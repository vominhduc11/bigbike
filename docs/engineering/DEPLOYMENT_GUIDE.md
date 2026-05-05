# BigBike Deployment Guide

## 1. Document Purpose

File này mô tả cách deploy BigBike ở mức kỹ thuật, dựa trực tiếp trên evidence trong repo (Docker Compose, Dockerfile, CI workflow, env example, nginx config).

Đối tượng đọc:

- DevOps cần build và run các service.
- Developer cần biết artifact / port / env / runtime của từng app.
- AI agent cần ngữ cảnh deployment để không bịa runbook.

Giới hạn:

- Không chứa secret, token, password, private key, hoặc env value nhạy cảm. Chỉ ghi env key / config name.
- Không thay thế runbook production. Repo chỉ có dev/CI evidence; runtime production chưa verify.
- Không claim production-ready cho bất kỳ component nào nếu chỉ có config evidence.
- Không sửa code, không refactor, không chạy build / test / deploy trong audit này.

## 2. Deployment Status Labels

| Label | Meaning |
|---|---|
| `CONFIRMED_FROM_CODE` | Có Dockerfile / compose / CI / config rõ trong repo cho component đó. |
| `CONFIG_ONLY` | Có env hook / variable / property nhưng không thấy script chạy hoàn chỉnh trong repo. |
| `NEEDS_VERIFICATION` | Có evidence một phần; cần test runtime hoặc audit thêm. |
| `OUT_OF_REPO_DEPLOYMENT` | Phần này phải xử lý ngoài repo (DNS, TLS cert, infra ACL, secret store, monitoring backend…). |
| `NOT_FOUND_IN_REPO` | Không có evidence trong repo. |
| `RUNTIME_NOT_VERIFIED` | Có code path đầy đủ nhưng chưa chạy/test runtime trong audit này. |
| `HIGH_RISK` | Cần đánh giá rủi ro: thiếu signature verification, thiếu network ACL, thiếu retry, thiếu backup, hoặc lộ secret. |

## 3. Deployment Component Summary

| Component | Runtime | Build Artifact | Port / Service | Status | Evidence |
|---|---|---|---|---|---|
| `bigbike-backend` | Java 17 (eclipse-temurin:17-jre-alpine) | `bigbike-backend-0.0.1-SNAPSHOT.jar` (Spring Boot fat-jar via `mvn package`) | container:8080 / host `127.0.0.1:8080` | `CONFIRMED_FROM_CODE` | [bigbike-backend/Dockerfile](bigbike-backend/Dockerfile), [docker-compose.yaml:50-104](docker-compose.yaml), [bigbike-backend/pom.xml](bigbike-backend/pom.xml) |
| `bigbike-web` | Node.js 20-alpine (Next.js standalone) | `.next/standalone` + `.next/static` + `public/` (multi-stage) | container:3000 / host `3000:3000` | `CONFIRMED_FROM_CODE` | [bigbike-web/Dockerfile](bigbike-web/Dockerfile), [docker-compose.yaml:106-154](docker-compose.yaml), [bigbike-web/package.json](bigbike-web/package.json), [bigbike-web/next.config.ts](bigbike-web/next.config.ts) |
| `bigbike-admin` | nginx:alpine serving Vite static build | `dist/` from `vite build` (served via nginx) | container:80 / host `4000:80` | `CONFIRMED_FROM_CODE` | [bigbike-admin/Dockerfile](bigbike-admin/Dockerfile), [bigbike-admin/nginx.conf](bigbike-admin/nginx.conf), [bigbike-admin/package.json](bigbike-admin/package.json), [docker-compose.yaml:156-182](docker-compose.yaml) |
| PostgreSQL | postgres:16-alpine | upstream image | container:5432 / host `127.0.0.1:5432:5432` | `CONFIRMED_FROM_CODE` | [docker-compose.yaml:3-24](docker-compose.yaml) |
| MinIO | minio/minio:RELEASE.2025-04-22T22-12-26Z | upstream image | container:9000 (S3 API), container:9001 (console) / host `127.0.0.1:9000`, `127.0.0.1:9001` | `CONFIRMED_FROM_CODE` | [docker-compose.yaml:26-48](docker-compose.yaml) |
| Redis / queue / distributed cache | — | — | — | `NOT_FOUND_IN_REPO` | None in `pom.xml`, `package.json`, or `docker-compose.yaml`. |
| `bigbike-web-init` (one-shot ISR purge) | curlimages/curl:8.11.1 | upstream image | runs once after `bigbike-web` healthy | `CONFIRMED_FROM_CODE` | [docker-compose.yaml:184-204](docker-compose.yaml) |
| Reverse proxy in front of public web/backend (TLS termination, hostnames) | — | — | — | `OUT_OF_REPO_DEPLOYMENT` | nginx exists only inside `bigbike-admin` container ([bigbike-admin/nginx.conf](bigbike-admin/nginx.conf)); no edge proxy / TLS config in repo. |
| Email / SMTP (transactional) | external SaaS | — | — | `CONFIG_ONLY` (env hooks present; senders no-op when host blank) | [docker-compose.yaml:88-98](docker-compose.yaml), [bigbike-backend/src/main/resources/application.properties:50-59](bigbike-backend/src/main/resources/application.properties); see [INTEGRATION_GUIDE.md](docs/engineering/INTEGRATION_GUIDE.md) Section 6 |
| WebSocket runtime | served by `bigbike-backend` on `/ws` | (same jar) | container:8080/ws | `CONFIRMED_FROM_CODE` | [bigbike-backend/src/main/java/com/bigbike/bigbike_backend/config/WebSocketConfig.java](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/config/WebSocketConfig.java); admin proxy at [nginx.conf:41-52](bigbike-admin/nginx.conf) |
| `bigbike_mobile` (Flutter) | Flutter | mobile binaries (apk/ipa) | n/a — distribute via app store/internal channel | `NEEDS_VERIFICATION` | [bigbike_mobile/README.md](bigbike_mobile/README.md) is Flutter default scaffold; no release pipeline in repo. |
| ETL sidecar (one-off WP migration) | mariadb:10.11 | upstream image | container:3306 / host `3307:3306` | `CONFIRMED_FROM_CODE` (one-off, not part of regular deploy) | [bigbike-web/scripts/extract-wp-data/docker-compose.etl.yml](bigbike-web/scripts/extract-wp-data/docker-compose.etl.yml) |
| Sentry / GTM | external SaaS | — | — | `CONFIG_ONLY` | [bigbike-web/sentry.*.config.ts](bigbike-web/sentry.client.config.ts), [bigbike-web/instrumentation.ts](bigbike-web/instrumentation.ts), [bigbike-web/next.config.ts](bigbike-web/next.config.ts) |
| TLS / certificate management | — | — | — | `OUT_OF_REPO_DEPLOYMENT` | No certbot/Caddy/Traefik/cert config in repo. |
| Backup / restore | — | — | — | `NOT_FOUND_IN_REPO` | No `backups/` automation script, no postgres dump cron. |
| Monitoring backend (Prometheus/Loki/Grafana) | — | — | — | `OUT_OF_REPO_DEPLOYMENT` | Backend exposes `prometheus` actuator endpoint in prod but no scraping infra in repo. |

## 4. Runtime Architecture

Lấy trực tiếp từ [docker-compose.yaml](docker-compose.yaml). Tất cả service nằm trên Docker network `bigbike-dev`.

