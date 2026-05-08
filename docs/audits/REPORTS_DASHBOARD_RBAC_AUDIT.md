# Reports + Dashboard + Audit Logs + Admin Users + Roles + Permissions/RBAC Audit

**Date:** 2026-05-08
**Auditor:** Senior Backend Architect + Security/RBAC Auditor
**Phase:** 9 (follows CMS Fix Report — Phase 8)
**Scope:** Reports analytics, Dashboard KPIs, Audit log write/read coverage, Admin user management, Roles & Permissions RBAC enforcement
**Audit type:** READ-ONLY — no source files modified
**Docs consulted:** `docs/business/BUSINESS_RULES.md`, `docs/engineering/API_CONTRACT.md`, `docs/engineering/PERMISSION_MATRIX.md`, `docs/engineering/DATA_CONTRACT.md`, `docs/engineering/TRACEABILITY_MATRIX.md`, `docs/engineering/API_FLOW_MAP.md`, `docs/business/STATE_MACHINES.md`, prior fix reports (Phase 8 CMS, POS/Receivables, Customers, etc.)

---

## Section 1 — Dashboard KPI Audit

| KPI | Controller | Service Method | Repository Query | Payment Statuses Included | Business Rule | Status |
|---|---|---|---|---|---|---|
| todayRevenue | `AdminDashboardController.getDashboardSummary()` | `dashboardService.getDashboardSummary(period)` | `orderRepo.sumPaidRevenueSince(today, VN_ZONE)` | PAID, PARTIALLY_PAID only | REPORT_RULE_002 | DIVERGES — see RBAUD-001 |
| todayOrders | Same | Same | `orderRepo.countOrdersSince(today, VN_ZONE)` | Excludes CANCELLED, FAILED, REFUNDED | REPORT_RULE_001 | PASS |
| lowStockCount | Same | Same | `variantRepo.countLowStock(threshold)` | N/A | N/A | PASS |
| pendingOrders | Same | Same | `orderRepo.countByPaymentStatus("UNPAID")` | Status=UNPAID | N/A | PASS |
| recentOrders | Same | Same | `orderRepo.findRecentOrders(limit)` | All statuses | N/A | PASS |
| Timezone | VN_ZONE (Asia/Ho_Chi_Minh) | `AdminDashboardService` class field | Applied to `since` boundary | — | — | PASS |

**Critical finding:** `todayPaidRevenue` in Dashboard uses `sumPaidRevenueSince()` which whitelists only PAID and PARTIALLY_PAID. The Reports module's equivalent `sumPaidRevenueBetweenExcluding()` additionally includes PARTIALLY_REFUNDED and REFUNDED. On any day with a partial refund, the Dashboard understates cash collected vs. what Reports shows for the same day. See RBAUD-001.

---

## Section 2 — Reports Analytics Audit

| Endpoint | Permission | Repository Query | Statuses Included | Business Rule | Status |
|---|---|---|---|---|---|
| GET /api/v1/admin/reports/analytics | `reports.read` | `sumPaidRevenueBetweenExcluding(from, to, ["CANCELLED","FAILED"])` | PAID, PARTIALLY_PAID, PARTIALLY_REFUNDED, REFUNDED | REPORT_RULE_001–005 | PASS (matches business rule) |
| Analytics — refund total | `reports.read` | `sumRefundAmountBetween(from, to)` | All with refundedAt in range | REPORT_RULE_003 | PASS |
| Analytics — top products | `reports.read` | `topProductsByRevenue(from, to, ["CANCELLED","FAILED","REFUNDED"])` | Excludes CANCELLED, FAILED, REFUNDED | REPORT_RULE_009 (RANKING_EXCLUDED) | PASS |
| Analytics — top customers | `reports.read` | `topCustomersByRevenue(from, to, ["CANCELLED","FAILED","REFUNDED"])` | Excludes CANCELLED, FAILED, REFUNDED | REPORT_RULE_010 | PASS |
| Date parsing (analytics) | — | `LocalDate.parse(s).atStartOfDay(ZoneOffset.UTC)` | — | — | MEDIUM — see RBAUD-004 |
| Daily revenue trend | `reports.read` | Groups by `DATE(placed_at AT TIME ZONE 'Asia/Ho_Chi_Minh')` | — | — | PASS (DB timezone conversion correct) |

---

## Section 3 — CSV Export Audit

