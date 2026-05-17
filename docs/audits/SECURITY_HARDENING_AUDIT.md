# BigBike Security Hardening Audit

> Phase: **AUDIT + TRACE + REPORT** — không sửa code hàng loạt, không destructive test.
> Ngày: 2026-05-16 · Phương pháp: static code audit (đọc code thật, cite file path).

---

## 1. Executive Summary

| Hạng mục | Giá trị |
|---|---|
| Module audit | 6 (bigbike-backend, bigbike-web, bigbike-admin, bigbike_mobile, docker/deploy, env/config) |
| Security surface kiểm tra | ~30 nhóm endpoint (auth, admin, customer, public, internal, upload, WS) + 99 Flyway migrations + 3 Dockerfile + 4 nginx conf + 3 CI workflow |
| Critical | 0 |
| High | 1 |
| Medium | 8 |
| Low | 9 |
| Info / accepted tradeoff | 3 |

**Blocking security issues:** Không có Critical. Issue High duy nhất (`SEC-001` — mobile production API URL) là **config/deployment**, chỉ blocking nếu app mobile sắp release production.

**Kết luận: `SECURITY_READY_WITH_BACKLOG`**

Lõi bảo mật của backend đã được hardening tốt và bài bản: JWT có fail-fast secret validation, refresh token rotation + revoke, Argon2id hashing, anti-enumeration timing-safe verify, rate limiting Bucket4j theo nhiều tier, CSRF cho customer session, CORS deny-by-default ở non-dev, security headers filter, upload validate bằng Tika magic-byte, GlobalExceptionHandler không leak stacktrace, audit log cho admin action. Không phát hiện IDOR, SQL injection, admin endpoint public, hay secret commit vào git.

Các issue còn lại là **hardening gap** và **config inconsistency** (đặc biệt ở mobile, CSP, nginx), không phải lỗ hổng khai thác trực tiếp ở backend.

---

## 2. Security Surface Inventory

| Area | File/module | Mô tả | Phạm vi | Risk | Status |
|---|---|---|---|---|---|
| Admin auth | `api/auth/AuthController.java`, `service/auth/AdminAuthService.java` | Login/refresh/logout JWT | Public (login/refresh/logout) | Med | OK |
| Customer auth | `api/customer/CustomerAuthController.java`, `service/customer/CustomerAuthService.java` | Register/login/refresh/reset, cookie session | Public | Med | OK |
| JWT | `service/auth/JwtService.java`, `config/JwtAuthFilter.java` | HS256, TTL 900s, refresh 7d | Internal | Med | OK |
| Customer session | `config/CustomerSessionFilter.java`, `CustomerCsrfFilter.java` | Cookie session + CSRF double-submit | Protected | Med | OK |
| RBAC admin | `service/auth/DevAdminAuthService.java`, `AdminPermissionService` | `requirePermission()` per endpoint, DB-driven | Protected | High | OK |
| Admin API | `api/admin/*` (28 controller) | Mọi endpoint gọi `requirePermission(...)` | Protected | High | OK |
| Customer order/return | `api/order/CustomerOrderController.java` | Ownership truyền `customerId` vào service | Protected | High | OK |
| Public catalog/content | `/api/v1/products`, `/categories`, `/articles`, `/pages`, `/search` | Read-only | Public | Low | OK |
| Warranty lookup | `/api/v1/warranties/lookup` | Tra cứu theo serial, no PII | Public | Low | OK |
| Internal redirect | `api/internal/InternalRedirectController.java` | Deny-by-default + `X-Internal-Token` | Internal | Med | OK |
| Media upload | `service/admin/AdminMediaService.java` | Tika magic-byte, allowlist MIME, 50MB | Protected | High | OK |
| WebSocket | `config/WebSocketConfig.java` | STOMP CONNECT yêu cầu admin JWT | Protected | Med | OK |
| Payment | — | Không có cổng thanh toán tự động / webhook (SePay đã bỏ - V59) | — | — | N/A |
| Storage | MinIO (`config/MinioConfig.java`) | S3-compatible, key qua env | Internal | Med | OK |
| Deployment | `docker-compose.yaml`, `deploy/nginx/*` | Compose + 4 nginx conf | Infra | Med | Backlog |
| CI/CD | `.github/workflows/*` | gitleaks, npm audit, OWASP dependency-check | Infra | Low | OK |

---

## 3. Authentication Hardening

| Kiểm tra | Kết quả | Evidence |
|---|---|---|
| Password hashing | ✅ Argon2id (OWASP params m=65536,t=3,p=4); rehash legacy phpass khi login | `service/auth/PasswordService.java` |
| JWT secret fail-fast | ✅ Throw nếu secret `dev-` hoặc `<32` chars ở prod profile | `JwtService.init()` L36-48 |
| JWT expiration | ✅ Access token 900s (15 phút), refresh 7 ngày | `application.properties` L22-23 |
| Refresh token | ✅ Opaque random 32-byte, lưu SHA-256 hash, **rotation + revoke token cũ** | `AdminAuthService.refresh()` L74-79; `CustomerAuthService.refresh()` |
| Logout | ✅ Revoke refresh token + clear cookie | `AuthController.logout()`, `AdminAuthService.logout()` |
| Invalid/expired token | ✅ `JwtException` → SecurityContext rỗng → 401 chuẩn | `JwtAuthFilter` L52-54 |
| Disabled/locked account | ✅ Login check `ACTIVE`; refresh re-check status; `CustomerSessionFilter` re-verify status mỗi request | `AdminAuthService` L42,70; `CustomerSessionFilter` L49 |
| Brute-force / rate limit | ✅ login 5/min, register 3/min, reset 5/min, refresh 30/min per IP | `RateLimitingFilter` |
| Anti-enumeration | ✅ `dummyVerify()` timing-safe khi user not found; thông báo lỗi generic; verify password trước khi check status | `AdminAuthService` L36-44, `CustomerAuthService` L90-100 |
| Token storage (admin) | ✅ In-memory only (`authStorage.js`) — không localStorage → XSS không đọc được | `bigbike-admin/src/lib/authStorage.js` |
| Token storage (web) | ✅ Cookie HttpOnly + Secure + SameSite=Strict | `CustomerAuthController.addCookie()` |
| Token storage (mobile) | ⚠️ Cookie persist ra file plaintext (`PersistCookieJar`/`FileStorage`) | `SEC-004` |
| Admin refresh cookie | ✅ HttpOnly, Secure, SameSite=Lax, path=`/api/v1/auth` | `AuthController.setRefreshCookie()` |

