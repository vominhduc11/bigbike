# Permission Matrix

## Role And Permission Source

**Runtime source of truth** is the database table `role_permissions`, seeded and mutated by Flyway migrations and the Admin Roles API. Runtime permission resolution is performed by `AdminPermissionService`, which reads from that table.

- `PermissionCatalog.java` is the canonical catalog of **valid permission keys + groupings + sensitive flags**. It is served by `GET /api/v1/admin/permissions` and used by `AdminRoleService` to validate which keys may be assigned to a custom role. New permissions must be added here first, then seeded into `role_permissions` by a migration.
- `AdminRolePermissions.java` is a **human-readable reference snapshot only** — it is explicitly NOT called at runtime. Do not treat it as authoritative.

### Inventory permissions

| Permission | Granted roles (seed) | Endpoint | Evidence |
|---|---|---|---|
| `inventory.read` | `SUPER_ADMIN` (wildcard), `ADMIN`, `SHOP_MANAGER`, `EDITOR` | `GET /api/v1/admin/inventory/**` (stock list / grouped / summary / movements) | `V121__realign_inventory_warranty_permissions.sql`, `AdminInventoryController.java` |
| `inventory.write` | `SUPER_ADMIN` (wildcard), `ADMIN`, `SHOP_MANAGER` | `POST /api/v1/admin/inventory/**` (manual stock adjust) | `V121__realign_inventory_warranty_permissions.sql`, `AdminInventoryController.java` |

`inventory.*` is listed in `PermissionCatalog` (`roles.groupProducts`), so it is grantable to custom roles via the Roles UI.

> **POS permissions removed (2026-06-23, online-only).** The four POS permissions — `pos.read`, `pos.write`, `pos.price_override`, `pos.sell_below_cost` — were **deleted** together with the POS module (admin POS screen, `POST /admin/pos/orders`, `GET /admin/pos/products/search`, `AdminPosController` / `PosOrderService`). They were dropped from `PermissionCatalog` and revoked from every role. BigBike is now online-only.
>
> **AL-03 realignment (V121).** Before V121, `inventory.*` gated the (now-removed) **Warranty** module while the **Inventory** module was gated by `products.*` — the permission name did not match the module it controlled. V121 introduced the dedicated permissions and re-gated each controller + the admin UI. The migration was a **non-breaking backfill**: every role holding `products.*` also received `inventory.*`. `EDITOR` therefore keeps `inventory.read` (it held `products.read`) — a deliberate compatibility grant. A post-launch RBAC cleanup may remove `inventory.read` from `EDITOR` if the business confirms EDITOR is content-only.
>
> **Serial feature removed (2026-06-23, V259).** `inventory.*` now gates **stock reads / manual quantity adjustments only** — the admin inventory serial endpoints (`/inventory/serials*`, `/variants/{id}/serials`, `/products/{id}/serials`, `/serials/{id}/status`, `/serials/import`) were deleted along with serial tracking.
>
> **Warranty module removed (2026-06-23, V266).** The `warranty.read` / `warranty.write` permissions were **deleted** together with the warranty feature (admin warranty endpoints, public lookup, records, and the `/bao-hanh` page). They were dropped from `PermissionCatalog` and revoked from every role by the migration.
>
> **Pages + Guide-page modules removed (2026-06-24).** `content.read` / `content.update` now scope to **articles (Tin tức) only** — the static CMS pages module and the guide-page builder were removed (tables `pages` + `guide_page_layout` dropped at `V271`; admin pages CRUD, `reference/pages`, and the `GET`/`PUT /admin/guide-page` endpoints deleted). The 10 info/policy pages are now hardcoded in `bigbike-web`. The permission keys themselves are **unchanged** (still `content.read` / `content.update`); only their reach shrank to article management.

## Roles

Four built-in admin roles are seeded as **system roles** (`is_system = TRUE`). `V49__create_roles_permissions_tables.sql` originally seeded seven; `V200__reduce_default_roles.sql` removed the three WordPress-legacy content roles (`AUTHOR`, `CONTRIBUTOR`, `SEO_EDITOR`) and folded SEO redirect permissions into `EDITOR`. `CUSTOMER` is a **storefront auth role**, not a row in the `admin_roles` table and not shown in the admin Roles screen.

