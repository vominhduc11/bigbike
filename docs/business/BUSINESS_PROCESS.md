# BigBike Business Process

## 1. Document Purpose

File này mô tả các quy trình nghiệp vụ chính của BigBike ở góc nhìn business/operation. Mục tiêu là giúp business user, PM, BA, tester, developer mới và AI agent hiểu doanh nghiệp vận hành như thế nào mà không cần đọc trực tiếp code.

File này trả lời câu hỏi: **"Các quy trình nghiệp vụ của BigBike diễn ra như thế nào?"**

Giới hạn:

- Không phải API contract.
- Không phải architecture document.
- Không phải database schema.
- Không mô tả chi tiết implementation kỹ thuật.
- Không chứa secret, token, password, private key hoặc env value nhạy cảm.
- Không khẳng định production-ready nếu chưa có evidence build/test/runtime hiện tại.
- Các process chưa đủ evidence được đánh dấu `NEEDS_VERIFICATION` hoặc `NOT_FOUND_IN_REPO`.

File này là nền để viết tiếp:

- `WORKFLOW_OVERVIEW.md`
- `BUSINESS_RULES.md`
- `STATE_MACHINES.md`
- `ACCEPTANCE_CRITERIA.md`
- `TRACEABILITY_MATRIX.md`

## 2. Process Status Labels

| Label | Meaning |
|---|---|
| `CONFIRMED_FROM_CODE` | Đã thấy bằng chứng trực tiếp trong code/config/docs hiện có. |
| `INFERRED_FROM_STRUCTURE` | Suy luận hợp lý từ routes, folders, API, controller, service hoặc DTO nhưng chưa đủ evidence để kết luận process hoàn chỉnh. |
| `NEEDS_VERIFICATION` | Cần xác nhận thêm từ business, runtime test, build/test hiện tại hoặc audit sâu hơn. |
| `NOT_FOUND_IN_REPO` | Chưa thấy bằng chứng trong repo hiện tại qua các file đã audit. |

## 3. Business Process Map

| Process | Purpose | Primary Actors | Supported By System | Status | Evidence |
|---|---|---|---|---|---|
| Product Management Process | Quản lý sản phẩm, category, brand, media, specification, variant, price, stock-facing data. | Admin / Staff | Admin UI, backend admin catalog service/API, product/category/brand repositories/entities. | `CONFIRMED_FROM_CODE` | `bigbike-admin/README.md`, `bigbike-admin/src/lib/adminApi.js`, `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/admin/AdminCatalogController.java` |
| Product Publishing Process | Chuyển sản phẩm từ trạng thái nội bộ sang public hoặc ẩn/xóa mềm. | Admin / Staff | Publish status, admin publish endpoint, public catalog endpoint. | `CONFIRMED_FROM_CODE` | `AdminCatalogController`, `CatalogController`, `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminCatalogMutationService.java` |
| Customer Product Browsing Process | Khách xem homepage, category, brand, product detail, search, article/content. | Guest / Customer | Next.js routes, Flutter routes, public catalog/content/search APIs. | `CONFIRMED_FROM_CODE` | `bigbike-web/app/page.tsx`, `bigbike-web/lib/utils/routes.ts`, `bigbike_mobile/lib/core/router/app_router.dart`, `CatalogController` |
| Cart / Checkout Process | Customer thêm giỏ hàng, nhập thông tin, chọn thanh toán/vận chuyển, tạo order. | Guest / Customer / System | Cart API, checkout service, quick-buy, checkout options, stock/price validation, order/payment/shipping creation. | `CONFIRMED_FROM_CODE` | `CheckoutController`, `CheckoutService`, `PHASE_1F_CHECKOUT_API_REPORT.md` |
| Order Management Process | Admin xem, lọc, xử lý, cập nhật trạng thái đơn, payment status, note, refund. | Admin / Staff / System | Admin order controller/service, allowed transitions, audit log, notification, websocket event. | `CONFIRMED_FROM_CODE` | `AdminOrderController`, `AdminOrderService`, `bigbike-admin/src/lib/adminApi.js` |
| Payment Handling Process | Tạo payment record khi checkout, quản lý trạng thái payment, hỗ trợ COD/BACS, refund. | Customer / Admin / System | Checkout payment creation, admin payment status transition, refund command. | `CONFIRMED_FROM_CODE` cho COD/BACS/manual payment; `NEEDS_VERIFICATION` cho external gateway/webhook | `CheckoutService`, `AdminOrderService`, `PHASE_1F_CHECKOUT_API_REPORT.md` |
| Shipping / Fulfillment Process | Quản lý shipping zones/methods, tính phí/auto-select shipping method, lưu shipping item vào order. | Admin / Customer / System | Admin shipping API, checkout shipping method resolution, order shipping item. | `CONFIRMED_FROM_CODE` cho internal shipping method; `NEEDS_VERIFICATION` cho carrier fulfillment/tracking | `AdminShippingController`, `CheckoutService`, `PHASE_1F_CHECKOUT_API_REPORT.md` |
| Inventory Management Process | Theo dõi tồn kho, movement, điều chỉnh stock, trừ kho khi checkout, restore khi cancel/return. | Admin / Staff / System | Inventory API/service, stock movements, checkout stock validation/decrement, order/return stock restore. | `CONFIRMED_FROM_CODE` | `AdminInventoryController`, `CheckoutService`, `AdminOrderService`, `AdminReturnService` |
| Return / Refund Process | Xử lý yêu cầu đổi/trả/hoàn tiền, cập nhật trạng thái return, restore stock khi nhận hàng hoàn. | Customer / Admin / System | Admin returns, customer returns route, return status transitions, refund service. | `CONFIRMED_FROM_CODE` cho admin return/refund; `NEEDS_VERIFICATION` cho customer-created return flow completeness | `AdminReturnController`, `AdminReturnService`, `AdminOrderService`, `bigbike_mobile/lib/core/router/app_router.dart` |
| Media Management Process | Upload/quản lý media, update metadata, soft-delete/hard-delete/restore media. | Admin / Staff | Admin media controller/service, MinIO dependency/config. | `CONFIRMED_FROM_CODE` | `AdminMediaController`, `bigbike-backend/pom.xml`, `docker-compose.yaml` |
| Content / SEO Management Process | Quản lý article/page/content, SEO metadata, public rendering, route/canonical/JSON-LD. | Admin / Content Editor / Guest | Admin content API, public content API, Next.js SEO metadata/JSON-LD, routes. | `CONFIRMED_FROM_CODE` | `AdminContentController`, `ContentController`, `bigbike-web/app/page.tsx`, `bigbike-web/lib/utils/routes.ts` |
| Admin User / Role / Permission Process | Kiểm soát quyền truy cập admin module và action nghiệp vụ. | Admin / Super Admin / Staff | Admin route permission map, backend permission enforcement, admin user/role controllers. | `CONFIRMED_FROM_CODE` cho permission enforcement; `NEEDS_VERIFICATION` cho full RBAC matrix | `bigbike-admin/README.md`, `SecurityConfig`, `AdminRolesController`, `AdminAdminUsersController` |
| Reporting / Dashboard Process | Xem analytics, export orders/customers/products/inventory. | Admin / Manager | Admin dashboard/report controllers, CSV export, analytics endpoint. | `CONFIRMED_FROM_CODE` | `AdminDashboardController`, `AdminReportController`, `AdminInventoryController`, `bigbike-admin/package.json` |
| Settings / Configuration Process | Quản lý site settings, public/private settings, menu, coupon. | Admin / Staff / System | Admin settings/menu/coupon APIs, public settings/menu APIs. | `CONFIRMED_FROM_CODE` | `PHASE_1J_ADMIN_SETTINGS_MENU_COUPON_API_REPORT.md`, `AdminSettingsController`, `AdminMenuController`, `AdminCouponController` |
| Notification Process | Gửi email xác nhận đơn, thông báo admin, cập nhật trạng thái order/return, websocket admin order events. | System / Admin / Customer | Notification service usage in checkout/order/return services, mail dependency/config. | `CONFIRMED_FROM_CODE` cho service usage; `NEEDS_VERIFICATION` cho production email deliverability | `CheckoutService`, `AdminOrderService`, `AdminReturnService`, `bigbike-backend/pom.xml`, `docker-compose.yaml` |
| Audit Log Process | Ghi nhận hành động quan trọng như update order/payment/refund/note, menu/settings/coupon theo report. | System / Admin | Audit repository/service/controller references. | `CONFIRMED_FROM_CODE` | `AdminOrderService`, `AdminAuditLogController`, `PHASE_1J_ADMIN_SETTINGS_MENU_COUPON_API_REPORT.md` |
| External Payment Webhook Process | Xử lý webhook từ payment provider. | Third-party / System | Chưa thấy evidence rõ trong repo đã audit. | `NOT_FOUND_IN_REPO` | Không thấy controller/service webhook payment trong audited evidence. |
| Third-party Shipping Carrier Process | Tích hợp đơn vị vận chuyển ngoài hệ thống. | Third-party / Admin / System | Chưa thấy evidence rõ trong repo đã audit. | `NOT_FOUND_IN_REPO` | `AdminShippingController` chỉ xác nhận internal shipping zones/methods. |

