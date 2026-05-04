# BigBike Module Catalog

## 1. Document Purpose

File này liệt kê các module chính và feature con của BigBike để business user, PM, BA, tester, developer mới và AI agent hiểu hệ thống có những khu vực chức năng nào, mỗi module gồm những gì, trạng thái hiện tại ra sao và phần nào cần kiểm tra thêm.

File này trả lời câu hỏi: **"Hệ thống có những module nào và mỗi module có những feature gì?"**

Giới hạn:

- Không phải API contract.
- Không phải database schema.
- Không phải architecture detail.
- Không nhồi request/response chi tiết.
- Không khẳng định module `DONE` hoặc production-ready nếu chưa có evidence đủ.
- Không đưa secret, token, password, private key hoặc env value nhạy cảm.
- Không xem một route/menu label là module hoàn chỉnh nếu chưa có evidence từ UI/API/service/model/permission/test.

## 2. Module vs Feature Definition

| Concept | Definition |
|---|---|
| Module | Nhóm chức năng lớn phục vụ một mảng nghiệp vụ hoặc kỹ thuật rõ ràng. Ví dụ: Products, Orders, Inventory, Media, Content. |
| Feature | Chức năng con cụ thể bên trong module. Ví dụ: product list, create product, publish product, product gallery. |
| Workflow | Luồng phối hợp nhiều module để hoàn thành mục tiêu end-to-end. Ví dụ: checkout cần Product, Cart, Order, Payment, Shipping, Inventory, Notification. |

Một module có thể xuất hiện ở nhiều layer:

- Public Web
- Admin Portal
- Backend
- Database/model/entity
- Integration
- Tests

Một feature có thể tham gia nhiều workflow. Ví dụ `update payment status` thuộc module Orders/Payment, nhưng ảnh hưởng reporting, notification và refund.

## 3. Status Labels

| Label | Meaning |
|---|---|
| `CONFIRMED_FROM_CODE` | Đã thấy evidence trực tiếp trong source/config/docs. |
| `INFERRED_FROM_STRUCTURE` | Suy luận từ folder/route/API naming nhưng chưa đủ evidence đầy đủ. |
| `NEEDS_VERIFICATION` | Cần kiểm tra thêm bằng code review sâu hơn, build/test/runtime hoặc business confirmation. |
| `NOT_FOUND_IN_REPO` | Chưa thấy bằng chứng trong repo hiện tại. |
| `PARTIAL` | Có một phần UI/API/model/service nhưng chưa đủ để xem module/feature hoàn chỉnh. |
| `MISSING_EVIDENCE` | Có claim hoặc nhu cầu business nhưng chưa tìm được evidence rõ. |

## 4. System Module Map

### Public Web Modules

| App / Layer | Module | Purpose | Main Features | Status | Evidence |
|---|---|---|---|---|---|
| Public Web | Homepage | Landing/SEO/conversion surface cho khách. | Hero slider, trust rail, featured products, categories, promo, articles, videos, brands, SEO content, analytics. | `CONFIRMED_FROM_CODE` | `bigbike-web/app/page.tsx` |
| Public Web | Product Listing | Khách browse catalog. | Product list, category/brand/query filters, route helpers. | `CONFIRMED_FROM_CODE` | `bigbike-web/lib/utils/routes.ts`, `CatalogController` |
| Public Web | Product Detail | Khách xem thông tin chi tiết sản phẩm. | PDP route, product slug, product snapshot. | `CONFIRMED_FROM_CODE` | `bigbike-web/lib/utils/routes.ts`, `CatalogController` |
| Public Web | Category / Brand Browsing | Browse theo danh mục/thương hiệu. | Category list/detail, brand list/detail. | `CONFIRMED_FROM_CODE` | `bigbike-web/lib/utils/routes.ts`, `CatalogController` |
| Public Web | Search | Tìm kiếm sản phẩm/content. | Search route, public search APIs. | `CONFIRMED_FROM_CODE` | `bigbike-web/lib/utils/routes.ts`, `PublicSearchController`, `SecurityConfig` |
| Public Web | Cart | Quản lý giỏ hàng. | Cart route, add/update/remove/apply coupon backend support. | `CONFIRMED_FROM_CODE` | `bigbike-web/lib/utils/routes.ts`, `CartController` |
| Public Web | Checkout | Tạo order từ cart/quick-buy. | Checkout route, order confirm route, checkout/quick-buy/options backend. | `CONFIRMED_FROM_CODE` | `bigbike-web/lib/utils/routes.ts`, `CheckoutController`, `CheckoutService` |
| Public Web | Customer Account/Auth | Customer login/register/account/order/address flows. | Login/register/forgot/account/order routes. | `CONFIRMED_FROM_CODE` | `bigbike-web/lib/utils/routes.ts`, `CustomerAuthController`, `CustomerController`, `CustomerAddressController`, `CustomerOrderController` |
| Public Web | Blog / Content | Tin tức, bài viết, page/policy/guide. | Article list/detail, CMS catch-all, public content APIs. | `CONFIRMED_FROM_CODE` | `bigbike-web/lib/utils/routes.ts`, `ContentController`, `AdminContentController` |
| Public Web | Contact | Khách gửi liên hệ. | Contact route/backend contact form. | `CONFIRMED_FROM_CODE` | `ContactController`, `bigbike_mobile/lib/core/router/app_router.dart` |
| Public Web | SEO / Metadata | SEO, canonical, JSON-LD, legacy redirect. | Metadata builder, JSON-LD, canonical routes, redirect tooling. | `CONFIRMED_FROM_CODE`; sitemap/robots `NEEDS_VERIFICATION` | `bigbike-web/app/page.tsx`, `bigbike-web/lib/utils/routes.ts`, `InternalRedirectController` |
| Public Web | Header / Footer / Menu | Navigation và public menu. | Public menus, route helpers, menu endpoint. | `CONFIRMED_FROM_CODE` | `PublicMenuController`, `bigbike-web/lib/utils/routes.ts` |

### Admin Portal Modules

| App / Layer | Module | Purpose | Main Features | Status | Evidence |
|---|---|---|---|---|---|
| Admin Portal | Dashboard | Tổng quan vận hành. | Dashboard route/API summary. | `CONFIRMED_FROM_CODE` | `bigbike-admin/README.md`, `AdminDashboardController` |
| Admin Portal | Products | Quản lý sản phẩm. | List, detail, create, edit, publish, soft-delete, filter. | `CONFIRMED_FROM_CODE` | `bigbike-admin/README.md`, `bigbike-admin/src/lib/adminApi.js`, `AdminCatalogController` |
| Admin Portal | Categories | Quản lý danh mục. | List, detail, create, edit, visibility/soft-delete. | `CONFIRMED_FROM_CODE` | `bigbike-admin/README.md`, `AdminCatalogController` |
| Admin Portal | Brands | Quản lý thương hiệu. | List, detail, create, edit, delete. | `CONFIRMED_FROM_CODE` | `bigbike-admin/README.md`, `AdminCatalogController` |
| Admin Portal | Orders | Quản lý đơn hàng. | List/detail/status/payment/refund/notes/allowed transitions. | `CONFIRMED_FROM_CODE` | `AdminOrderController`, `AdminOrderService`, `bigbike-admin/src/lib/adminApi.js` |
| Admin Portal | Customers | Quản lý khách hàng. | List/detail/update/status/order summary. | `CONFIRMED_FROM_CODE` | `AdminCustomerController`, `bigbike-admin/README.md` |
| Admin Portal | Inventory | Quản lý tồn kho. | Stock list, summary, movements, adjust stock, export CSV. | `CONFIRMED_FROM_CODE` | `AdminInventoryController` |
| Admin Portal | Returns / Refunds | Quản lý đổi trả/hoàn tiền. | Return list/detail/status, order refund. | `CONFIRMED_FROM_CODE` cho admin side; customer creation `NEEDS_VERIFICATION` | `AdminReturnController`, `AdminReturnService`, `AdminOrderController` |
| Admin Portal | Media | Quản lý file/media. | Upload, list, detail, update, soft/hard delete, restore. | `CONFIRMED_FROM_CODE` | `AdminMediaController` |
| Admin Portal | Content / Blog / Page | Quản lý article/page. | List, create, update, delete, publish status filter. | `CONFIRMED_FROM_CODE` | `AdminContentController` |
| Admin Portal | SEO / Redirects | Quản lý redirect/SEO migration support. | Admin redirects/internal redirects; SEO fields inferred from content/product DTOs. | `PARTIAL` | `AdminRedirectController`, `InternalRedirectController`, `bigbike-web/app/page.tsx` |
| Admin Portal | Users | Quản lý admin users. | Admin users controller/repository. | `CONFIRMED_FROM_CODE`; UI completeness `NEEDS_VERIFICATION` | `AdminAdminUsersController`, `bigbike-admin/README.md` |
| Admin Portal | Roles / Permissions | Quản lý RBAC. | Roles controller, backend permission checks, route permission map. | `CONFIRMED_FROM_CODE`; full matrix `NEEDS_VERIFICATION` | `AdminRolesController`, `SecurityConfig`, `bigbike-admin/README.md` |
| Admin Portal | Settings | Quản lý site settings. | List/get/update settings, public/private guard. | `CONFIRMED_FROM_CODE` | `AdminSettingsController`, `PHASE_1J_ADMIN_SETTINGS_MENU_COUPON_API_REPORT.md` |
| Admin Portal | Menus | Quản lý navigation menus. | Menu CRUD, item CRUD, reorder, public menu endpoint. | `CONFIRMED_FROM_CODE` | `AdminMenuController`, `PublicMenuController`, `PHASE_1J_ADMIN_SETTINGS_MENU_COUPON_API_REPORT.md` |
| Admin Portal | Coupons | Quản lý mã giảm giá. | Coupon list/detail/create/update/status. | `CONFIRMED_FROM_CODE`; checkout integration docs drift `NEEDS_VERIFICATION` | `AdminCouponController`, `CheckoutService`, `PHASE_1J_ADMIN_SETTINGS_MENU_COUPON_API_REPORT.md` |
| Admin Portal | Shipping | Quản lý shipping zones/methods. | Zone/method CRUD, shipping permissions. | `CONFIRMED_FROM_CODE`; carrier integration `NOT_FOUND_IN_REPO` | `AdminShippingController` |
| Admin Portal | Reports | Báo cáo/export. | Analytics, export orders/customers/products, inventory export. | `CONFIRMED_FROM_CODE` | `AdminReportController`, `AdminInventoryController` |
| Admin Portal | Reviews | Quản lý đánh giá sản phẩm. | Public review submit, admin review endpoints. | `CONFIRMED_FROM_CODE`; moderation UI `NEEDS_VERIFICATION` | `PublicReviewController`, `AdminReviewController`, `SecurityConfig` |
| Admin Portal | Sliders / Home Videos | Quản lý homepage media sections. | Slider/home video CRUD/reorder, public endpoints. | `CONFIRMED_FROM_CODE` | `AdminSliderController`, `PublicSliderController`, `AdminHomeVideoController`, `PublicHomeVideoController` |
| Admin Portal | POS | Bán hàng tại cửa hàng / point-of-sale. | POS controller and order payment auto-complete condition. | `PARTIAL` | `AdminPosController`, `AdminOrderService` |

