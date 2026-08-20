# Integration Guide

## Confirmed Integrations

| Integration | Current state | Status | Evidence |
|---|---|---|---|
| PostgreSQL | Primary persistence store for backend and CI | `CONFIRMED_FROM_CONFIG` | `docker-compose.yaml`, `.github/workflows/ci.yml` |
| MinIO | Media/object storage | `CONFIRMED_FROM_CODE` + `CONFIRMED_FROM_CONFIG` | `docker-compose.yaml`, `AdminMediaService.java` |
| SMTP mail | Transactional email path exists when env is configured. All mail goes through `EmailDispatchService.send(to, subject, template, ctx)` rendering a Thymeleaf template under `templates/email/`. Templates include customer `password-reset`, `password-change-alert`, order confirmation, and **admin `admin-invite`** (set-password link for newly invited admins; degrades gracefully — when no `JavaMailSender` bean is configured, `isEnabled()` is false and the caller surfaces the invite link instead) | `CONFIRMED_FROM_CODE` + `CONFIRMED_FROM_CONFIG` | `EmailDispatchService.java`, `AdminInviteService.java`, `templates/email/admin-invite.html` |
| Web revalidation | Backend can call Next.js revalidation endpoint with shared secret | `CONFIRMED_FROM_CONFIG` | `docker-compose.yaml` |
| WebSocket/STOMP | Admin order, inventory, review, customer and edit-presence channels are live. Each admin also subscribes to `/user/queue/admin/access`: role/permission changes cause a canonical profile refresh, while disable/suspend/password reset forces sign-in again. The admin client also reconciles `/auth/me` on reconnect, focus and every 30 seconds while visible; all data-topic deliveries recheck the current access server-side. | `OWNER_CONFIRMED_2026-07-31` | `WebSocketConfig.java`, `AdminAccessChangeService.java`, `auth.jsx`, `adminWebSocket.js` |
| Customer order tracking | Customer order detail and guest confirmation pages poll their existing authenticated/secret-link order-read endpoint every 15 seconds while visible, refetch on focus, and stop at `COMPLETED`/`CANCELLED`; no customer WebSocket channel | `CONFIRMED_FROM_CODE` | `CustomerOrderController.java`, `OrderLookupController.java`, `bigbike-web/lib/query/hooks.ts`, `bigbike-web/app/don-hang/xac-nhan/OrderConfirmClient.tsx` |
| VN address data | Dữ liệu hai cấp tỉnh/thành → phường/xã có ở cả API đọc backend và bundle web. Storefront dùng bundle `VN_PROVINCES`; hiện không có caller nội bộ cho API. | `CONFIRMED_FROM_CODE` | `VnAddressController.java`, `vn-address.json`, `vn-address-data.ts`, `VnAddressFields.tsx` |
| Google Gemini (shared backend credential) | Review moderation and the Trợ lý BigBike sales assistant share one backend-only credential but keep independent switches, quotas, models and failure behavior. **Not** a translation path. | `OWNER_CONFIRMED_2026-08-09` | `AiReviewModerationClient.java`, `AiChatClient.java`, `CHAT_RULE_005`/`011`, `REVIEW_RULE_012`/`013` |

> **Gemini auto-translation — STILL REMOVED (2026-07-03).** The VI→EN auto-translation integration
> (Google Gemini `generateContent` API, `GeminiTranslationService`, `AdminTranslateController`,
> `TranslationBackfillService`) remains fully removed. Bilingual content is entered manually by the
> admin — see `BUSINESS_RULES.md` §"Bilingual / Auto-translation Rules" (`TRANSLATION_RULE_001/002`)
> and `API_CONTRACT.md` §"Bilingual content — nhập tay, không còn tự động dịch (V312)". Do not
> re-add a translate endpoint or any auto-translation path without a new decision.
>
> **`GEMINI_API_KEY` is a shared backend AI credential (owner decisions 2026-08-08/09).**
> `AiReviewModerationClient` and `AiChatClient` use it independently; seeing it configured does
> **not** mean auto-translation is back. The common Spring property is
> `bigbike.ai.gemini-api-key=${GEMINI_API_KEY:}`. The legacy
> `bigbike.review-moderation.gemini-api-key` property remains as a compatibility alias so the live
> review moderator is not broken. Each consumer keeps a separately named model and timeout.

