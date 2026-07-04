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
| `GET` | `/api/v1/address/provinces` | List provinces (34 tỉnh/thành, post-2025-reform) | `ApiDataResponse<List<VnAddressItem>>` | `CONFIRMED_FROM_CODE` | `VnAddressController.java` |
| `GET` | `/api/v1/address/provinces/{provinceCode}/wards` | List wards (phường/xã) directly by province code — no district tier | `ApiDataResponse<List<VnAddressItem>>` | `CONFIRMED_FROM_CODE` | `VnAddressController.java` |
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
| `GET` | `/api/v1/customer/orders` | List own orders. Each item includes `channel` — now always `"WEB"` (POS / `"IN_STORE"` removed 2026-06-23, online-only). | `ApiListResponse<OrderListItemResponse>` | `CONFIRMED_FROM_CODE` | `CustomerOrderController.java` |
| `GET` | `/api/v1/customer/orders/{orderId}` | Get own order detail. Response includes `channel` — now always `"WEB"` (POS / `"IN_STORE"` removed 2026-06-23, online-only). | `ApiDataResponse<OrderDetailResponse>` | `CONFIRMED_FROM_CODE` | `CustomerOrderController.java` |
| `PATCH` | `/api/v1/customer/orders/{orderId}/cancel` | Customer cancels own order. Allowed only when `paymentStatus = UNPAID` **and** order is `PENDING` / `ON_HOLD` / (`PROCESSING` with fulfillment not yet `SHIPPED`/`DELIVERED`) — see `CustomerOrderCancelService.isCustomerCancellable`. Sets `CANCELLED` (+ fulfillment `CANCELLED` for DELIVERY), restores stock, revalidates product pages. Once `PAID`, returns `409` — the customer must contact the shop, who cancels the paid order directly. | `ApiDataResponse<OrderDetailResponse>` | `CONFIRMED_FROM_CODE` | `CustomerOrderController.java`, `CustomerOrderCancelService.java` |

> **Removed (2026-06-23).** The Return (RMA) and Refund feature was deleted platform-wide — the customer return endpoints (`/orders/returns`, `/orders/returns/{returnId}`, `/orders/{orderId}/returns`, `/orders/{orderId}/return-eligibility`), the admin returns/inspection endpoints, and every refund endpoint no longer exist. Customer-facing return/exchange policy text is kept as a manual commitment, not an API.
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
- `reviews` — `[{ id, authorName, rating, comment, photos, createdAt }]`, filtered + sorted per params. `photos` is an array of MinIO media URLs (`/media/reviews/...`, possibly empty) — customer-uploaded photos for that review, surfacing only for `APPROVED` reviews (moderated together with the review).
- `pagination` — `{ page, pageSize, totalItems, totalPages, hasNext, hasPrevious }`. `totalItems`/`totalPages`/`hasNext` follow the **filtered** list (so "load more" pages correctly within one star bucket); when `rating` is absent these equal the global approved count.

Out-of-range `page`/`size`/`rating` → `400 VALIDATION_ERROR`. Unknown `productId` → `404`.

### `POST /api/v1/products/{productId}/reviews`

Submits a review (`status = PENDING`, awaits admin moderation). Honeypot `website` field → accept-and-drop silently. Duplicate guard: same `productId` + normalized author + normalized body within 24h → `409`. See `SubmitReviewRequest`.

Body fields: `authorName` (required, ≤80), `rating` (required, 1..5), `comment` (optional, ≤1000), `website` (honeypot), plus `photos` (optional, `string[]`, ≤10). Each `photos[]` entry **must** be an internal MinIO media URL (`/media/...`) — external/hotlink URLs are rejected `400 VALIDATION_ERROR` (`photos/INVALID`); more than 10 entries → `photos/TOO_MANY`. Reuses `SafeMediaAssetUrlPolicy.validateImageUrlOrThrow`.

### `POST /api/v1/products/{productId}/reviews/photos`

Public, no auth. `multipart/form-data` with a single `file` part — uploads one customer review photo to MinIO and returns its URL so the submit body can reference it. Rate-limited per IP (`REVIEW_PHOTO` tier). Response `data`: `{ url }` (e.g. `/media/reviews/{uuid}/{filename}`).

Validation: image only — declared + Apache Tika magic-byte must be `image/jpeg`, `image/png`, or `image/webp` (no SVG/GIF/video). Max **8 MB** per file. Unknown `productId` → `404`; wrong type / oversize / empty → `400 VALIDATION_ERROR`. Photos are stored directly under the `reviews/` prefix and are **not** registered in the admin media library (`media` table). Evidence: `PublicReviewController.uploadPhoto`, `ReviewPhotoStorageService`.

## Content Categories Contract

`GET /api/v1/content-categories` — public, no auth. Powers the Tin tức (news) category filter, including the mobile category drawer.

No query params. Response shape: `ApiListResponse<ContentCategoryWithCount>`:
- `id`, `slug`, `name` — the content category.
- `articleCount` — number of `PUBLISHED` articles in that category.

**Counting semantics:** an article counts toward a category when that category is its primary `category` **or** appears in its many-to-many `categories` list — the same membership rule as the `category` filter of `GET /api/v1/articles`. Every content category is returned (including `articleCount = 0`), ordered by `name`. Status: `CONFIRMED_FROM_CODE` — `ContentController.listContentCategories`, `ContentReadService.listContentCategories`.

**Admin reference list** (`content.read`): `GET /api/v1/admin/content/reference/categories` → `ApiListResponse<ContentCategoryItem>` (`{ id, slug, name }`), ordered by `name`. Feeds the article editor's category picker so an article can be assigned to existing categories. Status: `ORPHAN` — *(Note: After V275, this endpoint is orphan/unused because the category picker has been removed from the admin form; all articles are automatically mapped to the default 'tin-tuc' category).* `AdminContentController.listCategories`, `AdminContentReferenceService.listCategories`, `adminApi.fetchContentCategories`.

**No admin CRUD.** There is no create/update/delete endpoint for content categories — the admin "Quản lý danh mục bài viết" screen was removed (the inventory of categories is fixed/seed-managed). Articles can only be assigned to categories that already exist; the public list and the article-editor picker both read from the same `content_categories` table.

## Static CMS Pages + Guide Page — REMOVED (2026-06-24)

> **REMOVED (2026-06-24).** Module "Trang tĩnh CMS" (pages) và module Guide Page Builder đã bị gỡ khỏi toàn stack. 10 trang thông tin — Giới thiệu (`/gioi-thieu`), Liên hệ (`/lien-he`), Hướng dẫn (`/huong-dan` + 3 trang con `/huong-dan/{mua-hang|size-mu|size-gang-tay}`), và 4 trang chính sách (`/chinh-sach/{slug}`) — nay **đóng cứng (hardcode) trong `bigbike-web`** (nguồn freeze: `bigbike-web/lib/content/static-pages.json` + `static-pages.ts`, render qua route giữ nguyên URL gồm cả catch-all `/[slug]`). Web **không** còn gọi backend cho các trang này.
>
> **Endpoint đã gỡ:**
> - Public `GET /api/v1/pages`, `GET /api/v1/pages/{slug}` — không còn.
> - Public `GET /api/v1/guide-page` — không còn.
> - Toàn bộ admin CRUD pages (`POST`/`PATCH`/`DELETE /api/v1/admin/content/pages`, type `PAGE` trong `GET /api/v1/admin/content`) + reference `GET /api/v1/admin/content/reference/pages` — không còn.
> - Admin guide-page `GET`/`PUT /api/v1/admin/guide-page` — không còn.
>
> Bảng `pages` + `guide_page_layout` đã drop ở `V271__drop_pages_and_guide_page.sql`. Module Nội dung admin nay **chỉ còn quản lý bài viết (Tin tức)** — xem "Article Content Contract" bên dưới. Sidebar trang chính sách `/chinh-sach` vẫn lấy danh mục từ menu location `policy` (`GET /api/v1/menus/policy`), nhưng thân bài từng trang nay là nội dung tĩnh ở web (không còn `GET /api/v1/pages/{slug}`).

## Article Content Contract

`GET /api/v1/articles/{slug}` — public, no auth. Returns `ApiDataResponse<Article>` for one
`PUBLISHED` article. Served by `ContentController.getArticleBySlug`.

### Article list — `GET /api/v1/articles` query param `featured` (V222)

`GET /api/v1/articles` — public, no auth. Accepts an optional boolean query param `featured`:

- `featured=true` → returns **only** featured articles (used by the storefront "Tin nổi bật" widget).
- `featured=false` or param omitted → no featured filtering (default list behaviour, unchanged).

Other existing list params (e.g. `category`, `q`, paging) are unaffected.

Status: `CONFIRMED_FROM_CODE` — `ContentController.listArticles` (`featured` query param).

### Article list — `GET /api/v1/articles` query param `homeExperience` (V272)

`GET /api/v1/articles` — public, no auth. Accepts an optional boolean query param `homeExperience`:

- `homeExperience=true` → returns **only** articles admin đã chọn vào carousel "Góc trải nghiệm cùng BigBike" trên trang chủ.
- `homeExperience=false` or param omitted → no filtering (default list behaviour, unchanged).

Combinable với các param khác (`category`, `featured`, `q`, paging). **Storefront fallback:** trang chủ gọi `?homeExperience=true&size=3`; nếu rỗng (admin chưa chọn bài nào) thì fall back về `?size=3&sort=publishedAt:desc` — 3 bài viết mới nhất (sau V275 chỉ còn 1 nhóm "Tin tức"). Logic fallback nằm ở web (`app/page.tsx`), không ở backend.

Status: `CONFIRMED_FROM_CODE` — `ContentController.listArticles` (`homeExperience` query param), `ArticleJpaRepository.findPublishedArticleIds`.

### Article payload — `featured` + `seo.noIndex` (V222)

Both the public `Article` shape (`GET /api/v1/articles`, `GET /api/v1/articles/{slug}`) and admin `AdminContentItem` now carry:

- `featured` — top-level boolean. `true` = bài viết được đánh dấu nổi bật.
- `homeExperience` — top-level boolean (V272). `true` = bài được chọn vào carousel "Góc trải nghiệm" trang chủ.
- `seo.noIndex` — boolean inside the `seo` object. `true` = trang đặt `noindex` (không cho search engine index bài này). The `seo` object may be `null` when no SEO field is set → treat `noIndex` as `false`.

**Admin upsert** (`POST` / `PATCH /api/v1/admin/content/articles`) accepts cả:

- top-level `featured` (boolean) — via `UpsertArticleRequest.featured`.
- top-level `homeExperience` (boolean, V272) — via `UpsertArticleRequest.homeExperience`.
- `seo.noIndex` (boolean) — via `SeoMetaRequest.noIndex`.

On update (`PATCH`), `null` cho bất kỳ field nào = giữ nguyên giá trị hiện có (presence-flag pattern).

Status: `CONFIRMED_FROM_CODE` — `ContentController.listArticles`, `UpsertArticleRequest.featured`, `UpsertArticleRequest.homeExperience`, `SeoMetaRequest.noIndex`, migration `V222__add_article_featured_and_seo_no_index.sql`, `V272__add_article_home_experience.sql`. Xem [DATA_CONTRACT.md](DATA_CONTRACT.md) §"Article featured + seo_no_index (V222)" và §"Article home_experience (V272)".

### Admin content list — sort params

`GET /api/v1/admin/content` accepts an optional `sort` param in `field:direction` format (default `updatedAt:desc`). The allowed sort fields are whitelisted by `AdminContentReadService.CONTENT_SORT_FIELDS`:

| Field | Notes |
|---|---|
| `title` | Case-insensitive. |
| `createdAt` / `updatedAt` / `publishedAt` | Timestamps; `publishedAt` falls back to `createdAt` when null. |
| `type` | `ARTICLE` only (pages module gỡ 2026-06-24). DB-paginated path falls back to `updatedAt` (not a DB column). |
| `publishStatus` | Sort theo trạng thái xuất bản (gom nhóm bản nháp/đã đăng khi triage nội dung). |

An unsupported field returns `400 UNSUPPORTED_SORT_FIELD` (not a silent fallback) via `SortParser`. The admin content list screen exposes column sort on `title`, `publishStatus`, and `updatedAt`.

Status: `CONFIRMED_FROM_CODE` — `AdminContentReadService.CONTENT_SORT_FIELDS` + `contentComparator`, `SortParser.parse`.

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

Admin detail reads (`AdminContentItem`) của Article bao gồm `bodyBlocks: DescriptionBlock[] | null`. `null` = chưa có blocks; `[]` = body bị xoá rỗng. **Public read** (`GET /api/v1/articles/{slug}`) **không** trả `bodyBlocks` — web và mobile tiếp tục đọc `body` HTML như cũ. (Page body blocks không còn — module pages đã gỡ 2026-06-24.)

**Upsert mutation:**
- Gửi key `bodyBlocks: [...]` trong `UpsertArticleRequest` → server render HTML từ blocks, ghi đè cả `body_blocks` lẫn `body`.
- Bỏ key `bodyBlocks` hoàn toàn → `body` được patch bình thường; `body_blocks` không bị đụng (presence-flag pattern, giống `products.descriptionBlocks`).
- **Tạo mới (`POST`):** nội dung là bắt buộc — chấp nhận **hoặc** `body` **hoặc** `bodyBlocks` non-empty. Gửi `bodyBlocks` mà bỏ `body` vẫn hợp lệ (server tự render `body` từ blocks); chỉ báo lỗi `body REQUIRED` khi thiếu cả hai.

Status: `CONFIRMED_FROM_CODE` — `UpsertArticleRequest.bodyBlocksPresent`, `AdminContentMutationService`, `AdminContentItem.bodyBlocks`. Xem [DATA_CONTRACT.md](DATA_CONTRACT.md) §"Article body blocks (V140)".

### Article EN translations on admin read — `translations` (V138)

Admin detail reads (`AdminContentItem`) của Article bao gồm `translations: { en: {...} } | null` — bản dịch tiếng Anh để form admin nạp lại tab EN. `null` trên list reads; non-null trên detail reads (`GET /api/v1/admin/content/{type}/{id}`). Shape `en`: `title`, `excerpt`, `body`, `seoTitle`, `seoDescription`. **Public read không đổi** (đọc cột canonical + fallback VI, không trả khối `translations`). (Page translations không còn — module pages đã gỡ 2026-06-24.)

Status: `CONFIRMED_FROM_CODE` — `AdminContentItem.translations` (kiểu `ArticleTranslations`, serialize thẳng `{ en: {...} }`), `AdminContentReadService.fromArticle`, `ContentFieldApplier.toAdminContentItem`. Xem [DATA_CONTRACT.md](DATA_CONTRACT.md) §"Article bilingual content (V138)".

### Bilingual content — nhập tay, không còn tự động dịch (V312)

Từ 2026-07-03, tính năng tự động dịch VI→EN (Google Gemini) đã bị **gỡ bỏ hoàn toàn**: không còn
endpoint `POST /api/v1/admin/translate` hay `POST /api/v1/admin/translate/backfill`, không còn cơ chế
khoá `enOverrides`/`enLocked` (cột `en_overrides`/`en_locked` đã drop khỏi DB — V312). Admin **tự nhập**
tiếng Anh qua `translations.en.*` (Product/Category/Brand/Article) hoặc `valueEn` (site settings), đổi
qua nút VI/EN (`contentLang`) trên form — không đổi hình dạng payload upsert, chỉ bỏ field
`enOverrides`/`enLocked`.

**Validate EN bắt buộc (mới):** tiếng Anh chỉ bắt buộc khi trường tiếng Việt tương ứng đang bắt buộc —
`UpsertProductRequest.translations.en.name`, `UpsertCategoryRequest.translations.en.name`,
`UpsertBrandRequest.translations.en.name`, `UpsertArticleRequest.translations.en.title` bắt buộc
non-blank (áp dụng cho cả tạo mới lẫn sửa bản ghi cũ, kể cả bản ghi cũ đang thiếu EN ở field này).
Thiếu → `400 VALIDATION_ERROR` (field `translations.en.name`/`translations.en.title`, code `REQUIRED`).
Các field/khối còn lại (mô tả, specifications, faqs, slug, body/bodyBlocks…) vẫn tùy chọn ở EN — không
chặn lưu khi trống. `UpdateSiteSettingRequest.valueEn` / `BatchUpdateSettingsRequest.BatchSettingUpdate.valueEn`
bắt buộc khi setting vừa translatable vừa `.required()` ở VI (hiện chỉ `site_name`) — thiếu → `400
VALIDATION_ERROR` (field `valueEn`, code `REQUIRED`).

Status: `CONFIRMED_FROM_CODE`. Xem [BUSINESS_RULES.md](../business/BUSINESS_RULES.md) §"Bilingual /
Auto-translation Rules" (`TRANSLATION_RULE_001/002`) + §"Site Settings Rules" (`SETTINGS_RULE_001`),
[DATA_CONTRACT.md](DATA_CONTRACT.md) §"Product bilingual content — English columns (V136)".

**Báo cáo record thiếu EN bắt buộc (V312):** `GET /api/v1/admin/translations/missing-required` — quyền
bất kỳ trong `products.read` / `catalog.read` / `content.read` / `settings.read`. Liệt kê record đang
**còn hoạt động** (bỏ qua Thùng rác/ẩn) thiếu tiếng Anh ở field bắt buộc: sản phẩm/danh mục/thương hiệu
thiếu `nameEn`, bài viết thiếu `titleEn`, và các setting key vừa translatable vừa `.required()` (hiện
chỉ `site_name`) thiếu `valueEn`. Trả `MissingRequiredEnglishResponse { products, categories, brands,
articles: Item[] (id, slug, name), settingKeys: string[] }`. Dùng để admin chủ động biết cần bổ sung gì
trước khi bị chặn lưu — không tự sửa dữ liệu. Status: `CONFIRMED_FROM_CODE` —
`AdminTranslationCompletenessController`, `TranslationCompletenessService`.

