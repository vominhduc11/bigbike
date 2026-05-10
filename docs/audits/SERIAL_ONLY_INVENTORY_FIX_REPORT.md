# Serial-Only Inventory Fix Report

**Date:** 2026-05-10
**Based on audit:** `docs/audits/SERIAL_ONLY_INVENTORY_VERIFICATION.md`
**Prior verdict:** NOT_READY / BLOCKED (9 gaps identified)
**Post-fix status:** COMPLETE — all phases implemented and verified

---

## Gaps Resolved

| Gap (from audit) | Resolution |
|---|---|
| B01 — No bridge tables linking orders/returns to serials | Added `order_line_item_serials` and `return_item_serials` in V90 |
| B02 — No warranty module | Added `warranty_records` table, `WarrantyRecordEntity`, `AdminWarrantyService`, `AdminWarrantyController` |
| B03 — `CheckoutService` decrements qty directly | Refactored to call `SerialLifecycleService.reserveForOrderLine()` for serial-tracked variants |
| `PosOrderService` qty decrement | Replaced with `applyPosStock()` — reserve + markSold in one transaction |
| `AdminOrderService` no markSold on COMPLETED | Added `markSoldForOrder(orderId)` call on COMPLETED |
| `AdminOrderService` no release on CANCELLED | Added `releaseReservationForOrder()` call on CANCELLED |
| `OrderStockRestoreService` double-restores | Added bridge-record guard — skips serial-tracked line items |
| `AdminReturnService` no INSPECTION flow | Added `receiveReturnForReturn()` and `moveReturnedToInspection()` calls; return item restore skips serial-tracked |
| No `serial_inventory_only` gate | Added `isSerialInventoryOnlyEnabled()` to `InventoryPolicyService`; guards in `AdminInventoryService` |
| No expired reservation cleanup | Added `SerialReservationCleanupJob` (`@Scheduled`) |
| No serial bulk import | Added `AdminSerialImportService` + `POST /admin/inventory/serials/import` |

---

## Phase 14 — Integration Tests

**Status: COMPLETE** — 16 tests, 16 passed (2026-05-10)

File: `bigbike-backend/src/test/java/com/bigbike/bigbike_backend/api/Phase2FSerialInventoryTest.java`

| Test | Flow | Result |
|---|---|---|
| T01 | Add serial to variant → IN_STOCK count = 3 | PASS |
| T02 | Add serial to product (no variant) → IN_STOCK count = 2 | PASS |
| T03 | Checkout reserve → serial RESERVED, bridge record created | PASS |
| T04 | Oversell rejected → ConflictException, serial stays IN_STOCK | PASS |
| T05 | Concurrent checkout (2 threads, 1 serial) → exactly 1 RESERVED, no duplicate bridge | PASS |
| T06 | Order COMPLETED → serial SOLD, soldAt non-null | PASS |
| T07 | Order CANCELLED → serial back IN_STOCK, reservedUntil null | PASS |
| T08 | POS sale → serial SOLD immediately (no intermediate RESERVED) | PASS |
| T09 | Return RECEIVED → serial RETURNED; stock not immediately restored | PASS |
| T10 | Inspection pass → serial IN_STOCK, stock count increases | PASS |
| T11 | Inspection DAMAGED/SCRAPPED → not counted in stock, note required | PASS |
| T12 | Expired reservation cleanup → serial back IN_STOCK | PASS |
| T13 | Manual adjust blocked when `serial_inventory_only=true` → 400 SERIAL_INVENTORY_ONLY | PASS |
| T14 | Import: product with variants requires variantId → row rejected | PASS |
| T15 | Import: duplicate chassis rejected → DUPLICATE_IN_DB error | PASS |
| T16 | (additional) Variant track_serials flag default false in H2 | PASS |

**Bug found and fixed during testing:** `AdminInventoryService.adjustStock()` checked `variant.isTrackSerials()` before `isSerialInventoryOnlyEnabled()`, returning `SERIAL_TRACKED` instead of `SERIAL_INVENTORY_ONLY` when both conditions were true. Guard order swapped to match the product path (gate check first). See `RULE-SER-010`.

**Pre-existing fix (unblocked Phase1K):** `ProductEntity` and `ProductVariantEntity` `@Column(track_serials)` lacked `columnDefinition = "boolean not null default false"`, causing H2 `NOT NULL` violations for INSERTs that omitted the column. Added `columnDefinition` to both entities.

---

## Phase 10 — Admin UI Gate

**Status: COMPLETE** (2026-05-10)

Files modified:
- `bigbike-admin/src/lib/adminApi.js` — added `fetchSerialInventoryOnly()` (calls `GET /admin/settings/serial_inventory_only`, fails open)
- `bigbike-admin/src/screens/InventoryScreen.jsx` — gated manual adjust button, header button, StockInModal render; serial-only banner

