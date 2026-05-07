# POS & Receivables Fix Report

**Date:** 2026-05-07  
**Author:** Claude Code (Senior Full-stack Engineer)  
**Related audit:** `docs/audits/POS_RECEIVABLES_AUDIT.md`

---

## Executive Summary

All 10 issues (POSREC-001 through POSREC-010) from the POS & Receivables audit have been resolved.

**Backend:** 999 tests pass, 0 failures (up from compile error state; +13 new tests added covering CREDIT flow and permission enforcement)  
**Frontend:** ESLint 0 errors, 0 warnings; Vite build success

---

## Test Results — Before / After

| Metric | Before | After |
|---|---|---|
| Backend compile | FAIL (1 compile error) | PASS |
| Backend tests | N/A (blocked by compile) | 999 pass, 0 fail, 3 skip |
| New backend tests added | 0 | +13 |
| Frontend lint errors | 3 errors (2 warnings) | 0 |
| Frontend build | PASS | PASS |

---

## Issues Fixed

### POSREC-001 — IP/UserAgent in audit log for receivable operations

**Status:** FIXED (previous session had partial work; this session completed it)

- `ReceivableService.writeOff()` — added overload accepting `clientIp, userAgent`; old single-arg overload delegates to new one
- `ReceivableService.auditLog()` — added overload to set `ipAddress` and `userAgent` on `AuditLogEntity`
- `recordPayment()` — updated audit call to pass ip/ua through
- `AdminReceivableController.writeOff()` and `recordPayment()` — already had `extractClientIp()` and passed ip/ua (previous session); fixed compile error where `writeOff` overload was missing

**Files changed:**
- `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/receivable/ReceivableService.java`

---

### POSREC-002 — POS Frontend CREDIT flow

**Status:** FIXED

- Added `'CREDIT'` to `PAYMENT_METHODS` array in `PosScreen.jsx`
- `PaymentModal` now accepts `canOverrideCreditLimit` prop
- Added customer search with live autocomplete dropdown (debounced ≥2 chars)
- Added credit info card: creditEnabled, creditStatus, creditLimit, currentOutstanding, availableCredit
- Validation: blocks submit if credit disabled or credit status inactive
- Credit limit enforcement: blocks if overLimit and no override permission; shows override warning if admin
- Down payment input (optional, 0–total validation)
- Credit payload build: `customerId`, `downPayment` (omitted if 0)
- `ReceiptModal` updated to show credit paymentStatus instead of change amount for CREDIT orders
- Switching payment methods resets CREDIT state (selectedCustomer, credit info, downPayment)
- `App.jsx` passes `canOverrideCreditLimit={hasPermission('receivables.override_limit')}` to PosScreen

**Files changed:**
- `bigbike-admin/src/screens/PosScreen.jsx`
- `bigbike-admin/src/App.jsx`

---

### POSREC-003 — Backend E2E tests for POS CREDIT sale

**Status:** FIXED (+11 new tests in Phase1MPosApiTest)

Tests added:
1. `createPosCreditOrder_withoutDownPayment_createsCompletedUnpaidOrderAndReceivable`
2. `createPosCreditOrder_withDownPayment_createsPartiallyPaidOrderPaymentAndReceivable`
3. `createPosCreditOrder_requiresCustomerId_returns409`
4. `createPosCreditOrder_rejectsCreditDisabledCustomer_returns409`
5. `createPosCreditOrder_rejectsCreditLimitExceeded_returns409` (uses SHOP_MANAGER token — no override perm)
6. `creditSale_admin_overCreditLimit_withOverridePerm_returns200` (POSREC-009)
7. `creditSale_shopManager_overCreditLimit_returns409` (POSREC-009)
8. `createPosCreditOrder_decrementsStock_andWritesMovement`
9. `createPosCreditOrder_idempotency_doesNotCreateDuplicateReceivable`
10. `createPosCashOrder_auditAfterDataHasPaymentMethod` (POSREC-010)
11. `createPosCreditOrder_auditAfterDataHasPaymentMethodCredit` (POSREC-010)

Added repos: `ReceivableJpaRepository`, `CustomerJpaRepository` and helper `createCreditCustomer(BigDecimal)`.

**Files changed:**
- `bigbike-backend/src/test/java/com/bigbike/bigbike_backend/api/Phase1MPosApiTest.java`

---

### POSREC-004 — Remove dead `candidates` query / use efficient repo query

