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
and `BIGBIKE_LEGACY_UPLOADS_BASE` must be public addresses rather than `localhost`. Since the
2026-08-06 domain cutover those are the https subdomains behind host nginx
(`https://api.bigbike.vn`, `https://media.bigbike.vn`); container ports stay on `127.0.0.1`,
so a raw `http://<server-ip>:<port>` value would both bypass nginx and be unreachable.
`CONFIRMED_FROM_CONFIG`

`bigbike-admin` is environment-portable: its browser calls hit relative paths (`/api/v1`,
`/media/`, `/ws`) that nginx proxies to internal Docker hostnames (`bigbike-backend:8080`,
`minio:9000`), so its API base never changes. Admin build values that may vary by environment are
`VITE_STOREFRONT_BASE_URL` (live-preview iframe) and optional `VITE_MINIO_EXTRA_ORIGINS`
(comma-separated legacy media origins that must be rewritten through `/media-proxy/`). Both are
passed from the env-file through Compose build args; the extra-origin list defaults to empty and
must never contain a retired host implicitly. `CONFIRMED_FROM_CONFIG`

> **Build-time bake:** every `NEXT_PUBLIC_*` and `VITE_*` value is compiled into the web/admin
> bundle at build time. After changing any of them you MUST rebuild (`--build`); a plain
> restart keeps the old links. `CONFIRMED_FROM_CONFIG`

When migrating from IP:port to a domain, swap the public values in `.env.vps` for the domain
(e.g. `https://api.bigbike.vn`), update `BIGBIKE_CORS_ALLOWED_ORIGINS`, and rebuild.

### Flyway on a database that once ran the `dev` profile

The VPS database applied 14 seed migrations `V1001..V1015` from `classpath:db/migration-dev`
while the stack was still on the `dev` profile. Profile `prod` ships only `classpath:db/migration`
(max `V373`), so those rows stay in `flyway_schema_history` with no matching file. Two env vars
handle it, and **both are required** — either one alone leaves the stack broken.
`CONFIRMED_FROM_CONFIG` (`docker-compose.yaml`, `.env.vps.example`)

| Var | Value on VPS | Without it |
|---|---|---|
| `SPRING_FLYWAY_IGNORE_MIGRATION_PATTERNS` | `*:missing,*:future` | Backend refuses to start: `Detected applied migration not resolved locally: 1001…`. `*:missing` alone is **not** enough — `V1001+` outranks every classpath version, so Flyway classifies them `future`, not `missing`. |
| `SPRING_FLYWAY_OUT_OF_ORDER` | `true` | Every NEW prod migration (`V371` onward) is numbered below the applied `V1015`, so Flyway marks it `ignored`. Startup fails with `Detected resolved migration not applied to database: 371…`. |

Both default to the safe value (blank / `false`) so a fresh deployment keeps full Flyway
validation. Only set them on a stack carrying this legacy history.

For local Docker development, the root `.env` uses `SPRING_PROFILES_ACTIVE=dev` and must
set `SPRING_FLYWAY_OUT_OF_ORDER=true` when the database already contains the
`db/migration-dev` history. `docker-compose.yaml` passes this variable into the backend,
so an explicit `false` overrides the profile's dev setting and prevents `V368+` from running.

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
- Admin access synchronization uses the backend's in-process STOMP simple broker. The current
  Compose topology runs one backend instance, so an access change reaches every connected session
  on that node. Do not scale backend replicas for this feature without adding a shared broker/event
  bus for the access-change event and WebSocket routing. `OWNER_CONFIRMED_2026-07-31`

## Security Hardening Config

