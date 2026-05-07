# Admin Users + Roles/RBAC Module Audit

> Audit date: 2026-05-07
> Scope: bigbike-admin (FE) + bigbike-backend (BE), Admin Users + Roles modules + cross-cutting RBAC runtime
> Branch: `main` (HEAD: e4ff41f)
> Methodology: code reading only. No code was modified during this audit. Every finding cites file:line evidence.

---

## 1. Executive Summary

**Verdict: NOT production-ready.**

The Admin Users module is in reasonable shape (CRUD + safety guards + audit log + tests), but the Roles/RBAC pipeline is **broken end-to-end**. The Roles UI persists changes to the database, but no part of the runtime authentication/authorization stack reads from that database — runtime auth is still driven by a hardcoded `AdminRolePermissions.MAP` in Java. The "dynamic role" feature is therefore **functional placebo** at the moment: editing permissions in the UI does not affect what users can actually do.

In addition, the SecurityConfig URL gates require `ROLE_ADMIN` for the catch-all `/api/v1/admin/**` rule, which silently blocks every non-ADMIN built-in role (EDITOR/AUTHOR/CONTRIBUTOR/SEO_EDITOR) and **every custom role ever created via the Roles UI** from reaching admin endpoints they nominally have permission for.

There is also one privilege-escalation footgun: `DevAdminAuthService.requirePermission()` falls back to ADMIN's permission set for any unknown role string. Combined with the static-map issue, this is a defense-in-depth failure rather than an exploitable hole today (because SecurityConfig blocks first), but it would become exploitable the moment SecurityConfig is generalised.

### Production readiness score (per surface)

| Surface | Score | One-line reason |
|---|---|---|
| Admin Users — FE | 4/5 | Solid UX, all states, sensitive-action confirms; minor gap (no `roleIgnored` actually triggers; no i18n parity check). |
| Admin Users — BE | 3.5/5 | All guards & audit present, but DTO is `Map<String,String>`, no GET-detail test, no permission-denied test. |
| Roles — FE | 3.5/5 | Full CRUD UI; dirty/sensitive/save-summary/discard guards. PERMISSION_CATALOG **stale** (missing pos/receivables/reports). |
| Roles — BE | 2/5 | API exists and writes DB, but writes nothing the runtime reads. No permission-key validation. No "role-in-use" check on delete. **No tests at all.** |
| **Runtime RBAC** | **1/5** | **DB writes are inert.** Static map drives `/auth/me` and `requirePermission`. SecurityConfig blocks every non-ADMIN role at URL level. |
| DB model | 3/5 | Schema is fine; seed matches static map (mostly). Drift between `admin_users.role` (used) and `admin_user_roles` (orphan column). |
| Test coverage | 2/5 | AdminUsersApiTest is OK (20 tests). **Zero** tests for AdminRolesController, AdminRoleService, runtime-RBAC, SecurityConfig RBAC, custom-role flow, permission-catalog completeness. |

---

## 2. Files Inspected

### Frontend (`bigbike-admin/`)

- [src/App.jsx](bigbike-admin/src/App.jsx) — route table, NAV_GROUP_DEFS, `routePermission`, permission-driven sidebar
- [src/screens/AdminUsersScreen.jsx](bigbike-admin/src/screens/AdminUsersScreen.jsx) — list/create/edit drawer, sensitive-action confirms
- [src/screens/RolesScreen.jsx](bigbike-admin/src/screens/RolesScreen.jsx) — Roles UI, PERMISSION_CATALOG, sensitive-perm confirms, save-summary, create/delete role
- [src/lib/adminApi.js](bigbike-admin/src/lib/adminApi.js) — `fetchAdminUsers`, `createAdminUser`, `updateAdminUser`, `fetchRoles`, `updateRolePermissions`, `createRole`, `deleteRole`, `fetchCurrentAdminUser`, `loginAdmin`, `logoutAdmin`, `refreshAccessToken`
- [src/lib/auth.jsx](bigbike-admin/src/lib/auth.jsx) — AuthProvider/bootstrap/login/logout, permission set
- [src/lib/authStorage.js](bigbike-admin/src/lib/authStorage.js) — in-memory access/refresh storage
- [src/locales/vi.json](bigbike-admin/src/locales/vi.json) — `adminUsers.*`, `roles.*` keys
- [src/locales/en.json](bigbike-admin/src/locales/en.json) — same keys (parity not deeply audited; both files have the structures)

### Backend (`bigbike-backend/`)

- [src/main/java/.../api/admin/AdminAdminUsersController.java](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/admin/AdminAdminUsersController.java)
- [src/main/java/.../api/admin/AdminRolesController.java](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/admin/AdminRolesController.java)
- [src/main/java/.../api/auth/AuthController.java](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/auth/AuthController.java)
- [src/main/java/.../service/admin/AdminAdminUsersService.java](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminAdminUsersService.java)
- [src/main/java/.../service/admin/AdminRoleService.java](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminRoleService.java)
- [src/main/java/.../service/auth/AdminAuthService.java](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/auth/AdminAuthService.java)
- [src/main/java/.../service/auth/DevAdminAuthService.java](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/auth/DevAdminAuthService.java)
- [src/main/java/.../service/auth/AdminRolePermissions.java](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/auth/AdminRolePermissions.java)
- [src/main/java/.../config/SecurityConfig.java](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/config/SecurityConfig.java)
- [src/main/java/.../config/JwtAuthFilter.java](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/config/JwtAuthFilter.java)
- [src/main/java/.../domain/auth/AdminPrincipal.java](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/domain/auth/AdminPrincipal.java)
- [src/main/java/.../domain/auth/AdminRole.java](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/domain/auth/AdminRole.java)
- [src/main/java/.../persistence/entity/auth/AdminUserEntity.java](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/persistence/entity/auth/AdminUserEntity.java)
- [src/main/java/.../persistence/entity/auth/AdminRoleEntity.java](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/persistence/entity/auth/AdminRoleEntity.java)
- [src/main/java/.../persistence/repository/auth/AdminUserJpaRepository.java](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/persistence/repository/auth/AdminUserJpaRepository.java)
- [src/main/java/.../persistence/repository/auth/AdminRoleJpaRepository.java](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/persistence/repository/auth/AdminRoleJpaRepository.java)

### DB / Migrations

- [V2__create_admin_auth_tables.sql](bigbike-backend/src/main/resources/db/migration/V2__create_admin_auth_tables.sql) — `admin_users`, `admin_refresh_tokens`
- [V12__create_admin_user_roles_table.sql](bigbike-backend/src/main/resources/db/migration/V12__create_admin_user_roles_table.sql) — `admin_user_roles` (orphan; never read for auth)
- [V49__create_roles_permissions_tables.sql](bigbike-backend/src/main/resources/db/migration/V49__create_roles_permissions_tables.sql) — `admin_roles`, `role_permissions`, seeds 7 system roles
- [V58__add_redirect_permissions.sql](bigbike-backend/src/main/resources/db/migration/V58__add_redirect_permissions.sql) — adds `redirects.*` to ADMIN, SEO_EDITOR
- [V76__fix_audit_log_admin_role_resource_type.sql](bigbike-backend/src/main/resources/db/migration/V76__fix_audit_log_admin_role_resource_type.sql) — back-fix audit `resource_type`
- [V78__add_reports_permissions.sql](bigbike-backend/src/main/resources/db/migration/V78__add_reports_permissions.sql) — adds `reports.*` to ADMIN, SHOP_MANAGER

### Tests

