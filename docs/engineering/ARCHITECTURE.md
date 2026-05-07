# Architecture

## Monorepo Shape

| Path | Runtime | Responsibility | Status | Evidence |
|---|---|---|---|---|
| `bigbike-web` | Next.js 16.2.4 / React 19 | Public storefront, SEO pages, cart, checkout, customer account | `CONFIRMED_FROM_CODE` | `bigbike-web/package.json`, `bigbike-web/app`, `bigbike-web/lib` |
| `bigbike-admin` | Vite 8 / React 19 | Internal operations dashboard | `CONFIRMED_FROM_CODE` | `bigbike-admin/package.json`, `bigbike-admin/src` |
| `bigbike-backend` | Spring Boot 4.0.5 / Java 17 | API, business rules, persistence, auth, integrations, WebSocket | `CONFIRMED_FROM_CODE` | `bigbike-backend/pom.xml`, `src/main/java` |
| `bigbike_mobile` | Flutter / Dart | Companion client using shared backend APIs | `CONFIRMED_FROM_CODE`; release scope `NEEDS_VERIFICATION` | `pubspec.yaml`, `lib/core` |

## Runtime Boundaries

- `bigbike-web` is the public BFF/client layer and consumes backend REST APIs. `CONFIRMED_FROM_CODE`
- `bigbike-admin` is a separate SPA that consumes backend admin APIs and the admin order WebSocket. `CONFIRMED_FROM_CODE`
- `bigbike-backend` owns business validation, state changes, persistence, auth, and integrations. `CONFIRMED_FROM_CODE`
- `bigbike_mobile` uses cookie-backed REST flows with Dio and CSRF support instead of a separate mobile-only backend. `CONFIRMED_FROM_CODE`

## Backend Architecture

### Primary backend layers

| Layer | Current implementation | Status | Evidence |
|---|---|---|---|
| Controllers | `api/admin`, `api/customer`, `api/order`, `api/public_`, `api/cart`, `api/checkout` | `CONFIRMED_FROM_CODE` | `src/main/java/com/bigbike/bigbike_backend/api` |
| Services | Business logic in `service/*` | `CONFIRMED_FROM_CODE` | `src/main/java/com/bigbike/bigbike_backend/service` |
| Persistence | JPA entities and repositories | `CONFIRMED_FROM_CODE` | `persistence/entity`, `persistence/repository` |
| Schema | Flyway migrations through `V73` plus dev seeds | `CONFIRMED_FROM_CODE` | `src/main/resources/db/migration`, `db/migration-dev` |
| Auth | Admin JWT + customer cookie/session auth | `CONFIRMED_FROM_CODE` | `SecurityConfig.java`, auth services/filters |
| Real-time | STOMP over WebSocket with simple broker | `CONFIRMED_FROM_CODE` | `WebSocketConfig.java`, `AdminOrderWsService.java` |

### Notable architectural realities

- OpenAPI is a checked-in companion file, not an automatically trusted source without verification. `CONFIRMED_FROM_STRUCTURE`
- POS is implemented inside the main order/inventory domain, not as a standalone payment subsystem. `CONFIRMED_FROM_CODE`
- Current serial handling is stock-movement based. Older full-lifecycle serial tables were removed and later replaced with movement/receipt serial tables. `CONFIRMED_FROM_CODE`
- Receipt tables exist in the schema, but a receiving service/controller was not confirmed in the current Java layer. `NOT_FOUND_IN_REPO`

## Infrastructure And Integrations

| Component | Current implementation | Status | Evidence |
|---|---|---|---|
| Database | PostgreSQL via Docker Compose and CI service container | `CONFIRMED_FROM_CONFIG` | `docker-compose.yaml`, `.github/workflows/ci.yml` |
| Object storage | MinIO S3-compatible storage | `CONFIRMED_FROM_CONFIG` | `docker-compose.yaml`, `AdminMediaService.java` |
| Email | SMTP-backed transactional email when configured | `CONFIRMED_FROM_CODE` | `pom.xml`, `docker-compose.yaml`, mail services |
| Revalidation | Backend calls web revalidate endpoint through shared secret | `CONFIRMED_FROM_CONFIG` | `docker-compose.yaml`, web env vars |
| WebSocket | `/ws` STOMP endpoint and `/topic/admin/orders` topic | `CONFIRMED_FROM_CODE` | `WebSocketConfig.java`, `AdminOrderWsService.java` |
| External payment gateway | No confirmed live provider/webhook integration | `NOT_FOUND_IN_REPO` | repo search, checkout/payment code |
| External shipping carrier | No confirmed GHN/GHTK/ViettelPost integration | `NOT_FOUND_IN_REPO` | repo search |

## Documentation Architecture Rule

- `docs/business/` defines scope and behavior.
- `docs/engineering/` defines technical contracts and boundaries.
- `bigbike-openapi.json` is the machine-readable API companion.
- Historical audits and phase reports are evidence only.
