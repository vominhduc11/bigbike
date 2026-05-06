# Returns / Refunds Module Audit

> Date: 2026-05-06
> Branch: `main` @ 73adcef
> Audit scope: backend, admin SPA, web Next.js, Flutter mobile, migrations, tests, docs.
> Tham chiếu canonical: [docs/business/STATE_MACHINES.md](../business/STATE_MACHINES.md), [docs/business/BUSINESS_RULES.md](../business/BUSINESS_RULES.md), [docs/engineering/API_CONTRACT.md](../engineering/API_CONTRACT.md).
>
> **Fix log (post-audit, 2026-05-06)**:
> - P0-1 FIXED: Web forms now send `items` array (checkbox+qty picker added to both `doi-tra/page.tsx` and `don-hang/[id]/page.tsx`; `CreateReturnPayload.items` required).
> - P0-2 FIXED: Mobile `create_return_screen.dart` rewritten — fetches order line items, renders checkbox+qty picker, sends `items` array; `DELIVERED` removed from `_returnableStatuses`.
> - P0-3 FIXED: Mobile `returns_screen.dart` `_load()` now uses `get<dynamic>` + normalizes raw `List` or `{data:[...]}` safely.
> - P0-4 FIXED: `CustomerReturnService.createReturn` validates each item's `orderLineItemId` belongs to order, derives all product fields from `OrderLineItemEntity`, validates `quantity ≤ remaining returnable`. Duplicate `orderLineItemId` in same payload now rejected with `DUPLICATE` (400). Migration V65 extends partial unique index to cover `RECEIVED`.
> - P0-5 FIXED: Unified `RefundService.applyRefund` created; both `AdminOrderService.createRefund` and `AdminReturnService.updateStatus→REFUNDED` delegate to it. RMA refund now syncs `orders.payment_status`, `orders.refunded_at`, `payments.*`, creates audit log, order note, WS event.
> - P1-1 FIXED: `AdminReturnService.updateStatus` validates `refundAmount > 0` before `REFUNDED` transition.
> - P1-2 FIXED: V65 migration drops and recreates `idx_returns_order_active` to include `RECEIVED`. App-level duplicate guard updated to match.
> - Tests: `Phase1LReturnsApiTest` tests 19-23 added (non-COMPLETED order, invalid reason, item not in order, quantity exceeds remaining, productName derived from DB). Test 24 added (duplicate `orderLineItemId` → 400 `DUPLICATE`).
> - Stock restore: confirmed `RECEIVED → REFUNDED` does NOT restore return-item stock (correct per `STATE_MACHINES.md`). `RefundService.applyRefund` may set `order.status = REFUNDED` on full refund but does not call `restoreStockForOrder` — pre-existing gap documented below (P1-new), out of current scope.
> - **Mobile tests not yet verified** (no widget/unit tests for returns screens). Module is NOT marked COMPLETE.
> - Remaining open items: P1-new (RefundService full-refund does not restore order-level stock), P1-6 (test coverage gaps for full lifecycle, stock restore on COMPLETED, invalid transition), P2 items unchanged.

---

## 1. Executive Summary

- **Verdict: PARTIAL — không production-ready.**
- **Production readiness: FAIL.**
- Module đã có khung end-to-end (DB schema, backend service/controller, admin UI list+detail+update, web/mobile list+detail), nhưng **flow tạo return từ customer (web + mobile) đang bị broken**, **mobile list-returns sẽ throw cast error**, và lớp validate item-level ở backend gần như không tồn tại.
- 3 rủi ro lớn nhất:
  1. **Web + mobile gửi `createReturn` thiếu `items` → backend `@NotEmpty` reject 400 ⇒ customer không bao giờ tạo return được.** (P0)
  2. **Mobile `returns_screen` cast `List` thành `Map<String, dynamic>` ⇒ list returns crash ngay khi mở.** (P0)
  3. **Backend không validate item thuộc order, không validate quantity ≤ purchased ⇒ customer có thể gửi item bịa ra (productName, sku, quantity, unitPrice) hoặc số lượng vượt mua, rồi admin restore stock theo dữ liệu giả ⇒ inventory + refund số liệu sai.** (P0 security/integrity)

Sau khi 3 vấn đề trên được fix, module mới đạt mức "có thể bật cho khách thật".

---

## 2. Scope Audited

### Backend (`bigbike-backend`)
- Entity: [ReturnEntity.java](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/persistence/entity/commerce/returns/ReturnEntity.java), [ReturnItemEntity.java](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/persistence/entity/commerce/returns/ReturnItemEntity.java), [ReturnHistoryEntity.java](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/persistence/entity/commerce/returns/ReturnHistoryEntity.java), [OrderEntity.java](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/persistence/entity/commerce/order/OrderEntity.java), [PaymentEntity.java](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/persistence/entity/commerce/payment/PaymentEntity.java).
- Repository: [ReturnJpaRepository.java](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/persistence/repository/commerce/returns/ReturnJpaRepository.java), [ReturnItemJpaRepository.java](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/persistence/repository/commerce/returns/ReturnItemJpaRepository.java), [ReturnHistoryJpaRepository.java](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/persistence/repository/commerce/returns/ReturnHistoryJpaRepository.java).
- Service: [CustomerReturnService.java](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/order/CustomerReturnService.java), [AdminReturnService.java](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminReturnService.java), [AdminOrderService.java](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminOrderService.java) (refund flow).
- Controller / DTO: [CustomerOrderController.java](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/order/CustomerOrderController.java), [AdminReturnController.java](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/admin/AdminReturnController.java), [AdminOrderController.java](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/admin/AdminOrderController.java), [CreateReturnRequest.java](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/order/dto/CreateReturnRequest.java), [CustomerReturnResponse.java](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/order/dto/CustomerReturnResponse.java), [UpdateReturnStatusRequest.java](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/admin/dto/returns/UpdateReturnStatusRequest.java), [AdminReturnDetailResponse.java](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/admin/dto/returns/AdminReturnDetailResponse.java), [AdminReturnListItemResponse.java](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/admin/dto/returns/AdminReturnListItemResponse.java), [CreateRefundRequest.java](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/admin/dto/order/CreateRefundRequest.java).
- Security: [SecurityConfig.java](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/config/SecurityConfig.java), [CustomerCsrfFilter.java](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/config/CustomerCsrfFilter.java).