## Administrative Deletion and Restore Contract (Trash Flow)

Các endpoint dưới đây được sử dụng để quản lý trạng thái Xóa mềm (Trash), Khôi phục (Restore) và Xóa vĩnh viễn (Permanent Delete) của 5 module Nhóm A.

### 1. Products (Sản phẩm)
- **Xóa mềm**: `DELETE /api/v1/admin/products/{id}`
  - Đưa sản phẩm vào Thùng rác bằng cách đặt `publishStatus = PublishStatus.TRASH`.
- **Khôi phục**: `POST /api/v1/admin/products/{id}/restore`
  - Đặt `publishStatus = PublishStatus.DRAFT`.
- **Xóa vĩnh viễn**: `DELETE /api/v1/admin/products/{id}/permanent`
  - Chặn lại bằng lỗi `409 Conflict` nếu trạng thái hiện tại khác `TRASH`.
  - Thực hiện xóa cứng sản phẩm khỏi DB, tự động xóa liên đới các bảng liên quan (variants, specifications, v.v.) và xóa tham chiếu khỏi `home_category_highlights`, `wishlist_items`.

### 2. Categories (Danh mục)
- **Xóa mềm**: `DELETE /api/v1/admin/categories/{id}`
  - Đặt `deleted = true` trên danh mục mục tiêu và toàn bộ cây con của nó. Không chuyển sản phẩm.
- **Khôi phục**: `POST /api/v1/admin/categories/{id}/restore`
  - Đặt `deleted = false` trên danh mục mục tiêu và toàn bộ cây con của nó.
- **Xóa vĩnh viễn**: `DELETE /api/v1/admin/categories/{id}/permanent`
  - Chặn lại bằng lỗi `409 Conflict` nếu danh mục chưa được xóa mềm (`deleted == false`).
  - Tự động chuyển toàn bộ sản phẩm trong cây con sang danh mục hệ thống "Chưa phân loại" (`uncategorized`).
  - Thực hiện xóa cứng danh mục và toàn bộ cây con.
  - Chặn (409) mọi thao tác xóa (mềm/cứng) đối với danh mục hệ thống `uncategorized`.

### 3. Brands (Thương hiệu)
- **Xóa mềm (Ẩn)**: `DELETE /api/v1/admin/brands/{id}`
  - Đặt `isVisible = false`.
- **Khôi phục**: `POST /api/v1/admin/brands/{id}/restore`
  - Đặt `isVisible = true`.
- **Xóa vĩnh viễn**: `DELETE /api/v1/admin/brands/{id}/permanent`
  - Chặn lại bằng lỗi `409 Conflict` nếu thương hiệu chưa được ẩn/xóa mềm (`isVisible == true`).
  - Tự động chuyển toàn bộ sản phẩm đang gắn thương hiệu này sang thương hiệu hệ thống "Chưa phân loại" (`uncategorized-brand`).
  - Thực hiện xóa cứng thương hiệu khỏi DB.
  - Response: `200 OK` với `{ data: { reassignedProductCount: number } }` (thay vì `204 No Content`) — số sản phẩm vừa được chuyển, để admin hiển thị thông báo.
  - Chặn (409) mọi thao tác sửa/xóa/khôi phục đối với thương hiệu hệ thống `uncategorized-brand`; thương hiệu này luôn ẩn (`isVisible = false`) và bị loại khỏi kết quả `GET /admin/brands`.
  - `GET /admin/brands` khi không truyền query param `visibility` (danh sách mặc định) chỉ trả về thương hiệu `isVisible = true` — thương hiệu đã Ẩn/Xóa mềm (`isVisible = false`) bị loại trừ, mirror hành vi mặc định của Category (`deleted = false`) và Product (`publishStatus != TRASH`). Truyền `visibility=VISIBLE` cho kết quả tương đương; `visibility=HIDDEN` trả đúng các thương hiệu `isVisible = false` (view "Thùng rác").

### 4. News Articles (Bài viết / Tin tức)
- **Xóa mềm**: `DELETE /api/v1/admin/content/articles/{id}` (chuyển qua `DELETE /api/v1/admin/content/{type}/{id}`)
  - Đặt `publishStatus = PublishStatus.TRASH`.
- **Khôi phục**: `POST /api/v1/admin/content/articles/{id}/restore`
  - Đặt `publishStatus = PublishStatus.DRAFT`.
- **Xóa vĩnh viễn**: `DELETE /api/v1/admin/content/articles/{id}/permanent`
  - Chặn lại bằng lỗi `409 Conflict` nếu trạng thái hiện tại khác `TRASH`.
  - Thực hiện xóa cứng bài viết khỏi DB.

### 5. Thư viện ảnh (Media)
- **Xóa mềm**: `DELETE /api/v1/admin/media/{id}`
  - Đặt `status = "DELETED"`.
- **Khôi phục**: `POST /api/v1/admin/media/{id}/restore`
  - Đặt `status = "ACTIVE"`.
- **Xóa vĩnh viễn**: `DELETE /api/v1/admin/media/{id}?permanent=true`
  - Chặn lại bằng lỗi `409 Conflict` nếu trạng thái hiện tại khác `DELETED`.
  - Chặn lại bằng lỗi `409 Conflict` nếu ảnh đang được dùng.
  - Thực hiện xóa cứng khỏi DB và xóa tệp khỏi MinIO.

## Commerce Mutation Contracts

| Endpoint | Current contract | Status | Evidence |
|---|---|---|---|
| `POST /api/v1/checkout` | Revalidates price/availability state and creates order/payment rows. Availability is gated per-variant by `isAvailable` (boolean); there is **no quantity decrement** (V261). No shipping-method choice and **no shipping fee** (`shippingAmount = 0`, owner decision 2026-06-23, `SHIP_RULE_001`). | `CONFIRMED_FROM_CODE` | `CheckoutService.java`, checkout tests |
| `POST /api/v1/orders/quick-buy` | Creates order directly from one product/variant request. | `CONFIRMED_FROM_CODE` | `CheckoutService.quickBuy` |

> **Removed (2026-06-23, online-only).** `POST /api/v1/admin/pos/orders` (immediate in-store sale) and `GET /api/v1/admin/pos/products/search` (POS product search) were deleted along with the POS module. See "POS Contract" below.

## Checkout Options Contract

`GET /api/v1/checkout/options` — no auth required; accessible to guests and authenticated customers.

Response shape: `ApiDataResponse<CheckoutOptionsResponse>`:
- `paymentMethods`: `[{ code, title }]` — `COD` ("Thanh toán khi nhận hàng (COD)"), `BACS` ("Chuyển khoản"). **Codes are uppercase strings; `title` is the customer-facing label.** Still returned for backward-compatible callers, but the web checkout and quick-buy UIs **no longer render a payment-method choice** (owner decision 2026-06-23) — see `PAY_RULE_001`. The `POST /checkout` and `POST /orders/quick-buy` request field `paymentMethod` is now **optional**; when omitted the order is stored with `paymentMethod = null` and created in `PROCESSING`. An explicit value, if sent, must still be `COD` or `BACS`. There is no automatic payment gateway.
- `shippingMethods`: **REMOVED (owner decision 2026-06-23)** — see `SHIP_RULE_001`. The shipping-method management module was dropped (migration `V264`); online orders no longer choose a shipping method and carry **no shipping fee** (`shippingAmount = 0`). The response no longer includes a `shippingMethods` array, and the `POST /checkout` / `POST /orders/quick-buy` request field `shippingMethodId` was **removed** (ignored if sent by an old client). The shop arranges/charges delivery offline (COD).

Status: `CONFIRMED_FROM_CODE` | Evidence: `CheckoutService.getOptions`, `CheckoutOptionsResponse.java`, `CheckoutController.java`, `V264__remove_shipping_methods.sql`

## Dashboard Contract

| Endpoint | Permission | Current behavior | Status | Evidence |
|---|---|---|---|---|
| `GET /api/v1/admin/dashboard?period={7d\|30d\|90d}` | `orders.read`; accessible to `ADMIN`, `SUPER_ADMIN`, `SHOP_MANAGER` | Returns KPI aggregates, revenue series, order-status breakdown, recent orders, top products. Revenue excludes `CANCELLED`, `FAILED` orders. Default period: `30d`. | `CONFIRMED_FROM_CODE` | `AdminDashboardController.java`, `AdminDashboardService.java` |

