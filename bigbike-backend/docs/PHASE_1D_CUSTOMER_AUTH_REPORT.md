HISTORICAL_REPORT_ONLY - Not canonical. Validate against current code and canonical docs.

# Phase 1D — Customer Auth + Session + CSRF Foundation

**Status:** COMPLETE  
**Date:** 2026-04-21  
**Tests:** 87 passed (67 prior + 20 new), 0 failed, 0 skipped

---

## A. Summary

Phase 1D implements cookie-based customer authentication on top of the Phase 1C schema foundation. Customers can register, login, refresh sessions, and logout. Sessions are persisted in `customer_sessions` and protected by a double-submit CSRF token. No checkout, no cart API, no WordPress migration.

**What this phase enables:**

| Consumer | Requires |
|----------|----------|
| Phase 1E — Cart/Checkout API | `CustomerPrincipal` in SecurityContext for `POST /api/v1/cart/add` |
| Phase 2 — WordPress Migration | `customers` table already created in V3; Phase 1D adds `customer_sessions` for login continuity post-migration |
| Phase 3 — Admin Customer Module | `CustomerJpaRepository`, `CustomerSessionJpaRepository` already in place |

---

## B. Files Changed

### New migration
- [V9__create_customer_auth_session_tables.sql](../bigbike-backend/src/main/resources/db/migration/V9__create_customer_auth_session_tables.sql)

### New domain
- `domain/customer/CustomerSessionStatus.java` — ACTIVE, REVOKED, EXPIRED
- `domain/customer/CustomerPrincipal.java` — `record(customerId, email, phone, sessionId)`

### New entities (`persistence.entity.customer`)
- `CustomerSessionEntity`
- `CustomerPasswordResetTokenEntity`
- `CustomerEmailVerificationTokenEntity`

### New repositories (`persistence.repository.customer`)
- `CustomerSessionJpaRepository`
- `CustomerPasswordResetTokenJpaRepository`
- `CustomerEmailVerificationTokenJpaRepository`

### New services (`service.customer`)
- `CustomerSessionService` — create/find/rotate/revoke sessions; raw tokens returned via `CustomerSessionResult` record
- `CustomerSessionResult` — internal record carrying raw session+refresh+CSRF tokens; never serialized to JSON
- `CustomerAuthResult` — controller-level record wrapping `CustomerAuthResponse` + raw tokens for cookie-setting
- `CustomerAuthService` — register, login, refresh, logout, getProfile
- `CustomerCsrfService` — CSRF token generation (delegates to `JwtService.generateRawRefreshToken`)

### New filters (`config`)
- `CustomerSessionFilter` — reads `bb_session` cookie → sets `CustomerPrincipal` + `ROLE_CUSTOMER` in SecurityContext
- `CustomerCsrfFilter` — double-submit CSRF validation for non-safe methods; exempts admin + auth + register/login/refresh

### New DTOs (`api.customer.dto`)
- `CustomerRegisterRequest`, `CustomerLoginRequest`, `CustomerSummary`, `CustomerAuthResponse`

### New exception
- `api/error/ConflictException.java` — 409 CONFLICT

### New controllers (`api.customer`)
- `CustomerAuthController` — `/api/v1/customer/auth/{register,login,refresh,logout}`
- `CustomerController` — `/api/v1/customer/me`

### Modified
- `config/SecurityConfig.java` — added customer endpoints, customer filters
- `docs/PHASE_1D_CUSTOMER_AUTH_REPORT.md` (this file)

### New test
- [Phase1DCustomerAuthTest.java](../bigbike-backend/src/test/java/com/bigbike/bigbike_backend/api/Phase1DCustomerAuthTest.java)

---

## C. Database Migration

### V9 — customer_sessions + token tables

| Table | Key fields | Notes |
|-------|-----------|-------|
| `customer_sessions` | `session_token_hash UNIQUE`, `refresh_token_hash UNIQUE`, `status`, `session_expires_at`, `refresh_expires_at` | All token hashes stored as SHA-256 hex (64 chars); raw tokens only in cookies |
| `customer_password_reset_tokens` | `token_hash UNIQUE`, `expires_at`, `used_at` | Append-only; no `updated_at` |
| `customer_email_verification_tokens` | `token_hash UNIQUE`, `expires_at`, `used_at` | Append-only; no `updated_at` |

---

## D. API Endpoints

| Method | Path | Auth | CSRF |
|--------|------|------|------|
| `POST` | `/api/v1/customer/auth/register` | Public | Exempt |
| `POST` | `/api/v1/customer/auth/login` | Public | Exempt |
| `POST` | `/api/v1/customer/auth/refresh` | `bb_refresh` cookie | Exempt |
| `POST` | `/api/v1/customer/auth/logout` | `bb_session` cookie | **Required** |
| `GET` | `/api/v1/customer/me` | `ROLE_CUSTOMER` | N/A (GET) |

### Cookie design

| Cookie | HttpOnly | Path | TTL | Purpose |
|--------|----------|------|-----|---------|
| `bb_session` | ✓ | `/` | 7 days | Session token (SHA-256 hashed in DB) |
| `bb_refresh` | ✓ | `/api/v1/customer/auth/refresh` | 30 days | Refresh token (SHA-256 hashed in DB) |
| `bb_csrf` | ✗ | `/` | 7 days | CSRF double-submit value (raw, readable by JS) |

---

## E. Design Decisions

### Token storage via `CustomerSessionResult` record
`CustomerAuthService` returns `CustomerAuthResult(response, rawSessionToken, rawRefreshToken)` to the controller layer. The controller sets cookies from these raw values; the JSON response body only carries `csrfToken`. Raw session and refresh tokens are never serialized to JSON.

