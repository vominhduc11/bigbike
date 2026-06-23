# BigBike User Roles

## 1. Document Purpose

File này mô tả các actor/user role tham gia vào hệ thống BigBike ở mức business. Mục tiêu là giúp business user, PM, BA, tester, developer mới và AI agent hiểu ai dùng hệ thống, mỗi vai trò dùng để làm gì, được phép làm gì ở mức nghiệp vụ, không được phép làm gì, và liên quan đến module/process/workflow nào.

File này trả lời câu hỏi: **"Ai dùng hệ thống và vai trò nghiệp vụ của họ là gì?"**

Giới hạn:

- Không phải bảng permission kỹ thuật chi tiết.
- Không thay thế `PERMISSION_MATRIX.md`.
- Không nhồi request/response API.
- Không tự bịa actor/role nếu repo không có evidence.
- Không khẳng định role production-ready nếu auth/RBAC runtime chưa được verify.
- Không chứa secret, token, password, private key hoặc env value nhạy cảm.

File này dùng làm nền cho:

- `PERMISSION_MATRIX.md`
- `BUSINESS_PROCESS.md`
- `MODULE_CATALOG.md`
- `WORKFLOW_OVERVIEW.md`
- `ACCEPTANCE_CRITERIA.md`
- `TRACEABILITY_MATRIX.md`

## 2. Role Status Labels

| Label | Meaning |
|---|---|
| `CONFIRMED_FROM_CODE` | Đã thấy evidence trực tiếp trong source/config/docs. |
| `INFERRED_FROM_STRUCTURE` | Suy luận từ route/folder/API naming nhưng chưa đủ evidence đầy đủ. |
| `NEEDS_VERIFICATION` | Cần kiểm tra thêm bằng code review sâu hơn, build/test/runtime hoặc business confirmation. |
| `NOT_FOUND_IN_REPO` | Chưa thấy trong repo hiện tại. |
| `PARTIAL` | Có một phần UI/API/model nhưng chưa đủ role behavior hoàn chỉnh. |
| `MISSING_EVIDENCE` | Có claim hoặc nhu cầu business nhưng chưa tìm được evidence rõ. |

## 3. Actor / Role Summary

| Role / Actor | Type | Purpose | Access Area | Status | Evidence |
|---|---|---|---|---|---|
| Guest / Visitor | Human user | Xem public website, sản phẩm, content, search, cart/checkout dạng guest. | Public web, public APIs, mobile public routes. | `CONFIRMED_FROM_CODE` | `bigbike-web/app/page.tsx`, `bigbike-web/lib/utils/routes.ts`, `SecurityConfig`, `CheckoutService` |
| Customer | Human user | Đăng ký/đăng nhập, checkout, quản lý profile/address/order. | Public web/mobile account area, customer APIs. | `CONFIRMED_FROM_CODE` | `CustomerAuthController`, `CustomerOrderController`, `CustomerAddressController`, `SecurityConfig`, `PHASE_1D_CUSTOMER_AUTH_REPORT.md` |
| Admin | Internal user | Vận hành hệ thống ở mức rộng: product, order, customer, content, settings, media, users, reports. | Admin portal, admin APIs. | `CONFIRMED_FROM_CODE` | `AdminRolePermissions.java`, `SecurityConfig`, `bigbike-admin/README.md`, admin controllers |
| Super Admin | Internal user | Quyền cao nhất, có wildcard permission và bảo vệ chống tự hạ quyền/last super admin demotion. | Admin portal, admin users/roles/settings/all admin modules. | `CONFIRMED_FROM_CODE` | `AdminRolePermissions.java`, `AdminAdminUsersService.java` |
| Shop Manager | Internal user | Quản lý bán hàng/vận hành shop: products, orders, customers, shipping read, reviews. | Admin portal selected business modules. | `CONFIRMED_FROM_CODE` for role mapping; UI behavior `NEEDS_VERIFICATION` | `AdminRolePermissions.java` |
| Editor | Internal user | Quản lý content/media/menu/slider, SEO redirects và đọc catalog. | Admin content/media/menu/slider/redirects modules. | `CONFIRMED_FROM_CODE` for role mapping; UI behavior `NEEDS_VERIFICATION` | `AdminRolePermissions.java`, `V200__reduce_default_roles.sql` |
| Staff | Internal user | Role nghiệp vụ chung để gọi nhân viên vận hành; repo không có role exact `STAFF`. | Admin modules depending assigned role. | `INFERRED_FROM_STRUCTURE` | Business docs/admin scope; exact technical role absent in `AdminRolePermissions.java` |
| System | System actor | Tự động validate, tạo order/payment/shipping, gửi notification, audit, websocket event. (Không trừ/hoàn kho — availability là cờ boolean admin tự bật/tắt, V261.) | Backend services/internal workflows. | `CONFIRMED_FROM_CODE` | `CheckoutService`, `AdminOrderService`, `AdminOrderWsService` |
| Email Service | Third-party/system actor | Gửi transactional email cho order/admin notifications. | Backend notification/email integration. | `CONFIRMED_FROM_CODE` for code path; runtime `NEEDS_VERIFICATION` | `OrderNotificationService`, `bigbike-backend/pom.xml`, `docker-compose.yaml` |
| Media Storage / MinIO | Third-party/system actor | Lưu file/media object. | Media upload/storage backend. | `CONFIRMED_FROM_CODE` | `AdminMediaController`, `MinioConfig`, `MinioProperties`, `docker-compose.yaml` |
| Payment Provider | Third-party actor | Tự động cập nhật payment qua webhook/provider nếu có. | Payment integration. | `NOT_FOUND_IN_REPO` | No payment webhook/provider evidence found in audited files. |
| Shipping Provider | Third-party actor | Tạo vận đơn/tracking với carrier nếu có. | Shipping/fulfillment integration. | `NOT_FOUND_IN_REPO` | `AdminShippingController` confirms internal zones/methods only. |
| Analytics / Observability Service | Third-party/system actor | Tracking/frontend analytics/errors. | Web analytics/Sentry/GTM references. | `INFERRED_FROM_STRUCTURE` | `bigbike-web/package.json`, `bigbike-web/app/page.tsx`, `docker-compose.yaml` |
| Support Agent | Internal user | Hỗ trợ khách hàng/order issues. | Potentially admin customers/orders. | `NEEDS_VERIFICATION` | No explicit `SUPPORT` role found. |
| Warehouse / Inventory Staff | Internal user | Quản lý kho/tồn/stock movement. | Inventory module. | `NEEDS_VERIFICATION` | Inventory module exists, no explicit warehouse role found. |

