# BigBike Workflow Overview

## 1. Document Purpose

File này mô tả các workflow end-to-end chính của BigBike, tức là các luồng nghiệp vụ chạy xuyên qua nhiều phần của hệ thống như public web, admin portal, backend API, database, media storage, email/websocket và các integration nếu có.

File này giúp business user, PM, BA, tester, developer mới và AI agent hiểu:

- Một nghiệp vụ bắt đầu từ đâu.
- Đi qua app/module nào.
- Backend/database/integration tham gia ra sao.
- Kết quả cuối cùng là gì.
- Workflow nào đã có evidence trong repo.
- Workflow nào còn thiếu hoặc cần verify.

Giới hạn:

- Không phải API contract.
- Không phải database schema.
- Không phải architecture detail.
- Không nhồi request/response chi tiết.
- Không nhồi schema/entity field chi tiết.
- Không khẳng định workflow `DONE` hoặc production-ready nếu chưa có build/test/runtime evidence hiện tại.
- Không chứa secret, token, password, private key hoặc env value nhạy cảm.

File này dùng làm nền cho:

- `ACCEPTANCE_CRITERIA.md`
- `API_FLOW_MAP.md`
- `TRACEABILITY_MATRIX.md`
- `BUSINESS_RULES.md`
- `STATE_MACHINES.md`

## 2. Workflow Status Labels

| Label | Meaning |
|---|---|
| `CONFIRMED_FROM_CODE` | Đã thấy evidence trực tiếp trong source/config/docs. |
| `INFERRED_FROM_STRUCTURE` | Suy luận hợp lý từ route/folder/API naming nhưng chưa đủ evidence đầy đủ. |
| `PARTIAL` | Workflow có một phần UI/API/model/service nhưng chưa đủ end-to-end. |
| `NEEDS_VERIFICATION` | Cần kiểm tra thêm bằng code review sâu hơn, build/test/runtime hoặc business confirmation. |
| `NOT_FOUND_IN_REPO` | Chưa thấy trong repo hiện tại. |
| `MISSING_EVIDENCE` | Có claim hoặc nhu cầu business nhưng chưa tìm được evidence rõ. |

## 3. Workflow Summary Map

| Workflow | Start Point | End Point | Primary Actors | Systems Involved | Status | Evidence |
|---|---|---|---|---|---|---|
| Product Publish Workflow | Admin tạo/sửa sản phẩm. | Product hiển thị public listing/detail nếu đủ điều kiện. | Admin, Shop Manager, System, Guest/Customer. | Admin portal, backend catalog/admin APIs, DB, media storage, public web. | `CONFIRMED_FROM_CODE`; public filtering `NEEDS_VERIFICATION` | `AdminCatalogController`, `CatalogController`, `bigbike-web/lib/utils/routes.ts`, `CheckoutService` |
| Customer Browsing Workflow | Guest vào homepage/public web. | Guest mở product/content/contact/cart/checkout path. | Guest, Customer. | Public web, backend public APIs, SEO renderer. | `CONFIRMED_FROM_CODE` | `bigbike-web/app/page.tsx`, `bigbike-web/lib/utils/routes.ts`, `CatalogController`, `ContentController`, `PublicSearchController` |
| Cart / Checkout / Order Creation Workflow | Guest/customer có cart hoặc quick-buy intent. | Order created, stock decremented, notification triggered. | Guest, Customer, System, Admin. | Public web/mobile, checkout/cart APIs, DB, inventory, email, websocket. | `CONFIRMED_FROM_CODE` | `CartController`, `CheckoutController`, `CheckoutService`, `PHASE_1F_CHECKOUT_API_REPORT.md` |
| Admin Order Processing Workflow | Admin mở order list/detail. | Order/payment/refund/note/status updated and audited. | Admin, Shop Manager, System, Customer. | Admin portal, backend order service, DB, audit, email, websocket. | `CONFIRMED_FROM_CODE`; fulfillment tracking `NEEDS_VERIFICATION` | `AdminOrderController`, `AdminOrderService`, `bigbike-admin/src/lib/adminApi.js` |
| Payment Handling Workflow | Checkout creates payment record or admin updates payment. | Payment status updated; order paid/refunded state reflected. | Customer, Admin, System. | Checkout/order service, payment records, admin order module. | `CONFIRMED_FROM_CODE` for COD/BACS/manual; external provider `NOT_FOUND_IN_REPO` | `CheckoutService`, `AdminOrderService` |
| Shipping / Fulfillment Workflow | Admin configures shipping or customer selects method. | Shipping item/cost saved on order; carrier tracking not confirmed. | Admin, Customer, System. | Admin shipping, checkout service, DB. | `PARTIAL` | `AdminShippingController`, `CheckoutService` |
| Inventory Workflow | Product/variant stock exists or admin adjusts stock. | Stock state/movement updated by checkout/cancel/return/manual adjustment. | Admin, Shop Manager, System. | Inventory API/service, product/variant DB, order/return services. | `CONFIRMED_FROM_CODE`; serial flow `NEEDS_VERIFICATION` | `AdminInventoryController`, `CheckoutService`, `AdminOrderService`, `AdminReturnService` |
| Return / Refund Workflow | Customer creates return or admin opens return/refund. | Return status/refund/stock restore updated. | Customer, Admin, System, Email Service. | Customer order API, admin return/order API, DB, inventory, notification. | `CONFIRMED_FROM_CODE` | `CustomerOrderController`, `AdminReturnController`, `AdminReturnService`, `AdminOrderService` |
| Media Management Workflow | Admin uploads media. | Media stored/listed/updated/deleted/restored and usable by product/content. | Admin, Editor, Author, System, MinIO. | Admin media API, MinIO storage, DB, product/content usage. | `CONFIRMED_FROM_CODE`; public URL/CDN runtime `NEEDS_VERIFICATION` | `AdminMediaController`, `MinioConfig`, `docker-compose.yaml` |
| Content / SEO Publishing Workflow | Admin/editor creates or updates content/page/SEO. | Content visible on public web; SEO metadata rendered where supported. | Admin, Editor, Author, SEO Editor, Guest. | Admin content API, public content API, public web SEO renderer, redirect tooling. | `CONFIRMED_FROM_CODE`; SEO migration coverage `NEEDS_VERIFICATION` | `AdminContentController`, `ContentController`, `bigbike-web/app/page.tsx`, `InternalRedirectController` |
| User / Role / Permission Workflow | Super Admin/Admin creates user or updates role/permissions. | Admin user/role changed and enforced by backend permission checks. | Super Admin, Admin, System. | Admin users/roles APIs, backend security/RBAC, audit log. | `CONFIRMED_FROM_CODE`; production auth/UI guard `NEEDS_VERIFICATION` | `AdminAdminUsersController`, `AdminAdminUsersService`, `AdminRolesController`, `AdminRolePermissions`, `SecurityConfig` |
| Settings / Configuration Workflow | Admin changes settings/menu/coupon/shipping/etc. | Public/admin behavior reads updated configuration. | Admin, Super Admin, System, Guest. | Admin settings/menu/coupon APIs, public settings/menu APIs, public web. | `CONFIRMED_FROM_CODE`; coupon docs drift `NEEDS_VERIFICATION` | `AdminSettingsController`, `PublicSettingsController`, `AdminMenuController`, `PublicMenuController`, `AdminCouponController`, `PHASE_1J...` |
| Reporting / Dashboard Workflow | Admin opens dashboard/report/export. | Analytics/export data returned. | Admin, Manager, System. | Admin dashboard/report APIs, order/customer/product/inventory data. | `CONFIRMED_FROM_CODE`; metric semantics `NEEDS_VERIFICATION` | `AdminDashboardController`, `AdminReportController`, `AdminInventoryController` |
| Notification Workflow | Event occurs: order created/status changed/return changed. | Email service called and/or admin websocket event pushed. | System, Admin, Customer, Email Service. | Backend notification service, mail config, websocket service. | `CONFIRMED_FROM_CODE`; delivery runtime `NEEDS_VERIFICATION` | `CheckoutService`, `AdminOrderService`, `AdminReturnService`, `OrderNotificationService`, `AdminOrderWsService` |
| Payment Webhook Workflow | Payment provider calls callback. | Payment auto-updated. | Payment Provider, System. | Payment provider/webhook. | `NOT_FOUND_IN_REPO` | No provider webhook evidence found. |
| Shipping Provider Workflow | Carrier creates waybill/tracking/status. | Shipment/tracking updated. | Shipping Provider, Admin, System. | Carrier integration. | `NOT_FOUND_IN_REPO` | No provider-specific shipping evidence found. |
| Backup / Restore Workflow | Ops triggers backup/restore. | Data restored/backed up. | Ops/Admin/System. | DB/storage ops. | `NOT_FOUND_IN_REPO` | No backup/restore workflow evidence found. |

