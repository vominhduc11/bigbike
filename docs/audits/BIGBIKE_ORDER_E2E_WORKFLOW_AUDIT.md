# BigBike Order E2E Workflow Audit

> Ngày audit: 2026-05-15
> Phạm vi: luồng đặt hàng end-to-end — `bigbike-web` (khách) → `bigbike-backend` (API/service/DB) → `bigbike-admin` (xử lý đơn).
> Phương pháp: code review trace UI → API → service → repository → DB + chạy test backend thật.

## 1. Executive Summary

Luồng đặt hàng cốt lõi (xem sản phẩm → giỏ hàng → checkout → tạo đơn → admin xử lý → hoàn tất / hủy / hoàn tiền) **được xây dựng vững và đúng nguyên tắc**: idempotency chống tạo đơn trùng, khóa hàng (pessimistic lock) chống bán âm kho, backend tự tính lại toàn bộ tiền (không tin frontend), state machine đơn hàng enforce bằng map transition tường minh, optimistic lock (`@Version`) chống ghi đè đồng thời, restore kho idempotent.

Audit tìm thấy **10 vấn đề**, không có vấn đề nào gây mất tiền / bán âm kho / lỗ hổng bảo mật. Hai vấn đề đáng chú ý nhất:

- **ORDER-E2E-01 (đã fix):** nút "Huỷ đơn hàng" phía khách bị ẩn với **mọi đơn web thực tế** vì điều kiện hiển thị gắn cứng vào trạng thái `PENDING` — trong khi đơn web luôn được tạo ở `PROCESSING` (COD) hoặc `ON_HOLD` (BACS). Backend hỗ trợ hủy đầy đủ nhưng UI không bao giờ hiện nút.
- **ORDER-E2E-02 (chưa fix — cần xác nhận):** khi đơn chuyển sang `FAILED`, tồn kho đã trừ lúc checkout **không được hoàn lại** → rò rỉ tồn kho (chỉ với hàng không serial).

**Mức độ rủi ro:** Medium → sau fix ORDER-E2E-01 còn **Low–Medium**.

**Có chặn launch không:** Không bắt buộc chặn. Khuyến nghị xử lý **ORDER-E2E-02** trước hoặc trong tuần đầu sau launch để tránh sai lệch tồn kho tích lũy.

## 2. Scope

### App / module đã kiểm tra
- `bigbike-web`: trang giỏ hàng, trang thanh toán, trang xác nhận đơn, chi tiết đơn của khách, API client, cart context, nút thêm giỏ.
- `bigbike-backend`: checkout/cart/order/admin-order controller + service + repository + entity + migration.
- `bigbike-admin`: hành vi quản lý đơn được kiểm tra qua API contract backend (controller `AdminOrderController` + service `AdminOrderService`).

### File chính đã đọc (≈30 file)
**Backend:** `CheckoutService.java`, `CartService.java`, `AdminOrderService.java`, `CustomerOrderCancelService.java`, `OrderStockRestoreService.java`, `OrderAutoCancelService.java`, `OrderAutoCancelScheduler.java`, `OrderReadService.java`, `CheckoutController.java`, `CartController.java`, `AdminOrderController.java`, `CustomerOrderController.java`, `OrderEntity.java`, các DTO request (`AddCartItemRequest`, `UpdateCartItemRequest`, `CheckoutRequest`, `QuickBuyRequest`, `CheckoutAddressRequest`), `OrderDetailResponse.java`.
**Migration:** `V7__create_order_tables.sql`, `V62__create_checkout_idempotency_keys.sql`.
**Web:** `app/thanh-toan/page.tsx`, `app/gio-hang/page.tsx`, `app/tai-khoan/don-hang/[id]/page.tsx`, `app/don-hang/xac-nhan/page.tsx`, `lib/cart-context.tsx`, `lib/api/client-api.ts`, `components/catalog/AddToCartButton.tsx`.
**Docs:** `docs/business/BUSINESS_RULES.md`, `docs/business/STATE_MACHINES.md`.

