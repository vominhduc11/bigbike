# BigBike API Contract

Audit date: 2026-05-04

## 1. Document Purpose

File này mô tả contract API giữa các frontend của BigBike (`bigbike-web`, `bigbike-admin`, `bigbike_mobile`) và backend Spring Boot.

Tài liệu này trả lời câu hỏi: **frontend/admin/mobile gọi backend như thế nào, endpoint nào tồn tại, cần auth gì, nhận/trả response high-level ra sao, lỗi/validation/pagination hoạt động thế nào.**

Giới hạn có chủ ý:

- Không nhồi full JSON schema. Data shape chi tiết nằm ở `docs/engineering/DATA_CONTRACT.md`.
- Không tự bịa endpoint. Endpoint nào không có evidence thì đánh dấu rõ.
- Không ghi secret/token/password/private key/env value.
- Không thay thế OpenAPI, controller source hay permission matrix. Đây là contract đọc được cho developer/tester/AI agent, không phải một bản sao máy móc của Swagger, vì thế giới đã đủ khổ rồi.

## 2. API Contract Status Labels

| Label | Meaning |
|---|---|
| `CONFIRMED_FROM_CODE` | Đã thấy trực tiếp trong backend controller/security/DTO/OpenAPI hoặc frontend API client. |
| `BACKEND_ONLY` | Có backend API nhưng chưa thấy frontend/admin/mobile gọi rõ trong audit hiện tại. |
| `FRONTEND_ONLY` | Frontend/admin/mobile gọi API nhưng chưa thấy backend endpoint tương ứng. |
| `DOCUMENTED_NOT_FOUND` | Docs nói có API nhưng code audit hiện tại chưa thấy. |
| `NEEDS_VERIFICATION` | Có evidence một phần nhưng cần audit sâu hơn, runtime test hoặc kiểm tra thêm client. |
| `NOT_FOUND_IN_REPO` | Không thấy evidence trong repo. |
| `CONFLICTING_EVIDENCE` | Controller/security/client/OpenAPI thể hiện khác nhau. |

## 3. API Surface Summary

| API Area | Audience | Base Path / Controller | Auth | Status | Evidence |
|---|---|---|---|---|---|
| Public Catalog | Public web/mobile/guest | `/api/v1/products`, `/api/v1/categories`, `/api/v1/brands` / `CatalogController` | `permitAll` GET | `CONFIRMED_FROM_CODE` | `CatalogController.java`, `SecurityConfig.java`, `bigbike-web/lib/api/public-api.ts` |
| Public Search | Public web/mobile | `/api/v1/search`, `/api/v1/search-suggest` / `PublicSearchController` | `permitAll` GET | `CONFIRMED_FROM_CODE` | `PublicSearchController.java`, `SecurityConfig.java`, `public-api.ts` |
| Public Content | Public web/mobile | `/api/v1/articles`, `/api/v1/pages` / `ContentController` | `permitAll` GET | `CONFIRMED_FROM_CODE` | `ContentController.java`, `SecurityConfig.java`, `public-api.ts` |
| Public Settings/Menu/Slider/Home Video | Public web | `/api/v1/settings/public`, `/api/v1/menus/{location}`, `/api/v1/sliders`, `/api/v1/home-videos` | `permitAll` GET | `CONFIRMED_FROM_CODE` | `PublicSettingsController.java`, `PublicMenuController.java`, `PublicSliderController.java`, `PublicHomeVideoController.java` |
| Cart | Guest/customer | `/api/v1/cart` / `CartController` | `permitAll`; mutations guarded by customer CSRF filter | `CONFIRMED_FROM_CODE` | `CartController.java`, `SecurityConfig.java` |
| Checkout | Guest/customer | `/api/v1/checkout`, `/api/v1/orders/quick-buy`, `/api/v1/checkout/options` / `CheckoutController` | `permitAll`; POST guarded by CSRF filter | `CONFIRMED_FROM_CODE` | `CheckoutController.java`, `SecurityConfig.java` |
| Customer Auth | Customer | `/api/v1/customer/auth/*` / `CustomerAuthController` | Auth endpoints mostly `permitAll`; session cookies set | `CONFIRMED_FROM_CODE` | `CustomerAuthController.java`, `SecurityConfig.java` |
| Customer Account / Address / Orders / Returns | Customer | `/api/v1/customer/me`, `/api/v1/customer/addresses`, `/api/v1/customer/orders` | `ROLE_CUSTOMER` via session/cookie | `CONFIRMED_FROM_CODE` | `CustomerController.java`, `CustomerAddressController.java`, `CustomerOrderController.java`, `SecurityConfig.java` |
| Order Lookup | Guest/customer | `/api/v1/orders/lookup` / `OrderLookupController` | `permitAll` GET with `orderNumber` + `orderKey` | `CONFIRMED_FROM_CODE` | `OrderLookupController.java`, `SecurityConfig.java`, `public-api.ts` |
| Contact | Public | `/api/v1/contact` / `ContactController` | `permitAll` POST | `CONFIRMED_FROM_CODE` | `ContactController.java`, `SecurityConfig.java` |
| Reviews | Public/admin | `/api/v1/products/{productId}/reviews`, `/api/v1/admin/reviews` | Public GET/POST; admin `ROLE_ADMIN` + permissions | `CONFIRMED_FROM_CODE` | `PublicReviewController.java`, `AdminReviewController.java`, `SecurityConfig.java` |
| Admin Auth | Admin | `/api/v1/auth/*` / `AuthController` | login/refresh/logout permitAll; `/me` authenticated | `CONFIRMED_FROM_CODE` | `AuthController.java`, `SecurityConfig.java`, `bigbike-admin/src/lib/adminApi.js` |
| Admin Products/Catalog | Admin | `/api/v1/admin/products`, `/categories`, `/brands` / `AdminCatalogController` | `ROLE_ADMIN` + `products.*`/`catalog.*` permissions | `CONFIRMED_FROM_CODE` | `AdminCatalogController.java`, `adminApi.js` |
| Admin Orders | Admin | `/api/v1/admin/orders` / `AdminOrderController` | `ROLE_ADMIN` + `orders.read/write` | `CONFIRMED_FROM_CODE` | `AdminOrderController.java`, `adminApi.js` |
| Admin Customers | Admin | `/api/v1/admin/customers` / `AdminCustomerController` | `ROLE_ADMIN` + `customers.read/write` | `CONFIRMED_FROM_CODE` | `AdminCustomerController.java`, `adminApi.js` |
| Admin Inventory | Admin | `/api/v1/admin/inventory` / `AdminInventoryController` | `ROLE_ADMIN` + `products.read/update` | `CONFIRMED_FROM_CODE` | `AdminInventoryController.java` |
| Admin Returns | Admin | `/api/v1/admin/returns` / `AdminReturnController` | `ROLE_ADMIN` + `orders.read/write` | `CONFIRMED_FROM_CODE` | `AdminReturnController.java` |
| Admin Media | Admin | `/api/v1/admin/media` / `AdminMediaController` | `ROLE_ADMIN` + `media.read/write` | `CONFIRMED_FROM_CODE` | `AdminMediaController.java` |
| Admin Content | Admin | `/api/v1/admin/content` / `AdminContentController` | `ROLE_ADMIN` + `content.read/update` | `CONFIRMED_FROM_CODE` | `AdminContentController.java`, `adminApi.js` |
| Admin Settings/Menu/Coupon | Admin | `/api/v1/admin/settings`, `/menus`, `/coupons` | `ROLE_ADMIN` + module permissions | `CONFIRMED_FROM_CODE` | `AdminSettingsController.java`, `AdminMenuController.java`, `AdminCouponController.java` |
| Admin Shipping | Admin | `/api/v1/admin/shipping` / `AdminShippingController` | `ROLE_ADMIN` + `shipping.read/write` | `CONFIRMED_FROM_CODE` | `AdminShippingController.java` |
| Admin Reports/Dashboard | Admin | `/api/v1/admin/dashboard`, `/reports` | `ROLE_ADMIN` + read permissions | `CONFIRMED_FROM_CODE` | `AdminDashboardController.java`, `AdminReportController.java` |
| Admin Users/Roles | Admin | `/api/v1/admin/admin-users`, `/roles` | `ROLE_ADMIN` + `admin-users.read/write` | `CONFIRMED_FROM_CODE` | `AdminAdminUsersController.java`, `AdminRolesController.java` |
| Admin Redirects/Audit/POS | Admin/internal | `/api/v1/admin/redirects`, `/api/internal/redirect*`, audit/POS controllers | Mixed: admin role/permissions; internal redirect permitAll but infra should lock down | `CONFIRMED_FROM_CODE` for redirects; audit/POS endpoint details `NEEDS_VERIFICATION` | `AdminRedirectController.java`, `InternalRedirectController.java`, backend compile list |