Response shape: `ApiDataResponse<AdminDashboardSummaryResponse>`:
- `kpi`: `{ todayRevenue, todayPaidRevenue, todayRevenuePct, todayOrders, todayOrdersDelta, pendingOrders, activeProducts }`
- `revenueData`: `[{ date (ISO yyyy-MM-dd), revenue, orders }]` — one entry per day in the period, VN timezone
- `orderStatusBreakdown`: `[{ status, count }]` — period-scoped, all statuses with count > 0
- `recentOrders`: last 5 orders `[{ id, orderNumber, customerName, customerEmail, total, orderStatus, currency, placedAt }]`
- `topProducts`: top 5 by line-item revenue `[{ productId (product_pk varchar), name, revenue, units }]`

Status: `CONFIRMED_FROM_CODE`

## Reports & Analytics Contract

| Endpoint | Permission | Current behavior | Status | Evidence |
|---|---|---|---|---|
| `GET /api/v1/admin/reports/analytics?from=YYYY-MM-DD&to=YYYY-MM-DD` | `reports.read` | Returns PeriodSummary, daily revenue series, top products, and top customers. | `CONFIRMED_FROM_CODE` | `AdminReportController.java`, `AdminReportService.java` |
| `GET /api/v1/admin/reports/orders/export?status=...&paymentStatus=...&from=...&to=...` | `reports.export` | Exports orders matching filters to a UTF-8 BOM CSV file. | `CONFIRMED_FROM_CODE` | `AdminReportController.java`, `AdminReportService.java` |
| `GET /api/v1/admin/reports/customers/export?status=...` | `reports.export` | Exports customers matching filters to a UTF-8 BOM CSV file. | `CONFIRMED_FROM_CODE` | `AdminReportController.java`, `AdminReportService.java` |
| `GET /api/v1/admin/reports/products/export?publishStatus=...` | `reports.export` | Exports products matching filters to a UTF-8 BOM CSV file. | `CONFIRMED_FROM_CODE` | `AdminReportController.java`, `AdminReportService.java` |

### Analytics Response Shape
Returns `AdminAnalyticsResponse`. The `PeriodSummary` object inside `summary` contains:
- `grossOrderValue`: GMV: SUM(totalAmount) excl CANCELLED/FAILED.
- `paidRevenue`: SUM(paidAmount) where paymentStatus = PAID, excl CANCELLED orders.
- `orderCount`: count of orders excl CANCELLED/FAILED.
- `avgOrderValue`: grossOrderValue / orderCount (or 0 if orderCount = 0).
*(Note: `refundAmount` and `netRevenue` metrics were removed on 2026-07-04 as the refund feature is retired).*

### Order Export Format
The CSV file generated by `/api/v1/admin/reports/orders/export` contains the following headers in order:
- `order_number`, `status`, `payment_status`, `customer_email`, `customer_phone`, `currency`, `subtotal`, `shipping`, `total`, `paid_amount`, `placed_at`, `paid_at`, `completed_at`, `cancelled_at`
*(Note: the `"discount"` column was removed on 2026-07-04 as promotion codes/discounts are retired).*

### Customer Export Format
The CSV file generated by `/api/v1/admin/reports/customers/export` contains the following headers in order:
- `id`, `email`, `phone`, `display_name`, `first_name`, `last_name`, `status`, `gender`, `email_verified_at`, `last_login_at`, `created_at`

### Product Export Format
The CSV file generated by `/api/v1/admin/reports/products/export` contains the following headers in order:
- `id`, `sku`, `slug`, `name`, `category`, `brand`, `retail_price`, `sale_price`, `currency`, `stock_state`, `publish_status`, `homepage_block`, `created_at`

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

### Product list — category filter includes descendant categories (2026-07-03)

`GET /api/v1/admin/products` (`categoryId` param) and `GET /api/v1/products` (category slug in the path/`category` param) both scope results to the requested category **and every category nested under it**, not just products assigned directly to that exact category (`BUSINESS_RULES.md` → `CATEGORY_RULE_006`). A leaf category (no children) behaves exactly as before — only its direct products.

Resolution happens per-request: the full category set (~35 rows) is loaded and walked via BFS from the requested category id/slug to collect self + descendant ids, then the product query filters by `category.id IN (...)` instead of an exact match. An invalid/unresolvable category slug on the public endpoint still yields zero results (was: no match on the raw slug predicate; now: an always-false predicate after slug resolution fails) — no change in observable behaviour for that case.

Status: `CONFIRMED_FROM_CODE` — `JpaCatalogReadRepository.resolveCategoryIdWithDescendants` / `resolveCategorySlugWithDescendants`, called from `findProductsFiltered` (admin) and `findPublishedProductsPaged` (public) before building the respective `Specification`.

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
| **Note (V261):** `stockQuantity` is **always `null`** on the public API (product & variant) — availability is boolean. The storefront shows only "Còn hàng / Hết hàng" from `stockState`; the old "Chỉ còn N sản phẩm" low-stock message was removed. | | |
| `description`, `contentBottom`, `promotionContent`, `installationGuide`, `suitabilityAdvisory` | ❌ `null` | ✅ present |
| `originBrandCountry`, `sizeGuide`, `specificationsHtml` | ❌ `null` | ✅ present |
| `gallery`, `videos`, `specifications`, `specStats`, `faqs`, `commitments`, `positiveNotes`, `negativeNotes` | ❌ `[]` | ✅ present |
| `videos[].description` | — | ✅ present (detail) |
| `seo` | ❌ `null` | ✅ present |
| `variants` | ✅ present as **stubs** | ✅ full |
| `variants[].id/sku/name/price/stockState/stockQuantity/isAvailable` | ✅ present | ✅ present |
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
| `POST /attributes` | `{ name, nameEn? }` | `{ data: AttributeSummaryResponse }` | Creates a brand-new attribute type (e.g. "Chất liệu"). `code` (the immutable machine key) is auto-derived from `name` via the same diacritic-insensitive kebab-case rule as attribute values; `kind` is always `"select"`, `is_variation` always `true`. A name whose derived code collides with an existing attribute → `409 CONFLICT`; a name that yields an empty code → `400 VALIDATION_ERROR`. Requires `products.update`. |
| `PATCH /attributes/{id}` | `{ name }` | `{ data: AttributeSummaryResponse }` | Renames an attribute's display name. **Only `name` changes; `code` is immutable** (variant options resolve to their attribute via the code). Requires `products.update`. |
| `DELETE /attributes/{id}` | — | `204 No Content` | Deletes an attribute type. **Blocked with `409 CONFLICT`** when any `product_variant_options` row still resolves to it (see `ATTRIBUTE_RULE_001`). Deleting an unused attribute cascades its (also-unused) values at the DB level (`fk_attribute_values_attribute_id ... on delete cascade`). Requires `products.update`. |
| `POST /attributes/{attributeId}/values` | `{ label, slug? }` | `{ data: AttributeValueResponse }` | Adds a new value. `slug` defaults to a diacritic-insensitive kebab-case form of `label` (same rule as product slugs, matching storefront colour-filter keys). Duplicate slug within the same attribute → `409 CONFLICT`; a label that yields an empty slug → `400 VALIDATION_ERROR`. Requires `products.update`. |
| `PATCH /attribute-values/{id}` | `{ label }` | `{ data: AttributeValueResponse }` | Renames an existing value. **Only `label` changes; `slug` is immutable** so variant options that reference it keep working (colour-scoped galleries and web filters key off the slug). Requires `products.update`. |
| `DELETE /attribute-values/{id}` | — | `204 No Content` | Deletes a single value (e.g. one colour). **Blocked with `409 CONFLICT`** when any `product_variant_options` row still resolves to it (`ATTRIBUTE_RULE_001`). Requires `products.update`. |

The two `GET` endpoints return bare arrays (legacy shape); the admin client (`fetchAttributes` / `fetchAttributeValues`) tolerates both bare arrays and `{data}`. The `POST`/`PATCH`/`DELETE` endpoints use the standard `ApiResponseFactory` envelope (`DELETE` returns an empty `204` body).

Status: `CONFIRMED_FROM_CODE`

Evidence: `AdminAttributeController.java` (`createAttribute`, `deleteAttribute`, `deleteAttributeValue`), `AdminAttributeService.java` (`createAttribute`, `deleteAttribute`, `deleteAttributeValue`), `ProductVariantOptionJpaRepository.java` (`countByAttribute_Id`, `countByAttributeValue_Id`), `CreateAttributeRequest.java`, `bigbike-admin/src/lib/adminApi.js` (`createAttribute`, `deleteAttribute`, `deleteAttributeValue`), `bigbike-admin/src/screens/product-detail/VariantEditors.jsx` (`CreateAttributeModal`, delete actions in `AttributeRenameModal` / `AttributeValueManagerModal`).

Evidence: `AdminAttributeController.java` (`listAttributes`, `listAttributeValues`, `updateAttribute`, `createAttributeValue`, `updateAttributeValue`), `AdminAttributeService.java` (`updateAttributeName` name-only, `createValue` slug derivation via `ProductSlugGenerator.toSlug` + dedup, `updateValueLabel` label-only), `adminApi.js` (`fetchAttributes`/`fetchAttributeValues` tolerant readers, `updateAttribute`, `createAttributeValue`/`updateAttributeValueLabel`), `ProductDetailScreen.jsx` (`AttributeRenameModal`, `AttributeValueManagerModal`).