## 4. Product Publish Workflow

### Purpose

Đưa sản phẩm từ dữ liệu nội bộ/admin ra public website/mobile để khách có thể browse, xem chi tiết và mua hàng.

### Start Point

Admin hoặc role có quyền catalog/product tạo hoặc chỉnh sửa sản phẩm trong admin portal.

### End Point

Sản phẩm được lưu vào backend/database và có thể hiển thị trên public listing/detail nếu đủ điều kiện publish/visibility.

### Primary Actors

- Admin
- Super Admin
- Shop Manager
- System
- Guest / Customer ở phía public web

### Systems Involved

- Admin portal
- Backend admin catalog APIs/services
- Database product/category/brand/media-related entities
- Media storage nếu sản phẩm dùng media
- Public web listing/detail
- SEO metadata/rendering nếu product/page có SEO fields

### Main Flow

1. Admin mở module Products trong admin portal.
2. Admin tạo hoặc chỉnh sửa product data.
3. Admin bổ sung category, brand, media, gallery, specifications, variants hoặc SEO fields nếu UI/API hỗ trợ.
4. Backend admin catalog controller/service validate input và permission.
5. Backend lưu product/category/brand-related data.
6. Admin cập nhật publish status nếu cần.
7. Public catalog APIs expose product/category/brand data.
8. Public web/mobile dùng route listing/detail để render product.
9. Checkout/quick-buy chỉ cho phép product hợp lệ theo business rule, ví dụ quick-buy yêu cầu product `PUBLISHED`.

### Data / State Impact

- Product record.
- Publish status.
- Category/brand relation.
- Product media/gallery/specification/variant data nếu có.
- Product visibility trên public web.
- Product SEO metadata nếu có.

### Related Modules

- Products
- Categories
- Brands
- Media
- SEO
- Public Product Listing
- Public Product Detail

### Related Permissions

- `products.read`
- `products.update`
- `catalog.read`
- `catalog.update`

Chi tiết permission action/API để `PERMISSION_MATRIX.md`, không nhét vào đây như một tấm bảng phạt nguội.

### Expected Output

- Admin có thể tạo/sửa/publish/soft-delete sản phẩm nếu có quyền.
- Public web có thể hiển thị product listing/detail.
- Product chưa đủ điều kiện publish không nên xuất hiện public.

### Evidence

- `bigbike-admin/README.md`
- `bigbike-admin/src/lib/adminApi.js`
- `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/admin/AdminCatalogController.java`
- `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/catalog/CatalogController.java`
- `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/checkout/CheckoutService.java`
- `bigbike-web/lib/utils/routes.ts`

### Status

`CONFIRMED_FROM_CODE`

### Needs Verification

- Public catalog read service should be audited to confirm exact publish/visibility filtering.
- Product SEO metadata per PDP/category/brand needs deeper UI audit.
- UI loading/empty/error/submitting states for admin product form.
- Fresh build/test/runtime status.

## 5. Customer Browsing Workflow

### Purpose

Cho guest/customer khám phá sản phẩm và nội dung trước khi thực hiện mua hàng hoặc liên hệ.

### Start Point

Guest/customer vào homepage hoặc public route.

### End Point

Guest/customer mở product detail, article/page, contact, cart hoặc checkout path.

### Primary Actors

- Guest / Visitor
- Customer
- System

### Systems Involved

- Public web
- Flutter mobile app routes
- Public catalog/content/search APIs
- Public settings/menu/slider/home video APIs
- SEO metadata renderer

### Main Flow

1. Guest vào homepage.
2. Public web fetch settings, sliders, categories, featured products, articles, brands, home videos.
3. Guest browse category/brand/product listing.
4. Guest search/filter nếu cần.
5. Guest mở product detail.
6. Public web/mobile render price, image/media, content/specs/stock-related data nếu có.
7. Guest chuyển tiếp sang contact, cart, checkout, quick-buy hoặc đọc content.

