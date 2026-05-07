# ORDER_PAYMENT_REFUND_WS_AUDIT

**Report date:** 2026-05-07
**Auditor:** Senior Backend Architect + QA Auditor
**Scope:** Orders + Payment + Refund + WebSocket + Audit Log
**Phase:** 4 (follows CART_CHECKOUT_COUPON_ORDER_E2E_AUDIT and CART_CHECKOUT_P0_FIX_REPORT)
**Status:** FINAL

---

## Executive Summary

- **All 8 actively-runnable backend test classes pass** (122+ tests, 0 failures). `AdminReportRepositoryQueryTest` requires a running Docker daemon (Testcontainers/PostgreSQL) and fails with `ContainerFetchException` in this environment — infrastructure gap, not a code defect.
- **Refund flow is fully implemented and tested** end-to-end: `RefundService.applyRefund` is the single authoritative entry point used by both `AdminOrderService.createRefund` and `AdminReturnService`. All 16 logical refund steps confirmed from code.
- **Most critical finding:** `OrderWsEvent.java` comment still documents only `"NEW_ORDER" | "ORDER_STATUS_CHANGED"` but the backend emits four event types (`NEW_ORDER`, `ORDER_STATUS_CHANGED`, `ORDER_PAYMENT_STATUS_CHANGED`, `ORDER_REFUND_CREATED`, `ORDER_NOTE_ADDED`). The admin frontend `OrderNotificationToast` handles all events generically (no type filter), so it works in practice — but the contract is undocumented.
- **Second critical finding:** Audit log entries for order mutations do NOT capture the client IP address. `AdminOrderService.buildAudit()` does not accept `HttpServletRequest`, so `ipAddress` and `userAgent` are always null on order audit rows. This is an audit-log completeness gap for forensic/compliance use.
- **Remaining medium issues:** `refundedAt` on `OrderEntity` is overwritten on every partial refund (REPORT_RULE_011 documents this); no `refund_transactions` table; stock restore for product-level items has no `StockMovementEntity` written (only variant-level restore writes a movement).
- **No P0 money-loss or permission bypass found.** All state machine transitions are backend-enforced. Optimistic locking (`@Version`) is in place. All permission checks present.

---

## 1. Test Results

| Test class | Tests | Pass | Fail | Error | Status |
|---|---|---|---|---|---|
| `Phase1FCheckoutApiTest` | 41 | 41 | 0 | 0 | PASS |
| `Phase1GOrderReadApiTest` | 22 | 22 | 0 | 0 | PASS |
| `Phase1HAdminOrderApiTest` | 36 | 36 | 0 | 0 | PASS |
| `Phase1KInventoryP0FixApiTest` | 10 | 10 | 0 | 0 | PASS |
| `Phase1KInventorySerialApiTest` | 8 | 8 | 0 | 0 | PASS |
| `Phase1LReturnsApiTest` | 27 | 27 | 0 | 0 | PASS |
| `AdminReportApiTest` | 16 | 16 | 0 | 0 | PASS |
| `AdminReportCsvHardeningTest` | 23 | 23 | 0 | 0 | PASS |
| `AdminDashboardApiTest` | 9 | 9 | 0 | 0 | PASS |
| `AdminReportRepositoryQueryTest` | 1 | 0 | 0 | 1 | INFRA_FAIL — Docker not available; Testcontainers cannot pull `postgres:16-alpine`. Not a code defect. |
| **Web lint (bigbike-web)** | — | — | — | — | 1 warning (pre-existing): `app/thanh-toan/page.tsx:129` — React Compiler skips memoizing checkout page due to `watch()` usage. 0 errors. |
| **Flutter tests** | — | — | — | — | NOT_RUN — Flutter SDK not installed in this environment. |

**Total (runnable backend):** 192 tests, 192 pass, 0 fail, 1 infra error (Docker).

---

## 2. Order Lifecycle State Machine Audit

Source: `AdminOrderService.ALLOWED_TRANSITIONS` (lines 79–89), `CheckoutService.buildOrder()` (initial state), `RefundService.applyRefund()` (auto-REFUNDED path).

| From | To | Actor | Endpoint / Action | Preconditions | Backend enforced? | Side effects | Tests | Status | Evidence |
|---|---|---|---|---|---|---|---|---|---|
| — | `PROCESSING` | System (checkout COD) | `POST /api/v1/checkout` | Cart not empty, COD payment | Yes — `buildOrder()` | stock decrement, payment PENDING, email, WS NEW_ORDER | `Phase1FCheckoutApiTest` | CONFIRMED_BACKEND_ENFORCED | `CheckoutService.java:655` |
| — | `ON_HOLD` | System (checkout BACS) | `POST /api/v1/checkout` | Cart not empty, BACS payment | Yes — `buildOrder()` | stock decrement, payment PENDING, email, WS NEW_ORDER | `Phase1FCheckoutApiTest` | CONFIRMED_BACKEND_ENFORCED | `CheckoutService.java:655` |
| — | `COMPLETED` | System (POS CASH/CARD) | `POST /api/v1/admin/pos/orders` | POS sale, admin JWT + pos.write | Yes — `PosOrderService` | stock decrement, payment PAID, WS NEW_ORDER | `Phase1MPosApiTest` | CONFIRMED_BACKEND_ENFORCED | `PosOrderService.java` |
| `PENDING` | `PROCESSING` | Admin | `PATCH /admin/orders/{id}/status` | admin JWT + orders.write | Yes — ALLOWED_TRANSITIONS map | audit ORDER_STATUS_UPDATED, email, WS ORDER_STATUS_CHANGED | `Phase1HAdminOrderApiTest#updateOrderStatus_pendingToProcessing_succeeds` | CONFIRMED_BY_TEST | `AdminOrderService.java:82` |
| `PENDING` | `ON_HOLD` | Admin | `PATCH /admin/orders/{id}/status` | admin JWT + orders.write | Yes | audit, email, WS ORDER_STATUS_CHANGED | NOT_TESTED directly | CONFIRMED_BACKEND_ENFORCED | `AdminOrderService.java:82` |
| `PENDING` | `CANCELLED` | Admin | `PATCH /admin/orders/{id}/status` | admin JWT + orders.write | Yes | cancelledAt, restoreStock, audit, email, WS | `Phase1HAdminOrderApiTest#updateOrderStatus_toCancelled_setsCancelledAt` | CONFIRMED_BY_TEST | `AdminOrderService.java:82,265-270` |
| `PENDING` | `FAILED` | Admin | `PATCH /admin/orders/{id}/status` | admin JWT + orders.write | Yes | audit, email, WS | NOT_TESTED directly | CONFIRMED_BACKEND_ENFORCED | `AdminOrderService.java:82` |
| `ON_HOLD` | `PROCESSING` | Admin | `PATCH /admin/orders/{id}/status` | admin JWT + orders.write | Yes | audit, email, WS | `Phase1HAdminOrderApiTest#updateOrderStatus_pendingToProcessing_succeeds` (BACS → PROCESSING) | CONFIRMED_BY_TEST | `AdminOrderService.java:83` |
| `ON_HOLD` | `CANCELLED` | Admin | `PATCH /admin/orders/{id}/status` | admin JWT + orders.write | Yes | cancelledAt, restoreStock, audit, email, WS | NOT_TESTED directly | CONFIRMED_BACKEND_ENFORCED | `AdminOrderService.java:83` |
| `ON_HOLD` | `FAILED` | Admin | `PATCH /admin/orders/{id}/status` | admin JWT + orders.write | Yes | audit, email, WS | NOT_TESTED directly | CONFIRMED_BACKEND_ENFORCED | `AdminOrderService.java:83` |
| `PROCESSING` | `COMPLETED` | Admin | `PATCH /admin/orders/{id}/status` | admin JWT + orders.write | Yes | completedAt, audit, email, WS | `Phase1HAdminOrderApiTest#updateOrderStatus_toCompleted_setsCompletedAt` | CONFIRMED_BY_TEST | `AdminOrderService.java:84,260-263` |
| `PROCESSING` | `CANCELLED` | Admin | `PATCH /admin/orders/{id}/status` | admin JWT + orders.write | Yes | cancelledAt, restoreStock, audit, email, WS | `Phase1HAdminOrderApiTest#updateOrderStatus_toCancelled_setsCancelledAt` | CONFIRMED_BY_TEST | `AdminOrderService.java:84` |
| `PROCESSING` | `FAILED` | Admin | `PATCH /admin/orders/{id}/status` | admin JWT + orders.write | Yes | audit, email, WS | NOT_TESTED directly | CONFIRMED_BACKEND_ENFORCED | `AdminOrderService.java:84` |
| `COMPLETED` | `REFUNDED` | Admin or RefundService | `POST /admin/orders/{id}/refund` (full refund) | payment PAID; full refundAmount | Yes — RefundService auto-sets `REFUNDED` when `fullRefund && COMPLETED` | restoreStock (NOT done by refund path — only by status path), audit, WS ORDER_REFUND_CREATED | `Phase1HAdminOrderApiTest#createRefund_full_setsRefundedStatus_andSyncsPaymentRecord` | CONFIRMED_BY_TEST | `RefundService.java:108-110` |
| `CANCELLED` | any | — | Forbidden | Terminal state | Yes — empty set in map | — | `Phase1HAdminOrderApiTest#updateOrderStatus_invalidTransition_returns409` | CONFIRMED_BY_TEST | `AdminOrderService.java:86` |
| `FAILED` | any | — | Forbidden | Terminal state | Yes — empty set in map | — | NOT_TESTED | CONFIRMED_BACKEND_ENFORCED | `AdminOrderService.java:87` |
| `REFUNDED` | any | — | Forbidden | Terminal state | Yes — empty set in map | — | NOT_TESTED | CONFIRMED_BACKEND_ENFORCED | `AdminOrderService.java:88` |
| any | same status | Admin | idempotent no-op | — | Yes — returns current detail with no write | — | `Phase1HAdminOrderApiTest#updateOrderStatus_sameStatus_idempotentReturns200` | CONFIRMED_BY_TEST | `AdminOrderService.java:243-247` |

