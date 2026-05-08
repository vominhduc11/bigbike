# BigBike — Production Deployment Checklist

**Version:** 1.0  
**Date:** 2026-05-08  
**Source gate:** `docs/audits/PRODUCTION_READINESS_GATE.md`  
**Verdict:** CONDITIONAL GO — all P1 items below must be verified before go-live.

---

## 1. Release Verdict

| Gate | Status | Notes |
|---|---|---|
| P0 Blockers | **NONE** | No blocking code defects |
| P1 Pre-deploy required | **5 items** | See Section 11 — all must be checked before traffic |
| P2 Post-release (first sprint) | 6 items | Non-blocking |
| P3 Backlog | 3 items | Future sprints |
| Test suite (1017 tests) | PASS — 0 failures | 1 INFRA_FAIL (Docker/Testcontainers — not a code defect) |
| TypeScript (bigbike-web) | PASS — 0 errors | |
| ESLint (bigbike-admin) | PASS — 0 errors | |
| Flyway migrations | V1–V82, no gaps | |

**Go-live decision:** System is deployable only when all P1 checkboxes in Section 11 are checked.

---

## 2. Required Backend Environment Variables

Set these in the backend's production environment (Docker env, systemd unit, or secrets manager). **Never commit real values to git.**

| Variable | Required | Example / Placeholder | Notes |
|---|---|---|---|
| `BIGBIKE_DB_URL` | YES | `jdbc:postgresql://db-host:5432/bigbike_prod` | PostgreSQL JDBC URL |
| `BIGBIKE_DB_USERNAME` | YES | `bigbike_app` | Dedicated app DB user (not superuser) |
| `BIGBIKE_DB_PASSWORD` | YES | `<STRONG_RANDOM_SECRET>` | Min 32 chars recommended |
| `BIGBIKE_JWT_SECRET` | **P1 — REQUIRED** | `<openssl rand -base64 64>` | Min 64 bytes. If unset, Spring uses an empty/dev default — **all tokens are insecure** |
| `BIGBIKE_COOKIES_SECURE` | YES | `true` | Must be `true` in production (HTTPS-only cookies). Default is `true` in code but set explicitly |
| `CORS_ALLOWED_ORIGINS` | YES | `https://bigbike.vn,https://admin.bigbike.vn` | Comma-separated list of allowed origins; no trailing slash |
| `BIGBIKE_INTERNAL_TOKEN` | **P1 — REQUIRED** | `<openssl rand -base64 32>` | Must equal `INTERNAL_API_TOKEN` on the web side (see Section 3) |
| `WEB_REVALIDATE_URL` | **P1 — REQUIRED** | `https://bigbike.vn/api/revalidate` | ISR revalidation endpoint on the Next.js web host |
| `WEB_REVALIDATE_SECRET` | **P1 — REQUIRED** | `<STRONG_RANDOM_SECRET>` | Must equal `REVALIDATE_SECRET` on the web side |
| `MINIO_ENDPOINT` | YES | `http://minio:9000` | Internal MinIO endpoint |
| `MINIO_ROOT_USER` | YES | `<STRONG_RANDOM>` | MinIO access key |
| `MINIO_ROOT_PASSWORD` | YES | `<STRONG_RANDOM_SECRET>` | MinIO secret key |
| `MINIO_BUCKET` | YES | `bigbike-media` | Bucket name (must be pre-created) |
| `BIGBIKE_MEDIA_PUBLIC_BASE_URL` | YES | `https://cdn.bigbike.vn` | Public URL for media assets (CDN or MinIO proxy) |
| `BIGBIKE_MAIL_HOST` | YES | `smtp.example.com` | SMTP host |
| `BIGBIKE_MAIL_PORT` | YES | `587` | SMTP port (587 for STARTTLS, 465 for SSL) |
| `BIGBIKE_MAIL_USERNAME` | YES | `noreply@bigbike.vn` | SMTP auth username |
| `BIGBIKE_MAIL_PASSWORD` | YES | `<SMTP_PASSWORD>` | SMTP auth password |
| `BIGBIKE_MAIL_FROM` | YES | `BigBike <noreply@bigbike.vn>` | From address shown to recipients |
| `BIGBIKE_MAIL_VERIFY_BASE_URL` | YES | `https://bigbike.vn/verify-email` | Base URL for email verification links |
| `BIGBIKE_MAIL_RESET_BASE_URL` | YES | `https://bigbike.vn/reset-password` | Base URL for password reset links |
| `BIGBIKE_SITE_BASE_URL` | YES | `https://bigbike.vn` | Canonical site URL used in outgoing links |

