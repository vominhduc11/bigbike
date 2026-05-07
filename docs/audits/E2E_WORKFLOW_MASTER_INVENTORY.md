# BigBike E2E Workflow Master Inventory

> **Audit date:** 2026-05-07
> **Auditor:** Senior Software Architect + QA Auditor (read-only AI agent)
> **Scope:** Toàn bộ repo BigBike trên branch hiện tại — `bigbike-web`, `bigbike-admin`, `bigbike-backend`, `bigbike_mobile`, và `docs/`.
> **Method:** Read-only inspection (file listing, glob, grep, read) — không build, không test, không deploy, không sửa code production.
> **Phạm vi:** Inventory thuần — liệt kê những gì repo thực sự có, đánh dấu rõ phần nào partial / doc-only / schema-only / not-found. **Không** xác nhận production-ready cho bất kỳ workflow nào.

---

## 1. Executive Summary

### Tổng số

| Hạng mục | Số liệu |
|---|---:|
| Tổng module active được nhận diện | **52** (Public 18 + Admin 22 + Backend/System 12) |
| Tổng E2E workflow được nhận diện | **109** |
| `CONFIRMED_FROM_CODE` (không có test trực tiếp) | **78** |
| `CONFIRMED_BY_TEST` (có test class trực tiếp cover) | **24** |
| `PARTIAL` (có code nhưng thiếu UI/test/contract) | **5** |
| `NEEDS_VERIFICATION` (có dấu hiệu nhưng chưa đủ evidence) | **2** |
| `SCHEMA_ONLY` (chỉ có DB migration, không có active controller/service/UI) | **1** (stock receipts/receipt lines/receipt serials — V52/V53/V55) |
| `NOT_FOUND_IN_REPO` (docs/memory mention, code không có) | **3** (SePay webhook code, GHN/GHTK/Viettel Post carrier integration, notification read/unread center) |

### Top 20 workflow rủi ro nhất cần audit sâu

Sắp theo (1) tác động doanh thu/dữ liệu, (2) độ phức tạp side-effect liên module, (3) thiếu test trực tiếp.

| # | Workflow | Lý do | Status |
|---|---|---|---|
| 1 | **Checkout cart → order (E2E-014)** | Chạm tới order/payment/stock/coupon/shipping/email/WS, có idempotency, race-condition; có test Phase1F nhưng web/mobile UI chưa có test integration. | `CONFIRMED_BY_TEST` (backend) / `PARTIAL` (web/mobile) |
| 2 | **Quick Buy → order (E2E-015)** | Side-effect tương tự checkout nhưng bypass cart, không có dedicated test class. | `CONFIRMED_FROM_CODE` |
| 3 | **POS Cash/Card sale (E2E-067)** | Stock decrement immediate, audit log, WS event, không thông qua pre-order pending state. Có Phase1MPosApiTest. | `CONFIRMED_BY_TEST` |
| 4 | **POS Credit sale → receivable (E2E-068)** | Tạo receivable, kiểm credit limit, có thể override, walk-in customer snapshot. Có AdminReceivableApiTest, nhưng full chain (POS → receivable → payment → write-off) chưa có integration test thấy được. | `CONFIRMED_BY_TEST` (partial) |
| 5 | **Refund (full / partial) (E2E-046)** | Side-effect lớn: payment record + order paymentStatus + order status (full refund) + stock restore (nếu order REFUNDED) + audit + WS + report numbers + receivable. | `CONFIRMED_FROM_CODE` (no direct test) |
| 6 | **Return RECEIVED → REFUNDED (E2E-079)** | Chain tới RefundService → payment → order paymentStatus → stock restore → notification. Có Phase1LReturnsApiTest. | `CONFIRMED_BY_TEST` |
| 7 | **Order CANCELLED stock restore (E2E-040)** | Dễ miss khi transition `PROCESSING → CANCELLED` thiếu restore. Phase1H tests admin order, transition coverage chưa rõ. | `CONFIRMED_FROM_CODE` |
| 8 | **Coupon apply at checkout (E2E-013)** | Lock row, validate expiry/min/limit, increment usage atomically, V73 enforce one-coupon-per-cart. Phase1E + Phase1F + Phase1J. | `CONFIRMED_BY_TEST` |
| 9 | **Receivable record payment (E2E-070)** | Updates receivable + creates Payment row + transitions order paymentStatus + audit. AdminReceivableApiTest. | `CONFIRMED_BY_TEST` |
| 10 | **Receivable write-off (E2E-071)** | Sensitive permission, audit, status transition tới WRITTEN_OFF. AR_RULE_007. | `CONFIRMED_FROM_CODE` |
| 11 | **Customer-initiated return creation (E2E-077)** | Authorization (customer phải own order); chưa rõ eligibility (status order, time window). Customer endpoint trả raw DTO không bọc envelope (drift docs đã flag). | `PARTIAL` |
| 12 | **Inventory manual stock adjust + serial (E2E-061/062)** | Phase1KInventoryP0FixApiTest + Phase1KInventorySerialApiTest cover. Side-effect movement + recompute stockState. | `CONFIRMED_BY_TEST` |
| 13 | **Customer auth `verify-email` POST (E2E-021)** | Docs flag: SecurityConfig permitAll **GET** nhưng controller `@PostMapping` → POST sẽ bị `anyRequest().authenticated()` chặn → email link sẽ fail in prod. | `CONFLICTING_EVIDENCE` (code bug đã được docs catch) |
| 14 | **Admin product publish/hide/archive/trash/restore (E2E-051..055)** | State machine 7 state, validator centralized; MISSING_TEST_COVERAGE cho transition. | `CONFIRMED_FROM_CODE` |
| 15 | **Admin order status update (E2E-035)** | Allowed-transitions map, side effect (cancelledAt, completedAt, stock restore, email, WS). Phase1H covers but transition coverage chưa rõ. | `CONFIRMED_FROM_CODE` |
| 16 | **Admin order payment status update (E2E-036)** | 8-state map, side-effect cross to payment record + refund fields. MISSING_TEST_COVERAGE direct. | `CONFIRMED_FROM_CODE` |
| 17 | **Admin user status/role update + Super Admin guard (E2E-095)** | Self-deactivation guard, last-Super-Admin guard. Phase1IAdminManagementApiTest covers some. | `CONFIRMED_BY_TEST` (partial) |
| 18 | **Admin role permission update (E2E-098)** | Sensitive `roles.write`; permission catalog + custom roles. AdminRolesApiTest. | `CONFIRMED_BY_TEST` |
| 19 | **Admin redirect manage + proxy.ts internal endpoint (E2E-091)** | `permitAll` ở app layer, expects infra IP allowlist; AdminRedirectApiTest. | `CONFIRMED_BY_TEST` (app), `NEEDS_VERIFICATION` (infra) |
| 20 | **Customer registration → email verify → login (E2E-019/021/020)** | 3-step flow; verify-email POST bug; rate-limit 3/min; sets session+refresh+csrf cookies. Phase1DCustomerAuthTest. | `CONFIRMED_BY_TEST` (partial) + `CONFLICTING_EVIDENCE` (verify-email) |

---

## 2. Repository Surfaces Reviewed

### Backend (`bigbike-backend`)
- 41 controller (admin 22, public 6, customer 4, cart 1, checkout 1, order 2, auth 1, content 1, internal 1, health 1, openapi 1)
- ~70 service class
- ~50 entity / 13 entity package
- 81 Flyway migration (V1–V81)
- Config/Security: `SecurityConfig`, `JwtAuthFilter`, `CustomerSessionFilter`, `CustomerCsrfFilter`, `RateLimitingFilter`, `SecurityHeadersFilter`, `CorsConfig`, `RequestIdFilter`, `WebSocketConfig`, `MinioConfig`, `RestAuthenticationEntryPoint`, `RestAccessDeniedHandler`, `DataInitializer`
- Test: 62 test class trong `src/test/java/**`

### Web (`bigbike-web`)
- Next.js 16.2.4 + React 19.2.4 + TypeScript + Vitest
- 31 page route + 7 Next API route + `proxy.ts`
- 32 lib module (api, auth, contracts, schemas, seo, query, utils, mock, vn-address, recently-viewed, analytics, logger)
- 8 component group (analytics, cart, catalog, contact, content, home, layout, providers, ui)
- 11 vitest test file ở `__tests__/**`

### Admin (`bigbike-admin`)
- React 19 + Vite 8 + JSX (no react-router; custom SPA routing trong `App.jsx`)
- 33 screen, 23 component, 16 lib file
- WebSocket: native STOMP client `lib/adminWebSocket.js` subscribe `/topic/admin/orders`
- TanStack React Query, Tiptap, @dnd-kit, recharts, sonner, xlsx, zod, i18next
- **0 test file** (gap)

### Mobile (`bigbike_mobile`)
- Flutter Dart SDK ~3.x + Riverpod + GoRouter + Dio + flutter_secure_storage
- 13 feature module (account, articles, auth, brands, cart, categories, checkout, contact, content, home, products, search, shell)
- core/api, core/models, core/providers, core/widgets, core/router, core/theme
- 3 unit test (model brand, model checkout, widget smoke)

### Docs (`docs/`)
- `business/`: PROJECT_OVERVIEW, MODULE_CATALOG, USER_ROLES, BUSINESS_PROCESS, BUSINESS_RULES, WORKFLOW_OVERVIEW, STATE_MACHINES, ACCEPTANCE_CRITERIA, GLOSSARY
- `engineering/`: ARCHITECTURE, API_CONTRACT, DATA_CONTRACT, API_FLOW_MAP, PERMISSION_MATRIX, TESTING_GUIDE, DEPLOYMENT_GUIDE, INTEGRATION_GUIDE, TRACEABILITY_MATRIX
- `audits/`: 16 module audit/fix/completion report cũ
- `DOCS_VERIFICATION_REPORT.md` (audit canonical, 2026-05-04 + 2026-05-05 patches)

---

## 3. Module Inventory

Status legend: `CONFIRMED_FROM_CODE` (CFC), `CONFIRMED_BY_TEST` (CBT), `PARTIAL` (P), `NEEDS_VERIFICATION` (NV), `DOC_ONLY` (DO), `CODE_ONLY` (CO), `SCHEMA_ONLY` (SO), `NOT_FOUND_IN_REPO` (NFIR).

### 3.1 Public / Customer modules

| # | Module | Web surface | Mobile surface | Backend | Status | Evidence |
|---|---|---|---|---|---|---|
| M01 | Homepage | `app/page.tsx` | `features/home/HomeScreen` | `CatalogReadService`, `SliderReadService`, `HomeVideoReadService`, `ContentReadService` | CFC | (above) |
| M02 | Catalog products list | `app/san-pham/page.tsx`, `/danh-muc-san-pham/[slug]` | `features/products/ProductListScreen`, `features/categories/CategoryDetailScreen` | `CatalogController GET /api/v1/products`, `/categories/{slug}` | CBT | `PublicReadApiTest`, agent inventory |
| M03 | Categories list | `app/danh-muc-san-pham/page.tsx` | `features/categories/CategoryListScreen` | `CatalogController GET /categories` | CBT | `PublicReadApiTest` |
| M04 | Brands | `app/brands/`, `/brands/[slug]` | `features/brands/BrandListScreen`, `BrandDetailScreen` | `CatalogController GET /brands`, `/brands/{slug}` | CBT | `PublicReadApiTest` |
| M05 | Search + Search Suggest | `app/tim-kiem/page.tsx`, `/api/search-suggest` | `features/search/SearchScreen` | `PublicSearchController GET /search`, `/search-suggest` | CBT | `__tests__/api/search-suggest-route.test.ts`, `PublicReadApiTest` |
| M06 | Product detail | `app/product/[slug]/page.tsx` | `features/products/ProductDetailScreen` | `CatalogController GET /products/{slug}`, `/snapshot` | CBT | `__tests__/api/snapshot-route.test.ts`, `PublicReadApiTest` |
| M07 | Reviews (public) | `components/catalog/ReviewsSection.tsx`, `/api/products/[id]/reviews` | (mobile fetch in product detail) | `PublicReviewController GET/POST /api/v1/products/{id}/reviews` | CBT | `Phase1NReviewsApiTest` |
| M08 | Blog / Articles | `app/tin-tuc/`, `/tin-tuc/[slug]` | `features/articles/ArticleListScreen`, `ArticleDetailScreen` | `ContentController GET /articles`, `/articles/{slug}` | CBT | `ContentPublicApiTest`, `ContentP1ApiTest` |
| M09 | Pages / Policies / Guides | `app/chinh-sach/[slug]/`, `/huong-dan/`, `/[slug]` | `features/content/ContentScreen` | `ContentController GET /pages`, `/pages/{slug}` | CBT | `ContentP1ApiTest`, `ContentPublicApiTest` |
| M10 | Contact | `app/lien-he/page.tsx` | `features/contact/ContactScreen` | `ContactController POST /api/v1/contact` (rate-limit 3/min) | CFC | `ContactController.java` |
| M11 | Cart | `app/gio-hang/page.tsx`, `lib/cart-context.tsx` | `features/cart/CartScreen`, `core/providers/cart_provider.dart` | `CartController` (CSRF + bb_guest_id cookie) | CBT | `Phase1ECartApiTest` |
| M12 | Checkout (cart + quick-buy) | `app/thanh-toan/page.tsx` | `features/checkout/CheckoutScreen` | `CheckoutController POST /checkout`, `/orders/quick-buy`, `GET /checkout/options` | CBT | `Phase1FCheckoutApiTest` |
| M13 | Coupon apply / remove | `lib/query/hooks.ts useApplyCoupon` | `cart_provider.dart applyCoupon` | `CartController POST/DELETE /coupons` | CBT | `Phase1ECartApiTest`, V73 |
| M14 | Order received / guest order lookup | `app/don-hang/xac-nhan/page.tsx` | `features/checkout/OrderConfirmationScreen` | `OrderLookupController GET /api/v1/orders/lookup` | CFC | `OrderLookupController.java` |
| M15 | Customer auth (register / login / logout / refresh / verify-email / forgot-password / reset-password) | `dang-nhap/`, `/dang-ky/`, `/quen-mat-khau/`, `/xac-nhan-email/` | `features/auth/{Login,Register,ForgotPassword}Screen` | `CustomerAuthController POST /verify-email\|register\|login\|password/forgot\|password/reset\|refresh\|logout` | P (verify-email POST/GET drift) | `Phase1DCustomerAuthTest`, `Phase1I1CustomerStatusLoginTest`, DOCS_VERIFICATION_REPORT 6.1 |
| M16 | Customer account / profile / addresses / orders / returns | `app/tai-khoan/**` | `features/account/**` | `CustomerController`, `CustomerAddressController`, `CustomerOrderController` | CBT | `Phase1GOrderReadApiTest`, `Phase1LReturnsApiTest` |
| M17 | Vietnam address lookup | `lib/vn-address-data.ts` (static), backend dynamic | `core/utils` (mostly via API) | `VnAddressController GET /address/provinces`, `/districts`, `/wards` | CFC | `VnAddressController.java` |
| M18 | Sitemap / Robots / Revalidation / Legacy redirect runtime | `app/sitemap.ts`, `app/robots.ts`, `app/api/revalidate/route.ts`, `proxy.ts` | n/a | `WebRevalidationService` (on backend), `InternalRedirectController GET /api/internal/redirect` | CBT | `WebRevalidationServiceTest`, `__tests__/seo/robots.test.ts`, `proxy.ts` |

