# BigBike API & Data Contract Audit

> Audit date: 2026-05-16
> Auditor role: Senior Software Architect / API Contract Auditor
> Phase: AUDIT + TRACE + REPORT (no bulk refactor, no business-rule changes)
> Scope: `bigbike-web`, `bigbike-admin`, `bigbike_mobile`, `bigbike-backend`, Flyway migrations

## Audit Methodology & Depth Disclosure

This audit is **trace-based and evidence-cited**. Every finding below references a real file
read during the audit. To be honest about confidence level:

- **Fully traced:** backend REST surface (50 controllers, ~190 endpoints), the 3 frontend API
  clients (`public-api.ts`, `client-api.ts`, `adminApi.js`, `api_endpoints.dart`), the global
  error contract, and the source-of-truth docs (`API_CONTRACT.md`, `DATA_CONTRACT.md`,
  `PERMISSION_MATRIX.md`).
- **Spot-checked (representative, not exhaustive):** DTO ↔ entity ↔ frontend-type field
  alignment was verified for the highest-risk domains (Order, Product, Shipping, Checkout,
  Customer) but **not** for every one of the ~190 endpoints. Domains marked
  `NOT_EXHAUSTIVELY_VERIFIED` below need a follow-up pass.
- A column-by-column diff of every Flyway migration vs every JPA entity was **not** performed;
  this report verifies the specific columns named in findings.

Where evidence was insufficient, the finding is marked `NEEDS_CONFIRMATION` or `UNKNOWN`
rather than guessed.

---

## 1. Executive Summary

| Metric | Value |
|---|---|
| Backend controllers inventoried | 50 |
| Backend REST endpoints inventoried | ~190 |
| Frontend API clients traced | 3 (web public + web client, admin, mobile) |
| Core data domains reviewed | 18 |
| Flyway migrations on disk | V1 → V122 |

### Issue count by severity

| Severity | Count |
|---|---|
| Critical | 0 |
| High | 1 |
| Medium | 4 |
| Low | 5 |

### Verdict

The contract surface is **largely production-safe**. The backend uses a single global
exception handler producing a uniform error envelope, a consistent `ApiDataResponse` /
`ApiListResponse` wrapper for most public/customer endpoints, and the highest-risk
request/response DTOs that were traced (Order detail, Order list, Checkout options, Product)
align field-for-field with the consuming frontend TypeScript types.

**No frontend-calls-a-nonexistent-endpoint and no enum/status divergence was found in the
traced surface.** The single High-severity issue is a **documentation contradiction** — not a
runtime bug — but it is dangerous because it would lead a future developer to write code
against database columns that no longer exist (`is_featured` / `show_on_homepage`, dropped in
V111). Per the repo's Docs-First Contract, an internally contradictory source-of-truth doc is
treated as High severity.

Remaining items are documentation drift, one dead query param, the known response-wrapper
inconsistency on customer-returns endpoints, and cross-app feature-parity gaps in the mobile
client. None block production for web + admin; mobile gaps should be confirmed as intentional.

---

## 2. API Inventory

Status legend: **OK** = backend exists and at least one client consumes it correctly ·
**UNUSED** = backend exists, no traced client consumes it · **MISSING_CLIENT** = backend
exists, no client wrapper (may be intentional) · **MISSING_BACKEND** = client calls it but no
backend route.

### 2.1 Public & catalog