### Data / State Impact

- Mostly read-only.
- Có thể tạo contact submission, review submission hoặc cart state nếu user tiếp tục hành động.

### Related Modules

- Homepage
- Catalog
- Search
- Product Detail
- Category/Brand
- Content/SEO
- Menu/Settings
- Contact
- Cart

### Related Permissions

- Public read endpoints are permitAll where configured.
- Admin/customer protected APIs are restricted by security config.

### Expected Output

- Public pages render product/content/menu/SEO data.
- Guest/customer có đường đi rõ đến product/cart/checkout/contact.

### Evidence

- `bigbike-web/app/page.tsx`
- `bigbike-web/lib/utils/routes.ts`
- `bigbike_mobile/lib/core/router/app_router.dart`
- `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/catalog/CatalogController.java`
- `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/content/ContentController.java`
- `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/search/PublicSearchController.java`
- `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/config/SecurityConfig.java`

### Status

`CONFIRMED_FROM_CODE`

### Needs Verification

- UI error/empty/loading behavior.
- Search ranking/scoring and filter semantics.
- SEO metadata completeness beyond homepage.

## 6. Cart / Checkout / Order Creation Workflow

### Purpose

Chuyển nhu cầu mua hàng của guest/customer thành order chính thức trong hệ thống.

### Start Point

Customer/guest có sản phẩm trong cart hoặc dùng quick-buy từ product.

### End Point

Order được tạo, stock bị trừ, payment record/shipping item/order notes được lưu và notification được trigger.

### Primary Actors

- Guest / Visitor
- Customer
- System
- Admin nhận thông báo đơn mới

### Systems Involved

- Public web/mobile cart/checkout routes
- Cart API/service
- Checkout API/service
- Product/variant stock repositories
- Order/payment/shipping/address/note repositories
- Inventory stock movement
- Email notification service
- Admin websocket service

### Main Flow

1. Guest/customer thêm sản phẩm vào cart hoặc chọn quick-buy.
2. Customer mở cart/checkout.
3. Customer nhập billing/shipping address.
4. Customer chọn payment method `COD` hoặc `BACS`.
5. Customer chọn shipping method hoặc hệ thống auto-select nếu chỉ có một enabled method.
6. Backend validate cart/items/address/payment/shipping.
7. Backend sync price và validate stock.
8. Backend tạo order.
9. Backend tạo line items, addresses, shipping item, payment record, applied coupons nếu cart có coupon, system note.
10. Backend decrement product/variant stock và ghi stock movement.
11. Backend mark cart `CONVERTED`.
12. Backend trigger order confirmation/admin notification and admin websocket event.
13. Customer nhận order summary/order key/status.

### Alternative / Error Flow

- Empty cart → validation error.
- Invalid phone/email/address → validation error.
- Unsupported payment method → validation error.
- Missing/disabled shipping method → validation error.
- Product unpublished/unavailable/out-of-stock/insufficient stock → conflict.
- Price changed → price changes returned in summary.

### Data / State Impact

- Cart status becomes `CONVERTED`.
- Order and related line items/addresses/shipping/payment/note records are created.
- Stock quantity decreases.
- Stock movement `OUT` is recorded.
- Payment status starts as `UNPAID`; payment record status starts as `PENDING`.
- COD order status starts as `PROCESSING`; BACS order status starts as `ON_HOLD`.

### Related Modules

- Cart
- Checkout
- Product/Catalog
- Inventory
- Orders
- Payment
- Shipping
- Notification

### Related Permissions

- Guest/customer checkout endpoints are public/customer accessible in security config.
- Customer-specific data uses `ROLE_CUSTOMER` for protected account/order APIs.

### Expected Output

- Order created with consistent totals.
- Stock reflected immediately.
- Admin/customer notification hooks are triggered.

### Evidence

- `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/cart/CartController.java`
- `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/checkout/CheckoutController.java`
- `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/checkout/CheckoutService.java`
- `bigbike-backend/docs/PHASE_1F_CHECKOUT_API_REPORT.md`
- `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/config/SecurityConfig.java`

### Status

`CONFIRMED_FROM_CODE`

### Needs Verification

- Frontend duplicate-submit prevention and UI submitting state.
- Coupon behavior vs older docs drift.
- Cart merge after login if required.
- Fresh integration tests/runtime.

## 7. Admin Order Processing Workflow

### Purpose

Cho admin/shop manager xử lý đơn hàng sau khi order được tạo.

### Start Point

Admin mở order list hoặc order detail trong admin portal.

### End Point

Order status/payment status/refund/note được cập nhật, audit log được ghi, notification/websocket được trigger khi phù hợp.

### Primary Actors

- Admin
- Super Admin
- Shop Manager
- System
- Customer nhận notification nếu status/note customer-visible

### Systems Involved

- Admin portal
- Admin order APIs
- Order service
- Payment records
- Stock/Inventory
- Audit log
- Email notification
- Admin websocket

### Main Flow

1. Admin xem danh sách đơn, filter theo status/payment/q/date.
2. Admin mở chi tiết đơn.
3. Backend trả order detail gồm line items, addresses, shipping, payments, notes, applied coupons.
4. Admin xem allowed transitions.
5. Admin cập nhật order status nếu transition hợp lệ.
6. Backend set timestamp như completedAt/cancelledAt nếu phù hợp.
7. Nếu order bị cancel/refund, backend restore stock.
8. Admin cập nhật payment status nếu cần.
9. Admin tạo refund nếu order đã paid/partially paid và refund amount hợp lệ.
10. Admin thêm note internal/customer-visible.
11. Backend ghi audit log.
12. Backend gửi email/websocket event nếu phù hợp.

### Alternative / Error Flow

- Invalid order status → validation error.
- Invalid order transition → conflict.
- Invalid payment status transition → conflict.
- Refund without paid/partially paid status → conflict.
- Refund amount > refundable amount → validation error.
- Same status/payment status → idempotent return current state.

### Data / State Impact

- Order status.
- Payment status / paidAmount / refundAmount / timestamps.
- Payment record status/refund data.
- Order notes.
- Audit log.
- Stock movement/restored stock on cancel/refund.

### Related Modules

