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
(e.g. `https://api.bigbike.vn`), update `BIGBIKE_CORS_ALLOWED_ORIGINS`, set
`BIGBIKE_COOKIES_DOMAIN` (below), and rebuild.

> **Always pass `--env-file .env.vps` on the VPS.** A bare `docker compose up -d --build`
> silently falls back to `.env` (the local file), which bakes `http://<server-ip>:<port>` into
> the web bundle: canonical/`og:url` tags advertise the raw origin IP and every browser call
> targets a port that is firewalled off. Observed live on 2026-08-07.

### Cookie Domain when the storefront and the API are different hosts

`BIGBIKE_COOKIES_DOMAIN` sets the `Domain` attribute on the customer cookies
(`bb_session`, `bb_csrf`, `bb_refresh`, `bb_guest_id`). `CONFIRMED_FROM_CODE`
(`CustomerAuthCookies.java`, `application.properties`)

| Environment | Value | Why |
|---|---|---|
| Local (`localhost:3000` + `localhost:8080`) | blank | Cookies ignore the port, so a host-only cookie already reaches both. |
| VPS (`bigbike.vn` + `api.bigbike.vn`) | `.bigbike.vn` | Different hosts of the same site. |

Without it on a split-host deployment the cookies are host-only and two things break, both
silently:

1. The storefront reads `bb_csrf` from `document.cookie` to build the `X-CSRF-Token` header
   (`bigbike-web/lib/api/client-api.ts`). It cannot see a cookie scoped to `api.bigbike.vn`,
   so **every customer mutation — add-to-cart, checkout, profile edit, review — returns
   `403 CSRF_INVALID`.**
2. `bigbike-web/proxy.ts` guards `/tai-khoan/**` on the presence of `bb_session`. That cookie
   is never visible on `bigbike.vn`, so logged-in customers are bounced back to the login page,
   and the social-login callback — which redirects to `/tai-khoan/` — looks like it silently
   failed.

This regressed with the 2026-08-06 domain cutover and was caught on 2026-08-07; see
`docs/audits/FINDING_2026-08-07_COOKIE_DOMAIN_SPLIT_HOST.md`.

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
- `BIGBIKE_MAIL_ADMIN` is required whenever the backend starts, even when SMTP is disabled. Set it in the selected env-file (`.env` locally or `.env.vps` on the VPS); the checked-in examples use `bigbikevnshop@gmail.com`. This is the one shared recipient for new-order alerts; assistant chat no longer sends internal handoff mail. Missing or malformed values stop backend startup with an explicit configuration error; there is no code or Compose fallback mailbox. `CONFIRMED_FROM_CONFIG`
- `EmailDispatchService` logs a successful SMTP handoff as provider acceptance only. It does not claim final delivery, because SMTP acceptance cannot confirm that the recipient mailbox accepted the message later. `CONFIRMED_FROM_CODE`
- **Backend memory and garbage collection** — the backend container remains capped at `1g`; Java
  uses G1GC with `MaxRAMPercentage=50.0`, so the JVM heap stays within that existing container
  limit. Do not raise the backend to 4 GB on the shared 8 GB server.
  **Lowered from 75.0 to 50.0 on 2026-08-21**: at 75.0 the heap ceiling alone was 768 MB, and the
  JVM's non-heap footprint (metaspace, code cache, ~69 thread stacks, direct buffers) added roughly
  400 MB, so the container sat at 982 MB / 1024 MB (91.5%) with no headroom — a traffic spike that
  let G1 grow the heap toward its ceiling would have been OOM-killed. Measured over 3 h of live
  traffic the live set was only ~140 MB with **zero Full GCs** and 9-36 ms young pauses, so a
  512 MB ceiling is still ~3.5x the working set. `CONFIRMED_FROM_RUNTIME`
  This setting is designed to let collection work use the host's available CPU cores without
  changing the memory allocation. Java emits its G1 collection identification to the backend log,
  so the shop owner can verify the active collector after deployment. The runtime also uses UTF-8
  so Vietnamese operational logs remain readable.
