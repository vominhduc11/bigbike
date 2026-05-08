# CUSTOMER_AUTH_ORDERS_RETURNS_FIX_REPORT

**Date:** 2026-05-08
**Engineer:** Backend + Full-stack
**Phase:** 7 (follows Customer Auth+Orders+Returns Audit — Phase 6, audit dated 2026-05-07)
**Source audit:** `docs/audits/CUSTOMER_AUTH_ORDERS_RETURNS_AUDIT.md`
**Status:** COMPLETE

---

## Executive Summary

| Issue | Severity | Status | Description |
|---|---|---|---|
| CUSTRET-001 | CRITICAL | **FIXED** | Phase1I1CustomerStatusLoginTest: 2 tests failing due to missing `@Sql` seed (role/permission data not loaded) |
| CUSTRET-002 | HIGH | **FIXED** | Customer return endpoints lacked `ApiDataResponse` envelope; now wrapped; tests + web updated |
| CUSTRET-003 | HIGH | **FIXED** | `CustomerResetPasswordRequest.password` `@Size(min=6)` → `@Size(min=8, max=256)` |
| CUSTRET-004 | MEDIUM | **FIXED** | Created `ClientIpResolver` component; `CustomerAuthController.getClientIp()` now uses trusted-proxy XFF |
| CUSTRET-005 | MEDIUM | **DEFERRED** | Admin return endpoints raw `PageResult` — admin FE already handles both patterns; deferring to avoid risk |
| CUSTRET-006 | MEDIUM | **FIXED** | `AdminReturnService.restoreStockForReturn()` now handles product-level (no-variant) items + idempotency guard |
| CUSTRET-007 | LOW | **CONFIRMED SAFE** | `CustomerRegisterRequest.phone` `@Pattern` without `@NotBlank` — empty string fails pattern; null is correct for optional phone |
| CUSTRET-008 | LOW | **FIXED** | Added `emailVerified` boolean field to `CustomerSummary`; mapped from `c.getEmailVerifiedAt() != null` |
| CUSTRET-009 | LOW | **FIXED** | Added `noteType` field to `OrderNoteResponse`; mapped from `OrderNoteEntity.getNoteType()`; web type + template updated |
| CUSTRET-010 | LOW | **FIXED** | Added `verifyEmail` constant to `ApiEndpoints` in `bigbike_mobile` |

---

## Section 1: CUSTRET-001 — Test Cache Isolation (CRITICAL → FIXED)

### Root Cause

`Phase1I1CustomerStatusLoginTest` uses real JWT admin authentication (`POST /api/v1/auth/login`), which triggers `AdminPermissionService.getPermissionsForRole("ADMIN")`. This queries the `admin_roles` / `role_permissions` tables. However, Flyway is disabled in the H2 test environment (`spring.flyway.enabled=false`), so V49 migration (which seeds `customers.read`, `customers.write` for ADMIN) was never executed. The tables were empty, causing all admin permission checks to fail with 403.

Other tests using JWT auth (e.g., `Phase1LReturnsApiTest`) had `@Sql(scripts = "/db/test-seed.sql", ...)` which seeds all roles and permissions. `Phase1I1CustomerStatusLoginTest` was missing this annotation.

### Fix

Added `@Sql(scripts = "/db/test-seed.sql", executionPhase = Sql.ExecutionPhase.BEFORE_TEST_CLASS)` to `Phase1I1CustomerStatusLoginTest`.

### Evidence Paths

- `bigbike-backend/src/test/java/com/bigbike/bigbike_backend/api/Phase1I1CustomerStatusLoginTest.java` (modified)
- `bigbike-backend/src/test/resources/db/test-seed.sql` (unchanged — already had role/permission seed)
- `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/auth/AdminPermissionService.java` (unchanged — root cause confirmed by reading)

---

## Section 2: CUSTRET-002 — Customer Return Endpoints Missing Envelope (HIGH → FIXED)

### Root Cause

`CustomerOrderController` returned raw `List<CustomerReturnResponse>` and raw `CustomerReturnResponse` from the three return endpoints (`GET /customer/orders/returns`, `GET /customer/orders/returns/{id}`, `POST /{orderId}/returns`). All other customer endpoints use `ApiDataResponse<T>` or `ApiListResponse<T>`. The web `client-api.ts` worked around this via `payload.data ?? payload` fallback (line 56).

