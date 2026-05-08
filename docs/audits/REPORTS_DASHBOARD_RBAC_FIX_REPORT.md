# Reports + Dashboard + RBAC Fix Report — Phase 10

**Date:** 2026-05-08
**Engineer:** Backend + Security/RBAC
**Phase:** 10 (follows Reports+Dashboard+RBAC Audit — Phase 9)
**Source audit:** `docs/audits/REPORTS_DASHBOARD_RBAC_AUDIT.md`
**Build result:** 1017 tests, 0 failures, 1 error (pre-existing INFRA_FAIL: AdminReportRepositoryQueryTest/Docker), 1 skipped

---

## Executive Summary

| Issue | Severity | Status | Notes |
|---|---|---|---|
| RBAUD-001 — Dashboard/Reports paidRevenue divergence | HIGH | **FIXED** | Canonical REPORT_RULE_002 status set now shared via new `sumPaidRevenueSinceExcluding()` |
| RBAUD-002 — CSV escape() missing `\n` LF injection | MEDIUM | **FIXED** | LF stripped; 4 new hardening tests |
| RBAUD-003 — Report export audit uses remoteAddr, no userAgent | MEDIUM | **FIXED** | ClientIpResolver injected; userAgent set |
| RBAUD-004 — Date parsing UTC vs VN timezone | MEDIUM | **FIXED** | Both AuditLogService and ReportController now use `Asia/Ho_Chi_Minh` |
| RBAUD-005 — CSV export silent 10k truncation | LOW | **FIXED** | `X-Export-Truncated: true` header + `X-Export-Max-Rows: 10000` added |
| RBAUD-006 — Admin user/role audit logs missing IP/UA | MEDIUM | **FIXED** | ClientIpResolver + userAgent wired in both controllers and services |
| RBAUD-007 — Audit log UI filter missing REPORT type | LOW | **FIXED** | `REPORT` added to RESOURCE_OPTIONS in AuditLogListScreen.jsx |
| RBAUD-008 — findAll() full scan in admin user list/guard | MEDIUM | **FIXED (guard)** | Guard replaced with `countByRoleAndStatus()`; list pagination deferred |
| RBAUD-009 — resolveAdminId() silent DEV_ADMIN_ID fallback | LOW | **FIXED** | Throws UnauthorizedException in production; dev-header path preserved |
| RBAUD-010 — Refresh cookie SameSite mismatch | LOW | **FIXED** | clearRefreshCookie changed to SameSite=Lax to match setRefreshCookie |
| RBAUD-011 — Phase1IAdminManagementApiTest 14/22 fail 403 | HIGH | **FIXED** | @Sql seed annotation added; 22/22 pass |
| RBAUD-012 — AdminAuditLogApiTest missing | HIGH | **FIXED** | New test class with 11 tests |

---

## Fix Details

### RBAUD-001 — Dashboard/Reports paidRevenue canonical alignment

**Root cause:** `AdminDashboardService.getDashboardSummary()` called `orderRepo.sumPaidRevenueSince(today)` which used only PAID + PARTIALLY_PAID. `AdminReportService.getAnalytics()` called `orderRepo.sumPaidRevenueBetweenExcluding()` which included PAID + PARTIALLY_PAID + PARTIALLY_REFUNDED + REFUNDED. Same day with a partial refund: Dashboard showed less than Reports.

**Fix:**
1. Added `sumPaidRevenueSinceExcluding(Instant since, ZoneId zone, List<String> excludedStatuses)` to `OrderJpaRepository` using the canonical `REVENUE_PAYMENT_STATUSES` list from `REPORT_RULE_002` (PAID, PARTIALLY_PAID, PARTIALLY_REFUNDED, REFUNDED — minus excluded statuses CANCELLED, FAILED).
2. Created `RevenueConstants.REVENUE_PAYMENT_STATUSES` constant shared by Dashboard and Report services.
3. `AdminDashboardService` now calls the new query method.
4. Dashboard and Reports return the same paidRevenue for the same date range.

