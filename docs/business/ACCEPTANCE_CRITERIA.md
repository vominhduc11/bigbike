# BigBike Acceptance Criteria

## 1. Document Purpose

File này định nghĩa tiêu chí nghiệm thu cho module, feature và workflow của BigBike. Mục tiêu là giúp business user, PM, BA, tester, developer mới và AI agent xác định rõ một phần của hệ thống đang ở trạng thái `PASS`, `PARTIAL`, `FAIL`, `NEEDS_VERIFICATION` hay thiếu test.

File này trả lời:

- Khi nào một module được xem là `DONE`?
- Khi nào một feature được xem là `PASS`?
- Khi nào workflow end-to-end được xem là đúng?
- UI/API/backend/database/permission/validation/test đã đủ chưa?
- Case nào phải bị reject?
- Test nào phải có?
- Tiêu chí nào còn thiếu evidence hoặc cần verify?

Phân biệt với các file khác:

| Document | Trả lời câu hỏi |
|---|---|
| `BUSINESS_RULES.md` | Hệ thống phải tuân thủ luật nghiệp vụ nào? |
| `STATE_MACHINES.md` | Entity được chuyển trạng thái như thế nào? |
| `WORKFLOW_OVERVIEW.md` | Luồng nghiệp vụ chạy xuyên hệ thống ra sao? |
| `ACCEPTANCE_CRITERIA.md` | Điều kiện nào phải đạt để gọi là hoàn thành/pass? |

Giới hạn:

- Không phải API contract.
- Không phải database schema.
- Không phải test implementation detail.
- Không nhồi request/response API.
- Không nhồi full database/entity fields.
- Không chứa secret, token, password, private key hoặc env value nhạy cảm.
- Không khẳng định release-ready nếu chưa có build/test/runtime evidence hiện tại.

## 2. Acceptance Status Labels

| Label | Meaning |
|---|---|
| `PASS` | Có evidence đủ rõ cho tiêu chí cụ thể và tiêu chí đạt ở phạm vi audit này. |
| `FAIL` | Có evidence cho thấy tiêu chí không đạt. |
| `PARTIAL` | Có một phần UI/API/model/test nhưng chưa đủ để gọi pass hoặc done. |
| `BACKEND_ONLY` | Backend/API/service có evidence nhưng UI/frontend chưa thấy hoặc chưa audit đủ. |
| `FRONTEND_ONLY` | UI/frontend có evidence nhưng backend/API/service chưa thấy. |
| `NEEDS_VERIFICATION` | Cần kiểm tra thêm bằng code review sâu hơn, build/test/runtime hoặc business confirmation. |
| `NEEDS_BUSINESS_CONFIRMATION` | Cần business xác nhận rule/process/scope. |
| `MISSING_TEST_COVERAGE` | Có feature/rule/workflow nhưng thiếu test tương ứng hoặc chưa thấy test evidence. |
| `DOCUMENTED_NOT_IMPLEMENTED` | Docs có nói nhưng code chưa thấy triển khai. |
| `NOT_FOUND_IN_REPO` | Chưa thấy trong repo hiện tại. |
| `NOT_APPLICABLE` | Không thuộc scope hiện tại. |

## 3. Definition of Done

Một module/feature/workflow chỉ được gọi là `DONE` khi đạt tất cả tiêu chí phù hợp với scope của nó:

| Done Requirement | Required When | Acceptance Rule |
|---|---|---|
| UI route/screen | Item cần người dùng thao tác trực tiếp. | Có route/page/screen/component rõ, user flow không cụt. |
| Backend/API/service | Item đọc/ghi dữ liệu hoặc xử lý mutation. | Có controller/API + service/use case + validation. |
| Data model/schema | Item cần lưu dữ liệu. | Có entity/model/schema/migration hoặc repository evidence. |
| Frontend validation | Form/input user-facing. | UI validate required/format cơ bản và hiển thị lỗi rõ. |
| Backend validation | Mọi request/input ảnh hưởng dữ liệu. | Backend reject required/invalid/duplicate enum/status/transition. |
| Permission/RBAC | Admin/internal action. | Backend enforce permission, frontend chỉ hỗ trợ UX. |
| Business rule enforcement | Dữ liệu/trạng thái/quyền/payment/inventory. | Rule được enforce ở backend/service/domain layer. |
| UI states | UI data/action. | Có loading/empty/error/submitting/success/permission-denied/not-found khi phù hợp. |
| Positive tests | Core feature/rule. | Có test cho happy path. |
| Negative tests | Validation/permission/state/business rules. | Có test reject invalid input/transition/permission. |
| E2E/smoke tests | Workflow xuyên hệ thống. | Có smoke/E2E hoặc checklist runtime rõ. |
| Build/lint/test gate | Release/deploy. | Có command/CI và evidence pass. |
| Evidence path | Tất cả criteria quan trọng. | Ghi rõ file/folder thật trong repo. |

Không được gọi `DONE` nếu:

- Chỉ có UI nhưng chưa có backend/API cho mutation/data thật.
- Chỉ có frontend validation nhưng backend không enforce.
- Chỉ có backend nhưng thiếu UI cho feature user-facing.
- Có business rule/state transition quan trọng nhưng thiếu negative test.
- Có docs nói đã có feature nhưng source không có evidence.
- Chưa chạy hoặc chưa thấy build/test/lint/CI pass mà gọi release-ready. Vì gọi vậy cũng như đội mũ bảo hiểm bằng giấy carton rồi lao ra quốc lộ.

## 4. Global Acceptance Criteria