### Variant color representation image (2026-07-03)

The variant color representation image (`variants[].image`) is chosen explicitly by the admin per color via a media picker, rather than being starred in the gallery.
- **Upsert request** (`POST` / `PATCH /api/v1/admin/products`): `VariantRequest` accepts `imageUrl` and `imageAlt` directly. The `cover` flag is removed from `GalleryImageRequest`.
- **Resolution** (`AdminCatalogMutationService.applyVariants`): For each color, the backend picks the first non-empty `imageUrl` among the variants with the same color, and applies it to all variants of that color. If no image URL is provided, the fields `image_url` and `image_alt` are set to `null` (allowing the web to fall back to `gallery[0]`).
- **No DB migration**: The data continues to be persisted in the existing columns on `product_variants` (e.g. `image_url`, `image_alt`).
- **Response**: `variants[].image` returns the resolved cover `ImageAsset`. The `isCover` flag on `variants[].gallery[]` items is removed.
- **Admin-side validation**: The separate representation image URL is validated client-side and is optional. No starring or gallery cover validation exists anymore.

Status: `CONFIRMED_FROM_CODE`
Evidence: `VariantRequest.java` (`imageUrl`/`imageAlt` fields), `AdminCatalogMutationService.applyVariants` (color-scoped application), `VariantGalleryRoundtripTest`.

### Variant display name — derived from attribute options (no separate input)

The variant display name (`variants[].name`) is **always derived server-side from the variant's attribute option values** (e.g. `"Đen bóng - XL"`), joined in option order and preferring each option's dictionary label over its raw value. It is **not** entered separately by admins.

- **Upsert request** (`POST` / `PATCH /api/v1/admin/products`): the request body **no longer accepts** `variants[].name`. The field was removed from `VariantRequest`. On save, the backend computes it from `variants[].options[]` after resolving each option's dictionary link — same precedence the read path uses to return the human label (`attributeValueId` resolution, see "Variant option — admin round-trip field" above).
- **Response**: `variants[].name` still returns the computed string; re-saving always recomputes it from the current options, so it can never drift out of sync with them.
- **Rationale**: a separately-typed name could diverge from the variant's actual attributes (stale after a color/size edit), which is exactly what motivated removing it — same pattern as the variant cover image below.

Status: `CONFIRMED_FROM_CODE`

Evidence: `VariantRequest.java` (no `name` field), `AdminCatalogMutationService.applyVariants` / `deriveVariantName`, `V297__derive_variant_name_from_options.sql` (legacy backfill).

### Product upsert — `stockState` is read-only

`POST /api/v1/admin/products` and `PATCH /api/v1/admin/products/{id}` do **not** accept `stockState` in the request body. The field mirrors the boolean availability and can only be mutated through the Inventory module availability endpoints (`/api/v1/admin/inventory/...`).

- On create: backend forces `stockState = OUT_OF_STOCK` (item starts unavailable) regardless of payload.
- On update: backend never reads `stockState` from the request.
- DTO `UpsertProductRequest` has no setter for the field; admin form does not render a picker.

Status: `CONFIRMED_BACKEND_ENFORCED`

Evidence: `UpsertProductRequest.java` (no `stockState` setter), `AdminCatalogMutationService.applyProductPatch` (`if (create) entity.setStockState(OUT_OF_STOCK)`).

### Inventory — availability toggle endpoints (V261)

Inventory availability is a **boolean** set by the admin. The former quantity-adjust endpoints `POST /api/v1/admin/inventory/variants/{id}/adjust` and `POST /api/v1/admin/inventory/products/{id}/adjust` (which took `quantityDelta`) are **REPLACED**:

| Endpoint | Body | Permission | Effect |
|---|---|---|---|
| `PATCH /api/v1/admin/inventory/variants/{variantId}/availability` | `{ available: boolean }` | `inventory.write` | Sets `product_variants.is_available`; the variant's `stockState` mirrors it. The product-level `stockState` re-aggregates from its variants. |
| `PATCH /api/v1/admin/inventory/products/{productId}/availability` | `{ available: boolean }` | `inventory.write` | For a no-variant product, sets `products.stock_state` (`IN_STOCK` / `OUT_OF_STOCK`) directly. |

Response shape changes:

- **Stock item / variant response** carries `available: boolean` instead of `quantityOnHand`.
- **Product group** carries `available` instead of `totalQuantity`.
- **Inventory summary** is `{ totalItems, inStockCount, outOfStockCount }` (the previous quantity-based counters are gone).

There is **no auto-decrement on sale and no restore on cancel** — selling does not change availability, so the admin must manually toggle an item to "Hết hàng" when it sells out (overselling is not auto-prevented).

Status: `CONFIRMED_FROM_CODE`

Evidence: `AdminInventoryController.java` (availability PATCH endpoints), `AdminInventoryService.java`, `V261__inventory_availability_toggle.sql`.

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

> **Lịch sử `quickAnswerSummary`:** field độc lập "Quick Answer" (không liên quan `suitabilityAdvisory`) từng có ở V236, bị gỡ hoàn toàn ở V253 (2026-06-20), và được **làm lại ở V300** (2026-07-02) — xem mục `quickAnswerSummary (V300)` ngay dưới đây.

`POST /api/v1/admin/products` and `PATCH /api/v1/admin/products/{id}` accept the bilingual field:

- **`suitabilityAdvisory`** — optional string carrying a **JSON array of advisory cards** (V240), max 20 000 chars (presence-flag). "Phù hợp với ai" block: each card = `{ audience, advice, linkLabel?, linkUrl? }` where `audience` is the bold target-rider lead-in, `advice` the recommendation sentence, and `linkLabel`/`linkUrl` an optional internal cross-sell link. The web parses the JSON and renders one card per item (no `sanitizeRichHtml`; non-JSON legacy values render nothing). `linkUrl` is shared across both languages; the EN array (`_en`) mirrors the cards by index with translated text. Was a free rich-HTML string before V240.

It is bilingual: the vi value goes to the canonical column, English to `_en`. On `PATCH`, sending no key leaves the field untouched; sending `null`/blank clears it. English is written via the `translations.en` object (`ProductContentRequest.suitabilityAdvisory`).

It is returned by `GET /api/v1/products/{slug}` (locale-resolved via `pick`, with vi fallback) and the admin product read (`GET /api/v1/admin/products/{id}` carries vi + raw English in `translations.en`). **Not** included in product *list* responses. It renders as its own PDP section; the section is hidden when the field is empty. The "Hoàn thiện bộ bảo hộ" block reuses `relatedProducts` — no new cross-sell field.

Status: `CONFIRMED_FROM_CODE`

Evidence: `UpsertProductRequest.java` (`suitabilityAdvisory` + presence flag), `ProductTranslationRequest.ProductContentRequest`, `AdminCatalogMutationService.applyProductPatch`/`applyTranslations`, `Product.java` + `ProductTranslations.java`, `JpaCatalogReadRepository` (detail mapper `pick`s it; list mapper passes `null`), `V237__add_product_suitability_advisory.sql`, `V240__convert_suitability_advisory_to_cards.sql`, `V253__drop_product_quick_answer_summary.sql`.

### Product PDP content — `quickAnswerSummary` (V300)

`POST /api/v1/admin/products` and `PATCH /api/v1/admin/products/{id}` accept the bilingual field:

- **`quickAnswerSummary`** — optional string, max 600 chars (presence-flag). "Quick Answer" block: a plain-text AIO summary (~40–60 words) whose first sentence states plainly what the product is, who it is for, and its standout feature — no formatting. The web renders it as a blockquote right after the "Specs Dashboard" and right before "Tính năng chi tiết" (canonical layout block #3 — see `PDP_CONTENT_GUIDE.md` §0b).

It is bilingual: the vi value goes to the canonical column, English to `_en`. On `PATCH`, sending no key leaves the field untouched; sending `null`/blank clears it. English is written via the `translations.en` object (`ProductContentRequest.quickAnswerSummary`).

It is returned by `GET /api/v1/products/{slug}` (locale-resolved via `pick`, with vi fallback) and the admin product read (`GET /api/v1/admin/products/{id}` carries vi + raw English in `translations.en`). **Not** included in product *list* responses. It renders as its own PDP section; the section is hidden when the field is empty — **no `sectionVisibility` gating** (that toggle mechanism was removed 2026-06-22; every PDP block now shows purely based on content, same as `suitabilityAdvisory` and the other detail-only text fields).

Status: `CONFIRMED_FROM_CODE`

Evidence: `UpsertProductRequest.java` (`quickAnswerSummary` + presence flag), `ProductTranslationRequest.ProductContentRequest`, `AdminCatalogMutationService.applyProductPatch`, `ProductFieldApplier.applyTranslations`, `Product.java` + `ProductTranslations.java`, `JpaCatalogReadRepository`/`JpaCatalogReadSupport` (detail mapper `pick`s it; list mapper passes `null`), `V300__add_product_quick_answer_summary.sql`. Web render: `components/catalog/ProductView.tsx` (`quickAnswer` blockquote after `FeaturedSpecsBar`). Admin editor: `ProductDetailScreen.jsx` SectionCard "Quick Answer".

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
- **`purchaseLines`** — **GỠ HẲN ở V276** (2026-06-24). Field `purchaseLines` (các dòng tự do của khối "Mua tại BigBike.vn" theo từng SP, V249) đã gỡ khỏi request/response/domain; bảng `product_purchase_lines` bị drop (`V276__drop_product_purchase_lines.sql`). Khối "Mua tại BigBike.vn" trên bigbike-web vẫn còn nhưng **chỉ** gồm các ô tự động: **Giá + Tồn kho** (realtime) và **Hotline + Địa chỉ** (từ site settings) — không còn dòng admin nhập tay.
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
(link YouTube/TikTok/Facebook / URL MinIO khi là video), `videoProvider` (`youtube`|`tiktok`|`facebook`|`upload`).
Item ảnh dùng `url`/`alt` như cũ; item video dùng `videoUrl`+`videoProvider`,
còn `url`/`alt` (nếu có) là **thumbnail/poster**.
Full-replace như trước; item rỗng (ảnh thiếu `url` HOẶC video thiếu `videoUrl`) bị bỏ. Ảnh bìa biến thể
vẫn lấy ảnh ĐẦU TIÊN là **ảnh** (bỏ qua item video).

Read: `GET /api/v1/products/{slug}` + admin read trả `gallery`/`variants[].gallery` dạng
`GalleryMedia[]` = `{ mediaType, image: ImageAsset|null, videoUrl, provider }`; `image.alt` vẫn là text
thay thế cho SEO/trợ năng. (Từng có thêm `caption` — V294 — nhưng đã bỏ ở V295, không còn trong contract.)
**Tách biệt với `videos`**
(mục "Video" riêng dưới PDP — `product_videos`, không đổi): gallery video do admin đăng chung khu vực ảnh
thumbnail, hiển thị trong dải media trên cùng.

Status: `CONFIRMED_FROM_CODE` — `GalleryImageRequest`, `AdminCatalogMutationService.applyGallery`/`applyVariantGallery`, `GalleryMedia`, `JpaCatalogReadRepository.toGalleryMedia`, `V248__add_gallery_media_video.sql`, `V295__drop_gallery_caption_columns.sql`.

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
`i18n.language` (chọn ở `LanguageSwitcher` header) vào `lang`. **Lọc (`q`) và sắp xếp vẫn theo cột tiếng Việt**
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
admin upsert tương ứng. (Trang thông tin/chính sách nay tĩnh ở web — không qua backend; module pages đã gỡ 2026-06-24.)

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

### Menu item URL tự resolve theo danh mục — `targetType=CATEGORY`

Mục menu có thể **liên kết thẳng tới một danh mục** thay vì lưu URL tĩnh: đặt
`targetType="CATEGORY"` + `targetId=<category id>` (2 cột đã có sẵn trên
`menu_items` từ trước, trước bản này chưa được diễn giải). Khi liên kết còn
hiệu lực, `url` trả về ở `GET /api/v1/menus/{location}?lang=` **được tính lại
tại thời điểm đọc** theo `lang` — dùng `CategoryEntity.slug` (vi) hoặc
`slugEn` (en, lùi về `slug` khi rỗng) thay vì cột `url` đã lưu trong DB.

Cột `url` đã lưu vẫn được giữ làm giá trị hiển thị VI mặc định trong bảng
danh sách admin và làm **fallback**: nếu danh mục bị xóa sau khi liên kết,
public read trả lại nguyên `url` đã lưu (không lỗi, không mất mục menu).

Mục `targetType="CUSTOM"` (mặc định, link ngoài/trang tĩnh/tel/mailto/#)
**không đổi hành vi** — vẫn trả nguyên `url` đã lưu bất kể `lang`.

**Ghi admin:** `POST/PATCH /api/v1/admin/menus/{menuId}/items` nhận
`targetType`/`targetId` như cũ; khi `targetType="CATEGORY"`, `targetId` bắt
buộc phải trỏ tới một danh mục tồn tại — sai → `400 VALIDATION_ERROR`
(field `targetId`, code `CATEGORY_NOT_FOUND`).

Status: `CONFIRMED_FROM_CODE` — `AdminMenuService.validateCategoryTarget`,
`AdminMenuService.resolveDisplayUrl`, `MenuItemEntity.targetType/targetId`
(cột có sẵn, không migration mới), `CategoryEntity.slug/slugEn`,
`AdminMenuServiceTest`.

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

### Category `introContent` — khối giới thiệu ĐẦU trang danh mục (admin-editable)

Field `introContent` (cột `intro_content` + `intro_content_en`; **đổi tên từ `content_bottom`/`contentBottom`
qua `V290`** — tên cũ là di sản WP ACF khi nội dung nằm dưới lưới) là **khối giới thiệu hiển thị ở ĐẦU
trang danh mục** (`bigbike-web` render `introContent` ở `beforeGridNode`, phía trên lưới sản phẩm — thay
cho `description` trước đây). Field `description`/`description_en` **không còn render trên trang**, chỉ còn
là nguồn fallback cho SEO meta description. (Khác hẳn `product.contentBottom` — field sản phẩm, vẫn render
ở CUỐI PDP; không liên quan.)

**Ghi (admin):** `POST/PATCH /api/v1/admin/categories` nhận thêm:
- `introContent` (string, ≤50 000 ký tự, rich HTML) — bản tiếng Việt, ở root request.
- `translations.en.introContent` (string, ≤50 000) — bản tiếng Anh → `intro_content_en`.

Presence-flag như các field khác: bỏ khóa thì PATCH giữ nguyên; gửi `null`/blank để xoá. Admin sửa ở
form danh mục (`CategoryDetailScreen`, field "Nội dung đầu trang danh mục").

**Đọc (admin):** response danh mục đã trả `introContent` (root, theo locale) và `translations.en.introContent`
(`CategoryTranslations.CategoryContent.introContent`) để editor nạp bản song ngữ.

Status: `CONFIRMED_FROM_CODE` — `UpsertCategoryRequest.introContent`,
`CategoryTranslationRequest.CategoryContentRequest.introContent`,
`AdminCatalogMutationService.applyCategoryPatch` (ghi `introContent`/`introContentEn`),
`CategoryEntity.introContent/introContentEn`, `JpaCatalogReadSupport.toCategoryTranslations`,
migration `V289` (đổ nội dung) + `V290` (đổi tên cột).

### Menu location `policy` — sidebar trang chính sách (Đã gỡ bỏ khỏi Admin, chuyển sang tĩnh ở Web từ 2026-07-03)

Quy trình quản lý menu `policy` qua admin đã bị loại bỏ. Thanh bên chính sách `/chinh-sach/{slug}` trên storefront nay hiển thị danh sách tĩnh các trang chính sách kế thừa từ DB cũ:
1. Chính sách bảo mật thông tin (`/chinh-sach/chinh-sach-bao-mat-thong-tin`)
2. Chính sách bảo hành (`/chinh-sach/chinh-sach-bao-hanh`)
3. Chính sách đổi trả hàng (`/chinh-sach/chinh-sach-doi-tra-hang`)

**Đọc public:** `GET /api/v1/menus/policy` không còn được sử dụng ở storefront. Storefront tự dựng danh sách này tĩnh thông qua hàm `buildStaticSidebarItems` và so khớp `current` dựa trên `slug` hiện tại.
**Ghi (admin):** Slot `policy` đã bị gỡ khỏi danh sách system slots và constants. Lớp `MenuLocations` không còn coi `policy` là system menu slot.

Status: `CONFIRMED_FROM_CODE` — `MenuLocations.PRIMARY` duy nhất, `bigbike-web/components/policy/PolicyPageClient.tsx`.

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

## POS Contract — REMOVED (owner decision 2026-06-23, online-only)

The POS (point-of-sale / walk-in) contract was removed entirely. The endpoints `GET /api/v1/admin/pos/products/search` and `POST /api/v1/admin/pos/orders`, the `AdminPosController` / `PosOrderService`, the `PosOrderResponse` shape, and the `pos.read` / `pos.write` / `pos.price_override` / `pos.sell_below_cost` permissions no longer exist. BigBike is online-only — every order is created through the storefront checkout / quick-buy endpoints above.

Status: `REMOVED`

## Admin Settings Contract

| Endpoint | Permission | Current behavior | Status | Evidence |
|---|---|---|---|---|
| `GET /api/v1/admin/settings` | `settings.read` | Paginated list with optional filters: `q` (key/description substring), `group`, `isPublic`. Sensitive keys return `settingValue="********"` with `sensitive=true, masked=true`. | `CONFIRMED_FROM_CODE` | `AdminSettingsController.java`, `AdminSettingsService.java` |
| `GET /api/v1/admin/settings/{key}` | `settings.read` | Single setting by key. Sensitive values masked. | `CONFIRMED_FROM_CODE` | `AdminSettingsController.java` |
| `PATCH /api/v1/admin/settings/{key}` | `settings.write` | Update single setting (value, valueEn, group, isPublic, description). Validates type/range per `SettingDefinitionRegistry`; **translatable + `.required()` keys (currently only `site_name`) also require non-blank `valueEn`** — `400 VALIDATION_ERROR` (field `valueEn`, code `REQUIRED`) if blank. Sensitive keys cannot be made public. **Keys flagged `superAdminOnly` (group `product_assign`) reject the write with 403 unless the caller holds wildcard `*` (`SUPER_ADMIN`)** — `ADMIN` is blocked despite having `settings.write`. | `CONFIRMED_FROM_CODE` | `AdminSettingsController.java` |
| `PATCH /api/v1/admin/settings` | `settings.write` | **Batch update** — atomically update multiple settings in one transaction. Body: `{"updates":[{"key":"…","value":"…","valueEn":"…"}]}` (`valueEn` optional, null = unchanged; same required-`valueEn`-for-translatable-required-keys rule as the single-update path). All validations run before any mutation; if any item is invalid the whole request fails with 400 and no settings are changed. Same `superAdminOnly` 403 gate as the single-update path. | `CONFIRMED_FROM_CODE` | `AdminSettingsController.java`, `AdminSettingsService.batchUpdateSettings` |
| `GET /api/v1/admin/product-assignment` | `products.read` | Returns the editable "Phân công" guide text (7 fields: title + 3 role labels + 3 task lists) for the product create/edit banner. Read uses `products.read` (not `settings.read`) so `SHOP_MANAGER`/`EDITOR` who edit products can render the banner. Write is via the `superAdminOnly` settings keys above. | `CONFIRMED_FROM_CODE` | `AdminProductAssignmentController.java` |
| `GET /api/v1/settings/public` | public | List settings marked `isPublic=true` that are on the registry public allowlist. Sensitive keys are never exposed regardless of DB flag. | `CONFIRMED_FROM_CODE` | `PublicSettingsController.java` |

**Batch update response shape:** `ApiDataResponse<List<AdminSiteSettingResponse>>` — items in same order as request `updates` array. `AdminSiteSettingResponse` no longer includes `enLocked` (dropped V312 with the Gemini auto-translation removal) — English values are entered manually, no lock/skip state to track.

**Sensitive key masking:** Any key whose name contains `secret`, `password`, `token`, `api_key`, `privatekey`, etc. always returns `settingValue="********"` in admin responses and in audit log `before_data`/`after_data`.

**`IMAGE_URL`-typed setting validation:** Keys typed `IMAGE_URL` in `SettingDefinitionRegistry` (hero banner images `hero_*_image_url`/`hero_*_mobile_image_url`/`hero_*_illustration_url`, `hero_default_bg_url`/`hero_default_illustration_url`, and `og_image_url`) are validated by the **shared media-URL whitelist** (`SafeMediaAssetUrlPolicy.validateImageUrlOrThrow`), not the generic URL check. Accepts relative `/media/…` and `/media-proxy/…` paths (what the admin media picker stores), absolute URLs under the configured MinIO public base, and BigBike legacy upload/CDN paths; rejects external hotlinks — same policy the catalog/content modules already use (per `DATA_CONTRACT.md` "menu icon" whitelist note). This fixes the prior `400 VALIDATION_ERROR` (`INVALID_URL`) when saving a library-picked image (relative `/media/…`) to a Banner/Hero or SEO setting. `CONFIRMED_FROM_CODE` — `SettingValueValidator.java`, `SafeMediaAssetUrlPolicy.java`.

**Public storefront setting keys returned by `GET /api/v1/settings/public`:**

- `general`:
  - `site_name` — public site/display name used by header/footer/SEO helpers.
  - `footer_description` — descriptive paragraph. Read by the header's mobile shop-info panel (`WpHeader.tsx`) and the web footer (`WpFooter.tsx` — reconnected 2026-07-04 as the sole exception).
  - `footer_tagline`, `bct_url`, `business_registration`: **removed 2026-07-03 (V308)** — see note below.
- `contact`:
  - `contact_email`, `contact_address`
  - `hotline`, `hotline_2`
  - `facebook_url`, `messenger_url`, `zalo_url`, `youtube_url`, `tiktok_url`, `instagram_url`, `shopee_url`
    - `shopee_url` — official Shopee storefront link, rendered on `/lien-he` and emitted in the homepage `LocalBusiness` JSON-LD `sameAs` (added V286). No longer rendered in the footer social list (footer hardcoded 2026-07-03, see below).
  - `messenger_display`, `zalo_display` — display text for the Messenger/Zalo lines in the floating-chat popup (falls back to the URL slug when empty).

**Footer hardcoded 2026-07-03 (shop owner decision):** `WpFooter.tsx` no longer reads the `contact` group (`hotline`/`hotline_2`/`hotline_3`, `contact_email`, `contact_address`, `facebook_url`/`youtube_url`/`tiktok_url`/`instagram_url`/`shopee_url`) — values are fixed constants in the component, frozen at what was live on that date. The footer link list is hardcoded too: it no longer merges with `GET /api/v1/menus/footer` (that endpoint call was removed from `app/layout.tsx`; `WpMenuClient` no longer has a `"footer"` mode). These settings/the menu endpoint are unchanged and still live for every other consumer — editing them in Admin Settings/Menu still updates the header (full `contact` group), homepage, product page, `/lien-he`, `/gioi-thieu`, the floating-chat widget, and the order-confirmation page. **Note:** `footer_description` is the sole exception that was reconnected on 2026-07-04 to `WpFooter.tsx` (falling back to the hardcoded constant if empty). `footer_tagline`, `bct_url`, and `business_registration` had **no other consumer**, so they were deleted outright (`SettingDefinitionRegistry`, admin `constants.js`, `site_settings` rows via `V308__remove_footer_only_settings.sql`) rather than left orphaned — same pattern as the `public_about` removal (V274) below.
- `public_home`: **removed 2026-07-03 (V311).** See `DATA_CONTRACT.md` "`public_home` keys — removed" for the full list (promo banner, experience section, about section, featured/news/videos kicker+title) — all 15 keys are now hardcoded in `bigbike-web` (`app/page.tsx`), not read from `site_settings`.
- `public_about`: **removed 2026-06-24 (V274).** Was the editable copy for the **About page** (`/gioi-thieu`, added in `V223`, re-seeded `V269`). The About page is **fully static** — copy from the i18n `About` namespace, 5 service tiles from theme assets (`AboutPageContent.tsx`); the web never consumed these settings. All 28 `about_page_*` keys were dropped from the DB, from `SettingDefinitionRegistry`, and the runtime `AboutServiceMediaSeeder` was deleted. The store/hotline/Facebook cards on the page still read the shared `contact` keys; brand logos still load from the brand taxonomy.
- `public_product`: **no shared settings.** All product-detail content is per-product: commitment rows under the buy buttons (`product.commitments`, V232) and the trust-badge row above the title (`product.trustBadges`, V233). The former `product_commitment_*` (V228) and `product_trust_*` keys were removed in V232/V233.
- `seo`:
  - `seo_home_title`, `seo_home_description`, `seo_home_h1`, `og_image_url`
  - `home_content_bottom_html` — homepage bottom SEO HTML block.

Status: `CONFIRMED_FROM_CODE` — `SettingDefinitionRegistry.java`, `PublicSettingsController.java`,
`V18__add_public_homepage_contract_fields.sql`, `V19__backfill_homepage_data.sql`,
`V22__seed_footer_menu_settings.sql`, `V24__seed_footer_contact_settings.sql`,
`V32__add_article_product_image_and_home_exp_settings.sql`.

**Page hero settings (group `public_hero`, all `publicAllowed`):**

For each listing page (`/san-pham`, `/brands`, `/tin-tuc`), the hero block is composed from 5 keys:

| Key prefix | Type | Purpose |
|---|---|---|
| `hero_<page>_image_url` | `IMAGE_URL` | Desktop background image URL |
| `hero_<page>_mobile_image_url` | `IMAGE_URL` | Mobile (≤767px) background image URL; blank → falls back to the desktop image |
| `hero_<page>_illustration_url` | `IMAGE_URL` | Right-side cut-out gear illustration; blank → falls back to `hero_default_illustration_url` |
| `hero_<page>_image_alt` | `STRING` | Image alt text |
| `hero_<page>_title` | `STRING` | Heading text |

Concrete keys: `hero_products_*`, `hero_brands_*`, `hero_news_*` (15 total). All are returned by `GET /api/v1/settings/public`. Two global fallbacks also live in `public_hero`: `hero_default_bg_url` and `hero_default_illustration_url`, used when a page has no own background / illustration. **Cascade per page:** the page's own key → the matching global default → a hardcoded asset baked into `WpCategoryHero`. The `WpCategoryHero` web component renders `mobile_image_url` via an art-directed `<img>` overlay shown only below the `md` breakpoint. The `_description` and `_kicker` keys that earlier seeds carried were dropped in `V199__drop_unused_hero_settings.sql` (never consumed); `_mobile_image_url` was re-introduced in `V220__reseed_hero_mobile_settings.sql`; per-page `_illustration_url` was added in `V221__add_hero_per_page_illustration.sql` (previously all three pages shared `hero_default_illustration_url`). These keys are managed by the dedicated **Banner trang** admin screen (`BannerScreen.jsx`). (Trước đây các trang CMS about/contact/policy/guides mang hero trên `Page` entity — module pages đã gỡ 2026-06-24, các trang đó nay tĩnh ở web nên không còn hero do admin quản lý.)

## Contact Page (trang tĩnh — không có endpoint)

Trang `/lien-he` là **trang tĩnh hoàn toàn**: bố cục, nhãn, tiêu đề và SEO cố định trong code web (i18n `Contact`/`StaticPage`), admin không quản lý. **Đã gỡ toàn bộ endpoint contact-page** (cả `GET/PUT /api/v1/admin/contact-page` lẫn public `GET /api/v1/contact-page`) và bảng `contact_page_layout` (drop ở `V270`, was V224). Số điện thoại/địa chỉ/giờ/mạng xã hội hiển thị trên trang là dữ liệu chung lấy từ `GET /api/v1/settings/public` (nhóm `contact`, cùng nguồn header/footer). Evidence: `bigbike-web/app/lien-he/page.tsx`, `bigbike-web/components/contact/ContactPageContent.tsx`, `V270__drop_contact_page_layout.sql`.

## Guide Page Builder Contract — REMOVED (2026-06-24)

> **REMOVED (2026-06-24).** Trang Hướng dẫn `/huong-dan` (+ 3 trang con `mua-hang`/`size-mu`/`size-gang-tay`) nay là **nội dung tĩnh trong `bigbike-web`** (nguồn `static-pages.json`). Toàn bộ endpoint guide-page đã gỡ: admin `GET`/`PUT /api/v1/admin/guide-page` và public `GET /api/v1/guide-page` không còn tồn tại. Bảng `guide_page_layout` drop ở `V271`. Trình dựng trang Hướng dẫn (GuidePageBuilder) trong admin cũng đã gỡ. Xem "Static CMS Pages + Guide Page — REMOVED (2026-06-24)" ở trên.

## Customer Admin — Summary

| Method | Path | Permission | Current behavior | Status | Evidence |
|---|---|---|---|---|---|
| `GET` | `/api/v1/admin/customers/summary` | `customers.read` | KPI counts for the admin Customers screen. Returns `AdminCustomerSummaryResponse`: `total` (all customers), `vip` (customers whose lifetime order total ≥ 10,000,000 VND — mirrors `AdminCustomerService.deriveSegment` VIP rule), `newLast30Days` (registered within the last 30 days), `active` (status = `ACTIVE`). | `CONFIRMED_FROM_CODE` | `AdminCustomerController.java`, `AdminCustomerService.java` |

## Audit Log Contract

| Endpoint | Permission | Current behavior | Status | Evidence |
|---|---|---|---|---|
| `GET /api/v1/admin/audit-logs` | `audit-logs.read` | Paginated list (page/size), filterable by actorType, actorId, resourceType, resourceId, action, q (matches action text), from/to (LocalDate). Enriches actor display name and resource code. | `CONFIRMED_FROM_CODE` | `AdminAuditLogController.java`, `AdminAuditLogService.java` |

**Resource types written by backend** (as of P0 fix):
- `ORDER` — order lifecycle events (AdminOrderService, PosOrderService)
- `PRODUCT` — create/update/publish/soft-delete/restore (AdminCatalogMutationService)
- `CATEGORY` — create/update/soft-delete (AdminCatalogMutationService)
- `BRAND` — create/update/soft-delete (AdminCatalogMutationService)
- `INVENTORY` — stock adjustments (AdminInventoryService)
- `CONTENT` — article/page create/update/delete (AdminContentMutationService)
- `CUSTOMER` — AdminCustomerService
- `MEDIA` — AdminMediaService
- `MENU` / `MENU_ITEM` — AdminMenuService
- `REDIRECT` — AdminRedirectService
- `SITE_SETTING` — AdminSettingsService
- `REVIEW` — AdminReviewService
- `ADMIN_USER` — AdminAdminUsersService
- `ADMIN_ROLE` — AdminRoleService (fixed in V76; previously erroneously `ADMIN_ROLE:<roleId>`)

**Note:** `resource_id` column is `uuid` type. For entities with String IDs (products, categories, brands, content, roles), `resource_id = null` and the entity identifier is embedded in `afterData`/`beforeData` JSON.

**Write guarantee (non-blocking):** All audit-log writes go through the central `AuditLogWriter`, which persists in a separate transaction (`@Transactional(REQUIRES_NEW)`) wrapped in try/catch. An audit-write failure is logged and swallowed — it never rolls back or breaks the originating business action. `createdAt` is auto-set if a caller leaves it null. In the mock/read-only profile (no JPA repository) the write is a silent no-op. `CONFIRMED_FROM_CODE` — `AuditLogWriter.java`, `AuditLogPersister.java`.

> **Warranty module removed (2026-06-23, V266).** The admin warranty contract — `GET /api/v1/admin/warranties` and `PATCH /api/v1/admin/warranties/{id}/void` — and the public lookup `GET /api/v1/warranties/lookup` were **deleted** along with the entire warranty feature (records, services, controllers, DTOs, the `/bao-hanh` web page, and the `warranty.read` / `warranty.write` permissions). Customer-facing warranty wording now lives only in CMS policy content and per-product marketing rows.

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

- Most public/customer CRUD endpoints use `ApiDataResponse` or `ApiListResponse`.
- Some admin modules use raw `PageResult`, DTOs, CSV, or other non-envelope responses.

Status: `CONFIRMED_FROM_CODE`

## Mobile Coverage Notes

| Topic | Current status | Evidence |
|---|---|---|
| Search, address, customer address are wrapped in mobile endpoint constants. | `CONFIRMED_FROM_CODE` | `api_endpoints.dart` |
| Verify-email and home-videos are wrapped in `api_endpoints.dart` (constants `verifyEmail` line 52, `homeVideos` line 26). Home-videos widget integration is still pending in the mobile app (tracked as `CMS-004`). | `CONFIRMED_FROM_CODE` | `api_endpoints.dart` lines 26, 52 |

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
- ~~`sectionVisibility: string | null` (V245)~~ — **GỠ khỏi admin+web (2026-06-22).** Chức năng "Hiển thị
  trên web" (bật/tắt riêng 5 section tab) đã bỏ; mọi khối PDP hiện **thuần theo nội dung**. Backend còn trả
  field `section_visibility` (cột giữ ngủ yên, không còn tác dụng) nhưng **web bỏ qua, admin không gửi**.

**Admin upsert** (`POST /api/v1/admin/products`, `PATCH /api/v1/admin/products/{id}`) — presence-flag:
- `descriptionBlocksEn: DescriptionBlock[]` (≤200) — khối mô tả tiếng Anh; gửi key (kể cả []) thì render →
  `description_en` + overwrite, bỏ key thì giữ nguyên. Admin read trả lại tại `translations.en.descriptionBlocks`.
- ~~`specifications[].featured: boolean`~~ — **GỠ BỎ ở V235**, thay bằng `specStats` (full-replace, ≤4 ô).
- `tabs: ProductTabRequest[]` (≤30) — cấu hình tab; mỗi tab `{ id, type, enabled, sortOrder, label, labelEn,
  blocks, blocksEn }`. Gửi key (kể cả []/null) thay/clear; bỏ key thì giữ nguyên. `[]`/null = reset về mặc định.
  Lưu ý: admin form không gửi `enabled` như công tắc hiển thị (luôn `true`), tab editor chỉ đổi thứ tự + đổi tên.
  (Việc ẩn/hiện riêng 5 section qua `sectionVisibility` đã **GỠ 2026-06-22** — nay hiện thuần theo nội dung.)
- ~~`sectionVisibility: string` (V245, ≤4000)~~ — **GỠ 2026-06-22.** Admin không còn gửi field này (đã bỏ ô
  "Hiển thị trên web"). Backend vẫn chấp nhận key tùy chọn (present-flag) nhưng không còn nguồn tạo nó.

Status: `CONFIRMED_FROM_CODE` — `CatalogController` (public detail), `AdminCatalogController` (upsert/preview),
`UpsertProductRequest` (`descriptionBlocksEn`/`tabs`), `Product`/`ProductTab`/`ProductSpecification`
domain records. Spec `featured` đã gỡ ở V235 (xem §"`specStats` (V235)"). Xem [DATA_CONTRACT.md](DATA_CONTRACT.md) §"PDP mockup port (V229–V231)".