| Role | Type | Current scope | Status | Evidence |
|---|---|---|---|---|
| `SUPER_ADMIN` | system (built-in) | wildcard `*` — permissions immutable; cannot be edited or deleted | `CONFIRMED_FROM_CODE` | `V49__create_roles_permissions_tables.sql`, `AdminRoleService.java` |
| `ADMIN` | system (built-in) | full operations including media, settings, redirects | `CONFIRMED_FROM_CODE` | `V49__create_roles_permissions_tables.sql` |
| `SHOP_MANAGER` | system (built-in) | catalog/orders/customers/reviews (shipping permissions removed 2026-06-23 `SHIP_RULE_001`; POS removed 2026-06-23) | `CONFIRMED_FROM_CODE` | `V49__create_roles_permissions_tables.sql`, `V264__remove_shipping_methods.sql` |
| `EDITOR` | system (built-in) | catalog/content/media/menu/slider + SEO redirects operations | `CONFIRMED_FROM_CODE` | `V49__create_roles_permissions_tables.sql`, `V200__reduce_default_roles.sql` |
| custom roles | non-system | any keys from `PermissionCatalog`; created/edited/deleted via the Roles API | `CONFIRMED_FROM_CODE` | `AdminRoleService.createRole/deleteRole` |
| `CUSTOMER` | storefront (not an admin role) | own profile/address/order APIs; **not** in `admin_roles` | `CONFIRMED_FROM_CONFIG` | `SecurityConfig.java` |

### Role Governance

Enforced in `AdminRoleService` (Admin Roles API, gated by `roles.write`):

- **System roles cannot be deleted.** `deleteRole` rejects any role with `is_system = TRUE` (`Cannot delete built-in system role`). All 4 built-in roles are system roles — there is no "2 fixed roles, rest deletable" model. (The built-in set itself is changed only through a Flyway migration, e.g. `V200` which reduced it from 7 to 4 — not through the Roles API.)
- **`SUPER_ADMIN` permissions are immutable.** `updateRolePermissions` rejects edits to `SUPER_ADMIN` (`Cannot modify SUPER_ADMIN permissions`) — it stays wildcard `*`. The other 3 system roles **can** have their permission set edited (but still cannot be deleted).
- **Custom roles** are created via `createRole` with `is_system = FALSE`; they can be both edited and deleted. `deleteRole` also blocks deletion while any admin user is still assigned to the role (`countByRole > 0`).
- Role IDs must match `[A-Z][A-Z0-9_]{1,49}`; assigned permission keys are validated against `PermissionCatalog.ALL_KEYS` (unknown keys rejected).
- **Admin-user guardrails** (`AdminAdminUsersService`): an admin cannot disable/suspend their own account, cannot demote themselves out of `SUPER_ADMIN`, and cannot demote the last active `SUPER_ADMIN`.
- **Privilege-tier protection on `SUPER_ADMIN` accounts** (`AdminAdminUsersService`): `admin-users.write` is also held by the `ADMIN` role, so the service guards against a lower-tier admin escalating or taking over the top tier. Specifically:
  - Only a `SUPER_ADMIN` actor may **modify** an existing `SUPER_ADMIN` account (display name, role, status, or password reset). A non-`SUPER_ADMIN` caller is rejected (`Only a SUPER_ADMIN can modify a SUPER_ADMIN account`) — this closes the password-reset account-takeover path.
  - Only a `SUPER_ADMIN` actor may **grant** the `SUPER_ADMIN` role, whether via `createAdminUser` or by promoting an existing user (`Only a SUPER_ADMIN can grant the SUPER_ADMIN role`) — this closes the self/other-promotion escalation path.
  - The **last active `SUPER_ADMIN`** cannot be disabled/suspended via a status change (extends the existing demote guard from role-change to status-change): `Cannot disable the last active SUPER_ADMIN`.
- `CUSTOMER` (`ROLE_CUSTOMER`) is a separate storefront auth realm enforced in `SecurityConfig`; it is never managed through the admin Roles screen.

## Super-admin-only settings (`product_assign`)

The `product_assign_*` site-setting keys (the editable "Phân công" guide on the product create/edit screen) are flagged `superAdminOnly` in `SettingDefinitionRegistry`. There is **no dedicated permission key** for them — the gate is the wildcard `*` itself:

- **Write** (`PATCH /api/v1/admin/settings[/{key}]`): `AdminSettingsService` rejects the write with 403 unless the caller's resolved permissions contain `*`. So only `SUPER_ADMIN` can edit; `ADMIN` is blocked even though it holds `settings.write`.
- **Read for the banner** (`GET /api/v1/admin/product-assignment`): gated by `products.read`, so every role that can open the product editor (`SUPER_ADMIN`, `ADMIN`, `SHOP_MANAGER`, `EDITOR`) sees the banner text.
- **Admin UI**: the "Phân công sản phẩm" settings tab is hidden for non-super-admins (`AdminSiteSettingResponse.superAdminOnly` + `hasPermission('*')` filter in `SettingsScreen`).

Status: `CONFIRMED_FROM_CODE` — `SettingDefinitionRegistry.java`, `AdminSettingsService.java`, `AdminProductAssignmentController.java`, `SettingsScreen.jsx`

## Bilingual auto-translate proxy (`POST /api/v1/admin/translate`)

Not gated by a single dedicated permission — `AdminTranslateController.requireAnyContentWrite` accepts
the caller if they hold **any one** of `TRANSLATE_PERMISSIONS`: `products.update`, `catalog.update`,
`content.update`, or `settings.write` (the last one added **V309** so the bigbike-admin Settings screen's
VI/EN auto-translate-on-save can call this shared endpoint). Any role holding at least one of these four
can translate VI→EN text for any module — the endpoint itself does not further scope by module.

Status: `CONFIRMED_FROM_CODE` — `AdminTranslateController.java` (`TRANSLATE_PERMISSIONS`)

## Audit Log Permission

| Permission | Roles with access | Endpoint |
|---|---|---|
| `audit-logs.read` | `SUPER_ADMIN`, `ADMIN` | `GET /api/v1/admin/audit-logs` |

`SHOP_MANAGER` and `EDITOR` do **not** have `audit-logs.read`.

## Admin Login Security

Enforced in `AdminAuthService.login` (public endpoint `POST /api/v1/auth/login`), in addition to the per-IP rate limit (5/min) in `RateLimitingFilter`:

- **Account lockout.** After **5 consecutive failed password attempts** an account is locked for **15 minutes** (`AdminLoginAttemptService`, constants `MAX_FAILED_ATTEMPTS` / `LOCK_DURATION`). While locked, login is refused before the password is checked. The failed-attempt counter is written in a `REQUIRES_NEW` transaction so it persists even though the rejected login rolls back. A successful login clears `failed_login_attempts` and `locked_until`.
- **Enumeration stance.** Unknown email, missing-password (`INVITED`) and bad-password all return the same generic `Invalid email or password.` with a constant-time dummy verify. The lockout case returns a distinct "temporarily locked" message — a deliberate trade of minor account-existence disclosure for operational clarity on an internal admin panel.
- **Audit events** (`actorType = ADMIN`, `resourceType = ADMIN_AUTH`, written via best-effort `AuditLogWriter`):
  - `ADMIN_LOGIN_SUCCESS` — actor = the user id.
  - `ADMIN_LOGIN_FAILED` — `afterData.reason` ∈ {`USER_NOT_FOUND`, `NO_PASSWORD`, `BAD_PASSWORD`, `ACCOUNT_LOCKED`, `INACTIVE`}; attempted email recorded in `afterData.email`.
  - `ADMIN_ACCOUNT_LOCKED` — emitted when a failure crosses the threshold.
  - `ADMIN_LOGOUT` — actor resolved from the revoked refresh token.

Status: `CONFIRMED_FROM_CODE` — `AdminAuthService.java`, `AdminLoginAttemptService.java`, `V283__admin_login_lockout.sql`

## Critical Endpoint Permissions