| Check | Finding | Location | Status |
|---|---|---|---|
| Permission guard | `requirePermission("reports.export")` | `AdminReportController.exportOrdersCsv()` | PASS |
| UTF-8 BOM | Written at module load | `AdminReportService.exportOrdersCsv()` | PASS |
| Content-Disposition header | `attachment; filename="orders_${from}_${to}.csv"` | `AdminReportController` | PASS |
| Row limit | `EXPORT_MAX_ROWS = 10_000`; silent truncation — no warning | `AdminReportService` constant | LOW — RBAUD-005 |
| CSV injection guard — `=`, `+`, `-`, `@` | Stripped in `escape()` | `AdminReportService.escape()` | PASS |
| CSV injection guard — TAB, CR | `\t`, `\r` stripped | `AdminReportService.escape()` | PASS |
| CSV injection guard — LF (`\n`) | **MISSING** — `\n` not listed | `AdminReportService.escape()` | MEDIUM — RBAUD-002 |
| Export audit — IP | `request.getRemoteAddr()` only; no X-Forwarded-For | `AdminReportController.recordExportAudit()` | MEDIUM — RBAUD-003 |
| Export audit — userAgent | NOT set on AuditLogEntity | `AdminReportController.recordExportAudit()` | MEDIUM — RBAUD-003 |

**Full export table:**

| Export | Permission | Filters | CSV injection guard | PII included | Audit log | Tests | Risk |
|---|---|---|---|---|---|---|---|
| Orders CSV | `reports.export` | dateFrom, dateTo, status | `=` `+` `-` `@` `\t` `\r` stripped; `\n` MISSING | email, phone, address | Yes (no IP/UA) | `AdminReportCsvHardeningTest` 23/23 | RBAUD-002 |
| Customers CSV | `reports.export` | N/A | Same as orders | email, phone, dob | Yes (no IP/UA) | Included in same test | RBAUD-002 |
| Products CSV | `reports.export` | N/A | Same | N/A | Yes (no IP/UA) | Included | RBAUD-002 |

---

## Section 4 — Audit Log Write Coverage

| Domain action | Audit action | Resource type | Actor | IP/UA set | Before/After | Test coverage | Status |
|---|---|---|---|---|---|---|---|
| Order status update | ORDER_STATUS_UPDATED | ORDER | JWT admin UUID | Yes (X-Forwarded-For added Phase 5) | Yes | Phase1HAdminOrderApiTest | PASS |
| Payment status update | ORDER_PAYMENT_STATUS_UPDATED | ORDER | JWT admin UUID | Yes | Yes | Phase1HAdminOrderApiTest | PASS |
| Refund create | ORDER_REFUND_CREATED | ORDER | JWT admin UUID | Yes | Yes | Phase1HAdminOrderApiTest | PASS |
| Order note create | ORDER_NOTE_CREATED | ORDER | JWT admin UUID | Yes | Yes | Phase1HAdminOrderApiTest | PASS |
| POS cash sale | POS_ORDER_CREATED | ORDER | JWT admin UUID | Yes | Yes | Phase1MPosApiTest | PASS |
| Receivable write-off | RECEIVABLE_WRITE_OFF | RECEIVABLE | JWT admin UUID | Yes | Yes | AdminReceivableApiTest | PASS |
| Product create/update/delete | PRODUCT_CREATED/UPDATED/DELETED | PRODUCT | JWT admin UUID | Yes | Yes | AdminProductApiTest | PASS |
| Inventory adjustment | INVENTORY_ADJUSTED | INVENTORY | JWT admin UUID | Yes | Yes | Phase1KInventoryApiTest | PASS |
| Content/page CRUD | CONTENT_ARTICLE_CREATED/UPDATED/DELETED | CONTENT | JWT admin UUID | Yes | Yes | AdminContentApiTest | PASS |
| Media upload/update/delete | MEDIA_UPLOADED/UPDATED/DELETED | MEDIA | JWT admin UUID | Yes | Yes | AdminMediaP0Test | PASS |
| Menu/menu item CRUD | MENU_CREATED/UPDATED/DELETED | MENU | JWT admin UUID | Yes | Yes | Phase1JAdminSettingsMenuCouponApiTest | PASS |
| Slider CRUD/reorder | SLIDER_CREATED/UPDATED/DELETED/REORDERED | SLIDER | JWT admin UUID | No (null string ID) | Yes | SliderApiTest | PARTIAL — resourceId null |
| Home video CRUD/reorder | HOME_VIDEO_CREATED/UPDATED/DELETED/REORDERED | HOME_VIDEO | JWT admin UUID | No (null string ID) | Yes | HomeVideoApiTest | PARTIAL — resourceId null |
| Redirect CRUD | REDIRECT_CREATED/UPDATED/DELETED | REDIRECT | JWT admin UUID | Yes | Yes | AdminRedirectApiTest | PASS |
| Settings update | SETTINGS_UPDATED | SETTINGS | JWT admin UUID | Yes | Yes | Phase1JAdminSettingsMenuCouponApiTest | PASS |
| Report export | REPORT_EXPORT_CREATED | REPORT | JWT admin UUID | Partial (no XFF, no UA) | Yes | AdminReportApiTest | RBAUD-003 |
| Admin user create/update/disable | ADMIN_USER_CREATED/UPDATED/DISABLED | ADMIN_USER | JWT admin UUID | **NO** | Yes | Phase1IAdminManagementApiTest (14 fail) | RBAUD-006 |
| Role create/update | ROLE_CREATED/UPDATED | ROLE | JWT admin UUID | **NO** | Yes | Phase1IAdminManagementApiTest (14 fail) | RBAUD-006 |
| Admin login | Not tracked | — | — | — | — | None | PARTIAL (intentional?) |

