# BigBike Permission Matrix

## 1. Document Purpose

File này mô tả role / permission / action / API matrix của hệ thống BigBike dựa trực tiếp trên source code đang có trong repo.

Đối tượng đọc:

- PM, BA, tester, developer.
- AI agent cần ngữ cảnh để không tự bịa role/permission.

Mục tiêu sử dụng:

- Đảm bảo đúng role được gán đúng quyền và đúng API/route.
- Tránh tình trạng "frontend giấu nút nhưng backend không enforce".
- Tránh đặt câu hỏi vào những role không tồn tại trong code.

Giới hạn:

- Không phải tài liệu test plan; phần Negative Test ở Section 10 chỉ liệt kê yêu cầu test cần có.
- Không phải nguồn business workflow chi tiết — xem `BUSINESS_RULES.md`, `STATE_MACHINES.md`.
- Không chứa secret/token/password/private key/env value nhạy cảm.
- Không khẳng định production auth đã ready: `DevAdminAuthService` còn dev/mock bypass; xem Section 9.

Backend là nguồn enforcement duy nhất. Frontend chỉ làm UX (ẩn/disable) và không thay thế backend check.

## 2. Permission Status Labels

| Label | Meaning |
|---|---|
| `CONFIRMED_BACKEND_ENFORCED` | Có evidence backend gọi `requirePermission(...)` hoặc `SecurityConfig` chặn role/path. |
| `CONFIRMED_FRONTEND_GUARD` | Frontend có route guard hoặc UI gate dùng permission. |
| `BACKEND_ONLY` | Backend enforce nhưng frontend không có UI/guard tương ứng. |
| `FRONTEND_ONLY` | Frontend có guard nhưng backend không enforce — high risk. |
| `DOCUMENTED_NOT_FOUND` | Có trong `USER_ROLES.md` hoặc business docs nhưng không thấy trong code. |
| `NEEDS_VERIFICATION` | Cần kiểm tra thêm bằng test runtime hoặc code review sâu hơn. |
| `NOT_FOUND_IN_REPO` | Không thấy bất kỳ evidence nào trong repo. |
| `HIGH_RISK` | Bảo vệ chỉ dựa trên frontend / hoặc backend chưa thực sự gắn kiểm tra cho action nhạy cảm. |

## 3. Role Summary

| Role | Type | Permissions Source | Status | Evidence |
|---|---|---|---|---|
| Guest / Visitor | Public actor | `SecurityConfig` permitAll cho public GET / cart / checkout / contact / order lookup; không có quyền `/api/v1/admin/**` hoặc `/api/v1/customer/**` protected. | `CONFIRMED_BACKEND_ENFORCED` | `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/config/SecurityConfig.java:53-100`, `bigbike-web/app/page.tsx` |
| Customer | Authenticated public user | `SecurityConfig` requires `ROLE_CUSTOMER` for `/api/v1/customer/orders/**`, `/api/v1/customer/me`, `/api/v1/customer/addresses/**`. Controllers chỉ truy cập theo `CustomerPrincipal.customerId`. | `CONFIRMED_BACKEND_ENFORCED` + `CONFIRMED_FRONTEND_GUARD` | `SecurityConfig.java:110-115`, `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/customer/CustomerController.java:31-50`, `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/customer/CustomerAddressController.java`, `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/order/CustomerOrderController.java`, `bigbike-web/components/layout/AccountShell.tsx:50-65` |
| Super Admin | Internal admin | `AdminRolePermissions.MAP["SUPER_ADMIN"] = ["*"]`. Wildcard match in `DevAdminAuthService.requirePermission`. Có guardrail self-demotion / last super admin trong `AdminAdminUsersService`. Permission của `SUPER_ADMIN` không sửa được qua `AdminRoleService.updateRolePermissions`. | `CONFIRMED_BACKEND_ENFORCED` | `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/auth/AdminRolePermissions.java:15-16`, `DevAdminAuthService.java:61-86`, `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminAdminUsersService.java:149-168`, `AdminRoleService.java:55-57` |
| Admin | Internal admin | Built-in role với danh sách permission rộng (products, catalog, content, orders, customers, media, settings, menus, sliders, coupons, shipping, reviews, admin-users, audit-logs, home_videos, redirects). | `CONFIRMED_BACKEND_ENFORCED` | `AdminRolePermissions.java:17-34` |
| Shop Manager | Internal admin | Built-in role với products.read/update, catalog.read, orders.read/write, customers.read/write, coupons.read/write, shipping.read, reviews.read/write. | `CONFIRMED_BACKEND_ENFORCED` for permission map; UI specifics `NEEDS_VERIFICATION` | `AdminRolePermissions.java:35-43` |
| Editor | Internal admin | Built-in role với products.read, catalog.read, content.read/update, media.read/write, menus.read/write, sliders.read/write. | `CONFIRMED_BACKEND_ENFORCED` for permission map; UI specifics `NEEDS_VERIFICATION` | `AdminRolePermissions.java:44-50` |
| Author | Internal admin | Built-in role với content.read/update, media.read/write. | `CONFIRMED_BACKEND_ENFORCED` for permission map; UI specifics `NEEDS_VERIFICATION` | `AdminRolePermissions.java:51-54` |
| Contributor | Internal admin | Built-in role với content.read, media.read. | `CONFIRMED_BACKEND_ENFORCED` for permission map; UI specifics `NEEDS_VERIFICATION` | `AdminRolePermissions.java:55-57` |
| SEO Editor | Internal admin | Built-in role với content.read/update, redirects.read/write. | `CONFIRMED_BACKEND_ENFORCED` for permission map; UI specifics `NEEDS_VERIFICATION` | `AdminRolePermissions.java:58-61` |
| Custom Role | Internal admin | `AdminRoleService` cho phép create/delete custom role và update permissions (trừ SUPER_ADMIN). Custom role được persist trong `admin_roles` (xem `AdminRoleJpaRepository`). `AdminAdminUsersService` cho phép gán role cho admin user nếu role là built-in hoặc tồn tại trong repo. | `CONFIRMED_BACKEND_ENFORCED` | `AdminRoleService.java:50-114`, `AdminAdminUsersService.java:211-213` |
| Staff | Business umbrella | Không có role exact `STAFF` trong `AdminRolePermissions.MAP`. Business gọi "staff" thường map sang `SHOP_MANAGER`, `EDITOR`, `AUTHOR`, `CONTRIBUTOR`, `SEO_EDITOR` hoặc custom role. | `DOCUMENTED_NOT_FOUND` (theo nghĩa "STAFF" không tồn tại như technical role) | `docs/business/USER_ROLES.md:51`, `AdminRolePermissions.java:15-62` |
| System | Backend service actor | Backend service tự thực hiện validate / decrement-stock / audit / notification — không qua HTTP role check. | `CONFIRMED_BACKEND_ENFORCED` (no HTTP entrypoint) | `docs/business/USER_ROLES.md:267-289` (USER_ROLES references services) |

## 4. Permission Registry

Tất cả permission string được lấy từ `AdminRolePermissions.MAP` và `requirePermission(...)` trong các admin controllers.