```text
                           ┌──────────────────────────────────┐
                           │ Browser / mobile / partner client│
                           └──────────────┬───────────────────┘
                                          │ HTTP(S)  ⟶  TLS termination
                                          │           is OUT_OF_REPO
                                          │           (no edge proxy in repo)
            ┌─────────────────────────────┼──────────────────────────────┐
            │                             │                              │
       host:3000                    host:4000                      host:127.0.0.1:8080
       (bigbike-web)                (bigbike-admin nginx)          (bigbike-backend)
            │                             │                              │
   ┌────────┴─────────┐         ┌─────────┴──────────┐         ┌─────────┴──────────┐
   │ Next.js standalone│         │ nginx proxies:    │         │ Spring Boot 4.0.5 │
   │ node server.js   │ ──────► │ /api/  → backend  │ ──────► │ Actuator /health  │
   │ proxy.ts redirect │         │ /media/→ minio    │         │ JWT, RBAC,         │
   │ /api/revalidate   │         │ /ws    → backend  │         │ rate limit         │
   └─────────┬─────────┘         │ /      → SPA      │         │ STOMP /ws          │
             │                   └─────────┬──────────┘        └─────┬──┬───────────┘
             │ POST /api/                  │                         │  │
             │ revalidate (secret)         │                         │  │
             ▼                             │           depends_on    │  │ depends_on
   ┌──────────────────┐                    │       (healthcheck)     │  │  (healthcheck)
   │ bigbike-web-init │  ─ POST tags ─►    │                         ▼  ▼
   │  (curl one-shot) │                    │                  ┌─────────┴────────┐
   └──────────────────┘                    │                  │   postgres:16    │
                                           │                  │   container:5432 │
                                           │                  │  vol postgres_data│
                                           │                  └──────────────────┘
                                           │                         │
                                           │                  ┌──────┴───────────┐
                                           │                  │   minio:RELEASE  │
                                           ▼                  │   container:9000 │
                                  (legacy + new media)        │   console:9001   │
                                                              │  vol minio_data  │
                                                              └──────────────────┘

External (CONFIG_ONLY):
  Email / SMTP   ← spring.mail.* env on backend (host empty disables)
  Sentry         ← SENTRY_DSN / NEXT_PUBLIC_SENTRY_DSN on web
  GTM            ← NEXT_PUBLIC_GTM_ID on web

depends_on chain:
  bigbike-backend  ⟵ postgres (healthy) + minio (healthy)
  bigbike-web      ⟵ bigbike-backend (healthy)
  bigbike-admin    ⟵ bigbike-backend (healthy)
  bigbike-web-init ⟵ bigbike-web (healthy)
```

## 5. Required Environment Variables

Chỉ liệt kê **tên** biến và **nguồn** evidence. **Không** ghi giá trị thực.

### 5.1 Root Compose (`.env` ở repo root)

| Component | Env Key | Purpose | Required | Sensitive? | Evidence |
|---|---|---|---|---|---|
| Compose / Postgres | `POSTGRES_DB` | Database name | Default `bigbike` | No | [docker-compose.yaml:8](docker-compose.yaml), [.env.example:7](.env.example) |
| Compose / Postgres | `POSTGRES_USER` | DB user | Default `bigbike` | No | [docker-compose.yaml:9](docker-compose.yaml), [.env.example:8](.env.example) |
| Compose / Postgres | `POSTGRES_PASSWORD` | DB password | **Required (`?:`)** | Yes | [docker-compose.yaml:10](docker-compose.yaml), [.env.example:9](.env.example) |
| Compose / MinIO | `MINIO_ROOT_USER` | MinIO admin user | Default `minio_admin` | Yes | [docker-compose.yaml:32](docker-compose.yaml), [.env.example:12](.env.example) |
| Compose / MinIO | `MINIO_ROOT_PASSWORD` | MinIO admin secret | **Required (`?:`)** | Yes | [docker-compose.yaml:33](docker-compose.yaml), [.env.example:13](.env.example) |
| Compose / MinIO | `MINIO_BUCKET` | Bucket name | Default `bigbike-media` | No | [docker-compose.yaml:76](docker-compose.yaml), [.env.example:14](.env.example) |
| Compose / Backend | `MINIO_ENDPOINT` | S3 endpoint URL | Auto-set to `http://minio:9000` in compose; override for prod | No | [docker-compose.yaml:73](docker-compose.yaml), [.env.example:19-21](.env.example) |
| Backend | `SPRING_PROFILES_ACTIVE` | Spring profile (`dev`/`mock`/`prod`) | Default `prod` in compose | No | [docker-compose.yaml:68](docker-compose.yaml), [.env.example:22](.env.example) |
| Backend | `BIGBIKE_DB_URL` | JDBC URL | Auto-built in compose | No | [docker-compose.yaml:69](docker-compose.yaml), [bigbike-backend/src/main/resources/application.properties:3](bigbike-backend/src/main/resources/application.properties) |
| Backend | `BIGBIKE_DB_USERNAME` | DB user | Same as `POSTGRES_USER` | No | [docker-compose.yaml:70](docker-compose.yaml) |
| Backend | `BIGBIKE_DB_PASSWORD` | DB password | **Required** | Yes | [docker-compose.yaml:71](docker-compose.yaml) |
| Backend | `BIGBIKE_JWT_SECRET` | JWT signing secret | **Required (`?:`)** for prod, ≥ 32 chars | Yes | [docker-compose.yaml:72](docker-compose.yaml), [.env.example:24-26](.env.example) |
| Backend | `BIGBIKE_CORS_ALLOWED_ORIGINS` (passed to backend as `CORS_ALLOWED_ORIGINS`) | Comma-separated allowed origins | **Required (`?:`)** | No | [docker-compose.yaml:77-78](docker-compose.yaml), [.env.example:28-29](.env.example) |
| Backend | `BIGBIKE_COOKIES_SECURE` | `Secure` cookie flag (true in prod) | Default `true` (overridden `false` in dev profile) | No | [bigbike-backend/src/main/resources/application.properties:18](bigbike-backend/src/main/resources/application.properties), [application-dev.properties:6](bigbike-backend/src/main/resources/application-dev.properties) |
| Backend | `BIGBIKE_SITE_BASE_URL` | Public site URL for email templates | Default `https://bigbike.vn` | No | [docker-compose.yaml:80](docker-compose.yaml), [.env.example:65](.env.example) |
| Backend | `BIGBIKE_ADMIN_BASE_URL` | Admin URL for email templates | Default `https://admin.bigbike.vn` | No | [docker-compose.yaml:81](docker-compose.yaml), [.env.example:66](.env.example) |
| Backend | `BIGBIKE_MEDIA_PUBLIC_BASE_URL` | Public-facing media base URL allowlist anchor | Default `http://localhost:9000/bigbike-media` | No | [docker-compose.yaml:85](docker-compose.yaml), [.env.example:71](.env.example) |
| Backend ↔ Web | `WEB_REVALIDATE_URL` | Backend → Web cache purge endpoint | Compose default `http://bigbike-web:3000/api/revalidate` | No | [docker-compose.yaml:86](docker-compose.yaml), [.env.example:46](.env.example) |
| Backend ↔ Web | `WEB_REVALIDATE_SECRET` | Shared secret cho ISR purge | Required if revalidation used | Yes | [docker-compose.yaml:87](docker-compose.yaml), [.env.example:43](.env.example) |
| Backend / Mail | `BIGBIKE_MAIL_HOST` | SMTP host (empty disables mail) | Optional | No | [docker-compose.yaml:89](docker-compose.yaml), [.env.example:52](.env.example) |
| Backend / Mail | `BIGBIKE_MAIL_PORT` | SMTP port | Default `587` | No | [docker-compose.yaml:90](docker-compose.yaml) |
| Backend / Mail | `BIGBIKE_MAIL_USERNAME` | SMTP user | Optional | Yes | [docker-compose.yaml:91](docker-compose.yaml) |
| Backend / Mail | `BIGBIKE_MAIL_PASSWORD` | SMTP password / App password | Optional | Yes | [docker-compose.yaml:92](docker-compose.yaml) |
| Backend / Mail | `BIGBIKE_MAIL_SMTP_AUTH` / `BIGBIKE_MAIL_STARTTLS` | SMTP auth / STARTTLS flag | Default `true` | No | [docker-compose.yaml:93-94](docker-compose.yaml) |
| Backend / Mail | `BIGBIKE_MAIL_FROM` / `BIGBIKE_MAIL_ADMIN` | From / admin recipient | Defaults present | No | [docker-compose.yaml:95-96](docker-compose.yaml) |
| Backend / Mail | `BIGBIKE_MAIL_VERIFY_BASE_URL` / `BIGBIKE_MAIL_RESET_BASE_URL` | Email deeplinks | Defaults present | No | [docker-compose.yaml:97-98](docker-compose.yaml) |

### 5.2 Web (`bigbike-web`)