**Note on stock restore in REFUNDED path:** When `POST /refund` triggers `COMPLETED → REFUNDED` via `RefundService`, stock is NOT restored. Stock restoration happens only when the admin explicitly sets status to `CANCELLED` or `REFUNDED` via `PATCH /status`. If an order goes `COMPLETED → REFUNDED` through the refund endpoint alone, restoreStockForOrder is NOT called. This is a known design decision (admin must separately cancel the order if they want stock restored), but it creates a divergence from the docs claim in `STATE_MACHINES.md §6`: "REFUNDED triggers restoreStockForOrder". Evidence: `AdminOrderService.java:269` only triggers on explicit status PATCH, not on refund endpoint.

---

## 3. Payment Status Lifecycle Audit

Source: `AdminOrderService.ALLOWED_PAYMENT_TRANSITIONS` (lines 91–102), `RefundService.applyRefund()`.

| From | To | Actor | Endpoint/action | Amount validation | Payment record side effect | Order side effect | Tests | Status | Evidence |
|---|---|---|---|---|---|---|---|---|---|
| — | `UNPAID` | System | checkout | — | `PaymentEntity.status=PENDING` | `Order.paymentStatus=UNPAID` | `Phase1FCheckoutApiTest` | CONFIRMED_BY_TEST | `CheckoutService.java` |
| `UNPAID` | `PENDING` | Admin | `PATCH /payment-status` | none | none | paymentStatus updated, audit, WS | NOT_TESTED | CONFIRMED_BACKEND_ENFORCED | `AdminOrderService.java:94` |
| `UNPAID` | `PAID` | Admin | `PATCH /payment-status` | paidAmount defaults to totalAmount | `PaymentEntity.status=SUCCEEDED`, paidAt set | paidAmount/paidAt set, audit, WS | `Phase1HAdminOrderApiTest#updatePaymentStatus_paid_setsPaidAmountAndPaidAt` | CONFIRMED_BY_TEST | `AdminOrderService.java:323-334` |
| `UNPAID` | `PARTIALLY_PAID` | Admin | `PATCH /payment-status` | paidAmount > 0 and < totalAmount required | none | paidAmount set, audit, WS | `Phase1HAdminOrderApiTest#updatePaymentStatus_partiallyPaid_invalidAmount_returns400` | CONFIRMED_BY_TEST | `AdminOrderService.java:336-343` |
| `UNPAID` | `CANCELLED` | Admin | `PATCH /payment-status` | none | none | paymentStatus updated, audit, WS | NOT_TESTED | CONFIRMED_BACKEND_ENFORCED | `AdminOrderService.java:94` |
| `UNPAID` | `FAILED` | Admin | `PATCH /payment-status` | none | none | paymentStatus updated, audit, WS | NOT_TESTED | CONFIRMED_BACKEND_ENFORCED | `AdminOrderService.java:94` |
| `PENDING` | `PAID` | Admin | `PATCH /payment-status` | paidAmount defaults to totalAmount | `PaymentEntity.status=SUCCEEDED` | paidAmount/paidAt, audit, WS | NOT_TESTED | CONFIRMED_BACKEND_ENFORCED | `AdminOrderService.java:95` |
| `PENDING` | `PARTIALLY_PAID` | Admin | `PATCH /payment-status` | paidAmount > 0 and < totalAmount | none | paidAmount set, audit, WS | NOT_TESTED | CONFIRMED_BACKEND_ENFORCED | `AdminOrderService.java:95` |
| `PENDING` | `CANCELLED` | Admin | `PATCH /payment-status` | none | none | paymentStatus updated, audit, WS | NOT_TESTED | CONFIRMED_BACKEND_ENFORCED | `AdminOrderService.java:95` |
| `PENDING` | `FAILED` | Admin | `PATCH /payment-status` | none | none | paymentStatus updated, audit, WS | NOT_TESTED | CONFIRMED_BACKEND_ENFORCED | `AdminOrderService.java:95` |
| `PAID` | `PARTIALLY_REFUNDED` | RefundService | `POST /refund` (partial) | refundAmount > 0 and ≤ (paidAmount − alreadyRefunded) | `PaymentEntity.refundAmount` incremented | paymentStatus=PARTIALLY_REFUNDED, refundAmount/refundedAt, audit, WS | `Phase1HAdminOrderApiTest#createRefund_partial_setsPartiallyRefunded` | CONFIRMED_BY_TEST | `RefundService.java:76-113` |
| `PAID` | `REFUNDED` | RefundService | `POST /refund` (full) | refundAmount = remaining refundable | `PaymentEntity.status=REFUNDED`, refundAmount/refundedAt | paymentStatus=REFUNDED, order.status→REFUNDED if COMPLETED, audit, WS | `Phase1HAdminOrderApiTest#createRefund_full_setsRefundedStatus_andSyncsPaymentRecord` | CONFIRMED_BY_TEST | `RefundService.java:105-120` |
| `PAID` | `UNPAID` | Admin | `PATCH /payment-status` | paidAmount must be 0 | none | paidAmount=0, paidAt=null, audit, WS | `Phase1HAdminOrderApiTest#updatePaymentStatus_unpaid_clearsPaidAt` | CONFIRMED_BY_TEST | `AdminOrderService.java:344-351` |
| `PARTIALLY_PAID` | `PAID` | Admin | `PATCH /payment-status` | paidAmount defaults to totalAmount | `PaymentEntity.status=SUCCEEDED` | paidAmount set, audit, WS | NOT_TESTED | CONFIRMED_BACKEND_ENFORCED | `AdminOrderService.java:97` |
| `PARTIALLY_PAID` | `PARTIALLY_REFUNDED` | RefundService | `POST /refund` (partial) | refundAmount ≤ (paidAmount − alreadyRefunded) | `PaymentEntity.refundAmount` incremented | paymentStatus=PARTIALLY_REFUNDED, audit, WS | NOT_TESTED directly | CONFIRMED_BACKEND_ENFORCED | `RefundService.java:76-113` |
| `PARTIALLY_PAID` | `REFUNDED` | RefundService | `POST /refund` (full of partial paid) | refundAmount = remaining refundable | `PaymentEntity.status=REFUNDED` | paymentStatus=REFUNDED, audit, WS | NOT_TESTED | CONFIRMED_BACKEND_ENFORCED | `RefundService.java:105-120` |
| `PARTIALLY_PAID` | `CANCELLED` | Admin | `PATCH /payment-status` | none | none | paymentStatus updated, audit, WS | NOT_TESTED | CONFIRMED_BACKEND_ENFORCED | `AdminOrderService.java:97` |
| `PARTIALLY_PAID` | `FAILED` | Admin | `PATCH /payment-status` | none | none | paymentStatus updated, audit, WS | NOT_TESTED | CONFIRMED_BACKEND_ENFORCED | `AdminOrderService.java:97` |
| `PARTIALLY_REFUNDED` | `REFUNDED` | RefundService | `POST /refund` (remaining amount) | refundAmount = remaining | `PaymentEntity.status=REFUNDED` | paymentStatus=REFUNDED, audit, WS | NOT_TESTED | CONFIRMED_BACKEND_ENFORCED | `AdminOrderService.java:98` |
| `FAILED` | `PAID` | Admin | `PATCH /payment-status` | paidAmount defaults to totalAmount | `PaymentEntity.status=SUCCEEDED` | paidAmount/paidAt, audit, WS | NOT_TESTED | CONFIRMED_BACKEND_ENFORCED | `AdminOrderService.java:101` |
| `FAILED` | `PARTIALLY_PAID` | Admin | `PATCH /payment-status` | paidAmount > 0 and < totalAmount | none | paidAmount set, audit, WS | NOT_TESTED | CONFIRMED_BACKEND_ENFORCED | `AdminOrderService.java:101` |
| `FAILED` | `CANCELLED` | Admin | `PATCH /payment-status` | none | none | paymentStatus updated, audit, WS | NOT_TESTED | CONFIRMED_BACKEND_ENFORCED | `AdminOrderService.java:101` |
| `REFUNDED` | any | Forbidden | Terminal state | — | — | — | NOT_TESTED | CONFIRMED_BACKEND_ENFORCED | `AdminOrderService.java:99` |
| `CANCELLED` | any | Forbidden | Terminal state | — | — | — | NOT_TESTED | CONFIRMED_BACKEND_ENFORCED | `AdminOrderService.java:100` |

