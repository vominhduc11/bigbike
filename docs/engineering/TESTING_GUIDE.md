# BigBike Testing Guide

Audit date: 2026-05-04

## 1. Document Purpose

File này mô tả test strategy, quality gates và cách kiểm thử BigBike theo evidence thực tế trong repo.

Audience chính:

- Developer cần biết chạy build/lint/test ở đâu.
- Tester/QA cần biết workflow/module/rule/state nào phải test.
- AI agent cần biết release gate tối thiểu trước khi đụng vào code.
- CI/CD cần biết command nào là gate thật, command nào mới chỉ là khuyến nghị.

Nguyên tắc:

- Không tự bịa script.
- Command nào có trong `package.json`, `pom.xml`, Maven wrapper, CI config hoặc config test thì ghi theo evidence.
- Command nào là đề xuất nhưng repo chưa implement script/job thì ghi `RECOMMENDED_NOT_IMPLEMENTED`.
- Test report cũ trong repo chỉ là `HISTORICAL_EVIDENCE`, không phải pass hiện tại.
- Task tạo file này không chạy test/build/lint, nên không được claim pass hiện tại. Đọc log cũ rồi tuyên bố release-ready là kiểu thấy ảnh chụp bình xăng đầy năm ngoái rồi lái xe đi xuyên tỉnh.
- Không đưa secret/token/password/private key/env value nhạy cảm vào tài liệu.

## 2. Testing Status Labels

| Label | Meaning |
|---|---|
| `CONFIRMED_SCRIPT` | Command/script tồn tại trong repo config như `package.json`, Maven wrapper/pom hoặc CI workflow. |
| `CONFIRMED_TEST_FILES` | Có test files hoặc test source evidence trong repo. |
| `HISTORICAL_EVIDENCE` | Có report/output cũ trong repo, nhưng không chạy lại trong audit này. Không được xem là pass hiện tại. |
| `RECOMMENDED_NOT_IMPLEMENTED` | Nên có gate/test/command, nhưng repo chưa có script/job rõ hoặc chưa wire vào CI. |
| `NEEDS_VERIFICATION` | Cần kiểm tra thêm bằng audit sâu hơn hoặc chạy thực tế. |
| `NOT_FOUND_IN_REPO` | Không thấy evidence trong repo qua audit hiện tại. |
| `MISSING_TEST_COVERAGE` | Feature/rule/workflow có evidence code nhưng thiếu test tương ứng hoặc chưa thấy test evidence. |

## 3. Test / Quality Gate Summary

| Layer | Gate | Command / Evidence | Status | Notes |
|---|---|---|---|---|
| `bigbike-web` | Install dependencies | `npm ci` in `.github/workflows/ci.yml` | `CONFIRMED_SCRIPT` | CI web job installs dependencies. |
| `bigbike-web` | Lint | `npm run lint`; script maps to `eslint` in `bigbike-web/package.json` | `CONFIRMED_SCRIPT` | CI runs lint. No fresh output in this audit. |
| `bigbike-web` | Build | `npm run build`; script maps to `next build` | `CONFIRMED_SCRIPT` | CI runs build with backend URL env. No fresh output in this audit. |
| `bigbike-web` | Unit/component tests | `npm run test`; script maps to `vitest run` | `CONFIRMED_SCRIPT` | Script exists, but CI does not run it currently. Test file coverage needs verification. |
| `bigbike-web` | Coverage | `npm run test:coverage`; script maps to `vitest run --coverage` | `CONFIRMED_SCRIPT` | Vitest coverage config exists; CI does not run coverage. |
| `bigbike-web` | Vitest config | `vitest.config.ts`, `vitest.setup.ts` | `CONFIRMED_SCRIPT` | jsdom + Testing Library setup. |
| `bigbike-admin` | Install dependencies | `npm ci` in `.github/workflows/ci.yml` | `CONFIRMED_SCRIPT` | CI admin job installs dependencies. |
| `bigbike-admin` | Lint | `npm run lint`; script maps to `eslint .` | `CONFIRMED_SCRIPT` | CI runs lint. No fresh output in this audit. |
| `bigbike-admin` | Build | `npm run build`; script maps to `vite build` | `CONFIRMED_SCRIPT` | CI runs build with `VITE_USE_ADMIN_MOCK=false`. |
| `bigbike-admin` | Unit/component tests | No `test` script in `bigbike-admin/package.json` | `NOT_FOUND_IN_REPO` | Must not invent `npm test`. Add Vitest/RTL later if needed. |
| `bigbike-backend` | Maven wrapper | `bigbike-backend/mvnw` exists | `CONFIRMED_SCRIPT` | Maven wrapper is present. |
| `bigbike-backend` | Test/build gate | `./mvnw -B clean verify` in `.github/workflows/ci.yml` | `CONFIRMED_SCRIPT` | CI backend job runs Maven verify against PostgreSQL service. No fresh output in this audit. |
| `bigbike-backend` | Unit/integration/controller tests | `src/test/java/**` list in Maven testCompile input file | `CONFIRMED_TEST_FILES` | Multiple API/schema/service tests exist. |
| `bigbike-backend` | Historical surefire reports | `target/surefire-reports/*.txt/xml` examples | `HISTORICAL_EVIDENCE` | Reports are old committed artifacts, not current run result. |
| `bigbike_mobile` | Test dependency | `flutter_test` in `pubspec.yaml` | `CONFIRMED_SCRIPT` for dependency only | No custom test script or CI job found. |
| `bigbike_mobile` | Lint dependency | `flutter_lints` in `pubspec.yaml` | `CONFIRMED_SCRIPT` for dependency only | `flutter analyze` is recommended, not repo script/CI gate. |
| `bigbike_mobile` | Flutter test/build gate | `flutter test`, `flutter build apk` | `RECOMMENDED_NOT_IMPLEMENTED` | Conventional Flutter commands, but not repo script/CI job. |
| Docker/runtime | Compose runtime | `docker-compose.yaml` services, healthchecks, Docker builds in CI for web/admin/backend | `CONFIRMED_SCRIPT` / `NEEDS_VERIFICATION` | CI builds Docker images, but full compose smoke is not in CI. |
| CI/CD | GitHub Actions | `.github/workflows/ci.yml` | `CONFIRMED_SCRIPT` | Backend, web, admin jobs exist. Mobile/E2E/coverage missing. |
| E2E/smoke | Browser/API smoke | No Playwright/Cypress script found | `NOT_FOUND_IN_REPO` | Need smoke checklist or implement Playwright later. |