- **Database connections** — the pool reports a checked-out connection held over 5 seconds,
  validates connections before use, keeps idle connections alive, and uses TCP keepalive to detect
  dead network sessions. PostgreSQL's
  `idle_in_transaction_session_timeout=30000` only terminates abandoned transactions; it does not
  impose a statement timeout on valid long-running queries.
- **Prometheus and PostgreSQL slow-query evidence** — the internal-only
  `/actuator/prometheus` endpoint requires the Prometheus registry dependency. PostgreSQL keeps
  statement logging at 200 ms and is configured with `shared_preload_libraries=pg_stat_statements`.
  The latter takes effect only after the shop owner redeploys/restarts PostgreSQL. Never expose
  Prometheus through the public nginx host.
- Multi-replica ISR currently uses deploy-time fan-out, not a shared Next.js cache handler. If
  more than one `bigbike-web` replica is deployed, `WEB_REVALIDATE_URL` must list every
  replica's `/api/revalidate` URL. Leave `WEB_REDIRECT_CACHE_CLEAR_URL` blank to derive every
  replica's `/_internal/redirect-cache/clear` endpoint, or list each clear endpoint explicitly.
  Set `WEB_REVALIDATE_EXPECTED_REPLICAS=N` so backend startup fails when the fan-out is
  incomplete instead of leaving one replica silently stale. `CONFIRMED_FROM_CONFIG`
- CORS must be set explicitly through `BIGBIKE_CORS_ALLOWED_ORIGINS`. `CONFIRMED_FROM_CONFIG`
- `BIGBIKE_COOKIES_DOMAIN` must be set on any split-host deployment — see the section above. `CONFIRMED_FROM_CODE`
- Social login (OAuth2) needs six vars: `OAUTH_GOOGLE_CLIENT_ID`, `OAUTH_GOOGLE_CLIENT_SECRET`,
  `OAUTH_FACEBOOK_CLIENT_ID`, `OAUTH_FACEBOOK_CLIENT_SECRET`, `OAUTH_CALLBACK_BASE_URL`
  (the API origin, e.g. `https://api.bigbike.vn`) and `OAUTH_WEB_SUCCESS_URL` (the storefront
  origin). Blank client id/secret keeps a provider disabled — the buttons still render and the
  flow lands on the login page with an error. The exact callback URL
  (`{OAUTH_CALLBACK_BASE_URL}/api/v1/customer/auth/oauth/{provider}/callback`) must also be
  registered provider-side, or Google answers `redirect_uri_mismatch`. See
  `INTEGRATION_GUIDE.md` for the provider setup. `CONFIRMED_FROM_CONFIG`
- All service ports (Postgres, MinIO, Backend, Web, Admin) are bound to `127.0.0.1` — public traffic must arrive via the nginx reverse proxy, never directly. `CONFIRMED_FROM_CONFIG`
- `SPRING_PROFILES_ACTIVE` for staging/production must not include `mock`; placeholder auth is explicitly limited to dev/mock behavior in `AuthController` and `DevAdminAuthService`. `CONFIRMED_FROM_CODE`
- `bigbike-web` must call the real backend public APIs (`/api/v1/products`, `/api/v1/menus/**`, `/api/v1/settings/public`, etc.). The legacy `scripts/mock-api-server.mjs` storefront shim is not part of the deployment contract and must not be restored in runtime/dev/prod paths. `CONFIRMED_FROM_CODE`
- `bigbike-admin` must call the real backend admin APIs at runtime. The former admin mock build flag and runtime mock fallback layer have been removed; admin production builds must not include mock data fallbacks. `CONFIRMED_FROM_CODE`
- Admin access synchronization uses the backend's in-process STOMP simple broker. The current
  Compose topology runs one backend instance, so an access change reaches every connected session
  on that node. Do not scale backend replicas for this feature without adding a shared broker/event
  bus for the access-change event and WebSocket routing. `OWNER_CONFIRMED_2026-07-31`

### Admin static delivery: cache and gzip

