# API Contract

This document is the human-readable companion to `bigbike-backend/src/main/resources/openapi/bigbike-openapi.json`.

## Governance

- Canonical contract sources for active work:
  1. controller/service/config/test evidence
  2. this document
  3. checked-in OpenAPI companion
- If OpenAPI and controllers drift, controllers and current tests are the verification source until docs are repaired.

## Auth Models

| Model | Used by | Current contract | Status | Evidence |
|---|---|---|---|---|
| Admin JWT | Admin REST APIs | `Authorization: Bearer <token>` | `CONFIRMED_FROM_CODE` | `SecurityConfig.java`, admin controllers |
| Customer session cookie | Customer account/order/address APIs | `bb_session` cookie | `CONFIRMED_FROM_CODE` | `SecurityConfig.java`, `CustomerSessionFilter.java` |
| CSRF header | Customer/guest cart and checkout mutations | `X-CSRF-Token` must match `bb_csrf` cookie | `CONFIRMED_FROM_CODE` | `CustomerCsrfFilter.java`, tests |
| Admin WebSocket JWT | STOMP CONNECT to `/ws` | native header `Authorization: Bearer <token>` | `CONFIRMED_FROM_CODE` | `WebSocketConfig.java`, `adminWebSocket.js` |

### Admin auth endpoints

| Method | Path | Current purpose | Response shape | Status | Evidence |
|---|---|---|---|---|---|
| `POST` | `/api/v1/auth/login` | Admin email + password login. Issues access token (body) + `bb_admin_refresh` httpOnly cookie | `ApiDataResponse<TokenResponse>` | `CONFIRMED_FROM_CODE` | `AuthController.java`, `AdminAuthService.login` |
| `POST` | `/api/v1/auth/refresh` | Rotate the refresh token. Reads `bb_admin_refresh` cookie (falls back to body). One-time use: old token is revoked, a new pair is issued | `ApiDataResponse<TokenResponse>` | `CONFIRMED_FROM_CODE` | `AuthController.java`, `AdminAuthService.refresh` |
| `POST` | `/api/v1/auth/logout` | Revoke the current refresh token and clear the cookie | `ApiDataResponse<Void>` | `CONFIRMED_FROM_CODE` | `AuthController.java`, `AdminAuthService.logout` |
| `GET` | `/api/v1/auth/me` | Current admin profile from the bearer token | `ApiDataResponse<AdminUserProfile>` | `CONFIRMED_FROM_CODE` | `AuthController.java`, `AdminAuthService.getProfile` |

**`refresh` error contract:** a **missing, blank, invalid, revoked or expired** refresh token returns **`401 UNAUTHORIZED`** (the standard `ApiResponse` error envelope), not `500`. In particular, calling `/api/v1/auth/refresh` with no cookie and no body (e.g. before logging in, or after a reload dropped the in-memory access token) is an expected unauthenticated case and yields `401`. Status: `CONFIRMED_FROM_CODE` — `AdminAuthService.refresh` guards a null/blank token and throws `UnauthorizedException`; `UnauthorizedException → HttpStatus.UNAUTHORIZED`.

## HTTP Caching

By default every API response carries `Cache-Control: no-cache, no-store, max-age=0, must-revalidate` (Spring Security default) — correct for authenticated and personalised responses, which must never be stored by a browser or CDN.

**Exception — public catalog/content GETs are briefly cacheable.** `PublicCacheHeaderFilter` overwrites the header to `Cache-Control: public, max-age=60` for `GET` requests on an explicit allowlist of fully public, non-personalised read endpoints:

- `GET /api/v1/products`, `/api/v1/products/**`
- `GET /api/v1/categories`, `/api/v1/categories/**`
- `GET /api/v1/brands`, `/api/v1/brands/**`
- `GET /api/v1/catalog/**` (facets)
- `GET /api/v1/articles`, `/api/v1/articles/**`
- `GET /api/v1/pages`, `/api/v1/pages/**`
- `GET /api/v1/menus/**`
- `GET /api/v1/sliders`, `/api/v1/home-videos`, `/api/v1/content-categories`
- `GET /api/v1/settings/public`

Any path containing `/admin/` or `/internal/` is excluded defensively. Cart, checkout, customer, order and all other cookie/auth-bearing endpoints are **not** on the allowlist and keep `no-store`, so no personalised response can leak into a shared cache.

The 60-second `max-age` is deliberately short: an admin edit becomes visible to all visitors within a minute without an explicit purge. Non-GET methods are never affected.

Status: `CONFIRMED_FROM_CODE` — `PublicCacheHeaderFilter.java`, `SecurityConfig.java` (filter registration), `RbacUrlGateIntegrationTest` (`publicCatalogGet_isBrowserCacheable`, `adminGet_staysNoStore_notCacheable`, `cartGet_staysNoStore_notCacheable`).

## Public And Customer Endpoints

| Method | Path | Current purpose | Response shape | Status | Evidence |
|---|---|---|---|---|---|
| `GET` | `/api/v1/search` | Cross-domain search for products/articles | `ApiDataResponse<SearchPayload>` | `CONFIRMED_FROM_CODE` | `PublicSearchController.java` |
| `GET` | `/api/v1/search-suggest` | Lightweight typeahead product suggestions | `ApiDataResponse<SearchPayload>` | `CONFIRMED_FROM_CODE` | `PublicSearchController.java` |
| `GET` | `/api/v1/address/provinces` | List provinces | `ApiDataResponse<List<VnAddressItem>>` | `CONFIRMED_FROM_CODE` | `VnAddressController.java` |
| `GET` | `/api/v1/address/provinces/{provinceCode}/districts` | List districts by province code | `ApiDataResponse<List<VnAddressItem>>` | `CONFIRMED_FROM_CODE` | `VnAddressController.java` |
| `GET` | `/api/v1/address/districts/{districtCode}/wards` | List wards by district code | `ApiDataResponse<List<VnAddressItem>>` | `CONFIRMED_FROM_CODE` | `VnAddressController.java` |
| `GET` | `/api/v1/content-categories` | List content (news) categories with published-article counts, for the Tin tức category filter | `ApiListResponse<ContentCategoryWithCount>` | `CONFIRMED_FROM_CODE` | `ContentController.java` |
| `POST` | `/api/v1/customer/auth/register` | Email/phone + password registration. Body accepts `email`, optional `phone`, `password`, `firstName`, `lastName`; at least email or phone must be present. | `ApiDataResponse<CustomerAuthResponse>` | `CONFIRMED_FROM_CODE` | `CustomerAuthController.java`, `CustomerRegisterRequest.java`, `CustomerAuthService.register` |
| `POST` | `/api/v1/customer/auth/login` | Email/phone + password login. Body accepts optional `remember` (boolean, default `false`) controlling session lifetime | `ApiDataResponse<CustomerAuthResponse>` | `CONFIRMED_FROM_CODE` | `CustomerAuthController.java`, `CustomerLoginRequest.java` |
| `POST` | `/api/v1/customer/auth/verify-email` | Verify email token from request param | `ApiDataResponse<{verified:true}>` | `CONFIRMED_FROM_CODE` | `CustomerAuthController.java` |
| `POST` | `/api/v1/customer/auth/resend-verification` | Resend the email-verification message for the authenticated customer | `ApiDataResponse<Map<String,Object>>` | `CONFIRMED_FROM_CODE` | `CustomerAuthController.java` |
| `GET` | `/api/v1/customer/auth/oauth/{provider}/authorize` | Start social login. `provider` ∈ `google` `facebook`. Sets a short-lived `bb_oauth_state` cookie and `302`-redirects to the provider consent screen. Optional `tiep` query param is the post-login returnTo path | `302` redirect | `CONFIRMED_FROM_CODE` | `CustomerOAuthController.java` |
| `GET` | `/api/v1/customer/auth/oauth/{provider}/callback` | Provider redirect target. Validates `state`, exchanges `code`, links-or-creates the customer, sets the `bb_session`/`bb_refresh`/`bb_csrf` cookies and `302`-redirects back to the storefront (`returnTo` on success, `/dang-nhap/?error=oauth` on failure) | `302` redirect | `CONFIRMED_FROM_CODE` | `CustomerOAuthController.java` |

### Customer login — `remember` flag

`POST /api/v1/customer/auth/login` request body:

```json
{ "login": "email@example.com hoặc 0901234567", "password": "…", "remember": false }
```

- `remember` is optional; `null`/absent is treated as `false`.
- `remember = false` → the `bb_refresh` cookie is issued with a **1-day** lifetime.
- `remember = true` → the `bb_refresh` cookie keeps the **30-day** lifetime.
- The chosen lifetime is persisted on `customer_sessions.remember` so the `refresh` endpoint preserves it on rotation.

### Social login (OAuth2) flow

1. Browser navigates to `…/oauth/{provider}/authorize?tiep=<returnTo>`.
2. Backend stores a random `state` (carrying `tiep`) in the `bb_oauth_state` cookie (`SameSite=Lax`, HttpOnly, ~10 min) and redirects to Google/Facebook.
3. Provider redirects back to `…/oauth/{provider}/callback?code=&state=`.
4. Backend validates `state`, exchanges `code` for the provider profile (`subject`, `email`, `displayName`), then **links-or-creates** the customer:
   - existing `(oauth_provider, oauth_subject)` → reuse that account;
   - else a verified provider `email` matching an existing account → link OAuth fields onto it;
   - else create a new active customer (`password_hash = null`, `email_verified_at = now()`).
