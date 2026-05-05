# BigBike Integration Guide

## 1. Document Purpose

File này mô tả các integration nội bộ và bên thứ ba của BigBike dựa trực tiếp trên evidence trong repo.

Đối tượng đọc:

- Developer cần wire up integration trong dev/test/stage/prod.
- DevOps cần biết runtime service / port / volume / health.
- Tester cần biết integration nào cần verify trong test plan.
- AI agent cần ngữ cảnh để không bịa integration không có.

Giới hạn:

- Không chứa secret, token, password, private key, hoặc env value nhạy cảm. Chỉ ghi tên biến / config key.
- Không khẳng định runtime nếu chưa verify (tham chiếu `RUNTIME_NOT_VERIFIED`).
- Không bịa integration không có trong repo.
- Không thay thế `DEPLOYMENT_GUIDE.md` hoặc runbook vận hành.
- Không sửa code, không refactor, không implement feature mới.

## 2. Integration Status Labels

| Label | Meaning |
|---|---|
| `CONFIRMED_FROM_CODE` | Có service/controller/config rõ trong code; flow có thể trace từ entrypoint → side-effect. |
| `CONFIG_ONLY` | Có config (env key, properties, docker-compose env) nhưng không thấy runtime flow đầy đủ trong code. |
| `DEPENDENCY_ONLY` | Có dependency trong `pom.xml`/`package.json` nhưng chưa thấy code dùng. |
| `DOCUMENTED_ONLY` | Chỉ thấy trong docs (USER_ROLES.md, ARCHITECTURE.md, BUSINESS_RULES.md…) chứ không thấy trong code. |
| `NEEDS_VERIFICATION` | Có một phần evidence; cần test runtime hoặc audit thêm để khẳng định. |
| `NOT_FOUND_IN_REPO` | Không có evidence trong repo audited. |
| `RUNTIME_NOT_VERIFIED` | Có code path đầy đủ nhưng chưa chạy/test runtime trong audit này. |
| `HIGH_RISK` | Cần đánh giá rủi ro: thiếu signature verification, thiếu network ACL, thiếu retry, hoặc lộ secret. |

## 3. Integration Summary

| Integration | Purpose | Type | Status | Evidence |
|---|---|---|---|---|
| PostgreSQL | OLTP database cho toàn bộ business state. | Internal | `CONFIRMED_FROM_CODE` | `docker-compose.yaml:3-24`, `bigbike-backend/src/main/resources/application.properties:3-12`, `bigbike-backend/pom.xml:39-43, 96-108` |
| Flyway migrations | Schema versioning. | Internal | `CONFIRMED_FROM_CODE` | `bigbike-backend/src/main/resources/application.properties:11-12`, `bigbike-backend/src/main/resources/db/migration/`, `bigbike-backend/pom.xml:42-44, 96-98` |
| MinIO (S3-compatible) | Lưu media (admin upload + WP migration copy). | Self-hosted infra | `CONFIRMED_FROM_CODE` | `docker-compose.yaml:26-48`, `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/config/MinioConfig.java`, `MinioProperties.java`, `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminMediaService.java` |
| Email / SMTP (JavaMailSender) | Transactional email (order, return, auth, contact). | External / SaaS | `CONFIRMED_FROM_CODE` (graceful disable when host blank) | `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/email/EmailDispatchService.java`, `OrderNotificationService.java`, `bigbike-backend/src/main/resources/templates/email/*.html`, `application.properties:50-59`, `pom.xml:46-48` |
| Thymeleaf email templates | Render HTML email. | Internal | `CONFIRMED_FROM_CODE` | 14 templates in `bigbike-backend/src/main/resources/templates/email/`, `pom.xml:80-82, 100-102` |
| WebSocket / STOMP (admin push) | Push order events đến admin SPA. | Internal | `CONFIRMED_FROM_CODE` | `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/config/WebSocketConfig.java`, `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/ws/AdminOrderWsService.java`, `bigbike-admin/src/lib/adminWebSocket.js`, `pom.xml:91-94` |
| Next.js on-demand revalidation | Backend → Web cache purge sau admin mutation. | Internal cross-service | `CONFIRMED_FROM_CODE` | `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/web/WebRevalidationService.java`, `bigbike-web/app/api/revalidate/route.ts`, `application.properties:64-65`, `docker-compose.yaml:86-87, 138-139` |
| Internal redirect lookup | Web proxy.ts → backend `/api/internal/redirect`. | Internal cross-service | `CONFIRMED_FROM_CODE` | `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/internal/InternalRedirectController.java`, `bigbike-web/proxy.ts` |
| WordPress migration | One-shot ETL từ legacy WordPress (SQL dump + uploads). | Internal tooling | `CONFIRMED_FROM_CODE` (disabled by default; dry-run) | `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/migration/wordpress/**`, `application.properties:32-43`, `bigbike-web/scripts/extract-wp-data/` |
| ETL MariaDB (one-off) | Sidecar MariaDB to ingest WP SQL dump. | Internal tooling | `CONFIRMED_FROM_CODE` | `bigbike-web/scripts/extract-wp-data/docker-compose.etl.yml`, `package.json` etl scripts |
| Rate limiting (Bucket4j) | In-process per-IP rate limit cho sensitive endpoints. | Internal | `CONFIRMED_FROM_CODE` | `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/config/RateLimitingFilter.java`, `pom.xml:122-126` |
| Logstash Logback JSON | Structured JSON logging (prod profile). | Internal | `DEPENDENCY_ONLY` (dependency present; encoder mapping chưa audit trong file này) | `pom.xml:128-133`, `application-prod.properties:9-13` |
| Spring Actuator (health, info, metrics, prometheus) | Health + ops metrics. | Internal | `CONFIRMED_FROM_CODE` | `application.properties:71-73`, `application-prod.properties:19-23`, `pom.xml:33-36` |
| SePay (Vietnamese bank-transfer / VietQR) | Removed from active system. | Historical reference only | `NOT_FOUND_IN_REPO` (V59 removes the schema/config artifacts; no live controller/service code in repo) | Historical DB migrations only; no active OpenAPI/DTO contract |
| Other payment providers (VNPay, Momo, Stripe, PayPal…) | Online payment auto-update. | External provider | `NOT_FOUND_IN_REPO` | No controller/service/webhook found |
| Shipping carrier API (GHN, GHTK, J&T…) | Auto waybill / tracking. | External provider | `NOT_FOUND_IN_REPO` | `AdminShippingController` chỉ quản lý nội bộ zones/methods/cost |
| Sentry (errors / performance / replays) | Frontend error tracking. | External SaaS | `CONFIG_ONLY` (init code + env var hooks; runtime depends on DSN env) | `bigbike-web/sentry.client.config.ts`, `sentry.server.config.ts`, `instrumentation.ts`, `next.config.ts:393-408`, `package.json:20`, `docker-compose.yaml:144-148` |
| Google Tag Manager / GA4 | Marketing analytics. | External SaaS | `CONFIG_ONLY` (env hook + CSP allowance; runtime depends on `NEXT_PUBLIC_GTM_ID`) | `docker-compose.yaml:142`, `.env.example:44-49`, `next.config.ts:368, 372` |
| YouTube thumbnail (img.youtube.com) | Hiển thị thumbnail cho HomeVideoCarousel. | External (GET only) | `CONFIRMED_FROM_CODE` (Next.js `images.remotePatterns`) | `bigbike-web/next.config.ts:189-192` |
| Redis / Kafka / RabbitMQ / queue / distributed cache | None. | — | `NOT_FOUND_IN_REPO` | Confirmed in `docs/engineering/ARCHITECTURE.md:429`, no Spring/JS dep, no docker-compose service |
| Search engine (Elasticsearch, Algolia, Meilisearch) | Full-text search. | — | `NOT_FOUND_IN_REPO` (search dùng SQL trong backend) | `PublicSearchController` (SQL-backed) |
| Docker Compose runtime | Local/staging orchestration. | Internal | `CONFIRMED_FROM_CODE` | `docker-compose.yaml` |

