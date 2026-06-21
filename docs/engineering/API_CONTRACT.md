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
| `GET` | `/api/v1/auth/admin/invite?token=…` | **Public.** Validate an admin invite token; returns the invitee email + expiry so the set-password page can render. Invalid/expired/used → `400` | `ApiDataResponse<InviteInfoResponse>` | `CONFIRMED_FROM_CODE` | `AuthController.java`, `AdminInviteService.validateToken` |
| `POST` | `/api/v1/auth/admin/accept-invite` | **Public.** Body `{token, password}`. Sets the invited admin's password and flips status `INVITED → ACTIVE`, consuming the token. Password ≥ 8. Rate-limited | `ApiDataResponse<Void>` | `CONFIRMED_FROM_CODE` | `AuthController.java`, `AdminInviteService.acceptInvite` |

**Admin user creation is invite-based.** `POST /api/v1/admin/admin-users` (`admin-users.write`) now takes `{email, displayName, role}` only — **no `password`**. It creates the user `status = INVITED` (no password), generates an invite token and sends an email with a set-password link (`{ADMIN_BASE}/accept-invite?token=…`). The response includes `inviteEmailSent` (boolean) and, when SMTP is not configured, the `inviteUrl` so a Super Admin can deliver it manually. Resend: `POST /api/v1/admin/admin-users/{id}/resend-invite` (`admin-users.write`). Status: `CONFIRMED_FROM_CODE` — `AdminAdminUsersController.java`, `AdminInviteService.java`.

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
| `PATCH` | `/api/v1/customer/orders/{orderId}/cancel` | Customer cancels own order. Allowed only when `paymentStatus = UNPAID` **and** order is `PENDING` / `ON_HOLD` / (`PROCESSING` with fulfillment not yet `SHIPPED`/`DELIVERED`) — see `CustomerOrderCancelService.isCustomerCancellable`. Sets `CANCELLED` (+ fulfillment `CANCELLED` for DELIVERY), releases reserved serials and restores stock, revalidates product pages. Once `PAID`, returns `409` — customer must request a refund via admin. | `ApiDataResponse<OrderDetailResponse>` | `CONFIRMED_FROM_CODE` | `CustomerOrderController.java`, `CustomerOrderCancelService.java` |
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
- `reviews` — `[{ id, authorName, rating, title, comment, photos, createdAt }]`, filtered + sorted per params. `title` is an optional short heading (string|null, ≤160). `photos` is an array of MinIO media URLs (`/media/reviews/...`, possibly empty) — customer-uploaded photos for that review. Both surface only for `APPROVED` reviews (moderated together with the review).
- `pagination` — `{ page, pageSize, totalItems, totalPages, hasNext, hasPrevious }`. `totalItems`/`totalPages`/`hasNext` follow the **filtered** list (so "load more" pages correctly within one star bucket); when `rating` is absent these equal the global approved count.

Out-of-range `page`/`size`/`rating` → `400 VALIDATION_ERROR`. Unknown `productId` → `404`.

### `POST /api/v1/products/{productId}/reviews`

Submits a review (`status = PENDING`, awaits admin moderation). Honeypot `website` field → accept-and-drop silently. Duplicate guard: same `productId` + normalized author + normalized body within 24h → `409`. See `SubmitReviewRequest`.

Body fields: `authorName` (required, ≤80), `rating` (required, 1..5), `comment` (optional, ≤1000), `website` (honeypot), plus `title` (optional, ≤160) and `photos` (optional, `string[]`, ≤10). Each `photos[]` entry **must** be an internal MinIO media URL (`/media/...`) — external/hotlink URLs are rejected `400 VALIDATION_ERROR` (`photos/INVALID`); more than 10 entries → `photos/TOO_MANY`. Reuses `SafeMediaAssetUrlPolicy.validateImageUrlOrThrow`.

### `POST /api/v1/products/{productId}/reviews/photos`

Public, no auth. `multipart/form-data` with a single `file` part — uploads one customer review photo to MinIO and returns its URL so the submit body can reference it. Rate-limited per IP (`REVIEW_PHOTO` tier). Response `data`: `{ url }` (e.g. `/media/reviews/{uuid}/{filename}`).

Validation: image only — declared + Apache Tika magic-byte must be `image/jpeg`, `image/png`, or `image/webp` (no SVG/GIF/video). Max **8 MB** per file. Unknown `productId` → `404`; wrong type / oversize / empty → `400 VALIDATION_ERROR`. Photos are stored directly under the `reviews/` prefix and are **not** registered in the admin media library (`media` table). Evidence: `PublicReviewController.uploadPhoto`, `ReviewPhotoStorageService`.

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
| `DELETE` | `/api/v1/admin/content/content-categories/{id}` | `content.update` | — | `204 No Content` |

**Delete guard:** `DELETE` is blocked with `400 VALIDATION_ERROR` carrying a detail `{ field: "category", code: "CATEGORY_IN_USE" }` when any article (any publish status) still references the category as its primary `category` or in its many-to-many `categories` list. Articles are never modified as a side effect — the editor must reassign/remove them first. Mirrors the product-category delete guard.

Status: `CONFIRMED_FROM_CODE` — `AdminContentController.createCategory/updateCategory/deleteCategory`, `AdminContentReferenceService.deleteCategory`, `ContentCategoryJpaRepository.countArticlesUsingCategory`, `adminApi.createContentCategory/updateContentCategory/deleteContentCategory`. (Note: `createCategory()` in `adminApi.js` targets `/admin/categories` — **product** categories — a separate resource.)

## Article Content Contract

`GET /api/v1/articles/{slug}` — public, no auth. Returns `ApiDataResponse<Article>` for one
`PUBLISHED` article. Served by `ContentController.getArticleBySlug`.

### Article list — `GET /api/v1/articles` query param `featured` (V222)

`GET /api/v1/articles` — public, no auth. Accepts an optional boolean query param `featured`:

- `featured=true` → returns **only** featured articles (used by the storefront "Tin nổi bật" widget).
- `featured=false` or param omitted → no featured filtering (default list behaviour, unchanged).

Other existing list params (e.g. `category`, `q`, paging) are unaffected.

Status: `CONFIRMED_FROM_CODE` — `ContentController.listArticles` (`featured` query param).

### Article payload — `featured` + `seo.noIndex` (V222)

Both the public `Article` shape (`GET /api/v1/articles`, `GET /api/v1/articles/{slug}`) and admin `AdminContentItem` now carry:

- `featured` — top-level boolean. `true` = bài viết được đánh dấu nổi bật.
- `seo.noIndex` — boolean inside the `seo` object. `true` = trang đặt `noindex` (không cho search engine index bài này). The `seo` object may be `null` when no SEO field is set → treat `noIndex` as `false`.

**Pages** không có `featured` và không bật `noIndex` đợt này — luôn `false`.

**Admin upsert** (`POST` / `PATCH /api/v1/admin/content/articles`) accepts both:

- top-level `featured` (boolean) — via `UpsertArticleRequest.featured`.
- `seo.noIndex` (boolean) — via `SeoMetaRequest.noIndex`.

On update (`PATCH`), `null` for either field = giữ nguyên giá trị hiện có (presence-flag pattern).

Status: `CONFIRMED_FROM_CODE` — `ContentController.listArticles`, `UpsertArticleRequest.featured`, `SeoMetaRequest.noIndex`, migration `V222__add_article_featured_and_seo_no_index.sql`. Xem [DATA_CONTRACT.md](DATA_CONTRACT.md) §"Article featured + seo_no_index (V222)".