| Area | Criteria | Required Evidence | Status | Notes |
|---|---|---|---|---|
| Code builds successfully | `bigbike-web`, `bigbike-admin`, `bigbike-backend` phải có command build/test tương ứng và chạy pass trước release. | `bigbike-web/package.json`, `bigbike-admin/package.json`, `bigbike-backend/pom.xml` | `NEEDS_VERIFICATION` | Có scripts/deps, nhưng task này không chạy build/test. |
| Lint passes | Web/admin lint command phải pass nếu đưa vào release gate. | Web `lint`, Admin `lint` scripts. | `NEEDS_VERIFICATION` | Không có evidence đã chạy. |
| Tests pass | Unit/integration tests phải pass. | Web `vitest`, backend Maven test deps. | `NEEDS_VERIFICATION` | Không thấy CI/fresh test result trong task này. |
| No secret exposure | Docs/config không được expose token/password/private key. | Docs/business files, env/config usage. | `PASS` for this doc | File này không đưa secret. Repo-wide secret scan chưa chạy. |
| Error handling | API phải có standard error response; UI phải hiển thị error state. | `GlobalExceptionHandler`, API response classes, UI components. | Backend `PASS`; UI `NEEDS_VERIFICATION` | Backend error layer exists; UI audit chưa đủ. |
| Permission enforcement | Admin/internal APIs phải backend-enforce permission. | `SecurityConfig`, admin controllers, `DevAdminAuthService`, `AdminRolePermissions`. | `PASS` for audited backend modules | Full permission matrix chưa tạo. |
| Backend validation | Required fields, enum/status, invalid transition, duplicate fields phải reject. | Services/controllers/validators. | `PASS` for audited core rules | Test coverage còn thiếu. |
| Data contract consistency | FE/admin/web/backend phải dùng canonical shape thống nhất. | API client, DTO/domain/entity. | `NEEDS_VERIFICATION` | Cần `DATA_CONTRACT.md`/traceability audit. |
| API contract consistency | FE request/response mapping phải khớp backend. | Admin API client, public API calls, controllers. | `PARTIAL` | Có evidence API usage, chưa verify toàn bộ endpoints. |
| UI states | Loading/empty/error/submitting/success/permission-denied/not-found. | UI pages/components. | `NEEDS_VERIFICATION` | Chưa audit sâu UI states. |
| Responsive/public web quality | Public web phải responsive và usable trên mobile/desktop. | Next app/routes/components. | `NEEDS_VERIFICATION` | Có public web evidence, chưa visual/runtime audit. |
| SEO basics | Public pages phải có metadata/canonical/structured data where applicable. | `bigbike-web/app/page.tsx`, route helpers. | `PARTIAL` | Homepage SEO có evidence; sitemap/robots/per-page SEO cần verify. |
| Logging/observability | Request id/logging/audit/actuator where applicable. | `RequestIdFilter`, logback, audit logs, actuator dependency. | `PARTIAL` | Code/config evidence có; runtime monitoring chưa verify. |
| Deployment readiness | Docker/build/config đủ cho deploy. | `docker-compose.yaml`, package scripts, Maven config. | `NEEDS_VERIFICATION` | Không chạy deploy/build; CI chưa thấy. |

## 5. Module Acceptance Criteria Summary

| Module | App / Layer | Acceptance Scope | Status | Evidence | Missing Criteria |
|---|---|---|---|---|---|
| Homepage/Public Web | Web | Homepage render, SEO, product/category/article/slider/settings consumption. | `PARTIAL` | `bigbike-web/app/page.tsx`, `CatalogController`, public settings/menu APIs | Runtime, responsive, UI states, per-page SEO tests. |
| Product | Admin/Web/Backend | Product CRUD/publish/public browse/stock/media/category/brand. | `PARTIAL` | `AdminCatalogController`, `AdminCatalogMutationService`, `CatalogReadService`, routes | UI state audit, product tests, full FE-BE mapping. |
| Category/Brand | Admin/Web/Backend | Taxonomy CRUD/visibility/public browse. | `PARTIAL` | `AdminCatalogController`, `CatalogReadService` | UI/test coverage, default visibility. |
| Cart/Checkout | Web/Backend | Cart/checkout/quick-buy/order creation/payment/shipping/stock. | `PARTIAL` | `CartController`, `CheckoutController`, `CheckoutService`, Phase 1F report | UI flow/runtime, duplicate submit, test discovery. |
| Orders | Admin/Backend | Order list/detail/status/payment/refund/notes. | `PARTIAL` | `AdminOrderController`, `AdminOrderService`, admin API client | UI state/action audit, tests for transitions. |
| Payment | Backend/Admin | COD/BACS/manual payment status/refund. | `PARTIAL` | `CheckoutService`, `AdminOrderService` | External gateway/webhook not found; test coverage missing. |
| Shipping | Admin/Backend | Internal zones/methods/checkout selection. | `PARTIAL` | `AdminShippingController`, `CheckoutService` | Carrier/fulfillment tracking not found. |
| Inventory | Admin/Backend | Stock list/adjust/movement/decrement/restore. | `PARTIAL` | `AdminInventoryController`, `CheckoutService`, `AdminOrderService`, `AdminReturnService` | Serial/concurrency/tests/UI states. |
| Returns/Refunds | Customer/Admin/Backend | Customer return create/list/detail, admin return transitions/refund. | `PARTIAL` | `CustomerOrderController`, `AdminReturnController`, `AdminReturnService` | Eligibility tests, payment/report impact. |
| Media | Admin/Backend/Storage | Upload/list/update/delete/restore, MinIO storage. | `PARTIAL` | `AdminMediaController`, `AdminMediaService`, `MinioConfig` | Public URL/CDN, attachment UI, tests. |
| Content/SEO | Admin/Web/Backend | Article/page CRUD/publish/public render/SEO/redirects. | `PARTIAL` | `AdminContentController`, `AdminContentMutationService`, `ContentController`, web routes | Public filtering, sitemap/robots, per-page SEO tests. |
| User/RBAC | Admin/Backend | Admin users, roles, permissions, security boundaries. | `PARTIAL` | `AdminAdminUsersService`, `AdminRolesController`, `SecurityConfig` | Production auth, UI guards, permission negative tests. |
| Settings/Menu/Coupon | Admin/Web/Backend | Settings/menu/coupon CRUD/public consumption. | `PARTIAL` | Phase 1J report, settings/menu/coupon controllers, `CheckoutService` | Coupon docs drift, public setting sanitization source audit. |
| Reports/Dashboard | Admin/Backend | Dashboard analytics/export. | `PARTIAL` | `AdminDashboardController`, `AdminReportController` | Metric semantics, UI/chart/export tests. |
| Notification | Backend/Integration | Email/websocket event calls. | `PARTIAL` | `OrderNotificationService`, `AdminOrderWsService`, service callers | Delivery runtime, retry, inbox state not found. |