## 4. Response / Error Contract

| Response Type | Shape / Meaning | Used By | Status | Evidence |
|---|---|---|---|---|
| Data response | `ApiDataResponse<T> { data, meta }` | Most single-object/single-payload API | `CONFIRMED_FROM_CODE` | `ApiDataResponse.java`, controllers |
| List response | `ApiListResponse<T> { data: T[], pagination, meta }` | Public/admin paginated list endpoints | `CONFIRMED_FROM_CODE` | `ApiListResponse.java`, `CatalogController.java`, `AdminCatalogController.java` |
| Pagination metadata | `{ page, pageSize, totalItems, totalPages, hasNext, hasPrevious }` | List APIs | `CONFIRMED_FROM_CODE` | `PaginationMeta.java` |
| Error response | `ApiErrorResponse { error: { code, message, details }, meta }` | Global exception handler | `CONFIRMED_FROM_CODE` | `ApiErrorResponse.java`, `ApiError.java`, `ApiErrorDetail.java`, `GlobalExceptionHandler.java` |
| Validation error | HTTP 400, code `VALIDATION_ERROR`, details list with field/code/message | Bean validation, type mismatch, malformed body, custom validation | `CONFIRMED_FROM_CODE` | `GlobalExceptionHandler.java`, controller validation annotations |
| Auth/forbidden errors | 401/403 through REST auth entry point/access denied handler | Protected admin/customer endpoints | `CONFIRMED_FROM_CODE`; exact payload mapper `NEEDS_VERIFICATION` | `SecurityConfig.java`, `RestAuthenticationEntryPoint.java`, `RestAccessDeniedHandler.java` paths |
| Direct/raw response | CSV export, internal redirect lookup, some return/inventory APIs returning `PageResult` or raw DTO | Report/inventory/internal hot path | `CONFIRMED_FROM_CODE`; consistency `NEEDS_VERIFICATION` | `AdminReportController.java`, `AdminInventoryController.java`, `InternalRedirectController.java` |

## 5. Auth / Security Contract

| API Group | Auth Required | Role / Permission | CSRF / Cookie / JWT | Status | Evidence |
|---|---|---|---|---|---|
| Public catalog/content/search/settings/menu/slider/home video | No | None | No auth; cache may apply on sliders/videos | `CONFIRMED_FROM_CODE` | `SecurityConfig.java`, public controllers |
| Public review submission | No | None | No auth; validation in controller | `CONFIRMED_FROM_CODE` | `SecurityConfig.java`, `PublicReviewController.java` |
| Cart | No auth required | Guest or customer context | `bb_guest_id` + `bb_csrf`; mutations CSRF-checked by filter | `CONFIRMED_FROM_CODE` | `CartController.java`, `SecurityConfig.java` |
| Checkout / quick-buy | No auth required | Guest or customer context | POST permitAll but CSRF enforced by `CustomerCsrfFilter` | `CONFIRMED_FROM_CODE` | `CheckoutController.java`, `SecurityConfig.java` |
| Customer auth | Login/register/refresh/logout/password reset permitAll | None | Sets `bb_session`, `bb_refresh`, `bb_csrf`; refresh uses cookie | `CONFIRMED_FROM_CODE` | `CustomerAuthController.java`, `SecurityConfig.java` |
| Customer profile/address/orders/returns | Yes | `ROLE_CUSTOMER` | Customer session cookie principal; mutations should carry CSRF where filter applies | `CONFIRMED_FROM_CODE` | `SecurityConfig.java`, customer controllers |
| Admin auth login/refresh/logout | Login/refresh/logout permitAll | None initially | JWT access token + httpOnly refresh cookie; body fallback exists | `CONFIRMED_FROM_CODE` | `AuthController.java`, `adminApi.js` |
| Admin `/auth/me` | Yes | authenticated | Bearer JWT or dev fallback | `CONFIRMED_FROM_CODE` | `AuthController.java`, `SecurityConfig.java` |
| Admin modules `/api/v1/admin/**` | Yes | `ROLE_ADMIN` globally plus controller permission checks | Bearer JWT via `Authorization: Bearer ...` | `CONFIRMED_FROM_CODE` | `SecurityConfig.java`, admin controllers, `adminApi.js` |
| Internal redirects | No app auth in SecurityConfig | Should be locked by infra/IP allowlist per comment | No standard envelope for lookup/list/hit | `CONFIRMED_FROM_CODE`; prod access policy `NEEDS_VERIFICATION` | `SecurityConfig.java`, `InternalRedirectController.java` |
| WebSocket `/ws/**` | Permit at HTTP layer | Auth validated in STOMP CONNECT interceptor per comment | WebSocket auth contract not fully audited | `NEEDS_VERIFICATION` | `SecurityConfig.java`, `WebSocketConfig.java` path |

## 6. Public API Contract

### 6.1 Catalog

| Method | Path | Purpose | Request High-level | Response High-level | Auth | Status | Evidence |
|---|---|---|---|---|---|---|---|
| GET | `/api/v1/products` | List products | `page`, `size`, `sort`, `category`, `pwb-brand`, `q`, `filter_color`, `filter_gender`, `min_price`, `max_price`, `featured`, `showOnHomepage` | `ApiListResponse<Product>`; `rating` / `ratingCount` are denormalized cache fields kept in sync with the approved-review aggregate | Public `permitAll` | `CONFIRMED_FROM_CODE` | `CatalogController.java`, `public-api.ts`, `AdminReviewService.java` |
| GET | `/api/v1/products/{slug}` | Product detail by slug | slug path | `ApiDataResponse<Product>`; `rating` / `ratingCount` are denormalized cache fields kept in sync with the approved-review aggregate | Public `permitAll` | `CONFIRMED_FROM_CODE` | `CatalogController.java`, `public-api.ts`, `AdminReviewService.java` |
| GET | `/api/v1/products/{idOrSlug}/snapshot` | Lightweight price/stock snapshot | id or slug path | `ApiDataResponse<ProductSnapshotResponse>` | Public `permitAll` by `/products/**` | `BACKEND_ONLY` in audited web client | `CatalogController.java` |
| GET | `/api/v1/categories` | List categories (visible only) | `page`, `size`, `sort` (default `sortOrder:asc`; allowed: `name`, `createdAt`, `sortOrder`), `showOnHomepage` or `filterHome` (either accepted, both filter to homepage categories) | `ApiListResponse<Category>` — **only `isVisible=true` categories returned; no visibility filter param** | Public `permitAll` | `CONFIRMED_FROM_CODE` | `CatalogController.java`, `CatalogReadService.java`, `public-api.ts` |
| GET | `/api/v1/categories/{slug}` | Category detail by slug | slug path; returns 404 if category is hidden | `ApiDataResponse<Category>` | Public `permitAll` | `CONFIRMED_FROM_CODE` | `CatalogController.java`, `public-api.ts` |
| GET | `/api/v1/brands` | List brands | `page`, `size`, `sort` | `ApiListResponse<Brand>` | Public `permitAll` | `CONFIRMED_FROM_CODE` | `CatalogController.java`, `public-api.ts` |
| GET | `/api/v1/brands/{slug}` | Brand detail | slug path | `ApiDataResponse<Brand>` | Public `permitAll` | `CONFIRMED_FROM_CODE` | `CatalogController.java`, `public-api.ts` |