## Review moderation (Google Gemini)

Outbound classification call used by the automatic review moderator
(`REVIEW_RULE_012`/`013`). Same provider as the removed auto-translation
integration, but a different purpose and a separate owner decision: this path
classifies text and **never writes model output into customer-visible content**.

| Aspect | Contract |
|---|---|
| Client | Plain Spring `RestClient` (`AiReviewModerationClient`) — the same approach the previous `GeminiTranslationService` used, and the same one the OAuth/revalidation callers use. No SDK dependency. |
| Endpoint | `POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent`, one non-streaming request per review. No retry loop. |
| Credential transport | `x-goog-api-key` **header**, not the `?key=` query parameter Google also accepts. A connect/read failure puts the request URI into the exception message, which would otherwise write the key straight into the application log. |
| Trigger | Once per review, after the submit transaction commits, on the `@Async` pool. Skipped entirely when the banned-word layer already matched or the comment is empty. |
| Request payload | Comment text (truncated to 4,000 chars) + star rating **only**. No email, name, photos, `customer_id`, or order data (`REVIEW_RULE_013`). |
| Response contract | `generationConfig.responseMimeType = application/json` plus a `responseSchema` pinning `violation` / `categories[]` / `reason`. Read from `candidates[0].content.parts[0].text`. A malformed, missing, or safety-blocked reply is treated as `SKIPPED`, never as a block. |
| Cost control | `thinkingConfig.thinkingBudget = 0` — thinking tokens bill as output and buy nothing for a classification. `maxOutputTokens = 512`. |
| Timeout | `BIGBIKE_REVIEW_MODERATION_TIMEOUT_SECONDS` (default 20s) as the read timeout; connect timeout is a fixed 5s. Exceeding either is `SKIPPED`. |
| Failure policy | **Fail-open for the customer, fail-safe for the shop:** any error leaves the review `PENDING` for a human. A provider outage degrades the feature to today's manual behavior; it never blocks submissions and never auto-approves. |

### Environment

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `GEMINI_API_KEY` | Yes, to enable the feature | *(empty)* | Google AI Studio credential. Empty → the moderator reports `SKIPPED` and never calls out. Never stored in `site_settings` or returned by any API. Shared name with the retired translation integration — see the note above. |
| `BIGBIKE_REVIEW_MODERATION_MODEL` | No | `gemini-2.5-flash` | Model id, scoped to this feature on purpose (not a generic `GEMINI_MODEL`). Changing it is a cost/accuracy tradeoff for the shop owner, not a code change. |
| `BIGBIKE_REVIEW_MODERATION_TIMEOUT_SECONDS` | No | `20` | Per-call read-timeout ceiling. |

**A new variable must be declared in two places to reach the container.** The
backend service in `docker-compose.yaml` lists its environment explicitly, so a
line added only to the env file is silently invisible to the app. All three
variables above are declared there.

**On the VPS, always `docker compose --env-file .env.vps …`** (`DEPLOYMENT_GUIDE.md`).
The bare command loads the local `.env` instead, which has previously shipped the
wrong configuration to production. Keep `.env.example` and `.env.vps.example` in
step when this contract changes; never commit a populated `.env` / `.env.vps`.

The master switch and the four category toggles are **settings**, not env — see
`API_CONTRACT.md` §"`review_moderation` group".

## Trợ lý BigBike (Google Gemini)