## 4. PostgreSQL Integration

**Purpose**: Primary OLTP store cho toàn bộ business data (catalog, orders, customers, returns, payments, audit, sliders, content, settings, RBAC, redirects, media metadata).

**Status**: `CONFIRMED_FROM_CODE`.

**Backend dependencies**:

- `org.springframework.boot:spring-boot-starter-data-jpa` ([pom.xml:39](bigbike-backend/pom.xml)).
- `org.postgresql:postgresql` runtime driver.
- HikariCP (transitively via Spring Boot starter).

**Config keys (no values)**:

| Key | Source | Notes |
|---|---|---|
| `spring.datasource.url` ← `BIGBIKE_DB_URL` | [application.properties:3](bigbike-backend/src/main/resources/application.properties), [docker-compose.yaml:69](docker-compose.yaml) | JDBC URL. |
| `spring.datasource.username` ← `BIGBIKE_DB_USERNAME` (or `POSTGRES_USER`) | [application.properties:4](bigbike-backend/src/main/resources/application.properties), [docker-compose.yaml:70](docker-compose.yaml) | DB user. |
| `spring.datasource.password` ← `BIGBIKE_DB_PASSWORD` (or `POSTGRES_PASSWORD`) | [application.properties:5](bigbike-backend/src/main/resources/application.properties), [docker-compose.yaml:71](docker-compose.yaml) | Required at deploy time. |
| `spring.jpa.hibernate.ddl-auto=validate` | [application.properties:8](bigbike-backend/src/main/resources/application.properties) | Schema migrations only via Flyway, never auto-DDL. |
| `spring.datasource.hikari.*` | [application-prod.properties:25-30](bigbike-backend/src/main/resources/application-prod.properties) | Pool tuning prod (max 20). |
| `POSTGRES_DB` / `POSTGRES_USER` / `POSTGRES_PASSWORD` | [docker-compose.yaml:8-10](docker-compose.yaml) | Postgres container env. |

**Service**: `postgres` (image `postgres:16-alpine`) in [docker-compose.yaml:3-24](docker-compose.yaml).

- Port: `127.0.0.1:5432:5432` (host loopback only).
- Volume: `postgres_data:/var/lib/postgresql/data`.
- Memory limit: 512m.
- Healthcheck: `pg_isready -U $POSTGRES_USER -d $POSTGRES_DB`.

**Migration tool**: Flyway.

- `spring.flyway.enabled=true` ([application.properties:11](bigbike-backend/src/main/resources/application.properties)).
- `spring.flyway.locations=classpath:db/migration` (prod), plus `classpath:db/migration-dev` in dev profile ([application-dev.properties:1](bigbike-backend/src/main/resources/application-dev.properties)).
- `spring.flyway.out-of-order=true` in dev only.
- Migrations live at [bigbike-backend/src/main/resources/db/migration/](bigbike-backend/src/main/resources/db/migration/) (V1…V47 audited).
- `flyway-database-postgresql` dep ([pom.xml:96-98](bigbike-backend/pom.xml)).

**Verification checklist**:

- [ ] Postgres container healthy (`pg_isready`).
- [ ] Backend boots without `ddl-auto=validate` mismatch.
- [ ] Latest Flyway version applied (compare `flyway_schema_history` against `db/migration` files).
- [ ] HikariCP pool size matches expected load.
- [ ] Backups configured (out-of-scope for this doc; see `DEPLOYMENT_GUIDE.md`).

## 5. MinIO / Media Storage Integration

**Purpose**: S3-compatible object storage cho admin media upload và WordPress migration media copy.

**Status**: `CONFIRMED_FROM_CODE`.

**Dependencies**:

- `io.minio:minio:8.5.17` ([pom.xml:114-119](bigbike-backend/pom.xml)).

**Config keys**:

| Key | Source | Notes |
|---|---|---|
| `bigbike.minio.endpoint` ← `MINIO_ENDPOINT` | [application.properties:26](bigbike-backend/src/main/resources/application.properties) | Internal docker URL `http://minio:9000`. |
| `bigbike.minio.access-key` ← `MINIO_ROOT_USER` | [application.properties:27](bigbike-backend/src/main/resources/application.properties) | Auth. |
| `bigbike.minio.secret-key` ← `MINIO_ROOT_PASSWORD` | [application.properties:28](bigbike-backend/src/main/resources/application.properties) | Auth — required env. |
| `bigbike.minio.bucket` ← `MINIO_BUCKET` | [application.properties:29](bigbike-backend/src/main/resources/application.properties) | Default `bigbike-media`. |
| `bigbike.media.public-base-url` ← `BIGBIKE_MEDIA_PUBLIC_BASE_URL` | [application.properties:46](bigbike-backend/src/main/resources/application.properties) | Public base used by admin write paths. |
| `BIGBIKE_LEGACY_UPLOADS_BASE` | [bigbike-web/.env.example:24-29](bigbike-web/.env.example), [next.config.ts:113-120](bigbike-web/next.config.ts) | Browser-facing media origin baked into CSP. |
| `BIGBIKE_MEDIA_INTERNAL_URL` | [bigbike-web/.env.example:30-36](bigbike-web/.env.example), [next.config.ts:121-128](bigbike-web/next.config.ts) | Server-side rewrite destination (internal Docker hostname). |
| `BIGBIKE_MEDIA_BUCKET_URL` | [bigbike-web/.env.example:38-42](bigbike-web/.env.example), [next.config.ts:130-139](bigbike-web/next.config.ts) | Bucket root URL used by `/media/*` rewrite. |
| `spring.servlet.multipart.max-file-size=52MB`, `max-request-size=55MB` | [application.properties:68-69](bigbike-backend/src/main/resources/application.properties) | Multipart limits. |

**Service**: `minio` (image `minio/minio:RELEASE.2025-04-22T22-12-26Z`) in [docker-compose.yaml:26-48](docker-compose.yaml).

- Ports: `127.0.0.1:9000:9000` (S3 API), `127.0.0.1:9001:9001` (admin console).
- Volume: `minio_data:/data`.
- Healthcheck: `curl http://localhost:9000/minio/health/live`.

**Boot-time bucket bootstrap**: [MinioConfig.java:30-52](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/config/MinioConfig.java) — `MinioStartupInitializer` runs `BucketExistsArgs` and `MakeBucketArgs` post-construct.

**Upload flow** ([AdminMediaService.uploadMedia](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminMediaService.java)):

1. POST multipart `/api/v1/admin/media` (admin auth required, see `PERMISSION_MATRIX.md` `media.write`).
2. MIME validation against allowlist: `image/jpeg, image/png, image/webp, image/gif, image/svg+xml, video/mp4, audio/{mpeg,ogg,wav,webm,aac}` ([AdminMediaService.java:45-48](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminMediaService.java)).
3. Size check ≤ 50 MB.
4. Filename sanitization (regex `[^a-zA-Z0-9._-]` → `_`, lowercase, max 200 chars).
5. Object key: `uploads/{uuid}/{safeFilename}`.
6. `minioClient.putObject(bucket, objectKey, stream, size, contentType)`.
7. Width/height extracted via `ImageIO.read` for raster (jpeg/png/gif).
8. Persist `MediaEntity` with `filePath`, `publicUrl=/media/{objectKey}`, `storageProvider="MINIO"`.
9. Audit log: `MEDIA_UPLOADED`.

**Public URL behavior**:

- Stored URL is **relative** (`/media/uploads/{uuid}/{file}`); browser hits Next.js, `next.config.ts` rewrites `/media/:path*` → `${BIGBIKE_MEDIA_BUCKET_URL}/:path*` ([next.config.ts:266](bigbike-web/next.config.ts)).
- Legacy WP uploads served via `/wp-content/uploads/:path*` rewrite ([next.config.ts:267-270](bigbike-web/next.config.ts)).