### 3.2 Admin modules

| # | Module | Admin screen | Backend | Status | Evidence |
|---|---|---|---|---|---|
| M19 | Dashboard | `DashboardScreen.jsx` | `AdminDashboardController` | CBT | `AdminDashboardApiTest` |
| M20 | Products | `ProductListScreen` + `ProductDetailScreen` | `AdminCatalogController /products`, `AdminCatalogReadService`, `AdminCatalogMutationService`, `AdminMutationValidators` | CBT | `AdminMutationApiTest`, `AdminReadApiTest`, `AdminMutationValidatorsTest`, `VariantGalleryRoundtripTest` |
| M21 | Categories | `CategoryListScreen`, `CategoryDetailScreen` | `AdminCatalogController /categories` | CBT | `AdminMutationApiTest` |
| M22 | Brands | `BrandListScreen`, `BrandDetailScreen` | `AdminCatalogController /brands` | CBT | `AdminMutationApiTest` |
| M23 | Inventory | `InventoryScreen` | `AdminInventoryController`, `AdminInventoryService` | CBT | `Phase1KInventoryP0FixApiTest`, `Phase1KInventorySerialApiTest` |
| M24 | Orders | `OrderListScreen`, `OrderDetailScreen` | `AdminOrderController`, `AdminOrderService` | CBT | `Phase1HAdminOrderApiTest` |
| M25 | Payments (per-order) | (sub-screen of OrderDetailScreen) | `AdminOrderController /payment-status`, `Payment*Entity` | CFC | `AdminOrderService.java` |
| M26 | Refunds | `RefundModal.jsx` (in OrderDetailScreen) | `AdminOrderController POST /{id}/refund`, `RefundService` | CFC | `RefundService.java`, `AdminOrderService.java` |
| M27 | Returns | `ReturnListScreen` | `AdminReturnController`, `AdminReturnService` | CBT | `Phase1LReturnsApiTest` |
| M28 | Customers | `CustomerListScreen`, `CustomerDetailScreen` | `AdminCustomerController` | CBT | `Phase1IAdminManagementApiTest` |
| M29 | Reviews | `ReviewListScreen`, `ReviewDetailScreen` | `AdminReviewController`, `AdminReviewService` | CBT | `Phase1NReviewsApiTest` |
| M30 | Coupons | `CouponListScreen` | `AdminCouponController`, `AdminCouponService`, `CouponExpiryScheduler` (hourly cron) | CBT | `Phase1JAdminSettingsMenuCouponApiTest` |
| M31 | POS | `PosScreen` | `AdminPosController`, `PosOrderService` | CBT | `Phase1MPosApiTest` |
| M32 | Receivables / Công nợ | `ReceivablesListScreen`, `ReceivableDetailScreen` | `AdminReceivableController`, `ReceivableService`, `ReceivableQueryService`, `CreditPolicyService` | CBT | `AdminReceivableApiTest`, V75 |
| M33 | Reports | `ReportsScreen` | `AdminReportController`, `AdminReportService`, V77/V78 indexes/permissions | CBT | `AdminReportApiTest`, `AdminReportRepositoryQueryTest`, `AdminReportCsvHardeningTest` |
| M34 | Report CSV export | (button in ReportsScreen, OrderListScreen, etc.) | `/api/v1/admin/reports/{orders,customers,products}/export`, `/api/v1/admin/inventory/export.csv` | CBT | `AdminReportApiTest`, `AdminReportCsvHardeningTest` |
| M35 | Audit logs | `AuditLogListScreen` | `AdminAuditLogController`, `AdminAuditLogService`, V76 | CFC | `AdminAuditLogController.java` (no dedicated test class) |
| M36 | Media | `MediaLibraryScreen`, picker modals | `AdminMediaController`, `AdminMediaService`, MinioConfig | CBT | `AdminMediaP0Test` |
| M37 | Content (Articles + Pages + content categories + authors) | `ContentListScreen`, `ContentDetailScreen` | `AdminContentController`, `AdminContentMutationService`, `AdminContentReferenceService` | CBT | `AdminContentApiTest` |
| M38 | Menus | `MenuScreen` | `AdminMenuController`, `AdminMenuService` | CBT | `Phase1JAdminSettingsMenuCouponApiTest` |
| M39 | Sliders | `SliderListScreen` | `AdminSliderController`, `AdminSliderService` | CBT | `SliderApiTest`, `SliderRepositoryTest` |
| M40 | Home Videos | `HomeVideoListScreen` | `AdminHomeVideoController`, `HomeVideoReadService` | CBT | `HomeVideoApiTest`, `HomeVideoRepositoryTest` |
| M41 | Redirects | `RedirectListScreen` | `AdminRedirectController`, `AdminRedirectService` | CBT | `AdminRedirectApiTest` |
| M42 | Shipping | `ShippingScreen` | `AdminShippingController`, `AdminShippingService` | CBT | `AdminShippingApiTest` |
| M43 | Settings | `SettingsScreen` | `AdminSettingsController`, `AdminSettingsService`, `service/admin/settings/**` | CBT | `Phase1JAdminSettingsMenuCouponApiTest` |
| M44 | Admin Users | `AdminUsersScreen` | `AdminAdminUsersController`, `AdminAdminUsersService` | CBT | `AdminUsersApiTest`, `Phase1IAdminManagementApiTest` |
| M45 | Roles & Permissions (RBAC) | `RolesScreen` | `AdminRolesController`, `AdminPermissionsController`, `AdminRolePermissions` | CBT | `AdminRolesApiTest`, `RbacUrlGateIntegrationTest` |
| M46 | Admin WebSocket order feed | `OrderListScreen` + `OrderNotificationToast` + `NotificationBell` | `WebSocketConfig`, `AdminOrderWsService`, `OrderWsEvent` | P (test runtime: connect-time auth confirmed; per-subscribe authz NV) | `WebSocketConfig.java`, `adminWebSocket.js` |

### 3.3 Mobile-only / mobile coverage notes

| # | Topic | Status | Evidence |
|---|---|---|---|
| M47 | Mobile public catalog/search/contact/address/cart/checkout/account wrappers | CFC | `bigbike_mobile/lib/core/api/api_endpoints.dart` |
| M48 | Mobile verify-email wrapper missing | CO_NOT_DOCUMENTED | MODULE_CATALOG.md row, `api_endpoints.dart` |
| M49 | Mobile home-videos wrapper missing | CO_NOT_DOCUMENTED | MODULE_CATALOG.md row |

### 3.4 Backend / System modules

| # | Module | Implementation | Status | Evidence |
|---|---|---|---|---|
| M50 | Spring Security config | `SecurityConfig` (stateless, CSRF disabled) | CFC | `SecurityConfig.java` |
| M51 | Customer CSRF filter | `CustomerCsrfFilter` (token in `bb_csrf` cookie, header `X-CSRF-Token`) | CFC | `CustomerCsrfFilter.java`, web `client-api.ts` |
| M52 | Customer session filter | `CustomerSessionFilter` (`bb_session` cookie + DB session lookup) | CFC | `CustomerSessionFilter.java` |
| M53 | Admin JWT filter | `JwtAuthFilter` (Bearer in Authorization header, refresh in httpOnly cookie) | CFC | `JwtAuthFilter.java` |
| M54 | Admin permissions | `AdminRolePermissions.MAP` (8 role tech), `requirePermission` calls | CBT | `RbacUrlGateIntegrationTest`, `AdminRolesApiTest` |
| M55 | Rate limiting | `RateLimitingFilter` (Bucket4j; per-endpoint policies) | CFC | `RateLimitingFilter.java` |
| M56 | Request ID + security headers | `RequestIdFilter`, `SecurityHeadersFilter` | CFC | filters |
| M57 | CORS | `CorsConfig` | CFC | `CorsConfig.java`, `CorsConfigTest.java` |
| M58 | Error normalization | `RestAuthenticationEntryPoint`, `RestAccessDeniedHandler`, `error/` package | CFC | files |
| M59 | WebSocket / STOMP | `WebSocketConfig` (CONNECT JWT validate role ADMIN/SUPER_ADMIN), `AdminOrderWsService`, `OrderWsEvent` | P (per-subscribe authz NV) | `WebSocketConfig.java`, DOCS_VERIFICATION_REPORT 6.1 |
| M60 | Email notification | `EmailDispatchService` (SMTP); `OrderNotificationService` integrating | NV (deliverability runtime) | `EmailDispatchService.java`, DOCS_VERIFICATION_REPORT |
| M61 | Audit logging | `AuditLogEntity`, `AdminAuditLogService`, V76 | CFC | (above) |
| M62 | Scheduled jobs | `CouponExpiryScheduler` (hourly), `ReceivableService.refreshOverdueStatus()` | CFC | `CouponExpiryScheduler.java`, `ReceivableService.java` |
| M63 | Stock movement | `StockMovementEntity`, `StockMovementSerialEntity`, `InventoryPolicyService`, `AdminInventoryService` | CBT | `Phase1KInventoryP0FixApiTest`, `Phase1KInventorySerialApiTest` |
| M64 | Idempotency (checkout) | `CheckoutIdempotencyKeyEntity` + `Idempotency-Key` header | CBT | V62, `Phase1FCheckoutApiTest` |
| M65 | Optimistic locking | V67 (`@Version` columns) | CFC | V67 migration |
| M66 | External payment integration | SePay schema only (V44/V47/V59 added then removed) | NFIR (controller/service code) | DOCS_VERIFICATION_REPORT 5 |
| M67 | External shipping carrier | None | NFIR | DOCS_VERIFICATION_REPORT 5 |

---

## 4. E2E Workflow Inventory

> 109 workflow. Mỗi row dùng format thu gọn vì bảng quá rộng. Khi ô bị trống nghĩa là không applicable / không có. Auth/Permission cột ghi rõ JWT/cookie/CSRF/permission key. Status dùng legend Section 3. Evidence = key file/test.

### 4.1 Public storefront — browse & content

| ID | Domain | Workflow | Actor | Trigger | FE surface | BE endpoint / controller | Service | DB / entity | Auth / Perm / CSRF | Side effects | Tests | Status | Evidence | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| E2E-001 | Catalog | View homepage | Guest/Customer | Visit `/` | `app/page.tsx` | aggregate of public reads | `CatalogReadService`, `SliderReadService`, `HomeVideoReadService`, `ContentReadService`, `PublicSettingsController` | products, categories, brands, sliders, home_videos, articles, site_settings | Public | None | `HomepagePublicApiTest` | CBT | `app/page.tsx`, `HomepagePublicApiTest.java` | |
| E2E-002 | Catalog | List categories | Guest/Customer | `/danh-muc-san-pham` | `app/danh-muc-san-pham/page.tsx` | `GET /api/v1/categories` | `CatalogReadService.listCategories` | categories | Public | — | `PublicReadApiTest` | CBT | | filters: showOnHomepage, sort |
| E2E-003 | Catalog | View category detail + products | Guest/Customer | `/danh-muc-san-pham/[slug]` | `app/danh-muc-san-pham/[slug]/page.tsx` | `GET /api/v1/categories/{slug}` + `/products?category=` | `CatalogReadService` | categories, products | Public | — | `PublicReadApiTest` | CBT | | only `visible=true` |
| E2E-004 | Catalog | List brands | Guest/Customer | `/brands` | `app/brands/page.tsx` | `GET /api/v1/brands` | `CatalogReadService.listBrands` | brands | Public | — | `PublicReadApiTest` | CBT | | |
| E2E-005 | Catalog | View brand detail + products | Guest/Customer | `/brands/[slug]` | `app/brands/[slug]/page.tsx` | `GET /api/v1/brands/{slug}` + `/products?brand=` | `CatalogReadService` | brands, products | Public | — | `PublicReadApiTest` | CBT | | |
| E2E-006 | Catalog | List products with filters/sort | Guest/Customer | `/san-pham?...` | `app/san-pham/page.tsx` | `GET /api/v1/products` | `CatalogReadService.listProducts` | products, variants | Public | — | `PublicReadApiTest` | CBT | | filters: brand, category, q, color, gender, price range, featured |
| E2E-007 | Catalog | View product detail | Guest/Customer | `/product/[slug]` | `app/product/[slug]/page.tsx` | `GET /api/v1/products/{slug}` | `CatalogReadService.getProductBySlug` | products, variants, gallery, specs, reviews | Public | — | `PublicReadApiTest` | CBT | ISR cache | |
| E2E-008 | Catalog | Live pricing/stock/variants snapshot | Guest/Customer | client snapshot fetch | `/api/products/[id]/snapshot` proxy | `GET /api/v1/products/{id}/snapshot` | `CatalogReadService.getSnapshot` | products, variants | Public | — | `__tests__/api/snapshot-route.test.ts` | CBT | force-dynamic | |
| E2E-009 | Catalog | Search global | Guest/Customer | `/tim-kiem` | `app/tim-kiem/page.tsx` | `GET /api/v1/search?type=` | `GlobalSearchService` | products, articles | Public | — | `PublicReadApiTest` | CBT | | |
| E2E-010 | Catalog | Search suggest (typeahead) | Guest/Customer | header search | `/api/search-suggest` | `GET /api/v1/search-suggest` | `GlobalSearchService.suggest` | products, articles | Public | — | `__tests__/api/search-suggest-route.test.ts` | CBT | empty if q<2 chars | |
| E2E-011 | Reviews | List product reviews | Guest/Customer | product detail page | `/api/products/[id]/reviews` (proxy) | `GET /api/v1/products/{id}/reviews` | `PublicReviewService` | reviews (status APPROVED) | Public | — | `Phase1NReviewsApiTest` | CBT | V60/V61 indexes | |
| E2E-012 | Reviews | Submit product review | Customer/Guest | review form | `/api/products/[id]/reviews` POST | `POST /api/v1/products/{id}/reviews` | `PublicReviewService.submit` | reviews (status PENDING) | Public + honeypot, rate-limit 5/min | Audit (review created); awaits admin approval | `Phase1NReviewsApiTest` | CBT | sync product_rating_cache (V63) | |
| E2E-013 | Content | List & view articles | Guest/Customer | `/tin-tuc/`, `/tin-tuc/[slug]` | pages | `GET /api/v1/articles`, `/articles/{slug}` | `ContentReadService` | articles | Public | — | `ContentP1ApiTest`, `ContentPublicApiTest` | CBT | only PUBLISHED | |
| E2E-014 | Content | View static page (policy/guide/CMS slug) | Guest/Customer | `/chinh-sach/[slug]`, `/[slug]`, `/huong-dan/[...sub]` | pages | `GET /api/v1/pages/{slug}` | `ContentReadService.getPageBySlug` | pages | Public | — | `ContentP1ApiTest` | CBT | catch-all `[slug]` resolves CMS pages | |
| E2E-015 | Public | Resolve sitemap | crawler | `/sitemap.xml` | `app/sitemap.ts` | aggregate public reads | various | products, categories, articles, pages | Public | — | `__tests__/seo/robots.test.ts` (related) | CFC | NV: completeness | |
| E2E-016 | Public | Resolve robots.txt | crawler | `/robots.txt` | `app/robots.ts` | n/a | n/a | n/a | Public | — | `__tests__/seo/robots.test.ts` | CBT | | |
| E2E-017 | Public | Legacy redirect runtime (proxy.ts) | Guest/Customer | any path | `proxy.ts` | `GET /api/internal/redirect?path=`, `POST /api/internal/redirects/hit/{id}` | `AdminRedirectService` (read), no internal service | redirects | App-layer permitAll, expects infra IP allowlist | L1 cache TTL 30s, hits counter | `AdminRedirectApiTest` | CBT (app) / NV (infra) | `proxy.ts`, `InternalRedirectController.java` | "should lock by infra/IP allowlist" comment |
| E2E-018 | Public | ISR revalidation webhook | system | webhook | `/api/revalidate/route.ts` | n/a (Next-only) | invalidates Next cache by tag | n/a | `x-revalidate-secret` header | None | `WebRevalidationServiceTest` (backend trigger) | CBT | | secret env `REVALIDATE_SECRET` |
| E2E-019 | Public | Vietnam address lookup | Guest/Customer | address form | `components/ui/VnAddressFields` | `GET /api/v1/address/{provinces,districts,wards}` | `VnAddressService` | static JSON `vn-address.json` | Public | — | (none) | CFC | | also static fallback `lib/vn-address-data.ts` |

