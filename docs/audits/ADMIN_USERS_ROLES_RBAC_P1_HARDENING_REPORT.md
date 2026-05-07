# Admin Users + Roles/RBAC — P1 Hardening Report

**Date:** 2026-05-07  
**Scope:** P1 hardening tasks for the Admin Users + Roles/RBAC module, following the P0 fix (see [ADMIN_USERS_ROLES_RBAC_P0_FIX_REPORT.md](ADMIN_USERS_ROLES_RBAC_P0_FIX_REPORT.md)).  
**Status:** ✅ Complete

---

## 1. Summary of Changes

| # | Item | Status |
|---|------|--------|
| 1 | Separate `roles.read` / `roles.write` permissions from `admin-users.*` | ✅ |
| 2 | Validate permission keys on role create/update — reject unknown keys | ✅ |
| 3 | Block delete of custom role when admin users are still assigned to it | ✅ |
| 4 | `GET /api/v1/admin/permissions` catalog API — FE fetches catalog from BE | ✅ |
| 5 | `RolesScreen` fetches catalog, adds POS/receivables/reports groups | ✅ |
| 6 | Clean up `AdminRolePermissions.java` — remove "single source of truth" claim | ✅ |
| 7 | Comprehensive integration tests (`AdminRolesApiTest`) | ✅ |

---

## 2. Backend Changes

### 2.1 New Files

#### `PermissionCatalog.java`
**Path:** `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/auth/PermissionCatalog.java`

Canonical permission key registry. Defines 43 permission keys organised into 4 groups:

| Group key | Description | Count |
|---|---|---|
| `roles.groupSales` | Orders, customers, coupons, shipping, reviews, POS, receivables, reports | 21 |
| `roles.groupProducts` | Products & catalog CRUD | 4 |
| `roles.groupContent` | Content, media, menus, sliders, home videos, redirects | 12 |
| `roles.groupSystem` | Settings, admin-users, roles, audit-logs | 7 (incl. new `roles.read`/`roles.write`) |

Each entry carries a `sensitive: boolean` flag used by the FE to show the confirm dialog before granting/revoking.

`PermissionCatalog.ALL_KEYS` is the unmodifiable Set used by `AdminRoleService.validatePermissionKeys`.

#### `AdminPermissionsController.java`
**Path:** `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/admin/AdminPermissionsController.java`

```
GET /api/v1/admin/permissions
Authorization: Bearer <token>   (requires roles.read)
```

Returns `ApiDataResponse<List<PermissionCatalog.Group>>`. The FE `RolesScreen` calls this on mount; falls back to a built-in catalog constant if the call fails.

> **Note:** The endpoint path is `/api/v1/admin/permissions` — NOT `/api/v1/admin/permissions/catalog`. The codebase contains no reference to the longer path; no alias is needed.

### 2.2 Modified Files

#### `AdminRoleService.java`

| Change | Detail |
|---|---|
| `validatePermissionKeys(Set<String>)` | New private helper. Rejects any key not in `PermissionCatalog.ALL_KEYS`; throws `ValidationException` (400) with a structured `ApiErrorDetail` list per unknown key. Called on create and update. |
| Role ID format validation | Pattern `[A-Z][A-Z0-9_]{1,49}` applied after normalisation (uppercase + spaces→underscore). Throws `ValidationException` (400). |
| Blank id/name guard | Both now throw `ValidationException` (400), not `ConflictException`. |
| Delete role — in-use guard | `adminUserRepo.countByRole(role.getId()) > 0` → `ConflictException` (409) with count in message. |
| `buildAudit` signature | Removed unused `String roleId` parameter. |

#### `AdminRolesController.java`

All 4 endpoints re-gated from `admin-users.*` to `roles.*`:

| Endpoint | Old gate | New gate |
|---|---|---|
| `GET /api/v1/admin/roles` | `admin-users.read` | `roles.read` |
| `POST /api/v1/admin/roles` | `admin-users.write` | `roles.write` |
| `PUT /api/v1/admin/roles/{id}/permissions` | `admin-users.write` | `roles.write` |
| `DELETE /api/v1/admin/roles/{id}` | `admin-users.write` | `roles.write` |

#### `AdminUserJpaRepository.java`

Added derived query:
```java
long countByRole(String role);
```
Used by the delete guard to count users assigned to the role being deleted.

#### `AdminRolePermissions.java`

Removed "single source of truth" claim from Javadoc; class is now clearly labelled as a **human-readable reference only**. Added `roles.read` and `roles.write` to the ADMIN entry in the reference map. `forRole()` static method removed (was unused post-P0).

### 2.3 Flyway Migration

**`V81__add_roles_permissions.sql`**
```sql
INSERT INTO role_permissions (role_id, permission) VALUES
    ('ADMIN', 'roles.read'),
    ('ADMIN', 'roles.write')
ON CONFLICT (role_id, permission) DO NOTHING;
```