| Aspect | Contract |
|---|---|
| Client | Plain Spring `RestClient`, `x-goog-api-key` header, `gemini-2.5-flash`; deadline toàn logical turn 65 giây. Retry đúng một lần cho `429`, `5xx`, connect/read timeout, trong trần 4 provider requests và cùng daily slot/requestId; không retry `4xx` khác, schema, safety hoặc guard. |
| Request | Request đầu có current question, bảy function declarations cố định và danh sách nhỏ tên/mã chuẩn của nhóm hàng, thương hiệu công khai hiện hành. Request tiếp theo chỉ nối exact model function call cùng function response tối thiểu của backend trong cùng logical turn. Never full catalog, sản phẩm riêng lẻ, giá, tồn kho, SQL, customer id/email/address, API key hoặc unrelated conversation history. |
| Function schema | `parameters` dùng đúng subset `Schema` của Generate Content API (`type`, `properties`, `required`, `enum`, giới hạn kiểu dữ liệu); không đặt các field JSON Schema như `additionalProperties` vào đây. Hàm không có argument sẽ bỏ qua `parameters`; không dùng `parametersJsonSchema` trong contract hiện tại. |
| Tool boundary | Gemini chỉ chọn bảy tool đọc cố định; registry backend validate tên/schema/sequence/quyền/slug trước khi chạy. `search_articles` chỉ đọc tối đa ba bài PUBLISHED đúng locale và trả nội dung chung đã loại dữ kiện động/URL. Tối đa 3 tool/lượt, cho phép call hợp lệ song song hoặc nối tiếp. `capture_lead` không expose; identity chỉ lấy từ server session. Alias tìm hàng được quét với catalog thật; alias va chạm bị reject. |
| Generation | Bước hiểu ý/chọn dữ liệu dùng `thinkingBudget: 1024`; bước định dạng final dùng `thinkingBudget: 0`; `maxOutputTokens: 2048`. Final bắt buộc JSON schema. Bốn safety category đặt `BLOCK_ONLY_HIGH`; `promptFeedback.blockReason`/`finishReason=SAFETY` đi nhánh từ chối. Guard chỉ cho Markdown paragraph/strong/list/table, tối đa 10 câu hoặc 2.000 ký tự và tối đa 8 sản phẩm. |
| Cost controls | Fast-path và input refusal chạy cục bộ; tối đa 12 lượt thường hoặc 20 lượt khi PDP được xác minh ở request hiện tại; mặc định 400 AI lượt/ngày. Một logical turn tối đa 4 provider requests vẫn dùng một slot. Lưu input/output/thinking token, request count, latency và chi phí ước tính; cảnh báo tổng USD theo tháng Việt Nam dùng setting, ngưỡng 0 tắt và không tự khóa. Giá mặc định Flash là USD 0.30/M input và USD 2.50/M output gồm thinking, có thể cấu hình khi bảng giá đổi. |
| Failure | Disabled, empty credential, exhausted daily quota or provider failure đóng trả `CONTACT`; input/Gemini safety trả `REFUSAL` và giữ hội thoại. Stream không phát draft, chỉ progress code soạn sẵn và final đã guard. |
| Privacy/retention | Conversation rows expire after 90 days. The storefront may keep only a minimal local chat snapshot for at most 24 hours, with a fixed expiry from the first save; it is cleared by delete or logout and contains no lead draft, customer profile, session secret or API key. No chat/question/phone/key is written to application logs. A consented lead records `source=FORM` or `source=ACCOUNT`; the latter is resolved from the authenticated customer record, not from the browser payload. |

Environment: `GEMINI_API_KEY`, `BIGBIKE_CHAT_MODEL=gemini-2.5-flash`, `BIGBIKE_CHAT_TIMEOUT_SECONDS=65`, `BIGBIKE_CHAT_INPUT_COST_USD_PER_MILLION=0.30` và `BIGBIKE_CHAT_OUTPUT_COST_USD_PER_MILLION=2.50`. Khai báo template ở `.env.example`/compose; `.env` thật không commit.

## Web Revalidation (ISR on-demand)

`WebRevalidationService` POSTs cache tags to the Next.js web app's `POST /api/revalidate`
endpoint (header `x-revalidate-secret`) so admin content edits invalidate the matching ISR
cache entries immediately, instead of waiting for the page's time-based `revalidate` window.
`CONFIRMED_FROM_CODE`