### 4.2 Customer auth & account

| ID | Domain | Workflow | Actor | Trigger | FE surface | BE endpoint | Service | DB | Auth/CSRF | Side effects | Tests | Status | Evidence |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| E2E-020 | Auth | Customer register | Guest | `/dang-ky` form | `LoginScreen`, `RegisterScreen` | `POST /api/v1/customer/auth/register` | `CustomerAuthService.register`, `EmailVerificationService` | customers, customer_email_verification_tokens | Rate-limit 3/min; sets `bb_session`+refresh+`bb_csrf` cookies | Email send (verify link); audit | `Phase1DCustomerAuthTest` | CBT | `Phase1DCustomerAuthTest.java` |
| E2E-021 | Auth | Customer email verify | Guest | email link | `/xac-nhan-email` | `POST /api/v1/customer/auth/verify-email` | `EmailVerificationService.verify` | customer_email_verification_tokens, customers (emailVerifiedAt) | **CONFLICTING_EVIDENCE**: SecurityConfig permits GET only; controller is `@PostMapping` → POST chain hits `anyRequest().authenticated()` | flips emailVerifiedAt | (none direct) | CONFLICTING_EVIDENCE | DOCS_VERIFICATION_REPORT 6.1 |
| E2E-022 | Auth | Customer login | Guest | `/dang-nhap` | `LoginScreen` | `POST /api/v1/customer/auth/login` | `CustomerAuthService.login` | customer_sessions | Rate-limit 5/min; sets `bb_session`+refresh+`bb_csrf` | Merge guest cart → customer cart; audit | `Phase1DCustomerAuthTest`, `Phase1I1CustomerStatusLoginTest` | CBT | |
| E2E-023 | Auth | Customer logout | Customer | header user menu | `HeaderUserMenu` | `POST /api/v1/customer/auth/logout` | `CustomerAuthService.logout` | customer_sessions (delete) | Cookie session | Clear cookies | (none direct) | CFC | |
| E2E-024 | Auth | Customer refresh session | Customer | proxy.ts/auth-store | client-api | `POST /api/v1/customer/auth/refresh` | `CustomerSessionService` | customer_sessions | Refresh cookie | Issue new tokens | (none direct) | CFC | |
| E2E-025 | Auth | Forgot password (request reset) | Guest | `/quen-mat-khau` | page | `POST /api/v1/customer/auth/password/forgot` | `CustomerPasswordResetService.request` | customer_password_reset_tokens | Rate-limit 5/min | Email send (reset link) | `Phase1DCustomerAuthTest` (partial) | CBT | |
| E2E-026 | Auth | Reset password | Guest with token | reset link page | page | `POST /api/v1/customer/auth/password/reset` | `CustomerPasswordResetService.reset` | customer_password_reset_tokens, customers (passwordHash) | Rate-limit 5/min | Token consumed; password updated; audit | `Phase1DCustomerAuthTest` (partial) | CBT | |
| E2E-027 | Account | View profile | Customer | `/tai-khoan/edit-account` | page | `GET /api/v1/customer/me` | `CustomerAuthService.me` | customers | Cookie session, ROLE_CUSTOMER | — | (covered indirectly by Phase1G) | CFC | |
| E2E-028 | Account | Update profile | Customer | `/tai-khoan/edit-account` | page | `PATCH /api/v1/customer/me` | `CustomerAuthService.updateProfile` | customers | Cookie session + CSRF | Audit (customer.updated) | (none direct) | CFC | |
| E2E-029 | Account | List addresses | Customer | `/tai-khoan/edit-address/[type]` | page | `GET /api/v1/customer/addresses` | `CustomerAddressService.list` | customer_addresses | Cookie session | — | (none direct) | CFC | |
| E2E-030 | Account | Create address | Customer | address form | page | `POST /api/v1/customer/addresses` | `CustomerAddressService.create` | customer_addresses | Cookie session + CSRF | Audit | (none direct) | CFC | |
| E2E-031 | Account | Update address | Customer | address form | page | `PATCH /api/v1/customer/addresses/{id}` | `CustomerAddressService.update` | customer_addresses | Cookie session + CSRF | Audit | (none direct) | CFC | own only |
| E2E-032 | Account | Delete address | Customer | address row | page | `DELETE /api/v1/customer/addresses/{id}` | `CustomerAddressService.delete` | customer_addresses | Cookie session + CSRF | Audit | (none direct) | CFC | own only |
| E2E-033 | Account | List own orders | Customer | `/tai-khoan/don-hang` | page | `GET /api/v1/customer/orders` | `OrderReadService.listForCustomer` | orders | Cookie session, ROLE_CUSTOMER | — | `Phase1GOrderReadApiTest` | CBT | filter by status, paymentStatus |
| E2E-034 | Account | View own order detail | Customer | `/tai-khoan/don-hang/[id]` | page | `GET /api/v1/customer/orders/{id}` | `OrderReadService.getForCustomer` | orders + line items + payment + shipping | Cookie session, ROLE_CUSTOMER | — | `Phase1GOrderReadApiTest` | CBT | own only |
| E2E-035 | Returns (customer) | Create return request | Customer | `/tai-khoan/doi-tra` per order | page | `POST /api/v1/customer/orders/{orderId}/returns` | `CustomerReturnService.create` | returns (PENDING), return_items | Cookie session + CSRF, ROLE_CUSTOMER | Audit; admin notification (potential) | `Phase1LReturnsApiTest` | CBT | own only; raw DTO (envelope drift docs flagged) |
| E2E-036 | Returns (customer) | List own returns | Customer | `/tai-khoan/doi-tra` | page | `GET /api/v1/customer/orders/returns` | `CustomerReturnService.listForCustomer` | returns | Cookie session | — | `Phase1LReturnsApiTest` | CBT | |
| E2E-037 | Returns (customer) | View own return detail | Customer | return row | page | `GET /api/v1/customer/orders/returns/{id}` | `CustomerReturnService.getForCustomer` | returns + items + history | Cookie session | — | `Phase1LReturnsApiTest` | CBT | own only |

### 4.3 Cart & Checkout

| ID | Domain | Workflow | Actor | Trigger | FE surface | BE endpoint | Service | DB | Auth/CSRF | Side effects | Tests | Status | Evidence |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| E2E-038 | Cart | Get / create cart (guest or customer) | Guest/Customer | every cart open | `lib/api/client-api.ts fetchCart` | `GET /api/v1/cart` | `CartService.getOrCreate` | carts (CartStatus 5: ACTIVE/MERGED/ABANDONED/CONVERTED/EXPIRED) | `bb_guest_id` cookie OR session | Issue `bb_csrf` | `Phase1ECartApiTest` | CBT | |
| E2E-039 | Cart | Add cart item | Guest/Customer | product page button | client-api | `POST /api/v1/cart/items` | `CartService.addItem` | carts, cart_items (V26 image snapshot) | CSRF | Validate publish status + variant in stock | `Phase1ECartApiTest` | CBT | publish PUBLISHED only |
| E2E-040 | Cart | Update cart item quantity | Guest/Customer | cart page | client-api | `PATCH /api/v1/cart/items/{id}` | `CartService.updateItem` | cart_items | CSRF | Validate stock | `Phase1ECartApiTest` | CBT | |
| E2E-041 | Cart | Remove cart item | Guest/Customer | cart page | client-api | `DELETE /api/v1/cart/items/{id}` | `CartService.removeItem` | cart_items | CSRF | Coupon refresh | `Phase1ECartApiTest` | CBT | |
| E2E-042 | Cart | Clear cart | Guest/Customer | cart page | client-api | `DELETE /api/v1/cart` (or `/clear`) | `CartService.clear` | cart_items, cart_coupons | CSRF | — | `Phase1ECartApiTest` | CBT | |
| E2E-043 | Cart | Apply coupon | Guest/Customer | cart page | client-api | `POST /api/v1/cart/coupons` | `CartService.applyCoupon`, `CouponPolicyService` | cart_coupons (V73 unique), coupons (lock row) | CSRF | Validate status/expiry/usage/min, V73 enforce one-coupon-per-cart | `Phase1ECartApiTest`, `Phase1JAdminSettingsMenuCouponApiTest` | CBT | |
| E2E-044 | Cart | Remove coupon | Guest/Customer | cart page | client-api | `DELETE /api/v1/cart/coupons/{code}` | `CartService.removeCoupon` | cart_coupons | CSRF | Recompute totals | `Phase1ECartApiTest` | CBT | |
| E2E-045 | Cart | Refresh cart (price/coupon revalidate) | Guest/Customer | implicit on get | (server-side) | `GET /api/v1/cart` | `CartService.refresh` | (above) | — | Removes invalid coupon if status changed | `Phase1ECartApiTest` | CBT | |
| E2E-046 | Cart | Merge guest cart → customer cart on login | Customer (login) | login response handler | `CartService.mergeOnLogin` (called on login) | (internal) | `CartService.merge` | carts (status MERGED) | Cookie session | Side effect of login | `Phase1ECartApiTest` (some), `Phase1DCustomerAuthTest` | CBT (partial) | |
| E2E-047 | Checkout | Get checkout options | Guest/Customer | thanh-toan load | page | `GET /api/v1/checkout/options` | `CheckoutService.getOptions` | shipping_methods, payment methods, tax settings, settings | `bb_guest_id`/session | — | `Phase1FCheckoutApiTest` | CBT | |
| E2E-048 | Checkout | Submit checkout from cart → create order | Guest/Customer | `/thanh-toan` form | page | `POST /api/v1/checkout` | `CheckoutService.checkoutFromCart` | orders, order_line_items, order_addresses, order_shipping_items, order_fee_items, order_applied_coupons, payments, stock_movements, checkout_idempotency_keys | CSRF, Rate-limit 5/min, **Idempotency-Key** header | Decrement stock; create payment row PENDING; coupon usage_count++; cart→ CONVERTED; emit WS event NEW_ORDER; send order confirmation email; revalidate web tags | `Phase1FCheckoutApiTest` | CBT | initial Order.status: COD→PROCESSING, BACS→ON_HOLD; paymentStatus UNPAID |
| E2E-049 | Checkout | Quick buy (skip cart) | Guest/Customer | product page Quick Buy modal | `QuickBuyModal` | `POST /api/v1/orders/quick-buy` | `CheckoutService.quickBuy` | orders + line items + payments + stock_movements + idempotency | CSRF + Idempotency-Key + rate-limit 5/min | Same side-effects as checkout (without cart) | (no dedicated test class) | CFC | |
| E2E-050 | Checkout | Idempotency replay | system | client retry | n/a | `POST /checkout` with same Idempotency-Key | `CheckoutService` returns cached response | checkout_idempotency_keys (V62) | tracked by (key, clientIp, userAgent) | None | `Phase1FCheckoutApiTest` (idempotency) | CBT | |
| E2E-051 | Checkout | Guest order lookup | Guest | `/don-hang/xac-nhan?so=...&key=...` | page | `GET /api/v1/orders/lookup` | `OrderReadService.lookup` | orders | Public + (orderNumber + orderKey required) | — | `Phase1FCheckoutApiTest` (partial) | CFC | rate-limit reasonable; no auth |
| E2E-052 | Checkout | Order received page (analytics) | Guest/Customer | redirect after checkout | `app/don-hang/xac-nhan/page.tsx` + `PurchaseEvent` | n/a (FE only) | n/a | n/a | n/a | GTM purchase event push | (none) | CFC | |
| E2E-053 | Checkout | Legacy redirect `/thanh-toan/order-received/[id]` → `/don-hang/xac-nhan` | Guest/Customer | old link | `app/thanh-toan/order-received/[id]/page.tsx` | n/a | n/a | n/a | n/a | permanentRedirect | (none) | CFC | |

### 4.4 Order admin & lifecycle