- Orders
- Payment
- Inventory
- Notification
- Audit Log
- Reports

### Related Permissions

- `orders.read`
- `orders.write`

### Expected Output

- Order lifecycle is controlled by backend transitions.
- Invalid transitions are blocked.
- Audit and notification side effects are recorded/triggered.

### Evidence

- `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/admin/AdminOrderController.java`
- `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminOrderService.java`
- `bigbike-admin/src/lib/adminApi.js`

### Status

`CONFIRMED_FROM_CODE`

### Needs Verification

- Fulfillment/tracking workflow is not fully confirmed.
- Admin UI display of allowed transitions/actions.
- Current test coverage for all transitions.

## 8. Payment Handling Workflow

### Purpose

Theo dõi và cập nhật trạng thái thanh toán của order.

### Start Point

Checkout creates payment record, or admin updates payment status after receiving payment information.

### End Point

Order payment status/payment record reflects paid/partial/refunded/failed/cancelled state.

### Primary Actors

- Customer
- Admin / Shop Manager
- System
- Payment Provider only if future integration exists

### Systems Involved

- Checkout service
- Payment entity/repository
- Admin order service
- Notification/audit where applicable

### Main Flow

1. Checkout creates payment record with provider `INTERNAL` and status `PENDING`.
2. Order payment status starts as `UNPAID`.
3. COD order starts `PROCESSING`; BACS order starts `ON_HOLD`.
4. Admin updates payment status manually.
5. Backend validates allowed payment transition.
6. For `PAID`, backend sets paid amount and paidAt; payment record becomes succeeded when found.
7. For `PARTIALLY_PAID`, backend validates paidAmount between zero and order total.
8. For `UNPAID`, paid amount must be zero and paidAt reset.
9. For refund, admin uses refund command and backend updates refund amount/payment status.

### Alternative / Error Flow

- Unsupported payment method at checkout → validation error.
- Unknown payment status → validation error.
- Invalid transition → conflict.
- Invalid partial paid amount → validation error.
- Refund amount exceeds max refundable → validation error.

### Data / State Impact

- Order.paymentStatus.
- Order.paidAmount / paidAt.
- Order.refundAmount / refundedAt / refundReason.
- Payment.status / paidAt / refundAmount.
- Audit log and websocket events.

### Related Modules

- Checkout
- Orders
- Payment
- Refund
- Notification
- Audit

### Related Permissions

- `orders.write` for admin payment updates/refunds.

### Expected Output

- Manual/internal payment state is consistent with order state.
- External provider workflow is not assumed.

### Evidence

- `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/checkout/CheckoutService.java`
- `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminOrderService.java`
- `bigbike-backend/docs/PHASE_1F_CHECKOUT_API_REPORT.md`

### Status

`CONFIRMED_FROM_CODE` for internal/manual COD/BACS payment handling.

### Needs Verification

- External gateway/QR/bank reconciliation not found.
- Whether BACS instruction UI exists and production bank info config is complete.
- Payment webhook workflow is `NOT_FOUND_IN_REPO`.

## 9. Shipping / Fulfillment Workflow

### Purpose

Cấu hình phương thức giao hàng và gắn shipping method/cost vào order checkout.

### Start Point

Admin configures shipping zones/methods, or customer selects shipping method during checkout.

### End Point

Order has shipping item/method/cost. Carrier tracking/waybill workflow is not confirmed.

### Primary Actors

- Admin
- Customer
- System
- Shipping Provider not confirmed

### Systems Involved

- Admin shipping APIs
- Checkout service
- Shipping method repository
- Order shipping item

### Main Flow

1. Admin creates/updates shipping zones.
2. Admin creates/updates shipping methods with cost/min order/free shipping threshold.
3. Customer chooses shipping method during checkout.
4. Backend validates shipping method ID and enabled status.
5. If only one enabled method exists and no method is provided, backend auto-selects it.
6. Backend calculates shipping cost, including free shipping threshold.
7. Backend stores order shipping item with method title/code/cost.

### Alternative / Error Flow

- Invalid shipping method UUID → validation error.
- Shipping method not found → validation error.
- Disabled shipping method → validation error.
- Multiple methods but missing shippingMethodId → validation error.

### Data / State Impact

- Shipping zones/methods.
- Order shipping item.
- Order shipping amount.

### Related Modules

- Shipping
- Checkout
- Orders

### Related Permissions

- `shipping.read`
- `shipping.write`

### Expected Output

- Checkout total includes shipping cost.
- Order detail shows shipping item.

### Evidence

- `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/admin/AdminShippingController.java`
- `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/checkout/CheckoutService.java`

### Status

`PARTIAL`

### Needs Verification

- Third-party carrier integration is not found.
- Shipment/tracking/waybill lifecycle is not confirmed.
- Fulfillment status transition workflow needs deeper audit.

## 10. Inventory Workflow

### Purpose

Đảm bảo stock thay đổi đúng khi checkout, cancel/refund, return hoặc admin adjust.

### Start Point

Product/variant stock exists, checkout consumes stock, admin adjusts stock, or return/cancel/refund restores stock.

### End Point

Stock quantity/stock state/movement history reflects the business event.

### Primary Actors

- Admin / Shop Manager
- System
- Customer indirectly through checkout/return

### Systems Involved

- Admin inventory APIs
- Product/variant repositories
- Checkout service
- Order service
- Return service
- Stock movement repository

### Main Flow

1. Admin views stock list/summary/movements.
2. Admin adjusts stock manually if needed.
3. During checkout, backend validates stock and locks/reads product/variant.
4. Backend decrements stock after order is created.
5. Backend records stock movement `OUT` for variant stock flow.
6. If order is cancelled/refunded, backend restores stock where supported.
7. If return is completed, backend restores stock and records movement `IN`.
8. Inventory policy recomputes stock state such as low/out/in stock.

### Alternative / Error Flow

- Insufficient stock at checkout → conflict.
- Product force out of stock or out-of-stock state → conflict.
- Variant unavailable → conflict.

### Data / State Impact

- Product stock quantity/state.
- Variant quantity/state.
- Stock movement records.
- Stock state recomputation.

### Related Modules

- Products
- Inventory
- Checkout
- Orders
- Returns

### Related Permissions

- `products.read`
- `products.update`

### Expected Output

- Stock decreases when order is created.
- Stock restores when cancellation/refund/return flow says so.
- Admin can inspect movement history.

