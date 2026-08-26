# Permission Matrix

## Role And Permission Source

**Runtime source of truth** is the database table `role_permissions`, seeded and mutated by Flyway migrations and the Admin Roles API. Runtime permission resolution is performed by `AdminPermissionService`, which reads from that table.

- `PermissionCatalog.java` is the canonical catalog of **valid permission keys + module/kind/sensitive/dependency metadata**. It is served by `GET /api/v1/admin/permissions` and used by `AdminRoleService` to validate both keys and dependency closure. New permissions must be added here first, then seeded into `role_permissions` by a migration.
- `AdminRolePermissions.java` is a **human-readable reference snapshot only** — it is explicitly NOT called at runtime. Do not treat it as authoritative.

## Permission dependency contract

`read` is the default module-access permission. A non-wildcard role may be stored only when every selected permission's transitive `requires` set is present. Roles UI may add dependencies for the operator; Roles API never auto-adds and returns `400 VALIDATION_ERROR` with `MISSING_PERMISSION_DEPENDENCY` details for a malformed payload. Flyway `V366__backfill_permission_dependencies.sql` closes existing role data without deleting grants.

| Permission | Direct requirements |
|---|---|
| `orders.write` | `orders.read` |
| `customers.write` | `customers.read` |
| `reviews.write` | `reviews.read` |
| `products.update` | `products.read`, `catalog.read` |
| `catalog.update` | `catalog.read` |
| `content.update` | `content.read` |
| `media.write` | `media.read` |
| `menus.write` | `menus.read` |
| `sliders.write` | `sliders.read` |
| `home_videos.write` | `home_videos.read` |
| `home_highlights.write` | `home_highlights.read`, `products.read` |
| `redirects.write` | `redirects.read` |
| `settings.write` | `settings.read` |
| `admin-users.write` | `admin-users.read`, `roles.read` |
| `roles.write` | `roles.read` |
| `reports.export` | `reports.read` |

Wildcard `*` satisfies every dependency for `SUPER_ADMIN`, but it is not listed in the assignable catalog and cannot be granted to a custom role.

## Admin surface access matrix

| Surface | Menu/list/detail | Create/full-edit | Mutation | Supporting/composite |
|---|---|---|---|---|
| Dashboard | `orders.read` | — | — | inventory widget/topic: `inventory.read`; Product/Reports links: corresponding `.read` |
| Products | `products.read` | `products.read` + `products.update` + `catalog.read` | `products.update` | includes the legacy discontinued-history list; media picker: `media.read`; upload: `media.write` |
| Categories / Brands | `catalog.read` | `catalog.read` + `catalog.update` | `catalog.update` | product references: `products.read`; media picker rules apply |
| Featured Products | `products.read` + `products.update` | same workspace requirement | save: `products.update` | owner-confirmed composite route |
| Content | `content.read` | `content.read` + `content.update` | `content.update` | media picker rules apply |
| Orders / Customers / Reviews | corresponding `.read` | — | corresponding `.write` | Review hard delete additionally exact built-in role `SUPER_ADMIN` |
| Media | `media.read` | — | `media.write` | hard delete: wildcard `*` |
| Menu | `menus.read` | — | `menus.write` | category target picker: `catalog.read` |
| Slider | `sliders.read` | `sliders.write` + `products.read` + `media.read` | toggle/reorder/delete: `sliders.write` | upload: `media.write` |
| Home Videos | `home_videos.read` | — | URL/provider: `home_videos.write` | internal picker: `media.read`; upload: `media.write` |
| Home Highlights | `home_highlights.read` | — | save: `home_highlights.write` + `products.read` | Product picker must not query without `products.read` |
| Redirects / Settings | corresponding `.read` | — | corresponding `.write` | Settings “Phân công”: wildcard `*`; media picker rules apply |
| Admin Users | `admin-users.read` | — | `admin-users.write` | role list/assignment: `roles.read` |
| Roles | `roles.read` | — | `roles.write` | dependency-closed payload required |
| Reports | `reports.read` | — | export: `reports.export` | export is sensitive and depends on `reports.read` |
| Trợ lý BigBike | `chat.read` | — | `chat.reply` | `chat.reply` tiếp nhận/nhắn/bàn giao/kết thúc và phụ thuộc `chat.read`; không sửa transcript/lead |