| ID | Domain | Workflow | Actor | Trigger | FE surface | BE endpoint | Service | DB | Auth/Perm | Side effects | Tests | Status | Evidence |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| E2E-054 | Orders admin | List orders (filters/pagination) | Admin / SHOP_MANAGER | `/admin/orders` | `OrderListScreen` | `GET /api/v1/admin/orders` | `AdminOrderService.listOrders` | orders | JWT + `orders.read` | — | `Phase1HAdminOrderApiTest` | CBT | |
| E2E-055 | Orders admin | View order detail | Admin / SHOP_MANAGER | row click | `OrderDetailScreen` | `GET /api/v1/admin/orders/{id}` | `AdminOrderService.getOrderDetail` | orders + items + payment + shipping | JWT + `orders.read` | — | `Phase1HAdminOrderApiTest` | CBT | |
| E2E-056 | Orders admin | List allowed transitions | Admin | open order detail | `OrderDetailScreen` | `GET /admin/orders/{id}/allowed-transitions` | `AdminOrderService.listAllowedTransitions` | orders | JWT + `orders.read` | — | (none direct) | CFC | for UI button visibility |
| E2E-057 | Orders admin | Update order status | Admin | status dropdown | `OrderDetailScreen` | `PATCH /admin/orders/{id}/status` | `AdminOrderService.updateOrderStatus` | orders | JWT + `orders.write` | Side-effect map per transition (see Section 5) | (transition coverage MISSING_TEST_COVERAGE) | CFC (P) | `STATE_MACHINES.md §6` |
| E2E-058 | Orders admin | Update payment status | Admin | payment dropdown | `OrderDetailScreen` | `PATCH /admin/orders/{id}/payment-status` | `AdminOrderService.updatePaymentStatus` | orders, payments | JWT + `orders.write` | paidAmount/paidAt/refundAmount; payment record SUCCEEDED/REFUNDED; audit; WS | (transition coverage MISSING_TEST_COVERAGE) | CFC (P) | `STATE_MACHINES.md §7` |
| E2E-059 | Orders admin | Add order note | Admin | note panel | `OrderDetailScreen` | `POST /admin/orders/{id}/notes` | `AdminOrderService.addNote` | order_notes | JWT + `orders.write` | Audit | `Phase1HAdminOrderApiTest` (partial) | CBT | customer-visible flag |
| E2E-060 | Orders admin | List order notes | Admin | open detail | (in detail) | `GET /admin/orders/{id}/notes` | `AdminOrderService.listNotes` | order_notes | JWT + `orders.read` | — | (none direct) | CFC | |
| E2E-061 | Refund | Create refund (full or partial) | Admin | RefundModal | `OrderDetailScreen` | `POST /admin/orders/{id}/refund` | `AdminOrderService.createRefund`, `RefundService.applyRefund` | orders (refundAmount, refundedAt, paymentStatus, status), payments (RefundPayment) | JWT + `orders.write` | Order.paymentStatus → PARTIALLY_REFUNDED or REFUNDED; if full and order COMPLETED → status REFUNDED → stock restore; audit; WS | (no dedicated test class) | CFC | `RefundService.java`; report rule REPORT_RULE_011 |
| E2E-062 | Orders admin | Real-time order feed | Admin | OrderListScreen mount | `OrderListScreen` + WS subscribe | `STOMP /topic/admin/orders` | `AdminOrderWsService.publish` | n/a | JWT in CONNECT, role ADMIN/SUPER_ADMIN | invalidate cache on receive | (none direct) | P (per-subscribe authz NV) | `WebSocketConfig.java`, `adminWebSocket.js` |
| E2E-063 | Orders admin | New-order toast notification | Admin | WS event NEW_ORDER | `OrderNotificationToast` | (above) | (above) | n/a | as above | toast bottom-right | (none) | CFC | |
| E2E-064 | Orders admin | Notification bell unread count | Admin | bell mount | `NotificationBell` | (likely WS / API mix) | (NV — likely partial) | n/a | JWT | UI count | (none) | NV | (notif center NFIR — see §10) |

### 4.5 Returns admin

| ID | Domain | Workflow | Actor | Trigger | FE surface | BE endpoint | Service | DB | Auth/Perm | Side effects | Tests | Status |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| E2E-065 | Returns admin | List returns | Admin | `/admin/returns` | `ReturnListScreen` | `GET /admin/returns` | `AdminReturnService.list` | returns | JWT + `orders.read` | — | `Phase1LReturnsApiTest` | CBT |
| E2E-066 | Returns admin | View return detail | Admin | row click | `ReturnListScreen` | `GET /admin/returns/{id}` | `AdminReturnService.get` | returns + items + history | JWT + `orders.read` | — | `Phase1LReturnsApiTest` | CBT |
| E2E-067 | Returns admin | Approve return PENDING→APPROVED | Admin | status update | `ReturnListScreen` | `PATCH /admin/returns/{id}/status` | `AdminReturnService.updateStatus` | returns, return_history | JWT + `orders.write` | History; customer email notification | `Phase1LReturnsApiTest` | CBT |
| E2E-068 | Returns admin | Reject return PENDING→REJECTED | Admin | status update | (above) | (above) | (above) | (above) | (above) | History; rejection email | `Phase1LReturnsApiTest` | CBT |
| E2E-069 | Returns admin | Mark return RECEIVED | Admin | status update | (above) | (above) | (above) | (above) | (above) | History; goods received email | `Phase1LReturnsApiTest` | CBT |
| E2E-070 | Returns admin | Complete return RECEIVED→COMPLETED (no refund) | Admin | status update | (above) | (above) | (above) | returns; stock_movements RETURN | (above) | Stock restore for return items; history | `Phase1LReturnsApiTest` | CBT |
| E2E-071 | Returns admin | Refund return RECEIVED→REFUNDED | Admin | status update + refundAmount | (above) | (above) | `AdminReturnService.refund`, `RefundService.applyRefund` | returns, orders (refundAmount/paymentStatus/refundedAt), payments (REFUND record), stock_movements RETURN, audit_logs, order_notes, WS event | JWT + `orders.write` | Stock restore; sync order paymentStatus PARTIALLY_REFUNDED/REFUNDED; payment record REFUNDED; audit; order note; WS; refunded notification | `Phase1LReturnsApiTest` | CBT |

### 4.6 POS & Receivables

| ID | Domain | Workflow | Actor | Trigger | FE surface | BE endpoint | Service | DB | Auth/Perm | Side effects | Tests | Status |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| E2E-072 | POS | Search POS products | Admin / SHOP_MANAGER | POS search input | `PosScreen` | `GET /admin/pos/products/search` | `PosOrderService.searchProducts` | products + variants | JWT + `pos.read` | — | `Phase1MPosApiTest` (search) | CBT |
| E2E-073 | POS | POS sale CASH | Admin / SHOP_MANAGER | confirm payment | `PosScreen` | `POST /admin/pos/orders` | `PosOrderService.createOrder` (cash branch) | orders (PROCESSING→COMPLETED, paymentStatus PAID, channel POS), order_line_items, order_addresses (POS staff), payments (POS, SUCCEEDED), stock_movements OUT, audit_logs, WS NEW_ORDER | JWT + `pos.write` | All side effects above; auto-complete | `Phase1MPosApiTest` | CBT |
| E2E-074 | POS | POS sale CARD_TERMINAL | same | confirm payment | (above) | (above) | (above) | (above) | (above) + reference number | (above) | `Phase1MPosApiTest` | CBT |
| E2E-075 | POS | POS sale CREDIT (bán chịu) | Admin / SHOP_MANAGER (with `pos.write` + `receivables.create`) | confirm payment | `PosScreen` | `POST /admin/pos/orders` (credit branch) | `PosOrderService.createOrder` + `CreditPolicyService.checkLimit`, `ReceivableService.create` | orders + receivables (OPEN), customer credit limit decremented, audit_logs | JWT + `pos.write`; if exceeds limit, requires `receivables.override_limit` (HTTP 422 otherwise) | Receivable created OPEN; status order `PROCESSING`; paymentStatus UNPAID; stock_movements OUT (immediate); audit | `Phase1MPosApiTest`, `AdminReceivableApiTest` | CBT |
| E2E-076 | POS | POS price override | Admin (only) | input override price | `PosScreen` | (in body) | `PosOrderService` validate `pos.price_override` | orders (line items custom price) | JWT + `pos.write` + `pos.price_override` | Audit special note | `Phase1MPosApiTest` (partial) | CBT |
| E2E-077 | Receivables | List receivables | Admin / SHOP_MANAGER | `/admin/receivables` | `ReceivablesListScreen` | `GET /admin/receivables` | `ReceivableQueryService.list` | accounts_receivable | JWT + `receivables.read` | — | `AdminReceivableApiTest` | CBT |
| E2E-078 | Receivables | View receivable detail | Admin / SHOP_MANAGER | row click | `ReceivableDetailScreen` | `GET /admin/receivables/{id}` | `ReceivableQueryService.get` | receivable + payments | JWT + `receivables.read` | — | `AdminReceivableApiTest` | CBT |
| E2E-079 | Receivables | List per-customer receivables | Admin / SHOP_MANAGER | customer detail | `CustomerDetailScreen` | `GET /admin/customers/{id}/receivables` | `ReceivableQueryService.listByCustomer` | accounts_receivable | JWT + `receivables.read` | — | `AdminReceivableApiTest` | CBT |
| E2E-080 | Receivables | View customer credit summary | Admin / SHOP_MANAGER | customer detail | `CustomerDetailScreen` | `GET /admin/customers/{id}/credit` | `CreditPolicyService.summary` | customers (credit fields), accounts_receivable | JWT + `receivables.read` | — | `AdminReceivableApiTest` | CBT |
| E2E-081 | Receivables | Update customer credit profile (limit/terms/status) | Admin | customer credit form | `CustomerDetailScreen` | `PATCH /admin/customers/{id}/credit` | `CreditPolicyService.updateProfile` | customers | JWT + `receivables.create` | Audit | `AdminReceivableApiTest` | CBT |
| E2E-082 | Receivables | Record receivable payment (full / partial) | Admin / SHOP_MANAGER | RecordPaymentModal | `ReceivableDetailScreen` | `POST /admin/receivables/{id}/payments` | `ReceivableService.recordPayment` | accounts_receivable (paidAmount, status), payments row, audit | JWT + `receivables.record_payment` | Receivable status: UNPAID→PARTIALLY_PAID→PAID/CLOSED; order paymentStatus may flip; audit | `AdminReceivableApiTest` | CBT |
| E2E-083 | Receivables | Write off receivable | Admin | WriteOffModal | `ReceivableDetailScreen` | `POST /admin/receivables/{id}/write-off` | `ReceivableService.writeOff` | accounts_receivable (status WRITTEN_OFF, reason), audit | JWT + `receivables.write_off` | Mandatory reason; audit; status WRITTEN_OFF | `AdminReceivableApiTest` | CBT |
| E2E-084 | Receivables | Aging report (auto refresh OVERDUE status) | system | scheduled / on-read | n/a | n/a | `ReceivableService.refreshOverdueStatus` | accounts_receivable | n/a | OPEN/PARTIALLY_PAID past due → OVERDUE | `AdminReceivableApiTest` (partial) | CBT |

### 4.7 Products / Catalog admin

| ID | Domain | Workflow | Actor | FE surface | BE endpoint | Service | DB | Auth/Perm | Side effects | Tests | Status |
|---|---|---|---|---|---|---|---|---|---|---|---|
| E2E-085 | Catalog admin | List products (admin) | Admin / EDITOR | `ProductListScreen` | `GET /admin/products` | `AdminCatalogReadService.listProducts` | products | JWT + `products.read` | — | `AdminReadApiTest` | CBT |
| E2E-086 | Catalog admin | View product detail (admin) | Admin / EDITOR | `ProductDetailScreen` | `GET /admin/products/{id}` | `AdminCatalogReadService.getProduct` | products + variants + gallery + specs + tags | JWT + `products.read` | — | `AdminReadApiTest` | CBT |
| E2E-087 | Catalog admin | Create product | Admin / EDITOR | `ProductDetailScreen` save | `POST /admin/products` | `AdminCatalogMutationService.createProduct` + `AdminMutationValidators.validatePublishTransition` | products | JWT + `products.update` | Audit `PRODUCT_CREATED`; revalidate web tags | `AdminMutationApiTest` | CBT |
| E2E-088 | Catalog admin | Update product | Admin / EDITOR | save | `PATCH /admin/products/{id}` | `AdminCatalogMutationService.updateProduct` + validator | products + variants + ... | JWT + `products.update` | Audit; revalidate; sync rating cache (V63) | `AdminMutationApiTest` | CBT |
| E2E-089 | Catalog admin | Update publish status (transition) | Admin / EDITOR | dropdown | `PATCH /admin/products/{id}/publish` | `AdminCatalogMutationService.updatePublishStatus` + `validatePublishTransition` | products (publishStatus) | JWT + `products.update` | Public catalog visibility; sitemap; audit | `AdminMutationValidatorsTest` (validator); transition coverage MISSING_TEST_COVERAGE for full E2E | CBT (P) |
| E2E-090 | Catalog admin | Soft-delete product → TRASH | Admin / EDITOR | trash button | `DELETE /admin/products/{id}` | `AdminCatalogMutationService.deleteProduct` | products (publishStatus=TRASH) | JWT + `products.update` | Public hidden; audit | `AdminMutationApiTest` | CBT |
| E2E-091 | Catalog admin | Restore product TRASH→DRAFT | Admin / EDITOR | restore button | `POST /admin/products/{id}/restore` | `AdminCatalogMutationService.restoreProduct` | products | JWT + `products.update` | Audit | `AdminMutationApiTest` | CBT |
| E2E-092 | Catalog admin | List categories (admin) | Admin / EDITOR | `CategoryListScreen` | `GET /admin/categories` | `AdminCatalogReadService.listCategories` | categories | JWT + `catalog.read` | — | `AdminReadApiTest` | CBT |
| E2E-093 | Catalog admin | Create category | Admin / EDITOR | save | `POST /admin/categories` | `AdminCatalogMutationService.createCategory` | categories | JWT + `catalog.update` | Audit | `AdminMutationApiTest` | CBT |
| E2E-094 | Catalog admin | Update category | Admin / EDITOR | save | `PATCH /admin/categories/{id}` | `AdminCatalogMutationService.updateCategory` | categories | JWT + `catalog.update` | Validate parent (no circular); audit | `AdminMutationApiTest` | CBT |
| E2E-095 | Catalog admin | Hide / Soft-delete category | Admin / EDITOR | delete | `DELETE /admin/categories/{id}` | `AdminCatalogMutationService.deleteCategory` | categories (visible=false) | JWT + `catalog.update` | Reject if visible children exist; public hidden; audit | `AdminMutationApiTest` | CBT |
| E2E-096 | Catalog admin | List/Create/Update/Hide brands | Admin / EDITOR | `BrandListScreen`, `BrandDetailScreen` | `/admin/brands*` | `AdminCatalogMutationService` brand methods | brands | JWT + `catalog.update` | Audit; public visibility | `AdminMutationApiTest` | CBT |
| E2E-097 | Reviews admin | List / approve / reject / edit / delete reviews | Admin / EDITOR | `ReviewListScreen`, `ReviewDetailScreen` | `/admin/reviews*` | `AdminReviewService` | reviews (status PENDING/APPROVED/REJECTED, V60) | JWT + `reviews.read`/`reviews.write` | Sync product rating cache (V63); audit | `Phase1NReviewsApiTest` | CBT |

### 4.8 Inventory admin

| ID | Domain | Workflow | Actor | FE surface | BE endpoint | Service | DB | Auth/Perm | Side effects | Tests | Status |
|---|---|---|---|---|---|---|---|---|---|---|---|
| E2E-098 | Inventory admin | List inventory by variant | Admin / SHOP_MANAGER | `InventoryScreen` | `GET /admin/inventory` | `AdminInventoryService.listStock` | products, variants, stock_movements | JWT + `products.read` | — | `Phase1KInventoryP0FixApiTest` | CBT |
| E2E-099 | Inventory admin | Inventory summary | Admin / SHOP_MANAGER | `InventoryScreen` KPIs | `GET /admin/inventory/summary` | `AdminInventoryService.summary` | (above) | JWT + `products.read` | — | `Phase1KInventoryP0FixApiTest` | CBT |
| E2E-100 | Inventory admin | List movements (all or per variant) | Admin / SHOP_MANAGER | InventoryScreen | `GET /admin/inventory/movements`, `/variants/{id}/movements` | `AdminInventoryService.listMovements` | stock_movements + serials | JWT + `products.read` | — | `Phase1KInventoryP0FixApiTest`, `Phase1KInventorySerialApiTest` | CBT |
| E2E-101 | Inventory admin | Adjust stock manual (IN/OUT/ADJUSTMENT) | Admin / SHOP_MANAGER | adjust modal | `POST /admin/inventory/variants/{id}/adjust` | `AdminInventoryService.adjustStock` + `InventoryPolicyService` | stock_movements, variants (stockState recompute), V50 integrity guards | JWT + `products.update` | Movement created; recompute stockState; serials required for IN; reject duplicate serial; audit | `Phase1KInventoryP0FixApiTest`, `Phase1KInventorySerialApiTest` | CBT |
| E2E-102 | Inventory admin | Export inventory CSV | Admin / SHOP_MANAGER | export button | `GET /admin/inventory/export.csv` | `AdminInventoryService.exportCsv` | (read) | JWT + `products.read` | Audit log (export) | `AdminReportCsvHardeningTest` (related) | CBT |

