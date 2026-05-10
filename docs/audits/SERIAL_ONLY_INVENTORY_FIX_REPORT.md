# Serial-Only Inventory Fix Report

**Date:** 2026-05-10
**Based on audit:** `docs/audits/SERIAL_ONLY_INVENTORY_VERIFICATION.md`
**Prior verdict:** NOT_READY / BLOCKED (9 gaps identified)
**Post-fix status:** IMPLEMENTED (pending Phase 14 integration tests and Phase 10 Admin UI)

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

## Remaining Items

| Item | Status | Notes |
|---|---|---|
| Phase 14 — Integration tests | PENDING | 15 test cases specified; not yet written |
| Phase 10 — Admin UI hides manual adjust when gate enabled | PENDING | Frontend work |
| `AdminSerialService.validateTransition()` RESERVED→DAMAGED gap | DEFERRED | Identified in audit; tracked as separate bug |
| V91 — Drop orphan tables (`stock_receipt_serials`, `stock_movement_serials`) | DEFERRED | 30-day stability window; see `SERIAL_TABLE_CLEANUP_PLAN.md` |

---

## Files Created / Modified

### New (14 files)

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
```

### Modified (8 files)

```
bigbike-backend/src/main/java/.../persistence/repository/catalog/ProductSerialJpaRepository.java
bigbike-backend/src/main/java/.../service/checkout/CheckoutService.java
bigbike-backend/src/main/java/.../service/pos/PosOrderService.java
bigbike-backend/src/main/java/.../service/admin/AdminOrderService.java
bigbike-backend/src/main/java/.../service/admin/AdminReturnService.java
bigbike-backend/src/main/java/.../service/inventory/OrderStockRestoreService.java
bigbike-backend/src/main/java/.../service/inventory/InventoryPolicyService.java
bigbike-backend/src/main/java/.../service/admin/AdminInventoryService.java
bigbike-backend/src/main/java/.../api/admin/AdminInventoryController.java
```
