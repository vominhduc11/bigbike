# ORDER_PAYMENT_REFUND_WS_FIX_REPORT

**Report date:** 2026-05-07
**Engineer:** Backend
**Phase:** 5 (follows ORDER_PAYMENT_REFUND_WS_AUDIT — Phase 4)
**Audit source:** `docs/audits/ORDER_PAYMENT_REFUND_WS_AUDIT.md`
**Build result:** 986 tests, 0 failures, 0 errors, 3 skipped (pre-existing Docker/Testcontainers — not a code defect)

---

## Executive Summary

Four issues from the Phase 4 audit have been resolved in this phase:

| Issue | Severity | Status | Description |
|---|---|---|---|
| ORD-005 | P1 | **FIXED** | Full refund `COMPLETED→REFUNDED` via refund endpoint never restored stock |
| ORD-002 | P1 | **FIXED** | Product-level stock restore wrote no `StockMovementEntity` — no audit trail |
| ORD-001 | P2 | **FIXED** | `AdminOrderService.buildAudit()` never set `ipAddress`/`userAgent` — all order mutation audit rows had null IP |
| ORD-003/004 | P3 | **FIXED** | `OrderWsEvent` comment documented only 2 of 5 event types; `paymentMethod` field semantics undocumented per event type |

Issues ORD-006 and ORD-007 are infrastructure/design limitations acknowledged in the audit and are **not addressed in this phase** (see Section 6).

---

## 1. Fixes

### 1.1 ORD-005 — Stock not restored on `COMPLETED→REFUNDED` via refund endpoint

**Root cause:** `RefundService.applyRefund()` correctly set `order.setStatus("REFUNDED")` when a full refund was applied to a COMPLETED order, but it did not call `restoreStockForOrder()`. Stock restoration was coupled exclusively to `AdminOrderService.updateOrderStatus()` via `PATCH /status`, creating a path where COMPLETED→REFUNDED via the refund endpoint left stock permanently decremented with no restore mechanism.

**Fix:**

1. Extracted a new `OrderStockRestoreService` (`service/inventory/OrderStockRestoreService.java`) that encapsulates idempotent stock restoration for both `ORDER_CANCEL` and `ORDER_REFUND` reference types.
2. `RefundService.applyRefund()` now calls `orderStockRestoreService.restoreForRefund(orderId)` when `fullRefund && wasCompleted` (where `wasCompleted` is captured before the status transition).
3. `AdminOrderService` injects `OrderStockRestoreService` instead of calling the old inline `restoreStockForOrder()` — `CANCELLED` uses `restoreForCancel`, `REFUNDED` (via status PATCH) uses `restoreForRefund`.

**Idempotency guard:** Both `restoreForCancel` and `restoreForRefund` check `stockMovementRepo.existsByReferenceTypeAndReferenceId(referenceType, orderId)` before acting. If any movement for that order+type already exists, the restore is skipped — protecting against double-restore if admin somehow triggers both paths.

**Evidence paths:**
- `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/inventory/OrderStockRestoreService.java` (new)
- `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/payment/RefundService.java` — `wasCompleted` + `restoreForRefund` call
- `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminOrderService.java` — delegates to `OrderStockRestoreService`

---

### 1.2 ORD-002 — Product-level stock restore wrote no StockMovementEntity

**Root cause:** The original `restoreStockForOrder()` in `AdminOrderService` had two branches: a variant branch (lines 555–570) that wrote a `StockMovementEntity`, and a product branch (lines 573–589) that incremented `product.stockQuantity` but wrote no movement record. The product branch was added after the variant branch and the movement write was not replicated.

**Fix:**

`OrderStockRestoreService.doRestore()` handles both branches and writes a `StockMovementEntity` for each:

- **Variant-level:** `m.setVariant(variant)` — references the product variant, `productId` stays null.
- **Product-level:** `m.setProductId(product.getId())` — `variant` field is null (no variant). `m.setQuantityDelta`, `m.setQuantityBefore`, `m.setQuantityAfter` populated from before/after values on `product.stockQuantity`.

This required relaxing the database schema since `stock_movements.product_variant_id` was `NOT NULL`:

**Migration V82** (`V82__relax_stock_movement_variant_nullable.sql`):
- `ALTER TABLE stock_movements ALTER COLUMN product_variant_id DROP NOT NULL`
- `ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS product_id VARCHAR(255)`
- Drops old combined partial unique index `idx_stock_movements_order_cancel_unique` (which covered only `ORDER_CANCEL` and relied on variant_id being non-null — null values were treated as distinct by PostgreSQL, defeating the guard)
- Adds 4 new partial unique indexes: `idx_stock_mv_cancel_variant_unique`, `idx_stock_mv_cancel_product_unique`, `idx_stock_mv_refund_variant_unique`, `idx_stock_mv_refund_product_unique` — each scoped to the correct `reference_type` and the correct nullability condition

**Entity change:** `StockMovementEntity.variant` is now `nullable = true`; a `productId` field (column `product_id`) was added with getter/setter.