- **Public Review CSRF boundary** — `CustomerCsrfFilter` exempts CSRF validation only for `POST /api/v1/products/{productId}/reviews` and `POST /api/v1/products/{productId}/reviews/photos`. These two endpoints intentionally support guests, and the storefront calls them directly on the API host with credentials so an existing customer session can supply authoritative identity. The exemption must match the HTTP method and complete path shape; it must never use the broad `/api/v1/products/` prefix or exempt neighboring/future product mutations. Exact-origin credentialed CORS and the dedicated per-IP `REVIEW` / `REVIEW_PHOTO` limits remain mandatory. `CONFIRMED_FROM_CODE_AND_SECURITY_REVIEW_2026-07-28`
- **`BIGBIKE_TRUSTED_PROXIES`** — comma-separated list of reverse-proxy IPs / CIDR ranges trusted to set `X-Forwarded-For`. Per-IP rate limiting keys the bucket on the forwarded client IP only when the request comes from a trusted proxy. Default `127.0.0.1,::1`. When the backend runs behind nginx or inside Docker (where the proxy is reached as a bridge gateway IP), set this to the proxy IP or subnet — otherwise rate limiting collapses to a single shared bucket. Every public nginx proxy location must **overwrite** both `X-Real-IP` and `X-Forwarded-For` with `$remote_addr`; never append untrusted incoming values with `$proxy_add_x_forwarded_for`, because the backend intentionally consumes the first forwarded address. Once DNS/TLS is live, bind backend/web/admin host ports to loopback as already required by `AUD-009`; the temporary pre-live direct bindings remain a documented owner-approved exception only until that cutover. `CONFIRMED_FROM_CONFIG`
- **Actuator** — only `GET /actuator/health` is public. The nginx API config (`deploy/nginx/api.bigbike.vn.conf`) returns `403` for every other `/actuator/` path; Prometheus must scrape the backend over the private network, not the public host. `CONFIRMED_FROM_CONFIG`
- **Media upload body size** — backend accepts media uploads up to 200 MB (raised from 50 MB to allow video uploads; enforced by `MAX_UPLOAD_BYTES` in `AdminMediaService` and `spring.servlet.multipart.max-file-size=200MB` / `max-request-size=210MB`). The nginx API config sets `client_max_body_size 210m` on `^~ /api/v1/admin/media` and keeps `10m` for all other routes. Exceeding the cap returns `413` with a `FILE_TOO_LARGE` JSON error. `CONFIRMED_FROM_CONFIG`
- **Legacy video CSP compatibility** — storefront `frame-src` and admin preview CSP include exactly `https://www.tiktok.com` and `https://www.facebook.com` in addition to YouTube so previously stored video records can still render. These origins are read-only compatibility allowances; every write contract accepts only YouTube or internal Media Library video (`MEDIA_RULE_004`). Do not add shortened-link or wildcard social domains. `CONFIRMED_FROM_OWNER_DECISION`
- **Internal endpoints** — `/api/internal/**` require the `X-Internal-Token` header (matched in constant time) when `BIGBIKE_INTERNAL_TOKEN` is set; deny-by-default when unset. `CONFIRMED_FROM_CONFIG`
- **`BIGBIKE_INTERNAL_TOKEN` / `INTERNAL_API_TOKEN` must both be set** to the same secret value in the environment used by `docker-compose.yaml` (`.env`/`.env.vps`) — generate with `openssl rand -base64 32`. If either is missing or mismatched, the redirect feature fails safe (every lookup gets `401` and falls through to normal routing) but silently does nothing end-to-end; `bigbike-web/proxy.ts` logs the failure on every request. `CONFIRMED_FROM_CONFIG`

## Schema And Migration Notes

- Flyway runs every versioned migration under `bigbike-backend/src/main/resources/db/migration`; the current repository reaches `V377` (2026-08-07). Do not use an older documentation note as a schema baseline—verify the migration directory and `flyway_schema_history` for the deployed environment. `CONFIRMED_FROM_CONFIG`
- The one-time WordPress live migration must follow [LIVE_MIGRATION_RUNBOOK.md](LIVE_MIGRATION_RUNBOOK.md). The normal Spring `mode=import` runner is legacy rehearsal tooling and is not an authorized production write path. `CONFIRMED_FROM_CODE_2026-08-03`
- Receipt tables (`V52/V53/V55`) were dropped in `V120`; the serial movement table (`V57`) and all other serial tables were dropped in `V259` (serial tracking removed 2026-06-23). POS order snapshot columns were added in `V71` and still exist, but the POS feature itself was removed 2026-06-23 (online-only) — the columns are now only written with online values. `CONFIRMED_FROM_CONFIG`

## Deployment Caveats

- Internal redirect endpoints (`/api/internal/**`) are protected by both the `X-Internal-Token` app-level check and an nginx-level block (`deploy/nginx/api.bigbike.vn.conf`, returns `403`) — see PERMISSION_MATRIX.md "Internal Redirect Caveat". `CONFIRMED_FROM_CONFIG`
- No confirmed external payment webhook or shipping carrier deployment contract exists in repo. `NOT_FOUND_IN_REPO`

## Maintenance Runbook (owner-confirmed 2026-08-06, thu gọn phạm vi cùng ngày)

Scope: the **admin panel only**. The storefront is never taken down on purpose and customers can always order (`BUSINESS_RULES` `MAINTENANCE_RULE_001`/`_002`). There is no host-side maintenance script any more.

### Turning maintenance on and off

Sign in to the admin panel with a `DEVELOPER` account and use **Hệ thống → Bảo trì hệ thống**. Three buttons, all manual, both directions — nothing transitions on a timer:

1. **Báo trước cho nhân viên** → `UPCOMING`. Every open admin session gets a realtime warning; staff can still save. Use this to let people finish what they are doing.
2. **Khoá ngay** → `ACTIVE`. The confirm dialog reports how many admin uploads are still in flight; locking now would break them. From this point the backend rejects every admin write with `423 MAINTENANCE_ACTIVE`, and non-developer staff get a full-screen overlay — they cannot save *or* look anything up, so do not promise them they can still check an order. (The backend itself does not block reads; the block is a deliberate UI decision by the owner.)
3. **Mở lại** → `NORMAL`. Staff sessions recover on their own within one cycle (STOMP push is immediate; the 60-second poll is the fallback).

`SUPER_ADMIN` cannot use these buttons — see `PERMISSION_MATRIX.md` §Maintenance Authority for why that is a role-name gate and not a permission.

**Provision two `DEVELOPER` accounts** and seal the second one's credentials with the owner. There is no admin self-service password reset, and `resend-invite` is itself blocked while the lock is `ACTIVE`, so a forgotten password mid-lock is a real deadlock.