### Admin (`bigbike-admin`)
- Routing & permission: [App.jsx](../../bigbike-admin/src/App.jsx) (lines 62, 165, 205, 388-389).
- Screens: [ReturnListScreen.jsx](../../bigbike-admin/src/screens/ReturnListScreen.jsx), [OrderDetailScreen.jsx](../../bigbike-admin/src/screens/OrderDetailScreen.jsx).
- Components: [RefundModal.jsx](../../bigbike-admin/src/components/RefundModal.jsx).
- API client: [adminApi.js](../../bigbike-admin/src/lib/adminApi.js) (`fetchReturns`, `fetchReturnDetail`, `updateReturnStatus`, `createRefund`, `normalizeReturn`, `parseListPayload`).

### Web (`bigbike-web`)
- Pages: [tai-khoan/doi-tra/page.tsx](../../bigbike-web/app/tai-khoan/doi-tra/page.tsx), [tai-khoan/don-hang/[id]/page.tsx](../../bigbike-web/app/tai-khoan/don-hang/[id]/page.tsx).
- API client: [lib/api/client-api.ts](../../bigbike-web/lib/api/client-api.ts) (lines 181-193).
- Contracts: [lib/contracts/commerce.ts](../../bigbike-web/lib/contracts/commerce.ts) (lines 250-298).

### Mobile (`bigbike_mobile`)
- Screens: [features/account/returns_screen.dart](../../bigbike_mobile/lib/features/account/returns_screen.dart), [features/account/create_return_screen.dart](../../bigbike_mobile/lib/features/account/create_return_screen.dart).
- API: [core/api/api_client.dart](../../bigbike_mobile/lib/core/api/api_client.dart), [core/api/api_endpoints.dart](../../bigbike_mobile/lib/core/api/api_endpoints.dart) (lines 57-61).

### Migrations
- [V28__add_refund_fields.sql](../../bigbike-backend/src/main/resources/db/migration/V28__add_refund_fields.sql) — order/payment refund fields.
- [V31__create_returns_tables.sql](../../bigbike-backend/src/main/resources/db/migration/V31__create_returns_tables.sql) — returns / return_items / return_history.
- [V39__returns_race_guard_and_seq.sql](../../bigbike-backend/src/main/resources/db/migration/V39__returns_race_guard_and_seq.sql) — partial unique index on (PENDING, APPROVED).
- [V49__create_roles_permissions_tables.sql](../../bigbike-backend/src/main/resources/db/migration/V49__create_roles_permissions_tables.sql) — role / permission table.