### Evidence

- `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/admin/AdminInventoryController.java`
- `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/checkout/CheckoutService.java`
- `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminOrderService.java`
- `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminReturnService.java`

### Status

`CONFIRMED_FROM_CODE`

### Needs Verification

- Serial-level inventory workflow.
- Stock movement for product-level non-variant stock restore may need deeper audit.
- Inventory UI behavior and tests.

## 11. Media Management Workflow

### Purpose

Cho admin/editor/author upload và quản lý media assets để dùng trong product/content/homepage.

### Start Point

Admin uploads media from admin portal/media module.

### End Point

Media is stored, listed, editable, deletable/restorable and available for product/content usage where referenced.

### Primary Actors

- Admin
- Editor
- Author
- System
- Media Storage / MinIO

### Systems Involved

- Admin media API
- Backend media service
- MinIO/S3-compatible storage
- Database media metadata
- Product/content modules if they reference media

### Main Flow

1. Admin uploads file as multipart form data.
2. Backend checks permission `media.write`.
3. Backend service stores media and metadata.
4. Admin lists/filter/searches media.
5. Admin opens media detail.
6. Admin updates metadata such as alt text/status if supported.
7. Admin soft-deletes, hard-deletes or restores media.
8. Product/content/homepage can reference media URLs/assets.

### Data / State Impact

- Media asset record.
- Storage object in MinIO/S3-compatible storage.
- Metadata such as alt text/status/provider.

### Related Modules

- Media
- Products
- Content
- Homepage
- SEO

### Related Permissions

- `media.read`
- `media.write`

### Expected Output

- Media can be uploaded and managed by authorized admin roles.
- Media can support product/content rendering.

### Evidence

- `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/admin/AdminMediaController.java`
- `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/config/MinioConfig.java`
- `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/config/MinioProperties.java`
- `docker-compose.yaml`

### Status

`CONFIRMED_FROM_CODE`

### Needs Verification

- Public URL/CDN behavior in production.
- File validation/security policy details.
- UI attachment flow from product/content forms.

## 12. Content / SEO Publishing Workflow

### Purpose

Cho admin/editor/SEO editor tạo, chỉnh sửa, publish và render content/pages/SEO assets trên public web.

### Start Point

Admin/editor creates or updates article/page/content/SEO/redirect data.

### End Point

Public web renders content and metadata; redirects preserve legacy URL continuity where configured.

### Primary Actors

- Admin
- Editor
- Author
- SEO Editor
- Guest / Customer
- System

### Systems Involved

- Admin content APIs
- Public content APIs
- Public web route renderer
- SEO metadata/canonical/JSON-LD where implemented
- Redirect/migration tooling

### Main Flow

1. Admin/editor opens content module.
2. Admin creates or updates article/page data.
3. Backend validates content type, ID, publish status and permissions.
4. Backend stores content.
5. Public content APIs serve published content.
6. Public web renders articles/pages/home content.
7. Homepage renders metadata/JSON-LD and SEO content.
8. Redirect tooling handles legacy URLs where configured.

### Alternative / Error Flow

- Invalid content type/publish status/id → validation error.
- Missing permission → forbidden.
- Redirect coverage gaps → needs SEO audit.

### Data / State Impact

- Article/page content.
- Publish status.
- SEO metadata/canonical/redirect records where supported.
- Public website visibility.

### Related Modules

- Content
- SEO
- Redirects
- Media
- Public Web
- Settings/Menu

### Related Permissions

- `content.read`
- `content.update`
- `redirects.read`
- `redirects.write`

### Expected Output

- Content can be managed internally and rendered publicly.
- SEO metadata/redirect support exists, but full SEO migration completeness requires separate audit.

### Evidence

- `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/admin/AdminContentController.java`
- `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/content/ContentController.java`
- `bigbike-web/app/page.tsx`
- `bigbike-web/lib/utils/routes.ts`
- `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/internal/InternalRedirectController.java`
- `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/migration/wordpress/**`

### Status

`CONFIRMED_FROM_CODE`

### Needs Verification

- Sitemap/robots workflow.
- Per-product/per-page SEO metadata completeness.
- Redirect coverage from legacy WordPress.
- Content UI rich editor behavior.

## 13. User / Role / Permission Workflow

### Purpose

Quản lý admin users/roles/permissions và enforce access control cho admin modules.

### Start Point

Super Admin/Admin with appropriate permission creates/updates admin user or role.

### End Point

Role/user changes are saved, audit logged and backend permission checks enforce access.

### Primary Actors

- Super Admin
- Admin
- System

### Systems Involved

- Admin users API
- Admin roles API
- RBAC permission map/service
- Security config/filters
- Audit log
- Admin portal route/action behavior

### Main Flow

1. Admin opens admin users/roles area.
2. Admin lists users or roles.
3. Admin creates user with email, displayName, role and password.
4. Backend validates email, role, password length and duplicate email.
5. Admin updates user displayName/status/password/role.
6. Backend guards against self-deactivation and Super Admin dangerous demotion.
7. Admin updates role permissions or creates/deletes custom role.
8. Backend permission checks apply to admin endpoints via `requirePermission`.
9. Audit logs are written for admin user changes and role updates where implemented.

### Alternative / Error Flow

- Invalid role/status/email/password → conflict.
- Duplicate email → conflict.
- Admin deactivates own account → conflict.
- Super Admin self-demotion → conflict.
- Demoting last active Super Admin → conflict.
- Missing permission → forbidden.

### Data / State Impact

- Admin user record.
- Admin role/custom role record.
- Permission mapping.
- Audit logs.

### Related Modules

- Admin Users
- Roles/Permissions
- Security/RBAC
- Audit Log

### Related Permissions

- `admin-users.read`
- `admin-users.write`

### Expected Output

- Admin access can be governed by role/permission mapping.
- Backend enforces permissions, not only frontend hiding.

### Evidence

- `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/admin/AdminAdminUsersController.java`
- `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminAdminUsersService.java`
- `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/admin/AdminRolesController.java`
- `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/auth/AdminRolePermissions.java`
- `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/auth/DevAdminAuthService.java`
- `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/config/SecurityConfig.java`

### Status

`CONFIRMED_FROM_CODE`

### Needs Verification