| Permission | Purpose | Used In Controllers (backend) | Used In Frontend (admin SPA) | Status | Evidence |
|---|---|---|---|---|---|
| `*` | Wildcard cho `SUPER_ADMIN`. `DevAdminAuthService.requirePermission` cấp tất cả nếu permissions chứa `*`. | (n/a — wildcard) | `bigbike-admin/src/App.jsx:248` (`hasPermission` accepts `*`) | `CONFIRMED_BACKEND_ENFORCED` + `CONFIRMED_FRONTEND_GUARD` | `AdminRolePermissions.java:16`, `DevAdminAuthService.java:69, 81`, `bigbike-admin/src/App.jsx:248` |
| `products.read` | List / view product, dashboard, inventory list/summary/movements/export, reports/products/export. | `AdminCatalogController` (products GET), `AdminInventoryController`, `AdminReportController` (products export) | `/admin/products`, `/admin/inventory`, `/admin/dashboard` (đi cùng `orders.read`), `/admin/reports` (đi cùng) | `CONFIRMED_BACKEND_ENFORCED` + `CONFIRMED_FRONTEND_GUARD` | `AdminCatalogController.java:75,98`, `AdminInventoryController.java:51-86`, `AdminReportController.java:75`, `bigbike-admin/src/App.jsx:70-71, 200` |
| `products.update` | Create / patch / publish / soft-delete product, inventory adjust. | `AdminCatalogController` (products POST/PATCH/DELETE), `AdminInventoryController` (variants/adjust) | `/admin/products/new`, `/admin/products/{id}` (`canUpdate`), `/admin/inventory` (`canUpdate`) | `CONFIRMED_BACKEND_ENFORCED` + `CONFIRMED_FRONTEND_GUARD` | `AdminCatalogController.java:107,117,127,144`, `AdminInventoryController.java:96`, `bigbike-admin/src/App.jsx:174,381` |
| `catalog.read` | List / view category, brand. | `AdminCatalogController` (categories/brands GET) | `/admin/categories`, `/admin/brands` | `CONFIRMED_BACKEND_ENFORCED` + `CONFIRMED_FRONTEND_GUARD` | `AdminCatalogController.java:159,179,227,247`, `bigbike-admin/src/App.jsx:72-73, 178-180` |
| `catalog.update` | Create / patch / delete category, brand. | `AdminCatalogController` (categories/brands POST/PATCH/DELETE) | `/admin/categories/new`, `/admin/categories/{id}`, `/admin/brands/new`, `/admin/brands/{id}` (`canUpdate`) | `CONFIRMED_BACKEND_ENFORCED` + `CONFIRMED_FRONTEND_GUARD` | `AdminCatalogController.java:188,198,212,256,266,275`, `bigbike-admin/src/App.jsx:175-176` |
| `content.read` | List / view article / page. | `AdminContentController` GET | `/admin/content` | `CONFIRMED_BACKEND_ENFORCED` + `CONFIRMED_FRONTEND_GUARD` | `AdminContentController.java:68,90`, `bigbike-admin/src/App.jsx:80, 183` |
| `content.update` | Create / patch / delete article hoặc page. | `AdminContentController` POST/PATCH/DELETE | `/admin/content/{type}/new`, `/admin/content/{type}/{id}` (`canUpdate`) | `CONFIRMED_BACKEND_ENFORCED` + `CONFIRMED_FRONTEND_GUARD` | `AdminContentController.java:99,109,118,128,138`, `bigbike-admin/src/App.jsx:181, 343-347` |
| `orders.read` | List / view orders, dashboard, reports/analytics, reports/orders/export, allowed-transitions, order notes (GET), returns list/detail. | `AdminOrderController` GET, `AdminDashboardController`, `AdminReportController` (analytics, orders export), `AdminReturnController` GET | `/admin/dashboard`, `/admin/orders`, `/admin/returns`, `/admin/reports` | `CONFIRMED_BACKEND_ENFORCED` + `CONFIRMED_FRONTEND_GUARD` | `AdminOrderController.java:67,79,88,153`, `AdminDashboardController.java:37`, `AdminReportController.java:43,55`, `AdminReturnController.java:48,57`, `bigbike-admin/src/App.jsx:57-61, 92, 199, 201` |
| `orders.write` | Update order status / payment-status / refund / add note; POS create order; POS product search; return status update. | `AdminOrderController` PATCH/POST, `AdminPosController` GET/POST, `AdminReturnController` PATCH | `/admin/pos`, `/admin/orders/{id}` (`canUpdate`), `/admin/returns` (`canUpdate`) | `CONFIRMED_BACKEND_ENFORCED` + `CONFIRMED_FRONTEND_GUARD` | `AdminOrderController.java:98,112,126,140`, `AdminPosController.java:49,62`, `AdminReturnController.java:67`, `bigbike-admin/src/App.jsx:59, 203, 351, 383, 387` |
| `customers.read` | List / view customer; reports/customers/export. | `AdminCustomerController` GET, `AdminReportController` (customers export) | `/admin/customers` | `CONFIRMED_BACKEND_ENFORCED` + `CONFIRMED_FRONTEND_GUARD` | `AdminCustomerController.java:59,69`, `AdminReportController.java:65`, `bigbike-admin/src/App.jsx:60, 187` |
| `customers.write` | Update customer / customer status. | `AdminCustomerController` PATCH | `/admin/customers/{id}` (`canUpdate`) | `CONFIRMED_BACKEND_ENFORCED` + `CONFIRMED_FRONTEND_GUARD` | `AdminCustomerController.java:79,90`, `bigbike-admin/src/App.jsx:355` |
| `media.read` | List / view media. | `AdminMediaController` GET | `/admin/media` | `CONFIRMED_BACKEND_ENFORCED` + `CONFIRMED_FRONTEND_GUARD` | `AdminMediaController.java:77,87`, `bigbike-admin/src/App.jsx:85, 188` |
| `media.write` | Upload / patch / delete / restore media. | `AdminMediaController` POST/PATCH/DELETE | `/admin/media` (`canUpdate`) | `CONFIRMED_BACKEND_ENFORCED` + `CONFIRMED_FRONTEND_GUARD` | `AdminMediaController.java:62,97,109,122`, `bigbike-admin/src/App.jsx:357` |
| `settings.read` | List / get setting. | `AdminSettingsController` GET | `/admin/settings` | `CONFIRMED_BACKEND_ENFORCED` + `CONFIRMED_FRONTEND_GUARD` | `AdminSettingsController.java:56,66`, `bigbike-admin/src/App.jsx:100, 197` |
| `settings.write` | Update setting. | `AdminSettingsController` PATCH | `/admin/settings` (`canUpdate`) | `CONFIRMED_BACKEND_ENFORCED` + `CONFIRMED_FRONTEND_GUARD` | `AdminSettingsController.java:76`, `bigbike-admin/src/App.jsx:375` |
| `menus.read` | List / view menu. | `AdminMenuController` GET | `/admin/menus` | `CONFIRMED_BACKEND_ENFORCED` + `CONFIRMED_FRONTEND_GUARD` | `AdminMenuController.java:67,76`, `bigbike-admin/src/App.jsx:84, 190` |
| `menus.write` | Create / patch / delete menu, menu item, reorder. | `AdminMenuController` POST/PATCH/DELETE | `/admin/menus` (`canUpdate`) | `CONFIRMED_BACKEND_ENFORCED` + `CONFIRMED_FRONTEND_GUARD` | `AdminMenuController.java:85,95,105,117,129,141,151`, `bigbike-admin/src/App.jsx:361` |
| `sliders.read` | List slider. | `AdminSliderController` GET | `/admin/sliders` | `CONFIRMED_BACKEND_ENFORCED` + `CONFIRMED_FRONTEND_GUARD` | `AdminSliderController.java:54`, `bigbike-admin/src/App.jsx:81, 191` |
| `sliders.write` | Create / patch / delete / reorder slider. | `AdminSliderController` POST/PATCH/DELETE | `/admin/sliders` (`canUpdate`) | `CONFIRMED_BACKEND_ENFORCED` + `CONFIRMED_FRONTEND_GUARD` | `AdminSliderController.java:64,74,85,96`, `bigbike-admin/src/App.jsx:363` |
| `home_videos.read` | List home video. | `AdminHomeVideoController` GET | `/admin/home-videos` | `CONFIRMED_BACKEND_ENFORCED` + `CONFIRMED_FRONTEND_GUARD` | `AdminHomeVideoController.java:47`, `bigbike-admin/src/App.jsx:82, 192` |
| `home_videos.write` | Create / patch / delete / reorder home video. | `AdminHomeVideoController` POST/PATCH/DELETE | `/admin/home-videos` (`canUpdate`) | `CONFIRMED_BACKEND_ENFORCED` + `CONFIRMED_FRONTEND_GUARD` | `AdminHomeVideoController.java:57,67,76,86`, `bigbike-admin/src/App.jsx:365` |
| `coupons.read` | List / view coupon. | `AdminCouponController` GET | `/admin/coupons` | `CONFIRMED_BACKEND_ENFORCED` + `CONFIRMED_FRONTEND_GUARD` | `AdminCouponController.java:63,73`, `bigbike-admin/src/App.jsx:63, 189` |
| `coupons.write` | Create / patch / status update coupon. | `AdminCouponController` POST/PATCH | `/admin/coupons` (`canUpdate`) | `CONFIRMED_BACKEND_ENFORCED` + `CONFIRMED_FRONTEND_GUARD` | `AdminCouponController.java:82,92,103`, `bigbike-admin/src/App.jsx:359` |
| `shipping.read` | List shipping zone / method (GET). | `AdminShippingController` GET | `/admin/shipping` | `CONFIRMED_BACKEND_ENFORCED` + `CONFIRMED_FRONTEND_GUARD` | `AdminShippingController.java:55,64,112`, `bigbike-admin/src/App.jsx:99, 194` |
| `shipping.write` | Create / patch / delete shipping zone & method. | `AdminShippingController` POST/PATCH/DELETE | `/admin/shipping` (`canUpdate`) | `CONFIRMED_BACKEND_ENFORCED` + `CONFIRMED_FRONTEND_GUARD` | `AdminShippingController.java:73,87,101,122,141,160`, `bigbike-admin/src/App.jsx:369` |
| `reviews.read` | List / view product review. | `AdminReviewController` GET | `/admin/reviews` | `CONFIRMED_BACKEND_ENFORCED` + `CONFIRMED_FRONTEND_GUARD` | `AdminReviewController.java:51,60`, `bigbike-admin/src/App.jsx:62, 195` |
| `reviews.write` | Update review status / delete review. | `AdminReviewController` PATCH/DELETE | `/admin/reviews` (`canUpdate`) | `CONFIRMED_BACKEND_ENFORCED` + `CONFIRMED_FRONTEND_GUARD` | `AdminReviewController.java:70,80`, `bigbike-admin/src/App.jsx:371` |
| `admin-users.read` | List / view admin user; list roles. | `AdminAdminUsersController` GET, `AdminRolesController` GET | `/admin/admin-users`, `/admin/roles` | `CONFIRMED_BACKEND_ENFORCED` + `CONFIRMED_FRONTEND_GUARD` | `AdminAdminUsersController.java:58,67`, `AdminRolesController.java:48`, `bigbike-admin/src/App.jsx:101-102, 196, 202` |
| `admin-users.write` | Create / patch admin user; update / create / delete role. | `AdminAdminUsersController` POST/PATCH, `AdminRolesController` PUT/POST/DELETE | `/admin/admin-users` (`canUpdate`), `/admin/roles` (`canUpdate`) | `CONFIRMED_BACKEND_ENFORCED` + `CONFIRMED_FRONTEND_GUARD` | `AdminAdminUsersController.java:77,96`, `AdminRolesController.java:59,78,100`, `bigbike-admin/src/App.jsx:373, 385` |
| `audit-logs.read` | List audit log. | `AdminAuditLogController` GET | `/admin/audit-logs` | `CONFIRMED_BACKEND_ENFORCED` + `CONFIRMED_FRONTEND_GUARD` | `AdminAuditLogController.java:50`, `bigbike-admin/src/App.jsx:103, 198` |
| `redirects.read` | List / view redirect rule. | `AdminRedirectController` GET | `/admin/redirects` | `CONFIRMED_BACKEND_ENFORCED` + `CONFIRMED_FRONTEND_GUARD` | `AdminRedirectController.java:83,95`, `bigbike-admin/src/App.jsx:83, 193` |
| `redirects.write` | Create / patch / delete redirect rule. | `AdminRedirectController` POST/PATCH/DELETE | `/admin/redirects` (`canUpdate`) | `CONFIRMED_BACKEND_ENFORCED` + `CONFIRMED_FRONTEND_GUARD` | `AdminRedirectController.java:104,125,146`, `bigbike-admin/src/App.jsx:367` |

## 5. Role → Permission Matrix

Lấy từ `AdminRolePermissions.MAP` (`bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/auth/AdminRolePermissions.java:15-62`).

| Role | Permissions | Status | Evidence |
|---|---|---|---|
| `SUPER_ADMIN` | `*` (wildcard — ngụ ý tất cả permission đã đăng ký, kể cả permission tương lai) | `CONFIRMED_BACKEND_ENFORCED` | `AdminRolePermissions.java:16` |
| `ADMIN` | `products.read`, `products.update`, `catalog.read`, `catalog.update`, `content.read`, `content.update`, `orders.read`, `orders.write`, `customers.read`, `customers.write`, `media.read`, `media.write`, `settings.read`, `settings.write`, `menus.read`, `menus.write`, `sliders.read`, `sliders.write`, `coupons.read`, `coupons.write`, `shipping.read`, `shipping.write`, `reviews.read`, `reviews.write`, `admin-users.read`, `admin-users.write`, `audit-logs.read`, `home_videos.read`, `home_videos.write`, `redirects.read`, `redirects.write` | `CONFIRMED_BACKEND_ENFORCED` | `AdminRolePermissions.java:17-34` |
| `SHOP_MANAGER` | `products.read`, `products.update`, `catalog.read`, `orders.read`, `orders.write`, `customers.read`, `customers.write`, `coupons.read`, `coupons.write`, `shipping.read`, `reviews.read`, `reviews.write` | `CONFIRMED_BACKEND_ENFORCED` | `AdminRolePermissions.java:35-43` |
| `EDITOR` | `products.read`, `catalog.read`, `content.read`, `content.update`, `media.read`, `media.write`, `menus.read`, `menus.write`, `sliders.read`, `sliders.write` | `CONFIRMED_BACKEND_ENFORCED` | `AdminRolePermissions.java:44-50` |
| `AUTHOR` | `content.read`, `content.update`, `media.read`, `media.write` | `CONFIRMED_BACKEND_ENFORCED` | `AdminRolePermissions.java:51-54` |
| `CONTRIBUTOR` | `content.read`, `media.read` | `CONFIRMED_BACKEND_ENFORCED` | `AdminRolePermissions.java:55-57` |
| `SEO_EDITOR` | `content.read`, `content.update`, `redirects.read`, `redirects.write` | `CONFIRMED_BACKEND_ENFORCED` | `AdminRolePermissions.java:58-61` |
| `<custom>` | Permissions theo `AdminRoleEntity.permissions` (set linked-hash). Custom role được persist trong DB qua `AdminRoleService.createRole`. Built-in `SUPER_ADMIN` không cho phép update permission. | `CONFIRMED_BACKEND_ENFORCED`; default permission resolution `NEEDS_VERIFICATION` (xem Section 9) | `AdminRoleService.java:50-114` |