### 6.2 Search

| Method | Path | Purpose | Request High-level | Response High-level | Auth | Status | Evidence |
|---|---|---|---|---|---|---|---|
| GET | `/api/v1/search` | Cross-domain search products/articles | `q`, optional `type`, `limit` | `ApiDataResponse<{query, products, articles}>` | Public `permitAll` | `CONFIRMED_FROM_CODE` | `PublicSearchController.java`, `public-api.ts` |
| GET | `/api/v1/search-suggest` | Lightweight typeahead | optional `q`, `limit`; empty if query < 2 chars | `ApiDataResponse<SearchPayload>` | Public `permitAll` | `BACKEND_ONLY` in audited web client | `PublicSearchController.java`, `SecurityConfig.java` |

### 6.3 Content

| Method | Path | Purpose | Request High-level | Response High-level | Auth | Status | Evidence |
|---|---|---|---|---|---|---|---|
| GET | `/api/v1/articles` | List articles | `page`, `size`, `sort`, `category`, `q` | `ApiListResponse<Article>` | Public `permitAll` | `CONFIRMED_FROM_CODE` | `ContentController.java`, `public-api.ts` |
| GET | `/api/v1/articles/{slug}` | Article detail | slug path | `ApiDataResponse<Article>` | Public `permitAll` | `CONFIRMED_FROM_CODE` | `ContentController.java`, `public-api.ts` |
| GET | `/api/v1/pages/{slug}` | Page detail | slug path | `ApiDataResponse<Page>` | Public `permitAll` | `CONFIRMED_FROM_CODE` | `ContentController.java`, `public-api.ts` |

### 6.4 Settings/Menu/Slider/Home Video

| Method | Path | Purpose | Request High-level | Response High-level | Auth | Status | Evidence |
|---|---|---|---|---|---|---|---|
| GET | `/api/v1/settings/public` | Public site settings subset | none | `ApiDataResponse<List<PublicSiteSettingResponse>>` | Public `permitAll` | `CONFIRMED_FROM_CODE` | `PublicSettingsController.java`, `public-api.ts` |
| GET | `/api/v1/menus/{location}` | Public active menu by location | location path | `ApiDataResponse<PublicMenuResponse>` | Public `permitAll` | `CONFIRMED_FROM_CODE` | `PublicMenuController.java`, `public-api.ts` |
| GET | `/api/v1/sliders` | Active sliders by location | `location`, default `home` | `ApiDataResponse<List<PublicSliderResponse>>` with 5-min public cache | Public `permitAll` | `CONFIRMED_FROM_CODE` | `PublicSliderController.java`, `public-api.ts` |
| GET | `/api/v1/home-videos` | Active homepage videos | none | `ApiDataResponse<List<PublicHomeVideoResponse>>` with 5-min public cache | Public `permitAll` | `CONFIRMED_FROM_CODE` | `PublicHomeVideoController.java`, `public-api.ts` |

### 6.5 Cart / Checkout Public Parts

| Method | Path | Purpose | Request High-level | Response High-level | Auth | Status | Evidence |
|---|---|---|---|---|---|---|---|
| GET | `/api/v1/cart` | Get/create current cart | guest/customer context from cookie/session | `ApiDataResponse<CartResponse>` | Public; guest/customer | `CONFIRMED_FROM_CODE` | `CartController.java`, `SecurityConfig.java` |
| POST | `/api/v1/cart/items` | Add item | `AddCartItemRequest` | `ApiDataResponse<CartResponse>` | Public + CSRF on mutation | `CONFIRMED_FROM_CODE` | `CartController.java` |
| PATCH | `/api/v1/cart/items/{itemId}` | Update item quantity | `UpdateCartItemRequest` | `ApiDataResponse<CartResponse>` | Public + CSRF on mutation | `CONFIRMED_FROM_CODE` | `CartController.java` |
| DELETE | `/api/v1/cart/items/{itemId}` | Remove item | item id | `ApiDataResponse<CartResponse>` | Public + CSRF on mutation | `CONFIRMED_FROM_CODE` | `CartController.java` |
| DELETE | `/api/v1/cart` and `/api/v1/cart/clear` | Clear cart | none | `ApiDataResponse<CartResponse>` | Public + CSRF on mutation | `CONFIRMED_FROM_CODE` | `CartController.java` |
| POST | `/api/v1/cart/coupons` | Apply coupon | `ApplyCouponRequest` | `ApiDataResponse<CartResponse>` | Public + CSRF on mutation | `CONFIRMED_FROM_CODE` | `CartController.java` |
| DELETE | `/api/v1/cart/coupons/{code}` | Remove coupon | coupon code path | `ApiDataResponse<CartResponse>` | Public + CSRF on mutation | `CONFIRMED_FROM_CODE` | `CartController.java` |
| GET | `/api/v1/checkout/options` | Get payment/shipping options | none | `ApiDataResponse<CheckoutOptionsResponse>` | Public `permitAll` | `CONFIRMED_FROM_CODE` | `CheckoutController.java` |
| POST | `/api/v1/checkout` | Submit cart checkout | `CheckoutRequest`; optional header `Idempotency-Key` to safely retry the same submission | `ApiDataResponse<OrderSummaryResponse>` | Public + CSRF on mutation | `CONFIRMED_FROM_CODE` | `CheckoutController.java` |
| POST | `/api/v1/orders/quick-buy` | Single item direct purchase | `QuickBuyRequest`; optional header `Idempotency-Key` to safely retry the same submission | `ApiDataResponse<OrderSummaryResponse>` | Public + CSRF on mutation | `CONFIRMED_FROM_CODE` | `CheckoutController.java` |

### 6.6 Contact / Review / Order Lookup

| Method | Path | Purpose | Request High-level | Response High-level | Auth | Status | Evidence |
|---|---|---|---|---|---|---|---|
| POST | `/api/v1/contact` | Submit contact form | `ContactRequest` | `ApiDataResponse<Void>` with HTTP 201 | Public `permitAll` | `CONFIRMED_FROM_CODE` | `ContactController.java`, `SecurityConfig.java` |
| GET | `/api/v1/products/{productId}/reviews` | Get approved product reviews | `productId` path; optional `page` (default 1, min 1), optional `size` (default 10, min 1, max 50) | `ApiDataResponse<{avgRating,totalReviews,reviews[],pagination}>`; aggregate values cover **all APPROVED reviews**, `reviews[]` is current page only; returns `404` if `productId` does not exist | Public | `CONFIRMED_FROM_CODE` | `PublicReviewController.java`, `PublicReviewService.java`, `ReviewJpaRepository.java` |
| POST | `/api/v1/products/{productId}/reviews` | Submit product review | `authorName`, `rating`, `comment`, optional honeypot `website` | `ApiDataResponse<{success:true}>` with HTTP 201 on accept; HTTP 409 `CONFLICT` if duplicate (same productId + normalized authorName + comment within 24h, any status, rating ignored); HTTP 429 if rate-limited (5/min/IP). Non-empty `website` after trim is silently dropped server-side: response is success-shaped 201 but no review is persisted. | Public `permitAll` | `CONFIRMED_FROM_CODE` | `PublicReviewController.java`, `PublicReviewService.java`, `SecurityConfig.java`, `bigbike_mobile/lib/features/products/product_detail_screen.dart` |
| GET | `/api/v1/orders/lookup` | Guest order lookup | `orderNumber`, `orderKey` required | `ApiDataResponse<OrderDetailResponse>` | Public `permitAll` | `CONFIRMED_FROM_CODE` | `OrderLookupController.java`, `public-api.ts` |