Media access is deliberately **not** an automatic dependency of Product/Content/Catalog/Settings write permissions. Missing `media.read` disables the picker and prevents media API calls; `media.write` is required only to upload.

### Inventory permissions

| Permission | Granted roles (seed) | Endpoint | Evidence |
|---|---|---|---|
| `inventory.read` | `SUPER_ADMIN` (wildcard), `ADMIN`, `SHOP_MANAGER`, `EDITOR` | `GET /api/v1/admin/inventory` (stock list), `GET /api/v1/admin/inventory/summary`, và subscribe `/topic/admin/inventory` cho Dashboard | `V121__realign_inventory_warranty_permissions.sql`, `AdminInventoryController.java`, `WebSocketConfig.java` |

`inventory.read` is listed in `PermissionCatalog` (`roles.groupProducts`), so it remains grantable to custom roles via the Roles UI. `inventory.write` was removed on 2026-07-31 because no current endpoint or admin action uses it; migration `V364__remove_orphan_inventory_write_permission.sql` revokes any persisted grants.

**Ranh giới quyền Còn/Hết hiện hành:** màn tạo/sửa sản phẩm gửi `available` (chỉ áp dụng SP không biến thể; đổi tên từ `forceOutOfStock`, gỡ hard-override cho SP có biến thể — V342, 2026-07-19) và `variants[].isAvailable` trong product upsert, nên dùng `products.update`; backend tự suy ra `stockState`. Từ 2026-07-15 đây là đường mutation availability DUY NHẤT (các endpoint `inventory.write` đã gỡ), nên không còn quyền ghi tồn kho độc lập — contract chủ đích theo `BUSINESS_RULES.md` Stock State Derivation Rules.

### Media Library permissions

| Permission | Granted roles (seed) | Endpoint | Evidence |
|---|---|---|---|
| `media.read` | `SUPER_ADMIN` (wildcard), `ADMIN`, `EDITOR` | `GET /api/v1/admin/media/**` (list, stats, tags, references, detail, download object gốc) | `V49__create_roles_permissions_tables.sql`, `AdminMediaController.java` |
| `media.write` | `SUPER_ADMIN` (wildcard), `ADMIN`, `EDITOR` | `POST/PUT/DELETE /api/v1/admin/media/**` (upload, bulk-move, bulk soft-delete, bulk-restore, update, soft-delete, restore) | `V49__create_roles_permissions_tables.sql`, `AdminMediaController.java` |
| `*` (wildcard — `SUPER_ADMIN` only) | `SUPER_ADMIN` | `POST /api/v1/admin/media/bulk-hard-delete`, `DELETE /api/v1/admin/media/{mediaId}?permanent=true` | `AdminMediaController.java` (`requirePermission("*")`, separate from and stricter than `media.write` — permanent/irreversible delete is gated to the top tier only) |

`SHOP_MANAGER` does **not** hold `media.read`/`media.write` (not seeded in `V49`) — it cannot access the Media Library at all.

### Reviews permissions

| Permission | Granted roles (seed) | Endpoint | Evidence |
|---|---|---|---|
| `reviews.read` | `SUPER_ADMIN` (wildcard), `ADMIN`, `SHOP_MANAGER` | `GET /api/v1/admin/reviews` (filtered list), `GET /api/v1/admin/reviews/{id}` (detail), `GET /api/v1/admin/reviews/summary` (global moderation KPIs) | `AdminReviewController.java`, `AdminRolePermissions.java`, `PermissionCatalog.java` |
| `reviews.write` | `SUPER_ADMIN` (wildcard), `ADMIN`, `SHOP_MANAGER` | `PATCH /api/v1/admin/reviews/{id}/status`, `POST /api/v1/admin/reviews/bulk-status`; also required for permanent delete, subject to the additional exact-role rule below | `AdminReviewController.java`, `AdminRolePermissions.java` |
| `reviews.write` **and exact built-in role `SUPER_ADMIN`** | `SUPER_ADMIN` only | `DELETE /api/v1/admin/reviews/{id}`, `POST /api/v1/admin/reviews/bulk-delete`; deletion is additionally restricted to reviews already in `TRASH` | `REVIEW_RULE_010`, `AdminReviewController.java`, `AdminReviewService.java` |

(Bổ sung 2026-07-15, AUD-076 — hai quyền này đã tồn tại trong seed/catalog từ trước nhưng chưa được ghi vào matrix. Không có quyền `reviews.moderate`.)