### Article preview — admin dry-run render (`POST /api/v1/admin/content/articles/preview`)

Mirror of the product preview: powers the **live preview** in the article editor — renders exactly what the storefront blog detail (`/tin-tuc/{slug}`) will show for the *current, unsaved* form input, without persisting anything.

| Aspect | Value |
|---|---|
| Permission | `content.update` (same as create/edit article) |
| Request | `UpsertArticleRequest` (identical to `POST /api/v1/admin/content/articles`) + optional `?lang=vi\|en` (default `vi`) |
| Response | `ApiDataResponse<Article>` — the **public** article shape, identical to `GET /api/v1/articles/{slug}` |

- **No persistence.** Backend validates, builds a transient `ArticleEntity` in memory via `applyArticlePatch` (never `save`d), and maps it through the same detail mapper the storefront uses (`toDomain(entity, locale, includeTranslations=false)`). `@Transactional(readOnly = true)`.
- **Slug uniqueness is NOT enforced** for the dry-run (it is a persistence concern). Previewing an existing article must not flag its own saved slug as a `DUPLICATE` — every other create-mode field rule still applies.
- The sidebar/related-article rails are storefront context (other articles) and are not part of the preview payload.

Status: `CONFIRMED_FROM_CODE`

Evidence: `AdminContentController.previewArticle`, `AdminContentMutationService.previewArticle` (transient build + no `save`), `JpaContentReadRepository.mapPreviewArticle` (public wrapper over `toDomain`).

### Article ↔ Product relation — REMOVED (V167)

> **REMOVED (V167).** Tính năng gắn sản phẩm liên quan vào bài viết đã bị gỡ — bảng `article_product_map` drop ở `V167__drop_article_product_map.sql`. Article không còn `relatedProducts` / `productIds`; `UpsertArticleRequest` không nhận `productIds` và `AdminContentItem` không trả `relatedProducts`. (Product `relatedProducts` ở section riêng — V135 — là tính năng khác, vẫn còn sống.)

Status: `CONFIRMED_FROM_CODE` — `V167__drop_article_product_map.sql`, `Article.java` (no `relatedProducts`), `UpsertArticleRequest.java` (no `productIds`). See [DATA_CONTRACT.md](DATA_CONTRACT.md) §"Article ↔ Product relation — REMOVED (V167)".

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

### Product tags — REMOVED (V243)

The admin product-tag sub-resource (`GET`/`PUT /api/v1/admin/products/{id}/tags`) was removed on 2026-06-19 along with the underlying tables (see DATA_CONTRACT → "Product tags — REMOVED"). The storefront never consumed product tags; the feature carried only dead WordPress-import data. The admin tag editor, controller endpoints, service, request DTO and `ProductEntity.tags` are all deleted.

Status: `CONFIRMED_FROM_CODE` — no remaining endpoint.

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
| `description`, `contentBottom`, `promotionContent`, `installationGuide`, `suitabilityAdvisory` | ❌ `null` | ✅ present |
| `originBrandCountry`, `sizeGuide`, `specificationsHtml` | ❌ `null` | ✅ present |
| `gallery`, `videos`, `specifications`, `specStats`, `faqs`, `commitments`, `purchaseLines`, `positiveNotes`, `negativeNotes` | ❌ `[]` | ✅ present |
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

This same list-view shape is what the product `relatedProducts` array
documents (one list-item `Product` per entry — see "Product related products"
below).

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

### Product preview — admin dry-run render (`POST /api/v1/admin/products/preview`)

Powers the **live preview** in the product editor: render exactly what the storefront PDP will show for the *current, unsaved* form input, without persisting anything.

| Aspect | Value |
|---|---|
| Permission | `products.update` (same as create/edit — the body is a full upsert payload and preview is a sub-step of authoring) |
| Request | `UpsertProductRequest` (byte-for-byte identical to `POST /api/v1/admin/products`) + optional `?lang=vi\|en` (default `vi`) |
| Response | `ApiDataResponse<Product>` — the **public** product shape (`publicView=true`: `costPrice` hidden, stock quantity masked), identical to `GET /api/v1/products/{slug}` |

- **No persistence.** Backend validates the payload, builds a transient `ProductEntity` in memory via `applyProductPatch` (never `save`d), and maps it through the same detail mapper the storefront uses. No row is created or updated; the method is `@Transactional(readOnly = true)`.
- **Validation mirrors create** (category required, slug rules, price/variant constraints) so the editor surfaces the same `400 VALIDATION_ERROR` live — **except slug uniqueness**, which is a persistence concern and is skipped for the dry-run. Without that carve-out, previewing an existing product would flag its own saved slug as a `DUPLICATE` and always `400`.
- **Transient-only fields:** `rating`/`ratingCount` are `null` (a brand-new draft has no reviews); curated `relatedProducts` resolve read-only from their IDs.

Status: `CONFIRMED_FROM_CODE`

Evidence: `AdminCatalogController.previewProduct`, `AdminCatalogMutationService.previewProduct` (transient build + no `save`), `JpaCatalogReadRepository.mapPreviewProduct` (public wrapper over `toDomain(entity, true, locale)`), `AdminCatalogMutationService.applyProductPatch` (pure in-memory entity build; its sole repo touch — `resolveRelatedProducts` — is a read).

### Product upsert — single category only

A product belongs to exactly one category, written via `categoryId`. The legacy `product_category_map` M:N side table was dropped in migration `V110__drop_product_category_map.sql` (2026-05-14). The `categories[]` array in product responses now always contains exactly the primary category, preserved for API compatibility.

Status: `CONFIRMED_BACKEND_ENFORCED`

### Product rich-text content fields — `promotionContent`, `installationGuide`

> **`promotionContent` DEPRECATED (2026-06-18):** khối "Ưu đãi & khuyến mãi" đã gỡ khỏi PDP web (`ProductView.tsx`) và ô nhập trong admin (`ProductDetailScreen.jsx`). API vẫn nhận/trả field và cột `promotion_content(+_en)` vẫn còn (giữ ngủ, không drop) — dữ liệu cũ được bảo toàn, nhưng không còn surface ở đâu trên storefront/admin.

`POST /api/v1/admin/products` and `PATCH /api/v1/admin/products/{id}` accept `promotionContent` (added `V124`) and `installationGuide` (added `V133`): optional strings, max 50 000 characters each, mutated with the presence-flag pattern (sending no key leaves the field untouched on PATCH; sending `null`/blank clears it). They join the existing `description` and `contentBottom` rich-text fields. **`installationGuide` carries a structured JSON object** (format changed in `V242`), not free rich-HTML — see below; the backend still stores it as an opaque string (like `size_guide`/`suitability_advisory`) and does not parse it.

`installationGuide` JSON shape: `{ "steps": [{ "icon": "wrench", "title": "...", "body": "...", "tip"?: "...", "warning"?: "..." }], "maintenance"?: "..." }`. The web renders it as a numbered step grid (number + lucide icon + title + body + optional tip/warning callouts) plus a closing maintenance note. Bilingual: the vi value goes to `installation_guide`, English to `installation_guide_en` written via `translations.en.installationGuide`; the `_en` `steps[]` mirror by index, `icon` is shared (written into both columns).