**Note:** `actorId null` cases: Slider and HomeVideo services resolve actor from `SecurityContextHolder`; when using dev-header (no JWT principal), actor UUID is null. This is documented as a known limitation.

**Note:** Audit logs have no DELETE endpoint — immutability confirmed. `AuditLogJpaRepository` has no `delete*` method exposed via any controller.

---

## Section 5 — Audit Log Read / Filter Audit

| Filter | Backend support | Frontend support | Notes |
|---|---|---|---|
| Action type | `findByFilters()` JPQL WHERE | `ACTION_OPTIONS` list in `AuditLogListScreen.jsx` | PASS |
| Resource type | `findByFilters()` JPQL WHERE | `RESOURCE_OPTIONS` list | PARTIAL — `REPORT` type absent from frontend list (RBAUD-007) |
| Actor (adminId) | `findByFilters()` | Admin user selector | PASS |
| Date range | `findByFilters()` | Date inputs | PASS |
| Date parsing timezone | UTC (`ZoneOffset.UTC`) in service | Dates entered as local VN | MEDIUM — RBAUD-004 |
| Pagination | `PageRequest.of()` | Pagination controls | PASS |
| Delete audit logs | No DELETE endpoint | Not in UI | PASS — immutable by design |
| Sorting | `created_at DESC` fixed | N/A | PASS |
| Performance index | Index on `created_at`, `actor_id`, `resource_type` in V49 | — | PASS |

---

## Section 6 — Admin Users Workflow Audit

| Operation | Endpoint | Permission | Key Logic | Audit Written | Issues |
|---|---|---|---|---|---|
| List admin users | GET /api/v1/admin/admin-users | `admin-users.read` | `findAll()` full table scan, in-memory filter/paginate | No | RBAUD-008 |
| Create admin user | POST /api/v1/admin/admin-users | `admin-users.write` | Validates unique email, hashes password (BCrypt) | Yes (no IP/UA) | RBAUD-006 |
| Update admin user | PUT /api/v1/admin/admin-users/{id} | `admin-users.write` | Cannot change own role | Yes (no IP/UA) | RBAUD-006 |
| Disable admin user | PUT …/{id}/disable | `admin-users.write` | Self-disable guard ✓; last-SUPER_ADMIN guard via `findAll()` | Yes (no IP/UA) | RBAUD-006, RBAUD-008 |
| Enable admin user | PUT …/{id}/enable | `admin-users.write` | Sets status ACTIVE | Yes (no IP/UA) | RBAUD-006 |
| Reset password | POST …/{id}/reset-password | `admin-users.write` | Admin sets new password directly (BCrypt) | Yes (no IP/UA) | RBAUD-006 |
| resolveAdminId fallback | (internal) | — | Falls back to DEV_ADMIN_ID on UUID parse failure | — | RBAUD-009 |

**Self-disable guard:** `AdminAdminUsersService.disableAdminUser()` explicitly rejects request when `actorId.equals(targetId)`. Evidence: service line ~148.

**Last-SUPER_ADMIN guard:** Counts `SUPER_ADMIN` users with status `ACTIVE` via `findAll()`. If count == 1 and target is that user → reject. Evidence: service line ~162. Uses `findAll()` — scalability issue (RBAUD-008).

---

## Section 7 — Roles and Permissions Audit

| Item | Finding | Status |
|---|---|---|
| Runtime permission source | DB table `role_permissions` (Flyway-seeded); `AdminPermissionService` reads at runtime into `ConcurrentHashMap` | PASS |
| Reference-only static map | `AdminRolePermissions.java` — NOT used at runtime; documents expected permissions per role | PASS |
| Permission catalog | `PermissionCatalog.GROUPS` canonical; `ALL_KEYS` validates permissions in `AdminRoleService` | PASS |
| Cache eviction | `adminPermissionService.evict(roleId)` called after every write in `AdminRoleService` | PASS |
| Empty result not cached | Empty permission list → not cached → prevents stale-empty | PASS |
| Role ID pattern | `[A-Z][A-Z0-9_]{1,49}` — min 2 chars, max 50 | PASS |
| System roles guard | Cannot delete system roles (`role.isSystem()` check); system roles: SUPER_ADMIN, ADMIN, SHOP_MANAGER, EDITOR, AUTHOR, CONTRIBUTOR, SEO_EDITOR | PASS |
| roles.read/write migration | Added V81 for ADMIN role | PASS |
| Role update audit IP/UA | IP/UA NOT set | RBAUD-006 |