SUPER_ADMIN already has `*` (wildcard) — no change needed.

---

## 3. Frontend Changes

### 3.1 `adminApi.js`

Added `fetchPermissionCatalog()`:
```js
export async function fetchPermissionCatalog() {
  try {
    const payload = await requestJson('/admin/permissions')
    return Array.isArray(payload?.data) ? payload.data : null
  } catch {
    return null   // silent fallback; RolesScreen uses BUILTIN_CATALOG
  }
}
```

Updated mock `ALL_PERMS` array in `buildMockRoles()` to include `roles.read`, `roles.write`, and all POS/receivables/reports keys.

### 3.2 `RolesScreen.jsx`

| Change | Detail |
|---|---|
| `BUILTIN_CATALOG` constant | Replaces the old `PERMISSION_CATALOG`. Same shape as `PermissionCatalog.Group`; contains all 43 keys with `sensitive` flags. Used as fallback when BE catalog is unavailable. |
| `buildCatalogHelpers(catalog)` | Derives `knownKeys: Set` and `sensitiveKeys: Set` from whichever catalog is active (BE or builtin). Replaces hardcoded module-level `KNOWN_PERM_KEYS` / `SENSITIVE_PERMS`. |
| `PERM_LABEL_KEY_MAP` | Covers all 43 permission keys → i18n label keys. |
| `useEffect` data load | `Promise.all([fetchRoles(), fetchPermissionCatalog()])` — parallel fetch; `setCatalog(catalogResult)` if BE returns non-null. |
| `catalog` state | Threaded through `RolesScreen` → `RoleDetail` → `RoleSummaryCard` and `SaveSummaryDialog`. Drives permission group rendering and sensitivity checks. |
| `PermGroup.isSensitive` | Now uses `perm.sensitive` from catalog entry directly, not hardcoded set. |
| New permission groups | POS, receivables, and reports permissions now visible in the UI (were missing from old hardcoded catalog). |

### 3.3 `App.jsx`

3 lines changed from `admin-users.*` to `roles.*`:

| Location | Before | After |
|---|---|---|
| `NAV_GROUP_DEFS` sidebar item for `/admin/roles` | `permission: 'admin-users.read'` | `permission: 'roles.read'` |
| `getRequiredPermission()` case `'roles'` | `return 'admin-users.read'` | `return 'roles.read'` |
| `RolesScreen` render | `canUpdate={hasPermission('admin-users.write')}` | `canUpdate={hasPermission('roles.write')}` |

### 3.4 i18n (`vi.json` / `en.json`)

Added 16 new label keys:

| Key | vi | en |
|---|---|---|
| `permRolesRead` | Xem danh sách vai trò | View roles list |
| `permRolesWrite` | Tạo & chỉnh sửa phân quyền vai trò | Create & edit role permissions |
| `permPosRead` | Xem màn hình bán tại quầy | View point-of-sale screen |
| `permPosWrite` | Tạo đơn hàng tại quầy | Create walk-in orders |
| `permPosPriceOverride` | Ghi đè giá khi bán tại quầy | Override price at point of sale |
| `permReceivablesRead` | Xem công nợ khách hàng | View customer receivables |
| `permReceivablesCreate` | Tạo phiếu công nợ | Create receivable entries |
| `permReceivablesRecordPayment` | Ghi nhận thanh toán công nợ | Record receivable payments |
| `permReceivablesWriteOff` | Xoá nợ / xử lý nợ xấu | Write off / handle bad debt |
| `permReceivablesOverrideLimit` | Bỏ qua giới hạn công nợ | Bypass receivable credit limit |
| `permReceivablesExport` | Xuất dữ liệu công nợ | Export receivables data |
| `permReportsRead` | Xem báo cáo doanh thu & vận hành | View revenue & operations reports |
| `permReportsExport` | Xuất báo cáo | Export reports |
| `noEditPermission` | ... Cần quyền `roles.write` ... | ... need `roles.write` permission ... |

Updated `permAdminUsersWrite` label (vi: "Quản lý tài khoản quản trị", en: "Manage admin accounts") to de-couple from roles management.

---

## 4. Test Results

### 4.1 `AdminRolesApiTest` — 27/27 pass

New integration test class covering:

| Group | Tests |
|---|---|
| List roles | No token → 401; with `roles.read` → 200; EDITOR → 403; response contains system roles |
| Permissions catalog | No token → 401; with `roles.read` → 200 with all groups; EDITOR → 403 |
| Create role | No token → 401; EDITOR → 403; valid → 201; blank id → 400; blank name → 400; invalid ID format → 400; duplicate → 409; unknown permission key → 400 |
| Update permissions | No token → 401; EDITOR → 403; valid → 200; unknown key → 400; SUPER_ADMIN → 409; role not found → 404 |
| Delete role | No token → 401; EDITOR → 403; system role → 409; not found → 404; role in use → 409; custom role no users → 204 |

