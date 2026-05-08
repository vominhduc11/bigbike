# POS_RECEIVABLES_AUDIT

**Report date:** 2026-05-07
**Auditor:** Senior Backend Architect + QA Auditor
**Scope:** POS + Receivables / Công nợ
**Phase:** 5 (follows ORDER_PAYMENT_REFUND_WS_FIX_REPORT)
**Status:** SUPERSEDED — see postscript below.

---

> **Postscript 2026-05-08 (BUSINESS_PROCESS_RULE_PRODUCTION_READINESS_AUDIT):** The CRITICAL "no scheduler calls `refreshOverdueStatus()`" item below has been **RESOLVED**. Current code includes `service/receivable/ReceivableOverdueScheduler.java` with `@Scheduled(cron = "0 5 0 * * ?")` (daily 00:05) that calls `receivableService.refreshOverdueStatus()`; `BigbikeBackendApplication.java` declares `@EnableScheduling`. The HIGH "POS frontend missing CREDIT" item has also been **RESOLVED**: `bigbike-admin/src/screens/PosScreen.jsx` line 9 declares `PAYMENT_METHODS = ['CASH', 'CARD_TERMINAL', 'CREDIT']` with full customer-selector / availableCredit / downPayment / creditEnabled gates. Subsequent fix history is captured in `POS_RECEIVABLES_FIX_REPORT.md` and `PRODUCTION_READINESS_GATE.md` (cycle 10, 2026-05-08, all 10 POSREC issues marked resolved).

---

## Executive Summary

All 4 targeted test suites pass with zero failures. The POS and Receivables domain is functional at the core happy-path level. However, a significant number of gaps were identified:

| Severity | Count | Summary |
|---|---|---|
| CRITICAL | 1 | `refreshOverdueStatus()` is dead code — no scheduler calls it; overdue AR records are never automatically flagged |
| HIGH | 3 | POS frontend missing CREDIT payment flow entirely; `refreshOverdueStatus` has a dead unreachable JPA query on line 213; audit log for `recordPayment`/`writeOff` missing `ipAddress`/`userAgent`; no test for CREDIT POS E2E |
| MEDIUM | 5 | Overdue flag logic uses `findAll()` full-table scan; AR `OVERDUE` status is not factored into `countOpen`/`countOverdue` summary discrepancy; no test for POS CREDIT sale E2E; write-off does not update parent order `paymentStatus`; no scheduler evidence for overdue refresh |
| LOW | 4 | `fetchReceivableAging` imported but unused in `ReceivablesListScreen.jsx` (lint error); POS screen cart quantity guard uses `stockQuantity` from search but backend stock is re-validated at order creation; `ReportsScreen.jsx` has 2 ESLint errors unrelated to this domain; no negative permission tests for SHOP_MANAGER `receivables.write_off` |

**Largest risks:** 1) Overdue receivables are never automatically flagged (AR_RULE_008 not met at runtime level). 2) The CREDIT payment path in the POS screen is completely missing from the frontend (`PAYMENT_METHODS = ['CASH', 'CARD_TERMINAL']` only) — staff cannot create credit sales through the UI even though the backend supports it. 3) A dead unreachable code block in `refreshOverdueStatus` will confuse future maintainers.

**Build status:**
- Backend: all 4 test suites PASS — `Phase1MPosApiTest` (18), `AdminReceivableApiTest` (13), `AdminDashboardApiTest` (9), `AdminReportApiTest` (16)
- Admin frontend: `npm run build` SUCCESS; `npm run lint` has 3 ESLint errors (2 in `ReportsScreen.jsx`, 1 unused import in `ReceivablesListScreen.jsx`)

---

## 1. Test Results

| Test class | Tests run | Failures | Errors | Skipped | Result | Evidence |
|---|---|---|---|---|---|---|
| `Phase1MPosApiTest` | 18 | 0 | 0 | 0 | **PASS** | actual `mvnw -Dtest=Phase1MPosApiTest test` output |
| `AdminReceivableApiTest` | 13 | 0 | 0 | 0 | **PASS** | actual `mvnw -Dtest=AdminReceivableApiTest test` output |
| `AdminDashboardApiTest` | 9 | 0 | 0 | 0 | **PASS** | actual `mvnw -Dtest=AdminDashboardApiTest test` output |
| `AdminReportApiTest` | 16 | 0 | 0 | 0 | **PASS** | actual `mvnw -Dtest=AdminReportApiTest test` output |
| **Total (scope)** | **56** | **0** | **0** | **0** | **PASS** | — |

Admin frontend lint: **3 errors** (see Section 12). Build: **SUCCESS** (9.26 s).

---

## 2. POS Product Search Audit

| Scenario | Expected | Actual | Evidence | Status | Risk |
|---|---|---|---|---|---|
| Search without auth | HTTP 401 | HTTP 401 (`posSearch_noAuth_returns401`) | `AdminPosController.java:49 requirePermission("pos.read")`; test passes | PASS | None |
| Search with valid admin JWT | HTTP 200, `data` array | HTTP 200, `data` array | `posSearch_withAuth_returns200` passes | PASS | None |
| Filters by `PUBLISHED` only | Only PUBLISHED products returned | `catalogReadService.listProducts(..., "PUBLISHED", ...)` hard-coded | `AdminPosController.java:50` | PASS | None |
| SHOP_MANAGER with `pos.read` can search | HTTP 200 | Permitted via `AdminRolePermissions.java` (SHOP_MANAGER has `pos.read`) | `AdminRolePermissions.java`, V79 migration | PASS | None |
| `q` param missing | HTTP 400 | Spring validation rejects missing required `@RequestParam` | `AdminPosController.java:44` `@RequestParam String q` | PASS | None |
| Search returns stock quantity per variant | `stockQuantity` in variant object | Backend returns via `catalogReadService`; frontend uses `variant.stockQuantity` for OOS guard | `PosScreen.jsx:338` | PASS — frontend reads `variant.stockQuantity` but POS order creates against DB-level lock | Medium: FE cart qty cap is advisory; real guard is at order creation |

---

## 3. POS Cash/Card Sale E2E Audit

