# Deployment Guide

## Docker Compose Defaults

| Service | Current default | Status | Evidence |
|---|---|---|---|
| Postgres | `postgres:16-alpine`, bound to `127.0.0.1:5432` | `CONFIRMED_FROM_CONFIG` | `docker-compose.yaml` |
| MinIO | `minio/minio:RELEASE.2025-04-22T22-12-26Z`, bound to `127.0.0.1:9000/9001` | `CONFIRMED_FROM_CONFIG` | `docker-compose.yaml` |
| Backend | profile defaults to `prod`, bound to `127.0.0.1:8080` | `CONFIRMED_FROM_CONFIG` | `docker-compose.yaml` |
| Web | bound to `127.0.0.1:3000`, backend API base injected via env/build args | `CONFIRMED_FROM_CONFIG` | `docker-compose.yaml` |
| Admin | built with real backend API base (`VITE_ADMIN_API_BASE=/api/v1`), bound to `127.0.0.1:4000` | `CONFIRMED_FROM_CONFIG` | `docker-compose.yaml`, `bigbike-admin/Dockerfile` |

## Deployment Notes

- Backend healthcheck uses `GET /actuator/health`. `CONFIRMED_FROM_CONFIG`
- Web and admin have container healthchecks. `CONFIRMED_FROM_CONFIG`
- Compose includes a `bigbike-web-init` one-shot container that calls the web revalidation endpoint after startup. `CONFIRMED_FROM_CONFIG`
- Backend mail sending is optional when SMTP env vars are empty. `CONFIRMED_FROM_CONFIG`
- CORS must be set explicitly through `BIGBIKE_CORS_ALLOWED_ORIGINS`. `CONFIRMED_FROM_CONFIG`
- All service ports (Postgres, MinIO, Backend, Web, Admin) are bound to `127.0.0.1` — public traffic must arrive via the nginx reverse proxy, never directly. `CONFIRMED_FROM_CONFIG`
- `SPRING_PROFILES_ACTIVE` for staging/production must not include `mock`; placeholder auth is explicitly limited to dev/mock behavior in `AuthController` and `DevAdminAuthService`. `CONFIRMED_FROM_CODE`
- `bigbike-web` must call the real backend public APIs (`/api/v1/products`, `/api/v1/menus/**`, `/api/v1/settings/public`, etc.). The legacy `scripts/mock-api-server.mjs` storefront shim is not part of the deployment contract and must not be restored in runtime/dev/prod paths. `CONFIRMED_FROM_CODE`
- `bigbike-admin` must call the real backend admin APIs at runtime. The former admin mock build flag and runtime mock fallback layer have been removed; admin production builds must not include mock data fallbacks. `CONFIRMED_FROM_CODE`

## Security Hardening Config

- **`BIGBIKE_TRUSTED_PROXIES`** — comma-separated list of reverse-proxy IPs / CIDR ranges trusted to set `X-Forwarded-For`. Per-IP rate limiting keys the bucket on the forwarded client IP only when the request comes from a trusted proxy. Default `127.0.0.1,::1`. When the backend runs behind nginx or inside Docker (where the proxy is reached as a bridge gateway IP), set this to the proxy IP or subnet — otherwise rate limiting collapses to a single shared bucket. `CONFIRMED_FROM_CONFIG`
- **Actuator** — only `GET /actuator/health` is public. The nginx API config (`deploy/nginx/api.bigbike.vn.conf`) returns `403` for every other `/actuator/` path; Prometheus must scrape the backend over the private network, not the public host. `CONFIRMED_FROM_CONFIG`
- **Media upload body size** — backend accepts media uploads up to 50 MB. The nginx API config sets `client_max_body_size 55m` on `^~ /api/v1/admin/media` and keeps `10m` for all other routes. `CONFIRMED_FROM_CONFIG`
- **Internal endpoints** — `/api/internal/**` require the `X-Internal-Token` header (matched in constant time) when `BIGBIKE_INTERNAL_TOKEN` is set; deny-by-default when unset. `CONFIRMED_FROM_CONFIG`

## Schema And Migration Notes

- Active Flyway migrations run through `V73`. `CONFIRMED_FROM_CONFIG`
- Receipt tables exist from `V52/V53/V55`; serial movement table exists from `V57`; POS order snapshot columns were added in `V71`. `CONFIRMED_FROM_CONFIG`

## Deployment Caveats

- Internal redirect endpoints rely on infra restriction outside Spring Security. `CONFIRMED_FROM_CONFIG`
- No confirmed external payment webhook or shipping carrier deployment contract exists in repo. `NOT_FOUND_IN_REPO`