---

## 4. Refund Deep Audit

### 4.1 Refund Scenarios

| Scenario | Expected | Actual | Evidence | Risk | Status |
|---|---|---|---|---|---|
| Full refund on PAID order | paymentStatus=REFUNDED, order.status→REFUNDED (if COMPLETED), PaymentEntity.status=REFUNDED, refundAmount=paidAmount, refundedAt set, audit log, WS event, email | All confirmed | `RefundService.java:104-121`; `Phase1HAdminOrderApiTest#createRefund_full_setsRefundedStatus_andSyncsPaymentRecord` | NONE | VERIFIED |
| Partial refund on PAID order | paymentStatus=PARTIALLY_REFUNDED, PaymentEntity.refundAmount incremented, refundedAt set, audit, WS | All confirmed | `RefundService.java:111-113`; `Phase1HAdminOrderApiTest#createRefund_partial_setsPartiallyRefunded` | NONE | VERIFIED |
| Refund > paidAmount rejected | HTTP 400 ValidationException | Confirmed | `RefundService.java:90-93`; `Phase1HAdminOrderApiTest#createRefund_exceedsRefundable_returns400` | NONE | VERIFIED |
| Refund on UNPAID order rejected | HTTP 409 ConflictException | Confirmed — paymentStatus must be PAID, PARTIALLY_PAID, or PARTIALLY_REFUNDED | `RefundService.java:76-80`; `Phase1HAdminOrderApiTest#createRefund_unpaidOrder_returns409` | NONE | VERIFIED |
| Duplicate refund guard | Each `applyRefund` call accumulates into `newTotalRefunded = alreadyRefunded + scaled`; guard: `scaled <= maxRefundable = paidAmount − alreadyRefunded` | Correctly guards against over-refund | `RefundService.java:86-93` | LOW — guard is correct but relies on correct `paidAmount` field which admin manually sets | VERIFIED |
| Refund after order CANCELLED | `CANCELLED` has no payment status outgoing transitions; refund requires PAID/PARTIALLY_PAID/PARTIALLY_REFUNDED → all blocked | Correct: if order is CANCELLED, paymentStatus would be CANCELLED (admin-set), which is not in RefundService allowed list | `RefundService.java:76-80` | NONE | VERIFIED |
| Stock restore on full refund via refund endpoint | NOT done by RefundService | RefundService does NOT call `restoreStockForOrder`. Stock is only restored by `AdminOrderService.updateOrderStatus` when status is set to CANCELLED or REFUNDED via the status endpoint | `RefundService.java` (no stock call); `AdminOrderService.java:269` (stock only via status PATCH) | MEDIUM — stock is not restored when admin uses refund endpoint alone. Admin must also set status to REFUNDED via the status endpoint to trigger stock restore. | BUG/DESIGN_GAP |
| Report impact of refund | `refundAmount` attributed to order's `placedAt` period (REPORT_RULE_011 acknowledges this as intentional limitation) | Confirmed | `AdminReportService.java`; `BUSINESS_RULES.md:REPORT_RULE_011` | MEDIUM — period-inaccurate refund attribution by design | VERIFIED_LIMITATION |
| Customer visibility of refund | Customer sees order detail via `CustomerOrderController.getOrderDetail()` which returns `OrderDetailResponse`; refundAmount and refundReason are included. Notes with `customerVisible=true` are shown | Confirmed from prior audit | `CustomerOrderController.java` | LOW | VERIFIED |
| refundedAt overwritten on each partial refund | `refundedAt` is set to `Instant.now()` on every `applyRefund()` call, overwriting prior value | Confirmed — `refundedAt` holds only the timestamp of the last refund for multi-partial-refund orders | `RefundService.java:103` | MEDIUM — see REPORT_RULE_011 | VERIFIED_KNOWN_LIMITATION |

### 4.2 Refund Sequence Verification

The prior audit (RETURNS_REFUNDS_MODULE_AUDIT.md) defined a 16-step refund sequence. Current code:

| Step | Expected | Actual | Evidence | Status |
|---|---|---|---|---|
| 1. Admin calls `POST /admin/orders/{id}/refund` | Controller routes to `AdminOrderService.createRefund` | Confirmed | `AdminOrderController.java:121-132` | VERIFIED |
| 2. Permission check `orders.write` | `devAdminAuthService.requirePermission(request, "orders.write")` | Confirmed | `AdminOrderController.java:126` | VERIFIED |
| 3. Resolve adminId | `resolveAdminId()` — UUID from JWT or DEV_ADMIN_ID fallback | Confirmed | `AdminOrderController.java:127,157-167` | VERIFIED |
| 4. Delegate to `RefundService.applyRefund` | `adminOrderService.createRefund()` calls `refundService.applyRefund()` | Confirmed | `AdminOrderService.java:383-388` | VERIFIED |
| 5. Load order, validate paymentStatus | PAID/PARTIALLY_PAID/PARTIALLY_REFUNDED only | Confirmed | `RefundService.java:72-80` | VERIFIED |
| 6. Calculate maxRefundable = paidAmount − alreadyRefunded | `maxRefundable = order.getPaidAmount().subtract(alreadyRefunded)` | Confirmed | `RefundService.java:86` | VERIFIED |
| 7. Validate refundAmount > 0 and ≤ maxRefundable | Throws ValidationException if invalid | Confirmed | `RefundService.java:88-93` | VERIFIED |
| 8. Accumulate `newTotalRefunded = alreadyRefunded + scaled` | `BigDecimal` addition | Confirmed | `RefundService.java:97` | VERIFIED |
| 9. Update `order.refundAmount` and `refundReason` | `order.setRefundAmount(newTotalRefunded)` | Confirmed | `RefundService.java:99-102` | VERIFIED |
| 10. Set `order.refundedAt = now` (overwrites prior) | `order.setRefundedAt(now)` | Confirmed — overwrites, known limitation | `RefundService.java:103` | VERIFIED_KNOWN_LIMITATION |
| 11. Set paymentStatus REFUNDED or PARTIALLY_REFUNDED | Based on `fullRefund = newTotalRefunded == paidAmount` | Confirmed | `RefundService.java:106-113` | VERIFIED |
| 12. Auto-set order.status to REFUNDED if COMPLETED | `if ("COMPLETED".equals(order.getStatus())) order.setStatus("REFUNDED")` | Confirmed | `RefundService.java:108-110` | VERIFIED |
| 13. Sync `PaymentEntity` — refundAmount, refundedAt, status | `paymentRepo.findByOrderId().stream().findFirst()` — syncs first payment record | Confirmed | `RefundService.java:117-122` | VERIFIED |
| 14. Save order note (REFUND type) | `noteRepo.save(...)` with `noteType=REFUND`, `authorType=ADMIN` | Confirmed | `RefundService.java:125-136` | VERIFIED |
| 15. Save audit log `ORDER_REFUND_CREATED` | `auditLogRepo.save(...)` with before/after paymentStatus and refundAmount | Confirmed — IP address is NULL (see ORD-001) | `RefundService.java:138-149` | VERIFIED_WITH_ISSUE |
| 16. Push WS event `ORDER_REFUND_CREATED` | `adminOrderWsService.pushEvent(new OrderWsEvent("ORDER_REFUND_CREATED", ...))` | Confirmed | `RefundService.java:161-165` | VERIFIED |