Sequence (CASH):
```
Staff → POST /api/v1/admin/pos/orders {paymentMethod:"CASH", items:[...], tenderedAmount:X}
  → AdminPosController.createPosOrder()
    → requirePermission("pos.write")
    → PosOrderService.createOrder(req, staffId, canOverridePrice, canOverrideCreditLimit)
      → validatePaymentMethod("CASH")
      → Loop items: validate stock (findByIdForUpdate), published, variant belongs to product
      → Validate tenderedAmount >= subtotal (if sent)
      → Create OrderEntity (status=COMPLETED, paymentStatus=PAID, paidAt=now, completedAt=now)
      → orderRepo.save + flush
      → Save line items
      → decrementStock() → StockMovementEntity(type=OUT, referenceType=ORDER)
      → Create PaymentEntity (status=PAID, provider=POS)
      → Create OrderNoteEntity (SYSTEM note)
      → Write AuditLogEntity (action=POS_ORDER_CREATED)
      → wsService.pushEvent(NEW_ORDER)
    → Return PosOrderResponse (orderId, orderNumber, status=COMPLETED, paymentStatus=PAID, totalAmount, changeAmount)
```

| Check | Expected | Actual | Evidence | Status |
|---|---|---|---|---|
| `status = COMPLETED` | COMPLETED | `order.setStatus("COMPLETED")` | `PosOrderService.java:278`; `createPosCashOrder_succeeds...` test | PASS |
| `paymentStatus = PAID` | PAID | `order.setPaymentStatus("PAID")` (non-credit branch) | `PosOrderService.java:280`; test | PASS |
| Stock decremented | qty -= requested | variant `quantityOnHand` decremented + `recomputeStockState` | `PosOrderService.java:335-450`; test verifies 10-2=8 | PASS |
| Stock movement written | `StockMovementEntity` with `referenceType=ORDER`, `movementType=OUT` | `decrementStock()` writes movement | `PosOrderService.java:439-450`; `createPosOrder_stockMovementCreated` test | PASS |
| PaymentEntity created | `status=PAID, provider=POS` | `paymentRepo.save(payment)` with `status=PAID` | `PosOrderService.java:348`; `createPosOrder_paymentRecordCreated` test | PASS |
| AuditLog written | action=`POS_ORDER_CREATED` | `auditLogRepo.save(auditLog)` | `PosOrderService.java:396`; `createPosOrder_auditLogCreated` test | PASS |
| WS event pushed | `NEW_ORDER` event | `wsService.pushEvent(new OrderWsEvent("NEW_ORDER", ...))` | `PosOrderService.java:398`; WS debug log visible in test output | PASS |
| Idempotency — retry same key | Same order returned, no double-decrement | `orderRepo.findByOrderKey()` shortcircuits on retry | `PosOrderService.java:151-163`; `createPosOrder_idempotencyRetry` test | PASS |
| Insufficient tendered amount (CASH) | HTTP 409 | `ConflictException` thrown | `PosOrderService.java:257-261`; test passes | PASS |
| Audit log missing `ipAddress`/`userAgent` | Should include IP/UA (like AdminOrderService) | `AuditLogEntity` does NOT set `ipAddress`/`userAgent` in `PosOrderService.java` | `PosOrderService.java:378-396` — no `ipAddress`/`userAgent` fields set | FAIL — POSREC-001 |
| CARD_TERMINAL — payment record `paymentMethod` | Should be `CARD_TERMINAL` | `payment.setPaymentMethod(isCreditOrder ? "CASH" : req.paymentMethod())` — for CARD_TERMINAL this correctly sets CARD_TERMINAL | `PosOrderService.java:345` | PASS |

---

## 4. POS Credit Sale E2E Audit

Sequence (CREDIT):
```
Staff → POST /api/v1/admin/pos/orders {paymentMethod:"CREDIT", customerId:UUID, items:[...], downPayment?:X}
  → AdminPosController:
    → canOverrideCreditLimit = admin.permissions().contains("receivables.override_limit")
    → PosOrderService.createOrder(req, staffId, canOverridePrice, canOverrideCreditLimit)
      → load creditCustomer (required for CREDIT)
      → idempotency check
      → loop items + compute subtotal
      → CreditPolicyService.validateCreditEligibility(customerId, subtotal, canOverrideCreditLimit)
        → check creditEnabled=true, creditStatus=ACTIVE
        → check outstandingAmount + subtotal <= creditLimit (unless override)
      → Create OrderEntity (status=COMPLETED, paymentStatus=UNPAID|PARTIALLY_PAID)
      → decrementStock
      → If downPayment > 0: create PaymentEntity with downPayment amount
      → ReceivableService.createReceivableForOrder(order, customer, downPayment, "POS", adminId)
        → Create ReceivableEntity (status=OPEN, outstandingAmount=total-downPayment)
        → Set dueDate = today + paymentTermsDays (if set)
        → Set creditLimitSnapshot = customer.creditLimit
      → Write AuditLogEntity (action=POS_ORDER_CREATED — same as CASH; no CREDIT-specific action)
      → WS event NEW_ORDER
    → Return PosOrderResponse (paymentStatus=UNPAID|PARTIALLY_PAID)
```

| Check | Expected | Actual | Evidence | Status |
|---|---|---|---|---|
| `customerId` required for CREDIT | HTTP 409 if missing | `ConflictException("customerId là bắt buộc...")` | `PosOrderService.java:141-144` | PASS |
| `creditEnabled=false` → 409 | HTTP 409 | `CreditPolicyService.validateCreditEligibility` throws | `CreditPolicyService.java:41-43` | PASS |
| `creditStatus != ACTIVE` → 409 | HTTP 409 | `CreditPolicyService.validateCreditEligibility` throws | `CreditPolicyService.java:44-47` | PASS |
| Credit limit exceeded → 409 | HTTP 409 unless override | `ConflictException` thrown if `afterOrder > creditLimit && !overrideLimit` | `CreditPolicyService.java:49-59` | PASS |
| `receivables.override_limit` bypasses limit | Proceeds despite over-limit | `canOverrideCreditLimit` passed from controller | `AdminPosController.java:65-66`; `CreditPolicyService.java:53-57` | PASS |
| ReceivableEntity created | OPEN status, `outstandingAmount = total - downPayment` | `receivableService.createReceivableForOrder(...)` called | `PosOrderService.java:354-363`; `ReceivableService.java:53-89` | PASS |
| Duplicate receivable for same order → 409 | `ConflictException` | `receivableRepo.findByOrderId` check before create | `ReceivableService.java:61-63` | PASS |
| `order.status = COMPLETED` for CREDIT | COMPLETED | `order.setStatus("COMPLETED")` regardless of payment method | `PosOrderService.java:278` | PASS (per `AR_RULE_001`) |
| `order.paymentStatus` for CREDIT no downPayment | `UNPAID` | `isCreditOrder ? "UNPAID" : "PAID"` | `PosOrderService.java:279-281` | PASS |
| `order.paymentStatus` for CREDIT with downPayment | `PARTIALLY_PAID` | `downPayment > 0 ? "PARTIALLY_PAID" : "UNPAID"` | `PosOrderService.java:279-281` | PASS |
| PaymentEntity only created if downPayment > 0 | No PaymentEntity if no down payment | `if (!isCreditOrder || downPayment.compareTo(ZERO) > 0)` | `PosOrderService.java:338` | PASS |
| **CREDIT flow in FE `PosScreen.jsx`** | CREDIT option in `PAYMENT_METHODS` | `PAYMENT_METHODS = ['CASH', 'CARD_TERMINAL']` — CREDIT absent | `PosScreen.jsx:9` | **FAIL — POSREC-002** |
| Backend E2E test for CREDIT POS | Should have `createPosCreditOrder_succeeds` test | Not found in `Phase1MPosApiTest.java` | scan of 18 test methods | **FAIL — POSREC-003** |
| Receivable `dueDate` set when `paymentTermsDays` null | `dueDate = null` | `if (customer.getPaymentTermsDays() != null)` guard | `ReceivableService.java:81-85` | PASS |
| Audit log action for CREDIT POS | Should have distinct action e.g. `POS_CREDIT_ORDER_CREATED` | Uses same `POS_ORDER_CREATED`; no differentiation | `PosOrderService.java:390` | LOW gap — POSREC-010 |