Both are returned by the public product detail endpoint `GET /api/v1/products/{slug}` and the admin product read response. They are **not** included in product *list* responses (list mappers omit all long-form text). The web PDP renders each as its own numbered section band ("Ưu đãi & khuyến mãi", "Hướng dẫn lắp đặt"); a band is hidden when its field is empty.

Status: `CONFIRMED_FROM_CODE`

Evidence: `UpsertProductRequest.java` (`promotionContent`/`installationGuide` + presence flags), `AdminCatalogMutationService.applyProductPatch`, `Product.java` domain record, `JpaCatalogReadRepository` (detail mapper maps both columns; list mapper passes `null`), `V124__add_product_promotion_content.sql`, `V133__add_product_installation_guide_and_faq.sql`, `V242__convert_installation_guide_to_steps.sql`. Web parse: `lib/utils/installation.ts` + `ProductInstallationGuide` (`ProductLocalizedParts.tsx`). Admin editor: `InstallationGuideEditor` (`ProductDetailScreen.jsx`).

### Product PDP content — `suitabilityAdvisory` (V237)

> **Đã gỡ (V250):** trường `quickAnswerSummary` ("Quick Answer" — blockquote AIO 40–60 từ) đã bị **bỏ hoàn toàn** khỏi web PDP, ô nhập admin và API; 2 cột `quick_answer_summary` / `_en` (V236) đã drop. Không còn nhận/trả ở bất kỳ endpoint nào.

`POST /api/v1/admin/products` and `PATCH /api/v1/admin/products/{id}` accept the bilingual field:

- **`suitabilityAdvisory`** — optional string carrying a **JSON array of advisory cards** (V240), max 20 000 chars (presence-flag). "Phù hợp với ai" block: each card = `{ audience, advice, linkLabel?, linkUrl? }` where `audience` is the bold target-rider lead-in, `advice` the recommendation sentence, and `linkLabel`/`linkUrl` an optional internal cross-sell link. The web parses the JSON and renders one card per item (no `sanitizeRichHtml`; non-JSON legacy values render nothing). `linkUrl` is shared across both languages; the EN array (`_en`) mirrors the cards by index with translated text. Was a free rich-HTML string before V240.

It is bilingual: the vi value goes to the canonical column, English to `_en`. On `PATCH`, sending no key leaves the field untouched; sending `null`/blank clears it. English is written via the `translations.en` object (`ProductContentRequest.suitabilityAdvisory`).

It is returned by `GET /api/v1/products/{slug}` (locale-resolved via `pick`, with vi fallback) and the admin product read (`GET /api/v1/admin/products/{id}` carries vi + raw English in `translations.en`). **Not** included in product *list* responses. It renders as its own PDP section; the section is hidden when the field is empty. The "Hoàn thiện bộ bảo hộ" block reuses `relatedProducts` — no new cross-sell field.

Status: `CONFIRMED_FROM_CODE`

Evidence: `UpsertProductRequest.java` (`suitabilityAdvisory` + presence flag), `ProductTranslationRequest.ProductContentRequest`, `AdminCatalogMutationService.applyProductPatch`/`applyTranslations`, `Product.java` + `ProductTranslations.java`, `JpaCatalogReadRepository` (detail mapper `pick`s it; list mapper passes `null`), `V237__add_product_suitability_advisory.sql`, `V240__convert_suitability_advisory_to_cards.sql`, `V253__drop_product_quick_answer_summary.sql`.

### Product specs HTML override — `specificationsHtml` (V255)

`POST /api/v1/admin/products` and `PATCH /api/v1/admin/products/{id}` accept the bilingual field:

- **`specificationsHtml`** — optional string, max 50 000 chars (presence-flag). When non-blank, the web PDP renders this HTML (via `sanitizeRichHtml`, which allows `<table>`) **instead of** the structured `specifications` name/value table ("html wins"); blank/null → the structured table renders as before. The structured `specifications` array is still stored and returned unchanged — only the PDP *rendering* is overridden.

It is bilingual: the vi value goes to the canonical column, English to `_en`. On `PATCH`, sending no key leaves the field untouched; sending `null`/blank clears it. English is written via the `translations.en` object (`ProductContentRequest.specificationsHtml`).

It is returned by `GET /api/v1/products/{slug}` (locale-resolved via `pick`, with vi fallback) and the admin product read (`GET /api/v1/admin/products/{id}` carries vi + raw English in `translations.en`). **Not** included in product *list* responses.

Status: `CONFIRMED_FROM_CODE`

Evidence: `UpsertProductRequest.java` (`specificationsHtml` + presence flag), `ProductTranslationRequest.ProductContentRequest`, `AdminCatalogMutationService.applyProductPatch`/`applyTranslations`, `Product.java` + `ProductTranslations.java`, `JpaCatalogReadRepository` (detail mapper `pick`s it; list mapper passes `null`), `V255__add_product_specifications_html.sql`.

### Product description blocks — `descriptionBlocks` (V139)

`POST /api/v1/admin/products` and `PATCH /api/v1/admin/products/{id}` accept `descriptionBlocks`: an optional array of typed block objects. Each element must include a `type` discriminator plus its type-specific required fields (validated via Bean Validation cascade). The wire schema still accepts the full sealed set (`heading`, `paragraph`, `list`, `image`, `video`, `callout`, `divider`, `feature`) because the model is shared with Content, but the **product admin editor only authors 4 of them** (V238): `paragraph` (rich-text), `image`, and `feature` with `side="right"`/`"left"`. The `feature` block (image + `subheading` eyebrow + `heading` + paragraph + list combined; optional `side` = `auto`\|`left`\|`right`) renders as a 2-column image–text row on the PDP and is the explicit replacement for the removed implicit image+text grouping — see `DATA_CONTRACT.md` § "Product description blocks".

**Mutation semantics:** Sending `descriptionBlocks` (including `[]`) triggers the block renderer, which converts the array to sanitized HTML and atomically overwrites **both** `description_blocks` (JSONB, raw blocks) and `description` (TEXT, rendered HTML). Omitting the key on PATCH leaves both columns untouched — backward-compatible with products authored via the legacy RichTextEditor.

`descriptionBlocks` is returned on `GET /api/v1/products/{slug}` and `GET /api/v1/admin/products/{id}` as `descriptionBlocks: BlockObject[] | null`. Products without blocks have `descriptionBlocks: null`; `description` (HTML) remains present and populated from whatever source last wrote it. Not included in product list responses (null).

Status: `CONFIRMED_FROM_CODE` — `UpsertProductRequest.java` (`descriptionBlocks` + presence flag), `DescriptionBlockRenderer`, `AdminCatalogMutationService.applyProductPatch`, `JpaCatalogReadRepository`, `V139__add_product_description_blocks.sql`, `V238__ConsolidateProductDescriptionBlocks.java` (gộp dữ liệu sản phẩm cũ về 4 khối; `FeatureBlock.subheading`).

### Product FAQ entries — `faqs`

`POST /api/v1/admin/products` and `PATCH /api/v1/admin/products/{id}` accept `faqs` (added `V133`): an optional array of `{ question, answer, sortOrder }` objects, max 50 entries (`@Size(max = 50)`). `question` ≤ 500 chars, `answer` ≤ 20 000 chars. Sending `faqs` replaces the whole list; rows with a blank question or answer are dropped. Mirrors the `specifications` array mutation pattern (full-replace, not presence-flag).