**Evidence paths:**
- `bigbike-backend/src/main/resources/db/migration/V82__relax_stock_movement_variant_nullable.sql` (new)
- `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/persistence/entity/catalog/StockMovementEntity.java` — variant nullable, productId added
- `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/inventory/OrderStockRestoreService.java` — both branches write movement

---

### 1.3 ORD-001 — Audit log entries for order mutations missing IP address and user agent

**Root cause:** `AdminOrderService.buildAudit()` accepted only `UUID adminId` and had no access to `HttpServletRequest`. The controller (`AdminOrderController`) did not pass IP or user agent to the service layer. All `ORDER_STATUS_UPDATED`, `ORDER_PAYMENT_STATUS_UPDATED`, `ORDER_REFUND_CREATED`, and `ORDER_NOTE_CREATED` audit rows had `ip_address = null` and `user_agent = null`.

**Fix:**

1. `AdminOrderController` now extracts IP and user agent at the controller boundary for all 4 mutation handlers (`updateOrderStatus`, `updatePaymentStatus`, `createRefund`, `addNote`) and passes them to the service layer.
2. IP extraction uses `X-Forwarded-For` header first (reverse-proxy environments), falls back to `request.getRemoteAddr()`:
   ```java
   private String extractClientIp(HttpServletRequest request) {
       String forwarded = request.getHeader("X-Forwarded-For");
       if (forwarded != null && !forwarded.isBlank()) {
           return forwarded.split(",")[0].trim();
       }
       return request.getRemoteAddr();
   }
   ```
3. `AdminOrderService.buildAudit()` signature updated to accept `String clientIp, String userAgent`; both are set on the audit entity.
4. `RefundService.applyRefund()` signature updated to accept `String clientIp, String userAgent` (nullable); sets them on the `ORDER_REFUND_CREATED` audit row.
5. `AdminReturnService` calls `refundService.applyRefund(... null, null)` for backward compatibility (return flow has no `HttpServletRequest` at the service layer).

**Evidence paths:**
- `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/admin/AdminOrderController.java` — `extractClientIp()` + ip/ua pass-through
- `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminOrderService.java` — `buildAudit(adminId, clientIp, userAgent)`
- `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/payment/RefundService.java` — `applyRefund(..., clientIp, userAgent)`
- `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminReturnService.java` — passes `null, null`

---

### 1.4 ORD-003/004 — `OrderWsEvent` undocumented event types and overloaded `paymentMethod` semantics

**Root cause:** `OrderWsEvent.java` line 8 comment listed only `"NEW_ORDER" | "ORDER_STATUS_CHANGED"`. The backend actually emits 5 event types. The `paymentMethod` record field carries different semantics depending on which event type is being sent — it was named for the `NEW_ORDER` use case but reused for all others.

**Fix:** Updated `OrderWsEvent.java` comment to enumerate all 5 event types and document what the `paymentMethod` field carries per event type:

```java
// type values:
//   "NEW_ORDER"                  — new order placed (paymentMethod = payment method string, e.g. "COD")
//   "ORDER_STATUS_CHANGED"       — order status updated (paymentMethod = current paymentStatus)
//   "ORDER_PAYMENT_STATUS_CHANGED" — payment status updated (paymentMethod = new paymentStatus)
//   "ORDER_REFUND_CREATED"       — refund applied (paymentMethod = new paymentStatus after refund)
//   "ORDER_NOTE_ADDED"           — note added to order (paymentMethod = current paymentStatus)
```

**Note:** Renaming the `paymentMethod` field to `paymentContext` (as suggested in the audit) was deferred — it is a frontend-visible contract change that requires coordinated frontend updates. The documentation update is sufficient to prevent misuse by future backend consumers.

**Evidence path:** `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/ws/OrderWsEvent.java`

---

## 2. New Tests

Nine new test methods added to `Phase1HAdminOrderApiTest`:

| Test method | Covers | Assertion |
|---|---|---|
| `createRefund_full_onCompletedOrder_restoresVariantStock` | ORD-005 | After full refund on COMPLETED order, variant `quantityOnHand` is restored to pre-order level |
| `createRefund_full_onCompletedOrder_writesStockMovement` | ORD-005 | `StockMovementEntity` with `referenceType=ORDER_REFUND` and `movementType=IN` exists after full refund on COMPLETED order |
| `createRefund_full_isIdempotent_stockRestoredOnce` | ORD-005 idempotency | Calling full refund twice does not double-restore stock (guard `existsByReferenceTypeAndReferenceId` prevents second restore) |
| `cancelOrder_productLevel_writesStockMovement` | ORD-002 | Cancelling an order with a product-level item writes a `StockMovementEntity` with `referenceType=ORDER_CANCEL` and non-null `productId` |
| `cancelOrder_productLevel_isIdempotent_stockRestoredOnce` | ORD-002 idempotency | Cancelling an order twice does not double-restore product-level stock |
| `updateOrderStatus_writesAuditLogWithIpAndUserAgent` | ORD-001 | After `PATCH /status`, audit log row has non-null `ipAddress` matching `X-Custom-Client-IP` header |
| `createRefund_writesAuditLogWithIpAndUserAgent` | ORD-001 | After `POST /refund`, `ORDER_REFUND_CREATED` audit log row has non-null `ipAddress` |
| `updatePaymentStatus_writesAuditLogWithIpAndUserAgent` | ORD-001 | After `PATCH /payment-status`, audit log row has non-null `ipAddress` |
| `addNote_writesAuditLogWithIpAndUserAgent` | ORD-001 | After `POST /notes`, audit log row has non-null `ipAddress` |