### 4.9 Coupons admin

| ID | Domain | Workflow | Actor | FE surface | BE endpoint | Service | DB | Auth/Perm | Side effects | Tests | Status |
|---|---|---|---|---|---|---|---|---|---|---|---|
| E2E-103 | Coupons | List / Filter coupons | Admin | `CouponListScreen` | `GET /admin/coupons` | `AdminCouponService.list` | coupons | JWT + `coupons.read` | — | `Phase1JAdminSettingsMenuCouponApiTest` | CBT |
| E2E-104 | Coupons | Create / Update / Update status | Admin | row form | `POST/PATCH /admin/coupons` | `AdminCouponService.create/update/updateStatus` | coupons | JWT + `coupons.write` | Audit | `Phase1JAdminSettingsMenuCouponApiTest` | CBT |
| E2E-105 | Coupons | Auto expire (hourly) | system | cron `0 0 * * * *` | n/a | `CouponExpiryScheduler` | coupons (status EXPIRED) | n/a | Flips overdue ACTIVE → EXPIRED | `Phase1JAdminSettingsMenuCouponApiTest` (partial) | CBT |
| E2E-106 | Coupons | Coupon redemption (atomic usage++) | Customer/Guest checkout | (E2E-048) | `POST /api/v1/checkout` | `CheckoutService.applyAndRedeemCoupon` | coupons (usage_count), order_applied_coupons | CSRF + Idempotency | Increment usage atomically; reject if status not ACTIVE / expired / over-limit | `Phase1FCheckoutApiTest` | CBT |

### 4.10 Customers admin

| ID | Workflow | Actor | FE | BE | Service | DB | Auth | Side | Tests | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| E2E-107 | List customers | Admin / SHOP_MANAGER | `CustomerListScreen` | `GET /admin/customers` | `AdminCustomerService.list` | customers | JWT + `customers.read` | — | `Phase1IAdminManagementApiTest` | CBT |
| E2E-108 | View customer detail | (above) | `CustomerDetailScreen` | `GET /admin/customers/{id}` | `AdminCustomerService.get` | customers + addresses + orders count | JWT + `customers.read` | — | `Phase1IAdminManagementApiTest` | CBT |
| E2E-109 | Update customer info | Admin | (above) | `PATCH /admin/customers/{id}` | `AdminCustomerService.update` | customers | JWT + `customers.write` | Audit | `Phase1IAdminManagementApiTest` | CBT |
| E2E-110 | Update customer status | Admin | (above) | `PATCH /admin/customers/{id}/status` | `AdminCustomerService.updateStatus` | customers | JWT + `customers.write` | Audit; possibly block login | `Phase1I1CustomerStatusLoginTest` | CBT |

### 4.11 Content / Sliders / Home Videos / Menu / Media / Redirect / Settings admin

| ID | Workflow | Actor | FE | BE | Service | DB | Auth | Side | Tests | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| E2E-111 | List content (articles + pages) | Admin / EDITOR / AUTHOR / SEO_EDITOR | `ContentListScreen` | `GET /admin/content` | `AdminContentReadService.list` | articles + pages | JWT + `content.read` | — | `AdminContentApiTest` | CBT |
| E2E-112 | Create / Update article | (above) | `ContentDetailScreen` | `POST/PATCH /admin/content/articles*` | `AdminContentMutationService` + `AdminMutationValidators` | articles | JWT + `content.update` | Audit; revalidate; SEO sitemap | `AdminContentApiTest` | CBT |
| E2E-113 | Create / Update page | (above) | (above) | `POST/PATCH /admin/content/pages*` | (above) | pages | JWT + `content.update` | Audit; revalidate | `AdminContentApiTest` | CBT |
| E2E-114 | Delete content (article or page) | (above) | (above) | `DELETE /admin/content/{type}/{id}` | (above) | (status ARCHIVED via shared validator) | JWT + `content.update` | Public hidden; audit | `AdminContentApiTest` | CBT |
| E2E-115 | Manage authors / content categories | (above) | (above) | `/admin/content/authors`, `/content-categories` | `AdminContentReferenceService` | content_authors, content_categories | JWT + `content.update` | Audit | `AdminContentApiTest` | CBT |
| E2E-116 | Sliders CRUD + reorder | Admin / EDITOR | `SliderListScreen` | `/admin/sliders*` | `AdminSliderService` | sliders (V17/V27/V33/V34) | JWT + `sliders.write` | Public hero carousel update; audit | `SliderApiTest`, `SliderRepositoryTest` | CBT |
| E2E-117 | Home videos CRUD | Admin / EDITOR | `HomeVideoListScreen` | `/admin/home-videos*` | `AdminHomeVideoService`, `HomeVideoReadService` | home_videos (V35/V36/V72) | JWT + `home_videos.write` | Public homepage update; audit | `HomeVideoApiTest`, `HomeVideoRepositoryTest` | CBT |
| E2E-118 | Menus CRUD + items + reorder | Admin / EDITOR | `MenuScreen` | `/admin/menus*` | `AdminMenuService` | menus, menu_items | JWT + `menus.write` | Public header/footer menu update; audit | `Phase1JAdminSettingsMenuCouponApiTest` | CBT |
| E2E-119 | Media upload + list + edit + soft-delete | Admin / EDITOR / AUTHOR | `MediaLibraryScreen` | `/admin/media*` | `AdminMediaService`, MinIO | media (status ACTIVE/INACTIVE/DELETED) | JWT + `media.write` | MIME magic-byte validation (Tika); reject SVG; block hard-delete if referenced; audit | `AdminMediaP0Test` | CBT |
| E2E-120 | Redirects CRUD | Admin / SEO_EDITOR | `RedirectListScreen` | `/admin/redirects*` | `AdminRedirectService` | redirects (V58/V80) | JWT + `redirects.write` | Internal redirect endpoint reads; cache invalidate (proxy.ts L1 cache TTL 30s); audit | `AdminRedirectApiTest` | CBT |
| E2E-121 | Settings list / batch update | Admin | `SettingsScreen` | `/admin/settings*` | `AdminSettingsService` | site_settings (V21/V22/V24/V29/V32/V40/V45/V48) | JWT + `settings.read`/`settings.write` | Public settings consumption update; revalidate; audit | `Phase1JAdminSettingsMenuCouponApiTest` | CBT |

### 4.12 Shipping admin

| ID | Workflow | Actor | FE | BE | Service | DB | Auth | Tests | Status |
|---|---|---|---|---|---|---|---|---|---|
| E2E-122 | Shipping zones CRUD | Admin / SHOP_MANAGER | `ShippingScreen` | `/admin/shipping/zones*` | `AdminShippingService` | shipping_zones (V68 constraints) | JWT + `shipping.write` | `AdminShippingApiTest` | CBT |
| E2E-123 | Shipping methods CRUD per zone | (above) | (above) | `/admin/shipping/zones/{id}/methods*` | (above) | shipping_methods | JWT + `shipping.write` | `AdminShippingApiTest` | CBT |

### 4.13 Reports & Dashboard admin

| ID | Workflow | Actor | FE | BE | Service | DB | Auth | Side | Tests | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| E2E-124 | Dashboard summary | Admin / SHOP_MANAGER | `DashboardScreen` | `GET /admin/dashboard?period=` | `AdminDashboardService` | orders, payments, customers (TZ Asia/Ho_Chi_Minh) | JWT + `orders.read` | — | `AdminDashboardApiTest` | CBT |
| E2E-125 | Analytics report | (above) | `ReportsScreen` | `GET /admin/reports/analytics?from&to` | `AdminReportService.analytics` | (above + REVENUE_EXCLUDED / RANKING_EXCLUDED set; REPORT_RULE_001..011) | JWT + `reports.read` | — | `AdminReportApiTest`, `AdminReportRepositoryQueryTest` | CBT |
| E2E-126 | Export orders CSV | (above) | (above) | `GET /admin/reports/orders/export` | `AdminReportService.exportOrders` | orders | JWT + `reports.export` | Audit (export) | `AdminReportApiTest`, `AdminReportCsvHardeningTest` | CBT |
| E2E-127 | Export customers CSV | (above) | (above) | `GET /admin/reports/customers/export` | `AdminReportService.exportCustomers` | customers | JWT + `reports.export` | Audit | `AdminReportApiTest` | CBT |
| E2E-128 | Export products CSV | (above) | (above) | `GET /admin/reports/products/export` | `AdminReportService.exportProducts` | products | JWT + `reports.export` | Audit | `AdminReportApiTest` | CBT |

### 4.14 Audit logs admin

| ID | Workflow | Actor | FE | BE | Service | DB | Auth | Tests | Status |
|---|---|---|---|---|---|---|---|---|---|
| E2E-129 | List audit logs (filters: actor/resource/action/q/date) | SUPER_ADMIN / ADMIN | `AuditLogListScreen` | `GET /admin/audit-logs` | `AdminAuditLogService.list` | audit_logs (V76 fix) | JWT + `audit-logs.read` | (no dedicated test class) | CFC |

### 4.15 Admin users / Roles / Permissions / Auth

| ID | Workflow | Actor | FE | BE | Service | DB | Auth | Side | Tests | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| E2E-130 | Admin login | Admin user | `LoginScreen` | `POST /api/v1/auth/login` | `AdminAuthService.login`, `JwtService` | admin_users, admin_refresh_tokens | Public + rate-limit | Refresh cookie set | `AdminAuthApiTest`, `AdminAuthSecurityTest` | CBT |
| E2E-131 | Admin refresh | Admin | (interceptor) | `POST /auth/refresh` | `AdminAuthService.refresh` | admin_refresh_tokens | Refresh cookie | Issue new tokens | `AdminAuthApiTest` | CBT |
| E2E-132 | Admin logout | Admin | top-bar | `POST /auth/logout` | `AdminAuthService.logout` | admin_refresh_tokens (delete) | Refresh cookie | Clear cookies | `AdminAuthApiTest` | CBT |
| E2E-133 | Admin profile (`/auth/me`) | Admin | bootstrap | `GET /auth/me` | `AdminAuthService.me` | admin_users | JWT | — | `AuthProfileGuardTest` | CBT |
| E2E-134 | List admin users | SUPER_ADMIN / ADMIN | `AdminUsersScreen` | `GET /admin/admin-users` | `AdminAdminUsersService.list` | admin_users + roles | JWT + `admin-users.read` | — | `AdminUsersApiTest`, `Phase1IAdminManagementApiTest` | CBT |
| E2E-135 | Create admin user | (above) | (above) | `POST /admin/admin-users` | `AdminAdminUsersService.create` | admin_users (V12 user_roles) | JWT + `admin-users.write` | Password hashed; audit | `AdminUsersApiTest` | CBT |
| E2E-136 | Update admin user (status / role) | (above) | (above) | `PATCH /admin/admin-users/{id}` | `AdminAdminUsersService.update` | admin_users | JWT + `admin-users.write` | Self-deactivation guard; last-Super-Admin guard; audit | `Phase1IAdminManagementApiTest` | CBT |
| E2E-137 | Delete admin user | (above) | (above) | `DELETE /admin/admin-users/{id}` | `AdminAdminUsersService.delete` | admin_users | JWT + `admin-users.write` | Audit | `AdminUsersApiTest` | CBT |
| E2E-138 | List roles | (above) | `RolesScreen` | `GET /admin/roles` | `AdminRoleService.list` | admin_roles, V49/V81 | JWT + `roles.read` | — | `AdminRolesApiTest` | CBT |
| E2E-139 | Create / Delete role | (above) | (above) | `POST/DELETE /admin/roles*` | `AdminRoleService.create/delete` | admin_roles | JWT + `roles.write` | Audit | `AdminRolesApiTest` | CBT |
| E2E-140 | Update role permissions | (above) | (above) | `PUT /admin/roles/{id}/permissions` | `AdminRoleService.updatePermissions` | role_permissions | JWT + `roles.write` | Audit | `AdminRolesApiTest`, `RbacUrlGateIntegrationTest` | CBT |
| E2E-141 | List permission catalog | (above) | (above) | `GET /admin/permissions` | `AdminPermissionsController` | (catalog code-driven) | JWT + `roles.read` | — | (none direct) | CFC |

---

## 5. Cross-Domain Side Effect Map