## 4. Product Management Process

Product Management là quy trình admin/staff tạo và duy trì catalog sản phẩm để bán trên public website/mobile.

| Step | Actor | Business goal | System support | Status | Evidence path |
|---|---|---|---|---|---|
| 1. Truy cập module products/categories/brands | Admin / Staff | Vào khu vực quản trị catalog. | Admin route `/admin/products`, `/admin/categories`, `/admin/brands` có permission tương ứng. | `CONFIRMED_FROM_CODE` | `bigbike-admin/README.md` |
| 2. Xem/lọc/tìm sản phẩm | Admin / Staff | Tìm sản phẩm theo keyword, publish status, stock state, brand, category. | Admin API client và backend admin catalog list hỗ trợ query/filter. | `CONFIRMED_FROM_CODE` | `bigbike-admin/src/lib/adminApi.js`, `AdminCatalogController` |
| 3. Tạo sản phẩm | Admin / Staff | Tạo item mới trong catalog. | Admin client gọi create product; backend yêu cầu `products.update`. | `CONFIRMED_FROM_CODE` | `bigbike-admin/src/lib/adminApi.js`, `AdminCatalogController` |
| 4. Cập nhật thông tin sản phẩm | Admin / Staff | Cập nhật name, SKU, price, category, brand, media, specs, variants nếu có. | Upsert product request, admin mutation service, media/specification/variant DTOs hiện diện. | `CONFIRMED_FROM_CODE` | `AdminCatalogController`, `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/admin/dto/UpsertProductRequest.java` |
| 5. Quản lý category/brand | Admin / Staff | Tổ chức catalog để khách browse/filter. | Category/brand CRUD trong admin controller/client. | `CONFIRMED_FROM_CODE` | `AdminCatalogController`, `bigbike-admin/src/lib/adminApi.js` |
| 6. Xóa mềm/ẩn sản phẩm | Admin / Staff | Loại khỏi catalog public mà không hard-delete dữ liệu nghiệp vụ. | Product delete được comment là soft-delete về `TRASH`; category delete chuyển `is_visible=false`. | `CONFIRMED_FROM_CODE` | `AdminCatalogController` |
| 7. Kiểm tra public display | Admin / Staff / Customer | Sản phẩm sau khi public phải hiển thị đúng bên web/mobile. | Public catalog endpoints và web/mobile product/category routes tồn tại. | `CONFIRMED_FROM_CODE` | `CatalogController`, `bigbike-web/lib/utils/routes.ts`, `bigbike_mobile/lib/core/router/app_router.dart` |

## 5. Product Publishing Process

Product Publishing là quy trình quyết định sản phẩm có được hiển thị public hay không.

| Step | Actor | Business goal | System support | Status | Evidence path |
|---|---|---|---|---|---|
| 1. Sản phẩm có publish status | Admin / System | Phân biệt sản phẩm draft/published/hidden/archived/trash. | Backend admin product publish request cho phép các status như `DRAFT`, `PUBLISHED`, `HIDDEN`, `ARCHIVED`, `PENDING`, `PRIVATE`, `TRASH`. | `CONFIRMED_FROM_CODE` | `AdminCatalogController` |
| 2. Admin cập nhật publish status | Admin | Chuyển trạng thái sản phẩm theo nhu cầu kinh doanh. | Endpoint publish yêu cầu `products.update`; admin client có `publishProduct`. | `CONFIRMED_FROM_CODE` | `AdminCatalogController`, `bigbike-admin/src/lib/adminApi.js` |
| 3. Public web lấy danh sách/chi tiết sản phẩm | Guest / Customer | Chỉ xem sản phẩm hợp lệ cho public. | Public product endpoints tồn tại; quick-buy yêu cầu product `PUBLISHED`. | `CONFIRMED_FROM_CODE` | `CatalogController`, `CheckoutService` |
| 4. SEO metadata cho sản phẩm/content | Admin / System | Public page có metadata/canonical hỗ trợ SEO. | Web có SEO metadata builder và route helper canonical URL. | `CONFIRMED_FROM_CODE` | `bigbike-web/app/page.tsx`, `bigbike-web/lib/utils/routes.ts` |
| 5. Rule public filter theo status | System | Đảm bảo sản phẩm chưa publish không lộ public. | Quick-buy check `PublishStatus.PUBLISHED`; public catalog filtering cần kiểm tra sâu trong read service. | `NEEDS_VERIFICATION` | `CheckoutService`, `CatalogController`, `CatalogReadService` |