### Trợ lý BigBike permissions

| Permission | Granted roles (seed) | Endpoint | Evidence |
|---|---|---|---|
| `chat.read` | `SUPER_ADMIN` qua wildcard `*`; không tự cấp cho vai trò thường | Hội thoại/detail, phễu, handoff waiting, unanswered và data gaps (data gaps còn cần `products.read`); cũng được đọc stats | `CHAT_RULE_013`, `CHAT_RULE_029`, `CHAT_RULE_040`–`042`, `PermissionCatalog`, migrations `V1016`/`V1052` |
| `settings.read` | Theo ma trận settings hiện hành | Snapshot stats không chứa transcript/PII: token/request, model usage, chi phí, latency và fallback telemetry để hiển thị trong Cài đặt → Trợ lý BigBike | `CHAT_RULE_056_UI_SETTINGS`, `API_CONTRACT.md` §Admin chat history |
| `chat.reply` | `SUPER_ADMIN` qua wildcard `*`; không tự cấp cho vai trò thường | Claim/send/return/close handoff; dependency bắt buộc `chat.read` | `CHAT_RULE_040`, `CHAT_RULE_047`, `PermissionCatalog`, migration `V1056` |

`chat.read` là quyền chỉ đọc, không có dependency và có thể được owner gán cho custom role. `chat.reply` là quyền ghi hẹp, nhạy cảm, phụ thuộc `chat.read`; lưu đúng admin và thời điểm nhận/gửi/bàn giao nhưng không cho sửa/xoá transcript. Migration đổi mọi role-permission `chat.handle` hiện có sang `chat.reply` và không tự cấp role thường. Chỉ người đang nhận được gửi/bàn giao/đóng. Lead chứa số/Zalo nên list/handoff chung chỉ trả cờ có liên hệ; detail chỉ mở sau `chat.read`.

Giai đoạn 4 không tạo quyền mới. Danh mục model, chi phí và kết quả bộ đề là dữ liệu vận hành nên đọc bằng `settings.read`; đổi model, bật/tắt ảnh, thay trần ảnh hoặc chạy bộ đề dùng `settings.write`. Dấu vân tay catalog được backend tự làm mới cục bộ, không mở mutation công khai. Nội dung ảnh khách vẫn là một phần riêng tư của transcript: cả endpoint storefront lẫn admin đều kiểm ownership/`chat.read` ở mỗi lần tải, không phát URL MinIO công khai. `settings.read` đứng một mình không cấp quyền xem ảnh; `chat.read` đứng một mình không cho đổi cấu hình hay chạy bộ đề có chi phí.

### Catalog / Product permissions

| Permission | Granted roles (seed) | Endpoints | Evidence |
|---|---|---|---|
| `catalog.read` | `SUPER_ADMIN` (wildcard), `ADMIN`, `SHOP_MANAGER`, `EDITOR` | `GET /api/v1/admin/brands`, `GET /api/v1/admin/brands/{id}` and other catalog taxonomy reads | `V49__create_roles_permissions_tables.sql`, `AdminCatalogController.java`, `PermissionCatalog.java` |
| `catalog.update` | `SUPER_ADMIN` (wildcard), `ADMIN`, `SHOP_MANAGER` | `POST/PATCH /api/v1/admin/brands`, `DELETE /api/v1/admin/brands/{id}`, `POST /api/v1/admin/brands/{id}/restore`, `DELETE /api/v1/admin/brands/{id}/permanent` and other catalog taxonomy mutations | `V49__create_roles_permissions_tables.sql`, `AdminCatalogController.java`, `PermissionCatalog.java` |
| `products.read` | `SUPER_ADMIN` (wildcard), `ADMIN`, `SHOP_MANAGER`, `EDITOR` | `GET /api/v1/admin/products`, `GET /api/v1/admin/products/{id}`, product presence topic; also one accepted read permission for `GET /api/v1/admin/product-assignment` | `V49__create_roles_permissions_tables.sql`, `V121__realign_inventory_warranty_permissions.sql`, `V363__restore_admin_product_read_permission.sql`, `AdminCatalogController.java`, `WebSocketConfig.java` |
| `products.update` | `SUPER_ADMIN` (wildcard), `ADMIN`, `SHOP_MANAGER` | `POST/PATCH /api/v1/admin/products`, `POST /api/v1/admin/products/preview`, `PATCH /api/v1/admin/products/{id}/publish`, `DELETE /api/v1/admin/products/{id}[/permanent]`, `POST /api/v1/admin/products/{id}/restore`, `POST /api/v1/admin/products/homepage-blocks`, `POST /api/v1/admin/products/import/validate`, `POST /api/v1/admin/products/import/commit`, `GET /api/v1/admin/products/import/export/{id}`; also required for editing/saving the dedicated `/admin/featured-products` workspace, which additionally requires `products.read` to load and search products | `V49__create_roles_permissions_tables.sql`, `AdminCatalogController.java`, `AdminProductImportController.java`, `App.jsx`, `FeaturedProductsScreen.jsx` |