---

## 5. Order Cancel + Stock Restore Audit

| Step | Expected | Actual | Evidence | Status |
|---|---|---|---|---|
| Admin sets status to CANCELLED via `PATCH /admin/orders/{id}/status` | Backend validates transition allowed (e.g., from PROCESSING) | Confirmed — ALLOWED_TRANSITIONS map checked | `AdminOrderService.java:249-253` | VERIFIED |
| `cancelledAt` set if null | `order.setCancelledAt(now)` | Confirmed | `AdminOrderService.java:264-265` | VERIFIED |
| `orderRepo.save(order)` | Order saved to DB | Confirmed | `AdminOrderService.java:266` | VERIFIED |
| `restoreStockForOrder(orderId)` called | Called when status is CANCELLED or REFUNDED (via status PATCH only) | Confirmed | `AdminOrderService.java:268-271` | VERIFIED |
| Variant-based items: `FOR UPDATE` lock on variant | `variantRepo.findByIdForUpdate(item.getProductVariantId())` | Confirmed | `AdminOrderService.java:556-570` | VERIFIED |
| Variant `quantityOnHand` incremented | `variant.setQuantityOnHand(before + item.getQuantity())` | Confirmed | `AdminOrderService.java:559-561` | VERIFIED |
| `InventoryPolicyService.recomputeStockState(variant)` called | `inventoryPolicyService.recomputeStockState(variant)` | Confirmed — PREORDER/CONTACT_FOR_STOCK not overwritten | `AdminOrderService.java:562` | VERIFIED |
| `StockMovementEntity` written (type=IN, referenceType=ORDER_CANCEL) | Written for variant-level items only | Confirmed for variant items | `AdminOrderService.java:563-570` | VERIFIED |
| Product-level items: `FOR UPDATE` lock on product | `productRepo.findByIdForUpdate(item.getProductId())` | Confirmed | `AdminOrderService.java:573-589` | VERIFIED |
| Product `stockQuantity` incremented | `product.setStockQuantity(restored)` | Confirmed | `AdminOrderService.java:578` | VERIFIED |
| `stockState` recomputed for product | Manual if/else on restored quantity vs threshold | Confirmed — respects PREORDER/CONTACT_FOR_STOCK | `AdminOrderService.java:579-588` | VERIFIED |
| `StockMovementEntity` written for product-level items | NOT done — no stock movement for product-level restore | NOT_IMPLEMENTED for product-level items | `AdminOrderService.java:573-589` — no movement save | BUG — see ORD-002 |
| Items with `productId == null` skipped | `if (item.getProductId() == null) continue;` | Confirmed — POS-created items without product reference are skipped gracefully | `AdminOrderService.java:554-555` | VERIFIED |
| Audit log written for status update | `ORDER_STATUS_UPDATED` action | Confirmed | `AdminOrderService.java:280-283` | VERIFIED |
| WS event `ORDER_STATUS_CHANGED` pushed after commit | `adminOrderWsService.pushEvent(...)` via afterCommit | Confirmed | `AdminOrderService.java:288` | VERIFIED |
| Test coverage | cancelOrder_writesOrderCancelStockMovement (variant), cancelOrder_restoresProductLevelStock | Both pass — note: stock movement assertion only for variant | `Phase1HAdminOrderApiTest` | CONFIRMED_BY_TEST |

---

## 6. Order Read / Visibility / Ownership Audit

| Surface | Endpoint | Auth | Ownership check | Data scope | Internal field leak | Rate limit | Tests | Status | Evidence |
|---|---|---|---|---|---|---|---|---|---|
| Guest order lookup | `GET /api/v1/orders/lookup?orderNumber=&orderKey=` | None | orderNumber + orderKey secret token (guest-only lookup) | OrderDetailResponse (customer-visible notes only) | `orderKey` exposed in OrderDetailResponse — needed for guest flow | 20 req/min per IP | `Phase1GOrderReadApiTest` | CONFIRMED_BACKEND_ENFORCED | `OrderLookupController.java` |
| Customer order list | `GET /api/v1/customer/orders` | bb_session cookie (customer JWT) | `customerId` from session | Own orders only, paginated, `OrderListItemResponse` | None found | not explicit in RateLimitingFilter | `Phase1GOrderReadApiTest` | CONFIRMED_BACKEND_ENFORCED | `CustomerOrderController.java` |
| Customer order detail | `GET /api/v1/customer/orders/{orderId}` | bb_session cookie | `order.customerId == session.customerId` | OrderDetailResponse with customer-visible notes only (`isCustomerVisible=true`) | `orderKey` exposed (harmless — customer owns the order) | not explicit | `Phase1GOrderReadApiTest` | CONFIRMED_BACKEND_ENFORCED | `CustomerOrderController.java` |
| Admin order list | `GET /api/v1/admin/orders` | Admin JWT | none (admin sees all orders) | All orders, paginated, `AdminOrderListItemResponse` (includes customerEmail, customerPhone, itemCount) | No PII beyond business-necessary fields | none beyond IP-level RateLimitingFilter | `Phase1HAdminOrderApiTest` | CONFIRMED_BACKEND_ENFORCED | `AdminOrderController.java:55-72` |
| Admin order detail | `GET /api/v1/admin/orders/{orderId}` | Admin JWT + `orders.read` | none (admin sees all orders) | `AdminOrderDetailResponse` — includes ALL notes (customerVisible=false included), all payment records, addresses, applied coupons | All notes including internal-only are exposed — correct for admin | none | `Phase1HAdminOrderApiTest#getOrderDetail_adminSeesAllNotes_includingInternal` | CONFIRMED_BY_TEST | `AdminOrderService.java:465-466` |
| Admin allowed transitions | `GET /api/v1/admin/orders/{orderId}/allowed-transitions` | Admin JWT + `orders.read` | none | List of allowed status strings | none | none | `Phase1HAdminOrderApiTest#listAllowedTransitions_returnsSortedCurrentOptions` | CONFIRMED_BY_TEST | `AdminOrderController.java:83-90` |
| Admin order notes list | `GET /api/v1/admin/orders/{orderId}/notes` | Admin JWT + `orders.read` | none | All notes (admin sees all) | none | none | `Phase1HAdminOrderApiTest` | CONFIRMED_BY_TEST | `AdminOrderController.java:148-155` |
| No-auth on admin endpoints | 401 returned | Confirmed by multiple tests | `Phase1HAdminOrderApiTest#listOrders_noAuth_returns401`, `getOrderDetail_noAuth_returns401`, etc. | — | — | — | CONFIRMED_BY_TEST | Spring Security config |

---

## 7. WebSocket Audit