## 6. Product Module Acceptance Criteria

### Scope

- Admin product management.
- Backend product data/API/service.
- Public web product listing/detail/snapshot.
- Media/category/brand/SEO linkage where supported.
- Publish status and public visibility rules.

### Pass Criteria

- Product list/detail APIs return correct data.
- Admin can create/update product when authorized.
- Backend validates required fields and price/slug/media constraints.
- Slug uniqueness is enforced.
- Publish transitions are backend-enforced.
- Only `PUBLISHED` product is visible from public catalog.
- Quick-buy rejects non-`PUBLISHED` products.
- Product soft delete moves to `TRASH` and public catalog excludes it.
- Permission is enforced for product mutations.
- UI handles loading/empty/error/submitting/success states.
- Positive and negative tests exist for publish transitions and invalid data.

### Fail Criteria

- Product `DRAFT`, `HIDDEN`, `ARCHIVED`, `TRASH`, `PRIVATE`, or `PENDING` appears on public product listing/detail without business approval.
- Backend accepts invalid price, duplicate slug, invalid media URL or forbidden publish transition.
- UI blocks invalid action but backend accepts the same invalid request.
- Admin without permission can mutate product.
- No error handling when API fails.

### Evidence / Status Table

| Criteria | Evidence | Status | Notes |
|---|---|---|---|
| Product status enum exists. | `PublishStatus.java` | `PASS` | `DRAFT`, `PUBLISHED`, `HIDDEN`, `ARCHIVED`, `PENDING`, `PRIVATE`, `TRASH`. |
| Publish transition validation exists. | `AdminMutationValidators.java` | `PASS` | Shared validator enforces allowed transitions. |
| Product create/update validates required fields/slug/price/media. | `AdminCatalogMutationService.java`, `AdminMutationValidators.java` | `PASS` | Backend-enforced. |
| Public catalog only returns `PUBLISHED`. | `CatalogReadService.java` | `PASS` | Backend public filter. |
| Quick-buy rejects non-published product. | `CheckoutService.java` | `PASS` | Backend checkout guard. |
| Admin product permission enforced. | `AdminCatalogController.java`, `DevAdminAuthService.java` | `PASS` | Permission strings need full matrix later. |
| Admin UI product route/form states. | `bigbike-admin/README.md`, admin source | `NEEDS_VERIFICATION` | Route exists, detailed UI states not audited. |
| Product positive/negative tests. | Targeted search/phase docs | `MISSING_TEST_COVERAGE` | Direct transition tests not found in this task. |
| Product public SEO/media/spec render. | `bigbike-web` routes/components, DTOs | `NEEDS_VERIFICATION` | Needs UI/runtime audit. |

## 7. Category / Brand Acceptance Criteria

| Criteria | Evidence | Status | Notes |
|---|---|---|---|
| Admin can list/detail/create/update category/brand when authorized. | `AdminCatalogController.java` | `PASS` for backend API existence | UI completeness not fully audited. |
| Public category/brand only returns visible records. | `CatalogReadService.java` | `PASS` | Backend visibility filter. |
| Category cannot be hidden when visible child categories exist. | `AdminCatalogMutationService.java` | `PASS` | Backend conflict guard. |
| Category parent cannot be self/circular. | `AdminCatalogMutationService.java` | `PASS` | Backend validation. |
| Slug uniqueness is enforced. | `AdminCatalogMutationService.java` | `PASS` | Category/brand duplicate slug checks. |
| Product assignment to hidden/deleted taxonomy is safe. | Product/category services | `NEEDS_VERIFICATION` | Needs deeper business rule audit. |
| UI loading/empty/error states. | Admin UI | `NEEDS_VERIFICATION` | Not audited. |
| Tests for visibility/slug/tree rules. | Test search | `MISSING_TEST_COVERAGE` | Direct tests not found. |

## 8. Customer Browsing / Public Web Acceptance Criteria

| Criteria | Evidence | Status | Notes |
|---|---|---|---|
| Homepage loads data from settings/sliders/products/categories/articles/brands/videos. | `bigbike-web/app/page.tsx` | `PASS` for code path | Runtime not run. |
| Product listing/detail routes exist. | `bigbike-web/lib/utils/routes.ts`, `CatalogController` | `PASS` for route/API evidence | UI behavior needs runtime audit. |
| Search/filter/category/brand route/API exists. | `PublicSearchController`, `CatalogController`, route helpers | `PASS` for backend/route evidence | Ranking/scoring/UI states need verify. |
| Empty state when no products/content. | UI components | `NEEDS_VERIFICATION` | Not deeply audited. |
| Error state when API fails. | UI components | `NEEDS_VERIFICATION` | Not deeply audited. |
| Image/media fallback when missing image. | Homepage/components | `NEEDS_VERIFICATION` | Needs UI audit. |
| SEO metadata/JSON-LD homepage. | `bigbike-web/app/page.tsx` | `PASS` for homepage | Per-page SEO/sitemap/robots partial. |
| No admin-only data exposed public. | `SecurityConfig`, public controllers | `PARTIAL` | Backend boundary exists; data leakage audit not complete. |
| Responsive/mobile usability. | Public web source | `NEEDS_VERIFICATION` | Requires visual/runtime audit. |
| Public web tests. | `bigbike-web/package.json` has Vitest script | `MISSING_TEST_COVERAGE` / `NEEDS_VERIFICATION` | Test command exists; test files/run not confirmed. |

## 9. Cart / Checkout / Order Creation Acceptance Criteria