The single-product JSON round-trip export (`GET /api/v1/admin/products/import/export/{id}`) stays under `products.update` because its file is intended to be edited and imported back as a catalog mutation. The catalog CSV export (`GET /api/v1/admin/products/export.csv`) stays under `reports.export` because it carries catalog data out of the system and is audited as a report export; it does not grant product-write access.

`EDITOR` holds `products.read`/`catalog.read` only, not `products.update` — confirmed via `V121__realign_inventory_warranty_permissions.sql`'s own comment describing `EDITOR` as a role that "only had products.read."

The bulk product import endpoints are gated by the same `products.update` permission as every other product-write endpoint — deliberately not `reports.export` (import is a catalog mutation, not a read-only report), so import and the normal admin product form share one authorization boundary.

> **POS permissions removed (2026-06-23, online-only).** The four POS permissions — `pos.read`, `pos.write`, `pos.price_override`, `pos.sell_below_cost` — were **deleted** together with the POS module (admin POS screen, `POST /admin/pos/orders`, `GET /admin/pos/products/search`, `AdminPosController` / `PosOrderService`). They were dropped from `PermissionCatalog` and revoked from every role. BigBike is now online-only.
>
> **AL-03 realignment (V121).** Before V121, `inventory.*` gated the (now-removed) **Warranty** module while the **Inventory** module was gated by `products.*` — the permission name did not match the module it controlled. V121 introduced the dedicated permissions and re-gated each controller + the admin UI. The migration was a **non-breaking backfill**: every role holding `products.*` also received `inventory.*`; `V364` later removed only the obsolete `inventory.write` grant. `EDITOR` therefore keeps `inventory.read` (it held `products.read`) — a deliberate compatibility grant. A later RBAC cleanup may remove `inventory.read` from `EDITOR` only if the business confirms EDITOR is content-only and no longer needs Dashboard stock alerts.
>
> **Serial feature removed (2026-06-23, V259).** `inventory.*` now gates **stock reads / manual boolean availability toggles only** — the admin inventory serial endpoints (`/inventory/serials*`, `/variants/{id}/serials`, `/products/{id}/serials`, `/serials/{id}/status`, `/serials/import`) were deleted along with serial tracking.
>
> **Warranty module removed (2026-06-23, V266).** The `warranty.read` / `warranty.write` permissions were **deleted** together with the warranty feature (admin warranty endpoints, public lookup, records, and the `/bao-hanh` page). They were dropped from `PermissionCatalog` and revoked from every role by the migration.
>
> **Pages + Guide-page modules removed (2026-06-24).** `content.read` / `content.update` now scope to **articles (Tin tức) only** — the static CMS pages module and the guide-page builder were removed (tables `pages` + `guide_page_layout` dropped at `V271`; admin pages CRUD, `reference/pages`, and the `GET`/`PUT /admin/guide-page` endpoints deleted). The 10 info/policy pages are now hardcoded in `bigbike-web`. The permission keys themselves are **unchanged** (still `content.read` / `content.update`); only their reach shrank to article management. `content.read` is also one accepted read permission for the shared `GET /api/v1/admin/product-assignment` banner.

## Roles

Only two default admin roles are seeded as **system roles** (`is_system = TRUE`): `SUPER_ADMIN` and `ADMIN`. `V361__retain_two_system_roles.sql` reclassifies every other existing system role—including the historical `SHOP_MANAGER` and `EDITOR` records—as custom roles without changing their users or permissions. `CUSTOMER` is a **storefront auth role**, not a row in the `admin_roles` table and not shown in the admin Roles screen. Permission tables above may still name `SHOP_MANAGER` or `EDITOR` to describe the retained permissions of those existing custom roles; they are not system defaults.

