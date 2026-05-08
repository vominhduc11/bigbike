# CMS Internal Redirect Proxy Fix Report

**Date:** 2026-05-08
**Engineer:** Full-stack
**Issue:** CMS-002 follow-up — web proxy token propagation
**Source report:** `docs/audits/CONTENT_MEDIA_MENUS_SLIDERS_SETTINGS_FIX_REPORT.md` (Open item: "CMS-002 proxy token propagation")

---

## 1. Summary

| Item | Status |
|---|---|
| Backend deny-by-default (CMS-002 main fix) | Already done in Phase 8 |
| Web proxy.ts reads `INTERNAL_API_TOKEN` and sends `X-Internal-Token` | Already done in Phase 8 |
| Startup warning when token missing in production | **FIXED in this report** |
| Per-request 401/403 error log in proxy.ts | **FIXED in this report** |
| `INTERNAL_API_TOKEN` documented in `.env.local` | **FIXED in this report** |
| `.env.example` production deployment instructions | **FIXED in this report** |
| Backend tests (allow-open=false → 401) | Verified passing (AdminRedirectApiTest 8/8) |
| Web TypeScript check | Pass — 0 errors |
| Full backend regression | 1002 tests, 0 failures |

**Env var required on web (production):** `INTERNAL_API_TOKEN`
**Env var required on backend (production):** `BIGBIKE_INTERNAL_TOKEN`
Both must be set to the **same** random secret value.

---

## 2. Root Cause

Phase 8 fixed the backend to deny-by-default (`bigbike.internal.allow-open=false`). The web `proxy.ts` was also updated in Phase 8 to read `INTERNAL_API_TOKEN` and send `X-Internal-Token` to the backend.

However, two gaps remained:

1. **Silent failure**: When `INTERNAL_API_TOKEN` is not set on the web side in production, the backend returns 401 and `fetchFromBackend` silently returns `null`. The redirect simply doesn't happen — no error is logged, no alert is raised. This makes production misconfiguration invisible until someone notices redirects aren't working.

2. **Missing env documentation**: `INTERNAL_API_TOKEN` was not present in `.env.local` (making it invisible to developers setting up the project) and the `.env.example` comment did not explain the production pairing requirement clearly.

---

## 3. Fix

### 3.1 proxy.ts — startup warning

Added a one-time `console.warn` at module load time when `INTERNAL_API_TOKEN` is not set and `NODE_ENV === "production"`:

```typescript
if (!INTERNAL_TOKEN && process.env.NODE_ENV === "production") {
  console.warn(
    "[proxy] INTERNAL_API_TOKEN is not set. Redirect lookups will silently fail because " +
    "the backend requires authentication on /api/internal/** in production " +
    "(bigbike.internal.allow-open defaults to false). " +
    "Set INTERNAL_API_TOKEN to the same value as BIGBIKE_INTERNAL_TOKEN on the backend."
  );
}
```

This fires once when the Next.js worker starts, not per request. It is suppressed in `development`/`test` because those environments have `bigbike.internal.allow-open=true` on the backend.

### 3.2 proxy.ts — per-request 401/403 error log

Added a distinct branch in `fetchFromBackend` for 401/403 responses:

```typescript
if (response.status === 401 || response.status === 403) {
  console.error(
    `[proxy] Backend returned ${response.status} for redirect lookup on "${path}". ` +
    "Verify INTERNAL_API_TOKEN matches BIGBIKE_INTERNAL_TOKEN on the backend. " +
    "Redirects will not function until this is resolved."
  );
  return null;
}
```

Without this branch, a 401 was treated the same as any other non-ok response and silently discarded.

### 3.3 .env.local — variable added

Added `INTERNAL_API_TOKEN=` (empty for local dev) with a comment explaining why empty is safe locally:

```
# In staging/prod: set this to the same random value as BIGBIKE_INTERNAL_TOKEN.
INTERNAL_API_TOKEN=
```

Empty is correct for local dev because `application-dev.properties` sets `bigbike.internal.allow-open=true`.

### 3.4 .env.example — production instructions clarified

Replaced vague "leave empty in local dev" comment with explicit step-by-step production pairing instructions:

```
# Local dev: leave empty. The backend dev profile sets bigbike.internal.allow-open=true
#   (application-dev.properties), so no token is needed locally.
#
# Staging / Production (REQUIRED):
#   1. Generate a random secret: openssl rand -base64 32
#   2. Set BIGBIKE_INTERNAL_TOKEN=<secret> on the backend.
#   3. Set INTERNAL_API_TOKEN=<same secret> here on the web.
#   If either is missing or mismatched, all runtime redirects will silently fail
#   and proxy.ts will log an error on every request.
#   Never set bigbike.internal.allow-open=true in staging/production.
INTERNAL_API_TOKEN=
```

### 3.5 Token name decision

The web uses `INTERNAL_API_TOKEN` and the backend uses `BIGBIKE_INTERNAL_TOKEN`. These names are intentionally different: `BIGBIKE_INTERNAL_TOKEN` follows the backend's `bigbike.*` namespace convention for Spring property binding; `INTERNAL_API_TOKEN` follows the web's pattern of non-prefixed server-only vars (see `REVALIDATE_SECRET`). Both `.env.example` and `proxy.ts` cross-reference the other name explicitly so the pairing is unambiguous.

---

## 4. Runtime behavior summary

| Scenario | Backend config | Web config | Result |
|---|---|---|---|
| Local dev | `allow-open=true` (application-dev.properties) | `INTERNAL_API_TOKEN=` (empty) | Redirects work — backend allows open access |
| Local dev with token | `allow-open=false`, `BIGBIKE_INTERNAL_TOKEN=dev-secret` | `INTERNAL_API_TOKEN=dev-secret` | Redirects work — token matches |
| Production, both set | `allow-open=false`, `BIGBIKE_INTERNAL_TOKEN=<secret>` | `INTERNAL_API_TOKEN=<same secret>` | Redirects work — token matches |
| Production, web token missing | `allow-open=false`, token set | `INTERNAL_API_TOKEN=` (empty) | Backend returns 401; proxy logs `console.error`; redirect silently skipped |
| Production, token mismatch | `allow-open=false`, token set | `INTERNAL_API_TOKEN=wrong` | Backend returns 401; same error log |
| Production misconfigured open | `allow-open=true` | Any | Backend open — security risk; **never do this in prod** |

---

## 5. Production Deployment Requirements

### Backend
| Property | Env var | Production value |
|---|---|---|
| `bigbike.internal.token` | `BIGBIKE_INTERNAL_TOKEN` | Random 32+ byte secret (`openssl rand -base64 32`) |
| `bigbike.internal.allow-open` | (not set / false) | Must be `false` or absent — never `true` in prod |

### Web (Next.js)
| Env var | Value |
|---|---|
| `INTERNAL_API_TOKEN` | Same value as backend `BIGBIKE_INTERNAL_TOKEN` |

### Defense-in-depth (infrastructure)
Backend `/api/internal/**` endpoints should additionally be restricted at the network layer:
- **Nginx:** `deny all; allow <web-server-IP>;` on `/api/internal/` location block
- **VPC:** Place backend in private subnet; only allow web server to reach backend port 8080

The token provides application-layer auth; the network ACL provides defense-in-depth if the token is ever compromised or accidentally removed.

---

## 6. Test Results

| Command | Result | Notes |
|---|---|---|
| `./mvnw -Dtest=AdminRedirectApiTest test` | 8/8 pass | Internal endpoint auth tests confirmed |
| `./mvnw test` (full suite) | 1002 tests, 0 failures, 1 error | Pre-existing Docker/Testcontainers infra error (AdminReportRepositoryQueryTest) — not a regression |
| `npx tsc --noEmit` (bigbike-web) | 0 errors | proxy.ts changes are type-correct |

---

## 7. Files Changed

| File | Change |
|---|---|
| `bigbike-web/proxy.ts` | Added startup `console.warn` when token missing in production; added explicit `console.error` on 401/403 from backend |
| `bigbike-web/.env.local` | Added `INTERNAL_API_TOKEN=` with explanatory comment |
| `bigbike-web/.env.example` | Expanded comment with production pairing instructions and security note |

---

## 8. Remaining Risks

| Risk | Severity | Notes |
|---|---|---|
| Token rotation requires coordinated redeploy | LOW | Backend and web must be updated simultaneously; brief redirect outage during rotation. Mitigation: blue-green deploy. |
| In-process L1 cache (30 s TTL) is not evicted by token change | LOW | After token rotation, cached misses expire within TTL. Not a security risk — the cache stores `null` (no redirect) or redirect targets, not auth tokens. |
| `recordHit()` errors are silently swallowed | LOW | Fire-and-forget hit counter: 401 on hit counter POST is not logged. Non-critical (counter only). Could add optional warn if needed. |
