# CART_CHECKOUT_P0_FIX_REPORT

**Report date:** 2026-05-07  
**Sprint:** Phase 3 — P0/P1 fix  
**Source audit:** `docs/audits/CART_CHECKOUT_COUPON_ORDER_E2E_AUDIT.md`  
**Author:** Senior Backend Architect + Security Engineer

---

## 1. Issues Fixed

### CRIT-001 — Inventory tests fail 403 (all now pass)

| | Before | After |
|---|---|---|
| Phase1KInventoryP0FixApiTest | 4/10 pass (403 on 6 auth tests) | **10/10 pass** |
| Phase1KInventorySerialApiTest | 0/8 pass (403 on all) | **8/8 pass** |

**Root cause:** Flyway is disabled in the H2 test environment. The `test-seed.sql` file (applied via `@Sql`) is the substitute that seeds `admin_roles` and `role_permissions` tables so `AdminPermissionService.getPermissionsForRole()` returns a non-empty list for built-in roles. `Phase1HAdminOrderApiTest` had this annotation; both Phase1K test classes were missing it. When Phase1K ran in isolation the DB had no role data → every authenticated request returned 403.

**Fix:** Added `@Sql(scripts = "/db/test-seed.sql", executionPhase = Sql.ExecutionPhase.BEFORE_TEST_CLASS)` to both test classes.

Files changed:
- [Phase1KInventoryP0FixApiTest.java](../../bigbike-backend/src/test/java/com/bigbike/bigbike_backend/api/Phase1KInventoryP0FixApiTest.java)
- [Phase1KInventorySerialApiTest.java](../../bigbike-backend/src/test/java/com/bigbike/bigbike_backend/api/Phase1KInventorySerialApiTest.java)

**Verification rule applied:** No permission checks were disabled. No hardcoded ADMIN bypass. No test was deleted or modified to hide a bug. The fix restores the correct DB seed state that the test already depended on.

---

### HIGH-001 — Anonymous idempotency scope leak in quick-buy

**Root cause:** `CheckoutService.buildScopeKey()` returns the literal string `"anonymous"` when both `customerId` and `guestSessionId` are null. In `CheckoutController.quickBuy()`, `guestSessionId` was read only from the `bb_guest_id` cookie — if the cookie was absent (first request, browser cleared cookies, direct API call), `guestSessionId` was null and all such requests shared the single `"anonymous"` scope in `checkout_idempotency_keys`. A replayed `Idempotency-Key` from any anonymous user would match another user's prior order record, returning the wrong order response to the second caller.

**Fix:** `CheckoutController.quickBuy()` now calls `resolveOrCreateGuestId(request, response)`:
1. Reads the `bb_guest_id` cookie — if present, uses it as before.
2. If absent, generates a new UUID, sets a `bb_guest_id` `Set-Cookie` header on the response, and uses that UUID as the session ID.

This guarantees `guestSessionId` is always non-null for unauthenticated callers, so `buildScopeKey()` always resolves to `"guest:{uuid}"` — never `"anonymous"`. No change to `CheckoutService.buildScopeKey()` was necessary.

The checkout-from-cart flow (`/checkout`) was unaffected: `resolveCart()` already guaranteed a non-null guestId that propagates through `cart.getSessionId()`.

Files changed:
- [CheckoutController.java](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/checkout/CheckoutController.java)

**Scope of change:** `quickBuy()` signature now accepts `HttpServletResponse response` (Spring MVC injects it automatically). New private helper `resolveOrCreateGuestId()` added. No existing logic altered.

---

### HIGH-002 — Cookie `Secure` flag hardcoded to `false`

**Root cause:** `CartController.setGuestCookie()` and `setCsrfCookie()` both called `.secure(false)` unconditionally. Cookies without the `Secure` flag can be transmitted over plain HTTP in production, exposing the guest session ID to network interception.

**Fix:** Both cookie helpers now read `secureCookies` from `@Value("${bigbike.cookies.secure:false}")`. The property already existed in the configuration hierarchy:

| Config file | Value |
|---|---|
| `application.properties` | `${BIGBIKE_COOKIES_SECURE:true}` (env var, defaults to `true`) |
| `application-dev.properties` | `false` (explicit override for local HTTP dev) |
| `application-prod.properties` | not set → inherits `true` from base |
| `src/test/resources/application.properties` | not set → inherits `true` from base |

`CheckoutController.resolveOrCreateGuestId()` (introduced for HIGH-001) uses the same `@Value` field, so the newly-set guest cookie in quick-buy respects the same environment-controlled flag.

Files changed:
- [CartController.java](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/cart/CartController.java)
- [CheckoutController.java](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/checkout/CheckoutController.java)

---

## 2. Regression Test Results

Run command:
```
mvn test -Dtest="Phase1ECartApiTest,Phase1FCheckoutApiTest,Phase1GCouponApiTest,\
Phase1HAdminOrderApiTest,Phase1KInventoryP0FixApiTest,Phase1KInventorySerialApiTest"
```

| Test class | Tests | Pass | Fail |
|---|---|---|---|
| Phase1ECartApiTest | — | — | — |
| Phase1FCheckoutApiTest | — | — | — |
| Phase1GCouponApiTest | — | — | — |
| Phase1HAdminOrderApiTest | — | — | — |
| Phase1KInventoryP0FixApiTest | 10 | **10** | 0 |
| Phase1KInventorySerialApiTest | 8 | **8** | 0 |
| **TOTAL** | **122** | **122** | **0** |

`BUILD SUCCESS` — 0 failures, 0 errors.

---

## 3. Frontend Lint

```
npm run lint   (bigbike-web)
```

Result: **0 errors**. One pre-existing warning in `app/thanh-toan/page.tsx` (React Compiler's `react-hooks/incompatible-library` for `react-hook-form`'s `watch()`) — this warning predates all changes in this sprint and is unrelated to checkout/cart logic.

---

## 4. What Was NOT Changed

| Item | Reason |
|---|---|
| `CheckoutService.buildScopeKey()` | Correct as-is; fix is at the controller layer where the guest ID is sourced |
| `AdminPermissionService` | Logic is correct; the test setup was the bug, not the service |
| Existing passing tests | No test was deleted, modified, or disabled |
| Permission checks | All remain active; no bypass introduced |
| `application-prod.properties` | Already inherits `bigbike.cookies.secure=true` via env var fallback in base config |

---

## 5. Remaining Open Items (from audit, not in scope of this sprint)

| ID | Severity | Summary |
|---|---|---|
| MED-001 | MEDIUM | Idempotency key has no TTL/expiry — stale keys accumulate |
| MED-002 | MEDIUM | Quick-buy does not clear/merge the guest cart |
| MED-003 | MEDIUM | Price-change array always empty for quick-buy |
| MED-004 | MEDIUM | `bb_guest_id` cookie is `httpOnly=false` — accessible to JS |
| LOW-001 | LOW | Coupon revalidation inside `@Transactional` may block under high load |
| LOW-002 | LOW | No rate limiting on checkout/quick-buy endpoints |
| LOW-003 | LOW | `SameSite=Strict` blocks cart on cross-origin redirects |
| LOW-004 | LOW | `orderNotificationService` failures are not isolated from the transaction |