| Env Key | Purpose | Required | Sensitive? | Evidence |
|---|---|---|---|---|
| `BIGBIKE_API_BASE_URL` | Backend base URL (server-side) | Required | No | [docker-compose.yaml:134](docker-compose.yaml), [bigbike-web/.env.example:7](bigbike-web/.env.example) |
| `NEXT_PUBLIC_API_BASE_URL` | Backend base URL (client-side, build-time bake) | Required at build | No | [bigbike-web/Dockerfile:22-23](bigbike-web/Dockerfile), [bigbike-web/.env.example:10](bigbike-web/.env.example) |
| `BIGBIKE_SITE_URL` / `NEXT_PUBLIC_SITE_URL` | Canonical site URL (metadata, og:url, sitemap) | Required | No | [docker-compose.yaml:136-137](docker-compose.yaml), [bigbike-web/.env.example:17-18](bigbike-web/.env.example) |
| `BIGBIKE_DISABLE_DEV_FALLBACK` | Disable dev API fallback at build | Compose sets `true` | No | [docker-compose.yaml:138](docker-compose.yaml), CI: [.github/workflows/ci.yml:85](.github/workflows/ci.yml) |
| `REVALIDATE_SECRET` | Validates incoming `/api/revalidate` POSTs (must match backend `WEB_REVALIDATE_SECRET`) | Required if revalidation used | Yes | [bigbike-web/app/api/revalidate/route.ts:6](bigbike-web/app/api/revalidate/route.ts), [docker-compose.yaml:139](docker-compose.yaml), [bigbike-web/.env.example:14](bigbike-web/.env.example) |
| `BIGBIKE_REDIRECT_CACHE_TTL_SECONDS` | In-process redirect cache TTL | Default `300` | No | [docker-compose.yaml:140](docker-compose.yaml), [bigbike-web/proxy.ts:13-16](bigbike-web/proxy.ts) |
| `BIGBIKE_LEGACY_UPLOADS_BASE` | Browser-facing media origin (build-time, baked into CSP) | Required at build for legacy media | No | [bigbike-web/Dockerfile:14-16](bigbike-web/Dockerfile), [bigbike-web/next.config.ts:113-120](bigbike-web/next.config.ts) |
| `BIGBIKE_MEDIA_INTERNAL_URL` | Server-side rewrite destination (Docker hostname) | Required at build for Docker | No | [bigbike-web/Dockerfile:18-20](bigbike-web/Dockerfile), [bigbike-web/next.config.ts:121-128](bigbike-web/next.config.ts) |
| `BIGBIKE_MEDIA_BUCKET_URL` | Bucket root for `/media/*` rewrite (auto-derived if unset) | Optional | No | [bigbike-web/.env.example:38-42](bigbike-web/.env.example), [bigbike-web/next.config.ts:130-139](bigbike-web/next.config.ts) |
| `NEXT_PUBLIC_GTM_ID` | Google Tag Manager container ID | Optional | No | [docker-compose.yaml:142](docker-compose.yaml), [bigbike-web/.env.example:44-49](bigbike-web/.env.example) |
| `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` | Sentry DSN | Optional | Yes (DSN treated as semi-secret) | [docker-compose.yaml:144-145](docker-compose.yaml), [bigbike-web/sentry.server.config.ts](bigbike-web/sentry.server.config.ts), [bigbike-web/sentry.client.config.ts](bigbike-web/sentry.client.config.ts) |
| `SENTRY_AUTH_TOKEN` / `SENTRY_ORG` / `SENTRY_PROJECT` | Sentry source-map upload (build-time) | Optional, build-only | Yes | [docker-compose.yaml:146-148](docker-compose.yaml), [bigbike-web/next.config.ts:393-408](bigbike-web/next.config.ts) |
| `BIGBIKE_ADMIN_TOKEN` / `BIGBIKE_ADMIN_EMAIL` / `BIGBIKE_ADMIN_PASSWORD` | One-off ETL scripts auth | Optional (only for `etl:*` scripts) | Yes | [bigbike-web/.env.example:53-58](bigbike-web/.env.example) |

### 5.3 Admin (`bigbike-admin`)

| Env Key | Purpose | Required | Sensitive? | Evidence |
|---|---|---|---|---|
| `VITE_ADMIN_API_BASE` | Admin API base URL (build-time) | Compose sets `/api/v1` (relative; nginx proxies) | No | [bigbike-admin/Dockerfile:10-13](bigbike-admin/Dockerfile), [docker-compose.yaml:163](docker-compose.yaml) |
| `VITE_USE_ADMIN_MOCK` | Force admin mock mode | Compose sets `false`, CI sets `false` | No | [bigbike-admin/Dockerfile:11](bigbike-admin/Dockerfile), [docker-compose.yaml:164](docker-compose.yaml), [.github/workflows/ci.yml:118](.github/workflows/ci.yml) |
| `VITE_ADMIN_ROLE` | Default admin role (mock/dev only) | Compose sets `ADMIN` | No | [bigbike-admin/Dockerfile:12](bigbike-admin/Dockerfile), [docker-compose.yaml:165](docker-compose.yaml) |

> Vite vars are **build-time** ARG → ENV; changing them needs a rebuild. Confirmed in [bigbike-admin/Dockerfile:10-15](bigbike-admin/Dockerfile).

### 5.4 Backend additional properties

Tham chiếu [bigbike-backend/src/main/resources/application.properties](bigbike-backend/src/main/resources/application.properties) cho các property nội bộ (`spring.flyway.locations`, `spring.servlet.multipart.max-file-size=52MB`, `spring.jpa.hibernate.ddl-auto=validate`, `bigbike.jwt.access-token-ttl-seconds=900`, `bigbike.jwt.refresh-token-ttl-seconds=604800`). Không cần override trong môi trường thường.

## 6. Build Commands

| Component | Build Command | Evidence | Status |
|---|---|---|---|
| `bigbike-backend` | `./mvnw -B clean verify` (CI) hoặc `./mvnw package` (Dockerfile builder stage runs `mvn package -DskipTests -q`) | [bigbike-backend/Dockerfile:7](bigbike-backend/Dockerfile), [.github/workflows/ci.yml:54](.github/workflows/ci.yml), [README.md:404-409](README.md) | `CONFIRMED_FROM_CODE` |
| Backend Docker image | `docker build -t bigbike-backend:<sha> .` (multi-stage) | [bigbike-backend/Dockerfile](bigbike-backend/Dockerfile), [.github/workflows/ci.yml:56-57](.github/workflows/ci.yml) | `CONFIRMED_FROM_CODE` |
| `bigbike-web` lint | `npm run lint` (= `eslint`) | [bigbike-web/package.json:9](bigbike-web/package.json), [.github/workflows/ci.yml:80-81](.github/workflows/ci.yml) | `CONFIRMED_FROM_CODE` |
| `bigbike-web` build | `npm run build` (= `next build`) | [bigbike-web/package.json:7](bigbike-web/package.json), [.github/workflows/ci.yml:82-87](.github/workflows/ci.yml) | `CONFIRMED_FROM_CODE` |
| `bigbike-web` tests | `npm run test` (= `vitest run`) | [bigbike-web/package.json:11](bigbike-web/package.json) | `CONFIRMED_FROM_CODE` (CI does **not** run tests — only lint + build) |
| Web Docker image | `docker build -t bigbike-web:<sha> .` (multi-stage; deps → builder → runner) | [bigbike-web/Dockerfile](bigbike-web/Dockerfile), [.github/workflows/ci.yml:89-90](.github/workflows/ci.yml) | `CONFIRMED_FROM_CODE` |
| `bigbike-admin` lint | `npm run lint` | [bigbike-admin/package.json:9](bigbike-admin/package.json), [.github/workflows/ci.yml:113-114](.github/workflows/ci.yml) | `CONFIRMED_FROM_CODE` |
| `bigbike-admin` build | `npm run build` (= `vite build`) | [bigbike-admin/package.json:8](bigbike-admin/package.json), [.github/workflows/ci.yml:116-119](.github/workflows/ci.yml) | `CONFIRMED_FROM_CODE` |
| Admin Docker image | `docker build -t bigbike-admin:<sha> .` (multi-stage; vite build → nginx serve) | [bigbike-admin/Dockerfile](bigbike-admin/Dockerfile), [.github/workflows/ci.yml:121-122](.github/workflows/ci.yml) | `CONFIRMED_FROM_CODE` |
| Compose build all | `docker compose build` | [docker-compose.yaml](docker-compose.yaml) build stanzas | `CONFIRMED_FROM_CODE` |

## 7. Local Docker Compose Deployment

### 7.1 Prerequisites

- Docker Engine + Compose v2.
- A populated `.env` at repo root (copy from [.env.example](.env.example) and fill in real secrets).
- All required `?:` variables (see Section 5.1) must be set or compose fails fast.

### 7.2 Compose services

[docker-compose.yaml](docker-compose.yaml) defines:

1. `postgres` — postgres:16-alpine.
2. `minio` — minio/minio image with console.
3. `bigbike-backend` — built from `./bigbike-backend/Dockerfile`.
4. `bigbike-web` — built from `./bigbike-web/Dockerfile` with required build args (see Section 5.2).
5. `bigbike-admin` — built from `./bigbike-admin/Dockerfile` with required Vite build args (Section 5.3).
6. `bigbike-web-init` — one-shot `curlimages/curl:8.11.1` that POSTs `/api/revalidate` after web is healthy.