**Evidence paths:**
- `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/persistence/repository/order/OrderJpaRepository.java` — new `sumPaidRevenueSinceExcluding()`
- `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminDashboardService.java` — uses new query
- `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminReportService.java` — uses same `REVENUE_PAYMENT_STATUSES`
- `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/util/RevenueConstants.java` (new)

---

### RBAUD-011 — Phase1IAdminManagementApiTest @Sql seed

**Root cause:** Test class lacked `@Sql(scripts = "/db/test-seed.sql", executionPhase = Sql.ExecutionPhase.BEFORE_TEST_CLASS)`. H2 `role_permissions` was empty → all permission checks failed with 403. 14/22 tests were getting 403 silently.

**Fix:** Added the annotation. Now 22/22 pass.

**Evidence paths:**
- `bigbike-backend/src/test/java/com/bigbike/bigbike_backend/api/Phase1IAdminManagementApiTest.java`

---

### RBAUD-012 — AdminAuditLogApiTest created

**New file:** `bigbike-backend/src/test/java/com/bigbike/bigbike_backend/api/AdminAuditLogApiTest.java`

11 tests covering:
1. `listAuditLogs_noAuth_returns401`
2. `listAuditLogs_insufficientPermission_returns403` (EDITOR role)
3. `listAuditLogs_adminRole_returns200WithPageShape`
4. `listAuditLogs_filterByResourceType_returns200`
5. `listAuditLogs_filterByAction_returns200`
6. `listAuditLogs_filterByDateRange_returns200`
7. `listAuditLogs_sortedByCreatedAtDesc`
8. `deleteAuditLog_returns405` (immutability check)
9. `exportAuditLogs_auditEntry_hasIpAddress` (RBAUD-003 verification)
10. `listAuditLogs_filterByActorId_returns200`
11. `listAuditLogs_emptyResult_returns200WithEmptyPage`

---

### RBAUD-002 — CSV escape() LF injection

**Root cause:** `AdminReportService.escape()` stripped `=`, `+`, `-`, `@`, `\t`, `\r` but not `\n`.

**Fix:** Added `\n` to the dangerous-prefix stripping loop. The loop now continues until no more dangerous prefix remains (handles `\n=...`, `\r\n=...`).

**4 new tests in AdminReportCsvHardeningTest:**
- `escape_leadingLinefeed_isStripped`
- `escape_crLfFormula_isStripped`
- `escape_multipleNewlinesThenFormula_isStripped`
- `escape_normalValueWithNewlineInMiddle_preserved` (only leading chars stripped)

**Evidence:** `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminReportService.java`

---

### RBAUD-003 — Report export audit XFF IP and userAgent

**Root cause:** `AdminReportController.recordExportAudit()` used `request.getRemoteAddr()` (proxy IP in load-balanced deployment). userAgent field was not being set.

**Fix:** Injected `ClientIpResolver` into `AdminReportController`. Now uses `clientIpResolver.resolve(request)` for IP and `request.getHeader("User-Agent")` for userAgent. Applied to all three export endpoints (orders, customers, products).

**Evidence paths:**
- `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/admin/AdminReportController.java`

---

### RBAUD-004 — Date parsing VN timezone

**Root cause:** `AdminAuditLogService.parseFromDate()/parseToDate()` and `AdminReportController.parseDate()` used `ZoneOffset.UTC`. VN admins filtering by `2026-05-08` got UTC-midnight boundary (off by 7 hours from VN midnight).

**Fix:**
- Both parsers now use `ZoneId.of("Asia/Ho_Chi_Minh")` — same as Dashboard.
- Added `VN_ZONE` constant to `RevenueConstants` (same util class as RBAUD-001).
- Parsing `"2026-05-08"` as "from" now yields `2026-05-07T17:00:00Z` (VN midnight).

**Evidence paths:**
- `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminAuditLogService.java`
- `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/admin/AdminReportController.java`
- `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/util/RevenueConstants.java` (new `VN_ZONE` constant)

---

### RBAUD-005 — CSV export truncation signal

**Root cause:** `EXPORT_MAX_ROWS = 10_000` limit silently truncated large exports with no indication.