5. Backend issues a 30-day session and redirects to the storefront.
| `GET` | `/api/v1/customer/addresses` | List own addresses | `ApiDataResponse<List<CustomerAddressResponse>>` | `CONFIRMED_FROM_CODE` | `CustomerAddressController.java` |
| `POST` | `/api/v1/customer/addresses` | Create own address | `ApiDataResponse<CustomerAddressResponse>` with HTTP `201` | `CONFIRMED_FROM_CODE` | `CustomerAddressController.java` |
| `PATCH` | `/api/v1/customer/addresses/{id}` | Update own address | `ApiDataResponse<CustomerAddressResponse>` | `CONFIRMED_FROM_CODE` | `CustomerAddressController.java` |
| `DELETE` | `/api/v1/customer/addresses/{id}` | Delete own address | HTTP `204` no body | `CONFIRMED_FROM_CODE` | `CustomerAddressController.java` |
| `GET` | `/api/v1/customer/orders` | List own orders. Each item includes `channel` (`"WEB"` hoặc `"IN_STORE"`). | `ApiListResponse<OrderListItemResponse>` | `CONFIRMED_FROM_CODE` | `CustomerOrderController.java` |
| `GET` | `/api/v1/customer/orders/{orderId}` | Get own order detail. Response includes `channel` (`"WEB"` hoặc `"IN_STORE"`). | `ApiDataResponse<OrderDetailResponse>` | `CONFIRMED_FROM_CODE` | `CustomerOrderController.java` |
| `GET` | `/api/v1/customer/orders/returns` | List own returns | `ApiDataResponse<List<CustomerReturnResponse>>` | `CONFIRMED_FROM_CODE` | `CustomerOrderController.java` |
| `GET` | `/api/v1/customer/orders/returns/{returnId}` | Get own return detail | `ApiDataResponse<CustomerReturnResponse>` | `CONFIRMED_FROM_CODE` | `CustomerOrderController.java` |
| `POST` | `/api/v1/customer/orders/{orderId}/returns` | Create own return request | `ApiDataResponse<CustomerReturnResponse>` with HTTP `201` | `CONFIRMED_FROM_CODE` | `CustomerOrderController.java` |
| `GET` | `/api/v1/customer/orders/{orderId}/return-eligibility` | Pre-check whether the customer can open a return on this order and which line items still have returnable quantity. Read-only. Returns stable reason codes (`OK`, `ORDER_NOT_FOUND`, `NOT_OWNER`, `ORDER_NOT_COMPLETED`, `WINDOW_EXPIRED`, `RETURN_IN_PROGRESS`, `NOTHING_TO_RETURN`, `IN_STORE_ORDER`). `IN_STORE_ORDER` — đơn được tạo qua POS (`channel="IN_STORE"`) không hỗ trợ trả hàng online; `eligible=false`. | `ApiDataResponse<ReturnEligibilityResponse>` | `CONFIRMED_FROM_CODE` | `CustomerOrderController.java`, `CustomerReturnService.getReturnEligibility` |
| `GET` | `/api/v1/customer/wishlist` | List own wishlist product IDs, newest first | `ApiDataResponse<List<String>>` | `CONFIRMED_FROM_CODE` | `CustomerWishlistController.java` |
| `GET` | `/api/v1/customer/wishlist/products` | List own wishlisted products (paginated, PUBLISHED only). Each `Product` uses the **list-view** shape — see "Product list — list-view payload vs detail payload". | `ApiListResponse<Product>` | `CONFIRMED_FROM_CODE` | `CustomerWishlistController.java` |
| `POST` | `/api/v1/customer/wishlist` | Add a product to own wishlist (idempotent) | `ApiDataResponse<{productId,added}>` with HTTP `201` | `CONFIRMED_FROM_CODE` | `CustomerWishlistController.java` |
| `DELETE` | `/api/v1/customer/wishlist/{productId}` | Remove a product from own wishlist | HTTP `204` no body | `CONFIRMED_FROM_CODE` | `CustomerWishlistController.java` |

## Catalog Facets Contract

`GET /api/v1/catalog/facets` — public, no auth. Aggregated product counts powering the storefront catalog filter sidebar.

Query params (all optional):
- `category` — category slug (`SLUG_REGEX`). Scopes the brand/color/price counts to that category.
- `q` — free-text search term (`@Size(max=100)`).

Response shape: `ApiDataResponse<CatalogFacets>`:
- `categories`: `[{ key, label, image: null, count }]` — one bucket per visible category, ordered by `sortOrder`.
- `brands`: `[{ key, label, image, count }]` — one bucket per visible brand with `count > 0`; `image` is the brand logo `ImageAsset`. Buckets with `count = 0` are omitted so the sidebar matches the legacy WordPress brand widget.
- `colors`: `[{ key, label, image: null, count }]` — **dynamic** buckets derived from every product variant color option (grouped by base slug, e.g. `den-2` → `den`). Buckets with `count = 0` are omitted; ordered by `count` descending. Labels resolve known slugs to friendly names (Vietnamese/English), otherwise echo the raw value. The set is open-ended (model-specific colors like `cyborg-blue`, `mythology-gold` appear) — this mirrors the legacy WordPress layered-nav color widget.
- `genders`: `[{ key, label, image: null, count }]` — fixed set `[Nam, Nữ, Unisex]`; buckets with `count = 0` are omitted (V184).
- `priceBands`: `[{ key, label, minPrice, maxPrice, count }]` — the 7 fixed price bands; `maxPrice` is `null` for the open-ended top band (`tren-10tr`, "Trên 10.000.000 VND").

**v1 counting semantics:** counts use a base context of `PUBLISHED + q`. Brand/color/price buckets additionally honor `category`; the `categories` bucket intentionally ignores the `category` param so every category keeps a navigable count. Counts are not cross-excluded per dimension — this matches the legacy WordPress filter widget. Status: `CONFIRMED_FROM_CODE` — `CatalogController.getCatalogFacets`, `CatalogReadService.computeFacets`.

## Public Reviews Contract

Public, no auth. Product detail review panel (web PDP `ReviewsSection`). Evidence: `PublicReviewController.java`, `PublicReviewService.getProductReviews`, `ReviewJpaRepository`.

### `GET /api/v1/products/{productId}/reviews`

Lists **APPROVED** reviews only (PENDING/SPAM/TRASH are never exposed). Response: `ApiDataResponse<PublicProductReviewsResponse>`.

Query params (all optional):
- `page` — 1-based page, `@Min(1)`, default `1`.
- `size` — page size, `@Min(1) @Max(50)`, default `10`.
- `rating` — star filter `@Min(1) @Max(5)`. When present, **only the `reviews` list is narrowed to that star**; `avgRating`, `totalReviews` and `ratingBreakdown` stay global (computed over all approved reviews) so the summary panel is stable while the customer drills into one bucket.
- `sort` — ordering of the list: `newest` (default — `createdAt` desc), `highest` (`rating` desc, then `createdAt` desc), `lowest` (`rating` asc, then `createdAt` desc). Unknown values fall back to `newest`.

Response `data` shape:
- `avgRating` (number, 1-decimal, **HALF_UP** — `PublicReviewService.roundAverage`), `totalReviews` (long) — **always global**, never affected by `rating`. Khi 0 review approved: `avgRating = 0.0` (không phải null) và `totalReviews = 0` — FE gate hiển thị sao bắt buộc bằng `totalReviews ≥ 1`, không bằng `avgRating > 0` (xem `BUSINESS_RULES.md` `REVIEW_RULE_003`).
- `ratingBreakdown` — `{ "5": n, "4": n, "3": n, "2": n, "1": n }`, every key present, global counts.
- `reviews` — `[{ id, authorName, rating, comment, createdAt }]`, filtered + sorted per params.
- `pagination` — `{ page, pageSize, totalItems, totalPages, hasNext, hasPrevious }`. `totalItems`/`totalPages`/`hasNext` follow the **filtered** list (so "load more" pages correctly within one star bucket); when `rating` is absent these equal the global approved count.

Out-of-range `page`/`size`/`rating` → `400 VALIDATION_ERROR`. Unknown `productId` → `404`.

### `POST /api/v1/products/{productId}/reviews`

Submits a review (`status = PENDING`, awaits admin moderation). Honeypot `website` field → accept-and-drop silently. Duplicate guard: same `productId` + normalized author + normalized body within 24h → `409`. See `SubmitReviewRequest`.

## Content Categories Contract

`GET /api/v1/content-categories` — public, no auth. Powers the Tin tức (news) category filter, including the mobile category drawer.

No query params. Response shape: `ApiListResponse<ContentCategoryWithCount>`:
- `id`, `slug`, `name` — the content category.
- `articleCount` — number of `PUBLISHED` articles in that category.

**Counting semantics:** an article counts toward a category when that category is its primary `category` **or** appears in its many-to-many `categories` list — the same membership rule as the `category` filter of `GET /api/v1/articles`. Every content category is returned (including `articleCount = 0`), ordered by `name`. Status: `CONFIRMED_FROM_CODE` — `ContentController.listContentCategories`, `ContentReadService.listContentCategories`.

**Admin CRUD** (consumed by the admin Content screen "Quản lý danh mục bài viết" modal — `ContentCategoryManagerModal`):

| Method | Path | Permission | Body | Response |
|---|---|---|---|---|
| `POST` | `/api/v1/admin/content/content-categories` | `content.update` | `UpsertCategoryRequest` (`slug` lowercase-kebab, `name`, optional `description`/`visible`/`showOnHomepage`/`sortOrder`/`parentId`) | `ApiDataResponse<ContentCategoryItem>` (`{ id, slug, name }`) |
| `PATCH` | `/api/v1/admin/content/content-categories/{id}` | `content.update` | same `UpsertCategoryRequest` | `ApiDataResponse<ContentCategoryItem>` |

No DELETE endpoint exists for content categories. Status: `CONFIRMED_FROM_CODE` — `AdminContentController.createCategory/updateCategory`, `adminApi.createContentCategory/updateContentCategory`. (Note: `createCategory()` in `adminApi.js` targets `/admin/categories` — **product** categories — a separate resource.)

## Article Content Contract

`GET /api/v1/articles/{slug}` — public, no auth. Returns `ApiDataResponse<Article>` for one
`PUBLISHED` article. Served by `ContentController.getArticleBySlug`.

The `Article` payload includes **`relatedProducts`** — an ordered `Product[]` of catalog products
showcased in the "Sản phẩm sử dụng trong bài viết" section of the blog detail page:
- Each entry is a list-item `Product` (id, sku, slug, name, brand, category, image, price,
  stockState, rating, ratingCount) — no variants/specifications/gallery.
