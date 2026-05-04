# BigBike API Flow Map

Audit date: 2026-05-04

## 1. Document Purpose

File này map các workflow nghiệp vụ end-to-end của BigBike sang API/backend flow tương ứng.

Audience chính:

- Developer cần biết một action đi qua route/API/service/entity nào.
- Tester/QA cần trace workflow để viết test case và smoke test.
- AI agent cần context để sửa code mà không phán bừa như bói API bằng bã cà phê.
- PM/BA kỹ thuật cần nhìn được flow vận hành mà không phải đọc từng controller/service.

Scope có chủ ý:

- Không thay thế `docs/API_CONTRACT.md`: file này chỉ mô tả chuỗi API theo workflow, không nhồi request/response detail.
- Không thay thế `docs/DATA_CONTRACT.md`: file này chỉ nêu data/entity bị đọc/ghi ở mức domain, không nhồi field detail.
- Không tự bịa API/flow nếu source chưa thấy evidence.
- Mỗi claim quan trọng đều có evidence path.
- Chỉ inspect repo/docs/source. Không sửa code, không refactor, không implement feature mới.

## 2. API Flow Status Labels

| Label | Meaning |
|---|---|
| `CONFIRMED_END_TO_END` | Đã thấy evidence từ frontend route/screen hoặc API client sang backend controller/service/data/security. |
| `BACKEND_ONLY` | Backend API/controller/service tồn tại nhưng chưa thấy frontend/admin/mobile call hoặc route/action rõ trong audit hiện tại. |
| `FRONTEND_ONLY` | Frontend/admin/mobile route/action/API call tồn tại nhưng chưa thấy backend endpoint tương ứng trong audit hiện tại. |
| `PARTIAL` | Có nhiều mảnh evidence nhưng chưa đủ route/action → API client → controller/service/data/permission đầy đủ. |
| `DOCUMENTED_NOT_FOUND` | Docs nói có flow/API nhưng source audit hiện tại chưa thấy. |
| `NEEDS_VERIFICATION` | Có evidence một phần nhưng cần kiểm tra thêm bằng build/test/runtime/deep code audit. |
| `NOT_FOUND_IN_REPO` | Không thấy evidence trong repo hiện tại. |

## 3. Flow Summary