### 7.3 Volumes

- `postgres_data:/var/lib/postgresql/data` — DB persistence.
- `minio_data:/data` — object storage persistence.
- (No volume for backend or web — apps are stateless containers.)

### 7.4 Memory limits (per `deploy.resources.limits.memory`)

| Service | Memory |
|---|---|
| `postgres` | 512m |
| `minio` | 512m |
| `bigbike-backend` | 768m |
| `bigbike-web` | 512m |
| `bigbike-admin` | 128m |
| `bigbike-web-init` | 32m |

### 7.5 Healthchecks

| Service | Probe | Interval / Start period |
|---|---|---|
| `postgres` | `pg_isready -U $POSTGRES_USER -d $POSTGRES_DB` | 10s / 15s |
| `minio` | `curl -f http://localhost:9000/minio/health/live` | 15s / 20s |
| `bigbike-backend` | `wget -qO- http://127.0.0.1:8080/actuator/health` | 30s / 60s |
| `bigbike-web` | `wget -qO- http://127.0.0.1:3000/` | 30s / 30s |
| `bigbike-admin` | `wget -qO- http://127.0.0.1:80/` | 30s / 10s |

### 7.6 Startup order (`depends_on … condition: service_healthy`)

```text
1. postgres + minio start
2. bigbike-backend waits both healthy → starts → ensures MinIO bucket exists → Flyway migrations
3. bigbike-web + bigbike-admin start in parallel after backend healthy
4. bigbike-web-init runs once after web healthy → POSTs /api/revalidate to purge ISR
```

### 7.7 Smoke checks (post-up)

- `docker compose ps` — all 5 long-running services in `healthy`.
- `curl http://127.0.0.1:8080/actuator/health` → JSON with `status: "UP"`.
- `curl http://localhost:3000/` → 200 OK home page.
- `curl http://localhost:4000/` → admin SPA index.
- MinIO console at `http://localhost:9001`.

> Section 17 lists more granular smoke checks.

## 8. Production Deployment Checklist

| # | Item | Status | Source |
|---|---|---|---|
| 1 | All secrets sourced outside repo (env injection or secret store) | `OUT_OF_REPO_DEPLOYMENT` | Required by `?:` failures in [docker-compose.yaml](docker-compose.yaml) |
| 2 | DB backup taken before applying new Flyway migrations | `NOT_FOUND_IN_REPO` (no backup script) | See Section 18 |
| 3 | All Docker images built with target tag | `CONFIRMED_FROM_CODE` (CI builds with `:${{ github.sha }}` tag) | [.github/workflows/ci.yml:57, 90, 122](.github/workflows/ci.yml) |
| 4 | `SPRING_PROFILES_ACTIVE=prod` (or includes `prod`) | Compose default `prod` | [docker-compose.yaml:68](docker-compose.yaml) |
| 5 | `BIGBIKE_JWT_SECRET` ≥ 32 chars and not the default | Required | [.env.example:24-26](.env.example), [bigbike-backend/src/main/resources/application.properties:21](bigbike-backend/src/main/resources/application.properties) |
| 6 | `BIGBIKE_CORS_ALLOWED_ORIGINS` is exact production origin list (no wildcards) | Required | [.env.example:28-29](.env.example) |
| 7 | `bigbike.cookies.secure=true` (default) | Confirmed | [bigbike-backend/src/main/resources/application.properties:18](bigbike-backend/src/main/resources/application.properties) |
| 8 | `NEXT_PUBLIC_*` URLs baked into web image are production URLs | Build-time | [bigbike-web/Dockerfile:22-25](bigbike-web/Dockerfile) |
| 9 | MinIO bucket `bigbike-media` created (auto via [MinioConfig.java:30-52](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/config/MinioConfig.java)) | Confirmed | See Section 10 |
| 10 | Bucket policy reviewed (public-read vs proxied) | `NEEDS_VERIFICATION` (no policy script in repo) | Section 10 |
| 11 | Reverse proxy / TLS in front of `bigbike-web`, `bigbike-admin`, `bigbike-backend` (port 8080 currently bound to `127.0.0.1`) | `OUT_OF_REPO_DEPLOYMENT` | [docker-compose.yaml:62](docker-compose.yaml); see Section 15 |
| 12 | `/api/internal/**` not reachable from public internet | `NEEDS_VERIFICATION` (`HIGH_RISK` if exposed) | [bigbike-backend/src/main/java/com/bigbike/bigbike_backend/config/SecurityConfig.java:92-96](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/config/SecurityConfig.java) |
| 13 | WebSocket upgrade allowed at edge proxy | `OUT_OF_REPO_DEPLOYMENT` (admin nginx supports it; edge proxy must too) | [bigbike-admin/nginx.conf:41-52](bigbike-admin/nginx.conf) |
| 14 | Healthchecks pass for all containers | Confirmed in compose | Section 7.5 |
| 15 | Smoke test the golden user flows post-deploy | `NEEDS_VERIFICATION` | Section 17, [README.md:737-771](README.md) |
| 16 | Rollback plan agreed (image tag rollback or DB-aware) | `NOT_FOUND_IN_REPO` | Section 18 |
| 17 | Logs aggregated (logstash JSON enabled in prod) and metrics scraped | `OUT_OF_REPO_DEPLOYMENT` for shippers | [bigbike-backend/src/main/resources/application-prod.properties:9-23](bigbike-backend/src/main/resources/application-prod.properties) |
| 18 | No secret in any committed file (incl. docs, `.env.local`, log dump) | `CONFIRMED` for tracked repo files | Section 19 |

## 9. Database Deployment

### 9.1 PostgreSQL service

- Image: `postgres:16-alpine`.
- Container: `bigbike-postgres`.
- Port (compose): host `127.0.0.1:5432:5432` — loopback only.
- Volume: `postgres_data`.
- Required env: `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` (compose enforces `POSTGRES_PASSWORD` via `?:`).

### 9.2 Migrations (Flyway)

- `spring.flyway.enabled=true` ([application.properties:11](bigbike-backend/src/main/resources/application.properties)).
- Locations:
  - prod: `classpath:db/migration` ([application-prod.properties:6](bigbike-backend/src/main/resources/application-prod.properties)).
  - dev: `classpath:db/migration,classpath:db/migration-dev` + `out-of-order=true` ([application-dev.properties:1-2](bigbike-backend/src/main/resources/application-dev.properties)).
- `spring.jpa.hibernate.ddl-auto=validate` ([application.properties:8](bigbike-backend/src/main/resources/application.properties)) — never auto-DDL.
- Versions present: `V1…V47` under [bigbike-backend/src/main/resources/db/migration/](bigbike-backend/src/main/resources/db/migration/).
- **Migration runs automatically at backend startup**. There is no separate migration command in repo.

### 9.3 Hikari pool (prod)

[application-prod.properties:25-30](bigbike-backend/src/main/resources/application-prod.properties):

```text
spring.datasource.hikari.maximum-pool-size=20
spring.datasource.hikari.minimum-idle=5
spring.datasource.hikari.connection-timeout=20000
spring.datasource.hikari.idle-timeout=300000
spring.datasource.hikari.max-lifetime=900000
```

### 9.4 Backup / restore

- `NOT_FOUND_IN_REPO`. There is a `backups/` directory at repo root but no automation script for `pg_dump` / `pg_basebackup` / restore is present.
- **Recommended (out-of-repo)**: cron `pg_dump` to `minio_data` (different prefix) or external object store; test restore on staging before each release; document RTO/RPO.

### 9.5 Verification checklist

- [ ] `docker compose exec postgres pg_isready` passes.
- [ ] `flyway_schema_history` matches highest `V*` file in [db/migration/](bigbike-backend/src/main/resources/db/migration/).
- [ ] No `pending` migrations after deploy.
- [ ] Hikari pool not saturated in prod load test.
- [ ] Backup runs nightly and is verified by staging restore.

## 10. Media Storage Deployment

### 10.1 MinIO service

- Image: `minio/minio:RELEASE.2025-04-22T22-12-26Z`.
- Container: `bigbike-minio`.
- Ports (compose): host `127.0.0.1:9000:9000` (S3 API), `127.0.0.1:9001:9001` (console).
- Volume: `minio_data:/data`.
- Required env: `MINIO_ROOT_USER`, `MINIO_ROOT_PASSWORD` (`?:` enforced).