## 4. Public Website Roles

### Role: Guest / Visitor

| Field | Value |
|---|---|
| Purpose | Người truy cập chưa đăng nhập, xem sản phẩm/content và có thể mua hàng dạng guest. |
| Access Area | Homepage, product listing/detail, category/brand, search, articles/pages, public menu/settings, cart, checkout, order lookup. |
| Main Actions | Xem sản phẩm/content, tìm kiếm, thêm giỏ hàng, checkout guest, quick-buy, submit review public nếu endpoint được dùng. |
| Restricted Actions | Không được gọi admin APIs; không được xem customer account/order protected APIs nếu chưa authenticate; không được gọi customer protected routes. |
| Related Modules | Homepage, Catalog, Search, Cart, Checkout, Content, Reviews, SEO/Menu. |
| Related Business Processes | Customer Browsing, Cart/Checkout, Review submission. |
| Status | `CONFIRMED_FROM_CODE` |
| Evidence | `SecurityConfig`, `CheckoutService`, `CartController`, `CatalogController`, `ContentController`, `bigbike-web/app/page.tsx` |

#### Business-level allowed actions

| Action | Status | Evidence | Notes |
|---|---|---|---|
| View homepage/public content | `CONFIRMED_FROM_CODE` | `bigbike-web/app/page.tsx`, `SecurityConfig` | Public GET endpoints are permitAll. |
| Browse products/categories/brands | `CONFIRMED_FROM_CODE` | `CatalogController`, `SecurityConfig` | Public catalog reads. |
| Search/search suggest | `CONFIRMED_FROM_CODE` | `PublicSearchController`, `SecurityConfig` | Public search endpoints. |
| Use cart | `CONFIRMED_FROM_CODE` | `CartController`, `SecurityConfig` | Cart endpoints permit guest/customer. |
| Checkout guest | `CONFIRMED_FROM_CODE` | `CheckoutService`, `SecurityConfig`, `PHASE_1F_CHECKOUT_API_REPORT.md` | Guest/customer checkout supported. |
| Quick-buy guest | `CONFIRMED_FROM_CODE` | `CheckoutService`, `SecurityConfig` | Quick-buy public POST. |
| Order lookup | `CONFIRMED_FROM_CODE` | `OrderLookupController`, `SecurityConfig` | Public GET order lookup. |
| Access admin portal/API | `CONFIRMED_FROM_CODE` restricted | `SecurityConfig` | `/api/v1/admin/**` requires `ROLE_ADMIN`. |

#### Needs Verification

- Whether public web UI clearly distinguishes guest checkout vs login-required features.
- Review submission UI and moderation path.
- Guest cart persistence and expiry behavior.

### Role: Customer

| Field | Value |
|---|---|
| Purpose | Người dùng có tài khoản, có thể đăng nhập, quản lý profile/address/order và checkout. |
| Access Area | Customer auth/account/profile/address/order APIs, public web/mobile account routes. |
| Main Actions | Register/login/refresh/logout, view profile, manage addresses, list/view orders, checkout as authenticated customer. |
| Restricted Actions | Không được gọi admin APIs; không được xem order của customer khác; customer mutations cần session/CSRF theo design. |
| Related Modules | Customer Account/Auth, Cart, Checkout, Orders, Address, Profile. |
| Related Business Processes | Customer Account, Cart/Checkout, Order Tracking. |
| Status | `CONFIRMED_FROM_CODE` |
| Evidence | `CustomerAuthController`, `CustomerOrderController`, `CustomerAddressController`, `SecurityConfig`, `PHASE_1D_CUSTOMER_AUTH_REPORT.md`, `bigbike_mobile/lib/core/router/app_router.dart` |

#### Business-level allowed actions

| Action | Status | Evidence | Notes |
|---|---|---|---|
| Register/login/logout | `CONFIRMED_FROM_CODE` | `CustomerAuthController`, `PHASE_1D_CUSTOMER_AUTH_REPORT.md` | Cookie session + refresh + CSRF. |
| View own profile | `CONFIRMED_FROM_CODE` | `CustomerController`, `SecurityConfig` | `/api/v1/customer/me` requires `ROLE_CUSTOMER`. |
| Manage own addresses | `CONFIRMED_FROM_CODE` | `CustomerAddressController`, `SecurityConfig` | Customer address endpoints protected. |
| List/view own orders | `CONFIRMED_FROM_CODE` | `CustomerOrderController`, `SecurityConfig` | Uses `CustomerPrincipal.customerId`. |
| Checkout as logged-in customer | `CONFIRMED_FROM_CODE` | `CheckoutService`, `PHASE_1F_CHECKOUT_API_REPORT.md` | Authenticated checkout supported. |
| Access admin APIs | `CONFIRMED_FROM_CODE` restricted | `SecurityConfig` | Admin APIs require `ROLE_ADMIN`. |