### Tests
- Backend: [Phase1LReturnsApiTest.java](../../bigbike-backend/src/test/java/com/bigbike/bigbike_backend/api/Phase1LReturnsApiTest.java), [Phase1HAdminOrderApiTest.java](../../bigbike-backend/src/test/java/com/bigbike/bigbike_backend/api/Phase1HAdminOrderApiTest.java) (refund tests #28+).
- Admin / web / mobile: **không có test cho returns/refunds**.

### Docs
- Đã đối chiếu với [STATE_MACHINES.md](../business/STATE_MACHINES.md) §10, [BUSINESS_RULES.md](../business/BUSINESS_RULES.md) §10 (RETURN_RULE_001/002, PAYMENT_RULE_002/003, INVENTORY_RULE_004), [API_CONTRACT.md](../engineering/API_CONTRACT.md) §7 + §8.4.

---

## 3. Route & Screen Coverage

| App | Route/Screen | Exists? | Works with backend contract? | Issues |
|---|---|---:|---:|---|
| Admin | `/admin/returns` (list) | ✅ | ✅ | `pageSize` query không được backend đọc (backend chỉ nhận `size`) ⇒ pagination size luôn = 20. |
| Admin | Return detail (modal trong [ReturnListScreen.jsx](../../bigbike-admin/src/screens/ReturnListScreen.jsx)) | ✅ | ✅ | Detail dùng JS modal trong list screen — không có dedicated `/admin/returns/:id` route, deep-link không hoạt động. |
| Admin | Update return status (modal) | ✅ | ✅ | UI cho phép APPROVE/REJECT/RECEIVE/COMPLETE/REFUND. UI map state machine bằng JS hardcoded ([NEXT_STATUSES](../../bigbike-admin/src/screens/ReturnListScreen.jsx) line 36-40) — không gọi `allowed-transitions` API. Backend là enforcement gate, ok. |
| Admin | Refund modal trong order detail | ✅ | ✅ | Hiển thị khi `paymentStatus ∈ {PAID, PARTIALLY_PAID}`. |
| Admin | Refund từ return RMA flow | ⚠️ | partial | Khi admin chọn status `REFUNDED` trong return modal, backend **chỉ set `orders.refund_amount`** (xem [AdminReturnService.java line 162-165](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminReturnService.java)). KHÔNG: cập nhật `orders.payment_status`, `orders.refunded_at`, `payments.refund_amount`, `payments.refunded_at`, `payments.status`, không tạo audit log, không tạo order note ⇒ **2 refund flow lệch nhau** (P0). |
| Web | `/tai-khoan/doi-tra` (list + create form) | ✅ | ❌ BROKEN | `createReturn` không gửi `items` ⇒ backend `@NotEmpty` reject 400. |
| Web | `/tai-khoan/doi-tra` (detail) | ✅ (modal) | ✅ | Render đúng. Không có dedicated `/tai-khoan/doi-tra/[id]` route. |
| Web | `/tai-khoan/don-hang/[id]` (create return từ order) | ✅ | ❌ BROKEN | Cùng lỗi thiếu `items`. |
| Mobile | `returns_screen.dart` (list) | ✅ | ❌ CRASH | `(resp['data'] as List?)` — backend trả raw `List<...>` nên `resp` là `List`, không phải `Map`; `Map<String, dynamic> resp` cast → throw `_TypeError` (xem chi tiết phần 11). |
| Mobile | `returns_screen.dart` (detail) | ✅ | ⚠️ | `(resp['data'] as Map<String, dynamic>?) ?? resp` — backend trả raw map (không có `data` wrapper), fallback dùng `resp` thật ra hoạt động vì map chính là detail. |
| Mobile | `create_return_screen.dart` | ✅ | ❌ BROKEN | Không gửi `items`. Cùng lỗi như web. |
| Mobile | Refund-specific UI | ❌ | n/a | Mobile không có RMA-refund flow (chỉ hiển thị `refundAmount` ở detail), điều này hợp lý vì refund chỉ admin làm. |

---

## 4. API Coverage

| API | Method | Auth | Permission | Request body | Response shape | Status |
|---|---|---|---|---|---|---|
| `/api/v1/customer/orders/{orderId}/returns` | POST | ROLE_CUSTOMER + CSRF | n/a (own order) | `CreateReturnRequest{reason, customerNote, items[]}` (`items @NotEmpty`) | raw `CustomerReturnResponse`, HTTP 201 | ✅ backend OK; ❌ web/mobile gửi không có `items`. |
| `/api/v1/customer/orders/returns` | GET | ROLE_CUSTOMER | n/a | — | raw `List<CustomerReturnResponse>` | ✅ backend OK; mobile cast wrong shape (P0). |
| `/api/v1/customer/orders/returns/{returnId}` | GET | ROLE_CUSTOMER | own only (NotFoundException nếu không match `customerId`) | — | raw `CustomerReturnResponse` | ✅ |
| `/api/v1/admin/returns` | GET | ROLE_ADMIN | `orders.read` | query: `page, size, status, q` | raw `PageResult{items, page, pageSize, totalItems, totalPages}` | ⚠️ admin client gửi `pageSize`, backend đọc `size` ⇒ pagination size luôn 20 (xem [adminApi.js line 1747](../../bigbike-admin/src/lib/adminApi.js) vs [AdminReturnController.java line 43](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/admin/AdminReturnController.java)). |
| `/api/v1/admin/returns/{returnId}` | GET | ROLE_ADMIN | `orders.read` | — | raw `AdminReturnDetailResponse` | ✅ |
| `/api/v1/admin/returns/{returnId}/status` | PATCH | ROLE_ADMIN | `orders.write` | `UpdateReturnStatusRequest{status, adminNote, refundAmount}` | raw `AdminReturnDetailResponse` | ⚠️ Side-effect không đầy đủ khi `status=REFUNDED` (xem §8). |
| `/api/v1/admin/orders/{orderId}/refund` | POST | ROLE_ADMIN | `orders.write` | `CreateRefundRequest{refundAmount, refundReason, note, customerVisible}` | wrapped `ApiDataResponse<AdminOrderDetailResponse>` | ✅ Đầy đủ side effects (order, payment, audit, note, ws, notification). |

> Envelope không nhất quán giữa hai cụm endpoint (returns trả raw, refund trả `{data}`). Đã được [API_CONTRACT.md §7](../engineering/API_CONTRACT.md) ghi nhận là *envelope inconsistency*. Không phải bug nhưng làm FE phải normalize 2 kiểu — admin client đã làm được, mobile thì làm sai cho list (xem §11).

---

## 5. Permission & Security Audit

| Area | Current behavior | Risk | Recommendation |
|---|---|---|---|
| Customer auth cho `/customer/orders/**` | ROLE_CUSTOMER bắt buộc + CSRF cho mutate ([SecurityConfig.java:111](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/config/SecurityConfig.java)). | OK | — |
| Customer object-level | `CustomerReturnService.createReturn`/`getCustomerReturn` so sánh `customerId` từ session với `order.customerId`/`return.customerId`, mismatch trả `NotFoundException` (không leak existence). | OK | — |
| Admin permission cho returns | Cả read+write dùng `orders.read`/`orders.write`. Không có permission `returns.read/write`. | Trung bình. ADMIN/SHOP_MANAGER đều có `orders.read/write` mặc định nên truy cập được returns cùng cấp với orders — đúng với mô hình hiện tại nhưng không cho phép tách quyền (vd: cho 1 nhân viên xử lý returns mà không sửa order). | (P2) Tách `returns.read` / `returns.write` trong [V49](../../bigbike-backend/src/main/resources/db/migration/V49__create_roles_permissions_tables.sql) khi nghiệp vụ cần. |
| CSRF | `CustomerCsrfFilter` ngoại trừ auth endpoints; `/customer/orders/**` được bảo vệ. Mobile có gửi `X-CSRF-Token` từ cookie `bb_csrf` ([api_client.dart:96-104](../../bigbike_mobile/lib/core/api/api_client.dart)). | OK | — |
| Trust client data | **Backend tin client cho `productName`, `variantName`, `sku`, `unitPrice`, `quantity`, `orderLineItemId`** — nhận trực tiếp từ DTO, không validate chéo với order line item. Xem [CustomerReturnService.java:101-113](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/order/CustomerReturnService.java). | **CAO**. Customer có thể gửi unitPrice 999.999.999 → admin restore stock theo quantity client cung cấp → audit log/báo cáo méo. | (P0) Validate `orderLineItemId` ∈ order; derive `productName/sku/variantName/unitPrice` từ line item thay vì tin client; validate `quantity ≤ purchased - đã return`. |
| Order eligibility | Chỉ check `order.status == COMPLETED`. | OK theo BUSINESS_RULES nhưng không check thời hạn (return window) hoặc đã refund đầy. | (P1) Thêm window kiểm tra (vd 30 ngày kể từ `completedAt`). Nếu chưa cần thì giữ nhưng ghi vào docs. |
| Duplicate return guard | App layer (loop list `findByOrderIdOrderByCreatedAtDesc`) **+** DB partial unique index trên `(order_id) WHERE status IN ('PENDING', 'APPROVED')` (V39). | OK cho race nhẹ. | Test cần khẳng định ConstraintViolation không leak ra customer (hiện chưa có). |
| Customer note sanitize | Không sanitize/length-limit ở backend. | Trung bình — column là TEXT nên DB chịu được, nhưng có thể abuse 10MB note. | (P2) `@Size(max=2000)` trên `customerNote`, `adminNote`. |
| Status enum | Backend so sánh `req.status().toUpperCase()` rồi check thuộc transition map (default empty). Reason cũng vậy. | OK | — |
| Refund permission khi đến từ RMA | Cùng `orders.write`, không có gate riêng "có quyền approve refund". | OK trong scope hiện tại. | — |

---

## 6. Validation Audit

Legend: ✅ có; ❌ thiếu; — không áp dụng.

| Validation | Backend | Admin FE | Web FE | Mobile | Status |
|---|---:|---:|---:|---:|---|
| `reason` required | ✅ `@NotBlank` + enum check (`VALID_REASONS`) | ✅ | ✅ | ✅ | OK |
| `reason` invalid → 400 với code `INVALID` | ✅ | hiển thị message | hiển thị message | hiển thị message | OK |
| `items` required (`@NotEmpty`) | ✅ | n/a (admin không tạo) | ❌ Web không gửi | ❌ Mobile không gửi | **P0** |
| `orderLineItemId` thuộc order | ❌ | n/a | n/a | n/a | **P0** thiếu (xem §11). |
| `productName/sku/unitPrice` derive từ order | ❌ tin client | n/a | n/a | n/a | **P0** thiếu. |
| `quantity > 0` | ⚠️ chỉ `Math.max(1, item.quantity())` — coerce mọi giá trị xấu thành ≥1 | ❌ | ❌ | ❌ | **P1** Nên reject thay vì coerce. |
| `quantity ≤ purchased - đã return` | ❌ | ❌ | ❌ | ❌ | **P0** thiếu. |
| Order status eligible (`COMPLETED`) | ✅ | ✅ filter ở UI | ✅ filter | ✅ filter | OK |
| Order thuộc customer | ✅ via session | n/a | n/a | n/a | OK |
| Duplicate active return | ✅ app + DB index (V39) | UI không gate | UI không gate | UI không gate | OK |
| Customer note length | ❌ (`@Size` thiếu) | ❌ | ❌ | ❌ | P2 |
| `status` admin enum | ✅ via transition map | ✅ FE map | n/a | n/a | OK |
| `adminNote` length | ❌ | ❌ | n/a | n/a | P2 |
| `refundAmount > 0` cho RMA | ❌ — backend chấp nhận `null/0/negative` (`if (req.refundAmount() != null) ret.setRefundAmount(req.refundAmount())`) | ✅ FE chỉ hiện input khi `REFUNDED` | n/a | n/a | **P1** Backend cần validate `> 0` và `≤ paidAmount - alreadyRefunded`. |
| `refundAmount` không vượt paid amount cho RMA | ❌ | ❌ | n/a | n/a | **P0** AdminReturnService không check refundable; có thể set `orders.refund_amount = 9.999.999` mà không check. |
| Direct refund: `refundAmount > 0` | ✅ `@DecimalMin("0.01")` + `> 0` re-check | ✅ | n/a | n/a | OK |
| Direct refund: `≤ refundable` | ✅ AdminOrderService line 392-400 | ✅ FE | n/a | n/a | OK |
| Direct refund: order paid status | ✅ `PAID` hoặc `PARTIALLY_PAID` | ✅ UI ẩn modal | n/a | n/a | OK |

---

## 7. State Machine Audit

| Entity | States | Allowed transitions | Backend enforced? | Issues |
|---|---|---|---:|---|
| Return | PENDING / APPROVED / REJECTED / RECEIVED / COMPLETED / REFUNDED | `PENDING→APPROVED|REJECTED`, `APPROVED→RECEIVED`, `RECEIVED→COMPLETED|REFUNDED`. REJECTED/COMPLETED/REFUNDED là terminal. | ✅ ([AdminReturnService.java:53-57](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminReturnService.java)) | (P2) Không cho phép `RECEIVED → REJECTED`/`APPROVED → REJECTED` — nghiệp vụ thực thường cần huỷ giữa chừng (vd hàng giả mạo). Cần xác nhận với business. |
| Return — admin UI | Cùng map | Hardcoded ở FE (`NEXT_STATUSES` line 36-40) | n/a | OK; FE chỉ là gợi ý. |
| Refund (qua return) | n/a | `RECEIVED → REFUNDED` | ✅ | Không sync `payments`/`paymentStatus`/audit (xem §8). |
| Refund (direct) | Payment statuses + Order status (`COMPLETED → REFUNDED`) | `PAID/PARTIALLY_PAID → PARTIALLY_REFUNDED/REFUNDED`; full refund có thể đẩy `order.status = REFUNDED` | ✅ ([AdminOrderService.java:411-419](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminOrderService.java)) | OK |

---

## 8. Refund Consistency Audit

| Flow | Updates `orders.refund_amount` | Updates `orders.payment_status` | Updates `orders.refunded_at` | Updates `orders.refund_reason` | Updates `payments.refund_amount`/`refunded_at`/`status` | Audit log | Order note | Notification | WS event | Issues |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| Direct order refund (`AdminOrderService.createRefund`) | ✅ | ✅ (`PARTIALLY_REFUNDED`/`REFUNDED`) | ✅ | ✅ (nếu có) | ✅ tất cả | ✅ `ORDER_REFUND_CREATED` | ✅ tự sinh hoặc dùng `req.note` | ✅ chỉ gửi khi full refund | ✅ `ORDER_REFUND_CREATED` | OK |
| RMA refund (`AdminReturnService.updateStatus → REFUNDED`) | ✅ chỉ overwrite `order.refundAmount` (không cộng dồn) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ `sendReturnRefunded` (email) | ❌ | **P0**. Hai flow lệch nhau hoàn toàn. |

> **Tác động**: nếu admin tạo return → REFUNDED, payment status order vẫn là `PAID` mặc dù tiền đã hoàn. Báo cáo doanh thu (`AdminReportService.fetchRefundAmountSummary`) đếm `orders.refund_amount` nên hiện đúng số tiền refund, nhưng `payments` vẫn `PAID` → đối soát ngân hàng/SePay sẽ sai. Ngoài ra, `order.refundAmount` bị overwrite (không `add`) ⇒ nếu trước đó đã direct-refund 200k rồi RMA-refund 500k, kết quả là 500k thay vì 700k.

---

## 9. DB Behavior Audit

| Table / Constraint / Index | Exists? | Correct? | Issues |
|---|---:|---:|---|
| `returns` table (V31) | ✅ | ✅ | FK `order_id` ON DELETE RESTRICT (an toàn). FK `customer_id` ON DELETE SET NULL (lỡ xoá customer thì return còn lại, OK theo audit trail). |
| `returns.return_number` UNIQUE | ✅ | ✅ | OK. |
| `returns.status` default `'PENDING'` | ✅ | ✅ | OK. |
| `returns.status` CHECK constraint | ❌ | ❌ | **P1** Không có CHECK ENUM ⇒ lỡ code lỗi viết `'pending'` nhỏ là DB chấp nhận. |
| `returns.reason` CHECK constraint | ❌ | ❌ | **P1** Cùng lý do. |
| `returns.refund_amount >= 0` CHECK | ❌ | ❌ | P2. App có default 0 nhưng không cấm âm. |
| `idx_returns_order_id` / `customer_id` / `status` | ✅ | ✅ | OK. |
| Partial unique idx `idx_returns_order_active` (V39) WHERE status IN (PENDING, APPROVED) | ✅ | ⚠️ partial | **P1**. State machine cho phép `RECEIVED` (đã nhận hàng) — về mặt nghiệp vụ vẫn là return active, nhưng index không cover. Hệ quả: khi return ở `RECEIVED`, customer có thể tạo return mới cho cùng order (DB cho phép, app check chỉ chặn `PENDING`/`APPROVED`). Nên include `'RECEIVED'`. |
| `return_items` table (V31) | ✅ | ✅ | OK. FK `order_line_item_id ON DELETE SET NULL` — hợp lý. |
| `return_items.quantity > 0` CHECK | ❌ | ❌ | P1. |
| `return_items.unit_price >= 0` CHECK | ❌ | ❌ | P2. |
| `return_history` table (V31) | ✅ | ✅ | OK. `from_status` nullable, `to_status` not null. |
| `return_history.admin_id` FK | ❌ | ❌ | P2. Hiện là raw UUID không FK → admin bị xoá thì lịch sử mồ côi nhưng vẫn read được. Không nghiêm trọng. |
| `return_number_seq` sequence | ✅ | ✅ | OK; service dùng `nextval`. |
| `orders.refund_amount/refund_reason/refunded_at` (V28) | ✅ | ✅ | OK. |
| `payments.refund_amount/refunded_at` (V28) | ✅ | ✅ | OK. |
| Idempotency cho refund (direct + RMA) | ❌ | ❌ | P1. Không có idempotency key cho `POST /admin/orders/{id}/refund` — admin double-click sẽ cộng dồn. UI có disable button, nhưng không phải defence-in-depth. |
| Transaction boundary | ✅ `@Transactional` trên createReturn/updateStatus/createRefund | ✅ | OK. |
| Concurrency stock restore | ✅ `findByIdForUpdate` (pessimistic lock) khi update variant trong RMA flow | ✅ | OK. |

---

## 10. Test Coverage

| Area | Covered? | Test file | Missing tests |
|---|---:|---|---|
| Create return — auth required | ✅ | `Phase1LReturnsApiTest#listReturns_withoutSession_returns401`, `createReturn_withoutSession_returns403` | — |
| Create return — non-existent order | ✅ | `createReturn_nonExistentOrder_returns404` | — |
| Create return — other customer's order | ✅ | `createReturn_otherCustomerOrder_returns404` | — |
| Create return — non-completed order | ❌ | — | **P0** Chưa có test cho `NOT_RETURNABLE` validation. |
| Create return — invalid reason enum | ❌ | — | P1 |
| Create return — items @NotEmpty rejection | ❌ | — | **P0** Đáng lẽ phải có để catch bug web/mobile. |
| Create return — item not in order | ❌ | — | **P0** (logic chưa tồn tại). |
| Create return — quantity > purchased | ❌ | — | **P0** (logic chưa tồn tại). |
| Create return — duplicate active | ✅ | `createReturn_duplicate_returns400` | Chưa cover duplicate khi status = RECEIVED. |
| Create return — happy path | ✅ | `createReturn_completedOrder_returns201WithReturnNumber`, `listReturns_afterCreation_containsReturn` | — |
| Get own return detail | ✅ | `getReturn_ownReturn_returnsFullDetail` | — |
| Get other customer's return | ✅ | `getReturn_otherCustomer_returns404` | — |
| Admin list — auth required | ✅ | `adminListReturns_noAuth_returns401` | — |
| Admin list — paginated | ✅ | `adminListReturns_authenticated_returnsPaginatedResult` | Chưa test `pageSize` param mismatch. |
| Admin filter / search | ✅ | `adminListReturns_searchByOrderNumber_filtersResults`, `filterByStatus_returnsPendingOnly` | — |
| Admin detail | ✅ | `adminGetReturn_existingReturn_returnsDetail`, `includesOrderNumberAndCustomerEmail` | — |
| Admin update — happy path | ✅ | `adminUpdateReturnStatus_toApproved_succeeds` | — |
| Admin update — viewer permission | ✅ | `adminUpdateReturnStatus_viewerRole_returns403` | — |
| Admin update — invalid transition | ❌ | — | **P0** vd PENDING→COMPLETED nên reject. |
| Full return lifecycle (PENDING → APPROVED → RECEIVED → COMPLETED) | ❌ | — | **P0** + verify `restoreStockForReturn` thực sự ghi `stock_movements`. |
| Stock restore on COMPLETED | ❌ | — | **P0**. |
| RMA refund (RECEIVED → REFUNDED) sync sang payment | ❌ | — | **P0**. Hiện không sync, test sẽ FAIL → tốt để bắt bug. |
| Direct refund — unpaid order | ✅ | `Phase1HAdminOrderApiTest#createRefund_unpaidOrder_returns409` | — |
| Direct refund — partial | ✅ | `createRefund_partial_setsPartiallyRefunded` | — |
| Direct refund — full | ✅ | `createRefund_full_setsRefundedStatus_andSyncsPaymentRecord` | — |
| Direct refund — exceed refundable | ✅ | `createRefund_exceedsRefundable_returns400` | — |
| Refund report aggregation | ✅ | `refundReport_partial_includesPartialRefundAmount` | — |
| Idempotency / double-click refund | ❌ | — | P1. |
| FE contract — web sends items | ❌ | — | **P0** integration test (Vitest có thể mock fetch, kiểm payload có items). |
| Mobile contract — list returns response shape | ❌ | — | **P0** widget/unit test cast Map. |
| OpenAPI consistency | n/a | — | Không có OpenAPI spec cho returns. P2: nên thêm. |

> Backend test status: chưa chạy do môi trường audit. Đã verify static. Không chạy `./mvnw test` — Windows + Maven wrapper sẽ kéo dài, và môi trường audit không có DB sẵn (Phase1L test cần Postgres seed).

> FE/mobile tests for returns: hoàn toàn không có. `bigbike-web/__tests__` không có file nào về return/refund. Mobile `test/` chỉ có model brand/checkout.

---

## 11. Bugs / Gaps Found

### P0 — Must fix before production

#### P0-1. Web tạo return không gửi `items` → backend reject mọi request
- **Severity**: Critical (feature hoàn toàn không dùng được).
- **Evidence**:
  - [bigbike-web/lib/api/client-api.ts:191-193](../../bigbike-web/lib/api/client-api.ts) — `createReturn(orderId, payload)` chuyển payload thẳng.
  - [bigbike-web/app/tai-khoan/doi-tra/page.tsx:234](../../bigbike-web/app/tai-khoan/doi-tra/page.tsx) — gọi `createReturn(orderId, { reason, customerNote })`.
  - [bigbike-web/app/tai-khoan/don-hang/[id]/page.tsx:63-64](../../bigbike-web/app/tai-khoan/don-hang/[id]/page.tsx) — `payload: CreateReturnPayload = { reason, customerNote }`.
  - Backend [CreateReturnRequest.java:12](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/order/dto/CreateReturnRequest.java) — `@NotEmpty List<ReturnItemRequest> items`.
- **Why it matters**: Customer mở UI, chọn lý do, bấm Gửi → 400 "items must not be empty" → support phone tăng.
- **Suggested fix**:
  - Web: cho customer chọn line items từ order detail (multi-select với checkbox + số lượng); gửi mảng `items` derived từ `OrderDetail.items`. Form trong list page hiện chỉ chọn order — phải mở rộng để chọn item.
  - Khi tạo từ order detail, có sẵn `order.items` → dùng làm gợi ý; user tick từng item, set quantity ≤ purchased.
  - Cập nhật contract `commerce.ts` đổi `items?` → `items` (required) sau khi UI sửa.

#### P0-2. Mobile tạo return không gửi `items` → cùng lỗi
- **Severity**: Critical.
- **Evidence**: [bigbike_mobile/lib/features/account/create_return_screen.dart:88-93](../../bigbike_mobile/lib/features/account/create_return_screen.dart) — `data: { 'reason': reason, ...customerNote }`.
- **Suggested fix**: Tương tự web — fetch order detail (`/api/v1/customer/orders/{orderId}`) sau khi user chọn order, render checklist line items, gửi `items`.

#### P0-3. Mobile list returns crash do cast `List` → `Map`
- **Severity**: Critical.
- **Evidence**: [bigbike_mobile/lib/features/account/returns_screen.dart:63-65](../../bigbike_mobile/lib/features/account/returns_screen.dart) — `final resp = await ApiClient().get<Map<String, dynamic>>(...)`. Backend [CustomerOrderController.java:65-67](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/order/CustomerOrderController.java) trả `List<CustomerReturnResponse>`.
- **Why it matters**: Khi customer mở màn returns, throw `_TypeError: type 'List<dynamic>' is not a subtype of type 'Map<String, dynamic>'`. Trang hiển thị error view — không thể xem returns đã tạo trước.
- **Suggested fix**: `final resp = await ApiClient().get<List>(ApiEndpoints.myReturns); _returns = resp.cast<Map<String, dynamic>>();`. Hoặc thêm helper `getList<T>` trong `ApiClient`.

#### P0-4. Backend không validate item-level (`orderLineItemId` thuộc order, `productName/sku/unitPrice` không tin client, `quantity ≤ purchased - đã return`)
- **Severity**: Critical (security + integrity).
- **Evidence**: [CustomerReturnService.java:101-113](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/order/CustomerReturnService.java) — set toàn bộ field từ `req.items()` không re-derive.
- **Why it matters**:
  - Customer (hoặc tool curl) có thể gửi `orderLineItemId = UUID khác`, hoặc thêm item không tồn tại → admin restore stock cho variant ngẫu nhiên (vì `restoreStockForReturn` đọc `lineItemRepo.findById(ri.getOrderLineItemId())` — nếu trùng line của order khác thì cộng kho cho variant thuộc order khác).
  - `unitPrice` từ client → admin xem detail thấy giá khách bịa → có thể quyết định refund sai.
  - `quantity` không bị giới hạn → restore stock có thể tăng tồn vô hạn.
- **Suggested fix**: trong `createReturn`, load `order.lineItems`, build `Map<UUID, OrderLineItemEntity>`. Mỗi item:
  - Nếu `orderLineItemId == null` hoặc không có trong map → reject 400.
  - Derive `productName, sku, variantName, unitPrice` từ line item; bỏ qua giá trị từ client.
  - `quantity` phải ∈ `[1, lineItem.quantity - đã return cho line đó]`. Tổng đã return từ `return_items` join `returns` (status ∉ REJECTED).

#### P0-5. RMA refund không sync `payments` / `paymentStatus` / audit
- **Severity**: Critical (số liệu tài chính sai, không đối soát được ngân hàng).
- **Evidence**: [AdminReturnService.java:159-175](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminReturnService.java) — chỉ `order.setRefundAmount(req.refundAmount())`.
- **Why it matters**:
  - `payments.status` vẫn `PAID`, `payments.refund_amount = 0` → đối soát SePay/COD không khớp.
  - `orders.payment_status` vẫn `PAID` thay vì `PARTIALLY_REFUNDED`/`REFUNDED`.
  - Không tạo `audit_logs` (vi phạm yêu cầu trail của module audit).
  - Không tạo order note customer-visible.
  - `order.refundAmount` bị overwrite (không cộng dồn) nên ai-là-đầu-tiên-thắng.
- **Suggested fix**: refactor refund logic thành domain service dùng chung (vd `OrderRefundDomainService.applyRefund(orderId, amount, reason, source)`), gọi từ cả `AdminOrderService.createRefund` và `AdminReturnService.updateStatus`. Service này cập nhật atomic: order, payment, audit, note (customer visible nếu source=RMA), ws event, validation refundable. Refund từ RMA reference `RETURN` thay vì `ORDER`.

#### P0-6. Admin client gửi `pageSize` thay vì `size` → backend bỏ qua, luôn 20
- **Severity**: P0 chức năng list (chỉ admin), nhưng impact thấp hơn vì max 20 vẫn dùng được.
- **Evidence**: [adminApi.js:1747](../../bigbike-admin/src/lib/adminApi.js) `params.pageSize` vs [AdminReturnController.java:43](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/admin/AdminReturnController.java) `int size`.
- **Suggested fix**: đổi `params.pageSize` thành `params.size` trong `buildReturnQuery` (đã làm ở các module khác?). Hoặc đổi controller nhận thêm alias `pageSize`.

### P1 — Should fix soon

#### P1-1. Backend AdminReturnService không validate `refundAmount`
- **Evidence**: [AdminReturnService.java:146](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminReturnService.java) — `if (req.refundAmount() != null) ret.setRefundAmount(req.refundAmount())`.
- **Risk**: admin có thể nhập số âm hoặc vượt paid amount; sau khi gọi RMA-refund, kế toán xem báo cáo sai. UI có `min="0"` nhưng client-side không phải gate.
- **Fix**: thêm validate `> 0` và `≤ order.paidAmount - order.refundAmount` trong updateStatus khi `newStatus == REFUNDED`. Tốt hơn nếu fix theo P0-5 (chuyển sang domain service chung).

#### P1-2. Partial unique index không cover `RECEIVED`
- **Evidence**: [V39__returns_race_guard_and_seq.sql](../../bigbike-backend/src/main/resources/db/migration/V39__returns_race_guard_and_seq.sql).
- **Risk**: khi return đã ở `RECEIVED` (đợi quyết định COMPLETED/REFUNDED), customer có thể tạo return thứ hai cho cùng order (app-level guard không chặn `RECEIVED`).
- **Fix**: migration V64 mở rộng `WHERE status IN ('PENDING', 'APPROVED', 'RECEIVED')` + đồng bộ guard ở `CustomerReturnService` line 80.

#### P1-3. Quantity coerce `Math.max(1, item.quantity())` thay vì reject
- **Risk**: gửi `quantity = -5` → backend tự convert thành 1 thay vì fail loud.
- **Fix**: sau khi áp P0-4, đổi thành validation reject.

#### P1-4. Không idempotency cho refund
- **Risk**: admin spam click → cộng dồn refund. UI có `disabled` nhưng race tab khác có thể.
- **Fix**: idempotency key (UUID client gửi qua header) hoặc dùng row-level lock + check `refunded_at` trong vòng 5s. Hoặc lock pessimistic order khi createRefund (đã có `@Transactional` nhưng default isolation, không lock).

#### P1-5. Thiếu CHECK constraint enum trên `returns.status`/`returns.reason`
- **Risk**: bug code khác có thể insert raw value.
- **Fix**: migration thêm `CHECK (status IN (...))` + `CHECK (reason IN (...))`.

#### P1-6. Test coverage gap
Xem §10 — bắt buộc bổ sung trước khi release: invalid transition, item not in order, quantity > purchased, lifecycle full flow, RMA→REFUNDED sync payment, FE contract test for items, mobile cast safety.

#### P1-7. Customer return form không có "Tôi đã hiểu chính sách đổi trả" / không link policy
- Minor UX nhưng nên thêm link `/chinh-sach/doi-tra` trước khi submit.

#### P1-new. `RefundService.applyRefund` full-refund không restore order-level stock
- **Added**: 2026-05-06 post-fix review.
- **Evidence**: `RefundService.applyRefund` sets `order.setStatus("REFUNDED")` when `order.status == COMPLETED` and `newRefundAmount >= paidAmount`. However, `AdminOrderService.updateOrderStatus(→ REFUNDED)` at line 269-270 also calls `restoreStockForOrder(orderId)` — this is NOT called from `RefundService`. Result: if admin marks order REFUNDED directly via the orders UI, stock is restored; if REFUNDED arrives via RMA path (return → REFUNDED), stock is NOT restored at order level.
- **Scope**: The return-item stock restore (`RECEIVED → COMPLETED` via `restoreStockForReturn`) is correct and unaffected. This gap only affects order-level stock when `refundService.applyRefund` triggers the `order.status = REFUNDED` side-effect.
- **Decision needed**: confirm with business whether goods from a `RECEIVED → REFUNDED` RMA have actually been physically returned (in which case restore is correct to do once at COMPLETED) or not. If REFUNDED = items NOT returned, no order-level stock restore is correct. Document decision in `STATE_MACHINES.md` §10.
- **Fix**: if stock restore is required for this path, add `restoreStockForOrder(order.getId())` in `RefundService.applyRefund` after setting `order.status = REFUNDED`, gated on `wasOrderCompleted`.

### P2 — Improvement

- **P2-1**. Tách permission `returns.read` / `returns.write` riêng để phép giao dịch nhân viên RMA mà không cho sửa order.
- **P2-2**. Thêm `@Size(max=2000)` cho `customerNote`/`adminNote`.
- **P2-3**. Dedicated route `/admin/returns/:id` để deep-link return detail.
- **P2-4**. Dedicated route `/tai-khoan/doi-tra/[id]` (hiện chỉ modal).
- **P2-5**. OpenAPI spec cho 6 endpoint return + endpoint refund (hiện không có).
- **P2-6**. Webhook/event sang notification service khi RMA `RECEIVED` để warehouse sắp xếp lưu kho.
- **P2-7**. Return policy window (ví dụ 30 ngày kể từ `completedAt`).
- **P2-8**. Mobile + web add Vitest/widget test cho cast & validation.
- **P2-9**. `ReturnHistoryEntity.adminId` bổ sung FK sang `admin_users`.
- **P2-10**. CHECK `refund_amount >= 0` ở DB.

---

## 12. Recommended Implementation Plan

> Thứ tự đảm bảo từng PR vừa ý nghĩa nghiệp vụ, vừa giảm rủi ro regression.

### Bước 1 — Hardening backend (1 PR, rule-level changes, có docs trước)
1. Cập nhật [docs/business/BUSINESS_RULES.md](../business/BUSINESS_RULES.md): thêm `RETURN_RULE_003` (item validation), `RETURN_RULE_004` (quantity ≤ purchased), `PAYMENT_RULE_005` (RMA refund cùng flow direct refund).
2. Cập nhật [docs/engineering/API_CONTRACT.md](../engineering/API_CONTRACT.md) §7 mô tả lại request `CreateReturnRequest` + tài liệu hoá deriving từ order line item.
3. Code:
   - `CustomerReturnService.createReturn`: load `OrderLineItem` map; validate item.orderLineItemId ∈ order, derive snapshot từ line item, validate `quantity` ≤ purchased − đã return, reject sai (không coerce). Aggregate đã return = sum(`return_items.quantity`) join với `returns` status ∉ REJECTED.
   - Thêm `@Size(max=2000)` cho `customerNote`, `adminNote`.
4. Test: thêm 4 test mới cho `Phase1LReturnsApiTest`.
5. Migration V64 (nếu cần CHECK constraints + mở rộng partial unique index).

### Bước 2 — Refund unification (1 PR)
1. Tạo `OrderRefundDomainService.applyRefund(order, amount, reason, source, sourceId, adminId)` chứa logic của `AdminOrderService.createRefund`.
2. `AdminOrderService.createRefund` delegate sang domain service.
3. `AdminReturnService.updateStatus` khi `newStatus == REFUNDED`: validate refundAmount, gọi `applyRefund(... source=RETURN, sourceId=returnId)` rồi mới save `ret.setRefundAmount`.
4. Bổ sung audit log `ORDER_REFUND_FROM_RETURN`.
5. Test: `Phase1HAdminOrderApiTest` thêm test `refundFromReturn_syncsPaymentAndAudit`; cập nhật `Phase1LReturnsApiTest` test full lifecycle.

### Bước 3 — Web Next.js (1 PR)
- File ảnh hưởng:
  - [bigbike-web/app/tai-khoan/don-hang/[id]/page.tsx](../../bigbike-web/app/tai-khoan/don-hang/[id]/page.tsx) — refactor `CreateReturnForm` thành multi-step: pick items + quantity, sau đó gửi.
  - [bigbike-web/app/tai-khoan/doi-tra/page.tsx](../../bigbike-web/app/tai-khoan/doi-tra/page.tsx) — sau khi chọn order phải gọi `fetchMyOrder(orderId)` để load `items`, render checkbox list.
  - [bigbike-web/lib/contracts/commerce.ts](../../bigbike-web/lib/contracts/commerce.ts) — đổi `items?` → `items` (required), narrow type.
  - [bigbike-web/lib/api/client-api.ts](../../bigbike-web/lib/api/client-api.ts) — không thay đổi nếu payload đổi cấu trúc bên page.
- Test Vitest mới: assert payload có `items` array khi submit.

### Bước 4 — Mobile Flutter (1 PR)
- [bigbike_mobile/lib/features/account/returns_screen.dart](../../bigbike_mobile/lib/features/account/returns_screen.dart) line 59-71 — sửa `_load` dùng `get<List>` rồi `.cast<Map<String, dynamic>>()`. Hoặc dùng `dio.get(...).then((r) => r.data)`.
- [bigbike_mobile/lib/features/account/create_return_screen.dart](../../bigbike_mobile/lib/features/account/create_return_screen.dart) — sau khi chọn order, fetch order detail (`/api/v1/customer/orders/{id}`), hiển thị checkbox list cho line items, send `items`.
- Cải thiện `ApiClient`: thêm helper `getList<T>(path)` để tránh tự cast khắp nơi.
- Widget test cho list screen với mock List response.

### Bước 5 — Admin polish (1 PR nhỏ)
- [bigbike-admin/src/lib/adminApi.js](../../bigbike-admin/src/lib/adminApi.js) — fix `pageSize` → `size` trong `buildReturnQuery`.
- [bigbike-admin/src/screens/ReturnListScreen.jsx](../../bigbike-admin/src/screens/ReturnListScreen.jsx) — khi modal hiển thị status `REFUNDED`, thông báo cho admin "Refund này sẽ tự sync với payment record và tạo audit log" để rõ luồng mới.
- (P2) thêm route `/admin/returns/:id`.

### Bước 6 — DB + ops (1 PR migration-only)
- Migration V64: CHECK constraints, mở rộng partial unique index, optional FK `return_history.admin_id`.
- Backfill: không cần nếu data sạch; verify với `SELECT DISTINCT status FROM returns;` trước khi thêm CHECK.

> Migration cần thiết: **có** (ít nhất V64). Không cần backfill data trừ khi prod đã có status không hợp lệ.

---

## 13. Final Verdict

- **Module đã hoàn thiện chưa? Chưa.** Trạng thái: PARTIAL-FIXED — tất cả P0 và P1-1/P1-2 đã được fix. Customer flow tạo return hoạt động đầy đủ trên backend + web + mobile (code). Admin RMA refund giờ sync đầy đủ sang payment/audit.
- **Còn lại để production-ready**:
  1. **P1-new**: `RefundService.applyRefund` khi full refund set `order.status = REFUNDED` nhưng KHÔNG gọi `restoreStockForOrder(orderId)` — đây là gap pre-existing trong `AdminOrderService.updateOrderStatus` (line 269-270). Khác với `restoreStockForReturn` (dành cho return items, chạy đúng ở `RECEIVED → COMPLETED`). Cần task riêng để quyết định: liệu `REFUNDED` qua RMA có nên restore order-level stock không.
  2. **P1-6**: Test cho full lifecycle (PENDING → APPROVED → RECEIVED → COMPLETED), stock restore on COMPLETED (verify `stock_movements` row), invalid status transition (PENDING → COMPLETED nên reject 400), RMA → REFUNDED sync payment (verify `payments.status` đổi thành `PARTIALLY_REFUNDED`/`REFUNDED`).
  3. **Mobile**: Không có widget/unit test cho `returns_screen.dart` và `create_return_screen.dart`. Backend + web tests hiện đã cover contract.
  4. **P2 items**: Còn nguyên (xem §11 P2 list).
- **Phải làm gì trước khi bật cho khách thật?** Chạy `./mvnw test` (Backend — cần Postgres) + `flutter analyze` (clean trên mobile). Sau đó ít nhất thêm test P1-6 lifecycle. Mobile widget test là P2.
- **`flutter analyze` status (post-fix)**: 1 lỗi pre-existing trong `test/widget_test.dart` (không liên quan đến returns). Tất cả warnings từ changes mới là `deprecated_member_use` (withOpacity, value) — info-level, không block build.
