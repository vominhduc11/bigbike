# Integration Guide

## Confirmed Integrations

| Integration | Current state | Status | Evidence |
|---|---|---|---|
| PostgreSQL | Primary persistence store for backend and CI | `CONFIRMED_FROM_CONFIG` | `docker-compose.yaml`, `.github/workflows/ci.yml` |
| MinIO | Media/object storage | `CONFIRMED_FROM_CODE` + `CONFIRMED_FROM_CONFIG` | `docker-compose.yaml`, `AdminMediaService.java` |
| SMTP mail | Transactional email path exists when env is configured. All mail goes through the shared `EmailDispatchService`, rendering Thymeleaf templates under `templates/email/`. Templates include customer mail, **admin `admin-invite`**, the bilingual daily out-of-stock digest, and the bilingual post-purchase review invitation. Review invitations use the same ordinary Gmail mailbox but are paced separately: one attempt per 10-minute tick during 09:00–20:50 Vietnam time and a fixed ceiling of 20/day. They never retry. Transactional calls remain immediate and do not consume this review-invitation quota. A successful SMTP call means only that the provider accepted the message for processing, not that the recipient received it. | `OWNER_CONFIRMED_2026-09-01` | `EmailDispatchService.java`, invitation/digest email services and templates |
| Telegram Bot API | Optional internal new-order alert. One `sendMessage` call is scheduled asynchronously after the checkout transaction commits; it is disabled when either credential is blank. Provider failure, timeout or rejection is fail-open for checkout and is recorded only as a sanitized warning. | `OWNER_CONFIRMED_2026-09-05` | Telegram order notification service, `CheckoutService.java` |
| Web revalidation | Backend can call Next.js revalidation endpoint with shared secret | `CONFIRMED_FROM_CONFIG` | `docker-compose.yaml` |
| WebSocket/STOMP | Admin order, inventory, review, customer and edit-presence channels are live. The inventory topic also carries a lightweight `INVENTORY_OUT_OF_STOCK_DIGEST_READY` refresh event after the persistent morning snapshot commits; it does not duplicate the long list in the frame. Each admin also subscribes to `/user/queue/admin/access`; all topic deliveries recheck current access server-side. | `OWNER_CONFIRMED_2026-08-31` | `WebSocketConfig.java`, `AdminInventoryWsService.java`, `AdminAccessChangeService.java`, `adminWebSocket.js` |
| Customer order tracking | Customer order detail and guest confirmation pages poll their existing authenticated/secret-link order-read endpoint every 15 seconds while visible, refetch on focus, and stop at `COMPLETED`/`CANCELLED`; no customer WebSocket channel | `CONFIRMED_FROM_CODE` | `CustomerOrderController.java`, `OrderLookupController.java`, `bigbike-web/lib/query/hooks.ts`, `bigbike-web/app/don-hang/xac-nhan/OrderConfirmClient.tsx` |
| VN address data | Dữ liệu hai cấp tỉnh/thành → phường/xã có ở cả API đọc backend và bundle web. Storefront dùng bundle `VN_PROVINCES`; hiện không có caller nội bộ cho API. | `CONFIRMED_FROM_CODE` | `VnAddressController.java`, `vn-address.json`, `vn-address-data.ts`, `VnAddressFields.tsx` |
| Google Gemini (shared backend credential) | Review moderation and Trợ lý BigBike share one backend-only credential but remain separate features. The assistant is fixed to Gemini 3.7 Flash with same-model retries; review moderation keeps its independent model/switch/failure behavior. **Not** a translation path. | `OWNER_CONFIRMED_2026-08-29` | `AiReviewModerationClient.java`, `AiChatClient.java`, `CHAT_RULE_019`, `REVIEW_RULE_012`/`013` |
| Synology NAS (offsite backup) | Sole offsite copy of sales data, media and operational config. Reached over the existing Tailscale tailnet — **no new Internet-facing port**. NFS v4.0 mount at `/mnt/bigbike-nas`, all writes confined to the `vps-backups/` subdirectory. Hourly database dumps, daily media and config archives, SHA-256 verified by read-back. | `OWNER_CONFIRMED_2026-09-06` | `scripts/ops/backup-to-nas.sh`, `/etc/cron.d/bigbike-backup`, [BACKUP_RESTORE_RUNBOOK.md](BACKUP_RESTORE_RUNBOOK.md) |
| Google Analytics 4 (storefront) | `gtag.js` loaded once from the storefront root layout with measurement id `NEXT_PUBLIC_GA4_MEASUREMENT_ID`. Ten e-commerce events plus GA4's own `page_view`. Google Tag Manager was removed 2026-09-06 — GA4 is wired directly and there must be exactly one measurement install in the repo. Blank id → the scripts are not rendered at all. | `OWNER_CONFIRMED_2026-09-06` | `bigbike-web/app/[locale]/layout.tsx`, `bigbike-web/lib/analytics.ts`, `bigbike-web/Dockerfile`, `docker-compose.yaml` |