#### Needs Verification

- Production cookie security settings and session cleanup.
- Email verification/password reset runtime completeness.
- Customer web UI route guard and empty/error states.
- Business rule preventing customer from returning invalid/non-returnable orders should be verified in `CustomerReturnService`.

## 5. Admin Portal Roles

### Role: Admin

| Field | Value |
|---|---|
| Purpose | Nội bộ vận hành hệ thống BigBike với quyền rộng trên các module business chính. |
| Access Area | Admin portal and `/api/v1/admin/**` APIs. |
| Main Actions | Quản lý products, catalog, content, orders, customers, media, settings, menus, sliders, shipping, reviews, admin users, redirects, audit logs. |
| Restricted Actions | Không có wildcard `*` như Super Admin; bị giới hạn theo permission map. |
| Related Modules | Products, Orders, Customers, Inventory, Media, Content, Settings, Menus, Shipping, Reports, Users/RBAC. |
| Related Business Processes | Product Management, Order Management, Payment Handling, Inventory Management, Content/SEO, Settings/Configuration. |
| Status | `CONFIRMED_FROM_CODE` |
| Evidence | `AdminRolePermissions.java`, `SecurityConfig`, `AuthController.java`, `AdminAuthService.java`, `JwtService.java`, `JwtAuthFilter.java`, `DevAdminAuthService.java`, `bigbike-admin/README.md` |

#### Business-level allowed actions

Admin default role has broad business access to read/update many admin modules. Do not use this file as permission matrix; detail belongs in `PERMISSION_MATRIX.md`.

#### Confirmed (production auth path)

- Admin login is a real JWT flow: `POST /api/v1/auth/login` verifies the password hash and requires the account status to be `ACTIVE` (`AdminAuthService`), then issues a signed JWT (`JwtService`). `JwtAuthFilter` parses the `Authorization: Bearer` token into an `AdminPrincipal`; `DevAdminAuthService.requirePermission` resolves that principal's permissions from the DB and enforces them. The legacy `X-Admin-Role` header bypass is **disabled by default** (`bigbike.auth.dev-header-enabled=false`) and additionally profile-guarded.

#### Needs Verification

- UI-level route guards and disabled actions by permission.
- Login brute-force / lockout behaviour and refresh-token revocation/rotation depth.

### Role: Super Admin

| Field | Value |
|---|---|
| Purpose | Quyền cao nhất trong admin system, dùng cho quản trị toàn hệ thống và quản lý role/user nhạy cảm. |
| Access Area | All admin modules, admin user/role management, settings/configuration. |
| Main Actions | Có wildcard permission `*`; có thể quản lý admin users/roles/settings và các module nghiệp vụ. |
| Restricted Actions | Không được tự hạ quyền khỏi `SUPER_ADMIN`; không được hạ quyền Super Admin cuối cùng đang active. |
| Related Modules | Users, Roles/Permissions, Settings, all admin modules. |
| Related Business Processes | Admin User/Role/Permission Process, Settings/Configuration, all admin operations. |
| Status | `CONFIRMED_FROM_CODE` |
| Evidence | `AdminRolePermissions.java`, `AdminAdminUsersService.java`, `AdminRolesController.java` |

#### Confirmed guardrails

| Guardrail | Status | Evidence | Notes |
|---|---|---|---|
| Wildcard permission | `CONFIRMED_FROM_CODE` | `AdminRolePermissions.java` | `SUPER_ADMIN` maps to `*`. |
| Cannot demote self from Super Admin | `CONFIRMED_FROM_CODE` | `AdminAdminUsersService.java` | Rejects self-demotion. |
| Cannot demote last active Super Admin | `CONFIRMED_FROM_CODE` | `AdminAdminUsersService.java` | Counts active Super Admins. |
| Can manage roles/permissions if has roles.write | `CONFIRMED_FROM_CODE` | `AdminRolesController.java` | Role permission update/create/delete. Gate changed from admin-users.write → roles.write in P1 hardening (V81). |

#### Needs Verification

- Whether UI visibly protects Super Admin destructive actions.
- Whether custom roles can accidentally receive dangerous permissions without business approval.

### Role: Shop Manager

| Field | Value |
|---|---|
| Purpose | Quản lý vận hành bán hàng/shop ở mức product/order/customer/review/shipping read. |
| Access Area | Admin business operation modules. |
| Main Actions | Product update/read, order processing, customer read/write, reviews read/write, shipping read. |
| Restricted Actions | Không thấy permissions cho settings, admin users, media write, menus, redirects, full shipping write. |
| Related Modules | Products, Orders, Customers, Shipping, Reviews. |
| Related Business Processes | Product Management, Order Management, Customer Management, Review Moderation. |
| Status | `CONFIRMED_FROM_CODE` for role map; UI behavior `NEEDS_VERIFICATION` |
| Evidence | `AdminRolePermissions.java` |

#### Needs Verification

- Whether admin UI labels this role as `Shop Manager` or business uses another Vietnamese role name.
- Whether this role should handle inventory adjustment; current map does not list separate inventory permission and inventory uses product permissions.