### CSRF double-submit pattern
`CustomerCsrfFilter` validates `X-CSRF-Token` header == `bb_csrf` cookie for all non-safe, non-exempt requests. The comparison is plaintext equality (no hash lookup, no server state). The `csrf_token_hash` column in `customer_sessions` is reserved for future server-side CSRF validation if stricter security is needed.

### Filter ordering in SecurityConfig
Spring Security's `FilterComparator` requires that a filter class is registered before it can be used as an anchor for other filters. The registration order in `securityFilterChain` is:
1. `addFilterBefore(jwtAuthFilter, UPAIF)` — registers `JwtAuthFilter`
2. `addFilterBefore(customerSessionFilter, JwtAuthFilter.class)` — safe because JwtAuthFilter is now registered
3. `addFilterAfter(customerCsrfFilter, CustomerSessionFilter.class)` — safe because CustomerSessionFilter is now registered

The resulting execution order: `customerSessionFilter → customerCsrfFilter → jwtAuthFilter → UPAIF`

### CSRF exempts `/api/v1/admin/**`
All admin mutation tests (`AdminMutationApiTest`) POST without CSRF headers. The CSRF filter explicitly exempts `/api/v1/admin/` prefix to avoid breaking admin API compatibility.

### Timing-safe login
When a login attempt uses an unknown email/phone, `PasswordService.dummyVerify()` is called before throwing 401 to prevent user enumeration via response timing.

### Session rotation on refresh
`CustomerSessionService.rotateSession()` replaces all three token hashes (session, refresh, CSRF) atomically. The old refresh token is immediately invalidated; the new tokens are returned to the caller.

---

## F. Tests Added

**Class:** `Phase1DCustomerAuthTest` (20 tests)

| Test | What it verifies |
|------|-----------------|
| `register_withEmail_creates_customer_and_sets_cookies` | Register succeeds; 3 cookies set with correct HttpOnly flags |
| `register_withPhone_creates_customer` | Phone-only registration works |
| `register_withoutEmailOrPhone_returns_400` | Validation: email or phone required |
| `register_passwordTooShort_returns_400` | Validation: min 6 chars |
| `register_duplicateEmail_returns_409` | Conflict detection; `error.code = CONFLICT` |
| `login_withEmail_succeeds_and_sets_cookies` | Login by email; cookies set |
| `login_withPhone_succeeds` | Login by phone |
| `login_wrongPassword_returns_401` | 401 UNAUTHORIZED |
| `login_unknownUser_returns_401_without_timing_shortcut` | Unknown user → 401 (no timing leak) |
| `session_cookie_authenticates_me_endpoint` | `bb_session` cookie → `GET /me` → 200 with profile |
| `me_withoutSession_returns_401` | No cookie → 401 |
| `csrf_protects_logout_without_header` | POST logout without X-CSRF-Token → 403 |
| `csrf_allows_logout_with_correct_header` | POST logout with matching header → 200 |
| `csrf_exempts_register_endpoint` | Register has no CSRF requirement |
| `csrf_exempts_login_endpoint` | Login has no CSRF requirement |
| `refresh_with_valid_token_rotates_session` | New `bb_session` differs from old |
| `refresh_without_cookie_returns_401` | Missing `bb_refresh` cookie → 401 |
| `logout_revokes_session_in_db` | After logout, session row `status = REVOKED` |
| `regression_adminEndpointStillRequires401` | Admin 401 intact (Phase 1A) |
| `regression_publicCatalogStillPublic` | Public catalog 200 intact (Phase 1B) |

---

## G. Commands Executed

| Command | Result |
|---------|--------|
| `./mvnw test` | **PASS** — 87 tests, 0 failures |

---

## H. Remaining Risks

| Risk | Notes |
|------|-------|
| `secure=false` on cookies | Set to `false` for local HTTP dev. Must be `true` in production (HTTPS). Add `@ConditionalOnProperty` or check `server.ssl.enabled` when deploying. |
| CSRF double-submit is stateless | If `bb_csrf` cookie is stolen alongside a session cookie, CSRF protection is bypassed. Acceptable for this phase; upgrade to HMAC-signed CSRF token in Phase 3 if needed. |
| No session cleanup job | Expired sessions are not purged. A scheduled task using `findBySessionExpiresAtBeforeAndStatus` should be added in Phase 3. |
| `customer_password_reset_tokens` / `customer_email_verification_tokens` tables created but not used | Reserved for future Phase (password reset, email verify flow). No controller or service uses them yet. |
| `CustomerCsrfService` not called from any controller | `CustomerCsrfService.generateCsrfToken()` is available but unused — CSRF token is generated inside `CustomerSessionService`. The service is a placeholder for standalone CSRF generation if needed later. |

---

## I. Recommended Next Tasks

1. **Phase 1E — Cart/Checkout Service + API**  
   `POST /api/v1/cart/add`, `POST /api/v1/checkout`, using `CustomerPrincipal` from SecurityContext + Phase 1C cart/order schema.

2. **Phase 2 — WordPress WooCommerce Order Migration**  
   ETL from `kd_wc_orders` into Phase 1C tables. `customers.legacy_id` and `orders.legacy_id` are in place.

3. **Phase 3 — Admin Customer + Session Management Module**  
   Admin endpoints to list/ban customers, view sessions, using `CustomerJpaRepository` + `CustomerSessionJpaRepository`.

4. **Production hardening**  
   Set `secure=true` on cookies behind HTTPS, add session expiry cleanup scheduler, consider HMAC-signed CSRF.

---

## J. Safety Check

- No secrets committed
- No frontend changes  
- No cart API implemented
- No WordPress data imported
- Phase 1A admin security: confirmed passing (regression tests pass)
- Phase 1B/1C schema: confirmed passing (all prior tests pass)
- No prior migrations modified