### Internal notification recipient

`BIGBIKE_MAIL_ADMIN` is the single deployment declaration for the shop's internal
notification mailbox. It is passed to `bigbike.mail.admin` without an email-address
fallback. New-order notifications read this resolved value. The backend fails during startup when
`BIGBIKE_MAIL_ADMIN` is missing or is not a valid email address, so a deployment cannot
silently queue internal alerts to nowhere. The sender address and customer-email paths are
separate and are unchanged by this setting.

### Telegram new-order notification

Telegram carries two unrelated internal alert kinds. **(1) New orders** — described below; this was the only use until 2026-09-06. **(2) Backup alerts** — the offsite backup jobs post failure alerts, a >24h staleness alert and a daily 06:00 digest through the same bot and chat id, sent from shell (`scripts/ops/lib/nas-common.sh`) rather than from the backend, and always paired with the same message to `BIGBIKE_MAIL_ADMIN` per owner decision 2026-09-06. The backend Java path below is unchanged and remains scoped to `NEW_ORDER`. The backend builds an
immutable notification snapshot from the cart/order line data already being persisted by checkout;
it does not perform a product lookup after checkout. The snapshot contains the order number,
customer contact fields, payment label, source label, total, up to the first ten line items and an
admin URL for the created order. Blank values are omitted or rendered as `—`; `null` is never sent.

The client calls the Bot API `sendMessage` endpoint with `parse_mode=HTML`, escaping every dynamic
value before inserting it into the approved Vietnamese message. The order number, title and total
are bold, the phone number is rendered as copyable code text, and the final admin label is a
clickable link. Product lines include the snapshotted product/variant name, quantity and unit price.
If more than ten lines exist, the message adds `… và N món khác`. The formatter preserves valid HTML
markup and truncates the final text to Telegram's 4,096-character limit rather than rejecting it.

The dispatch is registered after commit and runs on Spring's async executor, so Telegram latency
cannot hold the customer request or roll back the order. It makes one attempt only. Warnings contain
the order number and a safe failure category/status; bot token, chat ID, request URL, message body
and raw provider exception text are never logged.

| Environment variable | Required | Default / disabled state | Purpose |
|---|---|---|---|
| `BIGBIKE_TELEGRAM_BOT_TOKEN` | No | Empty disables Telegram | Bot credential; never logged or committed |
| `BIGBIKE_TELEGRAM_CHAT_ID` | No | Empty disables Telegram | Single internal destination chat; never logged |
| `BIGBIKE_TELEGRAM_API_BASE_URL` | No | `https://api.telegram.org` when blank | Bot API base URL; tests point this at a fake HTTP server |
| `BIGBIKE_TELEGRAM_TIMEOUT_SECONDS` | No | `5` when blank or invalid | Connect/read timeout ceiling for the one provider call |

The variables are declared in `.env.example`, `.env.vps.example`, `docker-compose.yaml` and the
backend application properties. They are not validated as startup-required settings. Local and CI
tests use a fake base URL and synthetic credentials only; no test contacts Telegram.

### Post-purchase review invitation mail