| Criteria | Evidence | Status | Notes |
|---|---|---|---|
| Cart API/module exists. | `CartController.java` | `PASS` for backend API | Frontend cart UI details need verify. |
| Checkout from cart and quick-buy exist. | `CheckoutController.java`, `CheckoutService.java` | `PASS` | Backend workflows exist. |
| Checkout validates cart not empty. | `CheckoutService.java` | `PASS` | Backend validation. |
| Checkout validates address/contact. | `CheckoutService.java` | `PASS` | Backend validation. |
| Checkout only allows supported payment methods. | `CheckoutService.java` | `PASS` | COD/BACS. |
| Checkout validates shipping method exists/enabled. | `CheckoutService.java` | `PASS` | Backend validation. |
| Checkout blocks insufficient/out-of-stock product/variant. | `CheckoutService.java` | `PASS` | Backend validation. |
| Order/items/payment/shipping/note are created. | `CheckoutService.java` | `PASS` | Backend side effects. |
| Stock is decremented and movement recorded. | `CheckoutService.java` | `PASS` | Variant movement confirmed; product movement symmetry needs verify. |
| Admin can see new order. | `AdminOrderController`, `AdminOrderService` | `PARTIAL` | Backend API exists; UI runtime not confirmed. |
| Checkout UI success/error/submitting/double-submit handling. | Public web/mobile UI | `NEEDS_VERIFICATION` | Requires frontend audit. |
| Tests positive/negative. | Phase 1F report, test search | `MISSING_TEST_COVERAGE` / `NEEDS_VERIFICATION` | Phase report exists; fresh tests not run. |

## 10. Admin Order Management Acceptance Criteria

| Criteria | Evidence | Status | Notes |
|---|---|---|---|
| Admin can view order list/detail. | `AdminOrderController.java`, `AdminOrderService.java`, admin API client | `PASS` for backend/API | UI states not verified. |
| Allowed order transitions are exposed for UI. | `AdminOrderService.listAllowedTransitions` | `PASS` | Helps UI hide invalid actions. |
| Backend rejects invalid order transitions. | `AdminOrderService.ALLOWED_TRANSITIONS` | `PASS` | Conflict error. |
| Same status update is idempotent. | `AdminOrderService.updateOrderStatus` | `PASS` | No write on same status. |
| Status update sets timestamps/stock restore/notification/audit/websocket. | `AdminOrderService` | `PASS` | Side effects confirmed by code. |
| Payment status update is backend-enforced. | `AdminOrderService.ALLOWED_PAYMENT_TRANSITIONS` | `PASS` | Payment transition map. |
| Refund only allowed when paid/partially paid and within refundable amount. | `AdminOrderService.createRefund` | `PASS` | Backend validation. |
| Permission `orders.*` enforced. | `AdminOrderController`, `DevAdminAuthService` | `PASS` | Full matrix pending. |
| UI loading/empty/error/action states. | Admin UI | `NEEDS_VERIFICATION` | Not deeply audited. |
| Transition tests positive/negative. | Test search | `MISSING_TEST_COVERAGE` | Direct tests not found. |

## 11. Payment Acceptance Criteria

| Criteria | Evidence | Status | Notes |
|---|---|---|---|
| Payment record created during checkout. | `CheckoutService.java` | `PASS` | `PENDING` internal payment record. |
| Order payment status initialized correctly. | `CheckoutService.java`, Phase 1F report | `PASS` | `UNPAID`; COD order `PROCESSING`, BACS `ON_HOLD`. |
| Payment transition map enforced. | `AdminOrderService.java` | `PASS` | Backend map exists. |
| Partial paid amount validation. | `AdminOrderService.java` | `PASS` | `> 0` and `< totalAmount`. |
| Refund amount validation. | `AdminOrderService.java` | `PASS` | Cannot exceed refundable amount. |
| Payment webhook/callback idempotency. | No webhook evidence | `NOT_FOUND_IN_REPO` | External provider workflow not found. |
| Payment provider secrets not exposed. | Current docs | `PASS` for this doc | Repo-wide secret scan not run. |
| Payment report/revenue impact. | `AdminReportController`/service area | `NEEDS_VERIFICATION` | Finance semantics not confirmed. |
| Positive/negative payment tests. | Test search | `MISSING_TEST_COVERAGE` | Direct tests not found. |

## 12. Shipping / Fulfillment Acceptance Criteria

| Criteria | Evidence | Status | Notes |
|---|---|---|---|
| Admin shipping zones/methods API exists. | `AdminShippingController.java` | `PASS` for backend API | UI/runtime not verified. |
| Checkout requires valid enabled shipping method. | `CheckoutService.java` | `PASS` | Backend validation. |
| Checkout auto-selects only when exactly one enabled method exists. | `CheckoutService.java` | `PASS` | Backend rule. |
| Order shipping item/cost saved. | `CheckoutService.java` | `PASS` | Backend side effect. |
| External shipping provider/tracking lifecycle. | No provider evidence | `NOT_FOUND_IN_REPO` | GHN/GHTK/ViettelPost not confirmed. |
| Fulfillment status transition. | `fulfillmentStatus` field observed | `STATUS_ONLY` / `NEEDS_VERIFICATION` | No transition map found. |
| Shipping tests. | Test search | `MISSING_TEST_COVERAGE` | Direct tests not found. |

## 13. Inventory Acceptance Criteria

| Criteria | Evidence | Status | Notes |
|---|---|---|---|
| Admin inventory list/summary/movement/adjust/export exists. | `AdminInventoryController.java` | `PASS` for backend API | UI states not verified. |
| Stock states exist. | `ProductStockState.java` | `PASS` | `IN_STOCK`, `LOW_STOCK`, `OUT_OF_STOCK`, `PREORDER`, `CONTACT_FOR_STOCK`. |
| Stock recomputes by quantity/threshold. | `InventoryPolicyService.java` | `PASS` | Admin-controlled states not overwritten. |
| Checkout blocks oversell. | `CheckoutService.java` | `PASS` | Backend validation. |
| Checkout decrements stock. | `CheckoutService.java` | `PASS` | Backend side effect. |
| Cancel/refund/return restores stock where service flow applies. | `AdminOrderService.java`, `AdminReturnService.java` | `PASS` for audited flows | Duplicate restore/idempotency needs verify. |
| Stock movement recorded. | `CheckoutService.java`, `AdminOrderService.java`, `AdminReturnService.java` | `PARTIAL` | Variant movement confirmed; product-level symmetry needs verify. |
| Serial lifecycle. | Prior docs mention possible serial movement entity | `NEEDS_VERIFICATION` | Full serial states not confirmed. |
| Inventory tests/concurrency tests. | Test search | `MISSING_TEST_COVERAGE` | Direct tests not found. |