- Only `PUBLISHED` products appear; trashed/draft products are filtered out by the read path.
- Order follows the admin-defined `sort_order` of `article_product_map`.
- Empty array when the article links no products.

**Admin upsert** (`AdminContentMutationService`, article branch) accepts `productIds: string[]` on
`UpsertArticleRequest`: it replaces the article's product set with the resolved, de-duplicated,
order-preserving list. `null` keeps the existing set; `[]` clears it (same presence semantics as
`tags`). The admin read DTO `AdminContentItem` returns `relatedProducts` as a lightweight
`RelatedProductRef[]` (`id`, `slug`, `name`, `imageUrl`) for rendering product chips in the editor.

Status: `CONFIRMED_FROM_CODE` — `ContentController`, `AdminContentMutationService`,
`UpsertArticleRequest`, `AdminContentItem`. See [DATA_CONTRACT.md](DATA_CONTRACT.md) §"Article ↔ Product relation (V130)".

### Article / Page body blocks — `bodyBlocks` (V140)

Admin detail reads (`AdminContentItem`) của cả Article lẫn Page giờ bao gồm `bodyBlocks: DescriptionBlock[] | null`. `null` = chưa có blocks; `[]` = body bị xoá rỗng. **Public read** (`GET /api/v1/articles/{slug}`, `GET /api/v1/pages/{slug}`) **không** trả `bodyBlocks` — web và mobile tiếp tục đọc `body` HTML như cũ.

**Upsert mutation:**
- Gửi key `bodyBlocks: [...]` trong `UpsertArticleRequest` / `UpsertPageRequest` → server render HTML từ blocks, ghi đè cả `body_blocks` lẫn `body`.
- Bỏ key `bodyBlocks` hoàn toàn → `body` được patch bình thường; `body_blocks` không bị đụng (presence-flag pattern, giống `products.descriptionBlocks`).
- **Tạo mới (`POST`):** nội dung là bắt buộc — chấp nhận **hoặc** `body` **hoặc** `bodyBlocks` non-empty. Gửi `bodyBlocks` mà bỏ `body` vẫn hợp lệ (server tự render `body` từ blocks); chỉ báo lỗi `body REQUIRED` khi thiếu cả hai.

Status: `CONFIRMED_FROM_CODE` — `UpsertArticleRequest.bodyBlocksPresent`, `UpsertPageRequest.bodyBlocksPresent`, `AdminContentMutationService`, `AdminContentItem.bodyBlocks`. Xem [DATA_CONTRACT.md](DATA_CONTRACT.md) §"Article body blocks (V140)".

### Article / Page EN translations on admin read — `translations` (V138)

Admin detail reads (`AdminContentItem`) của cả Article lẫn Page bao gồm `translations: { en: {...} } | null` — bản dịch tiếng Anh để form admin nạp lại tab EN. `null` trên list reads; non-null trên detail reads (`GET /api/v1/admin/content/{type}/{id}`). Shape `en` là superset: `title`, `excerpt` (article-only), `body`, `heroTitle` / `heroDescription` / `heroKicker` (page-only), `seoTitle`, `seoDescription` — trường không áp dụng cho loại đó = `null`. **Public read không đổi** (đọc cột canonical + fallback VI, không trả khối `translations`).

Status: `CONFIRMED_FROM_CODE` — `AdminContentItem.translations`, `ContentTranslations`, `ArticleTranslations` / `PageTranslations`, `AdminContentReadService.fromArticle` / `fromPage`. Xem [DATA_CONTRACT.md](DATA_CONTRACT.md) §"Article bilingual content (V138)".

## Commerce Mutation Contracts

| Endpoint | Current contract | Status | Evidence |
|---|---|---|---|
| `POST /api/v1/cart/coupons` | Applies one coupon to the active cart after validation and row locking. | `CONFIRMED_FROM_CODE` | `CartService.applyCoupon`, cart tests |
| `POST /api/v1/checkout` | Revalidates price/stock/coupon state, creates order/payment/shipping rows, decrements stock, and snapshots coupons. | `CONFIRMED_FROM_CODE` | `CheckoutService.java`, checkout tests |
| `POST /api/v1/orders/quick-buy` | Creates order directly from one product/variant request. | `CONFIRMED_FROM_CODE` | `CheckoutService.quickBuy` |
| `POST /api/v1/admin/pos/orders` | Creates completed/paid in-store order immediately. | `CONFIRMED_FROM_CODE` | `AdminPosController.java`, `PosOrderService.java` |

## Checkout Options Contract

`GET /api/v1/checkout/options` — no auth required; accessible to guests and authenticated customers.

Response shape: `ApiDataResponse<CheckoutOptionsResponse>`:
- `paymentMethods`: `[{ code, title }]` — `COD` ("Thanh toán khi nhận hàng (COD)"), `BACS` ("Chuyển khoản"). **Codes are uppercase strings; `title` is the customer-facing label.** These are the only two accepted payment methods — there is no automatic payment gateway.
- `shippingMethods`: `[{ id, code, title, cost, freeShippingThreshold, minOrderAmount, zoneRegionCode }]`
  - `cost` — base shipping fee (VND, never null; zero-cost methods have `cost: 0`)
  - `freeShippingThreshold` — if `orderSubtotal >= freeShippingThreshold`, effective shipping is 0; `null` means no threshold
  - `minOrderAmount` — minimum subtotal required to use this method; `null` means no minimum
  - `zoneRegionCode` — region/zone identifier (e.g. ISO-3166-2 code) this method applies to; `null` means applies to all regions

Frontend must compute `effectiveShippingCost` using `freeShippingThreshold` before displaying totals — the cart total returned by `GET /api/v1/cart` does not include shipping (always 0 in cart phase).

Status: `CONFIRMED_FROM_CODE` | Evidence: `CheckoutService.getOptions`, `ShippingMethodOptionResponse.java`, `CheckoutController.java`

## Dashboard Contract

| Endpoint | Permission | Current behavior | Status | Evidence |
|---|---|---|---|---|
| `GET /api/v1/admin/dashboard?period={7d\|30d\|90d}` | `orders.read`; accessible to `ADMIN`, `SUPER_ADMIN`, `SHOP_MANAGER` | Returns KPI aggregates, revenue series, order-status breakdown, recent orders, top products. Revenue excludes `CANCELLED`, `FAILED`, `REFUNDED` orders. Default period: `30d`. | `CONFIRMED_FROM_CODE` | `AdminDashboardController.java`, `AdminDashboardService.java` |

Response shape: `ApiDataResponse<AdminDashboardSummaryResponse>`:
- `kpi`: `{ todayRevenue, todayPaidRevenue, todayRevenuePct, todayOrders, todayOrdersDelta, pendingOrders, activeProducts }`
- `revenueData`: `[{ date (ISO yyyy-MM-dd), revenue, orders }]` — one entry per day in the period, VN timezone
- `orderStatusBreakdown`: `[{ status, count }]` — period-scoped, all statuses with count > 0
- `recentOrders`: last 5 orders `[{ id, orderNumber, customerName, customerEmail, total, orderStatus, currency, placedAt }]`
- `topProducts`: top 5 by line-item revenue `[{ productId (product_pk varchar), name, revenue, units }]`

Status: `CONFIRMED_FROM_CODE`

## Admin Catalog Contract

### Product list — filter and sort params (V111+)

`GET /api/v1/admin/products` and `GET /api/v1/products` accept the homepage placement filter:

| Param | Type | Purpose |
|---|---|---|
| `homepageBlock` (admin) / `homepage_block` (public) | enum `NONE \| FEATURED_GRID` (optional) | Filter to a single homepage slot. Omit for all. |
| `sort` | `string` (optional) | Accepts `homepageOrder:asc` and `homepageOrder:desc` in addition to `name`, `price`, `createdAt`, `updatedAt`. Null-last: unpinned products always appear after pinned ones. |

**Schema:** Each product carries exactly one `homepageBlock` enum. Migration `V111__refactor_product_homepage_block.sql` (2026-05-14) backfilled from the legacy boolean pair (`is_featured`, `show_on_homepage`). Migration `V149__drop_recommended_carousel_block.sql` (2026-05-26) removed `RECOMMENDED_CAROUSEL` because the web storefront never rendered that block — all products previously in that slot were reset to `NONE`.

**Homepage placement** (admin-managed via dedicated screen, max enforced in admin UI):
- `FEATURED_GRID` — max 12 products shown in the "Sản phẩm nổi bật" grid on the homepage

**New endpoint (V149):** `POST /api/v1/admin/products/homepage-blocks` — atomically sets the full ordered list of FEATURED_GRID products. Requires `products.update` permission. Request: `{ "featuredGrid": ["<id>", ...] }` (max 12 ids, each must be PUBLISHED). Response: updated list of FEATURED_GRID products.

`homepageBlock` and `homepageOrder` are no longer editable in the per-product form; they are set exclusively via the homepage-blocks endpoint.

Status: `CONFIRMED_FROM_CODE`

Evidence:
- `HomepageBlock.java` — enum definition
- `AdminCatalogController.java` — `@RequestParam(...) String homepageBlock` with `@Pattern` validation
- `CatalogController.java` — `@RequestParam(name = "homepage_block", ...) String homepageBlock`
- `AdminCatalogReadService.listProducts()` / `CatalogReadService.listProducts()` — single-slot filter
- `bigbike-openapi.json` — `homepage_block` param + `homepageBlock` enum field on Product schema
- `V111__refactor_product_homepage_block.sql` — schema change + backfill

### Product list — gender filter (V184)

`GET /api/v1/products` and `GET /api/v1/admin/products` accept:

| Param | Type | Validation | Purpose |
|---|---|---|---|
| `filter_gender` | `string` (optional) | `@Size(max=20)` | Filter products by gender field. Case-insensitive exact match. Values: `Nam` \| `Nữ` \| `Unisex`. Omit or blank = no filter. |