### Role: Editor

| Field | Value |
|---|---|
| Purpose | Quản lý nội dung, media, menu, slider, SEO redirects; có quyền đọc catalog/product để phục vụ nội dung. |
| Access Area | Admin content/media/menu/slider/redirects modules. |
| Main Actions | Read/update content, read/write media, read/write menus/sliders, read/write SEO redirects, read products/catalog. |
| Restricted Actions | Không thấy quyền order/customer/settings/admin-users/shipping. |
| Related Modules | Content, Media, Menus, Sliders, Redirects/SEO, Products/Catalog read. |
| Related Business Processes | Content/SEO Management, Media Management, Homepage Content Management, Redirect Management. |
| Status | `CONFIRMED_FROM_CODE` for role map; UI behavior `NEEDS_VERIFICATION` |
| Evidence | `AdminRolePermissions.java`, `V200__reduce_default_roles.sql`, `AdminRedirectController` |

### Role: Staff

| Field | Value |
|---|---|
| Purpose | Cách gọi business-level cho nhân viên vận hành. Repo không có role exact `STAFF`; quyền thực tế nên map qua `SHOP_MANAGER`, `EDITOR` hoặc custom role. |
| Access Area | Tùy role kỹ thuật được gán. |
| Main Actions | Tùy vai trò: xử lý đơn, quản lý sản phẩm, nội dung, media, SEO, kho. |
| Restricted Actions | Tùy permission map; không nên mặc định staff có quyền settings/users/roles. |
| Related Modules | Depends on assigned role. |
| Related Business Processes | Depends on assigned role. |
| Status | `INFERRED_FROM_STRUCTURE` / `NEEDS_VERIFICATION` |
| Evidence | `AdminRolePermissions.java`, `AdminAdminUsersService.java` |

#### Needs Verification

- Business có dùng khái niệm `Staff` không, hay chỉ dùng role cụ thể.
- Có cần custom role cho warehouse/support không.

## 6. System Actors

### Actor: System

| Field | Value |
|---|---|
| Purpose | Tự động thực hiện business logic và side effects bên trong backend. |
| System Interaction | Validate input, create order/payment/shipping/note, audit, notify, websocket push, enforce state transitions. (No quantity decrement/restore — boolean availability, V261.) |
| Related Processes | Checkout, Order Management, Payment Handling, Inventory, Return/Refund, Notification, Audit. |
| Status | `CONFIRMED_FROM_CODE` |
| Evidence | `CheckoutService`, `AdminOrderService`, `AdminReturnService`, `AdminOrderWsService`, `SecurityConfig` |

#### System actions confirmed

- Validate checkout address/payment/shipping/stock/price.
- Create order, line items, addresses, shipping item, payment, note.
- Mark cart converted.
- Validate per-variant availability (`isAvailable`) on checkout/quick-buy. (No quantity decrement — V261.)
- No stock restore on cancel/refund/return — availability is a manual boolean (V261).
- Validate order/payment/return status transitions.
- Write audit logs for admin order/admin user changes.
- Send notification service calls.
- Push admin websocket events.

### Actor: Payment Provider

| Field | Value |
|---|---|
| Purpose | Would update payment status automatically through provider callback/webhook. |
| System Interaction | Not confirmed. Current payment appears internal/manual with COD/BACS. |
| Related Processes | Payment Handling, Order Management. |
| Status | `NOT_FOUND_IN_REPO` |
| Evidence | No payment webhook/provider controller/service found in audited evidence. |

#### Needs Verification

- Whether bank transfer QR/reconciliation is planned outside repo.
- Whether BACS is purely manual bank transfer.

### Actor: Shipping Provider

| Field | Value |
|---|---|
| Purpose | Would create waybill/tracking and update shipping status through carrier integration. |
| System Interaction | Not confirmed. Current shipping support is internal zones/methods/cost. |
| Related Processes | Shipping/Fulfillment, Order Management. |
| Status | `NOT_FOUND_IN_REPO` |
| Evidence | `AdminShippingController` confirms zones/methods; no provider-specific integration found. |

### Actor: Email Service

| Field | Value |
|---|---|
| Purpose | Gửi transactional emails cho order/return/admin notifications. |
| System Interaction | Backend calls notification service during checkout/order/return flows; mail dependency/config exists. |
| Related Processes | Checkout, Order Management, Return/Refund, Notification. |
| Status | `CONFIRMED_FROM_CODE` for code path; runtime delivery `NEEDS_VERIFICATION` |
| Evidence | `CheckoutService`, `AdminOrderService`, `AdminReturnService`, `OrderNotificationService`, `bigbike-backend/pom.xml`, `docker-compose.yaml` |

### Actor: Media Storage / CDN

| Field | Value |
|---|---|
| Purpose | Lưu và phục vụ media assets cho product/content/homepage. |
| System Interaction | Admin uploads media; backend stores media via MinIO/S3-compatible configuration. |
| Related Processes | Media Management, Product Management, Content/SEO, Homepage. |
| Status | `CONFIRMED_FROM_CODE` for MinIO/storage config; CDN delivery `NEEDS_VERIFICATION` |
| Evidence | `AdminMediaController`, `MinioConfig`, `MinioProperties`, `docker-compose.yaml` |

### Actor: Analytics / Observability Service

| Field | Value |
|---|---|
| Purpose | Theo dõi frontend analytics/errors hoặc monitoring. |
| System Interaction | Package/env references exist; production setup not verified. |
| Related Processes | SEO/Marketing, Operations, Debugging. |
| Status | `INFERRED_FROM_STRUCTURE` |
| Evidence | `bigbike-web/package.json`, `bigbike-web/app/page.tsx`, `docker-compose.yaml` |