- [src/test/java/.../api/AdminUsersApiTest.java](bigbike-backend/src/test/java/com/bigbike/bigbike_backend/api/AdminUsersApiTest.java) — 20 integration tests (auth, list/filter/search, create, update guards, audit log).
- **No** test file for `AdminRolesController`, `AdminRoleService`, `AdminRolePermissions`, `SecurityConfig`, `JwtAuthFilter`, custom-role end-to-end, or runtime permission resolution. Verified by `grep -rln AdminRoleService|AdminRoleEntity|AdminRoleJpaRepository src/test/`.

### Docs

- [docs/engineering/PERMISSION_MATRIX.md](docs/engineering/PERMISSION_MATRIX.md) — explicitly states "Admin role-to-permission mapping is defined in `AdminRolePermissions.java`" (i.e. docs admit the static-map source of truth; UI promises something different).
- [docs/engineering/API_CONTRACT.md](docs/engineering/API_CONTRACT.md) — does **not** document `/api/v1/admin/admin-users/**` or `/api/v1/admin/roles/**` endpoints (only mentions `ADMIN_USER` and `ADMIN_ROLE` audit `resource_type` rows).
- [docs/business/USER_ROLES.md](docs/business/USER_ROLES.md) — not deeply audited (out of mismatch scope here, but flag below).

---

## 3. Route & Screen Coverage

