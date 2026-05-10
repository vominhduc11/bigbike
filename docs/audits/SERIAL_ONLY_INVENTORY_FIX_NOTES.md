# Serial-Only Inventory — Fix Notes

**Task:** Implement serial-number-as-source-of-truth for BigBike inventory.
**Triggered by:** `docs/audits/SERIAL_ONLY_INVENTORY_VERIFICATION.md` verdict: NOT_READY/BLOCKED.
**Implemented:** 2026-05-10

---

## Summary of Changes

### DB Migrations

| Migration | Description |
|---|---|
| `V90__add_serial_bridge_tables_and_warranty.sql` | Bridge tables `order_line_item_serials`, `return_item_serials`; `warranty_records`; seeds `serial_inventory_only=false`, `default_warranty_months=12` |

### New Entities

- `OrderLineItemSerialEntity` — `order_line_item_serials` bridge
- `ReturnItemSerialEntity` — `return_item_serials` bridge
- `WarrantyRecordEntity` — warranty records per serial

### New Repositories

- `OrderLineItemSerialJpaRepository`
- `ReturnItemSerialJpaRepository`
- `WarrantyRecordJpaRepository`

### New Services

- `SerialLifecycleService` — 8-method core service (reserve, markSold, release, receiveReturn, moveToInspection, markInspectionResult, releaseExpired, countAvailable)
- `AdminWarrantyService` — warranty CRUD (getBySerial, search, voidWarranty)
- `AdminSerialImportService` — bulk CSV-style import with duplicate detection

### New Controllers / Endpoints

- `POST /api/v1/admin/inventory/serials/import` (in `AdminInventoryController`)
- `GET /api/v1/admin/warranties/by-serial/{serialId}`
- `GET /api/v1/admin/warranties`
- `PATCH /api/v1/admin/warranties/{warrantyId}/void`

### New Jobs

- `SerialReservationCleanupJob` — `@Scheduled` every 60 s (configurable), releases expired RESERVED serials

### Modified Services

| Service | Change |
|---|---|
| `CheckoutService` | Serial reservation instead of qty decrement for `track_serials=true` variants |
| `PosOrderService` | Reserve + markSold immediately for serial-tracked POS orders |
| `AdminOrderService` | markSold on COMPLETED; release on CANCELLED |
| `OrderStockRestoreService` | Skip serial-tracked line items (bridge records present) |
| `AdminReturnService` | INSPECTION flow; skip serial-tracked return items in restore |
| `InventoryPolicyService` | Added `isSerialInventoryOnlyEnabled()` |
| `AdminInventoryService` | Guard `adjustStock()` and `adjustProductStock()` behind `serial_inventory_only` gate |

### Repository Additions (existing files)

- `ProductSerialJpaRepository` — `findAvailableForVariantWithLock()`, `findAvailableForProductNoVariantWithLock()`, `findByOrderId()`, `findByOrderLineItemId()`, `findByReturnId()`, `countByVariant_IdAndStatusIn()`, `countByProduct_IdAndVariantIsNullAndStatusIn()`

---

## Key Design Decisions

**DB trigger as sync mechanism:** `fn_sync_qty_from_serial_lifecycle` (V89) keeps `quantity_on_hand` consistent with `IN_STOCK` serial counts. Application code does NOT call `setQuantityOnHand()` for serial-tracked items — only the trigger does.

**Dual-path routing:** All stock-affecting paths check `variant.isTrackSerials()` (or `product.isTrackSerials()`). This allows per-product migration without forcing a big-bang switchover.

**FOR UPDATE SKIP LOCKED:** Serial reservation uses Postgres advisory locking via native SQL to be safe under concurrent checkout. Re-entrant calls check existing bridge records before inserting (idempotency).

**POS reserve+markSold in one tx:** POS orders are COMPLETED immediately; the `applyPosStock()` method reserves then marks sold in the same transaction, avoiding stale RESERVED state.

---

## Known Gaps / Out-of-Scope

- `AdminSerialService.validateTransition()` allows RESERVED→DAMAGED directly (identified in audit); not fixed in this task — tracked separately.
- Admin UI does not yet hide manual qty adjustment fields when `serial_inventory_only=true` — Phase 10 UI work is pending.
- Integration test suite (Phase 14) not yet written.
- Orphan tables `stock_receipt_serials` / `stock_movement_serials` deferred per `SERIAL_TABLE_CLEANUP_PLAN.md`.
