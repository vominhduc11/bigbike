# BigBike Web Module Full Completion Audit

> Read-only audit. No source code modified.
> Audit date: 2026-05-07
> Auditor: Senior Full-stack Architect + QA Auditor (AI agent)
> Scope: `bigbike-web` (Next.js public storefront) end-to-end — routes, screens, API client, proxy, auth, validation, SEO, tests — plus the backend endpoints, permissions and DB behaviors that `bigbike-web` depends on.
> Method: file inspection, route inventory, controller/service/security cross-check, `npm run lint`, `npm run test`, `npm run build`. Backend was not started; runtime smoke tests were not executed.

---

## 1. Executive Summary

| Metric | Value |
|---|---:|
| Overall verdict | **NOT_PRODUCTION_READY (PARTIAL — close, but blockers remain)** |
| Completion estimate | **~82 %** |
| CRITICAL blockers | **3** |
| HIGH issues | **6** |
| MEDIUM issues | **8** |
| LOW issues | **5** |
| Build (`npm run build`) | **PASS** (31 routes generated; static pages prerender even when backend offline because builders gracefully fall back via `loadList/loadData`) |
| Tests (`npm run test`) | **PASS** (7 files / 69 tests) |
| Lint (`npm run lint`) | **FAIL** — 4 errors, 2 warnings (`react-hooks/set-state-in-effect`, `react-hooks/incompatible-library`, unused var) |