**Hard delete** ([AdminMediaService.hardDeleteMedia](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminMediaService.java)): `minioClient.removeObject(bucket, filePath)` — failure logs warn, does not throw (best-effort).

**Security / file validation**:

- MIME allowlist enforced server-side ([AdminMediaService.java:81-84](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminMediaService.java)).
- 50 MB hard limit before object storage write.
- Filename sanitized; original name kept as `title`.
- `media.write` permission required (see `PERMISSION_MATRIX.md`).
- CSP `img-src` restricted to `BIGBIKE_LEGACY_UPLOADS_BASE` origin + `'self'` ([next.config.ts:370](bigbike-web/next.config.ts)).

**Verification checklist**:

- [ ] MinIO container healthy.
- [ ] Bucket `bigbike-media` exists (auto-created on backend start).
- [ ] Upload returns relative `/media/...` URL — never absolute internal `minio:9000`.
- [ ] `/wp-content/uploads/...` and `/media/...` Next.js rewrites resolve.
- [ ] Browser CSP allows `BIGBIKE_LEGACY_UPLOADS_BASE` origin.
- [ ] CDN setup (production) is NOT in repo — verify externally.

## 6. Email / SMTP Integration

**Purpose**: Transactional email cho order lifecycle, return lifecycle, customer auth (verify, password reset, password change alert), admin notifications, contact form.

**Status**: `CONFIRMED_FROM_CODE`. Runtime delivery: `RUNTIME_NOT_VERIFIED` (no SMTP host configured by default; senders log + skip when `mailSender` bean is empty).

**Dependencies**:

- `spring-boot-starter-mail` ([pom.xml:46-48](bigbike-backend/pom.xml)).
- `spring-boot-starter-thymeleaf` ([pom.xml:80-82](bigbike-backend/pom.xml)) for HTML rendering.
- `spring-boot-starter-mail-test` test dep ([pom.xml:172-176](bigbike-backend/pom.xml)).

**Config keys**:

| Key | Source | Notes |
|---|---|---|
| `spring.mail.host` ← `BIGBIKE_MAIL_HOST` | [application.properties:50](bigbike-backend/src/main/resources/application.properties) | Empty disables sending. |
| `spring.mail.port` ← `BIGBIKE_MAIL_PORT` | default 587 | |
| `spring.mail.username` ← `BIGBIKE_MAIL_USERNAME` | | Auth user. |
| `spring.mail.password` ← `BIGBIKE_MAIL_PASSWORD` | | App password / SMTP secret. |
| `spring.mail.properties.mail.smtp.auth` ← `BIGBIKE_MAIL_SMTP_AUTH` | default `true` | |
| `spring.mail.properties.mail.smtp.starttls.enable` ← `BIGBIKE_MAIL_STARTTLS` | default `true` | |
| `bigbike.mail.from` ← `BIGBIKE_MAIL_FROM` | default `no-reply@bigbike.vn` | |
| `bigbike.mail.admin` ← `BIGBIKE_MAIL_ADMIN` | default `info@bigbike.vn` | Admin notification recipient. |
| `bigbike.mail.verify-base-url` ← `BIGBIKE_MAIL_VERIFY_BASE_URL` | | Email verification deeplink. |
| `bigbike.mail.reset-base-url` ← `BIGBIKE_MAIL_RESET_BASE_URL` | | Password reset deeplink. |
| `bigbike.site.base-url` ← `BIGBIKE_SITE_BASE_URL` | | Order detail deeplink. |
| `bigbike.admin.base-url` ← `BIGBIKE_ADMIN_BASE_URL` | | Admin order detail deeplink. |
| `management.health.mail.enabled=false` (dev) | [application-dev.properties:3](bigbike-backend/src/main/resources/application-dev.properties) | Avoid actuator failing on missing SMTP. |

**Central dispatcher** ([EmailDispatchService.java](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/email/EmailDispatchService.java)):

- Ctor takes `Optional<JavaMailSender>`; when bean missing, `isEnabled()` returns false and `send(...)` no-ops with INFO log.
- Renders Thymeleaf template at `email/{templateName}` and sends as MIME `text/html` with UTF-8.
- Optional reply-to.
- Errors caught and logged at WARN; **no retry, no DLQ**.

**Templates** ([bigbike-backend/src/main/resources/templates/email/](bigbike-backend/src/main/resources/templates/email/)):

| Template | Purpose |
|---|---|
| `layout.html` | Shared layout. |
| `order-confirmation.html` | Customer: đơn đã đặt. |
| `order-status-update.html` | Customer: cập nhật trạng thái (PROCESSING, COMPLETED, CANCELLED, REFUNDED, FAILED). |
| `admin-new-order.html` | Admin: đơn mới. |
| `email-verification.html` | Customer: xác minh email. |
| `password-reset.html` | Customer: link reset mật khẩu. |
| `password-change-alert.html` | Customer: cảnh báo đã đổi mật khẩu. |
| `contact-admin.html` | Admin: form contact. |
| `return-received.html` | Return: yêu cầu đã nhận. |
| `return-approved.html` | Return: được duyệt. |
| `return-rejected.html` | Return: bị từ chối. |
| `return-refunded.html` | Return: đã hoàn tiền. |
| `return-goods-received.html` | Return: đã nhận hàng. |

**Notification senders**:

- [OrderNotificationService.java](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/checkout/OrderNotificationService.java): order confirmation, status updates, admin new-order. Uses `@Async` — không block transaction. Statuses notify customer: `PROCESSING, COMPLETED, CANCELLED, REFUNDED, FAILED` (`OrderNotificationService.CUSTOMER_NOTIFIABLE_STATUSES`).
- [EmailVerificationService.java](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/customer/EmailVerificationService.java): customer auth verify.
- Other senders for password reset / password-change-alert / contact / return events live alongside relevant services (not enumerated here exhaustively).

**Delivery / retry / failure handling**:

- No retry queue. `EmailDispatchService` catches Exception, logs WARN, returns.
- `@Async` on order notifications — caller tx not rolled back if email fails.
- No DLQ / outbox table observed.
- → `NEEDS_VERIFICATION` for production resilience guarantees; consider transactional outbox if business requires guaranteed delivery.

**Verification checklist**:

- [ ] `BIGBIKE_MAIL_HOST` set in target env (else senders silently skip).
- [ ] SMTP credentials valid; STARTTLS reachable on port 587.
- [ ] `bigbike.mail.from` matches authenticated sender; SPF/DKIM aligned (out-of-repo).
- [ ] Verify-email link uses `BIGBIKE_MAIL_VERIFY_BASE_URL` and resolves to `/xac-nhan-email` Next route.
- [ ] Reset-password link uses `BIGBIKE_MAIL_RESET_BASE_URL` and resolves to `/quen-mat-khau` Next route.
- [ ] Order status change triggers email per `CUSTOMER_NOTIFIABLE_STATUSES`.

## 7. WebSocket / Realtime Integration

**Purpose**: Push real-time order events (new order, status change) to admin SPA.

**Status**: `CONFIRMED_FROM_CODE`.

**Dependencies**:

- `spring-boot-starter-websocket` ([pom.xml:91-94](bigbike-backend/pom.xml)).
- Frontend uses native `WebSocket` + minimal STOMP frame parser ([bigbike-admin/src/lib/adminWebSocket.js](bigbike-admin/src/lib/adminWebSocket.js)).

**Endpoint**: `/ws` (STOMP-over-WebSocket).

**Broker**: in-memory Simple broker (`enableSimpleBroker("/topic")`), application prefix `/app` ([WebSocketConfig.java:45-48](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/config/WebSocketConfig.java)).

**Topics**:

| Topic | Producer | Consumer |
|---|---|---|
| `/topic/admin/orders` | [AdminOrderWsService.pushEvent](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/ws/AdminOrderWsService.java) | Admin SPA via `subscribeAdminWs("/topic/admin/orders", handler)` |