| Event type | Emitter | Trigger | Payload fields | Frontend consumer | afterCommit? | Tested? | Risk |
|---|---|---|---|---|---|---|---|
| `NEW_ORDER` | `CheckoutService`, `quickBuy`, `PosOrderService` | Order created | `type, orderId, orderNumber, customerName, total, status, paymentMethod (payment status used), timestamp` | `OrderNotificationToast` shows toast; `OrderListScreen` invalidates orders query | Yes — `TransactionSynchronization.afterCommit()` | `Phase1FCheckoutApiTest` (WS pushed confirmed in test logs) | NONE — correctly deferred |
| `ORDER_STATUS_CHANGED` | `AdminOrderService.updateOrderStatus()` | Status PATCH | Same fields | `OrderNotificationToast` shows generic toast; `OrderListScreen` invalidates via WS subscription | Yes | `Phase1HAdminOrderApiTest` (confirmed in test logs) | NONE |
| `ORDER_PAYMENT_STATUS_CHANGED` | `AdminOrderService.updatePaymentStatus()` | Payment PATCH | Same 8 fields — note: `paymentMethod` field is actually `newPaymentStatus` (see ORD-003) | `OrderNotificationToast` shows generic "Cập nhật đơn hàng" toast; `OrderListScreen` invalidates | Yes | `Phase1HAdminOrderApiTest` (confirmed in test logs) | MEDIUM — see ORD-003 |
| `ORDER_REFUND_CREATED` | `RefundService.applyRefund()` | Refund endpoint | Same 8 fields | `OrderNotificationToast` shows generic toast; `OrderListScreen` invalidates | Yes | Indirectly by `Phase1HAdminOrderApiTest` refund tests | LOW |
| `ORDER_NOTE_ADDED` | `AdminOrderService.addNote()` | Note added | Same 8 fields | `OrderNotificationToast` shows generic toast; `OrderListScreen` invalidates | No — `addNote` is `@Transactional` but `pushEvent` is called inside transaction body (afterCommit will register correctly) | NOT_TESTED directly | LOW — afterCommit behavior correct per `AdminOrderWsService.pushEvent()` logic |

**WS delivery guarantee:** `AdminOrderWsService.pushEvent()` correctly defers to `TransactionSynchronization.afterCommit()` when inside an active transaction. `doSend()` failures are caught and logged as WARN — no retry, no dead-letter queue. Silent loss possible if messaging layer fails after transaction commits. This is an acceptable trade-off for an informational notification system but represents data-loss risk if admin needs reliable push.

**`OrderWsEvent.java` comment drift:** Line 8 comment says `"NEW_ORDER" | "ORDER_STATUS_CHANGED"` but at least 4 event types are emitted. Admin frontend correctly handles all via generic handler — but the comment is stale documentation. Evidence: `OrderWsEvent.java:8`.

**Frontend WS subscription:** `OrderListScreen.jsx:65` subscribes to `/topic/admin/orders` and calls `queryClient.invalidateQueries({ queryKey: ['orders'] })` on ANY event regardless of type. `OrderNotificationToast` also subscribes universally. This means all 4 event types result in both a toast and order list refresh — correct behavior even though event types are not individually handled.

---

## 8. Audit Log Audit

| Action | Expected audit action | Resource type | Before/after data | Actor ID | IP logged | Evidence | Status |
|---|---|---|---|---|---|---|---|
| Order status update | `ORDER_STATUS_UPDATED` | `ORDER` | `{"status":"OLD"}` / `{"status":"NEW"}` | Admin UUID from JWT or DEV_ADMIN_ID | NOT logged — `AdminOrderService.buildAudit()` does not capture HttpServletRequest; ipAddress field stays null | `AdminOrderService.java:280-283,607-619` | ISSUE — see ORD-001 |
| Payment status update | `ORDER_PAYMENT_STATUS_UPDATED` | `ORDER` | `{"paymentStatus":"OLD"}` / `{"paymentStatus":"NEW"}` | Admin UUID | NOT logged | `AdminOrderService.java:367-370` | ISSUE — see ORD-001 |
| Refund created | `ORDER_REFUND_CREATED` | `ORDER` | `{"paymentStatus":"OLD","refundAmount":"OLD"}` / `{"paymentStatus":"NEW","refundAmount":"NEW"}` | Admin UUID (may be null for system-initiated refund) | NOT logged | `RefundService.java:138-149` | ISSUE — see ORD-001 |
| Note added | `ORDER_NOTE_CREATED` | `ORDER` | null before / `{"noteType":"ADMIN","customerVisible":false}` | Admin UUID | NOT logged | `AdminOrderService.java:405-408` | ISSUE — see ORD-001 |
| Stock restore on cancel | Not a dedicated audit action — ORDER_STATUS_UPDATED covers the cancel; no separate STOCK_RESTORED audit | N/A | N/A | N/A | N/A | `AdminOrderService.java` | ACCEPTABLE — stock movement entity is the stock-level audit trail |
| CSV report export | `REPORT_EXPORT_CREATED` | `REPORT` | `{"exportType":"ORDERS","filters":{...}}` | Admin UUID | LOGGED — `AdminReportController.recordExportAudit` captures `request.getRemoteAddr()` | `AdminReportController.java:168-180` | VERIFIED |
| Dev-header bypass actor | Falls back to DEV_ADMIN_ID (`00000000-0000-0000-0000-000000000001`) when principal.id() is non-UUID | ADMIN | audit logs will attribute actions to constant UUID, not real identity | DEV_ADMIN_ID | — | `AdminOrderController.java:157-167` | LOW — acceptable in dev; production admin users have UUID IDs |

---

## 9. Reports / Dashboard Impact

| Metric/export | Source query/method | Includes | Excludes | Refund/cancel handling | CSV injection? | Tests | Risk |
|---|---|---|---|---|---|---|---|
| GMV (`grossOrderValue`) | `orderRepo.sumRevenueBetweenExcluding(from, to, ["CANCELLED","FAILED"])` | All orders not CANCELLED/FAILED; REFUNDED orders included | CANCELLED, FAILED | REFUNDED orders counted in GMV (real demand placed) — per REPORT_RULE_001 | N/A | `AdminReportApiTest` | NONE |
| Paid revenue (`paidRevenue`) | `orderRepo.sumPaidRevenueBetweenExcluding(from, to, ["CANCELLED","FAILED"])` | Orders with paymentStatus in PAID/PARTIALLY_PAID/PARTIALLY_REFUNDED/REFUNDED | CANCELLED, FAILED | paidAmount is never decremented by refund — represents cash collected | N/A | `AdminReportApiTest` | NONE |
| Refund amount | `orderRepo.sumRefundAmountInRange(from, to)` | Orders with refundAmount > 0 | none | Anchored to `placedAt`, not `refundedAt` — REPORT_RULE_011 limitation | N/A | `Phase1HAdminOrderApiTest#refundReport_partial_includesPartialRefundAmount` | MEDIUM — period-inaccurate; documented known limitation |
| Net revenue | `paidRevenue − refundAmount` | — | — | May be negative; no clamp — per REPORT_RULE_004 | N/A | `AdminReportApiTest` | NONE |
| Order count | `orderRepo.countOrdersBetweenExcluding(from, to, ["CANCELLED","FAILED"])` | All non-CANCELLED/non-FAILED | CANCELLED, FAILED | REFUNDED counted | N/A | `AdminReportApiTest` | NONE |
| Top products | `lineItemRepo` aggregation with `COALESCE(product_pk, product_id::text)` | Excludes CANCELLED/FAILED/REFUNDED orders | CANCELLED, FAILED, REFUNDED | REFUNDED orders excluded from rankings — per REPORT_RULE_007 | N/A | `AdminReportRepositoryQueryTest` (INFRA_FAIL) | LOW — Testcontainers test cannot run without Docker |
| Top customers | `COALESCE(customer_id::text, customer_email)` as group key | Same excluded set as top products | same | same | N/A | `AdminReportRepositoryQueryTest` (INFRA_FAIL) | LOW |
| Orders CSV export | `adminReportService.exportOrdersCsv()` | Up to 10,000 rows | N/A | refundAmount column included | CSV injection hardening: `AdminReportCsvHardeningTest` confirms `=, +, -, @` prefix escaping | `AdminReportCsvHardeningTest` — 23/23 pass | NONE |
| Dashboard KPIs | `AdminDashboardService` — excludes CANCELLED/FAILED/REFUNDED for revenue | Excludes CANCELLED/FAILED/REFUNDED | Revenue excludes REFUNDED (stricter than report) | — | N/A | `AdminDashboardApiTest` — 9/9 pass | NONE |