## 6. Customer Browsing Process

Customer Browsing là luồng khách truy cập tìm hiểu sản phẩm trước khi mua.

| Step | Actor | Business goal | System support | Status | Evidence path |
|---|---|---|---|---|---|
| 1. Vào homepage | Guest / Customer | Nhìn thấy thương hiệu, slider, category, product, articles, brand, SEO content. | Homepage fetch sliders, categories, articles, brands, settings, featured products, home videos. | `CONFIRMED_FROM_CODE` | `bigbike-web/app/page.tsx` |
| 2. Xem danh sách sản phẩm | Guest / Customer | Browse catalog. | Route `/san-pham`; public product list API. | `CONFIRMED_FROM_CODE` | `bigbike-web/lib/utils/routes.ts`, `CatalogController` |
| 3. Xem category/brand | Guest / Customer | Browse theo nhóm sản phẩm/thương hiệu. | Category/brand routes và public APIs. | `CONFIRMED_FROM_CODE` | `bigbike-web/lib/utils/routes.ts`, `CatalogController` |
| 4. Tìm kiếm/lọc | Guest / Customer | Tìm nhanh sản phẩm/content theo nhu cầu. | Backend public search endpoints; mobile `/tim-kiem`; product list query/filter có category/brand/q/price/color/gender. | `CONFIRMED_FROM_CODE` | `SecurityConfig`, `PublicSearchController`, `CatalogController`, `bigbike_mobile/lib/core/router/app_router.dart` |
| 5. Xem chi tiết sản phẩm | Guest / Customer | Đọc giá, mô tả, ảnh, thông số, biến thể, stock. | Product detail route và product-by-slug/snapshot API. | `CONFIRMED_FROM_CODE` | `bigbike-web/lib/utils/routes.ts`, `CatalogController` |
| 6. Đọc content/blog/policy | Guest / Customer | Tăng trust và SEO visibility. | Article/content/page routes/API. | `CONFIRMED_FROM_CODE` | `AdminContentController`, `ContentController`, `bigbike_mobile/lib/core/router/app_router.dart` |
| 7. Tiếp tục hành động | Guest / Customer | Thêm giỏ, checkout, quick-buy, liên hệ. | Cart/checkout/contact endpoints/routes tồn tại. | `CONFIRMED_FROM_CODE` | `CartController`, `CheckoutController`, `ContactController`, `bigbike-web/lib/utils/routes.ts` |

## 7. Cart / Checkout Process

Cart / Checkout là quy trình chuyển nhu cầu mua thành order.

| Step | Actor | Business goal | System support | Status | Evidence path |
|---|---|---|---|---|---|
| 1. Customer thêm sản phẩm vào cart | Guest / Customer | Lưu sản phẩm muốn mua. | Cart controller/DTOs tồn tại; guest + customer cart endpoints được permit trong security. | `CONFIRMED_FROM_CODE` | `CartController`, `SecurityConfig` |
| 2. Customer nhập thông tin nhận hàng | Guest / Customer | Thu thập billing/shipping address. | Checkout service validate full name, phone, email, address line. | `CONFIRMED_FROM_CODE` | `CheckoutService` |
| 3. Customer chọn payment method | Guest / Customer | Chọn COD hoặc chuyển khoản ngân hàng. | Checkout options trả `COD`, `BACS`; checkout validate allowed methods. | `CONFIRMED_FROM_CODE` | `CheckoutService`, `PHASE_1F_CHECKOUT_API_REPORT.md` |
| 4. Customer chọn shipping method | Guest / Customer | Xác định phương thức và phí giao hàng. | Shipping method auto-select nếu chỉ có một enabled method hoặc yêu cầu chọn nếu có nhiều. | `CONFIRMED_FROM_CODE` | `CheckoutService`, `PHASE_1F_CHECKOUT_API_REPORT.md` |
| 5. System validate price/stock | System | Tránh bán sai giá hoặc vượt tồn kho. | Checkout sync price, validate stock, reject out-of-stock/insufficient stock. | `CONFIRMED_FROM_CODE` | `CheckoutService` |
| 6. System tạo order | System | Ghi nhận đơn hàng chính thức. | Tạo order, line items, addresses, shipping item, payment, applied coupons, system note. | `CONFIRMED_FROM_CODE` | `CheckoutService` |
| 7. System trừ kho | System | Phản ánh tồn kho sau khi đặt hàng. | Decrement stock/variant quantity, ghi stock movement `OUT`. | `CONFIRMED_FROM_CODE` | `CheckoutService` |
| 8. System đánh dấu cart converted | System | Ngăn dùng lại cart đã checkout. | Cart status set `CONVERTED`. | `CONFIRMED_FROM_CODE` | `CheckoutService`, `PHASE_1F_CHECKOUT_API_REPORT.md` |
| 9. System gửi thông báo | System | Xác nhận với khách và báo admin có đơn mới. | OrderNotificationService và AdminOrderWsService được gọi sau checkout/quick-buy. | `CONFIRMED_FROM_CODE`; email delivery production `NEEDS_VERIFICATION` | `CheckoutService`, `docker-compose.yaml` |
| 10. Customer nhận order summary | Customer | Biết đơn đã tạo và trạng thái ban đầu. | Response gồm order number, order key, status, payment status, totals. | `CONFIRMED_FROM_CODE` | `CheckoutService`, `OrderSummaryResponse.java` |

## 8. Order Management Process

Order Management là quy trình admin xử lý đơn hàng sau khi hệ thống tạo order.

