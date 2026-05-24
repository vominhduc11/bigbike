# Integration Guide

## Confirmed Integrations

| Integration | Current state | Status | Evidence |
|---|---|---|---|
| PostgreSQL | Primary persistence store for backend and CI | `CONFIRMED_FROM_CONFIG` | `docker-compose.yaml`, `.github/workflows/ci.yml` |
| MinIO | Media/object storage | `CONFIRMED_FROM_CODE` + `CONFIRMED_FROM_CONFIG` | `docker-compose.yaml`, `AdminMediaService.java` |
| SMTP mail | Transactional email path exists when env is configured | `CONFIRMED_FROM_CODE` + `CONFIRMED_FROM_CONFIG` | `pom.xml`, `docker-compose.yaml` |
| Web revalidation | Backend can call Next.js revalidation endpoint with shared secret | `CONFIRMED_FROM_CONFIG` | `docker-compose.yaml` |
| WebSocket/STOMP | Admin order push channel is live | `CONFIRMED_FROM_CODE` | `WebSocketConfig.java`, `AdminOrderWsService.java` |
| VN address data | Public backend address API and client-side address helpers are present | `CONFIRMED_FROM_CODE` | `VnAddressController.java`, `vn-address-data.ts`, mobile endpoints |

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