| Workflow | Frontend Entry | API Sequence | Backend Services | Data Touched | Status | Evidence |
|---|---|---|---|---|---|---|
| Customer browsing | Web `/`, `/san-pham`, `/product/:slug`, `/danh-muc-san-pham`, `/brands`, `/tin-tuc`; Mobile matching routes | `GET /products`, `/categories`, `/brands`, `/articles`, `/pages`, `/search`, `/settings/public`, `/menus/{location}`, `/sliders`, `/home-videos` | Public catalog/content/search/settings/menu/slider/home-video services | Product, Category, Brand, Article, Page, Setting, Menu, Slider, HomeVideo | `CONFIRMED_END_TO_END` | `bigbike-web/lib/utils/routes.ts`; `bigbike-web/lib/api/public-api.ts`; `bigbike_mobile/lib/core/router/app_router.dart`; `bigbike_mobile/lib/core/api/api_endpoints.dart`; `docs/API_CONTRACT.md`; `SecurityConfig.java` |
| Product publish | Admin `/admin/products`, `/admin/products/new`, `/admin/products/:id`; public product/category/brand routes | Admin CRUD/publish APIs then public catalog reads | `AdminCatalogReadService`, `AdminCatalogMutationService`, public catalog read service | Product, Category, Brand, Media/Image, SEO | `CONFIRMED_END_TO_END` | `bigbike-admin/src/App.jsx`; `bigbike-admin/src/lib/adminApi.js`; `AdminCatalogController.java`; `public-api.ts`; `docs/API_CONTRACT.md` |
| Cart | Web/mobile cart route `/gio-hang` | `GET /cart`, `POST /cart/items`, `PATCH /cart/items/{id}`, `DELETE /cart/items/{id}`, `DELETE /cart/clear`, coupon APIs | `CartService`, `CartCalculator` | Cart, CartItem, CartCoupon, Product/Variant price snapshot | `CONFIRMED_END_TO_END` | `client-api.ts`; `api_endpoints.dart`; `CartController.java`; `SecurityConfig.java` |
| Checkout | Web/mobile `/thanh-toan`, order confirmation route | `GET /checkout/options`, `POST /checkout` | `CheckoutService`, `CartService`, `OrderNotificationService`, `AdminOrderWsService` | Cart, Order, OrderLineItem, OrderAddress, OrderShippingItem, Payment, OrderNote, Coupon, Product/Variant stock, StockMovement | `CONFIRMED_END_TO_END` | `client-api.ts`; `api_endpoints.dart`; `CheckoutController.java`; `CheckoutService.java`; `SecurityConfig.java` |
| Quick-buy | Web client exposes `submitQuickBuy`; mobile endpoint exists; product detail route exists | `POST /orders/quick-buy` | `CheckoutService.quickBuy` | Product/Variant, Order, OrderLineItem, Address, ShippingItem, Payment, OrderNote, Stock | `PARTIAL` | `client-api.ts`; `api_endpoints.dart`; `CheckoutController.java`; `CheckoutService.java`; product detail routes in web/mobile. Exact screen action still needs verification. |
| Order lookup | Web order confirmation/lookup utility; mobile endpoint exists | `GET /orders/lookup?orderNumber&orderKey` | `OrderLookupController`, order read service | Order, LineItem, Address, ShippingItem, Payment, Note | `CONFIRMED_END_TO_END` | `routes.ts`; `public-api.ts`; `api_endpoints.dart`; `docs/API_CONTRACT.md`; `SecurityConfig.java` |
| Customer account/auth | Web `/dang-nhap`, `/dang-ky`, `/quen-mat-khau`, `/tai-khoan`; mobile auth/account routes | Customer auth/profile APIs | `CustomerAuthController`, `CustomerController` | Customer, CustomerSession/refresh token/cookies | `CONFIRMED_END_TO_END` | `client-api.ts`; `app_router.dart`; `api_endpoints.dart`; `SecurityConfig.java`; `docs/API_CONTRACT.md` |
| Customer address | Web/mobile account address routes | `GET/POST/PATCH/DELETE /customer/addresses` | `CustomerAddressController` | CustomerAddress | `CONFIRMED_END_TO_END` | `client-api.ts`; `app_router.dart`; `api_endpoints.dart`; `SecurityConfig.java`; `docs/API_CONTRACT.md` |
| Customer order history | Web/mobile order history/detail routes | `GET /customer/orders`, `GET /customer/orders/{id}` | `CustomerOrderController`, `OrderReadService` | Order and order child data | `CONFIRMED_END_TO_END` | `client-api.ts`; `app_router.dart`; `CustomerOrderController.java`; `SecurityConfig.java` |
| Customer return | Web/mobile return route/endpoints | `GET /customer/orders/returns`, `GET /customer/orders/returns/{id}`, `POST /customer/orders/{orderId}/returns` | `CustomerOrderController`, `CustomerReturnService` | ReturnRequest, ReturnItem, Order, OrderLineItem | `CONFIRMED_END_TO_END` | `client-api.ts`; `app_router.dart`; `api_endpoints.dart`; `CustomerOrderController.java` |
| Admin product management | Admin product/category/brand screens | Admin product/category/brand CRUD/publish APIs | Admin catalog services | Product, Category, Brand, SEO, Media refs | `CONFIRMED_END_TO_END` | `App.jsx`; `adminApi.js`; `AdminCatalogController.java` |
| Admin category/brand | Admin category/brand screens | Admin category/brand list/detail/create/update/delete APIs | Admin catalog services | Category, Brand | `CONFIRMED_END_TO_END` | `App.jsx`; `adminApi.js`; `AdminCatalogController.java` |
| Admin order processing | Admin `/admin/orders`, `/admin/orders/:id` | list/detail/transitions/status/payment/note/refund APIs | `AdminOrderService` | Order, Payment, Note, AuditLog, StockMovement | `CONFIRMED_END_TO_END`; refund/list-notes client usage `BACKEND_ONLY` | `App.jsx`; `adminApi.js`; `AdminOrderController.java`; `AdminOrderService.java` |
| Payment/refund | Checkout payment method and admin order detail | Checkout creates internal payment; admin updates payment/refund | `CheckoutService`, `AdminOrderService` | Payment, Order payment fields, AuditLog, Note | Manual/internal `CONFIRMED_END_TO_END`; provider webhook `NOT_FOUND_IN_REPO` | `CheckoutService.java`; `AdminOrderService.java`; `AdminOrderController.java`; `docs/API_CONTRACT.md` |
| Shipping config/checkout | Admin `/admin/shipping`, checkout route/options | Admin shipping zone/method APIs; `GET /checkout/options`; checkout stores shipping item | `AdminShippingService`, `CheckoutService` | ShippingZone, ShippingMethod, OrderShippingItem, Order.shippingAmount | `PARTIAL` | `App.jsx`; `docs/API_CONTRACT.md`; `CheckoutService.java`. Carrier integration not found. |
| Inventory | Admin `/admin/inventory`; checkout/order/return side effects | Inventory list/summary/movement/export/adjust APIs; checkout/order/return stock mutation | `AdminInventoryService`, `CheckoutService`, `AdminOrderService`, `AdminReturnService` | Product stock, Variant stock, StockMovement | `CONFIRMED_END_TO_END` | `App.jsx`; `AdminInventoryController.java`; `CheckoutService.java`; `AdminOrderService.java`; `AdminReturnController.java` |
| Return/refund admin | Admin `/admin/returns`; admin order refund | Return list/detail/status APIs; order refund API | `AdminReturnService`, `AdminOrderService` | ReturnRequest, Order, Payment, StockMovement, Audit/Note | `CONFIRMED_END_TO_END`; standalone refund client button needs verification | `App.jsx`; `AdminReturnController.java`; `AdminOrderController.java`; `AdminOrderService.java` |
| Media upload | Admin `/admin/media` | upload/list/detail/update/delete/restore APIs | Media service, MinIO/S3 adapter | MediaAsset, object storage | `CONFIRMED_END_TO_END` | `App.jsx`; `adminApi.js`; `docs/API_CONTRACT.md`; `docs/DATA_CONTRACT.md`; `MinioConfig.java` |
| Content/SEO publish | Admin content/redirect/menu/slider/home-video routes; public content/page routes | Admin content CRUD + redirects; public article/page/menu/settings reads | Content services, redirect services | Article, Page, SEO metadata, Redirect, Menu, Slider, HomeVideo | `CONFIRMED_END_TO_END`; sitemap/robots/migration coverage `NEEDS_VERIFICATION` | `App.jsx`; `adminApi.js`; `public-api.ts`; `routes.ts`; `docs/API_CONTRACT.md` |
| Settings/menu/coupon | Admin settings/menu/coupon routes; public menu/settings consumption; cart coupon apply/remove | Admin settings/menu/coupon APIs; public menu/settings; cart coupon APIs | Settings/Menu/Coupon/Cart services | SiteSetting, Menu, Coupon, CartCoupon, OrderAppliedCoupon | `CONFIRMED_END_TO_END` | `App.jsx`; `adminApi.js`; `public-api.ts`; `client-api.ts`; `CartController.java`; `CheckoutService.java` |
| Reports/dashboard | Admin `/admin/dashboard`, `/admin/reports` | Admin dashboard/report/export APIs | Dashboard/report services | Order, Product, Customer, Inventory metrics | `CONFIRMED_END_TO_END`; metric semantics `NEEDS_VERIFICATION` | `App.jsx`; `adminApi.js`; `docs/API_CONTRACT.md` |
| Users/roles | Admin `/admin/admin-users`, `/admin/roles` | Admin users/roles APIs | Admin users/roles/RBAC services | AdminUser, Role, Permission, AuditLog | `CONFIRMED_END_TO_END` | `App.jsx`; `docs/business/USER_ROLES.md`; `docs/API_CONTRACT.md`; `SecurityConfig.java` |
| Notification/websocket | Admin shell WebSocket + order toast; backend order/return side effects | `/ws/**`, admin websocket events, email notification service calls | `AdminOrderWsService`, `OrderNotificationService`, return/order services | No canonical notification entity confirmed; email/ws event payloads | `PARTIAL` | `App.jsx`; `CheckoutService.java`; `AdminOrderService.java`; `SecurityConfig.java`; `docs/business/USER_ROLES.md` |

## 4. Customer Browsing API Flow