---

## 5. Receivable Lifecycle State Machine Audit

Docs define: `OPEN → PARTIALLY_PAID → CLOSED`, `OPEN/PARTIALLY_PAID → OVERDUE`, `OPEN/PARTIALLY_PAID/OVERDUE → WRITTEN_OFF`

| From | To | Actor | Endpoint | Preconditions | Side Effects | Test | Status | Evidence |
|---|---|---|---|---|---|---|---|---|
| `OPEN` | `PARTIALLY_PAID` | Admin/SHOP_MANAGER (`receivables.record_payment`) | `POST /admin/receivables/{id}/payments` | `amount > 0`, `amount < outstanding`, status not CLOSED/WRITTEN_OFF | Updates `paidAmount`, `outstandingAmount`, creates PaymentEntity, updates order `paidAmount`/`paymentStatus`, writes audit log | `recordPayment_partialAmount_updatesStatusAndOrder` | CONFIRMED | `ReceivableService.java:126-131` |
| `OPEN`/`PARTIALLY_PAID` | `CLOSED` | Admin/SHOP_MANAGER (`receivables.record_payment`) | `POST /admin/receivables/{id}/payments` | `amount == outstanding` (outstanding becomes 0) | Same as partial plus order `paymentStatus=PAID`, `paidAt=now` | `recordPayment_fullAmount_closeReceivableAndPaidOrder` | CONFIRMED | `ReceivableService.java:126-129` |
| `OPEN`/`PARTIALLY_PAID` | `OVERDUE` | **Scheduler (expected)** | `ReceivableService.refreshOverdueStatus()` | `status IN (OPEN, PARTIALLY_PAID)` AND `dueDate < today` | Sets `status=OVERDUE` | **No test; no scheduler** | **FAIL — POSREC-004** | `ReceivableService.java:211-227` |
| `OPEN`/`PARTIALLY_PAID`/`OVERDUE` | `WRITTEN_OFF` | Admin only (`receivables.write_off`) | `POST /admin/receivables/{id}/write-off` | Mandatory non-blank `reason`; status not CLOSED/WRITTEN_OFF | Sets `writtenOffAmount`, `outstandingAmount=0`, `writeOffReason`, `writtenOffAt`, writes audit log | `writeOff_requiresReason` | CONFIRMED | `ReceivableService.java:178-204` |
| `CLOSED` | any | — | — | Blocked | — | `recordPayment_amountExceedsOutstanding_returnsBadRequest` (indirectly) | CONFIRMED | `ReceivableService.java:105-107` |
| `WRITTEN_OFF` | any | — | — | Blocked | — | `writeOff_requiresReason` (write-off on WRITTEN_OFF would return 409 per line 182-184) | CONFIRMED | `ReceivableService.java:182-184` |
| `OVERDUE` | `CLOSED` via payment | Admin/SHOP_MANAGER | `POST /admin/receivables/{id}/payments` | Same payment preconditions | Status transitions to CLOSED when outstanding reaches 0 | No direct test for OVERDUE→CLOSED | MISSING_TEST | Inferred from `ReceivableService.java:126-129` — OVERDUE not blocked |
| Write-off on OVERDUE | `WRITTEN_OFF` | Admin | `POST /admin/receivables/{id}/write-off` | Same preconditions | — | No test | MISSING_TEST | `ReceivableService.java:183` — OVERDUE not in blocked set |

**Critical gap — POSREC-004:** `refreshOverdueStatus()` is declared public and `@Transactional` but no `@Scheduled` annotation exists and no caller exists anywhere in the codebase. OVERDUE status is never set at runtime. AR_RULE_008 states "Overdue receivables are flagged by scheduler" — this is NOT implemented.

**Additional bug in `refreshOverdueStatus()`:**
Line 213: `receivableRepo.findByCustomerIdAndStatusNotIn(null, List.of("CLOSED", "WRITTEN_OFF", "OVERDUE"))` — this is a `WHERE customer_id = NULL` query (returns walk-in receivables only or may return 0 rows). The variable `candidates` is never used (immediately followed by a `findAll()` approach). This is dead/misleading code — POSREC-005.

---

## 6. Receivable Payment Recording Audit

Sequence:
```
Admin → POST /admin/receivables/{id}/payments {amount, paymentMethod, referenceNumber?, note?}
  → AdminReceivableController.recordPayment()
    → requirePermission("receivables.record_payment")
    → resolveAdminId(admin)
    → ReceivableService.recordPayment(id, req, adminId)
      → Load ReceivableEntity (404 if not found)
      → Guard: status not CLOSED or WRITTEN_OFF (409 if closed)
      → Validate amount <= outstanding (409 if over)
      → Load OrderEntity
      → Update ar.paidAmount += amount, outstandingAmount -= amount
      → Set status: CLOSED if outstanding=0; PARTIALLY_PAID if paid > 0
      → Update order.paidAmount, paymentStatus (PAID or PARTIALLY_PAID)
      → Create PaymentEntity (provider=ADMIN_RECEIVABLE)
      → Write audit log RECEIVABLE_PAYMENT_RECORDED
      → Return ReceivableDetailResponse
```

