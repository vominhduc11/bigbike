# CMS Fix Report — Phase 8

**Date:** 2026-05-08  
**Engineer:** Backend + Full-stack  
**Phase:** 8 — CMS Hardening (follows CMS Audit — Phase 7)  
**Audit source:** `docs/audits/CONTENT_MEDIA_MENUS_SLIDERS_SETTINGS_AUDIT.md`

---

## Executive Summary

| Issue | Priority | Status | Notes |
|---|---|---|---|
| CMS-001 — Phase1J test missing @Sql | P0 CRITICAL | FIXED | @Sql seed added; all 83 tests now pass |
| CMS-002 — InternalRedirectController open by default | P1 HIGH | FIXED | Deny-by-default; allow-open=true in dev/test only |
| CMS-003 — revalidateTag second argument | P2 MEDIUM | FIXED | Next.js 16.x requires `{ expire: 0 }` second arg; restored with explanation |
| CMS-004 — Mobile missing homeVideos constant | P2 MEDIUM | FIXED | Added `homeVideos` constant to ApiEndpoints |
| CMS-005 — Redirect multi-hop loop detection | P2 MEDIUM | FIXED | Full chain-walk with 20-hop depth limit; excludes self on update |
| CMS-006 — AdminContentController dev UUID fallback | P3 LOW | FIXED | Throws UnauthorizedException in prod; falls back to sentinel UUID only when devHeaderEnabled |
| CMS-007 — Menu item URL validation | P3 LOW-SECURITY | FIXED | validateMenuItemUrl blocks javascript:, data:, vbscript:, //, CRLF |
| CMS-008 — Batch settings isPublic guard | P3 LOW | N/A — STRUCTURAL | BatchSettingUpdate DTO has no isPublic field; risk excluded by design |
| CMS-009 — PublishStatus enum comment | P3 LOW | FIXED | Javadoc added; validatePublishTransition rejects PENDING/PRIVATE as targets |
| CMS-010 — Slider/HomeVideo audit logs | P3 LOW | FIXED | SLIDER_CREATED/UPDATED/DELETED/REORDERED and HOME_VIDEO_* events added |
| CMS-011 — HomeSlider productLink/link comments | P3 LOW | FIXED | Javadoc added to both computed fields; tsc passes |

---

## Test Results

| Metric | Before | After |
|---|---|---|
| Total tests | ~999 | 1002 |
| Failures | 2 (pre-CMS-006 fix broke them) | 0 |
| Errors | 1 (Docker unavailable for Testcontainers) | 1 (same, infrastructure) |
| TypeScript errors | 1 (revalidateTag arity) | 0 |

The single remaining error (`AdminReportRepositoryQueryTest`) is a pre-existing Testcontainers infrastructure constraint — Docker is not available in this environment. It is not a code regression.

---

## Fix Details

### CMS-001 — Phase1JAdminSettingsMenuCouponApiTest @Sql

**Root cause:** Test class lacked `@Sql(scripts = "/db/test-seed.sql", ...)` so the H2 database was empty; all permission-checked endpoints returned 403/404 rather than exercising the actual logic.

**Fix:** Added `@Sql(scripts = "/db/test-seed.sql", executionPhase = Sql.ExecutionPhase.BEFORE_TEST_CLASS)` to the class annotation.

**File:** `bigbike-backend/src/test/java/com/bigbike/bigbike_backend/api/Phase1JAdminSettingsMenuCouponApiTest.java`

---

### CMS-002 — InternalRedirectController deny-by-default

**Root cause:** `isAuthorized()` returned `true` when `internalToken` was blank, exposing the internal redirect lookup and hit-counter endpoints to any caller without authentication.

**Fix:**
- Added `@Value("${bigbike.internal.allow-open:false}")` property (default `false`).
- When token is blank AND `allowOpen=false` → deny (401). Safe production default.
- When token is blank AND `allowOpen=true` → allow. Dev/test only.
- When token is set → require matching `X-Internal-Token` header.
- Set `bigbike.internal.allow-open=true` in `src/test/resources/application.properties` and `application-dev.properties`.

**Files:**
- `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/internal/InternalRedirectController.java`
- `bigbike-backend/src/main/resources/application-dev.properties`
- `bigbike-backend/src/test/resources/application.properties`

---

### CMS-003 — revalidateTag second argument

**Root cause:** The previous agent removed the `{ expire: 0 }` second argument assuming it was invalid, but Next.js 16.x changed `revalidateTag(tag, profile)` to require a second `profile: string | CacheLifeConfig` argument. TypeScript reported "Expected 2 arguments, but got 1."

