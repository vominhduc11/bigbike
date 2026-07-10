# Deployment Guide

## Docker Compose Defaults

| Service | Current default | Status | Evidence |
|---|---|---|---|
| Postgres | `postgres:16-alpine`, bound to `127.0.0.1:5432` | `CONFIRMED_FROM_CONFIG` | `docker-compose.yaml` |
| MinIO | `minio/minio:RELEASE.2025-04-22T22-12-26Z`, bound to `127.0.0.1:9000/9001` | `CONFIRMED_FROM_CONFIG` | `docker-compose.yaml` |
| Backend | profile defaults to `prod`, bound to `127.0.0.1:8080` | `CONFIRMED_FROM_CONFIG` | `docker-compose.yaml` |
| Web | bound to `127.0.0.1:3000`, backend API base injected via env/build args | `CONFIRMED_FROM_CONFIG` | `docker-compose.yaml` |
| Admin | built with real backend API base (`VITE_ADMIN_API_BASE=/api/v1`), bound to `127.0.0.1:4000` | `CONFIRMED_FROM_CONFIG` | `docker-compose.yaml`, `bigbike-admin/Dockerfile` |

## Multi-Environment Run (local vs VPS)

The same compose stack runs in every environment with **no source edits** — only the
env-file differs. `docker compose` loads exactly one env-file, so each file must be complete.

- **Local:** `docker compose up -d --build` (reads `.env`, see `.env.example`). `CONFIRMED_FROM_CONFIG`
- **VPS:** `docker compose --env-file .env.vps up -d --build` (see `.env.vps.example`). `CONFIRMED_FROM_CONFIG`

Only `bigbike-web` has links that genuinely change per environment: its client bundle calls
the backend + MinIO **directly from the customer's browser**, so `NEXT_PUBLIC_API_BASE_URL`
and `BIGBIKE_LEGACY_UPLOADS_BASE` must be the server's public address (`http://<VPS_IP>:8080`,
`http://<VPS_IP>:9000`) rather than `localhost`. `CONFIRMED_FROM_CONFIG`

`bigbike-admin` is environment-portable: its browser calls hit relative paths (`/api/v1`,
`/media/`, `/ws`) that nginx proxies to internal Docker hostnames (`bigbike-backend:8080`,
`minio:9000`), so its API base never changes. The only per-env admin value is
`VITE_STOREFRONT_BASE_URL` (live-preview iframe), now read from the env-file. `CONFIRMED_FROM_CONFIG`

> **Build-time bake:** every `NEXT_PUBLIC_*` and `VITE_*` value is compiled into the web/admin
> bundle at build time. After changing any of them you MUST rebuild (`--build`); a plain
> restart keeps the old links. `CONFIRMED_FROM_CONFIG`

When migrating from IP:port to a domain, swap the public values in `.env.vps` for the domain
(e.g. `https://api.bigbike.vn`), update `BIGBIKE_CORS_ALLOWED_ORIGINS`, and rebuild.

## Deployment Notes

- Backend healthcheck uses `GET /actuator/health`. `CONFIRMED_FROM_CONFIG`
- Web and admin have container healthchecks. `CONFIRMED_FROM_CONFIG`
- The web container self-revalidates its storefront ISR cache on startup via `docker-entrypoint.mjs`: after `next build` bakes a data snapshot into the prerendered pages, the entrypoint waits for the server then POSTs the catalog/content tags to `/api/revalidate` so a fresh start serves backend-fresh data. This runs on every container start — including partial `docker compose up --no-deps` rebuilds — and replaces the former external `bigbike-web-init` one-shot container. `CONFIRMED_FROM_CONFIG`
- Backend mail sending is optional when SMTP env vars are empty. `CONFIRMED_FROM_CONFIG`
- Multi-replica ISR currently uses deploy-time fan-out, not a shared Next.js cache handler. If
  more than one `bigbike-web` replica is deployed, `WEB_REVALIDATE_URL` must list every
  replica's `/api/revalidate` URL. Leave `WEB_REDIRECT_CACHE_CLEAR_URL` blank to derive every
  replica's `/_internal/redirect-cache/clear` endpoint, or list each clear endpoint explicitly.
  Set `WEB_REVALIDATE_EXPECTED_REPLICAS=N` so backend startup fails when the fan-out is
  incomplete instead of leaving one replica silently stale. `CONFIRMED_FROM_CONFIG`