- Filtering is product-level (not variant-level).
- The same `filter_gender` value is accepted by `GET /api/v1/catalog/facets` so facet counts can be scoped accordingly (future — currently facets do not re-scope on gender param).
- `@Pattern(SLUG_REGEX)` is intentionally **not** used because `Nữ` contains Vietnamese characters incompatible with the slug regex; `@Size(max=20)` is used instead.

Status: `CONFIRMED_FROM_CODE` — `CatalogController.java`, `CatalogReadService.matchesGender`.

### Product list — list-view payload vs detail payload

`GET /api/v1/products` returns a **list view** of each `Product`, not the full
detail object. The list view carries only what the storefront catalog grid/card
renders; the heavy detail-only payload is served exclusively by
`GET /api/v1/products/{slug}`.

| Field | List view (`GET /api/v1/products`) | Detail (`GET /api/v1/products/{slug}`) |
|---|---|---|
| `id`, `sku`, `slug`, `name`, `shortDescription` | ✅ present | ✅ present |
| `brand`, `category`, `categories`, `image`, `price` | ✅ present | ✅ present |
| `stockState`, `stockQuantity`, `forceOutOfStock`, `rating`, `ratingCount`, `homepageBlock`, `homepageOrder` | ✅ present | ✅ present |
| `description`, `contentBottom`, `promotionContent`, `installationGuide` | ❌ `null` | ✅ present |
| `warrantyMonths`, `warrantyScope`, `originBrandCountry`, `originManufactureCountry`, `weightGrams`, `sizeGuide` | ❌ `null` | ✅ present |
| `gallery`, `videos`, `specifications`, `faqs`, `positiveNotes`, `negativeNotes` | ❌ `[]` | ✅ present |
| `videos[].description` | — | ✅ present (detail) |
| `seo` | ❌ `null` | ✅ present |
| `variants` | ✅ present as **stubs** | ✅ full |
| `variants[].id/sku/name/price/stockState/stockQuantity/isAvailable/trackSerials` | ✅ present | ✅ present |
| `variants[].options`, `variants[].gallery`, `variants[].image` | ❌ `[]` / `null` | ✅ present |

**Why variant stubs and not full omission:** the storefront product card needs the
variant *count* (`variants.length`) to decide between the "add to cart" and
"choose variant" buy-box buttons, but never reads variant internals on a list.
Keeping a stub array (id/sku/name/price/stock) preserves that signal while
dropping the per-variant option/gallery graph — historically ~62% of the list
payload. Filtering still runs on the full domain object server-side (the
`filter_color` param matches against `variants[].options`); the projection to the
list view happens only on the returned page.

This same list-view shape is what the article `relatedProducts` array already
documents (one list-item `Product` per entry — see "Article Content Contract").

Status: `CONFIRMED_FROM_CODE`

Evidence: `CatalogReadService.listProducts` (`toListView` / `toVariantStub` projection of the paginated slice), `CatalogController.listProducts`, `PublicReadApiTest.publicProductList_omitsDetailOnlyFields_butKeepsVariantCount`.

### Variant option — admin round-trip field (`attributeValueId`)

A variant option (`variants[].options[]`) is returned with these fields:

| Field | Public (`GET /api/v1/products/{slug}`) | Admin (`GET /api/v1/admin/products/{id}`) |
|---|---|---|
| `name`, `value` | ✅ human label (e.g. `Màu sắc` / `Đen bóng`) | ✅ |
| `attributeValueId` | ❌ omitted | ✅ the linked dictionary value id (when the option resolves to one) |

`value` is the human **label** (`Đen bóng`), not the stored slug (`den-bong`) — the read path prefers the dictionary label. The admin editor cannot reliably reconstruct the dictionary link from the label alone (some slugs carry WP dedup suffixes such as `xam-2` / `trang-2` that no label maps back to). Returning `attributeValueId` lets the admin form round-trip the exact reference, so re-saving a product preserves the colour link. It is **admin-only** (`@JsonInclude(NON_NULL)`, populated only when `publicView = false`); the public storefront response never carries it.

Colour variants render on the storefront using the **variant's own gallery image** (the first image of the matching variant), not a per-term colour swatch or hex value. The swatch/hex feature (`colorHex`, `swatchImageUrl`, per-option `swatchImageId`, and the `attribute_values.color_hex` / `attribute_values.swatch_image_id` / `product_variant_options.swatch_image_id` columns) was removed.

Status: `CONFIRMED_FROM_CODE`

Evidence: `ProductVariantOption.java` (record component `attributeValueId`, `@JsonInclude(NON_NULL)`), `JpaCatalogReadRepository.toVariantOption` (populates `attributeValueId` from `AttributeValueEntity.id`, gated on `publicView`), `VariantSelector.tsx` (renders the colour chip from `variant.gallery[0]`).

### Attribute value management — admin catalog endpoints

The colour/value dictionary for variant attributes is read and curated through `AdminAttributeController` (`/api/v1/admin`):

| Endpoint | Body | Response | Notes |
|---|---|---|---|
| `GET /attributes` | — | **bare array** of `{ id, code, name, kind, valueCount }` | Not wrapped in the `{data}` envelope. |
| `GET /attributes/{attributeId}/values` | — | **bare array** of `{ id, attributeId, slug, label, sortOrder }` | Not wrapped. |
| `PATCH /attributes/{id}` | `{ name }` | `{ data: AttributeSummaryResponse }` | Renames an attribute's display name. **Only `name` changes; `code` is immutable** (variant options resolve to their attribute via the code). Requires `products.update`. |
| `POST /attributes/{attributeId}/values` | `{ label, slug? }` | `{ data: AttributeValueResponse }` | Adds a new value. `slug` defaults to a diacritic-insensitive kebab-case form of `label` (same rule as product slugs, matching storefront colour-filter keys). Duplicate slug within the same attribute → `409 CONFLICT`; a label that yields an empty slug → `400 VALIDATION_ERROR`. Requires `products.update`. |
| `PATCH /attribute-values/{id}` | `{ label }` | `{ data: AttributeValueResponse }` | Renames an existing value. **Only `label` changes; `slug` is immutable** so variant options that reference it keep working (colour-scoped galleries and web filters key off the slug). Requires `products.update`. |

The two `GET` endpoints return bare arrays (legacy shape); the admin client (`fetchAttributes` / `fetchAttributeValues`) tolerates both bare arrays and `{data}`. The new `POST`/`PATCH` use the standard `ApiResponseFactory` envelope.

Status: `CONFIRMED_FROM_CODE`

Evidence: `AdminAttributeController.java` (`listAttributes`, `listAttributeValues`, `updateAttribute`, `createAttributeValue`, `updateAttributeValue`), `AdminAttributeService.java` (`updateAttributeName` name-only, `createValue` slug derivation via `ProductSlugGenerator.toSlug` + dedup, `updateValueLabel` label-only), `adminApi.js` (`fetchAttributes`/`fetchAttributeValues` tolerant readers, `updateAttribute`, `createAttributeValue`/`updateAttributeValueLabel`), `ProductDetailScreen.jsx` (`AttributeRenameModal`, `AttributeValueManagerModal`).

### Variant cover image — derived from the first gallery image (no separate input)

The variant cover image (`variants[].image`) is **always the first image of the variant's colour gallery** (`variants[].gallery[0]`). It is **not** entered separately by admins.

- **Upsert request** (`POST` / `PATCH /api/v1/admin/products`): the request body **no longer accepts** `variants[].imageUrl` / `variants[].imageAlt`. Both fields were removed from `VariantRequest`. On save, the backend mirrors the colour gallery's first image into the variant's `image_url` / `image_alt` / `image_width` / `image_height` / `image_mime_type` columns (colour-scoped, so every same-colour size shares it); a colour with no gallery, or a variant with no Colour option, gets a `null` cover.
- **Response**: `variants[].image` still returns the cover `ImageAsset` (now equal to `gallery[0]`). The read path keeps colour-scoping the stored `image_*` columns, so legacy rows where the cover diverged from `gallery[0]` are normalised on read and re-synced on the next save.
- **Rationale**: a separately-stored cover could diverge from the gallery (different URL or stale row), which surfaced as **duplicate thumbnails** on the PDP. Deriving the cover from `gallery[0]` removes the divergence at the source. To change the cover, reorder the gallery so the desired image is first.

Status: `CONFIRMED_FROM_CODE`

Evidence: `VariantRequest.java` (no `imageUrl`/`imageAlt`), `AdminCatalogMutationService.applyVariants` / `colorCoverImages` (cover = first colour-gallery image), `JpaCatalogReadRepository.withColorScopedVariantMedia` (colour-scopes the stored `image_*` columns on read), `VariantGalleryRoundtripTest.variantImage_isSharedByColorAcrossSizes`.

### Product upsert — `stockState` is read-only

`POST /api/v1/admin/products` and `PATCH /api/v1/admin/products/{id}` do **not** accept `stockState` in the request body. The field is derived from `quantityOnHand` via `InventoryPolicyService` and can only be mutated through the Inventory module endpoints (`/api/v1/admin/inventory/...`).

- On create: backend forces `stockState = OUT_OF_STOCK` regardless of payload.
- On update: backend never reads `stockState` from the request.
- DTO `UpsertProductRequest` has no setter for the field; admin form does not render a picker.

Status: `CONFIRMED_BACKEND_ENFORCED`

Evidence: `UpsertProductRequest.java` (no `stockState` setter), `AdminCatalogMutationService.applyProductPatch` (`if (create) entity.setStockState(OUT_OF_STOCK)`), `InventoryPolicyService.java` (sole writer post-create).

### Product upsert — single category only

A product belongs to exactly one category, written via `categoryId`. The legacy `product_category_map` M:N side table was dropped in migration `V110__drop_product_category_map.sql` (2026-05-14). The `categories[]` array in product responses now always contains exactly the primary category, preserved for API compatibility.

Status: `CONFIRMED_BACKEND_ENFORCED`