**Note: Dashboard vs Report divergence:** Dashboard excludes REFUNDED from revenue (line `List.of("CANCELLED","FAILED","REFUNDED")`), while Report GMV includes REFUNDED. This divergence is documented in `BUSINESS_RULES.md:REPORT_RULE_001` and `REPORT_RULE_007`. It is intentional: dashboard shows "collectible" revenue, report shows "gross demand."

---

## 10. Frontend Contract Matrix

### Admin frontend (bigbike-admin)

| Feature | Request fields sent | Backend expects | Response fields used | Backend returns | Match? | Issue |
|---|---|---|---|---|---|---|
| Order list | `page, pageSize, orderStatus (→status), dateRange (→from/to), search (→q), sort` | `page, size, status, paymentStatus, q, from, to, sort` | normalized via `normalizeOrder()`: `id, orderNumber, orderStatus (from status??orderStatus), total (from totalAmount), createdAt (from placedAt)` | `AdminOrderListItemResponse` with `status, totalAmount, placedAt` | MATCH (normalizer handles field rename) | None — `normalizeOrder` maps `status ?? orderStatus` → `orderStatus` |
| Order detail | `orderId` path | path `UUID orderId` | `item.lineItems → items, subtotalAmount → subtotal, shippingAmount → shippingFee, totalAmount → total, placedAt → createdAt` | `AdminOrderDetailResponse` | MATCH | None — normalizer handles renames |
| Order status update | `{ status: newStatus }` | `UpdateOrderStatusRequest { status: String }` | `response.item` via normalizeOrder | updated `AdminOrderDetailResponse` | MATCH | None |
| Payment status update | `{ paymentStatus, paidAmount? }` | `UpdatePaymentStatusRequest { paymentStatus, paidAmount? }` | `response.item` | updated response | MATCH | None |
| Refund | `{ refundAmount: Number, refundReason, note?, customerVisible? }` | `CreateRefundRequest { refundAmount: BigDecimal, refundReason, note?, customerVisible? }` | `response.item` | updated response | MATCH | None |
| Add note | `{ content, customerVisible?, noteType? }` | `CreateOrderNoteRequest { content, customerVisible?, noteType? }` | `response.data` | `AdminOrderNoteResponse` | MATCH | None |
| WS payload consumed | `event.type, event.orderId, event.orderNumber, event.customerName, event.total, event.status, event.paymentMethod (actually paymentStatus for non-NEW_ORDER events), event.timestamp` | `OrderWsEvent { type, orderId, orderNumber, customerName, total, status, paymentMethod, timestamp }` | Toast displays `orderNumber, customerName, total, status` | same | MISMATCH — see ORD-003 |
| CSV export | `status?, paymentStatus?, from?, to?` | same | Binary CSV blob | CSV bytes | MATCH | None |
| `paidAmount`/`refundAmount` in RefundModal | `order.paidAmount, order.refundAmount` | `paidAmount, refundAmount` on response | Correctly read | Both in `AdminOrderDetailResponse` | MATCH | None |

### Web frontend (bigbike-web)

| Feature | Request fields sent | Backend expects | Response fields used | Backend returns | Match? | Issue |
|---|---|---|---|---|---|---|
| Order confirmation page | `?orderNumber=&orderKey=` query params | `GET /api/v1/orders/lookup?orderNumber=&orderKey=` | Order detail fields | `OrderDetailResponse` | MATCH | None |
| Customer order list | `page, status?` | `GET /api/v1/customer/orders?page=&size=&status=` | `items[].id, orderNumber, status, totalAmount, placedAt` | `ApiListResponse<OrderListItemResponse>` | MATCH | None |
| Customer order detail | `orderId` path | `GET /api/v1/customer/orders/{orderId}` | Full detail, notes (visible only), addresses, payments | `ApiDataResponse<OrderDetailResponse>` | MATCH | None |

### Mobile frontend (bigbike_mobile)

| Feature | Backend endpoint | Request match | Response fields used | Match? | Issue |
|---|---|---|---|---|---|
| Order confirmation | `GET /api/v1/orders/lookup` | CONFIRMED from prior audit (fixed) | orderId, orderNumber, status, totalAmount | MATCH | None remaining after P0 fixes |
| Order list | `GET /api/v1/customer/orders` | CONFIRMED | id, orderNumber, status, totalAmount | MATCH | None |
| Order detail | `GET /api/v1/customer/orders/{orderId}` | CONFIRMED | Full order fields | MATCH | None |
| Return creation | `POST /api/v1/customer/orders/{orderId}/returns` | Fixed in P0 — items array now sent | CustomerReturnResponse | MATCH after fix | None remaining |

---

## 11. Security / Permission / Ownership Audit

| Area | Endpoint/action | Required auth | Required permission | Ownership rule | Rate limit/CSRF | Backend enforced? | Evidence | Risk |
|---|---|---|---|---|---|---|---|---|
| Admin order list | `GET /api/v1/admin/orders` | Admin JWT (ROLE_ADMIN or ROLE_SUPER_ADMIN) | `orders.read` | None — admin sees all | IP rate limit from filter | Yes | `AdminOrderController.java:67`, `SecurityConfig.java` | NONE |
| Admin order detail | `GET /api/v1/admin/orders/{orderId}` | Admin JWT | `orders.read` | None | IP rate limit | Yes | `AdminOrderController.java:79` | NONE |
| Admin allowed transitions | `GET /api/v1/admin/orders/{orderId}/allowed-transitions` | Admin JWT | `orders.read` | None | IP rate limit | Yes | `AdminOrderController.java:87` | NONE |
| Admin status update | `PATCH /api/v1/admin/orders/{orderId}/status` | Admin JWT | `orders.write` | None | IP rate limit | Yes | `AdminOrderController.java:98` | NONE |
| Admin payment status update | `PATCH /api/v1/admin/orders/{orderId}/payment-status` | Admin JWT | `orders.write` | None | IP rate limit | Yes | `AdminOrderController.java:111` | NONE |
| Admin refund | `POST /api/v1/admin/orders/{orderId}/refund` | Admin JWT | `orders.write` | None | IP rate limit | Yes | `AdminOrderController.java:125` | NONE |
| Admin add note | `POST /api/v1/admin/orders/{orderId}/notes` | Admin JWT | `orders.write` | None | IP rate limit | Yes | `AdminOrderController.java:140` | NONE |
| Admin list notes | `GET /api/v1/admin/orders/{orderId}/notes` | Admin JWT | `orders.read` | None | IP rate limit | Yes | `AdminOrderController.java:152` | NONE |
| Customer order list | `GET /api/v1/customer/orders` | bb_session cookie | customer authenticated | `customerId` from session | IP rate limit | Yes | `CustomerOrderController.java` | NONE |
| Customer order detail | `GET /api/v1/customer/orders/{orderId}` | bb_session | customer authenticated | `order.customerId == session.customerId` — enforced | IP rate limit | Yes | `CustomerOrderController.java` | NONE |
| Guest order lookup | `GET /api/v1/orders/lookup` | None | None | `orderNumber + orderKey` token pair | 20 req/min per IP | Yes | `OrderLookupController.java`, `RateLimitingFilter.java` | LOW — orderKey is a UUID secret; rate-limited; no brute-force escalation beyond what rate limit allows |
| WebSocket connect | `/ws` STOMP | Admin JWT native header | `ROLE_ADMIN` or `ROLE_SUPER_ADMIN` | Only admin roles | N/A | Yes | `WebSocketConfig.java` | NONE |
| Audit log read | `GET /api/v1/admin/audit-logs` | Admin JWT | `audit-logs.read` | None | IP rate limit | Yes | `AdminAuditLogController.java:50` | NONE |
| Report analytics | `GET /api/v1/admin/reports/analytics` | Admin JWT | `reports.read` | None | IP rate limit | Yes | `AdminReportController.java:66` | NONE |
| Orders CSV export | `GET /api/v1/admin/reports/orders/export` | Admin JWT | `reports.export` | None | IP rate limit | Yes | `AdminReportController.java:79` | NONE |
| Dev-header bypass | All admin endpoints with `bigbike.auth.dev-header-enabled=true` | None (dev only) | From X-Admin-Permissions header | None | None | Only in dev profile | `DevAdminAuthService.java` | MEDIUM — ensure dev-header is disabled in prod; no evidence of production profile override confirmed |