## 7. Role Responsibilities

| Role | Main Responsibilities | Related Modules | Related Processes | Status |
|---|---|---|---|---|
| Guest / Visitor | Browse public content/products, search, cart/checkout guest, order lookup. | Public Web, Catalog, Cart, Checkout, Content. | Customer Browsing, Cart/Checkout. | `CONFIRMED_FROM_CODE` |
| Customer | Account auth, profile/address, checkout, order history/detail, returns. | Customer Account, Orders, Returns, Checkout. | Customer Account, Checkout, Return/Refund. | `CONFIRMED_FROM_CODE` |
| Admin | Broad shop operation and admin module management. | Products, Orders, Customers, Media, Content, Settings, Reports, Users. | Product/Order/Content/Settings/Admin management. | `CONFIRMED_FROM_CODE` |
| Super Admin | Highest-level system/admin governance. | All admin modules, users, roles, settings. | RBAC/User Management, Configuration, all operations. | `CONFIRMED_FROM_CODE` |
| Shop Manager | Commercial/shop operations. | Products, Orders, Customers, Reviews, Shipping read. | Product Management, Order Management, Customer Management. | `CONFIRMED_FROM_CODE`; UI `NEEDS_VERIFICATION` |
| Editor | Content/media/menu/slider/redirect operations. | Content, Media, Menus, Sliders, Redirects. | Content/SEO, Media, Homepage Content, Redirect Management. | `CONFIRMED_FROM_CODE`; UI `NEEDS_VERIFICATION` |
| Staff | Generic internal operator; exact access depends on assigned role/custom role. | Depends on role. | Depends on role. | `INFERRED_FROM_STRUCTURE` |
| System | Enforce business rules and internal automation. | Checkout, Orders, Inventory, Returns, Notification, Audit. | Cross-process automation. | `CONFIRMED_FROM_CODE` |
| Email Service | Deliver notifications. | Notification. | Checkout, Order, Return. | `CONFIRMED_FROM_CODE`; runtime `NEEDS_VERIFICATION` |
| Media Storage / MinIO | Store media objects. | Media, Product, Content. | Media Management. | `CONFIRMED_FROM_CODE` |
| Payment Provider | Payment webhook/auto reconciliation. | Payment. | Payment Handling. | `NOT_FOUND_IN_REPO` |
| Shipping Provider | Carrier tracking/waybill. | Shipping/Fulfillment. | Shipping/Fulfillment. | `NOT_FOUND_IN_REPO` |

## 8. Role Restrictions

| Role | Restricted Actions | Reason | Status | Evidence |
|---|---|---|---|---|
| Guest / Visitor | Cannot access admin APIs. | Admin endpoints require `ROLE_ADMIN`. | `CONFIRMED_FROM_CODE` | `SecurityConfig` |
| Guest / Visitor | Cannot access customer protected APIs. | Customer order/profile/address endpoints require `ROLE_CUSTOMER`. | `CONFIRMED_FROM_CODE` | `SecurityConfig`, `CustomerOrderController` |
| Customer | Cannot access admin APIs. | Admin APIs require `ROLE_ADMIN`, customer has `ROLE_CUSTOMER`. | `CONFIRMED_FROM_CODE` | `SecurityConfig` |
| Customer | Cannot read other customer orders through customer order APIs. | Controller uses `CustomerPrincipal.customerId` from SecurityContext. | `CONFIRMED_FROM_CODE` | `CustomerOrderController` |
| Admin | Not automatically wildcard. | `ADMIN` has listed permissions; `SUPER_ADMIN` has `*`. | `CONFIRMED_FROM_CODE` | `AdminRolePermissions.java` |
| Super Admin | Cannot demote themselves from Super Admin. | Prevent lockout / governance issue. | `CONFIRMED_FROM_CODE` | `AdminAdminUsersService.java` |
| Super Admin / Admin user management | Cannot demote last active Super Admin. | Prevent losing highest admin access. | `CONFIRMED_FROM_CODE` | `AdminAdminUsersService.java` |
| Shop Manager | No default settings/admin-user write permission. | Role map excludes settings/admin-users. | `CONFIRMED_FROM_CODE` | `AdminRolePermissions.java` |
| Editor | No default order/customer/settings/admin-user permissions. | Role map excludes those scopes (content/media/menu/slider/redirects only). | `CONFIRMED_FROM_CODE` | `AdminRolePermissions.java` |
| Staff | Restrictions depend on assigned technical role. | No exact `STAFF` role in default role map. | `NEEDS_VERIFICATION` | `AdminRolePermissions.java` |
| Payment Provider | Cannot be confirmed as system actor. | No webhook/provider flow found. | `NOT_FOUND_IN_REPO` | N/A |
| Shipping Provider | Cannot be confirmed as system actor. | No carrier integration found. | `NOT_FOUND_IN_REPO` | N/A |

## 9. Role to Module Mapping