**Fix:** Restored `revalidateTag(tag, { expire: 0 })` with a comment explaining it is required by Next.js 16.x to force immediate cache expiry.

**File:** `bigbike-web/app/api/revalidate/route.ts`

---

### CMS-004 — Mobile homeVideos endpoint constant

**Root cause:** `ApiEndpoints` class had `sliders` but no `homeVideos` constant, making the home-videos API URL a magic string if used.

**Fix:** Added `static const String homeVideos = '/api/v1/home-videos';` adjacent to `sliders`.

**File:** `bigbike_mobile/lib/core/api/api_endpoints.dart`

---

### CMS-005 — Redirect multi-hop loop detection

**Root cause:** The original `validateNoSelfLoop()` only checked direct self-loops (A→A). Multi-hop chains like A→B→A were not detected.

**Fix:** Replaced with `validateNoRedirectLoop()` that:
- Normalizes paths (lowercase, trim, strip trailing slash except root).
- Walks the chain: source → target → target's target → … up to 20 hops.
- Maintains a visited set; if current path is already visited → throws `REDIRECT_LOOP`.
- For updates, uses `findBySourcePatternAndIdNot()` to exclude the record being updated.
- Stops cleanly on external URLs (no internal chain to follow).

`RedirectJpaRepository.findBySourcePatternAndIdNot()` was added to support the update exclusion.

**Files:**
- `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminRedirectService.java`
- `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/persistence/repository/redirect/RedirectJpaRepository.java`

---

### CMS-006 — AdminContentController resolveAdminId

**Root cause:** `resolveAdminId()` silently returned a hardcoded `DEV_ADMIN_ID` when no JWT principal was present, meaning production content mutations could be attributed to the wrong actor.

**Fix:** The method now:
1. Returns the real UUID from `AdminPrincipal` when a JWT principal is in the SecurityContext (production path).
2. Falls back to `DEV_ADMIN_ID` only when `bigbike.auth.dev-header-enabled=true` (dev/test path — dev-header auth passes permission checks without placing a principal in the context).
3. Throws `UnauthorizedException` when no principal is present and `devHeaderEnabled=false` (production default).

This matches the `AdminMediaController` pattern for production while preserving dev/test backward compatibility.

**File:** `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/admin/AdminContentController.java`

---

### CMS-007 — Menu item URL validation

**Root cause:** `AdminMenuService.createMenuItem` and `updateMenuItem` accepted any URL string without scheme validation, allowing `javascript:alert(1)` and similar XSS vectors.

**Fix:** Added `validateMenuItemUrl(String url)` private method:
- Returns early for null/blank (optional field for group/header items).
- Blocks: `javascript:`, `data:`, `vbscript:`, `//` (protocol-relative), CRLF characters.
- Allows: `/` (relative path), `https://`, `http://`, `mailto:`, `tel:`, `#` (in-page anchor).
- Throws `ValidationException("INVALID_MENU_ITEM_URL", ...)` for any other scheme.
- Called from both `createMenuItem` and `updateMenuItem`.

**File:** `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminMenuService.java`

---

### CMS-008 — Batch settings isPublic guard

**Finding:** `BatchSettingUpdate` record has only `key` and `value` fields — there is no `isPublic` field in the DTO. The batch endpoint structurally cannot change the `isPublic` flag; the only entry-point for that mutation is the single-update endpoint which already applies the sensitive-key guard. No code change required; a comment was added to document the structural exclusion.

**File:** `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminSettingsService.java` (comment only)

---

### CMS-009 — PublishStatus enum documentation and guard

**Root cause:** `PENDING` and `PRIVATE` are WordPress-import artifacts that should not be settable as targets via the admin API. They lacked documentation explaining their reserved status, and `validatePublishTransition` did not explicitly reject them as targets.

**Fix:**
- Added full Javadoc to `PublishStatus.java` explaining valid vs. reserved states.
- Added per-constant Javadoc for `PENDING`, `PRIVATE`, and `TRASH`.
- Added an explicit early-return check in `validatePublishTransition`: if `to == PENDING || to == PRIVATE` → emit `RESERVED_PUBLISH_STATUS` error.

**Files:**
- `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/domain/catalog/PublishStatus.java`
- `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminMutationValidators.java`

---

### CMS-010 — Slider and HomeVideo audit logs

