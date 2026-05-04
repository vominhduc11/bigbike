# BigBike Project Overview

## 1. Document Purpose

File này mô tả tổng quan dự án BigBike ở mức business/system context để business user, PM, BA, developer mới, tester và AI agent hiểu hệ thống đang làm gì trước khi đọc sâu vào code hoặc tài liệu kỹ thuật.

Giới hạn của file:

- Đây là overview, không phải architecture detail, API contract, database schema hay test report.
- Mọi claim quan trọng phải gắn với evidence path hoặc status rõ ràng.
- Không kết luận hệ thống production-ready nếu chưa có bằng chứng build/test/runtime hiện tại.
- Không chứa secret, token, password, private key hoặc giá trị env nhạy cảm.
- Các phần chưa đủ evidence được đánh dấu `NEEDS_VERIFICATION` thay vì viết như đã chắc chắn.

## 2. Project Summary

BigBike là một nền tảng commerce/D2C retail cho đồ bảo hộ moto, biker gear và phụ kiện touring. Repo hiện tại thể hiện một hệ thống gồm public SEO-first sales website, internal admin dashboard, Spring Boot backend, Flutter mobile companion, Docker Compose infrastructure và design system.

Theo README root, BigBike phục vụ việc bán các nhóm sản phẩm như mũ bảo hiểm, áo/quần bảo hộ, găng tay, giày, protection gear, túi/luggage moto, intercom/Bluetooth helmet accessories và các phụ kiện biker khác.

**Status:** `CONFIRMED_FROM_CODE`

**Evidence:**

- `README.md`
- `AGENTS.md`
- `bigbike-web/package.json`
- `bigbike-admin/package.json`
- `bigbike-backend/pom.xml`
- `bigbike_mobile/pubspec.yaml`
- `docker-compose.yaml`
- `Bigbike Design System/README.md`

## 3. Business Context

BigBike được mô tả là shop bảo hộ moto / biker gear tại TP.HCM, tập trung vào sản phẩm chính hãng và trải nghiệm mua hàng cho rider Việt Nam. Design system mô tả BigBike là motorcycle safety gear and touring accessory retailer tại Ho Chi Minh City, phân phối mũ bảo hiểm, áo giáp, găng tay, boots, intercom và touring accessories từ các thương hiệu quốc tế.

Public website có mục tiêu SEO, product discovery, PDP, cart, checkout, content/blog/policy pages và customer trust. Admin dashboard phục vụ vận hành nội bộ như quản lý sản phẩm, danh mục, thương hiệu, đơn hàng, khách hàng, media, coupon, settings, menu, slider, shipping, review và user/role/permission.

Repo cũng có dấu vết migration từ legacy WordPress/WooCommerce sang hệ thống mới thông qua ETL scripts, WordPress migration package, redirect handling và SEO redirect data.

**Status:** `CONFIRMED_FROM_CODE` cho retail/D2C commerce, public web, admin, backend, mobile companion và migration support. `NEEDS_VERIFICATION` cho mức hoàn thiện production của từng workflow.

**Evidence:**

- `README.md`
- `Bigbike Design System/README.md`
- `bigbike-web/app/page.tsx`
- `bigbike-web/lib/utils/routes.ts`
- `bigbike-admin/README.md`
- `bigbike-admin/src/lib/adminApi.js`
- `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/**`
- `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/migration/wordpress/**`
- `bigbike-web/package.json`

## 4. Target Users / Actors