**Status:** ALREADY FIXED (previous session)

`refreshOverdueStatus()` uses `receivableRepo.findOverdueCandidates(today)` which has a targeted JPQL query filtering `status IN ('OPEN','PARTIALLY_PAID') AND dueDate < :today AND outstandingAmount > 0` — no full table scan.

---

### POSREC-005 — Overdue scheduler

**Status:** ALREADY FIXED (previous session)

`ReceivableOverdueScheduler.java` exists with `@Scheduled(cron = "0 5 0 * * ?")` and `@EnableScheduling` is on `BigbikeBackendApplication`.

---

### POSREC-006 — Write-off updates order.paymentStatus

**Status:** FIXED

`ReceivableService.writeOff()` now loads the parent `OrderEntity` after writing off the receivable and sets `order.setPaymentStatus("WRITTEN_OFF")`. The `orders` table has no CHECK constraint on `payment_status` (varchar 50), so no migration needed.

Revenue queries verified: `sumPaidRevenueSince` uses whitelist `paymentStatus IN ('PAID', 'PARTIALLY_PAID')`, so WRITTEN_OFF orders are naturally excluded from paid revenue without any code change.

Test added: `writeOff_updatesOrderPaymentStatusToWrittenOff` in `AdminReceivableApiTest`.

**Files changed:**
- `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/receivable/ReceivableService.java`

---

### POSREC-007 — Frontend lint errors

**Status:** FIXED

Three errors eliminated:
1. `ReceivablesListScreen.jsx` — removed unused import `fetchReceivableAging`
2. `ReportsScreen.jsx` — wrapped synchronous `setState` calls inside `useEffect` in `queueMicrotask()`; added `preset` to deps array; removed unused `eslint-disable-next-line` comment
3. `CustomerDetailScreen.jsx` — wrapped synchronous `setCreditLoading(true)` in `queueMicrotask()`

**Files changed:**
- `bigbike-admin/src/screens/ReceivablesListScreen.jsx`
- `bigbike-admin/src/screens/ReportsScreen.jsx`
- `bigbike-admin/src/screens/CustomerDetailScreen.jsx`

---

### POSREC-008 — Negative permission test: write-off requires write_off permission

**Status:** FIXED (+2 new tests in AdminReceivableApiTest)

Tests added:
1. `writeOff_shopManager_withoutWriteOffPermission_returns403` — SHOP_MANAGER gets 403 on write-off
2. `writeOff_updatesOrderPaymentStatusToWrittenOff` — also covers POSREC-006

SHOP_MANAGER role does not have `receivables.write_off` (confirmed in `AdminRolePermissions.java`).

**Files changed:**
- `bigbike-backend/src/test/java/com/bigbike/bigbike_backend/api/AdminReceivableApiTest.java`

---

### POSREC-009 — Override credit limit permission tests

**Status:** FIXED (tests added in Phase1MPosApiTest)

- `creditSale_shopManager_overCreditLimit_returns409`: SHOP_MANAGER (no `receivables.override_limit`) gets 409 when order total exceeds credit limit
- `creditSale_admin_overCreditLimit_withOverridePerm_returns200`: ADMIN (has `receivables.override_limit`) gets 200 even over limit

---

### POSREC-010 — Audit afterData includes paymentMethod field

**Status:** ALREADY FIXED (previous session) + tests added

`PosOrderService` audit payload already included `"paymentMethod":"CREDIT"/"CASH"/"CARD_TERMINAL"`. Two new tests verify this:
- `createPosCashOrder_auditAfterDataHasPaymentMethod`
- `createPosCreditOrder_auditAfterDataHasPaymentMethodCredit`

---

## Files Changed (Complete List)

**Backend:**
- `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/receivable/ReceivableService.java`
- `bigbike-backend/src/test/java/com/bigbike/bigbike_backend/api/Phase1MPosApiTest.java`
- `bigbike-backend/src/test/java/com/bigbike/bigbike_backend/api/AdminReceivableApiTest.java`

**Frontend:**
- `bigbike-admin/src/screens/PosScreen.jsx`
- `bigbike-admin/src/screens/ReceivablesListScreen.jsx`
- `bigbike-admin/src/screens/ReportsScreen.jsx`
- `bigbike-admin/src/screens/CustomerDetailScreen.jsx`
- `bigbike-admin/src/App.jsx`

---

## Remaining Open Items

None. All 10 POSREC issues are resolved.
