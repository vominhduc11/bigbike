# API Contract

This document is the human-readable companion to `bigbike-backend/src/main/resources/openapi/bigbike-openapi.json`.

## Governance

- Canonical contract sources for active work:
  1. controller/service/config/test evidence
  2. this document
  3. checked-in OpenAPI companion
- If OpenAPI and controllers drift, controllers and current tests are the verification source until docs are repaired.

## Error Envelope

Every API error, including responses produced directly by security and rate-limit filters, uses
`ApiErrorResponse`: `{ "error": { "code", "message", "details" }, "meta": { "requestId", "timestamp" } }`.
`meta` is never `null`; it is generated through `ApiMetaFactory` so clients and operators can
correlate an early filter rejection with server logs. `CONFIRMED_FROM_CODE`

An unmapped path under `/api/**` returns HTTP `404` with code `NOT_FOUND` in the same envelope (not
`500 SERVER_ERROR`). This includes Spring's static-resource fallback when no controller matches the
request. `CONFIRMED_FROM_CODE`

## Auth Models

| Model | Used by | Current contract | Status | Evidence |
|---|---|---|---|---|
| Admin JWT | Admin REST APIs | `Authorization: Bearer <token>`; includes the admin id and `accessVersion`, which must equal the current account version | `OWNER_CONFIRMED_2026-07-31` | `JwtService.java`, `JwtAuthFilter.java` |
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

**Admin user creation is invite-based.** `POST /api/v1/admin/admin-users` (`admin-users.write`) now takes `{email, displayName, role}` only — **no `password`**. It creates the user `status = INVITED` (no password), generates an invite token and sends an email with a set-password link (`{ADMIN_BASE}/accept-invite?token=…`). The response includes `inviteEmailSent` (boolean) and, when SMTP is not configured, the `inviteUrl` so a Super Admin can deliver it manually. Resend: `POST /api/v1/admin/admin-users/{id}/resend-invite` (`admin-users.write`).

`PATCH /api/v1/admin/admin-users/{id}` (`admin-users.write`) accepts partial `{displayName, status, newPassword, role}`. `newPassword`, when present, must contain 8–128 characters. The manually settable statuses are `ACTIVE`, `DISABLED`, and `SUSPENDED`; callers cannot set `INVITED`, and an account currently in `INVITED` cannot be moved manually to another status because `INVITED → ACTIVE` belongs exclusively to the token-gated invite-acceptance flow. Super-admin privilege, self-lockout, and last-active-super-admin guards follow `PERMISSION_MATRIX.md` §Role Governance.

After a successful commit, a role assignment or role-permission change keeps the affected admin's
sessions but sends an access-change signal so the browser reloads `GET /api/v1/auth/me`. A change to
`DISABLED`/`SUSPENDED`, or `newPassword`, increments the target account's access version, revokes all
of its refresh tokens and forces that account to sign in again on every tab/device. This adds no REST
endpoint and does not change the PATCH request or response shape. `OWNER_CONFIRMED_2026-07-31`.