## 7. Customer API Contract

| Method | Path | Purpose | Request High-level | Response High-level | Auth | Status | Evidence |
|---|---|---|---|---|---|---|---|
| POST | `/api/v1/customer/auth/register` | Register customer | `CustomerRegisterRequest` | `ApiDataResponse<CustomerAuthResponse>` + session cookies | Public | `CONFIRMED_FROM_CODE` | `CustomerAuthController.java` |
| POST | `/api/v1/customer/auth/login` | Customer login | `CustomerLoginRequest` | `ApiDataResponse<CustomerAuthResponse>` + session cookies | Public | `CONFIRMED_FROM_CODE` | `CustomerAuthController.java` |
| POST | `/api/v1/customer/auth/refresh` | Refresh customer session | refresh cookie | `ApiDataResponse<CustomerAuthResponse>` + refreshed cookies | Public | `CONFIRMED_FROM_CODE` | `CustomerAuthController.java` |
| POST | `/api/v1/customer/auth/logout` | Logout customer | session cookie if present | `ApiDataResponse<Void>` + cleared cookies | Public but session-aware | `CONFIRMED_FROM_CODE` | `CustomerAuthController.java` |
| POST | `/api/v1/customer/auth/password/forgot` | Request password reset | `CustomerForgotPasswordRequest` | `ApiDataResponse<Void>` | Public | `CONFIRMED_FROM_CODE` | `CustomerAuthController.java` |
| POST | `/api/v1/customer/auth/password/reset` | Reset password | `CustomerResetPasswordRequest` | `ApiDataResponse<Void>` | Public | `CONFIRMED_FROM_CODE` | `CustomerAuthController.java` |
| POST | `/api/v1/customer/auth/verify-email?token=...` | Verify email token | token query | `ApiDataResponse<{verified:true}>` | Public — `SecurityConfig` permitAll for both POST (controller path) and GET (legacy compat). BUG-001 fixed 2026-05-05. | `CONFIRMED_FROM_CODE` | `CustomerAuthController.java:65`, `SecurityConfig.java:63-64` |
| GET | `/api/v1/customer/me` | Get profile | none | `ApiDataResponse<CustomerSummary>` | `ROLE_CUSTOMER` | `CONFIRMED_FROM_CODE` | `CustomerController.java`, `SecurityConfig.java` |
| PATCH | `/api/v1/customer/me` | Update profile | `UpdateCustomerProfileRequest` | `ApiDataResponse<CustomerSummary>` | `ROLE_CUSTOMER` | `CONFIRMED_FROM_CODE` | `CustomerController.java` |
| GET | `/api/v1/customer/addresses` | List addresses | none | `ApiDataResponse<List<CustomerAddressResponse>>` | `ROLE_CUSTOMER` | `CONFIRMED_FROM_CODE` | `CustomerAddressController.java` |
| POST | `/api/v1/customer/addresses` | Create address | `SaveCustomerAddressRequest` | `ApiDataResponse<CustomerAddressResponse>` with HTTP 201 | `ROLE_CUSTOMER` | `CONFIRMED_FROM_CODE` | `CustomerAddressController.java` |
| PATCH | `/api/v1/customer/addresses/{id}` | Update address | address id + request body | `ApiDataResponse<CustomerAddressResponse>` | `ROLE_CUSTOMER` | `CONFIRMED_FROM_CODE` | `CustomerAddressController.java` |
| DELETE | `/api/v1/customer/addresses/{id}` | Delete address | address id | HTTP 204 | `ROLE_CUSTOMER` | `CONFIRMED_FROM_CODE` | `CustomerAddressController.java` |
| GET | `/api/v1/customer/orders` | List own orders | `page`, `size`, `status`, `paymentStatus` | `ApiListResponse<OrderListItemResponse>` | `ROLE_CUSTOMER` | `CONFIRMED_FROM_CODE` | `CustomerOrderController.java` |
| GET | `/api/v1/customer/orders/{orderId}` | Own order detail | order id | `ApiDataResponse<OrderDetailResponse>`; `orderKey` is not exposed on authenticated customer detail | `ROLE_CUSTOMER` | `CONFIRMED_FROM_CODE` | `CustomerOrderController.java` |
| GET | `/api/v1/customer/orders/returns` | List own returns | none | raw `List<CustomerReturnResponse>` | `ROLE_CUSTOMER` | `CONFIRMED_FROM_CODE`; envelope inconsistency | `CustomerOrderController.java` |
| GET | `/api/v1/customer/orders/returns/{returnId}` | Own return detail | return id | raw `CustomerReturnResponse` | `ROLE_CUSTOMER` | `CONFIRMED_FROM_CODE`; envelope inconsistency | `CustomerOrderController.java` |
| POST | `/api/v1/customer/orders/{orderId}/returns` | Create return request | `CreateReturnRequest` | raw `CustomerReturnResponse` with HTTP 201 | `ROLE_CUSTOMER` | `CONFIRMED_FROM_CODE`; envelope inconsistency | `CustomerOrderController.java` |

## 8. Admin API Contract

Global admin rule: `/api/v1/admin/**` requires `ROLE_ADMIN` in `SecurityConfig`. Most controllers then call `devAdminAuthService.requirePermission(request, "module.action")`. That second check is the real module-level authorization contract, because pretending `ROLE_ADMIN` alone is enough is how dashboards become confetti cannons.

### 8.1 Admin Auth

| Method | Path | Purpose | Required permission | Request high-level | Response high-level | Status | Evidence |
|---|---|---|---|---|---|---|---|
| POST | `/api/v1/auth/login` | Admin login | None | `LoginRequest` | `ApiDataResponse<TokenResponse>` + refresh cookie | `CONFIRMED_FROM_CODE` | `AuthController.java`, `adminApi.js` |
| POST | `/api/v1/auth/refresh` | Refresh admin token | None | refresh cookie preferred; body fallback | `ApiDataResponse<TokenResponse>` | `CONFIRMED_FROM_CODE` | `AuthController.java`, `adminApi.js` |
| POST | `/api/v1/auth/logout` | Logout admin | None | refresh cookie/body fallback | `ApiDataResponse<Void>` | `CONFIRMED_FROM_CODE` | `AuthController.java`, `adminApi.js` |
| GET | `/api/v1/auth/me` | Current admin profile | authenticated | none | `ApiDataResponse<AdminUserProfile>` | `CONFIRMED_FROM_CODE` | `AuthController.java`, `adminApi.js` |

### 8.2 Products / Catalog