| Step | Actor | Frontend Route / Screen | API | Backend Controller / Service | Data | Status | Evidence |
|---|---|---|---|---|---|---|---|
| 1 | Guest/Customer | Web `/`; mobile `HomeScreen` | `GET /api/v1/settings/public`, `/menus/{location}`, `/sliders`, `/home-videos`, product/category/article reads | Public settings/menu/slider/home-video/catalog/content controllers | Setting, Menu, Slider, HomeVideo, Product, Category, Article | `CONFIRMED_END_TO_END` | `routes.ts`; `app_router.dart`; `public-api.ts`; `api_endpoints.dart`; `docs/API_CONTRACT.md` |
| 2 | Guest/Customer | `/san-pham`, mobile `ProductListScreen` | `GET /api/v1/products` | `CatalogController` | Product, Category/Brand filters | `CONFIRMED_END_TO_END` | `routes.ts`; `public-api.ts`; `api_endpoints.dart`; `SecurityConfig.java` |
| 3 | Guest/Customer | `/product/:slug`, mobile `ProductDetailScreen` | `GET /api/v1/products/{slug}`; mobile also declares snapshot/reviews endpoints | `CatalogController`; review controller for reviews | Product, Product media/spec/variants, Review | Product detail `CONFIRMED_END_TO_END`; snapshot/reviews UI usage `NEEDS_VERIFICATION` | `routes.ts`; `public-api.ts`; `api_endpoints.dart`; `docs/API_CONTRACT.md` |
| 4 | Guest/Customer | `/danh-muc-san-pham`, `/danh-muc-san-pham/:slug` | `GET /api/v1/categories`, `/categories/{slug}` | `CatalogController` | Category, Product relation | `CONFIRMED_END_TO_END` | `routes.ts`; `public-api.ts`; `api_endpoints.dart` |
| 5 | Guest/Customer | `/brands`, `/brands/:slug` | `GET /api/v1/brands`, `/brands/{slug}` | `CatalogController` | Brand, Product relation | `CONFIRMED_END_TO_END` | `routes.ts`; `public-api.ts`; `api_endpoints.dart` |
| 6 | Guest/Customer | `/tin-tuc`, `/tin-tuc/:slug`, CMS page routes | `GET /api/v1/articles`, `/articles/{slug}`, `/pages/{slug}` | `ContentController` | Article, Page, SEO metadata | `CONFIRMED_END_TO_END` | `routes.ts`; `public-api.ts`; `app_router.dart`; `api_endpoints.dart` |
| 7 | Guest/Customer | Search UI/mobile `/tim-kiem` | `GET /api/v1/search`; mobile endpoint also declares `search-suggest` | `PublicSearchController` | Product, Article search result | Search `CONFIRMED_END_TO_END`; suggest UI usage `NEEDS_VERIFICATION` | `public-api.ts`; `api_endpoints.dart`; `SecurityConfig.java` |

## 5. Product Publish API Flow

| Step | Actor | Frontend Route / Screen | API | Backend Controller / Service | Data | Status | Evidence |
|---|---|---|---|---|---|---|---|
| 1 | Admin | `/admin/products` | `GET /api/v1/admin/products` | `AdminCatalogController.listProducts` → `AdminCatalogReadService` | Product | `CONFIRMED_END_TO_END` | `App.jsx`; `adminApi.js`; `AdminCatalogController.java` |
| 2 | Admin | `/admin/products/new` | `POST /api/v1/admin/products` | `AdminCatalogController.createProduct` → `AdminCatalogMutationService` | Product, category/brand refs, media refs, SEO | `CONFIRMED_END_TO_END` | `App.jsx`; `adminApi.js`; `AdminCatalogController.java` |
| 3 | Admin | `/admin/products/:id` | `GET /api/v1/admin/products/{id}`, `PATCH /api/v1/admin/products/{id}` | `AdminCatalogController.getProductById/updateProduct` | Product | `CONFIRMED_END_TO_END` | `App.jsx`; `adminApi.js`; `AdminCatalogController.java` |
| 4 | Admin | Product detail publish action | `PATCH /api/v1/admin/products/{id}/publish` | `AdminCatalogController.publishProduct` | Product.publishStatus | `CONFIRMED_END_TO_END` | `adminApi.js`; `AdminCatalogController.java` |
| 5 | System/Public | Public product/category/brand routes | `GET /api/v1/products`, `/products/{slug}` | Public catalog read controller/service | Product read model | `CONFIRMED_END_TO_END`; exact publish filter `NEEDS_VERIFICATION` | `public-api.ts`; `docs/API_CONTRACT.md`; `docs/business/WORKFLOW_OVERVIEW.md` |
| 6 | Security | Admin route guard/backend guard | Admin API requires `ROLE_ADMIN`; product writes require `products.update` | `SecurityConfig`, `DevAdminAuthService.requirePermission` | Auth principal/permissions | `CONFIRMED_END_TO_END` | `App.jsx`; `SecurityConfig.java`; `AdminCatalogController.java` |

## 6. Cart / Checkout API Flow

| Step | Actor | Frontend Route / Screen | API | Backend Controller / Service | Data | Status | Evidence |
|---|---|---|---|---|---|---|---|
| 1 | Guest/Customer | `/gio-hang`, mobile `CartScreen` | `GET /api/v1/cart` | `CartController.getCart` → `CartService` | Cart, CartItem, CartCoupon | `CONFIRMED_END_TO_END` | `routes.ts`; `app_router.dart`; `client-api.ts`; `CartController.java` |
| 2 | Guest/Customer | Product/cart action | `POST /api/v1/cart/items` | `CartController.addItem` → `CartService.addItem` | CartItem, Product/Variant snapshot | `CONFIRMED_END_TO_END` | `client-api.ts`; `api_endpoints.dart`; `CartController.java` |
| 3 | Guest/Customer | Cart quantity/remove actions | `PATCH /cart/items/{itemId}`, `DELETE /cart/items/{itemId}`, `DELETE /cart/clear` | `CartController` → `CartService` | CartItem, Cart totals | `CONFIRMED_END_TO_END` | `client-api.ts`; `CartController.java` |
| 4 | Guest/Customer | Cart coupon action | `POST /cart/coupons`, `DELETE /cart/coupons/{code}` | `CartController` → `CartService`/calculator | CartCoupon, Coupon-derived totals | `CONFIRMED_END_TO_END` | `client-api.ts`; `CartController.java`; `CheckoutService.java` |
| 5 | Guest/Customer | `/thanh-toan`, mobile `CheckoutScreen` | `GET /api/v1/checkout/options` | `CheckoutController.getOptions` → `CheckoutService.getOptions` | Payment methods, Shipping methods | `CONFIRMED_END_TO_END` | `client-api.ts`; `api_endpoints.dart`; `CheckoutController.java`; `CheckoutService.java` |
| 6 | Guest/Customer | Checkout submit | `POST /api/v1/checkout` | `CheckoutController.checkout` → `CheckoutService.checkoutFromCart` | Order, line items, addresses, shipping item, payment, note, stock movement, cart status | `CONFIRMED_END_TO_END` | `client-api.ts`; `CheckoutController.java`; `CheckoutService.java` |
| 7 | Guest/Customer | Product detail quick-buy action | `POST /api/v1/orders/quick-buy` | `CheckoutController.quickBuy` → `CheckoutService.quickBuy` | Product/Variant, Order, stock, payment, shipping | `PARTIAL` | `client-api.ts`; `api_endpoints.dart`; `CheckoutController.java`; `CheckoutService.java`; exact screen button usage needs verification |
| 8 | System | Checkout side effects | internal service calls | `OrderNotificationService`, `AdminOrderWsService`, inventory policy | Email/admin notification, ws event, stock state | `CONFIRMED_END_TO_END` code path; delivery runtime `NEEDS_VERIFICATION` | `CheckoutService.java`; `SecurityConfig.java` |
| 9 | Security | Guest/customer mutation protection | CSRF header/cookie for non-GET client calls | `CustomerSessionFilter`, `CustomerCsrfFilter`, `SecurityConfig` | `bb_guest_id`, `bb_csrf`, customer principal | `CONFIRMED_END_TO_END` | `client-api.ts`; `CartController.java`; `CheckoutController.java`; `SecurityConfig.java` |