### Test đã chạy
- `bigbike-backend`: `Phase1ECartApiTest`, `Phase1FCheckoutApiTest`, `Phase1GOrderReadApiTest`, `Phase1HAdminOrderApiTest` → **164 test PASS** (H2 PostgreSQL-mode).
- `bigbike-backend`: `mvnw compile` → BUILD SUCCESS.
- `bigbike-web`: `tsc --noEmit` → không lỗi; `eslint` file đã sửa → sạch; `vitest` (`checkout.test.ts`, `commerce-order-detail.test.ts`) → 9 test PASS.

## 3. Current Order Workflow

### Customer flow (web)
```
Xem sản phẩm → Thêm vào giỏ (POST /cart/items) → Giỏ hàng (sửa SL / xóa / mã giảm giá)
   → Thanh toán (/thanh-toan): nhập địa chỉ + chọn payment (COD|BACS) + chọn vận chuyển
   → POST /api/v1/checkout  (kèm header Idempotency-Key sinh client-side)
   → Tạo đơn → redirect /don-hang/xac-nhan?so=...&key=...
```
Giỏ hàng là **server-side** (bảng `carts`/`cart_items`), không dùng localStorage → luôn đồng bộ. Khách (guest) dùng cookie `bb_guest_id`; khi đăng nhập, giỏ guest được merge vào giỏ tài khoản.

### Backend flow (checkout)
```
1. reserveIdempotency: INSERT checkout_idempotency_keys (unique flow+scope+key)
   → trùng key + cùng payload  → trả lại OrderSummary cũ
   → trùng key + khác payload  → 409
2. Validate địa chỉ + payment method (chỉ COD/BACS)
3. syncPricesAndValidateStock: lock product/variant FOR UPDATE, kiểm tra tồn kho,
   re-sync giá từ DB → ghi nhận priceChanges
4. Tính subtotal → revalidate coupon từ DB → discount → shipping → total
5. Lưu order + line items + addresses + shipping item + payment record
6. applyStockForLineItems: trừ quantity_on_hand HOẶC reserve serial
7. attemptRedeem coupon (conditional UPDATE) — thất bại → rollback toàn bộ
8. Mark cart CONVERTED, gửi email + WS event
```
Trạng thái khởi tạo: COD → `status=PROCESSING`; BACS → `status=ON_HOLD`; cả hai `paymentStatus=UNPAID`, `fulfillmentStatus=UNFULFILLED`, `fulfillmentType=DELIVERY`.

### Admin flow
```
PATCH /admin/orders/{id}/status        → state machine ALLOWED_TRANSITIONS
PATCH /admin/orders/{id}/payment-status → ALLOWED_PAYMENT_TRANSITIONS
PATCH /admin/orders/{id}/fulfillment    → ALLOWED_FULFILLMENT_TRANSITIONS
POST  /admin/orders/{id}/refund         → RefundService (luồng hoàn tiền duy nhất)
```
Tất cả endpoint admin gác quyền `orders.read` / `orders.write`.

### Payment flow
Không có cổng thanh toán tự động (xác nhận theo `project_bigbike_no_auto_payment`). COD: thu tiền khi giao. BACS: chuyển khoản, admin đối soát thủ công — khi admin chuyển BACS `ON_HOLD → PROCESSING`, hệ thống tự đánh dấu `paymentStatus=PAID`.

### Shipping flow
`fulfillmentStatus`: `UNFULFILLED → PROCESSING → SHIPPED → DELIVERED` (hoặc `CANCELLED`/`RETURNED`). Đánh dấu `SHIPPED` bắt buộc có `trackingNumber`. Đơn `DELIVERY` chỉ được `COMPLETED` sau khi `DELIVERED`.

### Inventory flow
Trừ kho **ngay lúc tạo đơn** (checkout), không phải lúc admin xác nhận. Hoàn kho khi `CANCELLED` / `REFUNDED` (idempotent theo `referenceType+orderId`). Auto-cancel đơn BACS `ON_HOLD/UNPAID` quá hạn (mặc định 72h) cũng hoàn kho.