| Role | Type | Current scope | Status | Evidence |
|---|---|---|---|---|
| `SUPER_ADMIN` | system (built-in) | wildcard `*` — permissions immutable; cannot be edited or deleted | `CONFIRMED_FROM_CODE` | `V49__create_roles_permissions_tables.sql`, `AdminRoleService.java` |
| `ADMIN` | system (built-in) | full operations including media, settings, redirects | `CONFIRMED_FROM_CODE` | `V49__create_roles_permissions_tables.sql` |
| `SHOP_MANAGER` | custom (historical preset, if retained) | catalog/orders/customers/reviews (shipping permissions removed 2026-06-23 `SHIP_RULE_001`; POS removed 2026-06-23) | `CONFIRMED_FROM_MIGRATION` | `V361__retain_two_system_roles.sql` |
| `EDITOR` | custom (historical preset, if retained) | catalog/content/media/menu/slider + SEO redirects operations | `CONFIRMED_FROM_MIGRATION` | `V361__retain_two_system_roles.sql` |
| custom roles | non-system | any keys from `PermissionCatalog`; created/edited/deleted via the Roles API | `CONFIRMED_FROM_CODE` | `AdminRoleService.createRole/deleteRole` |
| `CUSTOMER` | storefront (not an admin role) | own profile/address/order APIs; **not** in `admin_roles` | `CONFIRMED_FROM_CONFIG` | `SecurityConfig.java` |

### Role Governance

Enforced in `AdminRoleService` (Admin Roles API, gated by `roles.write`):

- **System roles cannot be deleted.** `deleteRole` rejects any role with `is_system = TRUE`; only `SUPER_ADMIN` and `ADMIN` are system roles. The set is changed only through a Flyway migration, never through the Roles API.
- **`SUPER_ADMIN` permissions are immutable.** `updateRolePermissions` rejects edits to `SUPER_ADMIN`, which retains the wildcard `*`. `ADMIN` retains its existing permission set and follows the existing permission-update flow.
- **Custom roles** are created with `is_system = FALSE`; they can be edited and deleted when no admin user is assigned. Historical `SHOP_MANAGER` and `EDITOR` roles follow this same custom-role governance after V361.
- **An admin cannot remove `roles.read` or `roles.write` from their own currently assigned role.** The existing UI and service guard continue to prevent self-lockout.
- `CUSTOMER` (`ROLE_CUSTOMER`) is a separate storefront auth realm and is never managed through the admin Roles screen.

### Admin access-change lifecycle

An access change becomes effective only after its database transaction commits. The backend remains
the final authority for every REST request and WebSocket delivery; a browser permission snapshot is
only a UX aid and can never authorize a mutation.

| Change | Session treatment | Required propagation |
|---|---|---|
| Admin role assignment changes, or permissions of an assigned role change | Keep that admin's sessions. Re-resolve current permissions for later requests and notify every open session. | Evict the affected account/role permission cache **after commit** and send the minimal access-change signal to every session of each affected admin. |
| `ACTIVE` to `DISABLED` or `SUSPENDED` | Revoke all refresh sessions for that account and force sign-in again. | Increment the account access version after the transaction commits; a prior bearer token is rejected by REST and STOMP. Send the access-change signal when the connected session can still receive it. |
| Admin password reset through `PATCH /admin-users/{id}` | Revoke all refresh sessions for that account and force sign-in again. | Increment the account access version and use the same invalidation path as a disabled/suspended account. |

Role/permission edits do **not** revoke unrelated accounts or log out the whole admin system. A
single-admin `PATCH` remains the write contract; the server emits one access-change signal for each
affected account. Audit logging records the access change and, when sign-in is forced, the session
revocation reason. This lifecycle is `OWNER_CONFIRMED_2026-07-31`.

## Super-admin-only settings (`product_assign`)

The `product_assign` site-setting keys — `product_assign_title` and `product_assign_roles` (a JSON array of 1–6 dynamic role entries, consolidated from 6 legacy keys by `V318`; see `DATA_CONTRACT.md`) — back the editable "Phân công" guide shown on BOTH the product and content/article create-edit screens (same data, same endpoint). Both keys are flagged `superAdminOnly` in `SettingDefinitionRegistry`. There is **no dedicated permission key** for them — the gate is the wildcard `*` itself:

- **Write** (`PATCH /api/v1/admin/settings[/{key}]`): `AdminSettingsService` rejects the write with 403 unless the caller's resolved permissions contain `*`. So only `SUPER_ADMIN` can edit; `ADMIN` is blocked even though it holds `settings.write`. `product_assign_roles` additionally enforces a 1–6 array-size + required-field structural check in `SettingValueValidator` regardless of caller.
- **Read for the banner** (`GET /api/v1/admin/product-assignment`): requires at least one of `products.read` or `content.read`, so a role that can open either the product editor or the content/article editor sees the shared banner.
- **Admin UI**: the "Phân công sản phẩm" settings tab is a bespoke synthetic tab (`AssignmentRolesScreen.jsx`, outside the generic per-field settings flow as of V318 — the group is in `HIDDEN_GROUPS`) explicitly gated on `isSuperAdmin` in `SettingsScreen.jsx` — non-super-admins never see the tab button.

Status: `CONFIRMED_FROM_OWNER_DECISION` — `SettingDefinitionRegistry.java`, `AdminSettingsService.java`, `AdminProductAssignmentController.java`, `SettingsScreen.jsx`

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

## Rate-limit authority

Rate limiting does not grant, remove or replace a permission. It applies after the existing admin
authentication/permission rules for account-keyed admin controls and before expensive side effects
for public controls. Admin account lockout above remains admin-only; customer login uses an IP plus
HMAC identity limiter rather than a new account-lock state. Admin mutations use the
`ADMIN_MUTATION` tier and privileged media/import/export actions use their dedicated tiers in
`RATE_LIMITING.md`. `OWNER_CONFIRMED_2026-08-12`

## Critical Endpoint Permissions

| Endpoint / surface | Required role/permission | Status | Evidence |
|---|---|---|---|
| `/api/v1/admin/**` | Spring Security URL gate requires an authenticated non-customer admin principal. Customer session cookies are intentionally ignored on this namespace, so a customer-only request receives `401` rather than creating an authenticated customer context that could interfere with an admin refresh; fine-grained permission is then enforced at controller level by `requirePermission()`. | `OWNER_CONFIRMED_2026-07-31` | `SecurityConfig.java`, `CustomerSessionFilter.java`, `DevAdminAuthService.requirePermission`, admin controllers |
| `POST /api/v1/admin/products/preview` | `products.update` (live preview dry-run; no persistence) | `CONFIRMED_FROM_CODE` | `AdminCatalogController.previewProduct`, `AdminCatalogMutationService.previewProduct` |
| `/api/v1/admin/dashboard` GET | `orders.read` only; no exact-role restriction | `OWNER_CONFIRMED_2026-07-31` | `AdminDashboardController.java`, `SecurityConfig.java` |
| `/api/v1/admin/orders` GET | `orders.read` | `CONFIRMED_FROM_CODE` | `AdminOrderController.listOrders` |
| `/api/v1/admin/orders/{orderId}` GET | `orders.read` | `CONFIRMED_FROM_CODE` | `AdminOrderController.getOrderDetail` |
| `/api/v1/admin/orders/{orderId}/allowed-transitions` GET | `orders.read` | `CONFIRMED_FROM_CODE` | `AdminOrderController.listAllowedTransitions` |
| `/api/v1/admin/orders/{orderId}/status` PATCH | `orders.write` | `CONFIRMED_FROM_CODE` | `AdminOrderController.updateOrderStatus` |
| `/api/v1/admin/orders/{orderId}/audit` GET | `orders.read` | `CONFIRMED_FROM_CODE` | `AdminOrderController.listAuditTrail`, `AdminOrderService.listAuditTrail` |
| `/api/v1/customer/orders/**` | `ROLE_CUSTOMER` | `CONFIRMED_FROM_CONFIG` | `SecurityConfig.java` |
| `/api/v1/customer/addresses/**` | `ROLE_CUSTOMER` | `CONFIRMED_FROM_CONFIG` | `SecurityConfig.java` |
| `POST`/`DELETE /api/v1/customer/me/avatar` | `ROLE_CUSTOMER` (own account only — no admin-upload path exists) | `CONFIRMED_FROM_CODE` | `CustomerController.java` |
| `GET /api/v1/admin/customers`, `/summary`, `/{customerId}` | `customers.read` | `CONFIRMED_FROM_CODE` | `AdminCustomerController.java` |
| `PATCH /api/v1/admin/customers/{customerId}`, `PATCH /{customerId}/status`, `DELETE /{customerId}/avatar` | `customers.write` — avatar removal reuses the same write permission; no separate delete/avatar tier was introduced | `CONFIRMED_FROM_CODE` | `AdminCustomerController.java` |
| `GET /api/v1/auth/admin/invite` | public (token-gated) — validate an admin invite token | `CONFIRMED_FROM_CODE` | `SecurityConfig.java`, `AdminInviteService.validateToken` |
| `POST /api/v1/auth/admin/accept-invite` | public (token-gated) — set password for an invited admin, `INVITED → ACTIVE` | `CONFIRMED_FROM_CODE` | `SecurityConfig.java`, `AdminInviteService.acceptInvite` |
| `POST /api/v1/admin/admin-users/{id}/resend-invite` | `admin-users.write` | `CONFIRMED_FROM_CODE` | `AdminAdminUsersController.java` |
| `/api/v1/search-suggest` | public | `CONFIRMED_FROM_CONFIG` | `SecurityConfig.java` (`/api/v1/search` gỡ 2026-07-15, AUD-066; `/api/v1/address/**` + `GET /checkout/options` gỡ 2026-07-15, AUD-056) |