The admin container (`bigbike-admin/Dockerfile` + `bigbike-admin/nginx.conf`) has two deliberately
different cache policies:

- `index.html`, including every SPA fallback route, is returned with `Cache-Control: no-cache`.
  A browser may keep a local copy, but must ask the server to validate it each time it opens the
  panel. This prevents an old HTML shell from referencing chunk hashes that a newer deployment has
  removed.
- Versioned static assets under `/assets/` keep `Cache-Control: public, immutable` for one year.
  Vite puts a content hash in every asset filename, so a new deployment safely receives a new URL
  while repeat visits reuse unchanged code, styles and fonts.

During the image build, gzip sidecars are generated for text delivery artifacts (`.js`, `.css`,
`.html`, `.json`, `.svg`). Nginx uses `gzip_static on` to send the prebuilt `.gz` file when the
request accepts gzip, avoiding per-request compression CPU. The original file remains in the image
and is returned unchanged to clients that do not advertise gzip. No Brotli module or serving stack
change is part of this contract. `CONFIRMED_FROM_CONFIG`

Verify a local or deployed admin container after a rebuild with all of the following:

1. `curl -I http://localhost:4000/` returns `Cache-Control: no-cache` for the HTML shell.
2. `curl -I http://localhost:4000/assets/<current-hash>.js` returns
   `Cache-Control: public, immutable`.
3. The same asset request with `Accept-Encoding: gzip` returns `Content-Encoding: gzip`; without
   that request header it still returns `200` without a gzip content encoding.

The host Nginx remains a pass-through proxy for the admin container. Before changing an actual VPS,
inspect the active configuration, run `nginx -t`, and reload only after it passes; see
“Deployment Caveats”.

## Security Hardening Config

### Storefront error reporting (Sentry)

`bigbike-web` has Sentry wired for browser, server, edge, and Next request errors. It is disabled
when the browser DSN is blank; server and edge reporting are also disabled when both DSNs are
blank, so local development does not send events. To enable a deployment, set
the same project DSN in `SENTRY_DSN` and `NEXT_PUBLIC_SENTRY_DSN` in that deployment's env file,
then rebuild the web image because the public value is baked into the browser bundle. The root
`.env.example` carries the blank placeholders; never commit the populated env file.

Storefront events carry only the operation name, HTTP failure class, and page pathname. The client
must not send customer identity, passwords, email, phone, order keys, payment data, chat text,
request bodies, query strings, cookies, or authorization headers. Expected customer outcomes
(`4xx`, including invalid credentials, validation, unavailable stock, duplicate review, rate
limit, and no-result states) are not reported; network failures and `5xx` failures are. The Sentry
build upload values (`SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`) are optional deployment
credentials for the build operator only, never browser configuration. `CONFIRMED_FROM_CODE` —
`sentry.*.config.ts`, `instrumentation.ts`, storefront reporting helper.