| Actor | Vai trò tổng quan | Evidence source | Status |
|---|---|---|---|
| Guest / Visitor | Xem homepage, danh mục, sản phẩm, brand, bài viết, search, settings/menu public, slider/home video, review public và có thể dùng cart/checkout dạng guest. | `bigbike-web/app/page.tsx`, `bigbike-web/lib/utils/routes.ts`, `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/config/SecurityConfig.java`, `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/catalog/CatalogController.java`, `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/checkout/CheckoutController.java` | `CONFIRMED_FROM_CODE` |
| Customer | Đăng ký/đăng nhập, quản lý tài khoản, địa chỉ, đơn hàng, đổi trả; mobile và web routes đều có account/order flows. | `bigbike_mobile/lib/core/router/app_router.dart`, `bigbike-web/lib/utils/routes.ts`, `bigbike-backend/docs/PHASE_1D_CUSTOMER_AUTH_REPORT.md`, `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/config/SecurityConfig.java` | `CONFIRMED_FROM_CODE` |
| Admin | Vận hành hệ thống qua admin dashboard: sản phẩm, category, brand, content, orders, customers, media, coupons, redirects, menus, sliders, shipping, reviews, admin users, settings. | `bigbike-admin/README.md`, `bigbike-admin/src/lib/adminApi.js`, `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/admin/**` | `CONFIRMED_FROM_CODE` |
| Staff / Manager / Content Editor / Viewer | Các profile role/permission trong mock/admin UI; mức business permission thực tế cần kiểm tra sâu trong backend role model. | `bigbike-admin/README.md`, `bigbike-admin/src/lib/adminApi.js`, `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/persistence/repository/auth/AdminRoleJpaRepository.java` | `INFERRED_FROM_STRUCTURE` |
| Super Admin | Admin role cấp cao được admin README nhắc trong mock profile; cần verify quyền thực tế và role seed/backend enforcement. | `bigbike-admin/README.md` | `NEEDS_VERIFICATION` |
| System / Backend | Enforce validation, auth, permission, checkout/order creation, catalog/content/admin APIs, rate limiting, security headers, persistence. | `bigbike-backend/pom.xml`, `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/config/SecurityConfig.java`, `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/**`, `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/**` | `CONFIRMED_FROM_CODE` |
| Third-party / Infrastructure Services | PostgreSQL database, MinIO media storage, optional transactional email, optional Sentry/GTM config, Docker Compose orchestration. Không thấy payment gateway/shipping carrier provider production flow được xác nhận. | `docker-compose.yaml`, `bigbike-backend/pom.xml`, `bigbike-web/package.json` | `CONFIRMED_FROM_CODE` cho Postgres/MinIO/email config; `NEEDS_VERIFICATION` cho payment/shipping third-party production integrations |
| AI Agent / Developer | Đọc AGENTS.md, README, design system, OpenAPI/phase reports trước khi thay đổi code; không tự bịa business rule. | `AGENTS.md`, `README.md` | `CONFIRMED_FROM_CODE` |

## 5. System Components

| Component | Purpose | Main responsibilities | Evidence source | Status |
|---|---|---|---|---|
| `bigbike-web` | Public SEO-first commerce website | Homepage, product discovery, category/brand browsing, product detail, cart, checkout, account/auth routes, article/content pages, SEO metadata/JSON-LD, redirect handling/revalidate hooks. | `README.md`, `bigbike-web/package.json`, `bigbike-web/app/page.tsx`, `bigbike-web/lib/utils/routes.ts`, `docker-compose.yaml` | `CONFIRMED_FROM_CODE` |
| `bigbike-admin` | Internal admin dashboard | Admin SPA for products, categories, brands, content, orders, customers, media, coupons, redirects, menus, sliders, shipping, reviews, admin users, settings. Includes permission-aware routes and mock fallback mode. | `README.md`, `bigbike-admin/README.md`, `bigbike-admin/package.json`, `bigbike-admin/src/lib/adminApi.js`, `bigbike-admin/nginx.conf` | `CONFIRMED_FROM_CODE` |
| `bigbike-backend` | Spring Boot REST API/backend service | Public/admin/customer APIs, validation, auth/security, permission checks, checkout/order/cart logic, persistence, content/catalog/admin operations, media integration, WordPress migration utilities. | `README.md`, `bigbike-backend/pom.xml`, `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/**`, `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/config/SecurityConfig.java`, `bigbike-backend/docs/*.md` | `CONFIRMED_FROM_CODE` |
| `bigbike_mobile` | Flutter mobile companion | Mobile app routes for home, products, product detail, categories, brands, cart, checkout, auth, account, orders, returns, search, articles, contact, CMS pages. | `bigbike_mobile/pubspec.yaml`, `bigbike_mobile/lib/core/router/app_router.dart` | `CONFIRMED_FROM_CODE` |
| PostgreSQL | Primary relational database | Backend persistence via JPA/Flyway; Docker Compose provisions Postgres. | `docker-compose.yaml`, `bigbike-backend/pom.xml`, `bigbike-backend/src/main/resources/db/migration/**` | `CONFIRMED_FROM_CODE` |
| MinIO / S3-compatible media storage | Media/object storage | Docker Compose provisions MinIO; backend includes MinIO SDK/config; media URL/base config exists. | `docker-compose.yaml`, `bigbike-backend/pom.xml`, `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/config/MinioConfig.java`, `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/config/MinioProperties.java` | `CONFIRMED_FROM_CODE` |
| Design System | Brand/UI source of truth | Brand context, colors, typography, logo/assets, icon set, UI kit/prototype references. | `Bigbike Design System/README.md`, `Bigbike Design System/colors_and_type.css`, `README.md`, `AGENTS.md` | `CONFIRMED_FROM_CODE` |
| WordPress migration tooling | Migration/reference layer from legacy WordPress/WooCommerce | ETL scripts, backend migration mappers/importers/redirect resolver, SEO redirect support. | `README.md`, `bigbike-web/package.json`, `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/migration/wordpress/**`, `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/internal/InternalRedirectController.java` | `CONFIRMED_FROM_CODE` |
| Docker Compose stack | Local/full stack orchestration | Runs Postgres, MinIO, backend, web, admin and init revalidation job. | `docker-compose.yaml` | `CONFIRMED_FROM_CODE` |
| Transactional email | Email capability/config boundary | Backend includes mail dependency/templates/config env placeholders. Actual production SMTP behavior needs runtime/config verification. | `bigbike-backend/pom.xml`, `docker-compose.yaml`, `bigbike-backend/target/classes/templates/email/layout.html` | `INFERRED_FROM_STRUCTURE` |