`faqs` is returned on the public product detail endpoint `GET /api/v1/products/{slug}` and the admin product read response as `faqs: [{ question, answer }]`. It is **not** included in product *list* responses. `answer` is sanitized rich-text **HTML** (authored in the admin TipTap editor; legacy plain-text answers remain valid). The web PDP renders it as the "Câu hỏi thường gặp" accordion section band — answer HTML sanitized via `sanitizeRichHtml` and shown in a `.wyswyg` block — and emits matching `FAQPage` JSON-LD whose answer text is stripped to plain text (`stripHtmlToText`).

Status: `CONFIRMED_FROM_CODE`

Evidence: `FaqRequest.java`, `UpsertProductRequest.java` (`faqs`), `AdminCatalogMutationService.applyFaqs`, `ProductFaq` domain record, `ProductFaqEntity`, `JpaCatalogReadRepository.toFaqs` (detail mapper; list mapper passes `[]`), `V133__add_product_installation_guide_and_faq.sql`.

### Product commitment rows — `commitments` (V232)

`POST /api/v1/admin/products` and `PATCH /api/v1/admin/products/{id}` accept `commitments` (added `V232`): an optional array of `{ icon, title, subtitle, titleEn?, subtitleEn?, sortOrder? }` objects, max 12 entries (`@Size(max = 12)`). `icon` ≤ 40 chars (a key from the fixed web icon set — e.g. `truck`, `refresh-cw`, `shield-check`, `badge-check`, `credit-card`, `headphones`, `package`, `gift`, `clock`, `map-pin`, `wrench`, `award`; unknown keys fall back to `shield-check`). `title` ≤ 200 chars, `subtitle` ≤ 300 chars. Sending `commitments` replaces the whole list; rows with a blank title are dropped. Full-replace, mirrors `faqs`.

This **supersedes** the former global `public_product` `product_commitment_*` settings (V228) — the commitment block under the buy buttons is now **per-product**, not a shared site setting. The 6 global commitment keys are removed from `SettingDefinitionRegistry`. The two former trust-badge settings (`product_trust_genuine` / `product_trust_freeship`) are likewise removed in **V233** — the trust-badge row above the title is now per-product via `trustBadges` (see below).

`POST`/`PATCH /api/v1/admin/products/{id}` also accept `trustBadges` (added `V233`): an optional array of `{ content, contentEn?, sortOrder? }` objects, max 12 entries, each ≤ 200 chars. These render as the **trust-badge row above the product title** (e.g. "Chính hãng" · "BH 2 năm" · "Freeship"). Full-replace like `commitments`; rows with blank `content` are dropped. Returned on `GET /api/v1/products/{slug}` and admin read as `trustBadges: [{ content }]` (admin reads add `contentEn`); not in list responses. Empty list → the web hides the row. No default seed — products start empty; admin curates per product.

`commitments` is returned on the public product detail endpoint `GET /api/v1/products/{slug}` and the admin product read response as `commitments: [{ icon, title, subtitle }]` (admin reads additionally carry `titleEn`/`subtitleEn`). It is **not** included in product *list* responses. The web PDP renders it as the commitment rows under the buy buttons (icon fixed per-row by the `icon` key); a row with a blank title is hidden; an empty list hides the whole block.

Status: `CONFIRMED_FROM_CODE`

Evidence: `CommitmentRequest.java`, `UpsertProductRequest.java` (`commitments`), `AdminCatalogMutationService.applyCommitments`, `ProductCommitment` domain record, `ProductCommitmentEntity`, `JpaCatalogReadRepository.toCommitments` (detail mapper; list mapper passes `[]`), `V232__create_product_commitments.sql`.

### Product spec-stat boxes — `specStats` (V235)

`POST /api/v1/admin/products` and `PATCH /api/v1/admin/products/{id}` accept `specStats` (added `V235`): an optional array of `{ value, label, valueEn?, labelEn?, sortOrder? }` objects, **max 4** entries (`@Size(max = 4)`). `value` ≤ 60 chars (the headline figure, e.g. `24 tháng`), `label` ≤ 80 chars (e.g. `Bảo hành`). Sending `specStats` replaces the whole list; rows with a blank value or label are dropped. Full-replace, mirrors `specifications`.

These render as the **"Specs Dashboard" stat boxes right under the buy area** on the PDP — a selling-point figure ("đòn chốt"), **not** a technical specification. This **replaces** the `specifications[].featured` flag (V230), which is **removed** in V235.

`specStats` is returned on the public product detail endpoint `GET /api/v1/products/{slug}` and the admin product read response as `specStats: [{ value, label }]` (admin reads additionally carry `valueEn`/`labelEn`). It is **not** included in product *list* responses. The web PDP renders up to 4 boxes; a row with a blank value/label is hidden; an empty list hides the whole block. V235 seeds each product from its existing `featured=true` specs (up to 4) then drops the `featured` column.

Status: `CONFIRMED_FROM_CODE`

Evidence: `SpecStatRequest.java`, `UpsertProductRequest.java` (`specStats`), `AdminCatalogMutationService.applySpecStats`, `ProductSpecStat` domain record, `ProductSpecStatEntity`, `JpaCatalogReadRepository.toSpecStats` (detail mapper; list mapper passes `[]`), `V235__create_product_spec_stats.sql`.

### Product SEO template fields — pros/cons, warranty, origin, weight, size guide (V175)

`POST /api/v1/admin/products` và `PATCH /api/v1/admin/products/{id}` chấp nhận nhóm
field bổ sung cho template trang sản phẩm chuẩn SEO/AEO:

- **`positiveNotes` / `negativeNotes`** — **(V251) nhận lại qua request, full-replace.** Ưu/Nhược
  điểm tách RA khỏi mô tả (đảo phần `prosCons` của V246) → khối RIÊNG cố định ngay dưới mô tả, ngoài
  tab; admin nhập ở card riêng (không bắt buộc). Mỗi nhóm là **mảng `{ content, contentEn?, sortOrder? }`**
  (`@Size(max = 20)`, `content` blank bị drop), lưu vào bảng con `product_highlights`
  (`AdminCatalogMutationService.applyHighlights`). Trên product detail response (public/admin) trả
  mảng `{ content, contentEn? }` đọc từ bảng (`JpaCatalogReadRepository.toHighlights`) — cũng là nguồn
  rich result schema.org `positiveNotes`/`negativeNotes` (json-ld).
- **`purchaseLines`** — `List<PurchaseLineRequest>` (presence-flag / **full-replace**, tối đa **12** dòng) — **(V249)** các dòng tự do của khối **"Mua tại BigBike.vn"** theo từng sản phẩm (mirror `commitments`/V232). Mỗi dòng `{ icon, label, value, labelEn?, valueEn?, sortOrder? }`: `icon` (key web cố định, trống → `shield-check`), `label` (bắt buộc — dòng label trống bị bỏ), `value` (tuỳ chọn), `labelEn`/`valueEn` (bản tiếng Anh tuỳ chọn). **Detail-only** (`[]` trong list). Public read chỉ trả `{ icon, label, value }`; admin read thêm `{ labelEn, valueEn }`. **Thay thế** 4 field cũ `warrantyMonths`/`warrantyScope`/`pdpShippingLine`/`pdpReturnLine` (đã gỡ khỏi domain/API/admin/web, V249 backfill dữ liệu cũ sang các dòng này). Trên bigbike-web, khối còn **tự động** chèn dòng **Giá + Tồn kho** (đầu khối, realtime) và **Hotline + Địa chỉ** (cuối khối) ngoài các dòng `purchaseLines` admin nhập.
- **`originBrandCountry`** — `String` ≤ 120 ký tự (presence-flag) — "thương hiệu [nước]".
  (Trường `originManufactureCountry` / cột `origin_manufacture_country` đã gỡ ở V241 — không còn hiển thị trên web.)