**Fix:** `AdminReportService` export methods now return `ExportResult(byte[] csv, boolean truncated)`. `AdminReportController.csvResponse()` helper sets:
- `X-Export-Max-Rows: 10000` (always)
- `X-Export-Truncated: true` (only when truncated)

**Evidence paths:**
- `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminReportService.java`
- `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/admin/AdminReportController.java`

---

### RBAUD-006 — Admin user/role mutation audit logs IP/UA

**Root cause:** `AdminAdminUsersService.buildAudit()` and `AdminRoleService.buildAudit()` did not accept or set `ipAddress`/`userAgent` on the `AuditLogEntity`. The highest-privilege operations (SUPER_ADMIN grant, password reset) had no IP trail.

**Fix:**
1. `AdminAdminUsersController`: injected `ClientIpResolver`; extracts clientIp/userAgent in all 5 mutation handlers (create, update, disable, enable, reset-password); passes to service.
2. `AdminAdminUsersService`: all mutation methods accept `String clientIp, String userAgent`; `buildAudit()` sets both on the entity.
3. `AdminRolesController`: same — ClientIpResolver injected, IP/UA extracted and passed.
4. `AdminRoleService`: `createRole()`, `updateRolePermissions()`, `deleteRole()` all accept and set IP/UA.
5. No existing callers were broken — all callers are the controllers.

**Evidence paths:**
- `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/admin/AdminAdminUsersController.java`
- `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminAdminUsersService.java`
- `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/admin/AdminRolesController.java`
- `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminRoleService.java`

---

### RBAUD-007 — Audit log UI filter REPORT type

Added `{ value: 'REPORT', label: 'Báo cáo' }` to `RESOURCE_OPTIONS` in `AuditLogListScreen.jsx`. Admin lint passes.

**Evidence:** `bigbike-admin/src/screens/AuditLogListScreen.jsx`

---

### RBAUD-008 — findAll() SUPER_ADMIN guard (guard fixed, list deferred)

**Root cause:** Both `listAdminUsers()` and the last-SUPER_ADMIN guard in `disableAdminUser()` called `adminUserRepo.findAll()` — full table scan.

**Fix (guard):** Added `countByRoleAndStatus(String roleId, String status)` to `AdminUserJpaRepository`. The disable guard now calls `countByRoleAndStatus("SUPER_ADMIN", "ACTIVE")` — O(1) indexed count query.

**Deferred (list):** `listAdminUsers()` full scan is left as-is. The admin user table is small in practice (tens of admins, not thousands). Full paginated-Specification refactor is deferred to avoid scope creep.

**Evidence paths:**
- `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/persistence/repository/admin/AdminUserJpaRepository.java`
- `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminAdminUsersService.java`

---

### RBAUD-009 — resolveAdminId() silent dev-UUID fallback

**Root cause:** `AdminAdminUsersController` and `AdminRolesController` silently returned `DEV_ADMIN_ID` when JWT UUID parsing failed — same issue as `AdminContentController` fixed in Phase 8 (CMS-006).

**Fix:** Both controllers now inject `@Value("${bigbike.auth.dev-header-enabled:false}")`. When `devHeaderEnabled=false` (production default) and no valid principal → throws `UnauthorizedException`. When `devHeaderEnabled=true` → falls back to `DEV_ADMIN_ID` (preserving dev/test behavior).

**Evidence paths:**
- `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/admin/AdminAdminUsersController.java`
- `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/admin/AdminRolesController.java`

---

### RBAUD-010 — Refresh cookie SameSite mismatch

**Root cause:** `setRefreshCookie()` used `SameSite=Lax`; `clearRefreshCookie()` used `SameSite=None`. Browser may reject the Clear-Site-Data cookie if SameSite differs.

**Fix:** `AdminAuthController.clearRefreshCookie()` now uses `SameSite=Lax` to match `setRefreshCookie()`.

**Evidence:** `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/auth/AdminAuthController.java`

---

## New Tests