| Method | Path | Purpose | Required permission | Request high-level | Response high-level | Status | Evidence |
|---|---|---|---|---|---|---|---|
| GET | `/api/v1/admin/products` | List products | `products.read` | page/size/pageSize/sort/q/search/publishStatus (default excludes TRASH; TRASH returns trashed products only)/stockState/brandId/categoryId | `ApiListResponse<Product>` | `CONFIRMED_FROM_CODE` | `AdminCatalogController.java`, `adminApi.js` |
| GET | `/api/v1/admin/products/{id}` | Product detail | `products.read` | id path | `ApiDataResponse<Product>` | `CONFIRMED_FROM_CODE` | `AdminCatalogController.java`, `adminApi.js` |
| POST | `/api/v1/admin/products` | Create product | `products.update` | `UpsertProductRequest` | `ApiDataResponse<Product>` | `CONFIRMED_FROM_CODE` | `AdminCatalogController.java`, `adminApi.js` |
| PATCH | `/api/v1/admin/products/{id}` | Update product | `products.update` | `UpsertProductRequest` | `ApiDataResponse<Product>` | `CONFIRMED_FROM_CODE` | `AdminCatalogController.java`, `adminApi.js` |
| PATCH | `/api/v1/admin/products/{id}/publish` | Update publish status | `products.update` | `ProductPublishRequest` | `ApiDataResponse<Product>` | `CONFIRMED_FROM_CODE` | `AdminCatalogController.java`, `adminApi.js` |
| DELETE | `/api/v1/admin/products/{id}` | Soft-delete product to TRASH | `products.update` | id path | `ApiDataResponse<Product>` | `CONFIRMED_FROM_CODE` | `AdminCatalogController.java`, `adminApi.js` |
| POST | `/api/v1/admin/products/{id}/restore` | Restore trashed product to DRAFT | `products.update` | id path | `ApiDataResponse<Product>` | `CONFIRMED_FROM_CODE` | `AdminCatalogController.java`, `adminApi.js` |
| GET | `/api/v1/admin/categories` | List categories (all visibility states) | `catalog.read` | `page`, `size`/`pageSize` (max 100), `sort` (default `updatedAt:desc`; allowed: `name`, `createdAt`, `updatedAt`, `sortOrder`), `q`/`search`, `visibility=VISIBLE\|HIDDEN` (omit for ALL) | `ApiListResponse<Category>` | `CONFIRMED_FROM_CODE` | `AdminCatalogController.java`, `AdminCatalogReadService.java`, `adminApi.js` |
| GET | `/api/v1/admin/categories/{id}` | Category detail by internal id | `catalog.read` | id path (format `^[A-Za-z0-9_-]+$`) | `ApiDataResponse<Category>` | `CONFIRMED_FROM_CODE` | `AdminCatalogController.java`, `adminApi.js` |
| POST | `/api/v1/admin/categories` | Create category | `catalog.update` | `UpsertCategoryRequest`; required: `slug`, `name`; see DATA_CONTRACT.md §6 for full field list | `ApiDataResponse<Category>` | `CONFIRMED_FROM_CODE` | `AdminCatalogController.java`, `adminApi.js` |
| PATCH | `/api/v1/admin/categories/{id}` | Update category (partial) | `catalog.update` | `UpsertCategoryRequest`; all fields optional in PATCH; send `parentId: ""` to clear parent; send `seo: {...empty...}` to clear SEO fields (omitting `seo` leaves SEO unchanged); **if `visible: false` and entity has visible children → HTTP 409 `CONFLICT`** | `ApiDataResponse<Category>` | `CONFIRMED_FROM_CODE` | `AdminCatalogController.java`, `AdminCatalogMutationService.java`, `adminApi.js` |
| DELETE | `/api/v1/admin/categories/{id}` | Soft-delete category (sets `isVisible=false`) | `catalog.update` | id path; **if category has visible children → HTTP 409 `CONFLICT`**; no physical delete; restore by PATCH `visible: true` | `ApiDataResponse<Category>` | `CONFIRMED_FROM_CODE` | `AdminCatalogController.java`, `AdminCatalogMutationService.java`, `adminApi.js` |
| GET/POST/PATCH/DELETE | `/api/v1/admin/brands[/{id}]` | Brand list/detail/create/update/delete | `catalog.read` / `catalog.update` | filters or `UpsertBrandRequest` | `ApiListResponse` / `ApiDataResponse<Brand>` | `CONFIRMED_FROM_CODE` | `AdminCatalogController.java`, `adminApi.js` |

### 8.3 Orders / Payment / Refund / Note

| Method | Path | Purpose | Required permission | Request high-level | Response high-level | Status | Evidence |
|---|---|---|---|---|---|---|---|
| GET | `/api/v1/admin/orders` | List orders | `orders.read` | page/size/status/paymentStatus/q/from/to/sort | `ApiListResponse<AdminOrderListItemResponse>` | `CONFIRMED_FROM_CODE` | `AdminOrderController.java`, `adminApi.js` |
| GET | `/api/v1/admin/orders/{orderId}` | Order detail | `orders.read` | order id | `ApiDataResponse<AdminOrderDetailResponse>` | `CONFIRMED_FROM_CODE` | `AdminOrderController.java`, `adminApi.js` |
| GET | `/api/v1/admin/orders/{orderId}/allowed-transitions` | Allowed order status transitions | `orders.read` | order id | `ApiDataResponse<List<String>>` | `CONFIRMED_FROM_CODE` | `AdminOrderController.java`, `adminApi.js` |
| PATCH | `/api/v1/admin/orders/{orderId}/status` | Update order status | `orders.write` | `UpdateOrderStatusRequest` | `ApiDataResponse<AdminOrderDetailResponse>` | `CONFIRMED_FROM_CODE` | `AdminOrderController.java`, `adminApi.js` |
| PATCH | `/api/v1/admin/orders/{orderId}/payment-status` | Update payment status | `orders.write` | `UpdatePaymentStatusRequest` | `ApiDataResponse<AdminOrderDetailResponse>` | `CONFIRMED_FROM_CODE` | `AdminOrderController.java`, `adminApi.js` |
| POST | `/api/v1/admin/orders/{orderId}/refund` | Create refund | `orders.write` | `CreateRefundRequest` | `ApiDataResponse<AdminOrderDetailResponse>` | `BACKEND_ONLY` in audited admin client segment | `AdminOrderController.java` |
| POST | `/api/v1/admin/orders/{orderId}/notes` | Add order note | `orders.write` | `CreateOrderNoteRequest` | `ApiDataResponse<AdminOrderNoteResponse>` | `CONFIRMED_FROM_CODE` | `AdminOrderController.java`, `adminApi.js` |
| GET | `/api/v1/admin/orders/{orderId}/notes` | List order notes | `orders.read` | order id | `ApiDataResponse<List<AdminOrderNoteResponse>>` | `BACKEND_ONLY` in audited admin client segment | `AdminOrderController.java` |

### 8.4 Customers / Inventory / Returns / Media

| Module | Methods / Paths | Required permission | Contract high-level | Status | Evidence |
|---|---|---|---|---|---|
| Customers | `GET /admin/customers`, `GET/PATCH /admin/customers/{customerId}`, `PATCH /admin/customers/{customerId}/status` | `customers.read/write` | list/detail/update/status | `CONFIRMED_FROM_CODE` | `AdminCustomerController.java`, `adminApi.js` |
| Inventory | `GET /admin/inventory`, `/summary`, `/movements`, `/export.csv`, `GET /variants/{variantId}/movements`, `POST /variants/{variantId}/adjust` | `products.read/update` | stock list/summary/movements/export/adjust | `CONFIRMED_FROM_CODE` | `AdminInventoryController.java` |
| Returns | `GET /admin/returns`, `GET /admin/returns/{returnId}`, `PATCH /admin/returns/{returnId}/status` | `orders.read/write` | return list/detail/status update | `CONFIRMED_FROM_CODE` | `AdminReturnController.java` |
| Media | `POST /admin/media` multipart, `GET /admin/media`, `GET/PATCH/DELETE /admin/media/{mediaId}`, `POST /admin/media/{mediaId}/restore` | `media.read/write` | upload/list/detail/update/delete/restore | `CONFIRMED_FROM_CODE` | `AdminMediaController.java` |

### 8.5 Content / Settings / Menu / Coupon / Shipping / Homepage