- **`weightGrams`** — **đã gỡ** (quyết định chủ shop). Field dẫn xuất này không còn trên
  request/response/domain, không còn ô nhập trong admin, web ngừng khai schema.org `Product.weight`.
  Cột vật lý `weight_kg` vẫn tồn tại trong DB (kích thước WooCommerce-import) nhưng không còn
  admin ghi/đọc qua field này.
- **`sizeGuide`** — **(V246) không còn nhận qua request** (bảng size giờ là khối `sizeGuide`
  trong `descriptionBlocks`). Cột `size_guide` = legacy/dormant. Field vẫn còn trên response
  (đọc từ cột cũ) nhưng web không render riêng nữa.
- **`suitabilityAdvisory`** (V237/V240) — tương tự, **(V246) không còn nhận qua request**
  (Phù hợp với ai giờ là khối `suitability` trong `descriptionBlocks`). Cột legacy/dormant.

> **V251:** `positiveNotes`/`negativeNotes` admin **gửi lại** (full-replace bảng `product_highlights`).
> `sizeGuide`/`suitabilityAdvisory` setter cũ vẫn dormant (admin không gửi — 2 mục đó vẫn là khối trong
> mô tả). DTO `UpsertProductRequest` còn `ProsConsBlock`-related dormant chỉ để deserialize an toàn.

`originBrandCountry` trả về trên
`GET /api/v1/products/{slug}` và admin product read; **không** có trong product *list*
responses (detail-only). Web PDP render: **Ưu/Nhược điểm là khối RIÊNG cố định ngay dưới mô tả, ngoài
tab (V251)** — đặt trước "Sản phẩm tương tự"; Phù hợp với ai · Bảng size vẫn là **khối trong mô tả**
(V246); schema `positiveNotes`/`negativeNotes` đọc từ bảng `product_highlights`.

Evidence: `UpsertProductRequest.java` (`positiveNotes`/`negativeNotes` + `applyHighlights`), `Product.java` domain record,
`JpaCatalogReadRepository.toHighlights`, `DescriptionBlock.java` (`SuitabilityBlock`/`SizeGuideBlock`;
`ProsConsBlock` dormant), `DescriptionBlockRenderer`, `V175__add_product_seo_template_fields.sql`,
`V246__MigrateProductSectionsToBlocks.java`, `V254__remove_proscons_blocks.sql`.

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

Evidence: `UpsertProductRequest.java` (`relatedProductIds`), `AdminCatalogMutationService.resolveProductRefs`, `Product.java` domain record (`relatedProducts`), `ProductEntity.relatedProducts`, `JpaCatalogReadRepository.toRelatedProducts` (detail mapper; list mapper passes `[]`), `V135__add_product_related_product_map.sql`.

### Gallery media — ảnh + video trong gallery (V248)

`gallery` (sản phẩm) và `variants[].gallery` (biến thể) giờ là **media hỗn hợp**. Mỗi phần tử
`GalleryImageRequest` nhận thêm: `mediaType` (`image`|`video`, mặc định `image`), `videoUrl`
(link YouTube / URL MinIO khi là video), `videoProvider` (`youtube`|`upload`). Item ảnh dùng `url`/`alt`
như cũ; item video dùng `videoUrl`+`videoProvider`, còn `url`/`alt` (nếu có) là **thumbnail/poster**.
Full-replace như trước; item rỗng (ảnh thiếu `url` HOẶC video thiếu `videoUrl`) bị bỏ. Ảnh bìa biến thể
vẫn lấy ảnh ĐẦU TIÊN là **ảnh** (bỏ qua item video).

Read: `GET /api/v1/products/{slug}` + admin read trả `gallery`/`variants[].gallery` dạng
`GalleryMedia[]` = `{ mediaType, image: ImageAsset|null, videoUrl, provider }`. **Tách biệt với `videos`**
(mục "Video" riêng dưới PDP — `product_videos`, không đổi): gallery video do admin đăng chung khu vực ảnh
thumbnail, hiển thị trong dải media trên cùng.

Status: `CONFIRMED_FROM_CODE` — `GalleryImageRequest` (3 field mới), `AdminCatalogMutationService.applyGallery`/`applyVariantGallery`, `GalleryMedia`, `JpaCatalogReadRepository.toGalleryMedia`, `V248__add_gallery_media_video.sql`.

### Product accessories — `accessoryProducts` / `accessoryProductIds` (V239)

`POST /api/v1/admin/products` and `PATCH /api/v1/admin/products/{id}` accept `accessoryProductIds` (added `V239`): an optional ordered array of product ID strings, max 24 entries (`@Size(max = 24)`). These are **sản phẩm bán kèm** ("Phụ kiện") curated from the catalog. Sending `accessoryProductIds` replaces the whole list; **an empty array clears it**, `null`/omitted leaves it untouched. The mutation service de-duplicates, preserves order, and silently drops unknown IDs plus the product's own ID. Semantics mirror `relatedProductIds` exactly (shared resolver `resolveProductRefs`); the two lists are independent.

`accessoryProducts` is returned on the public product detail endpoint `GET /api/v1/products/{slug}` and the admin product read response as an ordered array of **list-view product objects** (same shape as `relatedProducts`). It is **not** included in product *list* responses. The public read includes **only `PUBLISHED`** entries; admin reads return every linked product. The web PDP renders them in the "Phụ kiện" carousel above "Sản phẩm liên quan"; when the array is empty the section is hidden — there is **no fallback**.

Status: `CONFIRMED_FROM_CODE`

Evidence: `UpsertProductRequest.java` (`accessoryProductIds`), `AdminCatalogMutationService.resolveProductRefs`, `Product.java` domain record (`accessoryProducts`), `ProductEntity.accessoryProducts`, `JpaCatalogReadRepository.toAccessoryProducts` (detail mapper; list mapper passes `[]`), `V239__add_product_accessory_product_map.sql`.

### Product bilingual content — `lang` param & `translations` (V136)

Sản phẩm có 2 bản nội dung: tiếng Việt (canonical) và tiếng Anh (tùy chọn).

**Đọc public — query param `lang`:** `GET /api/v1/products` và
`GET /api/v1/products/{slug}` nhận `lang` = `vi` (mặc định) hoặc `en`. Khi
`lang=en`, mỗi trường text trả về bản tiếng Anh, **lùi về tiếng Việt theo từng
trường** khi cột `_en` rỗng (`COALESCE`). Storefront `bigbike-web` lưu lựa chọn
trong cookie `NEXT_LOCALE` (1 năm); server pages đọc cookie qua `getLocale()`
của next-intl và truyền vào `lang` query. Các trường được dịch: `name`,
`shortDescription`, `description`, `contentBottom`, `promotionContent`,
`installationGuide`, `suitabilityAdvisory`,
`seo.title`, `seo.description`, và `specifications[]`
(`name`/`value`/`group`), `faqs[]` (`question`/`answer`). Response public **giữ
nguyên shape** — không thêm khối `translations`.

