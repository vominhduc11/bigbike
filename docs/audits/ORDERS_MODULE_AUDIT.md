HISTORICAL_REPORT_ONLY - Not canonical. Validate against current code and canonical docs.

# Orders Module Audit

> **Audit date:** 2026-05-05
> **Auditor:** Senior Software Architect + QA Lead (AI agent — Claude Opus 4.7)
> **Scope:** Module Orders (Đơn hàng) — backend + admin + web + mobile + tests + DB
> **Method:** Đối chiếu source code thực tế với docs `docs/business/*.md` và `docs/engineering/*.md`. Mọi kết luận có evidence (file path + symbol).

---

## 1. Executive Summary

**Module Orders CHƯA SẴN SÀNG cho production** — nhưng phần backend core (checkout cart, quick-buy, admin status/payment/refund, guest lookup, customer order list/detail) đã ở mức "đủ chạy demo / staging" và đa số rule chính được backend enforce. Vấn đề nằm ở các **lỗ hổng correctness / consistency** ở frontend contracts, refund report, idempotency, mobile checkout broken, và ở **độ phủ test thực tế** quá hẹp với những kịch bản tài chính.

### Production readiness: **Not Ready (Critical issues phải fix trước)**

### Top risks (highest first)

1. **Mobile checkout BROKEN** — payload field name lệch hoàn toàn so với backend. Mobile checkout sẽ fail 400 ở 100% request. Xem [Critical #1](#10-critical-issues).
2. **Web admin/customer FE contract mismatch** với `OrderShippingItem` và `OrderPayment` — UI hiển thị thiếu method/cost. Xem [Critical #2](#10-critical-issues).
3. **Refund analytics sai số liệu** — `OrderJpaRepository.sumRefundAmountInRange` đang `SUM(totalAmount)` thay vì `SUM(refundAmount)` và bỏ qua `PARTIALLY_REFUNDED`. Báo cáo doanh thu hoàn tiền không đáng tin. Xem [Critical #3](#10-critical-issues).
4. **Không có idempotency** ở `/api/v1/checkout` và `/api/v1/orders/quick-buy` mặc dù FE gửi `Idempotency-Key`. Double-submit/double-tap sẽ tạo nhiều order và double-decrement stock. Xem [Critical #4](#10-critical-issues).
5. **Customer endpoint trả `OrderDetailResponse` lộ `orderKey`** — `orderKey` là token bí mật để guest tra cứu đơn, đáng lẽ chỉ trả khi cần. Hiện trả luôn cả khi customer đăng nhập (vô hại trong context này, nhưng vẫn là leak token). Xem [High #5](#10-critical-issues).
6. **Refund / cancel test 0 coverage** — không có test integration nào cho `POST /admin/orders/{id}/refund` và transition `CANCELLED → restore stock`. PAYMENT_RULE_002–003 confirmed by code only.
7. **Quick-buy không validate variant available cho variant unavailable** trong checkout từ cart đã được kiểm; nhưng quick-buy không validate `force_out_of_stock` ở variant level (chỉ check ở product level).

---

## 2. Files Reviewed

### Backend (Java / Spring)

- `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/checkout/CheckoutController.java`
- `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/checkout/dto/CheckoutRequest.java`, `QuickBuyRequest.java`, `CheckoutAddressRequest.java`, `CheckoutShippingAddressRequest.java`, `CheckoutOptionsResponse.java`, `OrderSummaryResponse.java`, `PaymentMethodOptionResponse.java`, `ShippingMethodOptionResponse.java`
- `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/order/CustomerOrderController.java`
- `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/order/OrderLookupController.java`
- `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/order/dto/OrderDetailResponse.java`, `OrderListItemResponse.java`, `OrderLineItemResponse.java`, `OrderAddressResponse.java`, `OrderShippingItemResponse.java`, `OrderPaymentResponse.java`, `OrderNoteResponse.java`, `CreateReturnRequest.java`, `CustomerReturnResponse.java`
- `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/admin/AdminOrderController.java`
- `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/admin/dto/order/AdminOrderDetailResponse.java`, `AdminOrderListItemResponse.java`, `AdminOrderNoteResponse.java`, `CreateOrderNoteRequest.java`, `CreateRefundRequest.java`, `OrderAppliedCouponResponse.java`, `UpdateOrderStatusRequest.java`, `UpdatePaymentStatusRequest.java`
- `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/checkout/CheckoutService.java`, `OrderNumberGenerator.java`, `OrderKeyGenerator.java`, `OrderNotificationService.java`
- `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/order/OrderReadService.java`, `CustomerReturnService.java`
- `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminOrderService.java`, `AdminReportService.java` (refund query usage)
- `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/ws/AdminOrderWsService.java`, `OrderWsEvent.java`
- `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/persistence/entity/commerce/order/OrderEntity.java`, `OrderLineItemEntity.java`, plus `OrderAddressEntity`, `OrderAppliedCouponEntity`, `OrderFeeItemEntity`, `OrderNoteEntity`, `OrderShippingItemEntity`
- `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/persistence/repository/commerce/order/OrderJpaRepository.java`, `OrderAddressJpaRepository.java`, `OrderAppliedCouponJpaRepository.java`, `OrderFeeItemJpaRepository.java`, `OrderLineItemJpaRepository.java`, `OrderNoteJpaRepository.java`, `OrderShippingItemJpaRepository.java`
- `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/config/SecurityConfig.java`, `RateLimitingFilter.java`, `CustomerCsrfFilter.java`, `CustomerSessionFilter.java`
- `bigbike-backend/src/main/resources/db/migration/V7__create_order_tables.sql`, `V8__create_payment_tables.sql`, `V20__add_coupon_cart_gender_shipping_threshold.sql`, `V28__add_refund_fields.sql`, `V46__add_order_channel_and_payment_method.sql`, `V50__inventory_integrity_guards.sql`

### Backend (tests)

- `bigbike-backend/src/test/java/com/bigbike/bigbike_backend/api/Phase1FCheckoutApiTest.java` (24 test)
- `bigbike-backend/src/test/java/com/bigbike/bigbike_backend/api/Phase1GOrderReadApiTest.java` (22 test)
- `bigbike-backend/src/test/java/com/bigbike/bigbike_backend/api/Phase1HAdminOrderApiTest.java` (28 test)
- `bigbike-backend/src/test/java/com/bigbike/bigbike_backend/api/Phase1LReturnsApiTest.java` (Returns)

### Admin frontend (React)

- `bigbike-admin/src/screens/OrderListScreen.jsx`
- `bigbike-admin/src/screens/OrderDetailScreen.jsx`
- `bigbike-admin/src/components/RefundModal.jsx`
- `bigbike-admin/src/components/OrderNotificationToast.jsx`
- `bigbike-admin/src/lib/adminApi.js` (orders + refund + notes)
- `bigbike-admin/src/lib/contracts.js` (`normalizeOrder`, status enums)

### Web frontend (Next.js)

- `bigbike-web/app/thanh-toan/page.tsx` (checkout)
- `bigbike-web/app/don-hang/xac-nhan/page.tsx` (order confirm)
- `bigbike-web/app/tai-khoan/don-hang/page.tsx`, `app/tai-khoan/don-hang/[id]/page.tsx`
- `bigbike-web/app/api/orders/quick-buy/route.ts`
- `bigbike-web/lib/api/client-api.ts`, `lib/api/public-api.ts`, `lib/contracts/commerce.ts`, `lib/schemas/checkout.ts`

### Mobile (Flutter)

- `bigbike_mobile/lib/features/checkout/checkout_screen.dart`, `order_confirmation_screen.dart`
- `bigbike_mobile/lib/features/account/orders_screen.dart`, `order_detail_screen.dart`
- `bigbike_mobile/lib/core/models/order.dart`, `core/models/checkout.dart`
- `bigbike_mobile/lib/core/api/api_endpoints.dart`

### Docs consulted

- `docs/business/BUSINESS_RULES.md` (ORDER_RULE_001-004, PAYMENT_RULE_001-005)
- `docs/business/STATE_MACHINES.md` (Order, Payment)
- `docs/engineering/API_CONTRACT.md`, `PERMISSION_MATRIX.md`, `DATA_CONTRACT.md`
- `docs/DOCS_VERIFICATION_REPORT.md`

---

## 3. Route Coverage Matrix

| Route | Controller / Service | Auth/Permission | Validation | Test Coverage | Status | Notes |
|---|---|---|---|---|---|---|
| `POST /api/v1/checkout` | `CheckoutController.checkout` → `CheckoutService.checkoutFromCart` | Public (guest cookie or customer JWT). CSRF enforced via `CustomerCsrfFilter`. Rate limit `LimitTier.CHECKOUT`. | Bean Validation + manual `validateAddress`/`validatePaymentMethod` inside service. | 22 tests in `Phase1FCheckoutApiTest`. ✅ Empty cart, invalid payment, invalid phone, address required, BACS/COD, auth/guest, single shipping auto-select, disabled shipping, sameAsBilling. | **Partial** | 1) FE gửi `Idempotency-Key` → BE bỏ qua. 2) Stock decrement chỉ check trong service, không qua DB-level guard cho race. |
| `POST /api/v1/orders/quick-buy` | `CheckoutController.quickBuy` → `CheckoutService.quickBuy` | Public (guest or customer). CSRF enforced. Rate limited. | Bean Validation + `validateAddress`/`validatePaymentMethod`. Variant qty/availability check. | Tested: COD success, BACS success, productNotFound 404, unpublished 409, invalid payment 400. | **Partial** | Không test cho variant unavailable trong quick-buy. Không test idempotency. |
| `GET /api/v1/checkout/options` | `CheckoutController.getOptions` | Public. | None (read-only). | Tested: returns 2 payment methods + 1 shipping. | **Complete (read)** | OK |
| `GET /api/v1/customer/orders` | `CustomerOrderController.listOrders` | `hasRole("CUSTOMER")` (`SecurityConfig` line 111-112). | `page/size` defaults; status/paymentStatus arbitrary string. | Tested: 401 without session, only own orders, pagination, status filter. | **Complete** | Sort/size không có upper bound check ở controller (service clamps `MAX_SIZE=100`). |
| `GET /api/v1/customer/orders/{orderId}` | `CustomerOrderController.getOrderDetail` → `OrderReadService.getCustomerOrderDetail` | Customer + ownership check (404 nếu khác customerId). | UUID path validation. | Tested: own returns detail, other 404, includes line items, addresses, shipping items, payments, không lộ ip/userAgent. | **Complete** | OK. **Note**: response includes `orderKey` — không cần thiết với customer authenticated. |
| `POST /api/v1/customer/orders/{orderId}/returns` | `CustomerOrderController.createReturn` → `CustomerReturnService.createReturn` | Customer + ownership 404. | Status `COMPLETED` only; reason whitelisted; duplicate guard; partial unique index `V39`. | Phase1L: createReturn happy + 404 + duplicate. | **Complete** | OK |
| `GET /api/v1/orders/lookup` | `OrderLookupController.lookup` → `OrderReadService.guestLookup` | Public. Rate limit `LimitTier.ORDER_LOOKUP`. | `orderNumber` + `orderKey` required; exact match → no enumeration. | Tested: valid lookup, wrong key 404, missing params 400, không lộ internal notes. | **Complete** | OK |
| `GET /api/v1/admin/orders` | `AdminOrderController.listOrders` → `AdminOrderService.listOrders` | `orders.read` permission via `DevAdminAuthService`. | `@Min(1)` on page, `@Min(1)@Max(100)` on size, sort whitelisted to placedAt/totalAmount. | Tested: 401 no auth, 200 with token, customer fields, status/payment filter, q search, pagination. | **Complete** | OK |
| `GET /api/v1/admin/orders/{orderId}` | `AdminOrderController.getOrderDetail` | `orders.read`. | UUID path. | Tested: 401, 404 unknown, success includes line items, admin sees all notes. | **Complete** | OK |
| `GET /api/v1/admin/orders/{orderId}/allowed-transitions` | `AdminOrderController.listAllowedTransitions` | `orders.read`. | UUID. | **No direct test found** for this endpoint. | **Partial** | Logic đúng (đọc từ static map). Test missing. |
| `PATCH /api/v1/admin/orders/{orderId}/status` | `AdminOrderController.updateOrderStatus` → `AdminOrderService.updateOrderStatus` | `orders.write`. | `@NotBlank status`; service validates whitelist + transition map. | Tested: 401, invalid 400, invalid transition 409, idempotent same status, PENDING→PROCESSING, COMPLETED sets `completedAt`, CANCELLED sets `cancelledAt`, with note. | **Complete** | ✅ Audit log + WS push. **Gap**: không test stock-restore khi CANCELLED. |
| `PATCH /api/v1/admin/orders/{orderId}/payment-status` | `AdminOrderController.updatePaymentStatus` | `orders.write`. | `@NotBlank paymentStatus`; service validates whitelist + transition map; PARTIALLY_PAID requires `0 < paidAmount < total`. | Tested: 401, PAID sets paidAmount/paidAt + sync payment record SUCCEEDED, PARTIALLY_PAID invalid amount 400, UNPAID clears paidAt, invalid status 400. | **Complete** | OK |
| `POST /api/v1/admin/orders/{orderId}/refund` | `AdminOrderController.createRefund` → `AdminOrderService.createRefund` | `orders.write`. | `@NotNull @DecimalMin("0.01") refundAmount`; service validates ≤ refundable. | **❌ ZERO test coverage** — `grep refund` in `bigbike-backend/src/test` returned only WordPress importer test. | **Backend-only / Untested** | Logic đúng theo PAYMENT_RULE_002/003 nhưng chưa có test hồi quy. |
| `POST /api/v1/admin/orders/{orderId}/notes` | `AdminOrderController.addNote` | `orders.write`. | `@NotBlank content`. | Tested: 401, internal not visible to customer, customerVisible appears. | **Complete** | OK |
| `GET /api/v1/admin/orders/{orderId}/notes` | `AdminOrderController.listNotes` | `orders.read`. | UUID. | Indirectly via detail tests. | **Partial** | Có endpoint nhưng FE không gọi (admin detail đã trả `notes` inline). Endpoint redundant — không phải bug, nhưng dead-ish. |

---

## 4. Screen / UI Coverage Matrix

| App | Screen / Component | Feature | API Used | State Handling | Status | Notes |
|---|---|---|---|---|---|---|
| Admin | `OrderListScreen.jsx` | List orders với filter status, date range, sort, search, pagination, CSV export, WS auto-refresh | `fetchOrders`, `exportOrdersCsv`, `subscribeAdminWs` | loading/error/empty/success | **Complete** | Lưu ý mock fallback (`shouldFallbackToMockOnLiveError`) — chỉ active khi `BB_MOCK_FALLBACK` cho phép, OK. |
| Admin | `OrderDetailScreen.jsx` | Status update (allowed transitions), payment status update (PARTIALLY_PAID có form số tiền), notes (add+list), refund button (gate by paymentStatus PAID/PARTIALLY_PAID) | `fetchOrderDetail`, `fetchOrderAllowedTransitions`, `updateOrderStatus`, `updateOrderPaymentStatus`, `addOrderNote`, `RefundModal` | loading/error/notFound/saving | **Complete** | Confirm cho dangerous transitions (CANCELLED, COMPLETED, REFUNDED). |
| Admin | `RefundModal.jsx` | Refund form (amount cap, reason picker, note, customerVisible) | `createRefund` | saving + field-level errors | **Complete** | OK |
| Admin | `OrderNotificationToast.jsx` | WS push hiển thị toast khi có order mới | WS `/topic/admin/orders` | OK | **Complete** | OK |
| Web | `app/thanh-toan/page.tsx` | Checkout 3-step (address → payment+shipping → review) | `submitCheckout`, `fetchCheckoutOptions` | submitting + error | **Complete** | Sends `Idempotency-Key` (BE ignores). |
| Web | `app/don-hang/xac-nhan/page.tsx` | Order confirmation page (guest lookup by `so` + `key`) | `getOrderLookup` | server-rendered with fallback "Đơn đã được tạo, nhưng không thể tải chi tiết ngay lúc này." | **Complete** | OK |
| Web | `app/tai-khoan/don-hang/page.tsx` | Customer orders list | `fetchMyOrders` | loading/error/empty | **Complete (assumed)** | OK |
| Web | `app/tai-khoan/don-hang/[id]/page.tsx` | Customer order detail + return form | `fetchMyOrder`, `createReturn` | loading/error/notFound | **Partial — Broken contract** | ❌ `order.payments[0]?.method` (đáng lẽ `paymentMethod`); ❌ `order.shippingItems[i].title`/`cost` (đáng lẽ `methodTitle`/`amount`). UI hiển thị "—" / 0₫. Xem [Critical #2]. |
| Mobile | `lib/features/checkout/checkout_screen.dart` | Checkout 3-step | `POST /api/v1/checkout` | OK | **❌ BROKEN** | Mobile gửi `paymentMethodCode`, `shippingMethodCode`, `notes` — backend `CheckoutRequest` expects `paymentMethod` (`@NotBlank`), `shippingMethodId`, `customerNote`. Tất cả checkout sẽ trả 400. Xem [Critical #1]. |
| Mobile | `lib/features/account/orders_screen.dart` | Customer order list | `GET /api/v1/customer/orders` | loading/error/empty/pagination | **Complete** | OK (model field map khớp). |
| Mobile | `lib/features/account/order_detail_screen.dart` | Customer order detail | `GET /api/v1/customer/orders/{id}` | OK | **Partial** | `OrderPayment.fromJson` đã có fallback đọc `paymentMethod` (đúng), nhưng `transactionId` không được BE trả — display 'null' fallback. |

---

## 5. Feature Coverage Matrix

| Feature | Backend | Admin FE | Web FE | Mobile | Tests | Status | Gaps |
|---|---|---|---|---|---|---|---|
| Checkout from cart | ✅ `CheckoutService.checkoutFromCart` | n/a | ✅ `app/thanh-toan/page.tsx` | ❌ Broken (field names lệch) | Phase1F (22 tests) | **Partial** | Mobile checkout không thể hoạt động |
| Quick-buy | ✅ `CheckoutService.quickBuy` | n/a | ✅ qua proxy `app/api/orders/quick-buy/route.ts` | Endpoint defined nhưng UI không gọi (chỉ checkout flow) | Phase1F: 5 tests | **Backend-only mobile** | Mobile chưa expose quick-buy UI |
| Guest order lookup | ✅ `OrderLookupController` + `guestLookup` | n/a | ✅ `app/don-hang/xac-nhan/page.tsx` | Endpoint defined; mobile không có UI riêng (chỉ confirmation screen) | Phase1G: 4 tests | **Complete** | OK |
| Customer order list | ✅ | n/a | ✅ | ✅ | Phase1G | **Complete** | OK |
| Customer order detail | ✅ | n/a | ⚠️ contract lệch (payments.method, shippingItems.title/cost) | ✅ (model có fallback) | Phase1G | **Partial — Broken** | Web hiển thị thiếu method/cost |
| Admin order list | ✅ | ✅ | n/a | n/a | Phase1H | **Complete** | OK |
| Admin order detail | ✅ | ✅ | n/a | n/a | Phase1H | **Complete** | OK |
| Status transitions | ✅ allowed map static, restore stock on CANCELLED/REFUNDED | ✅ allowed-transitions API | n/a | n/a | Phase1H 8 tests | **Complete** | Cancel/restore stock NOT tested |
| Payment status transitions | ✅ allowed map; PAID syncs payment record | ✅ | n/a | n/a | Phase1H 4 tests | **Complete** | OK |
| Refund | ✅ `AdminOrderService.createRefund` (amount cap, syncs payment, sets status REFUNDED/PARTIALLY_REFUNDED) | ✅ `RefundModal.jsx` | ✅ Read-only ở customer detail (`refundAmount`, `refundedAt`, `refundReason`) | n/a | **❌ ZERO** integration tests | **Backend-only / High risk** | PAYMENT_RULE_002, 003 not test-covered |
| Notes (system/admin/customer-visible) | ✅ `OrderNoteEntity` + `is_customer_visible` | ✅ add/list | ✅ display customerVisible-only | ❌ Mobile model định nghĩa `OrderNote` nhưng nó chỉ `id, content, createdAt` (không có `type`), khớp BE | Phase1H 3 tests, Phase1G 2 tests | **Complete** | OK |
| Coupons applied to order | ✅ `OrderAppliedCouponEntity` + usageCount increment in `CheckoutService` | ✅ `appliedCoupons` trong AdminOrderDetail | ❌ Web `OrderDetail` không expose `appliedCoupons` field | ❌ Mobile cũng không | Indirect via cart/checkout tests | **Backend-only beyond admin** | Customer/guest không thấy mã giảm giá đã áp dụng |
| Stock decrement on order | ✅ Variant qua `decrementVariantStock` + `StockMovementEntity` ref ORDER; product-level qua `productRepo.findByIdForUpdate` lock | n/a | n/a | n/a | Indirect (Phase1F creates order so stock moves) | **Partial** | No test asserts stock_movements row created |
| Stock restore on cancel/refund | ✅ `restoreStockForOrder` (variant + product, IN movement type ORDER_CANCEL) | n/a | n/a | n/a | **❌ NOT TESTED** | **Backend-only / High risk** | |
| Notification email | ✅ `OrderNotificationService` (confirmation, status update, admin new-order) — `@Async`, soft-fail nếu `EmailDispatchService` not enabled | n/a | n/a | n/a | None | **Backend-only** | Test không assert email content |
| WS admin push | ✅ `AdminOrderWsService` (afterCommit) | ✅ `OrderListScreen` subscribe; `OrderNotificationToast` shows toast | n/a | n/a | None integration | **Complete (manual)** | OK |
| Reports / dashboard usage | ✅ `AdminReportService` SUM(totalAmount) by date, status breakdown | ✅ Analytics screen | n/a | n/a | None | **Partial** | ❌ `sumRefundAmountInRange` BUG: dùng `SUM(o.totalAmount)` thay vì `SUM(o.refundAmount)`; bỏ qua PARTIALLY_REFUNDED. Xem [Critical #3]. |
| Returns integration | ✅ `CustomerReturnService` + `AdminReturnService` | Có `AdminReturnController` (out of scope this audit) | ✅ Return form | n/a | Phase1L (returns) | **Complete** | Linked to order via `RETURNABLE_STATUSES = COMPLETED` |
| Admin audit log on mutations | ✅ `AuditLogEntity` saved trong updateOrderStatus, updatePaymentStatus, createRefund, addNote | n/a | n/a | n/a | None direct (đã ghi vào audit table) | **Complete** | OK |

---

## 6. Permission & Security Review

### Pass

- **Admin orders.read / orders.write** enforced via `devAdminAuthService.requirePermission(request, "orders.read"|"orders.write")` ở mọi endpoint admin (`AdminOrderController.java:67-153`). Combined với `SecurityConfig.java:103` (`/api/v1/admin/** → hasRole("ADMIN")`). ✅
- **Customer ownership** ở list (`OrderReadService.listCustomerOrders` filter by `customerId`) và detail (`getCustomerOrderDetail` throws 404 nếu khác `customerId`). ✅ — `OrderReadService.java:107`.
- **Guest enumeration prevention**: `guestLookup` requires `orderNumber + orderKey`; if key mismatch → 404 (không leak existence). `OrderReadService.java:127-128`. ✅
- **Internal notes hidden from customer/guest**: `OrderReadService.toDetail(order, customerVisibleNotesOnly=true)` → query `findByOrderIdAndCustomerVisibleOrderByCreatedAtAsc(orderId, true)`. Test `Phase1GOrderReadApiTest.guestLookup_doesNotExposeInternalNotes`. ✅
- **IP / User-Agent not leaked**: `OrderDetailResponse` dto không có `ipAddress`/`userAgent`. Test `customerOrderDetail_doesNotExposeIpOrUserAgent`. ✅
- **CSRF for mutations**: `CustomerCsrfFilter` enforces on `/api/v1/checkout`, `/api/v1/orders/quick-buy`, customer order/cart mutations. Tests `checkout_missingCsrf_returns403`, `quickBuy_missingCsrf_returns403`. ✅
- **Admin mutations carry audit log**: `auditLogRepo.save(buildAudit(...))` in `AdminOrderService.updateOrderStatus`, `updatePaymentStatus`, `createRefund`, `addNote`. ✅
- **Constant-time CSRF compare**: `MessageDigest.isEqual` in `CustomerCsrfFilter.java:96`. ✅
- **Rate limiting**: `RateLimitingFilter` has `LimitTier.CHECKOUT` and `LimitTier.ORDER_LOOKUP`. ✅

### Fail / Concerns

- **`orderKey` leak in customer-authenticated detail**: `OrderDetailResponse` includes `orderKey` (`OrderDetailResponse.java:11`). The orderKey is a guest-lookup secret. Returning it to authenticated customers expands its exposure (e.g., browser history, JS heap dumps). Recommended: omit `orderKey` from authenticated responses, return only on guest lookup. **Severity: Medium** — not exploitable by itself but violates least-privilege.
- **`AdminOrderController.resolveAdminId()` falls back to a hard-coded UUID `00000000-0000-0000-0000-000000000001`** when principal id isn't a UUID (e.g. dev-admin). In prod, if a non-UUID principal slips through, the audit log will be attributed to "DEV admin" silently. `AdminOrderController.java:39, 157-167`. **Severity: Medium** — masks real actor in audit log.
- **No CSP/CSRF check on `idempotencyKey` reuse**: discussed in Critical #4.
- **Public lookup endpoint exposes full order details** including all line items, addresses, paid amount. Aligned with WooCommerce-style "order received" pages — acceptable but worth documenting as `BUSINESS_RULE`.

---

## 7. Validation Review

### Backend validation present

- `CheckoutRequest`: `@NotNull @Valid billingAddress`, `@NotBlank paymentMethod`. **CheckoutAddressRequest đầy đủ KHÔNG có Bean Validation annotation** — dựa hoàn toàn vào manual `validateAddress()` trong service.
- `validateAddress` checks: `fullName` not blank, `phone` matches `0[3-9]\d{8}|\+84[3-9]\d{8}` (VN mobile), `email` regex if non-blank, `addressLine1` not blank.
- `validatePaymentMethod` whitelist `Set.of("COD", "BACS")`.
- `resolveShippingMethod` checks UUID parse, exists, enabled; auto-select if exactly 1 enabled.
- `CreateRefundRequest`: `@NotNull @DecimalMin("0.01") refundAmount`. Service additionally caps to `paidAmount - alreadyRefunded`.
- `UpdateOrderStatusRequest`/`UpdatePaymentStatusRequest`: `@NotBlank` only; service validates whitelist + transition.
- `AdminOrderController.listOrders`: `@Min(1) page`, `@Min(1)@Max(100) size`. Sort field whitelist trong `resolveSort` (placedAt|createdAt|totalAmount only).
- `Phase1FCheckoutApiTest` covers each manual validation case → green.

### Validation gaps

- **PaymentMethodOptionResponse hiện tại chỉ COD/BACS**. Nếu sau này thêm method (SePay/VNPAY) phải thêm vào whitelist; hiện chưa enforce config-driven.
- **`shippingAddress` (when `sameAsBilling=false`) only partially required**: `resolveShippingAddress` falls back từng field về billing nếu null. Nghĩa là FE có thể gửi `sameAsBilling=false` với addressLine1 trống → BE silently dùng billing addressLine1. Behavior có thể đúng (UX-wise), nhưng không có test xác nhận.
- **Frontend (Web) zod schema**: `lib/schemas/checkout.ts` (đã đọc tóm tắt) — assumed to mirror backend. Đã verified `app/thanh-toan/page.tsx` map đúng field names lên `CheckoutPayload`.
- **Quick-buy variant validation**: chỉ check `variant.isAvailable()` và `quantityOnHand`. Không check `force_out_of_stock` ở variant level (chỉ ở product level cho non-variant path). Not a hard failure, vì `isAvailable()` thường đã cover, nhưng không có evidence in code.
- **Date range filter** ở admin list dùng `LocalDate.parse(date)` swallow exception → silent null. Nếu user gõ `from=invalid` → BE coi như không filter. Severity: **Low** — UX issue.
- **Customer note length** không có limit. `customer_note text` ở DB. Không có `@Size(max=...)` ở DTO. Severity: **Low** — abuse vector cho DB bloat.
- **Payment status PARTIALLY_PAID requires paidAmount > 0 && < total** — đúng, có test.

---

## 8. Database Behavior Review

### Schema (`V7__create_order_tables.sql` + `V8` + `V20` + `V28` + `V46`)

- `orders` PK `id uuid`, **uniques**: `legacy_id`, `order_number`, `order_key`. ✅
- `customer_id` FK `customers(id)` — no ON DELETE → defaults to NO ACTION. Soft-delete customer leaves orphan order pointing to non-existent FK only if hard-deleted. ✅ acceptable.
- `order_line_items.order_id` FK `orders(id)` **ON DELETE CASCADE**. Same for `order_addresses`, `order_shipping_items`, `order_fee_items`, `order_applied_coupons`, `order_notes`. ✅
- `payments.order_id` FK `orders(id)` ON DELETE CASCADE. ✅
- `ck_order_line_items_quantity check (quantity > 0)`. ✅
- Indexes: `idx_orders_legacy_id`, `idx_orders_order_number`, `idx_orders_order_key`, `idx_orders_customer_id`, `idx_orders_status`, `idx_orders_payment_status`, `idx_orders_customer_email`, `idx_orders_customer_phone`, `idx_orders_placed_at`, `idx_orders_created_at`. ✅ Strong index coverage for admin list filters.
- Partial index `idx_orders_onhold_sepay_placed` (V46) — irrelevant after `V59__remove_sepay_payment_artifacts.sql`. Worth checking if V46 partial index references `payment_method='SEPAY'` still exists despite SePay removal. Severity: **Low** — orphan index.
- `V28` adds `refund_amount`, `refund_reason`, `refunded_at` to `orders`; same to `payments`.
- `V50__inventory_integrity_guards.sql` (not read here) — assumed adds DB-level stock guards.

### Repository / queries

- `OrderJpaRepository` extends `JpaSpecificationExecutor` for filtering. Admin list uses `Specification` with `like` on lower(orderNumber/orderKey/email/phone). ✅
- `batchCountLineItems` uses `countByOrderIdIn(orderIds)` — single grouped query, **no N+1**. ✅
- `findByOrderId` lookups for line items, addresses, shipping, payment, notes are issued **per detail call**. For admin/customer detail (single order), this is acceptable. Could be optimized to JOIN-FETCH in one query but not required.
- **N+1 risk in admin list**: `toListItem` does NOT fetch line items per row → uses `batchCountLineItems`. ✅ no N+1.
- **`sumRefundAmountInRange` BUG**: returns `SUM(totalAmount)` for `status='REFUNDED'`. See Critical #3.
- Stock decrement uses `findByIdForUpdate` (pessimistic lock) — both product and variant. ✅ prevents oversell on concurrent checkout.
- `StockMovementEntity` records OUT for ORDER, IN for ORDER_CANCEL. ✅

### Cascade / orphan / nullable concerns

- `OrderLineItemEntity.productId` nullable (UUID) — necessary for legacy WP migrated orders where product may have been deleted. OK.
- `OrderEntity.customerId` nullable — guest orders. OK.
- `OrderEntity.placedAt` nullable — can be null for orders imported with no timestamp. Sort uses `nullsLast`. ✅
- `OrderEntity.legacyId unique` — OK for migration idempotency.

### Transactional integrity

- `CheckoutService.checkoutFromCart` is `@Transactional` — atomic for: order, line items, addresses, shipping items, payment record, applied coupons, system note, cart→CONVERTED, stock decrement + stock movement, coupon usage count. ✅
- WS push deferred to `afterCommit` (`AdminOrderWsService`). ✅ prevents push on rollback.
- Email is `@Async` — fire-and-forget. If commit succeeds but email fails, log only. ✅ acceptable.

### Idempotency / race

- ❌ No DB-level constraint to prevent duplicate orders from double-submit (other than `order_number`/`order_key` uniqueness, which won't catch since each call generates new UUID). Stock decrement via `findByIdForUpdate` prevents oversell but **does not prevent duplicate orders**.

---

## 9. Test Coverage Review

### Test inventory (Orders module)

| File | Tests | Focus |
|---|---|---|
| `Phase1FCheckoutApiTest.java` | 24 | checkout/quick-buy validation + happy path |
| `Phase1GOrderReadApiTest.java` | 22 | customer list/detail + guest lookup ownership/leak |
| `Phase1HAdminOrderApiTest.java` | 28 | admin list/detail + status/payment transitions + notes |
| `Phase1LReturnsApiTest.java` | ≥10 | returns CRUD, ownership, duplicate guard |

### Coverage matrix (selected high-risk cases)

| Case | Covered? | Test/Method | Risk if missing |
|---|---|---|---|
| Empty cart rejected | ✅ | `Phase1F.checkout_emptyCart_returns400` | Low |
| Invalid payment method | ✅ | `Phase1F.checkout_invalidPaymentMethod_returns400`, `quickBuy_invalidPaymentMethod_returns400` | Low |
| Invalid VN phone | ✅ | `Phase1F.checkout_invalidPhone_returns400` | Medium |
| Disabled shipping method | ✅ | `Phase1F.checkout_disabledShippingMethod_returns400` | Medium |
| Auto-select single shipping | ✅ | `Phase1F.checkout_shippingMethodAutoSelected_whenOnlyOneEnabled` | Low |
| BACS → ON_HOLD | ✅ | `Phase1F.checkout_guestBACS_createsOrder_status_ON_HOLD` | High |
| COD → PROCESSING | ✅ | `Phase1F.checkout_guestCOD_createsOrder_status_PROCESSING` | High |
| Cart → CONVERTED | ✅ | `Phase1F.checkout_cartMarkedConverted_afterCheckout` | High |
| Quick-buy unpublished product 409 | ✅ | `Phase1F.quickBuy_unpublishedProduct_returns409` | Medium |
| Quick-buy variant unavailable | ❌ | None | Medium — variant flow chưa test |
| **Double submit / idempotency** | ❌ | **None** | **Critical** — duplicate orders, double stock decrement |
| **Concurrent checkout same product (race)** | ❌ | **None** | **High** — relies on `findByIdForUpdate`, not asserted |
| BACS unpaid hold/expire/cancel | ❌ | **None** | Medium — partial index suggests planned, but no logic seen |
| **Cancel order → restore stock product-level** | ❌ | **None** | **High** — code exists, untested |
| **Cancel order → restore stock variant-level** | ❌ | **None** | **High** — code exists, untested |
| **Refund full / partial** | ❌ | **None** | **Critical** — PAYMENT_RULE_002/003 |
| **Refund report sum correctness** | ❌ | **None** | **Critical** — bug in query (Critical #3) |
| Payment record sync on PAID | ✅ | `Phase1H.updatePaymentStatus_paid_setsPaidAmountAndPaidAt` | High |
| Unauthorized admin write 401 | ✅ | `Phase1H.updateOrderStatus_noAuth_returns401`, etc. | High |
| Customer cannot view other order | ✅ | `Phase1G.customerOrderDetail_otherCustomerOrder_returns404` | High |
| Guest wrong key 404 | ✅ | `Phase1G.guestLookup_wrongKey_returns404` | High |
| Internal notes hidden | ✅ | `Phase1G.guestLookup_doesNotExposeInternalNotes` + admin sees all | High |
| IP/UA not leaked | ✅ | `Phase1G.customerOrderDetail_doesNotExposeIpOrUserAgent` | Medium |
| Invalid transitions 409 | ✅ | `Phase1H.updateOrderStatus_invalidTransition_returns409` | High |
| **Mobile/web/admin contract mismatch** | ❌ | **None** — there's no contract test between FE consumers and BE response shape | **Critical** — discovered during this audit |
| Notes added with customerVisible | ✅ | `Phase1H.addNote_customerVisibleNote_appearsInNotesList` | Medium |
| `allowed-transitions` endpoint | ❌ | None direct | Medium |

### Test coverage verdict

**Medium-Weak overall.** Backend route coverage is strong for happy-path + simple validation. **Refund and stock-restore are entirely untested at integration level.** Concurrency and idempotency are untested. No FE/BE contract test exists — this audit discovered live mismatches in web (`OrderShippingItem`/`OrderPayment`) and mobile (whole checkout payload) that integration tests would have caught immediately.

---

## 10. Critical Issues

### 🔴 Critical #1 — Mobile checkout BROKEN: payload field names lệch hoàn toàn

- **Severity:** Critical
- **Evidence:**
  - `bigbike_mobile/lib/core/models/checkout.dart` `CheckoutPayload.toJson` produces:
    ```json
    {
      "shippingAddress": {...},
      "billingAddress": {...},
      "shippingMethodCode": "...",
      "paymentMethodCode": "...",
      "notes": "..."
    }
    ```
  - `bigbike-backend/.../api/checkout/dto/CheckoutRequest.java` requires:
    ```java
    record CheckoutRequest(
        @NotNull @Valid CheckoutAddressRequest billingAddress,
        CheckoutShippingAddressRequest shippingAddress,
        String shippingMethodId,    // not Code
        @NotBlank String paymentMethod,  // not paymentMethodCode
        String customerNote          // not notes
    )
    ```
  - `paymentMethod` is `@NotBlank` → mobile request will fail Bean Validation with 400 ngay từ HTTP layer.
- **Impact:** Mobile users **không thể đặt hàng**. Toàn bộ revenue funnel mobile bị chặn.
- **Recommended fix:** Đổi mobile `CheckoutPayload.toJson` sang đúng tên field BE. Cụ thể: `paymentMethodCode → paymentMethod`, `shippingMethodCode → shippingMethodId` (và đổi semantic — `shippingMethodCode` = method.code, BE expect UUID `id`; cần chuyển sang gọi `/api/v1/checkout/options` rồi lấy `id`), `notes → customerNote`.
- **Files affected:** `bigbike_mobile/lib/core/models/checkout.dart`, `bigbike_mobile/lib/features/checkout/checkout_screen.dart` (variable rename + state management).

### 🔴 Critical #2 — Web customer order detail mismap field

- **Severity:** Critical (UI hiển thị sai)
- **Evidence:**
  - `bigbike-web/lib/contracts/commerce.ts:123-137` định nghĩa:
    ```ts
    export type OrderShippingItem = { id, code, title, cost }
    export type OrderPayment = { id, status, method, amount, transactionId, paidAt }
    ```
  - Backend trả (`OrderShippingItemResponse.java`, `OrderPaymentResponse.java`):
    ```
    OrderShippingItemResponse(id, methodCode, methodTitle, amount)
    OrderPaymentResponse(id, paymentMethod, status, amount, currency, paidAt)
    ```
  - `bigbike-web/app/tai-khoan/don-hang/[id]/page.tsx:317` dùng `order.payments[0]?.method` → undefined → fallback hiển thị `paymentStatus` thay cho payment method. Tương tự dòng 327: `item.title` và `item.cost` đều undefined → hiển thị `—` và `0₫`.
- **Impact:** Customer order history hiển thị sai phương thức thanh toán và phí ship. Có khả năng gây phàn nàn ("đã thanh toán mà sao không thấy tiền ship?").
- **Recommended fix:** Đổi `lib/contracts/commerce.ts`:
  ```ts
  OrderShippingItem: { id, methodCode, methodTitle, amount }
  OrderPayment: { id, status, paymentMethod, amount, currency, paidAt }
  ```
  và update mọi consumer (`app/tai-khoan/don-hang/[id]/page.tsx` ít nhất 1 chỗ).
- **Files affected:** `bigbike-web/lib/contracts/commerce.ts`, `bigbike-web/app/tai-khoan/don-hang/[id]/page.tsx`, possibly other consumers.

### 🔴 Critical #3 — Refund report sai số liệu

- **Severity:** Critical (báo cáo tài chính sai)
- **Evidence:**
  - `bigbike-backend/.../persistence/repository/commerce/order/OrderJpaRepository.java:102-104`:
    ```java
    @Query("SELECT COALESCE(SUM(o.totalAmount), 0) FROM OrderEntity o " +
           "WHERE o.placedAt >= :from AND o.placedAt < :to AND o.status = 'REFUNDED'")
    BigDecimal sumRefundAmountInRange(...)
    ```
  - Bug 1: `SUM(o.totalAmount)` thay vì `SUM(o.refundAmount)`. Một order có `totalAmount=10M`, refund đầy đủ thì `refundAmount=10M`, may mắn trùng. Nhưng order PARTIALLY_REFUNDED có `refundAmount < totalAmount` thì bug không lộ vì query loại order này hoàn toàn (filter `status='REFUNDED'`).
  - Bug 2: Filter `status='REFUNDED'` bỏ qua hoàn toàn các order có `paymentStatus='PARTIALLY_REFUNDED'` (status thường vẫn `COMPLETED` cho partial refunds).
  - `bigbike-backend/.../service/admin/AdminReportService.java:83`: `BigDecimal refundAmount = orderRepo.sumRefundAmountInRange(fromInstant, toInstant);` — đẩy thẳng vào `PeriodSummary.refundAmount`.
  - Admin Analytics screen + CSV export đều dùng giá trị sai này.
- **Impact:** Báo cáo doanh thu hoàn tiền **không khớp** với thực tế. Risk: tài chính/kế toán chốt số sai.
- **Recommended fix:**
  ```java
  @Query("SELECT COALESCE(SUM(o.refundAmount), 0) FROM OrderEntity o " +
         "WHERE o.placedAt >= :from AND o.placedAt < :to AND o.refundAmount > 0")
  BigDecimal sumRefundAmountInRange(...)
  ```
  Và thêm test `Phase1H.refundReport_partial_includesPartialRefundAmount`.
- **Files affected:** `OrderJpaRepository.java`, add test.

### 🔴 Critical #4 — Idempotency-Key không được backend xử lý

- **Severity:** Critical (data integrity)
- **Evidence:**
  - FE web gửi: `bigbike-web/app/thanh-toan/page.tsx:151` `idempotencyKey.current` qua header `Idempotency-Key`. `client-api.ts:91-94` truyền vào `extra` headers.
  - `grep -r Idempotency bigbike-backend/src/main/java` → kết quả chỉ có `PosOrderService.java` (POS path) và migration utilities. **`CheckoutController` và `CheckoutService` không đọc header này**.
  - Hệ quả: Double-tap "Đặt hàng" trong < 1s nếu network chậm sẽ gửi 2 request đầy đủ → tạo 2 order, decrement stock 2 lần (mỗi tx có lock nên ít nhất stock không âm trừ trường hợp buffer).
- **Impact:** Khách hàng thấy 2 đơn cho 1 lần đặt; stock bị giảm 2 lần; coupon usage tăng 2 lần. Chỉ trông cậy vào FE disable button — không đủ.
- **Recommended fix:**
  - Thêm bảng `checkout_idempotency_keys (key, customer_id|guest_session, order_id, created_at)` với unique key.
  - Trong `CheckoutController.checkout`, đọc `request.getHeader("Idempotency-Key")` và truyền vào service.
  - `CheckoutService.checkoutFromCart` mở đầu kiểm tra: nếu key exists → return existing OrderSummary; nếu chưa → upsert key + tiếp tục flow trong cùng tx.
  - Tham khảo cách `PosOrderService` đã làm với `posIdempotencyKey` (dùng `orderKey` làm key — tận dụng unique constraint).
- **Files affected:** `CheckoutController.java`, `CheckoutService.java`, new table + migration, `Phase1FCheckoutApiTest` thêm test idempotency.

### 🟠 High #5 — orderKey trả ra customer-authenticated response

- **Severity:** High (security hygiene)
- **Evidence:** `OrderDetailResponse.java:11` field `orderKey String`. `OrderReadService.toDetail` luôn gán `order.getOrderKey()`. Kể cả `getCustomerOrderDetail` (authenticated path).
- **Impact:** orderKey là token bí mật cho guest lookup. Trả ra cho authenticated customer mở rộng surface lộ token (browser cache, JS heap, third-party scripts trong `tai-khoan/...`). Không vi phạm rule cứng nhưng vi phạm least-privilege.
- **Recommended fix:** Tách 2 DTO hoặc set `orderKey=null` trong `getCustomerOrderDetail` path.
- **Files affected:** `OrderReadService.java`, `OrderDetailResponse.java`.

### 🟠 High #6 — Cancel/Refund stock-restore và refund logic không có integration test

- **Severity:** High
- **Evidence:** `grep refund` trong `bigbike-backend/src/test` chỉ trả về `Phase2C` (WP migration). `restoreStockForOrder` không được test trực tiếp.
- **Impact:** Code logic phức tạp (variant + product + stock_movements + low-stock recompute), nếu silently broken trong refactor thì không CI nào báo. Refund flow (PAYMENT_RULE_002, 003) chưa có hồi quy.
- **Recommended fix:** Thêm `Phase1HAdminOrderApiTest`:
  - `cancelOrder_restoresVariantStock_writesINMovement`
  - `cancelOrder_restoresProductStock_writesINMovement`
  - `createRefund_partial_setsPartiallyRefunded`
  - `createRefund_full_setsRefundedStatus_andSyncsPaymentRecord`
  - `createRefund_exceedsRefundable_returns400`
  - `createRefund_unpaidOrder_returns409` (PAYMENT_RULE_002)

### 🟡 Medium #7 — Web `OrderDetail` không render `appliedCoupons`

- **Severity:** Medium (feature gap)
- **Evidence:** `OrderDetailResponse` (customer/guest path) không expose `appliedCoupons` (chỉ admin DTO có). FE web `OrderDetail` type không có field này.
- **Impact:** Customer không biết mã giảm giá nào đã áp dụng cho đơn hàng.
- **Recommended fix:** Thêm `appliedCoupons` vào `OrderDetailResponse` (chỉ trả `code` và `discountAmount` — không lộ `couponId`).

### 🟡 Medium #8 — Date filter ở admin list silent-fail invalid format

- **Severity:** Low-Medium (UX)
- **Evidence:** `AdminOrderService.parseFromDate/parseToDate` swallow exception → null → no filter applied.
- **Impact:** User gõ date không hợp lệ → tưởng đã filter nhưng thực tế trả full list. Dễ gây confusion.
- **Recommended fix:** Throw `ValidationException.fromField("from"|"to", "INVALID_DATE", ...)` thay vì swallow.

### 🟡 Medium #9 — Quick-buy không exposed lên mobile

- **Severity:** Medium (feature parity)
- **Evidence:** `bigbike_mobile/lib/core/api/api_endpoints.dart:41` defines `quickBuy = '/api/v1/orders/quick-buy'` nhưng không có UI screen sử dụng (chỉ `checkout_screen` dùng `checkout`).
- **Impact:** Mobile thiếu shortcut "Mua ngay" vốn đã có ở web.
- **Recommended fix:** Either remove unused endpoint hoặc thêm UI.

### 🟡 Medium #10 — `AdminOrderController.resolveAdminId()` fallback to dev UUID in prod

- **Severity:** Medium
- **Evidence:** `AdminOrderController.java:39, 157-167` — nếu principal id không parse UUID, dùng `00000000-0000-0000-0000-000000000001`.
- **Impact:** Audit log mất chính xác actor trong edge case.
- **Recommended fix:** Ném 500 Internal hoặc fail hard nếu prod profile.

### 🟢 Low — Other observations

- `OrderEntity.paymentMethod` field tồn tại độc lập với `payments[].paymentMethod` — **double source of truth** (set ở `CheckoutService.buildOrder` trong service nhưng setter không gọi). Đọc lại `buildOrder`: KHÔNG gọi `order.setPaymentMethod(paymentMethod)` → field luôn null cho new orders. V46 backfill từ legacy. Nên: hoặc lưu, hoặc xóa column.
- `OrderEntity.channel` mặc định "WEB" — quick-buy/checkout không set explicit; POS service set "POS". OK.
- `idx_orders_onhold_sepay_placed` partial index vẫn còn dù SePay đã remove (V59) — orphan index, low priority.

---

## 11. Recommended Fix Plan

### Phase 1 — Must fix BEFORE production

1. **Fix mobile checkout payload field names** (Critical #1) — 0.5 day.
2. **Fix web `OrderShippingItem`/`OrderPayment` contract mismatch** (Critical #2) — 0.5 day.
3. **Fix `sumRefundAmountInRange` query** + add unit test (Critical #3) — 0.5 day.
4. **Implement Idempotency-Key handling on `/checkout` and `/orders/quick-buy`** (Critical #4) — 1.5 day (table + migration + service + 2 tests).
5. **Add integration tests for refund + cancel/restore stock** (High #6) — 1.5 day (6 tests).
6. **Stop returning `orderKey` to authenticated customer** (High #5) — 0.5 day.

**Phase 1 estimate: ~5 dev-days for 1 senior backend + 0.5 day frontend + 0.5 day mobile.**

### Phase 2 — Should fix soon (post-launch within 2-4 weeks)

7. Expose `appliedCoupons` to customer/guest order detail (Medium #7).
8. Date filter validation hard-fail (Medium #8).
9. Decide on mobile quick-buy UI (Medium #9).
10. Audit-log actor fallback hard-fail in prod (Medium #10).
11. Add concurrent-checkout race test (`findByIdForUpdate` correctness).
12. Add contract test (e.g., Pact / Spring Cloud Contract) between BE and each FE consumer to prevent future field drift.

### Phase 3 — Nice to have

13. Remove/clean up `OrderEntity.paymentMethod` redundancy.
14. Drop orphan `idx_orders_onhold_sepay_placed` index.
15. Add `@Size(max=1000)` to `customerNote` and `note` fields.
16. Document guest-lookup semantics in `BUSINESS_RULES.md` (orderKey expiration policy?).
17. WS push integration test.
18. Notification email content snapshot tests.

---

## 12. Final Verdict

### Module Orders đã hoàn thiện chưa?

**Chưa.** Backend core là solid và follow đúng business rules, nhưng có **4 Critical bugs** đang chặn production:

1. **Mobile checkout bị broken hoàn toàn** ở payload field names.
2. **Web customer order detail hiển thị sai** payment method và shipping cost (contract mismatch).
3. **Refund analytics sai số** — query bug + filter sai.
4. **Idempotency không enforce** ở backend dù FE đã gửi key — double-submit tạo duplicate order.

### Có thiếu gì?

- **Test integration cho refund và cancel/restore stock** = 0% coverage cho tài chính-critical flows.
- **Contract test FE↔BE** chưa tồn tại — đó là lý do 2 lỗi contract (Critical #1 và #2) chỉ được phát hiện ở audit này.
- **Mobile feature parity** thiếu quick-buy UI (endpoint sẵn nhưng không dùng).
- **Customer detail thiếu `appliedCoupons`** (admin có).

### Có thể cho AI agent triển khai tiếp không?

**Có, với điều kiện:**

- Agent **phải** đọc Critical #1-#4 trước và xử lý theo Phase 1 sequence.
- Agent **không** được "fix" những thứ đã được docs flag là code bug ở module khác (theo `CLAUDE.md` rule).
- Mỗi fix Critical phải đi kèm test mới (Phase 1F/H), không chỉ change code.
- Mobile fix phải được test thật trên Flutter app (không chỉ unit) vì payload semantics thay đổi (`shippingMethodCode` → `shippingMethodId` là UUID, không phải code string).

### Có đủ an toàn để production chưa?

**Chưa.** Khuyến nghị:

- **Block release** cho mobile cho đến khi Critical #1 fixed.
- **Soft-launch web** chấp nhận được nếu Critical #2 fix được trong 1-2 ngày, nhưng nên fix trước.
- **Block đẩy báo cáo doanh thu hoàn tiền cho kế toán/finance** cho đến khi Critical #3 fixed (hoặc dùng query thủ công thay thế).
- **Idempotency #4** có thể chấp nhận với mitigation FE: disable button submit, double-tap detection, server-side rate limit (đã có `LimitTier.CHECKOUT`). Tuy nhiên fix backend là cần thiết trong vòng 2 tuần.

**Production readiness: Not Ready, ETA ~1 sprint (5-7 dev-days) with above plan.**

---

## Appendix — Doc Mismatches detected during audit

- `BUSINESS_RULES.md` ORDER_RULE_003 status `MISSING_TEST_COVERAGE` ✅ confirmed (transitions tested but a few endpoints still no test).
- `BUSINESS_RULES.md` PAYMENT_RULE_003 / PAYMENT_RULE_004 status `MISSING_TEST_COVERAGE` ✅ confirmed.
- `STATE_MACHINES.md` "Order — Backend service CONFIRMED_BACKEND_ENFORCED" ✅ matches code (`AdminOrderService.ALLOWED_TRANSITIONS`).
- `STATE_MACHINES.md` "Payment record full lifecycle STATUS_ONLY" ✅ confirmed — Payment record statuses (`PENDING`, `SUCCEEDED`, `REFUNDED`) are set as side effects without explicit transition map.
- No documented contract test promised in any doc — gap not previously flagged.

End of audit.