The workflow is automatic after the first scheduler callback following deployment. It waits a
fixed seven days after order completion and reserves at most 20 attempts per Vietnam calendar
day. `BIGBIKE_REVIEW_INVITATION_ENABLED` is the only emergency switch and defaults to `true`;
turning it off closes the active campaign and permanently skips pending deliveries. Turning it
back on starts a new campaign without backfill. There is no admin settings or reporting surface.

No new SMTP account, broker or scheduling infrastructure is introduced. The 04:30 Vietnam-time queue job and the 10-minute daytime dispatcher reuse Spring scheduling and the shared mail renderer. The dispatcher atomically reserves one row in the Vietnam-date quota ledger before handing an email to SMTP. `FAILED` and stale `SENDING → UNCERTAIN` are final, not retryable; this favors avoiding duplicate/bulk mail over maximizing delivery. Transactional order/account/review-approved mail does not enter this queue and therefore keeps priority.

The template receives only the recipient display name, order number, localized product names/URLs and an unsubscribe URL. Product and unsubscribe secrets are random URL-safe values; persistence receives SHA-256 hashes only. Product URLs put the secret after `#write-review=` and the unsubscribe URL after `#token=`, so browsers do not send it in the initial HTTP request or ordinary referrer. Tests inject a fake dispatcher and render locally; they must never configure or contact the real Gmail account (`REVIEW_RULE_014`–`016`).

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
| Client/model | Plain Spring `RestClient` with `x-goog-api-key`. Sales assistant is always `gemini-3.7-flash` from server configuration; no DB setting, model discovery, price registry or fallback model. |
| Request/tools | Current question, fixed seven read-only tool declarations and verified minimal context only. Never full catalog, SQL, customer identity/contact, key or unrelated history. Tool calls are schema/permission/allowlist validated independently; at most 3 tools/logical turn. |
| Retry/failure | Logical turn has 65 seconds and at most 4 provider calls. Timeout, overload, `429`, `5xx`, network, empty or invalid provider payload only retry the same `gemini-3.7-flash` while budget remains. Safety/content refusal is not retried. Final technical failure returns polite direct-contact actions; it never silently changes model or creates handoff. |
| Quota/transaction | One logical AI turn reserves one atomic daily slot (default 400, Vietnam time); retries do not reserve another. Fast-path, safety refusal and clarification stay local. Provider waits are outside DB transactions. |
| Safety/privacy | Guard limits output to 10 sentences/2,000 characters and verified product cards. Conversation retention is 90 days; first-party visitor identity is session-only (owner decision 2026-09-05, `CHAT_RULE_049`), created only when the customer opens the chat panel, deletable by the customer, never IP/fingerprint. No chat/question/token/phone is logged. |
| Natural-language search | `ai_assistant_search_ai_interpretation_enabled` controls AI interpretation; backend verifies result against catalog. Common abbreviations are a fixed code list, not owner-editable data. |
| Direct contact | Customer opens the existing Hotline/Zalo/Messenger contact card. No handoff row, staff assignment, staff message, email, notification or realtime chat is created. |
| Image input | When the AI service is configured, image sending is always available and has no setting switch. Upload sends only re-encoded bytes, not EXIF/filename; private MinIO bucket plus ownership/`chat.read` stream. Contract is 1 image/turn, 3/conversation, 20/day, 8 MB. Image intent uses the same fixed model and catalog matching remains verified/local with “trông giống”. |

Environment: `GEMINI_API_KEY`, `BIGBIKE_CHAT_MODEL=gemini-3.7-flash`, `BIGBIKE_CHAT_TIMEOUT_SECONDS=65`, `MINIO_CHAT_PRIVATE_BUCKET=bigbike-chat-private`. The model property is validated at startup and is not an owner setting. Declare variables in `.env.example`, `.env.vps.example` and Compose; populated `.env`/`.env.vps` are never committed.

Review moderation remains a separate Google-Gemini client with its own model, timeout, setting group and failure policy. Changing the assistant must not alter that integration.

## Homepage YouTube Video Feed