### Backend Modules

| App / Layer | Module | Purpose | Main Features | Status | Evidence |
|---|---|---|---|---|---|
| Backend | Auth | Admin/customer auth, JWT/session/CSRF. | Admin login/refresh/logout/me, customer register/login/session/CSRF. | `CONFIRMED_FROM_CODE`; production auth `NEEDS_VERIFICATION` | `AuthController`, `CustomerAuthController`, `SecurityConfig`, `PHASE_1D_CUSTOMER_AUTH_REPORT.md` |
| Backend | Catalog | Public/admin product/category/brand. | Public browse, admin CRUD, publish, soft-delete. | `CONFIRMED_FROM_CODE` | `CatalogController`, `AdminCatalogController` |
| Backend | Cart | Guest/customer cart. | Cart create/read/mutate, coupon application inferred from checkout/cart repos. | `CONFIRMED_FROM_CODE`; coupon behavior `NEEDS_VERIFICATION` | `CartController`, `CheckoutService` |
| Backend | Checkout | Checkout/quick-buy/order creation. | Address/payment/shipping validation, price/stock validation, order/payment/shipping/note creation. | `CONFIRMED_FROM_CODE` | `CheckoutController`, `CheckoutService` |
| Backend | Orders | Admin/customer order lifecycle. | List/detail/status/payment/refund/notes/order lookup/customer orders. | `CONFIRMED_FROM_CODE` | `AdminOrderController`, `AdminOrderService`, `CustomerOrderController`, `OrderLookupController` |
| Backend | Payment | Internal/manual payment and refund. | Payment record, payment status transition, refund amount/status. | `CONFIRMED_FROM_CODE`; external webhook `NOT_FOUND_IN_REPO` | `CheckoutService`, `AdminOrderService` |
| Backend | Shipping | Internal shipping zones/methods. | Admin shipping CRUD, checkout shipping cost/method. | `CONFIRMED_FROM_CODE`; carrier integration `NOT_FOUND_IN_REPO` | `AdminShippingController`, `CheckoutService` |
| Backend | Inventory | Stock and movement management. | Stock list/summary/movement/adjust, checkout stock decrement, return/order restore. | `CONFIRMED_FROM_CODE` | `AdminInventoryController`, `CheckoutService`, `AdminReturnService`, `AdminOrderService` |
| Backend | Returns | Return request/admin return lifecycle. | Admin returns, transitions, notifications, stock restore. | `CONFIRMED_FROM_CODE`; customer return flow `NEEDS_VERIFICATION` | `AdminReturnController`, `AdminReturnService`, `CreateReturnRequest.java` |
| Backend | Media | Media upload/storage lifecycle. | Multipart upload, list, detail, update, delete, restore. | `CONFIRMED_FROM_CODE` | `AdminMediaController`, `AdminMediaService`, `MinioConfig` |
| Backend | Content / SEO | Articles/pages/public content. | Admin content CRUD, public content reads, SEO fields inferred. | `CONFIRMED_FROM_CODE` | `AdminContentController`, `ContentController` |
| Backend | User / RBAC | Admin users/roles/permissions. | Admin users, roles, permission checks. | `CONFIRMED_FROM_CODE`; full permission matrix `NEEDS_VERIFICATION` | `AdminAdminUsersController`, `AdminRolesController`, `DevAdminAuthService`, `SecurityConfig` |
| Backend | Settings / Menu / Coupon | Operational configuration. | Settings CRUD/public settings, menu CRUD/public menus, coupons. | `CONFIRMED_FROM_CODE` | `AdminSettingsController`, `AdminMenuController`, `AdminCouponController`, `PHASE_1J_ADMIN_SETTINGS_MENU_COUPON_API_REPORT.md` |
| Backend | Reports / Dashboard | Analytics and export. | Analytics, CSV export orders/customers/products, dashboard summary. | `CONFIRMED_FROM_CODE` | `AdminReportController`, `AdminDashboardController` |
| Backend | Notification | Email/admin realtime events. | Order confirmation/admin notification/status update/return notification, websocket push. | `CONFIRMED_FROM_CODE`; runtime delivery `NEEDS_VERIFICATION` | `CheckoutService`, `AdminOrderService`, `AdminReturnService`, `OrderNotificationService`, `AdminOrderWsService` |
| Backend | Search | Public search/suggest. | Search endpoints and security permitAll. | `CONFIRMED_FROM_CODE` | `PublicSearchController`, `SecurityConfig` |
| Backend | Contact | Public contact form. | Contact submission. | `CONFIRMED_FROM_CODE` | `ContactController`, `SecurityConfig` |
| Backend | Redirect / Migration | Legacy WordPress URL handling and migration. | Internal redirect endpoints, WordPress migration package. | `CONFIRMED_FROM_CODE`; coverage `NEEDS_VERIFICATION` | `InternalRedirectController`, `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/migration/wordpress/**` |
| Backend | Audit Log | Audit admin/system actions. | Audit log entity/repository/controller, action logging in services. | `CONFIRMED_FROM_CODE` | `AdminAuditLogController`, `AdminOrderService`, `PHASE_1J_ADMIN_SETTINGS_MENU_COUPON_API_REPORT.md` |

### Shared / Cross-cutting Modules

| App / Layer | Module | Purpose | Main Features | Status | Evidence |
|---|---|---|---|---|---|
| Cross-cutting | Security | Protect API and enforce boundaries. | JWT filter, customer session filter, CSRF, rate limiting, security headers. | `CONFIRMED_FROM_CODE` | `SecurityConfig`, `JwtAuthFilter`, `CustomerSessionFilter`, `CustomerCsrfFilter`, `RateLimitingFilter`, `SecurityHeadersFilter` |
| Cross-cutting | Validation | Validate request and business input. | Bean validation, custom validation exceptions, service-level business validation. | `CONFIRMED_FROM_CODE` | `AdminCatalogController`, `CheckoutService`, `AdminOrderService`, `ValidationException.java` |
| Cross-cutting | Error Handling | Standard API error shape. | Global exception handler and error DTOs. | `CONFIRMED_FROM_CODE` | `GlobalExceptionHandler`, `ApiErrorResponse.java`, `ValidationErrorMapper.java` |
| Cross-cutting | API Response Shape | Standard data/list/meta response. | ApiDataResponse, ApiListResponse, ApiResponseFactory. | `CONFIRMED_FROM_CODE` | `ApiDataResponse.java`, `ApiListResponse.java`, `ApiResponseFactory.java` |
| Cross-cutting | Design System | Brand/UI source of truth. | Colors, typography, logos, icons, UI kits. | `CONFIRMED_FROM_CODE` | `Bigbike Design System/README.md`, `Bigbike Design System/colors_and_type.css` |
| Cross-cutting | Configuration | App/env/runtime config. | Docker Compose, application profiles, frontend env examples. | `CONFIRMED_FROM_CODE` | `docker-compose.yaml`, `README.md`, `application.properties` |
| Cross-cutting | Observability / Logging | Request id, structured logging, audit logs. | RequestIdFilter, logback, audit log. | `CONFIRMED_FROM_CODE`; monitoring stack `NEEDS_VERIFICATION` | `RequestIdFilter`, `logback-spring.xml`, `AdminAuditLogController` |
| Integration | Media Storage | Object storage for media. | MinIO service/config/SDK. | `CONFIRMED_FROM_CODE` | `docker-compose.yaml`, `MinioConfig`, `MinioProperties`, `AdminMediaController` |
| Integration | Email | Transactional email. | Mail config/dependency and notification service usage. | `CONFIRMED_FROM_CODE` for code paths; production delivery `NEEDS_VERIFICATION` | `bigbike-backend/pom.xml`, `docker-compose.yaml`, `OrderNotificationService` |
| Integration | Analytics | Frontend analytics/GTM/Sentry references. | Home analytics, GTM/Sentry env/deps. | `INFERRED_FROM_STRUCTURE`; production analytics config `NEEDS_VERIFICATION` | `bigbike-web/app/page.tsx`, `bigbike-web/package.json`, `docker-compose.yaml` |
| Integration | External Payment Provider | Payment provider/webhook integration. | Not found in audited evidence. | `NOT_FOUND_IN_REPO` | N/A |
| Integration | External Shipping Provider | Carrier API integration. | Not found in audited evidence. | `NOT_FOUND_IN_REPO` | N/A |

## 5. Public Web Modules

### Module: Homepage

| Field | Value |
|---|---|
| Purpose | Landing page phục vụ SEO, trust, product discovery và conversion. |
| Primary Users | Guest, Customer |
| Status | `CONFIRMED_FROM_CODE` |
| Evidence | `bigbike-web/app/page.tsx` |

#### Features