| Step | Actor | Business goal | System support | Status | Evidence path |
|---|---|---|---|---|---|
| 1. Admin xem danh sách đơn | Admin / Staff | Theo dõi đơn mới, lọc theo status/payment/date/search. | Admin order list có filters status, paymentStatus, q, from/to, sort. | `CONFIRMED_FROM_CODE` | `AdminOrderController`, `AdminOrderService` |
| 2. Admin mở chi tiết đơn | Admin / Staff | Xem line items, address, shipping, payment, notes, coupons. | Admin order detail map full data. | `CONFIRMED_FROM_CODE` | `AdminOrderService` |
| 3. Admin xem allowed transitions | Admin / Staff | Chỉ thấy trạng thái có thể chuyển hợp lệ. | Endpoint allowed-transitions + service transition map. | `CONFIRMED_FROM_CODE` | `AdminOrderController`, `AdminOrderService` |
| 4. Admin cập nhật order status | Admin / Staff | Xử lý đơn: pending/processing/on-hold/completed/cancelled/failed/refunded. | Backend validate transition, set completed/cancelled timestamp, audit, notify, websocket. | `CONFIRMED_FROM_CODE` | `AdminOrderService` |
| 5. Admin cập nhật payment status | Admin / Staff | Ghi nhận unpaid/pending/paid/partial/refund/cancel/failed. | Backend validate payment transition, set paid amount/paidAt, update payment record. | `CONFIRMED_FROM_CODE` | `AdminOrderService` |
| 6. Admin tạo refund | Admin / Staff | Hoàn tiền một phần/toàn phần sau khi có thanh toán. | Refund command validate paid status, refundable amount, update order/payment/refund note/audit. | `CONFIRMED_FROM_CODE` | `AdminOrderController`, `AdminOrderService` |
| 7. Admin thêm note | Admin / Staff | Ghi chú nội bộ hoặc note customer-visible. | Add/list notes, customerVisible flag, audit, websocket. | `CONFIRMED_FROM_CODE` | `AdminOrderController`, `AdminOrderService` |
| 8. System restore stock khi cancel/refund | System | Trả hàng về tồn kho khi đơn cancel/refunded. | restoreStockForOrder khi order status `CANCELLED` hoặc `REFUNDED`. | `CONFIRMED_FROM_CODE` | `AdminOrderService` |
| 9. Fulfillment/tracking | Admin / Staff / System | Theo dõi giao hàng thực tế. | Có fulfillment status field/domain và shipping item, nhưng process carrier/tracking chưa rõ. | `NEEDS_VERIFICATION` | `AdminOrderService`, `AdminShippingController` |

Order status values observed in service:

```text
PENDING, PROCESSING, ON_HOLD, COMPLETED, CANCELLED, FAILED, REFUNDED
```

Payment status values observed in service:

```text
UNPAID, PENDING, PAID, PARTIALLY_PAID, FAILED, REFUNDED, CANCELLED, PARTIALLY_REFUNDED
```

Chi tiết transition đầy đủ nên được tách sang `STATE_MACHINES.md`.

## 9. Payment Handling Process

Payment Handling hiện tại là payment nội bộ/manual, chưa thấy external gateway/webhook production flow trong audited evidence.

| Step | Actor | Business goal | System support | Status | Evidence path |
|---|---|---|---|---|---|
| 1. Customer chọn payment method | Customer | Chọn cách thanh toán. | Checkout options hỗ trợ `COD` và `BACS`. | `CONFIRMED_FROM_CODE` | `CheckoutService`, `PHASE_1F_CHECKOUT_API_REPORT.md` |
| 2. System tạo payment record | System | Lưu trạng thái thanh toán ban đầu. | Payment provider set `INTERNAL`, status `PENDING`, order payment status `UNPAID`. | `CONFIRMED_FROM_CODE` | `CheckoutService` |
| 3. System gán order status theo payment method | System | COD xử lý ngay; BACS chờ thanh toán/chuyển khoản. | `COD` → `PROCESSING`; `BACS` → `ON_HOLD`; payment status `UNPAID`. | `CONFIRMED_FROM_CODE` | `CheckoutService`, `PHASE_1F_CHECKOUT_API_REPORT.md` |
| 4. Admin cập nhật payment status | Admin / Staff | Ghi nhận đã thanh toán/thanh toán một phần/thất bại/hủy. | Backend validate payment transitions và paidAmount. | `CONFIRMED_FROM_CODE` | `AdminOrderService` |
| 5. Admin refund | Admin / Staff | Hoàn tiền toàn phần/một phần. | Refund command update order/payment refund amount/status. | `CONFIRMED_FROM_CODE` | `AdminOrderService` |
| 6. Webhook tự động | Third-party / System | Tự động cập nhật payment từ provider. | Chưa thấy evidence payment webhook. | `NOT_FOUND_IN_REPO` | Không thấy controller/service webhook trong audited evidence. |
| 7. QR/bank provider integration | Third-party / System | Chuyển khoản tự động/QR/payment gateway. | `BACS` tồn tại như bank transfer method, nhưng chưa xác nhận external provider. | `NEEDS_VERIFICATION` | `CheckoutService` |

## 10. Shipping / Fulfillment Process

Shipping hiện tại được xác nhận ở mức cấu hình shipping zone/method và gắn shipping method vào order. Carrier/tracking fulfillment chưa được xác nhận.

| Step | Actor | Business goal | System support | Status | Evidence path |
|---|---|---|---|---|---|
| 1. Admin quản lý shipping zones | Admin / Staff | Cấu hình vùng giao hàng. | CRUD zones với `shipping.read/write`. | `CONFIRMED_FROM_CODE` | `AdminShippingController` |
| 2. Admin quản lý shipping methods | Admin / Staff | Cấu hình phương thức/phí/freeship threshold. | CRUD methods theo zone. | `CONFIRMED_FROM_CODE` | `AdminShippingController` |
| 3. Customer chọn shipping method | Customer | Chọn phương thức giao hàng khi checkout. | Checkout resolve shipping method, validate enabled, auto-select khi phù hợp. | `CONFIRMED_FROM_CODE` | `CheckoutService` |
| 4. System tính shipping cost | System | Tính phí vận chuyển vào tổng đơn. | `resolveShippingCost`, freeShippingThreshold. | `CONFIRMED_FROM_CODE` | `CheckoutService` |
| 5. System lưu shipping item | System | Ghi nhận phương thức vận chuyển vào order. | Tạo `OrderShippingItemEntity`. | `CONFIRMED_FROM_CODE` | `CheckoutService`, `AdminOrderService` |
| 6. Admin cập nhật fulfillment/tracking | Admin / Carrier / System | Theo dõi vận đơn, giao hàng, hoàn tất. | Chưa thấy process carrier/tracking rõ. | `NEEDS_VERIFICATION` | `AdminShippingController`, `AdminOrderService` |
| 7. Third-party carrier integration | Third-party / System | Tạo vận đơn với GHN/GHTK/ViettelPost hoặc carrier khác. | Chưa thấy evidence. | `NOT_FOUND_IN_REPO` | Không thấy provider-specific controller/service trong audited evidence. |

## 11. Inventory Management Process

Inventory Management quản lý số lượng tồn, biến động kho và stock state ảnh hưởng trực tiếp tới checkout.