**DB seed vs reference map consistency:**

The `AdminRolePermissions.MAP` reference map and V49/later Flyway migrations are verified consistent for all seeded roles. New permissions added in later phases (pos.*, receivables.*, home_videos.*, redirects.*, reports.*, audit-logs.*, admin-users.*, roles.*) are all present in both the reference map and the migrations. No divergence detected.

---

## Section 8 — Runtime RBAC Enforcement Audit

| Module/action | Permission key | In DB seed? | Role(s) | Frontend guard? | Backend test? | Status |
|---|---|---|---|---|---|---|
| Dashboard | `orders.read` | Yes (V49) | ADMIN, SHOP_MANAGER, EDITOR | Yes (`hasPermission`) | AdminDashboardApiTest | PASS |
| Reports read | `reports.read` | Yes | ADMIN, SHOP_MANAGER | Yes | AdminReportApiTest | PASS |
| Reports export | `reports.export` | Yes | ADMIN, SHOP_MANAGER | Yes | AdminReportApiTest | PASS |
| Audit logs read | `audit-logs.read` | Yes | ADMIN | Yes | MISSING_TEST (RBAUD-012) | PARTIAL |
| Admin users read | `admin-users.read` | Yes | ADMIN, SUPER_ADMIN | Yes | Phase1IAdminManagementApiTest (14 fail) | RBAUD-011 |
| Admin users write | `admin-users.write` | Yes | ADMIN, SUPER_ADMIN | Yes | Phase1IAdminManagementApiTest (14 fail) | RBAUD-011 |
| Roles read | `roles.read` | Yes | ADMIN, SUPER_ADMIN | Yes | Phase1IAdminManagementApiTest (14 fail) | RBAUD-011 |
| Roles write | `roles.write` | Yes | SUPER_ADMIN | Yes | Phase1IAdminManagementApiTest (14 fail) | RBAUD-011 |
| Products read/update | `products.read/update` | Yes (V49) | ADMIN, SHOP_MANAGER, EDITOR | Yes | AdminProductApiTest | PASS |
| Catalog read/update | `catalog.read/update` | Yes (V49) | ADMIN, EDITOR | Yes | AdminCategoryApiTest | PASS |
| Orders read/write | `orders.read/write` | Yes (V49) | ADMIN, SHOP_MANAGER | Yes | Phase1HAdminOrderApiTest | PASS |
| Customers read/write | `customers.read/write` | Yes (V49) | ADMIN, SHOP_MANAGER | Yes | Phase1I1CustomerStatusLoginTest | PASS |
| Returns | `orders.write` (shared) | Yes | ADMIN, SHOP_MANAGER | Yes | Phase1LReturnsApiTest | PASS |
| Coupons read/write | `coupons.read/write` | Yes (V49) | ADMIN, SHOP_MANAGER | Yes | Phase1JAdminSettingsMenuCouponApiTest | PASS |
| Content read/update | `content.read/update` | Yes (V49) | ADMIN, EDITOR, AUTHOR | Yes | AdminContentApiTest | PASS |
| Media read/write | `media.read/write` | Yes (V49) | ADMIN, EDITOR, AUTHOR | Yes | AdminMediaP0Test | PASS |
| Menus read/write | `menus.read/write` | Yes (V49) | ADMIN, EDITOR | Yes | Phase1JAdminSettingsMenuCouponApiTest | PASS |
| Sliders read/write | `sliders.read/write` | Yes | ADMIN, EDITOR | Yes | SliderApiTest | PASS |
| Home videos read/write | `home_videos.read/write` | Yes | ADMIN | Yes | HomeVideoApiTest | PASS |
| Redirects read/write | `redirects.read/write` | Yes | ADMIN, SEO_EDITOR | Yes | AdminRedirectApiTest | PASS |
| Settings read/write | `settings.read/write` | Yes (V49) | ADMIN | Yes | Phase1JAdminSettingsMenuCouponApiTest | PASS |
| POS read/write | `pos.read/write` | Yes | ADMIN, SHOP_MANAGER | Yes | Phase1MPosApiTest | PASS |
| Receivables.read | `receivables.read` | Yes | ADMIN, SHOP_MANAGER | Yes | AdminReceivableApiTest | PASS |
| Receivables.create | `receivables.create` | Yes | ADMIN, SHOP_MANAGER | Yes | AdminReceivableApiTest | PASS |
| Receivables.record_payment | `receivables.record_payment` | Yes | ADMIN, SHOP_MANAGER | Yes | AdminReceivableApiTest | PASS |
| Receivables.write_off | `receivables.write_off` | Yes | ADMIN | Yes | AdminReceivableApiTest | PASS |

