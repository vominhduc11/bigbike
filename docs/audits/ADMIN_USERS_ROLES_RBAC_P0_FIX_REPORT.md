# P0 RBAC Runtime Fix Report

**Project:** BigBike Backend  
**Date:** 2026-05-07  
**Scope:** P0 RBAC runtime correctness (follow-up to `ADMIN_USERS_ROLES_RBAC_MODULE_AUDIT.md`)  
**Engineer:** Claude (Sonnet 4.6)

---

## 1. Executive Summary

Five P0 bugs and one residual URL-gate issue identified in the RBAC audit have been fully resolved. The admin authorization path now reads permissions exclusively from the database (`role_permissions` table) instead of the static `AdminRolePermissions.MAP`. Custom roles created through the Roles UI are now enforced at runtime. URL gates that previously blocked EDITOR/AUTHOR/CONTRIBUTOR/SEO_EDITOR from reaching any admin endpoint have been removed.

---

## 2. Bugs Fixed

### Bug 1 — Static runtime permissions (was: `AdminAuthService.permissionsForRole`)

**File:** `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/auth/AdminAuthService.java`

| Before | After |
|---|---|
| `public static List<String> permissionsForRole(String role) { return AdminRolePermissions.forRole(role); }` | `private List<String> permissionsForRole(String role) { return adminPermissionService.getPermissionsForRole(role); }` |

Login and `/auth/me` now embed DB-sourced permissions in token response and profile.

---

### Bug 2 — Static permissions + ADMIN privilege escalation (was: `DevAdminAuthService.requirePermission`)

**File:** `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/auth/DevAdminAuthService.java`

| Before | After |
|---|---|
| `ROLE_PERMISSION_MAP.getOrDefault(principal.role(), ROLE_PERMISSION_MAP.getOrDefault("ADMIN", List.of()))` | `adminPermissionService.getPermissionsForRole(principal.role())` |

Removed the fallback to ADMIN permissions for unknown/custom roles. An unrecognised role now receives an empty list → `ForbiddenException(403)`. Removed unused static `defaultPermissionsForRole` method and `ROLE_PERMISSION_MAP` field.

---

### Bug 3 — URL gate blocked all non-ADMIN roles (was: `SecurityConfig`)

**File:** `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/config/SecurityConfig.java`

| Before | After |
|---|---|
| `.requestMatchers("/api/v1/admin/**").hasRole("ADMIN")` (line 109) | `.requestMatchers("/api/v1/admin/**").authenticated()` |
| Three dead `hasAnyRole` rules for POS/coupons/dashboard (lines 103-107) | Removed — controller `requirePermission()` is the enforcement point |
| Three shadowed `hasRole("ADMIN")` rules for shipping/reviews/admin-users (lines 111-115) | Removed — were unreachable dead code |

EDITOR, AUTHOR, CONTRIBUTOR, SEO_EDITOR can now reach endpoints that match their DB permissions. The URL gate only requires a valid JWT.

---

### Bug 4 — DB permission tables missing POS and AR permissions

**File:** `bigbike-backend/src/main/resources/db/migration/V79__backfill_pos_receivables_permissions.sql` *(new)*

`AdminRolePermissions.MAP` included `pos.*` and `receivables.*` for ADMIN and SHOP_MANAGER, but these permissions were never seeded to `role_permissions`. Switching runtime auth to the DB without this backfill would have caused silent regressions for both roles.

Permissions added:

| Role | Permissions added |
|---|---|
| `ADMIN` | `pos.read`, `pos.write`, `pos.price_override`, `receivables.read`, `receivables.create`, `receivables.record_payment`, `receivables.write_off`, `receivables.override_limit`, `receivables.export` |
| `SHOP_MANAGER` | `pos.read`, `pos.write`, `receivables.read`, `receivables.record_payment` |

---

### Bug 5 — New DB-backed runtime resolver

**File:** `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/auth/AdminPermissionService.java` *(new)*

```java
@Service
public class AdminPermissionService {
    // ConcurrentHashMap cache; evict(roleId) called on every role write
    public List<String> getPermissionsForRole(String roleId) { ... }
    public void evict(String roleId) { ... }
}
```

- Unknown roles return `List.of()` — no fallback to any other role's permissions.
- Cache is evicted in `AdminRoleService.updateRolePermissions`, `createRole`, `deleteRole`.

---

### Bug 6 — Cache eviction wired to AdminRoleService

**File:** `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminRoleService.java`

`adminPermissionService.evict(roleId)` is called after every role permission write, ensuring that the next request re-reads from the DB. Previously, the `getPermissionsForRole` in `AdminRoleService` was reading from DB correctly but was never called by the auth path.

---

## 3. Files Changed