## 6. Route / Screen Permission Matrix

### 6.1 Admin SPA routes (bigbike-admin)

Frontend guard logic: `bigbike-admin/src/App.jsx` parse pathname, lookup `routePermission(name)` rồi check qua `hasPermission`.

| App | Route / Screen | Required Role / Permission | Frontend Guard | Backend Enforcement | Status | Evidence |
|---|---|---|---|---|---|---|
| Admin SPA | `/admin/dashboard` | `orders.read` | Yes (App.jsx routePermission `dashboard`) | `AdminDashboardController` `requirePermission("orders.read")` | `CONFIRMED_BACKEND_ENFORCED` + `CONFIRMED_FRONTEND_GUARD` | `bigbike-admin/src/App.jsx:171, 57`, `AdminDashboardController.java:37` |
| Admin SPA | `/admin/products` | `products.read` | Yes | `AdminCatalogController` GET `/products` | `CONFIRMED_BACKEND_ENFORCED` + `CONFIRMED_FRONTEND_GUARD` | `bigbike-admin/src/App.jsx:172-173`, `AdminCatalogController.java:75` |
| Admin SPA | `/admin/products/new` | `products.update` | Yes | `AdminCatalogController` POST `/products` | `CONFIRMED_BACKEND_ENFORCED` + `CONFIRMED_FRONTEND_GUARD` | `bigbike-admin/src/App.jsx:174`, `AdminCatalogController.java:107` |
| Admin SPA | `/admin/products/{id}` | `products.read` (view) / `products.update` (edit) | Yes (`canUpdate` prop) | `AdminCatalogController` GET/PATCH/PUBLISH/DELETE `/products/{id}` | `CONFIRMED_BACKEND_ENFORCED` + `CONFIRMED_FRONTEND_GUARD` | `bigbike-admin/src/App.jsx:173, 327-329`, `AdminCatalogController.java:93,117,127,144` |
| Admin SPA | `/admin/categories` | `catalog.read` | Yes | `AdminCatalogController` GET `/categories` | `CONFIRMED_BACKEND_ENFORCED` + `CONFIRMED_FRONTEND_GUARD` | `bigbike-admin/src/App.jsx:178`, `AdminCatalogController.java:159` |
| Admin SPA | `/admin/categories/new`, `/{id}` | `catalog.read` (view) / `catalog.update` (edit) | Yes | `AdminCatalogController` categories POST/PATCH/DELETE | `CONFIRMED_BACKEND_ENFORCED` + `CONFIRMED_FRONTEND_GUARD` | `bigbike-admin/src/App.jsx:175,178`, `AdminCatalogController.java:188,198,212` |
| Admin SPA | `/admin/brands`, `/{id}` | `catalog.read`/`catalog.update` | Yes | `AdminCatalogController` brands GET/POST/PATCH/DELETE | `CONFIRMED_BACKEND_ENFORCED` + `CONFIRMED_FRONTEND_GUARD` | `bigbike-admin/src/App.jsx:176,180`, `AdminCatalogController.java:227,251,260,270` |
| Admin SPA | `/admin/content` | `content.read` | Yes | `AdminContentController` GET | `CONFIRMED_BACKEND_ENFORCED` + `CONFIRMED_FRONTEND_GUARD` | `bigbike-admin/src/App.jsx:80, 183`, `AdminContentController.java:68` |
| Admin SPA | `/admin/content/{type}/new`, `/{id}` | `content.read` (view) / `content.update` (edit) | Yes | `AdminContentController` POST/PATCH/DELETE | `CONFIRMED_BACKEND_ENFORCED` + `CONFIRMED_FRONTEND_GUARD` | `bigbike-admin/src/App.jsx:181-183`, `AdminContentController.java:99,109,118,128,138` |
| Admin SPA | `/admin/orders` | `orders.read` | Yes | `AdminOrderController` GET | `CONFIRMED_BACKEND_ENFORCED` + `CONFIRMED_FRONTEND_GUARD` | `bigbike-admin/src/App.jsx:184`, `AdminOrderController.java:67` |
| Admin SPA | `/admin/orders/{id}` | `orders.read` view, `orders.write` mutate | Yes | `AdminOrderController` GET/PATCH/POST | `CONFIRMED_BACKEND_ENFORCED` + `CONFIRMED_FRONTEND_GUARD` | `bigbike-admin/src/App.jsx:184-185, 351`, `AdminOrderController.java:79,98,112,126,140` |
| Admin SPA | `/admin/pos` | `orders.write` | Yes | `AdminPosController` GET/POST | `CONFIRMED_BACKEND_ENFORCED` + `CONFIRMED_FRONTEND_GUARD` | `bigbike-admin/src/App.jsx:59, 203, 387`, `AdminPosController.java:49,62` |
| Admin SPA | `/admin/customers` | `customers.read` | Yes | `AdminCustomerController` GET | `CONFIRMED_BACKEND_ENFORCED` + `CONFIRMED_FRONTEND_GUARD` | `bigbike-admin/src/App.jsx:187`, `AdminCustomerController.java:59` |
| Admin SPA | `/admin/customers/{id}` | `customers.read` view, `customers.write` edit | Yes (`canUpdate`) | `AdminCustomerController` GET/PATCH | `CONFIRMED_BACKEND_ENFORCED` + `CONFIRMED_FRONTEND_GUARD` | `bigbike-admin/src/App.jsx:187, 355`, `AdminCustomerController.java:69,79,90` |
| Admin SPA | `/admin/returns` | `orders.read` (view), `orders.write` (status change) | Yes | `AdminReturnController` GET/PATCH | `CONFIRMED_BACKEND_ENFORCED` + `CONFIRMED_FRONTEND_GUARD` | `bigbike-admin/src/App.jsx:201, 383`, `AdminReturnController.java:48,57,67` |
| Admin SPA | `/admin/reviews` | `reviews.read` (view), `reviews.write` (mutate) | Yes | `AdminReviewController` GET/PATCH/DELETE | `CONFIRMED_BACKEND_ENFORCED` + `CONFIRMED_FRONTEND_GUARD` | `bigbike-admin/src/App.jsx:195, 371`, `AdminReviewController.java:51,60,70,80` |
| Admin SPA | `/admin/coupons` | `coupons.read` view, `coupons.write` mutate | Yes | `AdminCouponController` GET/POST/PATCH | `CONFIRMED_BACKEND_ENFORCED` + `CONFIRMED_FRONTEND_GUARD` | `bigbike-admin/src/App.jsx:189, 359`, `AdminCouponController.java:63,73,82,92,103` |
| Admin SPA | `/admin/inventory` | `products.read` view, `products.update` adjust | Yes | `AdminInventoryController` | `CONFIRMED_BACKEND_ENFORCED` + `CONFIRMED_FRONTEND_GUARD` | `bigbike-admin/src/App.jsx:200, 381`, `AdminInventoryController.java:51-96` |
| Admin SPA | `/admin/sliders` | `sliders.read` / `sliders.write` | Yes | `AdminSliderController` | `CONFIRMED_BACKEND_ENFORCED` + `CONFIRMED_FRONTEND_GUARD` | `bigbike-admin/src/App.jsx:191, 363`, `AdminSliderController.java:54-96` |
| Admin SPA | `/admin/home-videos` | `home_videos.read` / `home_videos.write` | Yes | `AdminHomeVideoController` | `CONFIRMED_BACKEND_ENFORCED` + `CONFIRMED_FRONTEND_GUARD` | `bigbike-admin/src/App.jsx:192, 365`, `AdminHomeVideoController.java:47-86` |
| Admin SPA | `/admin/redirects` | `redirects.read` / `redirects.write` | Yes | `AdminRedirectController` | `CONFIRMED_BACKEND_ENFORCED` + `CONFIRMED_FRONTEND_GUARD` | `bigbike-admin/src/App.jsx:193, 367`, `AdminRedirectController.java:83-146` |
| Admin SPA | `/admin/menus` | `menus.read` / `menus.write` | Yes | `AdminMenuController` | `CONFIRMED_BACKEND_ENFORCED` + `CONFIRMED_FRONTEND_GUARD` | `bigbike-admin/src/App.jsx:190, 361`, `AdminMenuController.java:67-151` |
| Admin SPA | `/admin/media` | `media.read` / `media.write` | Yes | `AdminMediaController` | `CONFIRMED_BACKEND_ENFORCED` + `CONFIRMED_FRONTEND_GUARD` | `bigbike-admin/src/App.jsx:188, 357`, `AdminMediaController.java:62-122` |
| Admin SPA | `/admin/shipping` | `shipping.read` / `shipping.write` | Yes | `AdminShippingController` | `CONFIRMED_BACKEND_ENFORCED` + `CONFIRMED_FRONTEND_GUARD` | `bigbike-admin/src/App.jsx:194, 369`, `AdminShippingController.java:48-160` |
| Admin SPA | `/admin/settings` | `settings.read` / `settings.write` | Yes | `AdminSettingsController` | `CONFIRMED_BACKEND_ENFORCED` + `CONFIRMED_FRONTEND_GUARD` | `bigbike-admin/src/App.jsx:197, 375`, `AdminSettingsController.java:56-76` |
| Admin SPA | `/admin/admin-users` | `admin-users.read` / `admin-users.write` | Yes | `AdminAdminUsersController` | `CONFIRMED_BACKEND_ENFORCED` + `CONFIRMED_FRONTEND_GUARD` | `bigbike-admin/src/App.jsx:196, 373`, `AdminAdminUsersController.java:58-96` |
| Admin SPA | `/admin/roles` | `admin-users.read` (view) / `admin-users.write` (mutate) | Yes (cùng permission như admin-users) | `AdminRolesController` | `CONFIRMED_BACKEND_ENFORCED` + `CONFIRMED_FRONTEND_GUARD` | `bigbike-admin/src/App.jsx:202, 385`, `AdminRolesController.java:48,59,78,100` |
| Admin SPA | `/admin/audit-logs` | `audit-logs.read` | Yes | `AdminAuditLogController` GET | `CONFIRMED_BACKEND_ENFORCED` + `CONFIRMED_FRONTEND_GUARD` | `bigbike-admin/src/App.jsx:198`, `AdminAuditLogController.java:50` |
| Admin SPA | `/admin/reports` | `orders.read` (frontend) — backend route enforces tùy endpoint (`orders.read`, `customers.read`, `products.read`) | Yes (route guard chỉ check `orders.read`) | `AdminReportController` các endpoint check riêng (orders/customers/products) | `CONFIRMED_BACKEND_ENFORCED` + `CONFIRMED_FRONTEND_GUARD` (gate route bằng `orders.read` chứ không phải granular per export) | `bigbike-admin/src/App.jsx:199`, `AdminReportController.java:43,55,65,75` |