## 7. Admin Order Processing API Flow

| Step | Actor | Frontend Route / Screen | API | Backend Controller / Service | Data | Status | Evidence |
|---|---|---|---|---|---|---|---|
| 1 | Admin | `/admin/orders` | `GET /api/v1/admin/orders` | `AdminOrderController.listOrders` → `AdminOrderService.listOrders` | Order list summary | `CONFIRMED_END_TO_END` | `App.jsx`; `adminApi.js`; `AdminOrderController.java`; `AdminOrderService.java` |
| 2 | Admin | `/admin/orders/:id` | `GET /api/v1/admin/orders/{orderId}` | `AdminOrderController.getOrderDetail` → `AdminOrderService.getOrderDetail` | Order, line items, addresses, shipping, payments, notes, coupons | `CONFIRMED_END_TO_END` | `App.jsx`; `adminApi.js`; `AdminOrderController.java`; `AdminOrderService.java` |
| 3 | Admin | Order detail transition UI | `GET /admin/orders/{orderId}/allowed-transitions` | `AdminOrderService.listAllowedTransitions` | Order status | `CONFIRMED_END_TO_END` | `adminApi.js`; `AdminOrderController.java`; `AdminOrderService.java` |
| 4 | Admin | Order status update action | `PATCH /admin/orders/{orderId}/status` | `AdminOrderService.updateOrderStatus` | Order status/timestamps, stock restore on cancel/refund, note, audit | `CONFIRMED_END_TO_END` | `adminApi.js`; `AdminOrderController.java`; `AdminOrderService.java` |
| 5 | Admin | Payment update action | `PATCH /admin/orders/{orderId}/payment-status` | `AdminOrderService.updatePaymentStatus` | Order payment fields, Payment record, Note, Audit, WS | `CONFIRMED_END_TO_END` | `adminApi.js`; `AdminOrderController.java`; `AdminOrderService.java` |
| 6 | Admin | Note action | `POST /admin/orders/{orderId}/notes` | `AdminOrderService.addNote` | OrderNote, Audit, WS | `CONFIRMED_END_TO_END` | `adminApi.js`; `AdminOrderController.java`; `AdminOrderService.java` |
| 7 | Admin | Notes list | `GET /admin/orders/{orderId}/notes` | `AdminOrderService.listNotes` | OrderNote | `BACKEND_ONLY` in audited admin client segment | `AdminOrderController.java`; `AdminOrderService.java` |
| 8 | Admin | Refund action | `POST /admin/orders/{orderId}/refund` | `AdminOrderService.createRefund` | Order refund fields, Payment, Note, Audit, notification/ws | `BACKEND_ONLY` in audited admin client segment | `AdminOrderController.java`; `AdminOrderService.java`; `docs/API_CONTRACT.md` |
| 9 | Security | Admin permission | `/api/v1/admin/**` requires `ROLE_ADMIN`; order read/write require `orders.read/orders.write` | `SecurityConfig`, `DevAdminAuthService` | Admin principal/permission | `CONFIRMED_END_TO_END` | `SecurityConfig.java`; `AdminOrderController.java`; `App.jsx` |

## 8. Payment / Refund API Flow

| Step | Actor | Frontend Route / Screen | API | Backend Controller / Service | Data | Status | Evidence |
|---|---|---|---|---|---|---|---|
| 1 | Customer | Checkout form | `POST /checkout` or `POST /orders/quick-buy` with `COD`/`BACS` | `CheckoutService.buildPayment` | Payment provider=`INTERNAL`, payment status=`PENDING`, order paymentStatus=`UNPAID` | `CONFIRMED_END_TO_END` | `client-api.ts`; `CheckoutService.java` |
| 2 | Admin | `/admin/orders/:id` | `PATCH /admin/orders/{id}/payment-status` | `AdminOrderService.updatePaymentStatus` | Order paymentStatus, paidAmount, paidAt, Payment.status | `CONFIRMED_END_TO_END` | `adminApi.js`; `AdminOrderController.java`; `AdminOrderService.java` |
| 3 | Admin | Refund action | `POST /admin/orders/{id}/refund` | `AdminOrderService.createRefund` | Order.refundAmount/refundedAt/refundReason, Payment.refundAmount/status, Note, Audit | `BACKEND_ONLY` in audited admin client segment | `AdminOrderController.java`; `AdminOrderService.java` |
| 4 | System | Full refund side effect | internal notification/ws | `OrderNotificationService`, `AdminOrderWsService` | Email/ws event | Code path `CONFIRMED_END_TO_END`; runtime `NEEDS_VERIFICATION` | `AdminOrderService.java` |
| 5 | External provider | Provider webhook/auto reconciliation | Not found | Not found | Provider transaction/webhook payload | `NOT_FOUND_IN_REPO` | `docs/API_CONTRACT.md`; no webhook controller/service found in audited evidence |

## 9. Shipping / Fulfillment API Flow