## 4. Public Web Testing

### Confirmed commands

Run from `bigbike-web`:

```bash
npm ci
npm run lint
npm run build
npm run test
npm run test:coverage
```

Evidence:

- `bigbike-web/package.json`
- `bigbike-web/vitest.config.ts`
- `bigbike-web/vitest.setup.ts`
- `.github/workflows/ci.yml`

Status:

| Gate | Command | Status | Notes |
|---|---|---|---|
| Install | `npm ci` | `CONFIRMED_SCRIPT` | Used by CI. |
| Lint | `npm run lint` | `CONFIRMED_SCRIPT` | CI gate exists. |
| Build | `npm run build` | `CONFIRMED_SCRIPT` | CI gate exists. |
| Unit/component test | `npm run test` | `CONFIRMED_SCRIPT` | Script exists but CI does not run it. |
| Watch test | `npm run test:watch` | `CONFIRMED_SCRIPT` | Local only. |
| Coverage | `npm run test:coverage` | `CONFIRMED_SCRIPT` | Script exists but CI does not run it. |

### SEO smoke tests required

| Area | Required Check | Current Status |
|---|---|---|
| Homepage metadata | Title/description/canonical/JSON-LD render correctly. | `RECOMMENDED_NOT_IMPLEMENTED` |
| Product detail metadata | PDP has canonical, product schema if implemented, no draft/private product visible. | `RECOMMENDED_NOT_IMPLEMENTED` |
| Category/brand pages | Canonical URL, indexability, product filtering. | `RECOMMENDED_NOT_IMPLEMENTED` |
| Article/page SEO | Metadata/canonical and published-only content. | `RECOMMENDED_NOT_IMPLEMENTED` |
| Redirects | Legacy URL redirect returns expected status/location. | `RECOMMENDED_NOT_IMPLEMENTED` |
| Sitemap/robots | Generated/served correctly if implemented. | `NEEDS_VERIFICATION` |

### Responsive checks required

| Area | Required Check | Current Status |
|---|---|---|
| Homepage | Desktop/tablet/mobile layout, hero/media safe rendering. | `RECOMMENDED_NOT_IMPLEMENTED` |
| Product listing | Filters/sort/search usable on mobile and desktop. | `RECOMMENDED_NOT_IMPLEMENTED` |
| Product detail | Gallery, price, add-to-cart/quick-buy, specs/content render cleanly. | `RECOMMENDED_NOT_IMPLEMENTED` |
| Cart/checkout | Forms, validation, payment/shipping selection, submitting state. | `RECOMMENDED_NOT_IMPLEMENTED` |
| Account pages | Orders/returns/address forms usable on mobile. | `RECOMMENDED_NOT_IMPLEMENTED` |

### Missing tests

| Missing Test | Risk | Status |
|---|---|---|
| Public route smoke tests | Build may pass but route can runtime-fail. | `MISSING_TEST_COVERAGE` |
| API error UI tests | Public pages may fail silently when backend fails. | `MISSING_TEST_COVERAGE` |
| SEO metadata snapshot tests | Migration can break canonical/meta without warning. | `MISSING_TEST_COVERAGE` |
| Product visibility tests | Draft/private/trash products could leak public. | `MISSING_TEST_COVERAGE` |
| Checkout form tests | Invalid form/double-submit behavior not guarded by frontend tests. | `MISSING_TEST_COVERAGE` |
| Accessibility smoke | Basic keyboard/aria/contrast regressions not gated. | `RECOMMENDED_NOT_IMPLEMENTED` |

## 5. Admin Testing

### Confirmed commands

Run from `bigbike-admin`:

```bash
npm ci
npm run lint
npm run build
npm run preview
```

Evidence:

- `bigbike-admin/package.json`
- `.github/workflows/ci.yml`
- `bigbike-admin/src/App.jsx`
- `bigbike-admin/src/lib/adminApi.js`

Status:

| Gate | Command | Status | Notes |
|---|---|---|---|
| Install | `npm ci` | `CONFIRMED_SCRIPT` | Used by CI. |
| Lint | `npm run lint` | `CONFIRMED_SCRIPT` | Used by CI. |
| Build | `npm run build` | `CONFIRMED_SCRIPT` | Used by CI. |
| Preview | `npm run preview` | `CONFIRMED_SCRIPT` | Local preview only. |
| Unit/component tests | None | `NOT_FOUND_IN_REPO` | No `test` script in admin package. |
| Coverage | None | `NOT_FOUND_IN_REPO` | No coverage script. |

### Route/module permission tests required

`bigbike-admin/src/App.jsx` contains route parsing, navigation definitions and route-level permission mapping. Required tests:

| Area | Positive Tests Required | Negative Tests Required | Current Status |
|---|---|---|---|
| Admin login/session | Authenticated user sees allowed modules. | Unauthenticated user sees login screen only. | `MISSING_TEST_COVERAGE` |
| Route permission guard | User with permission can open route. | User missing permission gets permission-denied state. | `MISSING_TEST_COVERAGE` |
| Navigation filtering | Menu shows only allowed items. | Menu hides disallowed module links. | `MISSING_TEST_COVERAGE` |
| Product/category/brand screens | List/detail/create routes render and call expected API. | Mutation hidden/blocked without update permission. | `MISSING_TEST_COVERAGE` |
| Order screens | Order list/detail/status/payment actions render with `orders.*`. | Missing `orders.write` cannot mutate. | `MISSING_TEST_COVERAGE` |
| Media/content/settings/coupon | Module screens map to correct API calls. | Missing write permission disables mutations. | `MISSING_TEST_COVERAGE` |
| WebSocket toast | Authenticated admin connects and handles new order event. | Invalid auth/token does not leak/admin-crash. | `NEEDS_VERIFICATION` |

### Missing tests

| Missing Test | Risk | Status |
|---|---|---|
| Admin component tests | Build does not verify UI logic/action states. | `MISSING_TEST_COVERAGE` |
| Admin API client contract tests | Frontend can drift from backend endpoint names. | `MISSING_TEST_COVERAGE` |
| Permission-denied tests | UI can expose actions incorrectly. | `MISSING_TEST_COVERAGE` |
| Mock/live mode tests | `VITE_USE_ADMIN_MOCK` behavior can mask broken backend integration. | `MISSING_TEST_COVERAGE` |
| Rich editor/media tests | Content/media regressions are likely and visually expensive. | `MISSING_TEST_COVERAGE` |

## 6. Backend Testing

### Maven commands from project evidence

Run from `bigbike-backend`:

```bash
./mvnw -B clean verify
```

Evidence:

- `.github/workflows/ci.yml` runs this command in backend job.
- `bigbike-backend/mvnw` exists.
- `bigbike-backend/pom.xml` includes Spring Boot test dependencies and Maven compiler plugin.

Recommended local commands:

| Command | Status | Notes |
|---|---|---|
| `./mvnw -B clean verify` | `CONFIRMED_SCRIPT` | Same as CI backend gate. |
| `./mvnw test` | `CONFIRMED_SCRIPT` | Maven lifecycle command supported by Maven wrapper/pom; not explicitly shown in CI. |
| `./mvnw -Dtest=Phase1FCheckoutApiTest test` | `RECOMMENDED_NOT_IMPLEMENTED` | Useful targeted run, but not a repo script. |

### Confirmed test files

Maven testCompile input evidence lists these groups:

| Test Group | Example Files | Status | Notes |
|---|---|---|---|
| Admin auth/security | `AdminAuthApiTest`, `AdminAuthSecurityTest`, `AuthProfileGuardTest` | `CONFIRMED_TEST_FILES` | Auth/security API tests exist. |
| Admin catalog/read/mutation | `AdminReadApiTest`, `AdminMutationApiTest`, `AdminMutationValidatorsTest` | `CONFIRMED_TEST_FILES` | Product/category/brand behavior partly covered. |
| Customer auth/cart/checkout/orders | `Phase1DCustomerAuthTest`, `Phase1ECartApiTest`, `Phase1FCheckoutApiTest`, `Phase1GOrderReadApiTest` | `CONFIRMED_TEST_FILES` | Core commerce API tests exist. |
| Admin orders/settings/inventory/returns/POS | `Phase1HAdminOrderApiTest`, `Phase1JAdminSettingsMenuCouponApiTest`, `Phase1KInventorySerialApiTest`, `Phase1LReturnsApiTest`, `Phase1MPosApiTest` | `CONFIRMED_TEST_FILES` | Important backend API tests exist. |
| WordPress migration | `Phase2A/B/C/D/E...` tests | `CONFIRMED_TEST_FILES` | Migration/import/rehearsal/media tests exist. |
| Schema/repository/service | `Phase1BSchemaTest`, `Phase1CCommerceSchemaTest`, `SliderRepositoryTest`, `PasswordServiceTest`, `WebRevalidationServiceTest` | `CONFIRMED_TEST_FILES` | Schema/service-level tests exist. |
| Public APIs | `HomepagePublicApiTest`, `PublicReadApiTest`, `SliderApiTest` | `CONFIRMED_TEST_FILES` | Public read tests exist. |

Evidence path: `bigbike-backend/target/maven-status/maven-compiler-plugin/testCompile/default-testCompile/inputFiles.lst`.

### Historical test reports

| Report | Result in Report | Status | Notes |
|---|---|---|---|
| `target/surefire-reports/com.bigbike.bigbike_backend.api.Phase1FCheckoutApiTest.txt` | `Tests run: 26, Failures: 0, Errors: 0, Skipped: 0` | `HISTORICAL_EVIDENCE` | Old report committed in repo; not current run. |
| `target/surefire-reports/com.bigbike.bigbike_backend.api.Phase2D1StagingImportRehearsalTest.txt` | `Tests run: 20, Failures: 0, Errors: 0, Skipped: 0` | `HISTORICAL_EVIDENCE` | Old report committed in repo; not current run. |
| `target/surefire-reports/*.xml` | XML reports exist for at least some tests. | `HISTORICAL_EVIDENCE` | Must not claim current pass. |

### Required backend test types

| Test Type | Required Scope | Current Status |
|---|---|---|
| Unit tests | Pure validators, mappers, policy services, generators. | `CONFIRMED_TEST_FILES` / `NEEDS_VERIFICATION` |
| Controller tests | Public/customer/admin API status, response envelope, validation errors. | `CONFIRMED_TEST_FILES` |
| Service/business rule tests | Checkout, order/payment transition, inventory, returns, media, content. | `CONFIRMED_TEST_FILES` partially; gaps remain. |
| Security/RBAC tests | Guest/customer/admin boundary, permission denied, CSRF/session. | `CONFIRMED_TEST_FILES` partially; gaps remain. |
| State transition tests | Product/order/payment/return/media/admin user transitions. | `MISSING_TEST_COVERAGE` for full transition matrix. |
| Integration tests | DB/Flyway/PostgreSQL/H2/API integration. | `CONFIRMED_TEST_FILES`; CI uses PostgreSQL service. |
| Contract tests | OpenAPI/API shape, error shape, pagination/sort/filter. | `CONFIRMED_TEST_FILES` partially. |