No RBAC bypass found. All write operations require both JWT authentication and a specific DB-backed permission. `SecurityConfig` blocks all `/api/v1/admin/**` unless authenticated.

---

## Section 9 — Admin Auth Audit

| Item | Finding | Status |
|---|---|---|
| Login — status check | Blocks login if not ACTIVE (`AdminAuthService`) | PASS |
| Refresh — status check | Blocks refresh if not ACTIVE | PASS |
| Dev-header — prod default | `bigbike.auth.dev-header-enabled=false` in `application.properties`; must explicitly opt in | PASS |
| Dev-header — test | Test resources `application.properties` sets `bigbike.auth.dev-header-enabled=true` for test context | PASS |
| Dev-header — JWT present | Real JWT in SecurityContext → dev headers ignored | PASS |
| Refresh token rotation | Old token invalidated on refresh | PASS |
| JWT expiry | Access token 900s (15 min), refresh 7d — `application.properties` | PASS |
| Rate limiting login | `RateLimitingFilter` applies to `/api/v1/auth/**` | PASS |
| Password hashing | BCrypt via Spring Security `PasswordEncoder` | PASS |
| Disabled admin login | `DISABLED` status → 401 at login | PASS |
| Permission cache | ConcurrentHashMap per Spring context; evicted on role update | PASS |
| Cookie SameSite inconsistency | `setRefreshCookie` SameSite=Lax vs `clearRefreshCookie` SameSite=None | LOW — RBAUD-010 |
| resolveAdminId fallback | AdminContentController fixed in Phase 8 (CMS-006); AdminAdminUsersController and AdminRolesController still have silent fallback | RBAUD-009 |

---

## Section 10 — Frontend Contract Matrix

| Admin screen | Feature | Request | Backend expects | Response fields used | Backend returns | Match? | Issue |
|---|---|---|---|---|---|---|---|
| DashboardScreen | GET /admin/dashboard | query: period | period string | todayRevenue, todayOrders, pendingOrders, lowStockCount, recentOrders | DashboardSummary DTO | PASS | RBAUD-001 (metric divergence) |
| ReportsScreen | GET /admin/reports/analytics | from, to, granularity | ISO date strings | grossSales, paidRevenue, refundTotal, netRevenue, orderCount | AnalyticsResponse | PASS | — |
| ReportsScreen | GET /admin/reports/orders/export | from, to, status | — | blob download | CSV bytes | PASS | RBAUD-002 (LF injection) |
| AuditLogListScreen | GET /admin/audit-logs | page, action, resourceType, adminId, from, to | — | logs[], totalItems, page | PageResult<AuditLogResponse> | PASS | RBAUD-007 (REPORT missing from UI filter) |
| AdminUsersScreen | GET /admin/admin-users | page, q | — | users[], totalItems | PageResult<AdminUserResponse> | PASS | RBAUD-008 (full scan) |
| AdminUsersScreen | PUT /admin/admin-users/{id}/disable | — | id path param | success boolean | ApiDataResponse | PASS | — |
| AdminRolesScreen | GET /admin/roles | — | — | roles[], permissions[] | PageResult + PermissionGroup[] | PASS | — |
| AdminRolesScreen | PUT /admin/roles/{id} | permissionKeys[] | — | success | ApiDataResponse | PASS | — |
| App.jsx | Route guard | `hasPermission(key)` | DB-backed | boolean | Backend permission map | PASS | — |

---

## Section 11 — Test Coverage Audit

| Workflow | Backend test | Admin FE test | Covered | Missing critical cases | Status |
|---|---|---|---|---|---|
| Dashboard KPIs | AdminDashboardApiTest 9/9 | None | 9 scenarios | Timezone edge, refund impact | PARTIAL |
| Reports analytics | AdminReportApiTest 16/16 | None | Revenue/refund/top products | Write-off revenue impact | PARTIAL |
| CSV export | AdminReportCsvHardeningTest 23/23 | None | injection, BOM, columns | `\n` prefix | RBAUD-002 |
| CSV export DB query | AdminReportRepositoryQueryTest | None | None | INFRA_FAIL (Docker) | INFRA_FAIL |
| Admin user CRUD | Phase1IAdminManagementApiTest 8/22 ✓, 14/22 FAIL | None | Partial | Permission logic untested | RBAUD-011 |
| Admin roles/permissions | Phase1IAdminManagementApiTest (same failures) | None | Partial | roles.write, cache invalidation | RBAUD-011 |
| Audit log list/filter | AdminAuditLogApiTest | None | NONE | Everything | RBAUD-012 |
| Last SUPER_ADMIN guard | Phase1IAdminManagementApiTest (failing) | None | Untested (14 fail) | Guard correctness | RBAUD-011 |
| Self-disable guard | Same | None | Untested | Guard correctness | RBAUD-011 |
| Role permission cache eviction | None | None | None | Custom role affects runtime immediately | HIGH gap |
| Dev-header disabled in prod | Application config test | None | None | Integration test | LOW gap |
| IP/UA in admin user audit | None | None | None | Phase1I doesn't check audit rows | RBAUD-006 |