- **Public Review CSRF boundary** — `CustomerCsrfFilter` exempts CSRF validation only for `POST /api/v1/products/{productId}/reviews` and `POST /api/v1/products/{productId}/reviews/photos`. These two endpoints intentionally support guests, and the storefront calls them directly on the API host with credentials so an existing customer session can supply authoritative identity. The exemption must match the HTTP method and complete path shape; it must never use the broad `/api/v1/products/` prefix or exempt neighboring/future product mutations. Exact-origin credentialed CORS and the dedicated per-IP `REVIEW` / `REVIEW_PHOTO` limits remain mandatory. `CONFIRMED_FROM_CODE_AND_SECURITY_REVIEW_2026-07-28`
- **`BIGBIKE_TRUSTED_PROXIES`** — comma-separated exact proxy addresses or narrow, private CIDRs (minimum IPv4 `/24`, IPv6 `/64`) trusted to set `X-Forwarded-For`. Per-IP rate limiting consumes forwarding data only when the direct peer matches this list and the header contains exactly one IP. The minimum prefix is enforced at startup, so a `/16` or `/12` bridge range fails the boot — the checked-in Compose default `172.20.0.0/16` is therefore **not** bootable as-is and every environment must set an explicit narrow value. The `bigbike-dev` bridge allocates `172.20.0.x`, so `172.20.0.0/24` is the correct entry for the single-VPS Compose deployment. Do not use broad Docker ranges such as `172.16.0.0/12`; first verify the real ingress/container hop with `docker inspect` and `nginx -T`. Every public nginx proxy location must remove client-provided forwarding data and emit one canonical client address; BFF/admin internal proxies may forward only that single canonical value. `CONFIRMED_FROM_CODE_AND_CONFIG_2026-08-12`
- **Rate limiting and Redis** — production uses `BIGBIKE_RATE_LIMIT_STORE=redis` and a separate `BIGBIKE_RATE_LIMIT_HMAC_SECRET` (32+ chars); do not reuse JWT, internal API, mail or provider secrets. `BIGBIKE_RATE_LIMIT_REDIS_URL` accepts `rediss://` for a managed HA Redis-compatible service, or plaintext `redis://` **only** when the host stays inside the deployment network — a single-label service name (`redis`) or a loopback/private address. A publicly routable host over plaintext `redis://` is rejected at startup, because counters and HMAC-keyed bucket ids would cross the public internet in the clear. The single-VPS Compose deployment runs the in-network `redis` service, which exposes no host port (`OWNER_CONFIRMED_2026-08-12`: managed TLS Redis deferred; revisit before horizontal scaling). Backend production startup still rejects a missing Redis/HMAC configuration, unsafe proxy CIDR, or an accidental local-only limiter. Compose explicitly passes the documented per-tier `BIGBIKE_RATE_LIMIT_TIERS_<TIER>_{LIMIT,WINDOW}` overrides; leave them empty unless an owner-approved, expiry-bound change has staging evidence. Configure Redis memory quota/`noeviction`, alert at capacity pressure, and verify failover on staging before horizontal scaling. `RATE_LIMITING.md` is the canonical tier/failure policy. `OWNER_CONFIRMED_2026-08-12`
- **Nginx rate response** — set `limit_req_status 429` and `limit_conn_status 429` in the shared config. All versioned public hosts return the standard `RATE_LIMIT_EXCEEDED` JSON + `Retry-After`; native `429` stays separate from `error_page 502 503 504`. Keep proxy interception off on paths that can receive backend `429`, so the backend envelope and computed `Retry-After` pass through unchanged. `OWNER_CONFIRMED_2026-08-12`
- **Actuator** — only `GET /actuator/health` is public. The nginx API config (`deploy/nginx/api.bigbike.vn.conf`) returns `403` for every other `/actuator/` path; Prometheus must scrape the backend over the private network, not the public host. `CONFIRMED_FROM_CONFIG`
- **Media upload body size** — backend accepts media uploads up to 200 MB (raised from 50 MB to allow video uploads; enforced by `MAX_UPLOAD_BYTES` in `AdminMediaService` and `spring.servlet.multipart.max-file-size=200MB` / `max-request-size=210MB`). The nginx API config sets `client_max_body_size 210m` on `^~ /api/v1/admin/media` and keeps `10m` for all other routes. Exceeding the cap returns `413` with a `FILE_TOO_LARGE` JSON error. `CONFIRMED_FROM_CONFIG`
- **Legacy video CSP compatibility** — storefront `frame-src` and admin preview CSP include exactly `https://www.tiktok.com` and `https://www.facebook.com` in addition to YouTube so previously stored video records can still render. These origins are read-only compatibility allowances; every write contract accepts only YouTube or internal Media Library video (`MEDIA_RULE_004`). Do not add shortened-link or wildcard social domains. `CONFIRMED_FROM_OWNER_DECISION`
- **Internal endpoints** — `/api/internal/**` require the `X-Internal-Token` header (matched in constant time) when `BIGBIKE_INTERNAL_TOKEN` is set; deny-by-default when unset. `CONFIRMED_FROM_CONFIG`
- **`BIGBIKE_INTERNAL_TOKEN` / `INTERNAL_API_TOKEN` must both be set** to the same secret value in the environment used by `docker-compose.yaml` (`.env`/`.env.vps`) — generate with `openssl rand -base64 32`. If either is missing or mismatched, the redirect feature fails safe (every lookup gets `401` and falls through to normal routing) but silently does nothing end-to-end; `bigbike-web/proxy.ts` logs the failure on every request. `CONFIRMED_FROM_CONFIG`