| Role | Allowed / Related Modules | Level of Access | Status | Evidence |
|---|---|---|---|---|
| Guest / Visitor | Homepage, Catalog, Search, Cart, Checkout, Content, Order Lookup, Public Settings/Menu. | View public / transact guest. | `CONFIRMED_FROM_CODE` | `SecurityConfig`, public controllers, web routes |
| Customer | Account, Profile, Addresses, Orders, Returns, Cart, Checkout. | View/manage own account and orders. | `CONFIRMED_FROM_CODE` | `CustomerAuthController`, `CustomerOrderController`, `SecurityConfig` |
| Admin | Most admin business modules. | Manage/process/configure depending permission list. | `CONFIRMED_FROM_CODE` | `AdminRolePermissions.java` |
| Super Admin | All admin modules. | Manage/configure/govern all. | `CONFIRMED_FROM_CODE` | `AdminRolePermissions.java` |
| Shop Manager | Products, Catalog, Orders, Customers, Shipping read, Reviews. | Manage/process shop operations. | `CONFIRMED_FROM_CODE` | `AdminRolePermissions.java` |
| Editor | Products read, Catalog read, Content, Media, Menus, Sliders, Redirects. | Manage content/media/navigation/SEO redirects. | `CONFIRMED_FROM_CODE` | `AdminRolePermissions.java` |
| Staff | Depends on assigned role/custom role. | Needs verification. | `NEEDS_VERIFICATION` | `AdminRolePermissions.java`, `AdminRoleService` |
| System | Checkout, Orders, Payment, Inventory, Returns, Notification, Audit. | System-only. | `CONFIRMED_FROM_CODE` | services |
| Email Service | Notification. | System integration. | `CONFIRMED_FROM_CODE`; runtime `NEEDS_VERIFICATION` | `OrderNotificationService`, mail config |
| Media Storage / MinIO | Media. | System integration. | `CONFIRMED_FROM_CODE` | `MinioConfig`, `docker-compose.yaml` |
| Payment Provider | Payment. | Not confirmed. | `NOT_FOUND_IN_REPO` | N/A |
| Shipping Provider | Shipping/Fulfillment. | Not confirmed. | `NOT_FOUND_IN_REPO` | N/A |

## 10. Role to Business Process Mapping

| Role | Business Process | Responsibility | Status |
|---|---|---|---|
| Guest / Visitor | Customer Browsing Process | Xem homepage, products, categories, brands, content, search. | `CONFIRMED_FROM_CODE` |
| Guest / Visitor | Cart / Checkout Process | Thêm cart, checkout guest, quick-buy. | `CONFIRMED_FROM_CODE` |
| Customer | Customer Account Process | Register/login/logout/profile/address. | `CONFIRMED_FROM_CODE` |
| Customer | Order Tracking / Return Process | Xem đơn hàng, tạo/xem return. | `CONFIRMED_FROM_CODE` |
| Admin | Product Management Process | Quản lý sản phẩm/category/brand/publish. | `CONFIRMED_FROM_CODE` |
| Admin | Order Management Process | Xử lý order/payment/refund/note. | `CONFIRMED_FROM_CODE` |
| Admin | Settings / Configuration Process | Quản lý settings/menu/shipping/config modules. | `CONFIRMED_FROM_CODE` |
| Super Admin | Admin User / Role / Permission Process | Quản trị users/roles/permissions toàn hệ thống. | `CONFIRMED_FROM_CODE` |
| Shop Manager | Order/Product/Customer Process | Vận hành bán hàng/shop. | `CONFIRMED_FROM_CODE`; UI `NEEDS_VERIFICATION` |
| Editor | Content / SEO Management Process | Quản lý content/media/menu/slider và SEO redirects. | `CONFIRMED_FROM_CODE`; UI `NEEDS_VERIFICATION` |
| System | Checkout / Inventory / Order / Return | Enforce validation, create records, stock movement, notifications, audits. | `CONFIRMED_FROM_CODE` |
| Email Service | Notification Process | Gửi email. | `CONFIRMED_FROM_CODE`; runtime `NEEDS_VERIFICATION` |
| Media Storage / MinIO | Media Management Process | Store media objects. | `CONFIRMED_FROM_CODE` |
| Payment Provider | Payment Handling Process | Would update payment status automatically. | `NOT_FOUND_IN_REPO` |
| Shipping Provider | Shipping/Fulfillment Process | Would create tracking/waybill/status updates. | `NOT_FOUND_IN_REPO` |

## 11. Role to Workflow Mapping

| Role | Workflow | Role In Workflow | Status |
|---|---|---|---|
| Guest / Visitor | Browse → Product Detail → Cart → Checkout | Browse and place order without account. | `CONFIRMED_FROM_CODE` |
| Customer | Login → Account → Checkout → Orders → Returns | Manage own account/orders/returns. | `CONFIRMED_FROM_CODE` |
| Admin | Product Publish Workflow | Create/edit/publish/soft-delete product. | `CONFIRMED_FROM_CODE` |
| Admin / Shop Manager | Order Fulfillment Workflow | Review order, update status/payment, notes/refund. | `CONFIRMED_FROM_CODE` |
| Admin / Shop Manager | Customer Management Workflow | View/update customer records. | `CONFIRMED_FROM_CODE`; exact UI behavior `NEEDS_VERIFICATION` |
| Editor | Content Publishing Workflow | Create/update content/media. | `CONFIRMED_FROM_CODE`; UI `NEEDS_VERIFICATION` |
| Editor | Redirect / SEO Workflow | Manage content/redirects. | `CONFIRMED_FROM_CODE`; SEO coverage `NEEDS_VERIFICATION` |
| System | Checkout Workflow | Validate availability/price, create order/payment/shipping, notify. (No quantity decrement — V261.) | `CONFIRMED_FROM_CODE` |
| System | Order Status Workflow | Validate transitions, audit, notify, websocket. | `CONFIRMED_FROM_CODE` |
| System | Return Workflow | Validate return transitions, notify. (No stock restore — boolean availability, V261.) | `CONFIRMED_FROM_CODE` |
| Email Service | Notification Workflow | Deliver outbound email. | `CONFIRMED_FROM_CODE`; runtime `NEEDS_VERIFICATION` |
| Payment Provider | Payment Update Workflow | Would update payment automatically. | `NOT_FOUND_IN_REPO` |
| Shipping Provider | Fulfillment Tracking Workflow | Would update shipping/tracking automatically. | `NOT_FOUND_IN_REPO` |