---

## Section 12 — Risk Register

### RBAUD-001: [HIGH] Dashboard paidRevenue and Reports paidRevenue use different payment status sets

- **Workflow:** Admin views Dashboard today KPI then cross-checks with Reports analytics
- **Impact:** On days with PARTIALLY_REFUNDED or REFUNDED orders, Dashboard shows lower revenue than Reports for same date range; management decisions based on Dashboard are incorrect
- **Evidence:** `AdminDashboardService.java` — `orderRepo.sumPaidRevenueSince()` (PAID + PARTIALLY_PAID only); `AdminReportService.java` / `OrderJpaRepository` — `sumPaidRevenueBetweenExcluding()` (PAID + PARTIALLY_PAID + PARTIALLY_REFUNDED + REFUNDED)
- **Root cause:** Two separate JPQL queries with different payment status whitelists; no shared constant
- **Reproduction:** Place an order, pay it, partially refund it → Dashboard shows original amount (excludes partial refund collected portion); Reports shows net-of-refund amount for same day
- **Expected:** Both Dashboard and Reports use the same canonical revenue definition per REPORT_RULE_002
- **Actual:** Dashboard underreports relative to Reports on refund days
- **Suggested fix:** Extract a shared `REVENUE_STATUSES` constant (`[PAID, PARTIALLY_PAID, PARTIALLY_REFUNDED, REFUNDED]`) used by both queries
- **Suggested tests:** Dashboard API test with refunded order; assert Dashboard.todayRevenue matches Reports.paidRevenue for same 1-day window
- **Related files:** `AdminDashboardService.java`, `OrderJpaRepository.java`

---

### RBAUD-002: [MEDIUM] CSV escape() misses LF (`\n`) — linefeed injection vector

- **Workflow:** Admin exports orders/customers/products CSV
- **Impact:** A cell value beginning with `\n` creates a spurious new row in spreadsheet parsers (Excel, LibreOffice, Google Sheets); attacker who controlled order notes/product names could inject formula rows in the export
- **Evidence:** `AdminReportService.escape()` — lists `=`, `+`, `-`, `@`, `\t`, `\r` as stripped prefixes; `\n` is absent
- **Root cause:** LF was not included in the initial dangerous-prefix list; `AdminReportCsvHardeningTest` also does not cover this case
- **Reproduction:** Create an order note with value `\n=SUM(A1:A10)` → export orders CSV → open in Excel → formula appears
- **Expected:** Leading `\n` stripped or escaped before writing CSV field
- **Actual:** `\n` passes through unmodified
- **Suggested fix:** Add `'\n'` to the dangerous-prefix check in `AdminReportService.escape()`; also strip from `AdminReportCsvHardeningTest`
- **Suggested tests:** `AdminReportCsvHardeningTest`: assert `\n=formula` is escaped; assert result does not start with `\n`
- **Related files:** `AdminReportService.java`

---

### RBAUD-003: [MEDIUM] Report export audit log uses remoteAddr (proxy IP) and omits userAgent

- **Workflow:** Admin exports reports CSV; security team reviews export audit trail
- **Impact:** In load-balanced/reverse-proxy deployment, audit rows for report exports show proxy IP, not client IP; userAgent is null → investigation cannot identify which machine/browser performed the export
- **Evidence:** `AdminReportController.recordExportAudit()` — uses `request.getRemoteAddr()`; `AuditLogEntity.userAgent` not set in that method
- **Root cause:** Pattern from Phase 5 (AdminOrderController IP fix) not applied to AdminReportController
- **Suggested fix:** Use `ClientIpResolver.resolve(request)` (added in Phase 8/CMS-004); set `userAgent` from `request.getHeader("User-Agent")`
- **Suggested tests:** Assert audit log row for export has non-null ipAddress from X-Forwarded-For header
- **Related files:** `AdminReportController.java`

---

### RBAUD-004: [MEDIUM] Date parsing uses UTC instead of VN timezone in audit log service and report controller

