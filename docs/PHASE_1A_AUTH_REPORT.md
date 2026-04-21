# Phase 1A — Backend Security / Admin Auth Foundation

**Date:** 2026-04-21  
**Status:** COMPLETE — all 38 tests pass

---

## What was delivered

### Database schema (Flyway V2)
- `admin_users` — UUID PK, email (unique index), password_hash, display_name, role, status, last_login_at, timestamps
- `admin_refresh_tokens` — UUID PK, FK to admin_users (CASCADE DELETE), token_hash (unique index, SHA-256 hex), expires_at, revoked_at, timestamps + IP/UA for audit

### Dependencies added (`pom.xml`)
- JJWT 0.12.6 (`jjwt-api`, `jjwt-impl` runtime, `jjwt-jackson` runtime)
- BouncyCastle `bcprov-jdk18on` 1.80 (Argon2id support)

### Auth endpoints
| Method | Path | Auth required |
|--------|------|---------------|
| POST | `/api/v1/auth/login` | None |
| POST | `/api/v1/auth/refresh` | None |
| POST | `/api/v1/auth/logout` | None |
| GET | `/api/v1/auth/me` | Bearer token |

### JWT design
- Access token: 15 min TTL, HMAC-SHA256, claims: `sub` (userId), `email`, `role`
- Refresh token: 7-day TTL, opaque random bytes stored as SHA-256 hex, rotated on every use
- Secret: raw UTF-8 bytes; fail-fast on startup if active profile is `prod` and secret starts with `dev-` or is < 32 chars

### Security config
- `SessionCreationPolicy.STATELESS`; CSRF disabled (JWT-only API)
- `GET /api/v1/products/**`, `/categories/**`, `/brands/**`, `/articles/**`, `/pages/**` — public
- `POST /auth/login|refresh|logout` — public
- `/api/v1/admin/**` — requires `ROLE_ADMIN`
- `/api/v1/auth/me` — requires authenticated principal
- 401 → `{"error":{"code":"UNAUTHORIZED",...}}` via `RestAuthenticationEntryPoint`
- 403 → `{"error":{"code":"FORBIDDEN",...}}` via `RestAccessDeniedHandler`

### Security notes
- Timing-safe login: dummy Argon2 verify runs even when user is not found (prevents user enumeration)
- `DevAdminAuthService.requirePermission()` checks `SecurityContext` first (JWT path); falls back to header-based stub only when no JWT principal is present
- `AuthController.me()` falls back to `devAdminAuthService.currentAdminUser()` when no JWT principal — preserves 501 behavior in prod profile without a real JWT

---

## Test results

| Test class | Tests | Result |
|------------|-------|--------|
| `AdminAuthApiTest` | 10 | PASS |
| `AdminAuthSecurityTest` | 8 | PASS |
| `PasswordServiceTest` | 4 | PASS |
| `AdminReadApiTest` (pre-existing) | 5 | PASS |
| `AdminMutationApiTest` (pre-existing) | 4 | PASS |
| `PublicReadApiTest` (pre-existing) | 5 | PASS |
| `AuthProfileGuardTest` (pre-existing) | 1 | PASS |
| `BigbikeBackendApplicationTests` | 1 | PASS |
| **Total** | **38** | **ALL PASS** |

---

## Key technical fixes during implementation

| Issue | Root cause | Fix |
|-------|-----------|-----|
| `DecodingException` on startup | `Decoders.BASE64.decode()` threw uncaught exception on dev secret containing `-` | Removed Base64 decoding; always use `secret.getBytes(UTF_8)` |
| `NoSuchBeanDefinitionException: ObjectMapper` | Spring Boot 4.x uses `tools.jackson` (Jackson 3.x); handlers imported `com.fasterxml.jackson` (Jackson 2.x) | Switched to `tools.jackson.databind.ObjectMapper` constructor injection |
| `AuthProfileGuardTest` fails in prod profile | JwtService fail-fast rejected dev secret when `spring.profiles.active=prod` | Added `bigbike.jwt.secret=prod-guard-test-secret-strong-enough-abc123` to test properties |

---

## What is NOT in scope (deferred)

- Customer auth (sessions, cookies, CSRF) — Phase 2
- Cart, checkout, orders, payments — Phase 3+
- WordPress migration — separate track
- Frontend changes — separate track
- Admin user seeding/management UI — Phase 1B+