## 12. RBAC / Permission Notes

Repo có RBAC/permission model ở backend.

Confirmed evidence:

- `/api/v1/admin/**` requires an authenticated non-customer principal in `SecurityConfig` (`isAuthenticated() and !hasRole('CUSTOMER')`).
- Customer protected endpoints require `ROLE_CUSTOMER` in `SecurityConfig`.
- Admin auth is a real JWT flow: `POST /api/v1/auth/login` (`AdminAuthService`) verifies password + `ACTIVE` status and issues a signed JWT (`JwtService`); `JwtAuthFilter` sets the `AdminPrincipal`; controllers call `DevAdminAuthService.requirePermission(...)` which resolves the principal's permissions from the DB.
- `AdminRolePermissions.MAP` defines built-in role-to-permission mapping.
- `AdminRolePermissions.MAP` defines built-in role-to-permission mapping.
- `SUPER_ADMIN` has wildcard `*`.
- Admin user management validates built-in/custom roles and writes audit logs.
- Role management (`AdminRoleService`) supports listing roles, editing role permissions, creating custom roles and deleting custom roles.
- **Role governance** (enforced, not just inferred): the **4 built-in roles** (`SUPER_ADMIN`, `ADMIN`, `SHOP_MANAGER`, `EDITOR`) are **system roles** (`is_system = TRUE`) and **cannot be deleted**. `V49__create_roles_permissions_tables.sql` originally seeded 7; `V200__reduce_default_roles.sql` removed the WordPress-legacy content roles (`AUTHOR`, `CONTRIBUTOR`, `SEO_EDITOR`) and folded their SEO redirect permissions into `EDITOR`. `SUPER_ADMIN` permissions are **immutable** (`*`); the other 3 system roles can have their permission set **edited** but not deleted. Only **custom roles** can be deleted — and only when no admin user is still assigned. `CUSTOMER` is a **storefront auth role** (`ROLE_CUSTOMER`), not a row in `admin_roles`. Full detail: `PERMISSION_MATRIX.md` → Role Governance.

Important distinction:

- `USER_ROLES.md` describes who the roles are and what they do at business level.
- `PERMISSION_MATRIX.md` should list exact permission strings, route mappings and API/action-level access.

Production auth status:

- Production admin auth **is implemented** via JWT (`AuthController` + `AdminAuthService` + `JwtService` + `JwtAuthFilter`). `JwtService` **fails fast on startup** under a `prod`/`production` profile if `BIGBIKE_JWT_SECRET` is missing/weak (still the `dev-` default or < 32 chars).
- `DevAdminAuthService` retains a legacy `X-Admin-Role` header bypass for dev/test only: it is **off by default** (`bigbike.auth.dev-header-enabled=false`) and `currentAdminUser` throws `AuthNotImplementedException` under an explicit production profile. Deployment must keep this flag false and run with the `prod` profile.

## 13. Missing / Not Confirmed Roles

| Role / Actor | Status | Reason / Gap |
|---|---|---|
| Staff as exact technical role | `NOT_FOUND_IN_REPO` | No `STAFF` role in `AdminRolePermissions.MAP`; business staff should map to built-in/custom roles. |
| Support Agent | `NEEDS_VERIFICATION` | Customer/order support may be needed, but no explicit `SUPPORT` role found. |
| Warehouse / Inventory Staff | `NEEDS_VERIFICATION` | Inventory module exists, but no explicit warehouse role found. |
| Payment Provider | `NOT_FOUND_IN_REPO` | No payment webhook/provider integration found. |
| Shipping Provider | `NOT_FOUND_IN_REPO` | No carrier-specific integration found. |
| Backup / Ops Admin | `NOT_FOUND_IN_REPO` | No backup/restore operations role found. |
| Marketing Manager | `NEEDS_VERIFICATION` | Content/SEO exist, but no explicit marketing role found. |
| SEO Editor (removed) | `CONFIRMED_FROM_CODE` | Built-in role removed by `V200__reduce_default_roles.sql`; SEO redirect permissions folded into `EDITOR`. Re-create as a custom role if a dedicated SEO-only operator is needed. |
| Custom Role | `CONFIRMED_FROM_CODE` | `AdminRoleService` supports create/edit/delete of custom roles (`is_system = FALSE`); deletion blocked while any admin user is still assigned. Governance enforced and documented in `PERMISSION_MATRIX.md` → Role Governance. |
| System Job / Scheduled Task | `NEEDS_VERIFICATION` | System actor exists through services; scheduled/background jobs not fully audited here. |

## 14. Evidence Summary