**Root cause:** `AdminSliderService` and `AdminHomeVideoService` performed mutations (create, update, delete, reorder) without writing audit log entries, leaving no trace in the audit trail.

**Fix:** Both services now:
- Inject `AuditLogJpaRepository`.
- Resolve the acting admin UUID from `SecurityContextHolder` (null when called via dev-header auth without JWT — stored as null resourceId).
- Write audit entries for:
  - Slider: `SLIDER_CREATED`, `SLIDER_UPDATED`, `SLIDER_DELETED`, `SLIDER_REORDERED`
  - HomeVideo: `HOME_VIDEO_CREATED`, `HOME_VIDEO_UPDATED`, `HOME_VIDEO_DELETED`, `HOME_VIDEO_REORDERED`
- Use `resourceType` = `"SLIDER"` / `"HOME_VIDEO"` with `resourceId=null` (entity IDs are strings, not UUIDs).
- Store entity snapshots in `afterData` / `beforeData` JSON.

**Files:**
- `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminSliderService.java`
- `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminHomeVideoService.java`

---

### CMS-011 — HomeSlider productLink/link field documentation

**Root cause:** `HomeSlider.productLink` and `HomeSlider.link` were undocumented computed/legacy fields. Consumers (e.g. `app/page.tsx#toHeroSlide`) used a priority chain (`link || productLink || externalLink`) but the derivation and precedence were not documented.

**Fix:** Added TSDoc comments to both fields in `bigbike-web/lib/contracts/public.ts` explaining:
- `productLink`: computed by the backend from the linked product's slug; populated when `productId` is set.
- `link`: legacy/imported field from WordPress data extraction; takes highest priority.

TypeScript check passes (`npx tsc --noEmit` — no errors).

**File:** `bigbike-web/lib/contracts/public.ts`

---

## Files Changed

### Backend
- `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/admin/AdminContentController.java`
- `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/internal/InternalRedirectController.java`
- `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/domain/catalog/PublishStatus.java`
- `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/persistence/repository/redirect/RedirectJpaRepository.java`
- `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminHomeVideoService.java`
- `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminMenuService.java`
- `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminMutationValidators.java`
- `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminRedirectService.java`
- `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminSettingsService.java`
- `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminSliderService.java`
- `bigbike-backend/src/main/resources/application-dev.properties`
- `bigbike-backend/src/test/java/com/bigbike/bigbike_backend/api/Phase1JAdminSettingsMenuCouponApiTest.java`
- `bigbike-backend/src/test/resources/application.properties`

### Frontend / Mobile
- `bigbike-web/app/api/revalidate/route.ts`
- `bigbike-web/lib/contracts/public.ts`
- `bigbike_mobile/lib/core/api/api_endpoints.dart`

---

## Open / Deferred Items

| Item | Reason |
|---|---|
| AdminReportRepositoryQueryTest (Docker error) | Pre-existing: Testcontainers cannot pull `postgres:16-alpine` in this environment. Not a code regression. |
| CMS-002 proxy token propagation | `bigbike-web/proxy.ts` should send `X-Internal-Token` from env var when calling internal redirect endpoints. Not yet implemented — requires Next.js proxy changes. Tracked as follow-up. |
| CMS-007 tests (unit) | Unit tests for `validateMenuItemUrl` (javascript rejected, // rejected, /relative accepted, https accepted, mailto accepted) not added — the method is tested indirectly via the existing `Phase1JAdminSettingsMenuCouponApiTest` menu item flows. Explicit unit tests deferred. |
| CMS-010 slider/homevideo `resourceId` is null | Slider and HomeVideo IDs are strings, not UUIDs. The `AuditLogEntity.resourceId` column is UUID type, so it is stored as null. A schema change to add a `resourceStringId` column would be needed for full searchability. Deferred. |

---

## Business Impact

- **CMS-001 (CRITICAL):** Phase 1J menu/settings/coupon test coverage was entirely broken — 83 tests were untested. Now validated.
- **CMS-002 (HIGH):** Internal redirect API was open to any caller without authentication. Now locked down by default; requires explicit opt-in for dev environments.
- **CMS-007 (SECURITY):** Menu item URLs could contain `javascript:` XSS payloads. Now blocked at the service layer before any data reaches the database or frontend render.
- **CMS-005 (MEDIUM):** Multi-hop redirect loops could have caused infinite redirect chains in production. Now detected and rejected at save time.
- **CMS-003:** Cache revalidation was silently broken (TypeScript error at build time). Now passes.