- Config: `bigbike.web.revalidate-url`, `bigbike.web.revalidate-secret`
  (Docker env `WEB_REVALIDATE_URL`, `WEB_REVALIDATE_SECRET`). Disabled when either is blank.
  `bigbike.web.redirect-cache-clear-url` (`WEB_REDIRECT_CACHE_CLEAR_URL`) is optional; when
  blank it is derived from every revalidate URL as `/_internal/redirect-cache/clear`.
  `bigbike.web.revalidate-expected-replicas` (`WEB_REVALIDATE_EXPECTED_REPLICAS`) is a
  multi-replica fail-safe: if set above 0, backend startup fails unless the configured
  revalidate/redirect-clear URL fan-out covers every web replica.
- Fires **after transaction commit** (`afterCommit`), async, retry at 1s/3s.
- The web side reads these same tags on its server `fetch` calls in
  `bigbike-web/lib/api/public-api.ts`.
- **Contract rule:** every cache tag the web reads MUST have a backend emitter below —
  otherwise that content only refreshes on its time-based TTL, never on edit.
- Redirect admin mutations call `revalidateRedirects()`: this emits the `redirects` tag and
  immediately clears the web proxy L1 redirect Map through the internal clear endpoint. The
  redirect cache TTL is only a fallback. Clear also drops the active bulk snapshot; the next
  request starts one single-flight refresh.

### Redirect resolution order in `bigbike-web/proxy.ts`

Order matters — getting it wrong costs an extra hop or silently disables the admin table.
`CONFIRMED_FROM_CODE` (verified against live bigbike.vn 2026-08-07)

1. `next.config.ts` `redirects()` — runs **before** proxy. Anything matched here never
   reaches the admin table. Keep it to infrastructure-only rules; see BUSINESS_RULES.md
   `REDIRECT_RULE_008`. **If `docs/legacy/SEO_REDIRECT_MAP.csv` is ever restored, its generic
   `/{slug}.html→/{slug}/` rule will shadow the admin table again — re-check this order then.**
   The file does not exist today, so `csvRedirectRules` is empty.
2. `.html` lookup — legacy `.html` paths hit the redirect table before locale/trailing-slash
   normalization, so `/vi/x.html` and `/en/x.html` stay at one hop.
3. `/vi` prefix normalization, then old unprefixed-English roots.
4. **Slash-less lookup, then trailing-slash `308`.** The table is queried *before* the `308`
   is emitted. 489 of the 8.877 rules store `sourcePattern` without a trailing slash; querying
   after the `308` made every one of them cost two hops. `isLoop` (trailing-slash-insensitive)
   makes a `/x → /x/` rule fall through to the `308` instead of looping. See
   `REDIRECT_RULE_009`.
5. Auth gate, `?s=` search alias, then the general table lookup on the vi-normalized path.

On a healthy backend, `proxy.ts` first uses the enabled-rule snapshot from `/redirects/active`
(single-flight, 30-second TTL), then stores only positive per-path hits in L1. A snapshot
miss is a real miss and is not sent to the backend again until the TTL expires. If the bulk
request times out, fails at the network layer, or returns a non-2xx response, the proxy does
not cache an empty snapshot and falls back to the exact single lookup path. `lookupRedirect`
tries the exact path, then the de-trailed variant; targets are normalized by `translatePath`
(`localizeInternalPath` always ends with `withTrailingSlash`), so neither source nor target
needs a trailing slash to resolve in one hop.

**Failure mode to recognise:** if *every* redirect suddenly 404s and the web log repeats
`[proxy] Backend returned 401 for redirect lookup on "..."`, the shared secret is mismatched —
`INTERNAL_API_TOKEN` (web) must equal `BIGBIKE_INTERNAL_TOKEN` (backend). On the VPS this
usually means the stack was rebuilt with the wrong env-file: use
`docker compose --env-file .env.vps ...` (DEPLOYMENT_GUIDE.md), never the bare command, which
silently falls back to the local-only `.env`.

Tag map — catalog / commerce / home cluster (entity mutation → tags emitted):

| Admin mutation | Tags emitted | Evidence |
|---|---|---|
| Product create/update/delete | `products`, `product:<slug>`, `home-highlights` | `AdminCatalogMutationService.revalidateProduct` |
| Category create/update/delete | `categories`, `category:<slug>`, `products`, `menus`, `home-highlights` | `AdminCatalogMutationService.revalidateCategory` |
| Brand create/update/delete | `brands`, `brand:<slug>`, `products` | `AdminCatalogMutationService.revalidateBrand` |
| Order stock change | `products`, `product:<slug>` | `WebRevalidationService.revalidateProductsForOrder` |
| Home category-highlights save | `home-highlights` | `HomeHighlightsService.saveHighlights` |