### 6.2 Customer / Public web routes (bigbike-web)

| App | Route / Screen | Required Role / Permission | Frontend Guard | Backend Enforcement | Status | Evidence |
|---|---|---|---|---|---|---|
| Customer web | `/dang-nhap`, `/dang-ky`, `/quen-mat-khau`, `/xac-nhan-email` | None (Guest) | Public | `SecurityConfig` permitAll for `/api/v1/customer/auth/**` | `CONFIRMED_BACKEND_ENFORCED` | `SecurityConfig.java:57-63`, `bigbike-web/app/dang-nhap/page.tsx`, `bigbike-web/app/dang-ky/page.tsx` |
| Customer web | `/tai-khoan` (overview) | `ROLE_CUSTOMER` | Yes (`AccountShell` redirect to `toLoginPath` khi `auth.status === "anonymous"`) | `SecurityConfig` requires `ROLE_CUSTOMER` for `/api/v1/customer/me` | `CONFIRMED_BACKEND_ENFORCED` + `CONFIRMED_FRONTEND_GUARD` | `bigbike-web/components/layout/AccountShell.tsx:50-54`, `SecurityConfig.java:113`, `CustomerController.java:31` |
| Customer web | `/tai-khoan/edit-account` | `ROLE_CUSTOMER` | Yes (AccountShell) | `CustomerController` PATCH `/customer/me` | `CONFIRMED_BACKEND_ENFORCED` + `CONFIRMED_FRONTEND_GUARD` | `AccountShell.tsx:50-54`, `CustomerController.java:37-41` |
| Customer web | `/tai-khoan/edit-address/{type}` | `ROLE_CUSTOMER` | Yes (AccountShell) | `SecurityConfig` requires `ROLE_CUSTOMER` for `/api/v1/customer/addresses/**` | `CONFIRMED_BACKEND_ENFORCED` + `CONFIRMED_FRONTEND_GUARD` | `AccountShell.tsx:50-54`, `SecurityConfig.java:114-115`, `CustomerAddressController.java` |
| Customer web | `/tai-khoan/don-hang`, `/tai-khoan/don-hang/{id}` | `ROLE_CUSTOMER` | Yes (AccountShell) | `SecurityConfig` requires `ROLE_CUSTOMER` for `/api/v1/customer/orders/**` + `CustomerOrderController` filters by `CustomerPrincipal.customerId` | `CONFIRMED_BACKEND_ENFORCED` + `CONFIRMED_FRONTEND_GUARD` | `SecurityConfig.java:110-111`, `CustomerOrderController.java:46-101`, `AccountShell.tsx:50-54` |
| Customer web | `/tai-khoan/doi-tra` | `ROLE_CUSTOMER` | Yes (AccountShell) | `CustomerOrderController` returns endpoints filter by `customerId` | `CONFIRMED_BACKEND_ENFORCED` + `CONFIRMED_FRONTEND_GUARD` | `CustomerOrderController.java:64-93` |
| Customer web | `/don-hang/{id}/thanh-toan`, `/don-hang/xac-nhan` | Guest hoặc Customer | Frontend không hard-redirect (đơn được lookup theo orderId / token) | Public lookup endpoints (`/api/v1/orders/lookup`) `permitAll` | `CONFIRMED_BACKEND_ENFORCED` + `NEEDS_VERIFICATION` (cần kiểm tra rằng backend lookup yêu cầu order token để tránh enumeration) | `SecurityConfig.java:85`, `bigbike-web/app/don-hang/[id]/thanh-toan/page.tsx`, `bigbike-web/app/don-hang/xac-nhan/page.tsx` |
| Customer web | `/gio-hang`, `/thanh-toan` | Guest hoặc Customer | Frontend không yêu cầu login | `SecurityConfig` permitAll for `/api/v1/cart/**`, `/api/v1/checkout`, `/api/v1/orders/quick-buy` | `CONFIRMED_BACKEND_ENFORCED` | `SecurityConfig.java:78-82`, `bigbike-web/app/gio-hang/page.tsx`, `bigbike-web/app/thanh-toan/page.tsx` |
| Public web | `/`, `/san-pham`, `/danh-muc-san-pham/...`, `/brands/...`, `/product/...`, `/tin-tuc`, `/chinh-sach/...`, `/[slug]`, `/lien-he`, `/tim-kiem` | Guest | Public | Public GET endpoints permitAll | `CONFIRMED_BACKEND_ENFORCED` | `SecurityConfig.java:65-91`, `bigbike-web/app/...` |

## 7. API Permission Matrix

Tất cả API path tham chiếu `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/...`.

### 7.1 Admin auth (`/api/v1/auth`)

| API Area | Method / Path | Action | Required Role | Required Permission | Enforcement | Status | Evidence |
|---|---|---|---|---|---|---|---|
| Admin auth | POST `/api/v1/auth/login` | Admin login | None (anonymous) | none | `SecurityConfig` permitAll | `CONFIRMED_BACKEND_ENFORCED` | `SecurityConfig.java:53`, `AuthController.java:48` |
| Admin auth | POST `/api/v1/auth/refresh` | Refresh access token | None (anonymous) | none | `SecurityConfig` permitAll | `CONFIRMED_BACKEND_ENFORCED` | `SecurityConfig.java:54`, `AuthController.java:59` |
| Admin auth | POST `/api/v1/auth/logout` | Admin logout | None (anonymous) | none | `SecurityConfig` permitAll | `CONFIRMED_BACKEND_ENFORCED` | `SecurityConfig.java:55`, `AuthController.java:75` |
| Admin auth | GET `/api/v1/auth/me` | Get current admin profile | Authenticated | none | `SecurityConfig` `.authenticated()` | `CONFIRMED_BACKEND_ENFORCED` | `SecurityConfig.java:119`, `AuthController.java:91` |

### 7.2 Customer auth (`/api/v1/customer/auth`)

| API Area | Method / Path | Action | Required Role | Required Permission | Enforcement | Status | Evidence |
|---|---|---|---|---|---|---|---|
| Customer auth | POST `/api/v1/customer/auth/register` | Register | None | none | `SecurityConfig` permitAll | `CONFIRMED_BACKEND_ENFORCED` | `SecurityConfig.java:57`, `CustomerAuthController.java:74` |
| Customer auth | POST `/api/v1/customer/auth/login` | Login | None | none | `SecurityConfig` permitAll | `CONFIRMED_BACKEND_ENFORCED` | `SecurityConfig.java:58`, `CustomerAuthController.java:85` |
| Customer auth | POST `/api/v1/customer/auth/refresh` | Refresh | None (cookie) | none | `SecurityConfig` permitAll | `CONFIRMED_BACKEND_ENFORCED` | `SecurityConfig.java:59`, `CustomerAuthController.java:114` |
| Customer auth | POST `/api/v1/customer/auth/logout` | Logout | None | none | `SecurityConfig` permitAll | `CONFIRMED_BACKEND_ENFORCED` | `SecurityConfig.java:60`, `CustomerAuthController.java:126` |
| Customer auth | POST `/api/v1/customer/auth/password/forgot` | Forgot password | None | none | `SecurityConfig` permitAll | `CONFIRMED_BACKEND_ENFORCED` | `SecurityConfig.java:61`, `CustomerAuthController.java:96` |
| Customer auth | POST `/api/v1/customer/auth/password/reset` | Reset password | None | none | `SecurityConfig` permitAll | `CONFIRMED_BACKEND_ENFORCED` | `SecurityConfig.java:62`, `CustomerAuthController.java:105` |
| Customer auth | POST `/api/v1/customer/auth/verify-email` | Verify email (token in query) | None | none | `SecurityConfig` permitAll for POST | `CONFIRMED_BACKEND_ENFORCED` (BUG-001 fixed 2026-05-05) | `SecurityConfig.java:64`, `CustomerAuthController.java:65` |
| Customer auth | GET `/api/v1/customer/auth/verify-email` | (Legacy) — kept for backward compat; controller does not implement GET | None | none | `SecurityConfig` permitAll for GET | `CONFIRMED_BACKEND_ENFORCED`; route returns 405 since controller only `@PostMapping` | `SecurityConfig.java:63`, `CustomerAuthController.java:65` |

### 7.3 Customer protected (`/api/v1/customer/...`)

| API Area | Method / Path | Action | Required Role | Required Permission | Enforcement | Status | Evidence |
|---|---|---|---|---|---|---|---|
| Customer | GET `/api/v1/customer/me` | View own profile | `ROLE_CUSTOMER` | none | `SecurityConfig` `hasRole("CUSTOMER")` + controller checks `CustomerPrincipal` | `CONFIRMED_BACKEND_ENFORCED` | `SecurityConfig.java:113`, `CustomerController.java:31-50` |
| Customer | PATCH `/api/v1/customer/me` | Update own profile | `ROLE_CUSTOMER` | none | Same as above | `CONFIRMED_BACKEND_ENFORCED` | `CustomerController.java:37-41` |
| Customer addresses | GET/POST/PATCH/DELETE `/api/v1/customer/addresses` (and `/{id}`) | Manage own addresses | `ROLE_CUSTOMER` | none | `SecurityConfig` `hasRole("CUSTOMER")` + controller filters by `customerId` | `CONFIRMED_BACKEND_ENFORCED` | `SecurityConfig.java:114-115`, `CustomerAddressController.java:38-72` |
| Customer orders | GET `/api/v1/customer/orders` | List own orders | `ROLE_CUSTOMER` | none | `SecurityConfig` + `CustomerOrderController.requireCustomerId()` (uses principal) | `CONFIRMED_BACKEND_ENFORCED` | `SecurityConfig.java:110-111`, `CustomerOrderController.java:46-58` |
| Customer orders | GET `/api/v1/customer/orders/{orderId}` | View own order detail | `ROLE_CUSTOMER` | none | Same; passes `customerId` and `orderId` together | `CONFIRMED_BACKEND_ENFORCED` | `CustomerOrderController.java:74-84` |
| Customer returns | GET `/api/v1/customer/orders/returns`, `/{returnId}` | List/view own returns | `ROLE_CUSTOMER` | none | Controller filters by `customerId` | `CONFIRMED_BACKEND_ENFORCED` | `CustomerOrderController.java:64-72` |
| Customer returns | POST `/api/v1/customer/orders/{orderId}/returns` | Create return | `ROLE_CUSTOMER` | none | Same | `CONFIRMED_BACKEND_ENFORCED` | `CustomerOrderController.java:86-93` |

### 7.4 Public (guest + customer) commerce APIs