| Method | Endpoint | Controller | Auth | Used by | Status |
|---|---|---|---|---|---|
| GET | `/api/v1/products` | CatalogController | public | web, mobile | OK |
| GET | `/api/v1/products/{slug}` | CatalogController | public | web, mobile | OK |
| GET | `/api/v1/products/{idOrSlug}/snapshot` | CatalogController | public | web, mobile | OK |
| GET | `/api/v1/categories` | CatalogController | public | web, mobile | OK |
| GET | `/api/v1/categories/{slug}` | CatalogController | public | web, mobile | OK |
| GET | `/api/v1/brands` | CatalogController | public | web, mobile | OK |
| GET | `/api/v1/brands/{slug}` | CatalogController | public | web, mobile | OK |
| GET | `/api/v1/articles` `/{slug}` | ContentController | public | web, mobile | OK |
| GET | `/api/v1/pages` `/{slug}` | ContentController | public | web, mobile | OK |
| GET | `/api/v1/menus/{location}` | PublicMenuController | public | web, mobile | OK |
| GET | `/api/v1/sliders` | PublicSliderController | public | web, mobile | OK |
| GET | `/api/v1/home-videos` | PublicHomeVideoController | public | web; mobile constant declared, widget pending | OK |
| GET | `/api/v1/settings/public` | PublicSettingsController | public | web, mobile | OK |
| GET | `/api/v1/search` `/search-suggest` | PublicSearchController | public | web, mobile | OK |
| GET | `/api/v1/address/**` | VnAddressController | public | web, mobile | OK |
| GET/POST | `/api/v1/products/{productId}/reviews` | PublicReviewController | public / customer | web, mobile | OK |
| POST | `/api/v1/contact` | ContactController (public) | public | web, mobile | OK |
| GET | `/v3/api-docs` | OpenApiStaticController | public | tooling only | MISSING_CLIENT (intentional) |
| GET/POST | `/api/internal/redirect**` | InternalRedirectController | permitAll (infra-gated) | web middleware | OK |

### 2.2 Cart / checkout / orders (customer + guest)

| Method | Endpoint | Controller | Auth | Used by | Status |
|---|---|---|---|---|---|
| GET/POST/PATCH/DELETE | `/api/v1/cart**` | CartController | session + CSRF | web, mobile | OK |
| POST | `/api/v1/cart/coupons`, DELETE `/coupons/{code}` | CartController | session + CSRF | web, mobile | OK |
| POST | `/api/v1/checkout` | CheckoutController | session/guest + CSRF | web, mobile | OK |
| GET | `/api/v1/checkout/options` | CheckoutController | public | web, mobile | OK |
| POST | `/api/v1/orders/quick-buy` | CheckoutController | session/guest + CSRF | web, mobile | OK |
| GET | `/api/v1/orders/lookup` | OrderLookupController | public | web, mobile | OK |
| GET | `/api/v1/customer/orders` `/{id}` | CustomerOrderController | CUSTOMER | web, mobile | OK |
| PATCH | `/api/v1/customer/orders/{id}/cancel` | CustomerOrderController | CUSTOMER | web | MISSING_CLIENT (mobile) — see F-07 |
| GET/POST | `/api/v1/customer/orders/returns**` | CustomerOrderController | CUSTOMER | web, mobile | OK — see F-05 (wrapper) |
| GET | `/api/v1/customer/orders/{id}/return-eligibility` | CustomerOrderController | CUSTOMER | web | MISSING_CLIENT (mobile) — see F-07 |

### 2.3 Customer account / auth / wishlist

| Method | Endpoint | Controller | Auth | Used by | Status |
|---|---|---|---|---|---|
| POST | `/api/v1/customer/auth/{register,login,logout,refresh}` | CustomerAuthController | public/session | web, mobile | OK |
| POST | `/api/v1/customer/auth/verify-email` | CustomerAuthController | public | web, mobile | OK |
| POST | `/api/v1/customer/auth/resend-verification` | CustomerAuthController | CUSTOMER | web, mobile | OK |
| POST | `/api/v1/customer/auth/password/{forgot,reset}` | CustomerAuthController | public | web, mobile | OK |
| GET/PATCH | `/api/v1/customer/me` | CustomerController | CUSTOMER | web, mobile | OK |
| GET/POST/PATCH/DELETE | `/api/v1/customer/addresses**` | CustomerAddressController | CUSTOMER | web, mobile | OK |
| GET/POST/DELETE | `/api/v1/customer/wishlist**` | CustomerWishlistController | CUSTOMER | web | MISSING_CLIENT (mobile) — see F-07 |

### 2.4 Admin surface (38 endpoints across 28 admin controllers)

All `/api/v1/admin/**` endpoints require a Spring `ROLE_ADMIN` plus a controller-level
`requirePermission(...)` check. Every admin endpoint enumerated below has a matching wrapper
in `bigbike-admin/src/lib/adminApi.js`, **with one exception**:

| Method | Endpoint | Controller | Permission | Status |
|---|---|---|---|---|
| GET | `/api/v1/admin/warranties/by-serial/{serialId}` | AdminWarrantyController | `warranty.read` | **UNUSED** — no `adminApi.js` wrapper found (F-08) |