| Module | Methods / Paths | Required permission | Contract high-level | Status | Evidence |
|---|---|---|---|---|---|
| Content | `GET /admin/content`, `GET /admin/content/{type}/{id}`, `POST /admin/content/articles`, `PATCH /admin/content/articles/{id}`, `POST /admin/content/pages`, `PATCH /admin/content/pages/{id}`, `DELETE /admin/content/{type}/{id}` | `content.read/update` | article/page CRUD | `CONFIRMED_FROM_CODE` | `AdminContentController.java`, `adminApi.js` |
| Settings | `GET /admin/settings`, `GET/PATCH /admin/settings/{settingKey}` | `settings.read/write` | site setting list/detail/update | `CONFIRMED_FROM_CODE` | `AdminSettingsController.java` |
| Menus | `GET/POST /admin/menus`, `GET/PATCH/DELETE /admin/menus/{menuId}`, item create/update/delete, `POST /items/reorder` | `menus.read/write` | menu + menu item CRUD/reorder | `CONFIRMED_FROM_CODE` | `AdminMenuController.java` |
| Coupons | `GET/POST /admin/coupons`, `GET/PATCH /admin/coupons/{couponId}`, `PATCH /admin/coupons/{couponId}/status` | `coupons.read/write` | coupon list/detail/create/update/status | `CONFIRMED_FROM_CODE` | `AdminCouponController.java` |
| Shipping | zone CRUD under `/admin/shipping/zones`, method CRUD under `/zones/{zoneId}/methods` | `shipping.read/write` | internal zone/method config | `CONFIRMED_FROM_CODE` | `AdminShippingController.java` |
| Sliders | `GET/POST /admin/sliders`, `POST /admin/sliders/reorder`, `PATCH/DELETE /admin/sliders/{id}` | `sliders.read/write` | homepage slider CRUD/reorder | `CONFIRMED_FROM_CODE` | `AdminSliderController.java` |
| Home videos | `GET/POST /admin/home-videos`, `POST /admin/home-videos/reorder`, `PATCH/DELETE /admin/home-videos/{id}` | `home_videos.read/write` | homepage video CRUD/reorder | `CONFIRMED_FROM_CODE` | `AdminHomeVideoController.java` |

### 8.6 Reports / Dashboard / Users / Roles / Reviews / Redirects / Internal

| Module | Methods / Paths | Required permission | Contract high-level | Status | Evidence |
|---|---|---|---|---|---|
| Dashboard | `GET /admin/dashboard?period=...` | `orders.read` | dashboard summary | `CONFIRMED_FROM_CODE` | `AdminDashboardController.java` |
| Reports | `GET /admin/reports/analytics`, `/orders/export`, `/customers/export`, `/products/export` | `orders.read`, `customers.read`, `products.read` | analytics and CSV exports | `CONFIRMED_FROM_CODE` | `AdminReportController.java` |
| Admin users | `GET/POST /admin/admin-users`, `GET/PATCH /admin/admin-users/{id}` | `admin-users.read/write` | admin user list/detail/create/update | `CONFIRMED_FROM_CODE` | `AdminAdminUsersController.java` |
| Roles | `GET/POST /admin/roles`, `PUT /admin/roles/{id}/permissions`, `DELETE /admin/roles/{id}` | `admin-users.read/write` | role list/create/update permissions/delete | `CONFIRMED_FROM_CODE` | `AdminRolesController.java` |
| Admin reviews | `GET /admin/reviews`, `GET /admin/reviews/{id}`, `PATCH /admin/reviews/{id}/status`, `DELETE /admin/reviews/{id}` | `reviews.read/write` | review moderation; list/detail payloads include `productId`, `productName`, `productSlug`, author fields, rating, body, status, timestamps; admin UI uses detail endpoint for review detail screen and product-detail deep-linking; moderation writes audit log entries (`REVIEW_STATUS_CHANGED`, `REVIEW_DELETED`) with actor, review snapshot before/after, and request IP/user-agent when available, then recomputes `products.rating` / `products.rating_count` from approved reviews | `CONFIRMED_FROM_CODE` | `AdminReviewController.java`, `AdminReviewService.java`, `bigbike-admin/src/lib/adminApi.js`, `bigbike-admin/src/screens/ReviewListScreen.jsx`, `bigbike-admin/src/screens/ReviewDetailScreen.jsx` |
| Admin redirects | `GET/POST /admin/redirects`, `GET/PATCH/DELETE /admin/redirects/{id}` | `redirects.read/write` | redirect CRUD | `CONFIRMED_FROM_CODE` | `AdminRedirectController.java` |
| Internal redirects | `GET /api/internal/redirect`, `GET /api/internal/redirects/active`, `POST /api/internal/redirects/hit/{redirectId}` | No app auth; infra lock recommended | Next.js middleware redirect lookup/cache/hit counter | `CONFIRMED_FROM_CODE` | `InternalRedirectController.java`, `SecurityConfig.java` |
| Audit | Admin audit log controller exists | Unknown from current detailed fetch | Audit log list | `NEEDS_VERIFICATION` | backend compile list contains `AdminAuditLogController.java` |
| POS | Admin POS controller exists | Unknown from current detailed fetch | Point-of-sale search/order creation | `NEEDS_VERIFICATION` | backend compile list contains `AdminPosController.java` |

## 9. Frontend/API Client Mapping

| Frontend App | API Client / Caller | Backend Endpoint | Status | Evidence |
|---|---|---|---|---|
| `bigbike-web` | `bigbike-web/lib/api/public-api.ts` | `/api/v1/products`, `/products/{slug}`, `/categories`, `/categories/{slug}`, `/brands`, `/brands/{slug}` | `CONFIRMED_FROM_CODE` | `public-api.ts`, `CatalogController.java` |
| `bigbike-web` | `public-api.ts` | `/api/v1/articles`, `/articles/{slug}`, `/pages/{slug}` | `CONFIRMED_FROM_CODE` | `public-api.ts`, `ContentController.java` |
| `bigbike-web` | `public-api.ts` | `/api/v1/menus/{location}`, `/settings/public`, `/sliders`, `/home-videos` | `CONFIRMED_FROM_CODE` | `public-api.ts`, public controllers |
| `bigbike-web` | `public-api.ts` | `/api/v1/orders/lookup` | `CONFIRMED_FROM_CODE` | `public-api.ts`, `OrderLookupController.java` |
| `bigbike-web` | `public-api.ts` | `/api/v1/search` | `CONFIRMED_FROM_CODE` | `public-api.ts`, `PublicSearchController.java` |
| `bigbike-admin` | `bigbike-admin/src/lib/adminApi.js` | `/api/v1/auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/me` | `CONFIRMED_FROM_CODE` | `adminApi.js`, `AuthController.java` |
| `bigbike-admin` | `adminApi.js` | `/api/v1/admin/products`, `/categories`, `/brands`, `/content`, `/redirects`, `/orders`, `/customers` | `CONFIRMED_FROM_CODE` | `adminApi.js`, admin controllers |
| `bigbike-admin` | `adminApi.js` | Additional admin modules: media/settings/coupons/menus/shipping/reviews/reports/sliders/home-videos/admin-users/roles likely exist in same client; detailed lines partially truncated by fetch output | `NEEDS_VERIFICATION` | `adminApi.js`, respective controllers |
| `bigbike_mobile` | `bigbike_mobile/lib/core/api/api_client.dart`, `api_endpoints.dart`, `api_exception.dart` exist; per-endpoint mapping/payload not yet field-by-field audited | Customer/product/cart/order APIs likely intended | `NEEDS_VERIFICATION` for endpoint-level mapping | `bigbike_mobile/lib/core/api/api_client.dart`, `bigbike_mobile/lib/core/api/api_endpoints.dart`, `bigbike_mobile/lib/core/api/api_exception.dart`, `bigbike_mobile/lib/core/widgets/status_badge.dart` |