## 14. Return / Refund Acceptance Criteria

| Criteria | Evidence | Status | Notes |
|---|---|---|---|
| Customer return APIs exist and scope by authenticated customer. | `CustomerOrderController.java` | `PASS` | Customer principal used. |
| Admin return list/detail/update exists. | `AdminReturnController.java`, `AdminReturnService.java` | `PASS` for backend | UI states need verify. |
| Return transitions are backend-enforced. | `AdminReturnService.TRANSITIONS` | `PASS` | Explicit transition map. |
| Return history is recorded. | `AdminReturnService.java` | `PASS` | History entity saved. |
| Return notifications called by status. | `AdminReturnService.java` | `PASS` for service call | Delivery runtime needs verify. |
| Completed return restores stock. | `AdminReturnService.java` | `PASS` | Variant restore confirmed. |
| Return refunded syncs order refund amount if provided. | `AdminReturnService.java` | `PASS` for specific field | Payment record/order payment status impact needs verify. |
| Refund amount/payment/order/report consistency. | `AdminOrderService.java`, return service | `NEEDS_VERIFICATION` | Two refund paths need semantics alignment. |
| Return tests. | Test search | `MISSING_TEST_COVERAGE` | Direct tests not found. |

## 15. Media Acceptance Criteria

| Criteria | Evidence | Status | Notes |
|---|---|---|---|
| Upload media API exists. | `AdminMediaController.java`, `AdminMediaService.java` | `PASS` | Backend path confirmed. |
| File type whitelist enforced. | `AdminMediaService.java` | `PASS` | MIME whitelist. |
| File size max 50 MB enforced. | `AdminMediaService.java` | `PASS` | Backend validation. |
| Media upload stores object and metadata. | `AdminMediaService.java`, `MinioConfig.java` | `PASS` for storage attempt | Runtime MinIO/bucket not tested. |
| Media statuses `ACTIVE/INACTIVE/DELETED` enforced. | `AdminMediaService.java` | `PASS` | Status validation. |
| Deleted media excluded by default. | `AdminMediaService.java` | `PASS` | Backend list behavior. |
| Restore/hard-delete exists. | `AdminMediaService.java` | `PASS` | Backend side effects. |
| Dangerous file content sniffing. | MIME-only evidence | `NEEDS_VERIFICATION` | MIME header alone is not strong security. |
| Public URL/CDN render. | MinIO config and media URLs | `NEEDS_VERIFICATION` | Runtime/proxy not verified. |
| Media tests. | Test search | `MISSING_TEST_COVERAGE` | Direct tests not found. |

## 16. Content / SEO Acceptance Criteria

| Criteria | Evidence | Status | Notes |
|---|---|---|---|
| Admin article/page CRUD exists. | `AdminContentController.java`, `AdminContentMutationService.java` | `PASS` for backend | UI states not audited. |
| Content create validates required fields. | `AdminContentMutationService.java` | `PASS` | Slug/title/body/status/pageType checks. |
| Content publish transitions enforced. | `AdminContentMutationService.java`, `AdminMutationValidators.java` | `PASS` | Shared publish validator. |
| Delete content archives article/page. | `AdminContentMutationService.java` | `PASS` | Sets `ARCHIVED`. |
| Published content sets `publishedAt`; non-published clears it. | `AdminContentMutationService.java` | `PASS` | Side effect confirmed. |
| Web revalidation triggered. | `AdminContentMutationService.java` | `PASS` for service call | Runtime revalidation not tested. |
| Public content read exists. | `ContentController.java` | `PASS` for API existence | Publish filtering needs verify. |
| Homepage SEO metadata/JSON-LD. | `bigbike-web/app/page.tsx` | `PASS` for homepage | Per-page SEO/sitemap/robots partial. |
| Redirect/migration tooling. | `InternalRedirectController`, migration package | `PARTIAL` | Full SEO migration coverage needs audit. |
| Content/SEO tests. | Test search | `MISSING_TEST_COVERAGE` | Direct tests not found. |

## 17. User / Role / Permission Acceptance Criteria

| Criteria | Evidence | Status | Notes |
|---|---|---|---|
| Admin APIs require admin role. | `SecurityConfig.java` | `PASS` | Backend boundary. |
| Customer protected APIs require customer role. | `SecurityConfig.java`, customer controllers | `PASS` | Backend boundary. |
| Built-in admin roles exist. | `AdminRolePermissions.java` | `PASS` | `SUPER_ADMIN`, `ADMIN`, `SHOP_MANAGER`, etc. |
| Super Admin wildcard permission. | `AdminRolePermissions.java` | `PASS` | `*`. |
| Permission checks occur in audited admin controllers. | Admin controllers + `DevAdminAuthService` | `PASS` for audited modules | Full matrix pending. |
| Admin user create validates email/role/password. | `AdminAdminUsersService.java` | `PASS` | Backend validation. |
| Admin cannot deactivate self. | `AdminAdminUsersService.java` | `PASS` | Backend guard. |
| Super Admin cannot self-demote or demote last active Super Admin. | `AdminAdminUsersService.java` | `PASS` | Backend guard. |
| Disabled/suspended admin login blocked. | Auth services | `NEEDS_VERIFICATION` | Status update confirmed, login behavior needs audit. |
| Production admin auth. | `DevAdminAuthService.java` caveat in prior docs | `NEEDS_VERIFICATION` | Dev/mock auth not production-ready by itself. |
| UI permission denied/hidden actions. | Admin UI | `NEEDS_VERIFICATION` | Not deeply audited. |
| Permission negative tests. | Test search | `MISSING_TEST_COVERAGE` | Direct tests not found. |

## 18. Settings / Configuration Acceptance Criteria