## 4. State Machine (dựng lại từ code)

### Order status — `AdminOrderService.ALLOWED_TRANSITIONS`
| From | Allowed next | Actor | Condition | Side effect | Evidence |
|---|---|---|---|---|---|
| `PENDING` | `PROCESSING`, `ON_HOLD`, `CANCELLED`, `FAILED` | Admin `orders.write` | `CANCELLED`: paymentStatus ≠ PAID | audit, email, WS; `CANCELLED` → restore kho | `AdminOrderService.java:87,272-377` |
| `ON_HOLD` | `PROCESSING`, `CANCELLED`, `FAILED` | Admin | `PROCESSING`+BACS+UNPAID → auto PAID | `AdminOrderService.java:88,330-345` |
| `PROCESSING` | `COMPLETED`, `CANCELLED`, `FAILED` | Admin | `COMPLETED`: xem `validateBeforeComplete` | `COMPLETED` → markSold serial | `AdminOrderService.java:89,633-658` |
| `COMPLETED` | ∅ (terminal) | — | refund qua `POST /refund` | — | `AdminOrderService.java:95` |
| `CANCELLED`/`FAILED`/`REFUNDED` | ∅ (terminal) | — | — | — | `AdminOrderService.java:96-98` |

Khách tự hủy (`CustomerOrderCancelService`): chỉ khi `paymentStatus=UNPAID` **và** status ∈ {`PENDING`,`ON_HOLD`, hoặc `PROCESSING` chưa `SHIPPED`/`DELIVERED`}.

### Payment status — `ALLOWED_PAYMENT_TRANSITIONS` (V114 simplified)
`UNPAID → {PAID, CANCELLED}` · `PAID → {UNPAID}` · `REFUNDED`/`CANCELLED` terminal. `PAID → REFUNDED` chỉ qua `RefundService`.

### Fulfillment — `ALLOWED_FULFILLMENT_TRANSITIONS`
`UNFULFILLED → {PROCESSING,CANCELLED}` · `PROCESSING → {SHIPPED,CANCELLED}` · `SHIPPED → {DELIVERED,RETURNED}` · `DELIVERED → {RETURNED}`.

## 5. Findings

### [ORDER-E2E-01] Khách không bao giờ thấy nút "Huỷ đơn hàng" trên web
- **Severity:** High (P1) — **Type:** Business Logic Gap / UX
- **Location:** `bigbike-web/app/tai-khoan/don-hang/[id]/page.tsx:51` (cũ: `CANCELLABLE_ORDER_STATUSES = new Set(["PENDING"])`)
- **Current behavior:** Nút huỷ chỉ hiển thị khi `order.status === "PENDING"`. Nhưng checkout web/quick-buy luôn tạo đơn ở `PROCESSING` (COD) hoặc `ON_HOLD` (BACS) — không bao giờ `PENDING` (`CheckoutService.java:703`). POS tạo đơn `COMPLETED`. ⇒ Không có đơn thực tế nào của khách ở trạng thái `PENDING` → nút huỷ **không bao giờ xuất hiện**.
- **Expected behavior:** Khách có thể tự huỷ đúng theo backend `CustomerOrderCancelService.isCustomerCancellable`: `paymentStatus=UNPAID` và status ∈ {PENDING, ON_HOLD, PROCESSING-chưa-giao}.
- **Reproduction:** Đặt 1 đơn COD trên web → vào "Đơn hàng của tôi" → mở đơn → không có nút huỷ, dù backend `PATCH /customer/orders/{id}/cancel` chấp nhận.
- **Root cause:** Điều kiện UI gắn cứng `PENDING`, không khớp logic backend.
- **Impact:** Tính năng tự huỷ đơn coi như chết với mọi khách. Tăng tải CSKH (khách phải gọi shop để huỷ).
- **Recommended fix:** Thay set tĩnh bằng hàm mirror đúng logic backend.
- **Fix status:** **Fixed.** Thêm `isCustomerCancellable(order)` kiểm tra `paymentStatus`, `status`, `fulfillmentStatus`; thay điều kiện render nút.
- **Evidence:** `CheckoutService.java:703`, `CustomerOrderCancelService.java:74-93`, `OrderDetailResponse.java` (có `fulfillmentStatus`).