| Check | Expected | Actual | Status | Evidence |
|---|---|---|---|---|
| Partial payment updates `PARTIALLY_PAID` | AR status=PARTIALLY_PAID, order paidAmount updated | Test passes with exact values | PASS | `AdminReceivableApiTest.java:174-191` |
| Full payment closes AR | AR status=CLOSED, order paymentStatus=PAID | Test passes | PASS | `AdminReceivableApiTest.java:193-209` |
| Over-payment rejected | HTTP 409 | `ConflictException` on `amount > outstanding` | PASS | `AdminReceivableApiTest.java:212-222` |
| Payment on CLOSED/WRITTEN_OFF rejected | HTTP 409 | `ConflictException` at line 105-107 | PASS | `ReceivableService.java:105-107` |
| PaymentEntity created with `provider=ADMIN_RECEIVABLE` | Provider field set | `payment.setProvider("ADMIN_RECEIVABLE")` | PASS | `ReceivableService.java:149` |
| Audit log `RECEIVABLE_PAYMENT_RECORDED` written | Audit entry exists | `auditLog(...)` called | PASS | `ReceivableService.java:162-167` |
| Audit log missing `ipAddress`/`userAgent` | Should include IP per ORD-001 fix precedent | Not extracted; `auditLog()` helper only sets `actorType`, `actorId`, `action`, `resourceType`, `resourceId`, `afterData` | FAIL — POSREC-001 | `ReceivableService.java:229-238` |
| `net = totalAmount - refundAmount` in order paid calc | Correct net | `BigDecimal net = order.getTotalAmount().subtract(order.getRefundAmount())` — will NPE if `refundAmount` is null | Potential NPE risk | `ReceivableService.java:135` — `OrderEntity.refundAmount` may be null |
| `OVERDUE` receivable can receive payment | Should be allowed | `status` check only blocks CLOSED/WRITTEN_OFF | PASS | `ReceivableService.java:105-107` |

---

## 7. Receivable Write-off Audit

| Check | Expected | Actual | Status | Evidence |
|---|---|---|---|---|
| Empty reason rejected | HTTP 400 validation error | `@NotBlank` on `WriteOffReceivableRequest.reason` | PASS | `WriteOffReceivableRequest.java:6`; test passes |
| Valid reason accepted | HTTP 200, status=WRITTEN_OFF | Works | PASS | `writeOff_requiresReason` test |
| `writtenOffAmount` = prior outstanding | Written off = remaining balance | `ar.setWrittenOffAmount(ar.getOutstandingAmount())` then `setOutstandingAmount(0)` | PASS | `ReceivableService.java:187-189` |
| `writeOffReason` persisted | Stored in DB | `ar.setWriteOffReason(req.reason())` | PASS | `ReceivableService.java:190` |
| `writtenOffAt` timestamp set | Set to now | `ar.setWrittenOffAt(now)` | PASS | `ReceivableService.java:191` |
| Audit log `RECEIVABLE_WRITTEN_OFF` written | Written | Audit helper called | PASS | `ReceivableService.java:195-199` |
| Write-off on CLOSED → 409 | Rejected | `if ("CLOSED".equals(ar.getStatus()) \|\| "WRITTEN_OFF"...)` | PASS | `ReceivableService.java:182-184` |
| **Parent order `paymentStatus` not updated** | Write-off should ideally mark order `CANCELLED` or add note | Write-off does NOT update `order.paymentStatus` | MEDIUM GAP — POSREC-006 | `ReceivableService.java:178-203` — no order update |
| Permission enforced at controller | Requires `receivables.write_off` | `requirePermission("receivables.write_off")` | PASS | `AdminReceivableController.java:147` |
| SHOP_MANAGER cannot write-off | 403 | `AdminRolePermissions.java` — SHOP_MANAGER does NOT have `receivables.write_off` | PASS (by role config) | `V79__backfill_pos_receivables_permissions.sql` — only `receivables.read` and `receivables.record_payment` for SHOP_MANAGER |

---

## 8. Customer Credit Profile Audit

| Endpoint | Permission | Field | Validation | Status | Evidence |
|---|---|---|---|---|---|
| `PATCH /admin/customers/{id}/credit` | `receivables.create` | `creditEnabled` (Boolean) | Optional; null = no change | PASS | `AdminReceivableController.java:165` |
| `PATCH /admin/customers/{id}/credit` | `receivables.create` | `creditLimit` (BigDecimal) | `@DecimalMin(0)` — non-negative | PASS | `UpdateCustomerCreditRequest.java:10-11` |
| `PATCH /admin/customers/{id}/credit` | `receivables.create` | `paymentTermsDays` (Integer) | `@Min(1)` — at least 1 day | PASS | `UpdateCustomerCreditRequest.java:13-14` |
| `PATCH /admin/customers/{id}/credit` | `receivables.create` | `creditStatus` (String) | Server-side check: `VALID_CREDIT_STATUSES = {ACTIVE, SUSPENDED, BLOCKED}` | PASS | `AdminReceivableController.java:169-172` |
| `PATCH /admin/customers/{id}/credit` | `receivables.create` | `creditNote` (String) | Optional text | PASS | `AdminReceivableController.java:174` |
| `GET /admin/customers/{id}/credit` | `receivables.read` | Response includes `currentOutstanding`, `availableCredit` | Computed live via `CreditPolicyService.getCurrentOutstanding()` | PASS | `AdminReceivableController.java:212-220`; tests pass |
| `currentOutstanding` excludes CLOSED/WRITTEN_OFF | Sum of non-CLOSED/WRITTEN_OFF | `sumOutstandingByCustomerId` JPQL excludes these | PASS | `ReceivableJpaRepository.java:21-27`; test `closedAndWrittenOff_notCounted` |
| `availableCredit = null` when no limit set | Returns null | `c.getCreditLimit() != null ? ... : null` | PASS | `AdminReceivableController.java:218`; test `nullCreditLimit_availableCreditIsNull` |
| `creditLimit = 0` allowed | `@DecimalMin("0")` allows zero (disabled by zero-limit) | Zero limit means no credit available | PASS — but business ambiguity: zero limit vs null limit | `UpdateCustomerCreditRequest.java:10` |
| DB-level CHECK constraint | `credit_status IN ('ACTIVE','SUSPENDED','BLOCKED')` | `V75` migration adds `chk_customers_credit_status` | PASS | `V75__add_credit_and_receivables.sql:16` |
| Frontend credit edit in `CustomerDetailScreen.jsx` | Shows credit form, calls `updateCustomerCredit` | Implemented with permission guard `receivables.create` | PASS | `CustomerDetailScreen.jsx:70-71, 139-157` |

