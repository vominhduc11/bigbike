# Integration Guide

## Confirmed Integrations

| Integration | Current state | Status | Evidence |
|---|---|---|---|
| PostgreSQL | Primary persistence store for backend and CI | `CONFIRMED_FROM_CONFIG` | `docker-compose.yaml`, `.github/workflows/ci.yml` |
| MinIO | Media/object storage | `CONFIRMED_FROM_CODE` + `CONFIRMED_FROM_CONFIG` | `docker-compose.yaml`, `AdminMediaService.java` |
| SMTP mail | Transactional email path exists when env is configured. All mail goes through `EmailDispatchService.send(to, subject, template, ctx)` rendering a Thymeleaf template under `templates/email/`. Templates include customer `password-reset`, `password-change-alert`, order/coupon-gift, and **admin `admin-invite`** (set-password link for newly invited admins; degrades gracefully — when no `JavaMailSender` bean is configured, `isEnabled()` is false and the caller surfaces the invite link instead) | `CONFIRMED_FROM_CODE` + `CONFIRMED_FROM_CONFIG` | `EmailDispatchService.java`, `AdminInviteService.java`, `templates/email/admin-invite.html` |
| Web revalidation | Backend can call Next.js revalidation endpoint with shared secret | `CONFIRMED_FROM_CONFIG` | `docker-compose.yaml` |
| WebSocket/STOMP | Admin order push channel is live | `CONFIRMED_FROM_CODE` | `WebSocketConfig.java`, `AdminOrderWsService.java` |
| VN address data | Public backend address API and client-side address helpers are present | `CONFIRMED_FROM_CODE` | `VnAddressController.java`, `vn-address-data.ts`, mobile endpoints |

## Web Revalidation (ISR on-demand)

`WebRevalidationService` POSTs cache tags to the Next.js web app's `POST /api/revalidate`
endpoint (header `x-revalidate-secret`) so admin content edits invalidate the matching ISR
cache entries immediately, instead of waiting for the page's time-based `revalidate` window.
`CONFIRMED_FROM_CODE`

- Config: `bigbike.web.revalidate-url`, `bigbike.web.revalidate-secret` (Docker env
  `WEB_REVALIDATE_URL`, `WEB_REVALIDATE_SECRET`). Disabled when either is blank.
- Fires **after transaction commit** (`afterCommit`), async, retry at 1s/3s.
- The web side reads these same tags on its server `fetch` calls in
  `bigbike-web/lib/api/public-api.ts`.
- **Contract rule:** every cache tag the web reads MUST have a backend emitter below —
  otherwise that content only refreshes on its time-based TTL, never on edit.

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
> Content / settings / slider / menu / home-video mutations emit their own entity tags
> (`articles`, `pages`, `settings`, `sliders`, `menus`, `home-videos`) from their
> respective admin services, read by the matching `public-api.ts` functions.

## Media Integration Policy

- Public media URLs are validated against configured public base URL rules. `CONFIRMED_FROM_CODE`
- Server-side content detection uses Apache Tika. `CONFIRMED_FROM_CODE`
- SVG is rejected by current policy and tests. `CONFIRMED_FROM_CODE`

Evidence:

- `AdminMediaService.java`
- `MediaUrlProperties.java`
- `AdminMediaP0Test.java`

## Search

- Search and search suggest are public GET endpoints with rate limiting support. `CONFIRMED_FROM_CODE`

Evidence:

- `PublicSearchController.java`
- `RateLimitingFilter.java`
- `CustomerCsrfFilter.java`

## Payment — no automatic gateway

`CheckoutService.ALLOWED_PAYMENT_METHODS` accepts only `COD` and `BACS`.

There is **no automatic payment gateway integration**. Both methods are reconciled manually by admin:

- `COD` — cash collected on delivery; admin marks the order paid after the courier hands over the money.
- `BACS` — customer bank transfer; admin verifies the transfer and patches `paymentStatus`/`paidAmount` manually.

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