### Product rich-text content fields — `promotionContent`, `installationGuide`

`POST /api/v1/admin/products` and `PATCH /api/v1/admin/products/{id}` accept `promotionContent` (added `V124`) and `installationGuide` (added `V133`): optional rich-HTML strings, max 50 000 characters each, mutated with the presence-flag pattern (sending no key leaves the field untouched on PATCH; sending `null`/blank clears it). They join the existing `description` and `contentBottom` rich-text fields.

Both are returned by the public product detail endpoint `GET /api/v1/products/{slug}` and the admin product read response. They are **not** included in product *list* responses (list mappers omit all long-form text). The web PDP renders each as its own numbered section band ("Ưu đãi & khuyến mãi", "Hướng dẫn lắp đặt"); a band is hidden when its field is empty.

Status: `CONFIRMED_FROM_CODE`

Evidence: `UpsertProductRequest.java` (`promotionContent`/`installationGuide` + presence flags), `AdminCatalogMutationService.applyProductPatch`, `Product.java` domain record, `JpaCatalogReadRepository` (detail mapper maps both columns; list mapper passes `null`), `V124__add_product_promotion_content.sql`, `V133__add_product_installation_guide_and_faq.sql`.

### Product description blocks — `descriptionBlocks` (V139)

`POST /api/v1/admin/products` and `PATCH /api/v1/admin/products/{id}` accept `descriptionBlocks`: an optional array of typed block objects. Each element must include a `type` discriminator (`heading`, `paragraph`, `list`, `image`, `video`, `callout`, `divider`) plus its type-specific required fields (validated via Bean Validation cascade).

**Mutation semantics:** Sending `descriptionBlocks` (including `[]`) triggers the block renderer, which converts the array to sanitized HTML and atomically overwrites **both** `description_blocks` (JSONB, raw blocks) and `description` (TEXT, rendered HTML). Omitting the key on PATCH leaves both columns untouched — backward-compatible with products authored via the legacy RichTextEditor.

`descriptionBlocks` is returned on `GET /api/v1/products/{slug}` and `GET /api/v1/admin/products/{id}` as `descriptionBlocks: BlockObject[] | null`. Products without blocks have `descriptionBlocks: null`; `description` (HTML) remains present and populated from whatever source last wrote it. Not included in product list responses (null).

Status: `CONFIRMED_FROM_CODE` — `UpsertProductRequest.java` (`descriptionBlocks` + presence flag), `DescriptionBlockRenderer`, `AdminCatalogMutationService.applyProductPatch`, `JpaCatalogReadRepository`, `V139__add_product_description_blocks.sql`.

### Product FAQ entries — `faqs`

`POST /api/v1/admin/products` and `PATCH /api/v1/admin/products/{id}` accept `faqs` (added `V133`): an optional array of `{ question, answer, sortOrder }` objects, max 50 entries (`@Size(max = 50)`). `question` ≤ 500 chars, `answer` ≤ 20 000 chars. Sending `faqs` replaces the whole list; rows with a blank question or answer are dropped. Mirrors the `specifications` array mutation pattern (full-replace, not presence-flag).

`faqs` is returned on the public product detail endpoint `GET /api/v1/products/{slug}` and the admin product read response as `faqs: [{ question, answer }]`. It is **not** included in product *list* responses. The web PDP renders it as the "Câu hỏi thường gặp" accordion section band and emits matching `FAQPage` JSON-LD.

Status: `CONFIRMED_FROM_CODE`

Evidence: `FaqRequest.java`, `UpsertProductRequest.java` (`faqs`), `AdminCatalogMutationService.applyFaqs`, `ProductFaq` domain record, `ProductFaqEntity`, `JpaCatalogReadRepository.toFaqs` (detail mapper; list mapper passes `[]`), `V133__add_product_installation_guide_and_faq.sql`.

### Product SEO template fields — pros/cons, warranty, origin, weight, size guide (V175)

`POST /api/v1/admin/products` và `PATCH /api/v1/admin/products/{id}` chấp nhận nhóm
field bổ sung cho template trang sản phẩm chuẩn SEO/AEO:

- **`positiveNotes` / `negativeNotes`** — mảng `{ content, contentEn?, sortOrder? }`,
  tối đa 20 mục mỗi mảng (`@Size(max = 20)`). `content` ≤ 2 000 ký tự. Full-replace
  như `faqs`; mục `content` blank bị drop. Lưu vào bảng con `product_highlights`
  (cột `kind` = `PRO`/`CON`). Đọc ra public/admin detail thành **mảng string**
  `positiveNotes` / `negativeNotes` (đã resolve locale).
- **`warrantyMonths`** — `Integer` (presence-flag), số tháng bảo hành.
- **`warrantyScope`** — `String` ≤ 2 000 ký tự (presence-flag), phạm vi bảo hành, 1 ngôn ngữ.
- **`originBrandCountry`** / **`originManufactureCountry`** — `String` ≤ 120 ký tự
  (presence-flag) — "thương hiệu [nước]" vs "sản xuất tại [nước]".
- **`weightGrams`** — `Integer` (presence-flag), trọng lượng tính bằng gram. Lưu vào
  cột có sẵn `weight_kg` (= `weightGrams / 1000`); đọc ra `weightGrams` = `weight_kg × 1000`.
- **`sizeGuide`** — `String` rich-HTML ≤ 20 000 ký tự (presence-flag), bảng size dạng
  `<table>`; web sanitize trước khi render.

Tất cả trả về trên `GET /api/v1/products/{slug}` và admin product read; **không** có
trong product *list* responses (detail-only). Web PDP render: khối Ưu/Nhược điểm
(+ schema `positiveNotes`/`negativeNotes`), trust block bảo hành, dòng xuất xứ trong
bảng thông số, `weight` trong schema.org `Product`, và khối bảng size.

Evidence: `HighlightRequest.java`, `UpsertProductRequest.java`, `ProductHighlightEntity`,
`AdminCatalogMutationService.applyHighlights` + scalar patch, `Product.java` domain
record, `JpaCatalogReadRepository`, `V175__add_product_seo_template_fields.sql`.

### Product video description — `videos[].description` (V175)

`videos[]` trong upsert request nhận thêm `description` (`@Size(max = 5000)`), 1 ngôn
ngữ. Trả về trên product detail là `videos[].description`. Web render caption dưới
video embed và đưa vào `description` của schema.org `VideoObject`.

Evidence: `VideoRequest.java` (`description`), `ProductVideoEntity.description`,
`VideoAsset.description`, `AdminCatalogMutationService.applyVideos`,
`JpaCatalogReadRepository.toVideos`, `V175__add_product_seo_template_fields.sql`.

### Product related products — `relatedProducts` / `relatedProductIds`

`POST /api/v1/admin/products` and `PATCH /api/v1/admin/products/{id}` accept `relatedProductIds` (added `V135`): an optional ordered array of product ID strings, max 24 entries (`@Size(max = 24)`). Sending `relatedProductIds` replaces the whole list; **an empty array clears it**, `null`/omitted leaves it untouched. The mutation service de-duplicates, preserves order, and silently drops unknown IDs plus the product's own ID (a product cannot relate to itself).

`relatedProducts` is returned on the public product detail endpoint `GET /api/v1/products/{slug}` and the admin product read response as an ordered array of **list-view product objects** (`id`, `slug`, `name`, `image`, `price`, `rating`, … — no nested `gallery`/`specifications`/`relatedProducts`). It is **not** included in product *list* responses. The public read includes **only `PUBLISHED`** related products; admin reads return every linked product so the editor renders draft chips too. The web PDP renders them in the "Sản phẩm liên quan" carousel; when the array is empty the section is hidden — there is **no category fallback**.

Status: `CONFIRMED_FROM_CODE`

Evidence: `UpsertProductRequest.java` (`relatedProductIds`), `AdminCatalogMutationService.resolveRelatedProducts`, `Product.java` domain record (`relatedProducts`), `ProductEntity.relatedProducts`, `JpaCatalogReadRepository.toRelatedProducts` (detail mapper; list mapper passes `[]`), `V135__add_product_related_product_map.sql`.

### Product bilingual content — `lang` param & `translations` (V136)

Sản phẩm có 2 bản nội dung: tiếng Việt (canonical) và tiếng Anh (tùy chọn).

**Đọc public — query param `lang`:** `GET /api/v1/products` và
`GET /api/v1/products/{slug}` nhận `lang` = `vi` (mặc định) hoặc `en`. Khi
`lang=en`, mỗi trường text trả về bản tiếng Anh, **lùi về tiếng Việt theo từng
trường** khi cột `_en` rỗng (`COALESCE`). Storefront `bigbike-web` lưu lựa chọn
trong cookie `NEXT_LOCALE` (1 năm); server pages đọc cookie qua `getLocale()`
của next-intl và truyền vào `lang` query. Các trường được dịch: `name`,
`shortDescription`, `description`, `contentBottom`, `promotionContent`,
`installationGuide`, `seo.title`, `seo.description`, và `specifications[]`
(`name`/`value`/`group`), `faqs[]` (`question`/`answer`). Response public **giữ
nguyên shape** — không thêm khối `translations`.

**Đọc admin — cả 2 bản:** `GET /api/v1/admin/products/{id}` trả các trường chính
ở bản tiếng Việt **và** thêm:
- `translations.en` — object `{ name, shortDescription, description, contentBottom,
  promotionContent, installationGuide, seoTitle, seoDescription }` chứa bản tiếng
  Anh thô (giá trị thật của các cột `_en`, không fallback). `null` nếu chưa có bản
  tiếng Anh nào.
- `specifications[].nameEn / valueEn / groupEn` và `faqs[].questionEn / answerEn`
  — bản tiếng Anh thô của từng dòng con.