- **Workflow:** Admin filters audit logs or report by date "2026-05-08" → actual UTC boundary is 2026-05-07T17:00:00Z, excluding 7 hours of VN activity
- **Impact:** Audit log and report date filters return results for wrong VN calendar day; VN admins cannot reliably filter by local date
- **Evidence:** `AdminAuditLogService.parseFromDate()` and `parseToDate()` — `ZoneOffset.UTC`; `AdminReportController.parseDate()` — `ZoneOffset.UTC`; Dashboard uses `ZoneId.of("Asia/Ho_Chi_Minh")` correctly
- **Root cause:** Inconsistency between Dashboard date handling (VN zone) and Audit Log/Report date parsing (UTC)
- **Suggested fix:** Replace `ZoneOffset.UTC` with `ZoneId.of("Asia/Ho_Chi_Minh")` in both parsers; add this zone as a shared constant in a utility class
- **Suggested tests:** Assert `parseFromDate("2026-05-08")` yields `2026-05-07T17:00:00Z`; audit log filter by date matches expected VN day records
- **Related files:** `AdminAuditLogService.java`, `AdminReportController.java`

---

### RBAUD-005: [LOW] CSV export silently truncates at 10,000 rows with no client indication

- **Workflow:** Admin exports large dataset (>10,000 orders)
- **Impact:** Admin does not know export is incomplete; downstream analysis based on truncated data
- **Evidence:** `AdminReportService.EXPORT_MAX_ROWS = 10_000`; no response header or CSV comment added when limit hit
- **Suggested fix:** Add `X-Export-Truncated: true` response header when result count equals `EXPORT_MAX_ROWS`; optionally add footer row in CSV
- **Related files:** `AdminReportService.java`, `AdminReportController.java`

---

### RBAUD-006: [MEDIUM] Admin user and role mutation audit logs omit IP address and userAgent

- **Workflow:** Admin grants SUPER_ADMIN to another user; security audit investigates who made the change
- **Impact:** Audit rows for the highest-privilege operations (SUPER_ADMIN grant, password reset, role permission change) have no IP or userAgent — impossible to trace to a client in breach investigations
- **Evidence:** `AdminAdminUsersService.buildAudit()` — `AuditLogEntity` built without `ipAddress`/`userAgent`; `AdminRoleService.buildAudit()` same
- **Root cause:** IP/UA extraction pattern (added to AdminOrderController in Phase 5, AdminContentController in Phase 8) not propagated to AdminAdminUsersController / AdminAdminUsersService or AdminRolesController / AdminRoleService
- **Suggested fix:** Same as Phase 5 pattern: extract `clientIp` and `userAgent` in both controllers, pass to service `buildAudit()`; use `ClientIpResolver` for XFF-aware IP
- **Suggested tests:** Assert audit log row for admin user create/disable has non-null `ipAddress`; assert role write audit has non-null `ipAddress`
- **Related files:** `AdminAdminUsersController.java`, `AdminAdminUsersService.java`, `AdminRolesController.java`, `AdminRoleService.java`

---

### RBAUD-007: [LOW] Audit log filter UI missing REPORT resource type option

- **Workflow:** Security team filters audit log for export events
- **Impact:** Cannot filter audit log by `REPORT` resource type in admin UI; must scroll through all entries
- **Evidence:** `bigbike-admin/src/screens/AuditLogListScreen.jsx` RESOURCE_OPTIONS — `REPORT` absent; backend stores `resourceType = "REPORT"` for export events
- **Suggested fix:** Add `{ value: 'REPORT', label: 'Xuất báo cáo' }` to `RESOURCE_OPTIONS` in `AuditLogListScreen.jsx`
- **Related files:** `bigbike-admin/src/screens/AuditLogListScreen.jsx`

---

### RBAUD-008: [MEDIUM] Admin user list and last-SUPER_ADMIN guard use full table scan (`findAll()`)

- **Workflow:** Any admin user listing or disable operation
- **Impact:** Performance degrades linearly with admin user count; `findAll()` in the guard on every disable request
- **Evidence:** `AdminAdminUsersService.java` — `listAdminUsers()` calls `adminUserRepo.findAll()`; `disableAdminUser()` calls `findAll()` to count active SUPER_ADMINs
- **Suggested fix:** `listAdminUsers()` → use paginated `findAll(Pageable)`; guard → replace with `adminUserRepo.countByRoleIdAndStatus("SUPER_ADMIN", "ACTIVE")`
- **Related files:** `AdminAdminUsersService.java`, `AdminUserJpaRepository.java`

---

### RBAUD-009: [LOW] resolveAdminId() silently falls back to DEV_ADMIN_ID on malformed JWT UUID in admin-user and role controllers

- **Workflow:** Any admin user or role mutation with a corrupted JWT
- **Impact:** Mutation attributed to sentinel dev UUID instead of throwing auth error
- **Evidence:** `AdminAdminUsersController.java` and `AdminRolesController.java` — `resolveAdminId()` catches `IllegalArgumentException` on `UUID.fromString()` and returns `DEV_ADMIN_ID`
- **Root cause:** Same pattern fixed for `AdminContentController` in Phase 8 (CMS-006); not propagated to admin-user and role controllers
- **Suggested fix:** Throw `UnauthorizedException` on UUID parse failure; or reuse the `CMS-006` pattern of conditional fallback only when `devHeaderEnabled=true`
- **Related files:** `AdminAdminUsersController.java`, `AdminRolesController.java`

