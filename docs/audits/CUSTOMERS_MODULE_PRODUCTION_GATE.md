# Customers Module — Production Gate Report

**Date:** 2026-05-06  
**Auditor:** Claude (Senior Backend/Frontend Engineer)  
**Verdict:** ✅ PRODUCTION_READY (no CRITICAL or HIGH remaining)

---

## Gate Checks

### Gate 1 — V64 migration exists and is correct

**Result: ✅ PASS**

File: `bigbike-backend/src/main/resources/db/migration/V64__add_customer_email_phone_unique.sql`

```sql
CREATE UNIQUE INDEX IF NOT EXISTS customers_email_unique
    ON customers (email)
    WHERE email IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS customers_phone_unique
    ON customers (phone)
    WHERE phone IS NOT NULL;
```

Partial indexes (`WHERE ... IS NOT NULL`) allow multiple rows with `NULL` email or phone, matching PostgreSQL semantics. `IF NOT EXISTS` makes migration safe to re-run.

**Operator pre-flight:** If production data contains duplicate emails or phones, Flyway will fail with a descriptive index-creation error. Resolve duplicates with:
```sql
-- Find duplicates
SELECT email, COUNT(*) FROM customers WHERE email IS NOT NULL GROUP BY email HAVING COUNT(*) > 1;
SELECT phone, COUNT(*) FROM customers WHERE phone IS NOT NULL GROUP BY phone HAVING COUNT(*) > 1;
```

---

### Gate 2 — Unique indexes enforce at DB level

**Result: ✅ PASS**

- Unique indexes exist in V64 migration (Gate 1).
- All three mutation paths (`register`, `updateProfile`, `AdminCustomerService.updateCustomer`) now catch `DataIntegrityViolationException` on concurrent duplicate inserts and return HTTP 409 CONFLICT instead of HTTP 500.
- Pre-checks (`findByEmail` / `findByPhone` before save) provide a fast path for the common case; the `saveAndFlush` catch handles the race window.

---

### Gate 3 — Email/phone normalization consistent across all paths

**Result: ✅ PASS** (fixed during this audit cycle)

| Path | Email normalization | Phone normalization |
|------|--------------------|--------------------|
| `CustomerAuthService.register()` | `toLowerCase(ROOT).trim()` | `trim()` |
| `CustomerAuthService.updateProfile()` | `toLowerCase(ROOT).trim()` | `trim()` |
| `CustomerAuthService.findByEmailOrPhone()` (login) | `toLowerCase(ROOT).trim()` | `trim()` |
| `AdminCustomerService.updateCustomer()` | `toLowerCase(ROOT).trim()` | `trim()` |

**Operator pre-flight for existing data:** Customers who registered before this fix may have mixed-case emails stored. Run before deploying:
```sql
UPDATE customers SET email = LOWER(TRIM(email)) WHERE email IS NOT NULL;
UPDATE customers SET phone = TRIM(phone) WHERE phone IS NOT NULL;
```

---

### Gate 4 — Admin audit snapshot correct before/after for email/phone/displayName changes

**Result: ✅ PASS** (fixed during this audit cycle)

`AdminCustomerService.updateCustomer()`:
- `String beforeSnapshot = snapshot(customer)` is now captured **immediately after** `findById()`, before any `customer.setEmail()` / `customer.setPhone()` / `customer.setDisplayName()` mutation.
- `afterData` is captured via `snapshot(customer)` after all mutations and `saveAndFlush()`.
- The `snapshot()` helper records `email`, `phone`, `displayName`, and `status`.

---

### Gate 5 — Existing session rejected on all protected endpoints after DISABLED/BLOCKED/PENDING

**Result: ✅ PASS**

Two-layer defense:

**Layer 1 — Synchronous revocation:** `AdminCustomerService.updateCustomerStatus()` calls `customerSessionService.revokeAllSessions(customerId)` for any non-ACTIVE status. All DB session rows are set to REVOKED before the HTTP response is returned to the admin.

**Layer 2 — Filter-level status check:** `CustomerSessionFilter` (runs on every request) loads the customer entity after resolving the session token and verifies `status == "ACTIVE"` before granting `ROLE_CUSTOMER`. A revoked or ACTIVE-check-failed session falls through to the existing 401 handler.

Protected endpoints confirmed gated by `hasRole("CUSTOMER")` in `SecurityConfig`:
- `/api/v1/customer/me`
- `/api/v1/customer/addresses` and `/api/v1/customer/addresses/**`
- `/api/v1/customer/orders` and `/api/v1/customer/orders/**`

`/api/v1/customer/auth/refresh` is `permitAll()` at the route level but `CustomerAuthService.refresh()` explicitly checks `status == ACTIVE` and revokes the refresh session before throwing 401.