### Missing backend tests

| Area | Missing Coverage | Status |
|---|---|---|
| Product publish state matrix | Every allowed/forbidden product transition. | `MISSING_TEST_COVERAGE` |
| Order state matrix | Every allowed/forbidden order transition, timestamps, idempotency. | `MISSING_TEST_COVERAGE` |
| Payment/refund state matrix | Partial/full refund, invalid refund, terminal states. | `MISSING_TEST_COVERAGE` |
| Checkout concurrency | Same SKU ordered concurrently must not oversell. | `RECOMMENDED_NOT_IMPLEMENTED` |
| Product-level stock movement symmetry | Stock movement behavior for product-level non-variant stock. | `NEEDS_VERIFICATION` |
| Public settings sanitization | Public settings endpoint must never leak sensitive config. | `MISSING_TEST_COVERAGE` |
| Upload security | MIME spoofing/content sniffing, file size boundary. | `MISSING_TEST_COVERAGE` |
| WebSocket auth/events | STOMP auth, event delivery and unauthorized connect rejection. | `MISSING_TEST_COVERAGE` |
| External webhook | Payment webhook signature/idempotency if implemented later. | `NOT_FOUND_IN_REPO` |

## 7. Mobile Testing

`bigbike_mobile` exists and `pubspec.yaml` includes:

- `flutter_test`
- `flutter_lints`
- `go_router`
- `dio`, cookies/storage packages

### Commands

Run from `bigbike_mobile`:

| Gate | Command | Status | Notes |
|---|---|---|---|
| Dependency install | `flutter pub get` | `RECOMMENDED_NOT_IMPLEMENTED` | Conventional Flutter command; no repo script/CI job found. |
| Analyze/lint | `flutter analyze` | `RECOMMENDED_NOT_IMPLEMENTED` | `flutter_lints` dependency exists, but no CI job/script found. |
| Unit/widget tests | `flutter test` | `RECOMMENDED_NOT_IMPLEMENTED` | `flutter_test` dependency exists; no test files found by audit. |
| Android build | `flutter build apk --release` or AAB release build | `RECOMMENDED_NOT_IMPLEMENTED` | No CI mobile build job found. |
| iOS build | `flutter build ios` | `RECOMMENDED_NOT_IMPLEMENTED` | Depends on Mac runner; no CI job found. |

### Mobile route/smoke required

| Route Area | Required Smoke | Status |
|---|---|---|
| Public browse | Home/product/category/brand/article/search routes load. | `RECOMMENDED_NOT_IMPLEMENTED` |
| Cart | Add/update/remove/clear coupon/cart item flows. | `RECOMMENDED_NOT_IMPLEMENTED` |
| Checkout | Auth guard, checkout options, submit success/error. | `RECOMMENDED_NOT_IMPLEMENTED` |
| Auth/account | Login/register/forgot/profile/address/order/returns. | `RECOMMENDED_NOT_IMPLEMENTED` |
| Contact/content | Contact submit and CMS pages render. | `RECOMMENDED_NOT_IMPLEMENTED` |

## 8. Business Rule Test Requirements

Source: `docs/business/BUSINESS_RULES.md`.

| Rule Area | Positive Tests Required | Negative Tests Required | Current Status |
|---|---|---|---|
| Product visibility | Public list/detail returns `PUBLISHED` product. | Draft/hidden/private/trash product is not public; quick-buy non-published product fails. | `MISSING_TEST_COVERAGE` / `NEEDS_VERIFICATION` |
| Product validation | Valid product create/update succeeds. | Missing required field, duplicate slug, invalid price/media/state fails. | `CONFIRMED_TEST_FILES` partially; matrix gaps remain. |
| Category/brand | Visible category/brand public reads succeed. | Hidden category/brand not public; circular/self-parent category fails; hide parent with visible child fails. | `MISSING_TEST_COVERAGE` |
| Cart | Valid add/update/remove/apply coupon succeeds. | Invalid quantity/product/coupon/cart ownership fails. | `CONFIRMED_TEST_FILES` partially. |
| Checkout | Valid COD/BACS checkout creates order/payment/shipping/stock side effects. | Empty cart, invalid address/payment/shipping, out-of-stock, price drift fail. | `CONFIRMED_TEST_FILES` + historical report; full fresh coverage needs verification. |
| Order processing | Valid status/payment/note/refund actions succeed. | Invalid order transition, invalid payment transition, refund unpaid/excess amount fails. | `CONFIRMED_TEST_FILES` partially; transition matrix incomplete. |
| Payment | Paid/partial/refund flows update order/payment consistently. | Unsupported method/webhook spoof/refund invalid amount fails. | `MISSING_TEST_COVERAGE`; webhook not found. |
| Shipping | Enabled method can be selected; exactly one method auto-selects. | Disabled/missing/invalid method fails; multiple methods without selected id fails. | `MISSING_TEST_COVERAGE` |
| Inventory | Checkout decrements; cancel/refund/return restores where intended. | Concurrent checkout cannot oversell; invalid adjust rejected. | `CONFIRMED_TEST_FILES` partially; concurrency recommended. |
| Return/refund | Customer creates return for own eligible order; admin transition succeeds. | Other-customer order return denied; invalid transition/refund invalid fails. | `CONFIRMED_TEST_FILES` partially. |
| Media | Valid file upload/list/update/delete/restore succeeds. | MIME not allowed, over-size, missing permission, deleted item behavior fails. | `MISSING_TEST_COVERAGE` / `NEEDS_VERIFICATION` |
| Content/SEO | Valid article/page publish and public render succeeds. | Invalid type/status/slug, unpublished public access, bad redirect fails. | `CONFIRMED_TEST_FILES` partially; SEO smoke missing. |
| RBAC | Authorized admin/customer action succeeds. | Guest admin API, customer other-customer data, missing permission, self-demotion fail. | `CONFIRMED_TEST_FILES` partially; negative matrix needed. |
| Settings/menu/coupon | Valid admin config updates and public consumption succeeds. | Public settings leak sensitive key; invalid coupon/menu payload fails. | `CONFIRMED_TEST_FILES` partially; sanitization needs verification. |
| Integration | Email/ws/media storage calls are triggered. | Failed provider/storage/email does not corrupt transaction. | `MISSING_TEST_COVERAGE` / `NEEDS_VERIFICATION` |
| Reports | Valid filters/export return expected metrics. | Unauthorized export denied; invalid date/filter handled. | `MISSING_TEST_COVERAGE` |

