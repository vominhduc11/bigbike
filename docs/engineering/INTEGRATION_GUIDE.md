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

## Search And Contact

- Search and search suggest are public GET endpoints with rate limiting support. `CONFIRMED_FROM_CODE`
- Contact is a public POST endpoint and is explicitly excluded from customer-session requirements. `CONFIRMED_FROM_CODE`

Evidence:

- `PublicSearchController.java`
- `ContactController.java`
- `RateLimitingFilter.java`
- `CustomerCsrfFilter.java`

## Not Confirmed In Active Repo

| Topic | Current finding | Status |
|---|---|---|
| SePay (auto bank-transfer reconciliation) | Out of scope by business decision. Artifacts removed in V59. Bank-transfer payments are reconciled manually by admin in BACS flow — see `BUSINESS_PROCESS.md`. | `OUT_OF_SCOPE` |
| External payment provider/webhook | Out of scope. Online checkout supports COD/BACS only; no online gateway. | `OUT_OF_SCOPE` |
| External shipping carrier | No confirmed GHN/GHTK/ViettelPost integration. | `NOT_FOUND_IN_REPO` |

Evidence:

- `V59__remove_sepay_payment_artifacts.sql`
- `CheckoutService.ALLOWED_PAYMENT_METHODS` (COD, BACS only)
- repo search for provider/webhook/carrier implementations