Test evidence: `Phase1I1CustomerStatusLoginTest.adminDisable_existingSessionCookie_isRejected()` — login → confirm `/me` works → admin PATCH /status DISABLED → same cookie returns 401 on `/me` → all active sessions in DB verified REVOKED.

---

### Gate 6 — Legacy phpass login rehashes to Argon2id

**Result: ✅ PASS**

`CustomerAuthService.login()`:
1. `passwordService.verify(req.password(), customer.getPasswordHash())` — dispatches to `verifyPhpass()` for `$P$`/`$H$` prefix hashes.
2. On success, `passwordService.isLegacyHash()` returns `true`.
3. `customer.setPasswordHash(passwordService.hash(req.password()))` stores Argon2id hash.
4. Saved immediately; subsequent logins use Argon2id path.

`PasswordService.verifyPhpass()` implements the WordPress PHPass portable hash algorithm using `MessageDigest("MD5")` (JDK built-in, no external dependency). Constant-time comparison via `MessageDigest.isEqual()`.

---

### Gate 7 — Admin customer list: no N+1, no full table scan

**Result: ✅ PASS**

`AdminCustomerService.listCustomers()`:
- Uses `JpaSpecificationExecutor.findAll(Specification, Pageable)` — DB-level `WHERE` + `ORDER BY createdAt DESC` + `LIMIT`/`OFFSET`. Only the requested page is loaded.
- After fetching the page, a **single** JPQL aggregate query (`countAndSumByCustomerIds`) fetches `COUNT(*)` and `SUM(totalAmount)` grouped by `customerId` for all IDs on the page.
- Result assembled from `Map<UUID, long[]>` — zero additional per-row queries.

Complexity: **O(page_size) rows + 1 aggregate query** (was: O(total_customers) rows + O(page_size) queries).

---

### Gate 8 — Mobile profile/address envelope unwrap correct

**Result: ✅ PASS**

`bigbike_mobile/lib/core/providers/auth_provider.dart`:
- `_fetchMe()`: `final data = envelope['data'] as Map<String, dynamic>;` → `CustomerProfile.fromJson(data)`
- `updateProfile()`: `final updated = envelope['data'] as Map<String, dynamic>;` → `CustomerProfile.fromJson(updated)`

`bigbike_mobile/lib/features/account/addresses_screen.dart`:
- `_load()`: `final envelope = await ApiClient().get<Map<String, dynamic>>(...)` → `(envelope['data'] as List? ?? []).cast<...>()`

All three call sites correctly unwrap the `{ data: T, meta: {...} }` envelope before passing to model constructors.

---

### Gate 9 — All new tests present in test suite

**Result: ✅ PASS**

`Phase1I1CustomerStatusLoginTest.java` — 8 test methods:
1. `login_disabledCustomer_rejected`
2. `login_blockedCustomer_rejected`
3. `login_pendingCustomer_rejected`
4. `login_disabledCustomer_doesNotCreateSession`
5. `login_activeCustomer_stillWorks`
6. `adminCanDisableCustomer_thenCustomerLoginRejected`
7. `adminDisable_existingSessionCookie_isRejected` *(new — CRIT-1 end-to-end)*
8. `login_disabledCustomer_errorResponseDoesNotLeakStatus`

Test run from fix report: **54 passed, 0 failures, 0 errors** (Phase1DCustomerAuthTest, Phase1I1CustomerStatusLoginTest, Phase1IAdminManagementApiTest, PasswordServiceTest).

---

## Open Items (not blocking production)

| ID | Severity | Issue | Owner |
|----|----------|-------|-------|
| PRE-1 | LOW | `Phase1LReturnsApiTest.java` encoding corruption | Separate task |
| PRE-2 | LOW | `login_withPhone_succeeds` flakiness (sub-8-digit phone) | Separate task |
| PRE-3 | MEDIUM | `CustomerResetPasswordRequest` min password 6 vs service 8 | Separate task |
| PRE-4 | MEDIUM | Email-verification resend endpoint missing | Separate task |
| PRE-5 | MEDIUM | Admin frontend: PENDING missing from status dropdowns | Separate task |
| PRE-6 | LOW | `buildOrderSummary()` loads all orders for single customer | Acceptable at current scale |
| PRE-7 | LOW | Session-disable test only covers `/me` (not `/addresses`, `/orders`) | Separate task |

---

## Verdict

> **✅ PRODUCTION_READY**

All CRITICAL and HIGH issues are resolved. The MEDIUM and LOW open items are tracked as separate tasks and do not block deployment. The **operator pre-flight steps** in Gate 1 (duplicate data resolution) and Gate 3 (email/phone normalization migration) must be executed against the production database before the deployment rolls out.