### Fix

Wrapped all three return endpoints in `ApiDataResponse<>` using `apiResponseFactory.data(...)`. Updated `Phase1LReturnsApiTest` assertions from `$.returnNumber`, `$.id`, `$.items[0].productName` etc. to `$.data.returnNumber`, `$.data.id`, `$.data.items[0].productName`.

The web `clientRequest` helper already had the fallback `(payload as { data: T }).data ?? (payload as T)` (line 56 of `client-api.ts`), so the frontend now cleanly hits the `payload.data` path without any additional changes needed.

### Evidence Paths

- `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/order/CustomerOrderController.java` (modified)
- `bigbike-backend/src/test/java/com/bigbike/bigbike_backend/api/Phase1LReturnsApiTest.java` (3 jsonPath assertions updated)
- `bigbike-web/lib/api/client-api.ts` (no change needed — fallback already handles both)

---

## Section 3: CUSTRET-003 — Password Reset DTO min-length (HIGH → FIXED)

### Root Cause

`CustomerResetPasswordRequest.password` was annotated `@Size(min = 6, ...)` but `CustomerPasswordResetService.resetPassword()` enforces `newPassword.length() < 8` → 400 `TOO_SHORT`. A 6 or 7 character password would pass DTO validation but fail the service-layer check — inconsistent validation boundary.

### Fix

Changed `@Size(min = 6, message = "Password must be at least 6 characters")` to `@Size(min = 8, max = 256, message = "Password must be at least 8 characters")` in `CustomerResetPasswordRequest.java`. Now matches `CustomerRegisterRequest.password` (which had `@Size(min = 8)` already).

### Evidence Paths

- `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/customer/dto/CustomerResetPasswordRequest.java` (modified)

---

## Section 4: CUSTRET-004 — CustomerAuthController getClientIp() XFF (MEDIUM → FIXED)

### Root Cause

`CustomerAuthController.getClientIp()` always returned `request.getRemoteAddr()` (the proxy IP), while `RateLimitingFilter.resolveClientIp()` correctly read XFF from trusted proxies (configurable via `bigbike.trusted-proxies`). This meant `customer_sessions.ip_address` and password reset audit logs stored the proxy IP in load-balanced deployments.

### Fix

Created `ClientIpResolver` (`@Component`) in `com.bigbike.bigbike_backend.config` that encapsulates the trusted-proxy XFF pattern. Injected it into `CustomerAuthController` and replaced the `getClientIp()` body with `clientIpResolver.resolve(request)`.

Both `RateLimitingFilter` and `CustomerAuthController` now use the same trusted-proxy logic. The `ClientIpResolver` shares the same `bigbike.trusted-proxies` configuration property (default: `127.0.0.1,::1`).

### Evidence Paths

- `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/config/ClientIpResolver.java` (new file)
- `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/customer/CustomerAuthController.java` (modified)

---

## Section 5: CUSTRET-005 — Admin Return Endpoints Raw Response (MEDIUM → DEFERRED)

### Decision

Admin `GET /admin/returns`, `GET /admin/returns/{id}`, `PATCH /admin/returns/{id}/status` return raw `PageResult<>` / `AdminReturnDetailResponse`. The admin FE's `adminApi.js` already uses `parseListPayload()` (which handles both raw and wrapped list payloads) for the list, and `payload?.data || payload || {}` for detail/update calls.

Wrapping these endpoints would require updating both the admin FE and the Blender/other admin consumers. Since the admin FE is already compatible with both patterns and there is no active breakage, this change is deferred to a dedicated admin API normalization task to minimize risk.

---

## Section 6: CUSTRET-006 — Return Stock Restore Skips Product-Level Items (MEDIUM → FIXED)

### Root Cause

`AdminReturnService.restoreStockForReturn()` had `if (li.getProductVariantId() == null) return;` (effectively), skipping product-level line items (no variant). `OrderStockRestoreService` (cancel/refund path) already has a product-level branch since V82 migration made `product_variant_id` nullable and added `product_id` to `stock_movements`.