| API Area | Method / Path | Action | Required Role | Required Permission | Enforcement | Status | Evidence |
|---|---|---|---|---|---|---|---|
| Catalog public | GET `/api/v1/products/**`, `/api/v1/categories/**`, `/api/v1/brands/**` | Browse catalog | None | none | `SecurityConfig` permitAll | `CONFIRMED_BACKEND_ENFORCED` | `SecurityConfig.java:65, 68-69` |
| Reviews public | POST `/api/v1/products/{id}/reviews` | Submit review (defaults PENDING) | None | none | `SecurityConfig` permitAll | `CONFIRMED_BACKEND_ENFORCED`; moderation handled by admin `reviews.write` | `SecurityConfig.java:66-67` |
| Content public | GET `/api/v1/articles/**`, `/api/v1/pages/**` | Read article / page | None | none | `SecurityConfig` permitAll | `CONFIRMED_BACKEND_ENFORCED` | `SecurityConfig.java:70-71` |
| Sliders public | GET `/api/v1/sliders` | Read slider | None | none | `SecurityConfig` permitAll | `CONFIRMED_BACKEND_ENFORCED` | `SecurityConfig.java:72` |
| Home videos public | GET `/api/v1/home-videos` | Read home video | None | none | `SecurityConfig` permitAll | `CONFIRMED_BACKEND_ENFORCED` | `SecurityConfig.java:73` |
| Search | GET `/api/v1/search`, `/api/v1/search-suggest` | Search | None | none | `SecurityConfig` permitAll | `CONFIRMED_BACKEND_ENFORCED` | `SecurityConfig.java:74-75` |
| Address admin units | GET `/api/v1/address/**` | Lookup admin units | None | none | `SecurityConfig` permitAll | `CONFIRMED_BACKEND_ENFORCED` | `SecurityConfig.java:76` |
| Cart | * `/api/v1/cart/**` | Cart ops (guest & customer) | None | none | `SecurityConfig` permitAll + CSRF filter for mutations | `CONFIRMED_BACKEND_ENFORCED` | `SecurityConfig.java:78-79`, `CustomerCsrfFilter` (used in chain) |
| Checkout | POST `/api/v1/checkout`, POST `/api/v1/orders/quick-buy`, GET `/api/v1/checkout/options` | Checkout (guest & customer) | None | none | `SecurityConfig` permitAll + CSRF | `CONFIRMED_BACKEND_ENFORCED` | `SecurityConfig.java:81-83` |
| Order lookup | GET `/api/v1/orders/lookup` | Public order lookup | None | none | `SecurityConfig` permitAll | `CONFIRMED_BACKEND_ENFORCED` | `SecurityConfig.java:85` |
| Settings public | GET `/api/v1/settings/public` | Public settings | None | none | `SecurityConfig` permitAll | `CONFIRMED_BACKEND_ENFORCED` | `SecurityConfig.java:90` |
| Menus public | GET `/api/v1/menus/**` | Public menus | None | none | `SecurityConfig` permitAll | `CONFIRMED_BACKEND_ENFORCED` | `SecurityConfig.java:91` |
| Contact | POST `/api/v1/contact` | Contact form | None | none | `SecurityConfig` permitAll | `CONFIRMED_BACKEND_ENFORCED` | `SecurityConfig.java:98` |
| Internal redirect | GET `/api/internal/redirect`, GET `/api/internal/redirects/active`, POST `/api/internal/redirects/hit/**` | Web middleware redirect lookup | None at HTTP level | none | `SecurityConfig` permitAll; **must** be locked at network/infra level (private network / IP allowlist) | `CONFIRMED_BACKEND_ENFORCED` for HTTP layer; `NEEDS_VERIFICATION` for prod network restriction | `SecurityConfig.java:93-96`, `InternalRedirectController.java` |
| WebSocket | * `/ws/**` | Admin WebSocket | None at HTTP layer; auth in STOMP CONNECT | none | `SecurityConfig` permitAll; auth enforced in STOMP interceptor | `NEEDS_VERIFICATION` (STOMP interceptor not audited in this doc) | `SecurityConfig.java:99-100` |
| Health | GET `/actuator/health` | Health check | None | none | `SecurityConfig` permitAll | `CONFIRMED_BACKEND_ENFORCED` | `SecurityConfig.java:117` |

### 7.5 Admin business APIs (`/api/v1/admin/**`)

Tất cả các path đều bị gate `hasRole("ADMIN")` ở `SecurityConfig.java:102-108`. Mỗi controller method còn gọi `requirePermission(...)`. Nếu `SUPER_ADMIN` thì `*` cấp tất cả quyền (xem `DevAdminAuthService.java:69, 81`). Tất cả entries dưới đây đều là `CONFIRMED_BACKEND_ENFORCED`.

#### Dashboard

| Method / Path | Action | Required Permission | Evidence |
|---|---|---|---|
| GET `/api/v1/admin/dashboard` | Dashboard summary | `orders.read` | `AdminDashboardController.java:32-37` |

#### Catalog (products, categories, brands)

| Method / Path | Action | Required Permission | Evidence |
|---|---|---|---|
| GET `/api/v1/admin/products` | List products | `products.read` | `AdminCatalogController.java:61, 75` |
| GET `/api/v1/admin/products/{id}` | View product | `products.read` | `AdminCatalogController.java:93, 98` |
| POST `/api/v1/admin/products` | Create product | `products.update` | `AdminCatalogController.java:102, 107` |
| PATCH `/api/v1/admin/products/{id}` | Update product | `products.update` | `AdminCatalogController.java:111, 117` |
| PATCH `/api/v1/admin/products/{id}/publish` | Publish/unpublish product | `products.update` | `AdminCatalogController.java:121, 127` |
| DELETE `/api/v1/admin/products/{id}` | Soft delete product | `products.update` | `AdminCatalogController.java:139, 144` |
| GET `/api/v1/admin/categories` | List categories | `catalog.read` | `AdminCatalogController.java:148, 159` |
| GET `/api/v1/admin/categories/{id}` | View category | `catalog.read` | `AdminCatalogController.java:174, 179` |
| POST `/api/v1/admin/categories` | Create category | `catalog.update` | `AdminCatalogController.java:183, 188` |
| PATCH `/api/v1/admin/categories/{id}` | Update category | `catalog.update` | `AdminCatalogController.java:192, 198` |
| DELETE `/api/v1/admin/categories/{id}` | Delete category | `catalog.update` | `AdminCatalogController.java:207, 212` |
| GET `/api/v1/admin/brands` | List brands | `catalog.read` | `AdminCatalogController.java:216, 227` |
| GET `/api/v1/admin/brands/{id}` | View brand | `catalog.read` | `AdminCatalogController.java:242, 247` |
| POST `/api/v1/admin/brands` | Create brand | `catalog.update` | `AdminCatalogController.java:251, 256` |
| PATCH `/api/v1/admin/brands/{id}` | Update brand | `catalog.update` | `AdminCatalogController.java:260, 266` |
| DELETE `/api/v1/admin/brands/{id}` | Delete brand | `catalog.update` | `AdminCatalogController.java:270, 275` |

#### Content

| Method / Path | Action | Required Permission | Evidence |
|---|---|---|---|
| GET `/api/v1/admin/content` | List content | `content.read` | `AdminContentController.java:56, 68` |
| GET `/api/v1/admin/content/{type}/{id}` | View content | `content.read` | `AdminContentController.java:84, 90` |
| POST `/api/v1/admin/content/articles` | Create article | `content.update` | `AdminContentController.java:94, 99` |
| PATCH `/api/v1/admin/content/articles/{id}` | Update article | `content.update` | `AdminContentController.java:103, 109` |
| POST `/api/v1/admin/content/pages` | Create page | `content.update` | `AdminContentController.java:113, 118` |
| PATCH `/api/v1/admin/content/pages/{id}` | Update page | `content.update` | `AdminContentController.java:122, 128` |
| DELETE `/api/v1/admin/content/{type}/{id}` | Delete content | `content.update` | `AdminContentController.java:132, 138` |

#### Orders

| Method / Path | Action | Required Permission | Evidence |
|---|---|---|---|
| GET `/api/v1/admin/orders` | List orders | `orders.read` | `AdminOrderController.java:55, 67` |
| GET `/api/v1/admin/orders/{orderId}` | View order | `orders.read` | `AdminOrderController.java:74, 79` |
| GET `/api/v1/admin/orders/{orderId}/allowed-transitions` | Read allowed transitions | `orders.read` | `AdminOrderController.java:83, 88` |
| PATCH `/api/v1/admin/orders/{orderId}/status` | Change order status | `orders.write` | `AdminOrderController.java:92, 98` |
| PATCH `/api/v1/admin/orders/{orderId}/payment-status` | Change payment status | `orders.write` | `AdminOrderController.java:106, 112` |
| POST `/api/v1/admin/orders/{orderId}/refund` | Refund | `orders.write` | `AdminOrderController.java:120, 126` |
| POST `/api/v1/admin/orders/{orderId}/notes` | Add internal note | `orders.write` | `AdminOrderController.java:134, 140` |
| GET `/api/v1/admin/orders/{orderId}/notes` | List internal notes | `orders.read` | `AdminOrderController.java:148, 153` |

#### Returns (admin)

| Method / Path | Action | Required Permission | Evidence |
|---|---|---|---|
| GET `/api/v1/admin/returns` | List returns | `orders.read` | `AdminReturnController.java:40, 48` |
| GET `/api/v1/admin/returns/{returnId}` | View return | `orders.read` | `AdminReturnController.java:52, 57` |
| PATCH `/api/v1/admin/returns/{returnId}/status` | Update return status | `orders.write` | `AdminReturnController.java:61, 67` |

#### POS

| Method / Path | Action | Required Permission | Evidence |
|---|---|---|---|
| GET `/api/v1/admin/pos/products/search` | POS product search | `orders.write` | `AdminPosController.java:42, 49` |
| POST `/api/v1/admin/pos/orders` | Create POS order (decrement stock) | `orders.write` | `AdminPosController.java:57, 62` |

#### Customers (admin)

| Method / Path | Action | Required Permission | Evidence |
|---|---|---|---|
| GET `/api/v1/admin/customers` | List customers | `customers.read` | `AdminCustomerController.java:50, 59` |
| GET `/api/v1/admin/customers/{customerId}` | View customer | `customers.read` | `AdminCustomerController.java:64, 69` |
| PATCH `/api/v1/admin/customers/{customerId}` | Update customer | `customers.write` | `AdminCustomerController.java:73, 79` |
| PATCH `/api/v1/admin/customers/{customerId}/status` | Update customer status | `customers.write` | `AdminCustomerController.java:84, 90` |

#### Inventory

| Method / Path | Action | Required Permission | Evidence |
|---|---|---|---|
| GET `/api/v1/admin/inventory` | List inventory | `products.read` | `AdminInventoryController.java:43, 51` |
| GET `/api/v1/admin/inventory/summary` | Inventory summary | `products.read` | `AdminInventoryController.java:55, 57` |
| GET `/api/v1/admin/inventory/movements` | List movements | `products.read` | `AdminInventoryController.java:61, 69` |
| GET `/api/v1/admin/inventory/export.csv` | Export CSV | `products.read` | `AdminInventoryController.java:73, 75` |
| GET `/api/v1/admin/inventory/variants/{variantId}/movements` | Variant movements | `products.read` | `AdminInventoryController.java:79, 86` |
| POST `/api/v1/admin/inventory/variants/{variantId}/adjust` | Stock adjust | `products.update` | `AdminInventoryController.java:90, 96` |