---

## 9. Stock / Inventory Side Effects Audit

| Scenario | Expected | Actual | Evidence | Status |
|---|---|---|---|---|
| POS CASH order — stock decrement | `variantQty -= qty`; `StockMovementEntity(OUT, referenceType=ORDER)` | `decrementStock()` does both | `PosOrderService.java:423-450`; test confirms 10→8 | PASS |
| POS order — `recomputeStockState` after decrement | Stock state updated (IN_STOCK/LOW_STOCK/OUT_OF_STOCK) | `inventoryPolicyService.recomputeStockState(v)` called | `PosOrderService.java:436` | PASS |
| POS CREDIT order — stock decrement | Same as CASH — stock decremented immediately at time of sale | `decrementStock()` always called before credit branching | `PosOrderService.java:335` | PASS |
| Stock movement `referenceType=ORDER` for POS | Not `POS_SALE` type (referenceType=ORDER) | `mv.setReferenceType("ORDER")`, `mv.setNote("POS_SALE")` | `PosOrderService.java:443-444` | PASS — note clarifies POS context |
| `idempotency retry` — no double-decrement | Stock decremented exactly once | Short-circuit before `decrementStock()` | `PosOrderService.java:151-163`; test passes | PASS |
| `productVariantId` required for POS | Missing variant → 409 | `ConflictException` if blank | `PosOrderService.java:174-177`; test passes | PASS |
| Published status check during stock decrement | Order rejected if product unpublished | `product.getPublishStatus() != PUBLISHED` throws | `PosOrderService.java:194-197` | PASS |
| Variant availability check | `!variant.isAvailable()` throws | `ConflictException` if unavailable | `PosOrderService.java:207-209` | PASS |
| POS cancel/refund stock restore | Restore via `OrderStockRestoreService` (from Phase 5 fix) | `OrderStockRestoreService` handles both `ORDER_CANCEL` and `ORDER_REFUND` | `OrderStockRestoreService.java` (Phase 5 new file) | PASS (per fix report) |

---

## 10. Audit Log / WebSocket Audit

### Audit Log

| Action | Trigger | Resource | Actor | IP/UA in log | Before/After data | Evidence | Status |
|---|---|---|---|---|---|---|---|
| `POS_ORDER_CREATED` | `PosOrderService.createOrder()` | ORDER (UUID) | ADMIN | **NOT SET** | afterData contains orderId, orderNumber, staffId, totalAmount, paymentMethod, itemCount, source=POS | `PosOrderService.java:378-396` | FAIL — POSREC-001 |
| `RECEIVABLE_PAYMENT_RECORDED` | `ReceivableService.recordPayment()` | RECEIVABLE (UUID) | ADMIN | **NOT SET** | afterData: receivableId, amount, paymentMethod, remaining | `ReceivableService.java:162-167` | FAIL — POSREC-001 |
| `RECEIVABLE_WRITTEN_OFF` | `ReceivableService.writeOff()` | RECEIVABLE (UUID) | ADMIN | **NOT SET** | afterData: receivableId, reason, writtenOffAmount | `ReceivableService.java:195-199` | FAIL — POSREC-001 |

Note: Phase 5 (ORD-001 fix) added `ipAddress`/`userAgent` to order mutation audit logs. POS and Receivable audit logs were not updated in that fix — they still have null `ip_address`/`user_agent` in the `audit_log` table.

### WebSocket

| Event | Trigger | Payload | Consumer | Tested | Risk |
|---|---|---|---|---|---|
| `NEW_ORDER` | `PosOrderService.createOrder()` on success | `OrderWsEvent(type=NEW_ORDER, orderId, orderNumber, customerName\|phone, total, status=COMPLETED, paymentMethod, timestamp)` | `adminWebSocket.js` subscribed to `/topic/admin/orders` | WS debug log visible in test output: `WS pushed NEW_ORDER for order BB-...` | Low — POS WS event is same path as online checkout; well-tested |
| No WS event for `recordPayment` | AR payment recorded | No WS event pushed | N/A | N/A | Low for now; staff must manually refresh receivables list |
| No WS event for `writeOff` | Write-off completed | No WS event | N/A | N/A | Low for now |

---

## 11. Reports / Dashboard Impact Audit

| Metric | How CREDIT orders affect it | How CASH POS orders affect it | Evidence | Status |
|---|---|---|---|---|
| `todayRevenue` (GMV) | CREDIT orders: `status=COMPLETED` (not CANCELLED/FAILED/REFUNDED) → **included in GMV** | Same as CREDIT | `AdminDashboardService.java`; `DATA_CONTRACT.md` — "Credit (CREDIT) orders contribute to `todayRevenue`" | PASS |
| `todayPaidRevenue` | CREDIT orders with `paymentStatus=UNPAID`: **NOT counted** (filter: `paymentStatus IN ('PAID','PARTIALLY_PAID')` only) | CASH POS: `paymentStatus=PAID` → counted | `DATA_CONTRACT.md` — cash-vs-credit separation confirmed | PASS |
| `paidRevenue` in analytics | POS CASH: `paymentStatus=PAID` → included. CREDIT UNPAID: excluded | — | `REPORT_RULE_002` | PASS |
| `topProducts` ranking | CREDIT orders (COMPLETED, not REFUNDED/CANCELLED): included in product ranking | Same | `REPORT_RULE_007` — RANKING_EXCLUDED = CANCELLED/FAILED/REFUNDED | PASS |
| `topCustomers` | CREDIT customer orders: counted in top customers if not REFUNDED/CANCELLED/FAILED | — | `REPORT_RULE_007` | PASS |
| Down-payment partial credit | `order.paidAmount = downPayment`; later payments via `recordPayment` incrementally update | — | `PosOrderService.java:296`; `ReceivableService.recordPayment` increments `order.paidAmount` | PASS |
| AR aging report not linked to dashboard KPI | Dashboard has no overdue AR KPI | Expected (separate concern) | `AdminDashboardService.java` has no `accounts_receivable` queries | PASS (separate module) |

---

## 12. Frontend Contract Matrix