| Step | Actor | Business goal | System support | Status | Evidence path |
|---|---|---|---|---|---|
| 1. Admin xem tồn kho | Admin / Staff | Theo dõi stock theo sản phẩm/variant. | Inventory list, summary, movement endpoints. | `CONFIRMED_FROM_CODE` | `AdminInventoryController` |
| 2. Admin lọc tồn kho | Admin / Staff | Tìm sản phẩm theo keyword/stockState. | Query `q`, `stockState`. | `CONFIRMED_FROM_CODE` | `AdminInventoryController` |
| 3. Admin xem stock movements | Admin / Staff | Kiểm tra lịch sử nhập/xuất/điều chỉnh. | List all movements, list movements by variant. | `CONFIRMED_FROM_CODE` | `AdminInventoryController` |
| 4. Admin điều chỉnh stock | Admin / Staff | Sửa tồn kho thủ công có kiểm soát. | Adjust stock endpoint yêu cầu `products.update`. | `CONFIRMED_FROM_CODE` | `AdminInventoryController` |
| 5. System validate stock khi checkout | System | Không cho đặt vượt tồn. | Checkout lock/read product/variant, reject insufficient stock/out-of-stock. | `CONFIRMED_FROM_CODE` | `CheckoutService` |
| 6. System trừ stock khi order created | System | Đảm bảo tồn kho giảm khi bán hàng. | Decrement product/variant stock, update stock state, ghi stock movement `OUT`. | `CONFIRMED_FROM_CODE` | `CheckoutService` |
| 7. System restore stock khi cancel/refund/return | System | Hoàn hàng về kho khi đơn bị cancel/refunded hoặc return completed. | `restoreStockForOrder`, `restoreStockForReturn`. | `CONFIRMED_FROM_CODE` | `AdminOrderService`, `AdminReturnService` |
| 8. Serial-level inventory | Admin / Staff / System | Quản lý serial cụ thể nếu có. | Entity `StockMovementSerialEntity` tồn tại, nhưng process chưa audit sâu. | `INFERRED_FROM_STRUCTURE` | `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/persistence/entity/catalog/StockMovementSerialEntity.java` |

## 12. Return / Refund Process

Return / Refund gồm hai phần: return request/status và payment refund.

| Step | Actor | Business goal | System support | Status | Evidence path |
|---|---|---|---|---|---|
| 1. Customer xem returns | Customer | Theo dõi hoặc tạo yêu cầu đổi/trả. | Mobile có route `/tai-khoan/doi-tra`; backend customer return DTO/controller tồn tại trong compile list. | `INFERRED_FROM_STRUCTURE` | `bigbike_mobile/lib/core/router/app_router.dart`, `CustomerOrderController`, `CreateReturnRequest.java` |
| 2. Admin xem danh sách returns | Admin / Staff | Quản lý yêu cầu trả hàng. | Admin returns list filter status/q. | `CONFIRMED_FROM_CODE` | `AdminReturnController`, `AdminReturnService` |
| 3. Admin xem chi tiết return | Admin / Staff | Xem items, reason, note, history. | Return detail maps items/history/order/customer data. | `CONFIRMED_FROM_CODE` | `AdminReturnService` |
| 4. Admin cập nhật return status | Admin / Staff | Duyệt/từ chối/nhận hàng/hoàn tất/đã hoàn tiền. | Transition map: `PENDING -> APPROVED/REJECTED`, `APPROVED -> RECEIVED`, `RECEIVED -> COMPLETED/REFUNDED`. | `CONFIRMED_FROM_CODE` | `AdminReturnService` |
| 5. System gửi thông báo return | System | Thông báo customer khi return approved/rejected/received/refunded. | Notification service calls per status. | `CONFIRMED_FROM_CODE`; production delivery `NEEDS_VERIFICATION` | `AdminReturnService` |
| 6. System restore stock khi return completed | System | Hàng hoàn về kho. | `restoreStockForReturn` tạo stock movement `IN`. | `CONFIRMED_FROM_CODE` | `AdminReturnService` |
| 7. Admin tạo refund trên order | Admin / Staff | Hoàn tiền cho đơn hàng. | `createRefund` validate paid status/refundable amount, update order/payment. | `CONFIRMED_FROM_CODE` | `AdminOrderController`, `AdminOrderService` |
| 8. Payment provider refund | Third-party / System | Hoàn tiền qua gateway ngoài. | Chưa thấy external provider. | `NOT_FOUND_IN_REPO` | Không thấy provider webhook/refund integration trong audited evidence. |

## 13. Media Management Process

Media Management là quy trình admin quản lý file hình ảnh/tài nguyên dùng cho product/content/homepage.

| Step | Actor | Business goal | System support | Status | Evidence path |
|---|---|---|---|---|---|
| 1. Admin upload media | Admin / Staff | Đưa ảnh/file lên hệ thống. | Multipart upload endpoint yêu cầu `media.write`. | `CONFIRMED_FROM_CODE` | `AdminMediaController` |
| 2. Admin xem danh sách media | Admin / Staff | Tìm/lọc media theo keyword, mimeType, status, storageProvider. | List media endpoint. | `CONFIRMED_FROM_CODE` | `AdminMediaController` |
| 3. Admin xem chi tiết media | Admin / Staff | Kiểm tra URL/metadata/alt text/status. | Get media detail endpoint. | `CONFIRMED_FROM_CODE` | `AdminMediaController` |
| 4. Admin cập nhật metadata | Admin / Staff | Sửa alt text/metadata phục vụ SEO/accessibility. | Update media request. | `CONFIRMED_FROM_CODE` | `AdminMediaController`, `UpdateMediaRequest.java` |
| 5. Admin soft-delete/hard-delete/restore | Admin / Staff | Quản lý vòng đời media. | Delete permanent flag, restore endpoint. | `CONFIRMED_FROM_CODE` | `AdminMediaController` |
| 6. Storage backend | System | Lưu trữ object file. | MinIO dependency/config và Docker service. | `CONFIRMED_FROM_CODE` | `bigbike-backend/pom.xml`, `docker-compose.yaml` |
| 7. Media gắn với product/content | Admin / Staff / System | Dùng media cho product/content/home UI. | Product/content DTOs có image/media references; homepage consumes media URLs. | `INFERRED_FROM_STRUCTURE` | `UpsertProductRequest.java`, `UpsertArticleRequest.java`, `bigbike-web/app/page.tsx` |

## 14. Content / SEO Management Process

Content / SEO Management xử lý bài viết, page, homepage SEO, menu/redirect và public visibility.