#### Media

| Method / Path | Action | Required Permission | Evidence |
|---|---|---|---|
| POST `/api/v1/admin/media` (multipart) | Upload media | `media.write` | `AdminMediaController.java:55, 62` |
| GET `/api/v1/admin/media` | List media | `media.read` | `AdminMediaController.java:67, 77` |
| GET `/api/v1/admin/media/{mediaId}` | View media | `media.read` | `AdminMediaController.java:82, 87` |
| PATCH `/api/v1/admin/media/{mediaId}` | Update media | `media.write` | `AdminMediaController.java:91, 97` |
| DELETE `/api/v1/admin/media/{mediaId}` | Soft delete media | `media.write` | `AdminMediaController.java:102, 109` |
| POST `/api/v1/admin/media/{mediaId}/restore` | Restore media | `media.write` | `AdminMediaController.java:117, 122` |

#### Menus

| Method / Path | Action | Required Permission | Evidence |
|---|---|---|---|
| GET `/api/v1/admin/menus` | List menus | `menus.read` | `AdminMenuController.java:59, 67` |
| GET `/api/v1/admin/menus/{menuId}` | View menu | `menus.read` | `AdminMenuController.java:71, 76` |
| POST `/api/v1/admin/menus` | Create menu | `menus.write` | `AdminMenuController.java:80, 85` |
| PATCH `/api/v1/admin/menus/{menuId}` | Update menu | `menus.write` | `AdminMenuController.java:89, 95` |
| DELETE `/api/v1/admin/menus/{menuId}` | Delete menu | `menus.write` | `AdminMenuController.java:99, 105` |
| POST `/api/v1/admin/menus/{menuId}/items` | Add menu item | `menus.write` | `AdminMenuController.java:111, 117` |
| PATCH `/api/v1/admin/menus/{menuId}/items/{itemId}` | Update menu item | `menus.write` | `AdminMenuController.java:122, 129` |
| DELETE `/api/v1/admin/menus/{menuId}/items/{itemId}` | Delete menu item | `menus.write` | `AdminMenuController.java:134, 141` |
| POST `/api/v1/admin/menus/{menuId}/items/reorder` | Reorder items | `menus.write` | `AdminMenuController.java:145, 151` |

#### Coupons

| Method / Path | Action | Required Permission | Evidence |
|---|---|---|---|
| GET `/api/v1/admin/coupons` | List coupons | `coupons.read` | `AdminCouponController.java:52, 63` |
| GET `/api/v1/admin/coupons/{couponId}` | View coupon | `coupons.read` | `AdminCouponController.java:68, 73` |
| POST `/api/v1/admin/coupons` | Create coupon | `coupons.write` | `AdminCouponController.java:77, 82` |
| PATCH `/api/v1/admin/coupons/{couponId}` | Update coupon | `coupons.write` | `AdminCouponController.java:86, 92` |
| PATCH `/api/v1/admin/coupons/{couponId}/status` | Toggle coupon status | `coupons.write` | `AdminCouponController.java:97, 103` |

#### Shipping

| Method / Path | Action | Required Permission | Evidence |
|---|---|---|---|
| GET `/api/v1/admin/shipping/zones` | List zones | `shipping.read` | `AdminShippingController.java:48, 55` |
| GET `/api/v1/admin/shipping/zones/{id}` | View zone | `shipping.read` | `AdminShippingController.java:59, 64` |
| POST `/api/v1/admin/shipping/zones` | Create zone | `shipping.write` | `AdminShippingController.java:68, 73` |
| PATCH `/api/v1/admin/shipping/zones/{id}` | Update zone | `shipping.write` | `AdminShippingController.java:81, 87` |
| DELETE `/api/v1/admin/shipping/zones/{id}` | Delete zone | `shipping.write` | `AdminShippingController.java:95, 101` |
| GET `/api/v1/admin/shipping/zones/{zoneId}/methods` | List methods | `shipping.read` | `AdminShippingController.java:107, 112` |
| POST `/api/v1/admin/shipping/zones/{zoneId}/methods` | Create method | `shipping.write` | `AdminShippingController.java:116, 122` |
| PATCH `/api/v1/admin/shipping/zones/{zoneId}/methods/{methodId}` | Update method | `shipping.write` | `AdminShippingController.java:134, 141` |
| DELETE `/api/v1/admin/shipping/zones/{zoneId}/methods/{methodId}` | Delete method | `shipping.write` | `AdminShippingController.java:153, 160` |

#### Reports

| Method / Path | Action | Required Permission | Evidence |
|---|---|---|---|
| GET `/api/v1/admin/reports/analytics` | Analytics | `orders.read` | `AdminReportController.java:37, 43` |
| GET `/api/v1/admin/reports/orders/export` | Export orders | `orders.read` | `AdminReportController.java:47, 55` |
| GET `/api/v1/admin/reports/customers/export` | Export customers | `customers.read` | `AdminReportController.java:60, 65` |
| GET `/api/v1/admin/reports/products/export` | Export products | `products.read` | `AdminReportController.java:70, 75` |

#### Reviews (admin)

| Method / Path | Action | Required Permission | Evidence |
|---|---|---|---|
| GET `/api/v1/admin/reviews` | List reviews | `reviews.read` | `AdminReviewController.java:43, 51` |
| GET `/api/v1/admin/reviews/{id}` | View review | `reviews.read` | `AdminReviewController.java:55, 60` |
| PATCH `/api/v1/admin/reviews/{id}/status` | Approve/reject review | `reviews.write` | `AdminReviewController.java:64, 70` |
| DELETE `/api/v1/admin/reviews/{id}` | Delete review | `reviews.write` | `AdminReviewController.java:74, 80` |

#### Sliders / Home Videos

| Method / Path | Action | Required Permission | Evidence |
|---|---|---|---|
| GET `/api/v1/admin/sliders` | List sliders | `sliders.read` | `AdminSliderController.java:49, 54` |
| POST `/api/v1/admin/sliders` | Create slider | `sliders.write` | `AdminSliderController.java:58, 64` |
| POST `/api/v1/admin/sliders/reorder` | Reorder sliders | `sliders.write` | `AdminSliderController.java:69, 74` |
| PATCH `/api/v1/admin/sliders/{id}` | Update slider | `sliders.write` | `AdminSliderController.java:79, 85` |
| DELETE `/api/v1/admin/sliders/{id}` | Delete slider | `sliders.write` | `AdminSliderController.java:90, 96` |
| GET `/api/v1/admin/home-videos` | List home videos | `home_videos.read` | `AdminHomeVideoController.java:45, 47` |
| POST `/api/v1/admin/home-videos` | Create home video | `home_videos.write` | `AdminHomeVideoController.java:51, 57` |
| PATCH `/api/v1/admin/home-videos/{id}` | Update home video | `home_videos.write` | `AdminHomeVideoController.java:61, 67` |
| POST `/api/v1/admin/home-videos/reorder` | Reorder home videos | `home_videos.write` | `AdminHomeVideoController.java:71, 76` |
| DELETE `/api/v1/admin/home-videos/{id}` | Delete home video | `home_videos.write` | `AdminHomeVideoController.java:80, 86` |

#### Settings

| Method / Path | Action | Required Permission | Evidence |
|---|---|---|---|
| GET `/api/v1/admin/settings` | List settings | `settings.read` | `AdminSettingsController.java:47, 56` |
| GET `/api/v1/admin/settings/{settingKey}` | View setting | `settings.read` | `AdminSettingsController.java:61, 66` |
| PATCH `/api/v1/admin/settings/{settingKey}` | Update setting | `settings.write` | `AdminSettingsController.java:70, 76` |

#### Admin Users / Roles / Audit

| Method / Path | Action | Required Permission | Evidence |
|---|---|---|---|
| GET `/api/v1/admin/admin-users` | List admin users | `admin-users.read` | `AdminAdminUsersController.java:49, 58` |
| GET `/api/v1/admin/admin-users/{id}` | View admin user | `admin-users.read` | `AdminAdminUsersController.java:62, 67` |
| POST `/api/v1/admin/admin-users` | Create admin user | `admin-users.write` | `AdminAdminUsersController.java:71, 77` |
| PATCH `/api/v1/admin/admin-users/{id}` | Update admin user (role/status/displayName/password) — service blocks self-deactivate, self-demote SUPER_ADMIN, last-active SUPER_ADMIN demotion | `admin-users.write` | `AdminAdminUsersController.java:90, 96`, `AdminAdminUsersService.java:144-168` |
| GET `/api/v1/admin/roles` | List roles (built-in + custom) | `admin-users.read` | `AdminRolesController.java:46, 48` |
| PUT `/api/v1/admin/roles/{id}/permissions` | Update permissions for non-`SUPER_ADMIN` role | `admin-users.write` | `AdminRolesController.java:53, 59`, `AdminRoleService.java:55-57` |
| POST `/api/v1/admin/roles` | Create custom role | `admin-users.write` | `AdminRolesController.java:72, 78`, `AdminRoleService.java:70-98` |
| DELETE `/api/v1/admin/roles/{id}` | Delete custom (non-system) role | `admin-users.write` | `AdminRolesController.java:97, 100`, `AdminRoleService.java:100-114` |
| GET `/api/v1/admin/audit-logs` | List audit log entries | `audit-logs.read` | `AdminAuditLogController.java:36, 50` |

#### Redirects

| Method / Path | Action | Required Permission | Evidence |
|---|---|---|---|
| GET `/api/v1/admin/redirects` | List redirects | `redirects.read` | `AdminRedirectController.java:74, 83` |
| GET `/api/v1/admin/redirects/{id}` | View redirect | `redirects.read` | `AdminRedirectController.java:90, 95` |
| POST `/api/v1/admin/redirects` | Create redirect | `redirects.write` | `AdminRedirectController.java:99, 104` |
| PATCH `/api/v1/admin/redirects/{id}` | Update redirect | `redirects.write` | `AdminRedirectController.java:119, 125` |
| DELETE `/api/v1/admin/redirects/{id}` | Delete redirect | `redirects.write` | `AdminRedirectController.java:140, 146` |

## 8. Module Permission Matrix