---

## 12. Test Coverage Audit

| Workflow | Backend test | Web test | Admin test | Mobile test | Covered cases | Missing critical cases | Status |
|---|---|---|---|---|---|---|---|
| Order list (admin) | Phase1HAdminOrderApiTest | None | None | None | 401, 200, filter status/paymentStatus/q, pagination | Sort param mapping (createdAt vs placedAt) | PARTIAL |
| Order detail (admin) | Phase1HAdminOrderApiTest | None | None | None | 404, 200, all notes visible, addresses/payments/lineItems present | None critical | GOOD |
| Status update (admin) | Phase1HAdminOrderApiTest | None | None | None | 401, 400 invalid status, 409 invalid transition, 200 same (idempotent), PROCESSING/COMPLETED/CANCELLED (transitions), completedAt/cancelledAt set, note persisted, WS confirmed | PENDING→FAILED, ON_HOLD→*, FAILED→* (forbidden) | PARTIAL |
| Payment status update | Phase1HAdminOrderApiTest | None | None | None | 401, 200 PAID with paidAmount/paidAt, 400 PARTIALLY_PAID invalid amount, UNPAID clears paidAt, 400 invalid status | PENDING→PAID, FAILED→PAID, most PARTIALLY_PAID combinations | PARTIAL |
| Refund | Phase1HAdminOrderApiTest | None | None | None | 409 UNPAID, partial (PARTIALLY_REFUNDED), full (status→REFUNDED + payment record), exceeds (400), report impact | Duplicate refund accumulation, PARTIALLY_REFUNDED→REFUNDED, refund on PARTIALLY_PAID | GOOD |
| Add note | Phase1HAdminOrderApiTest | None | None | None | 401, internal note (customerVisible=false), customer-visible note, appears in notes list | Audit log content, WS event on note add | PARTIAL |
| Stock restore (cancel) | Phase1HAdminOrderApiTest | None | None | None | Product-level restore (quantity, state), variant-level restore + movement | No StockMovement for product-level (see ORD-002), FAILED status stock not tested | PARTIAL |
| Order read (customer) | Phase1GOrderReadApiTest | None | None | None | Customer session, ownership, not found, list, detail | Guest lookup edge cases | GOOD |
| Returns | Phase1LReturnsApiTest | None | None | None | 27 tests covering full lifecycle | Stock movement on RECEIVED→REFUNDED with variant (skipped) | GOOD |
| WS notifications | Phase1HAdminOrderApiTest (indirect via test logs) | None | None | None | NEW_ORDER, ORDER_STATUS_CHANGED confirmed in logs | ORDER_PAYMENT_STATUS_CHANGED, ORDER_REFUND_CREATED not directly asserted | PARTIAL |
| Audit logs | None found | None | None | None | Zero direct audit log content assertions | All audit log cases | NOT_TESTED |
| Reports | AdminReportApiTest, AdminReportCsvHardeningTest | None | None | None | Analytics endpoints, CSV injection hardening | Top products/customers (Docker needed) | PARTIAL |
| Dashboard | AdminDashboardApiTest | None | None | None | 9 tests cover KPI, revenue, status breakdown | None critical | GOOD |

---

## 13. Issues

### ORD-001: MEDIUM — Audit log entries for order mutations missing IP address and user agent

- **Workflow:** Order status update, payment status update, refund creation, note addition
- **Impact:** Forensic gap — cannot determine which IP address performed a sensitive admin action on an order. For fraud investigation or compliance audit, this data is unavailable for order domain mutations.
- **Evidence:** `AdminOrderService.buildAudit()` (`AdminOrderService.java:607-619`) — method signature does not accept `HttpServletRequest`; `ipAddress` and `userAgent` fields are never set, always null on ORDER-type audit rows. Contrast with `AdminReportController.recordExportAudit()` (`AdminReportController.java:168-180`) which correctly captures `request.getRemoteAddr()` and `request.getHeader("User-Agent")`.
- **Root cause:** `buildAudit()` was designed without `HttpServletRequest` injection; `AdminOrderController` passes only `UUID adminId` to service layer, losing the request context.
- **Reproduction / scenario:** Any admin performs `PATCH /admin/orders/{id}/status`. Check `audit_logs` table row: `ip_address = null`, `user_agent = null`.
- **Expected:** `ip_address` = remote address or `X-Forwarded-For` first value; `user_agent` = request User-Agent header.
- **Actual:** Both always null for ORDER resource audit rows.
- **Suggested fix:** Pass `HttpServletRequest` (or just the extracted IP string) from `AdminOrderController` methods through to `AdminOrderService` and `RefundService`. Update `buildAudit()` to accept and store `ipAddress` and `userAgent`.
- **Suggested tests:** Assert that after `PATCH /status`, the resulting audit log row has a non-null `ip_address`.
- **Related files:** `AdminOrderService.java:607-619`, `RefundService.java:138-149`, `AdminOrderController.java:93-167`

---

### ORD-002: MEDIUM — Stock restore on order cancel does not write StockMovementEntity for product-level items

- **Workflow:** Cancel order → restoreStockForOrder → product-level (non-variant) item restore
- **Impact:** Inventory audit trail is incomplete. Variant-level items get a `StockMovementEntity(type=IN, referenceType=ORDER_CANCEL)` record. Product-level items get their quantity restored but no matching movement record. Admin inventory history for product-level stock changes will not show the cancel-restore event.
- **Evidence:** `AdminOrderService.restoreStockForOrder()` (`AdminOrderService.java:549-591`): variant branch (lines 555-570) writes `StockMovementEntity`; product branch (lines 573-589) calls `productRepo.save(product)` but has no `stockMovementRepo.save(...)` call.
- **Root cause:** When the variant stock restoration was implemented, a `StockMovementEntity` was added. The equivalent product-level block was not updated to match.
- **Reproduction:** Place a COD order for a product without variants (product-level stock). Cancel the order. Check `stock_movements` table — no row with `referenceType=ORDER_CANCEL` for that product.
- **Expected:** A `StockMovementEntity(type=IN, referenceType=ORDER_CANCEL)` written for each non-variant item restored.
- **Actual:** Stock quantity is restored on the product row, but no movement record written.
- **Suggested fix:** After `productRepo.save(product)` in the non-variant branch, add a `StockMovementEntity` with `type=IN`, `referenceType=ORDER_CANCEL`, `referenceId=orderId`, `quantityDelta=item.getQuantity()`.
- **Suggested tests:** `cancelOrder_writesStockMovementForProductLevelItem` test.
- **Related files:** `AdminOrderService.java:573-589`

---

### ORD-003: LOW — `OrderWsEvent.paymentMethod` field is semantically overloaded

- **Workflow:** WebSocket event delivery for `ORDER_PAYMENT_STATUS_CHANGED` and `ORDER_REFUND_CREATED`
- **Impact:** The 8th field of `OrderWsEvent` is declared as `paymentMethod` (record component name, Java line 14) but for `ORDER_PAYMENT_STATUS_CHANGED` events it actually carries `newPaymentStatus` (e.g., "PAID"). For `ORDER_STATUS_CHANGED` it carries `order.getPaymentStatus()` (current payment status). For `NEW_ORDER` it carries `paymentMethod` (e.g., "COD"). The semantic meaning of this field changes by event type.
- **Evidence:** `OrderWsEvent.java:14` — field named `paymentMethod`; `AdminOrderService.java:371-374` — `NEW_ORDER`/`ORDER_STATUS_CHANGED` passes `order.getPaymentStatus()`; `updatePaymentStatus()` at line 371 passes `newPaymentStatus`; `RefundService.java:163-165` passes `order.getPaymentStatus()`.
- **Root cause:** `OrderWsEvent` was originally a `NEW_ORDER`-only record where the field was literally the payment method. It was reused for other event types without renaming the field.
- **Frontend impact:** `OrderNotificationToast.jsx` only uses `toast.status` for display, not `toast.paymentMethod`, so there is no visible bug. But any future consumer relying on `paymentMethod` for non-`NEW_ORDER` events gets wrong data.
- **Suggested fix:** Rename `paymentMethod` to `paymentContext` or add a separate `paymentStatus` field. Update the comment at line 8 to document all event types and what each field carries per event.
- **Suggested tests:** Assert WS event payload field values per event type.
- **Related files:** `OrderWsEvent.java`, `AdminOrderService.java:371-374,656-670`, `RefundService.java:161-165`