## 9. State Machine Test Requirements

Source: `docs/business/STATE_MACHINES.md`.

| Entity | Transitions to Test | Forbidden Transitions to Test | Current Status |
|---|---|---|---|
| Product `publishStatus` | `DRAFT -> PUBLISHED`, `PUBLISHED -> HIDDEN`, `HIDDEN -> PUBLISHED`, archive/trash/restore paths. | `PUBLISHED -> DRAFT`, `TRASH -> PUBLISHED`, unknown status, invalid direct transitions. | `MISSING_TEST_COVERAGE` / `NEEDS_VERIFICATION` |
| Category visibility | visible → hidden; hidden → visible. | Hide parent with visible child; self/circular parent. | `MISSING_TEST_COVERAGE` |
| Brand visibility | visible → hidden; hidden → visible. | Public read hidden brand; duplicate slug. | `MISSING_TEST_COVERAGE` |
| Order `status` | `PENDING -> PROCESSING/ON_HOLD/CANCELLED/FAILED`, `ON_HOLD -> PROCESSING/CANCELLED/FAILED`, `PROCESSING -> COMPLETED/CANCELLED/FAILED`, `COMPLETED -> REFUNDED`. | Terminal states to any other state; unknown status; invalid direct jumps; same status idempotency. | `CONFIRMED_TEST_FILES` partially; full matrix missing. |
| Order `paymentStatus` | `UNPAID/PENDING -> PAID/PARTIALLY_PAID`, `PAID -> PARTIALLY_REFUNDED/REFUNDED/UNPAID`, `FAILED -> PAID/PARTIALLY_PAID/CANCELLED`. | `REFUNDED`/`CANCELLED` outbound, invalid partial amount, refund unpaid, over-refund. | `MISSING_TEST_COVERAGE` |
| Payment record status | `PENDING -> SUCCEEDED/REFUNDED` where side effects apply. | Unknown/unsupported provider state. | `NEEDS_VERIFICATION` |
| Inventory stock state | quantity changes recompute `IN_STOCK/LOW_STOCK/OUT_OF_STOCK`; preserve admin-controlled states. | Oversell/concurrent decrement, invalid adjust. | `CONFIRMED_TEST_FILES` partially; concurrency missing. |
| Return `status` | `PENDING -> APPROVED/REJECTED`, `APPROVED -> RECEIVED`, `RECEIVED -> COMPLETED/REFUNDED` depending rule. | Terminal/invalid transitions. | `CONFIRMED_TEST_FILES` partially; matrix missing. |
| Admin user `status/role` | activate/disable/suspend, role update. | self-deactivate, self-demote Super Admin, demote last active Super Admin. | `CONFIRMED_TEST_FILES` partially; full negative matrix needed. |
| Content `publishStatus` | draft/publish/archive/hide transitions. | invalid type/status/id; unpublished public access. | `MISSING_TEST_COVERAGE` / `NEEDS_VERIFICATION` |
| Media `status` | upload active, update inactive, delete deleted, restore active. | invalid status, access deleted by default, forbidden file. | `MISSING_TEST_COVERAGE` |

## 10. API Test Requirements

| API Area | Positive Tests Required | Negative Tests Required | Current Status |
|---|---|---|---|
| Public APIs | Product/category/brand/article/page/search/settings/menu/slider/home-video return expected envelope/data. | Nonexistent slug, hidden/unpublished resources, invalid query params. | `CONFIRMED_TEST_FILES` partially. |
| Cart APIs | Get/create guest cart, add/update/remove item, coupon apply/remove. | Invalid quantity/product/item ownership/coupon. | `CONFIRMED_TEST_FILES` partially. |
| Checkout APIs | Options, checkout, quick-buy. | Empty cart, invalid address, invalid payment/shipping, stock conflict. | `CONFIRMED_TEST_FILES`; historical checkout report exists. |
| Customer APIs | Register/login/logout/me/address/order/return. | Unauthorized access, invalid credentials, other customer data access. | `CONFIRMED_TEST_FILES` partially. |
| Admin APIs | Products/orders/customers/media/content/settings/reports/users/roles. | Missing role/permission, invalid body, nonexistent id. | `CONFIRMED_TEST_FILES` partially. |
| Auth/RBAC | Admin/customer auth boundaries, token refresh, permission map. | Guest admin API, customer admin API, missing permission, disabled/suspended accounts. | `CONFIRMED_TEST_FILES` partially. |
| Validation errors | Standard validation error shape for invalid DTOs/enums/path ids. | Malformed JSON, invalid enum/status, invalid UUID/id. | `CONFIRMED_TEST_FILES` partially; full matrix needed. |
| Pagination/filter/sort | page/size/search/status/date/sort results consistent. | Invalid size/sort/status dates handled. | `CONFIRMED_TEST_FILES` partially. |
| Error response shape | `ApiErrorResponse` code/message/details/meta. | 400/401/403/404/409/500 mapping. | `CONFIRMED_TEST_FILES` partially. |
| OpenAPI/contract | Generated/static OpenAPI matches controllers. | Drift between docs/client/controller. | `CONFIRMED_TEST_FILES` via OpenAPI contract test evidence list. |