## WebSocket Access

| Channel | Access rule | Status | Evidence |
|---|---|---|---|
| `/ws` STOMP CONNECT | Native `Authorization` bearer token required; the JWT access version must equal the current `admin_users.access_version`, and the admin account must be `ACTIVE`. | `OWNER_CONFIRMED_2026-07-31` | `WebSocketConfig.java`, `JwtService.java`, `AdminAccountStatusService.java` |
| Admin data topics | Each `/topic/admin/**` subscription requires its destination permission. The account, access version and current permission are checked on CONNECT and SUBSCRIBE **and again for every outbound message to an existing subscription**. A stale subscription therefore cannot continue receiving events after access is withdrawn. | `OWNER_CONFIRMED_2026-07-31` | `WebSocketConfig.java`, `AdminPermissionService.java` |
| `/user/queue/admin/access` | Authenticated admin's own user queue only. The server sends the minimal access-change signal (`reason`, `forceReauthentication`) after the access transaction commits; the client calls `GET /api/v1/auth/me` rather than trusting a permission payload from the message. | `OWNER_CONFIRMED_2026-07-31` | `WebSocketConfig.java`, `AdminAccessChangeService.java`, `adminWebSocket.js` |
| Admin presence topics | `/topic/admin/presence/order/{orderId}` requires `orders.read`; `/topic/admin/presence/product/{productId}` requires `products.read`. The same current-access checks apply on SUBSCRIBE and outbound delivery; join/leave commands are accepted only from the authenticated admin session and are not persisted. | `OWNER_CONFIRMED_2026-07-31` | `WebSocketConfig.java`, `AdminPresenceController.java`, `AdminPresenceService.java` |

## Internal Redirect Caveat

`/api/internal/**` (redirect lookup, consumed only by `bigbike-web/proxy.ts` over the Docker-internal network) is `permitAll` in Spring Security — auth is handled manually inside `InternalRedirectController.isAuthorized()` instead of the normal RBAC/JWT flow used by `/api/v1/admin/**`.

- **Shared-secret header:** requests must carry `X-Internal-Token` matching `bigbike.internal.token` (env `BIGBIKE_INTERNAL_TOKEN` on the backend, must equal `INTERNAL_API_TOKEN` on `bigbike-web`). Deny-by-default (`401`) when the token is blank, **except** when `bigbike.internal.allow-open=true` — a flag set **only** in `application-dev.properties` (local dev convenience) and never in staging/prod profiles.
- **Infra-level restriction:** `deploy/nginx/api.bigbike.vn.conf` blocks `/api/internal/` from the public internet (`403`), the same pattern used for `/actuator/**`. This is defense-in-depth on top of the token check, since `bigbike-web` never calls this path over the public domain anyway (it uses the internal Docker hostname `http://bigbike-backend:8080`).

Status: `CONFIRMED_FROM_CONFIG`

Evidence:

- `SecurityConfig.java`
- `InternalRedirectController.java` (`isAuthorized`)
- `application.properties` / `application-dev.properties`
- `deploy/nginx/api.bigbike.vn.conf`

## Reports Permissions

