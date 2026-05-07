HISTORICAL_REPORT_ONLY - Not canonical. Validate against current code and canonical docs.

# Customers Module — Post-Fix Audit

**Date:** 2026-05-06  
**Auditor:** Claude (Senior Backend/Frontend Engineer)  
**Scope:** Regression + production-readiness check after 6-blocker fix set (see `CUSTOMERS_MODULE_FIX_REPORT.md`).

---

## Fix Status (from CUSTOMERS_MODULE_FIX_REPORT.md)

| ID | Severity | Issue | Fix Status |
|----|----------|-------|------------|
| CRIT-1 | CRITICAL | Sessions stay valid after DISABLE/BLOCK/PENDING | ✅ Fixed |
| CRIT-2 | CRITICAL | Mobile profile/address envelope unwrap broken | ✅ Fixed |
| HIGH-1 | HIGH | Admin list `findAll()` + N+1 order query | ✅ Fixed |
| HIGH-2 | HIGH | No DB UNIQUE constraint on email / phone | ✅ Fixed |
| HIGH-4 | HIGH | `firstName`/`lastName` dropped on register | ✅ Fixed |
| HIGH-5 | HIGH | Legacy phpass hashes cannot authenticate | ✅ Fixed |
| DTO-VAL | MEDIUM | Missing Bean Validation on 4 request DTOs | ✅ Fixed |

---

## New Findings During Post-Fix Audit

### AUDIT-1 — HIGH (FIXED) — Audit snapshot captures post-mutation values for email/phone

**File:** `AdminCustomerService.java`, `updateCustomer()`  
**Root cause:** `String beforeSnapshot = snapshot(customer)` was called **after** `customer.setEmail(newEmail)` and `customer.setPhone(...)` had already mutated the entity. The audit log's `beforeData` field therefore recorded the **new** email/phone, making the before/after diff useless for those fields.  
**Fix:** Moved `String beforeSnapshot = snapshot(customer)` to immediately after `findById()`, before any field mutation. Also replaced `customerRepo.save()` with `customerRepo.saveAndFlush()` inside a `DataIntegrityViolationException` catch block to return 409 instead of 500 on concurrent duplicate inserts.  
**Status:** ✅ Fixed in this audit cycle.

---

### AUDIT-2 — MEDIUM (FIXED) — Email not normalized to lowercase in register / login / customer-update paths

**Files:** `CustomerAuthService.java` — `register()`, `updateProfile()`, `findByEmailOrPhone()`  
**Root cause:** Admin update path used `req.email().toLowerCase(Locale.ROOT).trim()`. Customer-facing paths stored and looked up whatever case the user typed. With the unique index now enforced, `USER@test.com` and `user@test.com` could coexist as two distinct rows.  
**Fix:**
- `register()`: normalized email to `toLowerCase(ROOT).trim()` and phone to `trim()` upfront into local variables; pre-checks and `customer.set*()` calls use those variables.
- `updateProfile()`: same normalization applied before the uniqueness pre-check and the `customer.set*()` calls.
- `findByEmailOrPhone()`: email login normalized to `toLowerCase(ROOT).trim()` before repository lookup; phone login trimmed.

**Note for existing data:** Customers who registered with mixed-case emails before this fix have their original-case email in the DB. A one-time DBA migration (`UPDATE customers SET email = LOWER(TRIM(email)) WHERE email IS NOT NULL`) should be run before deploying this change to ensure login still works for those customers.  
**Status:** ✅ Fixed in this audit cycle.

---

### AUDIT-3 — MEDIUM (FIXED) — `DataIntegrityViolationException` not caught → HTTP 500 on concurrent duplicate

**Files:** `CustomerAuthService.register()`, `CustomerAuthService.updateProfile()`, `AdminCustomerService.updateCustomer()`  
**Root cause:** Pre-checks (`findByEmail` then `save`) are non-atomic. Two concurrent requests with the same email both pass the pre-check; the second `save()` hits the unique index and propagates a `DataIntegrityViolationException` as HTTP 500.  
**Fix:** Replaced `save()` with `saveAndFlush()` wrapped in a `try/catch (DataIntegrityViolationException)` that rethrows `ConflictException` (HTTP 409). Applied to all three mutation paths above.  
**Status:** ✅ Fixed in this audit cycle.

---

### AUDIT-4 — LOW (FIXED) — Dead `matchesQ()` method in `AdminCustomerService`

**Root cause:** `matchesQ()` was used in the old `findAll().stream()` filter; it became unreferenced after the HIGH-1 Specification refactor.  
**Fix:** Method removed.  
**Status:** ✅ Fixed in this audit cycle.

---

### AUDIT-5 — LOW (FIXED) — Unused `PaginationService` injection in `AdminCustomerService`

**Root cause:** `PaginationService` was injected but not called anywhere after the HIGH-1 refactor replaced its usage with Spring Data's `PageRequest`.  
**Fix:** Field, constructor parameter, and constructor assignment removed.  
**Status:** ✅ Fixed in this audit cycle.

---

## Remaining Pre-existing Issues (out of scope)

These were flagged before or during the fix cycle and are tracked as separate tasks:

| ID | Severity | Issue |
|----|----------|-------|
| PRE-1 | LOW | `Phase1LReturnsApiTest.java` curly-quote encoding corruption blocks normal `mvn test` |
| PRE-2 | LOW | `login_withPhone_succeeds` test can generate sub-8-digit phones (~0.1% flakiness) |
| PRE-3 | MEDIUM | `CustomerResetPasswordRequest` minimum password is 6 chars; service enforces 8 |
| PRE-4 | MEDIUM | Email-verification resend endpoint missing |
| PRE-5 | MEDIUM | Admin frontend: PENDING status missing from status dropdowns |
| PRE-6 | LOW | `buildOrderSummary()` (detail endpoint) calls `findByCustomerId()` — loads all orders; acceptable for single-customer detail but sub-optimal at scale |
| PRE-7 | LOW | Session-disable test (`adminDisable_existingSessionCookie_isRejected`) only exercises `/me`; `/addresses` and `/orders` paths not covered |

---

## Evidence Summary

| Check | Evidence |
|-------|----------|
| V64 migration exists | `db/migration/V64__add_customer_email_phone_unique.sql` — partial unique indexes `WHERE email IS NOT NULL` and `WHERE phone IS NOT NULL` |
| Email/phone normalization consistent | All 4 paths (admin update, register, updateProfile, login lookup) now normalize to lowercase+trim for email, trim for phone |
| Audit before/after correct | `beforeSnapshot` captured before all field mutations in `updateCustomer()` |
| Session revoked on status change | `AdminCustomerService.updateCustomerStatus()` calls `customerSessionService.revokeAllSessions()` for non-ACTIVE status; `CustomerSessionFilter` checks status on every request |
| Customer routes gated | `SecurityConfig`: `/api/v1/customer/me`, `/api/v1/customer/addresses/**`, `/api/v1/customer/orders/**` all require `hasRole("CUSTOMER")` |
| Refresh path checks status | `CustomerAuthService.refresh()` checks `status == ACTIVE` and revokes session on failure |
| Phpass rehash on login | `CustomerAuthService.login()` calls `passwordService.isLegacyHash()` and rehashes to Argon2id if true |
| Admin list N+1 eliminated | `listCustomers()` uses `JpaSpecificationExecutor` + `PageRequest` + single aggregate query |
| Mobile envelope unwrap | `auth_provider.dart` and `addresses_screen.dart` both extract `envelope['data']` before model construction |