### 10.2 Bucket bootstrap

[MinioConfig.MinioStartupInitializer.ensureBucket](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/config/MinioConfig.java) runs `BucketExistsArgs` then `MakeBucketArgs` on backend startup. Bucket name from `bigbike.minio.bucket` (default `bigbike-media`).

### 10.3 Public URL behavior

Stored URL is **relative** `/media/{objectKey}`. Browser requests `/media/...` and they are rewritten by the Next.js web (`bigbike-web`) and admin nginx (`bigbike-admin`) to MinIO:

- Web: `next.config.ts` rewrite `/media/:path*` → `${BIGBIKE_MEDIA_BUCKET_URL}/:path*` ([next.config.ts:266](bigbike-web/next.config.ts)) and `/wp-content/uploads/:path*` → `${BIGBIKE_MEDIA_INTERNAL_URL}/:path*` ([next.config.ts:267-270](bigbike-web/next.config.ts)).
- Admin: nginx `location ^~ /media/ → proxy_pass http://minio:9000/bigbike-media/` ([bigbike-admin/nginx.conf:25-30](bigbike-admin/nginx.conf)).

Build-time CSP `img-src` baked from `BIGBIKE_LEGACY_UPLOADS_BASE` origin ([bigbike-web/next.config.ts:370](bigbike-web/next.config.ts)).

### 10.4 CDN

`NOT_FOUND_IN_REPO`. `.env.example` references `https://cdn.bigbike.vn/uploads` as the production CDN URL ([bigbike-web/.env.example:25-29](bigbike-web/.env.example)) but no CDN provider config / TLS / cache rule lives in the repo. → `OUT_OF_REPO_DEPLOYMENT`.

### 10.5 Verification checklist

- [ ] `docker compose exec minio curl -f http://localhost:9000/minio/health/live`.
- [ ] Bucket `bigbike-media` created (visible in `http://localhost:9001` console).
- [ ] Test upload via admin `/admin/media`; resulting URL is relative `/media/...`.
- [ ] `/media/...` resolves through web and admin proxies.
- [ ] Production CDN (if any) configured to fetch from MinIO origin and respect cache headers.

## 11. Backend Deployment

### 11.1 Runtime

- Java 17 (`eclipse-temurin:17-jre-alpine`) with `-XX:+UseContainerSupport -XX:MaxRAMPercentage=75.0` ([bigbike-backend/Dockerfile:23](bigbike-backend/Dockerfile)).
- Run as non-root `bigbike` user ([bigbike-backend/Dockerfile:13-14](bigbike-backend/Dockerfile)).
- Port 8080.

### 11.2 Build / package

- Build stage: `maven:3.9-eclipse-temurin-17`.
- `mvn dependency:go-offline` then `mvn package -DskipTests -q`.
- Artifact: `target/bigbike-backend-0.0.1-SNAPSHOT.jar` (Spring Boot fat-jar).
- CI runs `./mvnw -B clean verify` (with tests) before building Docker image ([.github/workflows/ci.yml:48-57](.github/workflows/ci.yml)).

### 11.3 Profiles

| Profile | Notes |
|---|---|
| `dev` | Flyway dev seed enabled; `bigbike.cookies.secure=false`; `management.health.mail.enabled=false`. [application-dev.properties](bigbike-backend/src/main/resources/application-dev.properties) |
| `mock` | DataSource / JPA / Flyway autoconfig disabled — in-memory mock auth. [application-mock.properties](bigbike-backend/src/main/resources/application-mock.properties) |
| `prod` | Hikari tuned, structured WARN/INFO logs, Swagger disabled, Actuator restricted to `health,info,metrics,prometheus`, `show-details=never`, server compression on. [application-prod.properties](bigbike-backend/src/main/resources/application-prod.properties) |
| `test` | Used by CI (`SPRING_PROFILES_ACTIVE=test`), no dedicated properties file in `main/`; tests provide their own context. [.github/workflows/ci.yml:49](.github/workflows/ci.yml) |

### 11.4 Dependencies

- Postgres (Section 9), MinIO (Section 10), optional SMTP (Section 5.1).
- WebSocket served on the same port via STOMP `/ws`.

### 11.5 Health check

- Container `HEALTHCHECK CMD wget -qO- http://localhost:8080/actuator/health` ([bigbike-backend/Dockerfile:20-21](bigbike-backend/Dockerfile)).
- Endpoint exposed `permitAll` ([bigbike-backend/src/main/java/com/bigbike/bigbike_backend/config/SecurityConfig.java:117](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/config/SecurityConfig.java)).
- Prod actuator exposure: `health,info,metrics,prometheus`; details hidden ([application-prod.properties:19-23](bigbike-backend/src/main/resources/application-prod.properties)).

### 11.6 Logs

- Prod profile sets `logging.level.root=WARN`, `com.bigbike=INFO`, `springframework.security/web=WARN`.
- `logstash-logback-encoder` dependency ([bigbike-backend/pom.xml:128-133](bigbike-backend/pom.xml)) — actual `logback-spring.xml` mapping not audited.
- Log aggregator / shipper: `OUT_OF_REPO_DEPLOYMENT`.

### 11.7 Status

`CONFIRMED_FROM_CODE` for build / run / health. `RUNTIME_NOT_VERIFIED` for production profile end-to-end. Production admin auth still uses `DevAdminAuthService` placeholder — see [PERMISSION_MATRIX.md](docs/engineering/PERMISSION_MATRIX.md) Section 11.

## 12. Web Deployment

### 12.1 Runtime

- `node:20-alpine`, runs Next.js standalone (`node server.js`).
- Non-root `bigbike` user.
- `HOSTNAME=0.0.0.0`, `PORT=3000`.
- `NEXT_TELEMETRY_DISABLED=1`.

### 12.2 Build / package

- 3-stage: `deps` (`npm ci --prefer-offline`) → `builder` (`npm run build` = `next build`) → `runner` (only `.next/standalone`, `.next/static`, `public/`).
- Output mode: `output: "standalone"` ([bigbike-web/next.config.ts:156](bigbike-web/next.config.ts)).
- `trailingSlash: true` (mandatory for redirect map).
- Build args required at image build (NOT runtime) — see Section 5.2.

### 12.3 Build-time vs runtime env

| Type | Examples | Notes |
|---|---|---|
| Build-time (`ARG` → `ENV`) | `NEXT_PUBLIC_API_BASE_URL`, `NEXT_PUBLIC_SITE_URL`, `BIGBIKE_LEGACY_UPLOADS_BASE`, `BIGBIKE_MEDIA_INTERNAL_URL` | Baked into client bundle and CSP. Changing them needs `docker build` again. |
| Runtime | `BIGBIKE_API_BASE_URL`, `REVALIDATE_SECRET`, `BIGBIKE_REDIRECT_CACHE_TTL_SECONDS`, `NEXT_PUBLIC_GTM_ID` (also overridable at runtime), `SENTRY_DSN` | Read at request time. |

### 12.4 SEO / static / runtime considerations

- Build-time CSV: `bigbike-web/docs/legacy/SEO_REDIRECT_MAP.csv` parsed in [next.config.ts:14, 25-110](bigbike-web/next.config.ts) → emit Next `redirects` and `headers`.
- Hard-coded category renames + `.html` rewrites (see [next.config.ts:195-352](bigbike-web/next.config.ts)).
- `proxy.ts` does runtime redirect lookup against backend `/api/internal/redirect` with 2 s timeout + L1 cache (TTL `BIGBIKE_REDIRECT_CACHE_TTL_SECONDS`).
- CSP / HSTS headers in `next.config.ts headers()`.
- `next/image` `remotePatterns` allow `cdn.bigbike.vn`, `localhost:9000`, `img.youtube.com` ([next.config.ts:171-194](bigbike-web/next.config.ts)).

### 12.5 ISR revalidation

- Endpoint `POST /api/revalidate` validates `x-revalidate-secret` against `REVALIDATE_SECRET` (or `WEB_REVALIDATE_SECRET`). [bigbike-web/app/api/revalidate/route.ts](bigbike-web/app/api/revalidate/route.ts).
- Backend `WebRevalidationService` posts on `afterCommit` — see [INTEGRATION_GUIDE.md](docs/engineering/INTEGRATION_GUIDE.md) Section 3.
- `bigbike-web-init` one-shot purge after deploy: tags `products,sliders,categories,articles,brands,settings,menus,pages` ([docker-compose.yaml:184-204](docker-compose.yaml)).