## Schema And Migration Notes

- Flyway runs every versioned migration under `bigbike-backend/src/main/resources/db/migration`. Existing migrations are never edited. `V1070__remove_staff_chat_and_retired_assistant_settings.sql` is the additive cleanup for the owner decision 2026-08-30: it removes retired assistant settings, handoff tables/columns/data and `chat.reply`, while retaining core transcript/image/quota structures. Its preflight assertions must pass because the owner confirmed all live chat/handoff data was purged on 2026-08-29. Verify directory sequence and `flyway_schema_history` before rollout. `OWNER_CONFIRMED_2026-08-30`
- Notification retention uses `V1067__admin_notification_retention_and_remove_legacy_read_state.sql` to remove the obsolete shared `admin_notifications.is_read` column/index while retaining `admin_notification_reads`; the backend scheduler removes rows older than six calendar months daily at 03:50 Vietnam time in batches. After rollout, verify the Flyway history, absence of the old column/index, and a successful cleanup log. `OWNER_CONFIRMED_2026-08-28`
- The one-time WordPress live migration must follow [LIVE_MIGRATION_RUNBOOK.md](LIVE_MIGRATION_RUNBOOK.md). The normal Spring `mode=import` runner is legacy rehearsal tooling and is not an authorized production write path. `CONFIRMED_FROM_CODE_2026-08-03`
- Receipt tables (`V52/V53/V55`) were dropped in `V120`; the serial movement table (`V57`) and all other serial tables were dropped in `V259` (serial tracking removed 2026-06-23). POS order snapshot columns were added in `V71` and still exist, but the POS feature itself was removed 2026-06-23 (online-only) — the columns are now only written with online values. `CONFIRMED_FROM_CONFIG`

## Deployment Caveats

- **Chat post-deploy check:** confirm the public chat header identifies BigBike AI in Vietnamese and English, the input is immediately visible, the image button appears only when the AI service is configured, and the Hotline/Zalo/Messenger card opens without any request to `/chat/handoffs`, email or notification. Confirm admin can still view transcript/history and images with `chat.read`, while no queue, claim, staff reply or chat notification appears. Watch backend/nginx logs only for status/connection ids, never transcript/token/PII.

- Internal redirect endpoints (`/api/internal/**`) are protected by both the `X-Internal-Token` app-level check and an nginx-level block (`deploy/nginx/api.bigbike.vn.conf`, returns `403`) — see PERMISSION_MATRIX.md "Internal Redirect Caveat". `CONFIRMED_FROM_CONFIG`
- The host's nginx `default_server` for both HTTP and HTTPS must return `404` for a direct server IP or an unrecognised `Host`; it must not proxy, redirect, or serve a shared site's virtual host. Before reload: inspect the exact active file, run `nginx -t`, reload nginx only after it passes, then test the raw IP and the named BigBike host separately. `OWNER_CONFIRMED_2026-08-15`
- No confirmed external payment webhook or shipping carrier deployment contract exists in repo. `NOT_FOUND_IN_REPO`

## Automatic outage fallback (manual maintenance removed 2026-08-30)

From 30/08/2026, BigBike has no manual maintenance switch, admin lock, maintenance state machine, technical role or emergency lock environment variable. Migration `V1071` moves `vominhduc760@gmail.com` to `ADMIN` before deleting the retired role and data. Existing migrations are never edited.

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

Do not change the outage templates, `render-fallback-pages.sh`, or the Nginx `error_page 502 503 504` blocks as part of this removal. Always run `nginx -t` before any separately approved Nginx reload, and never reload on a failed test.

### Verification after deploy

