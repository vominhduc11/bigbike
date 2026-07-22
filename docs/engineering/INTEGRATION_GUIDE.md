# Integration Guide

## Confirmed Integrations

| Integration | Current state | Status | Evidence |
|---|---|---|---|
| PostgreSQL | Primary persistence store for backend and CI | `CONFIRMED_FROM_CONFIG` | `docker-compose.yaml`, `.github/workflows/ci.yml` |
| MinIO | Media/object storage | `CONFIRMED_FROM_CODE` + `CONFIRMED_FROM_CONFIG` | `docker-compose.yaml`, `AdminMediaService.java` |
| SMTP mail | Transactional email path exists when env is configured. All mail goes through `EmailDispatchService.send(to, subject, template, ctx)` rendering a Thymeleaf template under `templates/email/`. Templates include customer `password-reset`, `password-change-alert`, order confirmation, and **admin `admin-invite`** (set-password link for newly invited admins; degrades gracefully — when no `JavaMailSender` bean is configured, `isEnabled()` is false and the caller surfaces the invite link instead) | `CONFIRMED_FROM_CODE` + `CONFIRMED_FROM_CONFIG` | `EmailDispatchService.java`, `AdminInviteService.java`, `templates/email/admin-invite.html` |
| Web revalidation | Backend can call Next.js revalidation endpoint with shared secret | `CONFIRMED_FROM_CONFIG` | `docker-compose.yaml` |
| WebSocket/STOMP | Admin order and inventory push channels are live; order list, pending-order sidebar badge, and Dashboard inventory alert consume the feeds | `CONFIRMED_FROM_CODE` | `WebSocketConfig.java`, `AdminOrderWsService.java`, `AdminInventoryWsService.java`, `OrderListScreen.jsx`, `AdminShell.jsx`, `DashboardScreen.jsx` |
| VN address data | Dữ liệu hai cấp tỉnh/thành → phường/xã có ở cả API đọc backend và bundle web. Storefront dùng bundle `VN_PROVINCES`; hiện không có caller nội bộ cho API. | `CONFIRMED_FROM_CODE` | `VnAddressController.java`, `vn-address.json`, `vn-address-data.ts`, `VnAddressFields.tsx` |

> **Gemini auto-translation — REMOVED (2026-07-03).** The VI→EN auto-translation integration (Google
> Gemini `generateContent` API, `GeminiTranslationService`, `AdminTranslateController`,
> `TranslationBackfillService`) has been fully removed from the codebase. Bilingual content is now
> entered manually by the admin — see `BUSINESS_RULES.md` §"Bilingual / Auto-translation Rules"
> (`TRANSLATION_RULE_001/002`) and `API_CONTRACT.md` §"Bilingual content — nhập tay, không còn tự
> động dịch (V312)". This section is kept only as historical context; do not reintroduce
> `GEMINI_API_KEY`/`GEMINI_MODEL` config or re-add a translate endpoint without a new decision.

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
  redirect cache TTL is only a fallback.

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

## Media Integration Policy

- Public media URLs are validated against configured public base URL rules. `CONFIRMED_FROM_CODE`
- Server-side content detection uses Apache Tika. `CONFIRMED_FROM_CODE`
- SVG is accepted but sanitized on upload (`SvgSanitizer`, Jsoup XML parser): `<script>`, `on*` handlers, `javascript:`/external `href`/`xlink:href`/`src`, `<foreignObject>`/`<image>`/`<style>` and CSS vectors are stripped; payloads without an `<svg>` root are rejected. Tika magic-byte detection is skipped for SVG (unreliable for XML) — the structural parse is the content gate. `CONFIRMED_FROM_CODE`
- **Customer review photos** (`REVIEW_RULE_005`) are stored in MinIO under the `reviews/{uuid}/...` prefix (public URL `/media/reviews/...`) via a **public, no-auth** upload endpoint (`POST /api/v1/products/{id}/reviews/photos`). Stricter than the admin path: image only (`image/jpeg|png|webp`, Tika magic-byte enforced — no SVG/GIF/video), ≤ 8 MB, rate-limited per IP (`REVIEW_PHOTO` tier). They are **not** registered in the admin media library (`media` table) — they live purely as MinIO objects referenced by `reviews.photos`. Abuse surface is bounded by the type/size/rate caps plus the moderation gate (photos show publicly only after the review is `APPROVED`). Orphan note: a photo uploaded but never attached to a submitted review remains in MinIO; periodic cleanup is a separate task. `CONFIRMED_FROM_CODE`

Evidence:

- `AdminMediaService.java`, `SvgSanitizer.java`, `SvgSanitizerTest.java`
- `MediaUrlProperties.java`
- `AdminMediaP0Test.java`
- `ReviewPhotoStorageService.java`, `PublicReviewController.java`, `SafeMediaAssetUrlPolicy.java`

## Search

- Search and search suggest are public GET endpoints with rate limiting support. `CONFIRMED_FROM_CODE`

Evidence:

- `PublicSearchController.java`
- `RateLimitingFilter.java`
- `CustomerCsrfFilter.java`

## Payment — no automatic gateway

New storefront checkout accepts only `COD`. An omitted `paymentMethod` is normalised to COD; any other explicit code, including `BACS`, is rejected.

There is **no automatic payment gateway integration**. COD is reconciled manually by admin:

- `COD` — cash collected on delivery; admin marks the order paid after the courier hands over the money.
- Legacy `BACS` — no longer offered or accepted for new storefront orders; existing BACS orders remain readable and may still be reconciled manually through `paymentStatus`/`paidAmount`.

No redirect, no provider webhook, no `paymentRedirectUrl`. The Alepay/ZaloPay online-gateway plan was dropped — those method codes are no longer accepted at checkout.

## Social Login (OAuth2) — Google & Facebook

The backend supports Google and Facebook OAuth callbacks. The legacy-parity storefront auth
screen currently exposes the Facebook social link, matching the WordPress page.
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
  Scope: `email,public_profile`. Token endpoint `https://graph.facebook.com/v19.0/oauth/access_token`,
  profile `https://graph.facebook.com/me?fields=id,name,email`.
  ⚠️ Facebook requires **App Review + Business Verification** before the `email` scope works
  for the public; in Development mode only app admins/testers/developers can log in.
  ⚠️ Facebook may return **no email** (user revoked the permission) — the callback then
  creates an account without email or fails gracefully; it cannot link to an existing account.

**Credentials** are read from environment variables — keys `OAUTH_GOOGLE_*`,
`OAUTH_FACEBOOK_*`, `OAUTH_CALLBACK_BASE_URL`, `OAUTH_WEB_SUCCESS_URL`. See `.env.example`.
When client id/secret are blank, the social buttons still render but the flow returns the
`oauth` error. Account linking only links a provider identity to an existing password
account when the provider asserts a verified email (anti-takeover).

## Not Confirmed In Active Repo

| Topic | Current finding | Status |
|---|---|---|
| External shipping carrier | No confirmed GHN/GHTK/ViettelPost integration. | `NOT_FOUND_IN_REPO` |

Evidence:

- repo search for carrier implementations