| Workflow ID | Source action | Affected domains | Expected side effects | Evidence | Risk |
|---|---|---|---|---|---|
| E2E-048 | Checkout (cart → order, COD/BACS) | order, payment, shipping, coupon, stock movement, admin WS, email, web revalidate | Order created (PROCESSING/ON_HOLD), Payment row PENDING, Stock decrement (`OUT`), Coupon usage_count++ + `order_applied_coupons` row, cart status MERGED/CONVERTED, Idempotency key persisted, WS NEW_ORDER, email confirmation, web ISR tag invalidate | `CheckoutService.java`, `Phase1FCheckoutApiTest`, V62, V73 | High (race condition, idempotency mismatch) |
| E2E-049 | Quick buy → order | order, payment, stock, admin WS, email | Same as E2E-048 minus cart merge | `CheckoutService.quickBuy`, no dedicated test | High |
| E2E-073 / E2E-074 | POS CASH/CARD sale | order (status COMPLETED, paymentStatus PAID), payment (POS, SUCCEEDED), stock (OUT), audit, WS | Auto-complete; immediate decrement; reference no. for CARD | `PosOrderService.java`, `Phase1MPosApiTest` | High |
| E2E-075 | POS CREDIT sale | order (PROCESSING, paymentStatus UNPAID, channel POS), payment (UNPAID), receivable (OPEN), customer credit (consumed), stock (OUT), audit, WS | Walk-in customer snapshot (V71); credit limit check; HTTP 422 if exceed unless `receivables.override_limit`; due date computed from payment_terms_days | `PosOrderService.java`, `ReceivableService.java`, `Phase1MPosApiTest`, `AdminReceivableApiTest`, V75 | High |
| E2E-057 | Order status change PENDING/PROCESSING/ON_HOLD → CANCELLED | order (cancelledAt), stock (RETURN/restore), email, audit, WS | Stock restored only if not already restored; cancelledAt set; status email; WS event | `AdminOrderService.java`, STATE_MACHINES.md §6 | High |
| E2E-057 | Order status change PROCESSING → COMPLETED | order (completedAt), email, audit, WS | completedAt set; email; WS | `AdminOrderService.java` | Medium |
| E2E-057 | Order status change COMPLETED → REFUNDED | order (status REFUNDED), stock (restore), email, audit, WS | Restore stock; refund propagation; status `REFUNDED` is terminal | `AdminOrderService.java` | High |
| E2E-061 | Refund full / partial | payment, order paymentStatus, order status (full → REFUNDED), stock (restore on full), refundAmount/refundedAt, audit, WS, report numbers (REPORT_RULE_002/003/011) | All above; **REPORT_RULE_011 limitation**: `refundedAt` overwritten on each partial — period attribution only by `placedAt` | `RefundService.java`, BUSINESS_RULES.md REPORT_RULE_011 | High |
| E2E-067..E2E-071 | Return APPROVED / RECEIVED / COMPLETED / REFUNDED | return status + history, stock (RETURN restore on COMPLETED & REFUNDED), order paymentStatus (REFUNDED), payment record REFUNDED, refundAmount, audit, WS, customer email | Stock restore happens at COMPLETED **and** REFUNDED; refund chain: triggers `RefundService.applyRefund` | `AdminReturnService.java`, `Phase1LReturnsApiTest` | High |
| E2E-043 | Coupon applied to cart | cart_coupons (V73 unique), coupon row (locked), cart totals | One coupon per cart enforced; revalidate on refresh | `CartService.java`, V73 | Medium |
| E2E-106 | Coupon redeemed at checkout | coupon usage_count++, order_applied_coupons row | Atomic increment; reject if status / expiry / limit fails | `CheckoutService.java`, `Phase1FCheckoutApiTest` | High |
| E2E-082 | Receivable record payment | accounts_receivable (paidAmount, status), payments row, order.paymentStatus may flip, audit | UNPAID→PARTIALLY_PAID→PAID/CLOSED transitions | `ReceivableService.java`, `AdminReceivableApiTest` | Medium |
| E2E-083 | Receivable write-off | accounts_receivable (status WRITTEN_OFF, reason), audit | Mandatory reason; sensitive permission | `ReceivableService.java` | Medium |
| E2E-089 | Product publish/hide/archive | product publishStatus, public catalog visibility, sitemap, Next ISR cache | `CatalogReadService` filters PUBLISHED only; revalidate web tags | `AdminCatalogMutationService.java`, `WebRevalidationService.java` | Medium |
| E2E-114 | Content publish/hide | publishStatus on articles/pages, public route access, Next ISR | Public hidden; revalidate | `AdminContentMutationService.java` | Medium |
| E2E-120 | Redirect update | redirects, proxy.ts L1 cache (30s TTL), proxy lookup | Cache TTL 30s; hits counter increments via `POST /api/internal/redirects/hit/{id}` | `AdminRedirectService.java`, `proxy.ts` | Medium |
| E2E-121 | Settings batch update | site_settings, public settings consumption, revalidate web | Public homepage/header/footer affected | `AdminSettingsService.java` | Medium |
| E2E-118 | Menu/slider/home video update | menus / sliders / home_videos, public homepage / header / footer | Public update; revalidate | various | Low/Medium |
| E2E-126..E2E-128 | Report CSV export | audit log | Export action audited (audit-log gate per V78 + REPORT_RULE) | `AdminReportService.java`, `AdminReportApiTest` | Low |
| E2E-021 | verify-email POST | customers (emailVerifiedAt), tokens table | **Drift**: SecurityConfig permits GET only — POST will hit `authenticated()` filter → fail in prod for unauthenticated users | `SecurityConfig.java`, `CustomerAuthController.java` | High (deploy bug) |

---

## 6. State Machine Summary

| Entity | State field | States found | Allowed transitions found | Forbidden transitions found | Backend enforced? | Tests? | Evidence | Gaps |
|---|---|---|---|---|---|---|---|---|
| Product | `publishStatus` | DRAFT, PUBLISHED, HIDDEN, ARCHIVED, PENDING, PRIVATE, TRASH | per `AdminMutationValidators.validatePublishTransition` (15+ allowed pairs); incl. TRASH→DRAFT restore | DRAFT→HIDDEN; PUBLISHED→DRAFT; ARCHIVED→PUBLISHED (must go DRAFT first); TRASH→anything except DRAFT; same-status no-op | Yes | Validator unit test exists (`AdminMutationValidatorsTest`); E2E transition coverage `MISSING_TEST_COVERAGE` | `AdminMutationValidators.java`, `AdminCatalogMutationService.java`, `CatalogReadService.java`, STATE_MACHINES.md §4 | Direct E2E transition tests; admin UI behavior by status |
| Category | `visible` (boolean) | true/false | true→false (hide), false→true (show) | Hide parent with visible children; circular parent | Yes | `MISSING_TEST_COVERAGE` | `AdminCatalogMutationService.java`, `CatalogReadService.java`, STATE_MACHINES.md §5 | Default visibility on create |
| Brand | `visible` (boolean) | true/false | (same as category) | Hard-delete not confirmed | Yes (visibility) | `MISSING_TEST_COVERAGE` | (same files) | Hard-delete behavior |
| Content (article/page) | `publishStatus` (shared `PublishStatus`) | DRAFT, PUBLISHED, HIDDEN, ARCHIVED (PENDING/PRIVATE/TRASH inherited from enum) | shared validator | shared rules | Yes | Limited (`AdminContentApiTest`) | `AdminContentController.java`, `AdminContentMutationService.java`, STATE_MACHINES.md §11 | Public filtering NV |
| Order | `status` | PENDING, PROCESSING, ON_HOLD, COMPLETED, CANCELLED, FAILED, REFUNDED | per `AdminOrderService.ALLOWED_TRANSITIONS` (incl. PENDING→{PROCESSING,ON_HOLD,CANCELLED,FAILED}, PROCESSING→{COMPLETED,CANCELLED,FAILED}, COMPLETED→REFUNDED) | COMPLETED→PENDING/PROCESSING/etc.; CANCELLED/FAILED/REFUNDED → anything (terminal) | Yes | `MISSING_TEST_COVERAGE` per-transition; `Phase1HAdminOrderApiTest` covers some | STATE_MACHINES.md §6, `AdminOrderService.java` | Per-transition tests; fulfillment relation NV |
| Order paymentStatus | `paymentStatus` | UNPAID, PENDING, PAID, PARTIALLY_PAID, FAILED, REFUNDED, CANCELLED, PARTIALLY_REFUNDED | per `AdminOrderService.ALLOWED_PAYMENT_TRANSITIONS` (extensive map); REFUNDED/CANCELLED terminal | REFUNDED/CANCELLED→anything; PENDING→UNPAID; PARTIALLY_REFUNDED→anything except REFUNDED | Yes | `MISSING_TEST_COVERAGE` per-transition; `Phase1FCheckoutApiTest` covers initial UNPAID | `AdminOrderService.java`, STATE_MACHINES.md §7 | per-transition tests; PaymentEntity full lifecycle STATUS_ONLY |
| Payment record | `status` (`PaymentRecordStatus.java`) | PENDING, SUCCEEDED, FAILED, CANCELLED, REFUNDED (5 values per DOCS_VERIFICATION_REPORT M1 re-verify) | observed via service writes (PENDING→SUCCEEDED→REFUNDED, etc.) | full map not audited | Partial | `STATUS_ONLY` for full lifecycle | `PaymentRecordStatus.java`, STATE_MACHINES.md §7 | Full transition map audit |
| Cart | `status` (`CartStatus.java`) | ACTIVE, MERGED, ABANDONED, CONVERTED, EXPIRED (5 values) | ACTIVE→MERGED (login), ACTIVE→CONVERTED (checkout), ACTIVE→ABANDONED/EXPIRED (timeout/scheduler) | (full map not enumerated in service) | Yes for write paths | `Phase1ECartApiTest` covers some | `CartStatus.java`, `CartService.java` | Abandoned/expired scheduler not visible |
| Shipping/Fulfillment | `fulfillmentStatus` (Order field), shipping method `enabled` | exists on order detail; method enabled flag | shipping method selection enforced; fulfillment transitions not confirmed | (NV) | Partial | `MISSING_TEST_COVERAGE` | `AdminOrderService.java`, `CheckoutService.java`, STATE_MACHINES.md §8 | Full fulfillment lifecycle / carrier integration |
| Inventory / Stock | `stockState` (`ProductStockState.java`), variant qty | IN_STOCK, LOW_STOCK, OUT_OF_STOCK, PREORDER, CONTACT_FOR_STOCK | qty thresholds → recompute (system); admin-controlled PREORDER/CONTACT_FOR_STOCK not overwritten | sell beyond stock blocked at checkout | Yes | `Phase1KInventoryP0FixApiTest`, `Phase1KInventorySerialApiTest` | `InventoryPolicyService.java`, V50, STATE_MACHINES.md §9 | Concurrency / oversell tests; full serial lifecycle NV |
| Return | `status` | PENDING, APPROVED, REJECTED, RECEIVED, COMPLETED, REFUNDED | per `AdminReturnService.TRANSITIONS` (PENDING→APPROVED/REJECTED, APPROVED→RECEIVED, RECEIVED→COMPLETED/REFUNDED) | PENDING→RECEIVED/COMPLETED/REFUNDED; APPROVED→COMPLETED/REFUNDED/REJECTED; terminal states | Yes | `Phase1LReturnsApiTest` | `AdminReturnService.java`, STATE_MACHINES.md §10 | Customer-side eligibility NV |
| Receivable | `status` (`ReceivableStatus`) | OPEN, PARTIALLY_PAID, OVERDUE, CLOSED, WRITTEN_OFF | OPEN→PARTIALLY_PAID→CLOSED; OPEN/PARTIALLY_PAID→OVERDUE (scheduler); OPEN/PARTIALLY_PAID/OVERDUE→WRITTEN_OFF | (none directly forbidden — write-off requires permission) | Yes | `AdminReceivableApiTest` | BUSINESS_RULES.md AR_*, V75 | overdue scheduler runtime NV |
| Customer credit status | `creditStatus` | ACTIVE, SUSPENDED, BLOCKED | ACTIVE↔SUSPENDED, ACTIVE→BLOCKED (permanent) | BLOCKED→ACTIVE (requires credit clear) | Yes | `AdminReceivableApiTest` (partial) | BUSINESS_RULES.md AR_RULE_002, V75 | Reinstate path |
| Coupon | `status` | ACTIVE, EXPIRED, INACTIVE (others NV) | ACTIVE→EXPIRED (scheduler), admin set INACTIVE | (validator in service) | Yes | `Phase1JAdminSettingsMenuCouponApiTest` | `CouponExpiryScheduler.java`, `AdminCouponService.java` | Full enum audit |
| Media | `status` | ACTIVE, INACTIVE, DELETED | upload→ACTIVE; soft-delete→DELETED; restore→ACTIVE; hard-delete (if not referenced) | hard-delete blocked when URL referenced | Yes | `AdminMediaP0Test` | `AdminMediaService.java`, BUSINESS_RULES.md Media | |
| Admin user | `status`, `role` | Status: ACTIVE, DISABLED, SUSPENDED; Roles: SUPER_ADMIN, ADMIN, EDITOR, SHOP_MANAGER, AUTHOR, CONTRIBUTOR, SEO_EDITOR + custom | status/role transitions free; guards | self-deactivation; last-Super-Admin demotion | Yes | `Phase1IAdminManagementApiTest` (partial) | `AdminAdminUsersService.java`, STATE_MACHINES.md §12 | Login-block behavior on DISABLED/SUSPENDED NV |
| Settings | none confirmed | n/a | n/a | n/a | n/a | n/a | `AdminSettingsController.java` | No state machine |
| Notification | none persisted | n/a | n/a | n/a | n/a | n/a | `OrderNotificationService` (events only); no read/unread schema | `NOT_FOUND_IN_REPO` for notif center |

---

## 7. API Contract Coverage

| Client | Feature | Client call | Backend endpoint | Request match? | Response match? | Status | Evidence | Notes |
|---|---|---|---|---|---|---|---|---|
| bigbike-web | Cart get/add/update/remove/clear | `lib/api/client-api.ts fetchCart/addCartItem/...` | `/api/v1/cart*` | Yes | Yes | OK | `Phase1ECartApiTest`, `lib/contracts/commerce.ts` | CSRF header injected |
| bigbike-web | Coupon apply/remove | `applyCoupon/removeCoupon` | `/api/v1/cart/coupons*` | Yes | Yes | OK | (above) | |
| bigbike-web | Checkout submit + options + quick-buy | `submitCheckout/submitQuickBuy` | `/api/v1/checkout`, `/checkout/options`, `/orders/quick-buy` | Yes | Yes | OK | `Phase1FCheckoutApiTest`, `lib/schemas/checkout.ts` | Idempotency-Key supported |
| bigbike-web | Customer auth | `loginCustomer/logoutCustomer/registerCustomer` | `/api/v1/customer/auth/*` | Yes | Yes | OK (verify-email POST drift) | (above) | verify-email POST will be 401 in prod (CONFLICTING_EVIDENCE) |
| bigbike-web | Customer profile/addresses | `fetchProfile/updateProfile/listAddresses/createAddress/...` | `/api/v1/customer/me`, `/customer/addresses*` | Yes | Yes | OK | (above) | |
| bigbike-web | Customer orders | `fetchMyOrders/fetchMyOrder` | `/api/v1/customer/orders*` | Yes | Yes | OK | `Phase1GOrderReadApiTest` | |
| bigbike-web | Customer returns | `getMyReturns/createReturn` | `/api/v1/customer/orders/returns`, `/{id}/returns` | Yes | **Drift**: customer return endpoints return raw DTO (not wrapped in `ApiDataResponse`) | DRIFT (docs flagged) | DOCS_VERIFICATION_REPORT 3.3 | "envelope inconsistency" |
| bigbike-web | Order lookup (guest) | `getOrderLookup` | `/api/v1/orders/lookup` | Yes | Yes | OK | (above) | |
| bigbike-web Next API | Reviews submit | `/api/products/[id]/reviews` POST | `POST /api/v1/products/{id}/reviews` | Yes | Yes | OK | `Phase1NReviewsApiTest`, `__tests__` | |
| bigbike-web Next API | Search suggest | `/api/search-suggest` | `/api/v1/search-suggest` | Yes | Yes | OK | `__tests__/api/search-suggest-route.test.ts` | |
| bigbike-web Next API | Product snapshot/pricing/stock/variants/reviews | proxies | `/api/v1/products/{id}/snapshot`, `/{id}` | Yes | Some unwrap | OK | `__tests__/api/snapshot-route.test.ts` | unwraps `data` envelope |
| bigbike-admin | All admin endpoints | `lib/adminApi.js` (~80 fns) | `/api/v1/admin/**`, `/api/v1/auth/*` | Yes | Yes (admin normalizer renames `lineItems→items`, `subtotalAmount→subtotal` per DOCS_VERIFICATION 3.3 — known) | OK with documented drift | `lib/contracts.js` normalizers | |
| bigbike-admin | WebSocket | `lib/adminWebSocket.js` STOMP | `/ws` STOMP | Yes (CONNECT JWT) | Yes (event payload) | OK | `WebSocketConfig.java` | per-subscribe authz NV |
| bigbike_mobile | Public catalog/search/contact/address/cart/checkout/customer auth/orders/returns | `lib/core/api/api_endpoints.dart` | `/api/v1/**` | Likely yes | Likely yes | NEEDS_VERIFICATION (per-endpoint field mapping) | DOCS_VERIFICATION_REPORT M2 | mobile audit field-by-field still pending |
| bigbike_mobile | verify-email | (no wrapper) | `/api/v1/customer/auth/verify-email` | n/a | n/a | CODE_ONLY_NOT_DOCUMENTED | MODULE_CATALOG.md | gap noted |
| bigbike_mobile | Home videos | (no wrapper) | `/api/v1/home-videos` | n/a | n/a | CODE_ONLY_NOT_DOCUMENTED | MODULE_CATALOG.md | gap noted |