Admin modules with full client coverage (backend ↔ `adminApi.js` 1:1, **OK**): products,
categories, brands, content (articles/pages/authors/content-categories/reference), redirects,
orders (+ notes/refund/fulfillment/status/payment-status/allowed-transitions), customers
(+ status/credit/coupon-gift), media, media-folders, settings, coupons, coupon-gifts/bulk,
menus, sliders, home-videos, shipping zones/methods, admin-users, roles, permissions,
reviews, audit-logs, reports (analytics + 3 CSV exports), inventory (stock + serials +
movements + import + export.csv), returns (+ inspect), contact-messages, dashboard, pos
(search + orders + refund), receivables (+ payments/write-off/aging/summary), notifications.

### 2.5 WebSocket

| Item | Contract | Status |
|---|---|---|
| `/ws` STOMP CONNECT | native `Authorization: Bearer <admin-jwt>`, roles `ADMIN`/`SUPER_ADMIN` | OK |
| `/topic/admin/orders` | `OrderWsEvent` payload | OK — consumed by `adminWebSocket.js` |

---

## 3. Data Contract Inventory

Domains traced during this audit. "DTO↔Type aligned" reflects what was **actually diffed**,
not an assumption.

| Domain | DB / migration | Entity | Response DTO | FE type (web) | DTO↔Type aligned? |
|---|---|---|---|---|---|
| Order (detail) | `orders` + V7/V100/V114/V116 | OrderEntity | `OrderDetailResponse` | `OrderDetail` (commerce.ts) | **YES — all 20 fields match** |
| Order (list) | `orders` | OrderEntity | `OrderListItemResponse` | `OrderListItem` | **YES — incl. `itemCount`** |
| Checkout options | `shipping_*` | ShippingMethod | `ShippingMethodOptionResponse` | `ShippingMethodOption` | **YES — incl. `zoneRegionCode`** (doc lags, see F-03) |
| Product | `products` + V95/V108/V110/V111 | ProductEntity | `Product` (domain record) | `Product` (public.ts) | YES for traced fields; `homepageBlock`/`homepageOrder` present, legacy boolean pair dropped |
| Customer address | `customer_addresses` | — | `CustomerAddressResponse` | `CustomerAddress` | YES |
| Customer profile | `customers` + V75 | CustomerEntity | — | `CustomerProfile` | NOT_EXHAUSTIVELY_VERIFIED |
| Cart | `carts`/`cart_items` + V115 | CartEntity | — | `Cart` / `CartItem` | NOT_EXHAUSTIVELY_VERIFIED |
| Return | `returns*` + V104 | ReturnEntity | `CustomerReturnResponse` | `CustomerReturn` | NOT_EXHAUSTIVELY_VERIFIED |
| Receivable / credit | `accounts_receivable` V75/V83 | — | `Receivable*Response` | (admin only) | NOT_EXHAUSTIVELY_VERIFIED |
| Coupon | `coupons` + V73/V118/V119 | CouponEntity | — | (admin only) | NOT_EXHAUSTIVELY_VERIFIED |
| Inventory / serial | `stock_movements*` V57/V99/V120 | StockMovement* | — | (admin only) | NOT_EXHAUSTIVELY_VERIFIED |
| Auth/role/permission | `role_permissions` + V81/V109/V121/V122 | — | — | — | Permission catalog reviewed (§7) |
| Content/Page/Article | `articles`/`pages` V93/V98 | ArticleEntity/PageEntity | — | `Article`/`Page` | Hero fields verified present |
| Media | `media*` V85 | MediaEntity | `AdminMediaDetailResponse` | (admin only) | NOT_EXHAUSTIVELY_VERIFIED |
| Notification | `admin_notifications` V102 | — | — | (admin only) | NOT_EXHAUSTIVELY_VERIFIED |
| Slider / HomeVideo | `sliders` V92, `home_videos` | — | — | `HomeSlider`/`HomeVideo` | NOT_EXHAUSTIVELY_VERIFIED |
| Settings | `site_settings` V94/V107 | SiteSettingEntity | `AdminSiteSettingResponse` | `PublicSiteSetting` | NOT_EXHAUSTIVELY_VERIFIED |
| Contact message | `contact_messages` V105 | — | — | (admin only) | NOT_EXHAUSTIVELY_VERIFIED |