- Production admin auth readiness.
- Frontend route/action guard behavior.
- Custom role governance.
- Full permission matrix.

## 14. Settings / Configuration Workflow

### Purpose

Cho admin cấu hình site settings, menu/navigation, coupons và các cấu hình vận hành ảnh hưởng public/admin behavior.

### Start Point

Admin opens settings/menu/coupon/shipping/config module.

### End Point

Configuration is saved and consumed by public web/backend workflows.

### Primary Actors

- Admin
- Super Admin
- Editor for menu/slider/content-like areas depending permissions
- System
- Guest when public config affects UI

### Systems Involved

- Admin settings/menu/coupon APIs
- Public settings/menu APIs
- Public web homepage/navigation
- Checkout/cart coupon behavior if active

### Main Flow

1. Admin reads existing settings/menu/coupons.
2. Admin updates setting/menu/coupon data.
3. Backend validates permission and business constraints.
4. Backend stores updated config.
5. Public settings/menu endpoints expose public-safe config.
6. Public web uses settings/menu for homepage/navigation/SEO/content.
7. Checkout may use cart coupon data to apply discounts, but docs/code drift requires verification.

### Data / State Impact

- Settings values.
- Menu/menu items.
- Coupon records/status/usage count where applied.
- Public web rendered content/navigation.

### Related Modules

- Settings
- Menus
- Coupons
- Public Web
- Checkout
- SEO

### Related Permissions

- `settings.read`, `settings.write`
- `menus.read`, `menus.write`
- `coupons.read`, `coupons.write`

### Expected Output

- Public-facing configuration updates are reflected on public web where endpoints are consumed.
- Sensitive settings should not leak to public endpoint.

### Evidence

- `bigbike-backend/docs/PHASE_1J_ADMIN_SETTINGS_MENU_COUPON_API_REPORT.md`
- `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/admin/AdminSettingsController.java`
- `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/settings/PublicSettingsController.java`
- `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/admin/AdminMenuController.java`
- `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/menu/PublicMenuController.java`
- `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/admin/AdminCouponController.java`
- `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/checkout/CheckoutService.java`
- `bigbike-web/app/page.tsx`

### Status

`CONFIRMED_FROM_CODE`

### Needs Verification

- Coupon integration docs/code drift: older Phase 1J report says coupon-cart integration deferred, while current CheckoutService records applied coupons.
- Runtime public settings sanitization.
- Admin UI validation/permission guard.

## 15. Reporting / Dashboard Workflow

### Purpose

Cho admin/manager xem số liệu vận hành và export dữ liệu orders/customers/products/inventory.

### Start Point

Admin opens dashboard or reports/export module.

### End Point

Analytics response or CSV export is returned.

### Primary Actors

- Admin
- Super Admin
- Shop Manager / Manager-like role depending permissions
- System

### Systems Involved

- Admin dashboard/report APIs
- Order/customer/product repositories/services
- Inventory export
- Admin UI chart/table/export UX

### Main Flow

1. Admin opens dashboard/report module.
2. Admin selects date/status/payment filters where supported.
3. Backend checks read permission.
4. Backend aggregates analytics or exports CSV.
5. Admin downloads or views the result.

### Data / State Impact

- Read-only for analytics/export.
- Export file generated in response.

### Related Modules

- Reports
- Dashboard
- Orders
- Customers
- Products
- Inventory

### Related Permissions

- `orders.read`
- `customers.read`
- `products.read`

### Expected Output

- Admin receives analytics data or CSV export.

### Evidence

- `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/admin/AdminDashboardController.java`
- `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/admin/AdminReportController.java`
- `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/admin/AdminInventoryController.java`
- `bigbike-admin/package.json`

### Status

`CONFIRMED_FROM_CODE`

### Needs Verification

- Metric definitions and correctness.
- UI visual/chart behavior.
- Export encoding/large data behavior.

## 16. Notification Workflow

### Purpose

Trigger email and/or realtime admin events when business events happen.

### Start Point

Business event occurs: order created, order status changed, payment status changed, refund created, return status changed, order note added.

### End Point

Email service is called and/or websocket event pushed to admin UI.

### Primary Actors

- System
- Email Service
- Admin
- Customer

### Systems Involved

- OrderNotificationService
- AdminOrderWsService
- Mail dependency/config
- WebSocket config/service
- Checkout/order/return services

### Main Flow

1. Checkout creates order and calls customer/admin notification methods.
2. Checkout pushes new order websocket event.
3. Admin updates order status/payment/refund/note.
4. Backend pushes order websocket events and sends customer-visible email where applicable.
5. Admin updates return status.
6. Backend sends return approved/rejected/received/refunded notifications.

### Data / State Impact

- Mostly side effects; notification delivery state/read-unread persistence is not confirmed.
- Websocket events are emitted.
- Email service is invoked.

### Related Modules

- Checkout
- Orders
- Returns
- Notification
- WebSocket
- Email

### Related Permissions

- Indirectly tied to permissions of triggering admin action.

### Expected Output

- Customer/admin receives notification if configured and delivery works.
- Admin UI can receive realtime events if subscribed.

### Evidence

- `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/checkout/CheckoutService.java`
- `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminOrderService.java`
- `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminReturnService.java`
- `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/checkout/OrderNotificationService.java`
- `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/ws/AdminOrderWsService.java`
- `bigbike-backend/pom.xml`
- `docker-compose.yaml`

### Status

`CONFIRMED_FROM_CODE`

### Needs Verification

- SMTP production deliverability.
- Template correctness.
- Websocket admin UI subscription.
- Notification persistence/read-unread workflow, if needed, not confirmed.

## 17. Cross-Workflow Dependencies