## 10. Pagination / Filtering / Sorting Contract

| API Area | Pagination | Filters | Sort | Status | Evidence |
|---|---|---|---|---|---|
| Public products | `page`, `size`, max 100 | category, brand, q, color, gender, min/max price, featured, showOnHomepage | free string; web uses known sort values | `CONFIRMED_FROM_CODE` | `CatalogController.java`, `public-api.ts` |
| Public categories | `page`, `size`, max 100 | `showOnHomepage` or `filterHome` (both accepted; homepage filter only); no visibility filter (always returns visible only) | default `sortOrder:asc`; allowed: `name`, `createdAt`, `sortOrder` | `CONFIRMED_FROM_CODE` | `CatalogController.java`, `CatalogReadService.java` |
| Public brands | `page`, `size`, max 100 | none audited | free string | `CONFIRMED_FROM_CODE` | `CatalogController.java` |
| Public articles | `page`, `size`, max 100 | category, q | free string; web uses article sort values | `CONFIRMED_FROM_CODE` | `ContentController.java`, `public-api.ts` |
| Public reviews | `page`, `size`, default `1/10`, max 50 | approved reviews only (status filter is backend-owned, not client-controlled) | default `createdAt:desc` | `CONFIRMED_FROM_CODE` | `PublicReviewController.java`, `PublicReviewService.java`, `ReviewJpaRepository.java` |
| Search | no pagination; `limit` max 50 | type | none | `CONFIRMED_FROM_CODE` | `PublicSearchController.java` |
| Customer orders | `page`, `size` | status, paymentStatus | none audited | `CONFIRMED_FROM_CODE` | `CustomerOrderController.java` |
| Admin catalog | `page`, `size` or `pageSize`, max 100 | q/search, publishStatus, stockState, brandId, categoryId, visibility | free string | `CONFIRMED_FROM_CODE` | `AdminCatalogController.java` |
| Admin orders | `page`, `size`, max 100 | status, paymentStatus, q, from, to | default `placedAt:desc` | `CONFIRMED_FROM_CODE` | `AdminOrderController.java` |
| Admin customers | `page`, `size`, max 100 | q, status, synthetic | none audited | `CONFIRMED_FROM_CODE` | `AdminCustomerController.java` |
| Admin media | `page`, `size`, max 100 | q, mimeType, status, storageProvider | none audited | `CONFIRMED_FROM_CODE` | `AdminMediaController.java` |
| Admin settings/coupons/menus/shipping/reviews/redirects | standard page/size on list endpoints where present | module-specific filters | none audited | `CONFIRMED_FROM_CODE` | respective admin controllers |
| Inventory/returns | Uses `PageResult` rather than `ApiListResponse` in controllers audited | module filters | none audited | `CONFIRMED_FROM_CODE`; wrapper consistency `NEEDS_VERIFICATION` | `AdminInventoryController.java`, `AdminReturnController.java` |

## 11. Mutation Contract Rules

| Mutation Area | Backend Validation | Permission | Side Effects | Status | Evidence |
|---|---|---|---|---|---|
| Cart mutations | `@Valid` request DTOs + service validation | Public, CSRF mutation filter | Set/consume guest cart and CSRF cookies, recalc totals/coupons | `CONFIRMED_FROM_CODE` | `CartController.java`, `SecurityConfig.java` |
| Checkout/quick-buy | `@Valid` DTO + checkout service validation; optional `Idempotency-Key` header for duplicate-submit protection | Public, CSRF mutation filter | Create order, capture contact/totals, decrement stock, record client IP/user-agent, notifications | `CONFIRMED_FROM_CODE` | `CheckoutController.java`, `DATA_CONTRACT.md` |
| Product/catalog mutations | `@Valid`, regex/size constraints | `products.update`, `catalog.update` | Persist catalog, soft-delete/restore product/category semantics | `CONFIRMED_FROM_CODE` | `AdminCatalogController.java`, `UpsertProductRequest.java` |
| Order mutations | `@Valid` status/payment/refund/note requests | `orders.write` | Status transition, payment status, refund, notes, audit/admin id | `CONFIRMED_FROM_CODE` | `AdminOrderController.java` |
| Customer mutations | `@Valid` requests | `customers.write` | Update profile/status and audit admin id | `CONFIRMED_FROM_CODE` | `AdminCustomerController.java` |
| Inventory adjustment | `@Valid AdjustStockRequest` | `products.update` | Stock quantity/movement update | `CONFIRMED_FROM_CODE` | `AdminInventoryController.java` |
| Return status update | `@Valid UpdateReturnStatusRequest` | `orders.write` | Return lifecycle update; may affect refund/stock depending service | `CONFIRMED_FROM_CODE`; exact side effect `NEEDS_VERIFICATION` | `AdminReturnController.java` |
| Media upload/update/delete/restore | multipart upload or metadata request | `media.write` | Store media, logical/hard delete, restore | `CONFIRMED_FROM_CODE` | `AdminMediaController.java` |
| Settings/menu/coupon/shipping mutations | Mixed DTOs/Map bodies | module write permissions | Persist operational configuration | `CONFIRMED_FROM_CODE`; map-body validation weaker | respective controllers |
| Redirect mutations | `@Valid`, `@NotBlank` create request | `redirects.write` | Create/update/delete SEO redirects | `CONFIRMED_FROM_CODE` | `AdminRedirectController.java` |
| Public review submit | manual validation for author/rating/comment; honeypot field `website` (silently dropped if filled); duplicate guard on normalized authorName+comment within 24h (any status); rate-limit 5/min/IP | Public | Creates pending review | `CONFIRMED_FROM_CODE` | `PublicReviewController.java`, `PublicReviewService.java`, `RateLimitingFilter.java`, `SecurityConfig.java` |
| Admin review moderation | status update/delete | `reviews.write` | Moderate/delete review, recompute product rating cache from approved reviews, and write audit log entries with actor id, review snapshot before/after, request IP, and user-agent when available | `CONFIRMED_FROM_CODE` | `AdminReviewController.java`, `AdminReviewService.java` |

## 12. Missing / Drift / Needs Verification

### CONFLICTING_EVIDENCE

| Area | Issue | Risk | Evidence |
|---|---|---|---|
| Customer email verify (RESOLVED 2026-05-05) | `SecurityConfig` now permits both `POST` (controller) and `GET` (legacy) for `/api/v1/customer/auth/verify-email`. BUG-001 fixed. | None — POST flow works. | `SecurityConfig.java:63-64`, `CustomerAuthController.java:65` |
| Response envelope consistency | Most APIs use `ApiDataResponse`/`ApiListResponse`, but customer returns, admin inventory/returns/reports/internal redirects return raw DTO/PageResult/CSV. | Client parsing must handle multiple shapes; API contract is not uniform. | `CustomerOrderController.java`, `AdminInventoryController.java`, `AdminReturnController.java`, `AdminReportController.java`, `InternalRedirectController.java` |
| Admin content type path | Admin client detail path uses singular `article/page`; mutation path uses plural `articles/pages`; backend intentionally supports singular in `/{type}/{id}` and plural in create/update. | Easy to call wrong route from new clients. | `AdminContentController.java`, `adminApi.js` |

### BACKEND_ONLY candidates

- `GET /api/v1/products/{idOrSlug}/snapshot`: backend exists; audited web client did not call it.
- `GET /api/v1/search-suggest`: backend exists; audited web client did not call it directly.
- `GET /api/v1/admin/orders/{orderId}/notes`: backend exists; audited admin client segment only showed add note, not list notes.
- `POST /api/v1/admin/orders/{orderId}/refund`: backend exists; audited admin client segment did not show refund caller.
- Audit/POS controllers exist in backend compile list, but detailed route audit was not completed in this pass.