**Đọc admin — danh sách theo `lang`:** các endpoint list admin
`GET /api/v1/admin/products`, `/admin/categories`, `/admin/categories/tree`,
`/admin/brands` và `/admin/content` nhận query param `lang` = `vi` (mặc định)
hoặc `en`. Khi
`lang=en`, **trường hiển thị** trả bản tiếng Anh (`name` cho product/category/brand,
`title` cho content), **lùi về tiếng Việt theo từng trường** khi cột `_en` rỗng
(`COALESCE`, theo `PRODUCT_RULE_002` / `CATEGORY_RULE_002` / `BRAND_RULE_002`).
List response **giữ nguyên shape** — không thêm khối `translations`; chỉ trường
hiển thị được localize (chi tiết vẫn trả cả 2 bản như trên). `bigbike-admin` truyền
`i18n.language` (chọn ở `LanguageSwitcher` header) vào `lang`. POS
(`/admin/pos/...`) giữ tiếng Việt. **Lọc (`q`) và sắp xếp vẫn theo cột tiếng Việt**
— tìm theo từ khóa chỉ-tiếng-Anh có thể không khớp.

**Ghi — `POST/PATCH /api/v1/admin/products`:** nhận thêm:
- `translations.en` — object 8 trường text như trên. Toàn bộ tùy chọn (không bắt
  buộc); chỉ giới hạn độ dài như bản tiếng Việt. Theo presence-flag pattern: bỏ
  khóa `translations` thì giữ nguyên trên PATCH.
- `specifications[]` nhận thêm `nameEn`, `valueEn`, `groupNameEn`; `faqs[]` nhận
  thêm `questionEn`, `answerEn`. Đi cùng dòng tiếng Việt (full-replace như cũ).

Status: `CONFIRMED_FROM_CODE` — `CatalogController` (`lang` param public),
`AdminCatalogController` / `AdminContentController` (`lang` param admin list),
`AdminCatalogReadService` / `AdminContentReadService`,
`UpsertProductRequest.translations` / `ProductTranslationRequest`,
`AdminCatalogMutationService.applyProductPatch`, `JpaCatalogReadRepository` /
`JpaContentReadRepository` (resolve locale), migration `V136`.

### Menu bilingual label — `lang` param (V160)

Mục menu có nhãn 2 ngôn ngữ (`label` VI canonical + `label_en` EN tùy chọn).

**Đọc public:** `GET /api/v1/menus/{location}` nhận query `lang` = `vi` (mặc định)
hoặc `en`. Khi `lang=en`, `label` trả bản tiếng Anh, **lùi về VI** khi `label_en`
rỗng. Response giữ nguyên shape (không thêm khối translations). Storefront
`bigbike-web` truyền `getLocale()` vào `lang`.

**Đọc admin:** `GET /api/v1/admin/menus/...` trả thêm `labelEn` (giá trị thô cột
`label_en`, không fallback) để editor sửa song ngữ.

**Ghi admin:** `POST/PATCH /api/v1/admin/menus/{menuId}/items` nhận thêm `labelEn`
(tùy chọn, ≤255). PATCH gửi `labelEn` rỗng/blank → xóa bản EN.

Status: `CONFIRMED_FROM_CODE` — `PublicMenuController` (`lang` param),
`AdminMenuService` (resolve locale + set/return `labelEn`),
`CreateMenuItemRequest` / `UpdateMenuItemRequest` / `AdminMenuItemResponse`,
migration `V160`.

### Home video bilingual title — `lang` param (V161)

Video trang chủ có tiêu đề 2 ngôn ngữ (`title` VI + `title_en` EN tùy chọn).

**Đọc public:** `GET /api/v1/home-videos` nhận query `lang` = `vi` (mặc định) hoặc
`en`. Khi `lang=en`, `title` trả bản tiếng Anh, **lùi về VI** khi `title_en` rỗng.
Storefront truyền `getLocale()` vào `lang`.

**Đọc admin:** `GET /api/v1/admin/home-videos` trả thêm `titleEn` thô để editor sửa
song ngữ. **Ghi:** `POST/PATCH /api/v1/admin/home-videos` nhận thêm `titleEn` (tùy
chọn, ≤255); PATCH gửi `titleEn` blank → xóa bản EN.

Status: `CONFIRMED_FROM_CODE` — `PublicHomeVideoController` (`lang` param),
`PublicHomeVideoResponse.from(video, lang)`, `AdminHomeVideoService`,
`UpsertHomeVideoRequest` / `PatchHomeVideoRequest` (`titleEn`), migration `V161`.

## POS Contract

| Endpoint | Permission | Current behavior | Status | Evidence |
|---|---|---|---|---|
| `GET /api/v1/admin/pos/products/search` | `pos.read` | Product search for POS UI | `CONFIRMED_FROM_CODE` | `AdminPosController.java` |
| `POST /api/v1/admin/pos/orders` | `pos.write`; `pos.price_override` when overriding unit price | Immediate paid/completed order, payment record, stock movement, audit log, WS event. **`customerPhone` is required** (NotBlank, `^\+?[0-9]{8,15}$`); the order is linked to a customer resolved/auto-created by normalized phone (see POS_CUSTOMER rules). | `CONFIRMED_FROM_CODE` (sale) + `INTENDED` (phone-keyed customer, this PR) | `AdminPosController.java`, `PosOrderService.java`, `Phase1MPosApiTest.java` |

Response fields verified in `PosOrderResponse` usage:

- `orderId`
- `orderNumber`
- `status`
- `paymentStatus`
- `paymentMethod`
- `totalAmount`
- `tenderedAmount` — tiền khách đưa (Long, VND)
- `changeAmount` — tiền thừa trả lại (Long, VND)
- `paidAmount`
- `refundAmount`
- `items` — danh sách line item
- `discountAmount` — tổng discount từ coupon (BigDecimal, 0 khi không có coupon)
- `couponCode` — mã coupon đã áp dụng (String, null khi không có coupon)
- `customerName` — tên khách nhập lúc bán POS (String, null nếu không nhập) — dùng in lên hoá đơn
- `customerPhone` — SĐT khách nhập lúc bán POS (String) — dùng in lên hoá đơn; **bắt buộc** kể từ POS_CUSTOMER_001
- `customerId` — UUID hồ sơ khách đã được gắn/tạo cho đơn (String) — dùng để điều hướng tới hồ sơ khách sau khi bán `INTENDED` (this PR)

**Ghi chú:**
- Credit limit được check SAU khi tính coupon discount (`totalAfterDiscount`), không check trên `subtotal` trước coupon.
- Minimum-order coupon vẫn validate trên `subtotal` (đúng intent của coupon).
- `customerId` sai UUID format → HTTP 400 với field error `customerId: INVALID_FORMAT`.
- `customerPhone` rỗng → HTTP 400 với field error `customerPhone` (NotBlank). Phone được chuẩn hóa (`+84`/`84` → `0`, bỏ khoảng trắng) trước khi tra/tạo khách.
- Khách được tìm theo SĐT đã chuẩn hóa; trùng → gắn vào hồ sơ cũ (không sửa hồ sơ); chưa có → tạo hồ sơ mới (`is_synthetic=true`). Xem `POS_CUSTOMER_002/003`.

Status: `CONFIRMED_FROM_CODE`

## Admin Settings Contract

| Endpoint | Permission | Current behavior | Status | Evidence |
|---|---|---|---|---|
| `GET /api/v1/admin/settings` | `settings.read` | Paginated list with optional filters: `q` (key/description substring), `group`, `isPublic`. Sensitive keys return `settingValue="********"` with `sensitive=true, masked=true`. | `CONFIRMED_FROM_CODE` | `AdminSettingsController.java`, `AdminSettingsService.java` |
| `GET /api/v1/admin/settings/{key}` | `settings.read` | Single setting by key. Sensitive values masked. | `CONFIRMED_FROM_CODE` | `AdminSettingsController.java` |
| `PATCH /api/v1/admin/settings/{key}` | `settings.write` | Update single setting (value, group, isPublic, description). Validates type/range per `SettingDefinitionRegistry`. Sensitive keys cannot be made public. **Keys flagged `superAdminOnly` (group `product_assign`) reject the write with 403 unless the caller holds wildcard `*` (`SUPER_ADMIN`)** — `ADMIN` is blocked despite having `settings.write`. | `CONFIRMED_FROM_CODE` | `AdminSettingsController.java` |
| `PATCH /api/v1/admin/settings` | `settings.write` | **Batch update** — atomically update multiple settings in one transaction. Body: `{"updates":[{"key":"…","value":"…"}]}`. All validations run before any mutation; if any item is invalid the whole request fails with 400 and no settings are changed. Same `superAdminOnly` 403 gate as the single-update path. | `CONFIRMED_FROM_CODE` | `AdminSettingsController.java`, `AdminSettingsService.batchUpdateSettings` |
| `GET /api/v1/admin/product-assignment` | `products.read` | Returns the editable "Phân công" guide text (7 fields: title + 3 role labels + 3 task lists) for the product create/edit banner. Read uses `products.read` (not `settings.read`) so `SHOP_MANAGER`/`EDITOR` who edit products can render the banner. Write is via the `superAdminOnly` settings keys above. | `CONFIRMED_FROM_CODE` | `AdminProductAssignmentController.java` |
| `GET /api/v1/settings/public` | public | List settings marked `isPublic=true` that are on the registry public allowlist. Sensitive keys are never exposed regardless of DB flag. | `CONFIRMED_FROM_CODE` | `PublicSettingsController.java` |

**Batch update response shape:** `ApiDataResponse<List<AdminSiteSettingResponse>>` — items in same order as request `updates` array.

**Sensitive key masking:** Any key whose name contains `secret`, `password`, `token`, `api_key`, `privatekey`, etc. always returns `settingValue="********"` in admin responses and in audit log `before_data`/`after_data`.

**Public storefront setting keys returned by `GET /api/v1/settings/public`:**

- `general`:
  - `site_name` — public site/display name used by header/footer/SEO helpers.
  - `footer_tagline` — footer hero/tagline heading text.
  - `footer_description` — footer descriptive paragraph.
  - `bct_url` — public Bộ Công Thương registration URL for the footer badge.