### Backend properties NOT to set in production

| Property | Reason |
|---|---|
| `bigbike.internal.allow-open=true` | **NEVER** — opens internal endpoints to the public |
| `bigbike.auth.dev-header-enabled=true` | Dev-only bypass — **NEVER** in production |
| `spring.flyway.enabled=false` | Must remain `true` so migrations run on startup |
| Any `spring.h2.*` | H2 is test-only; production uses PostgreSQL |

---

## 3. Required Web Environment Variables (Next.js)

Set these in the web host's environment (Docker env, Vercel project settings, `.env.production`, etc.).

| Variable | Required | Example / Placeholder | Notes |
|---|---|---|---|
| `BIGBIKE_API_BASE_URL` | YES | `http://backend:8080` | Server-side only. Use internal Docker network hostname in Docker Compose; external URL otherwise |
| `NEXT_PUBLIC_API_BASE_URL` | YES | `https://api.bigbike.vn` | Client-side — browser-visible. Must be publicly reachable |
| `REVALIDATE_SECRET` | **P1 — REQUIRED** | `<same value as WEB_REVALIDATE_SECRET on backend>` | ISR revalidation secret. Must match backend `WEB_REVALIDATE_SECRET` |
| `BIGBIKE_SITE_URL` | YES | `https://bigbike.vn` | Server-side canonical URL for metadata/sitemap |
| `NEXT_PUBLIC_SITE_URL` | YES | `https://bigbike.vn` | Client-side canonical URL |
| `INTERNAL_API_TOKEN` | **P1 — REQUIRED** | `<same value as BIGBIKE_INTERNAL_TOKEN on backend>` | Must equal backend `BIGBIKE_INTERNAL_TOKEN`. If mismatched, all runtime redirects silently fail |
| `BIGBIKE_LEGACY_UPLOADS_BASE` | YES | `https://cdn.bigbike.vn/uploads` | Legacy WP uploads CDN base URL |
| `BIGBIKE_MEDIA_INTERNAL_URL` | YES (Docker) | `http://minio:9000/bigbike-media/wp-uploads` | Internal Docker URL for media rewrites. Omit if not using Docker |
| `BIGBIKE_MEDIA_BUCKET_URL` | YES (Docker) | `http://minio:9000/bigbike-media` | Internal Docker URL for /media/* rewrite |
| `BIGBIKE_REDIRECT_CACHE_TTL_SECONDS` | NO | `30` | Default 30s. Lower = faster admin propagation; higher = less backend load |
| `NEXT_PUBLIC_GTM_ID` | CAUTION | `GTM-STAGING_CONTAINER` | **Use a separate GTM container for staging** to avoid polluting production GA4 data. Production: `GTM-5BKZL3K` |

### Secret pairing summary

```
Backend BIGBIKE_INTERNAL_TOKEN  ←→  Web INTERNAL_API_TOKEN   (must match exactly)
Backend WEB_REVALIDATE_SECRET   ←→  Web REVALIDATE_SECRET    (must match exactly)
```

Both pairs must be set before the system handles live traffic. Mismatch causes silent redirect failures and broken ISR cache invalidation.

---

## 4. Required Admin Runtime Config (bigbike-admin)

The admin SPA is a static React/Vite build. It has no server-side runtime variables. All config is baked in at build time.

| Build variable | Required | Value | Notes |
|---|---|---|---|
| `VITE_API_BASE_URL` | YES | `https://api.bigbike.vn` | Backend API URL baked into the admin SPA bundle |

### Admin deployment steps

- [ ] Run `npm run build` in `bigbike-admin/` with production env vars.
- [ ] Serve the `dist/` output from Nginx (or a CDN).
- [ ] Nginx should serve `index.html` for all non-asset routes (SPA routing).
- [ ] Admin SPA must be served over HTTPS. Mixed content (HTTP assets on HTTPS page) will block auth cookies.
- [ ] Restrict admin origin to internal staff IPs at the Nginx level if possible (defense-in-depth).

---

## 5. Required Mobile Release Config (bigbike_mobile)

The Flutter app connects to the public backend API. No server-side env vars — config is compiled into the app binary.

| Config key | Required | Value | Notes |
|---|---|---|---|
| `apiBaseUrl` | YES | `https://api.bigbike.vn` | Must point to production backend. Verify in `lib/core/config/` or equivalent |
| App signing keystore | YES | Production keystore | Use Play Store / App Store signing credentials; never use debug keystore |
| `minSdkVersion` / `targetSdkVersion` | YES | Per current store requirements | Verify before submission |

### Mobile release checklist

- [ ] `apiBaseUrl` points to production backend, not staging/localhost.
- [ ] App signed with production keystore.
- [ ] ProGuard/obfuscation rules verified for release build.
- [ ] Deep links / universal links configured for production domain.
- [ ] Push notification certificates/keys configured for production.
- [ ] Version code and version name bumped.
- [ ] Internal test on physical device against production backend before store submission.

---

## 6. Nginx / Reverse Proxy Checklist

### HTTPS / TLS

- [ ] SSL certificate installed and valid for all domains (`bigbike.vn`, `api.bigbike.vn`, `admin.bigbike.vn`, `cdn.bigbike.vn` if applicable).
- [ ] HTTP → HTTPS redirect configured (301).
- [ ] TLS 1.2+ only (`ssl_protocols TLSv1.2 TLSv1.3;`).
- [ ] Strong cipher suites (`ssl_ciphers HIGH:!aNULL:!MD5;`).
- [ ] HSTS header added (`Strict-Transport-Security: max-age=31536000; includeSubDomains`).

### Forwarded headers (required for ClientIpResolver)

- [ ] `proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;`
- [ ] `proxy_set_header X-Forwarded-Proto $scheme;`
- [ ] `proxy_set_header X-Real-IP $remote_addr;`
- [ ] Backend `TRUSTED_PROXY_COUNT` (or equivalent property) configured to match the number of Nginx hops.

### Internal endpoint restriction (P1)

- [ ] `/api/internal/**` location block restricts access to the web server IP only:

```nginx
location /api/internal/ {
    allow <web-server-IP>;
    deny all;
    proxy_pass http://backend:8080;
}
```

- [ ] Verified that curl from a non-whitelisted IP to `/api/internal/redirects/lookup` returns 403.
- [ ] If backend is in a private VPC, confirm the web server is the only host that can reach port 8080.

### File upload and request limits

- [ ] `client_max_body_size` set to match backend's file upload limit (e.g., `50m` for image/media uploads).
- [ ] `proxy_read_timeout` increased for long-running admin operations if needed.

### Swagger / dev endpoints

- [ ] `/swagger-ui/**` and `/v3/api-docs/**` are blocked in production:

```nginx
location ~* ^/(swagger-ui|v3/api-docs)/ {
    deny all;
    return 404;
}
```

### Security headers

- [ ] `X-Content-Type-Options: nosniff`
- [ ] `X-Frame-Options: SAMEORIGIN` (or `DENY`)
- [ ] `Referrer-Policy: strict-origin-when-cross-origin`
- [ ] Content-Security-Policy configured (at minimum: restrict `script-src`, `img-src`, `connect-src`).

---

## 7. Docker / Service Checklist

### Compose / orchestration

- [ ] Production `docker-compose.prod.yml` (or equivalent) used — not `docker-compose.yml` (dev).
- [ ] Each service has a `restart: unless-stopped` (or `always`) policy.
- [ ] Health checks defined for backend, web, and database services.
- [ ] Secrets passed as environment variables from a secrets manager or `.env.prod` file (not baked into images).

### Volumes

- [ ] PostgreSQL data directory mounted to a named volume or host path (not ephemeral).
- [ ] MinIO data directory mounted to a named volume or host path.
- [ ] Next.js `.next/cache` optionally mounted for build cache persistence across deployments.

### Networking

- [ ] Backend container is NOT exposed on a public port — only accessible via Nginx on the internal Docker network.
- [ ] MinIO admin console port (9001) is NOT publicly accessible.
- [ ] Database port (5432) is NOT publicly accessible.

### Image tagging

- [ ] Production images tagged with a specific version or commit SHA — not `latest`.
- [ ] Old images cleaned up after successful deployment to reclaim disk space.

### Resource limits

- [ ] CPU and memory limits configured per service to prevent a single container from starving others.
- [ ] JVM heap size (`-Xmx`) set explicitly for the backend to fit within container memory limit.

---

## 8. Database Migration Checklist

### Pre-deployment

- [ ] Full database backup taken immediately before deployment.
- [ ] Backup restoration tested on a separate host (restore drill).
- [ ] Migration files V1–V82 present in `bigbike-backend/src/main/resources/db/migration/` with no gaps or checksum conflicts.
- [ ] `flyway validate` passes on a copy of the production database schema.

### First-time production setup

- [ ] PostgreSQL database `bigbike_prod` created.
- [ ] Application database user created with minimal privileges (`CONNECT`, `USAGE`, `SELECT/INSERT/UPDATE/DELETE` on relevant schemas — no `SUPERUSER`, no `CREATEDB`).
- [ ] Flyway runs on backend startup (`spring.flyway.enabled=true` — default).
- [ ] Migration log inspected after first startup to confirm all V1–V82 applied cleanly.

### Seed data

- [ ] `role_permissions` table populated with the canonical seed (all admin roles and their permissions). **If this table is empty, all admin users get 403 on every request.**
- [ ] At least one admin superuser account exists in the `admin_users` table with a known password.
- [ ] Confirm seed does not include test/dev accounts (e.g., `test@bigbike.vn`) in production.

### Post-migration verification

- [ ] Run `SELECT COUNT(*) FROM role_permissions;` — must be > 0.
- [ ] Run `SELECT COUNT(*) FROM admin_users;` — must be ≥ 1.
- [ ] Run `SELECT COUNT(*) FROM flyway_schema_history WHERE success = false;` — must be 0.

---

## 9. Pre-Production Smoke Test Plan

Run these tests against the production environment with real data before opening to public traffic. Use a staging account where possible.

### 9.1 Authentication

- [ ] Customer registration: create new account, receive verification email, verify email address.
- [ ] Customer login: obtain JWT, confirm cookie is `HttpOnly` and `Secure`.
- [ ] Customer logout: confirm cookie is cleared.
- [ ] Admin login via admin panel: confirm redirect to dashboard.
- [ ] Invalid credentials: confirm 401 response, no stack trace in response body.
- [ ] JWT expiry: confirm 401 after token TTL, confirm refresh flow if implemented.

### 9.2 Catalog / Content

- [ ] Homepage loads: hero sliders render, featured products appear.
- [ ] Product listing page loads with pagination.
- [ ] Product detail page loads with images from MinIO/CDN.
- [ ] Category navigation works.
- [ ] Search returns relevant results.
- [ ] Blog/news listing and detail pages load.
- [ ] Static pages (about, contact) load.

### 9.3 CMS / Admin Content

- [ ] Admin login and dashboard load.
- [ ] Create a test product: upload image (confirm MinIO storage), set price, publish.
- [ ] Create a test redirect: `/test-old` → `/test-new`. Verify redirect resolves within 30s (cache TTL).
- [ ] Update a page/slider: confirm ISR revalidation fires (check backend logs for outbound POST to `WEB_REVALIDATE_URL`), confirm updated content appears on web within 60s.
- [ ] Delete test product and redirect created above.

### 9.4 Orders

- [ ] Add product to cart.
- [ ] Checkout flow: address, payment method selection.
- [ ] Place order: confirm order confirmation page and confirmation email sent.
- [ ] Admin order list shows new order.
- [ ] Admin updates order status: confirm customer sees updated status.

### 9.5 Internal Endpoints (security)

- [ ] `curl https://api.bigbike.vn/api/internal/redirects/lookup?path=/test` from a non-whitelisted external IP returns 403 or connection refused (not 200).
- [ ] `curl https://api.bigbike.vn/swagger-ui/index.html` returns 404 (Nginx blocked).
- [ ] `curl https://api.bigbike.vn/v3/api-docs` returns 404.

### 9.6 Media / Uploads

- [ ] Upload an image via admin panel — confirm stored in MinIO and publicly accessible via `BIGBIKE_MEDIA_PUBLIC_BASE_URL`.
- [ ] Legacy `/wp-content/uploads/*` paths resolve via the Nginx rewrite to CDN.

### 9.7 Reports / Dashboard

- [ ] Admin dashboard revenue figures load without error.
- [ ] Admin reports export (CSV) downloads without error, contains expected columns.
- [ ] Audit log shows recent actions performed during smoke test.

### 9.8 Error handling

- [ ] Navigate to a non-existent URL: confirm 404 page (not a stack trace).
- [ ] Submit a form with invalid data: confirm validation error messages appear, no 500.

---

## 10. CI/CD Required Improvements

The following gaps were identified during the final readiness gate. They are non-blocking for the initial deployment but should be addressed before the second release cycle.

| Item | Priority | Notes |
|---|---|---|
| Docker runner for Testcontainers | P2 | `AdminReportRepositoryQueryTest` (1 test class) requires a Docker daemon. The CI runner must support Docker-in-Docker or a Docker socket mount so Testcontainers can pull `postgres:16-alpine`. Currently INFRA_FAIL in local/CI environments without Docker. |
| Secrets scanning in CI | P2 | Add a secrets-scanning step (e.g., `trufflehog`, `gitleaks`) to prevent accidental commit of credentials. |
| No plaintext secrets in CI logs | P2 | Confirm all secret env vars are masked in CI output (`::add-mask::` in GitHub Actions, or equivalent). |
| Automated smoke test on deploy | P2 | Trigger the Section 9 smoke tests automatically after each production deployment using a Playwright or HTTP-based test suite. |
| Staged rollout / blue-green deploy | P3 | Use blue-green or canary deployments to enable zero-downtime updates and instant rollback. |
| Dependency vulnerability scanning | P3 | Add OWASP Dependency-Check or Snyk to CI for both Maven and npm dependency trees. |

---

## 11. Production Readiness Gate Checklist

All P1 items must be checked before live traffic. P2 items should be completed within the first sprint post-launch.

### P1 — Must complete before go-live

- [ ] **JWT secret set**: `BIGBIKE_JWT_SECRET` is a strong random secret (≥ 64 bytes) on the backend. Verify: `printenv BIGBIKE_JWT_SECRET | wc -c` should be ≥ 88 (base64-encoded 64 bytes).
- [ ] **Internal token pairing**: `BIGBIKE_INTERNAL_TOKEN` (backend) and `INTERNAL_API_TOKEN` (web) are set to the **same** value. Verify: redirect lookup works end-to-end (Section 9.3 redirect smoke test passes).
- [ ] **ISR revalidation wired**: `WEB_REVALIDATE_URL` points to the live web host's `/api/revalidate` endpoint; `WEB_REVALIDATE_SECRET` matches web `REVALIDATE_SECRET`. Verify: update a product in admin, confirm web page reflects change within 60s.
- [ ] **Nginx ACL on `/api/internal/**`**: Requests from external IPs to `/api/internal/` return 403 or connection refused (Section 9.5 security smoke test).
- [ ] **SSL/TLS active on all domains**: All production domains (web, API, admin, CDN) serve HTTPS only; HTTP redirects to HTTPS; certificate is valid and not self-signed.

### P2 — Complete within first sprint post-launch

- [ ] **Docker runner in CI**: Testcontainers-based tests pass in CI (Section 10).
- [ ] **Secrets scanning in CI**: Secrets-scanning step added to CI pipeline.
- [ ] **`role_permissions` seed confirmed**: `SELECT COUNT(*) FROM role_permissions;` returns the expected count in production DB.
- [ ] **Admin seed user hardened**: Default admin password changed; no test accounts present in production DB.
- [ ] **GTM staging container**: Staging environment uses a separate GTM container ID (not `GTM-5BKZL3K`) to isolate analytics data.
- [ ] **Token rotation runbook documented**: Procedure for rotating `BIGBIKE_INTERNAL_TOKEN` / `INTERNAL_API_TOKEN` without redirect downtime (blue-green or coordinated redeploy).

---

## 12. Rollback Plan

### Criteria for rollback

Initiate rollback if any of the following occur within 30 minutes of go-live:

- Backend returns 5xx on more than 1% of requests for 5 consecutive minutes.
- Database migration failure on startup (Flyway exits with error).
- Admin panel or web homepage returns 5xx or blank page.
- Any P1 smoke test fails after traffic is live.

### Rollback procedure

1. **Redirect traffic back to previous version.**
   - Blue-green: update Nginx `upstream` to point to the previous backend container; update DNS/load balancer to serve previous web build.
   - Single-server: `docker compose stop backend web admin && docker compose up -d backend:PREV_TAG web:PREV_TAG admin:PREV_TAG`.

2. **Revert Flyway migrations (if any new migrations were applied).**
   - Flyway OSS does not support automatic rollback. Apply manual SQL `DOWN` scripts (prepare these before deployment for every migration in the release).
   - If rollback SQL is not ready, restore from the pre-deployment database backup (Section 8).

3. **Restore database from backup (if data corruption suspected).**
   - Stop all services.
   - `pg_restore -d bigbike_prod backup_pre_deploy.dump`
   - Restart previous version of backend.

4. **Verify rollback success.**
   - Re-run critical Section 9 smoke tests against the restored previous version.
   - Confirm backend logs show no errors.

5. **Post-incident.**
   - Document the failure mode, root cause, and timeline.
   - File a bug report before the next deployment attempt.
   - Do not re-attempt deployment until root cause is fixed and verified in staging.

### Rollback time target

Target: < 15 minutes from decision to traffic restored on previous version.

---

## 13. Post-Release Backlog (P2 / P3)

These items are not blocking the initial release but are required in subsequent sprints.

### P2 — First sprint post-launch

| ID | Item | Domain | Notes |
|---|---|---|---|
| P2-001 | `refund_transactions` table and refund ledger | Orders / Finance | Current refund flow writes `REFUNDED` status but has no separate refund transaction record. Required for accounting reconciliation. |
| P2-002 | Idempotency key TTL cleanup job | Orders | Idempotency keys (if implemented) accumulate in DB. Add a scheduled job to purge keys older than 30 days. |
| P2-003 | Verify-email rate limiting | Auth | Email verification resend endpoint has no rate limit. Add per-user throttle (e.g., max 3 resends per hour) to prevent abuse. |
| P2-004 | Admin return request detail envelope | Returns | `GET /api/admin/return-requests/{id}` returns a flat entity. Wrap in a consistent `data:` envelope for API contract consistency. |
| P2-005 | `listAdminUsers` pagination | Admin Users | `GET /api/admin/users` returns all records unbounded. Add `page`/`size` parameters and `Page<>` response. |
| P2-006 | Token rotation runbook | Ops | Document step-by-step procedure for rotating `BIGBIKE_INTERNAL_TOKEN` / `INTERNAL_API_TOKEN` without redirect downtime. |

### P3 — Future sprints

| ID | Item | Domain | Notes |
|---|---|---|---|
| P3-001 | Webhook auto-reconciliation for SePay | Payments | Current SePay flow is manual (no auto-reconciliation). Wire up SePay webhook callback to auto-confirm orders on payment receipt. |
| P3-002 | Distributed rate limiting (Redis) | Auth / API | Current rate limiting is in-process (per JVM instance). In a multi-instance deployment, rate limits are not shared. Replace with Redis-backed rate limiting. |
| P3-003 | Observability stack | Ops | Add centralized logging (ELK or Loki), metrics (Prometheus + Grafana), and distributed tracing (Jaeger or Zipkin) for production visibility. |

---

*Checklist owner: DevOps / Release Engineer*  
*Reviewed against: `docs/audits/PRODUCTION_READINESS_GATE.md` (2026-05-08)*  
*Next review: before each subsequent major release*