`GET /api/v1/products/{idOrSlug}/snapshot` (buy-box giá/tồn/biến thể) cũng nhận
`lang` = `vi` (mặc định) hoặc `en`. Khi `lang=en`, mỗi phần tử trong `variants[].options[]`
trả `name` (tên thuộc tính, vd "Màu sắc"→"Color") và `value` (giá trị, vd "Đỏ"→"Red")
ở bản tiếng Anh, **lùi về tiếng Việt theo từng trường** khi cột `_en` rỗng. `bigbike-web`
gọi snapshot với `lang` = locale hiện tại để khối chọn màu/size đổi ngôn ngữ đồng bộ với
phần còn lại của trang. `pricing`/`stock` không có text dịch nên không đổi theo `lang`.

**Đọc admin — cả 2 bản:** `GET /api/v1/admin/products/{id}` trả các trường chính
ở bản tiếng Việt **và** thêm:
- `translations.en` — object `{ name, shortDescription, description, contentBottom,
  promotionContent, installationGuide, suitabilityAdvisory,
  seoTitle, seoDescription }` chứa bản tiếng
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

### English URL slug — `slugEn` (V213/V214/V215/V216)

Danh mục, sản phẩm, thương hiệu, **bài viết** có thêm slug tiếng Anh tùy chọn. Áp dụng cho
`GET /api/v1/categories/{slug}`, `/products/{slug}`, `/brands/{slug}`, `/articles/{slug}` và các endpoint
admin upsert tương ứng. (**Trang tĩnh** `pages` **không** có — giữ `PAGE_RULE_003`.)

**Lookup public — tra cứu theo vi HOẶC en slug:** path `{slug}` được resolve theo
`slug` tiếng Việt **hoặc** `slug_en` (`findBySlug(slug).or(() -> findBySlugEn(slug))`, ưu tiên khớp
vi trước). Cả URL vi lẫn URL en đều mở cùng entity. `lang` param vẫn quyết định ngôn
ngữ **nội dung** (`PRODUCT_RULE_002`/`CATEGORY_RULE_002`/`BRAND_RULE_002`/`ARTICLE_RULE_002`); nó **không**
ảnh hưởng việc resolve slug.

**Response — thêm trường `slugEn`:** public detail (và list) trả thêm
`slugEn: string | null` cạnh `slug`. `slug` luôn là canonical tiếng Việt (không đổi
theo `lang`); `slugEn` là giá trị thô của cột `slug_en` (null nếu chưa nhập). Web dùng
`slug` cho canonical + `slugEn` cho URL/hreflang tiếng Anh (trống → URL EN lùi về `slug`).

**Embedded summary cũng mang `slugEn`:** object `category`/`brand` nhúng trong response
sản phẩm (`CategorySummary`/`BrandSummary` — dùng cho breadcrumb PDP) trả thêm
`slugEn: string | null` cạnh `slug`, lấy thô từ `slug_en` của danh mục/thương hiệu đó.
Cho phép breadcrumb PDP điều hướng tới URL tiếng Anh khi khách đang ở chế độ EN (trống →
lùi về `slug` vi). Embedded `categories[]` (danh mục phụ) giữ shape cũ, **chưa** mang `slugEn`.

**Ghi — `POST/PATCH` admin categories/products/brands/articles:** `translations.en` nhận thêm
khóa `slug` (optional): pattern `^[a-z0-9]+(?:-[a-z0-9]+)*$`, max 100. Bỏ trống/null →
xoá `slug_en` (URL EN fallback về vi). Validation uniqueness: `slugEn` trùng `slug` vi
của entity này, hoặc trùng `slug`/`slug_en` của entity khác cùng loại → lỗi
`DUPLICATE`/`INVALID_VALUE` tại path `translations.en.slug`; `slug` vi mới trùng
`slug_en` đang có → lỗi tại path `slug`. Catalog đổi/xoá `slug_en` tự sinh redirect 301;
**bài viết KHÔNG sinh redirect** (module nội dung không có cơ chế này).

Status: `CONFIRMED_FROM_CODE` — `CatalogController`/`ContentController` (path resolve), `CategoryJpaRepository`/
`ProductJpaRepository`/`BrandJpaRepository`/`ArticleJpaRepository` (`findBySlug`/`findBySlugEn`),
`JpaCatalogReadRepository`/`JpaContentReadRepository` (map `slugEn` + OR-resolve), `*TranslationRequest`/`ArticleTranslationRequest` (field `slug`),
`AdminCatalogMutationService`/`AdminContentMutationService` (validate), migrations `V213`/`V214`/`V215`/`V216`.
Xem [DATA_CONTRACT.md](DATA_CONTRACT.md) §"English URL slug".

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

### Menu/category line-icon — DB-driven (V213)

`GET /api/v1/menus/{location}` trả mỗi mục menu kèm `iconUrl` (icon line đơn sắc, null cho mục không phải
danh mục). Shape **không đổi**; chỉ đổi **nguồn**: trước V213 resolve từ map slug hard-code
(`CATEGORY_SLUG_ICON_MAP`), từ V213 resolve theo danh mục trong DB — backend tách slug từ URL mục menu
(`/danh-muc-san-pham/{slug}`) → `CategoryEntity.menuIconUrl`. Đổi tên danh mục/slug không còn làm mất icon.

`GET /api/v1/categories`, `/api/v1/categories/{slug}` cũng trả thêm field `menuIconUrl` trên mỗi Category
(dùng bởi bộ lọc "Danh mục sản phẩm" ở `bigbike-web`). Xem `DATA_CONTRACT` §"Category menu/sidebar line-icon".

**Ghi (admin):** `POST/PATCH /api/v1/admin/categories` nhận thêm `menuIcon` (`ImageAssetRequest`, chỉ `url`
được lưu vào `menu_icon_url`; validate URL whitelist media như `image`/`icon`/`banner`). Presence-flag:
bỏ khóa `menuIcon` thì PATCH giữ nguyên; gửi `menuIcon: { url: null }` để xoá icon. Admin sửa icon này ở
form danh mục (`CategoryDetailScreen`, field "Icon menu / bộ lọc danh mục"). Khác với `icon` (ảnh hero
trang danh mục → `icon_url`).

Status: `CONFIRMED_FROM_CODE` — `AdminMenuService.resolveMenuIconUrl` (DB lookup), `Category` domain record
(`menuIconUrl`), `CatalogController` `/categories`, `UpsertCategoryRequest.menuIcon` +
`AdminCatalogMutationService.applyCategoryPatch` (ghi admin), migration `V213`.

### Menu location `policy` — sidebar trang chính sách (V226)

`policy` là system menu slot thứ tư (cạnh `primary`/`footer`/`guide`). Nó cấp **danh
sách + thứ tự** các trang trong thanh bên `/chinh-sach/{slug}` của storefront — admin
quản lý qua trình quản lý Menu như các slot khác (thêm/bớt/sắp xếp/bật-tắt mục).

**Đọc public:** `GET /api/v1/menus/policy?lang=vi|en` — shape `PublicMenu` chuẩn. Mỗi
mục trỏ tới `/chinh-sach/{page-slug}`; web khớp `current` khi `page-slug` bằng slug đang
xem. Thân bài trang là PAGE content thường (`GET /api/v1/pages/{slug}`); slug không khớp
trang CMS nào → 404. Không còn bảng map slug hard-code trong `bigbike-web`.

