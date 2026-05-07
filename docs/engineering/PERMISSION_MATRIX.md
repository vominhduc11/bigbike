# Permission Matrix

## Role And Permission Source

Admin role-to-permission mapping is defined in `AdminRolePermissions.java`.

## Roles

| Role | Current scope | Status | Evidence |
|---|---|---|---|
| `SUPER_ADMIN` | wildcard `*` | `CONFIRMED_FROM_CODE` | `AdminRolePermissions.java` |
| `ADMIN` | full operations including media, settings, redirects, POS override | `CONFIRMED_FROM_CODE` | `AdminRolePermissions.java` |
| `SHOP_MANAGER` | catalog/orders/customers/coupons/shipping read/reviews/POS without price override | `CONFIRMED_FROM_CODE` | `AdminRolePermissions.java` |
| `EDITOR` | catalog/content/media/menu/slider operations | `CONFIRMED_FROM_CODE` | `AdminRolePermissions.java` |
| `AUTHOR` | content/media operations | `CONFIRMED_FROM_CODE` | `AdminRolePermissions.java` |
| `CONTRIBUTOR` | content/media read | `CONFIRMED_FROM_CODE` | `AdminRolePermissions.java` |
| `SEO_EDITOR` | content and redirects | `CONFIRMED_FROM_CODE` | `AdminRolePermissions.java` |
| `CUSTOMER` | own profile/address/order/return APIs | `CONFIRMED_FROM_CONFIG` | `SecurityConfig.java` |

## Critical Endpoint Permissions

| Endpoint / surface | Required role/permission | Status | Evidence |
|---|---|---|---|
| `/api/v1/admin/**` | `ROLE_ADMIN` in Spring Security, with controller-level permission checks | `CONFIRMED_FROM_CODE` | `SecurityConfig.java`, admin controllers |
| `/api/v1/admin/pos/products/search` | admin role + `pos.read` | `CONFIRMED_FROM_CODE` | `SecurityConfig.java`, `AdminPosController.java` |
| `/api/v1/admin/pos/orders` | admin role + `pos.write` | `CONFIRMED_FROM_CODE` | `SecurityConfig.java`, `AdminPosController.java` |
| POS price override | `pos.price_override` | `CONFIRMED_FROM_CODE` | `AdminPosController.java`, `PosOrderService.java` |
| `/api/v1/admin/coupons/**` | admin/security role; controller permissions `coupons.read` or `coupons.write` | `CONFIRMED_FROM_CODE` | `SecurityConfig.java`, `AdminCouponController.java` |
| `/api/v1/admin/dashboard` GET | `orders.read`; `ROLE_ADMIN`, `ROLE_SUPER_ADMIN`, or `ROLE_SHOP_MANAGER` | `CONFIRMED_FROM_CODE` | `SecurityConfig.java`, `AdminDashboardController.java` |
| `/api/v1/admin/returns` GET | `orders.read` | `CONFIRMED_FROM_CODE` | `AdminReturnController.java` |
| `/api/v1/admin/returns/{returnId}/status` PATCH | `orders.write` | `CONFIRMED_FROM_CODE` | `AdminReturnController.java` |
| `/api/v1/customer/orders/**` | `ROLE_CUSTOMER` | `CONFIRMED_FROM_CONFIG` | `SecurityConfig.java` |
| `/api/v1/customer/addresses/**` | `ROLE_CUSTOMER` | `CONFIRMED_FROM_CONFIG` | `SecurityConfig.java` |
| `/api/v1/contact` | public | `CONFIRMED_FROM_CONFIG` | `SecurityConfig.java` |
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

## Accounts Receivable Permissions

Status: `CONFIRMED_FROM_CODE` — implemented in `AdminRolePermissions.java`.

| Permission string | Granted roles | Purpose |
|---|---|---|
| `receivables.read` | `SUPER_ADMIN`, `ADMIN`, `SHOP_MANAGER` | View receivables list, per-customer outstanding balance, aging report, customer credit profile |
| `receivables.create` | `SUPER_ADMIN`, `ADMIN` | Update customer credit profile (creditEnabled, limit, terms, status) |
| `receivables.record_payment` | `SUPER_ADMIN`, `ADMIN`, `SHOP_MANAGER` | Record a partial or full payment against a credit receivable |
| `receivables.write_off` | `SUPER_ADMIN`, `ADMIN` | Write off an uncollectable receivable (mandatory reason required) |
| `receivables.override_limit` | `SUPER_ADMIN`, `ADMIN` | Bypass credit limit check when creating a POS credit sale |
| `receivables.export` | `SUPER_ADMIN`, `ADMIN` | Reserved for future CSV/PDF export of receivables |

Evidence: `AdminRolePermissions.java`, `AdminReceivableController.java`