`HOME_VIDEO_RULE_001`–`003` dùng duy nhất site setting `youtube_url`. Không có API key,
biến môi trường hoặc hạ tầng mới; TikTok/Facebook không có client, placeholder hay nhánh
dự phòng trong luồng tự động.

1. Scheduler chạy `0 10 4 * * *`, zone `Asia/Ho_Chi_Minh`.
2. URL `/channel/UC...` tạo thẳng feed `https://www.youtube.com/feeds/videos.xml?channel_id=...`;
   URL `/@handle` đọc đúng trang kênh và lấy RSS alternate link, chỉ chấp nhận host/path feed
   cố định của YouTube.
3. Feed tối đa 15 entry phải có channel id khớp, video id/title/published/link hợp lệ. Client
   đặt timeout, giới hạn kích thước response và không theo redirect ra ngoài allowlist.
4. Trước khi ghi, dịch vụ duyệt lần lượt các ứng viên có thể lên 10 vị trí. Entry còn trong
   feed là available; video YouTube cũ dùng `https://www.youtube.com/oembed` công khai:
   `200` = available, `401/404/410` = removed/private, mọi status/lỗi khác = UNKNOWN.
5. Bất kỳ UNKNOWN, feed lỗi/rỗng/sai cấu trúc hoặc setting đổi trong lúc chạy đều no-op toàn
   bộ. Network hoàn tất trước transaction; transaction đọc lại setting/kho, chống trùng lần
   cuối, chỉ insert mới hoặc đổi `is_active` sang false, rồi revalidate `home-videos` after commit.

Không kiểm tra video TikTok/Facebook/upload nhập tay. Video YouTube active nằm ngoài nhóm có
thể lên 10 vị trí cũng chưa cần gọi availability; khi nó trở thành ứng viên, lần chạy kế tiếp
sẽ kiểm tra trước khi cho nó nằm trong danh sách cuối.

Status: `OWNER_CONFIRMED_2026-08-31; CONFIRMED_FROM_CODE_AND_TEST` — `HOME_VIDEO_RULE_001`–`003`.

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
> The nightly YouTube sync emits `home-videos` only when its committed transaction actually
> inserted or disabled at least one row; a failed/no-change run emits nothing.
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
- New Admin Media uploads accept only JPEG/PNG/WebP images and MP4 video. Apache Tika content detection must match the declared MIME exactly; filename extensions are not trusted, so GIF/SVG content and renamed GIF/SVG files are rejected. Customer review/avatar/chat upload paths retain their separate JPEG/PNG/WebP contracts. `OWNER_CONFIRMED_2026-08-28`
- **Customer review photos** (`REVIEW_RULE_005`/`011`) are stored in MinIO under the `reviews/{uuid}/...` prefix (public URL `/media/reviews/...`) via a **public, no-auth** upload endpoint (`POST /api/v1/products/{id}/reviews/photos`). Stricter than the admin path: image only (`image/jpeg|png|webp`, declared Content-Type must exactly match Tika magic-byte detection; stored extension is canonicalized — no SVG/GIF/video), ≤ 8 MB, rate-limited per IP (`REVIEW_PHOTO` tier). They are **not** registered in the admin media library (`media` table). Every successful upload creates a durable `review_photo_uploads` ledger row and submit atomically claims it once for the same product. `ReviewPhotoOrphanCleanupService` removes unclaimed uploads older than 24 hours, cascade tombstones left when product deletion removes reviews, and old untracked MinIO objects from the narrow put-before-ledger crash window. Review deletion schedules reference-safe object cleanup only after commit. Photos show publicly only after the review is `APPROVED`. `CONFIRMED_FROM_CODE`
- **Server-side compression before storage** (`MEDIA_RULE_006`): all 3 raster upload paths (admin media original, review photo, customer avatar) run through `ImageCompressionService` (Thumbnailator-backed) before the `putObject` call — admin media original capped at 2000px wide, review photo at 1600px wide, avatar center-cropped to 400×400, all at JPEG quality 0.85. Never upscales, preserves alpha and fails soft (returns the original bytes untouched) on a decode error — an upload is never blocked by a compression failure. JPEG/PNG are decoded and resized as required. **Known shared P2 gap (2026-07-28):** WebP is accepted by all three paths, but the current JDK ImageIO runtime has no WebP reader, so WebP reaches the documented fail-soft path and is stored without the required resize. Fixing this requires a shared Media compression change that preserves a correct output MIME/extension when alpha-bearing WebP is re-encoded; it is not a Review-only format-rule change. `CODE_GAP_WEBP_2026-07-28`
- Admin Media Library download is an authenticated `media.read` stream from the MinIO object key recorded in the media row. The controller returns `Content-Disposition: attachment` with `originalFilename`, permits `DELETED` rows, and never redirects the browser to storage or serves a thumbnail/variant. URL-only external video rows have no downloadable object. The former replace-file endpoint and its write path were removed; existing MinIO objects are not changed. `OWNER_CONFIRMED_2026-08-20`