> The home highlight block renders product **and** category name/slug/image, so
> `home-highlights` is emitted both when the block is saved and when any product/category
> it may display is edited. Brand edits do not touch the block.
>
> Article mutations emit `articles` and `article:<slug>`. Settings, slider, menu and
> home-video mutations emit `settings`, `sliders`, `menus` and `home-videos` from their
> respective admin services, read by the matching `public-api.ts` functions.
>
> Static hardcoded pages under `bigbike-web/lib/content/static-pages.*` are build-time SSG
> content. They intentionally have no `pages` cache tag and are not included in startup
> revalidation.

## Distributed rate limiting (Redis)

Rate-limit state is a Redis integration, not business data and not a database migration. Production
uses a managed HA Redis-compatible service with TLS/ACL; local Docker Compose uses an internal
service for development and tests only. Bucket keys contain a versioned prefix, tier and HMAC of
the subject, never a raw email, phone, IP, session or token. Expiration follows time-to-refill so
inactive keys disappear automatically. Redis errors use the fail-closed/emergency-fallback policy
defined in `RATE_LIMITING.md`; the fallback is deliberately not distributed and must page
operations. `OWNER_CONFIRMED_2026-08-12`

## Catalog reference cache (Redis)

Category, brand and attribute dictionaries are low-churn reference data and may use the existing
shared Redis instance. Cache entries are immutable read projections, never managed JPA entities;
their safety TTL is one hour. A Redis outage is non-fatal for these reads: the backend logs the
cache error and reads PostgreSQL normally. After a successful committed product, category, brand
or attribute mutation, the relevant reference-cache keys are evicted so customers never wait for
the TTL to see a management change. This cache is separate from rate-limit state and adds no new
Redis service. `OWNER_CONFIRMED_2026-08-20`

## Media Integration Policy

- Public media URLs are validated against configured public base URL rules. `CONFIRMED_FROM_CODE`
- Server-side content detection uses Apache Tika. `CONFIRMED_FROM_CODE`
- SVG is accepted but sanitized on upload (`SvgSanitizer`, Jsoup XML parser): `<script>`, `on*` handlers, `javascript:`/external `href`/`xlink:href`/`src`, `<foreignObject>`/`<image>`/`<style>` and CSS vectors are stripped; payloads without an `<svg>` root are rejected. Tika magic-byte detection is skipped for SVG (unreliable for XML) — the structural parse is the content gate. `CONFIRMED_FROM_CODE`
- **Customer review photos** (`REVIEW_RULE_005`/`011`) are stored in MinIO under the `reviews/{uuid}/...` prefix (public URL `/media/reviews/...`) via a **public, no-auth** upload endpoint (`POST /api/v1/products/{id}/reviews/photos`). Stricter than the admin path: image only (`image/jpeg|png|webp`, declared Content-Type must exactly match Tika magic-byte detection; stored extension is canonicalized — no SVG/GIF/video), ≤ 8 MB, rate-limited per IP (`REVIEW_PHOTO` tier). They are **not** registered in the admin media library (`media` table). Every successful upload creates a durable `review_photo_uploads` ledger row and submit atomically claims it once for the same product. `ReviewPhotoOrphanCleanupService` removes unclaimed uploads older than 24 hours, cascade tombstones left when product deletion removes reviews, and old untracked MinIO objects from the narrow put-before-ledger crash window. Review deletion schedules reference-safe object cleanup only after commit. Photos show publicly only after the review is `APPROVED`. `CONFIRMED_FROM_CODE`
- **Server-side compression before storage** (`MEDIA_RULE_006`): all 3 raster upload paths (admin media original, review photo, customer avatar) run through `ImageCompressionService` (Thumbnailator-backed) before the `putObject` call — admin media original capped at 2000px wide, review photo at 1600px wide, avatar center-cropped to 400×400, all at JPEG quality 0.85. Never upscales, preserves alpha and fails soft (returns the original bytes untouched) on SVG/GIF or a decode error — an upload is never blocked by a compression failure. JPEG/PNG are decoded and resized as required. **Known shared P2 gap (2026-07-28):** WebP is accepted by all three paths, but the current JDK ImageIO runtime has no WebP reader, so WebP reaches the documented fail-soft path and is stored without the required resize. Fixing this requires a shared Media compression change that preserves a correct output MIME/extension when alpha-bearing WebP is re-encoded; it is not a Review-only format-rule change. `CODE_GAP_WEBP_2026-07-28`
- Admin Media Library download is an authenticated `media.read` stream from the MinIO object key recorded in the media row. The controller returns `Content-Disposition: attachment` with `originalFilename`, permits `DELETED` rows, and never redirects the browser to storage or serves a thumbnail/variant. URL-only external video rows have no downloadable object. The former replace-file endpoint and its write path were removed; existing MinIO objects are not changed. `OWNER_CONFIRMED_2026-08-20`