---

## 4. Contract Mismatch Findings

### F-01 — DATA_CONTRACT.md documents dropped columns as current

- **Severity:** High
- **Contract type:** DATA / DOC
- **Location:** `docs/engineering/DATA_CONTRACT.md` §"Product homepage flags and ordering" (lines ~203–221)
- **Evidence:**
  - DATA_CONTRACT.md still describes three columns: `is_featured` (`isFeatured`),
    `show_on_homepage` (`showOnHomepage`), `homepage_order` — as the current schema, with
    block-placement rules ("Max 12 shown… Max 5 shown… deduplication on web").
  - `bigbike-backend/.../persistence/entity/catalog/ProductEntity.java:125-128` declares
    **only** `homepage_block` (enum, `NOT NULL DEFAULT NONE`) and `homepage_order`. There is
    no `is_featured` / `show_on_homepage` field on the entity.
  - `docs/engineering/API_CONTRACT.md` §"Admin Catalog Contract" states migration
    `V111__refactor_product_homepage_block.sql` (2026-05-14) backfilled and **dropped** the
    legacy boolean pair.
  - Migration `V111__refactor_product_homepage_block.sql` exists on disk.
- **Problem:** The two halves of the single source of truth contradict each other.
  API_CONTRACT.md and the code agree on the `homepageBlock` enum model; DATA_CONTRACT.md was
  not updated when V111 landed.
- **Impact:** A developer who reads DATA_CONTRACT.md first (the Docs-First Contract requires
  exactly this) would write a query/DTO against `is_featured` / `show_on_homepage` and hit a
  compile/runtime failure, or re-introduce the dropped columns.
- **Recommended fix:** Replace the DATA_CONTRACT.md section with the single-slot
  `homepageBlock` enum model (`NONE | FEATURED_GRID | RECOMMENDED_CAROUSEL`) + `homepage_order`,
  matching API_CONTRACT.md and `ProductEntity`. Keep `homepage_order` documentation as-is.
- **Auto-fix allowed:** Yes (documentation only, no contract change).
- **NEEDS_CONFIRMATION:** No.
- **Status: FIXED** — `docs/engineering/DATA_CONTRACT.md` §"Product homepage placement (V111+)" rewritten 2026-05-16.

### F-02 — API_CONTRACT.md "Mobile Coverage Notes" is stale

- **Severity:** Low
- **Contract type:** DOC
- **Location:** `docs/engineering/API_CONTRACT.md` §"Mobile Coverage Notes"
- **Evidence:** The doc states *"Verify-email and home-videos are not currently wrapped in
  `api_endpoints.dart`"* (`CODE_ONLY_NOT_DOCUMENTED`). In fact
  `bigbike_mobile/lib/core/api/api_endpoints.dart` declares both:
  `verifyEmail` (line 52) and `homeVideos` (line 26).
- **Problem:** Stale doc note; both endpoints are wrapped.
- **Impact:** Minor — misleads contract reviewers; no runtime effect.
- **Recommended fix:** Update the note to reflect that both constants now exist (home-videos
  widget integration is still pending per the in-file comment, which is accurate).
- **Auto-fix allowed:** Yes (documentation only).
- **NEEDS_CONFIRMATION:** No.
- **Status: FIXED** — `docs/engineering/API_CONTRACT.md` §"Mobile Coverage Notes" updated 2026-05-16.

### F-03 — `zoneRegionCode` missing from API_CONTRACT.md checkout-options shape

- **Severity:** Low
- **Contract type:** DOC
- **Location:** `docs/engineering/API_CONTRACT.md` §"Checkout Options Contract"
- **Evidence:** Doc lists `shippingMethods` items as
  `{ id, code, title, cost, freeShippingThreshold, minOrderAmount }`.
  `ShippingMethodOptionResponse.java` actually has a 7th field `String zoneRegionCode`, and
  the web type `ShippingMethodOption` (`commerce.ts:70-78`) also declares `zoneRegionCode`.
  Backend and frontend **agree**; only the doc is incomplete.