### Fix

Refactored `restoreStockForReturn()` to:
1. Added an **idempotency guard** at the top: `if (stockMovementRepo.existsByReferenceTypeAndReferenceId("RETURN", returnId)) return;` — prevents double-restore if called twice.
2. Changed the variant-null check from early-return to an `if/else if` branch.
3. Added **product-level restore branch**: locks product with `productRepo.findByIdForUpdate()`, increments `product.stockQuantity`, updates `ProductStockState` (mirrors `OrderStockRestoreService.doRestore()`), saves, writes `StockMovementEntity` with `productId` set and `variant` null.
4. Injected `ProductJpaRepository` into `AdminReturnService`.

Mirrors the exact pattern from `OrderStockRestoreService.doRestore()` per the V82 schema.

### Evidence Paths

- `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminReturnService.java` (modified)
- `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/inventory/OrderStockRestoreService.java` (pattern reference, unchanged)

---

## Section 7: CUSTRET-007 — Phone Validation in CustomerRegisterRequest (LOW → CONFIRMED SAFE)

### Analysis

`CustomerRegisterRequest.phone` has `@Pattern(regexp = "^\\+?[0-9]{8,15}$")` without `@NotBlank`. Jakarta Bean Validation's `@Pattern` skips null values (null phone is valid — phone is optional for registration). An empty string `""` does NOT match the pattern (requires 8-15 digits) so it is correctly rejected. The service's `trim()` + null-check provides secondary guard.

No code change needed. The current behavior is correct: null phone passes (optional), non-empty invalid phone fails the pattern.

---

## Section 8: CUSTRET-008 — Missing emailVerified in CustomerSummary (LOW → FIXED)

### Root Cause

`CustomerSummary` (returned by `/me`, login, register, refresh, profile update) had 7 fields with no email verification status. Frontend/mobile could not show email verification state to users.

### Fix

Added `boolean emailVerified` field to `CustomerSummary` record. Updated `CustomerAuthService.toSummary()` to map `c.getEmailVerifiedAt() != null`. Updated `CustomerProfile` TypeScript type in `bigbike-web/lib/contracts/commerce.ts` to include `emailVerified?: boolean`.

### Evidence Paths

- `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/customer/dto/CustomerSummary.java` (modified)
- `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/customer/CustomerAuthService.java` (modified — `toSummary` method)
- `bigbike-web/lib/contracts/commerce.ts` (modified — `CustomerProfile` type)

---

## Section 9: CUSTRET-009 — Missing noteType in OrderNoteResponse (LOW → FIXED)

### Root Cause

`OrderNoteResponse` only had `{id, content, createdAt}`. `OrderNoteEntity` has `noteType` field. The web template at `page.tsx:432` read `note.type` (which was always `undefined`) to render the label, falling back to "Ghi chú" every time.

### Fix

Added `String noteType` to `OrderNoteResponse`. Updated `OrderReadService.toNote()` to include `e.getNoteType()`. Updated `OrderNote` TypeScript type in `commerce.ts` (renamed `type?` to `noteType?`). Updated the template in `app/tai-khoan/don-hang/[id]/page.tsx` to use `note.noteType` instead of `note.type`.

### Evidence Paths

- `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/order/dto/OrderNoteResponse.java` (modified)
- `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/order/OrderReadService.java` (modified — `toNote` method)
- `bigbike-web/lib/contracts/commerce.ts` (modified — `OrderNote` type)
- `bigbike-web/app/tai-khoan/don-hang/[id]/page.tsx` (modified — line 433)

---

## Section 10: CUSTRET-010 — Mobile verifyEmail Constant (LOW → FIXED)

### Fix

Added `static const String verifyEmail = '/api/v1/customer/auth/verify-email';` to `ApiEndpoints` in the Auth section, adjacent to the other auth constants.

### Evidence Paths

- `bigbike_mobile/lib/core/api/api_endpoints.dart` (modified)

---

## Files Changed

### New Files
- `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/config/ClientIpResolver.java`