Evidence:

- `AdminMediaService.java`, `AdminMediaP0Test.java`
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

## Google Analytics 4 (storefront)

`bigbike-web` reports to Google Analytics 4 directly. Google Tag Manager was removed on
2026-09-06: it had been installed but its container id was never populated in any environment
file, so the property recorded nothing. Replacing it with `gtag.js` keeps a single, auditable
measurement path — **exactly one install may exist in the repo**, because a second one would
double every number the property reports, revenue included.

| Aspect | Contract |
|---|---|
| Property | Measurement id `G-REZM4NT0CS` — the shop's existing GA4 property. It carries four years of history and must never be replaced with a freshly created one. |
| Load point | `bigbike-web/app/[locale]/layout.tsx` only. An inline `next/script` (`id="ga4-init"`, `strategy="afterInteractive"`) defines `window.dataLayer` + `window.gtag` and calls `gtag('js')` / `gtag('config')`; a second `next/script` pulls `https://www.googletagmanager.com/gtag/js?id=…`. Both render only when the id is set. |
| Page views | GA4's own Enhanced Measurement ("page changes based on browser history events") handles client-side navigation. The storefront fires **no** manual `page_view` — doing so would double-count unless the shop owner disabled that GA4 setting by hand. |
| Event helper | `bigbike-web/lib/analytics.ts` is the single choke point. It calls `window.gtag("event", …)` and no-ops when `gtag` is absent (server render, or id not configured). No component talks to `gtag` directly. |
| Events | `view_item_list`, `select_item`, `view_item`, `add_to_cart`, `remove_from_cart`, `view_cart`, `begin_checkout`, `add_shipping_info`, `add_payment_info`, `purchase`. |
| `add_shipping_info` | The storefront has no carrier chooser — shipping inside the system is always free and any real fee is settled with the customer off-platform. The event is emitted once per cart with a fixed `shipping_tier`, so GA4's ordered checkout funnel stays complete. |
| Money | `currency` is always `"VND"` and is present on every event that carries a value. Prices are integers (`Math.round`); VND has no minor unit, so values are never scaled by 100. Formatted strings must never be sent. |
| Item ids | `item_id` is the real merchant **SKU**, matching Google Merchant Center and Google Ads. Cart/order lines fall back to the internal product id only when a line has no SKU. Before 2026-09-06 the internal UUID was sent instead, so product-level reports do not join across that date. |
| `purchase` | `transaction_id` is the real `orderNumber`, never a timestamp or random value, and fires **once** per order — guarded by an in-memory latch plus a `sessionStorage` key on the order id. |
| Privacy | GA4 receives order number, SKU, product name, quantity and price only. It must never receive customer name, email, phone, address, or the order lookup `orderKey`. |
| CSP | No change required. `next.config.ts` already allows `https://www.googletagmanager.com` in `script-src` (which is where `gtag.js` is served from) and `https://www.google-analytics.com` in `connect-src`. |