- CORS must be set explicitly through `BIGBIKE_CORS_ALLOWED_ORIGINS`. `CONFIRMED_FROM_CONFIG`
- All service ports (Postgres, MinIO, Backend, Web, Admin) are bound to `127.0.0.1` — public traffic must arrive via the nginx reverse proxy, never directly. `CONFIRMED_FROM_CONFIG`
- `SPRING_PROFILES_ACTIVE` for staging/production must not include `mock`; placeholder auth is explicitly limited to dev/mock behavior in `AuthController` and `DevAdminAuthService`. `CONFIRMED_FROM_CODE`
- `bigbike-web` must call the real backend public APIs (`/api/v1/products`, `/api/v1/menus/**`, `/api/v1/settings/public`, etc.). The legacy `scripts/mock-api-server.mjs` storefront shim is not part of the deployment contract and must not be restored in runtime/dev/prod paths. `CONFIRMED_FROM_CODE`
- `bigbike-admin` must call the real backend admin APIs at runtime. The former admin mock build flag and runtime mock fallback layer have been removed; admin production builds must not include mock data fallbacks. `CONFIRMED_FROM_CODE`

## Security Hardening Config

- **`BIGBIKE_TRUSTED_PROXIES`** — comma-separated list of reverse-proxy IPs / CIDR ranges trusted to set `X-Forwarded-For`. Per-IP rate limiting keys the bucket on the forwarded client IP only when the request comes from a trusted proxy. Default `127.0.0.1,::1`. When the backend runs behind nginx or inside Docker (where the proxy is reached as a bridge gateway IP), set this to the proxy IP or subnet — otherwise rate limiting collapses to a single shared bucket. `CONFIRMED_FROM_CONFIG`
- **Actuator** — only `GET /actuator/health` is public. The nginx API config (`deploy/nginx/api.bigbike.vn.conf`) returns `403` for every other `/actuator/` path; Prometheus must scrape the backend over the private network, not the public host. `CONFIRMED_FROM_CONFIG`
- **Media upload body size** — backend accepts media uploads up to 200 MB (raised from 50 MB to allow video uploads; enforced by `MAX_UPLOAD_BYTES` in `AdminMediaService` and `spring.servlet.multipart.max-file-size=200MB` / `max-request-size=210MB`). The nginx API config sets `client_max_body_size 210m` on `^~ /api/v1/admin/media` and keeps `10m` for all other routes. Exceeding the cap returns `413` with a `FILE_TOO_LARGE` JSON error. `CONFIRMED_FROM_CONFIG`
- **Internal endpoints** — `/api/internal/**` require the `X-Internal-Token` header (matched in constant time) when `BIGBIKE_INTERNAL_TOKEN` is set; deny-by-default when unset. `CONFIRMED_FROM_CONFIG`
- **`BIGBIKE_INTERNAL_TOKEN` / `INTERNAL_API_TOKEN` must both be set** to the same secret value in the environment used by `docker-compose.yaml` (`.env`/`.env.vps`) — generate with `openssl rand -base64 32`. If either is missing or mismatched, the redirect feature fails safe (every lookup gets `401` and falls through to normal routing) but silently does nothing end-to-end; `bigbike-web/proxy.ts` logs the failure on every request. `CONFIRMED_FROM_CONFIG`

## Schema And Migration Notes

- Active Flyway migrations run through `V73`. `CONFIRMED_FROM_CONFIG`
- Receipt tables (`V52/V53/V55`) were dropped in `V120`; the serial movement table (`V57`) and all other serial tables were dropped in `V259` (serial tracking removed 2026-06-23). POS order snapshot columns were added in `V71` and still exist, but the POS feature itself was removed 2026-06-23 (online-only) — the columns are now only written with online values. `CONFIRMED_FROM_CONFIG`

## Deployment Caveats

- Internal redirect endpoints (`/api/internal/**`) are protected by both the `X-Internal-Token` app-level check and an nginx-level block (`deploy/nginx/api.bigbike.vn.conf`, returns `403`) — see PERMISSION_MATRIX.md "Internal Redirect Caveat". `CONFIRMED_FROM_CONFIG`
- No confirmed external payment webhook or shipping carrier deployment contract exists in repo. `NOT_FOUND_IN_REPO`
