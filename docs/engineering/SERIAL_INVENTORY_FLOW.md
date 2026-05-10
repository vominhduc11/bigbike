# Serial Inventory Flow — Engineering Reference

**See also:** `docs/business/SERIAL_INVENTORY_RULES.md` for business rules, `docs/migrations/SERIAL_ONLY_BACKFILL_GUIDE.md` for migration steps.

---

## Component Map

```
CheckoutService ──────────────────────────────────────────┐
PosOrderService ──────────────────────────────────────────┤
AdminOrderService ────────────────────────────────────────┤──► SerialLifecycleService
AdminReturnService ───────────────────────────────────────┤       │
OrderStockRestoreService (skip guard) ────────────────────┘       │
                                                                   ▼
                                                       ProductSerialJpaRepository
                                                       OrderLineItemSerialJpaRepository
                                                       ReturnItemSerialJpaRepository
                                                       WarrantyRecordJpaRepository
                                                       StockMovementJpaRepository
                                                                   │
                                                                   ▼ (DB trigger)
                                                       product_variants.quantity_on_hand
                                                       products.stock_quantity
```

---

## Checkout Flow (E-commerce)

```
User submits checkout
        │
        ▼
CheckoutService.syncPricesAndValidateStock()
  ├─ track_serials=true  → serialLifecycleService.countAvailable()
  └─ track_serials=false → variant.getQuantityOnHand()
        │ (stock OK)
        ▼
Save OrderLineItemEntities (MUST happen before reserve — bridge FK needs line item ID)
        │
        ▼
CheckoutService.applyStockForLineItems()
  ├─ track_serials=true  → SerialLifecycleService.reserveForOrderLine()
  │     • Picks FIFO IN_STOCK serials with FOR UPDATE SKIP LOCKED
  │     • Transitions IN_STOCK → RESERVED (sets reserved_until)
  │     • Creates order_line_item_serials bridge rows
  │     • Writes stock_movements ledger entry
  └─ track_serials=false → decrementVariantStock() (legacy)
        │
        ▼
Order status = PENDING_PAYMENT
```

## Order Completion

```
Admin sets order → COMPLETED
        │
        ▼
AdminOrderService.updateOrderStatus()
        │
        ▼
SerialLifecycleService.markSoldForOrder(orderId)
  • Finds all order_line_item_serials for this order
  • For each: RESERVED → SOLD
  • Creates warranty_records (start = today, end = today + warrantyMonths)
  • Writes stock_movements ledger entry
```

## Order Cancellation

```
Admin sets order → CANCELLED
        │
        ▼
AdminOrderService.updateOrderStatus()
  │
  ├─► SerialLifecycleService.releaseReservationForOrder(orderId, reason)
  │     • RESERVED → IN_STOCK, clears reserved_until
  │     • Writes stock_movements ledger entry
  │
  └─► OrderStockRestoreService.restoreForCancel()
        • doRestore() checks olisRepo.findByOrderLineItemId()
        • If bridge records exist (serial-tracked) → SKIP (trigger already restored qty)
        • Else → legacy qty restore
```

## Return Flow

```
Admin creates return → status = PENDING
        │
Admin sets return → RECEIVED
        │
        ▼
AdminReturnService.updateStatus()
        │
        ▼
SerialLifecycleService.receiveReturnForReturn(returnId)
  • SOLD → RETURNED
  • Creates return_item_serials bridge rows
        │
        ▼
Admin sets return → INSPECTION_PENDING (optional intermediate)
        │
        ▼
SerialLifecycleService.moveReturnedToInspection(returnId)
  • RETURNED → INSPECTION
        │
        ▼
Admin marks result per serial:
SerialLifecycleService.markInspectionResult(serialId, targetStatus, note)
  • INSPECTION → IN_STOCK | DAMAGED | SCRAPPED
  • note required for DAMAGED / SCRAPPED
  • IN_STOCK triggers DB trigger → qty_on_hand incremented
        │
Admin sets return → COMPLETED / REFUNDED
        │
        ▼
AdminReturnService.restoreStockForReturn()
  • Checks risRepo.findByReturnItemId()
  • If bridge records exist → SKIP (lifecycle service handled it)
  • Else → legacy qty restore
```

## POS Flow

```
POS staff submits order
        │
        ▼
PosOrderService (validates stock: countAvailable for serial-tracked)
        │
        ▼
Save OrderLineItemEntities
        │
        ▼
PosOrderService.applyPosStock()
  ├─ track_serials=true:
  │     SerialLifecycleService.reserveForOrderLine()  ← IN_STOCK → RESERVED
  │     SerialLifecycleService.markSoldForOrder()     ← RESERVED → SOLD (same tx)
  │     Creates warranty_records
  └─ track_serials=false → legacy qty decrement
        │
        ▼
Order status = COMPLETED (POS orders complete immediately)
```

## Reservation Cleanup Job

```
SerialReservationCleanupJob (every 60 s, configurable)
        │
        ▼
SerialLifecycleService.releaseExpiredReservations()
  • Finds RESERVED serials with reserved_until < NOW()
  • Skips serials linked to orders in COMPLETED / PROCESSING status
  • RESERVED → IN_STOCK (batch)
  • Returns count of released serials
```

---

## Repository: Key Methods

### `ProductSerialJpaRepository`

| Method | Purpose |
|---|---|
| `findAvailableForVariantWithLock(variantId, limit)` | `FOR UPDATE SKIP LOCKED`, FIFO by `received_at` |
| `findAvailableForProductNoVariantWithLock(productId, limit)` | Same, for product-level serials |
| `findByOrderId(orderId)` | All serials for an order (via bridge) |
| `findByOrderLineItemId(lineItemId)` | Serials for a single line item |
| `findByReturnId(returnId)` | All serials for a return (via bridge) |
| `countByVariant_IdAndStatusIn(...)` | Count available for stock check |

### `OrderLineItemSerialJpaRepository`

| Method | Purpose |
|---|---|
| `findByOrderLineItemId(id)` | Used by `OrderStockRestoreService` guard |
| `findByOrderId(orderId)` | Used by `markSoldForOrder`, `releaseReservationForOrder` |
| `existsBySerialId(id)` | Idempotency check |

### `ReturnItemSerialJpaRepository`

| Method | Purpose |
|---|---|
| `findByReturnItemId(id)` | Used by `AdminReturnService.restoreStockForReturn()` guard |
| `findByReturnId(returnId)` | Used by `receiveReturnForReturn`, `moveReturnedToInspection` |

---

## DB Trigger

`fn_sync_qty_from_serial_lifecycle` fires on `UPDATE` to `product_serials.status`. It recounts `IN_STOCK` serials for the affected `variant_id` / `product_id` and writes the result into `product_variants.quantity_on_hand` and `products.stock_quantity`. This is the only mechanism that changes `quantity_on_hand` for serial-tracked variants.

---

## Config Gates

| Gate | Location | Effect |
|---|---|---|
| `track_serials` (per variant/product) | `product_variants.track_serials` | Routes to serial or legacy path |
| `serial_inventory_only` (global) | `site_settings` | Blocks `adjustStock()` / `adjustProductStock()` |
| `reservation_ttl_minutes` | `site_settings` | Controls `reserved_until` TTL |
| `inventory.reservation.cleanup-interval-ms` | `application.properties` | Cleanup job interval |