| Surface | Feature | Request fields sent | Backend expects | Response fields consumed | Backend returns | Match | Issue |
|---|---|---|---|---|---|---|---|
| `PosScreen.jsx` → `posCreateOrder` | POS order create | `paymentMethod, customerName?, customerPhone?, staffNote?, tenderedAmount?, cardReferenceNumber?, posIdempotencyKey, items[{productId, productVariantId, quantity}]` | Same via `PosCreateOrderRequest` record | `orderId, orderNumber, changeAmount` | `PosOrderResponse(orderId, orderNumber, status, paymentStatus, paymentMethod, totalAmount, tenderedAmount, changeAmount)` | Partial mismatch — FE only reads `orderNumber` and `changeAmount`, ignores `orderId` from response body but `posCreateOrder` returns `payload?.data ?? null` | Low |
| `PosScreen.jsx` — CREDIT option | Credit sale | CREDIT not in `PAYMENT_METHODS = ['CASH', 'CARD_TERMINAL']` | Backend supports CREDIT | N/A | Backend supports `customerId`, `downPayment` fields | **MISSING** — POSREC-002 | CRITICAL |
| `ReceivablesListScreen.jsx` → `fetchReceivables` | List receivables | `page, pageSize, status, customerId?, search?` | `page, size, status, customerId, q` | `items[{id, orderId, orderNumber, customerId, customerName, customerPhone, originalAmount, paidAmount, outstandingAmount, status, dueDate, overdueDays, createdFrom, createdAt}]` | `ReceivableListItemResponse` record | MATCH | None |
| `ReceivablesListScreen.jsx` → `fetchReceivableSummary` | Summary KPIs | — | — | `totalOutstanding, overdueOutstanding, writtenOffTotal, countOpen, countOverdue` | `ReceivableSummaryResponse` record | MATCH | None |
| `ReceivablesListScreen.jsx` → `recordReceivablePayment` | Record payment | `{amount: Number, paymentMethod, referenceNumber?, note?}` | `RecordReceivablePaymentRequest` with `@NotNull @DecimalMin("0.01") BigDecimal amount, @NotBlank String paymentMethod` | Returns updated `ReceivableDetailResponse` via `normalizeReceivable` | `ReceivableDetailResponse` | MATCH | None |
| `ReceivablesListScreen.jsx` → `writeOffReceivable` | Write-off | `{reason: String}` | `WriteOffReceivableRequest` with `@NotBlank reason` | Returns `ReceivableDetailResponse` | `ReceivableDetailResponse` | MATCH | None |
| `ReceivableDetailScreen.jsx` → `fetchReceivableDetail` | Detail view | `receivableId` (UUID path param) | Same | All `ReceivableDetailResponse` fields including `writtenOffAmount, paymentTermsDays, creditLimitSnapshot, note, writeOffReason, writtenOffAt, updatedAt` | `ReceivableDetailResponse` | MATCH | None |
| `CustomerDetailScreen.jsx` → `fetchCustomerCredit` | Credit profile view | `customerId` (path param) | Same | `creditEnabled, creditLimit, paymentTermsDays, creditStatus, creditNote, currentOutstanding, availableCredit` | Inline `CustomerCreditProfile` record | MATCH | None |
| `CustomerDetailScreen.jsx` → `updateCustomerCredit` | Edit credit profile | `{creditEnabled?, creditLimit?, paymentTermsDays?, creditStatus?, creditNote?}` | `UpdateCustomerCreditRequest` (all nullable/optional) | Same `CustomerCreditProfile` shape | Same | MATCH | None |
| `ReceivablesListScreen.jsx` — `fetchReceivableAging` | Aging data | Imported but never called | Backend has `GET /admin/receivables/aging` | N/A | `ReceivableAgingResponse` | **UNUSED IMPORT** — POSREC-007 (lint error) | LOW |
| `App.jsx` permission guard for receivables | Route access | `receivables.read` | `requirePermission("receivables.read")` | N/A | N/A | MATCH | None |

---

## 13. Security / Permission Audit

| Endpoint | Auth required | Permission | Roles with access | Backend enforced | Frontend guard | Tests | Risk |
|---|---|---|---|---|---|---|---|
| `GET /api/v1/admin/pos/products/search` | Admin JWT | `pos.read` | ADMIN, SHOP_MANAGER, SUPER_ADMIN | `requirePermission("pos.read")` | `PosScreen` disabled if `!canUpdate` (uses `pos.write` not `pos.read`; read is assumed) | `posSearch_noAuth_returns401`, `posSearch_withAuth_returns200` | Low |
| `POST /api/v1/admin/pos/orders` | Admin JWT | `pos.write` | ADMIN, SHOP_MANAGER, SUPER_ADMIN | `requirePermission("pos.write")` | `pos-checkout-btn disabled if !canUpdate` (canUpdate = `pos.write`) | `createPosOrder_noAuth_returns401` | Low |
| POS price override | Admin JWT | `pos.price_override` | ADMIN, SUPER_ADMIN only (not SHOP_MANAGER) | `canOverridePrice` checked in `PosOrderService.java:181-184` | No FE price override UI (not implemented in `PosScreen`) | `createPosOrder_priceOverride_withoutPermission_returns409` (SHOP_MGR gets 409) | Low |
| `GET /api/v1/admin/receivables` | Admin JWT | `receivables.read` | ADMIN, SHOP_MANAGER, SUPER_ADMIN | `requirePermission("receivables.read")` | `App.jsx:212 — 'receivables-list' requires receivables.read` | `listReceivables_returnsOk` | Low |
| `POST /api/v1/admin/receivables/{id}/payments` | Admin JWT | `receivables.record_payment` | ADMIN, SHOP_MANAGER, SUPER_ADMIN | `requirePermission("receivables.record_payment")` | `canRecordPayment` prop gates button | `recordPayment_*` tests | Low |
| `POST /api/v1/admin/receivables/{id}/write-off` | Admin JWT | `receivables.write_off` | ADMIN, SUPER_ADMIN only | `requirePermission("receivables.write_off")` | `canWriteOff` prop gates button | `writeOff_requiresReason` (positive); **no negative test** for SHOP_MGR | Medium — POSREC-008 |
| `PATCH /admin/customers/{id}/credit` | Admin JWT | `receivables.create` | ADMIN, SUPER_ADMIN only | `requirePermission("receivables.create")` | `canEditCredit = hasPermission('receivables.create')` | `customerCredit_updateAndRead` | Low |
| `GET /admin/customers/{id}/credit` | Admin JWT | `receivables.read` | ADMIN, SHOP_MANAGER, SUPER_ADMIN | `requirePermission("receivables.read")` | `canReadReceivables = hasPermission('receivables.read')` | Several credit tests | Low |
| `receivables.override_limit` for credit sale | Admin JWT | `receivables.override_limit` | ADMIN, SUPER_ADMIN | `canOverrideCreditLimit` checked in `CreditPolicyService` | Not exposed in POS frontend (CREDIT flow missing) | **No test** | High — POSREC-009 |