**Auth (STOMP CONNECT interceptor)** ([WebSocketConfig.java:56-91](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/config/WebSocketConfig.java)):

1. Read `Authorization: Bearer <jwt>` native header on `CONNECT` frame.
2. Reject if missing/malformed → `IllegalArgumentException("Admin JWT required to connect.")`.
3. Parse JWT via `JwtService.parseAccessToken`.
4. Reject if role not `ADMIN`/`SUPER_ADMIN`.
5. Reject on `JwtException` (expired/invalid).

**CORS**: `allowedOrigins` from `bigbike.cors.allowed-origins` ([WebSocketConfig.java:35](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/config/WebSocketConfig.java)).

**Transactional safety** ([AdminOrderWsService.java:25-35](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/ws/AdminOrderWsService.java)): if a tx is active, push is registered in `afterCommit` hook so admin clients refetching see consistent DB state.

**Frontend client**:

- Singleton `connectAdminWs(tokenGetter)` / `disconnectAdminWs()` in [bigbike-admin/src/lib/adminWebSocket.js](bigbike-admin/src/lib/adminWebSocket.js).
- Auto-reconnect after 4s on close.
- Re-subscribes all destinations after reconnect with stable subId.
- Connected from `App.jsx` when `authState.status === 'authenticated'` ([App.jsx:234-238](bigbike-admin/src/App.jsx)).

**Security**:

- Endpoint `permitAll` at HTTP layer ([SecurityConfig.java:99-100](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/config/SecurityConfig.java)) — auth enforced in STOMP interceptor.
- Heartbeats currently `0,0` (frontend) — no application-level keepalive; relies on TCP/proxy.

**Verification checklist**:

- [ ] Reverse proxy (nginx) supports WebSocket upgrade for `/ws`.
- [ ] CORS `bigbike.cors.allowed-origins` includes admin origin (e.g. `https://admin.bigbike.vn`).
- [ ] `CONNECT` rejects when no `Authorization` header.
- [ ] `CONNECT` rejects non-admin JWT.
- [ ] Order admin events pushed only after DB tx commit.
- [ ] Token refresh path: closed connection reconnects with fresh token.

## 8. Redis / Cache Integration

**Status**: `NOT_FOUND_IN_REPO`.

**Evidence**:

- No Redis dependency in [bigbike-backend/pom.xml](bigbike-backend/pom.xml).
- No `redis` / `Redis` reference under `bigbike-backend/src/main/`.
- No Redis container in [docker-compose.yaml](docker-compose.yaml).
- No `ioredis` / `redis` package in [bigbike-web/package.json](bigbike-web/package.json).
- `docs/engineering/ARCHITECTURE.md:429` explicitly states `Redis/cache/queue: NOT_FOUND_IN_REPO`.

**What is used instead**:

- **In-process L1 cache for redirect lookup** in Next.js proxy: Map of `path → {value, expiresAt}` capped at 10 000 entries, TTL `BIGBIKE_REDIRECT_CACHE_TTL_SECONDS` (default 300 s). [proxy.ts:13-40](bigbike-web/proxy.ts).
- **In-process Bucket4j rate limiter** keyed by IP (no shared store across replicas). [RateLimitingFilter.java](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/config/RateLimitingFilter.java).
- **Next.js ISR / `revalidateTag`** for page cache (in-process per node).

**Implication**:

- Multi-replica scale-out has independent caches and rate-limit buckets — `NEEDS_VERIFICATION` if production targets >1 replica.

**Verification checklist**:

- [ ] If running >1 backend replica, verify rate-limit semantics are acceptable per-replica.
- [ ] If running >1 web replica, verify proxy redirect cache and ISR cache divergence is acceptable.
- [ ] Document decision (intentional no-Redis architecture vs future plan).

## 9. Payment Integration

### 9.1 Internal payment methods

**COD / BACS / CASH / CARD_TERMINAL**: `CONFIRMED_FROM_CODE`. Order entity has `payment_method` column ([V46__add_order_channel_and_payment_method.sql](bigbike-backend/src/main/resources/db/migration/V46__add_order_channel_and_payment_method.sql)). POS supports `CASH` / `CARD_TERMINAL` only after SePay cleanup. Status update flow per `STATE_MACHINES.md`.

### 9.2 Removed SePay/VietQR integration

SePay/VietQR-specific artifacts were removed from the active system:

- DB schema seeds and reconciliation tables from V44–V47 are no longer part of the deployed model.
- `payment_sepay.*` settings are removed from `site_settings`.
- The `qrVietQrUrl`-driven payment page and related polling flow were deleted from the web app.
- OpenAPI and DTO contracts no longer expose SePay-specific QR fields.

### 9.3 Other payment providers

| Provider | Status | Evidence |
|---|---|---|
| VNPay | `NOT_FOUND_IN_REPO` | grep negative |
| Momo / MoMo | `NOT_FOUND_IN_REPO` | grep negative |
| ZaloPay | `NOT_FOUND_IN_REPO` | grep negative |
| Stripe | `NOT_FOUND_IN_REPO` | grep negative |
| PayPal | `NOT_FOUND_IN_REPO` | grep negative |

### 9.4 Required (when any payment provider is added)

- Webhook signature verification (HMAC / RSA) before persistence.
- Audit log of every webhook event (raw payload).
- Replay protection (timestamp window).
- Network ACL: webhook URL on private path or IP allowlisted.
- Retry-on-our-side guard: webhook handler must be idempotent (no duplicate stock decrement).

## 10. Shipping Provider Integration

### 10.1 Internal shipping

**Status**: `CONFIRMED_FROM_CODE` — internal zones / methods / cost only.

**Modules**:

- `AdminShippingController` (`/api/v1/admin/shipping/zones[/{id}/methods]`) — see `PERMISSION_MATRIX.md` Section 7.5.
- Order shipping snapshot stored alongside order.

### 10.2 External carrier API

**Status**: `NOT_FOUND_IN_REPO`.

**Evidence**:

- Grep for `GHN`, `GHTK` returned no Java code.
- No carrier SDK in [pom.xml](bigbike-backend/pom.xml).
- `docs/business/USER_ROLES.md:55-56, 308-314` confirms "Shipping Provider: NOT_FOUND_IN_REPO".
- Shipping data is internal config (zones + flat method/cost) — no waybill/tracking integration.

**Implication**: All shipping fulfilment, tracking, label printing is currently manual / out-of-repo.

## 11. Analytics / Monitoring / Observability

### 11.1 Sentry (Next.js — bigbike-web)

**Status**: `CONFIG_ONLY` — code paths fully wired; runtime gated on DSN env vars.

**Evidence**:

- Dependency `@sentry/nextjs ^10.50.0` ([package.json:20](bigbike-web/package.json)).
- [bigbike-web/sentry.client.config.ts](bigbike-web/sentry.client.config.ts): `Sentry.init({ dsn: NEXT_PUBLIC_SENTRY_DSN, environment: NODE_ENV, tracesSampleRate, replayIntegration({maskAllText: true}), enabled: Boolean(NEXT_PUBLIC_SENTRY_DSN) })`.
- [bigbike-web/sentry.server.config.ts](bigbike-web/sentry.server.config.ts): server-side `Sentry.init` with `SENTRY_DSN ?? NEXT_PUBLIC_SENTRY_DSN`.
- [bigbike-web/sentry.edge.config.ts](bigbike-web/sentry.edge.config.ts): edge runtime init (file referenced in instrumentation.ts).
- [bigbike-web/instrumentation.ts](bigbike-web/instrumentation.ts): `register()` dispatches by `NEXT_RUNTIME`; exports `onRequestError` calling `captureRequestError`.
- [bigbike-web/next.config.ts:393-408](bigbike-web/next.config.ts): `withSentryConfig` wrapper for source-map upload at build time; goes into `dryRun` when no DSN.

**Env keys**:

- `SENTRY_DSN` — server-side.
- `NEXT_PUBLIC_SENTRY_DSN` — client-side.
- `SENTRY_AUTH_TOKEN` — source map upload.
- `SENTRY_ORG`, `SENTRY_PROJECT` — source map target.