### [ORDER-E2E-02] Đơn chuyển `FAILED` không hoàn lại tồn kho
- **Severity:** High (P1) — **Type:** Bug (Inventory)
- **Location:** `bigbike-backend/.../AdminOrderService.java:351-357` (`updateOrderStatus` side-effect)
- **Current behavior:** Khi đơn → `COMPLETED` thì markSold serial; → `CANCELLED` thì release serial + `restoreForCancel`. **`FAILED` không có side effect nào.** Tồn kho đã trừ lúc checkout giữ nguyên bị trừ vĩnh viễn.
- **Expected behavior:** Đơn `FAILED` (không bán được hàng) nên hoàn kho như `CANCELLED` — hàng vẫn ở kho thật, chưa giao cho ai.
- **Reproduction:** Tạo đơn web → admin `PATCH /status` đưa `PROCESSING → FAILED` → `quantity_on_hand` của sản phẩm vẫn bị trừ, không có `stock_movement` kiểu `IN`.
- **Root cause:** Nhánh side-effect chỉ xử lý `COMPLETED` và `CANCELLED`, bỏ sót `FAILED`.
- **Impact:** Tồn kho hiển thị thấp hơn thực tế; tích lũy nhiều đơn `FAILED` có thể đẩy sản phẩm về `OUT_OF_STOCK` ảo → mất doanh số. Chỉ ảnh hưởng hàng **không serial** (hàng serial tự lành nhờ reservation hết hạn). Không mất tiền trực tiếp.
- **Recommended fix:** Trong `updateOrderStatus`, thêm nhánh `FAILED` chạy `serialLifecycleService.releaseReservationForOrder(...)` + `orderStockRestoreService.restoreForCancel(orderId)` (đã idempotent). Vì đây là quyết định business (`FAILED` có hoàn kho không), cần xác nhận trước khi sửa code.
- **Fix status:** **Not fixed — Needs confirmation.**
- **Câu hỏi business:** Khi admin đánh dấu đơn `FAILED`, có hoàn kho tự động không? Đề xuất: **Có** (đề xuất hợp lý — `FAILED` nghĩa là không phát sinh giao dịch bán).
- **Evidence:** `CheckoutService.java:246,994-1011`; `AdminOrderService.java:351-357`; `OrderStockRestoreService.java:46-49`.

### [ORDER-E2E-03] Checkout tạo đơn theo giá mới khi giá thay đổi, không hỏi lại khách
- **Severity:** Medium (P2) — **Type:** Business Logic Gap / UX
- **Location:** `CheckoutService.java:182-184,931-937`; `bigbike-web/app/thanh-toan/page.tsx:210-215`
- **Current behavior:** Backend re-sync giá từ DB, nếu khác giá trong giỏ thì vẫn **tạo đơn ngay theo giá mới** rồi trả `priceChanges`. Frontend hiển thị cảnh báo "Giá đã thay đổi" **sau khi đơn đã được tạo**. Khách bấm "ĐẶT HÀNG · [giá cũ]" nhưng đơn ghi nhận giá mới (có thể cao hơn).
- **Expected behavior:** Nếu giá tăng, nên dừng lại cho khách xác nhận giá mới trước khi tạo đơn (hoặc frontend pre-check `/products/{id}/pricing`).
- **Impact:** Khách bị tính giá khác giá đã thấy mà không đồng ý rõ ràng. Với COD rủi ro thấp (khách có thể từ chối nhận); với BACS khách sẽ chuyển theo số trên trang xác nhận. Vẫn là vấn đề về sự đồng thuận giá.
- **Recommended fix:** Hoặc (a) backend trả lỗi `PRICE_CHANGED` khi giá tăng, yêu cầu client gửi lại với cờ xác nhận; hoặc (b) frontend kiểm tra giá trước khi submit. Cần quyết định business.
- **Fix status:** **Not fixed — Needs confirmation.**
- **Evidence:** `CheckoutService.java:182-184`, `app/thanh-toan/page.tsx:194-215`.