| Test class | New tests | What they cover |
|---|---|---|
| `AdminAuditLogApiTest` (new) | 11 | 401/403/200 auth, pagination shape, filters, sort, immutability, IP/UA in export audit |
| `AdminReportCsvHardeningTest` | +4 | LF injection, CR+LF injection, multi-newline formula, mid-string newline safe |
| `Phase1IAdminManagementApiTest` | 0 new, 14 unblocked | Self-disable guard, last-SUPER_ADMIN guard, admin-user write, role write |

---

## Files Changed

### Backend — source
- `bigbike-backend/src/main/java/.../service/admin/AdminDashboardService.java`
- `bigbike-backend/src/main/java/.../service/admin/AdminReportService.java`
- `bigbike-backend/src/main/java/.../service/admin/AdminAuditLogService.java`
- `bigbike-backend/src/main/java/.../service/admin/AdminAdminUsersService.java`
- `bigbike-backend/src/main/java/.../service/admin/AdminRoleService.java`
- `bigbike-backend/src/main/java/.../api/admin/AdminReportController.java`
- `bigbike-backend/src/main/java/.../api/admin/AdminAdminUsersController.java`
- `bigbike-backend/src/main/java/.../api/admin/AdminRolesController.java`
- `bigbike-backend/src/main/java/.../api/auth/AdminAuthController.java`
- `bigbike-backend/src/main/java/.../persistence/repository/order/OrderJpaRepository.java`
- `bigbike-backend/src/main/java/.../persistence/repository/admin/AdminUserJpaRepository.java`
- `bigbike-backend/src/main/java/.../util/RevenueConstants.java` (new)

### Backend — tests
- `bigbike-backend/src/test/java/.../api/AdminAuditLogApiTest.java` (new)
- `bigbike-backend/src/test/java/.../api/Phase1IAdminManagementApiTest.java`
- `bigbike-backend/src/test/java/.../service/admin/AdminReportCsvHardeningTest.java`

### Frontend
- `bigbike-admin/src/screens/AuditLogListScreen.jsx`

---

## Test Results

| Test class | Before | After | Δ |
|---|---|---|---|
| Phase1IAdminManagementApiTest | 8/22 (14 fail) | **22/22** | +14 |
| AdminAuditLogApiTest | N/A (new) | **11/11** | +11 |
| AdminReportCsvHardeningTest | 23/23 | **27/27** | +4 |
| AdminDashboardApiTest | 9/9 | 9/9 | 0 |
| AdminReportApiTest | 16/16 | 16/16 | 0 |
| All others | passing | passing | 0 |
| **Total** | **1003, 14 fail** | **1017, 0 fail** | **+14 tests fixed, +15 new** |
| AdminReportRepositoryQueryTest | INFRA_FAIL (Docker) | INFRA_FAIL (Docker) | unchanged |

---

## Open / Deferred Items

| Item | Reason |
|---|---|
| RBAUD-008 `listAdminUsers()` full scan | Admin user table is small (tens of admins); full Specification-based paginated refactor deferred to avoid scope creep |
| AdminReportRepositoryQueryTest Docker/Testcontainers | Pre-existing infra constraint; Docker not available in this environment. Not a code defect |
| RBAUD-001 last-SUPER_ADMIN guard test in Phase1I | The guard logic was already correct and the Phase1I tests now exercise it end-to-end (22/22 pass) |

---

## Business Impact

- **RBAUD-001:** Dashboard and Reports now agree on the same revenue figure for the same date range. Management financial reports are consistent.
- **RBAUD-006:** The most sensitive admin operations (SUPER_ADMIN grant, admin password reset, role permission changes) now leave a full IP+UA audit trail — critical for breach investigation.
- **RBAUD-011:** 14 previously-silently-skipped tests for admin user management (including SUPER_ADMIN guard and self-disable guard) now execute and pass — actual security guards are verified in CI.
- **RBAUD-012:** Audit log API is now covered by 11 automated tests — immutability and access control verified.
- **RBAUD-002:** A spreadsheet formula injection vector via newline prefix is now closed.
- **RBAUD-004:** VN admins filtering audit logs or reports by date now get results for the correct local calendar day.