| Feature | Purpose | Status | Evidence | Notes |
|---|---|---|---|---|
| Hero slider | Hiển thị banner chính. | `CONFIRMED_FROM_CODE` | `bigbike-web/app/page.tsx`, `HeroSlider` | Data từ `listHomeSliders`. |
| Trust rail | Tạo niềm tin mua hàng. | `CONFIRMED_FROM_CODE` | `bigbike-web/app/page.tsx` | Static items chính hãng/giao hàng/tư vấn. |
| Featured products | Đẩy sản phẩm nổi bật. | `CONFIRMED_FROM_CODE` | `bigbike-web/app/page.tsx` | Uses `listProducts({ filterFeatured: true })`. |
| Category grid | Browse danh mục. | `CONFIRMED_FROM_CODE` | `bigbike-web/app/page.tsx` | Uses `listCategories`. |
| Article/news sections | SEO/content/trust. | `CONFIRMED_FROM_CODE` | `bigbike-web/app/page.tsx` | Experience/blog categories. |
| Brand carousel | Hiển thị thương hiệu. | `CONFIRMED_FROM_CODE` | `bigbike-web/app/page.tsx` | Uses `listBrands`. |
| Home video carousel | Visual product experience. | `CONFIRMED_FROM_CODE` | `bigbike-web/app/page.tsx` | Uses `listHomeVideos`. |
| SEO metadata/JSON-LD | SEO technical support. | `CONFIRMED_FROM_CODE` | `bigbike-web/app/page.tsx` | Organization, Website, LocalBusiness, FAQ JSON-LD. |

#### Related Business Processes

- Customer Browsing Process
- Content / SEO Management Process
- Product Publishing Process

#### Related Workflows

- Homepage discovery → product/category/article navigation.

#### Needs Verification

- Runtime load/performance.
- Whether all fallback content matches current business copy.
- Test coverage for homepage rendering and SEO metadata.

### Module: Product Listing

| Field | Value |
|---|---|
| Purpose | Cho khách browse và lọc catalog sản phẩm. |
| Primary Users | Guest, Customer |
| Status | `CONFIRMED_FROM_CODE` |
| Evidence | `bigbike-web/lib/utils/routes.ts`, `CatalogController` |

#### Features

| Feature | Purpose | Status | Evidence | Notes |
|---|---|---|---|---|
| Product list route | Browse catalog. | `CONFIRMED_FROM_CODE` | `toProductListPath`, mobile `/san-pham` | Web route helper + mobile route. |
| Filter by category/brand/query | Narrow results. | `CONFIRMED_FROM_CODE` | `CatalogController` | Params category, brand, q. |
| Filter by color/gender/price | Product filtering. | `CONFIRMED_FROM_CODE` | `CatalogController` | `filter_color`, `filter_gender`, `min_price`, `max_price`. |
| Pagination/sort | Scale list browsing. | `CONFIRMED_FROM_CODE` | `CatalogController` | page/size/sort. |
| Public status filtering | Avoid leaking unpublished products. | `NEEDS_VERIFICATION` | `CatalogReadService` | Controller exists; service should be audited. |

#### Related Business Processes

- Customer Product Browsing
- Product Publishing

#### Related Workflows

- Browse product list → product detail → cart/checkout.

#### Needs Verification

- UI loading/empty/error states.
- Public filtering by publish status and visibility.
- Test coverage for filters/sort/pagination.

### Module: Product Detail

| Field | Value |
|---|---|
| Purpose | Hiển thị thông tin chi tiết trước khi mua. |
| Primary Users | Guest, Customer |
| Status | `CONFIRMED_FROM_CODE` |
| Evidence | `bigbike-web/lib/utils/routes.ts`, `CatalogController` |

#### Features

| Feature | Purpose | Status | Evidence | Notes |
|---|---|---|---|---|
| Product detail route | PDP by slug. | `CONFIRMED_FROM_CODE` | `toProductPath`, mobile `/product/:slug` | Web/mobile route evidence. |
| Product by slug API | Load PDP data. | `CONFIRMED_FROM_CODE` | `CatalogController` | `/products/{slug}`. |
| Product snapshot | Refresh buy-box price/stock/variants. | `CONFIRMED_FROM_CODE` | `CatalogController` | `/products/{idOrSlug}/snapshot`. |
| Gallery/video/specifications/variants | Product-rich details. | `INFERRED_FROM_STRUCTURE` | `UpsertProductRequest`, domain catalog DTOs | Need UI-specific audit. |
| Add to cart / buy action | Move to purchase. | `INFERRED_FROM_STRUCTURE` | `CartController`, `CheckoutService` | PDP UI action needs screen audit. |

#### Related Business Processes

- Customer Product Browsing
- Cart / Checkout
- Inventory Management

#### Related Workflows

- Product detail → add to cart / quick-buy → checkout.

#### Needs Verification

- PDP UI state handling.
- Variant selection behavior.
- SEO metadata for PDP.

### Module: Category / Brand Browsing

| Field | Value |
|---|---|
| Purpose | Cho khách browse catalog theo taxonomy và thương hiệu. |
| Primary Users | Guest, Customer |
| Status | `CONFIRMED_FROM_CODE` |
| Evidence | `bigbike-web/lib/utils/routes.ts`, `CatalogController`, `bigbike_mobile/lib/core/router/app_router.dart` |

#### Features

| Feature | Purpose | Status | Evidence | Notes |
|---|---|---|---|---|
| Category list/detail | Browse theo danh mục. | `CONFIRMED_FROM_CODE` | `CatalogController`, route helpers | `/categories`, `/categories/{slug}`. |
| Brand list/detail | Browse theo thương hiệu. | `CONFIRMED_FROM_CODE` | `CatalogController`, route helpers | `/brands`, `/brands/{slug}`. |
| Homepage category surface | Entry point to categories. | `CONFIRMED_FROM_CODE` | `bigbike-web/app/page.tsx` | Category grid. |
| Visibility/filterHome | Control category homepage visibility. | `CONFIRMED_FROM_CODE` | `CatalogController` | `showOnHomepage`, `filterHome`. |

#### Related Business Processes

- Customer Browsing
- Product Management

#### Needs Verification

- Category hierarchy behavior.
- SEO metadata for category/brand pages.

### Module: Search

| Field | Value |
|---|---|
| Purpose | Tìm kiếm sản phẩm/content nhanh. |
| Primary Users | Guest, Customer |
| Status | `CONFIRMED_FROM_CODE` |
| Evidence | `PublicSearchController`, `SecurityConfig`, `bigbike_mobile/lib/core/router/app_router.dart` |

#### Features

| Feature | Purpose | Status | Evidence | Notes |
|---|---|---|---|---|
| Search route | User search UI. | `CONFIRMED_FROM_CODE` | mobile `/tim-kiem`, web route helper inferred | Web route helper has search path usage in previous audit. |
| Search endpoint | Backend search. | `CONFIRMED_FROM_CODE` | `PublicSearchController`, `SecurityConfig` | `/api/v1/search`, `/api/v1/search-suggest`. |
| Search suggestion | Autocomplete/search assist. | `CONFIRMED_FROM_CODE` | `SecurityConfig` | Service behavior should be audited. |

#### Related Business Processes

- Customer Browsing

#### Needs Verification

- Search ranking/scoring behavior.
- UI empty/error/loading states.

### Module: Cart

| Field | Value |
|---|---|
| Purpose | Lưu sản phẩm trước checkout cho guest/customer. |
| Primary Users | Guest, Customer |
| Status | `CONFIRMED_FROM_CODE` |
| Evidence | `CartController`, `SecurityConfig`, `bigbike-web/lib/utils/routes.ts` |

#### Features

| Feature | Purpose | Status | Evidence | Notes |
|---|---|---|---|---|
| Cart route | Xem giỏ hàng. | `CONFIRMED_FROM_CODE` | `toCartPath`, mobile `/gio-hang` | Web/mobile route. |
| Guest cart | Cho guest mua không cần login. | `CONFIRMED_FROM_CODE` | `SecurityConfig`, `CheckoutController` | Guest cookie/cart handling. |
| Customer cart | Cart gắn customer khi logged in. | `CONFIRMED_FROM_CODE` | `CheckoutController`, `CartService` | Customer principal support. |
| Cart item mutation | Add/update/remove item. | `CONFIRMED_FROM_CODE` | `CartController`, cart DTOs | Need exact endpoint detail in API contract, not here. |
| Coupon on cart | Apply coupon before order. | `PARTIAL` | `CheckoutService`, cart coupon repositories | Docs/code drift needs verify. |

#### Related Business Processes

- Cart / Checkout
- Coupon / Settings

#### Needs Verification

- Cart merge after login, previously deferred in Phase 1F report.
- Coupon application tests/current behavior.

### Module: Checkout

| Field | Value |
|---|---|
| Purpose | Tạo order từ cart hoặc quick-buy. |
| Primary Users | Guest, Customer |
| Status | `CONFIRMED_FROM_CODE` |
| Evidence | `CheckoutController`, `CheckoutService`, `PHASE_1F_CHECKOUT_API_REPORT.md` |

#### Features

| Feature | Purpose | Status | Evidence | Notes |
|---|---|---|---|---|
| Checkout from cart | Convert cart to order. | `CONFIRMED_FROM_CODE` | `CheckoutService` | Validates cart/address/payment/shipping/stock/price. |
| Quick-buy | Tạo order trực tiếp từ product. | `CONFIRMED_FROM_CODE` | `CheckoutController`, `CheckoutService` | No cart required. |
| Checkout options | Payment/shipping choices. | `CONFIRMED_FROM_CODE` | `CheckoutService` | COD/BACS + enabled shipping methods. |
| Price/stock validation | Prevent oversell/wrong price. | `CONFIRMED_FROM_CODE` | `CheckoutService` | Syncs price and validates stock. |
| Order summary | Return order status/totals. | `CONFIRMED_FROM_CODE` | `OrderSummaryResponse.java` | Order number/key/status/paymentStatus. |
| Notification after checkout | Notify customer/admin. | `CONFIRMED_FROM_CODE`; delivery `NEEDS_VERIFICATION` | `CheckoutService`, `OrderNotificationService` | Mail runtime not tested here. |