| Step | Actor | Frontend Route / Screen | API | Backend Controller / Service | Data | Status | Evidence |
|---|---|---|---|---|---|---|---|
| 1 | Admin | `/admin/shipping` | Admin shipping zone/method APIs | `AdminShippingController`/`AdminShippingService` | ShippingZone, ShippingMethod | `CONFIRMED_END_TO_END` by docs/admin route; controller detail not deeply fetched | `App.jsx`; `adminApi.js`; `docs/API_CONTRACT.md`; `docs/business/WORKFLOW_OVERVIEW.md` |
| 2 | Customer | Checkout form | `GET /api/v1/checkout/options` | `CheckoutService.getOptions` | Enabled ShippingMethod list | `CONFIRMED_END_TO_END` | `client-api.ts`; `CheckoutController.java`; `CheckoutService.java` |
| 3 | Customer | Checkout submit | `POST /api/v1/checkout` | `CheckoutService.resolveShippingMethod`, `buildShippingItem` | OrderShippingItem, Order.shippingAmount | `CONFIRMED_END_TO_END` | `CheckoutService.java` |
| 4 | System | Shipping cost rule | internal calculation | `CheckoutService.resolveShippingCost` | shipping amount, free threshold | `CONFIRMED_END_TO_END` | `CheckoutService.java` |
| 5 | External carrier | Waybill/tracking/status | Not found | Not found | Carrier shipment/tracking | `NOT_FOUND_IN_REPO` | `docs/API_CONTRACT.md`; `docs/DATA_CONTRACT.md` |

## 10. Inventory API Flow

| Step | Actor | Frontend Route / Screen | API | Backend Controller / Service | Data | Status | Evidence |
|---|---|---|---|---|---|---|---|
| 1 | Admin | `/admin/inventory` | `GET /api/v1/admin/inventory` | `AdminInventoryController.listStock` → `AdminInventoryService` | Product/Variant stock list | `CONFIRMED_END_TO_END` | `App.jsx`; `AdminInventoryController.java` |
| 2 | Admin | Inventory summary widget | `GET /admin/inventory/summary` | `AdminInventoryController.getSummary` | Inventory summary metrics | `CONFIRMED_END_TO_END` | `AdminInventoryController.java` |
| 3 | Admin | Movement history/export | `GET /admin/inventory/movements`, `/export.csv`, `/variants/{id}/movements` | `AdminInventoryController` → `AdminInventoryService` | StockMovement | `CONFIRMED_END_TO_END` | `AdminInventoryController.java` |
| 4 | Admin | Stock adjust action | `POST /admin/inventory/variants/{variantId}/adjust` | `AdminInventoryController.adjustStock` | ProductVariant quantity, StockMovement | `CONFIRMED_END_TO_END` | `AdminInventoryController.java` |
| 5 | Customer/System | Checkout/quick-buy | `POST /checkout`, `POST /orders/quick-buy` | `CheckoutService.decrementStockForCartItems`, `decrementVariantStock` | Product/Variant stock, StockMovement OUT | `CONFIRMED_END_TO_END` | `CheckoutService.java` |
| 6 | Admin/System | Cancel/refund order | `PATCH /admin/orders/{id}/status`, `POST /refund` | `AdminOrderService.restoreStockForOrder` | Product/Variant stock, StockMovement IN for variant | `CONFIRMED_END_TO_END`; product-level movement restore detail `NEEDS_VERIFICATION` | `AdminOrderService.java` |
| 7 | Admin/System | Return completed | `PATCH /admin/returns/{id}/status` | `AdminReturnService` | Return, stock restore/movement | `PARTIAL` | `AdminReturnController.java`; `docs/business/WORKFLOW_OVERVIEW.md` |
| 8 | Security | Inventory permissions | `products.read/products.update` | `DevAdminAuthService.requirePermission` | Admin permission | `CONFIRMED_END_TO_END` | `AdminInventoryController.java`; `App.jsx`; `SecurityConfig.java` |

## 11. Return / Refund API Flow

| Step | Actor | Frontend Route / Screen | API | Backend Controller / Service | Data | Status | Evidence |
|---|---|---|---|---|---|---|---|
| 1 | Customer | `/tai-khoan/doi-tra`, order detail | `GET /api/v1/customer/orders/returns` | `CustomerOrderController.listReturns` → `CustomerReturnService` | CustomerReturn | `CONFIRMED_END_TO_END` | `client-api.ts`; `app_router.dart`; `CustomerOrderController.java` |
| 2 | Customer | Return detail | `GET /customer/orders/returns/{returnId}` | `CustomerOrderController.getReturn` | CustomerReturn detail | `CONFIRMED_END_TO_END` | `client-api.ts`; `api_endpoints.dart`; `CustomerOrderController.java` |
| 3 | Customer | Create return from own order | `POST /customer/orders/{orderId}/returns` | `CustomerOrderController.createReturn` → `CustomerReturnService.createReturn` | ReturnRequest, ReturnItem, Order relation | `CONFIRMED_END_TO_END` | `client-api.ts`; `CustomerOrderController.java`; `SecurityConfig.java` |
| 4 | Admin | `/admin/returns` | `GET /api/v1/admin/returns` | `AdminReturnController.listReturns` | Return list | `CONFIRMED_END_TO_END` | `App.jsx`; `AdminReturnController.java` |
| 5 | Admin | Return detail/action | `GET /admin/returns/{returnId}`, `PATCH /admin/returns/{returnId}/status` | `AdminReturnController` → `AdminReturnService` | Return status, order/stock side effects | `CONFIRMED_END_TO_END`; side effects need deeper service audit | `AdminReturnController.java`; `docs/business/WORKFLOW_OVERVIEW.md` |
| 6 | Admin | Order refund | `POST /admin/orders/{id}/refund` | `AdminOrderService.createRefund` | Payment/refund/order/note/audit | `BACKEND_ONLY` in audited admin client segment | `AdminOrderController.java`; `AdminOrderService.java` |

## 12. Media API Flow

| Step | Actor | Frontend Route / Screen | API | Backend Controller / Service | Data | Status | Evidence |
|---|---|---|---|---|---|---|---|
| 1 | Admin/Editor/Author | `/admin/media` | `POST /api/v1/admin/media` multipart | `AdminMediaController`/media service | Media metadata, object storage | `CONFIRMED_END_TO_END` by docs/admin route/client | `App.jsx`; `adminApi.js`; `docs/API_CONTRACT.md`; `docs/DATA_CONTRACT.md` |
| 2 | Admin/Editor/Author | Media library | `GET /admin/media`, `GET /admin/media/{mediaId}` | `AdminMediaController` | MediaAsset | `CONFIRMED_END_TO_END` | `App.jsx`; `adminApi.js`; `docs/API_CONTRACT.md` |
| 3 | Admin/Editor/Author | Media metadata/status action | `PATCH /admin/media/{mediaId}` | `AdminMediaController` | Media metadata/status | `CONFIRMED_END_TO_END` | `docs/API_CONTRACT.md`; `docs/DATA_CONTRACT.md` |
| 4 | Admin/Editor/Author | Delete/restore action | `DELETE /admin/media/{mediaId}`, `POST /admin/media/{mediaId}/restore` | `AdminMediaController` | Media soft delete/restore, storage delete if hard delete supported | `CONFIRMED_END_TO_END`; exact hard delete policy `NEEDS_VERIFICATION` | `docs/API_CONTRACT.md`; `docs/DATA_CONTRACT.md` |
| 5 | System | Storage side effect | internal storage adapter | MinIO/S3 config | Object storage bucket/object | `CONFIRMED_END_TO_END`; public CDN/runtime `NEEDS_VERIFICATION` | `docs/DATA_CONTRACT.md`; `MinioConfig.java`; `docker-compose.yaml` |