**Ghi (admin):** dùng chung `POST/PATCH/DELETE /api/v1/admin/menus/{menuId}/items` như
mọi menu. Container `policy` là system slot → không tạo/xóa được (chỉ quản lý mục bên
trong). V226 seed sẵn 4 mục: bảo mật, bảo hành, đổi trả, điều khoản.

Status: `CONFIRMED_FROM_CODE` — `MenuLocations.POLICY`, `AdminMenuService`,
`PublicMenuController`, `V226__seed_policy_menu_slot.sql`,
`bigbike-web/app/chinh-sach/[slug]/page.tsx`, `bigbike-admin/src/screens/MenuScreen.jsx`.

### Thứ tự danh sách danh mục công khai — `GET /api/v1/categories`

Danh sách trả về sắp theo `sortOrder` tăng dần (mặc định khi không truyền `sort`); danh mục có
`sortOrder = null` bị đẩy xuống cuối. **Tie-break:** khi nhiều danh mục cùng `sortOrder`, sắp phụ theo
`name` (không phân biệt hoa/thường, tăng dần) — để thứ tự ổn định và khớp với cây danh mục bên admin
(admin sắp anh-em theo `sortOrder` rồi `name`). Tie-break theo tên luôn tăng dần kể cả khi `sort=sortOrder:desc`.
Lưới danh mục trang chủ `bigbike-web` dùng đúng endpoint này với `showOnHomepage=true`.

Status: `CONFIRMED_FROM_CODE` — `CatalogReadService.categoryComparator` / `listCategories`.

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
- `public_home`:
  - `promo_title`, `promo_off`, `promo_href`, `promo_image_url` — homepage promo banner block.
  - `home_exp_subtitle`, `home_exp_title`, `home_exp_desc` — homepage experience/news teaser section copy.
  - `about_title`, `about_subtitle`, `about_content_html` — homepage about block copy.
- `public_about`: full **About page** (`/gioi-thieu`) editable copy — added in `V223__seed_about_page_content_settings.sql`. All `publicAllowed`; text keys carry `setting_value_en`. The web page renders these settings-first and falls back to the original theme copy (i18n `About` namespace) only when a key is blank, so the page is never empty.
  - `about_page_kicker` (STRING), `about_page_tagline` (LONG_TEXT) — intro block-head.
  - `about_page_intro_html` (HTML) — the four opening paragraphs as one rich-text field.
  - `about_page_quality_heading` (STRING), `about_page_quality_body` (LONG_TEXT) — "Chất lượng dịch vụ" block-head.
  - `about_page_service{1..5}_title` (STRING), `_body` (LONG_TEXT), `_image` (IMAGE_URL), `_highlight` (BOOLEAN) — the 5 service tiles; `_highlight=true` paints the orange tile background (defaults: tiles 1 & 5 highlighted). Tile count is fixed at 5 (layout constraint).
  - `about_page_connect_heading` (STRING), `about_page_connect_intro1` (LONG_TEXT), `about_page_connect_intro2` (LONG_TEXT) — "Kết nối với chúng tôi" block. The store/hotline/Facebook cards below still read the shared `contact` keys; brand logos still load from the brand taxonomy.
- `public_product`: **no shared settings.** All product-detail content is per-product: commitment rows under the buy buttons (`product.commitments`, V232) and the trust-badge row above the title (`product.trustBadges`, V233). The former `product_commitment_*` (V228) and `product_trust_*` keys were removed in V232/V233.
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
| `hero_<page>_image_url` | `IMAGE_URL` | Desktop background image URL |
| `hero_<page>_mobile_image_url` | `IMAGE_URL` | Mobile (≤767px) background image URL; blank → falls back to the desktop image |
| `hero_<page>_illustration_url` | `IMAGE_URL` | Right-side cut-out gear illustration; blank → falls back to `hero_default_illustration_url` |
| `hero_<page>_image_alt` | `STRING` | Image alt text |
| `hero_<page>_title` | `STRING` | Heading text |

Concrete keys: `hero_products_*`, `hero_brands_*`, `hero_news_*` (15 total). All are returned by `GET /api/v1/settings/public`. Two global fallbacks also live in `public_hero`: `hero_default_bg_url` and `hero_default_illustration_url`, used when a page has no own background / illustration. **Cascade per page:** the page's own key → the matching global default → a hardcoded asset baked into `WpCategoryHero`. The `WpCategoryHero` web component renders `mobile_image_url` via an art-directed `<img>` overlay shown only below the `md` breakpoint. The `_description` and `_kicker` keys that earlier seeds carried were dropped in `V199__drop_unused_hero_settings.sql` (never consumed); `_mobile_image_url` was re-introduced in `V220__reseed_hero_mobile_settings.sql`; per-page `_illustration_url` was added in `V221__add_hero_per_page_illustration.sql` (previously all three pages shared `hero_default_illustration_url`). These keys are managed by the dedicated **Banner trang** admin screen (`BannerScreen.jsx`). CMS pages (about/contact/policy/guides) carry the same hero fields directly on the `Page` entity instead — see [DATA_CONTRACT.md](DATA_CONTRACT.md) "Page hero fields".

**`UpsertPageRequest` admin DTO** (admin can edit hero on any CMS page):
- `heroImage`: `{ url, alt }` — same nested shape as `coverImage`. Send `{ url: "" }` to clear.
- `heroTitle`, `heroDescription`, `heroKicker`: nullable strings.

**Public `Page` response** adds `heroImageUrl`, `heroImageAlt`, `heroTitle`, `heroDescription`, `heroKicker` (all nullable strings) to the existing shape.

## Contact Page Builder Contract

Bố cục trang `/lien-he` (xem [DATA_CONTRACT.md](DATA_CONTRACT.md) §"Contact page layout").

| Endpoint | Permission | Behavior | Status | Evidence |
|---|---|---|---|---|
| `GET /api/v1/admin/contact-page` | `content.read` | Trả `{ blocks, values }`: toàn bộ khối (cả khối ẩn) + giá trị hiện tại của mọi key contact whitelisted để builder sửa inline. | `CONFIRMED_FROM_CODE` | `AdminContactPageController.java`, `ContactPageService.getForAdmin` |
| `PUT /api/v1/admin/contact-page` | `content.update` | Body `{ "blocks":[…], "values":[{"key","value","valueEn"}] }`. Lưu cả mảng khối (tối đa 40); với khối bound, **ghi xuyên** `values` xuống `site_settings` qua `AdminSettingsService` (chỉ key thuộc whitelist nhóm `contact` — editor không cần `settings.write`). Validate giá trị theo `SettingValueValidator`. Revalidate `page:lien-he` + `settings`. | `CONFIRMED_FROM_CODE` | `AdminContactPageController.java`, `ContactPageService.save` |
| `GET /api/v1/contact-page` | public | `?lang=vi\|en`. Trả mảng khối `enabled`, nhãn/HTML đã resolve theo lang. Web tự merge giá trị khối bound từ `GET /api/v1/settings/public`. | `CONFIRMED_FROM_CODE` | `PublicContactPageController.java`, `ContactPageService.listPublicBlocks` |

Whitelist key ghi xuyên (`ContactPageService.WRITE_THROUGH_KEYS`): `hotline`, `hotline_2`, `hotline_3`, `contact_email`, `contact_address`, `zalo_url`, `facebook_url`, `messenger_url`, `instagram_url`, `youtube_url`, `tiktok_url`, `opening_hours_weekday`, `opening_hours_weekend`, `opening_hours_holiday`.

## Guide Page Builder Contract