| Criteria | Evidence | Status | Notes |
|---|---|---|---|
| Admin settings APIs exist. | `AdminSettingsController.java`, Phase 1J report | `PASS` for backend API | Source/service details need deeper audit. |
| Public settings API exists. | `PublicSettingsController.java` | `PASS` for API existence | Sensitive whitelist needs source verification. |
| Menu admin/public APIs exist. | `AdminMenuController.java`, `PublicMenuController.java` | `PASS` for API existence | UI/runtime tests missing. |
| Coupon admin APIs exist. | `AdminCouponController.java`, Phase 1J report | `PASS` for backend API | Checkout coupon behavior docs drift. |
| Settings/menu/coupon permissions enforced. | Phase 1J report, controllers | `PASS` for documented/audited backend | Fresh test not run. |
| Public settings do not expose sensitive values. | Phase 1J report + public controller | `NEEDS_VERIFICATION` | Need source audit of whitelist/blacklist. |
| Settings affect app/module as expected. | Public web homepage consumes settings | `PARTIAL` | Not all settings traced. |
| Error/success UI states. | Admin UI | `NEEDS_VERIFICATION` | Not audited. |
| Tests. | Phase report/test search | `MISSING_TEST_COVERAGE` / `NEEDS_VERIFICATION` | Phase report exists; fresh tests not found. |

## 19. Reporting / Dashboard Acceptance Criteria

| Criteria | Evidence | Status | Notes |
|---|---|---|---|
| Dashboard API exists. | `AdminDashboardController.java` | `PASS` for backend API | Metric semantics need verify. |
| Report/analytics/export APIs exist. | `AdminReportController.java`, `AdminInventoryController.java` | `PASS` for backend API | UI/export runtime not run. |
| Report permission enforced. | `AdminReportController.java`, `AdminInventoryController.java` | `PASS` | Read permissions. |
| Cancelled/refunded/unpaid revenue semantics correct. | Report service/business finance rule | `NEEDS_BUSINESS_CONFIRMATION` | Need business-approved metric definition. |
| Filter/date/export large data behavior. | Report APIs | `NEEDS_VERIFICATION` | Runtime/performance not verified. |
| Empty/error UI states. | Admin UI | `NEEDS_VERIFICATION` | Not audited. |
| Report tests. | Test search | `MISSING_TEST_COVERAGE` | Direct tests not found. |

## 20. Workflow Acceptance Criteria

| Workflow | Criteria | Required Evidence | Status | Missing |
|---|---|---|---|---|
| Product Publish E2E | Admin creates/updates product, backend stores data, publish transitions valid, public web shows only `PUBLISHED`, non-public states hidden. | Admin product API/service, public catalog service, web routes. | `PARTIAL` | UI runtime, smoke/E2E, transition tests. |
| Customer Browsing E2E | Homepage/listing/detail/search/category/content routes render public data and do not expose admin-only data. | Web routes/components, public controllers, security config. | `PARTIAL` | Runtime/responsive/UI states/per-page SEO tests. |
| Checkout / Order Creation E2E | Customer/guest creates order; backend creates order/items/payment/shipping; stock decrements; admin can see order; invalid cases reject. | Cart/checkout/order/inventory services. | `PARTIAL` | Frontend checkout runtime, E2E, duplicate-submit tests. |
| Admin Order Processing E2E | Admin transitions order/payment/refund by allowed state machine; invalid transitions reject; stock/audit/notification/websocket side effects occur. | `AdminOrderService`, admin order controller/client. | `PARTIAL` | UI action audit, positive/negative transition tests. |
| Return / Refund E2E | Customer creates return; admin processes through allowed states; inventory/payment/order effects consistent. | Customer order controller, admin return service/order service. | `PARTIAL` | Eligibility/payment/report consistency tests. |
| Media Management E2E | Admin uploads media, validates file, stores object, lists/updates/deletes/restores, attaches to product/content where needed. | Media controller/service/MinIO config. | `PARTIAL` | Runtime object storage, public URL/CDN, attachment UI tests. |
| Content / SEO Publishing E2E | Admin creates/publishes content; public web renders only eligible content; SEO metadata/redirects correct. | Content controllers/services, web routes, redirect tooling. | `PARTIAL` | Public filtering, sitemap/robots, per-page SEO tests. |
| User / Role / Permission E2E | Super Admin/Admin manages users/roles; backend enforces permissions; forbidden roles/actions reject. | RBAC services/controllers/security. | `PARTIAL` | Production auth, UI permission behavior, negative tests. |
| Reports/Dashboard E2E | Admin views analytics/export with correct permission and metrics. | Dashboard/report controllers/services. | `PARTIAL` | Metric definitions, tests, runtime export checks. |

## 21. Permission Negative Criteria

| Criteria | Required Evidence | Status | Notes |
|---|---|---|---|
| Guest/customer cannot call admin APIs. | `SecurityConfig.java` | `PASS` | Backend role boundary. |
| Role without permission must be backend rejected. | `DevAdminAuthService`, admin controllers | `PASS` for audited controllers | Need permission matrix and tests. |
| Frontend hidden button is not enough. | Business/security principle, backend guards | `PASS` for doc criterion | Must be enforced in code per action. |
| Permission denied UI is clear. | Admin UI components | `NEEDS_VERIFICATION` | Not audited. |
| Negative permission tests exist. | Test files/CI | `MISSING_TEST_COVERAGE` | Direct tests not found. |

## 22. Validation & Error Handling Criteria

| Criteria | Required Evidence | Status | Notes |
|---|---|---|---|
| Required fields validate backend. | DTO annotations/services | `PASS` for audited modules | Product/content/checkout/admin user/media/order. |
| Invalid enum/status rejected. | Controllers/services/validators | `PASS` | Product/content/order/payment/return/media/admin user. |
| Invalid transition rejected. | State-machine services | `PASS` | Product/content/order/payment/return. |
| Duplicate unique field rejected. | Catalog/content/admin user services | `PASS` for audited fields | DB constraints need verify. |
| API error format standardized. | `GlobalExceptionHandler`, response DTOs | `PASS` for backend layer | UI handling needs verify. |
| UI field/global error displayed. | Frontend forms | `NEEDS_VERIFICATION` | Not deeply audited. |
| Loading/submitting prevents double submit. | Frontend forms | `NEEDS_VERIFICATION` | Not audited. |
| Negative validation tests. | Test files | `MISSING_TEST_COVERAGE` | Direct tests not found. |

## 23. UI State Criteria