Evidence:

- `AdminMediaService.java`, `SvgSanitizer.java`, `SvgSanitizerTest.java`
- `MediaUrlProperties.java`
- `AdminMediaP0Test.java`
- `ReviewPhotoStorageService.java`, `PublicReviewController.java`, `SafeMediaAssetUrlPolicy.java`
- `ImageCompressionService.java`, `ImageCompressionServiceTest.java`, `ImageVariantService.java`, `CustomerAvatarStorageService.java`

## Search

- Search and search suggest are public GET endpoints with rate limiting support. `CONFIRMED_FROM_CODE`

Evidence:

- `PublicSearchController.java`
- `RateLimitingFilter.java`
- `CustomerCsrfFilter.java`

## Payment — no automatic gateway

New storefront checkout accepts `COD` or `BANK_TRANSFER`. An omitted `paymentMethod` is normalised to `COD`; any other explicit code, including legacy `BACS`, is rejected.

There is **no automatic payment gateway integration**. Both methods are reconciled manually by admin:

- `COD` — cash collected on delivery; admin marks the order paid after the courier hands over the money.
- `BANK_TRANSFER` — shop staff first confirm the order by phone, then send account details by phone/Zalo; no account number, QR, transfer reference, redirect, or webhook is shown or generated by checkout.
- Legacy `BACS` — no longer offered or accepted for new storefront orders; existing BACS orders remain readable and may still be reconciled manually through payment records/`paidAmount`.

No redirect, no provider webhook, no `paymentRedirectUrl`. The Alepay/ZaloPay online-gateway plan was dropped — those method codes are no longer accepted at checkout.

## Social Login (OAuth2) — Google & Facebook

The backend supports Google and Facebook OAuth callbacks. The storefront login **and** register
screens each expose **both** provider buttons (`SocialLoginButtons.tsx`).
The backend implements the **authorization-code flow manually** (`CustomerOAuthController` +
`CustomerOAuthService`) rather than Spring Security's auto-wired `/oauth2/*` chain — the
custom `CustomerSessionFilter` / `CustomerCsrfFilter` and the `STATELESS` policy make the
manual flow simpler and conflict-free. No new Maven dependency is required.

**Provider setup:**

- **Google** — create an OAuth client in Google Cloud Console → APIs & Services → Credentials.
  Authorized redirect URI: `{OAUTH_CALLBACK_BASE_URL}/api/v1/customer/auth/oauth/google/callback`.
  Scope: `openid email profile`. Token endpoint `https://oauth2.googleapis.com/token`,
  userinfo `https://openidconnect.googleapis.com/v1/userinfo`.