| Source Workflow | Depends On / Affects | Reason | Status |
|---|---|---|---|
| Product Publish Workflow | Customer Browsing Workflow | Public browsing depends on product/category/brand visibility and data. | `CONFIRMED_FROM_CODE` |
| Product Publish Workflow | Checkout Workflow | Checkout validates product status/stock/price from catalog. | `CONFIRMED_FROM_CODE` |
| Media Management Workflow | Product Publish / Content SEO Workflows | Product/content/homepage can reference media assets. | `INFERRED_FROM_STRUCTURE` |
| Customer Browsing Workflow | Cart / Checkout Workflow | Browsing leads to cart/quick-buy/checkout. | `CONFIRMED_FROM_CODE` |
| Cart / Checkout Workflow | Inventory Workflow | Checkout decrements stock and writes movement. | `CONFIRMED_FROM_CODE` |
| Cart / Checkout Workflow | Payment Handling Workflow | Checkout creates payment record/status. | `CONFIRMED_FROM_CODE` |
| Cart / Checkout Workflow | Shipping Workflow | Checkout resolves shipping method and cost. | `CONFIRMED_FROM_CODE` |
| Cart / Checkout Workflow | Notification Workflow | Checkout triggers email/admin websocket. | `CONFIRMED_FROM_CODE` |
| Admin Order Processing Workflow | Inventory Workflow | Cancel/refund restores stock. | `CONFIRMED_FROM_CODE` |
| Admin Order Processing Workflow | Notification Workflow | Status/payment/refund/note changes push events/emails. | `CONFIRMED_FROM_CODE` |
| Return / Refund Workflow | Inventory Workflow | Return completed restores stock. | `CONFIRMED_FROM_CODE` |
| Return / Refund Workflow | Payment Handling Workflow | Refund updates order/payment state. | `CONFIRMED_FROM_CODE` |
| Settings / Configuration Workflow | Customer Browsing Workflow | Public settings/menu affect public web content/navigation. | `CONFIRMED_FROM_CODE` |
| User / Role / Permission Workflow | All Admin Workflows | Permissions decide which internal users can execute admin actions. | `CONFIRMED_FROM_CODE` |
| Reporting / Dashboard Workflow | Orders/Products/Customers/Inventory | Reports aggregate operational data from core modules. | `CONFIRMED_FROM_CODE` |
| Payment Webhook Workflow | Payment Handling Workflow | Would automate payment updates, but not found. | `NOT_FOUND_IN_REPO` |
| Shipping Provider Workflow | Shipping/Fulfillment Workflow | Would automate waybill/tracking, but not found. | `NOT_FOUND_IN_REPO` |
| Backup / Restore Workflow | All Data Workflows | Production recovery would affect all persisted data, but not found. | `NOT_FOUND_IN_REPO` |

## 18. Workflow Completeness Checklist

Một workflow được xem là đủ để audit hoàn chỉnh khi có:

| Checklist Item | Required For | Notes |
|---|---|---|
| Start point rõ | All workflows | Ai bắt đầu, từ màn hình/API/event nào. |
| End point rõ | All workflows | Kết quả cuối cùng là gì. |
| Actor rõ | All workflows | Guest/customer/admin/system/provider. |
| UI route/screen | UI workflows | Public web/admin/mobile nếu user thao tác trực tiếp. |
| Backend API/service | Query/mutation workflows | Không xem route/menu là workflow hoàn chỉnh nếu thiếu backend. |
| Data model/state | Persistent workflows | Product/order/cart/payment/stock/media/content/user/role state. |
| Permission | Admin/internal workflows | Backend enforcement, không chỉ UI hiding. |
| Validation | Input workflows | Backend validation/business validation. |
| Alternative/error path | Critical workflows | Checkout/order/payment/return cần error path rõ. |
| Integration evidence | Payment/shipping/email/media workflows | Config không đủ, cần flow/controller/service nếu claim confirmed. |
| Test coverage | Critical workflows | Unit/integration/e2e/phase reports/fresh CI. |
| Evidence path | All workflows | Path thật trong repo. |
| Status | All workflows | Không dùng “hoàn thiện” nếu chưa có build/test/runtime evidence. |

Current audit result:

- Core backend workflows có evidence tốt: checkout, order, payment manual, inventory, return, media, RBAC, settings, reports.
- Frontend workflows có route/homepage evidence, nhưng UI state/test completeness cần audit riêng.
- External provider workflows chưa có evidence.
- Fresh build/test/runtime chưa chạy trong task này.

## 19. Missing / Not Confirmed Workflows

| Workflow | Status | Gap |
|---|---|---|
| Payment webhook workflow | `NOT_FOUND_IN_REPO` | Không thấy payment provider callback/webhook controller/service. |
| External payment gateway / QR reconciliation workflow | `NEEDS_VERIFICATION` | `BACS` exists as payment method, but provider/QR/auto reconciliation not confirmed. |
| Shipping provider workflow | `NOT_FOUND_IN_REPO` | Không thấy GHN/GHTK/ViettelPost/carrier-specific integration. |
| Fulfillment tracking workflow | `NEEDS_VERIFICATION` | Shipping method/order shipping item exists, but waybill/tracking/status lifecycle unclear. |
| Backup / restore workflow | `NOT_FOUND_IN_REPO` | Không thấy operational backup/restore docs/code. |
| Sitemap / robots workflow | `NEEDS_VERIFICATION` | SEO metadata exists; sitemap/robots not confirmed in this audit. |
| Full SEO migration workflow | `NEEDS_VERIFICATION` | Migration/redirect tooling exists, but URL coverage needs separate audit. |
| Notification read/unread/ack workflow | `NOT_FOUND_IN_REPO` | Email/websocket service calls exist, but persisted notification inbox not confirmed. |
| POS full workflow | `PARTIAL` | `AdminPosController` exists and order service has POS condition, but business E2E not documented enough. |
| Frontend admin UI permission workflow | `NEEDS_VERIFICATION` | Backend RBAC strong evidence; UI route/action guard needs dedicated audit. |
| Frontend loading/empty/error/submitting workflow | `NEEDS_VERIFICATION` | Needs UI audit; not proven by route/controller evidence. |
| Customer account full lifecycle | `CONFIRMED_FROM_CODE` for auth/order/return core; `NEEDS_VERIFICATION` for email verification/password reset/session cleanup | Customer auth/order/return exist; lifecycle hardening needs verify. |
| Coupon/discount workflow | `PARTIAL` | Admin coupon exists; CheckoutService applies cart coupons, but older report says deferred. Needs tests/runtime. |

## 20. Evidence Summary