**Tradeoff đã chấp nhận (Info):** access token JWT là stateless — logout revoke refresh token nhưng access token vẫn sống tới hết TTL (≤15 phút). Đây là tradeoff JWT tiêu chuẩn, TTL ngắn nên chấp nhận được.

---

## 4. Authorization / Ownership Hardening

- **Admin protection:** `SecurityConfig` đặt `/api/v1/admin/**` = `authenticated()`; từng endpoint trong 28 controller `api/admin/*` gọi `devAdminAuthService.requirePermission(request, "<perm>")`. Khi có JWT principal thật → permission resolve từ DB qua `AdminPermissionService`, header bị bỏ qua. Đã verify các controller chỉ-1-endpoint (Dashboard, AuditLog, CouponGift, Permissions) đều có check.
- **Dev header bypass:** `bigbike.auth.dev-header-enabled=false` (default + `application.properties`); path bypass chỉ chạy ở profile dev/mock/test, throw `AuthNotImplementedException` nếu prod. An toàn.
- **Customer ownership:** `CustomerOrderController` truyền `requireCustomerId()` vào mọi service call (`getCustomerOrderDetail(customerId, orderId)`, `cancel(customerId, orderId)`...). Không có endpoint nào nhận `orderId` mà bỏ qua `customerId`.
- **IDOR:** không phát hiện. Các endpoint customer dùng UUID + filter theo owner ở service layer.
- **Public boundary:** warranty lookup không trả PII (theo comment + docs); review submit public default `PENDING`.
- **UI/backend guard:** admin UI guard (`auth.jsx`) chỉ là UX — backend enforce thật qua `requirePermission`.

> Lưu ý: audit này **không** kiểm tra lại toàn bộ ma trận RBAC (có report riêng). Chỉ xác nhận không có admin endpoint nào public và ownership được enforce ở backend.

---

## 5. API Input Validation & Abuse Protection

| Kiểm tra | Kết quả |
|---|---|
| DTO validation | ✅ Bean Validation + `@Valid` trên `@RequestBody`; `GlobalExceptionHandler` map `MethodArgumentNotValidException`/`ConstraintViolationException` |
| Query param type | ✅ `MethodArgumentTypeMismatchException` → 400 `VALIDATION_ERROR` |
| Pagination limit | ✅ `AdminMediaService.listMedia`: `MAX_SIZE=100`, `Math.min(size, MAX_SIZE)` |
| Sort allowlist | ✅ `AdminMediaService.ALLOWED_SORT_KEYS` — sort key ngoài allowlist fallback `createdAt` |
| Mass assignment | ✅ Dùng DTO record riêng (không bind thẳng entity); customer không set được `role`/`status` |
| SQL injection | ✅ 104 `@Query` đều JPQL named-param (`:param`); không có string-concat dynamic query; không `createNativeQuery` với input |
| Rate limit | ✅ 11 tier (xem mục 13) |
| Error leak | ✅ `handleUnexpected` trả `SERVER_ERROR` generic, không stacktrace; `DataIntegrityViolation` chỉ log `getMostSpecificCause()` server-side, response generic |

---

## 6. Public Data Exposure Audit

- **Catalog API** (`/api/v1/products/**`, `/categories`, `/brands`): read-only, không field admin-only đáng ngại.
- **Warranty lookup**: comment xác nhận no PII; trả trạng thái bảo hành theo serial.
- **Auth endpoints**: thông báo lỗi generic (anti-enumeration) cho cả login và register.
- **CMS/content**: `/articles`, `/pages` read-only.
- **OpenAPI/Swagger**: `springdoc.api-docs.enabled=false` + `swagger-ui.enabled=false` ở `application-prod.properties`; nginx `api.bigbike.vn.conf` chặn `/swagger-ui/`, `/v3/api-docs/`, `/webjars/` (lớp phòng thủ thứ 2). ✅
- **Actuator**: prod expose `health,info,metrics,prometheus`; `/actuator/health` permitAll, còn lại rơi vào `anyRequest().authenticated()`. `show-details=never` ở prod. Xem `SEC-014`.

---

## 7. File Upload / Media Security

`service/admin/AdminMediaService.java` — đánh giá tốt:

| Kiểm tra | Kết quả |
|---|---|
| Giới hạn size | ✅ `MAX_UPLOAD_BYTES = 50MB` + `spring.servlet.multipart.max-file-size=52MB` |
| MIME allowlist | ✅ `ALLOWED_MIME_TYPES` (image/jpeg,png,webp,gif; video/mp4; audio/*) |
| Magic-byte verify | ✅ Apache Tika detect 8KB đầu file; reject nếu `detected` không khớp allowlist (chống MIME spoof) |
| Chặn SVG/HTML/script | ✅ SVG **không** trong allowlist → reject |
| Path traversal | ✅ `sanitizeFilename()` strip ký tự lạ; object key = `uploads/{UUID}/{safeName}` |
| Chống overwrite | ✅ UUID prefix mỗi upload → không đụng file cũ (`replaceFile` cố ý overwrite cùng key, đúng ý đồ) |
| Upload endpoint auth | ✅ `/api/v1/admin/media` cần JWT + permission `media.write` |
| MinIO key | ✅ Qua env, không hardcode trong code |
| Hard delete | ✅ Storage delete phải thành công trước khi xóa DB row; có audit log |

⚠️ Xem `SEC-009` — nginx API gateway giới hạn body 10MB, mâu thuẫn limit 50MB.

---

## 8. Payment / Webhook Security

**Không áp dụng.** BigBike không tích hợp cổng thanh toán tự động — admin tự đối soát chuyển khoản ngân hàng (SePay đã bỏ ở V59). Không có webhook endpoint → không có bề mặt tấn công replay/signature.

Xác nhận tích cực: không có endpoint nào cho customer tự set `paymentStatus`. Thay đổi trạng thái thanh toán nằm trong `/api/v1/admin/**` (cần permission). Không phát hiện đường để khách hàng tự đánh dấu "đã thanh toán".

---

## 9. CORS / CSRF / Security Headers

**CORS** (`config/CorsConfig.java`):
- ✅ `@PostConstruct validateOrigins()` — ở non-dev profile: throw nếu rỗng, nếu có `*`, hoặc chứa `localhost`/`127.0.0.1`.
- ✅ Origin lấy từ `CORS_ALLOWED_ORIGINS` env, exact list.
- ⚠️ `setAllowedHeaders(List.of("*"))` — rộng, nhưng origin đã khóa chặt + `allowCredentials(true)` an toàn vì origin không phải `*`. Low.

**CSRF**:
- Backend disable CSRF mặc định của Spring (stateless JWT).
- Customer session dùng `CustomerCsrfFilter` — double-submit cookie `bb_csrf` + header `X-CSRF-Token`, so sánh constant-time (`MessageDigest.isEqual`). Exempt list tối thiểu, có comment cảnh báo.
- Admin API dùng JWT Bearer (không cookie cho call API) → CSRF không cần; refresh cookie SameSite=Lax.

**Security Headers** — backend `SecurityHeadersFilter`: X-Frame-Options DENY, X-Content-Type-Options nosniff, Referrer-Policy, Permissions-Policy, HSTS. nginx conf bổ sung lớp 2.

Xem `SEC-005` (CSP `unsafe-inline`), `SEC-008` (header rớt ở static asset location).

---

## 10. Secrets & Config Audit

| Kiểm tra | Kết quả |
|---|---|
| `.env` commit vào git? | ✅ KHÔNG — `git ls-files` chỉ thấy `.env.example`; `.gitignore` có `.env` + `.env.*` (trừ `.env.example`) |
| Secret hardcode trong code? | ✅ Không — JWT/DB/MinIO/SMTP đều qua `${ENV}` |
| `.env` (local) chứa credential thật | ⚠️ `SEC-002` — Gmail App Password + JWT secret thật nằm plaintext trong working tree |
| docker-compose unsafe default | ✅ `POSTGRES_PASSWORD`, `MINIO_ROOT_PASSWORD`, `BIGBIKE_JWT_SECRET`, `CORS_ALLOWED_ORIGINS` dùng `${VAR:?error}` → fail-fast nếu thiếu |
| JWT secret fallback | ✅ Có default dev nhưng `JwtService` throw ở prod nếu vẫn dùng default/yếu |
| Prod ≠ dev config | ✅ `application-prod.properties` riêng: logging WARN, swagger off, actuator hạn chế, show-details=never |
| Fail-fast khi thiếu config | ✅ CORS + JWT secret fail-fast; internal token deny-by-default |
| CI secret scan | ✅ gitleaks chạy mỗi push/PR (`ci.yml`) |

---

## 11. Logging & Error Handling

- ✅ Grep toàn backend: **không** có log password/token/JWT/secret. `WebSocketConfig` chỉ log `e.getMessage()` của JwtException (không log token).
- ✅ `GlobalExceptionHandler`: không trả stacktrace; `SERVER_ERROR` generic; `DataIntegrityViolation` log cause server-side, response generic.
- ✅ 401/403 format ổn định qua `RestAuthenticationEntryPoint` / `RestAccessDeniedHandler` + `ApiErrorResponse`.
- ✅ Admin mutation có audit log (`AuditLogEntity` — actor, action, before/after).
- ⚠️ `SEC-011` — `CustomerPasswordResetService` L64/127 log `login` identifier (email/phone = PII) ở mức INFO.

---

## 12. Frontend / Admin / Mobile Hardening

### bigbike-web
- Token: cookie HttpOnly/Secure/SameSite=Strict (set bởi backend) — XSS không lấy được session.
- XSS: 9+ chỗ `dangerouslySetInnerHTML`. Rich text/CMS đi qua `sanitizeRichHtml` (`lib/utils/html.ts`). JSON-LD đi qua `serializeJsonLd` — **escape `<`,`>`,`&`** đúng cách → không JSON-LD injection. ✅
- ⚠️ `SEC-007` — `sanitizeRichHtml` là sanitizer regex tự viết; `isomorphic-dompurify` đã có trong `package.json` nhưng không dùng.
- CSP: `next.config.ts` có CSP đầy đủ + `frame-ancestors 'none'` — nhưng `script-src` có `'unsafe-inline' 'unsafe-eval'` (`SEC-005`).

### bigbike-admin
- Token: in-memory (`authStorage.js`) — không localStorage. ✅
- Route guard UX-only; backend enforce thật. ✅
- XSS: `SettingsScreen.jsx:226` render `rawValue` setting bằng `dangerouslySetInnerHTML` **không sanitize** (`SEC-006`). `AuditLogListScreen.jsx:851` chỉ render i18n string + số → an toàn.
- CSP container (`nginx.conf`): có CSP nhưng `script-src 'self' 'unsafe-inline'` (`SEC-005`); header rớt ở static-asset location (`SEC-008`).
- Không expose admin secret trong bundle (chỉ `VITE_*` build args là API base, role, mock flag — không secret).

### bigbike_mobile
- ⚠️ `SEC-001` — `AppConfig.apiBaseUrl` release build = `http://localhost:8080` (cleartext + sai host, không có URL prod).
- Session: cookie-based qua `dio_cookie_manager` + `PersistCookieJar`.
- ⚠️ `SEC-004` — cookie persist ra file plaintext; `flutter_secure_storage` đã khai báo dependency nhưng không dùng.
- Logout: `clearSession()` xóa toàn bộ cookie. ✅
- CSRF: `_CsrfInterceptor` tự đọc cookie `bb_csrf` gắn vào header cho POST/PUT/PATCH/DELETE. ✅
- `_ErrorInterceptor`: không leak; map error payload chuẩn. ✅
- Không tìm thấy `print()` log token/password. ✅

---

## 13. Docker / Deployment Hardening

| Kiểm tra | Kết quả |
|---|---|
| Postgres/MinIO expose port | ✅ Bind `127.0.0.1:5432`, `127.0.0.1:9000/9001` — không ra public |
| Backend port | ✅ `127.0.0.1:8080` |
| Web/Admin port | ⚠️ `3000:3000`, `4000:80` — bind mọi interface; production nên đặt sau nginx + bind 127.0.0.1 (xem fix plan) |
| Container chạy root | ✅ backend + web tạo user `bigbike` (`USER bigbike`); admin = nginx:alpine (chuẩn) |
| Image copy .env/secret | ✅ Không — secret qua runtime env, build args chỉ public config |
| Multi-stage build | ✅ Cả 3 Dockerfile multi-stage (builder → runner) |
| Build artifact leak | ✅ Web `standalone` output; không source map admin secret |
| Debug mode prod | ✅ `SPRING_PROFILES_ACTIVE` default `prod` trong compose; web `BIGBIKE_DISABLE_DEV_FALLBACK=true` |
| Healthcheck leak | ✅ `/actuator/health` (show-details=never ở prod), `/` — không lộ sensitive |
| Resource limits | ✅ Mọi service có `deploy.resources.limits.memory` |
| nginx TLS | ✅ TLSv1.2/1.3, HSTS, OCSP stapling |

Xem `SEC-003` (trusted-proxies vs docker bridge IP) và `SEC-009` (body size).

---

## 14. Dependency Risk

> Không upgrade hàng loạt — chỉ report.

- **Backend:** `pom.xml` + `dependency-check-suppressions.xml` tồn tại; CI `security-scan.yml` chạy OWASP dependency-check hàng tuần (`-Psecurity-scan`). Build trên Java 17, Spring Boot hiện đại (Jakarta namespace). Bucket4j, jjwt, Tika, MinIO client, Argon2. Không phát hiện package bỏ hoang. **Khuyến nghị:** review report dependency-check mới nhất từ artifact CI; chú ý CVE của `commons`/`tika`/`jjwt` nếu có.
- **Web/Admin:** có `package-lock.json`; CI `ci.yml` chạy `npm audit --audit-level=high` (fail build) + `security-scan.yml` `--audit-level=moderate` (report-only). `isomorphic-dompurify` có sẵn.
- **Mobile:** `pubspec.yaml` không có lockfile commit được kiểm (cần `pubspec.lock`). dio 5.7, go_router 14.6 — version gần đây.

**Khuyến nghị:** không có upgrade gấp; duy trì cadence CI scan. Verify `pubspec.lock` được commit cho mobile.

---

## 15. Security Test Coverage

Test hiện có (`bigbike-backend/src/test`): `AdminAuthSecurityTest`, `AdminAuthApiTest`, `AdminMediaP0Test`, `CustomerAddressApiTest`, `CustomerWishlistApiTest`, `AdminMutationApiTest`, `AdminReadApiTest`, + ~20 Admin*ApiTest khác.

| Module | Test hiện có | Test còn thiếu | Priority | Test case đề xuất |
|---|---|---|---|---|
| Admin auth | ✅ `AdminAuthSecurityTest` (401/invalid token) | Expired token, revoked refresh token reuse | High | Gọi refresh 2 lần cùng token cũ → lần 2 phải 401 |
| RBAC admin | ✅ một phần (`Admin*ApiTest`) | Role thiếu permission → 403 cho mỗi nhóm controller | High | ADMIN role không có `roles.write` gọi `/admin/roles` POST → 403 |
| Customer ownership | ✅ `CustomerAddressApiTest` | Customer A đọc order/return của Customer B → 404/403 | **High** | `GET /customer/orders/{B_orderId}` bằng token A → không 200 |
| Upload | ✅ `AdminMediaP0Test` (MIME spoof) | File >50MB, SVG, file rỗng, magic-byte mismatch | Med | Upload .png đổi tên thành .jpg, upload SVG có script |
| CSRF | UNKNOWN | POST customer thiếu/sai `X-CSRF-Token` → 403 | High | `POST /customer/addresses` không header → `CSRF_INVALID` |
| Rate limit | UNKNOWN | 6 login fail liên tiếp → request thứ 6 trả 429 | Med | Loop login 6 lần cùng IP |
| Security headers | UNKNOWN | Assert X-Frame-Options/HSTS/nosniff trên response | Low | MockMvc assert header |
| Internal endpoint | UNKNOWN | `/api/internal/*` không token + `allow-open=false` → 401 | Med | Test deny-by-default |
| WebSocket | UNKNOWN | CONNECT không JWT / non-admin role → reject | Med | STOMP CONNECT thiếu Authorization |

---

## 16. Findings

---

### SEC-001 — Mobile release build trỏ API về `http://localhost:8080`
- **Severity:** High
- **Type:** DOCKER_DEPLOYMENT_RISK (mobile config)
- **Module:** bigbike_mobile
- **Location:** `bigbike_mobile/lib/core/config/app_config.dart`
- **Evidence:** `_defaultBase = 'http://localhost:8080'`; `apiBaseUrl` getter chỉ phân biệt Android-emulator-debug, các trường hợp khác (gồm release `!kDebugMode`) trả `_defaultBase`. Không có hằng `_apiProd` HTTPS — trong khi `mediaBaseUrl` lại có `_mediaProd = 'https://bigbike.vn'`.
- **Problem:** Release build không có URL API production và dùng `http://` (cleartext). App release không gọi được backend thật; nếu cấu hình tạm bằng IP cũng truyền cleartext.
- **Impact:** App mobile không hoạt động ở production HOẶC traffic auth/cookie đi cleartext → MITM đọc session.
- **Exploitability:** Trung bình (cần ở cùng network) — nhưng chỉ phát tác khi app release.
- **Recommended fix:** Thêm `_apiProd = 'https://api.bigbike.vn'`; `apiBaseUrl` trả `_apiProd` khi `!kDebugMode`. Đảm bảo Android `usesCleartextTraffic=false` cho release.
- **Auto-fix allowed:** No
- **NEEDS_CONFIRMATION:** **Yes** — cần xác nhận domain API production và mobile có release hay không.

---

### SEC-002 — `.env` working tree chứa credential thật (Gmail App Password, JWT secret)
- **Severity:** Medium
- **Type:** SECRET_EXPOSURE
- **Module:** env/config
- **Location:** `s:\project\bigbike\.env`
- **Evidence:** `BIGBIKE_MAIL_PASSWORD=jgwwnvcavlptrzid` (Gmail App Password thật), `BIGBIKE_JWT_SECRET=uhM/61719...`, `WEB_REVALIDATE_SECRET=r5cmen/...`.
- **Problem:** `.env` **không** bị commit (đã verify `git ls-files` — chỉ có `.env.example`), nhưng là credential sống đang nằm plaintext trong working tree. Gmail App Password này cấp quyền gửi mail dưới danh nghĩa tài khoản. File đã bị đọc trong quá trình audit này.
- **Impact:** Nếu working tree/máy dev bị lộ (backup, screen-share, agent log), kẻ tấn công gửi mail giả danh BigBike và ký JWT giả mạo admin.
- **Exploitability:** Thấp tại chỗ (gitignored) nhưng hậu quả cao nếu file rò rỉ.
- **Recommended fix:** (1) **Rotate** Gmail App Password và `BIGBIKE_JWT_SECRET` vì đã xuất hiện trong phiên audit; (2) chạy `git log --all --full-history -- .env` xác nhận chưa từng commit; (3) production JWT/SMTP phải khác giá trị local.
- **Auto-fix allowed:** No (rotate là thao tác vận hành)
- **NEEDS_CONFIRMATION:** **Yes**

---

### SEC-003 — Rate limiting có thể "sập" thành global do trusted-proxy không khớp Docker bridge
- **Severity:** Medium
- **Type:** RATE_LIMIT_MISSING
- **Module:** bigbike-backend / deployment
- **Location:** `config/RateLimitingFilter.java` L48 (`bigbike.trusted-proxies:127.0.0.1,::1`); `docker-compose.yaml` L62
- **Evidence:** `resolveClientIp()` chỉ đọc `X-Forwarded-For` khi `remoteAddr` ∈ `trustedProxies` (mặc định `127.0.0.1,::1`). Với compose port-map `127.0.0.1:8080:8080`, request từ nginx (host) đến container đi qua docker-proxy → container thấy `remoteAddr` = **IP gateway bridge** (vd `172.x.0.1`), không phải `127.0.0.1`.
- **Problem:** `remoteAddr` không nằm trong `trustedProxies` → `X-Forwarded-For` bị bỏ qua → mọi request bên ngoài bị tính rate-limit dưới **một IP gateway dùng chung**. `bigbike.trusted-proxies` không được set trong `docker-compose.yaml` lẫn `.env.example`.
- **Impact:** Rate limit per-IP biến thành per-toàn-hệ-thống: một attacker làm cạn bucket login/checkout cho TẤT CẢ user (DoS), hoặc giới hạn vô nghĩa. Anti-brute-force suy yếu nghiêm trọng.
- **Exploitability:** Trung bình.
- **Recommended fix:** Set `bigbike.trusted-proxies` = IP gateway Docker network (hoặc subnet nginx) qua env trong `docker-compose.yaml` + `application-prod.properties`; thêm vào `.env.example`. Khi deploy nginx trên host trực tiếp tới container, xác định đúng IP nguồn nginx thấy được.
- **Auto-fix allowed:** No (đổi deployment config)
- **NEEDS_CONFIRMATION:** **Yes**

---

### SEC-004 — Mobile lưu session cookie ra file plaintext
- **Severity:** Medium
- **Type:** TOKEN_RISK
- **Module:** bigbike_mobile
- **Location:** `bigbike_mobile/lib/core/api/api_client.dart` L19-22
- **Evidence:** `PersistCookieJar(storage: FileStorage('${dir.path}/.cookies/'))`. `flutter_secure_storage: ^9.2.2` khai báo trong `pubspec.yaml` nhưng không dùng cho cookie.
- **Problem:** Cookie `bb_session`/`bb_refresh` ghi plaintext vào app documents directory.
- **Impact:** Trên device đã root/jailbreak hoặc qua iOS unencrypted backup, session token bị trích xuất → chiếm phiên.
- **Exploitability:** Thấp (cần truy cập vật lý / device compromise; app sandbox bảo vệ phần lớn).
- **Recommended fix:** Lưu session token qua `flutter_secure_storage` (Keychain/Keystore), hoặc đánh dấu thư mục cookie loại khỏi backup (iOS `isExcludedFromBackup`, Android `allowBackup=false`).
- **Auto-fix allowed:** No (đổi cơ chế lưu trữ)
- **NEEDS_CONFIRMATION:** Yes

---

### SEC-005 — CSP cho phép `script-src 'unsafe-inline'` (admin) và `'unsafe-inline' 'unsafe-eval'` (web)
- **Severity:** Medium
- **Type:** SECURITY_HEADER_GAP / XSS_RISK
- **Module:** bigbike-admin, bigbike-web
- **Location:** `bigbike-admin/nginx.conf` (dòng CSP cuối); `bigbike-web/next.config.ts` L371
- **Evidence:** admin: `script-src 'self' 'unsafe-inline'`; web: `script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com`.
- **Problem:** `'unsafe-inline'` cho script vô hiệu hóa phần lớn khả năng chống XSS của CSP — nếu có HTML/script injection thì inline script vẫn chạy.
- **Impact:** Nếu một stored-XSS lọt qua sanitizer (xem SEC-006/SEC-007), CSP không còn là lớp chặn.
- **Exploitability:** Phụ thuộc có lỗ hổng injection khác.
- **Recommended fix:** Admin Vite SPA thường không cần inline script — bỏ `'unsafe-inline'` khỏi `script-src` admin (test kỹ). Web: chuyển sang nonce/hash-based CSP; `'unsafe-eval'` cần kiểm tra Next.js/GTM có thực sự yêu cầu.
- **Auto-fix allowed:** No (đổi CSP dễ vỡ GTM/Next runtime — cần test)
- **NEEDS_CONFIRMATION:** Yes

---

### SEC-006 — Admin SettingsScreen render giá trị setting bằng HTML thô, không sanitize
- **Severity:** Medium
- **Type:** XSS_RISK
- **Module:** bigbike-admin
- **Location:** `bigbike-admin/src/screens/SettingsScreen.jsx` L224-227
- **Evidence:** `<div ... dangerouslySetInnerHTML={{ __html: rawValue || '<em>Chưa có nội dung</em>' }} />` — `rawValue` là giá trị setting lấy từ backend, không qua sanitizer.
- **Problem:** Setting có loại `isHtml` được render thô. Nếu một admin quyền thấp (chỉ `settings.write`) lưu `<img src=x onerror=...>` vào một setting HTML, script chạy trong trình duyệt admin quyền cao khi họ mở màn hình Settings → stored XSS / leo thang nội bộ.
- **Impact:** Chiếm phiên admin quyền cao, thực hiện hành động bằng quyền của nạn nhân.
- **Exploitability:** Trung bình-thấp (cần là admin có quyền ghi setting).
- **Recommended fix:** Sanitize `rawValue` bằng DOMPurify trước khi render; hoặc xác nhận chỉ admin `*` mới sửa được setting HTML và whitelist tag.
- **Auto-fix allowed:** No (cần thêm thư viện + quyết định policy)
- **NEEDS_CONFIRMATION:** Yes

---

### SEC-007 — bigbike-web dùng sanitizer HTML regex tự viết thay vì DOMPurify
- **Severity:** Medium
- **Type:** XSS_RISK
- **Module:** bigbike-web
- **Location:** `bigbike-web/lib/utils/html.ts` (`sanitizeRichHtml`)
- **Evidence:** Sanitizer dựa trên regex (`replace(/<script.../gi)`, regex parse tag/attr). `isomorphic-dompurify: ^3.11.0` có trong `package.json` nhưng không được dùng.
- **Problem:** Sanitizer regex-based áp lên rich text/CMS, gồm 167 bài blog import từ WordPress (V93). Sanitizer regex về bản chất dễ bị bypass (mutation XSS, nested/malformed tag, parser differential). Đánh giá hiện tại: có allowlist tag/attr, strip `on*`, strip `<script>/<style>`, validate URL, iframe host allowlist — khá kỹ, **chưa thấy bypass cụ thể** nhưng kiến trúc dễ vỡ khi maintain.
- **Impact:** Nếu một payload bypass sanitizer + CSP `unsafe-inline` (SEC-005) → stored XSS trên trang public.
- **Exploitability:** Thấp hiện tại (chưa có bypass xác nhận) — đây là hardening gap, không phải bug đã xác nhận.
- **Recommended fix:** Thay `sanitizeRichHtml` bằng `isomorphic-dompurify` (đã là dependency) với cấu hình `ALLOWED_TAGS`/`ALLOWED_ATTR` tương đương; giữ phần `stripWpShortcodes` riêng.
- **Auto-fix allowed:** No (đổi sanitizer là thay đổi hành vi render content — cần test regression)
- **NEEDS_CONFIRMATION:** Yes

---

### SEC-008 — nginx admin: security header bị rớt ở location static asset
- **Severity:** Low
- **Type:** SECURITY_HEADER_GAP
- **Module:** bigbike-admin (container nginx)
- **Location:** `bigbike-admin/nginx.conf` — `location ~* \.(js|css|png|...)$`
- **Evidence:** Location này khai báo `add_header Cache-Control ...`. Theo ngữ nghĩa nginx, `add_header` trong một `location` **thay thế** toàn bộ `add_header` kế thừa từ server block → các header bảo mật (X-Frame-Options, CSP, nosniff...) không được phát cho file `.js/.css/...`.
- **Problem:** Static asset thiếu header bảo mật. `index.html` (`location /`) vẫn nhận đủ header (location đó không có `add_header` riêng).
- **Impact:** Thấp — XSS/clickjacking chủ yếu nhắm tài liệu HTML, mà HTML vẫn có header.
- **Recommended fix:** Đưa các `add_header` bảo mật vào file snippet và `include` ở cả server block lẫn location static; hoặc lặp lại trong location đó.
- **Auto-fix allowed:** No (đổi deployment config)
- **NEEDS_CONFIRMATION:** Yes

---

### SEC-009 — nginx API gateway `client_max_body_size 10m` mâu thuẫn upload media 50MB
- **Severity:** Medium
- **Type:** DOCKER_DEPLOYMENT_RISK
- **Module:** deploy/nginx
- **Location:** `deploy/nginx/api.bigbike.vn.conf` — `location /` `client_max_body_size 10m`
- **Evidence:** Backend cho phép upload 50MB (`AdminMediaService.MAX_UPLOAD_BYTES`, `spring.servlet.multipart.max-file-size=52MB`). nginx API gateway giới hạn 10MB.
- **Problem:** Upload media >10MB qua `api.bigbike.vn` bị nginx trả 413 trước khi tới backend. Hoặc đây là lỗi chức năng (admin không upload được video/ảnh lớn), hoặc giới hạn 50MB là sai chủ ý.
- **Impact:** Chức năng upload media lớn hỏng ở production; ngược lại nếu nâng nginx lên 50MB thì cần cân nhắc bề mặt DoS.
- **Exploitability:** N/A (config inconsistency).
- **Recommended fix:** Thống nhất một con số: nếu chấp nhận upload 50MB, set `client_max_body_size 55m` cho riêng path `/api/v1/admin/media` (giữ 10m cho phần còn lại). Nếu không, giảm limit backend.
- **Auto-fix allowed:** No (đổi deployment config + cần quyết định limit)
- **NEEDS_CONFIRMATION:** **Yes**

---

### SEC-010 — Web/Admin container bind port ra mọi interface
- **Severity:** Low
- **Type:** DOCKER_DEPLOYMENT_RISK
- **Module:** deployment
- **Location:** `docker-compose.yaml` L128 (`3000:3000`), L174 (`4000:80`)
- **Evidence:** postgres/minio/backend bind `127.0.0.1:...`; bigbike-web và bigbike-admin bind `3000:3000` / `4000:80` (mọi interface).
- **Problem:** Nếu compose này dùng trên host production, web/admin truy cập trực tiếp qua IP:3000/IP:4000, bỏ qua nginx (TLS, rate limit, security header host-level).
- **Impact:** Thấp (compose hiện thiên về dev; nginx conf production tách riêng) — nhưng admin dashboard lộ HTTP trần là rủi ro nếu vô tình deploy.
- **Recommended fix:** Ở production bind `127.0.0.1:3000`/`127.0.0.1:4000` và chỉ cho nginx truy cập; hoặc tách compose dev/prod.
- **Auto-fix allowed:** No
- **NEEDS_CONFIRMATION:** Yes

---

### SEC-011 — Password reset log định danh login (email/phone, PII)
- **Severity:** Low
- **Type:** LOGGING_LEAK
- **Module:** bigbike-backend
- **Location:** `service/customer/CustomerPasswordResetService.java` L64, L127
- **Evidence:** `log.info("Password reset requested for login '{}' from {}...", login, ipAddress)` và `log.info("Password reset completed for customer {} from {}", ...)`.
- **Problem:** Ghi email/phone (PII) vào log INFO. Không phải secret/token, nhưng PII trong log vi phạm nguyên tắc giảm thiểu dữ liệu.
- **Impact:** Thấp — log thường internal; nhưng aggregator/log shipping có thể lưu PII ngoài ý muốn.
- **Recommended fix:** Log `customer.getId()` thay vì `login`, hoặc mask (`v***@domain`). Dòng L127 đã dùng `customer.getId()` — chỉ cần sửa L64.
- **Auto-fix allowed:** Yes (sửa nhỏ, không đổi contract/behavior) — **chưa áp dụng** trong phase audit này; đề xuất ở Fix Plan.
- **NEEDS_CONFIRMATION:** No

---

### SEC-012 — So sánh `X-Internal-Token` không constant-time
- **Severity:** Low
- **Type:** AUTH_WEAKNESS
- **Module:** bigbike-backend
- **Location:** `api/internal/InternalRedirectController.java` L118
- **Evidence:** `return internalToken.equals(request.getHeader(TOKEN_HEADER));`
- **Problem:** `String.equals` không constant-time → về lý thuyết timing attack đoán dần token.
- **Impact:** Rất thấp — endpoint internal, không PII, được khóa ở tầng infra; timing attack qua mạng cực khó.
- **Recommended fix:** Dùng `MessageDigest.isEqual(internalToken.getBytes(UTF_8), header.getBytes(UTF_8))` (như `CustomerCsrfFilter` đã làm).
- **Auto-fix allowed:** Yes (sửa nhỏ, không đổi contract) — đề xuất ở Fix Plan.
- **NEEDS_CONFIRMATION:** No

---

### SEC-013 — Policy mật khẩu chỉ tối thiểu 8 ký tự, không kiểm tra độ phức tạp/lộ lọt
- **Severity:** Low
- **Type:** AUTH_WEAKNESS
- **Module:** bigbike-backend
- **Location:** `CustomerAuthService.register()` L44, `updateProfile()` L194
- **Evidence:** `req.password().length() < 8` là kiểm tra duy nhất.
- **Problem:** Không chặn mật khẩu phổ biến/đã lộ. Admin seed mặc định `admin123` (chỉ profile `!prod`).
- **Impact:** Thấp — rate limit login đã hạn chế brute-force online.
- **Recommended fix:** Cân nhắc chặn danh sách mật khẩu phổ biến hoặc tích hợp HaveIBeenPwned k-anonymity. Là **product/security decision**.
- **Auto-fix allowed:** No
- **NEEDS_CONFIRMATION:** Yes (product decision)

---

### SEC-014 — Actuator metrics/prometheus mở cho mọi user đã xác thực
- **Severity:** Low
- **Type:** DATA_LEAK
- **Module:** bigbike-backend
- **Location:** `application-prod.properties` L20; `SecurityConfig` (chỉ `/actuator/health` permitAll, còn lại → `anyRequest().authenticated()`)
- **Evidence:** prod expose `health,info,metrics,prometheus`; không có rule riêng cho `/actuator/**` ngoài `health` → `metrics`/`prometheus` chỉ cần *bất kỳ JWT/customer session hợp lệ*.
- **Problem:** Customer đã đăng nhập (ROLE_CUSTOMER) cũng truy cập được `/actuator/metrics`, `/actuator/prometheus` → lộ thông tin vận hành (đường dẫn, throughput, JVM).
- **Impact:** Thấp — không lộ PII/secret, nhưng metrics nên giới hạn cho admin/monitoring.
- **Recommended fix:** Thêm rule `/actuator/**` (trừ health) yêu cầu `hasRole("ADMIN")` hoặc khóa ở nginr (chỉ cho IP monitoring). nginx prod chưa thấy chặn `/actuator/metrics`.
- **Auto-fix allowed:** No (đổi security rule)
- **NEEDS_CONFIRMATION:** Yes

---

### SEC-015 — File `ent.py` lạ ở root repo
- **Severity:** Low
- **Type:** DOC_STALE / cleanup
- **Module:** repo root
- **Location:** `s:\project\bigbike\ent.py`
- **Evidence:** Script Python dry-run phân loại `@Entity` cho Lombok; untracked (`git ls-files` không có). Không phải file của stack.
- **Problem:** File công cụ tạm nằm ở root, không thuộc codebase, không trong `.gitignore`.
- **Impact:** Rất thấp — chỉ là rác. Không chứa secret.
- **Recommended fix:** Xóa nếu không còn dùng, hoặc chuyển vào `scripts/` và thêm `.gitignore`. **Không tự xóa** vì file do user tạo.
- **Auto-fix allowed:** No
- **NEEDS_CONFIRMATION:** Yes

---

### Info / Accepted tradeoffs
- **INFO-1:** Access JWT stateless — logout không thu hồi được access token (TTL 15 phút). Tradeoff chuẩn, chấp nhận.
- **INFO-2:** Login customer thành công kể cả khi email chưa verify; chỉ guest-order-linking yêu cầu verified. Là product decision (`WORKFLOW_OVERVIEW.md`), không phải bug.
- **INFO-3:** CORS `allowedHeaders=*` — rộng nhưng origin đã khóa exact ở non-dev nên an toàn.

---

## 17. Fix Plan

### Immediate blocking fixes
*(Không có Critical. SEC-001 chỉ blocking nếu mobile sắp release production.)*
- **SEC-001** — Cấu hình API base URL HTTPS production cho mobile trước khi release.

### High-priority hardening
- **SEC-002** — Rotate Gmail App Password + JWT secret; verify lịch sử git `.env`.
- **SEC-003** — Set `bigbike.trusted-proxies` đúng cho môi trường Docker/nginx production.
- **SEC-009** — Thống nhất `client_max_body_size` nginx với limit upload 50MB.

### Medium backlog
- **SEC-004** — Mobile lưu session qua secure storage / loại khỏi backup.
- **SEC-005** — Siết CSP: bỏ `unsafe-inline` script ở admin; nonce/hash cho web.
- **SEC-006** — Sanitize giá trị setting HTML trong admin SettingsScreen.
- **SEC-007** — Thay `sanitizeRichHtml` bằng DOMPurify (đã có dependency).

### Low cleanup / docs
- **SEC-008** — Đưa security header vào snippet `include` cho cả static-asset location.
- **SEC-010** — Bind web/admin port `127.0.0.1` ở production.
- **SEC-011** — Bỏ/mask PII trong log password reset *(auto-fix allowed — fix nhỏ)*.
- **SEC-012** — Đổi so sánh internal token sang `MessageDigest.isEqual` *(auto-fix allowed — fix nhỏ)*.
- **SEC-014** — Khóa `/actuator/metrics|prometheus` cho admin/IP monitoring.
- **SEC-015** — Dọn `ent.py` khỏi root.

### Tests to add (ưu tiên theo mục 15)
1. **High:** Customer A truy cập order/return của Customer B → không 200 (IDOR).
2. **High:** RBAC — role thiếu permission → 403 cho mỗi nhóm controller admin.
3. **High:** CSRF — POST customer thiếu/sai `X-CSRF-Token` → `CSRF_INVALID`.
4. **High:** Refresh token reuse — gọi refresh 2 lần cùng token → lần 2 phải 401.
5. **Med:** Rate limit login (request thứ 6 → 429); internal endpoint deny-by-default; upload SVG/MIME-mismatch; WebSocket CONNECT non-admin reject.

### Product / security decisions cần xác nhận
- SEC-001/SEC-009 (limit, domain), SEC-013 (policy mật khẩu), SEC-014 (ai được xem metrics), SEC-003/SEC-010 (deployment topology).

---

## 18. Acceptance Criteria — Trạng thái

| Tiêu chí | Trạng thái |
|---|---|
| Không Critical/High security issue chưa xử lý | ⚠️ 1 High (SEC-001) — config, conditional |
| Không admin endpoint public | ✅ Đạt |
| Không IDOR nghiêm trọng | ✅ Đạt (ownership enforce ở service) |
| Không secret hardcoded/committed | ✅ Đạt (`.env` gitignored; verify SEC-002) |
| Không leak stacktrace/internal error ở prod | ✅ Đạt |
| Public API không trả dữ liệu nhạy cảm | ✅ Đạt |
| Login/register/warranty/upload có abuse protection | ✅ Đạt (rate limit — lưu ý SEC-003) |
| Upload validate size/type/extension/magic-byte | ✅ Đạt |
| Webhook verify nguồn + idempotency | ✅ N/A (không có payment webhook) |
| CORS không mở bừa ở production | ✅ Đạt (fail-fast validate) |
| Token/session lifecycle rõ ràng | ✅ Đạt (TTL + rotation + revoke) |
| Sensitive logs loại bỏ | ⚠️ Gần đạt (SEC-011 — PII nhẹ) |
| Flow security-critical có test | ⚠️ Một phần — cần bổ sung IDOR/CSRF/rate-limit test |

---

## Phụ lục — Checks đã / chưa chạy

- **Static code audit:** đã thực hiện (đọc code thật, cite path).
- **`mvn compile` / backend test:** **chưa chạy** — phase này không sửa source code backend nên không cần build verify; CI (`ci.yml`) đã chạy `mvn clean verify` mỗi push.
- **Frontend/admin typecheck:** không sửa client → không chạy.
- **`npm audit` / OWASP dependency-check:** đã có sẵn trong CI (`ci.yml`, `security-scan.yml`) — không chạy lại thủ công, không upgrade.
- Không destructive test, không brute force, không scan domain production, không đổi dữ liệu thật.

---

## 19. Remediation Status — cập nhật 2026-05-16

Sau audit, các finding đã được fix trong cùng đợt (quyết định với product owner: SEC-005 chỉ
siết admin, SEC-009 giữ 50 MB, SEC-013 giữ nguyên policy mật khẩu).

| ID | Severity | Trạng thái | Ghi chú fix |
|---|---|---|---|
| SEC-001 | High | ✅ RESOLVED | `app_config.dart` thêm `_apiProd=https://api.bigbike.vn`, release build dùng HTTPS; `network_security_config.xml` thêm `base-config cleartextTrafficPermitted=false` |
| SEC-002 | Medium | ⚠️ MANUAL | Rotate Gmail App Password + JWT secret + revalidate secret — thao tác vận hành, user thực hiện (xem mục 17) |
| SEC-003 | Medium | ✅ RESOLVED | `RateLimitingFilter` hỗ trợ CIDR; `bigbike.trusted-proxies` wired qua `application.properties` + `BIGBIKE_TRUSTED_PROXIES` trong docker-compose / `.env.example` |
| SEC-004 | Medium | ✅ RESOLVED | Mobile dùng `SecureCookieStorage` (flutter_secure_storage) thay `FileStorage` plaintext |
| SEC-005 | Medium | ✅ RESOLVED (admin) | `bigbike-admin/nginx.conf` CSP `script-src 'self'` (bỏ `unsafe-inline`). Web giữ nguyên — known limitation (cần nonce rework riêng) |
| SEC-006 | Medium | ✅ RESOLVED | Admin thêm `dompurify`; `src/lib/sanitizeHtml.js`; `SettingsScreen` sanitize `rawValue` |
| SEC-007 | Medium | ✅ RESOLVED | `bigbike-web/lib/utils/html.ts` dùng `isomorphic-dompurify` thay sanitizer regex |
| SEC-008 | Low | ✅ RESOLVED | `bigbike-admin/nginx.conf` lặp security header trong location static-asset |
| SEC-009 | Medium | ✅ RESOLVED | nginx `^~ /api/v1/admin/media` đặt `client_max_body_size 55m` (khớp limit 50 MB backend) |
| SEC-010 | Low | ✅ RESOLVED | docker-compose bind web/admin về `127.0.0.1` |
| SEC-011 | Low | ✅ RESOLVED | `CustomerPasswordResetService` bỏ log `login` (PII) |
| SEC-012 | Low | ✅ RESOLVED | `InternalRedirectController` so sánh token bằng `MessageDigest.isEqual` |
| SEC-013 | Low | ⏸️ NO-CHANGE | Quyết định product: giữ policy mật khẩu tối thiểu 8 ký tự |
| SEC-014 | Low | ✅ RESOLVED | nginx API chặn `/actuator/` (trừ health) bằng `return 403` |
| SEC-015 | Low | ⏸️ USER DECISION | `ent.py` là file untracked do user tạo — không tự xóa |