Listed in [docker-compose.yaml:144-148](docker-compose.yaml).

**Sample rates**:

- `tracesSampleRate`: 0.1 prod / 1.0 dev.
- `replaysSessionSampleRate`: 0.01.
- `replaysOnErrorSampleRate`: 1.0.
- Replay `maskAllText: true`, `blockAllMedia: false`.

### 11.2 Google Tag Manager / GA4

**Status**: `CONFIG_ONLY`.

**Evidence**:

- `NEXT_PUBLIC_GTM_ID` env key in [.env.example:44-49](bigbike-web/.env.example) and [docker-compose.yaml:142](docker-compose.yaml).
- CSP allows GTM script + GA endpoint ([next.config.ts:368, 372](bigbike-web/next.config.ts)).
- Production container hint: `GTM-5BKZL3K` (in `.env.example` as documentation; not committed in `.env.local`).
- `.env.example` warns staging must use a separate container or empty value.

**Runtime injection**: not traced in this audit (likely in `app/layout.tsx` or a `<Script>` component); `NEEDS_VERIFICATION` for exact placement.

### 11.3 Backend logging / observability

| Aspect | Status | Evidence |
|---|---|---|
| Spring Actuator: `health`, `info` (dev/default) | `CONFIRMED_FROM_CODE` | [application.properties:71-73](bigbike-backend/src/main/resources/application.properties) |
| Spring Actuator: `health, info, metrics, prometheus` (prod), `show-details=never` | `CONFIRMED_FROM_CODE` | [application-prod.properties:19-23](bigbike-backend/src/main/resources/application-prod.properties) |
| Health endpoint exposed publicly via `permitAll` for k8s/Docker | `CONFIRMED_FROM_CODE` | [SecurityConfig.java:117](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/config/SecurityConfig.java) |
| Docker healthcheck for backend | `CONFIRMED_FROM_CODE` | [docker-compose.yaml:99-104](docker-compose.yaml) |
| Logstash JSON encoder dependency | `DEPENDENCY_ONLY` | [pom.xml:128-133](bigbike-backend/pom.xml); explicit `logback-spring.xml` not audited here |
| Structured prod logging levels (root=WARN, com.bigbike=INFO) | `CONFIRMED_FROM_CODE` | [application-prod.properties:9-13](bigbike-backend/src/main/resources/application-prod.properties) |
| Prometheus scrape endpoint | `CONFIG_ONLY` (exposed; no scrape config in repo) | [application-prod.properties:23](bigbike-backend/src/main/resources/application-prod.properties) |

### 11.4 Frontend logging

- `pino` + `pino-pretty` in [bigbike-web/package.json:29, 50](bigbike-web/package.json) — `DEPENDENCY_ONLY` until logger usage is audited.

### 11.5 Missing

- Centralized log aggregator (Loki/ELK/CloudWatch): `NOT_FOUND_IN_REPO` — referenced in comment but no shipper/agent in compose.
- APM / tracing: `NOT_FOUND_IN_REPO` (no OpenTelemetry / Jaeger / Zipkin).
- Uptime monitoring (Pingdom/UptimeRobot/etc.): `NOT_FOUND_IN_REPO`.

## 12. WordPress Migration / Redirect Integration

### 12.1 Migration tooling

**Purpose**: One-shot ETL từ legacy `kd_*`-prefixed WordPress site.

**Status**: `CONFIRMED_FROM_CODE`. Disabled by default; dry-run by default.

**Properties** ([WordPressMigrationProperties.java](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/migration/wordpress/config/WordPressMigrationProperties.java)):

| Key | Default | Notes |
|---|---|---|
| `bigbike.migration.wordpress.enabled` | `false` | Master switch. |
| `bigbike.migration.wordpress.sql-dump-path` / `dump-path` | `""` | Path to WP SQL dump. |
| `bigbike.migration.wordpress.uploads-path` | `""` | Path to wp-content/uploads. |
| `bigbike.migration.wordpress.table-prefix` | `kd_` | bigbike.vn dump prefix (not default `wp_`). |
| `bigbike.migration.wordpress.dry-run` | `true` | Default safe. |
| `bigbike.migration.wordpress.mode` | `""` | `catalog-dry-run`, `customer-order-coupon-dry-run`, `import`, … |
| `bigbike.migration.wordpress.confirm-execute` | `false` | Required true for real import. |
| `bigbike.migration.wordpress.environment` | `""` | Must be `local` or `staging` to allow real import. |
| `bigbike.migration.wordpress.domains` | `""` | Comma-separated subset (e.g. `categories,brands,media,products`). |
| `bigbike.migration.wordpress.batch-size` | `500` | |
| `bigbike.migration.wordpress.minio-endpoint` | `""` | Phase 2E media copy. |
| `bigbike.migration.wordpress.minio-access-key` | `""` | |
| `bigbike.migration.wordpress.minio-secret-key` | `""` | |
| `bigbike.migration.wordpress.minio-bucket` | `""` | |

**Modules** under [bigbike-backend/src/main/java/com/bigbike/bigbike_backend/migration/wordpress/](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/migration/wordpress/):

- `parser/`: SQL dump readers (`WordPressInsertParser`, `WordPressSqlDumpRowReader`, `PhpSerializeParser`, `WordPressTableRow`).
- `model/`: `WpPost`, `WpPostMeta`, `WpUser`, `WpTerm`, `WpOrderItem`, `WpFgRedirect`, etc.
- `mapper/`: domain mappers for product, category, brand, page, article, customer, order, coupon, menu, redirect, media, admin user, review.
- `importer/`: `ProductImporter`, `CategoryImporter`, `BrandImporter`, `MediaImporter`, `OrderImporter`, `RedirectImporter`, etc., plus `DomainImporter`, `MigrationExecutionOptions`/`Report`.
- `media/`: `MediaCopyService`, `MediaCopyRunner`, `MinioMediaStorageAdapter`, `MediaPathResolver`, `MediaChecksumService`.
- `redirect/`: `RankMathRedirectImporter` (RankMath SEO plugin), `FgRedirectAnalyzer`, `FgRedirectResolver`, `LegacyUrlMapper`, `RedirectResolverService`.
- `runner/`: `WordPressMigrationImportRunner`, `WordPressCatalogContentDryRunRunner`, `WordPressCustomerOrderCouponDryRunRunner`, `WordPressMigrationWritePlanRunner`.
- `writeplan/`: `MigrationWritePlan`, `MigrationWriteOperation`, `MigrationConflictStrategy`, `MigrationDomain`.
- `service/`: `WordPressMappingPlanService`, `WordPressCatalogContentDryRunService`, `WordPressCustomerOrderCouponDryRunService`.

**ETL helper (Next.js side)**: [bigbike-web/scripts/extract-wp-data/](bigbike-web/scripts/extract-wp-data/) hosts a sidecar MariaDB (`docker-compose.etl.yml`) ingesting `bigbike_vn__2026_04_17/sqldump.sql` and a TypeScript extractor.

- ETL env keys: `ETL_DB_NAME`, `ETL_DB_USER`, `ETL_DB_PASSWORD`, `ETL_DB_ROOT_PASSWORD`.
- Dependencies: `mysql2 ^3` (devDep in [bigbike-web/package.json:49](bigbike-web/package.json)).
- npm scripts: `etl:start`, `etl:run`, `etl:load-sliders`, `etl:stop`.
- Helper script auth env keys: `BIGBIKE_ADMIN_TOKEN`, `BIGBIKE_ADMIN_EMAIL`, `BIGBIKE_ADMIN_PASSWORD`.

### 12.2 Redirect resolver (runtime)

**Purpose**: Serve legacy WP URL → canonical Next.js URL via DB-backed redirect rules + 3-tier cache.

**Status**: `CONFIRMED_FROM_CODE`.