- `contact`:
  - `contact_email`, `contact_address`
  - `hotline`, `hotline_2`
  - `facebook_url`, `messenger_url`, `zalo_url`, `youtube_url`, `tiktok_url`, `instagram_url`
  - `messenger_display`, `zalo_display` — display text for the Messenger/Zalo lines in the floating-chat popup (falls back to the URL slug when empty).
  - `google_maps_url` — contact-page embedded map URL.
- `public_home`:
  - `promo_title`, `promo_off`, `promo_href`, `promo_image_url` — homepage promo banner block.
  - `home_exp_subtitle`, `home_exp_title`, `home_exp_desc` — homepage experience/news teaser section copy.
  - `about_title`, `about_subtitle`, `about_content_html` — homepage about block copy.
- `seo`:
  - `seo_home_title`, `seo_home_description`, `seo_home_h1`, `og_image_url`
  - `home_content_bottom_html` — homepage bottom SEO HTML block.

Status: `CONFIRMED_FROM_CODE` — `SettingDefinitionRegistry.java`, `PublicSettingsController.java`,
`V18__add_public_homepage_contract_fields.sql`, `V19__backfill_homepage_data.sql`,
`V22__seed_footer_menu_settings.sql`, `V24__seed_footer_contact_settings.sql`,
`V32__add_article_product_image_and_home_exp_settings.sql`.

**Page hero settings (group `public_hero`, all `publicAllowed`):**

For each listing page that lacks a `PageEntity` backing (`/san-pham`, `/brands`, `/tin-tuc`), the hero block is composed from 5 keys:

| Key prefix | Type | Purpose |
|---|---|---|
| `hero_<page>_image_url` | `IMAGE_URL` | Background image URL |
| `hero_<page>_image_alt` | `STRING` | Image alt text |
| `hero_<page>_title` | `STRING` | Heading text |
| `hero_<page>_description` | `STRING` | Short tagline below heading |
| `hero_<page>_kicker` | `STRING` | Small uppercase chip above heading |

Concrete keys: `hero_products_*`, `hero_brands_*`, `hero_news_*` (15 total). All are returned by `GET /api/v1/settings/public`. CMS pages (about/contact/policy/guides) carry the same hero fields directly on the `Page` entity instead — see [DATA_CONTRACT.md](DATA_CONTRACT.md) "Page hero fields".

**`UpsertPageRequest` admin DTO** (admin can edit hero on any CMS page):
- `heroImage`: `{ url, alt }` — same nested shape as `coverImage`. Send `{ url: "" }` to clear.
- `heroTitle`, `heroDescription`, `heroKicker`: nullable strings.

**Public `Page` response** adds `heroImageUrl`, `heroImageAlt`, `heroTitle`, `heroDescription`, `heroKicker` (all nullable strings) to the existing shape.

## Coupon Gift Contract

| Method | Path | Permission | Current behavior | Status | Evidence |
|---|---|---|---|---|---|
| `DELETE` | `/api/v1/admin/coupons/{couponId}` | `coupons.write` | Hard-deletes coupon by ID. Saves audit log entry `COUPON_DELETED`. Returns 204 No Content. | `CONFIRMED_FROM_CODE` | `AdminCouponController.java`, `AdminCouponService.java` |
| `POST` | `/api/v1/admin/customers/{customerId}/coupon-gift` | `coupons.write` | Creates a unique `GIFT`-prefixed coupon locked to the customer, saves audit log, sends email async. Returns `AdminCouponDetailResponse`. Customer must have email. | `CONFIRMED_FROM_CODE` | `AdminCustomerController.java`, `AdminCouponGiftService.java` |
| `POST` | `/api/v1/admin/coupon-gifts/bulk` | `coupons.write` | Sends email with an existing coupon's code to every active customer with verified email. Accepts `{ couponId }`. Coupon must be ACTIVE. No new coupon created. Returns `{ sent, skipped }`. | `CONFIRMED_FROM_CODE` | `AdminCouponGiftController.java`, `AdminCouponGiftService.java` |
| `POST` | `/api/v1/admin/coupon-gifts/targeted` | `coupons.write` | Sends email with an existing coupon's code to explicitly selected customers. Accepts `{ couponId, customerIds }`. Coupon must be ACTIVE. No new coupon created. Returns `{ sent, skipped }`. | `CONFIRMED_FROM_CODE` | `AdminCouponGiftController.java`, `AdminCouponGiftService.java` |

**Bulk notify request body:**
```json
{ "couponId": "uuid" }
```

**Targeted notify request body:**
```json
{ "couponId": "uuid", "customerIds": ["uuid1", "uuid2"] }
```

**Gift response shape:** `ApiDataResponse<BulkCouponGiftResult>` — `{ "sent": 3, "skipped": 0 }` where `skipped` = customers without verified email, inactive status, or not found.

## Customer Admin — Summary

| Method | Path | Permission | Current behavior | Status | Evidence |
|---|---|---|---|---|---|
| `GET` | `/api/v1/admin/customers/summary` | `customers.read` | KPI counts for the admin Customers screen. Returns `AdminCustomerSummaryResponse`: `total` (all customers), `vip` (customers whose lifetime order total ≥ 10,000,000 VND — mirrors `AdminCustomerService.deriveSegment` VIP rule), `newLast30Days` (registered within the last 30 days), `active` (status = `ACTIVE`). | `CONFIRMED_FROM_CODE` | `AdminCustomerController.java`, `AdminCustomerService.java` |

## Customer Admin — Coupons

| Method | Path | Permission | Current behavior | Status | Evidence |
|---|---|---|---|---|---|
| `GET` | `/api/v1/admin/customers/{customerId}/coupons` | `coupons.read` | Paginated list of coupons owned by a specific customer. Returns `ApiListResponse<AdminCouponListItemResponse>`. Query params: `page` (default 1), `size` (1–100, default 20). | `PLANNED` | — |

**Response item shape** (`AdminCouponListItemResponse`): `id`, `code`, `name`, `discountType` (`FIXED`\|`PERCENT`), `amount`, `minimumAmount`, `status` (`ACTIVE`\|`INACTIVE`\|`EXPIRED`), `channel` (`ALL`\|`ONLINE`\|`POS`), `usageCount`, `usageLimit`, `expiresAt`, `createdAt`.

## Audit Log Contract

| Endpoint | Permission | Current behavior | Status | Evidence |
|---|---|---|---|---|
| `GET /api/v1/admin/audit-logs` | `audit-logs.read` | Paginated list (page/size), filterable by actorType, actorId, resourceType, resourceId, action, q (matches action text), from/to (LocalDate). Enriches actor display name and resource code. | `CONFIRMED_FROM_CODE` | `AdminAuditLogController.java`, `AdminAuditLogService.java` |

**Resource types written by backend** (as of P0 fix):
- `ORDER` — order lifecycle events (AdminOrderService, PosOrderService, RefundService)
- `PRODUCT` — create/update/publish/soft-delete/restore (AdminCatalogMutationService)
- `CATEGORY` — create/update/soft-delete (AdminCatalogMutationService)
- `BRAND` — create/update/soft-delete (AdminCatalogMutationService)
- `INVENTORY` — stock adjustments (AdminInventoryService)
- `CONTENT` — article/page create/update/delete (AdminContentMutationService)
- `COUPON` — AdminCouponService
- `CUSTOMER` — AdminCustomerService
- `MEDIA` — AdminMediaService
- `MENU` / `MENU_ITEM` — AdminMenuService
- `REDIRECT` — AdminRedirectService
- `SITE_SETTING` — AdminSettingsService
- `REVIEW` — AdminReviewService
- `RECEIVABLE` — ReceivableService
- `ADMIN_USER` — AdminAdminUsersService
- `ADMIN_ROLE` — AdminRoleService (fixed in V76; previously erroneously `ADMIN_ROLE:<roleId>`)

**Note:** `resource_id` column is `uuid` type. For entities with String IDs (products, categories, brands, content, roles), `resource_id = null` and the entity identifier is embedded in `afterData`/`beforeData` JSON.

## Admin Returns Inspection Contract (V104)

| Method | Path | Permission | Purpose | Status | Evidence |
|---|---|---|---|---|---|
| `PATCH` | `/api/v1/admin/returns/{returnId}/items/{itemId}/inspect` | `orders.write` | Records a per-item QC decision while the parent return is `INSPECTING`. Body: `{ "result": "PASS"|"FAIL", "note": "..." }`. Idempotent: calling again overwrites the previous decision. | `CONFIRMED_FROM_CODE` | `AdminReturnController.java`, `AdminReturnService.inspectItem`, `V104__add_return_item_inspection.sql` |

`AdminReturnDetailResponse.ReturnItemResponse` now includes `inspectionResult`, `inspectionNote`, `inspectedAt`.

`AdminReturnDetailResponse` now also includes order-level refund context fields (used by admin UI to gate the REFUNDED transition and prefill the refund amount):

| Field | Type | Source | Purpose |
|---|---|---|---|
| `orderPaidAmount` | `BigDecimal` | `orders.paid_amount` | Total amount currently paid on the order |
| `orderRefundedAmount` | `BigDecimal` | `orders.refund_amount` (NULL → 0) | Cumulative refunded so far |
| `orderRefundableAmount` | `BigDecimal` | `paid − refunded` | Remaining refundable amount — must equal the `refundAmount` sent to `PATCH /returns/{id}/status` when transitioning to REFUNDED |
| `isFullReturnCoverage` | `boolean` | derived from `order_line_items.quantity` vs `sum(non-rejected return_items.quantity)` | `true` only when every line item is fully covered by non-rejected returns. UI hides the REFUNDED option when `false` |