| Route | Screen | Required permission | Status | Issues |
|---|---|---|---|---|
| `/admin/admin-users` | `AdminUsersScreen` | `admin-users.read` (sidebar+route) | ✅ parsed at [App.jsx:163](bigbike-admin/src/App.jsx#L163), gated at [App.jsx:205](bigbike-admin/src/App.jsx#L205) | Deep link: gated by `requiredPermission` check at [App.jsx:322](bigbike-admin/src/App.jsx#L322). Fallback path at [App.jsx:285-288](bigbike-admin/src/App.jsx#L285-L288) is reasonable. |
| `/admin/roles` | `RolesScreen` | `admin-users.read` (sidebar+route) | ✅ parsed at [App.jsx:171](bigbike-admin/src/App.jsx#L171), gated at [App.jsx:213](bigbike-admin/src/App.jsx#L213) | **P1: should be `roles.read`** (see §6, §7-Finding-9). Currently both Roles and AdminUsers share `admin-users.read/write`. |
| `/admin/admin-users/:id` | (n/a) | — | ⚠️ Not handled in `parseRoute`. BE controller exposes `GET /admin-users/{id}` ([AdminAdminUsersController.java:62-69](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/admin/AdminAdminUsersController.java#L62-L69)) but FE never calls it (no `fetchAdminUserDetail` exists in `adminApi.js`). The edit drawer in [AdminUsersScreen.jsx:159-164](bigbike-admin/src/screens/AdminUsersScreen.jsx#L159-L164) reuses the row from the list. Acceptable, but `GET /admin-users/{id}` is dead-code from the FE perspective. |

Sidebar visibility: [App.jsx:264-275](bigbike-admin/src/App.jsx#L264-L275) filters by `hasPermission(item.permission)` which uses `permissions` from `/auth/me`. Because `/auth/me` is driven by the static map (see §6 / Finding 1), sidebar visibility cannot be customised by editing roles in the UI — it always reflects the static map.

---

## 4. Feature Coverage

### 4a. Admin Users

| Feature | FE | BE | DB | Test | Status | Notes |
|---|---|---|---|---|---|---|
| List | ✅ [AdminUsersScreen.jsx:138-151](bigbike-admin/src/screens/AdminUsersScreen.jsx#L138-L151) | ✅ [AdminAdminUsersController.java:49-60](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/admin/AdminAdminUsersController.java#L49-L60) | ✅ | ✅ test #4 | OK | List uses `findAll()` + in-memory filter ([AdminAdminUsersService.java:59-77](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminAdminUsersService.java#L59-L77)) — fine for admin volumes, won't scale beyond ~10k. |
| Search (`q`) | ✅ debounce 250ms | ✅ matches email or displayName | — | ✅ test #7 | OK | |
| Filter role | ✅ | ✅ exact match | — | ✅ test #5 | OK | |
| Filter status | ✅ | ✅ exact match | — | ✅ test #6 | OK | |
| Pagination | ✅ via `PaginationControls` | ✅ via `PaginationService.paginate` (in-memory) | — | partial (test #4 asserts `pagination.page`) | OK | |
| Empty state | ✅ [AdminUsersScreen.jsx:378-395](bigbike-admin/src/screens/AdminUsersScreen.jsx#L378-L395) | — | — | — | OK | distinguishes empty-with-filter vs empty-clean |
| Loading state | ✅ via AdminTable `loading` prop | — | — | — | OK | |
| Error state | ✅ retryable `StatePanel` | — | — | — | OK | |
| Create | ✅ modal with email/displayName/role/password | ✅ POST [AdminAdminUsersController.java:71-88](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/admin/AdminAdminUsersController.java#L71-L88) | ✅ | ✅ tests #8-13 | OK | |
| Edit displayName | ✅ | ✅ | ✅ | ✅ test #20 | OK | |
| Change role | ✅ via select | ✅ same PATCH endpoint | ✅ | ✅ via test #16, #17 negative paths | OK; note guard tests below |
| Change status | ✅ | ✅ | ✅ | ✅ tests #14, #15, #18 | OK | |
| Reset / change password | ✅ inline `newPassword` field on edit drawer | ✅ via `newPassword` field of PATCH | ✅ | ✅ test #19 (asserts no raw pw in audit) | OK | No separate "reset password" admin action; admin overwrites directly. |
| Confirm sensitive action | ✅ for status≠ACTIVE and any role change ([AdminUsersScreen.jsx:191-214](bigbike-admin/src/screens/AdminUsersScreen.jsx#L191-L214)) | n/a | — | — | OK | |
| Read-only behavior (no `admin-users.write`) | ✅ "Add" button hidden, action column hidden, edit not reachable | ✅ BE rejects via `requirePermission("admin-users.write")` | — | ❌ no negative test | partial | No FE test, no BE test of forbidden case. |
| UX on backend error | ✅ | n/a | — | — | OK | |
| UX on permission denied | partial — banner via `roleIgnored` key exists at [AdminUsersScreen.jsx:232-234](bigbike-admin/src/screens/AdminUsersScreen.jsx#L232-L234) but **dead code**: BE always applies role if `requirePermission` passed. | n/a | — | — | dead-code | The check `r.item.role !== editForm.role` will never be true on a successful response because BE doesn't quietly drop fields. Remove or document. |
| i18n keys | ✅ `adminUsers.*` block in vi/en | n/a | — | — | OK | |
| Self-deactivate guard | n/a (no FE warning) | ✅ [AdminAdminUsersService.java:149-151](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminAdminUsersService.java#L149-L151) | — | ✅ test #15 | OK |
| SUPER_ADMIN self-demote guard | n/a | ✅ [AdminAdminUsersService.java:158-160](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminAdminUsersService.java#L158-L160) | — | ✅ test #16 | OK |
| Last-active-SUPER_ADMIN guard | n/a | ✅ [AdminAdminUsersService.java:161-168](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminAdminUsersService.java#L161-L168) | — | partial (test #17 admits collapsing into self-demote) | minor | Test acknowledges weakness; should add a separate test acting as a *different* SUPER_ADMIN. |
| Audit log writes | n/a | ✅ ADMIN_USER_CREATED / ADMIN_USER_UPDATED | ✅ resourceId=UUID | ✅ tests #8, #19, #20 | OK | |
| Password not logged | n/a | ✅ uses `passwordChanged` flag | — | ✅ test #19 | OK | |
| Password hash never returned | ✅ `toMap` excludes hash | ✅ | — | implicit | OK | |

### 4b. Roles / RBAC

| Feature | FE | BE | DB | Test | Status | Notes |
|---|---|---|---|---|---|---|
| List roles | ✅ [RolesScreen.jsx:836-855](bigbike-admin/src/screens/RolesScreen.jsx#L836-L855) | ✅ [AdminRolesController.java:46-50](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/admin/AdminRolesController.java#L46-L50) | ✅ reads `admin_roles + role_permissions` | ❌ | partial | No test exists. |
| View role detail / perms by group | ✅ via `PERMISSION_CATALOG` groups | ✅ list returns full perms array per role | — | ❌ | partial | FE catalog **stale** (P0-3). |
| Edit permissions | ✅ checkbox draft + dirty + sensitive confirm + summary dialog | ✅ PUT permissions | ✅ writes role_permissions + audit | ❌ | **broken** | DB write succeeds but **does not affect runtime auth** (P0-1). |
| Save permissions | ✅ | ✅ writes audit ROLE_PERMISSIONS_UPDATED | ✅ | ❌ | broken (same) | |
| Create custom role | ✅ dialog with auto-id from name | ✅ [AdminRolesController.java:71-94](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/admin/AdminRolesController.java#L71-L94) | ✅ writes admin_roles + audit ROLE_CREATED | ❌ | **broken end-to-end** | Custom role is **unusable** at runtime: SecurityConfig `.hasRole("ADMIN")` blocks it (P0-2); `requirePermission` falls back to ADMIN's permissions for unknown role keys (P0-4). |
| Delete custom role | ✅ confirm dialog | ✅ [AdminRolesController.java:97-102](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/admin/AdminRolesController.java#L97-L102) | ✅ blocks system roles | ❌ | partial | **No "role-in-use" check** — orphans assigned admin users (P1-1). |
| Block edit of SUPER_ADMIN | ✅ FE hides edit button when `id===SUPER_ADMIN` | ✅ [AdminRoleService.java:55-57](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminRoleService.java#L55-L57) | — | ❌ | OK | |
| Block delete of system role | ✅ FE hides delete when `role.isSystem` | ✅ [AdminRoleService.java:105-107](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminRoleService.java#L105-L107) | — | ❌ | OK | |
| Sensitive permission warning | ✅ confirm dialog before grant/remove for `admin-users.write`, `settings.write`, `audit-logs.read` | ❌ no BE check | — | — | FE-only | BE accepts any string as a permission. |
| Save summary dialog | ✅ shows added/removed with sensitive marker | n/a | — | — | OK | |
| Dirty / discard guard | ✅ | n/a | — | — | OK | |
| Empty/loading/error states | ✅ | n/a | — | — | OK | |
| i18n keys | ✅ `roles.*` block in vi/en | n/a | — | — | OK |
| Permission catalog completeness | ❌ **stale** — missing `pos.*`, `receivables.*`, `reports.*` | n/a | n/a | ❌ | **P0-3** | FE [RolesScreen.jsx:8-60](bigbike-admin/src/screens/RolesScreen.jsx#L8-L60) lists 30 perms, BE [AdminRolePermissions.java:17-38](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/auth/AdminRolePermissions.java#L17-L38) ADMIN role has 41+. Custom roles cannot be granted POS/receivables/reports via UI. |
| Permission key validation | ❌ none | ❌ none — any string accepted by `updateRolePermissions` / `createRole` | — | ❌ | **P1** | An admin can persist garbage like `wat.lol` as a permission. |
| Role ID format validation | ✅ FE upper-case, A-Z 0-9 _ regex | ❌ BE only normalises whitespace ([AdminRoleService.java:78](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminRoleService.java#L78)) | — | ❌ | P1 | BE accepts `Lower-case-id`. |

---

## 5. API Contract Audit

### Admin Users API

| API | Method | Permission | Request | Response | Validation | Test | Status | Issues |
|---|---|---|---|---|---|---|---|---|
| `/api/v1/admin/admin-users` | GET | `admin-users.read` (controller) + `ROLE_ADMIN` (SecurityConfig) | `page`, `size` (validated `@Min/@Max`), `q`, `role`, `status` | `ApiListResponse` items[]+pagination | OK | ✅ test #4-7 | OK | DTO is `Map<String,Object>` — OpenAPI cannot generate accurate schema. |
| `/api/v1/admin/admin-users/{id}` | GET | `admin-users.read` | path UUID | `ApiDataResponse` | OK | ❌ | **dead from FE** | No FE caller; no test. |
| `/api/v1/admin/admin-users` | POST | `admin-users.write` + `ROLE_ADMIN` | `{email,displayName,role,password}` (`Map<String,String>`) | `ApiDataResponse` | email format, dup, role exists, password ≥ 8, displayName/role required | ✅ tests #8-13 | OK | Returns 409 for *all* validation errors instead of 400/422 (`ConflictException` reuse). Acceptable but technically wrong HTTP semantics. |
| `/api/v1/admin/admin-users/{id}` | PATCH | `admin-users.write` + `ROLE_ADMIN` | `{displayName?,status?,newPassword?,role?}` | `ApiDataResponse` | status ∈ {ACTIVE,DISABLED,SUSPENDED}, role exists, self-deactivate, SUPER_ADMIN self-demote, last-SUPER_ADMIN | ✅ tests #14-18, 20 | OK | Same 409 vs 400 semantics. Audit log includes `displayName` only when changed; always includes role+status (acceptable). |

### Roles API

| API | Method | Permission | Request | Response | Validation | Test | Status | Issues |
|---|---|---|---|---|---|---|---|---|
| `/api/v1/admin/roles` | GET | `admin-users.read` + `ROLE_ADMIN` | none | `ApiDataResponse<List<...>>` | n/a | ❌ | partial | Returns array, not paginated wrapper — FE [adminApi.js:2098-2100](bigbike-admin/src/lib/adminApi.js#L2098-L2100) handles it specially (`Array.isArray(payload?.data)`). |
| `/api/v1/admin/roles/{id}/permissions` | PUT | `admin-users.write` + `ROLE_ADMIN` | `{permissions:[...]}` | `ApiDataResponse` | only blocks `SUPER_ADMIN` | ❌ | **broken at runtime** | (a) Writes DB, but DB is never read for auth (P0-1). (b) **No permission-key validation** (P1). (c) No "you can only grant permissions you yourself hold" check → privilege-escalation risk (P1, see §7 Finding 7). |
| `/api/v1/admin/roles` | POST | `admin-users.write` + `ROLE_ADMIN` | `{id,name,description?,permissions[]}` | `ApiDataResponse` | id non-blank, name non-blank, not duplicate | ❌ | broken at runtime | Same set of issues + ID format only normalised (`toUpperCase`+space→_); accepts e.g. `"Foo-Bar"`. |
| `/api/v1/admin/roles/{id}` | DELETE | `admin-users.write` + `ROLE_ADMIN` | path | `204` | only blocks `isSystem` roles | ❌ | partial | **No check that role is unused.** Admin users with that role become orphans (P1-1). |

### Shape inconsistency

`fetchRoles` expects `payload.data` to be a *plain array* ([adminApi.js:2099](bigbike-admin/src/lib/adminApi.js#L2099)), not the `{items, pagination}` shape used by everything else. This is a unique-of-its-kind API contract. Documented neither in [API_CONTRACT.md](docs/engineering/API_CONTRACT.md) nor in OpenAPI.

---

## 6. Permission/RBAC Audit (deep)

### 6.1 Where is the source of truth?

There are **three** competing sources today:

1. **Static**: `AdminRolePermissions.MAP` ([AdminRolePermissions.java:15-69](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/auth/AdminRolePermissions.java#L15-L69)).
2. **Database**: `admin_roles` + `role_permissions` (seeded by V49, mutated by `AdminRoleService`).
3. **FE**: `PERMISSION_CATALOG` ([RolesScreen.jsx:8-60](bigbike-admin/src/screens/RolesScreen.jsx#L8-L60)) — labels/groups only.

**Truth at runtime: #1 (static).** Evidence:

- `AdminAuthService.toProfile()` ([AdminAuthService.java:143-154](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/auth/AdminAuthService.java#L143-L154)) → calls `permissionsForRole(user.getRole())` which delegates to `AdminRolePermissions.forRole`. This is what `/auth/me` returns.
- `AdminAuthService.buildTokenResponse()` ([AdminAuthService.java:135-141](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/auth/AdminAuthService.java#L135-L141)) → same. This is what login returns.
- `DevAdminAuthService.requirePermission()` ([DevAdminAuthService.java:69-97](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/auth/DevAdminAuthService.java#L69-L97)) → reads `ROLE_PERMISSION_MAP` which is `AdminRolePermissions.MAP`.

`AdminRoleService` writes to the DB but **no authentication or authorization code path reads from `AdminRoleEntity` or `AdminRoleJpaRepository`** for permission resolution. (Verified: `grep -rln AdminRoleService\|AdminRoleEntity\|AdminRoleJpaRepository src/main/` — only consumers are `AdminRolesController` and `AdminAdminUsersService.isValidRole()` — that one only checks role *existence*, not permissions.)

The only consumer of `AdminRoleEntity.permissions` for runtime authorization is… nobody.

### 6.2 What happens when an admin edits role permissions in the UI?

1. PUT `/admin/roles/{id}/permissions` succeeds → `role_permissions` rows updated → audit log written.
2. **Nothing else changes.** Subsequent calls to `/auth/me` and to any controller method continue to use the static map.
3. The FE re-renders the Roles screen with the new DB data (because `fetchRoles` reads DB). UI looks like it worked.
4. If the affected admin re-logs in: their JWT-driven permission set is still computed from the static map — they see no change in what they can actually do.

**The Roles editor is functional placebo.**

### 6.3 What happens to a custom role created from the UI?

Walk-through for a hypothetical custom role `WAREHOUSE_STAFF` with permissions `[products.read, products.update]`:

1. `POST /admin/roles` creates row in `admin_roles` + 2 rows in `role_permissions` ✅.
2. Admin assigns user X to role `WAREHOUSE_STAFF` via PATCH `/admin/admin-users/{id}` `{role:"WAREHOUSE_STAFF"}`. `AdminAdminUsersService.isValidRole` ([AdminAdminUsersService.java:211-213](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminAdminUsersService.java#L211-L213)) accepts it because `adminRoleRepo.existsById` returns true ✅.
3. User X logs in → `AdminAuthService.login` issues JWT with `role: "WAREHOUSE_STAFF"`. Login response's `permissions` is computed from `AdminRolePermissions.forRole("WAREHOUSE_STAFF")` → returns **empty list** (`MAP.getOrDefault` returns `List.of()`). FE permission set is empty → **no sidebar items visible**, every route 403.
4. Even if user X manually deep-links to `/admin/products`: FE 403 first, but if they call the API directly, request hits `JwtAuthFilter` which adds authority `ROLE_WAREHOUSE_STAFF`. Then SecurityConfig rule `.requestMatchers("/api/v1/admin/**").hasRole("ADMIN")` → **blocked at URL gate (403)**.
5. Even if SecurityConfig were generalised to allow `ROLE_*`: `DevAdminAuthService.requirePermission` ([DevAdminAuthService.java:73-77](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/auth/DevAdminAuthService.java#L73-L77)) does `ROLE_PERMISSION_MAP.getOrDefault(role, ROLE_PERMISSION_MAP.getOrDefault("ADMIN", List.of()))` — i.e. **falls back to ADMIN's full permission set for any unknown role**. That's a privilege-escalation footgun (latent today because of #4, but exploitable as soon as URL gating is loosened).

### 6.4 Are there conflicts between SecurityConfig and controller-level checks?

Yes — and they are confusing rather than dangerous today:

- [SecurityConfig.java:103-115](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/config/SecurityConfig.java#L103-L115):
  - L103 POS: `hasAnyRole(ADMIN, SUPER_ADMIN, SHOP_MANAGER)`
  - L105 coupons: same
  - L107 dashboard GET: same
  - **L109 catch-all: `/api/v1/admin/** → hasRole(ADMIN)`** — this is processed in declared order; everything below is shadowed.
  - L111 shipping `hasRole(ADMIN)`, L113 reviews same, L115 admin-users same — **all shadowed** by L109. They are dead rules.
- Controller-level: each controller calls `devAdminAuthService.requirePermission(request, "<perm>")`. Path passes only if SecurityConfig URL gate passes first **and** the permission check passes.

**Net effect:** for `/api/v1/admin/**` in production:

| Role | URL gate | requirePermission outcome |
|---|---|---|
| `SUPER_ADMIN` | ✅ (JwtAuthFilter adds both `ROLE_SUPER_ADMIN` and `ROLE_ADMIN`, [JwtAuthFilter.java:46-48](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/config/JwtAuthFilter.java#L46-L48)) | `*` wildcard → all pass |
| `ADMIN` | ✅ | full permission set → pass |
| `SHOP_MANAGER` | ❌ except for `/pos/**`, `/coupons/**`, `/dashboard` GET (whitelisted before L109) | static perms used if URL gate passed |
| `EDITOR` / `AUTHOR` / `CONTRIBUTOR` / `SEO_EDITOR` | **❌ blocked at URL gate** | unreachable — even though static map grants e.g. `content.read`, `media.write`, the URL never lets them through |
| Any custom role | **❌ blocked at URL gate** | unreachable |

→ The 4 lower built-in roles **cannot use the admin API at all** in production today. (They might appear to work in dev because `bigbike.auth.dev-header-enabled=true` in dev profiles bypasses the JWT path — but in prod with real JWTs they'd be blocked.)

### 6.5 Should Roles use its own permission keys?

**Yes — recommended.** Today, both `/admin/admin-users` and `/admin/roles` use `admin-users.read/write` ([AdminUsersScreen.jsx](bigbike-admin/src/screens/AdminUsersScreen.jsx), [App.jsx:213](bigbike-admin/src/App.jsx#L213), [AdminRolesController.java:48,59,78,100](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/admin/AdminRolesController.java#L48)).

This bundles two distinct concerns:

- "see/edit who is an admin" (admin-users.*)
- "see/edit what each role can do" (roles.* / permissions.*)

Granting `admin-users.write` for the purpose of letting someone create new admin accounts inadvertently grants them the ability to grant *themselves* any permission by editing their own role — that's the privilege-escalation finding §7-7.

Recommendation: add `roles.read`, `roles.write` and gate Roles UI / controller on those, leaving `admin-users.*` for user management only. (Then add `permissions.read` if catalog ever becomes editable.)

### 6.6 Permission catalog completeness

FE catalog ([RolesScreen.jsx:8-60](bigbike-admin/src/screens/RolesScreen.jsx#L8-L60)) covers:

- orders, customers, coupons, shipping, reviews, products, catalog, content, media, menus, sliders, home_videos, redirects, settings, admin-users, audit-logs.

Missing (present in BE static map, used by controllers):

| Permission | Used by |
|---|---|
| `pos.read`, `pos.write`, `pos.price_override` | `AdminPosController`, [AdminRolePermissions.java:34](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/auth/AdminRolePermissions.java#L34) |
| `receivables.read`, `receivables.create`, `receivables.record_payment`, `receivables.write_off`, `receivables.override_limit`, `receivables.export` | `AdminReceivableController`, [AdminRolePermissions.java:35-36](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/auth/AdminRolePermissions.java#L35-L36) |
| `reports.read`, `reports.export` | `AdminReportController`, [AdminRolePermissions.java:37](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/auth/AdminRolePermissions.java#L37) |

The FE does render unknown perms in an "Other permissions" group ([RolesScreen.jsx:765-799](bigbike-admin/src/screens/RolesScreen.jsx#L765-L799)) — they appear read-only with their raw key. So the catalog gap is "visible-but-degraded" rather than "invisible". Still: an admin cannot **add** these perms via the catalog UI to a custom role.

---

## 7. Validation & Security Findings

### P0 — Critical

#### Finding 1 — Runtime authorization ignores DB role permissions
- **Title**: Editing role permissions has zero runtime effect; static `AdminRolePermissions.MAP` is the actual source of truth.
- **Evidence**:
  - `AdminAuthService.permissionsForRole` → static [AdminAuthService.java:114-116](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/auth/AdminAuthService.java#L114-L116)
  - `DevAdminAuthService.requirePermission` reads `ROLE_PERMISSION_MAP` (= static) [DevAdminAuthService.java:73-77](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/auth/DevAdminAuthService.java#L73-L77)
  - `AdminRoleEntity` is never injected into any auth service.
- **Root cause**: The dynamic-roles feature was scaffolded (controller, service, schema, audit) but never wired into the auth pipeline. V49 migration explicitly says *"Replaces hardcoded AdminRolePermissions.MAP"* — that replacement is incomplete.
- **Impact**: Roles UI is misleading; security policy cannot be changed without redeploying the backend. Audit logs of permission changes record events that did not actually take effect. False sense of control.
- **Recommended fix**: Introduce a `RolePermissionResolver` service backed by `AdminRoleJpaRepository` (with a small in-memory cache invalidated on writes via Spring events or a `roleVersion` row). Route `AdminAuthService.permissionsForRole` and `DevAdminAuthService.requirePermission` through it. Keep the static map as a **fallback only when DB role row is missing** — and then warn loudly.
- **Suggested test**: Integration test that (1) creates user with role `EDITOR`, (2) logs in & calls `/auth/me`, (3) `PUT /admin/roles/EDITOR/permissions` with extended set, (4) the same user calls a controller that requires the new perm and gets 200, (5) old user calls a controller for a removed perm and gets 403.

#### Finding 2 — SecurityConfig blocks every non-(ADMIN/SUPER_ADMIN/SHOP_MANAGER) role from `/api/v1/admin/**`
- **Title**: `.hasRole("ADMIN")` catch-all renders EDITOR/AUTHOR/CONTRIBUTOR/SEO_EDITOR/custom roles unable to use the admin API in production.
- **Evidence**: [SecurityConfig.java:109](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/config/SecurityConfig.java#L109) catch-all; [JwtAuthFilter.java:46-48](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/config/JwtAuthFilter.java#L46-L48) only adds extra `ROLE_ADMIN` for SUPER_ADMIN.
- **Root cause**: URL-gate strategy hardcodes a single role; doesn't consult the dynamic permission system.
- **Impact**: System ships with documented roles (e.g. EDITOR) that cannot exercise the permissions docs claim they have. Custom-role feature is unreachable end-to-end. In dev profiles with `dev-header-enabled=true`, this is hidden because the JWT path is bypassed by header auth.
- **Recommended fix**: Move from role-based URL gating to *authenticated + permission-based* gating: e.g. mark `/api/v1/admin/**` as `authenticated()` and rely on controller `requirePermission()` (which becomes DB-aware after Finding 1 fix). Alternatively, generalise to `hasAnyRole("SUPER_ADMIN","ADMIN","SHOP_MANAGER","EDITOR","AUTHOR","CONTRIBUTOR","SEO_EDITOR")` plus a runtime check that custom-role authorities also pass — but this still leaves custom roles broken.
- **Suggested test**: One controller endpoint per role. With JWT for that role, expect 200 on the endpoints that role has permission for, 403 elsewhere.

#### Finding 3 — Permission catalog stale; admins cannot grant POS/receivables/reports via UI
- **Title**: FE `PERMISSION_CATALOG` is missing 11 permissions that are live in the backend.
- **Evidence**: [RolesScreen.jsx:8-60](bigbike-admin/src/screens/RolesScreen.jsx#L8-L60) vs [AdminRolePermissions.java:34-37](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/auth/AdminRolePermissions.java#L34-L37) and V49/V58/V78 migrations.
- **Missing keys**: `pos.read`, `pos.write`, `pos.price_override`, `receivables.read`, `receivables.create`, `receivables.record_payment`, `receivables.write_off`, `receivables.override_limit`, `receivables.export`, `reports.read`, `reports.export`.
- **Impact**: Even after Finding 1 is fixed, the UI cannot grant these perms via checkboxes; only via the "Other permissions" read-only display. An admin trying to build a "POS-only" role hits a wall.
- **Recommended fix**: Either (a) extend `PERMISSION_CATALOG` with the missing entries + i18n keys + sensible groupings (Sales→POS/receivables/reports), or (b) make the catalog itself a backend-served endpoint (`GET /admin/permissions`) so it can never go stale.
- **Suggested test**: A FE/JS unit test that asserts `KNOWN_PERM_KEYS ⊇` expected set; a contract test that asserts every permission ever passed to `requirePermission(...)` appears in `KNOWN_PERM_KEYS`.

#### Finding 4 — Privilege escalation via unknown-role fallback
- **Title**: `DevAdminAuthService.requirePermission` falls back to ADMIN's permission set for any unrecognised role string.
- **Evidence**: [DevAdminAuthService.java:73-77](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/auth/DevAdminAuthService.java#L73-L77):
  ```java
  List<String> permissions = ROLE_PERMISSION_MAP.getOrDefault(
          principal.role().toUpperCase(Locale.ROOT),
          ROLE_PERMISSION_MAP.getOrDefault("ADMIN", List.of())
  );
  ```
- **Root cause**: Defensive `getOrDefault` chosen too generously.
- **Impact**: Today this is masked by Finding 2 (URL gate blocks unknown roles first). The moment that gate is fixed, every custom role and every typo'd role string gets ADMIN's permission set. Authorization-by-default-allow.
- **Recommended fix**: `MAP.getOrDefault(principal.role(), List.of())` → if no match, throw or return empty. Prefer empty + audit-log a warning. Once the DB resolver from Finding 1 is in place, treat "no resolver result" as deny.
- **Suggested test**: Integration test where a JWT carries an unknown role; controller call must return 403.

#### Finding 5 — No permission-key validation on role create/update
- **Title**: `AdminRoleService.updateRolePermissions` and `createRole` accept any string as a permission, including typos and arbitrary garbage.
- **Evidence**: [AdminRoleService.java:51-68](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminRoleService.java#L51-L68), [AdminRoleService.java:71-98](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminRoleService.java#L71-L98).
- **Impact**: Garbage in `role_permissions` (e.g. `wat.lol`, `admin-uers.read` typos that *look* right but never match `requirePermission` strings). Silent broken access. After Finding 1 is fixed, this becomes the dominant footgun.
- **Recommended fix**: Maintain a canonical permission registry (a constant set in Java, owned by the auth package; or a `permissions` table). Validate every incoming permission key. Reject 400 with `details:[{field:"permissions[i]", message:"Unknown permission: ..."}]`.
- **Suggested test**: PUT permissions with `["unknown.perm"]` → 400 with explicit error; POST role with same → 400.

### P1 — High

#### Finding 6 — Deleting a role does not check if any admin user still uses it
- **Title**: `AdminRoleService.deleteRole` removes the role and its permissions, but admin users referencing it via `admin_users.role` are left orphaned.
- **Evidence**: [AdminRoleService.java:100-114](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminRoleService.java#L100-L114). No FK between `admin_users.role` and `admin_roles.id` (V2 + V49). No service-level check.
- **Impact**: After delete, those users keep their string role; their JWT and in-memory cache work until logout, then login produces an empty permission list. Worse: a re-create of the same role ID later will retroactively re-grant access. Surprising, hard to debug.
- **Recommended fix**: Either (a) add `count by role` query in `AdminUserJpaRepository`, fail with 409 `"Cannot delete role assigned to N admins"`, or (b) require caller to first reassign or disable affected users (FE flow), or (c) cascade-update those users to a fallback role and audit-log.
- **Suggested test**: Create custom role + assign user; DELETE role → 409; reassign user to ADMIN; DELETE role → 204.

#### Finding 7 — No "you can't grant a permission you don't hold" check (privilege-escalation by role edit)
- **Title**: An admin with `admin-users.write` can grant *any* permission to *any* (non-system) role, including ones they don't themselves hold.
- **Evidence**: `AdminRoleService.updateRolePermissions` ([AdminRoleService.java:50-68](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminRoleService.java#L50-L68)) takes `Set<String> permissions` and writes them verbatim. No comparison against the actor's own permission set.
- **Impact**: Once Finding 1 is fixed, a SHOP_MANAGER who somehow has `admin-users.write` (or any custom role with same), can elevate themselves by giving their own role `settings.write` / `audit-logs.read` / etc. Even today, a SUPER_ADMIN user could create a custom role with `settings.write` and assign someone — but that may be intended; the issue is the *generic* lack of check.
- **Recommended fix**: Service-side check: for each newly-added permission, require actor to currently have that permission OR be SUPER_ADMIN (`*`). Same for create-role's permissions list.
- **Suggested test**: Login as ADMIN (no `*`); attempt to grant a custom role any permission ADMIN does not have (e.g. an invented future `dangerous.purge`) → 403.

#### Finding 8 — BE does not validate role ID format; only normalises whitespace and case
- **Title**: `createRole` accepts e.g. `Lower-case-id`, `1ROLE`, `_underscoreStart`. Frontend regex is stricter than backend.
- **Evidence**: [AdminRoleService.java:78](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminRoleService.java#L78) only does `toUpperCase().replaceAll("\\s+", "_")`. FE [RolesScreen.jsx:296-297](bigbike-admin/src/screens/RolesScreen.jsx#L296-L297) restricts to `[A-Z0-9_]`.
- **Impact**: Direct API calls (curl/admin SDK) can persist invalid IDs. JWT-driven authority `ROLE_<id>` may include hyphens/dots — Spring authority strings are mostly tolerant but downstream comparisons can break.
- **Recommended fix**: Validate `^[A-Z][A-Z0-9_]{1,49}$` at the service layer.

#### Finding 9 — Roles UI permission gate uses `admin-users.read/write`
- **Title**: Should be `roles.read/write` (or `permissions.read/write`).
- **Evidence**: [App.jsx:213](bigbike-admin/src/App.jsx#L213); [AdminRolesController.java:48,59,78,100](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/admin/AdminRolesController.java#L48).
- **Impact**: Granting "create admin user" implicitly grants "edit role permissions for everyone, including the granter's own role" → privilege-escalation surface (couples with Finding 7).
- **Recommended fix**: Add new permissions `roles.read`, `roles.write`. Migrate FE/BE in lockstep; backfill ADMIN/SUPER_ADMIN with the new perms; double-grant temporarily for backward compat; remove `admin-users.*` from Roles surfaces.

### P2 — Medium

#### Finding 10 — Wrong HTTP status for validation errors
- **Title**: All validation errors throw `ConflictException` (409) instead of 400/422.
- **Evidence**: [AdminAdminUsersService.java:88-112](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminAdminUsersService.java#L88-L112), [AdminRoleService.java:73-81](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminRoleService.java#L73-L81).
- **Impact**: API consumers can't distinguish "true conflict" (duplicate email) from "client-side input error" (missing field). FE handles both as a single error message; client SDK / OpenAPI clients see misleading semantics.
- **Recommended fix**: `BadRequestException` (400) for missing/invalid fields and short password; keep `ConflictException` (409) only for duplicates.

#### Finding 11 — DTOs are `Map<String, Object>` / `Map<String, String>`
- **Title**: AdminUsers and Roles controllers use raw maps for input/output.
- **Evidence**: [AdminAdminUsersController.java:73-74,91-93](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/admin/AdminAdminUsersController.java#L73-L74), [AdminRolesController.java:54-56,75-77](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/admin/AdminRolesController.java#L54-L56).
- **Impact**: No bean validation; OpenAPI/Swagger cannot generate accurate schema; FE has to guess field names; refactors silently break clients.
- **Recommended fix**: Introduce `CreateAdminUserRequest`, `UpdateAdminUserRequest`, `AdminUserResponse`, `RolePermissionsRequest`, `CreateRoleRequest`, `RoleResponse` records with `@NotBlank`/`@Email`/`@Size` annotations.

#### Finding 12 — `AdminUserEntity` data-model drift: two role columns
- **Title**: Entity has both `role` (String) and `roles` (`Set<AdminRole>`) — only `role` is used at runtime; `roles` is populated only by WordPress importer.
- **Evidence**: [AdminUserEntity.java:38-48](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/persistence/entity/auth/AdminUserEntity.java#L38-L48); only setter call: [AdminUserImporter.java:80](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/migration/wordpress/importer/AdminUserImporter.java#L80).
- **Impact**: Confusion; risk of bugs as future code starts using `getRoles()` thinking it's authoritative.
- **Recommended fix**: Either commit to multi-role (migrate all auth code, drop the `role` String column) or drop the multi-role column. Given current scope, drop `roles` + the `admin_user_roles` table.

#### Finding 13 — `/admin/admin-users/{id}` GET is dead from FE
- **Title**: Endpoint is implemented and tested-by-existence (it has `requirePermission`), but there is no FE caller and no test. Remove or use.
- **Evidence**: [AdminAdminUsersController.java:62-69](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/admin/AdminAdminUsersController.java#L62-L69); no `fetchAdminUserDetail` in [adminApi.js](bigbike-admin/src/lib/adminApi.js).
- **Recommended fix**: Either wire FE to use it (e.g. for deep-link `/admin/admin-users/:id`) or delete from the controller.

#### Finding 14 — Audit "before/after" for password change
- **Title**: Audit log for password-change event includes `passwordChanged:true` in `after` only. The action remains `ADMIN_USER_UPDATED` rather than something specific like `ADMIN_USER_PASSWORD_RESET`.
- **Evidence**: [AdminAdminUsersService.java:199-202](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminAdminUsersService.java#L199-L202).
- **Impact**: Filtering audit log for "who reset whose password" is hard. (Test #19 verifies pw is not leaked, which is good.)
- **Recommended fix**: Emit a dedicated `ADMIN_USER_PASSWORD_RESET` action when only password changed; or emit two audit events when password is part of a multi-field update.

#### Finding 15 — JWT contains role at issue time; permission changes don't propagate to live tokens
- **Title**: When an admin's role is changed via PATCH, the existing JWT (max 60-min TTL by default) still carries the old role.
- **Evidence**: JWT carries `role` claim ([JwtAuthFilter.java:41](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/config/JwtAuthFilter.java#L41)). No revocation on role change.
- **Impact**: Up to one access-token TTL of stale authorization after role change. Acceptable for product but should be documented.
- **Recommended fix**: Document, and optionally revoke all of the user's refresh tokens on role demotion / status DISABLED.

### P3 — Low

#### Finding 16 — Dead branch in AdminUsersScreen edit submit
- **Title**: `if (r.item.role !== editForm.role && editForm.role)` ([AdminUsersScreen.jsx:232-234](bigbike-admin/src/screens/AdminUsersScreen.jsx#L232-L234)) sets `roleIgnored` error — but BE always applies role if `requirePermission` passed; this branch never fires. Remove the dead code or document the future scenario it anticipates.

#### Finding 17 — Frontend doesn't audit-warn admin when granting `*` (wildcard)
- **Title**: Sensitive-perm dialog only warns for hardcoded `admin-users.write`, `settings.write`, `audit-logs.read` ([RolesScreen.jsx:66](bigbike-admin/src/screens/RolesScreen.jsx#L66)). Doesn't include POS price-override, receivables write-off, etc. (which are also missing from the catalog → Finding 3).

#### Finding 18 — `ROLE_META` in [AdminUsersScreen.jsx:14-22](bigbike-admin/src/screens/AdminUsersScreen.jsx#L14-L22) is hardcoded for 7 built-in roles
- **Title**: Custom roles fetched from BE are added to options ([AdminUsersScreen.jsx:115-120](bigbike-admin/src/screens/AdminUsersScreen.jsx#L115-L120)) but rendered without color/i18n. Acceptable today (custom roles unusable per Finding 2/4) but will need attention once dynamic roles work.

---

## 8. DB Behavior Findings

### Schema review

| Table | Source | Findings |
|---|---|---|
| `admin_users` | V2 | OK. Unique email index, status as VARCHAR (no DB CHECK; status is enforced in app code). `role` is VARCHAR(50), no FK to `admin_roles`. |
| `admin_refresh_tokens` | V2 | OK. FK + cascade delete, hash unique, expires_at indexed. |
| `admin_user_roles` | V12 | **Orphan join table.** Created for multi-role import from WP, never read by auth. Not used in production. |
| `admin_roles` | V49 | OK. PK is VARCHAR(50). `is_system` boolean. |
| `role_permissions` | V49 | OK. Composite PK (role_id, permission). FK with CASCADE. **Never read by runtime auth (Finding 1).** |
| `audit_logs` | (V76 fix) | After V76, `resource_type='ADMIN_ROLE'` for role events. resource_id stays NULL because role IDs are strings (documented in API_CONTRACT.md L121-L123). |

### Migration behavior

- **V49 seed vs static map drift:** V49 seeded `home_videos.read/write` for ADMIN; static map also has it. ✅
- **V58 drift fix:** Adds `redirects.*` to ADMIN, SEO_EDITOR. Static map [AdminRolePermissions.java:33](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/auth/AdminRolePermissions.java#L33) also has it for ADMIN. ✅
- **V78 drift fix:** Adds `reports.*` for ADMIN, SHOP_MANAGER. Static map [AdminRolePermissions.java:37,49](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/auth/AdminRolePermissions.java#L37) has it for ADMIN; **static map also has it for SHOP_MANAGER (line 49)**. ✅
- **Drift items to verify:** static map ADMIN includes `pos.read/write/price_override` and `receivables.*`, but **V49 seed for ADMIN does NOT include these**. So if Finding 1 is fixed by reading from DB, ADMIN role suddenly *loses* POS and receivables until a backfill migration runs. NEEDS_VERIFICATION via cross-table diff:
  - V49 ADMIN: products, catalog, content, orders, customers, media, settings, menus, sliders, coupons, shipping, reviews, admin-users, audit-logs, home_videos.
  - V58 + ADMIN: redirects.
  - V78 + ADMIN: reports.read/export.
  - **Static-map ADMIN extras NOT in any migration:** `pos.read`, `pos.write`, `pos.price_override`, `receivables.read`, `receivables.create`, `receivables.record_payment`, `receivables.write_off`, `receivables.override_limit`, `receivables.export`.
- **Drift items SHOP_MANAGER:** static map has `pos.read/write`, `receivables.read/record_payment` not present in V49 SHOP_MANAGER seed. Same backfill needed.

→ A "Phase 1 fix" migration is required to align DB seed with the static map *before* runtime is switched to read from DB.

### Cascade delete behavior

- `role_permissions.role_id → admin_roles.id ON DELETE CASCADE` — good, no permission row orphans.
- `admin_users.role` is a plain string with no FK — see Finding 6.

### Audit log consistency

- `ADMIN_USER_*` events use `resource_id = UUID`. ✅
- `ADMIN_ROLE` events use `resource_id = NULL`, role ID embedded in JSON. ✅ Documented in V76 + API_CONTRACT.md.

---

## 9. Test Coverage Findings

| Area | Existing tests | Missing tests | Priority |
|---|---|---|---|
| AdminUsers — auth gates (no token) | tests #1-3 | 401 with expired token; 401 with malformed Bearer | P3 |
| AdminUsers — list/filter/search | tests #4-7 | pageSize=0 / negative; sort param (not implemented but worth lock-in test) | P3 |
| AdminUsers — create | tests #8-13 | 403 path: actor without `admin-users.write`; missing email/role coverage explicit | P1 |
| AdminUsers — update guards | tests #14-18, 20 | "demote last SUPER_ADMIN" with a *separate* SUPER_ADMIN actor (current test #17 collapses into self-demote); 403 for actor lacking `admin-users.write`; PATCH to non-existent id → 404 | P1 |
| AdminUsers — audit | tests #19, #20 | actor email/IP captured in audit; password change emits dedicated action (after Finding 14 fix) | P2 |
| AdminUsers — get-detail (`GET /:id`) | none | 200 + 404 + 403 | P2 |
| Roles — list | none | empty result, system+custom mix | **P0** |
| Roles — update permissions | none | (1) 200 + audit row, (2) cannot edit SUPER_ADMIN, (3) **runtime effect: re-login carries new perms after Finding 1 fix**, (4) unknown perm key → 400 (after Finding 5 fix), (5) actor without permission → 403 | **P0** |
| Roles — create | none | success, dup id, missing fields, ID format invalid (after Finding 8 fix) | **P0** |
| Roles — delete | none | success for custom; 409 for system; 409 when in use (after Finding 6 fix); audit row | **P0** |
| Custom-role end-to-end | none | create role, assign user, login, call permitted endpoint = 200, call non-permitted = 403 | **P0** |
| SecurityConfig | none | each role hits each `/api/v1/admin/*` route → expected 200/403 grid | P1 |
| `requirePermission` for unknown role | none | After Finding 4 fix, expect 403 not silent ADMIN-fallback | **P0** |
| Permission-catalog completeness | none | unit test asserting each permission used in `requirePermission(...)` is present in FE catalog (or backend `/admin/permissions` if introduced) | P1 |
| Privilege-escalation (Finding 7) | none | actor without `settings.write` cannot grant role `settings.write` | **P0** |
| FE | none observed | RolesScreen dirty/discard; AdminUsersScreen confirm-on-role-change | P2 |
| E2E / Playwright | none observed for Admin Users / Roles | golden path: login as SUPER_ADMIN → create role → assign → re-login as that user → expected sidebar visibility | P2 |

---

## 10. Recommended Fix Plan

> Phases are ordered by risk. Phase 1 is **blocker** for production. Each item references the finding it closes.

### Phase 1 — P0 RBAC Runtime Correctness

1. **Wire DB-backed permissions into auth resolution.** Introduce `RolePermissionResolver` (Spring service) that reads `AdminRoleEntity.permissions` with a small refresh-on-write cache. Replace static-map calls in `AdminAuthService.permissionsForRole` and `DevAdminAuthService.requirePermission`. Static map becomes a fallback only when the DB row is missing, with a logged warning. *(Finding 1)*
2. **Backfill migration to align V49/V58/V78 seeds with the static map** so ADMIN/SHOP_MANAGER don't lose POS/receivables/reports the moment Phase-1 step #1 lands. Provide a diff-checked script. *(§8 drift)*
3. **Replace SecurityConfig URL gate with permission-aware gate.** Either: (a) `/api/v1/admin/**` → `authenticated()` and rely on controllers' `requirePermission()` (which is now DB-aware); or (b) generalise `hasAnyRole` to *all* roles in `AdminRole` enum + custom roles via a dynamic role-list. Prefer (a) for simplicity. Remove shadowed L111/L113/L115 rules. *(Finding 2)*
4. **Make `requirePermission` deny on unknown role.** Drop the `getOrDefault(.., ADMIN)` fallback. *(Finding 4)*
5. **Fix permission-key validation in `AdminRoleService.{updateRolePermissions,createRole}`.** Use a canonical permission registry (`KnownPermissions` constant or DB-backed). 400 on unknown keys. *(Finding 5)*
6. **Authorization-of-grant check.** Service-side: actor must hold every permission they grant (or be SUPER_ADMIN). *(Finding 7)*

### Phase 2 — Permission Catalog & API Contract

7. **Backfill FE `PERMISSION_CATALOG` with `pos.*`, `receivables.*`, `reports.*`** + i18n keys. Add appropriate group; mark `pos.price_override`, `receivables.write_off`, `receivables.override_limit` as sensitive. Or replace static catalog with `GET /admin/permissions`. *(Finding 3, 17)*
8. **Replace raw `Map` DTOs** in `AdminAdminUsersController` and `AdminRolesController` with typed records + `@Valid` annotations. *(Finding 11)*
9. **Document `/admin/admin-users/**` and `/admin/roles/**` in [API_CONTRACT.md](docs/engineering/API_CONTRACT.md).** Add OpenAPI schemas via the typed DTOs.
10. **Switch validation errors from 409 to 400** for missing/invalid fields. Keep 409 for duplicates/conflicts. *(Finding 10)*
11. **Add `roles.read` and `roles.write` permissions; gate Roles UI/controller on them.** Backfill ADMIN+SUPER_ADMIN; double-grant for transitional release. *(Finding 9)*

### Phase 3 — DB & Validation Hardening

12. **Drop `admin_user_roles` table + `AdminUserEntity.roles` column** (or commit fully to multi-role and drop `role` String). Recommend the former. *(Finding 12)*
13. **Add foreign key `admin_users.role → admin_roles.id` ON UPDATE RESTRICT, ON DELETE RESTRICT** — enforce role existence at DB level. *(Finding 6, partial)*
14. **Service-level "role-in-use" check on delete.** *(Finding 6)*
15. **Validate role ID format `^[A-Z][A-Z0-9_]{1,49}$` at service layer.** *(Finding 8)*
16. **Audit a dedicated `ADMIN_USER_PASSWORD_RESET` action.** *(Finding 14)*
17. **Document JWT staleness window after role change** + (optional) revoke refresh tokens on role demotion / status DISABLED. *(Finding 15)*
18. **Remove dead code** in `AdminUsersScreen.jsx` `roleIgnored` branch. *(Finding 16)*
19. **Remove dead `GET /admin-users/{id}`** or wire it from FE. *(Finding 13)*

### Phase 4 — Test Coverage

20. **AdminRolesController integration tests** mirroring `AdminUsersApiTest` structure: list, update permissions (success, system-blocked, audit), create (dup, missing, format), delete (system-blocked, role-in-use, success).
21. **End-to-end custom-role test** (the killer test): create role via API; assign user; login as that user; assert specific endpoints 200/403; revoke a perm; re-login; assert delta.
22. **SecurityConfig grid test** for every role × representative endpoint.
23. **`requirePermission` unknown-role test** asserting 403 (Finding 4).
24. **Permission-catalog completeness test** (FE Vitest or BE @Test) asserting every permission used in any `requirePermission(...)` call is present in catalog.
25. **Privilege-escalation tests** for Finding 7.
26. **AdminUsersApiTest gap fills**: 403 paths for read/write, demote-last-SUPER_ADMIN by another SUPER_ADMIN actor, GET-detail 200/404.
27. **FE component tests** for RolesScreen (dirty/discard, sensitive confirm, save summary) and AdminUsersScreen (sensitive confirm).

---

## 11. Final Verdict

**This module is NOT production-ready.** The Admin Users sub-module alone could ship; the Roles/RBAC sub-module is fundamentally broken and would actively mislead operators about what they have configured.

### Blockers (must fix before any release that exposes the Roles UI)

1. **Finding 1** — DB-backed roles are inert at runtime. UI lies about what it does.
2. **Finding 2** — Non-(ADMIN/SUPER_ADMIN/SHOP_MANAGER) roles cannot use the admin API in production at all.
3. **Finding 4** — Privilege-escalation footgun activated the moment SecurityConfig is loosened.
4. **Finding 5** — Garbage permission strings persist silently.
5. **Finding 6** — Role deletion silently orphans assigned admin users.
6. **Finding 7** — Any admin with `admin-users.write` can grant arbitrary permissions.
7. **§8 drift** — DB seed is missing pos/receivables (and partly reports) for ADMIN/SHOP_MANAGER; switching runtime to DB without a backfill migration causes regressions.
8. **§9** — Roles controller has *zero* tests.

### Minimum cut for release of Admin Users only (Roles UI hidden)

If product wants to ship sooner with Roles temporarily disabled:

- Hide `/admin/roles` from sidebar + remove `routePermission` mapping in [App.jsx:213](bigbike-admin/src/App.jsx#L213) with a feature flag.
- Keep `AdminUsersScreen` intact.
- File a top-priority follow-up to deliver Phase 1.
- Add at minimum: AdminUsers 403 negative test (Finding 11), `roleIgnored` cleanup (Finding 16), wrong-status semantics doc (Finding 10).

### Minimum cut for full release (Roles enabled)

Phase 1 + Phase 2 items 7-9 + Phase 4 items 20-25 are the smallest set that makes the Roles feature honest.

---

*Audit prepared without modifying any source. All file/line references reflect HEAD as of 2026-05-07.*