## 11. E2E / Smoke Test Requirements

No Playwright/Cypress script was found in `package.json` or CI. These scenarios are required as smoke gates but currently `RECOMMENDED_NOT_IMPLEMENTED`.

| Workflow | Smoke Scenario | Required Result | Status |
|---|---|---|---|
| Public browse | Open homepage, product list, category, brand, article. | 200 page render, no fatal console/API errors, key content visible. | `RECOMMENDED_NOT_IMPLEMENTED` |
| Product detail | Open a published product detail. | Gallery/title/price/stock/actions render; no draft/private product public. | `RECOMMENDED_NOT_IMPLEMENTED` |
| Cart checkout | Add product to cart, update qty, checkout COD/BACS. | Order confirmation shows order number/key; backend order created; stock decremented. | `RECOMMENDED_NOT_IMPLEMENTED` |
| Quick-buy | Buy directly from PDP if UI supports it. | Order created or validation shown; no duplicate submission. | `RECOMMENDED_NOT_IMPLEMENTED` |
| Admin order processing | Login admin, open order, update status/payment/note. | Backend state updates, audit/notification side effects not breaking UI. | `RECOMMENDED_NOT_IMPLEMENTED` |
| Media upload | Upload allowed image, list it, attach/use in product/content. | Media metadata saved and URL usable. | `RECOMMENDED_NOT_IMPLEMENTED` |
| Content publish | Create/publish article/page, verify public render. | Published content public; unpublished content not public. | `RECOMMENDED_NOT_IMPLEMENTED` |
| RBAC denied flow | Login lower-permission role and open forbidden route/API. | UI permission-denied and backend 403. | `RECOMMENDED_NOT_IMPLEMENTED` |
| Mobile browse/account | Launch mobile app, browse product, login, open account/order. | Routes load and API calls succeed against target backend. | `RECOMMENDED_NOT_IMPLEMENTED` |

## 12. Security Test Requirements

| Security Area | Required Tests | Current Status |
|---|---|---|
| Guest cannot admin API | Every `/api/v1/admin/**` endpoint rejects unauthenticated/guest. | `CONFIRMED_TEST_FILES` partially; full matrix needed. |
| Customer cannot admin API | Customer session cannot access admin routes. | `MISSING_TEST_COVERAGE` |
| Customer cannot read another customer data | Other customer order/address/return id is rejected. | `CONFIRMED_TEST_FILES` partially; needs direct negative evidence. |
| Missing permission rejected | Admin without `module.action` gets forbidden. | `CONFIRMED_TEST_FILES` partially; full permission matrix missing. |
| CSRF/session | Cart/checkout/customer mutations require CSRF/session behavior as configured. | `NEEDS_VERIFICATION` |
| JWT refresh/logout | Refresh token rotation/logout invalidation paths. | `CONFIRMED_TEST_FILES` partially. |
| Upload validation | MIME whitelist, size limit, filename/path safety, content sniffing. | MIME/size code evidence; tests `MISSING_TEST_COVERAGE`. |
| Public settings no secrets | Public settings endpoint whitelists safe keys only. | `NEEDS_VERIFICATION` |
| Rate limiting | Abuse endpoints rejected by `RateLimitingFilter`. | `MISSING_TEST_COVERAGE` |
| Security headers | Required headers applied by `SecurityHeadersFilter`. | `MISSING_TEST_COVERAGE` |
| CORS | Allowed origins work, disallowed origins blocked. | `CONFIRMED_TEST_FILES` via `CorsConfigTest`; fresh run not done. |
| Webhook signature | Required for payment/shipping webhook if implemented. | `NOT_FOUND_IN_REPO` |
| WebSocket auth | STOMP CONNECT rejects missing/invalid token. | `MISSING_TEST_COVERAGE` / `NEEDS_VERIFICATION` |

## 13. Performance / NFR Test Requirements

No load/performance tool script was found. These are release-quality recommendations.

| NFR Area | Required Test | Suggested Tool/Command | Status |
|---|---|---|---|
| Public web page load | Homepage/PDP/category LCP/TTFB under agreed threshold. | Lighthouse/PageSpeed/Playwright trace | `RECOMMENDED_NOT_IMPLEMENTED` |
| API latency | Public catalog/search/order/admin list endpoints under agreed p95 latency. | k6/JMeter/Gatling | `RECOMMENDED_NOT_IMPLEMENTED` |
| Checkout concurrency/oversell | Concurrent checkout same stock cannot oversell. | Backend concurrent integration test or k6 | `RECOMMENDED_NOT_IMPLEMENTED` |
| Large product list | Pagination/filter/sort with thousands of products. | Seeded DB + API benchmark | `RECOMMENDED_NOT_IMPLEMENTED` |
| Media upload size | Boundary tests around max allowed upload size. | Backend integration test | `MISSING_TEST_COVERAGE` |
| Report/export large data | Large report/export does not timeout/OOM. | Seeded DB + report/export test | `RECOMMENDED_NOT_IMPLEMENTED` |
| Admin dashboard | Dashboard/report aggregate query latency. | Integration benchmark | `RECOMMENDED_NOT_IMPLEMENTED` |
| Mobile perceived performance | Product list/image cache/navigation responsiveness. | Flutter integration/perf tests | `RECOMMENDED_NOT_IMPLEMENTED` |
| Docker health/restart | Containers become healthy and survive restart. | Compose smoke script | `RECOMMENDED_NOT_IMPLEMENTED` |