#### Related Business Processes

- Cart / Checkout
- Order Management
- Payment Handling
- Inventory Management

#### Needs Verification

- Frontend submit/double-submit UX.
- Coupon behavior vs docs drift.
- Fresh test run.

### Module: Blog / Content

| Field | Value |
|---|---|
| Purpose | Public articles/pages/policy/guide content. |
| Primary Users | Guest, Customer, Content Editor |
| Status | `CONFIRMED_FROM_CODE` |
| Evidence | `bigbike-web/app/page.tsx`, `bigbike-web/lib/utils/routes.ts`, `ContentController`, `AdminContentController` |

#### Features

| Feature | Purpose | Status | Evidence | Notes |
|---|---|---|---|---|
| Article list/detail | Tin tức/blog. | `CONFIRMED_FROM_CODE` | route helpers, mobile routes | `/tin-tuc`, `/tin-tuc/:slug`. |
| CMS pages | Policy/guide/catch-all pages. | `CONFIRMED_FROM_CODE` | mobile content route, web route helpers | `/chinh-sach/:slug`, `/huong-dan/:slug`, catch-all. |
| Homepage article sections | Promote content. | `CONFIRMED_FROM_CODE` | `bigbike-web/app/page.tsx` | Experience/news sections. |
| SEO content bottom | Crawlable SEO content. | `CONFIRMED_FROM_CODE` | `bigbike-web/app/page.tsx` | Fallback and settings-driven content. |

#### Related Business Processes

- Content / SEO Management
- Customer Browsing

#### Needs Verification

- Full content editor UX.
- SEO metadata per article/page.

### Module: Contact

| Field | Value |
|---|---|
| Purpose | Cho khách gửi liên hệ/tư vấn. |
| Primary Users | Guest, Customer |
| Status | `CONFIRMED_FROM_CODE` |
| Evidence | `ContactController`, `bigbike_mobile/lib/core/router/app_router.dart`, `SecurityConfig` |

#### Features

| Feature | Purpose | Status | Evidence | Notes |
|---|---|---|---|---|
| Contact route | Customer contact screen/page. | `CONFIRMED_FROM_CODE` | mobile `/lien-he`; web support inferred | Need deeper web screen audit. |
| Contact submission | Store/handle customer contact request. | `CONFIRMED_FROM_CODE` | `ContactController`, `ContactRequest.java` | Backend public endpoint. |

#### Needs Verification

- Admin follow-up workflow for contact requests.
- Notification after contact submission.

### Module: SEO / Metadata / Redirect

| Field | Value |
|---|---|
| Purpose | Tối ưu crawlability, metadata, canonical URL và legacy URL continuity. |
| Primary Users | Guest, SEO Admin, System |
| Status | `CONFIRMED_FROM_CODE` for metadata/redirect tooling; `NEEDS_VERIFICATION` for full SEO migration coverage |
| Evidence | `bigbike-web/app/page.tsx`, `bigbike-web/lib/utils/routes.ts`, `InternalRedirectController`, `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/migration/wordpress/**` |

#### Features

| Feature | Purpose | Status | Evidence | Notes |
|---|---|---|---|---|
| Homepage metadata | SEO title/description/OG. | `CONFIRMED_FROM_CODE` | `bigbike-web/app/page.tsx` | Uses public settings fallback. |
| JSON-LD | Structured data. | `CONFIRMED_FROM_CODE` | `bigbike-web/app/page.tsx` | Organization/WebSite/LocalBusiness/FAQ. |
| Canonical route helper | Stable URLs. | `CONFIRMED_FROM_CODE` | `bigbike-web/lib/utils/routes.ts` | `toCanonicalUrl`. |
| Legacy redirects | Preserve old URLs. | `CONFIRMED_FROM_CODE`; coverage `NEEDS_VERIFICATION` | `InternalRedirectController`, `bigbike-web/docs/` | Need SEO migration audit. |
| Sitemap/robots | Search engine discovery/control. | `NEEDS_VERIFICATION` | Not audited deeply in this task | Search needed later. |

## 6. Admin Portal Modules

### Module: Dashboard

| Field | Value |
|---|---|
| Purpose | Tổng quan vận hành cho admin/manager. |
| Primary Users | Admin, Manager |
| Status | `CONFIRMED_FROM_CODE`; metric semantics `NEEDS_VERIFICATION` |
| Evidence | `bigbike-admin/README.md`, `AdminDashboardController` |

#### Features

| Feature | Purpose | Status | Evidence | Notes |
|---|---|---|---|---|
| Dashboard route | Access overview. | `CONFIRMED_FROM_CODE` | `bigbike-admin/README.md` | Route-level evidence. |
| Dashboard summary API | Backend summary data. | `CONFIRMED_FROM_CODE` | `AdminDashboardController` | Need metric definition audit. |

#### Related Permissions

- Usually admin read/dashboard access, exact permission needs verification from controller/service.

#### Needs Verification

- Metric formulas.
- UI loading/error/empty states.
- Test coverage.

### Module: Products

| Field | Value |
|---|---|
| Purpose | Quản lý product catalog. |
| Primary Users | Admin, Staff |
| Status | `CONFIRMED_FROM_CODE` |
| Evidence | `bigbike-admin/README.md`, `bigbike-admin/src/lib/adminApi.js`, `AdminCatalogController` |

#### Features

| Feature | Purpose | Status | Evidence | Notes |
|---|---|---|---|---|
| Product list | Admin browse products. | `CONFIRMED_FROM_CODE` | `AdminCatalogController` | Filters q/search/publishStatus/stockState/brand/category. |
| Product detail | Admin inspect product. | `CONFIRMED_FROM_CODE` | `AdminCatalogController` | `getProductById`. |
| Create product | Add product. | `CONFIRMED_FROM_CODE` | `AdminCatalogController` | Requires `products.update`. |
| Edit product | Update product data. | `CONFIRMED_FROM_CODE` | `AdminCatalogController` | Requires `products.update`. |
| Publish status update | Change visibility/lifecycle. | `CONFIRMED_FROM_CODE` | `AdminCatalogController` | `PATCH /publish`. |
| Soft delete product | Move to trash. | `CONFIRMED_FROM_CODE` | `AdminCatalogController` | Comment says soft-delete to `TRASH`. |
| Product media/spec/variant fields | Rich product data. | `CONFIRMED_FROM_CODE` for DTO support; UI completeness `NEEDS_VERIFICATION` | `UpsertProductRequest.java`, DTOs `GalleryImageRequest`, `VariantRequest`, `SpecificationRequest` | Needs UI field audit. |
| Product SEO fields | SEO metadata. | `INFERRED_FROM_STRUCTURE` | `SeoMetaRequest.java`, product domain SEO classes | Need product UI/API audit. |

#### Related Permissions

- `products.read`
- `products.update`

#### Related Business Processes

- Product Management
- Product Publishing
- Inventory Management

#### Needs Verification

- Separate `products.create` vs `products.update` semantics; controller uses `products.update` for create/update/delete.
- UI form validation and test coverage.

### Module: Categories

| Field | Value |
|---|---|
| Purpose | Quản lý taxonomy sản phẩm. |
| Primary Users | Admin, Staff |
| Status | `CONFIRMED_FROM_CODE` |
| Evidence | `AdminCatalogController`, `bigbike-admin/README.md` |

#### Features

| Feature | Purpose | Status | Evidence | Notes |
|---|---|---|---|---|
| Category list/detail | Manage categories. | `CONFIRMED_FROM_CODE` | `AdminCatalogController` | Filter q/search/visibility. |
| Create/update category | Add/update taxonomy. | `CONFIRMED_FROM_CODE` | `AdminCatalogController` | Requires `catalog.update`. |
| Soft delete category | Hide category. | `CONFIRMED_FROM_CODE` | `AdminCatalogController` | `is_visible=false`. |
| Public category browse | Customer-facing taxonomy. | `CONFIRMED_FROM_CODE` | `CatalogController` | Public `/categories`. |

#### Related Permissions

- `catalog.read`
- `catalog.update`

### Module: Brands

| Field | Value |
|---|---|
| Purpose | Quản lý thương hiệu sản phẩm. |
| Primary Users | Admin, Staff |
| Status | `CONFIRMED_FROM_CODE` |
| Evidence | `AdminCatalogController`, `CatalogController` |

#### Features

| Feature | Purpose | Status | Evidence | Notes |
|---|---|---|---|---|
| Brand list/detail | Manage brands. | `CONFIRMED_FROM_CODE` | `AdminCatalogController` | Filter q/search/visibility. |
| Create/update/delete brand | Maintain brand catalog. | `CONFIRMED_FROM_CODE` | `AdminCatalogController` | Delete behavior should be audited for soft vs hard. |
| Public brand browse | Customer browse by brand. | `CONFIRMED_FROM_CODE` | `CatalogController`, route helpers | Public `/brands`. |

#### Related Permissions

- `catalog.read`
- `catalog.update`

### Module: Orders

| Field | Value |
|---|---|
| Purpose | Quản lý vòng đời đơn hàng. |
| Primary Users | Admin, Staff, Manager |
| Status | `CONFIRMED_FROM_CODE` |
| Evidence | `AdminOrderController`, `AdminOrderService`, `bigbike-admin/src/lib/adminApi.js` |

#### Features