| Step | Actor | Business goal | System support | Status | Evidence path |
|---|---|---|---|---|---|
| 1. Admin xem content | Admin / Content Editor | Quản lý articles/pages theo type/status/search. | Admin content list supports type/publishStatus/search. | `CONFIRMED_FROM_CODE` | `AdminContentController` |
| 2. Admin tạo/sửa article | Admin / Content Editor | Xuất bản blog/news/experience content. | Create/update article. | `CONFIRMED_FROM_CODE` | `AdminContentController` |
| 3. Admin tạo/sửa page | Admin / Content Editor | Quản lý policy/guide/CMS pages. | Create/update page. | `CONFIRMED_FROM_CODE` | `AdminContentController` |
| 4. Admin xóa content | Admin / Content Editor | Loại bỏ content không còn dùng. | Delete article/page. | `CONFIRMED_FROM_CODE` | `AdminContentController` |
| 5. Public web render articles/pages | Guest / Customer | Khách đọc content SEO/trust. | Homepage fetch articles; routes for articles/pages exist. | `CONFIRMED_FROM_CODE` | `bigbike-web/app/page.tsx`, `bigbike-web/lib/utils/routes.ts`, `ContentController` |
| 6. SEO metadata/canonical/JSON-LD | System | Tối ưu SEO và crawlability. | Homepage generate metadata, JSON-LD, route canonical helper. | `CONFIRMED_FROM_CODE` | `bigbike-web/app/page.tsx`, `bigbike-web/lib/utils/routes.ts` |
| 7. Legacy redirect/SEO migration | System / Admin | Giữ link cũ từ WordPress. | Redirect controller/migration utilities/ETL scripts exist. | `CONFIRMED_FROM_CODE` for tooling; completeness `NEEDS_VERIFICATION` | `InternalRedirectController`, `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/migration/wordpress/**`, `bigbike-web/package.json` |
| 8. Sitemap/robots | System | SEO technical files. | Chưa audit thấy evidence rõ trong task này. | `NEEDS_VERIFICATION` | Cần search sâu trong `bigbike-web/app` / `public`. |

## 15. Admin User / Role / Permission Process

Admin permission process kiểm soát ai được đọc/sửa từng module vận hành.

| Step | Actor | Business goal | System support | Status | Evidence path |
|---|---|---|---|---|---|
| 1. Admin đăng nhập | Admin / Staff | Truy cập admin portal. | Admin auth client login/refresh/logout; backend auth endpoints. | `CONFIRMED_FROM_CODE` | `bigbike-admin/src/lib/adminApi.js`, `AuthController`, `SecurityConfig` |
| 2. Admin route yêu cầu permission | Admin / Staff | UI chỉ cho vào module phù hợp. | Admin README map route -> permission. | `CONFIRMED_FROM_CODE` | `bigbike-admin/README.md` |
| 3. Backend enforce admin role | System | Không dựa vào frontend hiding. | `/api/v1/admin/**` yêu cầu `ROLE_ADMIN`. | `CONFIRMED_FROM_CODE` | `SecurityConfig` |
| 4. Backend enforce action permission | System | Kiểm soát read/write từng business action. | Controllers gọi `devAdminAuthService.requirePermission`. | `CONFIRMED_FROM_CODE` | `AdminCatalogController`, `AdminOrderController`, `AdminShippingController`, `AdminMediaController` |
| 5. Admin quản lý roles/users | Admin / Super Admin | Quản lý user/role/permission. | Admin roles/users controllers/repositories tồn tại. | `CONFIRMED_FROM_CODE` | `AdminRolesController`, `AdminAdminUsersController`, `AdminRoleJpaRepository` |
| 6. Full RBAC matrix | PM / BA / Admin | Biết role nào được thao tác module nào. | Chưa có docs matrix trong `docs/business`. | `NEEDS_VERIFICATION` | Planned `PERMISSION_MATRIX.md` |

Không liệt kê permission chi tiết trong file này. Chi tiết nên đưa vào `PERMISSION_MATRIX.md`.

## 16. Reporting / Dashboard Process

Reporting / Dashboard giúp admin/manager theo dõi vận hành và xuất dữ liệu.

| Step | Actor | Business goal | System support | Status | Evidence path |
|---|---|---|---|---|---|
| 1. Admin xem dashboard | Admin / Manager | Theo dõi tình hình vận hành. | Admin dashboard route/controller exists. | `CONFIRMED_FROM_CODE` | `bigbike-admin/README.md`, `AdminDashboardController` |
| 2. Admin xem analytics | Admin / Manager | Phân tích số liệu theo date range. | `/admin/reports/analytics` yêu cầu `orders.read`. | `CONFIRMED_FROM_CODE` | `AdminReportController` |
| 3. Export orders | Admin / Manager | Xuất danh sách đơn để đối soát. | CSV export orders filter status/payment/date. | `CONFIRMED_FROM_CODE` | `AdminReportController` |
| 4. Export customers | Admin / Manager | Xuất dữ liệu khách hàng phục vụ vận hành. | CSV export customers filter status. | `CONFIRMED_FROM_CODE` | `AdminReportController` |
| 5. Export products | Admin / Manager | Xuất catalog/product data. | CSV export products filter publishStatus. | `CONFIRMED_FROM_CODE` | `AdminReportController` |
| 6. Export inventory | Admin / Staff | Xuất tồn kho. | Inventory export csv. | `CONFIRMED_FROM_CODE` | `AdminInventoryController` |
| 7. Report semantics | PM / BA / Admin | Biết chính xác metric tính thế nào. | Cần docs riêng hoặc audit sâu service. | `NEEDS_VERIFICATION` | `AdminReportService` |

## 17. Settings / Configuration Process

Settings / Configuration cho phép admin chỉnh cấu hình ảnh hưởng đến public web và vận hành.