### [ORDER-E2E-04] BACS `ON_HOLD → PROCESSING` tự đánh dấu `PAID`
- **Severity:** Low (P3) — **Type:** Business Logic (by-design, cần xác nhận UX)
- **Location:** `AdminOrderService.java:330-345`
- **Current behavior:** Admin chuyển đơn BACS từ `ON_HOLD` sang `PROCESSING` thì hệ thống tự set `paymentStatus=PAID`, `paidAmount=totalAmount`. Hai sự kiện độc lập (bắt đầu xử lý vs đã nhận tiền) bị gộp làm một.
- **Impact:** Nếu admin lỡ tay chuyển `PROCESSING` khi chưa nhận chuyển khoản, đơn thành `PAID` và muốn huỷ phải đi đường refund. Ngược lại không thể bắt đầu đóng gói trước khi tiền về.
- **Recommended fix:** Theo mô hình đối soát thủ công, hành vi này chấp nhận được nhưng nên hiển thị cảnh báo rõ trên admin UI ("Chuyển sang Đang xử lý sẽ đánh dấu đã nhận thanh toán"). Cần xác nhận có muốn tách bước không.
- **Fix status:** Not fixed — by design, đề xuất bổ sung cảnh báo UI.

### [ORDER-E2E-05] `updatePaymentStatus` chấp nhận `paidAmount` bất kỳ khi set `PAID`
- **Severity:** Medium (P2) — **Type:** Data Contract / Validation
- **Location:** `AdminOrderService.java:416-432`
- **Current behavior:** Nhánh `PAID`: `paid = req.paidAmount() != null ? req.paidAmount() : totalAmount`. Không kiểm tra `paidAmount > 0` hay `paidAmount == totalAmount`. Admin có thể set `PAID` với `paidAmount=0` hoặc nhỏ hơn tổng đơn.
- **Expected behavior:** Sau V114 bỏ `PARTIALLY_PAID`, `PAID` nghĩa là đã trả đủ. `paidAmount` nên bằng `totalAmount`.
- **Impact:** Trạng thái không nhất quán (`PAID` nhưng `paidAmount < totalAmount`); báo cáo `paidRevenue` lệch; guard hoàn thành đơn COD chỉ xét `paymentStatus` nên vẫn cho hoàn thành đơn "PAID" chưa thu đủ tiền.
- **Recommended fix:** Khi set `PAID`, mặc định `paidAmount = totalAmount`; nếu client gửi `paidAmount` thì validate `== totalAmount` (hoặc reject nếu khác).
- **Fix status:** Not fixed — đề xuất.

### [ORDER-E2E-06] Timeline đơn của khách hiển thị `ON_HOLD` như bước cuối sau `COMPLETED`
- **Severity:** Low (P2) — **Type:** UX
- **Location:** `bigbike-web/app/tai-khoan/don-hang/[id]/page.tsx` (`TERMINAL_STEPS`, `OrderTimeline`)
- **Current behavior:** `ON_HOLD` nằm trong `TERMINAL_STEPS` → timeline render `[PENDING ✓][PROCESSING ✓][COMPLETED ✓][ON_HOLD ●]`, ngụ ý đơn đã qua "Hoàn thành" rồi mới "Tạm giữ" — sai. `ON_HOLD` là trạng thái sớm (BACS chờ chuyển khoản).
- **Impact:** Khách BACS thấy timeline khó hiểu / sai logic.
- **Recommended fix:** Render `ON_HOLD` ở vị trí đầu (tương đương "Đã tiếp nhận, chờ thanh toán"), không phải bước terminal sau `COMPLETED`. Là quyết định thiết kế UI nên chưa tự sửa.
- **Fix status:** Not fixed — đề xuất.