- **Problem:** Documentation omits a real field.
- **Impact:** Minor — no runtime effect; frontend already consumes it.
- **Recommended fix:** Add `zoneRegionCode` (nullable string) to the documented shape.
- **Auto-fix allowed:** Yes (documentation only).
- **NEEDS_CONFIRMATION:** No.
- **Status: FIXED** — `docs/engineering/API_CONTRACT.md` §"Checkout Options Contract" updated with `zoneRegionCode` field 2026-05-16.

### F-04 — `filter_gender` is a dead query param on `GET /api/v1/products`

- **Severity:** Low
- **Contract type:** API
- **Location:** `bigbike-backend/.../api/catalog/CatalogController.java:65,83`
- **Evidence:** `listProducts` declares
  `@RequestParam(name = "filter_gender", required = false) String filterGender`, but the call
  into `catalogReadService.listProducts(...)` passes a literal `null` in that argument
  position (`filterColor, null, minPrice, ...`). The param is parsed and discarded.
  No traced client (`public-api.ts`, `api_endpoints.dart`) sends `filter_gender`.
- **Problem:** Accepted-but-ignored query parameter. The admin product list
  (`AdminCatalogController`) was not checked for the same param.
- **Impact:** Minor — a caller using `filter_gender` would silently get unfiltered results
  (false "it works" signal). It is also a maintenance trap.
- **Recommended fix:** Either (a) remove the unused param, or (b) wire it into the service if
  gender filtering is an intended product feature.
- **Auto-fix allowed:** No — choosing (a) vs (b) is a product decision.
- **NEEDS_CONFIRMATION:** Yes — confirm whether gender filtering is planned.

### F-05 — Response-wrapper inconsistency on customer-returns endpoints

- **Severity:** Medium
- **Contract type:** API / ERROR-SHAPE
- **Location:** `CustomerOrderController.java` (returns endpoints); already self-flagged in
  `API_CONTRACT.md` ("wrapper inconsistency") and §"Response Shape Caveats".
- **Evidence:**
  - `GET /customer/orders/returns` returns raw `List<CustomerReturnResponse>`,
    `GET /customer/orders/returns/{id}` and `POST /customer/orders/{id}/returns` return raw
    `CustomerReturnResponse` — **not** wrapped in `ApiDataResponse` / `ApiListResponse`, unlike
    nearly every other public/customer endpoint.
  - Web survives this only because `client-api.ts:57` does
    `return (payload as { data: T }).data ?? (payload as T)` — a defensive fallback that
    accepts both wrapped and raw payloads.
- **Problem:** The same domain (customer orders) uses two different envelope conventions.
  Any client that strictly assumes the `{data, meta}` envelope (a future SDK, a stricter
  mobile parser) will break on these three routes.
- **Impact:** Medium — currently masked by the web fallback; a latent break for stricter
  consumers and a violation of contract uniformity.
- **Recommended fix:** Wrap the three returns endpoints in `ApiDataResponse` /
  `ApiListResponse` like the rest of the customer surface. This **changes the public response
  shape**, so it requires a coordinated FE update (remove the `?? raw` fallback) and a doc
  update — do not auto-fix.
- **Auto-fix allowed:** No.
- **NEEDS_CONFIRMATION:** Yes — public response-shape change; needs migration plan.

### F-06 — Web `ApiErrorDetail.field` typed non-nullable but backend can send `null`

- **Severity:** Low
- **Contract type:** DATA (type precision)
- **Location:** `bigbike-web/lib/contracts/public.ts:15-19` vs
  `bigbike-backend/.../api/error/GlobalExceptionHandler.java:64-68`
- **Evidence:** Web `ApiErrorDetail = { field: string; code: string; message: string }`.
  `handleUnreadableMessage` constructs `new ApiErrorDetail(null, "INVALID_VALUE", ...)` —
  i.e. `field` is `null` for malformed-body / invalid-enum errors.
- **Problem:** TypeScript type is stricter than the real contract.
- **Impact:** Low — could cause incorrect non-null assumptions in error rendering; no crash
  because JS tolerates it.
- **Recommended fix:** Change web type to `field: string | null`.
- **Auto-fix allowed:** Yes (frontend type only, no API change).
- **NEEDS_CONFIRMATION:** No.
- **Status: FIXED** — `bigbike-web/lib/contracts/public.ts` `ApiErrorDetail.field` changed to `string | null` 2026-05-16.