| Step | Actor | Business goal | System support | Status | Evidence path |
|---|---|---|---|---|---|
| 1. Admin xem settings | Admin / Staff | Kiểm tra cấu hình site. | Admin settings API, route `/admin/settings`. | `CONFIRMED_FROM_CODE` | `bigbike-admin/README.md`, `AdminSettingsController`, `PHASE_1J_ADMIN_SETTINGS_MENU_COUPON_API_REPORT.md` |
| 2. Admin cập nhật setting | Admin / Staff | Cấu hình nội dung/SEO/contact/public/private values. | Settings update endpoint; sensitive keys không được public theo report. | `CONFIRMED_FROM_CODE` | `PHASE_1J_ADMIN_SETTINGS_MENU_COUPON_API_REPORT.md` |
| 3. Public web đọc public settings | System / Guest | Render hotline, SEO home title/description, promo/about/home content. | Public settings endpoint; homepage uses settings. | `CONFIRMED_FROM_CODE` | `PublicSettingsController`, `bigbike-web/app/page.tsx` |
| 4. Admin quản lý menu | Admin / Staff | Cấu hình navigation public. | Admin/public menu APIs, reorder support. | `CONFIRMED_FROM_CODE` | `PHASE_1J_ADMIN_SETTINGS_MENU_COUPON_API_REPORT.md`, `AdminMenuController`, `PublicMenuController` |
| 5. Admin quản lý coupon | Admin / Staff | Tạo/cập nhật coupon business campaign. | Admin coupon API. Cart/checkout usage hiện có code trong checkout, nhưng report cũ nói deferred. | `CONFIRMED_FROM_CODE` for admin coupon; `NEEDS_VERIFICATION` for docs/code drift | `PHASE_1J_ADMIN_SETTINGS_MENU_COUPON_API_REPORT.md`, `CheckoutService` |
| 6. Ai được sửa settings | Admin / Staff | Tránh cấu hình sai/nhạy cảm. | Permission `settings.read/settings.write`; sensitive public guard theo report. | `CONFIRMED_FROM_CODE` | `PHASE_1J_ADMIN_SETTINGS_MENU_COUPON_API_REPORT.md` |

## 18. Cross-Process Dependencies

| Source Process | Depends On / Affects | Reason | Status |
|---|---|---|---|
| Product Management | Product Publishing | Product data phải tồn tại trước khi publish. | `CONFIRMED_FROM_CODE` |
| Product Publishing | Customer Browsing | Chỉ sản phẩm public/hợp lệ mới nên xuất hiện ngoài web/mobile. | `CONFIRMED_FROM_CODE`; filter public status cần verify sâu |
| Media Management | Product Display / Content SEO | Product/content cần ảnh/media/alt text để hiển thị và SEO tốt. | `INFERRED_FROM_STRUCTURE` |
| Content / SEO | Customer Browsing | Homepage/articles/pages/settings/menu ảnh hưởng traffic và trust. | `CONFIRMED_FROM_CODE` |
| Cart / Checkout | Order Management | Checkout tạo order để admin xử lý. | `CONFIRMED_FROM_CODE` |
| Cart / Checkout | Inventory | Checkout validate/trừ stock, stock ảnh hưởng khả năng đặt hàng. | `CONFIRMED_FROM_CODE` |
| Cart / Checkout | Payment Handling | Payment method quyết định order status ban đầu và payment record. | `CONFIRMED_FROM_CODE` |
| Cart / Checkout | Shipping | Shipping method/cost được lưu vào order. | `CONFIRMED_FROM_CODE` |
| Order Management | Inventory | Cancel/refund restore stock. | `CONFIRMED_FROM_CODE` |
| Return / Refund | Inventory | Return completed restore stock movement `IN`. | `CONFIRMED_FROM_CODE` |
| Return / Refund | Payment Handling | Refund update payment/order refund status. | `CONFIRMED_FROM_CODE` |
| Settings / Configuration | Public Web | Public settings/menu ảnh hưởng nội dung hiển thị. | `CONFIRMED_FROM_CODE` |
| Admin User / Permission | All Admin Processes | Permission quyết định admin nào được thao tác module nào. | `CONFIRMED_FROM_CODE` |
| Reporting / Dashboard | Orders / Products / Customers / Inventory | Report lấy dữ liệu từ các process vận hành. | `CONFIRMED_FROM_CODE` |
| Notification | Checkout / Order / Return | Email/websocket phát sinh từ các sự kiện nghiệp vụ. | `CONFIRMED_FROM_CODE`; delivery runtime `NEEDS_VERIFICATION` |
| WordPress Migration / Redirect | SEO / Content / Product URL | Migration/redirect ảnh hưởng giữ URL cũ và SEO equity. | `CONFIRMED_FROM_CODE` for tooling; completeness `NEEDS_VERIFICATION` |

## 19. Missing / Not Confirmed Processes

| Process | Status | Gap |
|---|---|---|
| External payment webhook | `NOT_FOUND_IN_REPO` | Chưa thấy webhook controller/service cho ngân hàng/payment provider. |
| External payment gateway / QR provider | `NEEDS_VERIFICATION` | `BACS` là bank transfer method, nhưng chưa xác nhận provider/QR/auto reconciliation. |
| Third-party shipping carrier integration | `NOT_FOUND_IN_REPO` | Chưa thấy GHN/GHTK/ViettelPost/carrier-specific integration. |
| Fulfillment tracking lifecycle | `NEEDS_VERIFICATION` | Có shipping item/fulfillment status, nhưng chưa thấy tracking number/carrier event workflow rõ. |
| Full customer-created return flow | `NEEDS_VERIFICATION` | Admin return process rõ hơn customer return creation process; cần audit `CustomerOrderController`. |
| Full RBAC matrix | `NEEDS_VERIFICATION` | Có permission checks nhưng chưa có matrix role/action/module đầy đủ. |
| POS business workflow | `NEEDS_VERIFICATION` | Có `AdminPosController` và logic auto-complete POS transfer order, nhưng chưa document process. |
| SEO migration completeness | `NEEDS_VERIFICATION` | Có tooling/redirect/migration, nhưng cần SEO migration docs riêng để verify URL coverage. |
| Production email delivery | `NEEDS_VERIFICATION` | Code gọi notification service và có mail config, nhưng chưa verify SMTP/runtime. |
| Backup / restore process | `NOT_FOUND_IN_REPO` | Chưa thấy backup/restore operational process trong audited evidence. |
| Build/test/runtime health for current main | `NEEDS_VERIFICATION` | Task này không chạy build/test/runtime. |
| Sitemap/robots process | `NEEDS_VERIFICATION` | Chưa audit sâu thấy evidence rõ trong task này. |

## 20. Evidence Summary