## 6. Core Business Capabilities

| Capability | Evidence | Status | Notes |
|---|---|---|---|
| Product browsing | Public product/category/brand endpoints and web/mobile routes. | `CONFIRMED_FROM_CODE` | `CatalogController`, `bigbike-web/lib/utils/routes.ts`, `bigbike_mobile/lib/core/router/app_router.dart`. |
| Product detail / PDP | Public product detail route and product-by-slug API. | `CONFIRMED_FROM_CODE` | `/product/:slug`, `/api/v1/products/{slug}`. |
| Category/brand browsing | Public routes and backend list/detail APIs. | `CONFIRMED_FROM_CODE` | `/danh-muc-san-pham`, `/brands`, `CatalogController`. |
| Search | Backend public search endpoints and web/mobile search routes. | `CONFIRMED_FROM_CODE` | `SecurityConfig`, `PublicSearchController`, mobile `/tim-kiem`. |
| Cart | Backend cart controller/DTOs present; web/mobile cart routes exist. | `CONFIRMED_FROM_CODE` | `CartController`, `bigbike-web/lib/utils/routes.ts`, mobile `/gio-hang`. |
| Checkout | Checkout, quick-buy, checkout options endpoints and report exist; web/mobile checkout routes exist. | `CONFIRMED_FROM_CODE` | `CheckoutController`, `PHASE_1F_CHECKOUT_API_REPORT.md`. |
| Guest checkout | Phase 1F report says guest and authenticated customer flows supported. | `CONFIRMED_FROM_CODE` | `PHASE_1F_CHECKOUT_API_REPORT.md`, `CheckoutController`. |
| Customer auth/session | Register/login/refresh/logout/me with cookie session + CSRF foundation. | `CONFIRMED_FROM_CODE` | `PHASE_1D_CUSTOMER_AUTH_REPORT.md`, `SecurityConfig`. |
| Customer account/address/order | Web/mobile routes and backend customer/order controllers exist. | `CONFIRMED_FROM_CODE` | `bigbike_mobile/lib/core/router/app_router.dart`, `SecurityConfig`, `CustomerController`, `CustomerAddressController`, `CustomerOrderController`. |
| Order lookup | Public order lookup endpoint present. | `CONFIRMED_FROM_CODE` | `OrderLookupController`, `SecurityConfig`. |
| Return/exchange management | Admin return controller/DTOs and customer returns mobile route exist. | `INFERRED_FROM_STRUCTURE` | Need verify full business rules/state transitions. |
| Product management | Admin routes/API client/backend admin catalog controller support product list/create/update/publish/soft-delete. | `CONFIRMED_FROM_CODE` | `bigbike-admin/README.md`, `adminApi.js`, `AdminCatalogController`. |
| Category/brand management | Admin routes/API client/backend admin catalog controller support category/brand CRUD. | `CONFIRMED_FROM_CODE` | `bigbike-admin/README.md`, `adminApi.js`, `AdminCatalogController`. |
| Order management | Admin order routes/API client/backend controller exist with status/payment/note flows. | `CONFIRMED_FROM_CODE` | `bigbike-admin/README.md`, `adminApi.js`, `AdminOrderController`. |
| Customer management | Admin customer route/API client/backend controller exists. | `CONFIRMED_FROM_CODE` | `bigbike-admin/README.md`, `adminApi.js`, `AdminCustomerController`. |
| Inventory/stock management | Admin inventory controller/DTOs and repository/entity names exist. | `CONFIRMED_FROM_CODE` | `AdminInventoryController`, `StockMovementResponse`, `StockMovementSerialEntity`. |
| Media management | Admin media route/API/backend controller and MinIO dependency/config exist. | `CONFIRMED_FROM_CODE` | `AdminMediaController`, `bigbike-admin/README.md`, `bigbike-backend/pom.xml`, `docker-compose.yaml`. |
| Content/articles/pages | Public/content admin controllers and web/mobile article/content routes exist. | `CONFIRMED_FROM_CODE` | `ContentController`, `AdminContentController`, `bigbike-web/app/page.tsx`, mobile `/tin-tuc`, `/:slug`. |
| SEO metadata / JSON-LD | Web homepage builds metadata and JSON-LD; route helpers canonical URL exist. | `CONFIRMED_FROM_CODE` | `bigbike-web/app/page.tsx`, `bigbike-web/lib/utils/routes.ts`. |
| Menu/slider/home video management | Admin/public controllers and reports exist; homepage consumes sliders/home videos. | `CONFIRMED_FROM_CODE` | `AdminMenuController`, `PublicMenuController`, `AdminSliderController`, `PublicSliderController`, `AdminHomeVideoController`, `PublicHomeVideoController`, `PHASE_1J...`. |
| Settings management | Admin/public settings endpoints and report exist. | `CONFIRMED_FROM_CODE` | `AdminSettingsController`, `PublicSettingsController`, `PHASE_1J...`. |
| Coupon management | Admin coupon endpoints exist. Coupon-cart/checkout integration explicitly deferred in report. | `CONFIRMED_FROM_CODE` for admin coupon management; `NEEDS_VERIFICATION` for commerce discount application | `PHASE_1J...`. |
| Shipping admin/config | Admin shipping route/controller exists; checkout shipping method resolution exists. | `CONFIRMED_FROM_CODE` for internal shipping methods; `NEEDS_VERIFICATION` for third-party carrier integration | `AdminShippingController`, `PHASE_1F...`. |
| Reports/dashboard | Admin dashboard/report controllers and admin UI dependencies include Recharts/xlsx. | `CONFIRMED_FROM_CODE` | `AdminDashboardController`, `AdminReportController`, `bigbike-admin/package.json`. |
| Admin users/roles/permissions | Admin user/role controllers/repositories and route permissions exist. | `CONFIRMED_FROM_CODE` | `AdminAdminUsersController`, `AdminRolesController`, `AdminRoleJpaRepository`, `bigbike-admin/README.md`, `SecurityConfig`. |
| Payment provider integration | Checkout supports COD/BACS status mapping; no confirmed online payment provider integration seen in audited files. | `NEEDS_VERIFICATION` | `PHASE_1F...` only confirms COD/BACS, not external payment gateway. |
| Third-party shipping provider integration | No confirmed GHN/GHTK/ViettelPost integration in audited evidence. | `NEEDS_VERIFICATION` | Admin shipping exists but carrier integration not confirmed. |