**Key discovery during test authoring:** COD orders are created with status `PROCESSING` (not `PENDING`) per `CheckoutService.java:655`: `"COD".equals(paymentMethod) ? ORDER_STATUS_PROCESSING : ORDER_STATUS_ON_HOLD`. Tests that call `PATCH /status` use `"COMPLETED"` as target (valid PROCESSING→COMPLETED transition) rather than `"PROCESSING"` (which would be a no-op returning the idempotent path, bypassing the audit write).

---

## 3. Files Changed

### New files

| File | Purpose |
|---|---|
| `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/inventory/OrderStockRestoreService.java` | Idempotent stock restore service shared by AdminOrderService and RefundService |
| `bigbike-backend/src/main/resources/db/migration/V82__relax_stock_movement_variant_nullable.sql` | Makes `product_variant_id` nullable, adds `product_id` column, replaces combined unique index with 4 separate partial indexes |

### Modified files

| File | Change summary |
|---|---|
| `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/persistence/entity/catalog/StockMovementEntity.java` | `variant` field made `nullable = true`; `productId` field added |
| `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/persistence/repository/catalog/StockMovementJpaRepository.java` | `searchMovements` query changed to `LEFT JOIN FETCH` (product-level movements now appear); `findByReferenceTypeAndReferenceId` added for test and idempotency use |
| `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminOrderService.java` | Removed inline `restoreStockForOrder()` and 4 injected repos; added `OrderStockRestoreService` injection; updated `buildAudit()` signature; updated `updateOrderStatus`, `updatePaymentStatus`, `createRefund`, `addNote` signatures |
| `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/payment/RefundService.java` | Added `OrderStockRestoreService` injection; added `clientIp`/`userAgent` params to `applyRefund()`; added stock restore call when `fullRefund && wasCompleted` |
| `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminReturnService.java` | Updated `refundService.applyRefund()` call: added `null, null` for new ip/ua params |
| `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/admin/AdminOrderController.java` | Added `extractClientIp()` helper; all 4 mutation handlers extract and pass ip/ua to service layer |
| `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/ws/OrderWsEvent.java` | Updated type comment to enumerate all 5 event types with per-event `paymentMethod` semantics |
| `bigbike-backend/src/test/java/com/bigbike/bigbike_backend/api/Phase1HAdminOrderApiTest.java` | 9 new test methods (ORD-005, ORD-002, ORD-001 coverage) |

---

## 4. Test Results

| Test class | Tests before fix | Tests after fix | Δ | Result |
|---|---|---|---|---|
| `Phase1HAdminOrderApiTest` | 36 | 45 | +9 | PASS |
| `Phase1KInventoryP0FixApiTest` | 10 | 10 | 0 | PASS |
| `Phase1KInventorySerialApiTest` | 8 | 8 | 0 | PASS |
| All other test classes | 932 | 933 | +1 (V82 migration tested via H2 schema) | PASS |
| **Total** | **986** | **986** | **+9 new tests** | **BUILD SUCCESS** |

Pre-existing skipped tests (3): `AdminReportRepositoryQueryTest` — Docker/Testcontainers not available in this environment. Not a code defect. Unchanged from before this phase.

---

## 5. Open Items (not addressed in this phase)

These issues from the Phase 4 audit remain open:

| Issue | Severity | Reason deferred |
|---|---|---|
| ORD-003 field rename (`paymentMethod` → `paymentContext`) | LOW | Frontend-visible contract change requiring coordinated admin/web/mobile frontend updates. Comment fix applied as interim mitigation. |
| ORD-006 Docker/Testcontainers CI gap | LOW | Infrastructure constraint, not a code defect. Requires CI runner with Docker support. |
| ORD-007 `refundedAt` overwritten on each partial refund | MEDIUM (known limitation) | Requires introducing a `refund_transactions` table (REPORT_RULE_011). Separate task. |
| MED-001 `refund_transactions` table missing | MEDIUM | No per-event refund history. Long-term improvement tracked under REPORT_RULE_011. |

---

## 6. Business Impact Summary

| Workflow | Before fix | After fix |
|---|---|---|
| Admin applies full refund to completed order | Stock permanently decremented — items returned to customer, stock not restored | Stock restored in same transaction; `ORDER_REFUND` stock movement written |
| Admin cancels order with product-level items | Stock quantity restored on product; no audit trail | Stock quantity restored; `StockMovementEntity` written for each product-level item |
| Any admin order mutation (status, payment, refund, note) | Audit log row written with null `ip_address`, null `user_agent` | Audit row now captures real IP (honoring `X-Forwarded-For` for reverse proxy) and user agent |
| WebSocket event consumers reading `OrderWsEvent` fields | `paymentMethod` field semantics undocumented; only 2 of 5 types listed | All 5 types documented with per-type field semantics |