| Workflow | Evidence Path | What It Proves | Confidence |
|---|---|---|---|
| Project context | `docs/business/PROJECT_OVERVIEW.md` | Overall apps/components/capabilities context. | High |
| Process context | `docs/business/BUSINESS_PROCESS.md` | Business process baseline and cross-process evidence. | High |
| Module context | `docs/business/MODULE_CATALOG.md` | Module/feature inventory used for workflow mapping. | High |
| Role context | `docs/business/USER_ROLES.md` | Actors/roles used in workflows. | High |
| Product publish | `AdminCatalogController`, `CatalogController`, `bigbike-admin/src/lib/adminApi.js`, `bigbike-web/lib/utils/routes.ts` | Admin catalog mutations and public catalog reads exist. | High |
| Customer browsing | `bigbike-web/app/page.tsx`, `bigbike-web/lib/utils/routes.ts`, `CatalogController`, `ContentController`, `PublicSearchController` | Public homepage/routes/catalog/content/search workflow. | High |
| Checkout/order creation | `CartController`, `CheckoutController`, `CheckoutService`, `PHASE_1F_CHECKOUT_API_REPORT.md` | Checkout from cart/quick-buy, validation, order/payment/shipping/stock/notification side effects. | High |
| Admin order processing | `AdminOrderController`, `AdminOrderService`, `bigbike-admin/src/lib/adminApi.js` | Order/payment transitions, refunds, notes, audit, stock restore, notifications. | High |
| Payment manual/internal | `CheckoutService`, `AdminOrderService` | COD/BACS, payment record, admin payment status/refund handling. | High |
| Shipping internal | `AdminShippingController`, `CheckoutService` | Shipping zones/methods and checkout shipping cost/item. | High for internal; low for provider |
| Inventory | `AdminInventoryController`, `CheckoutService`, `AdminOrderService`, `AdminReturnService` | Stock list/movements/adjust/decrement/restore. | High |
| Return/refund | `CustomerOrderController`, `AdminReturnController`, `AdminReturnService`, `AdminOrderService` | Customer return creation/list/read and admin return/refund lifecycle. | High |
| Media | `AdminMediaController`, `MinioConfig`, `MinioProperties`, `docker-compose.yaml` | Media upload/management and MinIO storage config. | High |
| Content/SEO | `AdminContentController`, `ContentController`, `bigbike-web/app/page.tsx`, `InternalRedirectController`, `migration/wordpress/**` | Content CRUD/public render and redirect/migration tooling. | High for content; medium for full SEO migration |
| RBAC/users | `AdminAdminUsersController`, `AdminAdminUsersService`, `AdminRolesController`, `AdminRolePermissions`, `SecurityConfig` | User/role/permission management and backend enforcement. | High |
| Settings/menu/coupon | `PHASE_1J_ADMIN_SETTINGS_MENU_COUPON_API_REPORT.md`, `AdminSettingsController`, `AdminMenuController`, `AdminCouponController`, `CheckoutService` | Settings/menu/coupon APIs and checkout coupon evidence with docs drift. | Medium-High |
| Reports/dashboard | `AdminDashboardController`, `AdminReportController`, `AdminInventoryController` | Analytics/export workflows. | High |
| Notification | `CheckoutService`, `AdminOrderService`, `AdminReturnService`, `OrderNotificationService`, `AdminOrderWsService`, `pom.xml`, `docker-compose.yaml` | Notification/websocket code paths. | Medium-High |
| Security | `SecurityConfig`, `DevAdminAuthService`, `AdminRolePermissions` | Public/customer/admin access boundaries and permission enforcement. | High |
| Payment provider | Audited checkout/payment/order files | No webhook/provider found. | High for not found in audited scope |
| Shipping provider | Audited shipping/checkout/order files | No carrier-specific workflow found. | High for not found in audited scope |

## 21. Known Ambiguities / Needs Verification

1. Coupon workflow has docs/code drift: Phase 1J says coupon-cart integration deferred, while current `CheckoutService` records cart coupons into orders and increments usage count.
2. Payment provider/webhook is not found. Current payment workflow is internal/manual COD/BACS.
3. Shipping provider/tracking workflow is not found. Current shipping workflow is zones/methods/cost/order shipping item only.
4. Product public filtering by publish status should be verified inside catalog read service.
5. Full fulfillment state machine is not documented enough in this workflow file.
6. Frontend UI state handling needs audit: loading/empty/error/submitting/success/permission denied.
7. Admin UI permission route/action guard needs dedicated audit. Backend permission enforcement is clearer.
8. Production admin auth readiness needs verification because dev/mock auth service explicitly guards production-like profiles.
9. Email delivery/runtime templates and SMTP config were not tested.
10. Websocket admin UI subscription was not verified.
11. Media public URL/CDN behavior needs deployment/runtime verification.
12. SEO migration coverage, sitemap and robots were not fully audited.
13. POS workflow is partial; controller exists but E2E business flow needs separate audit.
14. Backup/restore workflow is not found.
15. Build/test/runtime were not run during this documentation task. Do not treat this file as green-build evidence.

## 22. Relationship With Other Docs

| Document | Relationship |
|---|---|
| `PROJECT_OVERVIEW.md` | Tổng quan dự án: BigBike là gì. |
| `BUSINESS_PROCESS.md` | Quy trình nghiệp vụ: doanh nghiệp vận hành như thế nào. |
| `MODULE_CATALOG.md` | Module và feature: hệ thống có khu vực chức năng nào. |
| `USER_ROLES.md` | Actor/role tham gia workflow. |
| `WORKFLOW_OVERVIEW.md` | File hiện tại: workflow end-to-end xuyên web/admin/backend/database/integration. |
| `BUSINESS_RULES.md` | Nên mô tả luật nghiệp vụ chi phối workflow. |
| `STATE_MACHINES.md` | Nên mô tả trạng thái entity trong workflow: product/order/payment/return/content/etc. |
| `ACCEPTANCE_CRITERIA.md` | Nên định nghĩa tiêu chí hoàn thành workflow/module/feature. |
| `API_CONTRACT.md` | Request/response chi tiết. |
| `DATA_CONTRACT.md` | Shape dữ liệu xuyên app/layer. |
| `PERMISSION_MATRIX.md` | Quyền kỹ thuật chi tiết theo role/action/API. |
| `API_FLOW_MAP.md` | Mapping API theo workflow. |
| `TRACEABILITY_MATRIX.md` | Nối workflow/module/feature/API/DB/permission/test. |

## Audit Notes

Documentation này được tạo bằng thao tác đọc/inspect repository qua GitHub connector. Không chạy migration, seed, deploy, refactor hoặc command có side effect. Không sửa business logic hoặc source code ứng dụng.