## 13. Content / SEO API Flow

| Step | Actor | Frontend Route / Screen | API | Backend Controller / Service | Data | Status | Evidence |
|---|---|---|---|---|---|---|---|
| 1 | Admin/Editor | `/admin/content`, `/admin/content/:type/new`, `/admin/content/:type/:id` | Admin content list/detail/create/update/delete APIs | `AdminContentController`/content service | Article, Page, SEO metadata | `CONFIRMED_END_TO_END` | `App.jsx`; `adminApi.js`; `docs/API_CONTRACT.md` |
| 2 | Guest | `/tin-tuc`, `/tin-tuc/:slug`, CMS page catch-all | `GET /api/v1/articles`, `/articles/{slug}`, `/pages/{slug}` | `ContentController` | Article/Page public read model | `CONFIRMED_END_TO_END` | `routes.ts`; `public-api.ts`; `api_endpoints.dart` |
| 3 | Admin/SEO Editor | `/admin/redirects` | Admin redirect APIs | `AdminRedirectController` | Redirect rules | `CONFIRMED_END_TO_END` by route/client/docs | `App.jsx`; `adminApi.js`; `docs/API_CONTRACT.md`; `docs/business/USER_ROLES.md` |
| 4 | Public web middleware/system | Incoming legacy URL | `/api/internal/redirect`, `/api/internal/redirects/active`, `/hit/**` | `InternalRedirectController` | Redirect rule/hit count | `CONFIRMED_END_TO_END`; prod infra allowlist `NEEDS_VERIFICATION` | `SecurityConfig.java`; `docs/API_CONTRACT.md` |
| 5 | Admin | `/admin/sliders`, `/admin/home-videos`, `/admin/menus` | Admin slider/home-video/menu APIs | Admin content/navigation services | Slider, HomeVideo, Menu | `CONFIRMED_END_TO_END` | `App.jsx`; `adminApi.js`; `docs/API_CONTRACT.md` |
| 6 | Guest | Homepage/menu | Public slider/home-video/menu APIs | Public controllers/services | Slider, HomeVideo, Menu | `CONFIRMED_END_TO_END` | `public-api.ts`; `SecurityConfig.java`; `docs/API_CONTRACT.md` |
| 7 | SEO Ops | Sitemap/robots/migration completeness | Not fully confirmed in this audit | Not fully confirmed | SEO migration artifacts | `NEEDS_VERIFICATION` | `docs/business/WORKFLOW_OVERVIEW.md`; `docs/API_CONTRACT.md` |

## 14. User / Role / Permission API Flow

| Step | Actor | Frontend Route / Screen | API | Backend Controller / Service | Data | Status | Evidence |
|---|---|---|---|---|---|---|---|
| 1 | Admin | Login screen | `POST /api/v1/auth/login`, `/auth/refresh`, `/auth/logout`, `GET /auth/me` | `AuthController`, JWT/refresh handling | AdminUser profile, tokens/cookie | `CONFIRMED_END_TO_END` | `adminApi.js`; `SecurityConfig.java`; `docs/API_CONTRACT.md` |
| 2 | Admin | Admin shell route guard/navigation | client-side permission filtering and `routePermission` | N/A frontend guard | User permissions array | `CONFIRMED_END_TO_END` | `App.jsx` |
| 3 | Admin/Super Admin | `/admin/admin-users` | Admin users list/detail/create/update/status/password APIs | `AdminAdminUsersController`, `AdminAdminUsersService` | AdminUser, role assignment, AuditLog | `CONFIRMED_END_TO_END` by docs/route | `App.jsx`; `docs/API_CONTRACT.md`; `docs/business/USER_ROLES.md` |
| 4 | Super Admin/Admin | `/admin/roles` | Admin roles/permissions APIs | `AdminRolesController`, role service | Role, Permission | `CONFIRMED_END_TO_END` by docs/route | `App.jsx`; `docs/API_CONTRACT.md`; `docs/business/USER_ROLES.md` |
| 5 | Backend | Every admin controller | `DevAdminAuthService.requirePermission(request, "module.action")` | Permission enforcement | Admin principal/permission | `CONFIRMED_END_TO_END` | `AdminCatalogController.java`; `AdminOrderController.java`; `AdminInventoryController.java`; `AdminReturnController.java` |
| 6 | Security | Admin/customer/public boundary | `/api/v1/admin/**` requires `ROLE_ADMIN`; customer routes require `ROLE_CUSTOMER`; public routes permitAll | `SecurityConfig` | Security context | `CONFIRMED_END_TO_END` | `SecurityConfig.java` |
| 7 | Docs gap | `/docs/PERMISSION_MATRIX.md` | N/A | N/A | N/A | `NOT_FOUND_IN_REPO` | File requested by task but fetch returned 404; role/permission evidence taken from source/docs above |

## 15. Settings / Menu / Coupon API Flow

| Step | Actor | Frontend Route / Screen | API | Backend Controller / Service | Data | Status | Evidence |
|---|---|---|---|---|---|---|---|
| 1 | Admin | `/admin/settings` | `GET /admin/settings`, `GET/PATCH /admin/settings/{key}` | `AdminSettingsController` | SiteSetting | `CONFIRMED_END_TO_END` by route/client/docs | `App.jsx`; `adminApi.js`; `docs/API_CONTRACT.md` |
| 2 | Guest/Public | Homepage/layout | `GET /api/v1/settings/public` | `PublicSettingsController` | PublicSiteSetting subset | `CONFIRMED_END_TO_END` | `public-api.ts`; `SecurityConfig.java`; `docs/API_CONTRACT.md` |
| 3 | Admin | `/admin/menus` | Admin menu APIs | `AdminMenuController` | Menu/MenuItem | `CONFIRMED_END_TO_END` by route/client/docs | `App.jsx`; `adminApi.js`; `docs/API_CONTRACT.md` |
| 4 | Guest/Public | Header/footer/nav | `GET /api/v1/menus/{location}` | `PublicMenuController` | Active public menu | `CONFIRMED_END_TO_END` | `public-api.ts`; `api_endpoints.dart`; `SecurityConfig.java` |
| 5 | Admin | `/admin/coupons` | Admin coupon APIs | `AdminCouponController` | Coupon | `CONFIRMED_END_TO_END` by route/client/docs | `App.jsx`; `adminApi.js`; `docs/API_CONTRACT.md` |
| 6 | Guest/Customer | Cart/checkout | `POST /cart/coupons`, `DELETE /cart/coupons/{code}`; checkout applies coupons to order | `CartController`, `CheckoutService` | CartCoupon, Coupon usage count, OrderAppliedCoupon | `CONFIRMED_END_TO_END` | `client-api.ts`; `CartController.java`; `CheckoutService.java` |