Status: `CONFIRMED_FROM_CODE` — `AdminAdminUsersController.java`, `AdminAdminUsersService.java`, `AdminInviteService.java`.

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
| `GET` | `/api/v1/search-suggest` | Lightweight typeahead product/article suggestions. Accepts `q`, optional `limit`, and `lang=vi|en` (default `vi`); matching and displayed text follow `lang`, with field-level fallback to Vietnamese. Product/article items retain canonical `slug` plus optional `slugEn` so the storefront can build the correct localized URL. | `ApiDataResponse<SearchPayload>` | `CONFIRMED_FROM_CODE` | `PublicSearchController.java`, `GlobalSearchService.java` |
| `GET` | ~~`/api/v1/address/provinces`~~ + ~~`/api/v1/address/provinces/{provinceCode}/wards`~~ | **REMOVED (2026-07-15, AUD-056, owner decision #8 — không có mobile/client ngoài).** Web dùng dữ liệu tích hợp sẵn `VN_PROVINCES` (`vn-address-data.ts`), backend không còn API địa chỉ. | — | `REMOVED` | commit gỡ `VnAddressController.java` |
| `GET` | `/api/v1/content-categories` | List content (news) categories with published-article counts, for the Tin tức category filter | `ApiListResponse<ContentCategoryWithCount>` | `CONFIRMED_FROM_CODE` | `ContentController.java` |
| `GET` | `/api/v1/sliders?location=home` | Trả các homepage slider đang active theo `sortOrder`. Mỗi item có `desktopImage` và `mobileImage`; `mobileImage` là tùy chọn (`ImageAsset` hoặc `null`). Storefront dùng `mobileImage.url` dưới 768px khi có, nếu không dùng `desktopImage.url`. | `ApiDataResponse<List<PublicSliderResponse>>` | `OWNER_CONFIRMED_2026-07-30` | `PublicSliderController.java`, `PublicSliderResponse.java`, `HeroSlider.tsx` |
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

### Customer profile — email change resets verification

| Method | Path | Current purpose | Response shape | Status | Evidence |
|---|---|---|---|---|---|
| `GET` | `/api/v1/customer/me` | Current customer profile (requires `ROLE_CUSTOMER`) | `ApiDataResponse<CustomerSummary>` | `CONFIRMED_FROM_CODE` | `CustomerController.java` |
| `PATCH` | `/api/v1/customer/me` | Update own profile. Changing `email`, `phone` or `newPassword` requires `currentPassword` | `ApiDataResponse<CustomerSummary>` | `CONFIRMED_FROM_CODE` | `CustomerController.java`, `CustomerAuthService.updateProfile` |

- **Changing `email` through the customer's own `PATCH /api/v1/customer/me` clears `email_verified_at`** and sends a fresh verification email to the new address. Guest-order auto-linking (`GuestOrderLinkingService`) stays disabled until the new email is verified again — linking requires proven ownership of the address (security fix AUD-001, 2026-07-15). The admin customer endpoint does not accept email changes (`CUSTOMER_RULE_004`).

### Customer avatar upload/remove (2026-07-21, owner decision)

| Method | Path | Current purpose | Response shape | Status | Evidence |
|---|---|---|---|---|---|
| `POST` | `/api/v1/customer/me/avatar` | Upload/replace own avatar. `multipart/form-data`, single `file` part. Max **5 MB**, `image/jpeg`/`image/png`/`image/webp` only — both declared Content-Type and Apache Tika magic-byte detection must agree (same double-check as review photos, `ReviewPhotoStorageService`/`CustomerAvatarStorageService`). Server center-crops + downscales to **400×400** (`ImageCompressionService`, MEDIA_RULE_006) before storing to MinIO under `customers/{customerId}/...` and persisting the returned URL — replacing a previous avatar deletes the old MinIO object. | `ApiDataResponse<CustomerSummary>` with `avatarUrl` populated | `CONFIRMED_FROM_CODE` | `CustomerController.java`, `CustomerAvatarStorageService.java` |
| `DELETE` | `/api/v1/customer/me/avatar` | Remove own avatar — deletes the MinIO object and nulls `avatar_url`. Idempotent: calling when already unset is a no-op `200`, not `404`. | `ApiDataResponse<CustomerSummary>` with `avatarUrl: null` | `CONFIRMED_FROM_CODE` | `CustomerController.java` |

**No endpoint accepts an arbitrary avatar URL string.** The only way `avatar_url` changes is via the upload endpoint above (the server generates the URL from the stored MinIO object) or the two remove paths (this one and the admin one below) — enforcing the project-wide "no external image URLs" rule for avatars specifically. `PATCH /api/v1/customer/me` does **not** accept an `avatarUrl` field.

| Method | Path | Current purpose | Response shape | Status | Evidence |
|---|---|---|---|---|---|
| `GET` | `/api/v1/customer/addresses` | List own addresses | `ApiDataResponse<List<CustomerAddressResponse>>` | `CONFIRMED_FROM_CODE` | `CustomerAddressController.java` |
| `POST` | `/api/v1/customer/addresses` | Create own address | `ApiDataResponse<CustomerAddressResponse>` with HTTP `201` | `CONFIRMED_FROM_CODE` | `CustomerAddressController.java` |
| `PATCH` | `/api/v1/customer/addresses/{id}` | Update own address | `ApiDataResponse<CustomerAddressResponse>` | `CONFIRMED_FROM_CODE` | `CustomerAddressController.java` |
| `DELETE` | `/api/v1/customer/addresses/{id}` | Delete own address | HTTP `204` no body | `CONFIRMED_FROM_CODE` | `CustomerAddressController.java` |
| `GET` | `/api/v1/orders/lookup?orderNumber=...&orderKey=...` | Public guest-order lookup — no auth, no CSRF (safe GET). Both params required (`400 VALIDATION_ERROR` when blank); returns the order detail only when `orderNumber` + secret `orderKey` match (`orderKey` được phát trong URL xác nhận sau checkout). Caller: trang xác nhận đơn `don-hang/xac-nhan` (`public-api.ts getOrderLookup` → `OrderConfirmClient.tsx`). *(Bổ sung vào contract 2026-07-15, AUD-076 — endpoint đã tồn tại từ trước.)* | `ApiDataResponse<OrderDetailResponse>` | `CONFIRMED_FROM_CODE` | `OrderLookupController.java`, `OrderReadService.guestLookup` |
| `GET` | `/api/v1/customer/orders` | List own orders. Each item includes `channel` — now always `"WEB"` (POS / `"IN_STORE"` removed 2026-06-23, online-only). | `ApiListResponse<OrderListItemResponse>` | `CONFIRMED_FROM_CODE` | `CustomerOrderController.java` |
| `GET` | `/api/v1/customer/orders/{orderId}` | Get own order detail. Response includes `channel` — now always `"WEB"` (POS / `"IN_STORE"` removed 2026-06-23, online-only). Response no longer includes `notes`; admin cancellation reason is not customer-visible. | `ApiDataResponse<OrderDetailResponse>` | `CONFIRMED_FROM_CODE` | `CustomerOrderController.java` |
| `PATCH` | `/api/v1/customer/orders/{orderId}/cancel` | Customer cancels own order only while the order is `PENDING` or `PROCESSING`; `COMPLETED`/`CANCELLED` return `409`. Sets `CANCELLED`, does not restore stock, and sends the existing audit, WebSocket, inbox and email side effects. | `ApiDataResponse<OrderDetailResponse>` | `CONFIRMED_FROM_CODE` | `CustomerOrderController.java`, `CustomerOrderCancelService.java` |

**Customer order tracking (polling).** The signed-in order-detail page refreshes the existing own-order endpoint every 15 seconds while the page is visible and refetches when the tab regains focus. The guest confirmation page applies the same short polling to the existing `orderNumber` + `orderKey` lookup after the first successful lookup. Both stop polling for `COMPLETED` or `CANCELLED`; no customer WebSocket channel or new endpoint is introduced. Status: `CONFIRMED_FROM_CODE` — `bigbike-web` order query hooks and confirmation client.

> **Removed (2026-06-23).** The Return (RMA) and Refund feature was deleted platform-wide — the customer return endpoints (`/orders/returns`, `/orders/returns/{returnId}`, `/orders/{orderId}/returns`, `/orders/{orderId}/return-eligibility`), the admin returns/inspection endpoints, and every refund endpoint no longer exist. Customer-facing return/exchange policy text is kept as a manual commitment, not an API.
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
- `rating` — star filter, accepts the 9 half-star levels `1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5` (`REVIEW_RULE_008`, changed 2026-07-22 from integer-only `@Min(1)@Max(5)`). When present, **only the `reviews` list is narrowed to that exact star level**; `avgRating`, `totalReviews` and `ratingBreakdown` stay global (computed over all approved reviews) so the summary panel is stable while the customer drills into one bucket.
- `sort` — ordering of the list: `newest` (default — `createdAt` desc), `highest` (`rating` desc, then `createdAt` desc), `lowest` (`rating` asc, then `createdAt` desc). Unknown values fall back to `newest`.

Response `data` shape:
- `avgRating` (number, 1-decimal, **HALF_UP** — `PublicReviewService.roundAverage`), `totalReviews` (long) — **always global**, never affected by `rating`. Khi 0 review approved: `avgRating = 0.0` (không phải null) và `totalReviews = 0` — FE gate hiển thị sao bắt buộc bằng `totalReviews ≥ 1`, không bằng `avgRating > 0` (xem `BUSINESS_RULES.md` `REVIEW_RULE_003`).
- `ratingBreakdown` — **9 keys** (changed 2026-07-22, `REVIEW_RULE_008`): `{ "5": n, "4.5": n, "4": n, "3.5": n, "3": n, "2.5": n, "2": n, "1.5": n, "1": n }`, every key present (no trailing `.0` — whole levels are `"5"` not `"5.0"`), global counts. Each review's `rating` contributes to exactly one of these 9 buckets (no rounding/merging into an adjacent whole-star bucket).
- `reviews` — `[{ id, authorName, rating, comment, photos, createdAt, authorAvatarUrl }]`, filtered + sorted per params. `rating` is a decimal (one of the 9 half-star levels above), not always a whole integer. `photos` is an array of MinIO media URLs (`/media/reviews/...`, possibly empty) — customer-uploaded photos for that review, surfacing only for `APPROVED` reviews (moderated together with the review). `authorAvatarUrl` (string, nullable, added 2026-07-21) — the linked customer's **current** avatar URL when the review was submitted while logged in (`reviews.customer_id` non-null); resolved **live** at read time (not a snapshot frozen at submission — if the customer later changes/removes their avatar, already-published reviews reflect the new state on next read), batch-fetched for all distinct `customer_id`s on the page in one query (no N+1). `null` for guest-submitted reviews or when the linked customer currently has no avatar — client renders the initials fallback in both cases identically.
- `pagination` — `{ page, pageSize, totalItems, totalPages, hasNext, hasPrevious }`. `totalItems`/`totalPages`/`hasNext` follow the **filtered** list (so "load more" pages correctly within one star bucket); when `rating` is absent these equal the global approved count.

Out-of-range `page`/`size`/`rating` (not one of the 9 half-star levels) → `400 VALIDATION_ERROR`. Unknown `productId` → `404`.

The public review list, approved aggregate, 9-bucket breakdown and linked customer avatars are read in one repeatable-read snapshot, so a moderation commit cannot produce a response whose list and summary describe different points in time.

### `POST /api/v1/products/{productId}/reviews`

Submits a review (`status = PENDING`, awaits admin moderation). Honeypot `website` field → accept-and-drop silently. Duplicate guard: same `productId` + normalized author + normalized body within 24h → `409`. Concurrent submits for the same product are serialized on that product before the duplicate query and insert, so two racing identical requests cannot both pass the guard. See `SubmitReviewRequest`.

Body fields: `rating` (required, **decimal, one of `1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5`** — 9 half-star levels), `comment` (optional, ≤1000), `website` (honeypot), plus `photos` (optional, `string[]`, ≤10). For guests, `authorName` is required (≤80) and `authorEmail` is optional (≤255, valid email when present). For an authenticated customer, both body fields are optional and ignored: the backend resolves display name and email from the current account (`REVIEW_RULE_007`). Any rating outside the 9 levels (e.g. `4.2`) → `400 VALIDATION_ERROR`.

Each `photos[]` entry must be a canonical Review URL under `/media/reviews/...`. The object must have been created by this module's upload endpoint for the same `productId` and be unclaimed. Submit atomically claims each object for the newly created review; a missing, foreign-product, duplicate or already-claimed object returns `409`. This is a server-side ownership check, not URL-prefix trust alone (`REVIEW_RULE_005`/`011`).

**Customer linking and authoritative identity (2026-07-21; backend hardening 2026-07-28):** this endpoint stays `permitAll()` (guest submission remains supported), but a valid `bb_session` gives the backend a `CustomerPrincipal`. The controller passes only that server-derived customer ID. The service loads the current customer row and persists its `displayName` (fallback email local-part) and email, ignoring any fake `authorName`/`authorEmail` supplied in the body. Email text alone never links an account.

The storefront browser calls this public backend endpoint directly with
credentials included (and does the same for `/reviews/photos`), rather than
proxying through a shared Next.js server request. This preserves the real
`bb_session` identity and the real client-IP rate-limit bucket.

### `POST /api/v1/products/{productId}/reviews/photos`

Public, no auth. `multipart/form-data` with a single `file` part — uploads one customer review photo to MinIO and returns its URL so the submit body can reference it. Rate-limited per IP (`REVIEW_PHOTO` tier). Response `data`: `{ url }` (e.g. `/media/reviews/{uuid}/{filename}`).

Validation: image only — declared Content-Type and Apache Tika magic-byte detection must **match exactly** and be `image/jpeg`, `image/png`, or `image/webp` (no SVG/GIF/video); the stored object gets the canonical `.jpg`/`.png`/`.webp` extension for that verified type rather than trusting the client filename. Max **8 MB** per file. Unknown `productId` → `404`; wrong type / mismatch / oversize / empty → `400 VALIDATION_ERROR`. Photos are stored directly under the `reviews/` prefix and are **not** registered in the admin media library (`media` table). Contract target is to downscale to max **1600px** wide before storing (`ImageCompressionService`, MEDIA_RULE_006). JPEG/PNG currently meet that target; accepted WebP currently falls back to the original bytes because the runtime has no WebP ImageIO reader (`CODE_GAP_WEBP_2026-07-28`, shared Media P2 debt). Evidence: `PublicReviewController.uploadPhoto`, `ReviewPhotoStorageService`, `ReviewPhotoStorageServiceTest`, `ImageCompressionServiceTest`.

Every successful upload also creates a durable unclaimed record containing its canonical object key, product ID and upload timestamp. A scheduled cleanup atomically removes records still unclaimed after 24 hours and then deletes the corresponding MinIO object. Once claimed by a submitted review, the object cannot be claimed again.

## Content Categories Contract

`GET /api/v1/content-categories` — public, no auth. Powers the Tin tức (news) category filter, including the mobile category drawer.

No query params. Response shape: `ApiListResponse<ContentCategoryWithCount>`:
- `id`, `slug`, `name` — the content category.
- `articleCount` — number of `PUBLISHED` articles in that category.

**Counting semantics:** an article counts toward a category when that category is its primary `category` **or** appears in its many-to-many `categories` list — the same membership rule as the `category` filter of `GET /api/v1/articles`. Every content category is returned (including `articleCount = 0`), ordered by `name`. Status: `CONFIRMED_FROM_CODE` — `ContentController.listContentCategories`, `ContentReadService.listContentCategories`.

**Admin reference list — REMOVED (2026-07-15, AUD-056):** `GET /api/v1/admin/content/reference/categories` đã gỡ. Endpoint vốn nuôi ô chọn danh mục của form bài viết, nhưng ô chọn đã bị gỡ từ V275 (bài viết tự gán nhóm mặc định `tin-tuc`) nên endpoint thành orphan — xóa theo owner decision #8.

**No admin CRUD.** There is no create/update/delete endpoint for content categories — the admin "Quản lý danh mục bài viết" screen was removed (the inventory of categories is fixed/seed-managed). The public list reads from the `content_categories` table.

## Static CMS Pages + Guide Page — REMOVED (2026-06-24)

> **REMOVED (2026-06-24).** Module "Trang tĩnh CMS" (pages) và module Guide Page Builder đã bị gỡ khỏi toàn stack. 8 route thông tin hiện hành — Giới thiệu (`/gioi-thieu`), Liên hệ (`/lien-he`), Hướng dẫn (`/huong-dan` + 2 trang con `size-mu|size-trang-phuc`), và đúng 3 trang chính sách (`chinh-sach-bao-mat-thong-tin|chinh-sach-bao-hanh|chinh-sach-doi-tra-hang`) — nay **đóng cứng trong `bigbike-web`**. Web không gọi backend để đọc/quản lý các trang này.
>
> **Endpoint đã gỡ:**
> - Public `GET /api/v1/pages`, `GET /api/v1/pages/{slug}` — không còn.
> - Public `GET /api/v1/guide-page` — không còn.
> - Toàn bộ admin CRUD pages (`POST`/`PATCH`/`DELETE /api/v1/admin/content/pages`, type `PAGE` trong `GET /api/v1/admin/content`) + reference `GET /api/v1/admin/content/reference/pages` — không còn.
> - Admin guide-page `GET`/`PUT /api/v1/admin/guide-page` — không còn.
>
> Bảng `pages` + `guide_page_layout` đã drop ở `V271__drop_pages_and_guide_page.sql`. Module Nội dung admin nay **chỉ còn quản lý bài viết (Tin tức)** — xem "Article Content Contract" bên dưới. Sidebar chính sách là danh sách cố định 3 trang trong web; menu location `policy` không còn được admin hoặc storefront sử dụng.

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

When `publishStatus` is omitted, the endpoint returns every non-trashed article (`publishStatus != TRASH`). The Trash view is explicit: `publishStatus=TRASH`. This is a backend filter, so `totalItems` and pagination never count hidden Trash rows in the default view.

| Field | Notes |
|---|---|
| `title` | Case-insensitive. |
| `createdAt` / `updatedAt` / `publishedAt` | Timestamps; `publishedAt` falls back to `createdAt` when null. |
| `type` | `ARTICLE` only (pages module gỡ 2026-06-24). DB-paginated path falls back to `updatedAt` (not a DB column). |
| `publishStatus` | Sort theo trạng thái xuất bản (gom nhóm bản nháp/đã đăng khi triage nội dung). |

An unsupported field returns `400 UNSUPPORTED_SORT_FIELD` (not a silent fallback) via `SortParser`. The admin content list screen exposes both directions for `title`, `publishStatus`, `createdAt`, `updatedAt`, and `publishedAt`; `type` remains accepted for compatibility but is not shown because this module is Article-only.

Status: `CONFIRMED_FROM_CODE` — `AdminContentReadService.CONTENT_SORT_FIELDS` + `contentComparator`, `SortParser.parse`.

### Article admin save defaults — category and canonical

Every Article create/update request from BigBike Admin sends `categoryId=""`, which instructs `ContentRequestValidator.resolveCategory` to normalize the record to the sole `tin-tuc` category, including legacy records with a stale category. The form does not expose a category picker.

The form does not expose `seo.canonicalUrl`. It derives the Vietnamese canonical URL from `slug` as `https://bigbike.vn/tin-tuc/{slug}/` (or the literal localhost/127.0.0.1 origin in local development). The English URL remains independently controlled by optional `translations.en.slug` / `slugEn` and the `/news/{slugEn}/` contract.

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

Admin detail reads (`AdminContentItem`) của Article bao gồm `bodyBlocks: DescriptionBlock[] | null`. `null` = chưa có blocks; `[]` = body bị xoá rỗng. **Public read** (`GET /api/v1/articles/{slug}`) **không** trả `bodyBlocks` — web tiếp tục đọc `body` HTML như cũ. (Page body blocks không còn — module pages đã gỡ 2026-06-24.)

**Upsert mutation:**
- Gửi key `bodyBlocks: [...]` trong `UpsertArticleRequest` → server render HTML từ blocks, ghi đè cả `body_blocks` lẫn `body`.
- Bỏ key `bodyBlocks` hoàn toàn → `body` được patch bình thường; `body_blocks` không bị đụng (presence-flag pattern, giống `products.descriptionBlocks`).
- **Tạo mới (`POST`):** nội dung là bắt buộc — chấp nhận **hoặc** `body` **hoặc** `bodyBlocks` non-empty. Gửi `bodyBlocks` mà bỏ `body` vẫn hợp lệ (server tự render `body` từ blocks); chỉ báo lỗi `body REQUIRED` khi thiếu cả hai.
- Khối `video` trong bài viết khi ghi chỉ dùng `provider` `youtube|upload`; URL YouTube phải hợp lệ, còn `upload` phải là media nội bộ. `tiktok`, `facebook`, provider lạ hoặc provider không khớp URL trả `400 INVALID_VALUE`. PATCH không gửi `bodyBlocks` giữ nguyên dữ liệu cũ; nếu gửi lại `bodyBlocks`, mọi khối video legacy phải được thay nguồn. Đường đọc/render vẫn chấp nhận dữ liệu TikTok/Facebook cũ. Mô tả chi tiết sản phẩm không còn tạo block video; video sản phẩm là mục riêng (`videos[]`).

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
`UpsertArticleRequest.translations.en.title` bắt buộc non-blank (áp dụng cho cả tạo mới lẫn sửa bản ghi cũ,
kể cả bản ghi cũ đang thiếu EN ở field này). **Ngoại lệ:** `UpsertBrandRequest.translations.en.name`
và `UpsertBrandRequest.translations.en.slug` không còn bắt buộc và không dùng để hiển thị/điều hướng
thương hiệu; brand name + slug là giá trị dùng chung VI/EN (`BRAND_RULE_001`/`BRAND_RULE_003`).
Thiếu → `400 VALIDATION_ERROR` (field `translations.en.name`/`translations.en.title`,
code `REQUIRED`) cho product/category/article tương ứng.
Các field/khối còn lại (mô tả, specifications, faqs, slug của product/category/article,
body/bodyBlocks…) vẫn tùy chọn ở EN — không chặn lưu khi trống. `UpdateSiteSettingRequest.valueEn` / `BatchUpdateSettingsRequest.BatchSettingUpdate.valueEn`
bắt buộc khi setting vừa translatable vừa `.required()` ở VI (hiện chỉ `site_name`) — thiếu → `400
VALIDATION_ERROR` (field `valueEn`, code `REQUIRED`).

Status: `CONFIRMED_FROM_CODE`. Xem [BUSINESS_RULES.md](../business/BUSINESS_RULES.md) §"Bilingual /
Auto-translation Rules" (`TRANSLATION_RULE_001/002`) + §"Site Settings Rules" (`SETTINGS_RULE_001`),
[DATA_CONTRACT.md](DATA_CONTRACT.md) §"Product bilingual content — English columns (V136)".

**Báo cáo record thiếu EN bắt buộc — REMOVED (2026-07-15, AUD-056):** endpoint
`GET /api/v1/admin/translations/missing-required` (V312) đã gỡ theo owner decision #8 — chưa từng có
UI admin gọi, không có client ngoài. Validation chặn lưu khi thiếu EN bắt buộc vẫn giữ nguyên ở
mutation layer (xem đoạn trên); chỉ báo cáo tổng hợp bị gỡ.

## Administrative Deletion and Restore Contract (Trash Flow)

Các endpoint dưới đây được sử dụng để quản lý trạng thái Xóa mềm (Trash), Khôi phục (Restore) và Xóa vĩnh viễn (Permanent Delete) của 5 module Nhóm A.

### 1. Products (Sản phẩm)
- **Xóa mềm**: `DELETE /api/v1/admin/products/{id}`
  - Đưa sản phẩm vào Thùng rác bằng cách đặt `publishStatus = PublishStatus.TRASH`.
- **Khôi phục**: `POST /api/v1/admin/products/{id}/restore`
  - Đặt `publishStatus = PublishStatus.DRAFT`.
- **Xóa vĩnh viễn**: `DELETE /api/v1/admin/products/{id}/permanent`
  - Chặn lại bằng lỗi `409 Conflict` nếu trạng thái hiện tại khác `TRASH`.
  - Thực hiện xóa cứng sản phẩm khỏi DB, tự động xóa liên đới các bảng liên quan (variants, gallery, v.v.) và xóa tham chiếu khỏi `home_category_highlights`.

### 2. Categories (Danh mục)

**Quyền:** mọi route đọc bên dưới cần `catalog.read`; mọi route ghi cần `catalog.update`, trừ preview impact chỉ đọc cần `catalog.read`. Không có permission key Category riêng.

**Danh sách và cây:**
- `GET /api/v1/admin/categories?page=&size=&sort=&q=&visibility=&deleted=&lang=` trả phân trang `CategoryResponse[]`. `visibility` là `VISIBLE|HIDDEN` và tùy chọn; khi bỏ qua trả cả hai trạng thái. `deleted` mặc định `false` và độc lập với `visibility`. `lang` là `vi|en`, mặc định `vi`, áp dụng fallback từng field theo `CATEGORY_RULE_002`.
- `GET /api/v1/admin/categories/tree?lang=vi|en` trả cây Category không ở Trash, dùng để chọn cha và sắp xếp; không dùng trong Trash.
- `GET /api/v1/admin/categories/{id}` trả chi tiết Category gồm translations, asset theo vai trò, SEO, `isVisible`, `deleted`, `showOnHomepage`, parent và timestamps. API hiện không có `productCount` trên Category response.

**Ghi:**
- `POST /api/v1/admin/categories` và `PATCH /api/v1/admin/categories/{id}` nhận `UpsertCategoryRequest`: name/slug VI, `translations.en.name` bắt buộc khi field name được tạo/sửa, `slugEn` tùy chọn, parent, mô tả/intro/SEO song ngữ, asset theo vai trò, `sortOrder` và `showOnHomepage`.
- **Ảnh theo vai trò** (`image` thumbnail lưới, `icon` hero, `menuIcon` icon menu, `banner` hero desktop, `mobileBanner` hero mobile): tất cả đi qua whitelist kho ảnh MinIO theo `BUSINESS_RULES.md` `MEDIA_RULE_002`, có tha URL cũ đang lưu trên bản ghi; URL mới ngoài `/media/`·`/media-proxy/`·base MinIO bị chặn `400 INVALID_VALUE` với `field` = `<vai trò>.url`. Gửi `url: ""`/`null` để xóa ảnh. `alt` bị ghi đè mỗi lần lưu nên form luôn gửi kèm (audit 2026-07-28 — trước đó `banner`/`mobileBanner` **không** được máy chủ kiểm whitelist dù form đã kiểm định dạng, để lọt ảnh hero trỏ host ngoài).
- **Xóa mô tả / khối giới thiệu**: `description` và `introContent` theo presence-flag — **không gửi** field thì giữ nguyên, gửi chuỗi rỗng `""` thì xóa. Form quản trị luôn gửi cả hai (kể cả rỗng) để admin xóa được nội dung cũ, cùng cách form luôn gửi khối `seo`.
- `isVisible` là patch trạng thái riêng (`PATCH /{id}`); ẩn Category có con trực tiếp đang hiển thị trả `409` với hướng dẫn ẩn hoặc chuyển cha cho con trước. Không áp dụng kiểm tra đệ quy.
- `showOnHomepage` độc lập với `isVisible` và `deleted`, mặc định `false`. Create client không gửi field ở giá trị mặc định; PATCH bỏ field giữ nguyên. `seo` bị bỏ qua thì giữ nguyên, SEO được gửi với text trống được chuẩn hóa thành `null`, và `seo: {}` xóa toàn bộ SEO cũ gồm ảnh chia sẻ.
- `uncategorized` được trả trong danh sách admin nhưng mọi route ghi cho record này (kể cả restore) trả `409`.

**Mã lỗi chung:** `403` thiếu quyền, `404` không có Category, `409` cho vòng lặp cha-con, con trực tiếp còn hiển thị, Category chưa ở Trash khi xóa vĩnh viễn, hoặc Category hệ thống bị khóa. Client phải hiển thị từng nguyên nhân thay vì gộp chung.

- **Xóa mềm**: `DELETE /api/v1/admin/categories/{id}`
  - Đặt `deleted = true` trên danh mục mục tiêu và toàn bộ cây con của nó. Không chuyển sản phẩm.
- **Khôi phục**: `POST /api/v1/admin/categories/{id}/restore`
  - Đặt `deleted = false` trên danh mục mục tiêu và toàn bộ cây con của nó.
  - Trả `409` cho `uncategorized` vì Category hệ thống bị khóa cho mọi ghi.
- **Xóa vĩnh viễn**: `DELETE /api/v1/admin/categories/{id}/permanent`
  - Chặn lại bằng lỗi `409 Conflict` nếu danh mục chưa được xóa mềm (`deleted == false`).
  - Gỡ các liên kết thuộc cây danh mục bị xóa; chỉ sản phẩm không còn bất kỳ liên kết danh mục nào mới được gán danh mục hệ thống "Chưa phân loại" (`uncategorized`).
  - Thực hiện xóa cứng danh mục và toàn bộ cây con.
  - Chặn (409) mọi thao tác xóa (mềm/cứng) đối với danh mục hệ thống `uncategorized`.
- **Xem trước ảnh hưởng xóa vĩnh viễn**: `POST /api/v1/admin/categories/permanent-delete-impact`
  - Request: `{ "categoryIds": string[] }` (1–100 mã danh mục trong Thùng rác).
  - Response: `{ data: { requestedCategoryCount, rootCategoryIds, descendantCategoryCount, affectedProductCount, reassignedProductCount } }`. `affectedProductCount` là số sản phẩm bị gỡ liên kết trong cây xóa; `reassignedProductCount` là tập con không còn danh mục nào nên nhận `uncategorized`.
  - `rootCategoryIds` loại các mục đã nằm dưới một danh mục khác trong cùng lựa chọn để luồng xóa hàng loạt không xóa trùng cây.
  - `descendantCategoryCount` là tổng số danh mục con trong hợp của các cây sẽ xóa; `affectedProductCount` là số sản phẩm duy nhất có liên kết bị gỡ, còn `reassignedProductCount` là tập con thực sự chuyển sang `uncategorized`.
  - Trả `404` nếu có mã không tồn tại; trả `409` nếu có danh mục chưa nằm trong Thùng rác hoặc là danh mục hệ thống `uncategorized`.
  - Admin phải gọi phép xem trước này trước hộp xác nhận xóa đơn lẻ/hàng loạt và hiển thị **đồng thời** hai số đếm theo `BUSINESS_RULES.md` `CATEGORY_RULE_004`.

### 3. Brands (Thương hiệu)
- **Ảnh thương hiệu** (`POST/PATCH /api/v1/admin/brands`): 3 field ảnh đơn `logo`, `banner`, `mobileBanner` (shape `ImageAssetRequest`: `url`, `alt`, `width`, `height`, `mimeType`). Cả 3 đi qua whitelist kho ảnh MinIO theo `BUSINESS_RULES.md` `MEDIA_RULE_002`, có tha URL cũ đang lưu trên bản ghi; URL mới ngoài `/media/`·`/media-proxy/`·base MinIO bị chặn `400 INVALID_VALUE` với `field` = `logo.url`/`banner.url`/`mobileBanner.url`. Gửi `url: ""` để xóa ảnh. **`alt` phải được gửi kèm mỗi lần lưu**: field không gửi bị ghi `null`, nên form quản trị luôn gửi cả `url` và `alt` (audit 2026-07-28 — trước đó form bỏ `alt`, làm mất chữ thay-thế-ảnh admin vừa nhập ngay ở lần lưu đó).
- **Xóa mô tả**: `description` theo presence-flag — **không gửi** field thì giữ nguyên mô tả cũ, gửi chuỗi rỗng `""` thì xóa. Form quản trị luôn gửi `description` (kể cả rỗng) để admin xóa được mô tả cũ, cùng cách form luôn gửi khối `seo`.
- **Sửa SEO**: `PATCH /api/v1/admin/brands/{id}` giữ nguyên SEO hiện có khi request **không gửi** field `seo`; nếu gửi `seo`, từng giá trị trống được chuẩn hóa thành `null`, và `seo: {}` xóa toàn bộ SEO cũ (gồm ảnh chia sẻ). Form quản trị luôn gửi khối `seo` khi lưu để thao tác xóa hết các ô được ghi nhận rõ ràng, thay vì bị hiểu nhầm là không chỉnh sửa.
- **Đặt trên trang chủ**: `POST/PATCH /api/v1/admin/brands` nhận field `showOnHomepage` (boolean, mặc định `true`). Field này chỉ điều khiển dải logo thương hiệu ở trang chủ; không ẩn thương hiệu khỏi `/brands`, `/brands/{slug}`, facet thương hiệu hoặc brand nhúng trong sản phẩm.
- **Danh sách public**: `GET /api/v1/brands` nhận query param tùy chọn `showOnHomepage` (boolean). Chỉ khi truyền `true` hoặc `false` thì danh sách mới lọc theo cờ homepage; khi bỏ qua, danh sách vẫn chỉ loại Brand có `isVisible = false` theo quy tắc public hiện tại. Response Brand trả thêm `showOnHomepage`.
- **Xóa mềm (Ẩn)**: `DELETE /api/v1/admin/brands/{id}`
  - Đặt `isVisible = false`.
- **Không đổi visibility qua upsert**: `POST/PATCH /api/v1/admin/brands` không nhận `visible`/`isVisible` để chuyển trạng thái. Brand mới luôn hiển thị; chỉ endpoint xóa mềm ở trên mới đưa Brand vào Thùng rác.
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
- **Nơi đang sử dụng**: `GET /api/v1/admin/media/{id}/references`
  - Mỗi tham chiếu trả `type`, `id`, `name`, `adminPath`.
  - `adminPath` chỉ được trỏ tới route quản trị hợp lệ dưới `/admin`; tham chiếu sản phẩm và ảnh/biến thể của sản phẩm mở `/admin/products/{productId}`.
  - Nếu không xác định được route quản trị an toàn hoặc entity không còn tồn tại thì client hiển thị tên tham chiếu dạng chỉ đọc, không điều hướng sang route public hoặc route 404.
- **Xóa mềm**: `DELETE /api/v1/admin/media/{id}`
  - Đặt `status = "DELETED"`.
- **Khôi phục**: `POST /api/v1/admin/media/{id}/restore`
  - Đặt `status = "ACTIVE"`.
- **Xóa vĩnh viễn**: `DELETE /api/v1/admin/media/{id}?permanent=true`
  - Chặn lại bằng lỗi `409 Conflict` nếu trạng thái hiện tại khác `DELETED`.
  - Chặn lại bằng lỗi `409 Conflict` nếu ảnh đang được dùng.
  - Thực hiện xóa cứng khỏi DB và xóa tệp khỏi MinIO.

## Homepage Slider Contract

| Endpoint | Permission | Current behavior | Status | Evidence |
|---|---|---|---|---|
| `GET /api/v1/admin/sliders?location=home` | `sliders.read` | Trả danh sách banner trang chủ gồm `desktopImage` và `mobileImage` tùy chọn. | `OWNER_CONFIRMED_2026-07-30` | `AdminSliderController.java`, `SliderReadService.java` |
| `POST /api/v1/admin/sliders` | `sliders.write` + `products.read` + `media.read` | Tạo slider mới. `location` chỉ nhận `home`; `desktopImage` và `mobileImage` dùng `ImageAssetRequest`, trong đó ảnh mobile là tùy chọn. | `OWNER_CONFIRMED_2026-07-31` | `AdminSliderController.java`, `AdminSliderService.java` |
| `PATCH /api/v1/admin/sliders/{id}` | Full edit: `sliders.write` + `products.read` + `media.read`; partial toggle/order: `sliders.write` | Bản sửa toàn phần (có `location`) thay thế dữ liệu ảnh. `mobileImage: { "url": "...", "alt": "..." }` lưu ảnh mobile; `mobileImage: null` xóa ảnh mobile và response trả `mobileImage: null`. Patch chỉ đổi trạng thái/thứ tự không đụng dữ liệu ảnh. | `OWNER_CONFIRMED_2026-07-31` | `PatchSliderRequest.java`, `AdminSliderController.java`, `AdminSliderService.java` |
| `POST /api/v1/admin/sliders/reorder` | `sliders.write` | Sắp xếp lại slider trong location `home`. | `CONFIRMED_FROM_CODE` | `AdminSliderController.java`, `AdminSliderService.java` |
| `DELETE /api/v1/admin/sliders/{id}` | `sliders.write` | Xóa slider. | `CONFIRMED_FROM_CODE` | `AdminSliderController.java`, `AdminSliderService.java` |

Ảnh slider tiếp tục đi qua `SafeMediaAssetUrlPolicy`. `POST` và bản `PATCH` toàn phần (payload có `location`) bắt buộc có `productId` hợp lệ; không còn nhận hoặc validate `externalLink` trong luồng ghi mới. Cột và field response `externalLink` vẫn được giữ để bảo toàn dữ liệu lịch sử, nhưng chỉ mang tính tương thích và không được dùng làm `link` hiệu lực trên storefront; `link` hiệu lực chỉ là `productLink`. Patch một phần chỉ đổi trạng thái/thứ tự không yêu cầu `productId`. Mọi create/update/delete/reorder tiếp tục phát revalidation tag `sliders`. Quyết định 2026-07-30 chỉ khôi phục ảnh mobile cho `home`, không khôi phục `category`, `category_sidebar` hoặc `promotion`.

## Commerce Mutation Contracts

| Endpoint | Current contract | Status | Evidence |
|---|---|---|---|
| `POST /api/v1/checkout` | Revalidates price/availability state and creates order/payment rows. Availability is gated per-variant by `isAvailable` (boolean), or by `stockState` for no-variant products; there is **no quantity decrement** (V261). The old product-level `forceOutOfStock` hard override (`STOCK_RULE_004`) was removed (V342, 2026-07-19). Billing **and** resolved shipping address require `province` + `ward` + `addressLine1` (two-tier VN address; blank strings in a custom shipping block fall back to billing). No shipping-method choice and **no shipping fee** (`shippingAmount = 0`, owner decision 2026-06-23, `SHIP_RULE_001`). `paymentMethod` accepts `COD` or `BANK_TRANSFER`; omitted is normalised to `COD` and any other explicit code is rejected (`PAY_RULE_001`, owner decision 2026-07-21). | `CONFIRMED_FROM_CODE` | `CheckoutService.java`, `CheckoutSupport.java`, checkout tests |
> **Removed (2026-07-15).** `POST /api/v1/orders/quick-buy` (single-item direct purchase) was deleted — endpoint, `CheckoutService.quickBuy`, `QuickBuyRequest` DTO, security matcher and tests (owner decision, reversing AUD-010). The storefront has no quick-buy entry point; customers order through the cart.

> **Removed (2026-06-23, online-only).** `POST /api/v1/admin/pos/orders` (immediate in-store sale) and `GET /api/v1/admin/pos/products/search` (POS product search) were deleted along with the POS module. See "POS Contract" below.

## Checkout Options Contract — REMAINS REMOVED (2026-07-21)

`GET /api/v1/checkout/options` không được khôi phục. Owner đã chốt đúng hai lựa chọn storefront
ổn định là `COD` và `BANK_TRANSFER`; web hiển thị cố định hai lựa chọn này và backend vẫn là lớp
kiểm soát cuối ở `POST /checkout`, nên không cần endpoint danh sách động. Các quy tắc thanh toán/vận
chuyển được enforce ở `POST /checkout`:
- `paymentMethod` omitted → normalise thành `COD`; `COD`/`BANK_TRANSFER` → hợp lệ; mã khác
  (kể cả `BACS`) → `400 VALIDATION_ERROR`. `BANK_TRANSFER` là mã mới, tách khỏi logic legacy
  `BACS`. Đơn cũ mang `BACS`/`null` vẫn đọc/hiển thị bình thường. Không có cổng thanh toán tự động.
- Shipping method đã gỡ từ 2026-06-23 (`SHIP_RULE_001`, `V264`): không chọn phương thức, không phí
  (`shippingAmount = 0`), field `shippingMethodId` bị bỏ (client cũ gửi lên sẽ bị ignore).

Status: `REMOVED` | Evidence: commit gỡ `CheckoutController.getOptions` + `CheckoutOptionsResponse.java`; contract hiện tại tại `CheckoutSupport.java`, `CheckoutService.java`, `Phase1FCheckoutApiTest`

## Dashboard Contract

| Endpoint | Permission | Current behavior | Status | Evidence |
|---|---|---|---|---|
| `GET /api/v1/admin/dashboard?period={7d\|30d\|90d}` | `orders.read` only; no exact-role restriction | Returns KPI aggregates, revenue series, order-status breakdown, recent orders, top products. Revenue excludes `CANCELLED` orders (`FAILED` removed 2026-07-21). Default period: `30d`. | `OWNER_CONFIRMED_2026-07-31` | `AdminDashboardController.java`, `AdminDashboardService.java` |

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
| `GET /api/v1/admin/reports/orders/export?q=...&status=...&from=...&to=...` | `reports.export` | Exports every order matching the current Orders-screen search/status/date filters to a UTF-8 BOM CSV file. `from`/`to` are inclusive Vietnam calendar dates and the export is not capped at 10,000 rows. | `CONFIRMED_FROM_CODE` | `ORDER_RULE_011`, `ORDER_RULE_012`, `AdminOrderCsvExportService.java` |
| `GET /api/v1/admin/reports/customers/export?q=...&status=...&synthetic=...&emailVerified=...` | `reports.export` | Exports every customer matching the current Customers-screen search/status/synthetic/email-verification filters to a UTF-8 BOM CSV file. The export is streamed across all pages and has no 10,000-row cap. | `CONFIRMED_BACKEND_ENFORCED` | `CUSTOMER_RULE_009`, `AdminReportController.java`, `AdminCustomerCsvExportService.java` |

**Custom range limit (frontend-only, `REPORT_RULE_011`):** The admin UI restricts the custom `from`/`to` range picker on the Reports screen to a maximum 90-day span. This is not enforced by `/analytics` itself, which only validates `from <= to`.

### Analytics Response Shape
Returns `AdminAnalyticsResponse`. The `PeriodSummary` object inside `summary` contains:
- `grossOrderValue`: GMV: SUM(totalAmount) excl CANCELLED.
- `paidRevenue`: SUM(totalAmount) where status = COMPLETED; response name retained for compatibility.
- `orderCount`: count of orders excl CANCELLED.
- `avgOrderValue`: grossOrderValue / orderCount (or 0 if orderCount = 0).
*(Note: `refundAmount` and `netRevenue` metrics were removed on 2026-07-04 as the refund feature is retired. `FAILED` was removed as an order status on 2026-07-21 — old `FAILED` orders were migrated to `CANCELLED`.)*

### Order Export Format
The CSV file generated by `/api/v1/admin/reports/orders/export` contains the following headers in order:
- `order_number`, `status`, `customer_email`, `customer_phone`, `currency`, `subtotal`, `shipping`, `total`, `paid_amount`, `placed_at`, `paid_at`, `completed_at`, `cancelled_at`
*(Note: the `"discount"` column was removed on 2026-07-04 as promotion codes/discounts are retired).*

The export applies `q` to the same case-insensitive fields as the Orders list
(order number/key and customer email/phone), applies `status`, and interprets
`from`/`to` at `Asia/Ho_Chi_Minh` day boundaries. It exports every match across
all pages with no silent row cap.

### Customer Export Format
The CSV file generated by `/api/v1/admin/reports/customers/export` contains the following headers in order:
- `id`, `email`, `phone`, `display_name`, `first_name`, `last_name`, `status`, `gender`, `email_verified_at`, `last_login_at`, `created_at`

The export applies `q` to the same case-insensitive literal-substring fields as the Customers list
(`email`, `phone`, `displayName`), applies `status`, `synthetic`, and `emailVerified`, and exports
every matching row across all pages without silent truncation. The response declares
`X-Export-Uncapped: true`.

## Admin Catalog Contract

### Product admin lifecycle endpoints

| Method | Path | Permission | Contract |
|---|---|---|---|
| `GET` | `/api/v1/admin/products` | `products.read` | Paginated operational list with search, category/brand, publish/stock/homepage/gender filters and sorting. |
| `GET` | `/api/v1/admin/products/{id}` | `products.read` | Full bilingual edit payload, including media metadata, variants and current lifecycle state. |
| `POST` | `/api/v1/admin/products` | `products.update` | Creates a product in `DRAFT`. A create payload cannot publish the product. |
| `PATCH` | `/api/v1/admin/products/{id}` | `products.update` | Saves content without changing lifecycle: a `DRAFT` remains `DRAFT`, and a `PUBLISHED` product remains `PUBLISHED`. |
| `POST` | `/api/v1/admin/products/preview?lang=vi\|en` | `products.update` | Dry-run storefront render. `lang` accepts only `vi` or `en`; any other value is a validation error. |
| `PATCH` | `/api/v1/admin/products/{id}/publish` | `products.update` | The only active publish/unpublish action. Body selects `DRAFT` or `PUBLISHED`; Product List and Product Detail may both trigger it. `DRAFT → PUBLISHED` uses the shared publish-readiness checklist; `PUBLISHED → DRAFT` requires a clear confirmation on Product Detail. |
| `DELETE` | `/api/v1/admin/products/{id}` | `products.update` | Soft-deletes to `TRASH`. |
| `POST` | `/api/v1/admin/products/{id}/restore` | `products.update` | Restores `TRASH` to `DRAFT`. |
| `DELETE` | `/api/v1/admin/products/{id}/permanent` | `products.update` | Permanently deletes a trashed product. |
| `POST` | `/api/v1/admin/products/homepage-blocks` | `products.update` | Atomically replaces the ordered featured-product placement. |

Publishing is deliberately separate from ordinary create/save (`PRODUCT_RULE_005`):
the detail form's Save action only saves content, while Product List and Product
Detail may both trigger the dedicated `/publish` action. Product Detail blocks
the action while its form has unsaved changes. The backend contract is unchanged:
create/update cannot perform the lifecycle transition, and only this endpoint
changes `DRAFT ↔ PUBLISHED`.

### Full product catalog CSV export

`GET /api/v1/admin/products/export.csv` is the authoritative full-catalog export used by the Product module's **"Xuất CSV"** action. It requires `reports.export`, records an audit event, accepts **no filters or pagination**, and exports every product currently stored in the catalog, including `DRAFT` and `TRASH` rows. It is streamed in deterministic `id` order; there is no 10,000-row (or other silent) truncation limit.

The response is `text/csv; charset=UTF-8`, has a UTF-8 BOM for Excel, and sets a `Content-Disposition` attachment filename. One CSV row represents one product. Scalar data is emitted in these columns, in order:

`id`, `legacy_id`, `sku`, `slug`, `slug_en`, `name_vi`, `name_en`, `short_description_vi`, `short_description_en`, `description_vi`, `description_en`, `category_ids`, `category_slugs`, `category_names_vi`, `category_names_en`, `brand_id`, `brand_slug`, `brand_name`, `image_id`, `image_url`, `image_alt`, `image_width`, `image_height`, `image_mime_type`, `retail_price`, `sale_price`, `currency`, `stock_state`, `stock_quantity`, `manage_stock`, `backorders`, `length_cm`, `width_cm`, `height_cm`, `available`, `discount_percent_override`, `publish_status`, `homepage_block`, `homepage_order`, `rating`, `rating_count`, `pdp_shipping_line`, `pdp_return_line`, `origin_brand_country_vi`, `origin_brand_country_en`, `size_guide_vi`, `size_guide_en`, `suitability_advisory_vi`, `suitability_advisory_en`, `specifications_vi`, `specifications_en`, `spec_stats_vi`, `spec_stats_en`, `trust_badges_vi`, `trust_badges_en`, `quick_answer_summary_vi`, `quick_answer_summary_en`, `gender`, `seo_title_vi`, `seo_title_en`, `seo_description_vi`, `seo_description_en`, `seo_canonical_url`, `seo_og_image_id`, `seo_og_image_url`, `seo_og_image_alt`, `seo_og_image_width`, `seo_og_image_height`, `seo_og_image_mime_type`, `created_at`, `updated_at`, `version`.

The four plural category columns preserve every ordered category as a
pipe-separated value; the first entry remains the primary category. They are not
singular fields because one product may belong to multiple categories.

The following columns hold valid compact JSON strings, so nested/multi-row contract data is preserved without flattening or omission: `description_blocks_json`, `suitability_section_json`, `size_guide_section_json`, `faqs_json`, `commitments_json`, `highlights_json`, `gallery_json`, `videos_json`, `variants_json`, `related_products_json`, `accessory_products_json`.

`variants_json` preserves each variant's ID, SKU, generated name, own price/currency/stock state/availability/legacy quantity/sort order, cover image, ordered options (including attribute/value identifiers and bilingual labels when present), and ordered mixed-media gallery. `related_products_json` and `accessory_products_json` preserve order and identifying/list-view data for every linked product. All strings, including JSON strings, use the common CSV formula-injection protection before CSV quoting.

Status: `CONFIRMED_FROM_CODE`

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

**Auto-clear on unpublish (owner decision 2026-07-28, `BUSINESS_RULES.md` `PRODUCT_RULE_015`):** whenever a product's `publishStatus` leaves `PUBLISHED` — via `PATCH /admin/products/{id}/publish-status`, `DELETE /admin/products/{id}` (soft delete), or a `PATCH /admin/products/{id}` that changes the status — the server resets `homepageBlock` to `NONE` and `homepageOrder` to `null`. Re-publishing does not restore the placement. This keeps `POST /admin/products/homepage-blocks` from being permanently blocked by a stale non-`PUBLISHED` id.

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

Resolution happens per-request: the full category set is loaded and walked via BFS from the requested category id/slug to collect self + descendant ids. The product query matches **any** `product_category_map.category_id` in that set and is distinct at product level, so a product linked to several matching categories occurs once only. An invalid/unresolvable category slug on the public endpoint yields zero results.

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
| `stockState`, `available`, `rating`, `ratingCount`, `homepageBlock`, `homepageOrder` | ✅ present | ✅ present |
| **Note (V261):** `stockQuantity` / `quantityOnHand` are absent from the product and variant API shapes — availability is boolean. The storefront shows only "Còn hàng / Hết hàng" from `stockState`; the old "Chỉ còn N sản phẩm" low-stock message was removed. | | |
| `description`, `suitabilityAdvisory` | ❌ `null` | ✅ present |
| `originBrandCountry`, `sizeGuide`, `specifications`, `specStats`, `trustBadges`, `suitabilitySection`, `sizeGuideSection` | ❌ `null` | ✅ present |
| `gallery`, `videos`, `faqs`, `commitments` | ❌ `[]` | ✅ present |
| `highlights` (object `{ positiveNotes: [], negativeNotes: [] }`, gộp 2 field cũ — 2026-07-07) | ❌ cả 2 mảng con rỗng | ✅ present |
| `videos[].description` | — | ✅ present (detail) |
| `seo` | ❌ `null` | ✅ present |
| `variants` | ✅ present as **stubs** | ✅ full |
| `variants[].id/sku/name/price/stockState/isAvailable` | ✅ present | ✅ present |
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
- **Editing a variant's colour value in the admin (e.g. `Đen` → `Đen bóng`)** never drops the variant's images. The admin editor resolves the media the variant carries after the colour change (`resolveColorChangeMedia` in `constants.js`): if the **target colour group already has images** on another variant, the edited variant **inherits** that group's representation image + gallery (colour-scoped consistency); if the target colour group has **no images yet**, the variant **keeps its existing** representation image + gallery, which then seed the new colour group. Only removing the colour attribute entirely clears the media (a colourless variant carries none, matching `applyVariants`). There is no longer any confirmation prompt warning that a colour change deletes images.

Status: `CONFIRMED_FROM_CODE`
Evidence: `VariantRequest.java` (`imageUrl`/`imageAlt` fields), `AdminCatalogMutationService.applyVariants` (color-scoped application), `VariantGalleryRoundtripTest`, `bigbike-admin/src/screens/product-detail/constants.js` (`resolveColorChangeMedia`, `withColorScopedMedia`), `bigbike-admin/src/screens/product-detail/VariantEditors.jsx` (`updateVariant` colour-key branch).

### Variant display name — derived from attribute options (no separate input)

The variant display name (`variants[].name`) is **always derived server-side from the variant's attribute option values** (e.g. `"Đen bóng - XL"`), joined in option order and preferring each option's dictionary label over its raw value. It is **not** entered separately by admins.

- **Upsert request** (`POST` / `PATCH /api/v1/admin/products`): the request body **no longer accepts** `variants[].name`. The field was removed from `VariantRequest`. On save, the backend computes it from `variants[].options[]` after resolving each option's dictionary link — same precedence the read path uses to return the human label (`attributeValueId` resolution, see "Variant option — admin round-trip field" above).
- **Response**: `variants[].name` still returns the computed string; re-saving always recomputes it from the current options, so it can never drift out of sync with them.
- **Rationale**: a separately-typed name could diverge from the variant's actual attributes (stale after a color/size edit), which is exactly what motivated removing it — same pattern as the variant cover image below.

Status: `CONFIRMED_FROM_CODE`

Evidence: `VariantRequest.java` (no `name` field), `AdminCatalogMutationService.applyVariants` / `deriveVariantName`, `V297__derive_variant_name_from_options.sql` (legacy backfill).

### Product upsert — `stockState` derived from product-form availability

`POST /api/v1/admin/products` and `PATCH /api/v1/admin/products/{id}` do **not** accept `stockState` directly. The product form instead sends the manual availability inputs it owns: product-level `available` (no-variant products only; renamed from `forceOutOfStock` in V342 — the hard-override behavior for products WITH variants was removed) and `variants[].isAvailable`. Backend derives `stockState` on every save: no-variant product mirrors `available`; product with variants is `IN_STOCK` when any variant is available. This product-form mutation is gated by `products.update`.

- On create/update, backend ignores direct `stockState` input because the DTO has no setter.
- Admin form renders Còn/Hết switches and persists them in the normal product upsert payload.
- The former standalone Inventory availability endpoints were removed 2026-07-15 (AUD-056) — the product-form upsert is now the ONLY availability mutation path.

Status: `CONFIRMED_BACKEND_ENFORCED`

Evidence: `UpsertProductRequest.java` (`available`, no `stockState` setter), `VariantRequest.java` (`isAvailable`), `ProductMutationService` + `InventoryPolicyService.recomputeProductState`, admin `VariantEditors.jsx`/product form.

### Inventory — read-only endpoints (boolean availability model, V261)

Inventory availability is a **boolean** set by the admin **inside the product form** (see the
`stockState` derivation section above — `products.update`). The backend keeps only two read
endpoints and one realtime notification topic, all gated by `inventory.read`:

| Endpoint | Current behavior |
|---|---|
| `GET /api/v1/admin/inventory` | Flat stock list (variants + no-variant products), filter `q`/`stockState`, paginated. Carries `available: boolean` (no quantities). |
| WebSocket `/topic/admin/inventory` | `INVENTORY_STATE_CHANGED` after-commit event when a product or variant changes between `IN_STOCK` and `OUT_OF_STOCK`; gated by `inventory.read`. The Dashboard invalidates `['inventory-summary']` and keeps 90-second polling as fallback. |
| `GET /api/v1/admin/inventory/summary` | `{ totalItems, inStockCount, outOfStockCount }` — powers the Dashboard "Hết hàng" alert. |

**Removed (2026-07-15, AUD-056, owner decision #8):** `GET /grouped`, `GET /movements`,
`GET /variants/{id}/movements`, `GET /products/{id}/movements`, `GET /export.csv`,
`PATCH /variants/{id}/availability`, `PATCH /products/{id}/availability` — không có caller từ khi
màn "Kho hàng" độc lập bị gỡ (2026-06-23), không có mobile/client ngoài. `inventory.write` không còn
endpoint nào sử dụng và bị xóa khỏi catalog/role grants từ 2026-07-31 (`V364__remove_orphan_inventory_write_permission.sql`).

There is **no auto-decrement on sale and no restore on cancel** — selling does not change availability, so the admin must manually toggle an item to "Hết hàng" when it sells out (overselling is not auto-prevented).

Status: `CONFIRMED_FROM_CODE`

Evidence: `AdminInventoryController.java`, `AdminInventoryService.java`, `V261__inventory_availability_toggle.sql`.

### Product preview — admin dry-run render (`POST /api/v1/admin/products/preview`)

Powers the **live preview** in the product editor: render exactly what the storefront PDP will show for the *current, unsaved* form input, without persisting anything.

| Aspect | Value |
|---|---|
| Permission | `products.update` (same as create/edit — the body is a full upsert payload and preview is a sub-step of authoring) |
| Request | `UpsertProductRequest` (byte-for-byte identical to `POST /api/v1/admin/products`) + optional `?lang=vi\|en` (default `vi`; any other value returns `400 VALIDATION_ERROR`) |
| Response | `ApiDataResponse<Product>` — the **public** product shape (`publicView=true`: `costPrice` hidden, stock quantity masked), identical to `GET /api/v1/products/{slug}` |

- **No persistence.** Backend validates the payload, builds a transient `ProductEntity` in memory via `applyProductPatch` (never `save`d), and maps it through the same detail mapper the storefront uses. No row is created or updated; the method is `@Transactional(readOnly = true)`.
- **Validation mirrors create** (category required, slug rules, price/variant constraints) so the editor surfaces the same `400 VALIDATION_ERROR` live — **except slug uniqueness**, which is a persistence concern and is skipped for the dry-run. Without that carve-out, previewing an existing product would flag its own saved slug as a `DUPLICATE` and always `400`.
- **Transient-only fields:** `rating`/`ratingCount` are `null` (a brand-new draft has no reviews); curated `relatedProducts` resolve read-only from their IDs.

Status: `CONFIRMED_FROM_CODE`

Evidence: `AdminCatalogController.previewProduct`, `AdminCatalogMutationService.previewProduct` (transient build + no `save`), `JpaCatalogReadRepository.mapPreviewProduct` (public wrapper over `toDomain(entity, true, locale)`), `AdminCatalogMutationService.applyProductPatch` (pure in-memory entity build; its sole repo touch — `resolveRelatedProducts` — is a read).

### `seo.canonicalUrl` — host allowlist on every upsert (2026-07-08)

`seo.canonicalUrl` is validated on **every** Product/Category/Brand upsert (`CatalogRequestValidator.validateProductRequest`/`validateCategoryRequest`/`validateBrandRequest`, all three call the shared `AdminMutationValidators.validateSeoMeta`) and every Article upsert (`ContentRequestValidator`) — including **preview**, which shares the exact same call with no carve-out for this field (unlike slug uniqueness, see "Product preview" above).

Rule (`AdminMutationValidators.validatePublicUrl`): the URL must be `http(s)` and its **host** must be either:
- `bigbike.vn` or `www.bigbike.vn` (always allowed),
- `103.1.236.148` (owner-approved VPS/storefront IP used by the product JSON template, including `:3000` URLs), or
- `localhost` or `127.0.0.1` (allowed **only** when the backend's active Spring profile is `dev`/`mock`/`test`/`local` — `CatalogRequestValidator.isDev`/`ContentRequestValidator.isDev`, read from `Environment.getActiveProfiles()`).

Any other host → `400 VALIDATION_ERROR` `field=seo.canonicalUrl, code=INVALID_VALUE, message="Canonical URL must belong to bigbike.vn, www.bigbike.vn, or 103.1.236.148."` — **on both preview and the real save**, since the rule is not preview-specific.

**Frontend contract this implies (`bigbike-admin`):** the product form never lets the admin type a canonical URL — `canonicalUrlFromSlug()` (`bigbike-admin/src/screens/product-detail/constants.js`) auto-derives it from the slug. Its base URL MUST resolve to `https://bigbike.vn` (or a literal `localhost`/`127.0.0.1` origin) to ever pass the rule above — it must **not** blindly reuse `VITE_STOREFRONT_BASE_URL`, because that env var is independently dedicated to the live-preview iframe's `src` (see "Admin storefront-preview URL" gotcha — on a VPS it is deliberately pinned to the server's public IP to dodge a Private Network Access block, not to the production domain). Conflating the two: any environment where `VITE_STOREFRONT_BASE_URL` is neither `bigbike.vn` nor `localhost`/`127.0.0.1` (e.g. a VPS IP) makes **every** product preview and save fail this check. This exact incident happened 2026-07-08 (host-allowlist rule shipped in a same-day refactor, `canonicalUrlFromSlug`'s reuse of `VITE_STOREFRONT_BASE_URL` had existed since 2026-06-21 with no backend host check to conflict with until then) — fixed by having `canonicalUrlFromSlug`'s base resolve the env var's host itself and fall back to `https://bigbike.vn` unless that host is literally `localhost`/`127.0.0.1`.

Status: `CONFIRMED_FROM_CODE`

Evidence: `AdminMutationValidators.validatePublicUrl`/`validateSeoMeta`, `CatalogRequestValidator` (`isDev` field + 3 call sites), `ContentRequestValidator` (`isDev` field), `bigbike-admin/src/screens/product-detail/constants.js` (`canonicalUrlFromSlug`, `PRODUCT_STOREFRONT_BASE`).

### Bulk product import — JSON (V2026-07-04; CSV path removed V2026-07-06)

Lets a shop owner create/update many products at once from a single JSON file (typically ChatGPT/Claude-generated) instead of one-by-one via the form. Two-step flow: validate (dry-run report) → commit (actually saves). **CSV was removed on 2026-07-06** — a JSON object already carries the full product (goods *and* rich content), so the earlier goods-in-CSV + content-in-JSON split was collapsed to one JSON format; the `type` param is gone.

| Aspect | Value |
|---|---|
| Permission | `products.update` (same domain as every other product-write endpoint — see `PERMISSION_MATRIX.md` "Catalog / Product permissions") |
| `POST /api/v1/admin/products/import/validate` | multipart `file` (a JSON array of `ProductImportRow`). Parses + resolves references + runs the same validation `POST /api/v1/admin/products` would, but never persists. Returns `ImportReportResponse`. |
| `POST /api/v1/admin/products/import/commit` | Same multipart contract (client re-sends the identical file it already validated — stateless, no server-side temp storage between calls) + optional `skipRowKeys` (comma-separated) to exclude rows the admin unchecked in the review table. For each row that still validates clean, calls the real `createProduct`/`updateProduct` directly — zero drift from the single-product API. Each row commits (or fails) independently; one bad row never rolls back rows already saved earlier in the same file. |
| `GET /api/v1/admin/products/import/export/{id}` | Same round-trip shape, scoped to **one product** — a one-element `ProductImportRow[]` array (not a bare object) so the file re-imports unchanged. Filename is `product-{sku}.json`. `404 NOT_FOUND` if `id` doesn't match a product. Added V2026-07-06 for a per-product "Export JSON" button on the product detail screen (`ProductDetailScreen.jsx`). The former catalog-wide download was removed on 2026-07-19. |

`ImportRowResult.rowKey` includes the one-based JSON row number plus its SKU/slug fallback. The key is stable when the identical file is re-sent and stays unique even when two rows repeat the same SKU; the admin must send back the exact keys returned by validate in `skipRowKeys`.

**JSON row shape (V2026-07-22): `ProductImportRow`, a dedicated wire DTO — not `UpsertProductRequest` anymore.** Every bilingual column is nested as one VI/EN object at its own key (e.g. `name: {nameVI, nameEN}`, `seo: {titleVI, titleEN, descriptionVI, descriptionEN, canonicalUrl}`). The canonical category field is ordered `categorySlugs: string[]`; import also accepts `categoryIds: string[]` when `categorySlugs` is absent. Both are resolved in order, duplicate entries are collapsed to the first occurrence, and an invalid, hidden or trashed category is a row error. Legacy `categoryId` remains a one-slug alias during the transition only and cannot be combined with either array. `ProductImportRowMapper.toUpsertRequest` then supplies ordered internal `categoryIds` to the normal product upsert flow. `relatedProductIds`/`accessoryProductIds` may appear in exported or hand-authored JSON, but bulk import is a Draft-editing workflow and ignores both fields instead of resolving/writing them.

**Upsert matching:** product-level `sku` first (fallback `slug`) — more than one product sharing the same `sku` is an ambiguous-row error rather than a guess, since `products.sku` has no DB uniqueness (`PRODUCT_RULE_SKU_001` only covers variant SKU). **Variants are matched by SKU** before the existing full-replace-by-id `applyVariants` logic runs — this preserves each variant's real database id (and therefore any dormant historical stock-movement links) across re-imports of an unchanged catalog. (A row can additionally supply a `variants[].id` hint, honored only after verifying it belongs to the target product; SKU is the primary match key.)

**Validation note:** `validateImport` resolves the ordered category list and brand, then calls `CatalogRequestValidator.validateProductRequest` with `preview=false` — **not** `previewProduct` — because the preview/dry-run mode deliberately skips the English-name-required check and cross-product SKU/slug uniqueness (see "Product preview" above), which would under-report errors relative to what a real commit enforces.

**Publish status:** product import always saves rows as `DRAFT`, both for new products and updates to existing products, regardless of `publishStatus` in the file or the product's prior status. This keeps bulk import as a draft-editing workflow; publishing is a separate manual Admin action that runs the publish-readiness gate. Single-product JSON export includes `publishStatus` for completeness, but import ignores it.

**Export-only groups ignored on import:** bulk import accepts but discards fields that are not used while creating/updating Draft products: product `image`/`gallery`/`videos`, variant `id`/cover media/`gallery`, `publishStatus`, `relatedProductIds`, and `accessoryProductIds`. The discard happens before bean validation and before saving, so a single-product exported JSON file can be re-imported without those optional groups causing validation errors or overwriting Admin-managed media/relations. Net effect: single-product export is complete for review/backup of that product, while import remains safe for Draft data entry. Changing media, related products, accessories, or publishing status remains a direct Admin action, not a bulk-import side effect.

**Description blocks:** a JSON row carries a single `descriptionBlocks` key (unchanged shape — `ProductImportRow.descriptionBlocks` is the same `List<DescriptionBlock>` type `UpsertProductRequest` uses, passed through as-is by `ProductImportRowMapper`) — since V326 each block carries both languages inline (`html`/`htmlEn`, `text`/`textEn`, ...), there is no separate `descriptionBlocksEn` key anymore. Sending `descriptionBlocks` (including `[]`) makes the renderer own the `description`/`description_en` columns for that row (see "Product description blocks — `descriptionBlocks` (V139)" below), omitting the key leaves both untouched. Product JSON import accepts only the owner-approved `feature` block, with `side="right"` or `side="left"` for the two feature presets (image right/text left, image left/text right). Any other block type, or `feature.side` outside `left|right`, is a row validation error in both validate and commit. The **single-product JSON export** (`GET /import/export/{id}`) emits the same importable vocabulary: only `feature` blocks and only explicit alternating `left`/`right` sides. A legacy `side="auto"` is normalized deterministically in the downloaded file without writing the database. Legacy/unsupported product blocks are not emitted; if no exportable block remains, export falls back to the raw `description` string. **Since V327/V328,** `suitabilitySection`/`sizeGuideSection` are 2 more top-level keys on the same row (same object shape as the standalone product fields — see "Product PDP sections" above), also passed through as-is by `ProductImportRowMapper`/`toExportRow`; they are no longer part of `descriptionBlocks` in either the import or export shape.

Status: `CONFIRMED_FROM_CODE`

Evidence: `AdminProductImportController.java` (`exportProduct`), `ProductImportRow.java` (bulk import/single-product export wire shape — nested VI/EN objects), `ProductImportRowMapper.java` (`toUpsertRequest`), `ProductImportService.java` (`parseJson`, `discardExportOnlyImportFields`, `preserveExistingMedia`, `exportProductAsTemplateJson`/`toExportRow`/`writeExportJson`), `ApiErrorDetail`/`ImportRowResult`/`ImportReportResponse`, `ProductJpaRepository.findAllBySkuIgnoreCase`/`findBySlug`/`findById`/`findByIdsWithVariants`, `ProductVariantJpaRepository.findBySkuIgnoreCase`/`findByIdsWithGallery`, `AdminCatalogMutationService.applyProductPatch` (image present-flag + gallery/videos null-is-untouched semantics), `V30__add_inventory_tracking.sql` (`stock_movements` cascade). See `BUSINESS_RULES.md` `PRODUCT_RULE_009`.

### Product upsert — ordered categories

`POST /api/v1/admin/products`, `PATCH /api/v1/admin/products/{id}` and preview accept ordered `categoryIds: string[]`. Create requires at least one id. On PATCH an omitted array preserves the relationship; an empty array, duplicate id, unknown id, hidden category or trashed category is rejected. The first id is the primary category.

For this transition release, singular `categoryId` is a deprecated alias for one id. A request containing both `categoryId` and `categoryIds` is rejected. Responses retain singular `category` as the primary category and return every attachment in ordered `categories[]`; each summary exposes `visible` and `deleted` so clients can suppress inactive links safely.

Status: `CONFIRMED_BACKEND_ENFORCED`

### Product rich-text content fields — `promotionContent`, `installationGuide` — REMOVED (2026-07-07)

`promotionContent` (added `V124`) and `installationGuide` (added `V133`, format changed `V242`) have been **fully removed** — API no longer accepts or returns either field; DB columns `promotion_content(_en)`/`installation_guide(_en)` dropped (`V325__drop_dead_product_fields.sql`); `Product`/`UpsertProductRequest`/`ProductTranslationRequest` no longer carry them. Both were already dead end-to-end before this removal — confirmed via audit that neither `bigbike-web` nor `bigbike-admin` ever rendered/edited them (no `ProductInstallationGuide`/`InstallationGuideEditor`/`lib/utils/installation.ts` exist anywhere in the current repo; a prior version of this document incorrectly cited them as live). See `BUSINESS_RULES.md` `PRODUCT_RULE_006`.

Status: `CONFIRMED_FROM_CODE`

### Product PDP content — `suitabilityAdvisory` (V237)

> **Lịch sử `quickAnswerSummary`:** field độc lập "Quick Answer" (không liên quan `suitabilityAdvisory`) từng có ở V236, bị gỡ hoàn toàn ở V253 (2026-06-20), và được **làm lại ở V300** (2026-07-02) — xem mục `quickAnswerSummary (V300)` ngay dưới đây.

`POST /api/v1/admin/products` and `PATCH /api/v1/admin/products/{id}` accept the bilingual field:

- **`suitabilityAdvisory`** — optional string carrying a **JSON array of advisory cards** (V240), max 20 000 chars (presence-flag). "Phù hợp với ai" block: each card = `{ audience, advice }` where `audience` is the bold target-rider lead-in and `advice` the recommendation sentence (the `linkLabel`/`linkUrl` optional cross-sell link pair was removed from the card shape 2026-07-06 — see `suitability` block in `DATA_CONTRACT.md`). The web parses the JSON and renders one card per item (no `sanitizeRichHtml`; non-JSON legacy values render nothing). The EN array (`_en`) mirrors the cards by index with translated text. Was a free rich-HTML string before V240.

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

### Product HTML-only PDP sections — `specifications` / `specStats` / `trustBadges`

`POST /api/v1/admin/products` and `PATCH /api/v1/admin/products/{id}` accept the bilingual field:

- **`specifications`** — optional string, max 50 000 chars (presence-flag). Web renders this HTML (via `sanitizeRichHtml`, which allows `<table>`) as the **only** source for the technical-spec tab.
- **`specStats`** — optional string, max 50 000 chars (presence-flag). Web renders this HTML as the **only** source for the "Specs Dashboard" stat boxes.
- **`trustBadges`** — optional string, max 50 000 chars (presence-flag). Web renders this HTML as the **only** source for the trust-badge row above the product title.

These fields are bilingual: the vi value goes to the canonical column, English to `_en`. On `PATCH`, sending no key leaves the field untouched; sending `null`/blank clears it. English is written via the `translations.en` object.

They are returned by `GET /api/v1/products/{slug}` (locale-resolved via `pick`, with vi fallback) and the admin product read (`GET /api/v1/admin/products/{id}` carries vi + raw English in `translations.en`). **Not** included in product *list* responses. If a field is blank/null, the corresponding PDP section is hidden; there is no structured fallback.

Status: `CONFIRMED_FROM_CODE`

Evidence: `UpsertProductRequest.java` (`specifications`/`specStats`/`trustBadges` + presence flags), `ProductTranslationRequest.ProductContentRequest`, `AdminCatalogMutationService.applyProductPatch`/`applyTranslations`, `Product.java` + `ProductTranslations.java`, `JpaCatalogReadRepository` (detail mapper `pick`s it; list mapper passes `null`), `V255__add_product_specifications_html.sql`, `V256__add_product_spec_stats_html.sql`, `V257__add_product_trust_badges_html.sql`, `V329__BackfillProductHtmlOnlySections.java`, `V330__drop_product_html_only_structured_tables.sql`.

### Product description blocks — `descriptionBlocks` (V139, gộp song ngữ V326)

`POST /api/v1/admin/products` and `PATCH /api/v1/admin/products/{id}` accept `descriptionBlocks`: an optional array of typed block objects. Each element must include a `type` discriminator plus its type-specific required fields (validated via Bean Validation cascade). Since V326, each block also carries an optional sibling `*En` field per translatable field (`html`/`htmlEn`, `text`/`textEn`, `items`/`itemsEn`, ...) — there is **no separate `descriptionBlocksEn` array anymore** (that was V229; dropped). Vietnamese is structurally authoritative (block count/order); English only fills in the `*En` siblings of blocks that already exist in Vietnamese. The wire schema accepts the sealed set (`heading`, `paragraph`, `list`, `image`, `video`, `callout`, `divider`, `feature`) because the model is shared with Content. **Owner decision 2026-07-20:** the product admin editor authors only `feature` with `side="right"`/`"left"` — `paragraph`/`image` were removed from the product menu (narrower than the earlier 2026-07-15 4-choice set). `paragraph`/`image` remain valid at the wire-schema level (a direct PATCH can still send them; the shared sealed interface isn't narrowed), but the **Import flow** (`ProductImportService.checkImportDescriptionBlocks`) now rejects any product `descriptionBlocks` element whose `type` isn't `feature` (400 `INVALID_VALUE`), and a one-time migration (`V343__MigrateLegacyDescriptionBlocksToFeature.java`) converted every pre-existing `paragraph`/`image` block in `products.description_blocks` to an equivalent `feature` block (text-only or image-only) at rollout, so Export→Import round-trips no longer hit a legacy block of the removed types. The `feature` block (image + `subheading` eyebrow + `heading` + paragraph + list combined; optional `side` = `auto`\|`left`\|`right`, product menu only offers `left`/`right`) renders as a 2-column image–text row on the PDP and is the explicit replacement for the removed implicit image+text grouping — see `DATA_CONTRACT.md` § "Product description blocks". **Since V327/V328, `suitability`/`sizeGuide` are no longer valid `type` values here at all** (removed from the sealed interface entirely, not just unauthored) — sending either 400s (`VALIDATION_ERROR`, malformed discriminator) instead of silently accepting it; see the new `suitabilitySection`/`sizeGuideSection` top-level fields below.

`video` block write shape: `{ type: "video", provider: "youtube"|"upload", url, caption?, captionEn? }`. Link YouTube phải được parser chấp nhận; `upload` phải là URL video MinIO/media nội bộ. Provider khác hoặc provider không khớp URL bị từ chối (`400 INVALID_VALUE`). Response đọc có thể chứa `tiktok|facebook` cho dữ liệu legacy để renderer tương thích; các giá trị đó không hợp lệ khi ghi lại (`MEDIA_RULE_004`).

**Mutation semantics:** Sending `descriptionBlocks` (including `[]`) triggers the block renderer, which converts the array to sanitized HTML and atomically overwrites the `description_blocks` (JSONB, raw blocks) column plus **both** flat HTML columns `description` (VI, base fields) and `description_en` (EN, resolved per-field with VI fallback via `DescriptionBlock.resolveForLocale` — same policy as every other bilingual field). Omitting the key on PATCH leaves all three untouched — backward-compatible with products authored via the legacy RichTextEditor. There is a single presence flag (`descriptionBlocksPresent`); the old, separate `descriptionBlocksEn`/`descriptionBlocksEnPresent` pair no longer exists.

`descriptionBlocks` is returned on `GET /api/v1/products/{slug}` and `GET /api/v1/admin/products/{id}` as `descriptionBlocks: BlockObject[] | null`. **Admin reads get the raw array** (both languages inline per block). **Public reads get a locale-resolved copy** (`?lang=en` → each block's base fields become the English value when non-blank, else fall back to Vietnamese; `*En` fields are stripped to `null`). Products without blocks have `descriptionBlocks: null`; `description`/`description_en` (HTML) remain present and populated from whatever source last wrote them — **since V327/V328 this flat HTML fallback no longer includes suitability/sizeGuide content** (see below). Not included in product list responses (null).

Status: `CONFIRMED_FROM_CODE` — `UpsertProductRequest.java` (`descriptionBlocks` + single presence flag), `DescriptionBlock.resolveForLocale`, `DescriptionBlockRenderer`, `AdminCatalogMutationService.applyProductPatch`, `JpaCatalogReadRepository`/`JpaCatalogReadSupport`, `V139__add_product_description_blocks.sql`, `V238__ConsolidateProductDescriptionBlocks.java` (gộp dữ liệu sản phẩm cũ về 4 khối; `FeatureBlock.subheading`), `V326__MergeProductDescriptionBlocksBilingual.java` (gộp song ngữ, drop `description_blocks_en`), `V327`/`V328` (tách `suitability`/`sizeGuide` khỏi mảng này), `V343__MigrateLegacyDescriptionBlocksToFeature.java` (chuyển `paragraph`/`image` cũ sang `feature`), `ProductImportService.checkImportDescriptionBlocks` (Import chỉ nhận `feature`).

### Product PDP sections — `suitabilitySection` / `sizeGuideSection` (V327/V328)

`POST /api/v1/admin/products` and `PATCH /api/v1/admin/products/{id}` accept `suitabilitySection` ("Phù hợp với ai") and `sizeGuideSection` ("Bảng size") as two independent optional top-level fields, each a single object (not an array element) — `{ title?, titleEn?, html?, htmlEn? }`. `html`/`htmlEn` is the sole render source on the web; `cards` was removed from the contract/domain/storage.

**Presence semantics:** each field has its own presence flag (`suitabilitySectionPresent`/`sizeGuideSectionPresent`), independent of `descriptionBlocksPresent`. Sending the key replaces the **entire object** (no per-subfield merge); `null` clears it; omitting the key leaves it untouched.

**Read:** returned on `GET /api/v1/products/{slug}` and `GET /api/v1/admin/products/{id}`. Admin reads get the raw object (both languages inline). Public reads get a locale-resolved copy (`SuitabilitySection.resolveForLocale`/`SizeGuideSection.resolveForLocale` — same `pick()` convention as every other bilingual field). `null` when unset. Not included in product list responses.

**Media validation:** `MEDIA_RULE_003` applies to `html`/`htmlEn` on both fields exactly as it did when they were blocks — new external image hotlinks are rejected, pre-existing ones (from before the field existed as such) are grandfathered.

Status: `CONFIRMED_FROM_CODE` — `UpsertProductRequest.java` (`suitabilitySection`/`sizeGuideSection` + presence flags), `SuitabilitySection.java`/`SizeGuideSection.java` (domain), `AdminCatalogMutationService.applyProductPatch`, `JpaCatalogReadRepository`/`JpaCatalogReadSupport`, `AdminMutationValidators.suitabilitySectionMediaUrls`/`sizeGuideSectionMediaUrls`, `V327__add_product_suitability_size_guide_sections.sql`, `V328__ExtractProductSuitabilitySizeGuideFromBlocks.java`, `V329__BackfillProductHtmlOnlySections.java`.

### Product FAQ entries — `faqs`

`POST /api/v1/admin/products` and `PATCH /api/v1/admin/products/{id}` accept `faqs` (added `V133`): an optional array of `{ question, answer, sortOrder }` objects, max 50 entries (`@Size(max = 50)`). `question` ≤ 500 chars, `answer` ≤ 20 000 chars. Sending `faqs` replaces the whole list; rows with a blank question or answer are dropped. Full-replace, not presence-flag. Physical storage moved from the old child table to `products.faqs` JSONB in V331/V332/V333; API shape is unchanged.

`faqs` is returned on the public product detail endpoint `GET /api/v1/products/{slug}` and the admin product read response as `faqs: [{ question, answer }]`. It is **not** included in product *list* responses. `answer` is sanitized rich-text **HTML** (authored in the admin TipTap editor; legacy plain-text answers remain valid). The web PDP renders it as the "Câu hỏi thường gặp" accordion section band — answer HTML sanitized via `sanitizeRichHtml` and shown in a `.wyswyg` block — and emits matching `FAQPage` JSON-LD whose answer text is stripped to plain text (`stripHtmlToText`).

Status: `CONFIRMED_FROM_CODE`

Evidence: `FaqRequest.java`, `UpsertProductRequest.java` (`faqs`), `AdminCatalogMutationService.applyFaqs`, `ProductFaq` domain record, `JpaCatalogReadRepository.toFaqs` (detail mapper; list mapper passes `[]`), `V133__add_product_installation_guide_and_faq.sql`, `V331__add_product_jsonb_content_columns.sql`, `V332__MigrateProductChildContentToJsonb.java`, `V333__drop_product_child_content_tables.sql`.

### Product commitment rows — `commitments` (V232)

`POST /api/v1/admin/products` and `PATCH /api/v1/admin/products/{id}` accept `commitments` (added `V232`): an optional array of `{ icon, title, subtitle, titleEn?, subtitleEn?, sortOrder? }` objects, max 12 entries (`@Size(max = 12)`). `icon` ≤ 40 chars (a key from the fixed web icon set — e.g. `truck`, `refresh-cw`, `shield-check`, `badge-check`, `credit-card`, `headphones`, `package`, `gift`, `clock`, `map-pin`, `wrench`, `award`; unknown keys fall back to `shield-check`). `title` ≤ 200 chars, `subtitle` ≤ 300 chars. Sending `commitments` replaces the whole list; rows with a blank title are dropped. Full-replace, mirrors `faqs`.

This **supersedes** the former global `public_product` `product_commitment_*` settings (V228) — the commitment block under the buy buttons is now **per-product**, not a shared site setting. The 6 global commitment keys are removed from `SettingDefinitionRegistry`. Physical storage moved from the old child table to `products.commitments` JSONB in V331/V332/V333; API shape is unchanged. The trust-badge row above the title is now HTML-only via field `trustBadges` (see "Product HTML-only PDP sections").

`commitments` is returned on the public product detail endpoint `GET /api/v1/products/{slug}` and the admin product read response as `commitments: [{ icon, title, subtitle }]` (admin reads additionally carry `titleEn`/`subtitleEn`). It is **not** included in product *list* responses. The web PDP renders it as the commitment rows under the buy buttons (icon fixed per-row by the `icon` key); a row with a blank title is hidden; an empty list hides the whole block.

Status: `CONFIRMED_FROM_CODE`

Evidence: `CommitmentRequest.java`, `UpsertProductRequest.java` (`commitments`), `AdminCatalogMutationService.applyCommitments`, `ProductCommitment` domain record, `JpaCatalogReadRepository.toCommitments` (detail mapper; list mapper passes `[]`), `V232__create_product_commitments.sql`, `V331__add_product_jsonb_content_columns.sql`, `V332__MigrateProductChildContentToJsonb.java`, `V333__drop_product_child_content_tables.sql`.

### Product spec-stat boxes — HTML-only (field `specStats`)

The pre-V255 structured `specStats` array (rows of value/label) is removed from request and response —
not to be confused with the current field of the same name. The "Specs Dashboard" stat boxes are
authored and rendered only through the HTML-only field `specStats` / `translations.en.specStats`;
blank HTML hides the block. See "Product HTML-only PDP sections".

### Product SEO template fields — pros/cons, warranty, origin, weight, size guide (V175)

`POST /api/v1/admin/products` và `PATCH /api/v1/admin/products/{id}` chấp nhận nhóm
field bổ sung cho template trang sản phẩm chuẩn SEO/AEO:

- **`highlights.positiveNotes` / `highlights.negativeNotes`** — **(V251) nhận lại qua request,
  full-replace; (2026-07-07) gộp 2 field top-level cũ thành 1 field lồng `highlights`.** Ưu/Nhược
  điểm tách RA khỏi mô tả (đảo phần `prosCons` của V246) → khối RIÊNG cố định ngay dưới mô tả, ngoài
  tab; admin nhập ở card riêng (không bắt buộc). Request gửi `highlights: { positiveNotes?, negativeNotes? }`
  (DTO `HighlightsRequest`); mỗi nhóm là **mảng `{ content, contentEn?, sortOrder? }`**
  (`@Size(max = 20)`, `content`/`contentEn` rich-text **HTML** ≤ 20 000 ký tự,
  `content` blank bị drop). HTML được soạn qua TipTap ở admin và web sanitize bằng
  `sanitizeRichHtml` trước khi render; JSON-LD schema.org chuyển nội dung về plain text,
  ghi chú plain-text cũ vẫn hợp lệ. Khi nhập JSON, mọi `<img>` nhúng trong
  `content`/`contentEn` bị xoá vô điều kiện, cùng quy tắc với các khối HTML nội dung khác.
  Lưu vào `products.highlights` JSONB
  (`AdminCatalogMutationService.applyHighlights` — mỗi nhóm vẫn full-replace ĐỘC LẬP như trước, `null`
  = không đụng nhóm đó, hành vi giữ nguyên qua bước gộp). Trên product detail response (public/admin)
  trả `highlights: { positiveNotes: [...], negativeNotes: [...] }`, mỗi mục `{ content, contentEn? }`
  đọc từ JSONB (`JpaCatalogReadRepository.toHighlights`, gộp vào domain record `ProductHighlights`) —
  cũng là nguồn rich result schema.org `positiveNotes`/`negativeNotes` (json-ld); **schema.org output
  vẫn giữ 2 property rời như cũ** (chuẩn ngoài của Google, không đổi được) — `bigbike-web` tự un-nest
  `highlights` về lại 2 field phẳng ngay tại tầng fetch trước khi build JSON-LD.
- **`purchaseLines`** — **GỠ HẲN ở V276** (2026-06-24). Field `purchaseLines` (các dòng tự do của khối "Mua tại BigBike.vn" theo từng SP, V249) đã gỡ khỏi request/response/domain; bảng `product_purchase_lines` bị drop (`V276__drop_product_purchase_lines.sql`). Khối "Mua tại BigBike.vn" trên bigbike-web vẫn còn nhưng **chỉ** gồm các ô tự động: **Giá + Tồn kho** (realtime) và **Hotline + Địa chỉ** (từ site settings) — không còn dòng admin nhập tay.
- **`originBrandCountry`** — `String` ≤ 120 ký tự (presence-flag) — "thương hiệu [nước]".
  (Trường `originManufactureCountry` / cột `origin_manufacture_country` đã gỡ ở V241 — không còn hiển thị trên web.)
  **(V319)** Bilingual — có bản tiếng Anh riêng qua `translations.en.originBrandCountry`
  (không còn dùng chung 1 giá trị cho cả 2 ngôn ngữ). Public/admin detail response resolve
  theo locale qua `pick()` giống các field `*_en` khác (fallback về bản vi khi chưa dịch).
- **`weightGrams`** — **đã gỡ** (quyết định chủ shop). Field dẫn xuất này không còn trên
  request/response/domain, không còn ô nhập trong admin, web ngừng khai schema.org `Product.weight`.
  Cột vật lý `weight_kg` vẫn tồn tại trong DB (kích thước WooCommerce-import) nhưng không còn
  admin ghi/đọc qua field này.
- **`sizeGuide`** — **(V246) không còn nhận qua request** (bảng size giờ là khối `sizeGuide`
  trong `descriptionBlocks`). Cột `size_guide` = legacy/dormant. Field vẫn còn trên response
  (đọc từ cột cũ) nhưng web không render riêng nữa.
- **`suitabilityAdvisory`** (V237/V240) — tương tự, **(V246) không còn nhận qua request**
  (Phù hợp với ai giờ là khối `suitability` trong `descriptionBlocks`). Cột legacy/dormant.

> **V251:** `positiveNotes`/`negativeNotes` admin **gửi lại** (full-replace theo nhóm).
> `sizeGuide`/`suitabilityAdvisory` setter cũ vẫn dormant (admin không gửi — 2 mục đó vẫn là khối trong
> mô tả). DTO `UpsertProductRequest` còn `ProsConsBlock`-related dormant chỉ để deserialize an toàn.
>
> **V327/V328 (đảo lại quyết định V246 ngay trên):** "Phù hợp với ai"/"Bảng size" tách RA khỏi
> `descriptionBlocks` thành 2 field cấp cao nhất riêng, **KHÁC** với `sizeGuide`/`suitabilityAdvisory`
> legacy ở trên — 2 field mới tên `suitabilitySection`/`sizeGuideSection`, giữ nguyên shape của khối
> cũ (`title`/`titleEn`/`html`/`htmlEn` [+ `cards` cho suitability]) nhưng là 1 object đơn, có
> presence-flag riêng (`suitabilitySectionPresent`/`sizeGuideSectionPresent`). Xem mục "Product PDP
> sections — `suitabilitySection` / `sizeGuideSection` (V327/V328)" bên dưới. `sizeGuide`/
> `suitabilityAdvisory` legacy scalar ở trên KHÔNG đổi gì — vẫn dormant, vẫn khác field mới này.
>
> **(2026-07-07):** `UpsertProductRequest.positiveNotes`/`negativeNotes` (2 field phẳng) gộp thành
> `UpsertProductRequest.highlights` (kiểu `HighlightsRequest`, chứa 2 field con y hệt cũ). Đây là
> đổi wire shape theo yêu cầu chủ shop (gọn file mẫu nhập JSON — cùng DTO theo
> `PRODUCT_RULE_009`); V331/V332/V333 chuyển lưu vật lý sang `products.highlights` JSONB, không đổi hành vi
> full-replace độc lập từng nhóm, không đổi shape 2 property schema.org.

`originBrandCountry` trả về trên
`GET /api/v1/products/{slug}` và admin product read; **không** có trong product *list*
responses (detail-only). Web PDP render: **Ưu/Nhược điểm là khối RIÊNG cố định ngay dưới mô tả, ngoài
tab (V251)** — đặt trước "Sản phẩm tương tự"; schema `positiveNotes`/`negativeNotes` đọc từ
`products.highlights` JSONB.

Evidence: `UpsertProductRequest.java` (`highlights` field + `HighlightsRequest` + `applyHighlights`),
`Product.java` domain record (`highlights` field + `ProductHighlights` record),
`JpaCatalogReadRepository.toHighlights`, `DescriptionBlock.java` (`ProsConsBlock` dormant),
`DescriptionBlockRenderer`, `V175__add_product_seo_template_fields.sql`,
`V246__MigrateProductSectionsToBlocks.java`, `V254__remove_proscons_blocks.sql`,
`V331__add_product_jsonb_content_columns.sql`, `V332__MigrateProductChildContentToJsonb.java`,
`V333__drop_product_child_content_tables.sql`.

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
(link YouTube hoặc URL MinIO khi là video), `videoProvider` (`youtube`|`upload`) trên đường ghi.
Item ảnh dùng `url`/`alt` như cũ; item video dùng `videoUrl`+`videoProvider`,
còn `url`/`alt` (nếu có) là **thumbnail/poster**.
Full-replace như trước; item rỗng (ảnh thiếu `url` HOẶC video thiếu `videoUrl`) bị bỏ. Ảnh bìa biến thể
vẫn lấy ảnh ĐẦU TIÊN là **ảnh** (bỏ qua item video).

Read: `GET /api/v1/products/{slug}` + admin read trả `gallery`/`variants[].gallery` dạng
`GalleryMedia[]` = `{ mediaType, image: ImageAsset|null, videoUrl, provider }`; `image.alt` vẫn là text
thay thế cho SEO/trợ năng. (Từng có thêm `caption` — V294 — nhưng đã bỏ ở V295, không còn trong contract.)
**Tách biệt với `videos`**
(mục "Video" riêng dưới PDP — lưu ở `products.videos` JSONB từ V334/V335/V336, **wire
shape `videos[]` không đổi**): gallery video do admin đăng chung khu vực ảnh
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
`shortDescription`, `description`, `suitabilityAdvisory`,
`seo.title`, `seo.description`, các khối HTML-only (`specifications`,
`specStats`, `trustBadges`), `suitabilitySection`, `sizeGuideSection`,
`faqs[]` (`question`/`answer`), `commitments[]`, và `highlights`. Response public **giữ
nguyên shape** — không thêm khối `translations`.

`GET /api/v1/products/{idOrSlug}/snapshot` (buy-box giá/tồn/biến thể) cũng nhận
`lang` = `vi` (mặc định) hoặc `en`. Khi `lang=en`, mỗi phần tử trong `variants[].options[]`
trả `name` (tên thuộc tính, vd "Màu sắc"→"Color") và `value` (giá trị, vd "Đỏ"→"Red")
ở bản tiếng Anh, **lùi về tiếng Việt theo từng trường** khi cột `_en` rỗng. `bigbike-web`
gọi snapshot với `lang` = locale hiện tại để khối chọn màu/size đổi ngôn ngữ đồng bộ với
phần còn lại của trang. `pricing`/`stock` không có text dịch nên không đổi theo `lang`.

**Đọc admin — cả 2 bản:** `GET /api/v1/admin/products/{id}` trả các trường chính
ở bản tiếng Việt **và** thêm:
- `translations.en` — object `{ name, shortDescription, description,
  suitabilityAdvisory, seoTitle, seoDescription, specifications, specStats,
  trustBadges }` chứa bản tiếng
  Anh thô (giá trị thật của các cột `_en`, không fallback). `null` nếu chưa có bản
  tiếng Anh nào.
- `faqs[].questionEn / answerEn`, `commitments[].titleEn / subtitleEn`, và
  `highlights.*[].contentEn` — bản tiếng Anh thô của từng item.

**Đọc admin — danh sách theo `lang`:** các endpoint list admin
`GET /api/v1/admin/products`, `/admin/categories`, `/admin/categories/tree`,
`/admin/brands` và `/admin/content` nhận query param `lang` = `vi` (mặc định)
hoặc `en`. Khi
`lang=en`, **trường hiển thị** trả bản tiếng Anh (`name` cho product/category,
`title` cho content), **lùi về tiếng Việt theo từng trường** khi cột `_en` rỗng
(`COALESCE`, theo `PRODUCT_RULE_002` / `CATEGORY_RULE_002`). Riêng `name` và `slug` của brand
luôn là giá trị dùng chung VI/EN theo `BRAND_RULE_001`/`BRAND_RULE_003`; các field khác của brand
vẫn fallback theo `BRAND_RULE_002`.
List response **giữ nguyên shape** — không thêm khối `translations`; chỉ trường
hiển thị được localize (chi tiết vẫn trả cả 2 bản như trên). `bigbike-admin` truyền
`i18n.language` (chọn ở `LanguageSwitcher` header) vào `lang`. **Lọc (`q`) và sắp xếp vẫn theo cột tiếng Việt**
— tìm theo từ khóa chỉ-tiếng-Anh có thể không khớp.

**Ghi — `POST/PATCH /api/v1/admin/products`:** nhận thêm:
- `translations.en` — object 8 trường text như trên. Toàn bộ tùy chọn (không bắt
  buộc); chỉ giới hạn độ dài như bản tiếng Việt. Theo presence-flag pattern: bỏ
  khóa `translations` thì giữ nguyên trên PATCH.
- `faqs[]` nhận thêm `questionEn`, `answerEn`; `commitments[]` nhận thêm
  `titleEn`, `subtitleEn`; `highlights.*[]` nhận thêm `contentEn`. Đi cùng item
  tiếng Việt (full-replace như cũ).

Status: `CONFIRMED_FROM_CODE` — `CatalogController` (`lang` param public),
`AdminCatalogController` / `AdminContentController` (`lang` param admin list),
`AdminCatalogReadService` / `AdminContentReadService`,
`UpsertProductRequest.translations` / `ProductTranslationRequest`,
`AdminCatalogMutationService.applyProductPatch`, `JpaCatalogReadRepository` /
`JpaContentReadRepository` (resolve locale), migration `V136`.

### English URL slug — `slugEn` (V213/V214/V216)

Danh mục, sản phẩm và **bài viết** có thêm slug tiếng Anh tùy chọn. Áp dụng cho
`GET /api/v1/categories/{slug}`, `/products/{slug}`, `/articles/{slug}` và các endpoint
admin upsert tương ứng. **Thương hiệu là ngoại lệ:** tên và slug thương hiệu dùng chung VI/EN
(`BRAND_RULE_001`/`BRAND_RULE_003`) — không có khái niệm `slugEn`/`nameEn` cho brand nữa; cột
`brands.name_en`/`brands.slug_en` (legacy, chưa từng khác dữ liệu chính) đã **xoá hẳn ở V352**.
(Trang thông tin/chính sách nay tĩnh ở web — không qua backend; module pages đã gỡ 2026-06-24.)

**Lookup public — tra cứu theo vi HOẶC en slug:** path `{slug}` được resolve theo
`slug` tiếng Việt **hoặc** `slug_en` (`findBySlug(slug).or(() -> findBySlugEn(slug))`, ưu tiên khớp
vi trước). Cả URL vi lẫn URL en đều mở cùng entity. `lang` param vẫn quyết định ngôn
ngữ **nội dung** (`PRODUCT_RULE_002`/`CATEGORY_RULE_002`/`ARTICLE_RULE_002`); nó **không**
ảnh hưởng việc resolve slug.

**Response — thêm trường `slugEn`:** public detail (và list) của category/product/article trả thêm
`slugEn: string | null` cạnh `slug`. `slug` luôn là canonical tiếng Việt (không đổi
theo `lang`); `slugEn` là giá trị thô của cột `slug_en` (null nếu chưa nhập). Từ 2026-07-24,
`slugEn` khi có giá trị trỏ tới **1 trang tiếng Anh thật, server-render riêng** (`/products/`,
`/categories/`, `/news/` — xem `PRODUCT_RULE_003`/`CATEGORY_RULE_003`/`ARTICLE_RULE_003`), không
phải chỉ để dựng hreflang. `slugEn` rỗng → không có trang EN cho bản ghi đó (không phải "URL EN
lùi về slug VI" như trước). Brand response **không có field `slugEn`**; URL VI/EN của thương hiệu
dùng cùng `slug`.

**Embedded summary:** object `category` nhúng trong response sản phẩm (`CategorySummary` —
dùng cho breadcrumb PDP) trả thêm `slugEn: string | null` cạnh `slug`, lấy thô từ
`categories.slug_en`, cho phép breadcrumb PDP điều hướng tới URL tiếng Anh cho danh mục khi
khách đang ở chế độ EN (trống → lùi về `slug` vi). Cả `category` và mọi phần tử embedded
`categories[]` đều mang cùng shape `slugEn`, `visible`, `deleted`; `category` là phần tử đầu
theo thứ tự gán. Object `brand` nhúng (`BrandSummary`) chỉ mang `id`/`slug`/`name` — không có
`slugEn`.

**Ghi — `POST/PATCH` admin categories/products/articles:** `translations.en` nhận thêm
khóa `slug` (optional): pattern `^[a-z0-9]+(?:-[a-z0-9]+)*$`, max 100. Bỏ trống/null →
xoá `slug_en` (URL EN fallback về vi). Validation uniqueness: `slugEn` trùng `slug` vi
của entity này, hoặc trùng `slug`/`slug_en` của entity khác cùng loại → lỗi
`DUPLICATE`/`INVALID_VALUE` tại path `translations.en.slug`; `slug` vi mới trùng
`slug_en` đang có → lỗi tại path `slug`. Catalog đổi/xoá `slug_en` tự sinh redirect 301;
**bài viết KHÔNG sinh redirect** (module nội dung không có cơ chế này).

**409 DATA_CONFLICT thân thiện — sản phẩm (2026-07-04):** nếu app-layer validation ở trên bị
vượt qua (vd race hiếm giữa hai request đồng thời) và DB unique constraint chặn ở tầng
persistence, `PATCH /api/v1/admin/products/{id}` trả `409 DATA_CONFLICT` kèm `details[]`
field-level thay vì câu chung "Operation violates a data integrity constraint" rỗng `details`:
`ux_products_slug_en` → path `translations.en.slug`; `products_slug_key` (slug tiếng Việt) →
path `slug`; `ux_product_variants_sku_lower` (xem `BUSINESS_RULES.md` `PRODUCT_RULE_SKU_001`) →
path `variants`. Category/article's tương ứng vẫn trả `409` rỗng `details[]` (chưa map).
Constraint không nhận diện được vẫn giữ nguyên câu chung như cũ. `CONFIRMED_FROM_CODE` —
`GlobalExceptionHandler.handleDataIntegrityViolation`/`friendlyConstraintError`.

Status: `CONFIRMED_FROM_CODE` — `CatalogController`/`ContentController` (path resolve), `CategoryJpaRepository`/
`ProductJpaRepository`/`ArticleJpaRepository` (`findBySlug`/`findBySlugEn`); `BrandJpaRepository` has no
`findBySlugEn` overload; `JpaCatalogReadRepository`/`JpaContentReadRepository`
(map `slugEn` + OR-resolve), `ProductTranslationRequest`/`CategoryTranslationRequest`/`ArticleTranslationRequest` (field `slug`),
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

### Menu item nhãn & URL tự resolve theo danh mục — `targetType=CATEGORY`

Mục menu có thể **liên kết thẳng tới một danh mục** thay vì lưu tên/URL tĩnh:
đặt `targetType="CATEGORY"` + `targetId=<category id>` (2 cột đã có sẵn trên
`menu_items` từ trước, trước bản này chưa được diễn giải). Khi liên kết còn
hiệu lực, cả `label` lẫn `url` trả về ở `GET /api/v1/menus/{location}?lang=`
**được tính lại tại thời điểm đọc** theo `lang`, không dùng cột `label`/
`label_en`/`url` đã lưu trong DB:
- `label` = `CategoryEntity.name` (vi) hoặc `nameEn` (en, lùi về `name` khi rỗng).
- `url` = `CategoryEntity.slug` (vi) hoặc `slugEn` (en, lùi về `slug` khi rỗng).

Đọc admin (`GET /api/v1/admin/menus/...`) cũng resolve **live** theo cùng
cơ chế (bản VI) — bảng danh sách/form sửa trong admin luôn hiển thị đúng tên
& đường dẫn hiện tại của danh mục, không cần admin tự vào sửa lại sau khi
đổi tên/slug danh mục.

Cột `label`/`label_en`/`url` đã lưu trong DB vẫn được giữ làm **snapshot
fallback**: nếu danh mục bị xóa sau khi liên kết, cả đọc public lẫn đọc admin
trả lại nguyên giá trị đã lưu (không lỗi, không mất mục menu). Xem
[DATA_CONTRACT.md](DATA_CONTRACT.md) §"Menu item bilingual label".

Mục `targetType="CUSTOM"` (mặc định, link ngoài/trang tĩnh/tel/mailto/#)
**không đổi hành vi** — vẫn trả nguyên `label`/`url` đã lưu bất kể `lang`.

**Ghi admin:** `POST/PATCH /api/v1/admin/menus/{menuId}/items` nhận
`targetType`/`targetId` như cũ; khi `targetType="CATEGORY"`, `targetId` bắt
buộc phải trỏ tới một danh mục tồn tại — sai → `400 VALIDATION_ERROR`
(field `targetId`, code `CATEGORY_NOT_FOUND`). Khi `targetType="CATEGORY"`,
backend **bỏ qua hoàn toàn** `label`/`labelEn`/`url` client gửi lên — luôn
tính lại và lưu snapshot từ danh mục hiện tại (admin không sửa tay 2 trường
này được nữa, chỉ chọn danh mục). Vì vậy `label` trên `CreateMenuItemRequest`
**không còn bắt buộc ở tầng annotation** (`@NotBlank` đã bỏ) — chỉ bắt buộc
có điều kiện khi `targetType≠CATEGORY`, validate thủ công trong service
(thiếu → `400 VALIDATION_ERROR`, field `label`, code `REQUIRED`).

Status: `CONFIRMED_FROM_CODE` — `AdminMenuService.validateCategoryTarget`,
`AdminMenuService.resolveDisplayLabel`/`resolveDisplayUrl`,
`AdminMenuService.toAdminItemResponse`, `MenuItemEntity.targetType/targetId`
(cột có sẵn, không migration mới), `CategoryEntity.name/nameEn/slug/slugEn`,
`AdminMenuServiceTest`.

### Menu/category line-icon — DB-driven with legacy slug fallback (V213/V360)

`GET /api/v1/menus/{location}` trả mỗi mục menu kèm `iconUrl` (icon line đơn sắc). Shape **không đổi**;
chỉ đổi **nguồn**:
- Ưu tiên resolve theo danh mục trong DB: backend tách slug từ URL mục menu (`/danh-muc/{slug}` cho VI,
  `/categories/{slugEn}` cho EN) → `CategoryEntity.menuIconUrl`. Đổi tên danh mục/slug không còn làm mất icon.
- Nếu mục menu là item legacy không còn category record tương ứng, backend dùng fallback slug→icon cho các
  menu/header item lịch sử của WP, với asset phục vụ từ MinIO (`/media/uploads/wp-icons/*`).

`GET /api/v1/categories`, `/api/v1/categories/{slug}` cũng trả thêm field `menuIconUrl` trên mỗi Category
(dùng bởi bộ lọc "Danh mục sản phẩm" ở `bigbike-web`). Xem `DATA_CONTRACT` §"Category menu/sidebar line-icon".

**Ghi (admin):** `POST/PATCH /api/v1/admin/categories` nhận thêm `menuIcon` (`ImageAssetRequest`, chỉ `url`
được lưu vào `menu_icon_url`; validate URL whitelist media như `image`/`icon`/`banner`). Presence-flag:
bỏ khóa `menuIcon` thì PATCH giữ nguyên; gửi `menuIcon: { url: null }` để xoá icon. Admin sửa icon này ở
form danh mục (`CategoryDetailScreen`, field "Icon menu / bộ lọc danh mục"). Khác với `icon` (ảnh hero
trang danh mục → `icon_url`).

Status: `CONFIRMED_FROM_CODE` — `AdminMenuService.resolveMenuIconUrl` (DB lookup + legacy slug fallback),
`Category` domain record (`menuIconUrl`), `CatalogController` `/categories`, `UpsertCategoryRequest.menuIcon`
+ `AdminCatalogMutationService.applyCategoryPatch` (ghi admin), migrations `V213`/`V360`.

### Category `introContent` — khối giới thiệu ĐẦU trang danh mục (admin-editable)

Field `introContent` (cột `intro_content` + `intro_content_en`; **đổi tên từ `content_bottom`/`contentBottom`
qua `V290`** — tên cũ là di sản WP ACF khi nội dung nằm dưới lưới) là **khối giới thiệu hiển thị ở ĐẦU
trang danh mục** (`bigbike-web` render `introContent` ở `beforeGridNode`, phía trên lưới sản phẩm — thay
cho `description` trước đây). Field `description`/`description_en` **không còn render trên trang**, chỉ còn
là nguồn fallback cho SEO meta description. Tên cột cũ của Category không liên
quan đến Product: `product.contentBottom` đã bị gỡ cùng hai cột sản phẩm ở V151.

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

Status: `CONFIRMED_FROM_CODE` — `MenuLocations.PRIMARY` duy nhất, `bigbike-web/app/chinh-sach/[slug]/page.tsx`.

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
chọn, ≤255); PATCH gửi `titleEn` blank → xóa bản EN. `videoUrl` khi ghi chỉ nhận
URL YouTube hợp lệ hoặc URL video media nội bộ; TikTok/Facebook và host khác trả
`400 INVALID_VALUE`. PATCH không gửi `videoUrl` vẫn cho phép cập nhật field khác và
giữ nguyên URL legacy. Public/admin GET tiếp tục trả URL legacy để xem trước/render.

Status: `CONFIRMED_FROM_CODE` — `PublicHomeVideoController` (`lang` param),
`PublicHomeVideoResponse.from(video, lang)`, `AdminHomeVideoService`,
`UpsertHomeVideoRequest` / `PatchHomeVideoRequest` (`titleEn`), migration `V161`.

## POS Contract — REMOVED (owner decision 2026-06-23, online-only)

The POS (point-of-sale / walk-in) contract was removed entirely. The endpoints `GET /api/v1/admin/pos/products/search` and `POST /api/v1/admin/pos/orders`, the `AdminPosController` / `PosOrderService`, the `PosOrderResponse` shape, and the `pos.read` / `pos.write` / `pos.price_override` / `pos.sell_below_cost` permissions no longer exist. BigBike is online-only — every order is created through the storefront checkout endpoint above.

Status: `REMOVED`

## Admin Settings Contract

| Endpoint | Permission | Current behavior | Status | Evidence |
|---|---|---|---|---|
| `GET /api/v1/admin/settings` | `settings.read` | Paginated list with optional filters: `q` (key/description substring), `group`, `isPublic`. Sensitive keys return `settingValue="********"` with `sensitive=true, masked=true`. | `CONFIRMED_FROM_CODE` | `AdminSettingsController.java`, `AdminSettingsService.java` |
| ~~`GET /api/v1/admin/settings/{key}`~~ | — | **Removed 2026-07-15 (AUD-068)** — no UI caller; the settings screen loads the full list via `GET /admin/settings`. | `REMOVED` | `AdminSettingsController.java` |
| `PATCH /api/v1/admin/settings/{key}` | `settings.write` | Update single setting (value, valueEn, group, isPublic, description). Validates type/range per `SettingDefinitionRegistry`; **translatable + `.required()` keys (currently only `site_name`) also require non-blank `valueEn`** — `400 VALIDATION_ERROR` (field `valueEn`, code `REQUIRED`) if blank. Sensitive keys cannot be made public. **Keys flagged `superAdminOnly` (group `product_assign`) reject the write with 403 unless the caller holds wildcard `*` (`SUPER_ADMIN`)** — `ADMIN` is blocked despite having `settings.write`. | `CONFIRMED_FROM_CODE` | `AdminSettingsController.java` |
| `PATCH /api/v1/admin/settings` | `settings.write` | **Batch update** — atomically update multiple settings in one transaction. Body: `{"updates":[{"key":"…","value":"…","valueEn":"…"}]}` (`valueEn` optional, null = unchanged; same required-`valueEn`-for-translatable-required-keys rule as the single-update path). All validations run before any mutation; if any item is invalid the whole request fails with 400 and no settings are changed. Same `superAdminOnly` 403 gate as the single-update path. | `CONFIRMED_FROM_CODE` | `AdminSettingsController.java`, `AdminSettingsService.batchUpdateSettings` |
| `GET /api/v1/admin/product-assignment` | `products.read` **or** `content.read` | Returns the editable "Phân công" guide for the product AND content/article create-edit banners (same endpoint, same data): `{title, roles: [{id, name, items}]}` — `roles` is a dynamic list, 1–6 entries, Super-Admin managed; `items` is a single free-text field (not a nested array). A caller who can open either editor may read it. Write is via the `product_assign_title` + `product_assign_roles` `superAdminOnly` settings keys above. | `CONFIRMED_FROM_OWNER_DECISION` | `AdminProductAssignmentController.java`, `DevAdminAuthService.java` |
| `GET /api/v1/settings/public` | public | List settings marked `isPublic=true` that are on the registry public allowlist. Sensitive keys are never exposed regardless of DB flag. | `CONFIRMED_FROM_CODE` | `PublicSettingsController.java` |

**Batch update response shape:** `ApiDataResponse<List<AdminSiteSettingResponse>>` — items in same order as request `updates` array. `AdminSiteSettingResponse` no longer includes `enLocked` (dropped V312 with the Gemini auto-translation removal) — English values are entered manually, no lock/skip state to track.

**Sensitive key masking:** Any key whose name contains `secret`, `password`, `token`, `api_key`, `privatekey`, etc. always returns `settingValue="********"` in admin responses and in audit log `before_data`/`after_data`.

**`IMAGE_URL`-typed setting validation:** Keys typed `IMAGE_URL` in `SettingDefinitionRegistry` (hero banner images `hero_*_image_url`/`hero_*_mobile_image_url`/`hero_*_illustration_url`, `hero_default_bg_url`/`hero_default_illustration_url`; the former `og_image_url` was removed with the `seo` group in V337) are validated by the **shared media-URL whitelist** (`SafeMediaAssetUrlPolicy.validateImageUrlOrThrow`), not the generic URL check. Accepts relative `/media/…` and `/media-proxy/…` paths (what the admin media picker stores), absolute URLs under the configured MinIO public base, and BigBike legacy upload/CDN paths; rejects external hotlinks — same policy the catalog/content modules already use (per `DATA_CONTRACT.md` "menu icon" whitelist note). This fixes the prior `400 VALIDATION_ERROR` (`INVALID_URL`) when saving a library-picked image (relative `/media/…`) to a Banner/Hero or SEO setting. `CONFIRMED_FROM_CODE` — `SettingValueValidator.java`, `SafeMediaAssetUrlPolicy.java`.

**`JSON`-typed setting validation:** The single `product_assign` key `product_assign_roles` is typed `JSON` in `SettingDefinitionRegistry` — its value must parse as a JSON array of 1–6 objects, each with a non-blank, array-unique `id`, a non-blank `name` (≤1,000 chars), and a free-text `items` string (≤65,536 chars, blank allowed — a newly-added role may not have its tasks filled in yet). Malformed JSON or a violation of the 1–6/uniqueness/required-field rules is rejected with `400 VALIDATION_ERROR`. `CONFIRMED_FROM_CODE` — `SettingValueValidator.java`.

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
- `public_product`: **no shared settings.** All product-detail content is per-product: commitment rows under the buy buttons (`product.commitments`, JSONB on `products`) and the trust-badge row above the title (`product.trustBadges`, HTML-only). The former `product_commitment_*` (V228) and `product_trust_*` keys were removed in V232/V233.
- `seo`:
  - `home_content_bottom_html` — homepage bottom SEO HTML block (still admin-editable).
  - `seo_home_title`, `seo_home_description`, `og_image_url`: **removed 2026-07-12 (V337)** — the `bigbike-web` homepage now falls back `<title>`/meta-description to `site_name` and emits **no default `og:image`**. See `DATA_CONTRACT.md` "`seo` — 3 keys removed (V337)". (Per-entity SEO for category/product/article is unrelated and unchanged.)

Status: `CONFIRMED_FROM_CODE` — `SettingDefinitionRegistry.java`, `PublicSettingsController.java`,
`V18__add_public_homepage_contract_fields.sql`, `V19__backfill_homepage_data.sql`,
`V22__seed_footer_menu_settings.sql`, `V24__seed_footer_contact_settings.sql`,
`V32__add_article_product_image_and_home_exp_settings.sql`.

**Page hero settings (group `public_hero`, all `publicAllowed`):**

For each listing page (`/san-pham`, `/brands`, `/tin-tuc`), the hero block is composed from 4 editable keys:

| Key prefix | Type | Purpose |
|---|---|---|
| `hero_<page>_image_url` | `IMAGE_URL` | Desktop background image URL |
| `hero_<page>_illustration_url` | `IMAGE_URL` | Right-side cut-out gear illustration; blank → falls back to `hero_default_illustration_url` |
| `hero_<page>_image_alt` | `STRING` | Image alt text |
| `hero_<page>_title` | `STRING` | Heading text |

Concrete editable keys: `hero_products_*`, `hero_brands_*`, `hero_news_*` (12 total). All are returned by `GET /api/v1/settings/public`. Two global fallbacks also live in `public_hero`: `hero_default_bg_url` and `hero_default_illustration_url`, used when a page has no own background / illustration. **Cascade per page:** the page's own key → the matching global default → a hardcoded asset baked into `PageHero`. The legacy `hero_<page>_mobile_image_url` keys remain persisted and returned so existing data is preserved, but are not editable in admin and are ignored by the web. At every breakpoint, `PageHero` uses the desktop background with responsive CSS. The `_description` and `_kicker` keys that earlier seeds carried were dropped in `V199__drop_unused_hero_settings.sql` (never consumed); `_mobile_image_url` was re-introduced in `V220__reseed_hero_mobile_settings.sql` and retired from UI/rendering on 2026-07-15 without a data migration; per-page `_illustration_url` was added in `V221__add_hero_per_page_illustration.sql` (previously all three pages shared `hero_default_illustration_url`). These keys are managed by the dedicated **Banner trang** admin screen (`BannerScreen.jsx`). (Trước đây các trang CMS about/contact/policy/guides mang hero trên `Page` entity — module pages đã gỡ 2026-06-24, các trang đó nay tĩnh ở web nên không còn hero do admin quản lý.)

## Contact Page (trang tĩnh — không có endpoint)

Trang `/lien-he` là **trang tĩnh hoàn toàn**: bố cục, nhãn, tiêu đề và SEO cố định trong code web (i18n `Contact`/`StaticPage`), admin không quản lý. **Đã gỡ toàn bộ endpoint contact-page** (cả `GET/PUT /api/v1/admin/contact-page` lẫn public `GET /api/v1/contact-page`) và bảng `contact_page_layout` (drop ở `V270`, was V224). Số điện thoại/địa chỉ/giờ/mạng xã hội hiển thị trên trang là dữ liệu chung lấy từ `GET /api/v1/settings/public` (nhóm `contact`, cùng nguồn header/footer). Evidence: `bigbike-web/app/lien-he/page.tsx`, `bigbike-web/components/contact/ContactPageContent.tsx`, `V270__drop_contact_page_layout.sql`.

## Guide Page Builder Contract — REMOVED (2026-06-24)

> **REMOVED (2026-06-24).** Trang Hướng dẫn `/huong-dan` (+ đúng 2 trang con `size-mu`/`size-trang-phuc`) nay là **nội dung tĩnh trong `bigbike-web`**. URL `mua-hang` chuyển về trang Hướng dẫn; `size-gang-tay` chuyển sang `size-trang-phuc`. Toàn bộ endpoint guide-page đã gỡ: admin `GET`/`PUT /api/v1/admin/guide-page` và public `GET /api/v1/guide-page` không còn tồn tại. Bảng `guide_page_layout` drop ở `V271`; trình dựng GuidePageBuilder trong admin cũng đã gỡ.

## Admin Orders

| Method | Path | Permission | Current behavior | Status | Evidence |
|---|---|---|---|---|---|
| `GET` | `/api/v1/admin/orders` | `orders.read` | Paginated order list. Query: `page` (≥1, default 1), `size` (1–100, default 20), `status`, `q` (order number/key, customer email or phone), `from`/`to` (`YYYY-MM-DD`, inclusive calendar dates interpreted at `Asia/Ho_Chi_Minh` day boundaries), and `sort` (default `placedAt:desc`; supports placed/created date and total amount). | `CONFIRMED_FROM_CODE` | `ORDER_RULE_011`, `AdminOrderController.listOrders`, `AdminOrderService.listOrders`, `AdminOrderSupport` |
| `GET` | `/api/v1/admin/orders/{orderId}` | `orders.read` | Admin order detail, including line-item/address/payment snapshots and internal-only `cancelReason` immediately after `cancelledAt`. Customer and guest order-detail responses do not expose `cancelReason`. | `CONFIRMED_FROM_CODE` | `AdminOrderController.getOrderDetail`, `AdminOrderDetailResponse` |
| `GET` | `/api/v1/admin/orders/{orderId}/allowed-transitions` | `orders.read` | Returns only the legal next values in the single order-status lifecycle documented in `STATE_MACHINES.md` §6. | `CONFIRMED_FROM_CODE` | `AdminOrderController.listAllowedTransitions`, `AdminOrderService.ALLOWED_TRANSITIONS` |
| `PATCH` | `/api/v1/admin/orders/{orderId}/status` | `orders.write` | Accepts `UpdateOrderStatusRequest.status` and optional `cancelReason`. When transitioning into `CANCELLED`, `cancelReason` is mandatory; the backend stores the trimmed value in `orders.cancel_reason` and rejects blank/missing values with `VALIDATION_ERROR`. Repeating the already-current status is an idempotent no-op; invalid lifecycle moves return conflict. | `CONFIRMED_BACKEND_ENFORCED` | `AdminOrderController.updateOrderStatus`, `AdminOrderService.updateOrderStatus` |
| `GET` | `/api/v1/admin/orders/{orderId}/audit` | `orders.read` | Returns the order's internal audit trail in reverse chronological order. | `CONFIRMED_FROM_CODE` | `AdminOrderController.listAuditTrail`, `AdminOrderService.listAuditTrail` |

## Customer Admin

| Method | Path | Permission | Current behavior | Status | Evidence |
|---|---|---|---|---|---|
| `GET` | `/api/v1/admin/customers` | `customers.read` | Paginated customer list for the admin Customers screen. Query: `page` (≥1, default 1), `size` (1-100, default 20), `q` (matches email/phone/displayName, case-insensitive substring), `status` (one of the Customer Status Enum values below; unknown values return `400 VALIDATION_ERROR`), `synthetic` (boolean — filters on `isSynthetic`, see below), `emailVerified` (boolean — `true` = `emailVerifiedAt IS NOT NULL`, `false` = `IS NULL`). Each item includes `orderCount`/`totalSpent` aggregated in one per-page query (no N+1) and excluding `CANCELLED` orders. | `CONFIRMED_BACKEND_ENFORCED` | `CUSTOMER_RULE_001`, `CUSTOMER_RULE_006`, `AdminCustomerController.java`, `AdminCustomerService.listCustomers` |
| `GET` | `/api/v1/admin/customers/{customerId}` | `customers.read` | Customer detail: profile fields, `addresses[]`, `orderSummary`. Its `orderCount`, `totalSpent`, `avgOrderValue`, VIP/segment calculations exclude `CANCELLED`; `latestOrders` and first/last-order timestamps keep the complete history including cancelled orders. | `CONFIRMED_BACKEND_ENFORCED` | `CUSTOMER_RULE_006`, `AdminCustomerController.java`, `AdminCustomerService.getCustomerDetail` |
| `GET` | `/api/v1/admin/customers/summary` | `customers.read` | KPI counts for the admin Customers screen. Returns `AdminCustomerSummaryResponse`: `total` (all customer rows, including synthetic), `vip` (all rows, including synthetic, whose non-cancelled lifetime order total ≥ 10,000,000 VND — mirrors `AdminCustomerService.deriveSegment` VIP rule), `newLast30Days` (non-synthetic registered accounts created within the last 30 days), `active` (non-synthetic registered accounts whose status is `ACTIVE`). | `CONFIRMED_BACKEND_ENFORCED` | `CUSTOMER_RULE_006`, `CUSTOMER_RULE_008`, `AdminCustomerController.java`, `AdminCustomerService.java` |
| `PATCH` | `/api/v1/admin/customers/{customerId}` | `customers.write` | Admin may update only `displayName` and `phone`; attempts to write `email`, `firstName`, or `lastName` return `400 VALIDATION_ERROR`. `phone = null` means unchanged; blank phone explicitly clears the stored number; a non-blank phone accepts common display separators, is normalized before validation, and returns `400 VALIDATION_ERROR` on field `phone` when invalid. Uniqueness compares the normalized database value, covering canonical local `0…`, legacy `+84…`, and legacy formatted storage; any matching number owned by another customer returns `409`. Synthetic customer rows use the same two-field edit contract. | `CONFIRMED_BACKEND_ENFORCED` | `CUSTOMER_RULE_004`, `CUSTOMER_RULE_007`, `AdminCustomerController.java`, `AdminCustomerService.java`, `Phase1IAdminManagementApiTest.java` |
| `PATCH` | `/api/v1/admin/customers/{customerId}/status` | `customers.write` | Sets a real customer's `status` to one of the Customer Status Enum values (rejects unknown values with `400 VALIDATION_ERROR`). A synthetic customer's status cannot be changed to a different value (`409`). Optional `reason` (free text, ≤1000 chars) is not stored on the customer row — it is written only into the `CUSTOMER_STATUS_UPDATED` audit log entry alongside the before/after status. Setting any non-`ACTIVE` status revokes all of the customer's active sessions immediately (defence-in-depth alongside `CustomerSessionFilter`'s own status check). | `CONFIRMED_BACKEND_ENFORCED` | `CUSTOMER_RULE_001`–`CUSTOMER_RULE_003`, `CUSTOMER_RULE_007`, `AdminCustomerController.java`, `AdminCustomerService.updateCustomerStatus` |
| `DELETE` | `/api/v1/admin/customers/{customerId}/avatar` | `customers.write` | Admin removes a customer's avatar (owner decisions 2026-07-21 and 2026-07-28) — same storage semantics as the customer's own `DELETE /api/v1/customer/me/avatar` (deletes the MinIO object, nulls `avatar_url`, idempotent). An actual removal writes one `CUSTOMER_AVATAR_REMOVED` audit event; a repeated no-op writes none. **No admin upload endpoint exists** — admins can only view and remove, never upload on a customer's behalf. | `CONFIRMED_BACKEND_ENFORCED` | `CUSTOMER_RULE_005`, `AdminCustomerController.java`, `AdminCustomerService.removeAvatar` |

## Redirect Management Contract

Admin CRUD for URL redirect rules (`redirects` table) plus an internal lookup API consumed by `bigbike-web`'s edge proxy (`proxy.ts`) to resolve legacy/old URLs on the storefront.

### Admin CRUD — `AdminRedirectController` (`/api/v1/admin`)

| Method | Path | Permission | Body / Query | Response | Notes |
|---|---|---|---|---|---|
| `GET` | `/redirects` | `redirects.read` | Query: `page` (≥1, default 1), `size` (1-100, default 20), `q` (search), `enabled` (`true`/`false`), `statusCode` | `{data: [...], pagination}` list of `AdminRedirectResponse` | Standard paginated list envelope. |
| `GET` | `/redirects/{id}` | `redirects.read` | — | `{data: AdminRedirectResponse}` | |
| `POST` | `/redirects` | `redirects.write` | `CreateRedirectRequest`: `sourcePattern` (required), `targetUrl` (required), `redirectType` (`PERMANENT`/`TEMPORARY`/`CUSTOM`, defaults from statusCode), `statusCode` (one of `301/302/307/308`, business rule — see `REDIRECT_RULE_005`), `enabled`, `notes`, `legacyId` | `{data: AdminRedirectResponse}` | Rejects self-redirect, multi-hop loop (max depth 20), duplicate `sourcePattern`, and open-redirect targets (see BUSINESS_RULES.md `REDIRECT_RULE_00x`). |
| `PATCH` | `/redirects/{id}` | `redirects.write` | `UpdateRedirectRequest` (same fields, all presence-guarded — an omitted field, including `notes`/`legacyId`, leaves the stored value unchanged; a partial PATCH like `{enabled}` no longer wipes them). To clear `notes`, send an explicit empty string `""`. `legacyId` cannot be cleared back to `null` via this endpoint once set (bare JSON `null` is indistinguishable from "field omitted") — only overwritten with a new id. | `{data: AdminRedirectResponse}` | Same validation as create. |
| `DELETE` | `/redirects/{id}` | `redirects.write` | — | `204 No Content` | |

Every mutation writes an `AuditLogEntity` (`resourceType = REDIRECT`, see Audit Log Contract below).

### Internal lookup API — `InternalRedirectController` (`/api/internal`)

Not wrapped in the standard `{data}` envelope (bare JSON, optimized for the hot per-request proxy path). Requires header `X-Internal-Token` matching `BIGBIKE_INTERNAL_TOKEN` (backend) / `INTERNAL_API_TOKEN` (`bigbike-web`) — deny-by-default when the token is unset in non-dev profiles (see DEPLOYMENT_GUIDE.md "Security Hardening Config" and PERMISSION_MATRIX.md "Internal Redirect Caveat").

| Method | Path | Response | Notes |
|---|---|---|---|
| `GET` | `/redirect?path=` | `200 {redirectId, target, statusCode}` on an enabled match, `404` on miss, `401` unauthorized, `400` blank `path` | Exact-match lookup (`findBySourcePattern`), case-sensitive, no trailing slash (see DATA_CONTRACT.md). `redirectType` is **not** returned here — only `statusCode` drives the actual HTTP response `bigbike-web/proxy.ts` sends to the browser. |
| `GET` | `/redirects/active` | `200 [...]` bulk dump of enabled redirects (includes `redirectType`) | Not currently called by `bigbike-web` — reserved for future use, not part of the live request path. |
| `POST` | `/redirects/hit/{redirectId}` | `204` | Fire-and-forget hit-count increment, called by the proxy after a successful redirect. |

Consumed only by `bigbike-web/proxy.ts` over the Docker-internal network (`http://bigbike-backend:8080`) — never over the public `api.bigbike.vn` domain. `deploy/nginx/api.bigbike.vn.conf` blocks `/api/internal/**` from the public internet as a second layer of defense (see DEPLOYMENT_GUIDE.md).

Status: `CONFIRMED_FROM_CODE`

Evidence: `AdminRedirectController.java`, `AdminRedirectService.java`, `InternalRedirectController.java`, `bigbike-web/proxy.ts`, `V4__create_media_redirect_menu_tables.sql`, `V58__add_redirect_permissions.sql`, `V80__add_redirect_source_pattern_unique.sql`.

## Audit Log Contract

| Endpoint | Permission | Current behavior | Status | Evidence |
|---|---|---|---|---|
| `GET /api/v1/admin/audit-logs` | `audit-logs.read` | Paginated list (page/size), filterable by actorType, actorId, resourceType, resourceId, action, q, from/to (LocalDate). Sorted by createdAt desc, id desc (secondary key keeps pagination stable when a batch write shares one timestamp). Enriches actor display name/email and resource display name/code. | `CONFIRMED_FROM_CODE` | `AdminAuditLogController.java`, `AdminAuditLogService.java` |

**Search (`q`) — fixed 2026-07-04, was action-only.** Case-insensitive match across: `action`, the raw `beforeData`/`afterData` JSON (covers product/category/brand/content names, SKUs, slugs — anything the mutation service already recorded), the acting admin's `displayName`/`email` (subquery on `admin_users`), the order number for `ORDER`-resource rows (subquery on `orders`), and the customer's `displayName`/`email` for `CUSTOMER`-resource rows (subquery on `customers`). Matches what `auditLog.filterSearchPlaceholder` (vi.json/en.json) promises: "Tìm mã đơn, sản phẩm, khách hàng, người thao tác…". `action` param kept for backward compatibility, `q` takes precedence. `CONFIRMED_FROM_CODE` — `AdminAuditLogService.buildSearchPredicate`.

**Malformed filters → 400 — fixed 2026-07-04, was silently ignored.** `actorId`, `resourceId` (must parse as UUID) and `from`/`to` (must parse as `YYYY-MM-DD` or ISO instant) throw `ValidationException` (400, `INVALID_UUID_FORMAT` / `INVALID_DATE_FORMAT`) instead of being dropped and silently returning the unfiltered page. Mirrors `AdminReportController.parseDate`. `CONFIRMED_FROM_CODE` — `AdminAuditLogService.parseUuidOrThrow/parseFromDate/parseToDate`.

**Resource display name enrichment — fixed 2026-07-04, was ORDER/REVIEW only.** `ORDER` resolves via a batch join on `orders.order_number` (resourceId is real UUID); `REVIEW` parses `productName`/review id out of its own JSON. Every other type below pulls its display name straight out of the already-recorded `afterData` (fallback `beforeData`) JSON — no DB join, since most of these entities have String (non-UUID) ids. See `AdminAuditLogService.RESOURCE_NAME_FIELDS` for the exact field per type. `INVENTORY` has no natural display name (only variantId/productId codes) and stays unenriched.

**Resource types written by backend:**
- `ORDER` — order lifecycle events (`AdminOrderService`).
- `PRODUCT` — create/update/publish/soft-delete/restore (AdminCatalogMutationService). Before/after snapshot includes sku, brandId, ordered `categoryIds` plus `primaryCategoryId`, shortDescription, description, imageUrl, retailPrice, salePrice, stockState, available (renamed from forceOutOfStock in V342) — captured **before** the patch is applied.
- `CATEGORY` — create/update/soft-delete (AdminCatalogMutationService). Snapshot (fixed 2026-07-04) adds description, introContent, imageUrl, iconUrl, menuIconUrl, bannerUrl, parentId, sortOrder, showOnHomepage; before-snapshot bug fixed same as PRODUCT.
- `BRAND` — create/update/soft-delete (AdminCatalogMutationService). Snapshot (fixed 2026-07-04) adds description, logoUrl, bannerUrl; before-snapshot bug fixed same as PRODUCT.
- `INVENTORY` — manual availability changes (`AdminInventoryService`)
- `CONTENT` — article create/update/soft-delete/restore/hard-delete (AdminContentMutationService). Snapshot (fixed 2026-07-04) adds excerpt, coverImageUrl, categoryId; before-snapshot bug fixed on update/soft-delete/restore.
- `CUSTOMER` — `AdminCustomerService`: `CUSTOMER_UPDATED`, `CUSTOMER_STATUS_UPDATED`, and `CUSTOMER_AVATAR_REMOVED` (the avatar action is emitted only when a stored avatar is actually cleared).
- `MEDIA` — AdminMediaService
- `MENU` / `MENU_ITEM` — AdminMenuService
- `REDIRECT` — AdminRedirectService
- `SITE_SETTING` — AdminSettingsService
- `REVIEW` — AdminReviewService
- `ADMIN_USER` — AdminAdminUsersService. `ADMIN_USER_UPDATED` split 2026-07-04 into `ADMIN_USER_ROLE_CHANGED`, `ADMIN_USER_DISABLED`, `ADMIN_USER_SUSPENDED`, `ADMIN_USER_REACTIVATED` (one entry per changed dimension) — `ADMIN_USER_UPDATED` remains for plain displayName/password edits or a no-op patch.
- `ADMIN_ROLE` — AdminRoleService (fixed in V76; previously erroneously `ADMIN_ROLE:<roleId>`)
- `ADMIN_AUTH` — AdminAuthService: `ADMIN_LOGIN_SUCCESS`/`ADMIN_LOGIN_FAILED`/`ADMIN_LOGOUT`/`ADMIN_ACCOUNT_LOCKED`. `ipAddress` fixed 2026-07-04 to resolve via `ClientIpResolver` (reads `X-Forwarded-For` from a trusted proxy) instead of raw `request.getRemoteAddr()`, which behind the reverse proxy always returned the Docker-internal address.
- `SLIDER` — AdminSliderService (homepage hero slider create/update/delete/reorder). Vị trí duy nhất còn nhận cho bản ghi mới là `home` — 3 vị trí cũ `category`/`category_sidebar`/`promotion` đã gỡ khỏi admin (owner decision 2026-07-15, AUD-063); bản ghi cũ mang vị trí khác vẫn nằm trong DB (không xóa) nhưng không được quản lý/hiển thị.
- `HOME_VIDEO` — AdminHomeVideoService (homepage video create/update/delete/reorder)
- `REPORT` — `REPORT_EXPORT_CREATED` on every `/api/v1/admin/reports/*/export` call (AdminReportController)
- `MEDIA_FOLDER` — added 2026-07-04, previously unaudited (AdminMediaFolderService: folder create/update/delete)
- `ATTRIBUTE` — added 2026-07-04, previously unaudited (AdminAttributeService: attribute + attribute-value create/update/delete)
- `HOME_HIGHLIGHT` — added 2026-07-04, previously unaudited (HomeHighlightsService: single `HOME_HIGHLIGHTS_SET` action per full-replace save, before/after = the whole slot list)

**Note:** `resource_id` column is `uuid` type. For entities with String IDs (products, categories, brands, content, roles, sliders, home videos, attributes), `resource_id = null` and the entity identifier is embedded in `afterData`/`beforeData` JSON.

**Write guarantee (non-blocking):** All audit-log writes go through the central `AuditLogWriter`, which persists in a separate transaction (`@Transactional(REQUIRES_NEW)`) wrapped in try/catch. An audit-write failure is logged and swallowed — it never rolls back or breaks the originating business action. `createdAt` is auto-set if a caller leaves it null. In the mock/read-only profile (no JPA repository) the write is a silent no-op. `CONFIRMED_FROM_CODE` — `AuditLogWriter.java`, `AuditLogPersister.java`.

> **Warranty module removed (2026-06-23, V266).** The admin warranty contract — `GET /api/v1/admin/warranties` and `PATCH /api/v1/admin/warranties/{id}/void` — and the public lookup `GET /api/v1/warranties/lookup` were **deleted** along with the entire warranty feature (records, services, controllers, DTOs, the `/bao-hanh` web page, and the `warranty.read` / `warranty.write` permissions). Customer-facing warranty wording now lives only in CMS policy content and per-product marketing rows.

## Admin Notification Center Contract (V102 + V339)

Persistent counterpart of the WebSocket order feed — admins offline when an event fires still see it here. All endpoints are gated by `orders.read` (no dedicated `notifications.*` permission).

**Per-admin read state (V339, AUD-017/018/019).** Read state is tracked **per admin** in `admin_notification_reads` (a per-admin `last_read_at` high-water mark) — a notification is "read" for an admin when it was created at/before that admin's marker. The legacy shared `admin_notifications.is_read` flag is no longer read or written. `GET` returns the shared recent backlog (up to 50, newest first) with each item's `isRead` resolved for the calling admin, plus that admin's own `unreadCount`. `mark-all-read` only advances the **caller's** marker — it never mutates the shared rows, so other admins keep their unread state and no backlog disappears from the list. The notification `payload` now also carries `customerName` and `total` (AUD-026) so an offline admin catching up sees who ordered and how much.

| Method | Path | Permission | Purpose | Status | Evidence |
|---|---|---|---|---|---|
| `GET` | `/api/v1/admin/notifications` | `orders.read` | Recent notifications (≤50) with the caller's `unreadCount`. Each item: `id`, `type`, `orderId`, `orderNumber`, `payload` (incl. `customerName`, `total`), `isRead` (per-admin), `createdAt`. | `CONFIRMED_FROM_CODE` | `AdminNotificationController.java`, `AdminNotificationService.inboxFor` |
| `POST` | `/api/v1/admin/notifications/mark-all-read` | `orders.read` | Advance the calling admin's read marker to now. Returns `{ unreadCount: 0 }`. | `CONFIRMED_FROM_CODE` | `AdminNotificationController.java`, `AdminNotificationService.markAllReadFor` |

> **Removed (2026-07-15, AUD-067).** `POST /api/v1/admin/notifications/mark-read` (mark specific IDs) had no UI caller — the bell only ever advanced the whole-inbox marker. Deleted with the move to the per-admin high-water-mark model.

## WebSocket Contract

| Item | Current contract | Status | Evidence |
|---|---|---|---|
| Connect endpoint | `/ws` | `CONFIRMED_FROM_CODE` | `WebSocketConfig.java` |
| CONNECT auth | native header `Authorization: Bearer <admin-jwt>` | `CONFIRMED_FROM_CODE` | `WebSocketConfig.java`, `adminWebSocket.js` |
| Allowed admins | Any active built-in or custom admin role may connect; each subscription is authorized by the destination-specific permission (for example, `/topic/admin/reviews` requires `reviews.read`) | `CONFIRMED_FROM_CODE` | `WebSocketConfig.java` |
| Confirmed topic | `/topic/admin/orders` | `CONFIRMED_FROM_CODE` | `AdminOrderWsService.java`, `adminWebSocket.js` |
| Payload | `OrderWsEvent` with `type`, `orderId`, `orderNumber`, `customerName`, `total`, `status`, `paymentMethod`, `timestamp` | `CONFIRMED_FROM_CODE` | `OrderWsEvent.java` |
| Confirmed topic | `/topic/admin/inventory` | `CONFIRMED_FROM_CODE` | `AdminInventoryWsService.java`, `adminWebSocket.js` |
| Inventory payload | `InventoryWsEvent` with `type`, `productId`, `timestamp`; subscription requires `inventory.read` | `CONFIRMED_FROM_CODE` | `InventoryWsEvent.java`, `WebSocketConfig.java` |
| Confirmed topic | `/topic/admin/reviews` | `CONFIRMED_FROM_CODE` | `AdminReviewWsService.java`, `adminWebSocket.js` |
| Review payload | `ReviewWsEvent` with `type`, `reviewId`, `productId`, `status`, `timestamp`; `REVIEW_SUBMITTED` is sent after the public review transaction commits and subscription requires `reviews.read` | `CONFIRMED_FROM_CODE` | `ReviewWsEvent.java`, `PublicReviewService.java`, `WebSocketConfig.java` |
| Confirmed topic | `/topic/admin/customers` | `CONFIRMED_FROM_CODE` | `AdminCustomerWsService.java`, `adminWebSocket.js` |
| Customer payload | `CustomerWsEvent` with `type`, `customerId`, `status`, `timestamp`; `CUSTOMER_REGISTERED` is sent after the customer registration transaction commits and subscription requires `customers.read` | `CONFIRMED_FROM_CODE` | `CustomerWsEvent.java`, `CustomerAuthService.java`, `WebSocketConfig.java` |
| Admin access queue | `/user/queue/admin/access`; server-to-own-admin only. Payload is `{reason, forceReauthentication}` and intentionally contains no token or permission list. On receipt the client clears stale data and calls `GET /api/v1/auth/me`; `forceReauthentication=true` requires removing local access state and returning to sign-in. | `OWNER_CONFIRMED_2026-07-31` | `AdminAccessChangeService.java`, `WebSocketConfig.java`, `auth.jsx` |
| Presence topics | `/topic/admin/presence/order/{orderId}` requires `orders.read`; `/topic/admin/presence/product/{productId}` requires `products.read` | `CONFIRMED_FROM_CODE` | `WebSocketConfig.java`, `AdminPresenceService.java` |
| Presence command | STOMP `SEND` to `/app/admin/presence` with `{ action: JOIN|LEAVE, entityType: ORDER|PRODUCT, entityId }`; presence is in-memory per WebSocket session, removed on `LEAVE` or disconnect, and never replaces `@Version` conflict protection | `CONFIRMED_FROM_CODE` | `AdminPresenceController.java`, `AdminPresenceService.java`, `OrderEntity.java`, `ProductEntity.java` |


## Admin Reviews Contract

## Admin Home Highlights Contract

The homepage highlight module manages the fixed `{slot, productId}` assignments and
requires `home_highlights.read` for reads. Save is a composite action requiring both
`home_highlights.write` and `products.read`.
The admin response is versioned at the configuration level because one save replaces
the complete set of up to three slots.

| Method | Path | Permission | Purpose |
|---|---|---|---|
| `GET` | `/api/v1/admin/home/category-highlights?lang=vi|en` | `home_highlights.read` | Returns `{ items: HomeHighlightItem[], version: number }`. |
| `PUT` | `/api/v1/admin/home/category-highlights` | `home_highlights.write` + `products.read` | Body `{ slots: [{ slot: 1..3, productId: string }], expectedVersion: number }`; replaces the configured slots and returns the updated items plus version. |

The backend validates that every selected product exists and is `PUBLISHED`. A stale
`expectedVersion` returns `409 CONCURRENT_MODIFICATION`; the client must reload the
configuration before submitting again. The public
`GET /api/v1/home/category-highlights` contract remains an unversioned slot array.
Evidence: `AdminHomeHighlightsController.java`, `HomeHighlightsService.java`,
`HomeHighlightsConfigEntity.java`, migration `V362__add_home_highlights_config_version.sql`.

Admin review endpoints require an Admin JWT and the permission shown below. Evidence:
`AdminReviewController.java`, `AdminReviewService.java`, `ReviewJpaRepository.java`.

| Method | Path | Permission | Purpose |
|---|---|---|---|
| `GET` | `/api/v1/admin/reviews` | `reviews.read` | Paginated review list. Optional `page`, `size`, literal-text `q`, `status` (`PENDING|APPROVED|SPAM|TRASH`), `rating` (one of the 9 half-star levels), and `lang`. Invalid filter enums/ratings return `400`. Stable order is `createdAt DESC, id DESC`. List items expose `version` but deliberately omit `authorEmail`. |
| `GET` | `/api/v1/admin/reviews/{id}` | `reviews.read` | Review detail, including `version`, author email, product metadata and review photos. Email is detail-only. |
| `GET` | `/api/v1/admin/reviews/summary` | `reviews.read` | Whole-system moderation summary, independent of list filters and page. |
| `PATCH` | `/api/v1/admin/reviews/{id}/status` | `reviews.write` | Body `{ "status": "...", "expectedVersion": n }`. Enforces `REVIEW_RULE_009`; a same-state request is a no-op. Stale version → `409 CONCURRENT_MODIFICATION`. Response includes the updated mutation-safe review payload and `version`, but omits detail-only `authorEmail`. |
| `DELETE` | `/api/v1/admin/reviews/{id}?expectedVersion=n` | exact role `SUPER_ADMIN` **and** `reviews.write` | Permanent deletion, allowed only while status is `TRASH`. Returns `204`; wrong state/stale version → `409`, insufficient role → `403`. Photos are cleaned after commit and reference-safely. |
| `POST` | `/api/v1/admin/reviews/bulk-status` | `reviews.write` | Body `{ "items": [{ "id": 1, "expectedVersion": 2 }], "status": "APPROVED" }`, at most 500 items. Best-effort per item with deterministic result below. |
| `POST` | `/api/v1/admin/reviews/bulk-delete` | exact role `SUPER_ADMIN` **and** `reviews.write` | Body `{ "items": [{ "id": 1, "expectedVersion": 2 }] }`, at most 500 items. Each item must currently be `TRASH`. |

Status transitions are exactly those in `STATE_MACHINES.md` §15A:
`PENDING → APPROVED|SPAM|TRASH`, and `APPROVED|SPAM|TRASH → PENDING`.
Choosing the current status changes nothing. The first-ever transition to `APPROVED`
sets a durable marker; the approval email is queued only for that first transition
and dispatched only after commit.

Bulk response `data`:

```json
{
  "affected": 1,
  "skipped": [
    { "id": 12, "reason": "VERSION_CONFLICT" },
    { "id": 12, "reason": "DUPLICATE_ID" }
  ]
}
```

`affected` counts distinct items actually changed/deleted. Occurrence one of an ID
is processed; later occurrences are skipped. Allowed reason values are
`DUPLICATE_ID`, `NOT_FOUND`, `VERSION_CONFLICT`, `INVALID_TRANSITION`,
`NOT_IN_TRASH`, and `NO_CHANGE`.

`GET /api/v1/admin/reviews/summary` returns `ApiDataResponse<AdminReviewSummaryResponse>`:

Its approved aggregate/breakdown and pending counters are read in one repeatable-read snapshot to keep the cards internally consistent while moderators are changing statuses.

```json
{
  "approved": {
    "averageRating": 4.2,
    "totalReviews": 120,
    "ratingBreakdown": { "1": 2, "1.5": 0, "2": 5, "2.5": 1, "3": 13, "3.5": 4, "4": 40, "4.5": 6, "5": 60 }
  },
  "pending": { "totalReviews": 8, "oneStarReviews": 2 }
}
```

`approved` includes only `APPROVED` reviews and follows `REVIEW_RULE_001`; the average is rounded
to one decimal using `HALF_UP` and is `0.0` when there are no public reviews. `ratingBreakdown`
contains all **nine** keys (half-star levels, `REVIEW_RULE_008`, changed 2026-07-22 from five whole-star
keys — no trailing `.0` on whole levels). `pending` is counted across the whole system and is not affected by list
filters. Review photos remain limited to the existing `REVIEW_RULE_005` constraints.

The list `rating` filter affects only the returned rows and `pagination.totalItems`; it never changes
the summary endpoint. Unknown or missing products/authors remain representable in the response with
empty nullable metadata so the admin UI can render an explicit fallback.

Review audit snapshots intentionally contain no `authorEmail`, review body/comment
or photo URLs. They retain only operational metadata such as review/product ID,
status, rating, photo count, timestamps and optimistic version.

## Admin Roles Contract

Admin role and permission-catalog endpoints require an Admin JWT. Role reads and the permission
catalog require `roles.read`; role creation, permission updates and deletion require `roles.write`.
Evidence: `AdminRolesController.java`, `AdminPermissionsController.java`, `AdminRoleService.java`,
`CreateRoleRequest.java`, `UpdateRolePermissionsRequest.java`.

`Role` response objects have the following shape:

```json
{
  "id": "ADMIN",
  "name": "Administrator",
  "description": "Full business operations",
  "isSystem": true,
  "permissions": ["content.read", "content.update"],
  "assignedUserCount": 2,
  "createdAt": "2026-01-01T00:00:00Z",
  "updatedAt": "2026-01-01T00:00:00Z"
}
```

`assignedUserCount` counts rows in `admin_users` whose `role` equals the role id and whose status is
one of `ACTIVE`, `INVITED`, `DISABLED` or `SUSPENDED`. Roles with no matching users return `0`.
The count is informational for the Roles screen; existing role guards and `409` deletion behavior
remain unchanged.

| Method | Path | Permission | Request | Response |
|---|---|---|---|---|
| `GET` | `/api/v1/admin/roles` | `roles.read` | None | `200 ApiDataResponse<Role[]>` |
| `POST` | `/api/v1/admin/roles` | `roles.write` | `{id, name, description?, permissions?}`; id 2–50 chars matching `[A-Z][A-Z0-9_]{1,49}`, name required and max 100 chars, description max 1,000 chars, permissions max 300 | `201 ApiDataResponse<Role>` |
| `PUT` | `/api/v1/admin/roles/{id}/permissions` | `roles.write` | `{permissions?}`; max 300 permission keys | `200 ApiDataResponse<Role>` |
| `DELETE` | `/api/v1/admin/roles/{id}` | `roles.write` | None | `204 No Content` |
| `GET` | `/api/v1/admin/permissions` | `roles.read` | None | `200 ApiDataResponse<PermissionGroup[]>` |

`PermissionGroup` is `{groupKey, permissions}`. Each permission entry is:

```json
{
  "key": "products.update",
  "moduleKey": "products",
  "kind": "WRITE",
  "sensitive": false,
  "requires": ["products.read", "catalog.read"]
}
```

`kind` is one of `READ`, `WRITE`, `EXPORT`, `DANGEROUS`, `SUPPORTING`.
`reports.export` is `EXPORT`, sensitive, and requires `reports.read`; `inventory.read`
is `SUPPORTING`. Wildcard `*` satisfies dependencies but is not an assignable catalog entry.

Create/update role payloads must contain the complete transitive dependency closure. The backend
does not auto-add permissions. A missing edge returns `400 VALIDATION_ERROR`; each detail is:
`{field:"permissions", code:"MISSING_PERMISSION_DEPENDENCY", message:"Permission '<selected>' requires '<missing>'."}`.
Missing/invalid authentication returns `401`; insufficient permission returns `403`; unknown keys
continue to return `UNKNOWN_PERMISSION`.
Updating the role currently assigned to the acting admin cannot remove either `roles.read` or
`roles.write`; the API returns `409` so direct calls cannot bypass the UI self-lockout guard.

Status: `CONFIRMED_FROM_CODE`

## Response Shape Caveats

The repo does not use one wrapper consistently across every controller:

- Most public/customer CRUD endpoints use `ApiDataResponse` or `ApiListResponse`.
- Some admin modules use raw `PageResult`, DTOs, CSV, or other non-envelope responses.

Status: `CONFIRMED_FROM_CODE`

### Admin WebSocket consumers

The existing `/topic/admin/orders` feed has two admin consumers: `OrderListScreen.jsx`
invalidates `['orders']`, while `AdminShell.jsx` invalidates
`['nav-badge', 'orders-pending']` so the pending-order sidebar count refetches
immediately. `/topic/admin/inventory` invalidates `['inventory-summary']` in
`DashboardScreen.jsx`, and `/topic/admin/reviews` invalidates both `['reviews']` and
`['review-summary']` in `ReviewListScreen.jsx`, and `/topic/admin/customers` invalidates both
`['customers']` and `['customer-summary']` in `CustomerListScreen.jsx`; the pending review count
and customer KPIs are screen summaries, not separate sidebar badges. All use the shared reconnecting STOMP client; the REST query
remains the fallback when WebSocket delivery is unavailable.

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

### PDP — descriptionBlocks / specifications.featured (V229–V230, gộp song ngữ V326)

Trang chi tiết sản phẩm (public `GET /api/v1/products/{slug}` + admin upsert) port bố cục mockup.

**Public product detail** (`GET /api/v1/products/{slug}?lang=`):
- `descriptionBlocks` — đã có (V139), nay **localize theo `lang` ở TỪNG FIELD trong từng khối** (en → field `*En` nếu non-blank, fallback field VI; `*En` bị null hóa trong response public). Detail-only. **V327/V328:** không còn chứa khối `suitability`/`sizeGuide` — xem `suitabilitySection`/`sizeGuideSection` (2 field riêng, cùng cơ chế localize theo `lang`).
- `specifications` / `specStats` / `trustBadges` — HTML-only field hiện hành; không còn response cấu trúc (mảng dòng tên/giá trị, lưới value/label, danh sách nhãn) của bảng `product_specifications`/`product_spec_stats`/`product_trust_badges` cũ, đã DROP ở V329/V330.

**Admin upsert** (`POST /api/v1/admin/products`, `PATCH /api/v1/admin/products/{id}`) — presence-flag:
- `descriptionBlocks: DescriptionBlock[]` (≤200) — **V326: 1 mảng duy nhất, mỗi khối mang cả 2 ngôn ngữ inline** (không còn `descriptionBlocksEn` riêng); gửi key (kể cả []) thì render → cả `description` (VI) lẫn `description_en` (EN, resolved per-field với VI fallback) + overwrite, bỏ key thì giữ nguyên cả hai. Admin read trả nguyên mảng thô (field `*En` đọc thẳng trong từng khối, không còn đường `translations.en.descriptionBlocks` riêng).
- `specifications` / `specStats` / `trustBadges` cấu trúc đã gỡ khỏi request; admin chỉ gửi các field HTML tương ứng.

**Đã xóa (2026-07-07):** `tabs`/`tabs: ProductTabRequest[]` (V231) và `sectionVisibility` (V245) — cả API request lẫn response không còn field này; DB cột `product_tabs`/`section_visibility` đã DROP (`V325__drop_dead_product_fields.sql`). Trước đó cả hai đã dormant từ 2026-06-22 (admin không còn gửi, web bỏ qua); nay xóa hẳn khỏi contract. Xem `BUSINESS_RULES.md` `PRODUCT_RULE_006`.

Status: `CONFIRMED_FROM_CODE` — `CatalogController` (public detail), `AdminCatalogController` (upsert/preview),
`UpsertProductRequest` (`descriptionBlocks`, single presence flag since V326), `Product` domain record.
Spec `featured` và các mảng cấu trúc `specifications`/`specStats`/`trustBadges` đã gỡ; xem [DATA_CONTRACT.md](DATA_CONTRACT.md) §"Product specs HTML" / "Product spec-stats HTML" / "Product trust-badges HTML".