---

## 14. Test Coverage Audit

| Workflow | Backend test | Admin FE test | Covered cases | Missing | Status |
|---|---|---|---|---|---|
| POS search | `Phase1MPosApiTest`: 2 tests | None (unit/e2e FE test not present) | No-auth 401, with-auth 200 | Search returns only PUBLISHED products test; pagination test | PARTIAL |
| POS CASH sale E2E | `Phase1MPosApiTest`: 8+ tests | None | Completed+paid, stock decrement, idempotency, audit, WS, payment record, staffId, customerName | CARD_TERMINAL specific test; CARD_TERMINAL `cardReferenceNumber` persisted test | PARTIAL |
| POS CARD_TERMINAL sale | `Phase1MPosApiTest`: covered via CASH path (same flow) | None | Status=COMPLETED, paymentStatus=PAID | Explicit test with CARD_TERMINAL paymentMethod; cardRef persisted in note | MISSING |
| POS CREDIT sale E2E | None found | None | — | Full CREDIT order E2E: create order + verify receivable created + verify order paymentStatus=UNPAID | MISSING — POSREC-003 |
| POS credit limit exceeded | None in test file | None | — | 409 when over limit; 200 when override_limit permission | MISSING |
| Receivable list/summary/aging endpoints | `AdminReceivableApiTest`: 3 tests | None | HTTP 200, fields present | Filter by customerId; filter by status; aging buckets calculation | PARTIAL |
| Receivable partial payment | `AdminReceivableApiTest`: 1 test | None | Status→PARTIALLY_PAID, order paidAmount updated | Multiple sequential partial payments; OVERDUE→CLOSED via payment | PARTIAL |
| Receivable full payment | `AdminReceivableApiTest`: 1 test | None | Status→CLOSED, order paymentStatus=PAID | — | PASS |
| Receivable over-payment | `AdminReceivableApiTest`: 1 test | None | 409 on amount > outstanding | — | PASS |
| Receivable write-off | `AdminReceivableApiTest`: 1 test | None | Empty reason → 400; valid reason → WRITTEN_OFF | Write-off on CLOSED/WRITTEN_OFF → 409 | PARTIAL |
| Customer credit CRUD | `AdminReceivableApiTest`: 5 tests | None | Update+read, outstanding=0, with open AR, with partial AR, closed/written-off excluded, null limit | Invalid creditStatus → 409 | PARTIAL |
| Overdue refresh | None | None | — | Full scheduler test | MISSING — POSREC-004 |
| Permission negative tests | `createPosOrder_priceOverride_withoutPermission` | None | SHOP_MGR cannot override price | SHOP_MGR cannot write-off; SHOP_MGR `receivables.override_limit` denial | PARTIAL |

---

## 15. Issues

### POSREC-001 — Audit log missing `ipAddress`/`userAgent` for POS and Receivable mutations
**Severity:** HIGH
**Evidence:** `PosOrderService.java:378-396` — AuditLogEntity built without `ipAddress`/`userAgent`; `ReceivableService.java:229-238` — `auditLog()` helper never sets these fields.
**Business impact:** Phase 5 (ORD-001) fixed IP/UA capture for order mutations. POS sales and receivable mutations remain without IP tracking. In a fraud investigation, `audit_log` rows for POS transactions cannot be traced to a terminal or staff workstation IP.
**Fix direction:** `AdminPosController.createPosOrder()` and `AdminReceivableController.recordPayment()`/`writeOff()` should extract `clientIp`/`userAgent` (same pattern as `AdminOrderController.extractClientIp()`) and pass to the service layer.

---

### POSREC-002 — POS frontend missing CREDIT payment method entirely
**Severity:** CRITICAL
**Evidence:** `PosScreen.jsx:9` — `const PAYMENT_METHODS = ['CASH', 'CARD_TERMINAL']`. Backend `PosOrderService` supports `CREDIT` paymentMethod with `customerId` and `downPayment` fields. The `PosCreateOrderRequest` record has `customerId` and `downPayment` fields.
**Business impact:** Staff cannot create credit sales (bán chịu) through the POS UI. The entire AR module is built on POS credit sales yet the POS screen does not expose this flow. Credit sales can only be created programmatically (e.g., via direct API call).
**Fix direction:** Add CREDIT option to `PAYMENT_METHODS`; add customer lookup/selection field (requires `customerId`); add optional down-payment field; submit to backend with `customerId` and `downPayment` fields.

---

### POSREC-003 — No backend E2E test for POS CREDIT sale
**Severity:** HIGH
**Evidence:** `Phase1MPosApiTest.java` — 18 tests, all testing CASH flow. No test method covers `paymentMethod=CREDIT`.
**Business impact:** Credit sale logic in `PosOrderService` and `CreditPolicyService` has no automated regression coverage. A refactor could silently break the credit eligibility check, receivable creation, or down-payment recording.
**Fix direction:** Add tests covering: (1) CREDIT sale with valid customer, (2) CREDIT sale with credit disabled → 409, (3) CREDIT sale over limit → 409, (4) CREDIT sale over limit with override_limit → 200, (5) CREDIT sale with downPayment → PARTIALLY_PAID order and receivable.

---

### POSREC-004 — `refreshOverdueStatus()` has no scheduler — AR_RULE_008 not met
**Severity:** CRITICAL
**Evidence:** `ReceivableService.java:211-227` — method exists but has no `@Scheduled` annotation. Codebase search for callers returns zero results (no other class calls `refreshOverdueStatus()`). `CouponExpiryScheduler.java` exists as the only scheduler class.
**Business impact:** OVERDUE status is never set automatically. `AR_RULE_008` states "Overdue receivables are flagged by scheduler." Receivables past their due date remain at `OPEN` or `PARTIALLY_PAID` status indefinitely. Dashboard `countOverdue` KPI always shows 0. Staff cannot identify overdue accounts via status filter.
**Fix direction:** Create `ReceivableOverdueScheduler.java` annotated with `@EnableScheduling` / `@Scheduled(cron = "0 0 1 * * ?")` (daily at 01:00 VN time) that calls `receivableService.refreshOverdueStatus()`.

---