- **Rate-limit preflight (read-only):** run `docker ps`, then `nginx -T | rg -n 'limit_req_status|limit_conn_status|error_page 429|X-Forwarded-For'`; verify the active files—not only repository copies—show `429`, no `$proxy_add_x_forwarded_for` on a public-to-backend hop, and one known canonical header per hop. Run `bash deploy/nginx/tests/rate-limit-config-test.sh` in the checkout before copying any Nginx file. Do not reload Nginx from this verification step.
- **Rate-limit behavior (staging/approved preview only):** make one normal API request and inspect `status`, `Retry-After`, `Cache-Control`, `error.code`, `meta.requestId` and `meta.timestamp` after a controlled threshold test. It must be `429 RATE_LIMIT_EXCEEDED`, never `503` or the outage body. Do not run a burst/load test against production without an approved window.
- **Redis behavior (staging):** run two backend replicas against the managed endpoint, consume one test bucket through replica A and confirm replica B sees the same remaining state. Test a rolling restart and provider failover; sensitive routes must remain fail-closed, while cart/checkout fallback is bounded and alerts fire. These tests are a release gate for horizontal scaling.

- Confirm `V1071` is recorded in `flyway_schema_history`, the database is still reachable, `maintenance_state` is absent, all five obsolete setting keys are absent, and no `DEVELOPER` role/user/permission references remain.
- Confirm `vominhduc760@gmail.com` has role `ADMIN`; use a fresh login, save one admin record, save one ordinary role, and upload one non-PII image.
- Place a controlled test order or run the approved checkout smoke test to prove the customer flow is unchanged.
- If a controlled outage test is approved, verify `Retry-After: 60` and the static HTML/JSON pages. This tests only the preserved fallback, never a removed lock.

### Rollout gate

Run the migration and the code removal in the same controlled deployment window so an old backend is never expected to use the dropped table. The agent must not start, restart or stop Docker; live checks remain owner-operated when the stack is available.

## Trợ lý BigBike giai đoạn 4 — cấu hình và runbook

- Local dùng `.env`; VPS hiện tại bắt buộc dùng `.env.vps` qua `docker compose --env-file .env.vps ...`. Hai file thật không commit và không được copy đè qua nhau; mọi biến mới chỉ commit trong `.env.example` và `.env.vps.example`.
- Trợ lý chỉ chạy `gemini-3.7-flash`; cấu hình triển khai vẫn khai `BIGBIKE_CHAT_MODEL=gemini-3.7-flash` để nhận diện rõ dịch vụ, nhưng backend khóa cứng ID này và bỏ qua mọi giá trị khác. Không có fallback model, catalog cache hoặc evaluation/cost environment. `BIGBIKE_CHAT_TIMEOUT_SECONDS=65` và `MINIO_CHAT_PRIVATE_BUCKET` vẫn áp dụng. Review moderation giữ các biến riêng, không đổi.
- Bucket ảnh chat phải tồn tại nhưng tuyệt đối không có anonymous policy. Startup backend kiểm bucket riêng khác bucket media công khai; nếu trùng hoặc không thể xác minh private, tính năng ảnh fail-closed trong khi chat chữ vẫn hoạt động.
- Deploy không cần bật ảnh bằng setting. Sau deploy owner chỉ kiểm quota AI ngày 400, image disclosure và quota ảnh cố định 1/lượt–3/hội thoại–20/ngày–8 MB; không còn handoff email/lịch trực. Không có model list, bộ đề, chọn model hoặc theo dõi chi phí/fallback theo model. Backend cập nhật dấu vân tay catalog cục bộ khi cần; thao tác này không gọi Gemini ngoài lượt phân loại ảnh của khách.
- Xoá thử có kiểm soát: upload một fixture không có PII vào hội thoại test, xoá lịch sử, xác minh cả DB metadata và object private biến mất; dùng clock/test fixture cho mốc 90 ngày. Không dùng ảnh hoặc hội thoại khách thật.

Các bước live có chi phí hoặc cần account thật phải do owner chạy sau triển khai; mã nguồn/CI chỉ dùng fake provider. Không gọi hàng loạt Gemini để “test nhanh”.