### F-07 — Mobile client lacks wishlist, order-cancel, and return-eligibility

- **Severity:** Medium
- **Contract type:** API (cross-app coverage)
- **Location:** `bigbike_mobile/lib/core/api/api_endpoints.dart`
- **Evidence:** `api_endpoints.dart` declares no constants for, and the mobile feature folders
  contain no module for:
  - Wishlist — `GET/POST/DELETE /api/v1/customer/wishlist**` (web has a full wishlist client).
  - Order cancel — `PATCH /api/v1/customer/orders/{id}/cancel` (web: `cancelMyOrder`).
  - Return eligibility — `GET /api/v1/customer/orders/{id}/return-eligibility`
    (web pre-checks before opening a return).
- **Problem:** Mobile customers cannot use wishlist, cannot self-cancel an order, and the
  mobile return flow has no eligibility pre-check (it can only attempt a return and handle the
  failure reason after the fact).
- **Impact:** Medium — feature-parity gap, not a contract bug. Backend contract is fine; the
  mobile app simply does not consume part of it.
- **Recommended fix:** Confirm with product whether these are intentionally web-only. If not,
  add the endpoint constants + mobile screens. The return-eligibility check in particular
  improves mobile UX (stable reason codes are already defined backend-side).
- **Auto-fix allowed:** No — product scope decision.
- **NEEDS_CONFIRMATION:** Yes.

### F-08 — `GET /admin/warranties/by-serial/{serialId}` has no admin client wrapper

- **Severity:** Low
- **Contract type:** API (unused endpoint)
- **Location:** `AdminWarrantyController.java:31` vs `adminApi.js`
- **Evidence:** `adminApi.js` only wraps `/admin/warranties` (list) and
  `/admin/warranties/{id}/void`. No call to `by-serial/{serialId}` was found in
  `bigbike-admin/src`.
- **Problem:** Endpoint may be dead, or may be consumed via a path not detected by the audit
  grep (e.g. built dynamically).
- **Impact:** Low — unused surface area; minor maintenance/attack-surface concern.
- **Recommended fix:** Confirm whether a serial-detail screen needs it. If genuinely unused,
  either wire it into the serial-detail UI or remove the endpoint.
- **Auto-fix allowed:** No.
- **NEEDS_CONFIRMATION:** Yes.

---

## 5. Cross-App Inconsistency

| # | Inconsistency | Apps | Detail |
|---|---|---|---|
| X-1 | Wishlist exists on web, absent on mobile | web vs mobile | F-07 |
| X-2 | Order self-cancel exists on web, absent on mobile | web vs mobile | F-07 |
| X-3 | Return-eligibility pre-check exists on web, absent on mobile | web vs mobile | F-07 |
| X-4 | Returns endpoints use raw payloads; rest of customer surface uses `ApiDataResponse`/`ApiListResponse` | backend internal | F-05 |
| X-5 | `homepageBlock` enum model in code/API_CONTRACT.md vs legacy boolean model still in DATA_CONTRACT.md | docs internal | F-01 |
| X-6 | `home-videos` constant present in mobile but no widget consumes it yet | mobile internal | Tracked in-file comment (`CMS-004`); accurate, not a defect |

**Positive cross-app findings (no inconsistency):**

- Enum/status values are consistent: web `PublishStatus` (`DRAFT|PUBLISHED|HIDDEN|TRASH`) and
  `ProductStockState` (`IN_STOCK|LOW_STOCK|OUT_OF_STOCK`) match backend domain enums and the
  `homepage_block` regex (`NONE|FEATURED_GRID|RECOMMENDED_CAROUSEL`) is identical between
  `CatalogController` (public) and the web `ProductListQuery` type. No `PENDING_PAYMENT`
  vs `pending_payment`-style casing divergence was found.
- Money: backend serializes `BigDecimal`; web types use `number`. JSON numbers parse cleanly —
  no string/number divergence found. (VND scale-2 serialization documented in DATA_CONTRACT.md.)
- IDs: order/customer/address IDs are UUID strings backend-side and `string` in web types;
  product/category/brand IDs are prefixed varchar strings and typed `string`. No
  number-vs-string ID divergence found.