### 4.2 Full test suite

```
Tests run: 970   Failures: 0   Errors: 1   Skipped: 3
```

The 1 error is `AdminReportRepositoryQueryTest` — Docker is not running in this environment so Testcontainers cannot pull the `postgres:16-alpine` image. This is a **pre-existing infrastructure constraint**, not a regression introduced by P1 changes. All other 969 tests pass.

### 4.3 Frontend build

```
✓ built in 7.56s   (no TypeScript / lint errors)
```

`RolesScreen--EMy5MOa.js` — 42.01 kB gzip: 11.74 kB — compiled cleanly.

---

## 5. Reference Check — Stale Endpoint / Permission Strings

### 5.1 Wrong endpoint path `/permissions/catalog`

**Result: 0 occurrences found.** The catalog endpoint is `/api/v1/admin/permissions` everywhere in source, docs, and tests.

### 5.2 `admin-users.read/write` used as a Roles module **gate** (should be `roles.*`)

All remaining occurrences of `admin-users.read/write` in source are **legitimate**:

| Location | Type | Verdict |
|---|---|---|
| `PermissionCatalog.java` | Permission **key** in catalog | ✅ correct — it's a valid permission a role can hold |
| `AdminRolePermissions.java` | Permission **key** in reference map | ✅ correct |
| `RolesScreen.jsx` (BUILTIN_CATALOG) | Permission **key** in catalog | ✅ correct |
| `adminApi.js` `ALL_PERMS` mock | Permission **key** list | ✅ correct |
| `mockData.js` | Permission **key** in ADMIN mock role | ✅ correct |
| `App.jsx:105` | Gate for `/admin/admin-users` route | ✅ correct — admin-users page still gated by `admin-users.read` |
| `App.jsx:205` | Gate for `case 'admin-users'` route | ✅ correct |

The 3 cases that were incorrectly using `admin-users.*` as the **gate for the Roles module** have all been updated to `roles.*`.

### 5.3 Documentation updated

| File | Change |
|---|---|
| `docs/business/USER_ROLES.md:172` | Updated "admin-users.write → roles.write" for role management capability |

The original audit `ADMIN_USERS_ROLES_RBAC_MODULE_AUDIT.md` intentionally retains pre-P1 state as the historical audit record.

---

## 6. Remaining Risks

| Risk | Severity | Notes |
|---|---|---|
| Testcontainers requires Docker | Low | `AdminReportRepositoryQueryTest` needs Docker running to pass. Pre-existing; no fix needed here. |
| Privilege escalation (Finding 7) | Medium — deferred | An admin with `roles.write` can still grant any permission to any role, including permissions they don't hold themselves. Flagged in original audit as P1 item 7; scoped out of this hardening sprint. No new regression introduced. |
| FE catalog fallback divergence | Very low | `BUILTIN_CATALOG` in `RolesScreen.jsx` must stay in sync with `PermissionCatalog.java`. A comment and keep-in-sync note is in place. The BE catalog is fetched at runtime so divergence only matters if the BE is unreachable. |

---

## 7. Files Changed

### Backend
| File | Change |
|---|---|
| `service/auth/PermissionCatalog.java` | **NEW** — canonical permission registry |
| `api/admin/AdminPermissionsController.java` | **NEW** — `GET /api/v1/admin/permissions` |
| `service/admin/AdminRoleService.java` | Updated — validation, in-use guard, ID format |
| `api/admin/AdminRolesController.java` | Updated — gates `admin-users.*` → `roles.*` |
| `persistence/repository/auth/AdminUserJpaRepository.java` | Updated — added `countByRole` |
| `service/auth/AdminRolePermissions.java` | Updated — reference-only cleanup |
| `resources/db/migration/V81__add_roles_permissions.sql` | **NEW** — seeds `roles.read/write` for ADMIN |
| `test/resources/db/test-seed.sql` | Updated — idempotent inserts for `roles.read/write` |
| `test/java/.../api/AdminRolesApiTest.java` | **NEW** — 27 integration tests |

### Frontend
| File | Change |
|---|---|
| `src/lib/adminApi.js` | Updated — `fetchPermissionCatalog()`, mock ALL_PERMS |
| `src/screens/RolesScreen.jsx` | Updated — catalog-driven, new groups, catalog prop threading |
| `src/App.jsx` | Updated — 3 permission gate strings |
| `src/locales/vi.json` | Updated — 16 new/updated i18n keys |
| `src/locales/en.json` | Updated — 16 new/updated i18n keys |

### Docs
| File | Change |
|---|---|
| `docs/business/USER_ROLES.md` | Updated — stale `admin-users.write` gate description |
| `docs/audits/ADMIN_USERS_ROLES_RBAC_P1_HARDENING_REPORT.md` | **NEW** — this file |