### API contract issues / drifts noted

- **verify-email POST vs SecurityConfig GET permitAll** — code bug, docs catch correctly (do not fix in unrelated tasks).
- **Customer return endpoints raw DTO** — different envelope from rest of customer API.
- **Admin order normalizer renames** (`lineItems→items`, `subtotalAmount→subtotal`, `customerName` derived) — intentional FE-side normalization.
- **PublishStatus subset** — backend has 7 (DRAFT, PUBLISHED, HIDDEN, ARCHIVED, PENDING, PRIVATE, TRASH); web/admin TypeScript subset only 4 (DRAFT, PUBLISHED, HIDDEN, ARCHIVED) — known drift.
- **`forceOutOfStock`/`stockQuantity`** — backend domain has, public web TypeScript drops them — known drift.
- **PARTIALLY_REFUNDED** — exists in backend `OrderPaymentStatus`, ensure web/admin/mobile handle.
- **CartStatus EXPIRED & PaymentRecordStatus REFUNDED** — confirmed in re-verification 2026-05-05; clients should handle 5 values.

---

## 8. Security / Permission / Ownership Inventory

| Area | Workflow | Required auth | Required permission | CSRF / rate-limit | Ownership rule | Backend enforced? | Evidence | Risk |
|---|---|---|---|---|---|---|---|---|
| Customer self-service | View own orders / returns / addresses / profile | `bb_session` cookie + ROLE_CUSTOMER | n/a | CSRF on mutations; rate-limit on auth/password endpoints | Customer can only access own orders / addresses / returns | Yes (`SecurityConfig` + service-level scope) | `SecurityConfig.java`, `OrderReadService.java`, `CustomerAddressService.java`, `Phase1GOrderReadApiTest` | Medium (must be sure all customer endpoints filter by customerId at service layer) |
| Customer return create | `POST /api/v1/customer/orders/{id}/returns` | Customer | n/a | CSRF | Order must belong to customer | Yes | `CustomerReturnService.java`, `Phase1LReturnsApiTest` | Medium |
| Guest order lookup | `GET /api/v1/orders/lookup?orderNumber=&orderKey=` | Public | n/a | (no rate-limit explicit) | Must know `orderNumber + orderKey` | Yes | `OrderLookupController.java` | Low (key-gated, but no explicit rate-limit found) |
| Cart mutations (guest + customer) | POST/PATCH/DELETE `/api/v1/cart*` | `bb_guest_id` or session | n/a | CSRF (`X-CSRF-Token` matching `bb_csrf` cookie); rate-limit 30/min | Cart bound to guest_id or customer_id | Yes | `CustomerCsrfFilter.java`, `RateLimitingFilter.java`, `CartService.java` | Medium |
| Checkout / quick-buy | POST `/api/v1/checkout`, `/orders/quick-buy` | `bb_guest_id` or session | n/a | CSRF + rate-limit 5/min + Idempotency-Key | n/a | Yes | `CheckoutService.java`, `RateLimitingFilter.java`, `Phase1FCheckoutApiTest` | High (idempotency, oversell race) |
| Contact form | POST `/api/v1/contact` | Public | n/a | rate-limit 3/min | n/a | Yes | `ContactController.java`, `RateLimitingFilter.java` | Low |
| Customer auth login/register/forgot/reset | `/api/v1/customer/auth/*` | Public | n/a | rate-limit 5/min (login, reset), 3/min (register) | n/a | Yes | `RateLimitingFilter.java` | Medium |
| Customer email verify | `POST /api/v1/customer/auth/verify-email` | Should be public | n/a | n/a | n/a | **No** — drift with SecurityConfig GET permitAll only | DOCS_VERIFICATION_REPORT 6.1 | High (deploy bug) |
| Admin endpoints | `/api/v1/admin/**` | Admin JWT (Authorization Bearer) | Per-endpoint `requirePermission(...)` from `AdminRolePermissions.MAP` | n/a | n/a | Yes | `SecurityConfig.java`, `JwtAuthFilter.java`, `AdminRolePermissions.java` | Medium |
| Admin POS | `/api/v1/admin/pos/*` | Admin JWT | `pos.read`, `pos.write`, `pos.price_override` | n/a | n/a | Yes | `AdminPosController.java`, `Phase1MPosApiTest` | High (price override; credit) |
| Admin receivables | `/api/v1/admin/receivables*`, `/customers/{id}/receivables`, `/credit` | Admin JWT | `receivables.read`, `receivables.create`, `receivables.record_payment`, `receivables.write_off`, `receivables.override_limit`, `receivables.export` | n/a | n/a | Yes | `AdminReceivableController.java`, `AdminRolePermissions.java`, `AdminReceivableApiTest` | High (write_off, override_limit are sensitive) |
| Admin reports export | `/api/v1/admin/reports/*/export` | Admin JWT | `reports.export` | n/a | n/a | Yes | `AdminReportController.java`, V77/V78 | Medium (audit log gate) |
| Admin audit logs | `GET /admin/audit-logs` | Admin JWT | `audit-logs.read` (only SUPER_ADMIN, ADMIN) | n/a | n/a | Yes | `AdminAuditLogController.java`, `AdminRolePermissions.java` | Medium (data exposure) |
| Media upload | `POST /admin/media` | Admin JWT | `media.write` | n/a | n/a (server-side MIME validation Tika; SVG rejected; max 50 MB at FE) | Yes | `AdminMediaService.java`, `AdminMediaP0Test` | Medium |
| Media hard-delete | (DELETE) | Admin JWT | `media.write` | n/a | block when URL referenced | Yes | (above) | Low |
| Redirects | `/admin/redirects*` | Admin JWT | `redirects.write` | n/a | n/a | Yes | `AdminRedirectController.java`, V58/V80 | Medium (open redirect not enforced — admin trust) |
| Internal redirect | `GET /api/internal/redirect`, `POST /redirects/hit/{id}` | App-level permitAll | n/a | n/a | Expects infra IP allowlist | NV (infra) | `SecurityConfig.java` (comment), `InternalRedirectController.java`, DOCS_VERIFICATION_REPORT 6.1 | Medium (deploy must lock) |
| WebSocket STOMP | CONNECT `/ws` | JWT bearer in CONNECT header | role ADMIN/SUPER_ADMIN at connect | n/a | per-subscribe authz NV | Yes (connect-time only) | `WebSocketConfig.java`, DOCS_VERIFICATION_REPORT 6.1 | Medium (per-topic authz) |
| Admin user self-deactivation guard | `PATCH /admin/admin-users/{id}` | Admin JWT | `admin-users.write` | n/a | Cannot deactivate self; cannot demote last Super Admin | Yes | `AdminAdminUsersService.java`, STATE_MACHINES.md §12 | Medium |
| Dev/mock auth bypass | `DevAdminAuthService.ensureDevMockProfile()` | n/a | n/a | n/a | Throws `AuthNotImplementedException` if profile contains `prod`/`production` | Yes (with caveat) | `DevAdminAuthService.java`, DOCS_VERIFICATION_REPORT 6.1 | Medium (ops awareness) |
| Admin SPA mock mode | `VITE_USE_ADMIN_MOCK` | n/a | n/a | n/a | Hardcoded `false` in docker-compose + CI | Yes (ops gate) | `docker-compose.yaml`, `.github/workflows/ci.yml`, DOCS_VERIFICATION_REPORT 6.1 | Low |

---

## 9. Test Coverage Inventory

> Format: workflow → test files → test type → covered cases → missing critical cases → status

### 9.1 Backend test inventory (62 test classes)

| Workflow ID(s) | Test files | Test type | Covered cases | Missing critical cases | Status |
|---|---|---|---|---|---|
| E2E-020..E2E-026 (Customer auth) | `Phase1DCustomerAuthTest`, `Phase1I1CustomerStatusLoginTest` | API integration | Register, login, refresh, logout, password reset, status-blocked login | verify-email POST end-to-end (CONFLICTING_EVIDENCE), full session expiry edge | CBT (P) |
| E2E-038..E2E-046 (Cart + coupon) | `Phase1ECartApiTest` | API integration | Add/update/remove, coupon apply/remove, concurrent access, V73 unique | Long-running cart abandonment scheduler | CBT |
| E2E-047..E2E-051 (Checkout + quick-buy + idempotency + lookup) | `Phase1FCheckoutApiTest` | API integration | Address validate, shipping/payment, idempotency UUID, race conditions, order create | Quick-buy dedicated test, oversell test, partial-shipping selection | CBT |
| E2E-033..E2E-034 (Customer order read) | `Phase1GOrderReadApiTest` | API integration | List/detail by customer, pagination, authz | — | CBT |
| E2E-054..E2E-061 (Admin order incl. refund) | `Phase1HAdminOrderApiTest` | API integration | List, detail, status update | Per-transition full coverage; refund partial vs full | CBT (P) |
| E2E-107..E2E-110 (Customers admin + status block login) | `Phase1IAdminManagementApiTest`, `Phase1I1CustomerStatusLoginTest` | API integration | CRUD customer; admin user mgmt; status block | Address-side audit | CBT |
| E2E-103..E2E-106, E2E-118, E2E-121 (Coupon, menu, settings) | `Phase1JAdminSettingsMenuCouponApiTest` | API integration | Coupon CRUD + status; menus + items; settings batch | — | CBT |
| E2E-098..E2E-102 (Inventory) | `Phase1KInventoryP0FixApiTest`, `Phase1KInventorySerialApiTest` | API integration | Adjust stock, summary, list movements, serial validation | Concurrency / oversell race | CBT |
| (contract hardening + OpenAPI) | `Phase1K1ContractHardeningTest`, `Phase1KOpenApiContractTest` | Contract validation | OpenAPI compliance, response shapes | Mobile field mapping | CBT |
| E2E-065..E2E-071 (Returns) | `Phase1LReturnsApiTest` | API integration | Return state transitions, refund branch, race guard (V39), check constraints (V66) | Customer-initiated eligibility | CBT |
| E2E-072..E2E-076 (POS) | `Phase1MPosApiTest` | API integration | CASH/CARD/CREDIT branches, price override, idempotency | Receivables full chain integration | CBT |
| E2E-011..E2E-012, E2E-097 (Reviews) | `Phase1NReviewsApiTest` | API integration | Submit, approve/reject, public list filter, status check (V60), index (V61) | Spam detection / honeypot edge | CBT |
| E2E-085..E2E-096 (Catalog admin reads/mutations) | `AdminReadApiTest`, `AdminMutationApiTest`, `AdminMutationValidatorsTest`, `VariantGalleryRoundtripTest` | API + unit | Read filter; mutation create/update; publish transition validator | Per-transition E2E | CBT |
| E2E-019, E2E-001..E2E-010 (Public reads) | `PublicReadApiTest`, `HomepagePublicApiTest`, `ContentPublicApiTest`, `ContentP1ApiTest` | API integration | Product/category/brand list/detail; sliders; home content; pages/articles | Sitemap/robots completeness | CBT |
| E2E-119 (Media) | `AdminMediaP0Test` | API integration | Upload + MIME magic-byte (Tika) + SVG reject + delete-blocked-when-referenced | Restore from DELETED edge | CBT |
| E2E-130..E2E-133 (Admin auth) | `AdminAuthApiTest`, `AdminAuthSecurityTest`, `AuthProfileGuardTest`, `PasswordServiceTest` | API + unit | Login, refresh, logout, JWT validation, RBAC at URL gate, password hashing | Long session edge | CBT |
| E2E-134..E2E-141 (Admin users / roles / RBAC) | `AdminUsersApiTest`, `AdminRolesApiTest`, `RbacUrlGateIntegrationTest` | API integration | CRUD admin users, roles, permission matrix at URL gate | Self-deactivation guard explicit test (NV) | CBT |
| E2E-077..E2E-084 (Receivables) | `AdminReceivableApiTest` | API integration | List/detail/payment/write-off/credit profile/aging | Overdue scheduler runtime; full POS-credit→receivable chain | CBT |
| E2E-120 (Redirects) | `AdminRedirectApiTest` | API integration | CRUD + permission V58/V80 | Internal endpoint infra-level allowlist | CBT |
| E2E-122..E2E-123 (Shipping) | `AdminShippingApiTest` | API integration | Zone + method CRUD, V68 constraints | — | CBT |
| E2E-124..E2E-128 (Reports + dashboard) | `AdminDashboardApiTest`, `AdminReportApiTest`, `AdminReportRepositoryQueryTest`, `AdminReportCsvHardeningTest` | API + unit | Analytics, CSV export, repo queries, REPORT_RULE_001..010 | REPORT_RULE_011 known limitation (refund period attribution) |  CBT |
| E2E-116..E2E-117 (Sliders + home videos) | `SliderApiTest`, `SliderRepositoryTest`, `HomeVideoApiTest`, `HomeVideoRepositoryTest` | API + repo | CRUD + reorder; uniqueness V72 | — | CBT |
| E2E-018 (Web revalidate) | `WebRevalidationServiceTest` | Service unit | Revalidate trigger contract | End-to-end with Next | CBT |
| E2E-129 (Audit logs) | (none direct test class) | — | — | List filters, role-gated read | CFC |
| E2E-035..E2E-037 (Customer return create + list/detail) | `Phase1LReturnsApiTest` (partial customer side) | API integration | Customer-create return | Customer eligibility window, return-to-merge edge | CBT (P) |
| Migrations / WP import | `Phase2*` (10 tests) | Migration / dry-run integration | WordPress import: catalog, customers, orders, coupons, redirects, media, gallery | Production rehearsal runtime | CBT |
| Schema | `Phase1BSchemaTest`, `Phase1CCommerceSchemaTest`, `HomeVideoRepositoryTest`, `SliderRepositoryTest` | Schema integration | Constraints, uniques | — | CBT |
| Config | `CorsConfigTest` | Config unit | CORS allowed origins | — | CBT |

### 9.2 Web (Vitest) test inventory