### Environment

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `NEXT_PUBLIC_GA4_MEASUREMENT_ID` | Yes, to enable measurement | *(empty)* | GA4 measurement id, shape `G-XXXXXXXXXX`. Production: `G-REZM4NT0CS`. Leave empty on staging/local so test traffic never pollutes the property. Validated at build time by `bigbike-web/env.ts`; a malformed value fails the build rather than reaching the browser. |

**This variable must be declared in three places, not two.** Unlike a backend
variable, a `NEXT_PUBLIC_*` value is compiled into the browser bundle by
`next build`, so it needs:

1. `build.args:` on the `bigbike-web` service in `docker-compose.yaml`, **and**
2. a matching `ARG` + `ENV` pair in `bigbike-web/Dockerfile`, placed before the
   `RUN npm run build` line, **and**
3. `environment:` on the same service, for anything read during server render.

Declaring it only under `environment:` is one half of the defect that kept the
previous Google Tag Manager install silent; the other half was that
`NEXT_PUBLIC_GTM_ID` was left blank in every env file. Both were confirmed inside
the running container on 2026-09-06.
**Changing this value therefore requires rebuilding the web image — a restart is
not enough.** See `DEPLOYMENT_GUIDE.md` §"Storefront analytics (Google Analytics 4)".

**On the VPS, always `docker compose --env-file .env.vps …`.** Keep
`.env.example`, `.env.vps.example` and `bigbike-web/.env.example` in step when
this contract changes; never commit a populated `.env` / `.env.vps`.

## Offsite backup target (Synology NAS over Tailscale)

`OWNER_CONFIRMED_2026-09-06`

The only copy of BigBike data outside this VPS. See [BACKUP_RESTORE_RUNBOOK.md](BACKUP_RESTORE_RUNBOOK.md)
for the operating and restore procedure, and DEPLOYMENT_GUIDE.md for the schedule.

### Environment

This integration introduces **no new environment variable**. It reuses, read directly from `.env.vps` by the
shell library and never echoed or logged: `BIGBIKE_TELEGRAM_BOT_TOKEN`, `BIGBIKE_TELEGRAM_CHAT_ID`,
`BIGBIKE_MAIL_HOST`/`_PORT`/`_USERNAME`/`_PASSWORD`/`_FROM`/`_FROM_NAME`/`_STARTTLS`, and `BIGBIKE_MAIL_ADMIN`.
Postgres credentials are never expanded on the host: `pg_dump` runs inside `bigbike-postgres` and dereferences
`$POSTGRES_PASSWORD` there.

### Transport

Tailscale node `home-nas` (`100.116.56.123`), export `/volume1/Bigbike`, **NFS v4.0** over TCP 2049. The NAS
rejects `nfsvers=4.1`. Because the provider blocks outbound UDP, the tailnet always relays through DERP Hong
Kong: ~105 ms RTT, ~1.1 MB/s, ~280 ms per file operation. That per-operation cost is why media is shipped as a
single incremental archive rather than a file-by-file mirror.

### What is backed up

| Kind | Contents | Cadence |
|---|---|---|
| `db` | `pg_dump --format=custom` of the `bigbike` database, taken online | hourly |
| `media` | The whole `bigbike_minio_data` volume — both `bigbike-media` and `bigbike-chat-private` buckets — minus MinIO's in-flight `tmp`/`multipart` staging | daily |
| `config` | `.env`/`.env.vps`, `docker-compose.yaml`, the **live** nginx vhosts from `/etc/nginx/sites-available` (BigBike only), ufw rules, the backup schedule, the NAS mount units, and the repo's uncommitted working-tree patch | daily |

The config job filters `*bigbike*` explicitly so the co-tenant 4thitek stack's nginx configuration is never
collected. Application source is not backed up — it lives in Git — but the uncommitted patch is, because the
VPS has repeatedly carried working-tree changes that Git did not yet hold.

## Not Confirmed In Active Repo

| Topic | Current finding | Status |
|---|---|---|
| External shipping carrier | No confirmed GHN/GHTK/ViettelPost integration. | `NOT_FOUND_IN_REPO` |

Evidence:

- repo search for carrier implementations