- **Facebook** — create an app at developers.facebook.com → Facebook Login product.
  Valid OAuth Redirect URI: `{OAUTH_CALLBACK_BASE_URL}/api/v1/customer/auth/oauth/facebook/callback`.
  Scope: `email,public_profile`, plus `auth_type=rerequest` on the authorize URL. Token endpoint
  `https://graph.facebook.com/v19.0/oauth/access_token`, profile
  `https://graph.facebook.com/me?fields=id,name,email` — called with `appsecret_proof`
  (HMAC-SHA256 of the access token keyed by the app secret) so a stolen token cannot be replayed.
  ⚠️ Facebook requires **App Review + Business Verification** before the `email` scope works
  for the public; in Development mode only app admins/testers/developers can log in.
  ⚠️ Facebook may return **no email** (user revoked the permission) — the callback then
  creates an account without email or fails gracefully; it cannot link to an existing account.
  A repeat login by the same linked customer **does** backfill the email later if the provider
  starts supplying a verified one (e.g. after App Review approval) and no other customer already
  owns that address — see `CustomerOAuthService.backfillEmailIfMissing`.
  ⚠️ **`auth_type=rerequest` is required, not optional.** Without it Facebook silently reuses
  whatever the customer granted on an *earlier* authorization of this app and never shows the
  consent screen again — so any customer who logged in before `email` had App Review approval
  stays stuck with a `public_profile`-only grant forever, even after re-authorizing. This bit
  bigbike itself: the app went live and got `email` approved on 2026-08-07, but a test login from
  before that change kept coming back with no email until this parameter was added.

> **The redirect URI must be registered provider-side, exactly.** Google answers
> `Error 400: redirect_uri_mismatch` otherwise, and the customer never reaches the consent
> screen. This is what blocked Google sign-in on production until 2026-08-07 despite correct
> credentials — see `docs/audits/FINDING_2026-08-07_COOKIE_DOMAIN_SPLIT_HOST.md` §F-2.

**Credentials** are read from environment variables — keys `OAUTH_GOOGLE_*`,
`OAUTH_FACEBOOK_*`, `OAUTH_CALLBACK_BASE_URL`, `OAUTH_WEB_SUCCESS_URL`. See `.env.example`.
When client id/secret are blank, the social buttons still render and the flow lands on the login
page with `?error=oauth_unconfigured`, which the storefront explains in words.

**Account linking rules** (`CustomerOAuthService.linkOrCreate`, revised 2026-08-07 —
CUSTOMER_RULE_010):

- An existing `(provider, subject)` in `customer_oauth_links` reuses that account. Both providers
  can be linked to one customer — a second link no longer overwrites the first.
- A provider email that matches an existing account only adopts it when that account **has no
  password** (`password_hash IS NULL`) — i.e. it's itself a social-only account. A password
  account is **never** adopted, even with a matching verified email; a separate account is created
  instead, with `email = null` to avoid the `customers_email_unique` collision. (Before 2026-08-07,
  a *verified* password account was adopted too — only an *unverified* one was protected. Password
  accounts and social accounts are now deliberately separate identities.)
- A non-`ACTIVE` account is refused with `oauth_blocked` rather than being given a session that
  `CustomerSessionFilter` will then reject — that combination looked like a silent login loop.
- On every login (creation, first link, repeat sign-in) `display_name`/`avatar_url` are overwritten
  with the provider's current values (`syncProfileFromProvider`) — a social account has no
  self-service profile edit (`CustomerAuthService.requireNotOauthManaged` returns `403` on
  `PATCH /customer/me` and the avatar endpoints), so this sync-on-login is the only update path.

The "Tài khoản liên kết" link/unlink panel at `/tai-khoan/edit-account/` was **removed 2026-08-07**
— with new logins no longer able to attach to a password account, there was nothing left for a
self-service screen to manage. `GET`/`DELETE /api/v1/customer/auth/oauth/links` remain live on the
backend (grandfathered pre-2026-08-07 accounts, API completeness) but are called by no `bigbike-web`
UI.

> **Cookies:** the callback issues the session cookies from the API host. On a split-host
> deployment (`bigbike.vn` + `api.bigbike.vn`) `BIGBIKE_COOKIES_DOMAIN` must be set, or the
> storefront cannot see the session and the post-login redirect bounces straight back to the
> login page. See `DEPLOYMENT_GUIDE.md` §Cookie Domain.

## Not Confirmed In Active Repo

| Topic | Current finding | Status |
|---|---|---|
| External shipping carrier | No confirmed GHN/GHTK/ViettelPost integration. | `NOT_FOUND_IN_REPO` |

Evidence:

- repo search for carrier implementations