| Endpoint / surface | Required role/permission | Status | Evidence |
|---|---|---|---|
| `/api/v1/admin/**` | Spring Security URL gate requires `isAuthenticated() and !hasRole('CUSTOMER')` — any admin role (built-in or custom) passes, a logged-in customer is rejected (403). Fine-grained permission is then enforced at controller level by `requirePermission()`. See `PERMISSION_RBAC_AUDIT.md` findings F1/F2. | `CONFIRMED_FROM_CODE` | `SecurityConfig.java`, `DevAdminAuthService.requirePermission`, admin controllers |
| `POST /api/v1/admin/products/preview` | `products.update` (live preview dry-run; no persistence) | `CONFIRMED_FROM_CODE` | `AdminCatalogController.previewProduct`, `AdminCatalogMutationService.previewProduct` |
| `/api/v1/admin/dashboard` GET | `orders.read`; `ROLE_ADMIN`, `ROLE_SUPER_ADMIN`, or `ROLE_SHOP_MANAGER` | `CONFIRMED_FROM_CODE` | `SecurityConfig.java`, `AdminDashboardController.java` |
| `/api/v1/admin/orders/{orderId}/audit` GET | `orders.read` | `CONFIRMED_FROM_CODE` | `AdminOrderController.listAuditTrail`, `AdminOrderService.listAuditTrail` |
| `/api/v1/customer/orders/**` | `ROLE_CUSTOMER` | `CONFIRMED_FROM_CONFIG` | `SecurityConfig.java` |
| `/api/v1/customer/addresses/**` | `ROLE_CUSTOMER` | `CONFIRMED_FROM_CONFIG` | `SecurityConfig.java` |
| `GET /api/v1/auth/admin/invite` | public (token-gated) — validate an admin invite token | `CONFIRMED_FROM_CODE` | `SecurityConfig.java`, `AdminInviteService.validateToken` |
| `POST /api/v1/auth/admin/accept-invite` | public (token-gated) — set password for an invited admin, `INVITED → ACTIVE` | `CONFIRMED_FROM_CODE` | `SecurityConfig.java`, `AdminInviteService.acceptInvite` |
| `POST /api/v1/admin/admin-users/{id}/resend-invite` | `admin-users.write` | `CONFIRMED_FROM_CODE` | `AdminAdminUsersController.java` |
| `/api/v1/search*` | public | `CONFIRMED_FROM_CONFIG` | `SecurityConfig.java` |
| `/api/v1/address/**` | public | `CONFIRMED_FROM_CONFIG` | `SecurityConfig.java` |

## WebSocket Access

| Channel | Access rule | Status | Evidence |
|---|---|---|---|
| `/ws` STOMP CONNECT | native `Authorization` bearer token required | `CONFIRMED_FROM_CODE` | `WebSocketConfig.java` |
| Admin order topic | only admin connections allowed to connect; current client subscribes to `/topic/admin/orders` | `CONFIRMED_FROM_CODE` | `WebSocketConfig.java`, `adminWebSocket.js` |
| Allowed WS roles | `ADMIN`, `SUPER_ADMIN` | `CONFIRMED_FROM_CODE` | `WebSocketConfig.java` |

## Internal Redirect Caveat

Spring Security marks internal redirect endpoints `permitAll`, with the expectation that infrastructure restricts them in production.

Status: `CONFIRMED_FROM_CONFIG`

Evidence:

- `SecurityConfig.java`

## Reports Permissions

Status: `CONFIRMED_FROM_CODE` — `AdminRolePermissions.java`, `AdminReportController.java`, `V78__add_reports_permissions.sql`

| Endpoint | Required permission | Roles with access |
|---|---|---|
| `GET /api/v1/admin/reports/analytics` | `reports.read` | `SUPER_ADMIN`, `ADMIN`, `SHOP_MANAGER` |
| `GET /api/v1/admin/reports/orders/export` | `reports.export` | `SUPER_ADMIN`, `ADMIN`, `SHOP_MANAGER` |
| `GET /api/v1/admin/reports/customers/export` | `reports.export` | `SUPER_ADMIN`, `ADMIN`, `SHOP_MANAGER` |
| `GET /api/v1/admin/reports/products/export` | `reports.export` | `SUPER_ADMIN`, `ADMIN`, `SHOP_MANAGER` |

| Permission string | Roles | Purpose |
|---|---|---|
| `reports.read` | `SUPER_ADMIN`, `ADMIN`, `SHOP_MANAGER` | Access analytics dashboard |
| `reports.export` | `SUPER_ADMIN`, `ADMIN`, `SHOP_MANAGER` | CSV export from Reports module (audit log gate) |