| Module | Read Permission | Write Permission | Delete / Special Permission | Roles Allowed (built-in) | Status | Evidence |
|---|---|---|---|---|---|---|
| Products | `products.read` | `products.update` | `products.update` (delete = soft delete) | `SUPER_ADMIN`, `ADMIN`, `SHOP_MANAGER` (read+update); `EDITOR` (read only) | `CONFIRMED_BACKEND_ENFORCED` | `AdminCatalogController.java`, `AdminRolePermissions.java` |
| Catalog (categories, brands) | `catalog.read` | `catalog.update` | `catalog.update` | `SUPER_ADMIN`, `ADMIN`, `SHOP_MANAGER` (read), `EDITOR` (read) | `CONFIRMED_BACKEND_ENFORCED` | `AdminCatalogController.java`, `AdminRolePermissions.java` |
| Orders | `orders.read` | `orders.write` | `orders.write` (refund/note/status) | `SUPER_ADMIN`, `ADMIN`, `SHOP_MANAGER` | `CONFIRMED_BACKEND_ENFORCED` | `AdminOrderController.java`, `AdminReturnController.java`, `AdminPosController.java` |
| POS | n/a | `orders.write` | n/a | `SUPER_ADMIN`, `ADMIN`, `SHOP_MANAGER` | `CONFIRMED_BACKEND_ENFORCED` | `AdminPosController.java`, `AdminRolePermissions.java` |
| Customers | `customers.read` | `customers.write` | `customers.write` (status change) | `SUPER_ADMIN`, `ADMIN`, `SHOP_MANAGER` | `CONFIRMED_BACKEND_ENFORCED` | `AdminCustomerController.java`, `AdminRolePermissions.java` |
| Inventory | `products.read` | `products.update` (adjust) | n/a | `SUPER_ADMIN`, `ADMIN`, `SHOP_MANAGER` | `CONFIRMED_BACKEND_ENFORCED` | `AdminInventoryController.java`, `AdminRolePermissions.java` |
| Returns | `orders.read` | `orders.write` | n/a | `SUPER_ADMIN`, `ADMIN`, `SHOP_MANAGER` | `CONFIRMED_BACKEND_ENFORCED` | `AdminReturnController.java`, `AdminRolePermissions.java` |
| Media | `media.read` | `media.write` | `media.write` (soft delete + restore) | `SUPER_ADMIN`, `ADMIN`, `EDITOR`, `AUTHOR`; `CONTRIBUTOR` (read only) | `CONFIRMED_BACKEND_ENFORCED` | `AdminMediaController.java`, `AdminRolePermissions.java` |
| Content (articles + pages) | `content.read` | `content.update` | `content.update` | `SUPER_ADMIN`, `ADMIN`, `EDITOR`, `AUTHOR`, `SEO_EDITOR`; `CONTRIBUTOR` (read only) | `CONFIRMED_BACKEND_ENFORCED` | `AdminContentController.java`, `AdminRolePermissions.java` |
| Settings | `settings.read` | `settings.write` | n/a | `SUPER_ADMIN`, `ADMIN` | `CONFIRMED_BACKEND_ENFORCED` | `AdminSettingsController.java`, `AdminRolePermissions.java` |
| Menus | `menus.read` | `menus.write` | `menus.write` | `SUPER_ADMIN`, `ADMIN`, `EDITOR` | `CONFIRMED_BACKEND_ENFORCED` | `AdminMenuController.java`, `AdminRolePermissions.java` |
| Coupons | `coupons.read` | `coupons.write` | `coupons.write` (status) | `SUPER_ADMIN`, `ADMIN`, `SHOP_MANAGER` | `CONFIRMED_BACKEND_ENFORCED` | `AdminCouponController.java`, `AdminRolePermissions.java` |
| Shipping | `shipping.read` | `shipping.write` | `shipping.write` | `SUPER_ADMIN`, `ADMIN` (read+write); `SHOP_MANAGER` (read only) | `CONFIRMED_BACKEND_ENFORCED` | `AdminShippingController.java`, `AdminRolePermissions.java` |
| Reports | `orders.read` (analytics & order export), `customers.read` (customer export), `products.read` (product export) | n/a | n/a | Tùy permission được gán; `SUPER_ADMIN`, `ADMIN`, `SHOP_MANAGER` đủ cho phần lớn report | `CONFIRMED_BACKEND_ENFORCED` | `AdminReportController.java` |
| Reviews | `reviews.read` | `reviews.write` | `reviews.write` (delete) | `SUPER_ADMIN`, `ADMIN`, `SHOP_MANAGER` | `CONFIRMED_BACKEND_ENFORCED` | `AdminReviewController.java`, `AdminRolePermissions.java` |
| Sliders / Home Videos | `sliders.read` / `home_videos.read` | `sliders.write` / `home_videos.write` | same write | `SUPER_ADMIN`, `ADMIN`; `EDITOR` (sliders only) | `CONFIRMED_BACKEND_ENFORCED` | `AdminSliderController.java`, `AdminHomeVideoController.java`, `AdminRolePermissions.java` |
| Users / Roles | `admin-users.read` | `admin-users.write` | `admin-users.write` (create/delete custom role; create/update admin user) | `SUPER_ADMIN`, `ADMIN` | `CONFIRMED_BACKEND_ENFORCED` | `AdminAdminUsersController.java`, `AdminRolesController.java`, `AdminAdminUsersService.java`, `AdminRoleService.java` |
| Redirects | `redirects.read` | `redirects.write` | `redirects.write` | `SUPER_ADMIN`, `ADMIN`, `SEO_EDITOR` | `CONFIRMED_BACKEND_ENFORCED` | `AdminRedirectController.java`, `AdminRolePermissions.java` |
| Audit | `audit-logs.read` | n/a | n/a | `SUPER_ADMIN`, `ADMIN` | `CONFIRMED_BACKEND_ENFORCED` | `AdminAuditLogController.java`, `AdminRolePermissions.java` |

## 9. Critical Permission Rules

1. **Guest / Customer không được gọi admin API.**
   `SecurityConfig` requires `hasRole("ADMIN")` cho `/api/v1/admin/**`, `/api/v1/admin/shipping/**`, `/api/v1/admin/reviews/**`, `/api/v1/admin/admin-users/**`. Status: `CONFIRMED_BACKEND_ENFORCED`. Evidence: `SecurityConfig.java:102-108`.

2. **Customer chỉ được đọc/ghi dữ liệu của chính mình.**
   `CustomerController`, `CustomerAddressController`, `CustomerOrderController` đều resolve `CustomerPrincipal` từ SecurityContext và truyền `customerId` vào service layer. Customer không thể gọi qua orderId của khách khác (controller pass `(customerId, orderId)` xuống `OrderReadService.getCustomerOrderDetail`). Status: `CONFIRMED_BACKEND_ENFORCED`. Evidence: `CustomerController.java:31-50`, `CustomerAddressController.java:38-72`, `CustomerOrderController.java:46-101`.

3. **`SUPER_ADMIN` wildcard.** `SUPER_ADMIN` được map sang `*` và `requirePermission` accept tất cả permission. Wildcard cũng valid với frontend `hasPermission`. Status: `CONFIRMED_BACKEND_ENFORCED` + `CONFIRMED_FRONTEND_GUARD`. Evidence: `AdminRolePermissions.java:16`, `DevAdminAuthService.java:69, 81`, `bigbike-admin/src/App.jsx:248`.

4. **Không cho phép self-deactivate.** Admin không thể chuyển status của chính mình về DISABLED/SUSPENDED. Status: `CONFIRMED_BACKEND_ENFORCED`. Evidence: `AdminAdminUsersService.java:149-151`.

5. **Không cho phép self-demote SUPER_ADMIN.** Nếu actor đang là `SUPER_ADMIN` và update role chính mình về role khác, service từ chối. Status: `CONFIRMED_BACKEND_ENFORCED`. Evidence: `AdminAdminUsersService.java:158-160`.

6. **Không demote `SUPER_ADMIN` cuối cùng đang ACTIVE.** Service đếm số `SUPER_ADMIN` đang ACTIVE; nếu chỉ còn 1, từ chối demote. Status: `CONFIRMED_BACKEND_ENFORCED`. Evidence: `AdminAdminUsersService.java:161-168`.

7. **Không sửa permission của `SUPER_ADMIN` qua UI/role API.** `AdminRoleService.updateRolePermissions` từ chối nếu role.id == `SUPER_ADMIN`. Status: `CONFIRMED_BACKEND_ENFORCED`. Evidence: `AdminRoleService.java:55-57`.

8. **Không xoá role hệ thống (`isSystem`).** `AdminRoleService.deleteRole` từ chối nếu role là system role. Status: `CONFIRMED_BACKEND_ENFORCED`. Evidence: `AdminRoleService.java:105-107`.

9. **Backend enforcement bắt buộc.** Mọi admin API đều gọi `requirePermission(...)` trước khi thực thi business logic. Frontend `App.jsx` hide/disable UI là UX, không phải gate cuối cùng.

10. **Frontend-only guard là high risk.** Nếu một future endpoint chỉ check ở frontend mà không gọi `requirePermission(...)`, đó là `FRONTEND_ONLY` và phải đánh giá `HIGH_RISK`. Hiện tại trong evidence audited, mọi admin route trong `App.jsx` đều có backend `requirePermission` tương ứng — không tìm thấy `FRONTEND_ONLY`.

11. **Production auth chưa hoàn thiện.** `DevAdminAuthService.ensureDevMockProfile` ném `AuthNotImplementedException` cho profile production khi chỉ dùng header-based dev auth. Khi JWT principal có sẵn, role-based permission được áp; khi không có JWT, fallback sang header `X-Admin-Role` / `X-Admin-Permissions` (chỉ dev/mock/test/local). Đây là `HIGH_RISK` nếu deploy production mà không gắn profile chuẩn. Status: `NEEDS_VERIFICATION`. Evidence: `DevAdminAuthService.java:25-26, 93-111`.

12. **Internal redirect endpoints hoàn toàn không auth ở HTTP layer.** `/api/internal/redirect`, `/api/internal/redirects/active`, `/api/internal/redirects/hit/**` đều `permitAll`. Comment trong `SecurityConfig` ghi rõ phải lock ở infra/network layer cho production. Status: `NEEDS_VERIFICATION` for prod network restriction; `HIGH_RISK` nếu prod expose public. Evidence: `SecurityConfig.java:92-96`.

13. **WebSocket auth dựa vào STOMP CONNECT interceptor.** `SecurityConfig` permitAll `/ws/**`; auth check nằm ở STOMP layer. Status: `NEEDS_VERIFICATION` (interceptor không audit trong tài liệu này).

14. **Public review submission permitAll.** `POST /api/v1/products/{id}/reviews` không cần auth — mọi review submit đều default PENDING và phải qua moderation (`reviews.write`). Status: `CONFIRMED_BACKEND_ENFORCED`. Evidence: `SecurityConfig.java:66-67`, comment in code.

## 10. Permission Negative Test Requirements