## 7. High-level Business Workflows

### 7.1 Product publish workflow

Admin can list product records, create/update product data, update publish status and soft-delete product records. Backend enforces admin permission checks such as `products.read` and `products.update`. Public catalog endpoints expose product browsing by list/detail and product snapshot for price/stock refresh.

**Evidence:** `AdminCatalogController`, `CatalogController`, `bigbike-admin/src/lib/adminApi.js`, `bigbike-admin/README.md`

**Status:** `CONFIRMED_FROM_CODE`

### 7.2 Customer browsing and purchase workflow

Guest/customer browses homepage, products, categories, brands, articles/content and search. Customer can add items to cart, checkout from cart or use quick-buy. Checkout creates order summary after validating cart/items/address/payment/shipping. Phase 1F documents guest and authenticated customer flows.

**Evidence:** `bigbike-web/app/page.tsx`, `bigbike-web/lib/utils/routes.ts`, `bigbike_mobile/lib/core/router/app_router.dart`, `CartController`, `CheckoutController`, `PHASE_1F_CHECKOUT_API_REPORT.md`

**Status:** `CONFIRMED_FROM_CODE`

### 7.3 Customer account workflow

Customer can register/login/refresh/logout and access protected account routes such as profile, addresses, orders and returns. Customer session uses cookies and CSRF protection according to the backend phase report.