| Feature | Purpose | Status | Evidence | Notes |
|---|---|---|---|---|
| Order list/filter | Theo dõi đơn hàng. | `CONFIRMED_FROM_CODE` | `AdminOrderController`, `AdminOrderService` | status/payment/q/date/sort. |
| Order detail | Xem đầy đủ dữ liệu đơn. | `CONFIRMED_FROM_CODE` | `AdminOrderService` | line items, addresses, shipping, payments, notes, coupons. |
| Allowed transitions | Prevent invalid status actions. | `CONFIRMED_FROM_CODE` | `AdminOrderController`, `AdminOrderService` | Used for admin UI. |
| Update order status | Process/cancel/complete/refund. | `CONFIRMED_FROM_CODE` | `AdminOrderService` | Transition validation. |
| Update payment status | Record payment state. | `CONFIRMED_FROM_CODE` | `AdminOrderService` | Payment transition validation. |
| Create refund | Refund paid/partially paid order. | `CONFIRMED_FROM_CODE` | `AdminOrderService` | Validates refundable amount. |
| Notes | Internal/customer-visible notes. | `CONFIRMED_FROM_CODE` | `AdminOrderController`, `AdminOrderService` | Adds audit/websocket. |
| Audit + notification | Trace and notify order changes. | `CONFIRMED_FROM_CODE` | `AdminOrderService` | Email delivery runtime needs verify. |
| Export orders | Operational export. | `CONFIRMED_FROM_CODE` | `AdminReportController` | CSV. |

#### Related Permissions

- `orders.read`
- `orders.write`

#### Needs Verification

- Fulfillment/tracking provider flow.
- Test coverage current beyond phase reports.

### Module: Customers

| Field | Value |
|---|---|
| Purpose | Quản lý customer/account data. |
| Primary Users | Admin, Staff, Customer |
| Status | `CONFIRMED_FROM_CODE` |
| Evidence | `AdminCustomerController`, `CustomerAuthController`, `CustomerController`, `CustomerAddressController`, `PHASE_1D_CUSTOMER_AUTH_REPORT.md` |

#### Features

| Feature | Purpose | Status | Evidence | Notes |
|---|---|---|---|---|
| Customer register/login/session | Customer account access. | `CONFIRMED_FROM_CODE` | `PHASE_1D_CUSTOMER_AUTH_REPORT.md`, `CustomerAuthController` | Cookie session + CSRF foundation. |
| Customer profile | Customer self-management. | `CONFIRMED_FROM_CODE` | `CustomerController`, `SecurityConfig` | `/customer/me`. |
| Customer addresses | Manage shipping/billing addresses. | `CONFIRMED_FROM_CODE` | `CustomerAddressController`, `SecurityConfig` | ROLE_CUSTOMER protected. |
| Customer orders | View order history/details. | `CONFIRMED_FROM_CODE` | `CustomerOrderController`, `SecurityConfig` | ROLE_CUSTOMER protected. |
| Admin customer list/detail/update | Admin customer management. | `CONFIRMED_FROM_CODE` | `AdminCustomerController` | Details should be audited for exact fields. |
| Customer session management | Session persistence/refresh/logout. | `CONFIRMED_FROM_CODE`; cleanup job `NEEDS_VERIFICATION` | `PHASE_1D_CUSTOMER_AUTH_REPORT.md` | Report notes no session cleanup job. |

#### Related Permissions

- Customer protected routes require `ROLE_CUSTOMER`.
- Admin side likely `customers.read` / customer write permissions; exact update permissions need controller audit.

#### Needs Verification

- Production auth hardening.
- Password reset/email verification runtime completeness.
- Admin UI customer actions.

### Module: Inventory

| Field | Value |
|---|---|
| Purpose | Quản lý tồn kho và stock movements. |
| Primary Users | Admin, Staff, System |
| Status | `CONFIRMED_FROM_CODE` |
| Evidence | `AdminInventoryController`, `CheckoutService`, `AdminOrderService`, `AdminReturnService` |

#### Features

| Feature | Purpose | Status | Evidence | Notes |
|---|---|---|---|---|
| Stock list | Xem tồn kho. | `CONFIRMED_FROM_CODE` | `AdminInventoryController` | q/stockState filters. |
| Inventory summary | Tổng quan kho. | `CONFIRMED_FROM_CODE` | `AdminInventoryController` | `/summary`. |
| Stock movements | Audit stock changes. | `CONFIRMED_FROM_CODE` | `AdminInventoryController`, `CheckoutService` | Movement OUT/IN references. |
| Adjust stock | Điều chỉnh tồn kho thủ công. | `CONFIRMED_FROM_CODE` | `AdminInventoryController` | Requires `products.update`. |
| Export inventory | CSV inventory export. | `CONFIRMED_FROM_CODE` | `AdminInventoryController` | `/export.csv`. |
| Checkout decrement | Trừ kho khi đặt hàng. | `CONFIRMED_FROM_CODE` | `CheckoutService` | Product/variant support. |
| Restore stock | Trả kho khi cancel/refund/return. | `CONFIRMED_FROM_CODE` | `AdminOrderService`, `AdminReturnService` | Return completed/restored. |
| Serial inventory | Serial-level tracking. | `INFERRED_FROM_STRUCTURE` | `StockMovementSerialEntity.java` | Needs deeper audit. |

#### Related Permissions

- `products.read`
- `products.update`

### Module: Media

| Field | Value |
|---|---|
| Purpose | Quản lý media assets cho product/content/homepage. |
| Primary Users | Admin, Staff, Content Editor |
| Status | `CONFIRMED_FROM_CODE` |
| Evidence | `AdminMediaController`, `AdminMediaService`, `MinioConfig`, `docker-compose.yaml` |

#### Features

| Feature | Purpose | Status | Evidence | Notes |
|---|---|---|---|---|
| Upload media | Add file to media library. | `CONFIRMED_FROM_CODE` | `AdminMediaController` | Multipart upload. |
| List/filter media | Browse library. | `CONFIRMED_FROM_CODE` | `AdminMediaController` | q/mimeType/status/provider. |
| Media detail | Inspect asset. | `CONFIRMED_FROM_CODE` | `AdminMediaController` | Detail response. |
| Update metadata | Alt/status/metadata maintenance. | `CONFIRMED_FROM_CODE` | `AdminMediaController`, `UpdateMediaRequest.java` | Supports SEO/accessibility. |
| Soft delete | Hide/remove asset without immediate hard delete. | `CONFIRMED_FROM_CODE` | `AdminMediaController` | `permanent=false`. |
| Hard delete | Permanent deletion. | `CONFIRMED_FROM_CODE` | `AdminMediaController` | `permanent=true`. |
| Restore media | Recover soft-deleted media. | `CONFIRMED_FROM_CODE` | `AdminMediaController` | `/restore`. |
| MinIO storage | Store media objects. | `CONFIRMED_FROM_CODE` | `MinioConfig`, `docker-compose.yaml` | External storage runtime needs verify. |

#### Related Permissions

- `media.read`
- `media.write`

### Module: Content / Blog / Page

| Field | Value |
|---|---|
| Purpose | Quản lý nội dung public và SEO content. |
| Primary Users | Admin, Content Editor |
| Status | `CONFIRMED_FROM_CODE` |
| Evidence | `AdminContentController`, `ContentController`, `bigbike-web/app/page.tsx` |

#### Features

| Feature | Purpose | Status | Evidence | Notes |
|---|---|---|---|---|
| Content list | Manage articles/pages. | `CONFIRMED_FROM_CODE` | `AdminContentController` | type/publishStatus/search. |
| Create/update article | Blog/news. | `CONFIRMED_FROM_CODE` | `AdminContentController` | `content.update`. |
| Create/update page | CMS/policy/guide. | `CONFIRMED_FROM_CODE` | `AdminContentController` | `content.update`. |
| Delete article/page | Remove content. | `CONFIRMED_FROM_CODE` | `AdminContentController` | Exact soft/hard behavior needs service audit. |
| Public content read | Serve content to web/mobile. | `CONFIRMED_FROM_CODE` | `ContentController`, route helpers | Public article/page routes. |
| Publish status | Control visibility. | `CONFIRMED_FROM_CODE` | `AdminContentController` | `DRAFT`, `PUBLISHED`, `HIDDEN`, `ARCHIVED`. |
| Rich editor UI | Content editing UX. | `INFERRED_FROM_STRUCTURE` | `bigbike-admin/package.json` includes TipTap | UI screen audit needed. |

#### Related Permissions

- `content.read`
- `content.update`

### Module: Settings / Menus / Coupons

| Field | Value |
|---|---|
| Purpose | Cấu hình hệ thống, public menu và campaign coupon. |
| Primary Users | Admin, Staff |
| Status | `CONFIRMED_FROM_CODE`; coupon checkout drift `NEEDS_VERIFICATION` |
| Evidence | `PHASE_1J_ADMIN_SETTINGS_MENU_COUPON_API_REPORT.md`, `AdminSettingsController`, `AdminMenuController`, `AdminCouponController`, `CheckoutService` |

#### Features

| Feature | Purpose | Status | Evidence | Notes |
|---|---|---|---|---|
| Settings list/get/update | Manage site settings. | `CONFIRMED_FROM_CODE` | `AdminSettingsController`, Phase 1J report | Sensitive key public guard. |
| Public settings | Web consumes public settings. | `CONFIRMED_FROM_CODE` | `PublicSettingsController`, `bigbike-web/app/page.tsx` | Home SEO/promo/about content. |
| Menu CRUD | Manage nav menus. | `CONFIRMED_FROM_CODE` | `AdminMenuController`, Phase 1J report | Location uniqueness. |
| Menu item CRUD/reorder | Manage menu structure. | `CONFIRMED_FROM_CODE` | `AdminMenuController`, Phase 1J report | Public active-only items. |
| Public menu | Frontend navigation. | `CONFIRMED_FROM_CODE` | `PublicMenuController` | Public endpoint. |
| Coupon CRUD | Manage coupons. | `CONFIRMED_FROM_CODE` | `AdminCouponController`, Phase 1J report | Validation rules. |
| Coupon status update | Activate/inactivate/expire coupon. | `CONFIRMED_FROM_CODE` | `AdminCouponController` | Status update endpoint. |
| Coupon application in checkout | Apply discount to order. | `PARTIAL` | `CheckoutService`, Phase 1J report | Code suggests support; old report says deferred. Needs test/runtime verification. |

#### Related Permissions

- `settings.read`, `settings.write`
- `menus.read`, `menus.write`
- `coupons.read`, `coupons.write`