State machine guards (also see [STATE_MACHINES.md §10](../business/STATE_MACHINES.md)):
- `INSPECTING → COMPLETED/REFUNDED` is rejected with `items.INSPECTION_INCOMPLETE` if any `ReturnItem` is missing an inspection result.
- `RECEIVED|INSPECTING → REFUNDED` is rejected with `ConflictException` code `RETURN_NOT_FULL_COVERAGE` when the RMA (together with prior non-rejected RMAs) does not cover every order line item × full quantity. Partial refunds are unsupported (V114); admins must close via `COMPLETED` and use `POST /admin/orders/{id}/refund` for order-level refund.
- `RECEIVED|INSPECTING → REFUNDED` requires `refundAmount` to **equal** `orderRefundableAmount` exactly (V114 full-refund-only).
- `restoreStockForReturn` skips items with `inspection_result = 'FAIL'` so customer-damaged goods don't re-enter inventory. On the REFUNDED path it is **not invoked at all** — `RefundService.applyRefund` handles stock & serial restoration at order level to avoid double-restore.

## Admin Warranty Contract

All three endpoints are gated by `warranty.read` (read) or `warranty.write` (void). Responses are **not** wrapped in `ApiDataResponse` — these endpoints return the DTO directly, consistent with each other but inconsistent with the broader admin API envelope convention.

`WarrantyRecordResponse` shape: `{ id: UUID, serialId: UUID, orderLineItemId: UUID|null, customerId: UUID|null, customerEmail: string|null, customerPhone: string|null, startDate: LocalDate, endDate: LocalDate, status: "ACTIVE"|"VOIDED", createdAt: Instant }`

| Method | Path | Permission | Purpose | Status | Evidence |
|---|---|---|---|---|---|
| `GET` | `/api/v1/admin/warranties?page&size&status&customerId&q` | `warranty.read` | Paginated list filtered by optional `status` and `customerId`. Optional `q` is a case-insensitive free-text filter matching `customerEmail` or `customerPhone` (blank treated as no filter). Returns `PageResult<WarrantyRecordResponse>`. | `CONFIRMED_FROM_CODE` | `AdminWarrantyController.java`, `AdminWarrantyService.search` |
| `GET` | `/api/v1/admin/warranties/by-serial/{serialId}` | `warranty.read` | Look up a warranty record by the internal serial UUID (not the human-readable serial number string). Returns `WarrantyRecordResponse` or `404` if no warranty exists for that serial. Wired into the `SerialListScreen` serial-detail "Bảo hành" panel via `adminApi.getWarrantyBySerial`; HTTP-tested. | `CONFIRMED_FROM_CODE` | `AdminWarrantyController.java:31`, `AdminWarrantyService.getBySerial`, `WarrantyApiTest.java`, audit finding F-08 |
| `PATCH` | `/api/v1/admin/warranties/{warrantyId}/void` | `warranty.write` | Void an active warranty. Idempotent rejection: returns `409` if already `VOIDED`. Sets `status = "VOIDED"`, stamps `updatedAt`. | `CONFIRMED_FROM_CODE` | `AdminWarrantyController.java`, `AdminWarrantyService.voidWarranty`, `WarrantyApiTest.java` |

**Public warranty lookup (no auth):**

| Method | Path | Permission | Purpose | Status | Evidence |
|---|---|---|---|---|---|
| `GET` | `/api/v1/warranties/lookup?serial={serialNumber}` | None (public) | Customer-facing lookup by human-readable serial number string. Returns `ApiDataResponse<PublicWarrantyResponse>` with `{ serialNumber, productName, status, startDate, endDate, daysLeft }`. Consumed by web `/bao-hanh` and the mobile `WarrantyLookupScreen` (route `/bao-hanh`). | `CONFIRMED_FROM_CODE` | `PublicWarrantyController.java`, `WarrantyApiTest.java` |

## Admin Notification Center Contract (V102)

Persistent counterpart of the WebSocket order feed — admins offline when an event fires still see it here. All three endpoints are gated by `orders.read` (no dedicated `notifications.*` permission).

| Method | Path | Permission | Purpose | Status | Evidence |
|---|---|---|---|---|---|
| `GET` | `/api/v1/admin/notifications` | `orders.read` | List unread notifications with `unreadCount`. Each item: `id`, `type`, `orderId`, `orderNumber`, `payload`, `isRead`, `createdAt`. | `CONFIRMED_FROM_CODE` | `AdminNotificationController.java`, `AdminNotificationService.listUnread` |
| `POST` | `/api/v1/admin/notifications/mark-read` | `orders.read` | Mark the given notification IDs as read. Body `{ "ids": [uuid] }`. Returns `{ updated }`. | `CONFIRMED_FROM_CODE` | `AdminNotificationController.java`, `AdminNotificationService.markRead` |
| `POST` | `/api/v1/admin/notifications/mark-all-read` | `orders.read` | Mark every unread notification as read. Returns `{ updated }`. | `CONFIRMED_FROM_CODE` | `AdminNotificationController.java`, `AdminNotificationService.markAllRead` |

## WebSocket Contract

| Item | Current contract | Status | Evidence |
|---|---|---|---|
| Connect endpoint | `/ws` | `CONFIRMED_FROM_CODE` | `WebSocketConfig.java` |
| CONNECT auth | native header `Authorization: Bearer <admin-jwt>` | `CONFIRMED_FROM_CODE` | `WebSocketConfig.java`, `adminWebSocket.js` |
| Allowed roles | `ADMIN`, `SUPER_ADMIN` | `CONFIRMED_FROM_CODE` | `WebSocketConfig.java` |
| Confirmed topic | `/topic/admin/orders` | `CONFIRMED_FROM_CODE` | `AdminOrderWsService.java`, `adminWebSocket.js` |
| Payload | `OrderWsEvent` with `type`, `orderId`, `orderNumber`, `customerName`, `total`, `status`, `paymentMethod`, `timestamp` | `CONFIRMED_FROM_CODE` | `OrderWsEvent.java` |

## Response Shape Caveats

The repo does not use one wrapper consistently across every controller:

- Most public/customer CRUD endpoints use `ApiDataResponse` or `ApiListResponse`. Customer-returns endpoints (`/returns`, `/returns/{id}`, `/{orderId}/returns`) are now also wrapped — the prior raw-payload inconsistency was fixed in `CustomerOrderController`.
- Some admin modules use raw `PageResult`, DTOs, CSV, or other non-envelope responses.

Status: `CONFIRMED_FROM_CODE`

## Mobile Coverage Notes

| Topic | Current status | Evidence |
|---|---|---|
| Search, address, customer address, customer returns are wrapped in mobile endpoint constants. | `CONFIRMED_FROM_CODE` | `api_endpoints.dart` |
| Verify-email and home-videos are wrapped in `api_endpoints.dart` (constants `verifyEmail` line 52, `homeVideos` line 26). Home-videos widget integration is still pending in the mobile app (tracked as `CMS-004`). | `CONFIRMED_FROM_CODE` | `api_endpoints.dart` lines 26, 52 |

## Proposed Accounts Receivable Endpoints

> Status: `PROPOSED_FOR_AR_MODULE` — not yet implemented. Requires business confirmation (`AR_RULE_001`–`AR_RULE_011` in `BUSINESS_RULES.md`) and completion of Phase 1 prerequisite fixes before these endpoints are built.

### Admin receivables endpoints

| Method | Path | Permission | Proposed behavior |
|---|---|---|---|
| `GET` | `/api/v1/admin/receivables` | `receivables.read` | Paginated list of credit orders with `outstanding > 0`, filterable by `customerId`, `dueStatus` (CURRENT / OVERDUE / ALL), date range |
| `GET` | `/api/v1/admin/receivables/summary` | `receivables.read` | Total outstanding amount, overdue count, aging buckets (0–30, 31–60, 61–90, 90+ days) |
| `GET` | `/api/v1/admin/receivables/customers/{customerId}` | `receivables.read` | Per-customer credit orders and payment history |
| `POST` | `/api/v1/admin/orders/{id}/payments` | `receivables.record_payment` | Record a payment against a receivable (credit) order; updates `paidAmount` on the `accounts_receivable` record; transitions AR `paymentStatus` toward `PAID`. `PARTIALLY_PAID` is a valid AR-level status (not order-level — order `payment_status` uses `UNPAID/PAID/REFUNDED/CANCELLED` per V114). |
| `PATCH` | `/api/v1/admin/orders/{id}/credit-terms` | `receivables.set_credit_terms` | Set or update `due_at` and `credit_terms` on an existing order |
| `POST` | `/api/v1/admin/orders/{id}/write-off` | `receivables.write_off` | Write off uncollectable receivable — sets `paymentStatus` to `CANCELLED` with an audit note |

### POS endpoint extension (additive, same path)

`POST /api/v1/admin/pos/orders` — if request body includes `paymentMethod: "CREDIT"` and the caller has `pos.credit_sale` permission:
- Creates order with `status = COMPLETED` and `paymentStatus = UNPAID`
- Requires `dueAt` in request body (ISO-8601 timestamp)
- Does NOT create a `PaymentEntity` row (payment is deferred)
- This is an additive extension to the existing POS endpoint; existing `CASH` / `CARD_TERMINAL` behavior is unchanged

### Customer-facing extension (additive, existing endpoint)

`GET /api/v1/customer/orders/{orderId}` — extend `OrderDetailResponse` with two additional read-only fields:
- `outstanding`: `BigDecimal` — `totalAmount - paidAmount` (zero for fully paid orders)
- `dueAt`: `Instant` nullable — payment due date for credit orders (null for non-credit)

### Account page fields — address email, order product names (V127)

Additive fields backing the rebuilt account pages:

- `CustomerAddressResponse` (`/api/v1/customer/addresses`) — adds `email: string` nullable.
  `SaveCustomerAddressRequest` accepts optional `email` (`@Email`, max 255 chars).
- `OrderListItemResponse` (`GET /api/v1/customer/orders`) — adds `productNames: string[]`,
  the line-item product names of the order, used for the order-history list summary row.
- `OrderLineItemResponse` (inside `OrderDetailResponse`, `GET /api/v1/customer/orders/{orderId}`)
  — adds `productThumbnailUrl: string` nullable, the current catalog image of the product,
  used to show a product thumbnail in the order-detail view. Resolved read-time (not
  snapshotted); `null` when the product no longer exists. See `DATA_CONTRACT.md`.