- `homepage_block` (public) vs `homepageBlock` (admin) param-name difference is **intentional
  and documented** in API_CONTRACT.md — not a defect.

---

## 6. Error Contract Audit

| Aspect | Finding |
|---|---|
| Uniform envelope | **OK.** `GlobalExceptionHandler` (`@RestControllerAdvice`) produces `ApiErrorResponse = { error: { code, message, details[] }, meta }` for every handled exception. Web `parseError` (`public-api.ts:71`) and `client-api.ts` both read `payload.error.message` — consistent. |
| Validation errors | **OK.** Bean Validation / constraint / bind / type-mismatch / unreadable-body all map to HTTP 400 `VALIDATION_ERROR` with a `details[]` array of `{field, code, message}`. Predictable. |
| Auth/permission errors | **Partial.** `requirePermission(...)` is enforced in admin controllers; Spring Security gates `/admin/**` and `/customer/**`. HTTP status codes for 401/403 were not exhaustively traced — recommend confirming 401 (unauthenticated) vs 403 (authenticated-but-forbidden) are distinct and consistent. |
| Conflict errors | **OK.** `DataIntegrityViolationException` → 409 `DATA_CONFLICT`; `ObjectOptimisticLockingFailureException` → 409 `CONCURRENT_MODIFICATION`. |
| Catch-all | **OK.** Unhandled `Exception` → 500 `SERVER_ERROR`, no stack-trace leak in the body. |
| Type precision | **Minor.** `details[].field` can be `null` (F-06); web type says non-nullable. |

Conclusion: the error contract is **consistent and production-safe** on the backend; the only
fix is the web-side nullability of `field` (F-06).

---

## 7. Permission Contract Audit

- **Runtime source of truth:** DB table `role_permissions`, resolved by
  `AdminPermissionService`. `PermissionCatalog.java` is the canonical key catalog;
  `AdminRolePermissions.java` is a non-runtime reference snapshot (per PERMISSION_MATRIX.md).
- **Enforcement model:** every traced admin controller calls
  `devAdminAuthService.requirePermission(request, "<perm>")`. Spot-checked
  `AdminMediaController` — all 11 handlers have a `requirePermission` call, and the
  irreversible hard-delete path is correctly escalated to wildcard `*` while soft-delete needs
  only `media.write`. This is a **good** least-privilege pattern.