| Scenario | Expected Result | Test Status | Evidence / Notes |
|---|---|---|---|
| Guest gọi `/api/v1/admin/orders` | 401/403 | `NEEDS_VERIFICATION` (chưa thấy integration test cho path này trong evidence audited) | `SecurityConfig.java:102` enforces `hasRole("ADMIN")` |
| Guest gọi `/api/v1/customer/me` | 401/403 | `NEEDS_VERIFICATION` | `SecurityConfig.java:113` |
| Customer A đọc order của Customer B qua `/api/v1/customer/orders/{otherOrderId}` | 404/403 (filtered by customerId) | `NEEDS_VERIFICATION` (cần test integration cụ thể) | `CustomerOrderController.java:74-84` truyền `customerId` xuống service |
| Customer gọi `/api/v1/admin/products` | 403 | `NEEDS_VERIFICATION` | `SecurityConfig.java:102` |
| Editor gọi `PATCH /api/v1/admin/orders/{id}/status` | 403 (Permission denied) | `NEEDS_VERIFICATION` | EDITOR không có `orders.write`; `DevAdminAuthService` ném `ForbiddenException` |
| Editor gọi `POST /api/v1/admin/products` | 403 (`products.update`) | `NEEDS_VERIFICATION` | EDITOR không có `products.update` |
| Shop Manager gọi `PATCH /api/v1/admin/settings/{key}` | 403 | `NEEDS_VERIFICATION` | SHOP_MANAGER không có `settings.write` |
| Shop Manager gọi `POST /api/v1/admin/admin-users` | 403 | `NEEDS_VERIFICATION` | SHOP_MANAGER không có `admin-users.write` |
| Author gọi `POST /api/v1/admin/products` | 403 | `NEEDS_VERIFICATION` | AUTHOR không có `products.update` |
| Contributor gọi `POST /api/v1/admin/media` | 403 | `NEEDS_VERIFICATION` | CONTRIBUTOR không có `media.write` |
| SEO Editor gọi `POST /api/v1/admin/products` | 403 | `NEEDS_VERIFICATION` | SEO_EDITOR không có `products.update` |
| Admin user without `media.write` upload media | 403 | `NEEDS_VERIFICATION` | Nếu Admin role bị custom restrict; `AdminMediaController.java:62` |
| Super Admin self-demote về Admin | 409 ConflictException | Logic confirmed | `AdminAdminUsersService.java:158-160` |
| Demote SUPER_ADMIN cuối cùng đang ACTIVE | 409 ConflictException | Logic confirmed | `AdminAdminUsersService.java:161-168` |
| Admin self-deactivate (status DISABLED on own id) | 409 ConflictException | Logic confirmed | `AdminAdminUsersService.java:149-151` |
| Update permissions của `SUPER_ADMIN` role | 409 ConflictException | Logic confirmed | `AdminRoleService.java:55-57` |
| Delete built-in role (e.g. `EDITOR`) | 409 ConflictException | Logic confirmed | `AdminRoleService.java:105-107` |
| Production profile + dev/mock not enabled gọi admin API | `AuthNotImplementedException` | Logic confirmed | `DevAdminAuthService.java:106-110` |
| Public POST review without auth | 200/201 (status PENDING) | `NEEDS_VERIFICATION` | `SecurityConfig.java:66-67` |
| Internal redirect endpoint từ public IP | Phải bị reject ở infra layer | `NEEDS_VERIFICATION` (depends on prod network setup) | `SecurityConfig.java:92-96` |

## 11. Missing / Needs Verification

1. **STAFF role không có technical equivalent.** `USER_ROLES.md` đề cập `Staff` ở mức business; code không có. Cần BA quyết định map về role nào hoặc tạo custom role. → `DOCUMENTED_NOT_FOUND`.
2. **Support / Warehouse role.** Chưa có role chuyên biệt cho support agent / warehouse staff. → `NOT_FOUND_IN_REPO`.
3. **Production admin auth path.** `DevAdminAuthService` tự nhận biết dev/mock/test/local; production cần JWT path validate đầy đủ và backing user store. → `NEEDS_VERIFICATION`.
4. **Custom role default permission resolution.** `DevAdminAuthService.requirePermission` JWT path: nếu role không có trong `AdminRolePermissions.MAP` (e.g. custom role), service fallback về permission của `ADMIN` (`ROLE_PERMISSION_MAP.getOrDefault(...., ROLE_PERMISSION_MAP.getOrDefault("ADMIN", List.of()))`). Đây có thể leak quyền nếu custom role lẽ ra phải bị giới hạn. → `NEEDS_VERIFICATION` + `HIGH_RISK` candidate. Evidence: `DevAdminAuthService.java:65-68`.
5. **Custom role permissions lookup tại runtime không đọc DB.** `requirePermission` JWT path chỉ tra cứu `AdminRolePermissions.MAP` (built-in) — không đọc `admin_roles` repository để lấy permissions cho custom role. Hệ quả: custom role có thể không nhận được permission như cấu hình UI. → `NEEDS_VERIFICATION` + `HIGH_RISK`. Evidence: `DevAdminAuthService.java:64-69` so với `AdminRoleService.getPermissionsForRole`.
6. **WebSocket STOMP auth interceptor.** Chưa audit trong tài liệu này. → `NEEDS_VERIFICATION`.
7. **Email verification path mismatch — RESOLVED 2026-05-05 (BUG-001).** `SecurityConfig` đã permitAll cả `GET` (legacy) và `POST` cho `/api/v1/customer/auth/verify-email`; controller dùng `POST` — request từ frontend đi qua được. → `CONFIRMED_FROM_CODE`. Evidence: `SecurityConfig.java:63-64`, `CustomerAuthController.java:65`.
8. **Internal redirect endpoints tin tưởng vào infra-level allowlist.** Không có middleware hoặc IP allowlist trong code. → `NEEDS_VERIFICATION` cho production deploy.
9. **Public order lookup token semantics.** `GET /api/v1/orders/lookup` permitAll; chưa kiểm tra liệu endpoint yêu cầu token bí mật hay chỉ cần orderId/email. → `NEEDS_VERIFICATION`.
10. **CSRF token cho cart/checkout mutations.** `CustomerCsrfFilter` được mount; nội dung chính sách (header name, token rotation) chưa audit ở đây. → `NEEDS_VERIFICATION`.
11. **UI denied state.** `bigbike-admin/src/App.jsx:310-318` có generic permission-denied state, nhưng không xác nhận từng modal/action UI ẩn nút khi thiếu quyền theo chuẩn (`canUpdate` được prop-pass nhưng cần component-level test). → `NEEDS_VERIFICATION`.
12. **Bigbike-web admin route.** `bigbike-web` không có `/admin` route — admin SPA tách riêng (`bigbike-admin`). Confirmed by Glob/listing. Không có frontend-only guard nào ở web cho admin scope.
13. **Negative test coverage.** Hiện không có evidence test integration covering từng role × từng endpoint trong evidence audited. → `NEEDS_VERIFICATION` (`__tests__/` của bigbike-web và `bigbike-backend/src/test` không được kiểm tra trong audit này).

## 12. Evidence Summary

| Area | Evidence Path | What It Proves | Confidence |
|---|---|---|---|
| Role → Permission map | `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/auth/AdminRolePermissions.java` | Built-in role permission lists. | High |
| Permission enforcement | `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/auth/DevAdminAuthService.java` | `requirePermission` logic, dev/mock vs JWT path, ForbiddenException. | High |
| Role-based HTTP gating | `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/config/SecurityConfig.java` | `hasRole("ADMIN")` / `hasRole("CUSTOMER")` rules and permitAll public endpoints. | High |
| Admin user guardrails | `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminAdminUsersService.java` | Self-deactivate, self-demote SUPER_ADMIN, last super-admin guard, valid roles. | High |
| Role management API | `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminRoleService.java` | Create/update/delete custom role, block SUPER_ADMIN edit, block system delete. | High |
| Admin controllers `requirePermission(...)` calls | `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/admin/Admin*Controller.java` | Per-action permission requirement. | High |
| Customer controllers principal handling | `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/customer/CustomerController.java`, `CustomerAddressController.java`, `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/order/CustomerOrderController.java` | Customer endpoints filter by `CustomerPrincipal.customerId`. | High |
| Customer auth flows | `CustomerAuthController.java`, `AuthController.java` | Public auth surfaces. | High |
| Internal redirect endpoints | `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/internal/InternalRedirectController.java` | Public lookup endpoints for web middleware. | High |
| Admin SPA route guard | `bigbike-admin/src/App.jsx` | Frontend permission/route map, hasPermission, NAV groups. | High |
| Admin SPA auth bootstrap | `bigbike-admin/src/lib/auth.jsx` | AuthProvider + bootstrap with `/auth/me`. | High |
| Customer web account guard | `bigbike-web/components/layout/AccountShell.tsx` | Redirect to login when anonymous, profile context. | High |
| Existing role/business doc | `docs/business/USER_ROLES.md` | Role catalog at business layer; references same evidence files. | High |

## 13. Relationship With Other Docs

| Document | Relationship |
|---|---|
| `docs/business/USER_ROLES.md` | Mô tả role ở business level (ai dùng, để làm gì). `PERMISSION_MATRIX.md` chi tiết quyền kỹ thuật cho cùng các role đó. |
| `docs/business/MODULE_CATALOG.md` | Module/feature catalog. `PERMISSION_MATRIX.md` map mỗi module → permission read/write. |
| `docs/business/BUSINESS_RULES.md` | Business rules (validation, eligibility). Permission matrix là phần "ai được làm" của những rule đó. |
| `docs/business/STATE_MACHINES.md` | Trạng thái order/return/...; `orders.write` là điều kiện kỹ thuật để chuyển trạng thái qua admin API. |
| `docs/business/ACCEPTANCE_CRITERIA.md` | Tiêu chí hoàn thành feature; tham chiếu PERMISSION_MATRIX để xác định hành vi 401/403. |
| `docs/engineering/ARCHITECTURE.md` | Component breakdown; PERMISSION_MATRIX giải thích boundary auth/permission. |
| `docs/engineering/DATA_CONTRACT.md` | Data shapes; PERMISSION_MATRIX là layer trên cùng (ai được đọc/ghi). |
| `API_CONTRACT.md` | Chưa tồn tại trong repo. PERMISSION_MATRIX section 7 đóng vai trò mapping API ↔ permission cho tới khi tài liệu API contract được viết. |
| `TRACEABILITY_MATRIX.md` | Chưa tồn tại; PERMISSION_MATRIX là input để link role × module × API × test. |

## Audit Notes

Chỉ đọc/inspect repository. Không sửa code, không refactor, không deploy, không tạo migration.

Audited evidence ngày: 2026-05-04.

Phạm vi audit:

- `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/config/SecurityConfig.java`
- `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/auth/AdminRolePermissions.java`, `DevAdminAuthService.java`
- Toàn bộ `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/admin/Admin*Controller.java` (21 file).
- `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/customer/*` và `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/order/CustomerOrderController.java`.
- `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/auth/AuthController.java`.
- `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/internal/InternalRedirectController.java`.
- `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminAdminUsersService.java`, `AdminRoleService.java`.
- `bigbike-admin/src/App.jsx`, `bigbike-admin/src/lib/auth.jsx`.
- `bigbike-web/components/layout/AccountShell.tsx`, `bigbike-web/app/tai-khoan/...`.

Không audit / out-of-scope cho file này:

- WebSocket STOMP auth interceptor.
- Test suites (`bigbike-backend/src/test/...`, `bigbike-web/__tests__/...`).
- Production deployment config / nginx / infrastructure-layer ACL.
- Database migration / seed data.
- Mobile app role mapping (`bigbike_mobile`).