## 16. Reporting / Dashboard API Flow

| Step | Actor | Frontend Route / Screen | API | Backend Controller / Service | Data | Status | Evidence |
|---|---|---|---|---|---|---|---|
| 1 | Admin | `/admin/dashboard` | Dashboard summary API | `AdminDashboardController`/dashboard service | Order/customer/product/revenue metrics | `CONFIRMED_END_TO_END` by route/client/docs | `App.jsx`; `adminApi.js`; `docs/API_CONTRACT.md` |
| 2 | Admin | `/admin/reports` | Report/query/export APIs | `AdminReportController`/report service | Orders, payments, products, customers, inventory metrics | `CONFIRMED_END_TO_END` by route/client/docs | `App.jsx`; `adminApi.js`; `docs/API_CONTRACT.md` |
| 3 | Admin | `/admin/inventory` export | `GET /admin/inventory/export.csv` | `AdminInventoryController.exportCsv` | Inventory CSV | `CONFIRMED_END_TO_END` | `AdminInventoryController.java` |
| 4 | QA/Business | Metric semantics | N/A | Need verify formulas/source windows | Aggregated metrics | `NEEDS_VERIFICATION` | `docs/API_CONTRACT.md`; `docs/business/WORKFLOW_OVERVIEW.md` |

## 17. Notification / WebSocket Flow

| Step | Actor | Frontend Route / Screen | API | Backend Controller / Service | Data | Status | Evidence |
|---|---|---|---|---|---|---|---|
| 1 | Admin | Authenticated admin app | WebSocket connect after auth | `connectAdminWs`, `/ws/**`, STOMP interceptor comment | Access token/session context | `PARTIAL` | `App.jsx`; `SecurityConfig.java`; `bigbike-admin/src/lib/adminWebSocket.js` should be deep-audited |
| 2 | System | Checkout new order | internal service calls | `OrderNotificationService.sendOrderConfirmation`, `sendAdminNewOrderNotification`; `AdminOrderWsService.pushEvent` | Email notification, WS event | Code path `CONFIRMED_END_TO_END`; delivery runtime `NEEDS_VERIFICATION` | `CheckoutService.java` |
| 3 | System | Admin order status/payment/note/refund | internal service calls | `OrderNotificationService`, `AdminOrderWsService` | Email notification, WS event | Code path `CONFIRMED_END_TO_END`; delivery runtime `NEEDS_VERIFICATION` | `AdminOrderService.java` |
| 4 | Admin | Toast notification | Admin shell toast component | client WS event handler | Display toast/navigate order | `PARTIAL` | `App.jsx`; `OrderNotificationToast` path referenced by import; handler file needs deep audit |
| 5 | System | Return status notification | internal service calls | `AdminReturnService`/notification service | Return/customer notification | `NEEDS_VERIFICATION` | `docs/business/WORKFLOW_OVERVIEW.md`; `AdminReturnController.java` |
| 6 | Data contract | Persisted notification records | Not found | Not found | Notification entity | `NOT_FOUND_IN_REPO` | `docs/DATA_CONTRACT.md`; no canonical notification entity confirmed |

## 18. Missing / Broken / Needs Verification Flows

| Flow | Gap | Risk | Status | Evidence |
|---|---|---|---|---|
| Payment provider webhook | Không thấy webhook/controller/provider reconciliation flow. | BACS/bank transfer có thể phải xử lý thủ công, không tự update payment. | `NOT_FOUND_IN_REPO` | `docs/API_CONTRACT.md`; `docs/business/WORKFLOW_OVERVIEW.md` |
| Shipping carrier integration | Không thấy GHN/GHTK/ViettelPost/waybill/tracking provider flow. | Admin chỉ cấu hình shipping method nội bộ, chưa có fulfillment carrier automation. | `NOT_FOUND_IN_REPO` | `docs/DATA_CONTRACT.md`; `CheckoutService.java` |
| `/docs/PERMISSION_MATRIX.md` | Task yêu cầu đọc file này nhưng repo trả 404. | Permission audit phải dựa vào `SecurityConfig`, `App.jsx`, `requirePermission`, `USER_ROLES.md`. | `NOT_FOUND_IN_REPO` | Fetch `/docs/PERMISSION_MATRIX.md` returned 404; `USER_ROLES.md`; `SecurityConfig.java`; `App.jsx` |
| Quick-buy screen action | API client/backend có, nhưng chưa deep-audit exact UI button usage. | Có thể client function tồn tại nhưng UX chưa wired đủ. | `PARTIAL` | `client-api.ts`; `api_endpoints.dart`; `CheckoutController.java`; `CheckoutService.java` |
| Admin refund action | Backend API có, nhưng audited admin client segment chưa thấy exported function gọi `/refund`. | Refund UI có thể thiếu hoặc chưa wire. | `BACKEND_ONLY` | `AdminOrderController.java`; `AdminOrderService.java`; `adminApi.js` segment inspected |
| Admin notes list API | Backend có `GET /admin/orders/{id}/notes`; admin client segment chưa thấy call riêng. | UI có thể đang lấy notes từ detail, hoặc API thừa. | `BACKEND_ONLY` | `AdminOrderController.java`; `AdminOrderService.java` |
| Search suggest UI | Backend/mobile endpoint có; web `public-api.ts` chỉ thấy `/search`. | Typeahead có thể chưa dùng hoặc chỉ mobile. | `NEEDS_VERIFICATION` | `SecurityConfig.java`; `api_endpoints.dart`; `docs/API_CONTRACT.md` |
| Product snapshot UI | Mobile endpoint/backend contract có; web public client chưa thấy dùng. | Có thể API phục vụ mobile/cache nhưng chưa trace action. | `NEEDS_VERIFICATION` | `api_endpoints.dart`; `docs/API_CONTRACT.md` |
| WebSocket auth/runtime delivery | SecurityConfig permit `/ws/**` và comment nói STOMP CONNECT interceptor; chưa deep-audit interceptor. | WS có thể fail auth/runtime nếu interceptor/config mismatch. | `NEEDS_VERIFICATION` | `SecurityConfig.java`; `App.jsx` |
| Metrics formulas | Dashboard/report APIs có evidence nhưng metric definition chưa audit sâu. | Business có thể hiểu sai số liệu. | `NEEDS_VERIFICATION` | `docs/API_CONTRACT.md`; `App.jsx` |
| Product public publish filter | Admin publish/public read flow có nhưng exact public visibility filtering cần deep service audit. | Draft/private product có thể leak nếu filter sai. | `NEEDS_VERIFICATION` | `AdminCatalogController.java`; `public-api.ts`; `docs/business/WORKFLOW_OVERVIEW.md` |
| Sitemap/robots/SEO migration completeness | Content/redirect flow có, nhưng sitemap/robots/legacy URL coverage chưa xác nhận trong flow map. | SEO migration có thể mất traffic nếu redirect/sitemap thiếu. | `NEEDS_VERIFICATION` | `docs/business/WORKFLOW_OVERVIEW.md`; `docs/API_CONTRACT.md` |