### 12.6 Health check

`HEALTHCHECK CMD wget -qO- http://localhost:3000/` ([bigbike-web/Dockerfile:43-44](bigbike-web/Dockerfile)).

### 12.7 Status

`CONFIRMED_FROM_CODE` for build/run/health/CSP/redirects. CDN integration: `OUT_OF_REPO_DEPLOYMENT`.

## 13. Admin Deployment

### 13.1 Runtime

- `nginx:alpine` serving Vite static build.
- Port 80 inside container; published at host `4000`.
- `HEALTHCHECK CMD wget -qO- http://localhost:80/`.

### 13.2 Build / package

- 2-stage: `node:20-alpine` builder (`npm ci --prefer-offline`, `npm run build` = `vite build`) → `nginx:alpine` runner (copies `dist/` and `nginx.conf`).
- Build args: `VITE_ADMIN_API_BASE`, `VITE_USE_ADMIN_MOCK`, `VITE_ADMIN_ROLE` (default in compose: `/api/v1`, `false`, `ADMIN`).

### 13.3 nginx behavior ([bigbike-admin/nginx.conf](bigbike-admin/nginx.conf))

- `gzip on` for text/css/json/js/xml.
- `location /api/` → `http://bigbike-backend:8080/api/` (5 s connect, 30 s read, sets `X-Real-IP` / `X-Forwarded-For` / `X-Forwarded-Proto`).
- `location ^~ /media/` → `http://minio:9000/bigbike-media/` (15 s read).
- `location ^~ /media-proxy/` → same MinIO bucket (legacy DB rewrite path).
- `location /ws` → backend WebSocket with `Upgrade`, `Connection: upgrade`, 3600 s read/send timeouts.
- `location /` → SPA fallback (`try_files $uri $uri/ /index.html`).
- Long static cache for assets (1y immutable).
- Security headers: `X-Frame-Options DENY`, `X-Content-Type-Options nosniff`, `Referrer-Policy strict-origin-when-cross-origin`, `Permissions-Policy`, `Strict-Transport-Security max-age=31536000; includeSubDomains; preload`, full `Content-Security-Policy`.

### 13.4 Reverse proxy / API base URL

API base is **relative** (`/api/v1`) so the nginx inside the container forwards to `bigbike-backend` over the `bigbike-dev` network. Edge reverse proxy in production should expose `bigbike-admin` on `admin.bigbike.vn` and not require any rewrite — admin browser hits same host.

### 13.5 Status

`CONFIRMED_FROM_CODE`. CSP `img-src` whitelists `http://localhost:9000` ([nginx.conf:69](bigbike-admin/nginx.conf)) — `NEEDS_VERIFICATION` whether prod replaces this with the CDN origin.

## 14. Mobile Release

- Project: `bigbike_mobile/` (Flutter).
- [bigbike_mobile/README.md](bigbike_mobile/README.md) is the **default Flutter scaffold** ("A new Flutter project") with no release pipeline.
- No fastlane / `gradle :assembleRelease` / iOS signing config / TestFlight workflow in repo.
- Status: `NEEDS_VERIFICATION`. Per memory note `project_bigbike_mobile`, `bigbike_mobile` is the Flutter mobile counterpart of `bigbike-web`. No release process documented in the repo.

> Out of scope for this guide. A separate `MOBILE_RELEASE_GUIDE.md` would be needed when release automation is added.

## 15. Reverse Proxy / Domain / SSL

### 15.1 What is in repo

- **`bigbike-admin/nginx.conf`** is an **internal** nginx that runs **inside** the admin container. It only serves the admin SPA and proxies `/api`, `/media`, `/ws` to the backend / MinIO over the Docker bridge network. It listens on plain HTTP port 80.

### 15.2 What is NOT in repo

- Edge reverse proxy / load balancer config (Caddy, Traefik, nginx, Cloudflare, etc.).
- TLS certificates / certbot / Let's Encrypt / acme.sh setup.
- Domain config: `bigbike.vn`, `www.bigbike.vn`, `admin.bigbike.vn`, `api.bigbike.vn`, `cdn.bigbike.vn` are referenced in defaults (e.g. [.env.example:65](.env.example), [docker-compose.yaml:80-81](docker-compose.yaml), [bigbike-web/next.config.ts:177](bigbike-web/next.config.ts)) but no DNS or proxy config maps them.
- Status: `OUT_OF_REPO_DEPLOYMENT`.

### 15.3 Recommended checklist (no file paths invented)

- [ ] Edge proxy terminates TLS for `bigbike.vn`, `www.bigbike.vn`, `admin.bigbike.vn`, `api.bigbike.vn`.
- [ ] Edge proxy forwards `bigbike.vn` → `bigbike-web:3000` (or the published port) with `X-Forwarded-Proto https`.
- [ ] Edge proxy forwards `admin.bigbike.vn` → `bigbike-admin:80` and supports WebSocket upgrade.
- [ ] Edge proxy forwards `api.bigbike.vn` → `bigbike-backend:8080`. Restrict `/api/internal/**` paths via location/IP allowlist (HIGH_RISK if exposed).
- [ ] HSTS, OCSP stapling, modern TLS (TLS 1.2+).
- [ ] CDN in front of `cdn.bigbike.vn` for media; origin = MinIO (or rotated from MinIO bucket export).
- [ ] WebSocket: `Upgrade` and 1h+ idle timeout (admin nginx already sets `proxy_read_timeout 3600s`; mirror at edge).

## 16. CI/CD

### 16.1 What is in repo

- [.github/workflows/ci.yml](.github/workflows/ci.yml) — three jobs running on `push` to `main` and on PRs to `main`:

| Job | Steps |
|---|---|
| `backend` | Checkout → setup-java 17 (Temurin, maven cache) → `./mvnw -B clean verify` against postgres:16-alpine service container (`SPRING_PROFILES_ACTIVE=test`, in-job DB env) → `docker build -t bigbike-backend:${{ github.sha }} .` |
| `web` | Checkout → setup-node 22 (npm cache) → `npm ci` → `npm run lint` → `npm run build` (with `BIGBIKE_DISABLE_DEV_FALLBACK=true`, `BIGBIKE_API_BASE_URL=http://localhost:8080`) → `docker build -t bigbike-web:${{ github.sha }} .` |
| `admin` | Checkout → setup-node 22 → `npm ci` → `npm run lint` → `npm run build` (with `VITE_USE_ADMIN_MOCK=false`) → `docker build -t bigbike-admin:${{ github.sha }} .` |

- Concurrency cancellation: `ci-${{ github.ref }}` (`cancel-in-progress: true`).

### 16.2 What is NOT in repo

- No deploy job (no push to registry, no `kubectl`, no `docker compose up` on remote, no SSH/rsync, no Cloud Run/Fly/Railway/etc. step).
- No image push to GHCR / Docker Hub / ECR.
- No release tagging / changelog automation.
- No staging/prod environment promotion gate.
- No security scan (Trivy, Grype) or SBOM step.
- Status: `NOT_FOUND_IN_REPO` for deployment automation.

### 16.3 Recommended release gate (out of repo)

- [ ] Add `docker login` + `docker push` to a registry on `main`.
- [ ] Add a release tag job that triggers a deploy workflow with manual approval.
- [ ] Add Trivy / Grype image scan.
- [ ] Add `npm run test` (vitest) to web job — currently only `lint + build` runs.
- [ ] Add a smoke-test job (HTTP probe of staging) gating production promotion.

## 17. Health Check / Smoke Test

### 17.1 Container-level health

| Check | Target | Expected Result | Status |
|---|---|---|---|
| `pg_isready` | `postgres` | exit 0 | `CONFIRMED_FROM_CODE` ([docker-compose.yaml:19-24](docker-compose.yaml)) |
| `GET /minio/health/live` | `minio` 9000 | 200 OK | `CONFIRMED_FROM_CODE` ([docker-compose.yaml:43-48](docker-compose.yaml)) |
| `GET /actuator/health` | `bigbike-backend` 8080 | `{"status":"UP",...}` | `CONFIRMED_FROM_CODE` ([Dockerfile:20-21](bigbike-backend/Dockerfile), [docker-compose.yaml:99-104](docker-compose.yaml)) |
| `GET /` | `bigbike-web` 3000 | 200 (HTML) | `CONFIRMED_FROM_CODE` ([Dockerfile:43-44](bigbike-web/Dockerfile), [docker-compose.yaml:149-154](docker-compose.yaml)) |
| `GET /` | `bigbike-admin` 80 | 200 (SPA index) | `CONFIRMED_FROM_CODE` ([Dockerfile:26-27](bigbike-admin/Dockerfile), [docker-compose.yaml:177-182](docker-compose.yaml)) |