| UI State | Required For | Status | Notes |
|---|---|---|---|
| Loading state | Any route/page fetching data. | `NEEDS_VERIFICATION` | Needs component-level audit. |
| Empty state | Lists/tables/search/results. | `NEEDS_VERIFICATION` | Needs component-level audit. |
| Error state | Failed API/network/server error. | `NEEDS_VERIFICATION` | Needs component-level audit. |
| Submitting state | Forms/actions/mutations. | `NEEDS_VERIFICATION` | Must prevent duplicate submit. |
| Success state | Create/update/delete/checkout/upload actions. | `NEEDS_VERIFICATION` | Toast/redirect/confirmation needs audit. |
| Permission denied state | Admin protected pages/actions. | `NEEDS_VERIFICATION` | Backend guard exists; UI state unknown. |
| Not found state | Detail pages/routes. | `NEEDS_VERIFICATION` | Needs route-level audit. |
| Fallback media/image state | Public web/product/content/media. | `NEEDS_VERIFICATION` | Needs UI audit. |
| Responsive behavior | Public web/admin/mobile scope. | `NEEDS_VERIFICATION` | Requires visual/browser check. |

## 24. API / Data Contract Criteria

| Criteria | Status | Notes |
|---|---|---|
| FE request must match backend API. | `PARTIAL` | Admin API client and controllers exist; full endpoint mapping not audited. |
| FE response mapping must match backend response. | `PARTIAL` | Needs `API_CONTRACT.md` and `DATA_CONTRACT.md`. |
| Admin/web/backend use canonical data shape. | `NEEDS_VERIFICATION` | Previous docs mention contract drift risk. |
| Enum/status values are consistent. | `PARTIAL` | Backend state machines clear; UI mapping needs verify. |
| Null/missing fields are handled. | `NEEDS_VERIFICATION` | Needs UI/data mapping audit. |
| Error format handled by frontend. | `NEEDS_VERIFICATION` | Backend error shape exists; UI handling not verified. |

## 25. Test Coverage Criteria

| Area | Required Tests | Existing Evidence | Status | Missing |
|---|---|---|---|---|
| Product | Unit/integration tests for required fields, duplicate slug, publish transitions, public visibility. | Code evidence, no direct tests found. | `MISSING_TEST_COVERAGE` | Positive/negative tests. |
| Category/Brand | Visibility, duplicate slug, category tree invalid cases. | Code evidence, no direct tests found. | `MISSING_TEST_COVERAGE` | Positive/negative tests. |
| Public Web | Homepage/listing/detail/search render, empty/error states, SEO basics. | Vitest script exists. | `NEEDS_VERIFICATION` | Test files/run result. |
| Checkout | Cart/quick-buy success, invalid address/payment/shipping/stock, price change. | Phase 1F report. | `NEEDS_VERIFICATION` | Fresh tests and UI/E2E. |
| Order | Allowed/forbidden order/payment transitions, refund rules. | Code evidence. | `MISSING_TEST_COVERAGE` | Transition tests. |
| Shipping | Enabled/disabled/multiple method selection. | Code evidence. | `MISSING_TEST_COVERAGE` | Negative tests. |
| Inventory | Oversell, stock decrement, restore, movement, concurrency. | Code evidence. | `MISSING_TEST_COVERAGE` | Integration/concurrency tests. |
| Return | Allowed/forbidden transitions, customer scoping, stock/refund effects. | Code evidence. | `MISSING_TEST_COVERAGE` | Positive/negative tests. |
| Media | MIME, size, upload, delete/restore, storage failure. | Code evidence. | `MISSING_TEST_COVERAGE` | Unit/integration tests. |
| Content/SEO | Required fields, publish transitions, public filtering, SEO render. | Code evidence. | `MISSING_TEST_COVERAGE` | Tests and smoke. |
| RBAC | Guest/customer/admin boundaries, permission denial, Super Admin guardrails. | Code evidence. | `MISSING_TEST_COVERAGE` | Security tests. |
| Reports | Permission, filters, metrics with refunds/cancellations. | API evidence. | `MISSING_TEST_COVERAGE` | Metric tests. |
| Release gate | Web/admin build/lint/test, backend Maven tests, Docker build, smoke/E2E. | Scripts/deps exist. | `NEEDS_VERIFICATION` | CI/current run evidence. |

## 26. Release Gate Criteria

| App / Layer | Gate Command / Evidence | Status | Notes |
|---|---|---|---|
| Public Web | `npm run build`, `npm run lint`, `npm run test`, `npm run test:coverage` in `bigbike-web`. | `NEEDS_VERIFICATION` | Scripts exist in `bigbike-web/package.json`; not run here. |
| Admin Web | `npm run build`, `npm run lint` in `bigbike-admin`. | `NEEDS_VERIFICATION` | Scripts exist; no test script found. |
| Backend | Maven build/test via `pom.xml`, typically `mvn test` / `mvn package`. | `NEEDS_VERIFICATION` | Test dependencies exist; no command run here. |
| Docker/Infra | `docker-compose.yaml`. | `NEEDS_VERIFICATION` | Compose exists from prior docs; docker build/up not run here. |
| CI | `.github/workflows` or equivalent CI config. | `NEEDS_VERIFICATION` | Repository search/list did not surface CI config in this task. |
| Smoke/E2E | Playwright/Cypress/API smoke. | `NOT_FOUND_IN_REPO` / `NEEDS_VERIFICATION` | No confirmed E2E gate found in this audit. |
| Release-ready decision | All above gates pass, plus critical tests pass. | `NEEDS_VERIFICATION` | Do not call release-ready without actual run results. |

## 27. Missing / Needs Verification Criteria