Status: `CONFIRMED_FROM_CODE` — `AdminRolePermissions.java`, `AdminReportController.java`, `V78__add_reports_permissions.sql`

| Endpoint | Required permission | Roles with access |
|---|---|---|
| `GET /api/v1/admin/reports/analytics` | `reports.read` | `SUPER_ADMIN`, `ADMIN`, `SHOP_MANAGER` |
| `GET /api/v1/admin/reports/orders/export` | `reports.export` | `SUPER_ADMIN`, `ADMIN`, `SHOP_MANAGER` |
| `GET /api/v1/admin/reports/customers/export` | `reports.export` | `SUPER_ADMIN`, `ADMIN`, `SHOP_MANAGER` |
| `GET /api/v1/admin/products/export.csv` | `reports.export` | `SUPER_ADMIN`, `ADMIN`, `SHOP_MANAGER` |

| Permission string | Roles | Purpose |
|---|---|---|
| `reports.read` | `SUPER_ADMIN`, `ADMIN`, `SHOP_MANAGER` | Access analytics dashboard |
| `reports.export` | `SUPER_ADMIN`, `ADMIN`, `SHOP_MANAGER` | CSV export from Reports and the filtered/selected/full Product catalog export (audit log gate); not required for the editable JSON round-trip file |

## Maintenance Authority

| Action | Allowed actor | Notes |
|---|---|---|
| Read maintenance state (`GET /api/v1/admin/maintenance`) | **Any** signed-in admin | Deliberately not permission-gated: every staff member must be able to see why the panel refuses to save. Also pushed over STOMP `/topic/admin/maintenance` |
| Change the state (`PUT /api/v1/admin/maintenance`) | **`DEVELOPER` role only**, and the caller must hold `maintenance.manage` | `SUPER_ADMIN` is explicitly excluded (owner decision 2026-08-06) even though its wildcard grants the permission |
| Edit the `DEVELOPER` role's permissions | **Nobody** — `AdminRoleService` refuses, like `SUPER_ADMIN` | Those permissions are what let a developer *release* the lock |
| Write anything else under `/api/v1/admin/**` while `ACTIVE` | `DEVELOPER` only | Everyone else receives `423 MAINTENANCE_ACTIVE`. The backend does not block reads, but the admin UI covers the screen for non-developers, so in practice staff cannot look anything up either (owner decision) |
| Regenerate the static outage pages | Dev/operator with VPS access | `deploy/maintenance/render-fallback-pages.sh`; unrelated to the lock |
| Break-glass unlock | Dev/operator with DB or VPS access | `UPDATE maintenance_state SET state='NORMAL' WHERE id=1;` + restart backend, or `BIGBIKE_MAINTENANCE_LOCK_ENABLED=false` — see `DEPLOYMENT_GUIDE.md` |

**The decisive gate is the role name, not the permission — and it has to be.** `DevAdminAuthService.hasAnyPermission` short-circuits `return true` for any role holding `*`, so *any* permission invented for this endpoint is automatically held by `SUPER_ADMIN`, including `maintenance.manage`. An exact comparison against `profile.roles()` is the only construct in this codebase that the wildcard cannot satisfy (same shape as `AdminReviewController.requireSuperAdminWithReviewsWrite`). If someone ever "tidies" the role check away and relies on the permission alone, the owner's requirement silently breaks; `MaintenanceLockIntegrationTest.superAdmin_cannotToggleMaintenance_despiteHoldingWildcard` exists to catch exactly that.

**Why `maintenance.manage` exists anyway (V375).** A pure role-name gate left the capability invisible: the Roles screen lists permissions, so nothing there showed that `DEVELOPER` could lock the panel. Worse, the endpoint originally authenticated with `settings.write` — an unrelated permission that *is* editable in that screen, so un-ticking it would silently disable the maintenance toggle with no visible connection. The dedicated permission makes the capability appear where operators look for it and removes the accidental coupling. Granting it to any other role does nothing (the role gate still rejects them); the admin label states this outright. The `DEVELOPER` role's permissions are frozen so the pairing cannot be broken from the UI.

Operational consequence, accepted by the owner: if the developer is unavailable, the owner cannot unlock from the admin UI and must use one of the break-glass paths above. Provision **two** `DEVELOPER` accounts — there is no admin self-service password reset, and `resend-invite` is itself blocked while the lock is `ACTIVE`.