### 17.2 Application-level smoke (post-deploy)

Source: [README.md:737-771](README.md). Status: `RUNTIME_NOT_VERIFIED`.

| Check | Target | Expected Result | Status |
|---|---|---|---|
| Homepage loads | web `/` | H1 + product strips render | from README §17.1 |
| Category listing | web `/danh-muc-san-pham/...` | Listing + filters | from README §17.1 |
| Product detail | web `/product/...` | Gallery + variants + Add to cart | from README §17.1 |
| Cart add/update/remove | web `/gio-hang` | Cart state persists | from README §17.1 |
| Checkout flow | web `/thanh-toan` | Validates required fields | from README §17.1 |
| Order success | web `/don-hang/xac-nhan` | Renders confirmation | from README §17.1 |
| Mobile layout | viewport ≤ 768px | Usable | from README §17.1 |
| Admin login | admin `/admin/dashboard` (after login) | Session set; dashboard loads | from README §17.2 |
| Admin product list | admin `/admin/products` | List with pagination | from README §17.2 |
| Admin order detail | admin `/admin/orders/{id}` | Status update success/error states | from README §17.2 |
| Permission denied state | admin route lacking required permission | Empty/denied panel | from README §17.2; see [PERMISSION_MATRIX.md](docs/engineering/PERMISSION_MATRIX.md) §6.1 |
| Backend OpenAPI conformance | `bigbike-backend/src/main/resources/openapi/bigbike-openapi.json` | Matches running endpoints | from README §17.3 |
| Backend rejects invalid state transition | e.g. `COMPLETED → PENDING_CONFIRMATION` | 4xx | from README §17.3 |
| WebSocket admin push | admin connects `/ws` after login; new order triggers push | Toast / list refresh | [bigbike-admin/src/lib/adminWebSocket.js](bigbike-admin/src/lib/adminWebSocket.js) |
| ISR revalidation | one-shot `bigbike-web-init` POST | 200; tags purged | [docker-compose.yaml:184-204](docker-compose.yaml) |

## 18. Rollback / Backup

### 18.1 What is in repo

- Image tagging by commit SHA in CI ([.github/workflows/ci.yml:57, 90, 122](.github/workflows/ci.yml)) — enables rollback by re-deploying a previous tag.
- A `backups/` directory exists at repo root (mentioned in [README.md:32](README.md) tree but not committed automation).

### 18.2 What is NOT in repo

- No automated `pg_dump` / `pg_basebackup` / WAL archiving script.
- No MinIO snapshot script.
- No documented rollback playbook.
- No rollback for failed Flyway migration (Flyway versioned migrations are forward-only by design unless paired with manual `repair`/down-script).
- Status: `NOT_FOUND_IN_REPO`.

### 18.3 Recommended rollback / backup checklist (out of repo)

- [ ] Snapshot Postgres before each migration (`pg_dump --format=custom`).
- [ ] Snapshot MinIO bucket (mirror to secondary store) on a schedule.
- [ ] Tag every deploy with image SHA and persist DB schema version.
- [ ] Document forward-only migration policy: never modify a published migration; add a new one to revert.
- [ ] Test restore on staging quarterly (RTO/RPO commitments).
- [ ] Define rollback procedure: re-deploy previous image tag + restore DB snapshot if migration was incompatible.

## 19. Security Deployment Checklist

| Item | Status | Source |
|---|---|---|
| No secret in repo or docs | `CONFIRMED` for tracked files; `.env.local` is gitignored ([.env.example:3-4](.env.example) instructs "NEVER commit .env") | Throughout |
| HTTPS at edge | `OUT_OF_REPO_DEPLOYMENT` | Section 15 |
| `Secure` cookies in prod | `CONFIRMED_FROM_CODE` (`bigbike.cookies.secure=true` default) | [bigbike-backend/src/main/resources/application.properties:18](bigbike-backend/src/main/resources/application.properties) |
| `SameSite` on auth cookies | `CONFIRMED_FROM_CODE` | [bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/auth/AuthController.java:113](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/auth/AuthController.java) (`SameSite=Lax`), [CustomerAuthController.java:166](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/customer/CustomerAuthController.java) (`SameSite=Strict`) |
| CORS allowlist | `CONFIRMED_FROM_CODE` (required env, exact origins) | [bigbike-backend/src/main/resources/application.properties:15](bigbike-backend/src/main/resources/application.properties), [.env.example:28-29](.env.example) |
| CSRF on customer mutations | `CONFIRMED_FROM_CODE` (`CustomerCsrfFilter` in chain) | [bigbike-backend/src/main/java/com/bigbike/bigbike_backend/config/SecurityConfig.java:135-136](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/config/SecurityConfig.java) |
| Admin auth (production-grade) | `NEEDS_VERIFICATION` / `HIGH_RISK` | `DevAdminAuthService` placeholder; see [PERMISSION_MATRIX.md](docs/engineering/PERMISSION_MATRIX.md) §11 |
| Public settings do not expose secrets | `CONFIRMED_FROM_CODE` | [bigbike-backend/src/main/resources/db/migration/V45__seed_sepay_settings.sql](bigbike-backend/src/main/resources/db/migration/V45__seed_sepay_settings.sql) (`is_public=false` for `webhook_token`, `timeout_hours`) |
| Upload limits | `CONFIRMED_FROM_CODE` (50 MB cap, MIME allowlist) | [bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminMediaService.java:45-88](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminMediaService.java), [application.properties:68-69](bigbike-backend/src/main/resources/application.properties) |
| Webhook signature verification | `NOT_FOUND_IN_REPO` (no payment webhook handler) | See [INTEGRATION_GUIDE.md](docs/engineering/INTEGRATION_GUIDE.md) §9.2 |
| Rate limiting | `CONFIRMED_FROM_CODE` (Bucket4j, per-IP) | [bigbike-backend/src/main/java/com/bigbike/bigbike_backend/config/RateLimitingFilter.java](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/config/RateLimitingFilter.java) |
| Security response headers (web + admin) | `CONFIRMED_FROM_CODE` | [bigbike-web/next.config.ts:354-378](bigbike-web/next.config.ts), [bigbike-admin/nginx.conf:64-69](bigbike-admin/nginx.conf) |
| `/api/internal/**` not public | `NEEDS_VERIFICATION` (`HIGH_RISK` if exposed publicly) | [bigbike-backend/src/main/java/com/bigbike/bigbike_backend/config/SecurityConfig.java:92-96](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/config/SecurityConfig.java) |
| Container runs as non-root | `CONFIRMED_FROM_CODE` (backend + web) | [bigbike-backend/Dockerfile:13-14](bigbike-backend/Dockerfile), [bigbike-web/Dockerfile:34-40](bigbike-web/Dockerfile); admin nginx runs as nginx default |
| `?:` env required for sensitive vars | `CONFIRMED_FROM_CODE` | [docker-compose.yaml:10, 33, 72, 78](docker-compose.yaml) |

## 20. Missing / Needs Verification

| Area | Status | Gap | Risk |
|---|---|---|---|
| CI/CD deploy step | `NOT_FOUND_IN_REPO` | CI builds + builds Docker images but no push/deploy. | Medium — manual deploy required. |
| Production admin auth | `NEEDS_VERIFICATION` / `HIGH_RISK` | `DevAdminAuthService` accepts `X-Admin-Role` headers in dev/mock; production JWT path partial. See [PERMISSION_MATRIX.md](docs/engineering/PERMISSION_MATRIX.md) §11. | High |
| Edge reverse proxy + TLS | `OUT_OF_REPO_DEPLOYMENT` | No nginx/Caddy/Traefik for the public domains; no certbot. | High if served publicly without TLS. |
| `/api/internal/**` exposure | `NEEDS_VERIFICATION` | `permitAll` at HTTP layer; depends on infra ACL. | High |
| Backup / restore | `NOT_FOUND_IN_REPO` | No automation. | High |
| Monitoring / alerting | `OUT_OF_REPO_DEPLOYMENT` | Backend exposes prometheus actuator; no scrape config in repo. | Medium |
| Log aggregation shipper | `NOT_FOUND_IN_REPO` | `logstash-logback-encoder` dep present; no agent in compose. | Medium |
| Payment provider runtime (SePay webhook) | `NOT_FOUND_IN_REPO` | DB schema + settings exist; no controller. Memory says manual flow. | Medium for full automation. |
| Shipping carrier API runtime | `NOT_FOUND_IN_REPO` | Internal zones/methods only. | Medium |
| CDN for media public URL | `OUT_OF_REPO_DEPLOYMENT` | `cdn.bigbike.vn/uploads` referenced; no CDN config in repo. | Medium |
| Mobile release pipeline | `NOT_FOUND_IN_REPO` | Default Flutter scaffold. | Low for current scope. |
| Vitest in CI | `NOT_FOUND_IN_REPO` | `npm run test` not run in CI; only lint + build. | Medium |
| Trivy / SBOM scan | `NOT_FOUND_IN_REPO` | No image scanning. | Medium |
| Production runtime smoke test | `RUNTIME_NOT_VERIFIED` | Smoke checklist exists in README; not automated. | Medium |
| `bigbike-web-init` failure handling | `NEEDS_VERIFICATION` | `restart: "no"` — silent failure if revalidate fails. | Low (cache will heal on next admin mutation). |
| WebSocket scale-out | `NEEDS_VERIFICATION` | In-memory `SimpleBroker`; multi-replica may diverge. | Medium when scaling >1 replica. |