## 14. CI/CD Test Gate

### Confirmed CI

Workflow path: `.github/workflows/ci.yml`

| Job | Working Directory | Commands / Gates | Status | Notes |
|---|---|---|---|---|
| Backend | `bigbike-backend` | `./mvnw -B clean verify`; Docker build | `CONFIRMED_SCRIPT` | Uses PostgreSQL service and Java 17. No fresh result in this audit. |
| Web | `bigbike-web` | `npm ci`; `npm run lint`; `npm run build`; Docker build | `CONFIRMED_SCRIPT` | Does not run `npm run test` or coverage. |
| Admin | `bigbike-admin` | `npm ci`; `npm run lint`; `npm run build`; Docker build | `CONFIRMED_SCRIPT` | No unit/component tests script. |
| Mobile | N/A | No mobile job found. | `NOT_FOUND_IN_REPO` | Add Flutter analyze/test/build job later. |
| E2E/smoke | N/A | No Playwright/Cypress/API smoke job found. | `NOT_FOUND_IN_REPO` | Add smoke gate before release. |
| Coverage publishing | N/A | No coverage job/artifact found. | `NOT_FOUND_IN_REPO` | Web coverage script exists but not CI-wired. |

### Recommended release gate checklist

| Gate | Command / Action | Status |
|---|---|---|
| Backend verify | `cd bigbike-backend && ./mvnw -B clean verify` | `CONFIRMED_SCRIPT` |
| Web lint/build | `cd bigbike-web && npm ci && npm run lint && npm run build` | `CONFIRMED_SCRIPT` |
| Web tests/coverage | `cd bigbike-web && npm run test && npm run test:coverage` | `CONFIRMED_SCRIPT` but not CI-wired |
| Admin lint/build | `cd bigbike-admin && npm ci && npm run lint && npm run build` | `CONFIRMED_SCRIPT` |
| Admin tests | Add test runner/script first. | `RECOMMENDED_NOT_IMPLEMENTED` |
| Mobile analyze/test/build | Add CI job for `flutter analyze`, `flutter test`, release build. | `RECOMMENDED_NOT_IMPLEMENTED` |
| Docker compose smoke | Start stack and check `/actuator/health`, web `/`, admin `/`. | `RECOMMENDED_NOT_IMPLEMENTED` |
| E2E smoke | Public browse/cart checkout/admin order/RBAC denied. | `RECOMMENDED_NOT_IMPLEMENTED` |
| Secret scan | Scan env/config/docs before release. | `RECOMMENDED_NOT_IMPLEMENTED` |
| Migration dry-run | Run WP migration/import tests when migration scope changes. | `CONFIRMED_TEST_FILES`; command gate should be verified |

## 15. Manual QA Checklist

### Public web

- [ ] Homepage renders without fatal error.
- [ ] Product list filters/search/sort/pagination work.
- [ ] Product detail renders image/gallery/price/spec/content/CTA.
- [ ] Hidden/draft/trash product is not public.
- [ ] Category/brand/article/page routes render correctly.
- [ ] Mobile/tablet/desktop layouts do not break.
- [ ] SEO metadata/canonical are correct for key routes.

### Admin

- [ ] Login/logout/refresh works.
- [ ] Navigation only shows modules allowed by permissions.
- [ ] Product/category/brand CRUD works with validation.
- [ ] Order list/detail/status/payment/note actions work.
- [ ] Settings/menu/coupon/shipping screens save and reload.
- [ ] Reports/dashboard render without crashing.
- [ ] Permission denied UI appears for forbidden modules.

### Checkout

- [ ] Add/update/remove cart item works.
- [ ] Coupon apply/remove works.
- [ ] Checkout options load payment/shipping methods.
- [ ] COD checkout creates order confirmation.
- [ ] BACS checkout creates `ON_HOLD`/unpaid order behavior as expected.
- [ ] Invalid phone/email/address/payment/shipping shows useful error.
- [ ] Double submit does not create duplicate order.

### Order

- [ ] Admin can open order detail.
- [ ] Allowed transitions are shown; forbidden transitions unavailable or rejected.
- [ ] Status/payment update persists and refreshes UI.
- [ ] Refund rule works for paid/partial only.
- [ ] Customer-visible note behaves as expected.

### Media

- [ ] Allowed image uploads.
- [ ] Oversize/invalid MIME rejected.
- [ ] Media list/detail/update/delete/restore works.
- [ ] Uploaded media can be used by product/content where intended.

### Content

- [ ] Article/page create/update/publish/archive works.
- [ ] Published content appears public.
- [ ] Unpublished/archived content is not public.
- [ ] Redirect rules work for legacy URLs.

### RBAC

- [ ] Guest cannot access admin API.
- [ ] Customer cannot access admin API.
- [ ] Admin missing permission cannot mutate resource.
- [ ] Super Admin self-demotion/self-deactivation is blocked.
- [ ] Last active Super Admin cannot be demoted.

### Mobile

- [ ] App launches and loads home screen.
- [ ] Browse product/category/brand/article routes.
- [ ] Cart and checkout flows work.
- [ ] Login/account/address/order/returns routes work.
- [ ] Contact/CMS routes work.

## 16. Missing Test Coverage

Source: `docs/business/ACCEPTANCE_CRITERIA.md` plus repo test evidence.