### Module: Reports

| Field | Value |
|---|---|
| Purpose | Analytics và data export phục vụ vận hành. |
| Primary Users | Admin, Manager |
| Status | `CONFIRMED_FROM_CODE`; metric semantics `NEEDS_VERIFICATION` |
| Evidence | `AdminReportController`, `AdminInventoryController` |

#### Features

| Feature | Purpose | Status | Evidence | Notes |
|---|---|---|---|---|
| Analytics | Operational metrics. | `CONFIRMED_FROM_CODE` | `AdminReportController` | Date range support. |
| Export orders | CSV order export. | `CONFIRMED_FROM_CODE` | `AdminReportController` | status/payment/date filters. |
| Export customers | CSV customer export. | `CONFIRMED_FROM_CODE` | `AdminReportController` | status filter. |
| Export products | CSV product export. | `CONFIRMED_FROM_CODE` | `AdminReportController` | publishStatus filter. |
| Export inventory | CSV inventory export. | `CONFIRMED_FROM_CODE` | `AdminInventoryController` | Separate inventory endpoint. |

#### Related Permissions

- `orders.read`
- `customers.read`
- `products.read`

## 7. Backend Modules

### Module: Auth

| Field | Value |
|---|---|
| Purpose | Xác thực admin/customer và bảo vệ API. |
| Related APIs | Admin auth, customer auth, customer profile/session endpoints. |
| Related Models/Entities | Admin principal/user/role, customer session/token entities. |
| Related Services | JWT auth, customer auth/session/CSRF, dev admin auth. |
| Status | `CONFIRMED_FROM_CODE`; production auth `NEEDS_VERIFICATION` |
| Evidence | `SecurityConfig`, `AuthController`, `CustomerAuthController`, `PHASE_1D_CUSTOMER_AUTH_REPORT.md` |

#### Backend Features

| Feature | Purpose | Status | Evidence | Notes |
|---|---|---|---|---|
| Admin login/refresh/logout/me | Admin authentication. | `CONFIRMED_FROM_CODE` | `AuthController`, `SecurityConfig` | Dev/mock placeholder risk noted in prior overview. |
| Customer register/login/refresh/logout | Customer account access. | `CONFIRMED_FROM_CODE` | `CustomerAuthController`, Phase 1D report | Cookie session + refresh. |
| Customer CSRF | Protect non-safe customer mutations. | `CONFIRMED_FROM_CODE` | `CustomerCsrfFilter`, Phase 1D report | Double-submit pattern. |
| JWT filter | Bearer auth. | `CONFIRMED_FROM_CODE` | `JwtAuthFilter`, `SecurityConfig` | Admin/customer boundary. |
| Role-based access | Admin/customer route protection. | `CONFIRMED_FROM_CODE` | `SecurityConfig` | `/admin/**` requires ROLE_ADMIN. |

### Module: Catalog

| Field | Value |
|---|---|
| Purpose | Product/category/brand public và admin management. |
| Related APIs | Public catalog APIs, admin catalog APIs. |
| Related Models/Entities | Product, Category, Brand, Price, Stock State, Publish Status, SEO/media/variants/specifications. |
| Related Services | CatalogReadService, AdminCatalogReadService, AdminCatalogMutationService. |
| Status | `CONFIRMED_FROM_CODE` |
| Evidence | `CatalogController`, `AdminCatalogController` |

#### Backend Features

| Feature | Purpose | Status | Evidence | Notes |
|---|---|---|---|---|
| Public product/category/brand read | Customer browse. | `CONFIRMED_FROM_CODE` | `CatalogController` | Params validate slug/range. |
| Product snapshot | Refresh PDP price/stock. | `CONFIRMED_FROM_CODE` | `CatalogController` | Lightweight buy-box. |
| Admin product CRUD/publish/delete | Catalog management. | `CONFIRMED_FROM_CODE` | `AdminCatalogController` | Permission enforced. |
| Admin category/brand CRUD | Taxonomy/brand management. | `CONFIRMED_FROM_CODE` | `AdminCatalogController` | Permission enforced. |
| Product validation | Protect input/status. | `CONFIRMED_FROM_CODE` | `AdminCatalogController`, DTO validation | Details in service/DTO. |

### Module: Checkout / Orders / Payment

| Field | Value |
|---|---|
| Purpose | Convert cart/product intent into order and manage order/payment lifecycle. |
| Related APIs | Cart, checkout, quick-buy, order lookup, customer orders, admin orders. |
| Related Models/Entities | Cart, CartItem, Order, OrderLineItem, OrderAddress, OrderShippingItem, Payment, OrderNote, AppliedCoupon. |
| Related Services | CartService, CheckoutService, AdminOrderService, OrderNotificationService. |
| Status | `CONFIRMED_FROM_CODE`; external provider `NOT_FOUND_IN_REPO` |
| Evidence | `CartController`, `CheckoutController`, `CheckoutService`, `AdminOrderController`, `AdminOrderService` |

#### Backend Features

| Feature | Purpose | Status | Evidence | Notes |
|---|---|---|---|---|
| Checkout from cart | Create order from cart. | `CONFIRMED_FROM_CODE` | `CheckoutService` | Validates cart/address/payment/shipping/stock. |
| Quick-buy | Direct product order. | `CONFIRMED_FROM_CODE` | `CheckoutService` | Validates published/stock. |
| Payment method support | COD/BACS/manual. | `CONFIRMED_FROM_CODE` | `CheckoutService` | `ALLOWED_PAYMENT_METHODS`. |
| Admin order status transition | Control order lifecycle. | `CONFIRMED_FROM_CODE` | `AdminOrderService` | Rejects invalid transitions. |
| Admin payment transition | Control payment status. | `CONFIRMED_FROM_CODE` | `AdminOrderService` | paidAmount validation. |
| Refund | Refund paid/partial orders. | `CONFIRMED_FROM_CODE` | `AdminOrderService` | Updates order/payment. |
| Notifications/websocket | Realtime/admin/customer updates. | `CONFIRMED_FROM_CODE`; runtime `NEEDS_VERIFICATION` | `CheckoutService`, `AdminOrderService` | Uses services. |
| Payment webhook | Auto payment reconciliation. | `NOT_FOUND_IN_REPO` | N/A | No evidence found. |

### Module: Shipping

| Field | Value |
|---|---|
| Purpose | Manage shipping zones/methods and checkout shipping cost. |
| Related APIs | Admin shipping zones/methods, checkout options. |
| Related Models/Entities | ShippingZone, ShippingMethod, OrderShippingItem. |
| Related Services | AdminShippingService, CheckoutService. |
| Status | `CONFIRMED_FROM_CODE`; carrier integration `NOT_FOUND_IN_REPO` |
| Evidence | `AdminShippingController`, `CheckoutService` |

#### Backend Features

| Feature | Purpose | Status | Evidence | Notes |
|---|---|---|---|---|
| Zone CRUD | Manage shipping regions. | `CONFIRMED_FROM_CODE` | `AdminShippingController` | shipping.read/write. |
| Method CRUD | Manage methods/costs. | `CONFIRMED_FROM_CODE` | `AdminShippingController` | cost/min/free threshold. |
| Shipping method resolution | Choose shipping method at checkout. | `CONFIRMED_FROM_CODE` | `CheckoutService` | Auto-select if one enabled. |
| Shipping cost calculation | Add shipping fee. | `CONFIRMED_FROM_CODE` | `CheckoutService` | Free shipping threshold. |
| Carrier API/tracking | Provider fulfillment. | `NOT_FOUND_IN_REPO` | N/A | No provider-specific evidence. |

### Module: Inventory

| Field | Value |
|---|---|
| Purpose | Manage stock state and movement history. |
| Related APIs | Admin inventory list/summary/movements/adjust/export. |
| Related Models/Entities | Product, ProductVariant, StockMovement, StockMovementSerial. |
| Related Services | AdminInventoryService, InventoryPolicyService, CheckoutService, AdminOrderService, AdminReturnService. |
| Status | `CONFIRMED_FROM_CODE`; serial flow `INFERRED_FROM_STRUCTURE` |
| Evidence | `AdminInventoryController`, `CheckoutService`, `AdminOrderService`, `AdminReturnService` |

#### Backend Features

| Feature | Purpose | Status | Evidence | Notes |
|---|---|---|---|---|
| Stock list/summary | Operations visibility. | `CONFIRMED_FROM_CODE` | `AdminInventoryController` | products.read. |
| Movements | Stock audit trail. | `CONFIRMED_FROM_CODE` | `AdminInventoryController`, `CheckoutService` | Reference type ORDER/RETURN/ORDER_CANCEL. |
| Adjust stock | Manual correction. | `CONFIRMED_FROM_CODE` | `AdminInventoryController` | products.update. |
| Low stock recompute | Product stock state logic. | `CONFIRMED_FROM_CODE` | `InventoryPolicyService`, service callers | Threshold policy. |
| Serial-level movement | Track serials. | `INFERRED_FROM_STRUCTURE` | `StockMovementSerialEntity.java` | Need workflow audit. |

### Module: Media

| Field | Value |
|---|---|
| Purpose | Manage uploaded media and object storage. |
| Related APIs | Admin media upload/list/detail/update/delete/restore. |
| Related Models/Entities | Media entity/DTOs. |
| Related Services | AdminMediaService, MinIO config. |
| Status | `CONFIRMED_FROM_CODE` |
| Evidence | `AdminMediaController`, `MinioConfig`, `docker-compose.yaml` |

#### Backend Features

| Feature | Purpose | Status | Evidence | Notes |
|---|---|---|---|---|
| Multipart upload | Upload file. | `CONFIRMED_FROM_CODE` | `AdminMediaController` | media.write. |
| List/filter | Browse library. | `CONFIRMED_FROM_CODE` | `AdminMediaController` | q/mime/status/provider. |
| Update metadata | SEO/accessibility metadata. | `CONFIRMED_FROM_CODE` | `AdminMediaController` | UpdateMediaRequest. |
| Delete/restore | Lifecycle management. | `CONFIRMED_FROM_CODE` | `AdminMediaController` | Soft/hard delete. |
| Object storage | Store media. | `CONFIRMED_FROM_CODE` | `MinioConfig`, `docker-compose.yaml` | Runtime bucket access needs verify. |