### FRONTEND_ONLY

No hard `FRONTEND_ONLY` API was confirmed from the audited `bigbike-web` and visible `bigbike-admin` client segments. Mobile API client was not found by current repository search, so mobile-specific frontend-only calls cannot be ruled out.

### NEEDS_VERIFICATION

- `bigbike_mobile` per-endpoint mapping (network layer file `bigbike_mobile/lib/core/api/api_client.dart` and constants in `api_endpoints.dart` exist; field-by-field caller mapping not yet audited).
- Full `adminApi.js` lower-section mapping for media/settings/coupons/menus/shipping/reviews/reports/sliders/home-videos/admin-users/roles because fetched file output was truncated after the order/customer section.
- Detailed `AdminAuditLogController` and `AdminPosController` endpoint tables.
- Exact payload shapes for Map-based admin endpoints: shipping, roles, admin-users, reviews, redirects.
- WebSocket STOMP auth/channel contract.
- Runtime enforcement of customer CSRF for every intended mutation path.
- OpenAPI parity with controller source after future changes.

## 13. Evidence Summary

| Area | Evidence Path | What It Proves | Confidence |
|---|---|---|---|
| Existing docs | `docs/engineering/ARCHITECTURE.md`, `docs/engineering/DATA_CONTRACT.md`, `docs/business/*` | Architecture/data context and module boundaries | High |
| OpenAPI | `bigbike-backend/src/main/resources/openapi/bigbike-openapi.json` | Published API tags/paths/response envelope intent | Medium; still cross-checked with controllers |
| Security | `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/config/SecurityConfig.java` | Public/admin/customer auth boundaries, CSRF comments, WebSocket/internal route posture | High |
| Response wrappers | `api/common/ApiDataResponse.java`, `ApiListResponse.java`, `PaginationMeta.java`, `ApiErrorResponse.java`, `ApiError.java`, `ApiErrorDetail.java` | Standard success/list/error envelope shapes | High |
| Error handling | `api/error/GlobalExceptionHandler.java` | Validation/error behavior and status mapping | High |
| Public catalog/search/content | `CatalogController.java`, `PublicSearchController.java`, `ContentController.java` | Public GET endpoints, filters, pagination, validation | High |
| Public settings/menu/homepage | `PublicSettingsController.java`, `PublicMenuController.java`, `PublicSliderController.java`, `PublicHomeVideoController.java` | Public config/navigation/homepage APIs | High |
| Cart/checkout | `CartController.java`, `CheckoutController.java` | Guest/customer cart and checkout endpoints, cookies, CSRF-related flow | High |
| Customer | `CustomerAuthController.java`, `CustomerController.java`, `CustomerAddressController.java`, `CustomerOrderController.java`, `OrderLookupController.java` | Customer auth/account/address/orders/returns/lookup API | High |
| Admin auth/catalog/orders | `AuthController.java`, `AdminCatalogController.java`, `AdminOrderController.java` | Admin auth and primary operational modules | High |
| Admin operations | `AdminCustomerController.java`, `AdminInventoryController.java`, `AdminReturnController.java`, `AdminMediaController.java`, `AdminContentController.java` | Customers/inventory/returns/media/content APIs | High |
| Admin config/modules | `AdminSettingsController.java`, `AdminMenuController.java`, `AdminCouponController.java`, `AdminShippingController.java`, `AdminSliderController.java`, `AdminHomeVideoController.java` | Settings/menu/coupon/shipping/homepage module APIs | High |
| Admin governance/reporting | `AdminDashboardController.java`, `AdminReportController.java`, `AdminAdminUsersController.java`, `AdminRolesController.java`, `AdminReviewController.java`, `AdminRedirectController.java`, `InternalRedirectController.java` | Dashboard/report/user/role/review/redirect/internal APIs | High |
| Web client mapping | `bigbike-web/lib/api/public-api.ts` | Public web API calls and query params | High |
| Admin client mapping | `bigbike-admin/src/lib/adminApi.js` | Admin auth/catalog/content/redirect/order/customer API calls and normalization; lower sections truncated | Medium |
| Mobile mapping | `bigbike_mobile/lib/core/api/api_client.dart`, `api_endpoints.dart`, `api_exception.dart`, `lib/core/widgets/status_badge.dart`, router evidence from architecture | Mobile network layer file confirmed (Dio-based client, endpoint constants); field-by-field per-endpoint mapping not yet audited | Medium / per-endpoint mapping needs verification |

## 14. Relationship With Other Docs

- `DATA_CONTRACT.md`: chứa data shape chi tiết của domain/entity/DTO. API contract chỉ mô tả request/response high-level.
- `PERMISSION_MATRIX.md`: nên chứa permission detail theo role/module/action. File này chỉ ghi permission strings thấy trong controller.
- `API_FLOW_MAP.md`: nên mô tả API theo workflow end-to-end như browse -> cart -> checkout -> order.
- `TRACEABILITY_MATRIX.md`: nên nối API với module, business rule, acceptance criteria, test.
- `STATE_MACHINES.md`: nên mô tả status transition hợp lệ. File này chỉ ghi endpoint nào cập nhật/truy vấn state.
- `BUSINESS_RULES.md`: nên mô tả luật nghiệp vụ bắt buộc. File này chỉ ghi nơi rule được gọi/enforce ở API layer hoặc service layer.

## Audit Notes

- Chỉ đọc/inspect repo qua GitHub source evidence.
- Không chạy build/test/deploy.
- Không chạy migration.
- Không sửa code application.
- Không refactor.
- Không implement feature mới.
- Không đưa secret/token/password/private key/env value vào tài liệu.

## Post-Audit Summary

### Files created/updated

| File | Action |
|---|---|
| `docs/engineering/API_CONTRACT.md` | Created |

### API groups documented

Public Catalog, Public Search, Public Content, Public Settings/Menu/Slider/Home Video, Cart, Checkout, Customer Auth, Customer Profile/Address/Orders/Returns, Order Lookup, Contact, Reviews, Admin Auth, Admin Products/Catalog, Admin Orders, Admin Customers, Admin Inventory, Admin Returns, Admin Media, Admin Content, Admin Settings/Menu/Coupon, Admin Shipping, Admin Reports/Dashboard, Admin Users/Roles, Admin Reviews, Admin Redirects/Internal Redirects, Audit/POS notes.

### CONFIRMED_FROM_CODE highlights

- Standard response/error/pagination wrappers.
- Public catalog/search/content/homepage APIs.
- Cart and checkout APIs with guest/customer cookie context.
- Customer auth/profile/address/order/return APIs.
- Admin auth/catalog/order/customer/inventory/return/media/content/settings/menu/coupon/shipping/slider/home-video/dashboard/report/user/role/review/redirect APIs.
- Public web client mapping for catalog/content/settings/menu/homepage/order lookup/search.
- Admin client mapping for visible auth/catalog/content/redirect/order/customer sections.

### BACKEND_ONLY highlights

- Product snapshot endpoint.
- Search suggest endpoint.
- Admin order note list endpoint.
- Admin order refund endpoint in visible admin client audit.
- Audit/POS detailed endpoints pending deeper controller audit.

### FRONTEND_ONLY highlights

- No hard frontend-only endpoint confirmed from audited web/admin client sections.
- Mobile frontend-only calls remain unknown because mobile network layer was not found in current search.

### NEEDS_VERIFICATION highlights

- Mobile API client/caller mapping.
- Full lower part of `adminApi.js` mapping because fetched output was truncated.
- Admin audit/POS controller routes.
- Map-body endpoint validation depth.
- WebSocket STOMP auth/channel contract.
- CSRF runtime behavior on every customer/guest mutation.