**Backend endpoints** ([InternalRedirectController.java](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/internal/InternalRedirectController.java)):

| Method / Path | Purpose | Auth |
|---|---|---|
| GET `/api/internal/redirect?path=...` | Single exact-match lookup. | None (HTTP-level). Must be locked at infra. |
| GET `/api/internal/redirects/active` | Bulk dump of all active redirects. | None. |
| POST `/api/internal/redirects/hit/{redirectId}` | Fire-and-forget hit counter. | None. |

**Web client** ([bigbike-web/proxy.ts](bigbike-web/proxy.ts)):

- Calls backend with 2 s `AbortSignal.timeout`.
- L1 in-process cache: `Map<path, {value, expiresAt}>` capped at 10 000 entries, TTL `BIGBIKE_REDIRECT_CACHE_TTL_SECONDS` (default 300 s).
- Falls back to passthrough on backend error.
- Tries deslashed variant for Next.js trailing-slash quirk.

**Next.js redirect/rewrite rules**:

- Build-time CSV at `bigbike-web/docs/legacy/SEO_REDIRECT_MAP.csv` parsed in [next.config.ts:14, 25-110](bigbike-web/next.config.ts) → emit Next `redirects` (active rows) and `headers` (noindex rows).
- Hard-coded category renames + sitemap consolidation in `next.config.ts redirects()`.
- `afterFiles` rewrites for `.html` → trailing-slash routes.

**Security**:

- Internal redirect endpoints are `permitAll` at HTTP layer ([SecurityConfig.java:92-96](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/config/SecurityConfig.java)) — comment explicitly says "lock down at infra layer (private network / IP allowlist) for prod". → `HIGH_RISK` if exposed publicly.

**Verification checklist**:

- [ ] Migration `enabled=false` in production unless explicit cutover.
- [ ] `confirm-execute=true` only for explicit run; `environment` whitelisted.
- [ ] Redirect endpoints not reachable from public internet (infra ACL).
- [ ] `BIGBIKE_REDIRECT_CACHE_TTL_SECONDS` reflects business tolerance for stale redirects after admin edit.
- [ ] CSV `SEO_REDIRECT_MAP.csv` is reviewed before each deploy (build-time bake).

## 13. Docker / Runtime Integration

**File**: [docker-compose.yaml](docker-compose.yaml).

**Network**: `bigbike-dev` (single bridge).

**Services**:

| Service | Image | Ports (host:container) | Volumes | Healthcheck | Memory | Status |
|---|---|---|---|---|---|---|
| `postgres` | `postgres:16-alpine` | `127.0.0.1:5432:5432` | `postgres_data:/var/lib/postgresql/data` | `pg_isready` | 512m | `CONFIRMED_FROM_CODE` |
| `minio` | `minio/minio:RELEASE.2025-04-22T22-12-26Z` | `127.0.0.1:9000:9000`, `127.0.0.1:9001:9001` | `minio_data:/data` | `curl /minio/health/live` | 512m | `CONFIRMED_FROM_CODE` |
| `bigbike-backend` | built from `./bigbike-backend/Dockerfile` | `127.0.0.1:8080:8080` | — | `wget /actuator/health` | 768m | `CONFIRMED_FROM_CODE` |
| `bigbike-web` | built from `./bigbike-web/Dockerfile` | `3000:3000` | — | `wget /` | 512m | `CONFIRMED_FROM_CODE` |
| `bigbike-admin` | built from `./bigbike-admin/Dockerfile` | `4000:80` (nginx proxies `/api/*` to backend) | — | `wget /` | 128m | `CONFIRMED_FROM_CODE` |
| `bigbike-web-init` | `curlimages/curl:8.11.1` | — | — | one-shot revalidate POST | 32m | `CONFIRMED_FROM_CODE` |

**depends_on chain**:

- `bigbike-backend` ← `postgres` (healthy) + `minio` (healthy).
- `bigbike-web` ← `bigbike-backend` (healthy).
- `bigbike-admin` ← `bigbike-backend` (healthy).
- `bigbike-web-init` ← `bigbike-web` (healthy).

**Backend env (compose)**: `SPRING_PROFILES_ACTIVE`, `BIGBIKE_DB_*`, `BIGBIKE_JWT_SECRET`, `MINIO_*`, `MINIO_BUCKET`, `CORS_ALLOWED_ORIGINS`, `BIGBIKE_SITE_BASE_URL`, `BIGBIKE_ADMIN_BASE_URL`, `BIGBIKE_MEDIA_PUBLIC_BASE_URL`, `WEB_REVALIDATE_URL`, `WEB_REVALIDATE_SECRET`, `BIGBIKE_MAIL_*`. Required (compose fails fast if missing): `POSTGRES_PASSWORD`, `BIGBIKE_JWT_SECRET`, `MINIO_ROOT_PASSWORD`, `BIGBIKE_CORS_ALLOWED_ORIGINS`.

**Web env (compose)**: `BIGBIKE_API_BASE_URL`, `NEXT_PUBLIC_API_BASE_URL`, `BIGBIKE_SITE_URL`, `NEXT_PUBLIC_SITE_URL`, `BIGBIKE_DISABLE_DEV_FALLBACK`, `REVALIDATE_SECRET`, `BIGBIKE_REDIRECT_CACHE_TTL_SECONDS`, `NEXT_PUBLIC_GTM_ID`, `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`. Build args: `BIGBIKE_LEGACY_UPLOADS_BASE`, `BIGBIKE_MEDIA_INTERNAL_URL`, `NEXT_PUBLIC_API_BASE_URL`, `NEXT_PUBLIC_SITE_URL`.

**Admin env (compose build args)**: `VITE_ADMIN_API_BASE=/api/v1` (relative, nginx proxied), `VITE_USE_ADMIN_MOCK=false`, `VITE_ADMIN_ROLE=ADMIN`.

**Notes**:

- Postgres + MinIO ports bound to `127.0.0.1` only (loopback). Admin SPA + Web exposed on host; production reverse proxy expected.
- Compose uses `${VAR:?error}` fail-fast for required secrets.
- `bigbike-web-init` performs one-shot ISR purge for `products,sliders,categories,articles,brands,settings,menus,pages` after web is healthy.

**Verification checklist**:

- [ ] All `${VAR:?...}` required secrets supplied in deploy environment.
- [ ] `127.0.0.1` host binding for Postgres/MinIO is intentional in target env.
- [ ] Reverse proxy (nginx, Caddy, Traefik — out-of-repo) terminates TLS and forwards to internal services.
- [ ] WebSocket upgrade allowed at proxy.
- [ ] `WEB_REVALIDATE_SECRET` matches between backend env and `bigbike-web` `REVALIDATE_SECRET`.

## 14. Integration Security Requirements