### [ORDER-E2E-07] Trang giỏ hàng không hiển thị tình trạng tồn kho
- **Severity:** Low (P3) — **Type:** UX
- **Location:** `bigbike-web/app/gio-hang/page.tsx`
- **Current behavior:** Giỏ hàng không cảnh báo khi sản phẩm trong giỏ đã hết hàng / giảm tồn sau khi thêm. Khách chỉ biết khi backend từ chối ở bước checkout.
- **Impact:** Khách đi tới bước thanh toán rồi mới gặp lỗi → trải nghiệm gãy.
- **Recommended fix:** Hiển thị badge "Hết hàng / Chỉ còn N" trên dòng giỏ hàng (dùng `/products/{id}/stock`).
- **Fix status:** Not fixed — đề xuất.

### [ORDER-E2E-08] Enum trạng thái đơn/thanh toán không có DB CHECK constraint
- **Severity:** Low (P3) — **Type:** Data Contract
- **Location:** `V7__create_order_tables.sql:7-8` (`status`/`payment_status` là `varchar not null`, không CHECK)
- **Current behavior:** Giá trị enum chỉ được enforce ở tầng Java (`ALLOWED_ORDER_STATUSES`...). DB chấp nhận chuỗi bất kỳ.
- **Impact:** Thấp — mọi đường ghi đều qua service. Rủi ro chỉ khi sửa DB trực tiếp / script migration sai.
- **Recommended fix:** Cân nhắc thêm CHECK constraint hoặc enum type ở migration tương lai.
- **Fix status:** Not fixed — đề xuất (ưu tiên thấp).

### [ORDER-E2E-09] Docs còn nhắc `PARTIALLY_PAID` đã bị bỏ ở V114
- **Severity:** Low (P3) — **Type:** Docs
- **Location:** `docs/business/BUSINESS_RULES.md` (ORDER_RULE_004), `docs/business/STATE_MACHINES.md` (mục Order/Payment)
- **Current behavior:** Docs mô tả guard huỷ đơn xét `PAID` hoặc `PARTIALLY_PAID`, và liệt kê `PARTIALLY_PAID` trong allowed transitions. Code sau V114 chỉ còn `UNPAID/PAID/REFUNDED/CANCELLED`; `validateBeforeCancel` chỉ xét `PAID`.
- **Impact:** Sai lệch tài liệu, không phải lỗi code.
- **Recommended fix:** Cập nhật 2 file docs cho khớp enum V114.
- **Fix status:** Not fixed — đề xuất cập nhật docs.

### [ORDER-E2E-10] Quick-buy idempotency là tùy chọn
- **Severity:** Low (P3) — **Type:** Defense-in-depth
- **Location:** `CheckoutController.java:75-86`, `client-api.ts:submitQuickBuy`
- **Current behavior:** `Idempotency-Key` lấy từ header request; nếu client không gửi thì không chống tạo đơn trùng. Trang checkout web **luôn gửi** key (`thanh-toan/page.tsx:104`) nên an toàn. Quick-buy `submitQuickBuy` để key là optional và hiện chưa có UI nào gọi.
- **Impact:** Thấp hiện tại. Nếu sau này thêm UI quick-buy mà quên truyền key → có thể tạo đơn trùng khi double-submit.
- **Recommended fix:** Khi triển khai UI quick-buy, bắt buộc sinh và gửi `Idempotency-Key`; hoặc backend sinh fallback key server-side.
- **Fix status:** Not fixed — ghi nhận.