**Evidence:** `PHASE_1D_CUSTOMER_AUTH_REPORT.md`, `SecurityConfig`, `bigbike_mobile/lib/core/router/app_router.dart`, `bigbike-web/lib/utils/routes.ts`

**Status:** `CONFIRMED_FROM_CODE`

### 7.4 Admin order processing workflow

Admin can access order list/detail, update order status, fetch allowed transitions, update payment status and add order notes via admin API client. Backend admin order controller exists; deeper state-machine correctness needs separate workflow/state-machine documentation.

**Evidence:** `bigbike-admin/src/lib/adminApi.js`, `AdminOrderController`, `AdminOrderDetailResponse`, `UpdateOrderStatusRequest`, `UpdatePaymentStatusRequest`

**Status:** `CONFIRMED_FROM_CODE` for API presence; `NEEDS_VERIFICATION` for full business process completeness.

### 7.5 Content/SEO publishing workflow

Admin content APIs support articles/pages; public web consumes articles and pages. Homepage builds SEO metadata, JSON-LD and internal links. Redirect/migration support exists for legacy WordPress URL handling.

**Evidence:** `AdminContentController`, `ContentController`, `bigbike-web/app/page.tsx`, `bigbike-web/lib/utils/routes.ts`, `InternalRedirectController`, `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/migration/wordpress/**`

**Status:** `CONFIRMED_FROM_CODE`

### 7.6 Media management workflow

Admin media APIs and MinIO/S3-compatible dependency/config exist. This indicates media management/storage capability. However one backend report lists `Media uploads` as out of scope for that specific phase, so actual upload completeness must be verified from current controller/service/tests.

**Evidence:** `AdminMediaController`, `AdminMediaDetailResponse`, `bigbike-backend/pom.xml`, `docker-compose.yaml`, `PHASE_1J_ADMIN_SETTINGS_MENU_COUPON_API_REPORT.md`

**Status:** `CONFIRMED_FROM_CODE` for media module presence; `NEEDS_VERIFICATION` for full upload workflow completeness.

### 7.7 Menu/settings/coupon operational workflow

Admin can manage site settings, menus/menu items and coupons. Public settings and public menus are exposed for frontend consumption. Coupon-cart integration was explicitly deferred in the phase report.

**Evidence:** `PHASE_1J_ADMIN_SETTINGS_MENU_COUPON_API_REPORT.md`, `AdminSettingsController`, `PublicSettingsController`, `AdminMenuController`, `PublicMenuController`, `AdminCouponController`

**Status:** `CONFIRMED_FROM_CODE` for settings/menu/coupon admin APIs; `NEEDS_VERIFICATION` for coupon application in checkout.

## 8. Current Project Scope

### Confirmed in repository