---

### RBAUD-010: [LOW] setRefreshCookie SameSite=Lax vs clearRefreshCookie SameSite=None mismatch

- **Workflow:** Admin logout in cross-origin deployment
- **Impact:** Cookie clearing may be rejected by browser if SameSite attribute differs between set and clear; silent logout failure — refresh cookie lingers
- **Evidence:** `AdminAuthController.java` — `setRefreshCookie()` SameSite=Lax; `clearRefreshCookie()` SameSite=None
- **Suggested fix:** Standardize both to SameSite=Lax (or Strict); ensure `clearRefreshCookie` uses same SameSite as `setRefreshCookie`
- **Related files:** `AdminAuthController.java`

---

### RBAUD-011: [HIGH] Phase1IAdminManagementApiTest 14/22 tests fail — missing @Sql seed annotation

- **Workflow:** CI test run for admin user management API
- **Impact:** 14 tests silently pass with 403 (expected status not validated), leaving admin-users.write, roles.write, self-disable guard, and last-SUPER_ADMIN guard completely untested
- **Evidence:** `Phase1IAdminManagementApiTest.java` — class-level annotation: `@SpringBootTest` only; no `@Sql(scripts="/db/test-seed.sql", ...)`; same root cause as CMS-001 (Phase 8)
- **Root cause:** `role_permissions` table empty in H2 (Flyway disabled, Hibernate create-drop) → all permission checks fail → 403 for every admin request
- **Reproduction:** Run `./mvnw -Dtest=Phase1IAdminManagementApiTest test` → 14 failures
- **Expected:** All 22 tests pass after seed
- **Actual:** 8/22 pass (those checking for 403/401), 14 fail
- **Suggested fix:** Add `@Sql(scripts = "/db/test-seed.sql", executionPhase = Sql.ExecutionPhase.BEFORE_TEST_CLASS)` identical to pattern in `AdminContentApiTest`
- **Related files:** `Phase1IAdminManagementApiTest.java`

---

### RBAUD-012: [HIGH] AdminAuditLogApiTest does not exist — zero automated test coverage for audit log API

- **Workflow:** CI — audit log list, filter, detail, permission enforcement
- **Impact:** Any regression in audit log list/filter/permission is undetected; audit log `audit-logs.read` permission enforcement is completely untested
- **Evidence:** `bigbike-backend/src/test/java/.../api/` — `AdminAuditLogApiTest.java` absent
- **Suggested fix:** Create `AdminAuditLogApiTest` covering: list returns 200, pagination, filters (action/resourceType/adminId/date), no delete endpoint (405), 403 for role without `audit-logs.read`, at least one audit row present after a mutation
- **Related files:** `bigbike-backend/src/test/java/.../api/AdminAuditLogApiTest.java` (to be created)

---

## Section 13 — Summary Table

| ID | Severity | Domain | Title | Status |
|---|---|---|---|---|
| RBAUD-001 | HIGH | Dashboard vs Reports | Dashboard paidRevenue diverges from Reports paidRevenue on refund days | CONFIRMED |
| RBAUD-002 | MEDIUM | CSV Export | `escape()` misses `\n` — linefeed injection vector | CONFIRMED |
| RBAUD-003 | MEDIUM | Audit Write | Report export audit lacks XFF IP and userAgent | CONFIRMED |
| RBAUD-004 | MEDIUM | Audit / Reports | Date parsing uses UTC instead of VN timezone | CONFIRMED |
| RBAUD-005 | LOW | CSV Export | 10k-row truncation silent — no client indication | CONFIRMED |
| RBAUD-006 | MEDIUM | Audit Write | Admin user and role mutations audit logs omit IP/UA | CONFIRMED |
| RBAUD-007 | LOW | Frontend | Audit log UI filter missing REPORT resource type | CONFIRMED |
| RBAUD-008 | MEDIUM | Admin Users | `findAll()` full table scan in list and disable guard | CONFIRMED |
| RBAUD-009 | LOW | Admin Users/Roles | resolveAdminId() silent dev UUID fallback on malformed JWT | CONFIRMED |
| RBAUD-010 | LOW | Auth | setRefreshCookie/clearRefreshCookie SameSite mismatch | CONFIRMED |
| RBAUD-011 | HIGH | Tests | Phase1IAdminManagementApiTest 14/22 fail — missing @Sql seed | CONFIRMED |
| RBAUD-012 | HIGH | Tests | AdminAuditLogApiTest missing — zero audit log API test coverage | CONFIRMED |