### Break-glass

Both paths sit above the app-layer lock by definition and need VPS access:

- **Unlock directly in the database**, then restart the backend to drop its 2-second cached flag:
  `docker compose exec postgres psql -U bigbike -d bigbike -c "UPDATE maintenance_state SET state='NORMAL' WHERE id=1;"`
- **Disable the lock entirely** with `BIGBIKE_MAINTENANCE_LOCK_ENABLED=false` and redeploy the backend. Use this when the lock *itself* misbehaves and has bricked the panel — the DB unlock cannot help there.

### Static outage pages (unrelated to the lock)

Nginx serves `deploy/maintenance/templates/maintenance-web.html` and `maintenance-admin.html` via `error_page 502 503 504 =503` when a container is genuinely unreachable — a crash or a deploy restart, nobody switches it on. Those pages return `503` with `Retry-After: 60`, never `200` and never a redirect; the API host returns JSON `503` instead of HTML.

Regenerate them with `deploy/maintenance/render-fallback-pages.sh` **on every deploy and whenever contact settings change**. The script reads `contact_address`, `hotline`, `facebook_url`, `zalo_url` and `opening_hours_*` from the public settings endpoint and inlines them, because a static file cannot read the database at the moment it is served — which is exactly when the stack is down. It fails loudly if any of those settings is blank, and it never touches Docker or reloads nginx. Configure `BIGBIKE_MAINTENANCE_STATIC_ROOT` and `BIGBIKE_MAINTENANCE_API_URL`.

**Logo.** The page inlines `deploy/maintenance/templates/logo-outage.png` (320px, ~70 KB), **not** `bigbike-web/public/brand/logo-primary.png`. The brand original is 2000×2000 / 6.5 MB, and base64-inlining it produced an **8.6 MB** outage page — served exactly when the system is already struggling and the customer is most likely on mobile data. The derivative keeps the page under 100 KB while still covering 2x retina (CSS caps display width at 160px).

`logo-outage.source.sha256` records which brand logo the derivative was made from, and the render script prints a non-fatal warning when the brand logo has changed since. To regenerate after a rebrand, run this from the repo root (Pillow is needed only for this one-off, never at deploy time):

    python3 -c "
    from PIL import Image
    import hashlib, pathlib
    src = pathlib.Path('bigbike-web/public/brand/logo-primary.png')
    out = pathlib.Path('deploy/maintenance/templates/logo-outage.png')
    im = Image.open(src); W = 320
    r = im.resize((W, round(im.height * W / im.width)), Image.LANCZOS)
    r.convert('RGB').quantize(colors=128).save(out, 'PNG', optimize=True)
    pathlib.Path('deploy/maintenance/templates/logo-outage.source.sha256').write_text(
        hashlib.sha256(src.read_bytes()).hexdigest() + '  logo-primary.png\n')
    "

### Nginx notes

`shared-config.conf` no longer includes any maintenance conf, and `bigbike-maintenance-access.conf` / `bigbike-maintenance-state.conf` are deleted — remove both from `/etc/nginx/conf.d/` in the **same** step that installs the new vhosts. The removed `add_header Set-Cookie $bigbike_maintenance_set_cookie` lines lived inside the crash-fallback blocks that survive, so a partial update fails `nginx -t` on an unknown variable in either direction. Always `nginx -t` before `systemctl reload nginx`, and never reload on a failed test.

### Verification after deploy

- `SELECT * FROM maintenance_state;` returns exactly one `NORMAL` row; `SELECT count(*) FROM role_permissions WHERE role_id='DEVELOPER';` returns 34; the five `maintenance_*` rows are gone from `site_settings`.
- `GET /api/v1/maintenance/status` and `POST /api/internal/maintenance/state` are gone. Unauthenticated they answer `401`, not `404`: removing their `permitAll` entries drops them into `anyRequest().authenticated()`, so the security chain replies before routing. The point of the check is that neither returns `200` any more. `GET /api/internal/redirects/active` with the internal token → still `200`, proving the shared-token redirect feature survived.
- `SELECT count(*) FROM role_permissions WHERE role_id='DEVELOPER';` returns 35 after V375 (34 from V374 plus `maintenance.manage`). Editing that role from the Roles screen must be refused — the Edit button is hidden and the API returns `409`.
- Place a real test order to prove customers are unaffected — do not assume it.
- Stop the backend container and confirm `bigbike.vn` shows the static outage page with `Retry-After: 60`, and `api.bigbike.vn` returns the static JSON. Restart.
- With the lock `ACTIVE`, confirm an admin write returns `423` with `error.code = "MAINTENANCE_ACTIVE"` **through nginx**, not the static `{"status":"MAINTENANCE"}` body. This is the one check that cannot be performed anywhere except production-shaped infrastructure.

### Not yet rehearsed

The end-to-end rehearsal on the real stack still has not been run: it needs an agreed quiet-hour window, and Docker lifecycle commands are out of scope for the agent. Treat the sequence above as documented-but-untested until that rehearsal happens.