- Monorepo-style BigBike project with `bigbike-web`, `bigbike-admin`, `bigbike-backend`, `bigbike_mobile`, `Bigbike Design System`, root README/AGENTS and Docker Compose.
- Public web: Next.js 16.2.4 + React 19.2.4 + TypeScript.
- Admin: Vite 8 + React 19.2.4 SPA.
- Backend: Spring Boot 4.0.5, Java 17, Maven, JPA, Flyway, Security, Mail, WebSocket, MinIO, Bucket4j, PostgreSQL runtime dependency.
- Mobile: Flutter app with Riverpod, GoRouter, Dio/cookies/secure storage and main commerce/account routes.
- Docker Compose: Postgres, MinIO, backend, web, admin and web init/revalidate service.
- Public catalog/content/search/cart/checkout/customer/order APIs exist.
- Admin APIs exist for catalog, content, orders, customers, inventory, media, reports, returns, reviews, roles, admin users, settings, menus, coupons, sliders, shipping, redirects, audit logs, POS.
- Customer auth/session/CSRF documented by backend phase report.
- Checkout/quick-buy/options documented by backend phase report.
- Settings/menu/coupon APIs documented by backend phase report.
- WordPress migration/redirect support exists.
- Design system and brand source-of-truth exists.

### Inferred from structure

- System is a migration/rewrite from legacy WordPress/WooCommerce to custom Next.js + Spring Boot stack.
- Email sending is intended for transactional flows, based on mail dependency, email template path and Docker/env config, but production sending must be verified.
- Admin report/dashboard likely supports analytics/export based on controllers and admin dependencies, but report semantics need deeper verification.
- POS module exists by controller name, but business purpose and frontend support need verification.

### Needs verification

- Current build/test status of all apps on latest `main` was not executed during this documentation update.
- Production readiness of auth, admin role/permission model and all state transitions.
- Full media upload lifecycle, including upload validation, storage, public URL and delete behavior.
- Coupon application during cart/checkout is not confirmed; phase report explicitly says coupon-cart integration was deferred.
- Payment provider integration beyond COD/BACS is not confirmed.
- Third-party shipping carrier integration is not confirmed.
- Return/exchange business rules and state machine completeness.
- Whether `bigbike_mobile` is production scope or companion/prototype scope; code exists but root README structure did not include it in the repository tree.
- Whether `docs/DECISIONS.md` exists; root README/AGENTS mention it, but it was not found by direct fetch during this audit.

### Not found / out of current scope

- No confirmed external online payment gateway integration in audited evidence.
- No confirmed GHN/GHTK/ViettelPost production integration in audited evidence.
- No confirmed complete documentation set for `BUSINESS_PROCESS.md`, `MODULE_CATALOG.md`, `WORKFLOW_OVERVIEW.md`, `BUSINESS_RULES.md`, `STATE_MACHINES.md`, `ACCEPTANCE_CRITERIA.md`, `ARCHITECTURE.md`, `DATA_CONTRACT.md`, `API_CONTRACT.md`, `PERMISSION_MATRIX.md`, `TRACEABILITY_MATRIX.md` at root `docs/business` during this audit.
- No runtime deployment evidence proving production health was collected for this document.

## 9. Out of Scope / Not Confirmed

The following areas are not confirmed as complete from the audited evidence:

- Production readiness of the entire system.
- Full admin RBAC matrix and permission coverage for every endpoint/action.
- Complete order/payment/fulfillment/return state machines.
- Coupon usage tracking, customer limits and checkout discount calculation.
- External payment gateway integration.
- External shipping carrier integration.
- Complete media upload/processing workflow.
- Full SEO migration coverage from WordPress, including every redirect and historical URL.
- Production email deliverability and email verification/password reset runtime behavior.
- Mobile app parity with public web and backend.
- POS business workflow.

## 10. Relationship With Other Documentation