### Modified Files (Backend)
- `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/customer/CustomerAuthController.java`
- `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/customer/dto/CustomerResetPasswordRequest.java`
- `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/customer/dto/CustomerSummary.java`
- `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/order/CustomerOrderController.java`
- `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/order/dto/OrderNoteResponse.java`
- `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminReturnService.java`
- `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/customer/CustomerAuthService.java`
- `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/order/OrderReadService.java`
- `bigbike-backend/src/test/java/com/bigbike/bigbike_backend/api/Phase1I1CustomerStatusLoginTest.java`
- `bigbike-backend/src/test/java/com/bigbike/bigbike_backend/api/Phase1LReturnsApiTest.java`

### Modified Files (Web)
- `bigbike-web/lib/contracts/commerce.ts`
- `bigbike-web/app/tai-khoan/don-hang/[id]/page.tsx`

### Modified Files (Mobile)
- `bigbike_mobile/lib/core/api/api_endpoints.dart`

---

## Test Results

### Before Fixes

| Test Suite | Tests Run | Failures | Status |
|---|---|---|---|
| Phase1DCustomerAuthTest | 20 | 0 | PASS |
| Phase1I1CustomerStatusLoginTest | 8 | **2** | **FAIL** |
| Phase1GOrderReadApiTest | 22 | 0 | PASS |
| Phase1LReturnsApiTest | 27 | 0 | PASS |
| Phase1HAdminOrderApiTest | 45 | 0 | PASS |
| Phase1FCheckoutApiTest | 41 | 0 | PASS |

### After Fixes

| Test Suite | Tests Run | Failures | Status |
|---|---|---|---|
| Phase1DCustomerAuthTest | 20 | 0 | **PASS** |
| Phase1I1CustomerStatusLoginTest | 8 | **0** | **PASS** ✓ |
| Phase1GOrderReadApiTest | 22 | 0 | **PASS** |
| Phase1LReturnsApiTest | 27 | 0 | **PASS** |
| Phase1HAdminOrderApiTest | 45 | 0 | **PASS** |
| Phase1FCheckoutApiTest | 41 | 0 | **PASS** |
| **Full suite** | **1002** | **0** | **PASS** (1 infra error: Docker not available for AdminReportRepositoryQueryTest — pre-existing) |

### Web TypeScript Check

```
npx tsc --noEmit
# Exit 0 — no type errors
```

---

## Open Items

| Item | Reason for Deferral |
|---|---|
| CUSTRET-005: Admin return endpoints — wrap in ApiDataResponse | Admin FE already handles both raw and wrapped patterns; wrapping requires coordinated FE update; deferring to avoid risk |
| Phase1DCustomerAuthTest: verify-email endpoint has no test coverage | Noted in audit; not part of this fix scope; separate test task |
| `POST /customer/auth/verify-email` has no rate limit | Noted in audit as LOW risk (token is 64 hex chars, computationally infeasible to brute-force) |
| CustomerRegisterRequest phone: document as explicitly optional | Low risk; current behavior is correct |

---

## Business Impact Summary

- **CUSTRET-001**: Test suite is green again. Admin customer management API (disable/enable) is now correctly tested end-to-end via HTTP, not just direct DB manipulation.
- **CUSTRET-002**: Customer returns API is now consistent with all other customer endpoints. Web and mobile clients using the standard `payload.data` extraction now work correctly without fragile fallback patterns.
- **CUSTRET-003**: Password reset DTO validation now correctly rejects 6-7 character passwords at the validation layer (400 with field error) instead of passing validation then failing at service layer (also 400 but with less clear UX).
- **CUSTRET-004**: Customer session IP addresses and password reset audit logs now correctly record the real client IP (not proxy IP) when deployed behind a trusted reverse proxy.
- **CUSTRET-006**: Returns for products without variants (no-variant products) now correctly restore inventory on completion/refund. Idempotency guard prevents double-restore.
- **CUSTRET-008**: Customer profile response now includes `emailVerified` flag enabling frontend/mobile to show email verification status.
- **CUSTRET-009**: Order notes now include `noteType` field enabling proper rendering in the customer order detail timeline.
- **CUSTRET-010**: Mobile app now has the `verifyEmail` endpoint constant for consistent navigation to the email verification API.