| Process | Evidence Path | What It Proves | Confidence |
|---|---|---|---|
| Project context | `docs/business/PROJECT_OVERVIEW.md` | BigBike scope/components/capabilities đã được tóm tắt từ repo. | High |
| Root context | `README.md` | BigBike là motorcycle gear retail/D2C commerce platform. | High |
| Agent/business guardrails | `AGENTS.md` | Repo yêu cầu không tự bịa business rule, backend enforce business logic, permission server-side. | High |
| Admin routes | `bigbike-admin/README.md` | Admin has route/permission map for product, catalog, content, orders, customers, media, coupons, redirects, menus, sliders, shipping, reviews, admin users, settings. | High |
| Admin API client | `bigbike-admin/src/lib/adminApi.js` | Admin UI calls backend for catalog/order/customer/content/settings/media/etc. | High |
| Public web homepage | `bigbike-web/app/page.tsx` | Homepage business sections and SEO/public data consumption. | High |
| Public web routes | `bigbike-web/lib/utils/routes.ts` | Confirms public commerce/account routes. | High |
| Mobile routes | `bigbike_mobile/lib/core/router/app_router.dart` | Confirms mobile commerce/account/content routes. | High |
| Public catalog | `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/catalog/CatalogController.java` | Product/category/brand browsing APIs. | High |
| Admin catalog | `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/admin/AdminCatalogController.java` | Product/category/brand admin CRUD/publish/soft-delete permission checks. | High |
| Checkout | `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/checkout/CheckoutService.java` | Checkout business logic: validate address/payment/stock/price, create order/payment/shipping/note, decrement stock, notifications. | High |
| Checkout report | `bigbike-backend/docs/PHASE_1F_CHECKOUT_API_REPORT.md` | Phase-level checkout behavior, status mapping and tests at time of report. | High for phase scope |
| Admin order | `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/admin/AdminOrderController.java` | Admin order list/detail/status/payment/refund/note endpoints and permission checks. | High |
| Admin order service | `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminOrderService.java` | Order/payment transitions, refund rules, audit, notes, notifications, websocket, stock restore. | High |
| Admin inventory | `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/admin/AdminInventoryController.java` | Inventory list/summary/movements/export/adjust stock. | High |
| Admin return | `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/admin/AdminReturnController.java` | Admin returns read/update permissioned endpoints. | High |
| Admin return service | `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminReturnService.java` | Return transitions, notification, stock restore. | High |
| Admin shipping | `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/admin/AdminShippingController.java` | Shipping zones/methods CRUD. | High |
| Admin media | `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/admin/AdminMediaController.java` | Media upload/list/detail/update/delete/restore. | High |
| Admin content | `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/admin/AdminContentController.java` | Article/page content management with permissions/status filters. | High |
| Reporting | `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/admin/AdminReportController.java` | Analytics and CSV export for orders/customers/products. | High |
| Security/permissions | `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/config/SecurityConfig.java` | Public/protected endpoints, admin role, customer role, auth boundaries. | High |
| Customer auth | `bigbike-backend/docs/PHASE_1D_CUSTOMER_AUTH_REPORT.md` | Customer register/login/session/CSRF foundation and tests at phase time. | High for phase scope |
| Settings/menu/coupon | `bigbike-backend/docs/PHASE_1J_ADMIN_SETTINGS_MENU_COUPON_API_REPORT.md` | Settings/menu/coupon APIs and business rules at phase time. | High for phase scope; coupon checkout drift needs verify |
| Infrastructure | `docker-compose.yaml` | Postgres, MinIO, backend/web/admin runtime services and mail/env boundaries. | High |
| Backend dependencies | `bigbike-backend/pom.xml` | JPA/Flyway/Security/Mail/MinIO/WebSocket/Bucket4j/PostgreSQL capabilities. | High |
| Design system | `Bigbike Design System/README.md` | Brand/business retail context, UI direction and product categories. | High |

## 21. Known Ambiguities / Needs Verification

1. `PHASE_1J_ADMIN_SETTINGS_MENU_COUPON_API_REPORT.md` says coupon-cart integration was deferred, but current `CheckoutService` records cart coupons into orders and increments coupon usage. This is likely docs drift and needs verification by tests/runtime.
2. External payment provider/webhook was not found in audited evidence. `BACS` exists, but auto bank reconciliation/QR/payment webhook is not confirmed.
3. Third-party shipping carrier integration was not found. Shipping currently appears as internal zones/methods/cost configuration.
4. Fulfillment lifecycle beyond shipping method/order shipping item is not fully clear. `fulfillmentStatus` exists in order detail, but carrier/tracking workflow needs audit.
5. Return process is clear on admin side, but customer-created return flow requires deeper audit of customer order APIs and UI.
6. Product public filtering by publish status is partly confirmed by quick-buy requiring `PUBLISHED`, but public catalog read service should be audited separately.
7. Admin RBAC exists through permissions, but full matrix by role/action/module is not documented here.
8. POS process appears in backend (`AdminPosController`, POS auto-complete condition in order payment update), but business workflow is not documented enough to mark complete.
9. Production auth readiness remains unclear because previous overview noted production auth provider concerns from root README.
10. Email notification code paths exist, but SMTP production deliverability was not tested.
11. SEO migration tooling exists, but full redirect coverage and sitemap/robots completeness need dedicated SEO migration audit.
12. Build/test/runtime were not run for this documentation task. Do not treat this file as green-build evidence.
13. `docs/DECISIONS.md` was referenced in root docs but previously direct fetch returned not found. Verify actual location or update references.
14. `bigbike_mobile` exists with real routes, but root README tree previously did not list it; clarify official production scope.

## 22. Relationship With Other Docs

| Document | Relationship |
|---|---|
| `PROJECT_OVERVIEW.md` | Trả lời “Dự án BigBike là gì?” và cung cấp context/components/capabilities tổng quan. |
| `BUSINESS_PROCESS.md` | File hiện tại, trả lời “Các quy trình nghiệp vụ diễn ra như thế nào?”. |
| `MODULE_CATALOG.md` | Nên liệt kê từng module, owner, UI support, API support, data support, test evidence. |
| `WORKFLOW_OVERVIEW.md` | Nên mô tả workflow end-to-end kỹ thuật hơn process, nối UI -> API -> service -> DB -> notification. |
| `BUSINESS_RULES.md` | Nên tách luật nghiệp vụ chi tiết: checkout, payment, order transition, return, inventory, coupon. |
| `STATE_MACHINES.md` | Nên định nghĩa trạng thái và transition hợp lệ cho product, order, payment, return, content, fulfillment. |
| `ACCEPTANCE_CRITERIA.md` | Nên định nghĩa tiêu chí hoàn thành theo process/module. |
| `API_CONTRACT.md` | Nên mô tả request/response contract giữa FE/BE hoặc reference OpenAPI. |
| `DATA_CONTRACT.md` | Nên định nghĩa shape dữ liệu thống nhất giữa web/admin/mobile/backend. |
| `PERMISSION_MATRIX.md` | Nên map role -> permission -> route/action/API. |
| `TRACEABILITY_MATRIX.md` | Nên nối process -> module -> feature -> API -> data -> tests. |

## Audit Notes

Documentation này được tạo bằng thao tác đọc/inspect repository qua GitHub connector. Không chạy migration, seed, deploy, refactor hoặc command có side effect. Không sửa business logic hoặc source code ứng dụng.