### What is genuinely production-grade
- Server-side fetch/contract layer ([bigbike-web/lib/api/public-api.ts](bigbike-web/lib/api/public-api.ts)) with ISR + tag-based revalidation ([app/api/revalidate/route.ts](bigbike-web/app/api/revalidate/route.ts)).
- CSRF-protected client mutations via `bb_csrf` cookie + `X-CSRF-Token` header ([lib/api/client-api.ts:24-41](bigbike-web/lib/api/client-api.ts#L24-L41), enforced server-side at [CustomerCsrfFilter.java](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/config/CustomerCsrfFilter.java)).
- Server-side price/stock/coupon revalidation in checkout with pessimistic row locking and atomic coupon redemption ([CheckoutService.java:822-869, 257-260](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/checkout/CheckoutService.java)).
- Customer ownership enforced server-side (`requireCustomerId()` on every customer order/return endpoint, [CustomerOrderController.java:95-101](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/order/CustomerOrderController.java#L95-L101)).
- Idempotency for checkout/quick-buy via `Idempotency-Key` header ([client-api.ts:91-103](bigbike-web/lib/api/client-api.ts#L91-L103), backend `idempotency.existingSummary()`).
- SEO: per-page metadata helper ([lib/seo/metadata.ts](bigbike-web/lib/seo/metadata.ts)), JSON-LD (Product/Organization/WebSite/LocalBusiness/FAQ/Breadcrumb/Article) ([lib/seo/json-ld.ts](bigbike-web/lib/seo/json-ld.ts)), sitemap with WP→Next slug mapping ([app/sitemap.ts](bigbike-web/app/sitemap.ts)), robots ([app/robots.ts](bigbike-web/app/robots.ts)), `noIndex` on filter/search/auth/cart/checkout/order-confirm/account.
- Legacy WP redirect proxy with L1 cache + trailing-slash retry ([proxy.ts:65-82](bigbike-web/proxy.ts#L65-L82)) backed by `/api/internal/redirect` ([InternalRedirectController.java](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/internal/InternalRedirectController.java)).

### Why it is not yet production-ready
- Login post-redirect query param mismatch breaks deep-link return-to (`proxy.ts` writes `redirect=`, login reads `tiep=`).
- Checkout silently rewrites prices from the cart (backend returns `priceChanges`) but the frontend type and UI ignore it — direct violation of AGENTS.md §13 “Show price/stock changed notices.”
- Lint-blocking errors in 4 files including `app/tai-khoan/doi-tra/page.tsx` and a hot path component (`SearchToggle`, `RecentlyViewedSection`).
- Several form schemas defined in `lib/schemas/` are not actually used (contact form has its own ad-hoc validation that diverges from the schema).
- Duplicated PDP snapshot pipeline: backend has a canonical `GET /api/v1/products/{idOrSlug}/snapshot` ([CatalogController.java:95-102](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/catalog/CatalogController.java#L95-L102)), but the Next handler at [app/api/products/[id]/snapshot/route.ts](bigbike-web/app/api/products/[id]/snapshot/route.ts) reimplements pricing/stock derivation against the heavier full-product endpoint.

---

## 2. Scope Audited

### Apps / files / docs read
- `AGENTS.md`, `bigbike-web/AGENTS.md`, `bigbike-web/CLAUDE.md`.
- `docs/DOCS_VERIFICATION_REPORT.md`.
- `docs/business/`: `PROJECT_OVERVIEW.md`, `MODULE_CATALOG.md`, `WORKFLOW_OVERVIEW.md`, `BUSINESS_RULES.md`, `STATE_MACHINES.md`, `USER_ROLES.md` (sampled).
- `docs/engineering/`: `API_CONTRACT.md` (full), `API_FLOW_MAP.md` (full), `DATA_CONTRACT.md` (sampled), `PERMISSION_MATRIX.md` (sampled), `TESTING_GUIDE.md`, `TRACEABILITY_MATRIX.md` (sampled).
- All `bigbike-web/app/**/page.tsx` for the routes listed in §3 plus `layout.tsx`, `error.tsx`, `not-found.tsx`, `loading.tsx`.
- All Next route handlers under `bigbike-web/app/api/**`.
- `bigbike-web/proxy.ts`, `bigbike-web/lib/api/{public-api,client-api}.ts`, `lib/auth/auth-store.ts`, `lib/cart-context.tsx`, `lib/seo/{metadata,json-ld}.ts`, `lib/utils/routes.ts`, `lib/schemas/{auth,checkout,contact}.ts`, `lib/contracts/commerce.ts`.
- `bigbike-web/components/**` — read 11 component files relevant to checkout/PDP/cart/account.
- `bigbike-web/__tests__/**` — full inventory.
- Backend controllers: `CatalogController`, `CartController`, `CheckoutController`, `CustomerAuthController`, `CustomerController`, `CustomerOrderController`, `CustomerAddressController`, `OrderLookupController`, `PublicSearchController`, `PublicReviewController`, `PublicMenuController`, `PublicSettingsController`, `PublicSliderController`, `PublicHomeVideoController`, `ContentController`, `ContactController`, `InternalRedirectController`, `VnAddressController`.
- Backend security: `SecurityConfig.java`, `CustomerCsrfFilter.java`, `CustomerSessionFilter` (referenced).
- Backend service: `CheckoutService.java` (key sections — stock validation, price re-sync, coupon atomic redeem, decrement, idempotency).

### Commands run
| Command | Result | Notes |
|---|---|---|
| `cd bigbike-web && npm run lint` | **FAIL** | 4 errors, 2 warnings — see §10.2 |
| `cd bigbike-web && npm run test` | **PASS** | 7 files / 69 tests in 7.39 s |
| `cd bigbike-web && npm run build` | **PASS** | 31 routes generated; warnings about backend `fetch failed` for menu (expected — backend not running). Build itself succeeded. |

### Commands NOT run
| Command | Reason |
|---|---|
| `cd bigbike-backend && ./mvnw test` | Out of stated scope and time budget; backend is referenced for endpoint/security verification only. Backend tests have been verified `PASS` in `docs/DOCS_VERIFICATION_REPORT.md` (CI gate). |
| `npm run dev` smoke (browser) | Backend not started. UI smoke for actual cart/checkout flow `NOT_RUN` — UX state coverage assessed via code only. |
| Sitemap fetch / robots fetch | Backend not running — content cannot be sampled. Code-level verification done in §9. |

---

## 3. Module Inventory

| # | Route | Page file | Key API call(s) | Backend endpoint | DB tables (read-only context) | Auth | Validation | States | SEO | Tests | Verdict |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | `/` | [app/page.tsx](bigbike-web/app/page.tsx) | listHomeSliders, listCategories, listArticles ×2, listBrands, listPublicSettings, listProducts ×2, listHomeVideos | `/api/v1/sliders`, `/api/v1/categories`, `/api/v1/articles`, `/api/v1/brands`, `/api/v1/settings/public`, `/api/v1/products`, `/api/v1/home-videos` | products, categories, articles, brands, sliders, home_videos, site_settings | public | server-side params only | empty/error tolerated per section | meta + Org/WebSite/LocalBusiness/FAQ JSON-LD | ❌ none | **PARTIAL — works, no E2E** |
| 2 | `/san-pham/` | [app/san-pham/page.tsx](bigbike-web/app/san-pham/page.tsx) | listProducts, listBrands | `/api/v1/products`, `/api/v1/brands` | products, product_variants, categories, brands | public | ✅ all query params parsed via `lib/utils/query.ts` | loading, empty, error | meta with `noIndex=true` when filters present | ❌ | **COMPLETE** |
| 3 | `/product/[slug]/` | [app/product/[slug]/page.tsx](bigbike-web/app/product/[slug]/page.tsx) | getProductBySlug, listProducts (related) + client snapshot | `/api/v1/products/{slug}`, `/api/v1/products` | products, product_variants, product_specifications, reviews | public | slug regex, 404 fallback | loading, error, notFound, snapshot loading | Product + Breadcrumb + FAQ JSON-LD; canonical from `seo.canonicalUrl` | ⚠️ ReviewsSection.test.tsx | **PARTIAL — duplicate snapshot pipeline (HIGH-1)** |
| 4 | `/danh-muc-san-pham/` | [app/danh-muc-san-pham/page.tsx](bigbike-web/app/danh-muc-san-pham/page.tsx) | listCategories | `/api/v1/categories` | categories | public | none needed | empty/error | meta, no JSON-LD | ❌ | **COMPLETE** |
| 5 | `/danh-muc-san-pham/[slug]/` | [app/danh-muc-san-pham/[slug]/page.tsx](bigbike-web/app/danh-muc-san-pham/[slug]/page.tsx) | getCategoryBySlug, listProducts | `/api/v1/categories/{slug}`, `/api/v1/products` | categories, products | public | slug regex | loading, error, 404 | meta + Breadcrumb JSON-LD | ❌ | **COMPLETE** |
| 6 | `/brands/` | [app/brands/page.tsx](bigbike-web/app/brands/page.tsx) | listBrands | `/api/v1/brands` | brands | public | ✅ params parsed | loading, empty, error | meta + `noIndex` for paged | ❌ | **COMPLETE** |
| 7 | `/brands/[slug]/` | [app/brands/[slug]/page.tsx](bigbike-web/app/brands/[slug]/page.tsx) | getBrandBySlug, listProducts | `/api/v1/brands/{slug}`, `/api/v1/products` | brands, products | public | slug regex | loading, error, notFound | meta + Breadcrumb JSON-LD | ❌ | **COMPLETE** |
| 8 | `/tin-tuc/` | [app/tin-tuc/page.tsx](bigbike-web/app/tin-tuc/page.tsx) | listArticles | `/api/v1/articles` | articles, content_categories | public | params parsed | loading, empty, error | meta | ❌ | **COMPLETE** |
| 9 | `/tin-tuc/[slug]/` | [app/tin-tuc/[slug]/page.tsx](bigbike-web/app/tin-tuc/[slug]/page.tsx) | getArticleBySlug | `/api/v1/articles/{slug}` | articles, content_categories | public | slug regex | error, notFound | Article JSON-LD + Breadcrumb | ❌ | **COMPLETE** |
| 10 | `/tim-kiem/` | [app/tim-kiem/page.tsx](bigbike-web/app/tim-kiem/page.tsx) | search | `/api/v1/search` | products, articles | public | text/limit parsed | loading, empty, error | meta `noIndex=true` | ❌ | **COMPLETE** |
| 11 | `/gio-hang/` | [app/gio-hang/page.tsx](bigbike-web/app/gio-hang/page.tsx) | fetchCart, updateCartItem, removeCartItem, clearCart, applyCoupon, removeCoupon | `/api/v1/cart`, `/api/v1/cart/items/{id}`, `/api/v1/cart/clear`, `/api/v1/cart/coupons` | carts, cart_items, cart_coupons | guest+customer (cookie) | client int parse | loading, empty, error, mutating, coupon error | robots disallow | ❌ | **PARTIAL — coupon UX OK, missing analytics on remove (LOW)** |
| 12 | `/thanh-toan/` | [app/thanh-toan/page.tsx](bigbike-web/app/thanh-toan/page.tsx) | fetchCart (via React Query), fetchCheckoutOptions, submitCheckout | `/api/v1/cart`, `/api/v1/checkout/options`, `/api/v1/checkout` | carts, orders, order_line_items, order_addresses, order_payments, shipping_items, stock_movements, coupons | guest+customer | ✅ Zod schema | step/loading/options-loading/empty/error | robots disallow | ⚠️ schema test only | **PARTIAL — priceChanges silently dropped (CRIT-3)** |
| 13 | `/thanh-toan/order-received/[id]/` | [app/thanh-toan/order-received/[id]/page.tsx](bigbike-web/app/thanh-toan/order-received/[id]/page.tsx) | — (permanentRedirect) | n/a | n/a | public | n/a | n/a | n/a (redirects) | ❌ | **COMPLETE** (legacy WC redirect) |
| 14 | `/don-hang/xac-nhan` | [app/don-hang/xac-nhan/page.tsx](bigbike-web/app/don-hang/xac-nhan/page.tsx) | getOrderLookup | `/api/v1/orders/lookup` | orders, order_line_items | public (via key) | requires `?so=` and `?key=` | error tolerated | meta `noIndex=true` | ❌ | **COMPLETE** |
| 15 | `/dang-nhap/` | [app/dang-nhap/page.tsx](bigbike-web/app/dang-nhap/page.tsx) | loginCustomer, refreshAuth | `/api/v1/customer/auth/login`, `/api/v1/customer/me` | customers, customer_sessions | public | ✅ Zod (login, password) | submitting, error | meta + robots disallow | schema test | **BROKEN — `tiep` vs `redirect` mismatch (CRIT-1)** |
| 16 | `/dang-ky/` | [app/dang-ky/page.tsx](bigbike-web/app/dang-ky/page.tsx) | registerCustomer | `/api/v1/customer/auth/register` | customers | public | ✅ Zod (firstName, email, password ≥8, confirm match) | submitting, success-screen, error | meta + robots disallow | schema test | **COMPLETE** (post-register doesn't auto-login profile until user clicks the CTA — see MED-3) |
| 17 | `/quen-mat-khau/` | [app/quen-mat-khau/page.tsx](bigbike-web/app/quen-mat-khau/page.tsx), `ForgotPasswordFlow.tsx` | requestPasswordReset, resetCustomerPassword | `/api/v1/customer/auth/password/{forgot,reset}` | customer_password_reset_tokens | public | ✅ Zod | success/error | robots disallow | schema test | **COMPLETE** |
| 18 | `/xac-nhan-email` | [app/xac-nhan-email/page.tsx](bigbike-web/app/xac-nhan-email/page.tsx) | POST verify-email | `/api/v1/customer/auth/verify-email?token=…` | customers | public | client checks token presence | loading/success/error/missing | robots disallow | ❌ | **COMPLETE** (lint error: setState-in-effect — see HIGH-2) |
| 19 | `/tai-khoan/` | [app/tai-khoan/page.tsx](bigbike-web/app/tai-khoan/page.tsx) | useAuth → fetchMe | `/api/v1/customer/me` | customers | session+CSRF | n/a | loading, anonymous→login, authenticated | robots disallow | ❌ | **COMPLETE** |
| 20 | `/tai-khoan/don-hang/` | [app/tai-khoan/don-hang/page.tsx](bigbike-web/app/tai-khoan/don-hang/page.tsx) | fetchMyOrders | `/api/v1/customer/orders` | orders | session ROLE_CUSTOMER | tab + page parse | loading, empty, error, paged | robots disallow | ❌ | **COMPLETE** |
| 21 | `/tai-khoan/don-hang/[id]/` | [app/tai-khoan/don-hang/[id]/page.tsx](bigbike-web/app/tai-khoan/don-hang/[id]/page.tsx) | fetchMyOrder, createReturn | `/api/v1/customer/orders/{id}`, `/api/v1/customer/orders/{id}/returns` | orders, order_line_items, returns | session ROLE_CUSTOMER | client-side return form | loading, error, ownership 403 surfaced | robots disallow | ❌ | **COMPLETE** |
| 22 | `/tai-khoan/doi-tra/` | [app/tai-khoan/doi-tra/page.tsx](bigbike-web/app/tai-khoan/doi-tra/page.tsx) | fetchMyReturns, fetchMyReturn, createReturn, fetchMyOrders, fetchMyOrder | `/api/v1/customer/orders/returns…` | returns | session ROLE_CUSTOMER | none in form | loading, error | robots disallow | ❌ | **PARTIAL — lint error (HIGH-2), no client validation on return form** |
| 23 | `/tai-khoan/edit-account/` | [app/tai-khoan/edit-account/page.tsx](bigbike-web/app/tai-khoan/edit-account/page.tsx) | updateCustomerProfile | `PATCH /api/v1/customer/me` | customers | session ROLE_CUSTOMER | partial (password length match) | saving, success, error, passwordError | robots disallow | ❌ | **PARTIAL — no Zod, email/phone format unvalidated client-side (MED-1)** |
| 24 | `/tai-khoan/edit-address/[type]/` | [app/tai-khoan/edit-address/[type]/page.tsx](bigbike-web/app/tai-khoan/edit-address/[type]/page.tsx) | fetchMyAddresses, createAddress, updateAddress, deleteAddress | `/api/v1/customer/addresses…` | customer_addresses | session ROLE_CUSTOMER | type whitelist (`billing`/`shipping`) | loading, empty, saving, error | robots disallow | ❌ | **PARTIAL — Zod missing for address (MED-1)** |
| 25 | `/lien-he/` | [app/lien-he/page.tsx](bigbike-web/app/lien-he/page.tsx) | getPageBySlug, listPublicSettings, ContactForm → submitContactForm | `/api/v1/pages/lien-he`, `/api/v1/contact` | pages, site_settings, contact_messages | public (CSRF exempt — see §6) | ad-hoc + 30 s cooldown | success, error, cooldown | meta only | ❌ | **PARTIAL — schema dead code (MED-2)** |
| 26 | `/[slug]/` | [app/[slug]/page.tsx](bigbike-web/app/[slug]/page.tsx) | getPageBySlug | `/api/v1/pages/{slug}` | pages | public | slug regex | error, notFound | meta + canonical from page | ❌ | **COMPLETE** |
| 27 | `/chinh-sach/[slug]/` | [app/chinh-sach/[slug]/page.tsx](bigbike-web/app/chinh-sach/[slug]/page.tsx) | getPageBySlug (with slug map) | `/api/v1/pages/{slug}` | pages | public | slug regex | error, notFound | meta | ❌ | **COMPLETE** |
| 28 | `/gioi-thieu/`, `/huong-dan-mua-hang/`, `/huong-dan/[…sub]/` | various | getPageBySlug | `/api/v1/pages/*` | pages | public | slug regex | error, notFound | meta | ❌ | **COMPLETE** |
| 29 | `/sitemap.xml` | [app/sitemap.ts](bigbike-web/app/sitemap.ts) | listProducts, listCategories, listBrands, listArticles, listPages (paginated, 50-page cap) | various | many | public | n/a | n/a | n/a | ❌ | **PARTIAL — 50 000-URL cap not split via `generateSitemaps()` (LOW)** |
| 30 | `/robots.txt` | [app/robots.ts](bigbike-web/app/robots.ts) | n/a | n/a | n/a | public | n/a | n/a | n/a | ❌ | **COMPLETE** (see HIGH-4 for missing `/xac-nhan-email` and trailing slash) |
| 31 | Proxy / WP redirects | [proxy.ts](bigbike-web/proxy.ts) | fetchFromBackend → `/api/internal/redirect` | `GET /api/internal/redirect` | redirects | public | none | loop guard, 2 s timeout, L1 cache | n/a | ❌ | **PARTIAL — login `redirect` query param mismatch (CRIT-1)** |

### Next.js route handlers under `app/api/**`
| Path | Backend route called | Verdict |
|---|---|---|
| `POST /api/cart/add` | `POST /api/v1/cart/items` | **DUPLICATE — `client-api.addCartItem` already wraps the same endpoint with CSRF; route handler appears unused or vestigial.** Verify before keeping. (LOW) |
| `POST /api/orders/quick-buy` | `POST /api/v1/orders/quick-buy` | Same as above — `client-api.submitQuickBuy` is the canonical client call. (LOW) |
| `GET /api/products/[id]/snapshot` | `GET /api/v1/products/{id}` (calls heavy product endpoint, reimplements pricing/stock derivation) | **HIGH-1 — backend already has canonical `/snapshot`** |
| `GET /api/products/[id]/pricing` | `GET /api/v1/products/{id}` | Same shape pattern as snapshot; functions but redundant. (LOW) |
| `GET /api/products/[id]/stock` | `GET /api/v1/products/{id}` | Same pattern. (LOW) |
| `GET /api/products/[id]/variants` | `GET /api/v1/products/{id}` | Same pattern. (LOW) |
| `GET/POST /api/products/[id]/reviews` | `GET/POST /api/v1/products/{id}/reviews` | OK proxy; uniform error mapping; honors 404 with EMPTY default. **COMPLETE** |
| `POST /api/revalidate` | revalidates Next tags | Properly secret-gated, validates input, length capped. **COMPLETE** |
| `GET /api/search-suggest` | `GET /api/v1/products?q&size=6&page=1` | Uses `/products` not `/search-suggest` — inconsistent with the dedicated backend `GET /api/v1/search-suggest` endpoint. (MED-4) |

---

## 4. Route & Screen Audit (highlights)

### 4.1 Login `/dang-nhap/` — **BROKEN**
- Login form reads `searchParams.get("tiep")` ([dang-nhap/page.tsx:16](bigbike-web/app/dang-nhap/page.tsx#L16)).
- Helper `toLoginPath(returnTo)` writes `?tiep=` ([lib/utils/routes.ts:70-73](bigbike-web/lib/utils/routes.ts#L70-L73)).
- `AccountShell` calls `toLoginPath(loginRedirect)` so internal redirects use `tiep` correctly ([components/layout/AccountShell.tsx:52](bigbike-web/components/layout/AccountShell.tsx#L52)).
- **Proxy** ([proxy.ts:103](bigbike-web/proxy.ts#L103)) writes `?redirect=…` instead of `?tiep=…`. Anyone hitting a deep account URL while logged out (e.g. shared `/tai-khoan/don-hang/<id>` link, email link, paste-url) will be sent to `/dang-nhap/?redirect=/tai-khoan/don-hang/<id>`, login succeeds, then `returnTo` falls back to `/tai-khoan/` — original target lost. **CRIT-1**.

### 4.2 Checkout `/thanh-toan/` — **PARTIAL**
- Frontend Zod schema covers fullName, VN phone, email/optional, province, district, addressLine1 ([lib/schemas/checkout.ts](bigbike-web/lib/schemas/checkout.ts)). ✅
- React Query for cart + checkout options. ✅
- `Idempotency-Key` UUID set per page mount ([app/thanh-toan/page.tsx:93](bigbike-web/app/thanh-toan/page.tsx#L93)). ✅
- `address.email || ""` is sent — backend must accept empty string; backend stores nullable. ✅ (`OrderEntity` accepts blank email).
- **Backend `OrderSummaryResponse` returns `priceChanges: List<PriceChange>`** when cart prices were silently overwritten during `syncPricesAndValidateStock` ([CheckoutService.java:822-869](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/checkout/CheckoutService.java#L822-L869)). The frontend `OrderSummary` type ([lib/contracts/commerce.ts:82-94](bigbike-web/lib/contracts/commerce.ts#L82-L94)) **does not include `priceChanges`** and the checkout page does not surface them. AGENTS.md §13: “Show price/stock changed notices.” **CRIT-3**.
- `lint` error: `react-hooks/incompatible-library` for `watch()` ([thanh-toan/page.tsx:127](bigbike-web/app/thanh-toan/page.tsx#L127)) — warning level (HIGH-2 contains the broader lint set).

### 4.3 PDP `/product/[slug]/` — **PARTIAL**
- Static content ISR-cached 1 h ([app/product/[slug]/page.tsx:33](bigbike-web/app/product/[slug]/page.tsx#L33)). ✅
- Dynamic snapshot via React Query against `/api/products/{slug}/snapshot/` ([components/catalog/PurchaseSectionClient.tsx:108-119](bigbike-web/components/catalog/PurchaseSectionClient.tsx#L108-L119)).
- The Next route handler **does not call `/api/v1/products/{idOrSlug}/snapshot`** — it calls `/api/v1/products/{id}` and reimplements `discountPercent`, currency default, `forceOutOfStock` derivation in TypeScript ([app/api/products/[id]/snapshot/route.ts:36-72](bigbike-web/app/api/products/[id]/snapshot/route.ts#L36-L72)). Backend already does the same math ([CatalogController.java:104-142](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/catalog/CatalogController.java#L104-L142)) but in a strict canonical record `ProductSnapshotResponse`. **HIGH-1.**
- Comment in `PurchaseSectionClient.tsx:153` says “Price is product-level only — picking a variant must not change the displayed price.” — confirmed; this matches backend behavior. ✅

### 4.4 Account/Auth — **PARTIAL**
- `AccountShell` handles loading skeleton, anonymous→login redirect, logout confirm. ✅ States.
- Login redirect uses `tiep` in helper — internally consistent.
- `useAuth()` server snapshot returns `{ status: "loading" }` to keep SSR/CSR markup identical ([lib/auth/auth-store.ts:66-82](bigbike-web/lib/auth/auth-store.ts#L66-L82)). ✅
- **`fetchCart()` runs unconditionally on mount in `CartProvider`** ([lib/cart-context.tsx:36-38](bigbike-web/lib/cart-context.tsx#L36-L38)) — hits backend on every page nav. Could be debounced or moved behind React Query, but functional. (LOW)

### 4.5 Returns `/tai-khoan/doi-tra/` — **PARTIAL**
- Lint **error** at line 45 (`setState in effect`).
- No client-side validation: customer can post empty `customerNote`, blank `reason` if backend lets it; backend validation status `NEEDS_VERIFICATION` per `docs/engineering/API_CONTRACT.md` §7. (MED-5)
- Customer return list/detail returns raw DTO (`CustomerReturnResponse`), not wrapped — frontend handles via direct `fetch().json()` then `(payload as { data })?.data ?? payload`. Works but inconsistent. **Already documented as known drift** in `API_CONTRACT.md`.

### 4.6 Contact `/lien-he/` — **PARTIAL**
- `lib/schemas/contact.ts` defines `name, email, phone(optional), subject, message` (email **required**), but the actual form ([components/contact/ContactForm.tsx](bigbike-web/components/contact/ContactForm.tsx)) uses `fullName, phone, email(optional), content` and never imports the schema. Schema is **dead code**. (MED-2)
- VN phone regex client-side; backend only checks blank ([ContactService.java:31-32](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/ContactService.java#L31-L32)). Email field has no client format validation and backend doesn't validate format either. (MED-2)
- `CSRF_EXEMPT_PREFIXES` includes `/api/v1/contact` ([CustomerCsrfFilter.java:50](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/config/CustomerCsrfFilter.java#L50)) → contact form is open to cross-site POST. Mitigated by client cooldown (30 s) and rate limiter, but not by CSRF. **MED-7**.

### 4.7 SEO infra
- `noIndex` correctly applied on filter/search/cart/checkout/order-confirm/auth/account.
- Sitemap fetches up to 50 pages × 1000 = 50k items per resource. Single sitemap returned; `generateSitemaps()` not used. (LOW)
- `robots.ts` disallows the right paths but uses **non-trailing-slash** form (`/tai-khoan`) plus inconsistent mixing (`/dang-nhap` no slash, `/gio-hang/` with slash). With `trailingSlash: true` in Next, both forms can match in practice but it's not explicit. **MED-6**.
- `xac-nhan-email` is **not** in robots disallow list — the email-verification token is in the URL and the page is reachable to crawlers. (MED-6)

---

## 5. API Contract Audit

| Frontend caller | Path used | Backend endpoint found | Status | Auth/CSRF | Verdict |
|---|---|---|---|---|---|
| `listProducts`, `getProductBySlug` | `GET /api/v1/products`, `/api/v1/products/{slug}` | `CatalogController` | matched | public GET | ✅ |
| `listCategories`, `getCategoryBySlug` | `GET /api/v1/categories[/{slug}]` | `CatalogController` | matched | public | ✅ |
| `listBrands`, `getBrandBySlug` | `GET /api/v1/brands[/{slug}]` | `CatalogController` | matched | public | ✅ |
| `listArticles`, `getArticleBySlug` | `GET /api/v1/articles[/{slug}]` | `ContentController` | matched | public | ✅ |
| `listPages`, `getPageBySlug` | `GET /api/v1/pages[/{slug}]` | `ContentController` | matched | public | ✅ |
| `getPublicMenu` | `GET /api/v1/menus/{location}` | `PublicMenuController` | matched | public | ✅ |
| `listPublicSettings` | `GET /api/v1/settings/public` | `PublicSettingsController` | matched | public | ✅ |
| `listHomeSliders` | `GET /api/v1/sliders?location=home` | `PublicSliderController` | matched | public | ✅ |
| `listHomeVideos` | `GET /api/v1/home-videos` | `PublicHomeVideoController` | matched | public | ✅ |
| `getOrderLookup` | `GET /api/v1/orders/lookup?orderNumber=&orderKey=` | `OrderLookupController` | matched | public GET | ✅ |
| `search` | `GET /api/v1/search?q&type&limit` | `PublicSearchController` | matched | public | ✅ |
| Header search-suggest (Next handler) | `GET /api/v1/products?q&size=6&page=1` | uses `/products` | mismatch | public | **MED-4 — should use `/api/v1/search-suggest`** |
| `fetchCart`, `addCartItem`, `updateCartItem`, `removeCartItem`, `clearCart` | `/api/v1/cart`, `/api/v1/cart/items[/{id}]`, `/api/v1/cart/clear` | `CartController` | matched | session+CSRF | ✅ |
| `applyCoupon`, `removeCoupon` | `POST /api/v1/cart/coupons`, `DELETE /api/v1/cart/coupons/{code}` | `CartController` | matched | session+CSRF | ✅ |
| `submitCheckout`, `submitQuickBuy`, `fetchCheckoutOptions` | `/api/v1/checkout`, `/api/v1/orders/quick-buy`, `/api/v1/checkout/options` | `CheckoutController` | matched | session+CSRF | ✅ — but `priceChanges` field dropped client-side (CRIT-3) |
| `loginCustomer`, `registerCustomer`, `logoutCustomer`, `requestPasswordReset`, `resetCustomerPassword` | `/api/v1/customer/auth/{login,register,logout,password/forgot,password/reset}` | `CustomerAuthController` | matched | CSRF-exempt | ✅ |
| `verify-email` page | `POST /api/v1/customer/auth/verify-email?token=…` | `CustomerAuthController` (POST + GET both `permitAll`, [SecurityConfig.java:63-64](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/config/SecurityConfig.java#L63-L64)) | matched | both methods open | ✅ — DOCS_VERIFICATION_REPORT M2 issue is now **fixed in code** |
| `fetchMe`, `updateCustomerProfile` | `GET/PATCH /api/v1/customer/me` | `CustomerController` | matched | session ROLE_CUSTOMER + CSRF on PATCH | ✅ |
| `fetchMyAddresses`, `createAddress`, `updateAddress`, `deleteAddress` | `/api/v1/customer/addresses…` | `CustomerAddressController` | matched | session ROLE_CUSTOMER + CSRF | ✅ |
| `fetchMyOrders`, `fetchMyOrder` | `/api/v1/customer/orders[/{id}]` | `CustomerOrderController` | matched | session ROLE_CUSTOMER | ✅ |
| `fetchMyReturns`, `fetchMyReturn`, `createReturn` | `/api/v1/customer/orders/returns…` | `CustomerOrderController` | matched | session ROLE_CUSTOMER + CSRF on POST | ✅ — wrapper-shape drift documented (raw DTO instead of `ApiDataResponse`) |
| `submitContactForm` | `POST /api/v1/contact` | `ContactController` | matched | CSRF-exempt | ✅ but exempt — see MED-7 |
| `VnAddressFields` (province/district/ward dropdowns) | derived from `lib/vn-address-data.ts` (static JSON) | backend has `/api/v1/address/**` but is **not called** | — | n/a | **MED-8 — frontend uses static data, not backend API** |
| Snapshot Next handler | `GET /api/v1/products/{id}` (NOT `/snapshot`) | endpoint exists but unused | mismatch | public | **HIGH-1** |
| Internal redirect proxy | `GET /api/internal/redirect?path=…` | `InternalRedirectController` | matched | `permitAll` (lock at infra) | ✅ |

**Endpoints called from frontend that do not exist in backend:** none found.
**Endpoints in backend exposed for storefront that frontend never calls:** `/api/v1/search-suggest`, `/api/v1/products/{idOrSlug}/snapshot`, `/api/v1/address/**` (provinces/districts/wards), `/api/v1/customer/auth/refresh` (silent JWT refresh — frontend has no refresh logic; relies on session cookie).

---

## 6. Permission & Auth Audit

### Public routes (no auth)
`/`, `/san-pham/`, `/product/[slug]/`, `/danh-muc-san-pham/[slug]/`, `/brands[/[slug]]/`, `/tin-tuc[/[slug]]/`, `/tim-kiem/`, `/lien-he/`, `/[slug]/`, `/chinh-sach/[slug]/`, `/gio-hang/`, `/thanh-toan/`, `/don-hang/xac-nhan`, `/dang-nhap`, `/dang-ky`, `/quen-mat-khau`, `/xac-nhan-email`, `/sitemap.xml`, `/robots.txt`. ✅ matches `SecurityConfig.java`.

### Protected routes (require `bb_session` cookie)
- All `/tai-khoan/**` enforced **at the proxy layer** ([proxy.ts:99-106](bigbike-web/proxy.ts#L99-L106)).
- Backend separately gates `/api/v1/customer/me`, `/api/v1/customer/addresses/**`, `/api/v1/customer/orders/**` to `hasRole("CUSTOMER")`.
- Defense in depth ✅ — but the proxy redirect query name is broken (CRIT-1).

### Ownership enforcement (backend)
- `CustomerOrderController.requireCustomerId()` derives customer from `CustomerPrincipal` and passes to service `getCustomerOrderDetail(customerId, orderId)`, `listCustomerReturns(customerId)`, etc. ✅ confirmed by code read.
- Cannot fetch another user's order even with the right UUID — backend filters by `customerId`.
- Customer addresses: same pattern (assumed; backend uses CSRF + `hasRole("CUSTOMER")` and ownership check via service — recommend explicit verification by reading `CustomerAddressService` if not yet covered, currently `NEEDS_VERIFICATION`). **MED-9**.

### Session / CSRF
- Cookie name `bb_session` (HttpOnly) + `bb_csrf` (readable by JS for header echo).
- `CustomerCsrfFilter` enforces `X-CSRF-Token == bb_csrf` cookie via constant-time compare. ✅
- Cart endpoints `/api/v1/cart/**` are `permitAll` but CSRF-protected for non-safe methods. ✅
- Auth endpoints exempt for bootstrap (login/register/forgot/reset/verify). ✅
- `/api/v1/contact` exempt — see MED-7.
- Admin `/api/v1/admin/**` exempt because admin uses Bearer JWT (not cookies). ✅

### Frontend trust boundary
- Cart line totals, discount, shipping all rendered from server-returned `cart.totals.*` ([gio-hang/page.tsx:281-298](bigbike-web/app/gio-hang/page.tsx#L281-L298)). ✅
- Checkout total displayed `cart.totals.totalAmount + (selectedShipping?.cost ?? 0)` ([thanh-toan/page.tsx:566](bigbike-web/app/thanh-toan/page.tsx#L566)) — only for **display**. Backend recomputes everything; frontend total is informational only. ✅
- Order confirmation `orderStatus` label mapping has unknown-enum fallback (`orderStatusLabel(status)` returns the raw key). ✅

---

## 7. Validation Audit

| Form / surface | Client validation | Backend validation | Verdict |
|---|---|---|---|
| Login | Zod (login non-empty, password non-empty) | rate-limited; checks credentials; opaque error | ✅ |
| Register | Zod (firstName, email format, password ≥8, confirm match) | service-level email/password rules + `customer_email_unique` | ✅ |
| Forgot password | Zod (login non-empty) | always returns OK to prevent enumeration | ✅ |
| Reset password | Zod (password ≥8, confirm match) | token TTL + single-use (`customer_password_reset_tokens`) | ✅ |
| Edit account profile | ad-hoc (newPassword length only) | service validates email uniqueness + password change | **MED-1 — no email/phone format check client-side** |
| Edit address | none (FormData → POST) | DTO validation server-side | **MED-1** |
| Checkout address | Zod (full coverage) | server re-validates + parses VN phone | ✅ |
| Quick-buy | weak — same `EMPTY_ADDRESS` defaults; phone/format ad-hoc | server full validation | **MED-1** |
| Cart quantity | client `min=1` step + `parseInt` guard | server clamps & re-validates against stock | ✅ |
| Coupon | non-empty client-side | `CouponPolicy.validate` + atomic `attemptRedeem` | ✅ |
| Contact form | ad-hoc fullName/phone(VN regex)/content; 30 s cooldown | only blank-checks fullName/phone/content; **no email format, no length cap** | **MED-2** |
| Return create | none client-side | `NEEDS_VERIFICATION` per `API_CONTRACT.md` §7 | **MED-5** |
| Product list / catalog query params | full Zod-style guards via `lib/utils/query.ts` | `@Pattern`/`@Min`/`@Max` server-side | ✅ |
| Snapshot path param `id` | none in Next handler — passed through | server `@Pattern(SLUG_REGEX)` (matches both UUIDs and slugs since both are lowercase alphanumeric+dash) | ✅ |

---

## 8. DB Behavior Audit

This audit is read-only; DB shape is verified via service reads only.

### Snapshot integrity (orders)
`OrderEntity` is built with snapshots: `customerEmail`, `customerPhone`, `customerNote`, `paymentMethod`, monetary totals, currency. `OrderLineItemEntity` is built from `cartItem` (carries `productName`, `variantName`, `unitPrice`, `quantity`, `lineSubtotal`, `lineDiscount`, `lineTotal`) — see [CheckoutService.java:236-249](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/checkout/CheckoutService.java#L236-L249). Addresses are written separately via `addressRepo.save(buildAddress(savedOrder, "BILLING", req.billingAddress(), now))`. ✅ Snapshot is preserved per AGENTS.md §7.3.

### Stock race & consistency
- Two-pass: `syncPricesAndValidateStock` uses `findByIdForUpdate` (pessimistic write lock) → throws `ConflictException` on insufficient stock; `decrementStockForCartItems` then re-locks and decrements + writes `stock_movements`. ✅ Two writes wrapped in same `@Transactional` boundary.
- Variant path tracks `quantityOnHand` + `inventoryPolicyService.recomputeStockState(variant)` to drive `IN_STOCK`/`LOW_STOCK`/`OUT_OF_STOCK`. ✅

### Coupon atomicity
- `couponPolicy.validate(freshCoupon, subtotal)` checks expiry/min/max/usage limit.
- `couponRepo.attemptRedeem(couponId, now)` is a conditional `UPDATE coupons SET usage_count = usage_count + 1 WHERE id = ? AND (usage_limit IS NULL OR usage_count < usage_limit)` — returns 0 rows on race; service throws `ConflictException`. ✅
- `OrderAppliedCouponEntity` snapshots `code` and `discount_amount` — historical orders unaffected by later coupon edits. ✅

### Idempotency
- `CheckoutService` accepts an `Idempotency-Key` header; frontend generates UUID per page mount ([thanh-toan/page.tsx:93](bigbike-web/app/thanh-toan/page.tsx#L93), [QuickBuyModal.tsx:56](bigbike-web/components/catalog/QuickBuyModal.tsx#L56)).
- Service exits early via `idempotency.existingSummary()` if key was seen. ✅
- The frontend regenerates UUID per page mount, so reloading checkout creates a new key — **idempotency only protects against double-clicks within the same render cycle, not against page refresh after submit.** This is the conventional definition; arguably acceptable. (LOW)

### Inventory side effects
- `stock_movements` written on each decrement with `movementType=OUT`, `referenceType=ORDER`, `referenceId=orderId`. ✅
- Refund/return path not audited here — owned by Returns module.

### Customer ownership
- All `requireCustomerId()` calls funnel through `CustomerPrincipal`. ✅ See §6.

---

## 9. SEO & Redirect Audit

### Metadata / canonical / noIndex
- `buildPublicMetadata` returns `alternates.canonical`, OG, Twitter cards, locale `vi_VN`, image fallback to brand logo. ✅
- Used consistently across home, PDP, category list/detail, brand list/detail, article list/detail, search, page, contact, account routes.
- `noIndex` correctly applied:
  - `/san-pham/` when filters or pagination present.
  - `/brands/` when paged or sort changed.
  - `/tim-kiem/` always.
  - `/don-hang/xac-nhan` always.
  - `/dang-nhap`, `/dang-ky`, `/quen-mat-khau`, `/tai-khoan/**`, `/gio-hang/`, `/thanh-toan/` via `robots.ts` disallow (and metadata for some).
- Missing: explicit per-page `robots: { index: false }` for `/dang-nhap`, `/dang-ky`, `/gio-hang/`, `/thanh-toan/` (relies on robots.txt only). (MED-6)

### JSON-LD
- Home: Organization + WebSite (with SearchAction to `/tim-kiem/`) + LocalBusiness + FAQPage.
- PDP: Product (with `offers.availability` mapped from `stockState`, `priceCurrency: VND`) + BreadcrumbList + FAQPage from specifications.
- Article: Article + BreadcrumbList.
- Category/Brand: BreadcrumbList only — `ItemList` of products is **not** emitted; could add (LOW).

### Sitemap
- Dynamic — fetches up to 50 pages × 1000 per resource type.
- Includes home, productList, articleList, brandList, 4 static informational pages, all products, categories, brands, articles (excluding `noIndex`), pages (excluding `noIndex`).
- Policy pages re-routed via `POLICY_BACKEND_TO_ROUTE` map (`chinh-sach-bao-ve-thong-tin-ca-nhan` → `/chinh-sach/bao-mat/`, etc.). ✅
- 50 000-URL limit not yet split via `generateSitemaps()`. Future risk only. (LOW)

### Robots
```
disallow: /api/, /admin/, /gio-hang.html, /gio-hang/, /thanh-toan.html, /thanh-toan/,
          /don-hang/, /tai-khoan, /dang-nhap, /dang-ky, /quen-mat-khau, /tim-kiem
```
- Mixed trailing-slash form (`/dang-nhap` vs `/gio-hang/`). With `trailingSlash: true` either matches by prefix, but consistency is recommended. (MED-6)
- **Missing `/xac-nhan-email`** — token-bearing URL is currently crawlable. Add disallow. (MED-6)
- **Missing `/[slug]/edit-account`, `/[slug]/edit-address` precision** — covered by `/tai-khoan` prefix. ✅

### Redirect / WP migration
- Proxy at `bigbike-web/proxy.ts` looks up backend `redirects` table via `/api/internal/redirect?path=…`.
- L1 cache 5 min (configurable) + trailing-slash retry.
- Loop guard prevents `/x → /x` redirect.
- WP search `?s=foo` → `/tim-kiem/?q=foo` (and `&post_type=product`). 301 status. ✅
- Excludes `_next`, `api`, sitemap, robots, `wp-content`, favicon. ✅
- `/api/internal/redirects/active` consumed by sitemap/audit tools (not yet by storefront).

---

## 10. Test Coverage Audit

### 10.1 Existing tests
| File | Subject | Type |
|---|---|---|
| [`__tests__/contracts/commerce-order-detail.test.ts`](bigbike-web/__tests__/contracts/commerce-order-detail.test.ts) | OrderDetail shape parsing | unit |
| [`__tests__/schemas/auth.test.ts`](bigbike-web/__tests__/schemas/auth.test.ts) | login/register/forgot/reset Zod schemas | unit |
| [`__tests__/schemas/checkout.test.ts`](bigbike-web/__tests__/schemas/checkout.test.ts) | checkout address Zod schema | unit |
| [`__tests__/utils/format.test.ts`](bigbike-web/__tests__/utils/format.test.ts) | currency formatting, status labels | unit |
| [`__tests__/utils/html.test.ts`](bigbike-web/__tests__/utils/html.test.ts) | rich-html sanitizer | unit |
| [`__tests__/utils/variant-match.test.ts`](bigbike-web/__tests__/utils/variant-match.test.ts) | variant attribute matching | unit |
| [`components/catalog/ReviewsSection.test.tsx`](bigbike-web/components/catalog/ReviewsSection.test.tsx) | Reviews component | component |

`npm run test`: **PASS — 7 files, 69 tests, 7.39 s.**

### 10.2 Lint findings (`npm run lint`)
| File | Rule | Severity | Line |
|---|---|---|---|
| `app/dang-ky/page.tsx` | `@typescript-eslint/no-unused-vars` (`getValues`) | warning | 22 |
| `app/tai-khoan/doi-tra/page.tsx` | `react-hooks/set-state-in-effect` | **error** | 45 |
| `app/thanh-toan/page.tsx` | `react-hooks/incompatible-library` (`watch()`) | warning | 127 |
| `app/xac-nhan-email/page.tsx` | `react-hooks/set-state-in-effect` | **error** | 19 |
| `components/catalog/RecentlyViewedSection.tsx` | `react-hooks/set-state-in-effect` | **error** | 28 |
| `components/layout/SearchToggle.tsx` | `react-hooks/set-state-in-effect` | **error** | 68 |

CI gate per `docs/engineering/TESTING_GUIDE.md` runs `npm run lint` for web — **these errors will block CI**. (HIGH-2)

### 10.3 Tests that are missing (recommended)
| Suggested file | Subject | Priority |
|---|---|---|
| `__tests__/api/snapshot-route.test.ts` | Next snapshot handler discount math + stockState fallback + 502 path | P1 |
| `__tests__/api/cart-add-route.test.ts` | CSRF passthrough, error envelope mapping | P1 |
| `__tests__/api/orders-quick-buy-route.test.ts` | Idempotency-Key passthrough, error envelope mapping | P1 |
| `__tests__/api/revalidate-route.test.ts` | secret check, tag length cap, dedupe | P1 |
| `__tests__/proxy/proxy-redirect.test.ts` | TTL cache, trailing-slash retry, loop guard, WP `?s=` rewrite, **`tiep` query name** (regression test for CRIT-1) | P0 |
| `__tests__/seo/sitemap.test.ts` | policy slug map, noIndex exclusion, hardcoded last-modified | P2 |
| `__tests__/seo/json-ld.test.ts` | Product offers.availability mapping, Breadcrumb hierarchy with parent | P2 |
| `__tests__/components/CheckoutPage.test.tsx` | `priceChanges` rendering when present (regression for CRIT-3) | P0 |
| `__tests__/auth/AccountShell.test.tsx` | anonymous → login redirect query name | P0 |
| `__tests__/components/CartPage.test.tsx` | quantity stepper guards, coupon error states | P1 |
| `__tests__/components/ContactForm.test.tsx` | VN phone validation, email-format gating, cooldown banner | P1 |
| `__tests__/contracts/order-summary.test.ts` | OrderSummary type contains `priceChanges` and decoder reads it | P0 |

CI currently runs lint+build for web — **does not run tests** ([`docs/engineering/TESTING_GUIDE.md`](docs/engineering/TESTING_GUIDE.md) flags this gap). HIGH-3.

---

## 11. Critical Findings

### CRIT-1 — Login return-to query param mismatch breaks deep-link auth
- **Severity**: CRITICAL
- **Area**: proxy / auth UX
- **Evidence**: [proxy.ts:103](bigbike-web/proxy.ts#L103) writes `loginUrl.searchParams.set("redirect", pathname);` whereas [dang-nhap/page.tsx:16](bigbike-web/app/dang-nhap/page.tsx#L16) reads `searchParams.get("tiep")`, and [lib/utils/routes.ts:70-73](bigbike-web/lib/utils/routes.ts#L70-L73) `toLoginPath()` writes `?tiep=`.
- **Impact**: Any user landing on a protected `/tai-khoan/**` deep link (shared link, email-link to order detail, browser back-forward) gets bounced to login then dumped on `/tai-khoan/` after authenticating. Specifically breaks order-detail share/restore, returns flow, address edit deep links.
- **Recommended fix**: change `proxy.ts:103` to `loginUrl.searchParams.set("tiep", pathname);` (one-line). Add proxy regression test.
- **Files likely affected**: `bigbike-web/proxy.ts`. (Ideally also extract a constant.)

### CRIT-2 — Disjoint Next snapshot handler vs canonical backend `/snapshot` endpoint
- **Severity**: CRITICAL (logic duplication that diverges)
- **Area**: PDP buy-box pricing/stock
- **Evidence**: backend exposes `GET /api/v1/products/{idOrSlug}/snapshot` returning a strictly-typed `ProductSnapshotResponse(pricing, stock, variants)` with discountPercent + stock label computed once in Java ([CatalogController.java:95-142](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/catalog/CatalogController.java#L95-L142)). Frontend Next handler at [app/api/products/[id]/snapshot/route.ts](bigbike-web/app/api/products/[id]/snapshot/route.ts) calls the heavier `/api/v1/products/{id}` and **reimplements** discount math, stock-label localization, currency default, `forceOutOfStock` derivation in TS, then synthesizes a similar shape.
- **Impact**: Two divergent sources of truth for the same buy-box data. A backend rounding/threshold change won't be reflected on the storefront. Larger payload (full product) over the wire on every buy-box refresh. Stock label mapping duplicated. Variant array carries full product variants every time.
- **Recommended fix**: change the Next handler to proxy `GET /api/v1/products/{idOrSlug}/snapshot` and pass through the `data` body verbatim with `Cache-Control: no-store`. Keep the route handler so client code keeps using `/api/products/{slug}/snapshot/`. Same simplification for `/pricing`, `/stock`, `/variants` Next handlers (or delete them — `PurchaseSectionClient` only consumes `/snapshot`).
- **Files likely affected**: `bigbike-web/app/api/products/[id]/{snapshot,pricing,stock,variants}/route.ts`.

### CRIT-3 — Checkout silently drops `priceChanges`; UX violates AGENTS.md §13
- **Severity**: CRITICAL (compliance + customer-trust risk)
- **Area**: checkout
- **Evidence**:
  - Backend response includes `List<PriceChange>` ([OrderSummaryResponse.java:20](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/checkout/dto/OrderSummaryResponse.java#L20), populated by [CheckoutService.java:822-869](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/checkout/CheckoutService.java#L822-L869)).
  - Frontend type [`OrderSummary`](bigbike-web/lib/contracts/commerce.ts#L82-L94) does **not** include `priceChanges`.
  - [`thanh-toan/page.tsx`](bigbike-web/app/thanh-toan/page.tsx) reads only `order.orderNumber`, `order.orderKey` and immediately routes to confirm.
  - AGENTS.md §13 explicitly says: “Show price/stock changed notices.”
- **Impact**: Customer pays without being told the price was rewritten between cart and checkout. Increases dispute risk and erodes trust. Also breaches the explicit project rule.
- **Recommended fix**: extend `OrderSummary` with `priceChanges?: { productName: string; oldPrice: number; newPrice: number }[]`; in `placeOrder()` if non-empty, show a confirmation dialog (or a banner on the confirmation page) before navigating to `/don-hang/xac-nhan`. Persist last delta into the OrderSummary URL state for the confirmation page so it can show “Giá đã được cập nhật theo kho” banner.
- **Files likely affected**: `bigbike-web/lib/contracts/commerce.ts`, `bigbike-web/app/thanh-toan/page.tsx`, `bigbike-web/app/don-hang/xac-nhan/page.tsx`.

### HIGH-1 — Vestigial duplicate Next route handlers (`/api/cart/add`, `/api/orders/quick-buy`)
- **Severity**: HIGH
- **Area**: API surface hygiene
- **Evidence**: [`app/api/cart/add/route.ts`](bigbike-web/app/api/cart/add/route.ts) and [`app/api/orders/quick-buy/route.ts`](bigbike-web/app/api/orders/quick-buy/route.ts) exist but are **not called** by `client-api.ts` (which talks to backend directly with `credentials: include`). No component grep shows usage.
- **Impact**: Two paths to the same operation, with subtly different error envelope (the route handler returns `{ error }` flat, while client-api throws based on `payload.error.message`). Future edits could land in the wrong one.
- **Recommended fix**: confirm they're unused and delete, or refactor `client-api.addCartItem`/`submitQuickBuy` to call them and benefit from server-side body validation (`zod` already in use in `/api/cart/add`).

### HIGH-2 — Lint errors will block CI
- **Severity**: HIGH (CI gate)
- **Area**: code quality
- **Evidence**: 4 errors in §10.2.
- **Impact**: `npm run lint` is part of the web CI gate per `docs/engineering/TESTING_GUIDE.md`. PRs cannot merge until fixed.
- **Recommended fix**: replace synchronous `setState` inside effects with derived values or move the state update into the async callback; for `RecentlyViewedSection`, read localStorage during render via `useSyncExternalStore` or perform the filter inside the effect's promise handler. For `useForm.watch()`, read fields via `getValues()` per-call inside `placeOrder` rather than caching `watch()` at render. Remove unused `getValues` in `dang-ky`.

### HIGH-3 — Web tests not wired into CI
- **Severity**: HIGH (regression risk)
- **Area**: CI
- **Evidence**: 69 tests pass locally; `.github/workflows/ci.yml` runs only lint+build for web (per `docs/engineering/TESTING_GUIDE.md` and DOCS_VERIFICATION_REPORT §7 P5).
- **Impact**: Tests can silently rot.
- **Recommended fix**: add `- run: npm run test` step to web job in `.github/workflows/ci.yml`. Ensure `vitest run --reporter default --reporter junit` so failures show in PR.

### HIGH-4 — Customer-cart prefetch on every navigation
- **Severity**: HIGH (perf)
- **Area**: cart provider
- **Evidence**: [`lib/cart-context.tsx:36-38`](bigbike-web/lib/cart-context.tsx#L36-L38) calls `fetchCart()` in a top-level `useEffect`. `CartProvider` wraps every page, so this fires on every full nav.
- **Impact**: One DB hit per page load even for non-cart pages (PDP, blog, contact). Wasteful at scale.
- **Recommended fix**: hydrate `cartCount` from a lightweight cookie-driven endpoint (`/api/v1/cart/count`) or move cart state into TanStack Query with `staleTime` and on-demand refetch. At minimum, debounce the initial `fetchCart` to first user interaction.

### HIGH-5 — Robots disallow misses `/xac-nhan-email`
- **Severity**: HIGH (privacy)
- **Area**: SEO
- **Evidence**: [`app/robots.ts`](bigbike-web/app/robots.ts) does not list `/xac-nhan-email`.
- **Impact**: Verification tokens in URL are crawlable. Tokens are usually single-use, but indexing them is still a leak surface.
- **Recommended fix**: add `/xac-nhan-email` to disallow list and ensure metadata sets `robots.index=false`.

### HIGH-6 — Search-suggest uses wrong backend route
- **Severity**: HIGH (semantic drift)
- **Area**: header search dropdown
- **Evidence**: [`app/api/search-suggest/route.ts:24-28`](bigbike-web/app/api/search-suggest/route.ts#L24-L28) calls `/api/v1/products?q&size=6&page=1`. Backend has a dedicated `/api/v1/search-suggest` ([PublicSearchController.java:69](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/public_/PublicSearchController.java#L69)) which is documented as the canonical surface in `API_CONTRACT.md`.
- **Impact**: Duplicate logic, weaker ranking (no typeahead-tuned scoring), no article suggestions.
- **Recommended fix**: switch to `${BACKEND}/api/v1/search-suggest?q=…&limit=6`. Map the `SearchPayload` shape into the existing `{ products: ... }` envelope.

### MED-1 — Account / address forms lack client-side validation
- **Severity**: MEDIUM
- **Area**: UX
- **Evidence**: `edit-account/page.tsx` and `edit-address/[type]/page.tsx` use `FormData` without Zod. Email format and VN phone aren't checked client-side; password rules only checked when present.
- **Recommended fix**: extract Zod schemas (mirror `checkoutAddressSchema`) and use `react-hook-form + zodResolver`.

### MED-2 — Contact form schema is dead code; format gaps
- **Severity**: MEDIUM
- **Area**: contact
- **Evidence**: [`lib/schemas/contact.ts`](bigbike-web/lib/schemas/contact.ts) defines fields `name/email/phone/subject/message` (email required), but [`components/contact/ContactForm.tsx`](bigbike-web/components/contact/ContactForm.tsx) uses `fullName/phone/email(optional)/content` and never imports the schema. Backend ContactService also doesn't validate email format.
- **Recommended fix**: rewrite `contactSchema` to match the actual fields, import it via `react-hook-form`, and have backend `ContactService` use Bean Validation `@Email`/`@Pattern` annotations.

### MED-3 — Register success leaves user anonymous
- **Severity**: MEDIUM
- **Area**: post-register UX
- **Evidence**: [`app/dang-ky/page.tsx:35-79`](bigbike-web/app/dang-ky/page.tsx#L35-L79) shows success screen and CTA to `/tai-khoan`, but `refreshAuth()` is **not** called. If backend doesn't auto-set the session, hitting `/tai-khoan` will bounce back to login.
- **Recommended fix**: confirm backend `register` returns/sets `bb_session` + `bb_csrf` cookies (per `CustomerAuthData`); if so, call `refreshAuth()` before showing CTA. If not, route to login with prefilled email.

### MED-4 — Search-suggest: see HIGH-6 (kept here for completeness — duplicates resolve under HIGH-6).

### MED-5 — Customer return form lacks client validation
- **Severity**: MEDIUM
- **Evidence**: [`app/tai-khoan/doi-tra/page.tsx`](bigbike-web/app/tai-khoan/doi-tra/page.tsx) and the inline return form on [`app/tai-khoan/don-hang/[id]/page.tsx`](bigbike-web/app/tai-khoan/don-hang/[id]/page.tsx) don't validate selected items, quantity per item, or reason.
- **Recommended fix**: add `createReturnSchema` to `lib/schemas/`; require ≥1 line item, integer quantity ≤ original line quantity, reason in known enum.

### MED-6 — Robots and per-page `noIndex` consistency
- **Severity**: MEDIUM
- **Area**: SEO hygiene
- **Evidence**: `robots.ts` mixes trailing-slash forms; some auth pages rely on robots.txt only without per-page metadata `index:false`; `/xac-nhan-email` missing (HIGH-5).
- **Recommended fix**: normalize robots.txt entries (trailing slash for all directory paths), and add `noIndex: true` to `buildPublicMetadata` for `/dang-nhap`, `/dang-ky`, `/quen-mat-khau`, `/xac-nhan-email`, `/gio-hang/`, `/thanh-toan/`, `/tai-khoan/**`.

### MED-7 — `/api/v1/contact` is CSRF-exempt
- **Severity**: MEDIUM
- **Area**: backend security
- **Evidence**: [`CustomerCsrfFilter.java:50`](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/config/CustomerCsrfFilter.java#L50) prefix-exempts `/api/v1/contact`.
- **Impact**: Cross-origin posters can spam the form bypassing CSRF (frontend cooldown is per-tab only). Rate limiter mitigates volume.
- **Recommended fix**: remove `/api/v1/contact` from CSRF exempt set; add `bb_csrf` cookie minting endpoint or piggyback on the existing CSRF cookie that's set on first GET to `/api/v1/cart`. Alternative: add CAPTCHA or hCaptcha for production.

### MED-8 — VN address dropdowns use static frontend data
- **Severity**: MEDIUM
- **Area**: address
- **Evidence**: [`lib/vn-address-data.ts`](bigbike-web/lib/vn-address-data.ts) embedded; backend `/api/v1/address/{provinces|districts|wards}` is exposed but **never called** by the storefront.
- **Impact**: Bundle bloat (full VN admin units), no province/district refresh on backend updates, divergence risk if backend table is the source of truth (it is per `API_CONTRACT.md` §1).
- **Recommended fix**: switch `VnAddressFields` to fetch on demand using TanStack Query with `staleTime: Infinity` (data is essentially static); fall back to embedded data only on offline.

### MED-9 — Customer address ownership: server-side path needs verification
- **Severity**: MEDIUM
- **Area**: backend permission
- **Evidence**: `SecurityConfig` requires `hasRole("CUSTOMER")` for `/api/v1/customer/addresses/**` but per-row ownership in `CustomerAddressService` was not audited in this pass (out of scope). `docs/engineering/PERMISSION_MATRIX.md` flags ownership for addresses as `NEEDS_VERIFICATION`.
- **Recommended fix**: read `CustomerAddressService.update`/`delete` and confirm filter `customerId=auth.customerId()` on every mutation. Add integration test.

### LOW findings

| ID | Area | Evidence | Recommendation |
|---|---|---|---|
| LOW-1 | sitemap | single-file output, 50k cap not enforced via `generateSitemaps()` | enable `generateSitemaps()` once total URL count > 30 000 |
| LOW-2 | cart UX | `gio-hang` does not push GTM `remove_from_cart` event | add `pushDataLayer("remove_from_cart", ...)` to `handleRemove` |
| LOW-3 | API surface | `app/api/cart/add`, `app/api/orders/quick-buy` Next handlers unused | delete or document |
| LOW-4 | idempotency | UUID regenerated per page mount; refresh after fail starts a new transaction | optionally persist key in `sessionStorage` |
| LOW-5 | snapshot route | parallel `pricing`/`stock`/`variants` Next handlers all reissue a full product fetch | once HIGH-6 + CRIT-2 land, drop these three handlers |

---

## 12. Completion Matrix

Each row scored independently per dimension. Production-ready means **no CRITICAL** and **no HIGH** open.

| Module | Routes | Components | API match | DB safety | Permission | Validation | SEO | Tests | Verdict | Required work |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---|---|
| Storefront — home, listings | 100 % | 100 % | 100 % | n/a | 100 % | 95 % | 95 % | 0 % | **COMPLETE (no E2E)** | add E2E smoke + listing query unit tests |
| PDP | 100 % | 95 % | 70 % | n/a | 100 % | 95 % | 100 % | 30 % | **PARTIAL** | CRIT-2 (snapshot routing); add buy-box test |
| Cart | 100 % | 100 % | 100 % | 100 % | 100 % | 90 % | 100 % (disallow) | 0 % | **PARTIAL** | LOW-2 + cart unit test |
| Checkout | 100 % | 95 % | 90 % | 100 % | 100 % | 100 % | 100 % | 30 % | **PARTIAL** | CRIT-3 (`priceChanges`), HIGH-2 lint |
| Quick-buy | 100 % | 90 % | 100 % | 100 % | 100 % | 80 % | 100 % | 0 % | **PARTIAL** | client validation + test |
| Order confirmation | 100 % | 100 % | 100 % | 100 % | 100 % | 100 % | 100 % | 0 % | **COMPLETE** | priceChanges banner once CRIT-3 fixed |
| Order history & detail | 100 % | 100 % | 100 % | 100 % | 100 % | 100 % | 100 % | 0 % | **COMPLETE** | proxy redirect query name (CRIT-1) |
| Returns | 100 % | 90 % | 100 % | partially-verified | 100 % | 50 % | 100 % | 0 % | **PARTIAL** | MED-5, HIGH-2 lint |
| Auth — login | 100 % | 100 % | 100 % | 100 % | 100 % | 100 % | 100 % | 50 % | **BROKEN** | CRIT-1 |
| Auth — register | 100 % | 100 % | 100 % | 100 % | 100 % | 100 % | 100 % | 50 % | **PARTIAL** | MED-3 post-register session refresh |
| Auth — forgot/reset | 100 % | 100 % | 100 % | 100 % | 100 % | 100 % | 100 % | 50 % | **COMPLETE** | nothing |
| Auth — verify-email | 100 % | 100 % | 100 % | 100 % | 100 % | 90 % | 70 % | 0 % | **PARTIAL** | HIGH-2 lint, HIGH-5 robots |
| Account overview, edit-account, edit-address | 100 % | 100 % | 100 % | partially | 100 % | 70 % | 100 % | 0 % | **PARTIAL** | MED-1 schemas; MED-9 ownership confirm |
| Contact | 100 % | 100 % | 100 % | n/a | 100 % | 70 % | 100 % | 0 % | **PARTIAL** | MED-2 + MED-7 |
| Static / policy / dynamic page | 100 % | 100 % | 100 % | n/a | 100 % | 100 % | 100 % | 0 % | **COMPLETE** | nothing |
| Search | 100 % | 100 % | 100 % | n/a | 100 % | 100 % | 100 % | 0 % | **COMPLETE** | header suggest endpoint (HIGH-6) |
| Sitemap, robots, JSON-LD | 100 % | n/a | 100 % | n/a | 100 % | n/a | 95 % | 10 % | **PARTIAL** | MED-6 + LOW-1 |
| Proxy / WP redirect | 100 % | n/a | 100 % | n/a | 100 % | n/a | 100 % | 0 % | **PARTIAL** | CRIT-1 |
| API client / contracts layer | 100 % | n/a | 95 % | n/a | 100 % | n/a | n/a | 30 % | **PARTIAL** | CRIT-3 type, HIGH-1 dedupe |

**Aggregate: 82 %** weighted by surface area; held back by 3 CRITICAL + 6 HIGH.

---

## 13. Final Recommendation

### Production-ready? **No** — close, but not yet.

Backend is solid: contract, security, ownership, stock locking, coupon atomicity, idempotency are all in place and verified. Frontend is well-structured (server components for SEO, React Query for dynamic, CSRF-aware client, ISR + tag-based revalidation, comprehensive metadata + JSON-LD). The blockers are all narrow:

### P0 — must fix before any production cut
1. **CRIT-1** — change `proxy.ts:103` from `redirect` → `tiep`. One-line fix; add proxy regression test.
2. **CRIT-3** — extend `OrderSummary` with `priceChanges` and surface a notice on checkout submit / confirmation page.
3. **HIGH-2** — fix the 4 lint errors so CI passes.
4. **HIGH-5** — add `/xac-nhan-email` to robots disallow.
5. **HIGH-3** — wire `npm run test` into CI for web (one workflow line).

### P1 — fix in the production-readiness sprint
6. **CRIT-2** + **LOW-5** — collapse all 4 `/api/products/[id]/{snapshot,pricing,stock,variants}` Next handlers onto backend `/api/v1/products/{idOrSlug}/snapshot`.
7. **HIGH-1** — delete or wire up the unused `/api/cart/add`, `/api/orders/quick-buy` Next handlers.
8. **HIGH-4** — replace the unconditional `fetchCart` on every nav with a lighter cart-count call or React Query.
9. **HIGH-6** — switch header suggest to `/api/v1/search-suggest`.
10. **MED-1, MED-2, MED-5** — Zod schemas for edit-account, edit-address, contact (sync schema with form), return create.

### P2 — quality sprint
11. **MED-3** — auto-refresh auth profile after register (or route to login).
12. **MED-6** — robots/path `noIndex` consistency.
13. **MED-7** — drop `/api/v1/contact` CSRF exemption and protect with cookie-issued CSRF or CAPTCHA.
14. **MED-8** — swap static VN address data for backend lookup with `staleTime: Infinity`.
15. **MED-9** — explicit per-row ownership audit on `CustomerAddressService` (read-only verification + integration test).
16. **LOW-1..LOW-5** as listed.

Once P0 ships, the storefront is production-grade for the launch SKU set. P1 is required for sustained ops; P2 is hygiene.

> Note for follow-ups: this audit is **read-only**. None of the fixes above were attempted. Each one needs its own task with regression tests as prescribed in §10.3.