## 21. Evidence Summary

| Area | Evidence Path | What It Proves | Confidence |
|---|---|---|---|
| Backend image | [bigbike-backend/Dockerfile](bigbike-backend/Dockerfile) | Multi-stage Maven build, JRE-alpine runtime, healthcheck, non-root. | High |
| Backend dependencies | [bigbike-backend/pom.xml](bigbike-backend/pom.xml) | Spring Boot 4.0.5, JJWT, BouncyCastle, MinIO 8.5.17, Bucket4j, Logstash encoder, Flyway pg, Thymeleaf, Mail starter. | High |
| Backend config profiles | [bigbike-backend/src/main/resources/application.properties](bigbike-backend/src/main/resources/application.properties) + `application-prod.properties` + `application-dev.properties` + `application-mock.properties` | All env hooks, profile differences, Flyway behavior, Hikari prod tuning. | High |
| Backend health | [SecurityConfig.java:117](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/config/SecurityConfig.java) + [Dockerfile:20-21](bigbike-backend/Dockerfile) + [application-prod.properties:19-23](bigbike-backend/src/main/resources/application-prod.properties) | `/actuator/health` permitAll, container probe, prod actuator restriction. | High |
| Web image | [bigbike-web/Dockerfile](bigbike-web/Dockerfile) | 3-stage Next.js standalone build, build args, runtime CMD. | High |
| Web dependencies | [bigbike-web/package.json](bigbike-web/package.json) | Next 16.2.4, React 19.2.4, Sentry, Pino, Zod, React Query. | High |
| Web build behavior | [bigbike-web/next.config.ts](bigbike-web/next.config.ts) | Standalone output, redirects/rewrites, headers, image patterns, Sentry wrap. | High |
| Web ISR purge | [bigbike-web/app/api/revalidate/route.ts](bigbike-web/app/api/revalidate/route.ts), [docker-compose.yaml:184-204](docker-compose.yaml) | Secret-gated tag purge + one-shot init container. | High |
| Admin image | [bigbike-admin/Dockerfile](bigbike-admin/Dockerfile) | Vite build → nginx serve. | High |
| Admin nginx | [bigbike-admin/nginx.conf](bigbike-admin/nginx.conf) | API/media/WS proxying, security headers, CSP. | High |
| Compose | [docker-compose.yaml](docker-compose.yaml) | All 6 services, healthchecks, depends_on, env, ports, volumes. | High |
| Root env example | [.env.example](.env.example) | Complete env-key catalog with explanatory comments. | High |
| Web env example | [bigbike-web/.env.example](bigbike-web/.env.example) | Web-specific keys including ETL helpers. | High |
| CI workflow | [.github/workflows/ci.yml](.github/workflows/ci.yml) | Job matrix, build steps, Docker builds (no push). | High |
| Repo README | [README.md](README.md) | Setup commands, env summary, smoke checklist (§17). | High |
| Admin README | [bigbike-admin/README.md](bigbike-admin/README.md) | Local dev port, route map, mock mode env. | High |
| Mobile project | [bigbike_mobile/README.md](bigbike_mobile/README.md) | Default Flutter scaffold; no release pipeline. | High (for absence of pipeline) |

## 22. Relationship With Other Docs

| Document | Relationship |
|---|---|
| [docs/engineering/ARCHITECTURE.md](docs/engineering/ARCHITECTURE.md) | Tổng quan component / actor / runtime. DEPLOYMENT_GUIDE chi tiết hoá phần "build / runtime / port / env" của Architecture. |
| [docs/engineering/INTEGRATION_GUIDE.md](docs/engineering/INTEGRATION_GUIDE.md) | Mô tả integration nội bộ + bên thứ ba. DEPLOYMENT_GUIDE tham chiếu tên env / config; INTEGRATION_GUIDE giải thích flow. |
| [docs/engineering/PERMISSION_MATRIX.md](docs/engineering/PERMISSION_MATRIX.md) | RBAC backend/frontend; DEPLOYMENT_GUIDE chỉ ra điểm production auth còn `HIGH_RISK`. |
| [docs/business/ACCEPTANCE_CRITERIA.md](docs/business/ACCEPTANCE_CRITERIA.md) | Tiêu chí hoàn thành feature theo role/module; deploy gate liên quan smoke test phải pass criteria tương ứng. |
| `TESTING_GUIDE.md` | (Chưa có) — sẽ chi tiết test plan cho mỗi component. |
| `MOBILE_RELEASE_GUIDE.md` | (Chưa có) — sẽ chi tiết Flutter release. |
| `RUNBOOK.md` / `INCIDENT_RESPONSE.md` | (Chưa có) — sẽ chi tiết oncall, rollback procedure, on-call escalation. |

## Audit Notes

Chỉ đọc/inspect repo. Không sửa code. Không refactor. Không deploy. Không build. Không chạy test. Không ghi secret/token/password/private key/env value.

Audited evidence date: 2026-05-04.

Phạm vi audit:

- [docker-compose.yaml](docker-compose.yaml).
- [bigbike-backend/Dockerfile](bigbike-backend/Dockerfile), [bigbike-backend/pom.xml](bigbike-backend/pom.xml), [application.properties](bigbike-backend/src/main/resources/application.properties), `application-prod.properties`, `application-dev.properties`, `application-mock.properties`.
- [bigbike-backend/src/main/java/.../config/SecurityConfig.java](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/config/SecurityConfig.java), `MinioConfig.java`, `RateLimitingFilter.java`, `WebSocketConfig.java`.
- [bigbike-backend/src/main/java/.../service/admin/AdminMediaService.java](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminMediaService.java).
- [bigbike-backend/src/main/resources/db/migration/](bigbike-backend/src/main/resources/db/migration/) (V1…V47).
- [bigbike-web/Dockerfile](bigbike-web/Dockerfile), [bigbike-web/package.json](bigbike-web/package.json), [bigbike-web/next.config.ts](bigbike-web/next.config.ts), [bigbike-web/proxy.ts](bigbike-web/proxy.ts), [bigbike-web/app/api/revalidate/route.ts](bigbike-web/app/api/revalidate/route.ts), [bigbike-web/sentry.*.config.ts](bigbike-web/sentry.client.config.ts), [bigbike-web/instrumentation.ts](bigbike-web/instrumentation.ts), [bigbike-web/.env.example](bigbike-web/.env.example).
- [bigbike-admin/Dockerfile](bigbike-admin/Dockerfile), [bigbike-admin/nginx.conf](bigbike-admin/nginx.conf), [bigbike-admin/package.json](bigbike-admin/package.json), [bigbike-admin/README.md](bigbike-admin/README.md).
- [.env.example](.env.example).
- [.github/workflows/ci.yml](.github/workflows/ci.yml).
- [README.md](README.md).
- [bigbike_mobile/README.md](bigbike_mobile/README.md), [bigbike_mobile/pubspec.yaml](bigbike_mobile/pubspec.yaml) (existence).

Out-of-scope cho file này:

- Production reverse proxy (nginx/Caddy/Traefik) config.
- Cloud / Kubernetes manifests / Helm chart / Terraform.
- Backup / restore automation.
- Monitoring backend (Prometheus/Loki/Grafana/Datadog).
- CDN provider config.
- Mobile release pipeline (fastlane / Gradle release / iOS signing).
- Test suites internals.
- nginx config for any service other than `bigbike-admin`.