Lưới trang tổng `/huong-dan` (xem [DATA_CONTRACT.md](DATA_CONTRACT.md) §"Guide page layout"). Thân bài chi tiết vẫn qua `GET /api/v1/pages/{slug}` của module Trang.

| Endpoint | Permission | Behavior | Status | Evidence |
|---|---|---|---|---|
| `GET /api/v1/admin/guide-page` | `content.read` | Trả `{ heroTitleVi, heroTitleEn, heroImageUrl, entries }`: hero + toàn bộ ô (cả ô ẩn) để builder sửa. | `CONFIRMED_FROM_CODE` | `AdminGuidePageController.java`, `GuidePageService.getForAdmin` |
| `PUT /api/v1/admin/guide-page` | `content.update` | Body `{ heroTitleVi, heroTitleEn, heroImageUrl, entries:[…] }`. Lưu cả mảng ô (tối đa 40). Revalidate `page:huong-dan`. | `CONFIRMED_FROM_CODE` | `AdminGuidePageController.java`, `GuidePageService.save` |
| `GET /api/v1/guide-page` | public | `?lang=vi\|en`. Trả `{ heroTitle, heroImageUrl, entries }` với ô `enabled`, tiêu đề/mô tả đã resolve theo lang. Web dựng lưới + sidebar + map `pathSegment→pageSlug` từ payload này. | `CONFIRMED_FROM_CODE` | `PublicGuidePageController.java`, `GuidePageService.getPublic` |

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

**Write guarantee (non-blocking):** All audit-log writes go through the central `AuditLogWriter`, which persists in a separate transaction (`@Transactional(REQUIRES_NEW)`) wrapped in try/catch. An audit-write failure is logged and swallowed — it never rolls back or breaks the originating business action. `createdAt` is auto-set if a caller leaves it null. In the mock/read-only profile (no JPA repository) the write is a silent no-op. `CONFIRMED_FROM_CODE` — `AuditLogWriter.java`, `AuditLogPersister.java`.

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
| `orderRefundableAmount` | `BigDecimal` | `paid − refunded` | Remaining refundable amount. Full-coverage REFUNDED requires `refundAmount` to equal this exactly; partial-coverage REFUNDED requires `0 < refundAmount ≤ this` |
| `isFullReturnCoverage` | `boolean` | derived from `order_line_items.quantity` vs `sum(non-rejected return_items.quantity)` | `true` when every line item is fully covered by non-rejected returns. Full coverage → whole-order refund; `false` → partial refund (returned items' value only) |

State machine guards (also see [STATE_MACHINES.md §10](../business/STATE_MACHINES.md)):
- `INSPECTING → COMPLETED/REFUNDED` is rejected with `items.INSPECTION_INCOMPLETE` if any `ReturnItem` is missing an inspection result.
- `RECEIVED|INSPECTING → REFUNDED` is allowed for both full- and partial-coverage RMAs. Full coverage (`isFullReturnCoverage = true`) → `refundAmount` must **equal** `orderRefundableAmount` and `RefundService.applyRefund` refunds the whole order. Partial coverage → `0 < refundAmount ≤ orderRefundableAmount` and `RefundService.applyReturnPartialRefund` refunds only the returned items' value, leaving the order `PAID`/`COMPLETED` until cumulative refund reaches the paid amount.
- `restoreStockForReturn` skips items with `inspection_result = 'FAIL'` so customer-damaged goods don't re-enter inventory. On the **full-coverage** REFUNDED path it is not invoked — `RefundService.applyRefund` restores stock & serials at order level. On the **partial-coverage** REFUNDED path it IS invoked (RMA-level) so only the returned PASS items are restored.

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

### PDP — descriptionBlocks(En) / specifications.featured / tabs (V229–V231)

Trang chi tiết sản phẩm (public `GET /api/v1/products/{slug}` + admin upsert) port bố cục mockup.

**Public product detail** (`GET /api/v1/products/{slug}?lang=`):
- `descriptionBlocks` — đã có (V139), nay **localize theo `lang`** (en → khối tiếng Anh, fallback vi). Detail-only.
- ~~`specifications[].featured: boolean`~~ — **GỠ BỎ ở V235**, thay bằng `specStats` (xem §"Product spec-stat boxes — `specStats` (V235)").
- `tabs: ProductTab[] | null` — cấu hình tab PDP, **detail-only**, `null` = web dùng tab mặc định. Mỗi
  `ProductTab`: `{ id, type, enabled, sortOrder, label, blocks }` đã resolve theo `lang` (public bỏ raw
  English). `type` ∈ `description|reviews|specs|installation|faq|custom`; `custom` mới có `blocks`.
- `sectionVisibility: string | null` (V245) — "Hiển thị trên web", **detail-only**, opaque JSON string
  `{sectionKey: boolean}`. Chỉ quản **5 section dạng tab**: `description, specifications, faqs, videos, reviews`.
  `null` = chưa cấu hình → web hiện theo nội dung (legacy); `key=false` ẩn, `key=true` hiện-nếu-có-nội-dung.
  Khối ngoài tab không nằm trong map (web tự hiện khi có nội dung). Web parse + gate (`PRODUCT_RULE_006`).

**Admin upsert** (`POST /api/v1/admin/products`, `PATCH /api/v1/admin/products/{id}`) — presence-flag:
- `descriptionBlocksEn: DescriptionBlock[]` (≤200) — khối mô tả tiếng Anh; gửi key (kể cả []) thì render →
  `description_en` + overwrite, bỏ key thì giữ nguyên. Admin read trả lại tại `translations.en.descriptionBlocks`.
- ~~`specifications[].featured: boolean`~~ — **GỠ BỎ ở V235**, thay bằng `specStats` (full-replace, ≤4 ô).
- `tabs: ProductTabRequest[]` (≤30) — cấu hình tab; mỗi tab `{ id, type, enabled, sortOrder, label, labelEn,
  blocks, blocksEn }`. Gửi key (kể cả []/null) thay/clear; bỏ key thì giữ nguyên. `[]`/null = reset về mặc định.
  Lưu ý (V245): ẩn/hiện 5 section dạng tab đã chuyển sang `sectionVisibility`; admin form không còn gửi `enabled`
  như công tắc hiển thị (luôn `true`), tab editor chỉ đổi thứ tự + đổi tên.
- `sectionVisibility: string` (V245, ≤4000) — opaque JSON string `{sectionKey: boolean}` cho **5 section dạng
  tab** (`description, specifications, faqs, videos, reviews`). Presence-flag: gửi key thay cấu hình; bỏ key giữ
  nguyên; null/blank xoá (về legacy). Admin luôn gửi map đầy đủ 5 khoá (đông cứng trạng thái). SP mới = tắt hết
  (opt-in). Map cũ chứa khoá ngoài-tab hoặc `_order` được bỏ qua an toàn. Xem `DATA_CONTRACT.md` §V245 +
  `PRODUCT_RULE_006`.

Status: `CONFIRMED_FROM_CODE` — `CatalogController` (public detail), `AdminCatalogController` (upsert/preview),
`UpsertProductRequest` (`descriptionBlocksEn`/`tabs`), `Product`/`ProductTab`/`ProductSpecification`
domain records. Spec `featured` đã gỡ ở V235 (xem §"`specStats` (V235)"). Xem [DATA_CONTRACT.md](DATA_CONTRACT.md) §"PDP mockup port (V229–V231)".