| Document | Relationship | Current status from audit |
|---|---|---|
| `README.md` | Root project overview, stack, setup, rules and high-level business context. | Existing |
| `AGENTS.md` | Operating instructions for AI coding agents; must be read before broad changes. | Existing |
| `Bigbike Design System/README.md` | Brand context, design direction, copy rules, typography/color/iconography. | Existing |
| `bigbike-admin/README.md` | Admin app overview, routes and permissions. | Existing |
| `bigbike-backend/docs/PHASE_1D_CUSTOMER_AUTH_REPORT.md` | Customer auth/session/CSRF implementation report. | Existing |
| `bigbike-backend/docs/PHASE_1F_CHECKOUT_API_REPORT.md` | Checkout/quick-buy/options implementation report. | Existing |
| `bigbike-backend/docs/PHASE_1J_ADMIN_SETTINGS_MENU_COUPON_API_REPORT.md` | Settings/menu/coupon admin API report. | Existing |
| `docs/DECISIONS.md` | Architecture/product decisions. Root README/AGENTS mention it, but direct fetch returned not found during this audit. | `NEEDS_VERIFICATION` |
| `BUSINESS_PROCESS.md` | Should define business-level processes end-to-end. | Planned documentation / not found in audited paths |
| `MODULE_CATALOG.md` | Should catalogue modules, ownership, UI/API/data/test evidence. | Planned documentation / not found in audited paths |
| `WORKFLOW_OVERVIEW.md` | Should describe cross-component workflows. | Planned documentation / not found in audited paths |
| `BUSINESS_RULES.md` | Should define business rules and rule ownership. | Planned documentation / not found in audited paths |
| `STATE_MACHINES.md` | Should define order/payment/product/content/return state transitions. | Planned documentation / not found in audited paths |
| `ACCEPTANCE_CRITERIA.md` | Should define completion criteria per module/workflow. | Planned documentation / not found in audited paths |
| `ARCHITECTURE.md` | Should describe architecture, runtime boundaries, deployment, scaling and integrations. | Planned documentation / not found in audited paths |
| `DATA_CONTRACT.md` | Should define canonical data models and cross-app field contracts. | Planned documentation / not found in audited paths |
| `API_CONTRACT.md` | Should summarize backend API contracts or reference OpenAPI. | Planned documentation / not found in audited paths |
| `PERMISSION_MATRIX.md` | Should map roles/permissions/actions/routes/endpoints. | Planned documentation / not found in audited paths |
| `TRACEABILITY_MATRIX.md` | Should connect business requirements -> module -> API -> data -> tests. | Planned documentation / not found in audited paths |

## 11. Evidence Summary

| Area | Evidence Path | What It Indicates | Confidence |
|---|---|---|---|
| Root project summary | `README.md` | BigBike is motorcycle gear retail/D2C commerce platform with public web, admin and backend. | High |
| Agent operating rules | `AGENTS.md` | AI agents must respect business rules, API/data contracts, design system and repo boundaries. | High |
| Public web package | `bigbike-web/package.json` | Public web uses Next.js 16.2.4, React 19.2.4, TypeScript, Tailwind 4, React Query, Sentry, Vitest. | High |
| Public web homepage | `bigbike-web/app/page.tsx` | Homepage consumes sliders, categories, articles, brands, settings, products, home videos; includes SEO metadata/JSON-LD. | High |
| Public web route helpers | `bigbike-web/lib/utils/routes.ts` | Confirms routes for product, categories, brands, articles, cart, checkout, order confirm, auth and account. | High |
| Admin package | `bigbike-admin/package.json` | Admin uses Vite 8, React 19, React Query, TipTap, Recharts, xlsx, zod. | High |
| Admin README | `bigbike-admin/README.md` | Lists admin routes and permissions; confirms internal admin dashboard purpose and mock mode. | High |
| Admin API client | `bigbike-admin/src/lib/adminApi.js` | Confirms admin API interactions for auth, products, categories, brands, content, redirects, orders, customers and more. | High |
| Backend package | `bigbike-backend/pom.xml` | Confirms Spring Boot 4.0.5, Java 17, JPA, Flyway, Security, Mail, WebSocket, MinIO, Bucket4j, PostgreSQL. | High |
| Backend public catalog | `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/catalog/CatalogController.java` | Confirms public products/categories/brands list/detail APIs and product snapshot. | High |
| Backend checkout | `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/checkout/CheckoutController.java` | Confirms checkout, quick-buy and checkout options endpoints. | High |
| Backend admin catalog | `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/admin/AdminCatalogController.java` | Confirms admin product/category/brand read/mutation/publish/soft-delete endpoints and permission checks. | High |
| Backend security | `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/config/SecurityConfig.java` | Confirms public/protected endpoint boundaries, admin role requirement, customer role, rate limiting/security filters. | High |
| Backend compile input list | `bigbike-backend/target/maven-status/maven-compiler-plugin/compile/default-compile/inputFiles.lst` | Shows broad backend file presence: admin controllers, DTOs, config, domain, commerce/customer/content/catalog classes. | Medium |
| Customer auth report | `bigbike-backend/docs/PHASE_1D_CUSTOMER_AUTH_REPORT.md` | Documents customer auth/session/CSRF endpoints, tests and remaining risks. | High for phase scope |
| Checkout report | `bigbike-backend/docs/PHASE_1F_CHECKOUT_API_REPORT.md` | Documents checkout/quick-buy/options endpoints, order status/payment mapping and tests for that phase. | High for phase scope |
| Settings/menu/coupon report | `bigbike-backend/docs/PHASE_1J_ADMIN_SETTINGS_MENU_COUPON_API_REPORT.md` | Documents settings/menu/coupon admin/public APIs and notes coupon-cart integration deferred. | High for phase scope |
| Docker Compose | `docker-compose.yaml` | Confirms Postgres, MinIO, backend, web, admin and web init services with healthchecks. | High |
| Mobile package | `bigbike_mobile/pubspec.yaml` | Confirms Flutter mobile companion with Riverpod, GoRouter, Dio/cookie/secure storage. | High |
| Mobile router | `bigbike_mobile/lib/core/router/app_router.dart` | Confirms mobile routes for home, products, cart, checkout, auth, account, orders, returns, search, articles, contact and content. | High |
| Design system | `Bigbike Design System/README.md` | Confirms brand context, visual identity, assets, UI kit and BigBike retail positioning. | High |
| WordPress migration | `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/migration/wordpress/**`, `bigbike-web/package.json` ETL scripts | Indicates legacy WordPress/WooCommerce migration and redirect tooling. | Medium-High |