Behaviour when `serial_inventory_only=true`:
- Header "Nhập hàng" button hidden
- Per-row action column shows "Quản lý serial" for all items (not "Nhập hàng")
- `openStockIn()` redirects to serial manage for any item when gate is on
- `StockInModal` not rendered (double guard)
- Blue info banner displayed: "Tồn kho đang được tính tự động từ serial. Không thể sửa số lượng thủ công."

Behaviour when `serial_inventory_only=false`:
- Backward-compatible; items with `trackSerials=true` still show "Quản lý serial"
- Items with `trackSerials=false` show legacy "Nhập hàng" button

Build: `npm run build` clean (3946 modules, no errors).

---

## Remaining Items

| Item | Status | Notes |
|---|---|---|
| `AdminSerialService.validateTransition()` RESERVED→DAMAGED gap | DEFERRED | Identified in audit; tracked as separate bug |
| V91 — Drop orphan tables (`stock_receipt_serials`, `stock_movement_serials`) | DEFERRED | 30-day stability window; see `SERIAL_TABLE_CLEANUP_PLAN.md` |

---

## Files Created / Modified

### New (15 files)

```
bigbike-backend/src/main/resources/db/migration/V90__add_serial_bridge_tables_and_warranty.sql
bigbike-backend/src/main/java/.../persistence/entity/commerce/order/OrderLineItemSerialEntity.java
bigbike-backend/src/main/java/.../persistence/entity/commerce/returns/ReturnItemSerialEntity.java
bigbike-backend/src/main/java/.../persistence/entity/commerce/warranty/WarrantyRecordEntity.java
bigbike-backend/src/main/java/.../persistence/repository/commerce/order/OrderLineItemSerialJpaRepository.java
bigbike-backend/src/main/java/.../persistence/repository/commerce/returns/ReturnItemSerialJpaRepository.java
bigbike-backend/src/main/java/.../persistence/repository/commerce/warranty/WarrantyRecordJpaRepository.java
bigbike-backend/src/main/java/.../service/inventory/SerialLifecycleService.java
bigbike-backend/src/main/java/.../service/inventory/SerialReservationCleanupJob.java
bigbike-backend/src/main/java/.../service/admin/AdminWarrantyService.java
bigbike-backend/src/main/java/.../service/admin/AdminSerialImportService.java
bigbike-backend/src/main/java/.../api/admin/AdminWarrantyController.java
bigbike-backend/src/main/java/.../api/admin/dto/warranty/WarrantyRecordResponse.java
bigbike-backend/src/main/java/.../api/admin/dto/inventory/SerialImportRequest.java
bigbike-backend/src/main/java/.../api/admin/dto/inventory/SerialImportRowRequest.java
bigbike-backend/src/main/java/.../api/admin/dto/inventory/SerialImportResponse.java
docs/migrations/SERIAL_ONLY_BACKFILL_GUIDE.md
docs/migrations/SERIAL_TABLE_CLEANUP_PLAN.md
docs/business/SERIAL_INVENTORY_RULES.md
docs/engineering/SERIAL_INVENTORY_FLOW.md
docs/audits/SERIAL_ONLY_INVENTORY_FIX_NOTES.md
docs/audits/SERIAL_ONLY_INVENTORY_FIX_REPORT.md
bigbike-backend/src/test/java/.../api/Phase2FSerialInventoryTest.java
```

### Modified (11 files)

```
bigbike-backend/src/main/java/.../persistence/repository/catalog/ProductSerialJpaRepository.java
bigbike-backend/src/main/java/.../persistence/entity/catalog/ProductEntity.java          (columnDefinition fix)
bigbike-backend/src/main/java/.../persistence/entity/catalog/ProductVariantEntity.java   (columnDefinition fix)
bigbike-backend/src/main/java/.../persistence/entity/settings/SiteSettingEntity.java     (@PrePersist/@PreUpdate)
bigbike-backend/src/main/java/.../service/checkout/CheckoutService.java
bigbike-backend/src/main/java/.../service/pos/PosOrderService.java
bigbike-backend/src/main/java/.../service/admin/AdminOrderService.java
bigbike-backend/src/main/java/.../service/admin/AdminReturnService.java
bigbike-backend/src/main/java/.../service/admin/AdminInventoryService.java               (guard order fix)
bigbike-backend/src/main/java/.../service/inventory/OrderStockRestoreService.java
bigbike-backend/src/main/java/.../service/inventory/InventoryPolicyService.java
bigbike-backend/src/main/java/.../api/admin/AdminInventoryController.java
bigbike-admin/src/lib/adminApi.js
bigbike-admin/src/screens/InventoryScreen.jsx
```