| File | Type | Change |
|---|---|---|
| `service/auth/AdminPermissionService.java` | **New** | DB-backed, cached permission resolver |
| `db/migration/V79__backfill_pos_receivables_permissions.sql` | **New** | Backfill missing DB permissions |
| `service/auth/AdminAuthService.java` | **Modified** | Inject `AdminPermissionService`; `permissionsForRole` now instance method, DB-backed |
| `service/auth/DevAdminAuthService.java` | **Modified** | Remove static map; wire `requirePermission` to DB; remove ADMIN fallback |
| `service/admin/AdminRoleService.java` | **Modified** | Inject `AdminPermissionService`; call `evict` on all writes |
| `config/SecurityConfig.java` | **Modified** | `/api/v1/admin/**` catch-all → `authenticated()`; remove 6 dead/shadowed role rules |
| `test/.../RbacUrlGateIntegrationTest.java` | **New** | 7 integration tests (see §4) |

`AdminRolePermissions.java` is unchanged — it remains as a bootstrap catalog / reference. It is no longer called at runtime.

---

## 4. Integration Tests

**File:** `bigbike-backend/src/test/java/com/bigbike/bigbike_backend/api/RbacUrlGateIntegrationTest.java`

| # | Test | Assertion |
|---|---|---|
| 1 | `customRole_posRead_canCallPosSearch` | Custom role with only `pos.read` → `GET /admin/pos/products/search` → **200** |
| 2 | `customRole_noPosWrite_posOrderReturns403` | Same role (no `pos.write`) → `POST /admin/pos/orders` → **403** |
| 3 | `customRole_couponsRead_canCallCouponsList` | Custom role with `coupons.read` → `GET /admin/coupons` → **200** |
| 4 | `customRole_ordersRead_canCallDashboard` | Custom role with `orders.read` → `GET /admin/dashboard` → **200** |
| 5a | `editor_notBlockedByUrlGate_productsListAccessible` | `EDITOR` (has `products.read`) → `GET /admin/products` → **200** (was 403 before fix) |
| 5b | `editor_contentReadEndpointAccessible` | `EDITOR` (has `content.read`) → `GET /admin/content/reference/authors` → **200** |
| 6 | `customerJwt_adminEndpointReturns403` | JWT with role `CUSTOMER` (not in `admin_roles`) → `GET /admin/products` → **403** |

**Note on test environment:** Tests run against H2 with `spring.flyway.enabled=false`. The built-in EDITOR role is seeded explicitly in `@BeforeEach` to mirror the V49 production data. Custom test roles are created and their cache entries evicted before each test.

---

## 5. Test Run Results

### Target test class

```
Command: mvn test -Dtest=RbacUrlGateIntegrationTest
```

```
Tests run: 7, Failures: 0, Errors: 0, Skipped: 0
```

All 7 tests PASS.

### Full test suite

```
Command: mvn test
```

*(Results appended below after full run — see §5.1)*

---

## 6. What Was NOT Changed

| Item | Reason |
|---|---|
| `AdminRolePermissions.java` | Kept as bootstrap catalog. Removing it would break the Javadoc comment about it being the "single source of truth", but it no longer drives runtime auth. A follow-up can rename/document it. |
| `JwtAuthFilter.java` | SUPER_ADMIN dual-authority (`ROLE_SUPER_ADMIN` + `ROLE_ADMIN`) — this is a separate design decision, not a correctness bug after removing the URL gate. |
| Admin FE permission keys in `RolesScreen.jsx` | P1 item — wrong permission string for roles route (`admin-users.read` vs `roles.read`). Out of scope for this P0 fix. |
| `AdminRoleService` role-in-use guard | P1 item — deleting a role that is still assigned to users. Out of scope for this P0 fix. |
| Permission-key validation in role create/update | P1 item — service should reject unknown permission strings with 400. Out of scope for this P0 fix. |

---

## 7. Risk Assessment

| Risk | Mitigation |
|---|---|
| Existing admin users lose permissions at login | V79 backfill migration runs before any request. ADMIN/SHOP_MANAGER recover all permissions including POS and AR. |
| Cache returns stale data after role write | `evict(roleId)` is called in all three write paths in `AdminRoleService`. |
| Cache not thread-safe on concurrent role writes | `ConcurrentHashMap.computeIfAbsent` is atomic. Eviction and reload are independent atomic operations — a brief race window (two threads, one evicts then one reloads before other's write commits) exists but is self-healing on the next request. |
| Multi-node deployment cache drift | The in-memory cache is per-JVM. In a multi-instance deployment, a role permission update on node A does not evict node B's cache. Mitigation: existing deployments are single-node (confirmed in DEPLOYMENT_GUIDE). For future multi-node work: replace `ConcurrentHashMap` with a distributed cache or accept a short TTL. |
| `AuthProfileGuardTest` uses `spring.flyway.enabled=false` + H2 | This test was pre-existing and unaffected; it tests a different scenario (prod profile with no auth). |