### Điểm tốt đã xác nhận (workflow hoạt động đúng)
- **Idempotency:** bảng `checkout_idempotency_keys` + unique `(flow_type, scope_key, idempotency_key)`; web sinh key 1 lần/lần mở trang; nút submit `disabled` khi đang gửi → double-submit được chặn 2 lớp.
- **Chống bán âm kho:** `findByIdForUpdate` (pessimistic lock) trên product/variant trong toàn bộ `@Transactional` checkout; validate và trừ kho dưới cùng khóa hàng; 2 checkout đồng thời cùng variant → cái sau bị 409.
- **Không tin frontend:** `CheckoutRequest`/`QuickBuyRequest` không có trường giá/tổng tiền; backend tự tính subtotal/discount/shipping/total và re-sync giá từ DB.
- **State machine:** enforce bằng map transition tường minh; `COMPLETED/CANCELLED/FAILED/REFUNDED` terminal; guard `validateBeforeComplete`/`validateBeforeCancel`.
- **Concurrency:** `OrderEntity` có `@Version` (optimistic lock) chống 2 admin ghi đè.
- **Restore kho idempotent:** `OrderStockRestoreService` chặn theo `existsByReferenceTypeAndReferenceId`.
- **Quyền:** đơn của khách enforce ownership (trả 404 nếu không phải chủ); guest lookup cần đúng `orderKey`; endpoint admin gác `orders.read/write`.
- **Coupon:** redeem bằng conditional UPDATE atomic; thất bại → rollback cả đơn.
- **DB constraint:** `order_line_items` có `CHECK (quantity > 0)`; DTO giỏ hàng có `@Min(1)`.
- **Auto-cancel:** scheduler huỷ đơn BACS quá hạn thanh toán và hoàn kho.

## 6. Fixes Applied

### `bigbike-web/app/tai-khoan/don-hang/[id]/page.tsx`
- **Sửa:** thay hằng `CANCELLABLE_ORDER_STATUSES = new Set(["PENDING"])` bằng hàm `isCustomerCancellable(order)` mirror đúng `CustomerOrderCancelService.isCustomerCancellable` của backend (xét `paymentStatus=UNPAID` + `status` ∈ {PENDING, ON_HOLD, PROCESSING-chưa-SHIPPED/DELIVERED}); cập nhật điều kiện render nút huỷ.
- **Lý do:** Khắc phục ORDER-E2E-01 — nút huỷ trước đây không bao giờ hiện vì đơn web không bao giờ ở `PENDING`.
- **Rủi ro còn lại:** Thấp. Backend vẫn là chốt chặn cuối (`PATCH /cancel` reject nếu không đủ điều kiện). Trường hợp xấu nhất: nút hiện nhưng backend từ chối → khách thấy message lỗi rõ ràng (không phá dữ liệu).
- **Test:** `tsc --noEmit` sạch; `eslint` file sạch; không đổi API contract / data shape nên không cần cập nhật docs.

Không sửa code backend trong audit này (các vấn đề backend đều cần xác nhận business rule trước — xem mục 9).

## 7. Test Results

| Lệnh | Kết quả |
|---|---|
| `bigbike-backend` · `mvnw compile` | BUILD SUCCESS |
| `bigbike-backend` · `mvnw test -Dtest=Phase1ECartApiTest` | 27 PASS / 0 fail |
| `bigbike-backend` · `mvnw test -Dtest=Phase1FCheckoutApiTest` | 46 PASS / 0 fail |
| `bigbike-backend` · `mvnw test -Dtest=Phase1GOrderReadApiTest` | 26 PASS / 0 fail |
| `bigbike-backend` · `mvnw test -Dtest=Phase1HAdminOrderApiTest` | 65 PASS / 0 fail |
| **Tổng backend order/cart/checkout** | **164 PASS / 0 fail** |
| `bigbike-web` · `tsc --noEmit` | Không lỗi |
| `bigbike-web` · `eslint app/tai-khoan/don-hang/[id]/page.tsx` | Sạch |
| `bigbike-web` · `vitest checkout.test.ts + commerce-order-detail.test.ts` | 9 PASS / 0 fail |

Test backend chạy trên H2 (PostgreSQL-mode) — cấu hình test mặc định của repo. Không chạy bộ test Testcontainers (cần Docker daemon cho test DB riêng) và không chạy `next build` đầy đủ.

## 8. Remaining Risks