## 12. Known Ambiguities / Needs Verification

1. `docs/DECISIONS.md` is referenced by `README.md` and `AGENTS.md`, but direct fetch returned not found during this audit. Verify whether it exists on another branch/path or was planned but not committed.
2. `bigbike_mobile` exists and has Flutter routes, but root README repository tree does not list it. Clarify whether mobile is official production scope, companion scope or experimental scope.
3. Root README says `bigbike-backend/src/main/resources/openapi/bigbike-openapi.json` is the full API contract. This overview did not fully parse OpenAPI; API contract should be verified separately.
4. Customer auth reports phase completion, but root README mentions production auth provider is not fully implemented in this phase. Production auth readiness needs explicit verification.
5. Admin permission model exists through route permissions and backend checks, but a full permission matrix by role/action/endpoint is not present in this overview.
6. Checkout supports COD/BACS per phase report. External payment gateway integration is not confirmed.
7. Shipping methods exist in checkout/admin, but third-party carrier integration is not confirmed.
8. Coupon admin API exists, but coupon application during cart/checkout was explicitly deferred in the Phase 1J report.
9. Media management exists, MinIO exists, and admin media APIs exist. Full upload workflow needs deeper verification because one phase report listed media uploads as out of scope for that phase.
10. Return/exchange modules/controllers exist, but return business rules and state transitions need a dedicated workflow/state-machine audit.
11. WordPress migration packages and redirect support exist, but full SEO migration coverage and redirect completeness need a separate SEO migration document.
12. No build/test/runtime command was executed as part of this documentation update, so do not treat this file as current green-build evidence.
13. Some test reports and `target/` artifacts are present in repo, but committed artifacts are not a substitute for a fresh CI/build run.
14. Design system README references Next.js 15 in its source note, while `bigbike-web/package.json` uses Next.js 16.2.4. Treat package config as current technical evidence and verify docs drift.

## 13. Status Labels Used

- `CONFIRMED_FROM_CODE`: Đã thấy bằng chứng trực tiếp trong source/config/docs hiện có.
- `INFERRED_FROM_STRUCTURE`: Suy luận hợp lý từ cấu trúc repo, tên module, route, dependency hoặc file path, nhưng chưa đủ bằng chứng để kết luận hoàn chỉnh.
- `NEEDS_VERIFICATION`: Cần kiểm tra thêm bằng build/test/runtime, đọc sâu service/tests, hoặc xác nhận business.
- `NOT_FOUND_IN_REPO`: Chưa thấy trong repo hiện tại qua audit paths/search/fetch đã thực hiện.

## Audit Notes

Documentation này được tạo chỉ bằng thao tác đọc/inspect repository qua GitHub connector. Không chạy migration, seed, deploy, refactor hoặc command có side effect. Không sửa business logic hoặc source code ứng dụng.