- **Public exposure:** no admin or customer-scoped endpoint was found mounted under a public
  path. `/api/internal/redirect**` is `permitAll` by design, with the documented expectation
  that infrastructure restricts it in production (PERMISSION_MATRIX.md "Internal Redirect
  Caveat") — flagged here only so it stays on the deployment checklist.
- **Catalog ↔ endpoint hygiene:** recent migrations actively keep the permission catalog 1:1
  with real endpoints — V121 realigned `inventory.*` / `warranty.*` to the modules they
  actually gate, and V122 removed the orphan `receivables.export` permission. This is healthy.

**Not verified (follow-up needed):** whether the admin UI hides/disables actions the caller's
role cannot perform (UI-guard vs backend-guard parity). Backend enforcement is present; the
audit did not trace every admin React screen's conditional rendering. Marked `UNKNOWN` —
recommend a dedicated admin-UI permission-guard pass.

---

## 8. Recommended Canonical Contract

1. **Single source of truth — keep, but reconcile.** `API_CONTRACT.md` + `DATA_CONTRACT.md`
   remain canonical, but F-01/F-02/F-03 prove they drift. Add a release-checklist step:
   *"any migration that adds/drops a column updates DATA_CONTRACT.md in the same PR"* — the
   Docs-First Contract already mandates this; enforce it in PR review.
2. **OpenAPI as the executable contract.** `bigbike-openapi.json` already exists and is served
   at `/v3/api-docs`. Recommend a CI check that diffs the committed JSON against the live
   generated spec so controller drift fails the build. This would have caught F-04.
3. **Generated clients.** Consider generating the web `lib/contracts/*` types and the mobile
   `api_endpoints.dart` + models from the OpenAPI spec. This structurally eliminates the F-03
   / F-06 / F-07 class of drift (FE type stricter/looser than backend, missing endpoint).
4. **Standardize the response envelope.** Adopt `ApiDataResponse` / `ApiListResponse` for
   **every** JSON endpoint (fix F-05). Document the deliberate exceptions (CSV exports,
   `204 No Content`) explicitly so "raw payload" is never an accident.
5. **Enum single-sourcing.** Status/state enums are currently consistent but maintained in
   parallel (Java enum + TS union + Dart). Generating them from one source removes the risk.

---

## 9. Fix Plan

### Quick fixes (low risk, documentation/type only — auto-fixable)

| Item | Action | File | Status |
|---|---|---|---|
| F-01 | Rewrite "Product homepage flags" section to the `homepageBlock` enum model | `docs/engineering/DATA_CONTRACT.md` | **FIXED 2026-05-16** |
| F-02 | Correct the stale Mobile Coverage note (verify-email + home-videos are wrapped) | `docs/engineering/API_CONTRACT.md` | **FIXED 2026-05-16** |
| F-03 | Add `zoneRegionCode` to the documented checkout-options shape | `docs/engineering/API_CONTRACT.md` | **FIXED 2026-05-16** |
| F-06 | Change `ApiErrorDetail.field` to `string \| null` | `bigbike-web/lib/contracts/public.ts` | **FIXED 2026-05-16** |

### Contract fixes (need confirmation — do NOT auto-fix)

| Item | Action | Why blocked |
|---|---|---|
| F-04 | Remove or wire up `filter_gender` param | Product decision: is gender filtering planned? |
| F-05 | Wrap customer-returns endpoints in `ApiDataResponse`/`ApiListResponse` | Public response-shape change; needs coordinated FE + doc update |
| F-07 | Add wishlist / cancel / return-eligibility to mobile | Product scope decision |
| F-08 | Wire or remove `GET /admin/warranties/by-serial/{serialId}` | Confirm if a serial-detail screen needs it |

### DB / migration fixes

None required. No entity↔migration column mismatch was found in the traced columns. The
schema-vs-doc gap in F-01 is documentation-only — the schema itself (post-V111) is correct.

### Refactor suggestions (not now)

- OpenAPI-driven client/type generation (§8.3).
- CI OpenAPI-drift gate (§8.2).
- Dedicated admin-UI permission-guard audit (§7, `UNKNOWN`).
- Exhaustive DTO↔entity↔FE-type diff for the 13 domains marked `NOT_EXHAUSTIVELY_VERIFIED`
  in §3.

---

## 10. Acceptance Criteria

| Criterion | Status |
|---|---|
| No frontend calls a non-existent endpoint | **PASS** (traced surface) |
| No API response missing a field the UI uses | **PASS** (traced domains: Order, Product, Checkout, Shipping, Customer) |
| No enum/status divergence backend ↔ frontend | **PASS** (traced surface) |
| No serious DB / entity / DTO mismatch | **PASS** (traced columns); 13 domains still `NOT_EXHAUSTIVELY_VERIFIED` |
| Error format unified | **PASS** (backend); F-06 minor FE type fix |
| Auth / permission contract clear | **PASS backend**; admin-UI guard parity `UNKNOWN` |
| Core workflows end-to-end consistent | **PASS** for browse → cart → checkout → order → admin-order; mobile parity gaps in F-07 |

**Contract-ready verdict:** **YES for `bigbike-web` + `bigbike-admin` + `bigbike-backend`**,
conditional on the four quick documentation/type fixes. **`bigbike_mobile` is contract-safe
for what it consumes** but has feature-coverage gaps (F-07) that should be explicitly
confirmed as intentional before launch sign-off.

---

## Appendix — Items explicitly NOT covered (so the next auditor knows)

- Per-field DTO↔entity↔FE-type diff for the 13 domains marked `NOT_EXHAUSTIVELY_VERIFIED` in §3.
- Column-by-column diff of all 122 Flyway migrations against all JPA entities.
- Admin React UI permission-guard rendering (§7, `UNKNOWN`).
- HTTP 401 vs 403 status-code consistency for auth failures (§6).
- `AdminCatalogController` (admin product list) was not checked for the F-04 `filter_gender`
  dead-param pattern — only the public `CatalogController` was.
- WebSocket payload field-level diff beyond the documented `OrderWsEvent` shape.