## 19. Evidence Summary

| Flow | Evidence Path | What It Proves | Confidence |
|---|---|---|---|
| Required task scope | Uploaded prompt text | Specifies required docs/source targets and output structure for this file. | High |
| Existing workflow baseline | `docs/business/WORKFLOW_OVERVIEW.md` | Existing business workflow map and status expectations. | High |
| API contract baseline | `docs/API_CONTRACT.md` | API surface, auth model, frontend/backend matching, backend-only gaps. | High |
| Data contract baseline | `docs/DATA_CONTRACT.md` | Canonical entities/data ownership and known data gaps. | High |
| Roles baseline | `docs/business/USER_ROLES.md` | Actors, admin roles, system actors, missing provider actors. | High |
| Public web routes | `bigbike-web/lib/utils/routes.ts` | Public route entry points for product/category/brand/article/cart/checkout/account/order. | High |
| Public web read client | `bigbike-web/lib/api/public-api.ts` | Public GET API usage for catalog/content/search/settings/menu/order lookup. | High |
| Web commerce client | `bigbike-web/lib/api/client-api.ts` | Cart, checkout, quick-buy, customer auth/profile/address/orders/returns/contact client APIs. | High |
| Mobile routes | `bigbike_mobile/lib/core/router/app_router.dart` | Mobile screens/routes for browse/cart/checkout/auth/account/orders/returns/contact/content. | High |
| Mobile endpoints | `bigbike_mobile/lib/core/api/api_endpoints.dart` | Mobile API endpoint constants for catalog/cart/checkout/customer/orders/returns/contact. | High |
| Admin routes/permissions | `bigbike-admin/src/App.jsx` | Admin route map, screen names, nav permissions, route-level permission guard, WS connect on auth. | High |
| Admin API client | `bigbike-admin/src/lib/adminApi.js` | Admin frontend calls for products/catalog/content/orders/customers and many admin modules. | Medium-High because large file was inspected in relevant segments. |
| Security model | `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/config/SecurityConfig.java` | Public/customer/admin route access, CSRF filter placement, WebSocket permitAll at HTTP layer. | High |
| Cart backend | `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/cart/CartController.java` | Cart endpoints, guest/customer cart resolution, CSRF/guest cookie behavior. | High |
| Checkout backend | `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/checkout/CheckoutController.java` | Checkout/quick-buy/options API entry points. | High |
| Checkout service | `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/checkout/CheckoutService.java` | Order creation, payment, shipping, stock decrement, cart conversion, coupon application, notification/ws side effects. | High |
| Admin catalog | `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/admin/AdminCatalogController.java` | Product/category/brand CRUD/publish APIs and permissions. | High |
| Admin order controller | `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/admin/AdminOrderController.java` | Order list/detail/status/payment/refund/note APIs and permissions. | High |
| Admin order service | `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminOrderService.java` | Status/payment transitions, stock restore, refund, audit, note, notification/ws side effects. | High |
| Customer order/return | `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/order/CustomerOrderController.java` | Customer order list/detail and customer return create/list/detail APIs. | High |
| Admin inventory | `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/admin/AdminInventoryController.java` | Inventory list/summary/movement/export/adjust APIs and permissions. | High |
| Admin returns | `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/admin/AdminReturnController.java` | Admin return list/detail/status APIs and permissions. | High |

## 20. Relationship With Other Docs

| Related Doc | Relationship |
|---|---|
| `docs/API_CONTRACT.md` | Source for endpoint inventory, auth rules, response/error contract. `API_FLOW_MAP.md` references endpoint sequences only, not detailed request/response schemas. |
| `docs/DATA_CONTRACT.md` | Source for canonical entity/data ownership. `API_FLOW_MAP.md` only states high-level data touched. |
| `docs/business/WORKFLOW_OVERVIEW.md` | Source for business workflow definitions. `API_FLOW_MAP.md` translates those workflows into API/controller/service/data/security chains. |
| `docs/business/BUSINESS_PROCESS.md` | Should describe business-level process intent. This file maps implementation/API evidence behind those processes. |
| `docs/business/BUSINESS_RULES.md` | Should contain rule rationale and constraints. This file points to where those rules appear in API/service flow. |
| `docs/business/STATE_MACHINES.md` | Should own status transition rules. This file references transition APIs/services and side effects. |
| `docs/business/USER_ROLES.md` | Source for actor/role definitions, especially when `/docs/PERMISSION_MATRIX.md` is absent. |
| `docs/PERMISSION_MATRIX.md` | Requested by task but not found in repo at audit time. Until created, permission evidence is traced from `SecurityConfig`, admin `App.jsx`, controller `requirePermission`, and `USER_ROLES.md`. |
| `docs/TRACEABILITY_MATRIX.md` | Not required to exist for this audit, but should link business process/rule/API/data/test coverage. This file can feed it. |

## Audit Notes

- This audit only read/inspected repo evidence.
- No code was changed.
- No feature was implemented.
- No refactor was performed.
- API detail belongs in `API_CONTRACT.md`.
- Data field detail belongs in `DATA_CONTRACT.md`.
- Any flow marked `PARTIAL`, `BACKEND_ONLY`, `FRONTEND_ONLY`, `DOCUMENTED_NOT_FOUND`, `NEEDS_VERIFICATION`, or `NOT_FOUND_IN_REPO` must not be treated as production-complete without deeper source/runtime verification.