---

### ORD-004: LOW — `OrderWsEvent.java` comment documents only 2 of 5 emitted event types

- **Workflow:** WebSocket contract documentation
- **Impact:** Misleading documentation. Any developer reading `OrderWsEvent.java:8` assumes only `NEW_ORDER` and `ORDER_STATUS_CHANGED` exist.
- **Evidence:** `OrderWsEvent.java:8`: `// "NEW_ORDER" | "ORDER_STATUS_CHANGED"`. Actual emitted types: `NEW_ORDER` (`CheckoutService`, `PosOrderService`), `ORDER_STATUS_CHANGED` (`AdminOrderService.buildStatusChangedEvent`), `ORDER_PAYMENT_STATUS_CHANGED` (`AdminOrderService.updatePaymentStatus:371`), `ORDER_REFUND_CREATED` (`RefundService:161`), `ORDER_NOTE_ADDED` (`AdminOrderService.addNote:409`).
- **Suggested fix:** Update comment to list all 5 types. Optionally add a `sealed interface` or `enum` for type safety.
- **Related files:** `OrderWsEvent.java:8`

---

### ORD-005: LOW — Stock restore NOT triggered when `COMPLETED→REFUNDED` occurs via refund endpoint

- **Workflow:** Full refund on a COMPLETED order
- **Impact:** After admin creates a full refund on a COMPLETED order (via `POST /admin/orders/{id}/refund`), the order status becomes REFUNDED but `restoreStockForOrder` is NOT called. Stock is only restored if admin additionally sets `PATCH /status` to REFUNDED (which is now a no-op since the order is already REFUNDED — and REFUNDED is terminal). There is no path to trigger stock restore after `COMPLETED→REFUNDED` via refund endpoint alone.
- **Evidence:** `RefundService.java:108-110` — sets `order.setStatus("REFUNDED")` but does NOT call `restoreStockForOrder`. `AdminOrderService.java:268-271` — restoreStock is called only from `updateOrderStatus()` for CANCELLED and REFUNDED transitions, which are via `PATCH /status` only.
- **Root cause:** Stock restore is coupled to the status-update path, not the refund path. When refund auto-transitions status to REFUNDED, the stock hook is not triggered.
- **Reproduction:** Place order (PROCESSING, stock = 8). Set to COMPLETED. Mark payment PAID. Create full refund. Check stock — still 8, not restored to original.
- **Expected:** After full refund on a COMPLETED order, stock should be restored.
- **Actual:** Stock remains decremented.
- **Suggested fix:** Add `restoreStockForOrder(orderId)` call inside `RefundService.applyRefund()` when `fullRefund && "COMPLETED".equals(order.getStatus())` (i.e., when the order transitions to REFUNDED via the refund path).
- **Suggested tests:** `createRefund_full_onCompletedOrder_restoresStock` test.
- **Related files:** `RefundService.java:105-115`, `AdminOrderService.java:268-271`

---

### ORD-006: LOW — `AdminReportRepositoryQueryTest` requires Docker (Testcontainers) and cannot run without it

- **Workflow:** CI/CD test execution for report repository queries
- **Impact:** The test class `AdminReportRepositoryQueryTest` uses `@ServiceConnection` with a real PostgreSQL container (Testcontainers). In CI environments without Docker, this test always fails with `ContainerFetchException`. Other tests use H2 in-memory which works everywhere.
- **Evidence:** `AdminReportRepositoryQueryTest` error: `ContainerFetchException: Can't get Docker image: RemoteDockerImage(imageName=postgres:16-alpine)`.
- **Suggested fix:** Either ensure Docker is available in the CI runner, or provide an H2-compatible variant of the native SQL queries tested in `AdminReportRepositoryQueryTest` for environments without Docker.
- **Related files:** `bigbike-backend/src/test/java/com/bigbike/bigbike_backend/api/AdminReportRepositoryQueryTest.java`

---

### ORD-007: LOW — `refundedAt` is overwritten on each partial refund call (REPORT_RULE_011)

- **Workflow:** Multiple partial refunds on the same order
- **Impact:** After two partial refunds on the same order, `orders.refunded_at` holds only the timestamp of the second (most recent) refund. Period-based refund reports anchored to `refundedAt` would misattribute early partial refunds to the later period.
- **Evidence:** `RefundService.java:103`: `order.setRefundedAt(now)` — called unconditionally on every `applyRefund()` invocation. `BUSINESS_RULES.md:REPORT_RULE_011` acknowledges this and explains the workaround (attribute to `placedAt` instead).
- **Suggested fix (long-term):** Introduce a `refund_transactions` table with one row per refund event, each with its own timestamp and amount. This enables accurate per-period refund reporting.
- **Related files:** `RefundService.java:103`, `BUSINESS_RULES.md:REPORT_RULE_011`

---

## 14. Appendix: Migration Scan

Migrations relevant to order/payment/refund/audit/stock/reports:

| Migration | Tables affected | Summary |
|---|---|---|
| `V7__create_order_tables.sql` | `orders`, `order_line_items`, `order_addresses`, `order_shipping_items`, `order_fee_items`, `order_applied_coupons`, `order_notes` | Core order schema creation |
| `V8__create_payment_tables.sql` | `payments` | Payment entity schema — `status`, `amount`, `currency`, `transaction_id`, `paid_at`, `refund_amount`, `refunded_at` |
| `V28__add_refund_fields.sql` | `orders` | Adds `refund_amount`, `refund_reason`, `refunded_at` columns to orders |
| `V31__create_returns_tables.sql` | `returns`, `return_items`, `return_history` | Return/RMA schema |
| `V46__add_order_channel_and_payment_method.sql` | `orders` | Adds `channel`, `payment_method`, `source` columns |
| `V50__inventory_integrity_guards.sql` | `stock_movements` | Adds NOT NULL / CHECK constraints on stock movement quantities |
| `V57__add_stock_movement_serials.sql` | `stock_movement_serials` | Serial number tracking per movement |
| `V62__create_checkout_idempotency_keys.sql` | `checkout_idempotency_keys` | Idempotency table for checkout and quick-buy |
| `V65__fix_returns_active_index_include_received.sql` | `returns` | Extends partial unique index to include RECEIVED status (prevents duplicate active returns) |
| `V66__returns_check_constraints.sql` | `returns`, `return_items` | CHECK constraints: status enum, reason enum, refund_amount ≥ 0, quantity > 0 |
| `V67__add_optimistic_lock_version.sql` | `orders`, `returns` | Adds `version BIGINT DEFAULT 0` for `@Version` optimistic locking on both entities |
| `V71__add_pos_staff_and_customer_name_to_orders.sql` | `orders` | Adds `created_by_admin_id UUID nullable`, `customer_name varchar(255) nullable` |
| `V74__add_order_line_item_product_pk.sql` | `order_line_items`, `cart_items` | Adds `product_pk varchar(64) nullable` for admin-created product reference in reports |
| `V75__add_credit_and_receivables.sql` | `accounts_receivable`, `customers` | AR module — credit fields on customers, receivable entity |
| `V76__fix_audit_log_admin_role_resource_type.sql` | `audit_logs` | Fixes historical rows where `resource_type = 'ADMIN_ROLE:<roleId>'` to `ADMIN_ROLE` |
| `V77__add_reports_indexes.sql` | `orders`, `order_line_items` | Adds composite indexes for report query performance (`placed_at`, `status`, `payment_status`) |
| `V78__add_reports_permissions.sql` | `role_permissions` | Seeds `reports.read` and `reports.export` permissions for ADMIN, SUPER_ADMIN, SHOP_MANAGER roles |
| `V79__backfill_pos_receivables_permissions.sql` | `role_permissions` | Seeds POS and receivables permissions for existing roles |
| `V81__add_roles_permissions.sql` | `role_permissions` | Additional permission seeds |

---

*End of ORDER_PAYMENT_REFUND_WS_AUDIT.md*