- **Chưa kiểm thử bằng E2E thực tế:** không có Playwright/Cypress E2E cho luồng đặt hàng; xác nhận dựa trên code review + 164 API test backend + unit test web. Các kịch bản UI thuần (double-click thực tế trên trình duyệt, refresh giữa checkout, mất mạng) chỉ được suy luận từ code, chưa chạy trên trình duyệt thật.
- **Không chạy `next build`** đầy đủ cho `bigbike-web` (chỉ typecheck + lint + vitest).
- **Không chạy Testcontainers suite** (cần Docker daemon riêng cho test DB).
- **`bigbike-admin` UI** kiểm tra qua API contract backend, chưa trace từng màn hình admin (nút/badge theo `allowed-transitions` đã có endpoint hỗ trợ).
- **Serial inventory** không trace sâu trong audit này — đã có audit riêng `BIGBIKE_SERIAL_MODULE_PRODUCTION_READY_AUDIT.md`.
- **ORDER-E2E-02/03/04/05** chưa fix vì phụ thuộc quyết định business — xem câu hỏi bên dưới.

## 9. Final Verdict

**Kết luận: Ready with conditions.** Luồng đặt hàng end-to-end về cơ bản đúng đắn và an toàn — không phát hiện lỗi gây mất tiền, bán âm kho, tạo đơn trùng, hay lỗ hổng phân quyền. Mức tin cậy: **cao** với phần backend (164 API test pass + code review), **trung bình–cao** với phần UI web (typecheck/lint/unit test pass, chưa E2E trình duyệt).

### Bắt buộc xử lý trước hoặc ngay sau launch
- **ORDER-E2E-01** — đã fix (nút huỷ đơn của khách).
- **ORDER-E2E-02** — cần quyết định: đơn `FAILED` có hoàn kho không. Nếu "có" (khuyến nghị), sửa `AdminOrderService.updateOrderStatus` thêm nhánh `FAILED` → release serial + `restoreForCancel`. Nếu không xử lý, tồn kho sẽ lệch dần.

### Nên xử lý sớm sau launch
- **ORDER-E2E-03** — hành vi giá thay đổi khi checkout (cần quyết định business: chặn & hỏi lại, hay giữ nguyên tạo đơn).
- **ORDER-E2E-05** — validate `paidAmount` khi set `PAID`.

### Có thể để sau
- ORDER-E2E-04 (cảnh báo UI BACS), ORDER-E2E-06 (timeline ON_HOLD), ORDER-E2E-07 (badge tồn kho ở giỏ), ORDER-E2E-08 (DB CHECK constraint), ORDER-E2E-09 (cập nhật docs), ORDER-E2E-10 (idempotency quick-buy).

### Câu hỏi cần shop/PO trả lời
1. **(ORDER-E2E-02)** Khi admin đánh dấu đơn `FAILED`, có tự động hoàn tồn kho không? — *Đề xuất: Có.*
2. **(ORDER-E2E-03)** Khi giá sản phẩm thay đổi lúc khách checkout: tạo đơn theo giá mới luôn (hiện tại), hay dừng lại cho khách xác nhận giá mới? — *Đề xuất: dừng lại xác nhận nếu giá tăng.*
3. **(ORDER-E2E-04)** Có muốn tách thao tác "Bắt đầu xử lý" và "Xác nhận đã nhận chuyển khoản" cho đơn BACS, hay giữ gộp như hiện tại?

---

## Tóm tắt

- **File đã kiểm tra:** ≈30 (backend service/controller/entity/DTO/migration + web page/lib + 2 docs business).
- **Tổng số issue:** 10 — Critical 0 · High 2 · Medium 3 · Low 5.
- **Có fix code:** Có — 1 file (`bigbike-web/app/tai-khoan/don-hang/[id]/page.tsx`, ORDER-E2E-01).
- **Production-ready:** Ready with conditions — cần chốt ORDER-E2E-02 (hoàn kho khi `FAILED`).
- **Test:** backend 164 PASS · web tsc/lint/vitest PASS.