| Requirement | Status | Notes |
|---|---|---|
| No secret in repo or docs | `CONFIRMED` for repo-tracked files; `.env.local` is gitignored per [.env.example](bigbike-web/.env.example) | Never commit real DSN, password, JWT secret, API keys. |
| All required secrets fail-fast at boot | `CONFIRMED_FROM_CODE` | `${VAR:?msg}` in [docker-compose.yaml](docker-compose.yaml) for `POSTGRES_PASSWORD`, `BIGBIKE_JWT_SECRET`, `MINIO_ROOT_PASSWORD`, `BIGBIKE_CORS_ALLOWED_ORIGINS`. |
| Webhooks must verify signature | `NEEDS_VERIFICATION` | When a provider webhook is added, it must HMAC-verify the provider secret before processing. |
| Webhooks must be idempotent | `NEEDS_VERIFICATION` | Application-level dedupe should be implemented with provider transaction id or equivalent. |
| Upload validates type / size / content | `CONFIRMED_FROM_CODE` | [AdminMediaService.java:79-88](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminMediaService.java) MIME allowlist + 50 MB cap. |
| Public settings must not expose secrets | `CONFIRMED_FROM_CODE` | Public settings remain limited to non-secret keys; SePay settings were removed. |
| External APIs need timeout / retry / error handling | Partially | `WebRevalidationService` uses 3 s connect / 5 s read timeout, no retry, error logged ([WebRevalidationService.java:35-78](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/web/WebRevalidationService.java)). `EmailDispatchService` has no retry. `proxy.ts` redirect lookup has 2 s timeout, no retry. |
| Per-IP rate limit | `CONFIRMED_FROM_CODE` | Bucket4j on login/register/refresh/contact/cart/checkout/lookup/search ([RateLimitingFilter.java](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/config/RateLimitingFilter.java)). |
| CORS allowlist required at deploy | `CONFIRMED_FROM_CODE` | `BIGBIKE_CORS_ALLOWED_ORIGINS` is required (`?:` in compose). |
| Cookie `Secure` defaulted true; dev override | `CONFIRMED_FROM_CODE` | `bigbike.cookies.secure=true` default, `false` only in dev profile. |
| HTTPS / HSTS at frontend | `CONFIRMED_FROM_CODE` | [next.config.ts:360-362](bigbike-web/next.config.ts) HSTS preload. |
| CSP set at Next.js | `CONFIRMED_FROM_CODE` | [next.config.ts:364-378](bigbike-web/next.config.ts). |
| Internal endpoints (`/api/internal/**`) not public | `NEEDS_VERIFICATION` (depends on infra ACL) | Comment in [SecurityConfig.java:93-94](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/config/SecurityConfig.java) demands infra-layer lock. → `HIGH_RISK` if production exposes publicly. |
| WebSocket auth at STOMP CONNECT | `CONFIRMED_FROM_CODE` | JWT + role check ([WebSocketConfig.java:56-91](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/config/WebSocketConfig.java)). |

## 15. Integration Test Requirements

| Integration | Required Tests | Current Evidence | Status |
|---|---|---|---|
| PostgreSQL | Schema validate against latest Flyway migration; H2 + Flyway in test scope. | `spring-boot-starter-data-jpa-test`, `spring-boot-starter-flyway-test`, H2 ([pom.xml:163-170](bigbike-backend/pom.xml)); test seed at `src/test/resources/db/test-seed.sql`. | `CONFIRMED_FROM_CODE` (presence); coverage `NEEDS_VERIFICATION`. |
| MinIO | Upload happy path; reject oversize; reject disallowed MIME; soft delete; restore; hard delete. | Tests not enumerated in this audit. | `NEEDS_VERIFICATION`. |
| Email / SMTP | Template renders with required variables; no-mailSender path no-ops; admin notify uses `BIGBIKE_MAIL_ADMIN`. | `spring-boot-starter-mail-test` dep. | `NEEDS_VERIFICATION`. |
| WebSocket | CONNECT rejects without JWT; rejects non-admin; pushes `/topic/admin/orders` after tx commit. | `spring-boot-starter-websocket-test` dep ([pom.xml:193-196](bigbike-backend/pom.xml)). | `NEEDS_VERIFICATION`. |
| Web revalidation | Backend sends with secret header; web `route.ts` returns 401 on mismatch; tags purged. | Test exists: `WebRevalidationServiceTest` ([bigbike-backend/src/test/java/com/bigbike/bigbike_backend/service/web/WebRevalidationServiceTest.java](bigbike-backend/src/test/java/com/bigbike/bigbike_backend/service/web/WebRevalidationServiceTest.java)). | `CONFIRMED_FROM_CODE` (presence). |
| Internal redirect | Lookup returns 404 when no match; bulk list returns active only; hit increments. | Not enumerated. | `NEEDS_VERIFICATION`. |
| WordPress migration | Dry-run produces report without DB writes; `confirm-execute=false` blocks real import; `environment` whitelist enforced. | Multiple `*MapperTest` etc. exist; full coverage `NEEDS_VERIFICATION`. | Partial. |
| Rate limiting | 5/min login, 3/min register, etc. | Not enumerated. | `NEEDS_VERIFICATION`. |
| SePay webhook | Removed from active system. | No handler in repo. | `NOT_FOUND_IN_REPO`. |
| Sentry | DSN absent → no init; DSN present → events captured. | `enabled: Boolean(...)` guard in init configs. | `CONFIG_ONLY`. |
| GTM | Empty `NEXT_PUBLIC_GTM_ID` → no script injection. | Runtime injection not traced. | `NEEDS_VERIFICATION`. |

## 16. Missing / Not Confirmed Integrations

| Integration | Status | Gap | Risk |
|---|---|---|---|
| SePay webhook handler | `NOT_FOUND_IN_REPO` | No `SepayWebhookController` / `PaymentReconciliationService`; SePay artifacts have been removed from the active system. | Low — historical only. |
| Online VietQR generation endpoint | `NOT_FOUND_IN_REPO` | The standalone QR payment page was removed. | Low — historical only. |
| Other payment providers | `NOT_FOUND_IN_REPO` | No VNPay/Momo/ZaloPay/Stripe/PayPal. | None unless business plans expansion. |
| Shipping carrier API | `NOT_FOUND_IN_REPO` | No GHN/GHTK/J&T integration. Internal zones/methods/cost only. | Medium — manual fulfilment workflow. |
| Distributed cache (Redis) | `NOT_FOUND_IN_REPO` | All caches are in-process. | Medium — only relevant when scaling >1 replica. |
| Message queue / event bus | `NOT_FOUND_IN_REPO` | No Kafka/RabbitMQ/SQS. Email and WS are in-process `@Async`. | Low while traffic small; medium for delivery guarantees. |
| Outbox / DLQ for email | `NOT_FOUND_IN_REPO` | `EmailDispatchService` swallows exceptions and logs WARN. | Medium — silent email loss possible. |
| Centralized log shipper | `NOT_FOUND_IN_REPO` | `logstash-logback-encoder` dep present; no Promtail/Filebeat agent in compose. | Low for dev; medium for prod debugging. |
| APM / tracing | `NOT_FOUND_IN_REPO` | No OpenTelemetry / Jaeger / Zipkin. | Low for dev; medium for prod. |
| Search engine | `NOT_FOUND_IN_REPO` | SQL-based search. | Low until catalog growth. |
| Production `/api/internal/**` ACL | `NEEDS_VERIFICATION` | Comment in code; no infrastructure config in repo. | High if exposed publicly. |
| Production admin auth (real JWT path enforcement) | `NEEDS_VERIFICATION` | `DevAdminAuthService` still serves dev/mock auth. See `PERMISSION_MATRIX.md` Section 11. | High for production deploy. |
| WebSocket scale-out | `NEEDS_VERIFICATION` | In-memory `SimpleBroker`; no `BrokerRelay` (RabbitMQ/ActiveMQ). | Medium when scaling >1 replica. |
| Pino logger usage on web | `DEPENDENCY_ONLY` | Dependency in package.json; usage not traced. | Low. |

## 17. Evidence Summary