### POSREC-005 — Dead code in `refreshOverdueStatus()` — misleading JPA query
**Severity:** MEDIUM
**Evidence:** `ReceivableService.java:213-214`:
```java
List<ReceivableEntity> candidates = receivableRepo.findByCustomerIdAndStatusNotIn(
        null, List.of("CLOSED", "WRITTEN_OFF", "OVERDUE"));
```
`candidates` is assigned but never read. The method immediately discards this and calls `receivableRepo.findAll()`. The `findByCustomerIdAndStatusNotIn(null, ...)` query issues a `WHERE customer_id = NULL` SQL statement — this would return zero rows in most databases or walk-in-only receivables, which is not the intended scope.
**Business impact:** Code confuses future maintainers. The dead query adds unnecessary DB round-trip overhead.
**Fix direction:** Remove the `candidates` line entirely. Alternatively, replace `findAll()` with an efficient JPQL query `WHERE status IN ('OPEN','PARTIALLY_PAID') AND dueDate < :today`.

---

### POSREC-006 — Write-off does not update parent order `paymentStatus`
**Severity:** MEDIUM
**Evidence:** `ReceivableService.writeOff()` (`java:178-203`) sets the receivable to `WRITTEN_OFF` and zeroes `outstandingAmount`, but does NOT update `OrderEntity.paymentStatus`. The order remains at `UNPAID` or `PARTIALLY_PAID` permanently after write-off.
**Business impact:** Reports showing orders by `paymentStatus` will continue counting written-off orders as uncollected revenue. Dashboard `todayPaidRevenue` will not include written-off orders (correct), but the order list will show misleading `UNPAID` status for written-off orders.
**Fix direction:** After write-off, update `order.paymentStatus = "CANCELLED"` (or introduce a new value `"WRITTEN_OFF"`) and persist. Add audit log entry on order for the write-off event.

---

### POSREC-007 — `fetchReceivableAging` imported but unused in `ReceivablesListScreen.jsx`
**Severity:** LOW
**Evidence:** `ReceivablesListScreen.jsx:9` — `import { ..., fetchReceivableAging, ... } from '../lib/adminApi'`. ESLint lint reports: `error 'fetchReceivableAging' is defined but never used`.
**Business impact:** The aging report is fetched in `adminApi.js` but the Receivables List screen never calls it. Aging data is only accessible via `AdminReceivableController.getAging()` at `GET /admin/receivables/aging`. The `ReceivableDetailScreen` also does not show aging data in context. No aging visualization exists in the frontend.
**Fix direction:** Either implement an aging chart/table in `ReceivablesListScreen.jsx` using `fetchReceivableAging`, or remove the unused import. The `docs/engineering/DATA_CONTRACT.md` defines the aging response shape — the feature should be implemented.

---

### POSREC-008 — No negative permission test for SHOP_MANAGER `receivables.write_off`
**Severity:** LOW
**Evidence:** `AdminReceivableApiTest.java` — no test verifying that a SHOP_MANAGER token gets 403 on `POST /admin/receivables/{id}/write-off`. The positive test uses ADMIN role only.
**Business impact:** If role permissions were accidentally modified to include write-off for SHOP_MANAGER, no test would catch it.
**Fix direction:** Add `writeOff_shopManager_returns403()` test parallel to the existing `createPosOrder_priceOverride_withoutPermission` pattern.

---

### POSREC-009 — No test for `receivables.override_limit` permission bypass
**Severity:** HIGH
**Evidence:** The `canOverrideCreditLimit` flag is passed from `AdminPosController` to `PosOrderService` and then to `CreditPolicyService`. No test in `Phase1MPosApiTest` covers the credit limit exceeded scenario or the override bypass scenario.
**Business impact:** A regression in the credit limit validation or the override permission check would go undetected. Staff with SHOP_MANAGER could potentially issue credit sales exceeding a customer's approved limit if the bypass logic were incorrectly broadened.
**Fix direction:** Add tests: (1) CREDIT sale as ADMIN with `receivables.override_limit` — succeeds over limit; (2) CREDIT sale as SHOP_MANAGER (no `receivables.override_limit`) — fails with 409 when over limit.

---

### POSREC-010 — POS audit log action is same for CASH/CARD/CREDIT — no differentiation
**Severity:** LOW
**Evidence:** `PosOrderService.java:390` — `auditLog.setAction("POS_ORDER_CREATED")` regardless of payment method.
**Business impact:** Audit log queries cannot filter specifically for credit sale events. Compliance/reconciliation of credit sales requires scanning `afterData` JSON field instead of `action` field.
**Fix direction:** Use `"POS_CREDIT_ORDER_CREATED"` when `isCreditOrder`, `"POS_CASH_ORDER_CREATED"` for CASH, `"POS_CARD_ORDER_CREATED"` for CARD_TERMINAL. Or add a `source` enum to differentiate.

---

## 16. Appendix: Migration Scan

| Migration | Relevance | Key DDL |
|---|---|---|
| `V71__add_pos_staff_and_customer_name_to_orders.sql` | POS | Adds `created_by_admin_id`, `customer_name` to orders table (P0 fix for staffId/customerName) |
| `V75__add_credit_and_receivables.sql` | AR | Adds credit columns to `customers`; creates `accounts_receivable` table with constraints + indexes |
| `V76__fix_audit_log_admin_role_resource_type.sql` | AR (indirect) | Fixes `ADMIN_ROLE:<roleId>` resource_type bug in audit_log |
| `V78__add_reports_permissions.sql` | Reports | Adds `reports.read`, `reports.export` to `role_permissions` |
| `V79__backfill_pos_receivables_permissions.sql` | POS + AR | Backfills `pos.*` and `receivables.*` permissions for ADMIN and SHOP_MANAGER into `role_permissions` table |
| `V82__relax_stock_movement_variant_nullable.sql` | Inventory (Phase 5 fix) | Makes `product_variant_id` nullable; adds `product_id` column; replaces combined unique index with 4 partial unique indexes |

### DB constraint coverage for AR

| Constraint | Table | Enforces |
|---|---|---|
| `UNIQUE(order_id)` | `accounts_receivable` | One receivable per order |
| `CHECK status IN (...)` | `accounts_receivable` | Valid status values only |
| `CHECK outstanding_amount >= 0` | `accounts_receivable` | No negative outstanding |
| `CHECK credit_status IN (...)` | `customers` | Valid credit status only |
| `CHECK outstanding_amount >= 0 AND paid_amount >= 0 AND written_off_amount >= 0` | `accounts_receivable` | All amounts non-negative |