| Role / Actor | Evidence Path | What It Proves | Confidence |
|---|---|---|---|
| Guest / Visitor | `SecurityConfig`, `CatalogController`, `CartController`, `CheckoutController`, `bigbike-web/app/page.tsx` | Public access to browsing/search/cart/checkout/order lookup. | High |
| Customer | `CustomerAuthController`, `CustomerOrderController`, `CustomerAddressController`, `SecurityConfig`, `PHASE_1D_CUSTOMER_AUTH_REPORT.md` | Customer auth/account/order/return capabilities and `ROLE_CUSTOMER` protection. | High |
| Admin | `AdminRolePermissions.java`, `SecurityConfig`, `DevAdminAuthService.java`, admin controllers | Admin role/permission mapping and admin API protection. | High |
| Super Admin | `AdminRolePermissions.java`, `AdminAdminUsersService.java`, `AdminRolesController.java` | Wildcard permission and Super Admin guardrails. | High |
| Shop Manager | `AdminRolePermissions.java` | Built-in role and default permission set. | High for role existence; UI Medium |
| Editor | `AdminRolePermissions.java`, `V200__reduce_default_roles.sql` | Built-in content/media/menu/slider/redirect role. | High for role existence; UI Medium |
| Staff | `AdminRolePermissions.java`, admin docs | No exact staff role; business umbrella inferred. | Medium-Low |
| System | `CheckoutService`, `AdminOrderService`, `AdminReturnService`, `AdminOrderWsService` | Internal business automation/side effects. | High |
| Email Service | `OrderNotificationService`, `bigbike-backend/pom.xml`, `docker-compose.yaml` | Notification code paths and mail dependency/config. | Medium-High |
| Media Storage / MinIO | `AdminMediaController`, `MinioConfig`, `MinioProperties`, `docker-compose.yaml` | Media upload/storage integration. | High |
| Payment Provider | Audited payment/order/checkout evidence | No external payment webhook/provider found. | High for not found in audited scope |
| Shipping Provider | `AdminShippingController`, shipping/checkout evidence | Internal shipping config found; no carrier provider found. | High for not found in audited scope |
| Analytics / Observability | `bigbike-web/package.json`, `bigbike-web/app/page.tsx`, `docker-compose.yaml` | Analytics/Sentry/GTM-like references inferred. | Medium |
| Module context | `docs/business/MODULE_CATALOG.md` | Existing module map used to relate roles to modules. | High |
| Process context | `docs/business/BUSINESS_PROCESS.md` | Existing process map used to relate roles to business processes. | High |
| Project context | `docs/business/PROJECT_OVERVIEW.md` | Existing project actor/component context. | High |

## 15. Known Ambiguities / Needs Verification

1. `Staff` is a business-friendly umbrella role, but no exact `STAFF` technical role was found. Use built-in roles or custom roles instead.
2. Production admin authentication **is implemented** (JWT login via `AuthController`/`AdminAuthService`/`JwtService`/`JwtAuthFilter`, with startup fail-fast on a weak `BIGBIKE_JWT_SECRET` under the prod profile). Remaining verification is operational: login brute-force/lockout and refresh-token revocation depth.
3. Admin UI route guards and action-level disabled/hidden behavior need a dedicated UI audit. Backend permission enforcement is clearer than UI behavior.
4. `SHOP_MANAGER` and `EDITOR` are confirmed in permission map, but business naming/Vietnamese labels and user-facing admin UI need verification. (`AUTHOR`, `CONTRIBUTOR`, `SEO_EDITOR` removed in `V200__reduce_default_roles.sql`.)
5. `SUPER_ADMIN` guardrails exist in admin user service, but UI confirmation/destructive-action safeguards need verification.
6. Custom role creation/edit/delete exists; role governance (system roles non-deletable, `SUPER_ADMIN` immutable, custom-only deletion) is now documented in `PERMISSION_MATRIX.md` → Role Governance and section 12 above.
7. Customer role is confirmed, including returns creation/list/detail, but return eligibility rules need deeper audit in `CustomerReturnService`.
8. Payment provider actor is not confirmed. Current payment flow appears internal/manual COD/BACS.
9. Shipping provider actor is not confirmed. Current shipping flow appears internal zones/methods/cost only.
10. Email service code paths exist, but production SMTP deliverability was not runtime-tested.
11. Media storage/MinIO exists, but CDN/public media delivery runtime behavior needs deployment verification.
12. Analytics/observability service is inferred from package/config references; exact production tracking actor needs verification.
13. Build/test/runtime were not run during this documentation task. Do not treat this file as green-build evidence.

## 16. Relationship With Other Docs

| Document | Relationship |
|---|---|
| `PROJECT_OVERVIEW.md` | Tổng quan dự án: BigBike là gì, gồm app/layer/actor chính nào. |
| `BUSINESS_PROCESS.md` | Quy trình nghiệp vụ: role tham gia vào process nào. |
| `MODULE_CATALOG.md` | Danh sách module/feature: role được map tới module nào. |
| `USER_ROLES.md` | File hiện tại: ai dùng hệ thống và vai trò nghiệp vụ là gì. |
| `WORKFLOW_OVERVIEW.md` | Nên mô tả workflow end-to-end xuyên role/module/API/service. |
| `BUSINESS_RULES.md` | Nên định nghĩa luật nghiệp vụ theo role/process/module. |
| `PERMISSION_MATRIX.md` | Nên chi tiết hóa role -> permission -> route/action/API. |
| `ACCEPTANCE_CRITERIA.md` | Nên định nghĩa tiêu chí hoàn thành theo role/module/feature. |
| `TRACEABILITY_MATRIX.md` | Nên nối role/module/feature/workflow/API/permission/test. |

## Audit Notes

Documentation này được tạo bằng thao tác đọc/inspect repository qua GitHub connector. Không chạy migration, seed, deploy, refactor hoặc command có side effect. Không sửa business logic hoặc source code ứng dụng.