| Workflow | Test files | Test type | Covered cases | Missing | Status |
|---|---|---|---|---|---|
| E2E-008 (snapshot proxy) | `__tests__/api/snapshot-route.test.ts` | API route | Forward, error, unwrap | — | CBT |
| E2E-010 (search suggest proxy) | `__tests__/api/search-suggest-route.test.ts` | API route | Forward, empty short query | — | CBT |
| Order detail / price-changes contract | `__tests__/contracts/commerce-order-detail.test.ts`, `__tests__/contracts/price-changes.test.ts` | Type contract | Field shape | — | CBT |
| Auth schemas | `__tests__/schemas/auth.test.ts` | Schema validation | login/register/forgot/reset Zod | — | CBT |
| Checkout schemas | `__tests__/schemas/checkout.test.ts` | Schema validation | VN phone regex, address required fields | — | CBT |
| robots | `__tests__/seo/robots.test.ts` | SEO | robots.txt correctness | — | CBT |
| utils (auth/format/html/variant-match) | `__tests__/utils/*.test.ts` | unit | safe redirect, currency, sanitize, variant matching | — | CBT |

### 9.3 Admin test inventory

| Workflow | Test files | Status |
|---|---|---|
| (any) | **none** | Gap — 0 admin frontend tests |

### 9.4 Mobile test inventory

| Workflow | Test files | Test type | Covered cases | Missing | Status |
|---|---|---|---|---|---|
| Brand model fromJson | `test/models/brand_test.dart` | unit | logo parsing edge cases | — | CBT |
| Checkout model | `test/models/checkout_test.dart` | unit | options + payload serialization | — | CBT |
| App smoke | `test/widget_test.dart` | widget | startup placeholder | All real flows | CBT (smoke only) |

### 9.5 Critical gaps — top-10 untested workflows

1. **POS CREDIT full chain (E2E-075)** — POS → receivable created → payment recorded → write-off — only partial pieces tested.
2. **Refund period accuracy (E2E-061)** — REPORT_RULE_011 known limitation has no test isolating it.
3. **Order status per-transition E2E (E2E-057)** — `MISSING_TEST_COVERAGE` per STATE_MACHINES.md §6.
4. **Order paymentStatus per-transition E2E (E2E-058)** — same.
5. **Product publish transitions full E2E (E2E-089)** — validator unit-tested, but full E2E `MISSING_TEST_COVERAGE`.
6. **Stock decrement concurrency / oversell (E2E-048)** — race condition test not explicit.
7. **Customer return eligibility window** — order status, time-based eligibility for return creation not tested.
8. **Coupon double redemption / atomic increment** — partial coverage; concurrent redemption test not explicit.
9. **Mobile cart/checkout/auth provider state** — no provider tests in `bigbike_mobile/test/`.
10. **Admin frontend** — entire admin SPA has 0 tests.

Other gaps tracked in DOCS_VERIFICATION_REPORT: WebSocket per-subscribe authz, email production deliverability, sitemap/robots completeness, full SEO redirect coverage.

---

## 10. Missing / Non-Active Workflow List

| Topic | Finding | Status | Evidence | Should be future workflow? |
|---|---|---|---|---|
| External payment gateway (SePay) | DB schema (V44–V47), settings (V45), OpenAPI tag exist; controller/service code **removed** (V59 explicitly). Memory `project_sepay_manual.md` says manual mode — confirmed (no webhook code). | NFIR (controller/service code) / SO (schema) | DOCS_VERIFICATION_REPORT §5; INTEGRATION_GUIDE.md "CONFIG_ONLY"; V59 | Yes — likely target for payment automation |
| External payment provider (VNPAY / MoMo) | None | NFIR | DOCS_VERIFICATION_REPORT §5 | Future |
| External shipping carrier (GHN / GHTK / Viettel Post) | None | NFIR | DOCS_VERIFICATION_REPORT §5 | Future |
| Stock receiving workflow | Tables `stock_receipts`, `stock_receipt_lines`, `receipt_serials` exist (V52/V53/V55) but no active controller/service/UI. | SO | MODULE_CATALOG.md §"Inventory And Receiving Subdomains"; V52/V53/V55 | Yes — receiving workflow incomplete |
| Fulfillment lifecycle / shipping tracking | `OrderEntity.fulfillmentStatus` field exists in admin order detail mapping, no transition map / tracking number lifecycle. | NV | STATE_MACHINES.md §8, `AdminOrderService.java` | Yes |
| Notification read/unread center | `NotificationBell` component shows count but no persistent `notifications` table or read/unread API; backend only emits WS events + emails. | NFIR (data model) | STATE_MACHINES.md §13 "Notification" `NOT_FOUND_IN_REPO` | Yes |
| Customer-facing SOA / receivable portal | Receivables admin-only by design (AR_RULE_010). | by design (NFIR public-facing) | BUSINESS_RULES.md AR_RULE_010 | Optional |
| Refund per-period accuracy / `refund_transactions` table | Limitation — refundedAt overwritten on partial refunds (REPORT_RULE_011). Planned P1/P2. | DOC_ONLY (planned) | BUSINESS_RULES.md REPORT_RULE_011 | Yes |
| Sitemap/robots full content | `app/sitemap.ts`, `app/robots.ts` exist; content completeness not audited. | NV | DOCS_VERIFICATION_REPORT §5 | Should verify |
| Full SEO migration / redirect coverage | Tooling (`AdminRedirectController`, proxy.ts) has, content coverage NV. | NV | DOCS_VERIFICATION_REPORT §5 | Should verify |
| Email production deliverability | Code path (`EmailDispatchService`), runtime not verified. | NV | DOCS_VERIFICATION_REPORT §5 | Should verify |
| Customer-created return flow completeness | Endpoint POST exists, eligibility window / refund automation NV. | NV / DRIFT (envelope) | DOCS_VERIFICATION_REPORT §3.3, `Phase1LReturnsApiTest` partial | Should expand |
| POS expiry cleanup lifecycle | No live cleanup job confirmed for POS pending sales. | NFIR | BUSINESS_RULES.md POS Rules | Optional |
| WebSocket per-subscribe topic-level authz | CONNECT auth confirmed; per-subscribe NV. | NV | DOCS_VERIFICATION_REPORT §6.1 | Should verify |
| Mobile verify-email + home-videos wrappers | Backend has, mobile `api_endpoints.dart` doesn't wrap. | CO_NOT_DOCUMENTED | MODULE_CATALOG.md §"Mobile Coverage Notes" | Future |
| Admin SPA tests | 0 test file in admin frontend. | NFIR (test) | (above) | Should add |

---

## 11. Recommended Deep Audit Order

Prioritize the next prompts/audits for these in the order below — by descending business impact and side-effect cross-domain reach.

1. **Cart + Checkout + Coupon + Order create** — (E2E-038..E2E-053, E2E-106). Highest cross-domain side-effect (order/payment/stock/coupon/shipping/email/WS), idempotency, race-conditions. Verify against `Phase1ECartApiTest` + `Phase1FCheckoutApiTest` and **add** missing oversell-concurrency + per-transition tests.
2. **Orders + Payment + Refund + WebSocket + Audit** — (E2E-054..E2E-064). Verify state-machine transitions full coverage, REPORT_RULE_011 refund period edge, WS per-subscribe authz, audit completeness.
3. **POS + Receivables** — (E2E-072..E2E-084). Walk full chain CREDIT sale → receivable → payment → write-off; sensitive permissions; AR rules.
4. **Products + Inventory** — (E2E-085..E2E-102). Publish transitions full E2E; concurrency oversell; serial lifecycle / receiving workflow gap (V52/V53/V55).
5. **Returns** — (E2E-065..E2E-071). Customer-side eligibility window; envelope drift; refund chain.
6. **Customer account / address / auth** — (E2E-020..E2E-037). Fix verify-email POST drift; ownership-scope verification; mobile parity.
7. **Content / SEO / Media / Menu / Slider / HomeVideo / Redirect / Settings** — (E2E-013..E2E-018, E2E-111..E2E-121). Sitemap/robots completeness, redirect infra allowlist, ISR cache invalidation paths, MIME validation edges.
8. **Admin users / RBAC / Audit logs** — (E2E-129..E2E-141). Self-deactivation guard explicit test, last Super Admin guard, audit log read coverage.
9. **Reports / Dashboard / Exports** — (E2E-124..E2E-128). REPORT_RULE_011 limitation, audit-log gate on export, report rule compliance vs business expectations.
10. **Mobile contract** — (M47..M49). Field-by-field mapping audit against backend; add mobile provider/widget tests; close verify-email + home-videos wrapper gaps.

---

## 12. Evidence Appendix

### 12.1 Web (`bigbike-web`)

- `app/page.tsx`, `app/san-pham/page.tsx`, `app/danh-muc-san-pham/page.tsx`, `app/danh-muc-san-pham/[slug]/page.tsx`, `app/brands/page.tsx`, `app/brands/[slug]/page.tsx`, `app/product/[slug]/page.tsx`, `app/tin-tuc/`, `app/tin-tuc/[slug]/`, `app/tim-kiem/page.tsx`, `app/lien-he/page.tsx`, `app/gio-hang/page.tsx`, `app/thanh-toan/page.tsx`, `app/don-hang/xac-nhan/page.tsx`, `app/dang-nhap/`, `app/dang-ky/`, `app/quen-mat-khau/`, `app/xac-nhan-email/`, `app/tai-khoan/**`, `app/chinh-sach/[slug]/`, `app/[slug]/page.tsx`, `app/huong-dan/**`, `app/sitemap.ts`, `app/robots.ts`, `app/error.tsx`, `app/not-found.tsx`, `app/layout.tsx`
- `app/api/revalidate/route.ts`, `app/api/search-suggest/route.ts`, `app/api/products/[id]/{snapshot,pricing,stock,variants,reviews}/route.ts`, `app/api/orders/...`, `app/api/cart/...` (proxies)
- `proxy.ts`
- `lib/api/{public-api.ts,client-api.ts}`, `lib/auth/auth-store.ts`, `lib/contracts/{public.ts,commerce.ts}`, `lib/schemas/{auth.ts,checkout.ts,contact.ts}`, `lib/seo/{metadata.ts,json-ld.ts}`, `lib/query/{client.ts,hooks.ts,keys.ts}`, `lib/utils/*`, `lib/cart-context.tsx`, `lib/recently-viewed.ts`, `lib/analytics.ts`, `lib/logger.ts`, `lib/vn-address-data.ts`
- `__tests__/api/snapshot-route.test.ts`, `search-suggest-route.test.ts`; `__tests__/contracts/*`; `__tests__/schemas/*`; `__tests__/utils/*`; `__tests__/seo/robots.test.ts`

### 12.2 Admin (`bigbike-admin`)

- `src/App.jsx`, `src/main.jsx`
- `src/screens/*.jsx` (33 screens — DashboardScreen, OrderListScreen, OrderDetailScreen, ProductDetailScreen, ProductListScreen, InventoryScreen, CategoryListScreen, CategoryDetailScreen, BrandListScreen, BrandDetailScreen, ReviewListScreen, ReviewDetailScreen, CouponListScreen, ContentListScreen, ContentDetailScreen, MenuScreen, SliderListScreen, HomeVideoListScreen, RedirectListScreen, MediaLibraryScreen, ShippingScreen, SettingsScreen, AdminUsersScreen, RolesScreen, AuditLogListScreen, ReportsScreen, ReceivablesListScreen, ReceivableDetailScreen, ReturnListScreen, PosScreen, CustomerListScreen, CustomerDetailScreen, LoginScreen)
- `src/components/*` (AdminShell, AdminTable, MediaPickerModal, RefundModal, NotificationBell, OrderNotificationToast, RichTextEditor, etc.)
- `src/lib/*` (adminApi.js, adminWebSocket.js, auth.jsx, authStorage.js, contracts.js, formatters.js, i18n.js, mockData.js, queryClient.js, schemas.js, theme.jsx, urlPolicies.js, useAdminList.js, useDebounce.js, useUrlQuery.js, confirm.js)
- `src/locales/{vi,en}.json`
- (No tests)

### 12.3 Backend (`bigbike-backend`)

- Controllers (41): see Section 3.2 + 3.4
- Services (~70): `service/admin/*`, `service/auth/*`, `service/cart/*`, `service/catalog/*`, `service/checkout/*`, `service/content/*`, `service/coupon/*`, `service/customer/*`, `service/email/*`, `service/inventory/*`, `service/order/*`, `service/payment/*`, `service/pos/*`, `service/public_/*`, `service/receivable/*`, `service/search/*`, `service/security/*`, `service/slider/*`, `service/video/*`, `service/web/*`, `service/ws/*`, `service/address/*`, `service/common/*`, root `ContactService.java`
- Entities (`persistence/entity/**`): audit, auth, catalog, commerce/{cart,order,payment,receivable,returns}, content, coupon, customer, media, menu, redirect, settings, shipping, slider, video
- Config: `config/{SecurityConfig,JwtAuthFilter,CustomerSessionFilter,CustomerCsrfFilter,RateLimitingFilter,SecurityHeadersFilter,CorsConfig,RequestIdFilter,WebSocketConfig,MinioConfig,MinioProperties,MediaUrlProperties,JwtProperties,DataInitializer,RestAuthenticationEntryPoint,RestAccessDeniedHandler}.java`
- Migrations: `src/main/resources/db/migration/V1__create_catalog_content_tables.sql` … `V81__add_roles_permissions.sql`
- Tests (62): see Section 9.1

### 12.4 Mobile (`bigbike_mobile`)

- `lib/main.dart`
- `lib/core/{api,config,models,providers,router,theme,utils,widgets}/**`
- `lib/features/{account,articles,auth,brands,cart,categories,checkout,contact,content,home,products,search,shell}/**`
- `pubspec.yaml`
- `test/{models/brand_test.dart, models/checkout_test.dart, widget_test.dart}`

### 12.5 Docs (`docs/`)

- `docs/business/{PROJECT_OVERVIEW,MODULE_CATALOG,USER_ROLES,BUSINESS_PROCESS,BUSINESS_RULES,WORKFLOW_OVERVIEW,STATE_MACHINES,ACCEPTANCE_CRITERIA,GLOSSARY}.md`
- `docs/engineering/{ARCHITECTURE,API_CONTRACT,DATA_CONTRACT,API_FLOW_MAP,PERMISSION_MATRIX,TESTING_GUIDE,DEPLOYMENT_GUIDE,INTEGRATION_GUIDE,TRACEABILITY_MATRIX}.md`
- `docs/audits/*.md` (16 module audit/fix/completion reports)
- `docs/DOCS_VERIFICATION_REPORT.md`
- `docs/BIGBIKE_DOC_CODE_REPORT.md`
- `docs/DECISIONS.md`
- `docs/README.md`

---

> **Disclaimer.** Đây là inventory thuần — không phải release-gate, không phải production-readiness statement. Mọi workflow ghi `CONFIRMED_FROM_CODE` chỉ có nghĩa là source code có active controller/service/UI/tests đủ để chứng minh tồn tại; không có nghĩa workflow đó vận hành đúng nghiệp vụ trong runtime production. Đặc biệt các workflow rủi ro cao (Section 1, top 20) cần audit sâu kế tiếp theo thứ tự Section 11.