| Area | Missing / Needs Verification |
|---|---|
| Frontend UI states | Loading/empty/error/submitting/success/permission denied/not found/fallback media across public/admin. |
| Frontend/backend mapping | Full API/data contract matching for admin/web/mobile. |
| Tests | Direct test coverage for most business rules/state transitions not found. |
| CI | No confirmed GitHub Actions/CI config found in this task. |
| Payment | External gateway/webhook/QR reconciliation not found. |
| Shipping | Carrier/tracking/waybill lifecycle not found. |
| Fulfillment | `fulfillmentStatus` exists but transition logic not confirmed. |
| Inventory | Serial lifecycle, duplicate restore prevention, concurrency/oversell tests. |
| Return/refund | Return refunded vs order refund flow consistency. |
| Content/SEO | Public filtering, sitemap/robots, redirect migration coverage, per-page metadata. |
| Media | Public URL/CDN, inactive/deleted media rendering, magic-byte validation. |
| RBAC/Auth | Production admin auth, disabled/suspended login blocking, UI permission guard. |
| Reports | Revenue/report semantics with cancelled/refunded/unpaid orders. |
| Settings | Public settings sensitive key whitelist/source verification. |
| Coupon | Admin coupon exists; checkout coupon docs/code drift needs tests. |
| Mobile app | Flutter routes exist in prior docs; official production scope and acceptance criteria need confirmation. |

## 28. Evidence Summary

| Area | Evidence Path | What It Proves | Confidence |
|---|---|---|---|
| Project docs | `docs/business/PROJECT_OVERVIEW.md` | Project/business context. | High |
| Business process | `docs/business/BUSINESS_PROCESS.md` | Business process baseline. | High |
| Module catalog | `docs/business/MODULE_CATALOG.md` | Module/feature inventory. | High |
| User roles | `docs/business/USER_ROLES.md` | Actor/role mapping. | High |
| Workflow overview | `docs/business/WORKFLOW_OVERVIEW.md` | End-to-end workflow context. | High |
| Business rules | `docs/business/BUSINESS_RULES.md` | Backend-enforced rules and gaps. | High |
| State machines | `docs/business/STATE_MACHINES.md` | Entity states/transitions and missing state machines. | High |
| Public web scripts | `bigbike-web/package.json` | Build/lint/test scripts and dependencies. | High |
| Admin scripts | `bigbike-admin/package.json` | Build/lint scripts, no test script observed. | High |
| Backend build/test deps | `bigbike-backend/pom.xml` | Maven project, Spring Boot deps, test deps, Java 17. | High |
| Product states | `PublishStatus.java`, `AdminMutationValidators.java`, `AdminCatalogMutationService.java` | Publish statuses and transitions. | High |
| Public catalog visibility | `CatalogReadService.java` | Public product/category/brand filtering. | High |
| Checkout | `CheckoutController.java`, `CheckoutService.java` | Cart/quick-buy/order/payment/shipping/stock side effects. | High |
| Order/payment | `AdminOrderController.java`, `AdminOrderService.java` | Order/payment transitions/refund/audit/stock/notification/websocket. | High |
| Inventory | `AdminInventoryController.java`, `ProductStockState.java`, `InventoryPolicyService.java` | Inventory APIs and stock state rules. | High |
| Return | `CustomerOrderController.java`, `AdminReturnController.java`, `AdminReturnService.java` | Customer/admin return lifecycle. | High |
| Media | `AdminMediaController.java`, `AdminMediaService.java`, `MinioConfig.java` | Media upload/status/storage lifecycle. | High |
| Content/SEO | `AdminContentController.java`, `AdminContentMutationService.java`, `ContentController.java`, `bigbike-web/app/page.tsx` | Content CRUD/publish and homepage SEO evidence. | High |
| RBAC | `SecurityConfig.java`, `AdminRolePermissions.java`, `DevAdminAuthService.java`, `AdminAdminUsersService.java` | Access boundaries, permissions, role/user guardrails. | High |
| Settings/Menu/Coupon | Phase 1J report, settings/menu/coupon controllers | Backend modules and documented tests. | Medium-High |
| Reports | `AdminDashboardController.java`, `AdminReportController.java`, `AdminInventoryController.java` | Reporting/export APIs. | High |

## 29. Known Ambiguities / Needs Verification

1. Many backend criteria pass at service/controller level, but full module/workflow remains `PARTIAL` without UI runtime and test coverage evidence.
2. Direct test files for key business rules/state transitions were not found by targeted search in this task.
3. Existing phase reports are useful but not a fresh CI/build/test proof.
4. Public settings sensitive-key guard is documented but needs source-level whitelist/blacklist audit.
5. Coupon checkout integration has docs/code drift: older report says deferred, current checkout service appears to apply cart coupons.
6. Fulfillment status exists in order detail but no explicit state machine was found.
7. External payment provider/webhook/QR reconciliation was not found.
8. External shipping provider/tracking/waybill workflow was not found.
9. Content public filtering by publish status needs deeper read-service audit.
10. Media `INACTIVE`/`DELETED` public rendering behavior needs verification.
11. Admin disabled/suspended login blocking needs auth-service audit.
12. Report/revenue definitions need business confirmation, especially cancelled/refunded/unpaid orders.
13. Frontend UI states and responsive behavior need visual/runtime audit.
14. CI/GitHub Actions config was not confirmed in this task.
15. Build/lint/test were not run during this documentation task. Do not treat this file as release evidence.

## 30. Relationship With Other Docs

| Document | Relationship |
|---|---|
| `PROJECT_OVERVIEW.md` | Tổng quan dự án. |
| `BUSINESS_PROCESS.md` | Process nghiệp vụ. |
| `MODULE_CATALOG.md` | Module và feature. |
| `USER_ROLES.md` | Actor/role. |
| `WORKFLOW_OVERVIEW.md` | Workflow end-to-end. |
| `BUSINESS_RULES.md` | Rule dùng làm tiêu chí pass/fail. |
| `STATE_MACHINES.md` | State transition dùng làm tiêu chí pass/fail. |
| `ACCEPTANCE_CRITERIA.md` | File hiện tại: điều kiện nghiệm thu module/feature/workflow. |
| `API_CONTRACT.md` | Contract chi tiết. |
| `DATA_CONTRACT.md` | Data shape chi tiết. |
| `PERMISSION_MATRIX.md` | Permission chi tiết. |
| `TESTING_GUIDE.md` | Cách chạy test. |
| `TRACEABILITY_MATRIX.md` | Nối criteria với module/feature/workflow/API/test. |

## Audit Notes

Documentation này được tạo bằng thao tác đọc/inspect repository qua GitHub connector. Không chạy migration, seed, deploy, refactor, build/test hoặc command có side effect. Không sửa business logic hoặc source code ứng dụng.