### Module: Content / SEO / Redirect

| Field | Value |
|---|---|
| Purpose | Manage articles/pages and legacy SEO continuity. |
| Related APIs | Admin content, public content, redirects/internal redirects. |
| Related Models/Entities | Article, Page, SeoMeta, Redirect entities. |
| Related Services | AdminContentRead/Mutation, public content services, redirect resolver/migration utilities. |
| Status | `CONFIRMED_FROM_CODE`; migration completeness `NEEDS_VERIFICATION` |
| Evidence | `AdminContentController`, `ContentController`, `InternalRedirectController`, `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/migration/wordpress/**` |

#### Backend Features

| Feature | Purpose | Status | Evidence | Notes |
|---|---|---|---|---|
| Article/page admin | Content management. | `CONFIRMED_FROM_CODE` | `AdminContentController` | content.read/update. |
| Public content read | Serve content. | `CONFIRMED_FROM_CODE` | `ContentController` | Public pages/articles. |
| Publish status | Content lifecycle. | `CONFIRMED_FROM_CODE` | `AdminContentController` | DRAFT/PUBLISHED/HIDDEN/ARCHIVED. |
| Redirect management | Legacy URL continuity. | `CONFIRMED_FROM_CODE` | `AdminRedirectController`, `InternalRedirectController` | Coverage needs SEO audit. |
| WordPress migration | Migration support. | `CONFIRMED_FROM_CODE`; completeness `NEEDS_VERIFICATION` | `migration/wordpress/**`, README | Do not commit raw legacy data. |

### Module: User / RBAC

| Field | Value |
|---|---|
| Purpose | Manage internal admin access and enforce permissions. |
| Related APIs | Admin users, roles, auth/me, all admin endpoints. |
| Related Models/Entities | AdminUser, AdminRole, Permission-related models. |
| Related Services | DevAdminAuthService, auth services. |
| Status | `CONFIRMED_FROM_CODE`; full matrix `NEEDS_VERIFICATION` |
| Evidence | `SecurityConfig`, `AdminAdminUsersController`, `AdminRolesController`, `bigbike-admin/README.md` |

#### Backend Features

| Feature | Purpose | Status | Evidence | Notes |
|---|---|---|---|---|
| Admin role protection | Protect admin APIs. | `CONFIRMED_FROM_CODE` | `SecurityConfig` | `/api/v1/admin/**` requires ROLE_ADMIN. |
| Permission checks | Enforce module actions. | `CONFIRMED_FROM_CODE` | Admin controllers calling `requirePermission` | Backend-side enforcement. |
| Admin users | Manage admin accounts. | `CONFIRMED_FROM_CODE` | `AdminAdminUsersController` | UI completeness needs verify. |
| Roles | Manage roles/permissions. | `CONFIRMED_FROM_CODE` | `AdminRolesController` | Need full matrix. |

### Module: Notification / WebSocket

| Field | Value |
|---|---|
| Purpose | Notify customers/admins and push realtime admin events. |
| Related APIs | WebSocket endpoint and service-level notification calls. |
| Related Models/Entities | Order, Return, notification/email templates. |
| Related Services | OrderNotificationService, AdminOrderWsService. |
| Status | `CONFIRMED_FROM_CODE`; runtime delivery `NEEDS_VERIFICATION` |
| Evidence | `CheckoutService`, `AdminOrderService`, `AdminReturnService`, `WebSocketConfig`, `docker-compose.yaml` |

#### Backend Features

| Feature | Purpose | Status | Evidence | Notes |
|---|---|---|---|---|
| Order confirmation email | Customer confirmation. | `CONFIRMED_FROM_CODE` | `CheckoutService`, `OrderNotificationService` | SMTP runtime not tested. |
| Admin new order email | Alert admin. | `CONFIRMED_FROM_CODE` | `CheckoutService` | Depends mail config. |
| Order status email | Customer-visible status update. | `CONFIRMED_FROM_CODE` | `AdminOrderService` | customerVisible note support. |
| Return notification | Return status messages. | `CONFIRMED_FROM_CODE` | `AdminReturnService` | Approved/rejected/received/refunded. |
| Admin websocket events | Realtime admin UI. | `CONFIRMED_FROM_CODE` | `AdminOrderWsService`, `WebSocketConfig` | UI subscription needs verify. |

## 8. Shared / Cross-cutting Modules

| Module | Purpose | Used By | Status | Evidence | Needs Verification |
|---|---|---|---|---|---|
| Auth/session | Xác thực admin/customer. | Admin, customer, backend APIs. | `CONFIRMED_FROM_CODE` | `SecurityConfig`, `PHASE_1D_CUSTOMER_AUTH_REPORT.md` | Production auth provider, session cleanup. |
| Permission/RBAC | Enforce admin access. | All admin modules. | `CONFIRMED_FROM_CODE` | `SecurityConfig`, admin controllers, `bigbike-admin/README.md` | Full permission matrix. |
| Validation | Validate input and business rules. | Catalog, checkout, orders, shipping, media. | `CONFIRMED_FROM_CODE` | Controllers/services/DTOs, `ValidationException.java` | Frontend validation parity. |
| Error handling | Standard error behavior. | Backend API. | `CONFIRMED_FROM_CODE` | `GlobalExceptionHandler`, `ApiErrorResponse.java` | API contract doc alignment. |
| Logging / request id | Traceability. | Backend requests. | `CONFIRMED_FROM_CODE` | `RequestIdFilter`, logback config | Centralized monitoring. |
| File/media handling | Store and serve media. | Products/content/homepage/media admin. | `CONFIRMED_FROM_CODE` | `AdminMediaController`, `MinioConfig` | CDN/public URL runtime. |
| SEO metadata | Search visibility. | Public web/content/product/category. | `CONFIRMED_FROM_CODE` | `bigbike-web/app/page.tsx`, route helpers | Per-page SEO completeness. |
| Notification | Email/realtime. | Checkout, orders, returns. | `CONFIRMED_FROM_CODE` | `CheckoutService`, `AdminOrderService`, `AdminReturnService` | SMTP/WebSocket runtime. |
| Configuration | Runtime/env/app profiles. | All apps. | `CONFIRMED_FROM_CODE` | `docker-compose.yaml`, README | Secret management/deployment env. |
| Design system/shared UI | Brand consistency. | Public web/admin/mobile/design work. | `CONFIRMED_FROM_CODE` | `Bigbike Design System/README.md`, `colors_and_type.css` | Cross-app UI parity. |
| Tests/quality gates | Prevent regressions. | Backend/frontend. | `PARTIAL` | Phase reports, package scripts, Maven tests | Fresh full suite not run here. |

## 9. Module Dependencies

| Module | Depends On | Reason | Status |
|---|---|---|---|
| Homepage | Catalog, Content, Settings, Media, SEO | Homepage renders sliders, products, categories, articles, brands, settings and SEO data. | `CONFIRMED_FROM_CODE` |
| Product Listing | Catalog API, Product Publishing | List depends on public product/category/brand data and product visibility. | `CONFIRMED_FROM_CODE`; public status filter `NEEDS_VERIFICATION` |
| Product Detail | Catalog API, Inventory, Media | PDP requires product data, media and stock/price snapshot. | `CONFIRMED_FROM_CODE` |
| Cart | Catalog, Customer Session | Cart item operations depend on valid products and guest/customer identity. | `CONFIRMED_FROM_CODE` |
| Checkout | Cart, Product, Inventory, Payment, Shipping, Orders, Notification | Checkout validates stock/price, creates order/payment/shipping, notifies users/admin. | `CONFIRMED_FROM_CODE` |
| Orders | Payment, Inventory, Notification, Audit Log | Order updates affect payment state, stock restore, notifications and audit logs. | `CONFIRMED_FROM_CODE` |
| Returns | Orders, Inventory, Notification, Payment | Returns relate to order line items, refund amount/status and stock restore. | `CONFIRMED_FROM_CODE` |
| Inventory | Products/Variants, Orders, Returns | Stock changes come from product variants, checkout, cancellation/refund and return. | `CONFIRMED_FROM_CODE` |
| Media | Products, Content, Homepage | Media assets are used by product/content/homepage display. | `INFERRED_FROM_STRUCTURE` |
| Content/SEO | Settings, Media, Redirect | Content uses settings/media and affects redirect/SEO visibility. | `CONFIRMED_FROM_CODE` |
| Settings/Menu | Public Web | Public settings/menu drive site display/navigation. | `CONFIRMED_FROM_CODE` |
| Coupons | Cart, Checkout, Orders | Coupon can affect cart totals/order applied coupons; docs/code drift needs verify. | `PARTIAL` |
| Reports | Orders, Customers, Products, Inventory | Report/export pulls operational data from core modules. | `CONFIRMED_FROM_CODE` |
| RBAC | All Admin Modules | Admin modules require backend permission checks. | `CONFIRMED_FROM_CODE` |
| External Payment Provider | Payment | Would automate reconciliation/refund, but not found. | `NOT_FOUND_IN_REPO` |
| External Shipping Provider | Shipping/Orders | Would create tracking/waybill, but not found. | `NOT_FOUND_IN_REPO` |

## 10. Module Completeness Checklist

Một module được xem là đủ để đánh giá hoàn chỉnh khi có đủ các lớp sau, tùy loại module:

| Checklist Item | Required For | Notes |
|---|---|---|
| Route/screen | UI-facing modules | Public web/admin/mobile phải có route/screen nếu user cần thao tác. |
| API/backend support | Query/mutation modules | Không xem UI menu là feature hoàn chỉnh nếu không có backend support. |
| Service/business logic | Business modules | Checkout/order/payment/inventory/return cần service enforce rule. |
| Data model/schema/entity | Persistent modules | Product/order/customer/media/settings cần storage model. |
| Permission | Admin/internal modules | Backend enforcement bắt buộc, frontend hiding không đủ. |
| Validation | Input/mutation modules | Backend validation bắt buộc; frontend validation chỉ hỗ trợ UX. |
| State handling | UI modules | Loading/empty/error/submitting/success/permission denied. |
| Business rules | Commerce modules | Price/stock/payment/order/return transitions phải rõ. |
| Test coverage | Critical modules | Có unit/integration/e2e/smoke tests hoặc phase reports. |
| Evidence path | All modules | Path thật trong repo, không dùng path bịa. |

Current audit result:

- Backend core commerce modules có nhiều evidence tốt hơn UI state/test evidence.
- Admin/public UI routes hiện diện nhưng completeness về loading/empty/error/submitting cần audit UI sâu hơn.
- Fresh build/test/runtime chưa chạy trong task này.

## 11. Missing / Not Confirmed Modules

| Module / Feature | Status | Why It Matters | Evidence / Gap |
|---|---|---|---|
| External payment webhook | `NOT_FOUND_IN_REPO` | Tự động cập nhật thanh toán từ ngân hàng/payment provider. | Chưa thấy webhook controller/service. |
| External payment gateway / QR integration | `NEEDS_VERIFICATION` | Bank transfer/QR reconciliation có thể cần cho vận hành. | `BACS` exists, provider flow chưa thấy. |
| Third-party shipping provider integration | `NOT_FOUND_IN_REPO` | Tạo vận đơn/tracking tự động với carrier. | Admin shipping chỉ internal zones/methods. |
| Fulfillment tracking | `NEEDS_VERIFICATION` | Theo dõi vận chuyển thực tế. | fulfillment status/shipping item exists, tracking flow chưa rõ. |
| Full customer-created return flow | `NEEDS_VERIFICATION` | Customer self-service đổi/trả. | Admin return rõ; customer side cần audit sâu. |
| Full RBAC permission matrix | `NEEDS_VERIFICATION` | Business/admin cần biết role nào được làm gì. | Permission checks exist, docs matrix chưa có. |
| POS full workflow | `PARTIAL` | Bán tại cửa hàng. | `AdminPosController` exists, business workflow chưa document. |
| Backup / restore operations | `NOT_FOUND_IN_REPO` | Vận hành production cần backup/restore. | Chưa thấy module/process. |
| Sitemap / robots management | `NEEDS_VERIFICATION` | SEO technical completeness. | Chưa audit sâu thấy evidence rõ. |
| Fresh test evidence for all modules | `NEEDS_VERIFICATION` | Không claim ổn định nếu chưa chạy test hiện tại. | Task này không chạy build/test/runtime. |
| Frontend loading/empty/error states coverage | `NEEDS_VERIFICATION` | UI production quality. | Cần UI audit riêng. |
| Mobile app production scope | `NEEDS_VERIFICATION` | Flutter app tồn tại nhưng root docs scope chưa rõ. | `bigbike_mobile` exists; official scope cần xác nhận. |

## 12. Evidence Summary

| Module | Evidence Path | What It Proves | Confidence |
|---|---|---|---|
| Project overview | `docs/business/PROJECT_OVERVIEW.md` | Tổng quan project/components/capabilities đã được tạo trước. | High |
| Business process | `docs/business/BUSINESS_PROCESS.md` | Các business process chính đã được document trước. | High |
| Root project | `README.md` | BigBike commerce/D2C context, app structure, stack and development rules. | High |
| Agent rules | `AGENTS.md` | Guardrails cho business rules, API/data contracts, permissions, SEO. | High |
| Public web homepage | `bigbike-web/app/page.tsx` | Homepage modules and SEO/JSON-LD/content/product consumption. | High |
| Public web routes | `bigbike-web/lib/utils/routes.ts` | Product/category/brand/article/cart/checkout/account/auth routes. | High |
| Mobile routes | `bigbike_mobile/lib/core/router/app_router.dart` | Mobile commerce/account/content/contact routes. | High |
| Admin routes | `bigbike-admin/README.md` | Admin route and permission map. | High |
| Admin API client | `bigbike-admin/src/lib/adminApi.js` | Admin frontend API usage across modules. | High |
| Public catalog backend | `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/catalog/CatalogController.java` | Public product/category/brand APIs and snapshot. | High |
| Admin catalog backend | `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/admin/AdminCatalogController.java` | Product/category/brand admin CRUD/publish/delete and permissions. | High |
| Cart backend | `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/cart/CartController.java` | Cart API module. | Medium-High |
| Checkout backend | `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/checkout/CheckoutController.java` | Checkout/quick-buy/options APIs. | High |
| Checkout service | `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/checkout/CheckoutService.java` | Checkout business logic, order creation, stock/payment/shipping/notification behavior. | High |
| Admin orders | `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/admin/AdminOrderController.java` | Admin order endpoints and permission checks. | High |
| Order service | `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminOrderService.java` | Order/payment transitions, refund, notes, audit, notification, stock restore. | High |
| Inventory | `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/admin/AdminInventoryController.java` | Stock list/summary/movements/adjust/export. | High |
| Returns | `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/admin/AdminReturnController.java` | Admin return APIs. | High |
| Return service | `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminReturnService.java` | Return status transitions, notifications, stock restore. | High |
| Shipping | `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/admin/AdminShippingController.java` | Internal shipping zones/methods CRUD. | High |
| Media | `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/admin/AdminMediaController.java` | Media upload/list/detail/update/delete/restore. | High |
| Content | `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/admin/AdminContentController.java` | Article/page admin management. | High |
| Reports | `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/admin/AdminReportController.java` | Analytics/export modules. | High |
| Security | `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/config/SecurityConfig.java` | Public/admin/customer auth boundaries and role protection. | High |
| Customer auth report | `bigbike-backend/docs/PHASE_1D_CUSTOMER_AUTH_REPORT.md` | Customer auth/session/CSRF tests and known risks at phase time. | High for phase scope |
| Checkout report | `bigbike-backend/docs/PHASE_1F_CHECKOUT_API_REPORT.md` | Checkout/quick-buy/options test report and business mapping at phase time. | High for phase scope |
| Settings/menu/coupon report | `bigbike-backend/docs/PHASE_1J_ADMIN_SETTINGS_MENU_COUPON_API_REPORT.md` | Settings/menu/coupon APIs, permissions and tests at phase time. | High for phase scope; coupon drift needs verify |
| Infrastructure | `docker-compose.yaml` | Postgres, MinIO, backend, web, admin and runtime config boundaries. | High |
| Backend dependencies | `bigbike-backend/pom.xml` | Spring Boot, JPA, Flyway, Security, Mail, WebSocket, MinIO, Bucket4j, PostgreSQL. | High |
| Design system | `Bigbike Design System/README.md` | Brand/UI source of truth. | High |

## 13. Known Ambiguities / Needs Verification

1. Coupon integration has docs/code drift: Phase 1J says coupon-cart integration deferred, but current `CheckoutService` records cart coupons into orders and increments usage count. Needs test/runtime verification.
2. Payment supports COD/BACS/internal/manual flow. External gateway/webhook/QR auto reconciliation was not found.
3. Shipping supports zones/methods/cost. Third-party carrier/tracking integration was not found.
4. Product public filtering by publish status should be verified inside read services, not only inferred from checkout requiring `PUBLISHED`.
5. Admin RBAC is enforced in backend controllers, but full role-permission-action matrix is not documented in this file.
6. Several admin modules are confirmed by controller/API evidence, but UI state completeness needs a dedicated admin UI audit.
7. POS module exists by controller name and order service condition, but business workflow is only partial.
8. Customer return creation flow needs deeper audit; admin return workflow is clearer than customer side.
9. Media module is confirmed, but CDN/public URL/runtime storage behavior needs deployment verification.
10. Email/notification code paths exist, but SMTP delivery and templates were not runtime-tested.
11. Sitemap/robots and full SEO migration coverage need separate SEO audit.
12. `docs/DECISIONS.md` was referenced by root docs in prior audit but direct fetch previously returned not found.
13. `bigbike_mobile` exists, but official production scope is not fully clarified by root README.
14. Build/test/runtime were not run during this documentation task. Do not treat this file as green-build evidence.
15. Some paths in backend compile `target/` artifacts indicate broad code presence, but generated/compiled artifacts are not primary source-of-truth for completeness.

## 14. Relationship With Other Docs

| Document | Relationship |
|---|---|
| `PROJECT_OVERVIEW.md` | Tổng quan dự án: BigBike là gì, gồm app/layer nào. |
| `BUSINESS_PROCESS.md` | Quy trình nghiệp vụ: doanh nghiệp vận hành như thế nào. |
| `MODULE_CATALOG.md` | File hiện tại: hệ thống có module nào và mỗi module có feature gì. |
| `WORKFLOW_OVERVIEW.md` | Nên mô tả workflow end-to-end xuyên module. |
| `BUSINESS_RULES.md` | Nên định nghĩa luật nghiệp vụ chi tiết. |
| `STATE_MACHINES.md` | Nên định nghĩa trạng thái entity và transition hợp lệ. |
| `ACCEPTANCE_CRITERIA.md` | Nên định nghĩa tiêu chí hoàn thành module/feature. |
| `API_CONTRACT.md` | Nên mô tả request/response FE-BE hoặc reference OpenAPI. |
| `DATA_CONTRACT.md` | Nên định nghĩa shape dữ liệu thống nhất giữa web/admin/mobile/backend. |
| `PERMISSION_MATRIX.md` | Nên chi tiết hóa role, permission, route/action/API. |
| `TRACEABILITY_MATRIX.md` | Nên nối module/feature/workflow/API/DB/permission/test. |

## Audit Notes

Documentation này được tạo bằng thao tác đọc/inspect repository qua GitHub connector. Không chạy migration, seed, deploy, refactor hoặc command có side effect. Không sửa business logic hoặc source code ứng dụng.