| Integration | Evidence Path | What It Proves | Confidence |
|---|---|---|---|
| PostgreSQL + Flyway | [bigbike-backend/src/main/resources/application.properties](bigbike-backend/src/main/resources/application.properties), [docker-compose.yaml](docker-compose.yaml), [bigbike-backend/pom.xml](bigbike-backend/pom.xml), [bigbike-backend/src/main/resources/db/migration/](bigbike-backend/src/main/resources/db/migration/) | DB driver, migrations location, Hikari tuning, container config. | High |
| MinIO | [bigbike-backend/src/main/java/com/bigbike/bigbike_backend/config/MinioConfig.java](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/config/MinioConfig.java), [MinioProperties.java](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/config/MinioProperties.java), [bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminMediaService.java](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminMediaService.java), [docker-compose.yaml](docker-compose.yaml) | Bucket bootstrap, upload/delete flow, validation, container config. | High |
| Email / SMTP | [bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/email/EmailDispatchService.java](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/email/EmailDispatchService.java), [OrderNotificationService.java](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/checkout/OrderNotificationService.java), 14 templates in [bigbike-backend/src/main/resources/templates/email/](bigbike-backend/src/main/resources/templates/email/) | Dispatcher with graceful disable; specific senders; templates for all flows. | High |
| WebSocket / STOMP | [bigbike-backend/src/main/java/com/bigbike/bigbike_backend/config/WebSocketConfig.java](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/config/WebSocketConfig.java), [bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/ws/AdminOrderWsService.java](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/ws/AdminOrderWsService.java), [bigbike-admin/src/lib/adminWebSocket.js](bigbike-admin/src/lib/adminWebSocket.js) | Endpoint `/ws`, JWT CONNECT auth, broker, transactional push. | High |
| Web revalidation | [bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/web/WebRevalidationService.java](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/web/WebRevalidationService.java), [bigbike-web/app/api/revalidate/route.ts](bigbike-web/app/api/revalidate/route.ts), [docker-compose.yaml](docker-compose.yaml) | Backend → web cache purge with shared secret; secret-header gate. | High |
| Internal redirect | [bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/internal/InternalRedirectController.java](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/internal/InternalRedirectController.java), [bigbike-web/proxy.ts](bigbike-web/proxy.ts) | Lookup endpoint, L1 cache, timeout, hit counter. | High |
| WordPress migration | [bigbike-backend/src/main/java/com/bigbike/bigbike_backend/migration/wordpress/](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/migration/wordpress/), [bigbike-web/scripts/extract-wp-data/](bigbike-web/scripts/extract-wp-data/) | Importers, mappers, dump readers, runners, media copy via MinIO; ETL sidecar MariaDB. | High |
| SePay payment | Removed from active system. | Historical V44-V47 migrations only. | Low |
| Sentry | [bigbike-web/sentry.client.config.ts](bigbike-web/sentry.client.config.ts), [sentry.server.config.ts](bigbike-web/sentry.server.config.ts), [instrumentation.ts](bigbike-web/instrumentation.ts), [next.config.ts](bigbike-web/next.config.ts), [package.json](bigbike-web/package.json) | Init, DSN env hooks, source-map upload via `withSentryConfig`. | High for setup; runtime depends on DSN |
| Google Tag Manager | [bigbike-web/.env.example](bigbike-web/.env.example), [bigbike-web/next.config.ts](bigbike-web/next.config.ts) (CSP), [docker-compose.yaml](docker-compose.yaml) | Env hook + CSP allowance; runtime placement not traced. | Medium |
| Rate limiting | [bigbike-backend/src/main/java/com/bigbike/bigbike_backend/config/RateLimitingFilter.java](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/config/RateLimitingFilter.java) | Per-IP bucket policies. | High |
| Docker Compose | [docker-compose.yaml](docker-compose.yaml) | All service definitions, healthchecks, dependencies. | High |
| Architecture context | [docs/engineering/ARCHITECTURE.md](docs/engineering/ARCHITECTURE.md), [docs/business/USER_ROLES.md](docs/business/USER_ROLES.md) | Existing audit confirming no Redis/Kafka/Carrier/Payment-provider. | High |

## 18. Relationship With Other Docs

| Document | Relationship |
|---|---|
| [docs/engineering/ARCHITECTURE.md](docs/engineering/ARCHITECTURE.md) | Tổng quan component / actor / runtime. INTEGRATION_GUIDE chi tiết hoá phần "external/internal services" của Architecture. |
| [docs/engineering/PERMISSION_MATRIX.md](docs/engineering/PERMISSION_MATRIX.md) | RBAC cho admin/customer endpoint. Một số integration (media upload, web revalidate, redirect) có permission/secret riêng đã liệt kê chéo ở đây. |
| `DEPLOYMENT_GUIDE.md` | (Chưa có) — sẽ chứa môi trường thực tế (DNS, TLS, reverse proxy, secret store). INTEGRATION_GUIDE liệt kê env keys nhưng không cung cấp value. |
| `TESTING_GUIDE.md` | (Chưa có) — Section 15 ở đây là input. |
| `API_FLOW_MAP.md` | (Chưa có) — sẽ vẽ end-to-end gọi từng integration. |
| [docs/engineering/DATA_CONTRACT.md](docs/engineering/DATA_CONTRACT.md) | Data shape cho payment, order, media…; chéo với SePay schema, media entity. |
| [docs/business/BUSINESS_RULES.md](docs/business/BUSINESS_RULES.md) | Quy tắc nghiệp vụ (timeout SePay, CSAT email…); INTEGRATION_GUIDE giải thích kênh kỹ thuật. |
| [docs/business/STATE_MACHINES.md](docs/business/STATE_MACHINES.md) | Order/return state transitions; nhiều transitions trigger email + WS push. |

## Audit Notes

Chỉ đọc/inspect repo. Không sửa code. Không refactor. Không deploy. Không tạo migration. Không ghi secret/token/password/private key/env value.

Audited evidence date: 2026-05-04.

Phạm vi audit:

- [docker-compose.yaml](docker-compose.yaml).
- [bigbike-backend/pom.xml](bigbike-backend/pom.xml).
- [bigbike-backend/src/main/resources/application.properties](bigbike-backend/src/main/resources/application.properties), `application-prod.properties`, `application-dev.properties`, `application-mock.properties`.
- [bigbike-backend/src/main/java/.../config/SecurityConfig.java](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/config/SecurityConfig.java), `MinioConfig.java`, `MinioProperties.java`, `WebSocketConfig.java`, `RateLimitingFilter.java`.
- [bigbike-backend/src/main/java/.../service/admin/AdminMediaService.java](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminMediaService.java).
- [bigbike-backend/src/main/java/.../service/email/EmailDispatchService.java](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/email/EmailDispatchService.java) + email templates.
- [bigbike-backend/src/main/java/.../service/checkout/OrderNotificationService.java](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/checkout/OrderNotificationService.java).
- [bigbike-backend/src/main/java/.../service/ws/AdminOrderWsService.java](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/ws/AdminOrderWsService.java).
- [bigbike-backend/src/main/java/.../service/web/WebRevalidationService.java](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/web/WebRevalidationService.java).
- [bigbike-backend/src/main/java/.../api/internal/InternalRedirectController.java](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/internal/InternalRedirectController.java).
- [bigbike-backend/src/main/java/.../migration/wordpress/](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/migration/wordpress/) and `WordPressMigrationProperties.java`.
- [bigbike-backend/src/main/resources/db/migration/V44…V47](bigbike-backend/src/main/resources/db/migration/) (SePay schema).
- [bigbike-backend/src/main/resources/openapi/bigbike-openapi.json](bigbike-backend/src/main/resources/openapi/bigbike-openapi.json) (PosOrderResponse).
- [bigbike-web/.env.example](bigbike-web/.env.example), [bigbike-web/next.config.ts](bigbike-web/next.config.ts), [bigbike-web/proxy.ts](bigbike-web/proxy.ts), [bigbike-web/instrumentation.ts](bigbike-web/instrumentation.ts), `sentry.*.config.ts`, [bigbike-web/app/api/revalidate/route.ts](bigbike-web/app/api/revalidate/route.ts), [bigbike-web/app/don-hang/[id]/thanh-toan/page.tsx](bigbike-web/app/don-hang/[id]/thanh-toan/page.tsx), [bigbike-web/scripts/extract-wp-data/docker-compose.etl.yml](bigbike-web/scripts/extract-wp-data/docker-compose.etl.yml).
- [bigbike-admin/src/lib/adminWebSocket.js](bigbike-admin/src/lib/adminWebSocket.js).

Out-of-scope cho file này:

- Production reverse proxy (nginx) config.
- Backup / restore scripts.
- CI/CD pipelines.
- Test suites (presence noted in Section 15; coverage not enumerated).
- Mobile app integrations (`bigbike_mobile`).
- Sentry source-map upload runtime in CI.
- Logback custom encoder XML (if any).
- nginx config of `bigbike-admin` container.