| Area | Missing Coverage | Priority |
|---|---|---|
| Product | Full publish transition matrix, public visibility, invalid price/slug/media, UI states. | High |
| Category/Brand | Visibility, circular/self-parent category, hidden taxonomy public exclusion. | High |
| Checkout | Duplicate submit, concurrency/oversell, frontend validation parity, shipping/coupon negative matrix. | Critical |
| Order/payment | Full order/payment/refund transition matrix, audit/notification side effects, invalid refund paths. | Critical |
| Shipping | Disabled/missing/multiple shipping method tests, carrier flow if implemented. | High |
| Inventory | Stock restore idempotency, product vs variant movement consistency, concurrent checkout. | Critical |
| Return | Customer ownership, eligibility, admin transition matrix, refund/stock consistency. | High |
| Media | MIME spoofing, size boundary, delete/restore, MinIO failure handling. | High |
| Content | Publish transition, public filtering, redirect behavior, SEO metadata. | High |
| RBAC | Permission denied matrix across admin modules, customer data isolation, CSRF/session. | Critical |
| Reports | Metric formula tests, date/filter/export tests, large dataset performance. | Medium-High |
| Integrations | Email delivery failure, WebSocket auth/events, MinIO runtime, webhook signature if added. | High |
| Public web UI | Route smoke, SEO, responsive, error/empty/loading states. | High |
| Admin UI | Route permission guard, action states, live/mock API drift. | High |
| Mobile | Flutter analyze/test/build, route/API smoke, auth guard. | High |
| CI/CD | Web tests/coverage, mobile job, E2E smoke, compose runtime smoke, coverage artifacts. | High |

## 17. Evidence Summary

| Area | Evidence Path | What It Proves | Confidence |
|---|---|---|---|
| Web scripts | `bigbike-web/package.json` | Web has `dev`, `build`, `start`, `lint`, `test`, `test:watch`, `test:coverage` scripts. | High |
| Web test config | `bigbike-web/vitest.config.ts`, `bigbike-web/vitest.setup.ts` | Vitest configured with jsdom, setup file, coverage include/exclude. | High |
| Admin scripts | `bigbike-admin/package.json` | Admin has `dev`, `build`, `lint`, `preview`; no test script. | High |
| Backend Maven | `bigbike-backend/pom.xml` | Java 17, Spring Boot, test dependencies, compiler plugin. | High |
| Maven wrapper | `bigbike-backend/mvnw` | Maven wrapper exists and can be used for CI/local commands. | High |
| Backend test files | `bigbike-backend/target/maven-status/maven-compiler-plugin/testCompile/default-testCompile/inputFiles.lst` | Many backend test source files existed at prior compile time. | Medium-High because path is generated artifact, but it names real test source paths. |
| Historical checkout test report | `bigbike-backend/target/surefire-reports/com.bigbike.bigbike_backend.api.Phase1FCheckoutApiTest.txt` | Old report recorded 26 checkout tests with zero failures/errors at that time. | Medium; historical only. |
| Historical migration test report | `bigbike-backend/target/surefire-reports/com.bigbike.bigbike_backend.api.Phase2D1StagingImportRehearsalTest.txt` | Old report recorded 20 migration rehearsal tests with zero failures/errors at that time. | Medium; historical only. |
| Mobile config | `bigbike_mobile/pubspec.yaml` | Flutter app exists with `flutter_test` and `flutter_lints` dependencies. | High |
| CI workflow | `.github/workflows/ci.yml` | CI has backend/web/admin jobs with concrete commands and Docker builds. | High |
| Docker runtime | `docker-compose.yaml` | Runtime services, healthchecks, build contexts and dependencies exist. | High |
| Acceptance requirements | `docs/business/ACCEPTANCE_CRITERIA.md` | Module/workflow completion criteria and missing test expectations. | High |
| Business rules | `docs/business/BUSINESS_RULES.md` | Rule areas and expected positive/negative coverage. | High |
| State machines | `docs/business/STATE_MACHINES.md` | Entities/transitions that require transition tests. | High |
| API contract | `docs/engineering/API_CONTRACT.md` | API areas and auth/validation/response expectations for test planning. | High |
| API flow map | `docs/engineering/API_FLOW_MAP.md` | Workflow-to-API/service/data mapping for E2E smoke planning. | High |

## 18. Relationship With Other Docs

| Related Doc | Relationship |
|---|---|
| `docs/business/ACCEPTANCE_CRITERIA.md` | Defines what must be true before a module/workflow can be accepted. This testing guide converts those criteria into gates/checklists/test requirements. |
| `docs/business/BUSINESS_RULES.md` | Defines business rules that need positive/negative tests. Backend-enforced rules should have service/controller tests. |
| `docs/business/STATE_MACHINES.md` | Defines transitions and forbidden transitions that must be covered by state-machine tests. |
| `docs/engineering/API_CONTRACT.md` | Defines endpoint/auth/response/error contract that API tests must verify. |
| `docs/engineering/API_FLOW_MAP.md` | Defines workflow-to-API/service/data chains that should become E2E/smoke scenarios. |
| `docs/engineering/DATA_CONTRACT.md` | Defines canonical entity fields/status/data ownership that should be used in fixtures/assertions. |
| `docs/engineering/TRACEABILITY_MATRIX.md` | Should link rule → API → data → tests → acceptance result. If it does not exist yet, generate it after this guide. |
| `.github/workflows/ci.yml` | Owns actual CI commands. This guide should not contradict it. |

## Audit Notes

- Không chạy test/build/lint trong task này.
- Không claim pass hiện tại.
- Không sửa code.
- Không implement test mới.
- Không refactor.
- Chỉ tạo tài liệu `docs/engineering/TESTING_GUIDE.md` dựa trên repo evidence.
- Historical surefire reports trong `target/` chỉ được dùng như `HISTORICAL_EVIDENCE`.
- Secret/env sensitive values không được đưa vào file này; CI/env evidence được mô tả theo tên biến/gate, không copy secret-like values.
