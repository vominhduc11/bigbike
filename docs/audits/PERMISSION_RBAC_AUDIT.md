# BigBike Permission / RBAC Audit

> Audit type: **AUDIT + TRACE + REPORT** — read-only investigation. Mọi fix làm thay đổi
> RBAC policy / API contract / permission model được flag `NEEDS_CONFIRMATION`, không tự sửa.
>
> Ngày audit: 2026-05-16 · Phạm vi: `bigbike-backend`, `bigbike-web`, `bigbike-admin`,
> `bigbike_mobile`, Flyway migrations.
> Phương pháp: đọc code thật (SecurityConfig, filter chain, 51 controller, service ownership,
> client guard), đối chiếu với `docs/engineering/PERMISSION_MATRIX.md`.

---

## 1. Executive Summary

| Chỉ số | Giá trị |
|---|---|
| Role/authority phát hiện | **8** — 7 admin role + `ROLE_CUSTOMER`; guest = không authority |
| Permission key (fine-grained) | **49** (`PermissionCatalog.java`) |
| Controller backend | **51** (28 admin · 5 customer · 2 cart/checkout · ~13 public · 3 auth/internal/openapi) |
| Endpoint audit | **~220** (170 admin endpoint + ~50 customer/public/auth) |
| Admin endpoint có permission gate | **170/170** — mọi endpoint đều gọi `requirePermission()` |
| Customer-data domain kiểm ownership | 6/6 enforce (orders, order-cancel, returns, addresses, wishlist, cart) |
| UI route/action kiểm tra | bigbike-web (5 account route) · bigbike-admin (30+ route, permission-mapped) · bigbike_mobile (8 protected route) |

### Issue & trạng thái (cập nhật sau khi xử lý)

| ID | Severity | Issue | Trạng thái |
|---|---|---|---|
| F2 | High | Dev-header escalation customer → admin | ✅ **FIXED** |
| F1 | Medium | Admin URL guard chỉ `.authenticated()` (thiếu defense-in-depth) | ✅ **FIXED** |
| F3 | Medium | Warranty serial enumeration (không leak PII) | ⏳ Backlog — cần quyết định business |
| F5 | Medium | Thiếu test bảo mật (IDOR / customer→admin) | ✅ Đã thêm `RbacSecurityTest`; owner-test cho return/wishlist còn backlog |
| F7 | Low | `PERMISSION_MATRIX.md` mô tả sai admin URL guard | ✅ **FIXED** |
| F4 | Low | Client web/mobile không auto-redirect khi 401/403 | ⏳ Backlog UI |
| F6 | Low | Admin UI không phân tầng theo role | ⏳ Backlog UX |

### Kết luận

**RBAC backend vững.** Không phát hiện IDOR — mọi domain dữ liệu khách hàng đều enforce
ownership ở tầng service/repository. Mọi admin endpoint (170/170) đều có permission gate.
401/403 trả JSON chuẩn, không leak stacktrace. Internal redirect endpoint được token-gate
deny-by-default. Public endpoint không leak PII.

Sau audit, **hai điểm yếu defense-in-depth nghiêm trọng nhất đã được vá** (F1, F2 — xem mục
11). Authorization admin giờ có hai tầng: (1) URL gate chặn `ROLE_CUSTOMER`, (2) controller
`requirePermission()`. Đường leo quyền customer → admin qua dev-header đã bị bịt kể cả khi
`dev-header-enabled=true`.

### Blocking issues (cho production)

**Không còn blocking issue.** F1 + F2 đã fix, verified bằng full test suite (1176 test pass).
Các issue còn lại (F3 Medium, F4/F6 Low) là backlog non-blocking — không phải lỗ hổng RBAC,
không leak PII, không bypass auth.

**Verdict: `RBAC_READY`** — an toàn để production. F3 (warranty enumeration) nên xử lý như
một hardening item khi business quyết định có yêu cầu thêm định danh phụ; F4/F6 là backlog UX.

---

## 2. Role & Permission Model Inventory

### 2.1 Hai hệ xác thực tách biệt

| | Admin | Customer | Guest |
|---|---|---|---|
| Cơ chế | JWT Bearer (HMAC-SHA256, TTL 15') + opaque refresh token (rotate, 7d) | Cookie session `bb_session` (hash trong DB) + CSRF `bb_csrf` | Cookie guest cart, không auth |
| Filter set principal | `JwtAuthFilter` → `AdminPrincipal` | `CustomerSessionFilter` → `CustomerPrincipal` | — |
| Authority | `ROLE_<role>` (SUPER_ADMIN cấp thêm `ROLE_ADMIN`) | `ROLE_CUSTOMER` | none |
| Account state check | `status = ACTIVE` lúc login | `status = ACTIVE` lúc login **và** mỗi request (`CustomerSessionFilter:49`) | — |

### 2.2 Role inventory

| Role / Authority | Defined backend | Stored DB/migration | Trong JWT/token | web | admin | mobile | Mô tả | Status |
|---|---|---|---|---|---|---|---|---|
| `SUPER_ADMIN` | `AdminRole.java` | `admin_roles` (V49) | claim `role` | ✗ | ✓ | ✗ | Wildcard `*` | ACTIVE |
| `ADMIN` | `AdminRole.java` | `admin_roles` (V49) | claim `role` | ✗ | ✓ | ✗ | Full operations | ACTIVE |
| `SHOP_MANAGER` | `AdminRole.java` | `admin_roles` (V49) | claim `role` | ✗ | ✓ | ✗ | Sales/commerce, POS không price-override | ACTIVE |
| `EDITOR` | `AdminRole.java` | `admin_roles` (V49) | claim `role` | ✗ | ✓ | ✗ | Content/media/menu/slider + inventory.read (V121 compat) | ACTIVE |
| `AUTHOR` | `AdminRole.java` | `admin_roles` (V49) | claim `role` | ✗ | ✓ | ✗ | Content/media | ACTIVE |
| `CONTRIBUTOR` | `AdminRole.java` | `admin_roles` (V49) | claim `role` | ✗ | ✓ | ✗ | Content/media read-only | ACTIVE |
| `SEO_EDITOR` | `AdminRole.java` | `admin_roles` (V49) | claim `role` | ✗ | ✓ | ✗ | Content + redirects | ACTIVE |
| `ROLE_CUSTOMER` | `CustomerSessionFilter:54` | implicit (`customers` table, không có cột role) | session cookie (không phải JWT) | ✓ | ✗ | ✓ | Tự truy cập dữ liệu cá nhân | ACTIVE |

- **Không có role escalation tự phục vụ**: customer không có cột role, không có endpoint tự
  đổi role. Admin role chỉ đổi qua `admin-users.write` / `roles.write`.
- **`AdminUserEntity.roles`** (ElementCollection) tồn tại cho legacy WordPress import nhưng
  **không dùng khi login** — JWT chỉ encode 1 `role`. → Field dead trong auth flow.

### 2.3 Permission model

- **Fine-grained**: 49 permission key trong `PermissionCatalog.java`, 4 nhóm (Sales, Products,
  Content, System). Runtime source of truth = bảng `role_permissions` (đọc qua
  `AdminPermissionService`, cache theo role).
- Permission nhạy cảm (đánh dấu trong catalog): `pos.price_override`, `pos.refund`,
  `receivables.write_off`, `receivables.override_limit`, `settings.write`,
  `admin-users.write`, `roles.write`, `audit-logs.read`.
- `*` (wildcard) = SUPER_ADMIN.

---

## 3. Backend Endpoint Permission Matrix

### 3.1 Admin controllers — `/api/v1/admin/**` (28 controller, 170 endpoint)

| Controller | Endpoint | Permission gate | Ownership | Status |
|---|---|---|---|---|
| AdminOrderController | 9 | `orders.read` / `orders.write` | n/a (admin xem mọi order) | OK |
| AdminCustomerController | 5 | `customers.read/write`, `coupons.write` | n/a | OK |
| AdminReturnController | 6 | `orders.read/write` | n/a | OK |
| AdminCatalogController | 18 | `products.read/update`, `catalog.*` | n/a | OK |
| AdminContentController | 14 | `content.read/update` | n/a | OK |
| AdminInventoryController | 17 | `inventory.read/write` | n/a | OK |
| AdminMediaController | 14 | `media.read/write` | n/a | OK |
| AdminMenuController | 9 | `menus.read/write` | n/a | OK |
| AdminShippingController | 9 | `shipping.read/write` | n/a | OK |
| AdminReceivableController | 9 | `receivables.*` | n/a | OK |
| AdminCouponController | 5 | `coupons.read/write` | n/a | OK |
| AdminHomeVideoController | 5 | `home_videos.read/write` | n/a | OK |
| AdminRedirectController | 5 | `redirects.read/write` | n/a | OK |
| AdminSliderController | 5 | `sliders.read/write` | n/a | OK |
| AdminAdminUsersController | 4 | `admin-users.read/write` | n/a | OK |
| AdminRolesController | 4 | `roles.read/write` | n/a | OK |
| AdminReviewController | 4 | `reviews.read/write` | n/a | OK |
| AdminReportController | 4 | `reports.read/export` | n/a | OK |
| AdminSettingsController | 4 | `settings.read/write` | n/a | OK |
| AdminMediaFolderController | 4 | `media.read/write` | n/a | OK |
| AdminContactController | 3 | `contact.read/write` | n/a | OK |
| AdminNotificationController | 3 | `orders.read` | n/a | OK |
| AdminPosController | 3 | `pos.read/write/price_override/refund` | n/a | OK |
| AdminWarrantyController | 3 | `warranty.read/write` | n/a | OK |
| AdminAuditLogController | 1 | `audit-logs.read` | n/a | OK |
| AdminCouponGiftController | 1 | `coupons.write` | n/a | OK |
| AdminDashboardController | 1 | `orders.read` | n/a | OK |
| AdminPermissionsController | 1 | (đọc catalog) | n/a | OK |

**Verification**: đếm cơ học — `@(Get/Post/Put/Patch/Delete)Mapping` = **170** vs
`requirePermission(...)` = **171** trong package `api/admin`. Tỉ lệ 1:1 theo từng file
(27/28 file khớp tuyệt đối; `AdminContentController` 14↔15). → Bằng chứng mạnh: mọi admin
endpoint đều được gate. **Lưu ý**: đây là quy ước thủ công, không có cơ chế compile-time bắt
buộc — xem F1.

### 3.2 Customer controllers — `hasRole("CUSTOMER")` ở SecurityConfig

| Method · Endpoint | Controller | Auth | Ownership check | Evidence | Status |
|---|---|---|---|---|---|
| GET · `/customer/me` | CustomerController | ROLE_CUSTOMER | `principal.customerId()` | `CustomerController:32` | OK |
| PATCH · `/customer/me` | CustomerController | ROLE_CUSTOMER | `principal.customerId()` | — | OK |
| GET · `/customer/addresses` | CustomerAddressController | ROLE_CUSTOMER | `findByCustomerId` | `CustomerAddressService:31` | OK |
| PATCH/DELETE · `/customer/addresses/{id}` | CustomerAddressController | ROLE_CUSTOMER | `findByIdAndCustomerId` | `CustomerAddressService:64,80` | OK |
| GET · `/customer/orders` | CustomerOrderController | ROLE_CUSTOMER | Specification `customerId` | `OrderReadService:69` | OK |
| GET · `/customer/orders/{orderId}` | CustomerOrderController | ROLE_CUSTOMER | so sánh `customerId`, 404 nếu lệch | `OrderReadService:100` | OK |
| PATCH · `/customer/orders/{orderId}/cancel` | CustomerOrderController | ROLE_CUSTOMER | so sánh `customerId` | `CustomerOrderCancelService:33` | OK |
| GET/POST · `/customer/orders/{orderId}/returns*` | CustomerOrderController | ROLE_CUSTOMER | so sánh `customerId` | `CustomerReturnService:64,199,259` | OK |
| GET/POST/DELETE · `/customer/wishlist*` | CustomerWishlistController | ROLE_CUSTOMER | `find/deleteByCustomerId...` | `CustomerWishlistController:50,99` | OK |

### 3.3 Public / guest controllers

| Method · Endpoint | Auth | Ghi chú | Status |
|---|---|---|---|
| GET · `/products/**`, `/categories/**`, `/brands/**`, `/articles/**`, `/pages/**`, `/menus/**`, `/sliders`, `/home-videos`, `/settings/public`, `/address/**`, `/search*` | public | read-only catalog/content | OK |
| POST · `/products/*/reviews` | public | submit review (status PENDING + honeypot) | OK |
| GET · `/products/{productId}/reviews` | public | chỉ review APPROVED | OK |
| GET · `/orders/lookup` | public | yêu cầu `orderNumber` + `orderKey` khớp chính xác | OK |
| GET · `/warranties/lookup` | public | chỉ cần `serial` — xem F3 | REVIEW |
| POST · `/contact` | public | honeypot; rate-limit qua `RateLimitingFilter` | OK |
| `/cart/**`, `/checkout`, `/orders/quick-buy` | guest hoặc customer | cô lập theo session/cookie hoặc `customerId` | OK |
| GET · `/api/internal/redirect`, `/redirects/active`, POST `/redirects/hit/{id}` | permitAll ở Spring, **token-gate ở controller** | `X-Internal-Token` deny-by-default (`InternalRedirectController:112`) | OK |

### 3.4 Auth controllers

| Method · Endpoint | Auth | Status |
|---|---|---|
| POST · `/auth/login`, `/auth/refresh`, `/auth/logout` | public | OK |
| GET · `/auth/me` | `.authenticated()` | OK (xem mục 9) |
| POST · `/customer/auth/{register,login,refresh,logout,password/forgot,password/reset}`, GET/POST `verify-email` | public | OK |
| POST · `/customer/auth/resend-verification` | authenticated | OK |

---

## 4. Frontend / Admin / Mobile Guard Matrix

| App | Route/Component | Required role | UI guard | API endpoint | Backend guard | 401/403 handling | Status |
|---|---|---|---|---|---|---|---|
| web | `/tai-khoan/**` (5 account route) | đăng nhập (không role) | `AccountShell` redirect khi `anonymous` | `/customer/**` | ✓ `hasRole(CUSTOMER)` + ownership | redirect qua auth state, **không** redirect trên HTTP 401/403 | OK (F4) |
| web | `/thanh-toan` (checkout) | guest cho phép | không guard cứng (cố ý — guest checkout) | `/checkout` | ✓ session-based | — | OK |
| admin | LoginScreen gate | — | `authState.status==='unauthenticated'` → LoginScreen | `/auth/login` | ✓ public | — | OK |
| admin | 30+ route | permission (không phải role) | `routePermission()` + `hasPermission()` chặn render; menu lọc theo permission | `/api/v1/admin/**` | ✓ `requirePermission()` controller-level | 401 → refresh+retry; cuối cùng → login. 403 → `ApiClientError` generic | OK (F4) |
| mobile | `/tai-khoan/**`, `/thanh-toan` (8 route) | đăng nhập | `app_router` redirect khi chưa auth | `/customer/**` | ✓ `hasRole(CUSTOMER)` + ownership | lỗi → `ApiException`, **không** auto-redirect login | OK (F4) |
| mobile | — | — | `api_endpoints.dart` **không có** path `/admin/*` | — | — | — | OK |

**Role naming consistency**: backend authority `ROLE_<role>` (Spring convention). bigbike-admin
**không check role string** — chỉ check permission string (`hasPermission`), khớp 1:1 với
`PermissionCatalog`. Customer dùng `ROLE_CUSTOMER`. → **Không có role-mismatch.**
Điểm nhỏ: `adminApi.js` fallback `roles: ['ADMIN']` khi payload thiếu — chỉ ảnh hưởng hiển thị,
không ảnh hưởng enforcement (backend luôn enforce permission từ DB theo role thật trong JWT).

---

## 5. IDOR / Ownership Findings

**Kết quả: KHÔNG phát hiện IDOR.** Mọi endpoint customer nhận `{id}` path param đều verify
resource thuộc về user hiện tại trước khi trả về/sửa.

| # | Domain | Endpoint | Cơ chế ownership | Vị trí | Kết quả |
|---|---|---|---|---|---|
| O-1 | Order detail | `GET /customer/orders/{orderId}` | so sánh `customerId.equals(order.getCustomerId())` → 404 nếu lệch (không leak tồn tại) | `OrderReadService.java:96-104` | SAFE |
| O-2 | Order list | `GET /customer/orders` | Specification predicate `customerId` ở tầng DB | `OrderReadService.java:69` | SAFE |
| O-3 | Order cancel | `PATCH /customer/orders/{orderId}/cancel` | so sánh `customerId` → `AccessDeniedException` | `CustomerOrderCancelService.java:33` | SAFE |
| O-4 | Return detail | `GET /customer/orders/returns/{returnId}` | so sánh `customerId` → 404 | `CustomerReturnService.java:259` | SAFE |
| O-5 | Return create | `POST /customer/orders/{orderId}/returns` | so sánh `customerId` của order → 404 | `CustomerReturnService.java:64` | SAFE |
| O-6 | Return eligibility | `GET /customer/orders/{orderId}/return-eligibility` | `NOT_OWNER` cùng shape với `ORDER_NOT_FOUND` (chống enumeration) | `CustomerReturnService.java:199` | SAFE |
| O-7 | Address update/delete | `PATCH/DELETE /customer/addresses/{id}` | `addressRepo.findByIdAndCustomerId(id, customerId)` → 404 | `CustomerAddressService.java:64,80` | SAFE |
| O-8 | Wishlist remove | `DELETE /customer/wishlist/{productId}` | `deleteByCustomerIdAndProductId(customerId, productId)` | `CustomerWishlistController.java:99` | SAFE |
| O-9 | Cart item | `PATCH/DELETE /cart/items/{itemId}` | cart resolve theo `customerId` (auth) hoặc guest cookie; item thuộc cart đã resolve | `CartController.java:140-162` | SAFE |
| O-10 | Guest order lookup | `GET /orders/lookup` | yêu cầu `orderKey` khớp chính xác | `OrderReadService.java:120` | SAFE |

**Admin & ownership (F6, Info — không phải lỗi)**: admin endpoint **không** có row-level
ownership — bất kỳ admin có permission `orders.read` đều xem được mọi order/customer. Đây là
**đúng thiết kế** cho hệ vận hành tập trung. Không có khái niệm "admin chỉ thấy data của
mình". Lưu ý để rõ ràng, không cần fix.

---

## 6. Public Endpoint Data Exposure Audit

| Surface | Field nhạy cảm? | Internal ID? | PII? | Đánh giá |
|---|---|---|---|---|
| `GET /products/**`, `/categories/**`, `/brands/**` | Không | slug (public) | Không | OK |
| `GET /articles/**`, `/pages/**`, `/menus/**` | Không | — | Không | OK |
| `GET /products/{id}/reviews` | Không — chỉ review APPROVED + `authorName` do người gửi tự nhập | — | authorName tự nhập, không phải account PII | OK |
| `GET /orders/lookup` | Trả chi tiết order — nhưng cần `orderNumber`+`orderKey` khớp | order id | có (địa chỉ giao) nhưng token-gated | OK |
| `GET /warranties/lookup` | `WarrantyLookupResponse` = serial, tên SP, ngày BĐ/KT, status, daysLeft | Không | **Không PII** (không tên/SĐT/email khách) | OK về data, xem F3 về enumeration |
| `POST /customer/auth/register`, `login` | — | — | — | login dùng dummy-verify constant-time chống user enumeration; lỗi generic | OK |
| `GET /settings/public` | Chỉ setting đánh dấu public | — | Không | OK |
| `/api/internal/**` | Redirect rule (source/target path) | redirect id | Không | token-gate deny-by-default ở controller | OK |
| Error 401/403/500 | — | — | — | message generic, **không leak stacktrace** (`GlobalExceptionHandler`) | OK |

---

## 7. Admin Permission Audit

| Module | Action | Permission | Ai làm được |
|---|---|---|---|
| Dashboard | xem | `orders.read` | ADMIN, SUPER_ADMIN, SHOP_MANAGER |
| Product/Catalog | CRUD | `products.read/update`, `catalog.*` | ADMIN, SUPER_ADMIN, SHOP_MANAGER (read), EDITOR (read) |
| Order | xem/sửa status/fulfillment | `orders.read/write` | ADMIN, SUPER_ADMIN, SHOP_MANAGER |
| Order | refund | `orders.write` | ADMIN, SUPER_ADMIN, SHOP_MANAGER |
| POS | bán | `pos.read/write` | ADMIN, SUPER_ADMIN, SHOP_MANAGER |
| POS | price override | `pos.price_override` (nhạy cảm) | ADMIN, SUPER_ADMIN |
| POS | refund | `pos.refund` (nhạy cảm) | ADMIN, SUPER_ADMIN, SHOP_MANAGER (V112) |
| Receivables | write-off / override limit | `receivables.write_off/override_limit` (nhạy cảm) | ADMIN, SUPER_ADMIN |
| Customer | xem/sửa | `customers.read/write` | ADMIN, SUPER_ADMIN, SHOP_MANAGER |
| Warranty | xem/void | `warranty.read/write` | ADMIN, SUPER_ADMIN, SHOP_MANAGER |
| Content/Media | CRUD | `content.*`, `media.*` | ADMIN, SUPER_ADMIN, EDITOR, AUTHOR (CONTRIBUTOR read) |
| Settings | sửa | `settings.write` (nhạy cảm) | ADMIN, SUPER_ADMIN |
| Admin users | tạo/sửa | `admin-users.write` (nhạy cảm) | ADMIN, SUPER_ADMIN |
| Roles | sửa | `roles.write` (nhạy cảm) | ADMIN, SUPER_ADMIN |
| Audit logs | xem | `audit-logs.read` (nhạy cảm) | ADMIN, SUPER_ADMIN |

- **Phân tầng OK**: permission nhạy cảm (settings/admin-users/roles/receivables write-off,
  price override) chỉ thuộc ADMIN/SUPER_ADMIN. SHOP_MANAGER/EDITOR/AUTHOR/CONTRIBUTOR bị giới
  hạn đúng phạm vi.
- **UI/backend không lệch về enforcement**: bigbike-admin lọc menu + chặn route theo đúng
  permission string mà backend kiểm. Khác biệt: admin UI **không phân tầng theo role** — mọi
  admin đăng nhập thấy cùng cấu trúc menu, chỉ item nào thiếu permission thì ẩn (F6, Low — UX,
  không phải lỗ hổng vì backend vẫn enforce).
- **Quan sát over-permissive nhỏ**: `EDITOR` giữ `inventory.read` là compat-grant từ V121 (đã
  ghi chú trong `PERMISSION_MATRIX.md`). Không phải lỗi — chờ business xác nhận EDITOR
  content-only thì mới gỡ.

---

## 8. Customer Permission Audit

| Domain | Customer chỉ truy cập data của mình? | IDOR risk | Endpoint không nên gọi được? |
|---|---|---|---|
| Profile (`/customer/me`) | ✓ qua `principal.customerId()` | Không | — |
| Address | ✓ `findByIdAndCustomerId` | Không | — |
| Cart / Checkout | ✓ session/customer isolation | Không | — |
| Order list/detail | ✓ Specification + so sánh customerId | Không | — |
| Cancel order | ✓ so sánh customerId | Không | — |
| Return request | ✓ so sánh customerId trên order & return | Không | — |
| Wishlist | ✓ repo filter customerId | Không | — |
| Warranty lookup | public, không gắn customer | n/a | — |
| Payment | không có endpoint customer-facing riêng (payment nằm trong order) | n/a | — |
| Notification | chỉ admin-facing; không có customer notification API | n/a | — |
| Review | submit public (authorName tự nhập, không gắn account) | n/a | — |

**Customer gọi admin endpoint?** Tầng URL `/api/v1/admin/**` chỉ `.authenticated()` → customer
đăng nhập **đi qua được tầng URL**. Tại controller, `requirePermission()` thấy principal là
`CustomerPrincipal` (không phải `AdminPrincipal`) → rơi xuống nhánh dev-header → với
`dev-header-enabled=false` (mặc định) ném `UnauthorizedException` (401). → **Mặc định: customer
bị chặn.** Rủi ro khi `dev-header-enabled=true`: xem **F2**.

---

## 9. Error / Auth Response Contract

| Tình huống | HTTP | Body | Đánh giá |
|---|---|---|---|
| Thiếu token / token sai / hết hạn | 401 | `{"error":{"code":"UNAUTHORIZED","message":"Authentication required.","details":[]},"meta":{...}}` | `RestAuthenticationEntryPoint` — OK |
| Đã auth nhưng thiếu quyền (Spring layer) | 403 | `{"error":{"code":"FORBIDDEN","message":"Access denied.",...}}` | `RestAccessDeniedHandler` — OK |
| Thiếu permission (controller `requirePermission`) | 403 | `ForbiddenException` → `{"error":{"code":"FORBIDDEN",...}}` | OK |
| Customer chạm admin endpoint, dev-header off | 401 | `UnauthorizedException` "No authenticated admin principal." | OK |
| Lỗi không lường trước | 500 | message generic, **không stacktrace** (log server-side) | `GlobalExceptionHandler:88-89` — OK |
| `/auth/me` profile prod chưa implement | 501 | `AUTH_NOT_IMPLEMENTED` | quan sát từ `AuthProfileGuardTest` |

**Client handling**: bigbike-admin xử lý 401 tốt (refresh + retry 1 lần, thất bại → login).
bigbike-web & bigbike_mobile convert lỗi thành message generic, một số flow không tự redirect
login khi 401/403 → **F4 (Low)**.

---

## 10. Test Coverage

| Module / Endpoint | Test 401 | Test 403 | Test owner | Test non-owner | Thiếu | Priority |
|---|---|---|---|---|---|---|
| Admin endpoint (no token) | ✓ `AdminAuthSecurityTest` | ✗ | n/a | n/a | test 403 (admin thiếu permission) | High |
| Admin endpoint (token sai/hết hạn) | ✓ `AdminAuthSecurityTest` | — | — | — | — | — |
| `/auth/me` | ✓ | — | — | — | — | — |
| Public catalog/content | ✓ (accessible) | — | — | — | — | — |
| Customer → admin endpoint | ✗ | ✗ | — | — | **test customer session bị 401/403 ở admin** | High |
| Order ownership | ✗ | ✗ | ✗ | ✗ | **owner vs non-owner** | High |
| Address ownership | ✗ | ✗ | ✗ | ✗ | **owner vs non-owner** | High |
| Return ownership | ✗ | ✗ | ✗ | ✗ | **owner vs non-owner** | Medium |
| Wishlist ownership | ✗ | ✗ | ✗ | ✗ | owner vs non-owner | Medium |
| Public lookup (order/warranty) sai key | ✗ | — | — | — | test key sai → 404 | Medium |
| Disabled/locked customer | một phần (`CustomerSessionFilter` check) | — | — | — | test session sau khi account bị disable | Low |

Test bảo mật hiện có: `AdminAuthSecurityTest`, `AuthProfileGuardTest`, `AdminAuthApiTest`,
`Phase1DCustomerAuthTest`. → Có nền tảng nhưng **thiếu hẳn nhóm IDOR owner/non-owner và
customer→admin** (F5).

---

## 11. Findings

### F1 — Admin URL guard chỉ `.authenticated()`, không chặn theo role — ✅ FIXED

- **Severity**: Medium · **Type**: `OVER_PERMISSIVE` · **Status**: FIXED
- **Module**: backend security
- **Location**: `bigbike-backend/.../config/SecurityConfig.java`
- **Evidence (trước fix)**: `.requestMatchers("/api/v1/admin/**").authenticated()` — bất kỳ
  principal đã xác thực nào (kể cả `ROLE_CUSTOMER`) đều qua được tầng URL. Toàn bộ
  authorization admin nằm ở `requirePermission()` gọi thủ công dòng đầu mỗi controller method.
- **Problem**: Không có defense-in-depth. Nếu **một** controller method tương lai quên gọi
  `requirePermission()`, endpoint đó lộ cho **mọi user đăng nhập** (gồm customer).
- **Lưu ý quan trọng**: `.authenticated()` là một fix P0 trước đó (xem `RbacUrlGateIntegrationTest`)
  — nó thay cho `hasRole("ADMIN")` cũ vốn chặn nhầm EDITOR và **custom role**. Vì vậy fix mới
  **không được** dùng allowlist 7 role cứng (sẽ chặn custom role).
- **Fix đã áp dụng**: thay bằng blocklist —
  `.requestMatchers("/api/v1/admin/**").access(new WebExpressionAuthorizationManager(
  "isAuthenticated() and !hasRole('CUSTOMER')"))`. Cho phép **mọi admin role (built-in lẫn
  custom)** qua tầng URL, nhưng chặn `ROLE_CUSTOMER` ngay tại đó (403). Anonymous → 401.
- **Verification**: `RbacUrlGateIntegrationTest` (custom role vẫn qua), `RbacSecurityTest`
  (customer session → 403), full suite 1176 test pass.

### F2 — Dev-header bypass: customer leo quyền thành admin — ✅ FIXED

- **Severity**: High · **Type**: `MISSING_BACKEND_GUARD` · **Status**: FIXED
- **Module**: backend auth
- **Location**: `DevAdminAuthService.requirePermission()`
- **Evidence (trước fix)**: customer đăng nhập (`CustomerPrincipal` + `ROLE_CUSTOMER`) qua
  được URL gate `.authenticated()` (F1) → tại `requirePermission()`, principal ≠
  `AdminPrincipal` → rơi xuống nhánh dev-header → nếu `dev-header-enabled=true`,
  `currentAdminUser()` với header `X-Admin-Role` trống **mặc định trả `"ADMIN"`** → cấp toàn
  quyền admin cho customer mà không cần gửi header nào.
- **Impact**: Privilege escalation customer → admin nếu dev-header bật ở môi trường thật.
- **Fix đã áp dụng**: trong `requirePermission()`, ngay sau nhánh `AdminPrincipal`, thêm:
  nếu `auth.getPrincipal() instanceof CustomerPrincipal` → ném `UnauthorizedException` ngay,
  **không** rơi xuống nhánh dev-header. Customer không bao giờ chạm tới đường dev-header nữa,
  bất kể `dev-header-enabled` bật hay tắt. Lưu ý: check hẹp đúng `CustomerPrincipal` để không
  phá pattern dev-auth hợp lệ của test (`AdminRedirectApiTest.devAuth()`).
- **Phòng thủ 2 tầng sau fix**: (1) F1 URL gate chặn `ROLE_CUSTOMER` (403); (2) F2 chặn
  `CustomerPrincipal` ở controller. Dù một tầng bị nới lỏng trong tương lai, tầng còn lại
  vẫn giữ.
- **Khuyến nghị bổ sung (chưa làm — không bắt buộc)**: document trong `DEPLOYMENT_GUIDE.md` /
  `.env.example` rằng `BIGBIKE_AUTH_DEV_HEADER_ENABLED` CHỈ dùng cho test; cân nhắc gỡ hẳn
  dev-header path khỏi production code về sau.
- **Verification**: `RbacSecurityTest.customerSessionCannotReachAdminEndpoint`,
  `AdminRedirectApiTest` (devAuth path không bị phá), full suite 1176 test pass.

### F3 — Public warranty lookup thiếu rate-limit (serial enumeration)

- **Severity**: Medium · **Type**: `DATA_EXPOSURE`
- **Location**: `bigbike-backend/.../api/public_/PublicWarrantyController.java:30-57`
- **Evidence**: `GET /api/v1/warranties/lookup?serial=` chỉ cần `serial`, không yêu cầu token
  phụ (khác `OrderLookupController` cần `orderNumber`+`orderKey`).
- **Problem**: Nếu serial number tuần tự/đoán được, kẻ tấn công enumerate được trạng thái bảo
  hành mọi serial. **Lưu ý giảm nhẹ**: `WarrantyLookupResponse` **không chứa PII** (chỉ serial,
  tên SP, ngày, status, daysLeft) — không leak tên/SĐT/email khách hàng.
- **Impact**: Thấp về PII; trung bình về business intelligence (đối thủ map được tồn kho/bán
  hàng qua serial). Có `RateLimitingFilter` toàn cục nhưng không có ngưỡng riêng cho endpoint
  này.
- **Recommended fix**: thêm rate-limit riêng cho `/warranties/lookup`; cân nhắc yêu cầu thêm
  một định danh phụ (vd ngày mua / mã đơn) như order lookup. Quyết định business.
- **Auto-fix allowed**: No · **NEEDS_CONFIRMATION**: Yes (đổi behavior public API).

### F4 — Client web/mobile không auto-redirect khi 401/403

- **Severity**: Low · **Type**: `MISSING_UI_GUARD`
- **Location**: `bigbike-web/lib/api/client-api.ts:51-57`;
  `bigbike_mobile/lib/core/api/api_client.dart` `_ErrorInterceptor`
- **Evidence**: cả hai convert lỗi HTTP thành Error/`ApiException` generic. bigbike-web dựa
  vào auth-state subscription để redirect; bigbike_mobile không tự redirect login khi session
  hết hạn giữa chừng.
- **Problem**: UX — user gặp lỗi generic thay vì được đưa về login / thông báo "phiên hết hạn".
  Không phải lỗ hổng (backend vẫn enforce đúng).
- **Recommended fix**: thêm xử lý 401 → refresh/redirect login; 403 → thông báo "không đủ
  quyền" tường minh. Backlog UI, ngoài phạm vi phase này.
- **Auto-fix allowed**: No · **NEEDS_CONFIRMATION**: No (chỉ là backlog UI).

### F5 — Thiếu test bảo mật cho IDOR và customer→admin

- **Severity**: Medium · **Type**: `MISSING_TEST`
- **Location**: `bigbike-backend/src/test/java/.../api/`
- **Evidence**: có `AdminAuthSecurityTest` (401 cơ bản) nhưng **không** có test: customer
  session gọi admin endpoint, customer A truy cập data customer B (orders/addresses/returns/
  wishlist), public lookup sai key.
- **Impact**: Regression bảo mật (vd quên `requirePermission`, hỏng ownership check) không bị
  CI bắt.
- **Recommended fix**: thêm test class `RbacSecurityTest` (đã thực hiện trong phase này — xem
  mục 13).
- **Auto-fix allowed**: **Yes** (thêm test, không đổi behavior) · **NEEDS_CONFIRMATION**: No.

### F6 — Admin UI không phân tầng theo role

- **Severity**: Low · **Type**: `UI_INFO`
- **Location**: `bigbike-admin/src/App.jsx` (NAV + `routePermission`)
- **Evidence**: bigbike-admin lọc menu/route theo **permission**, không theo role. Mọi admin
  thấy cùng cấu trúc menu; item thiếu permission thì ẩn, route thiếu permission hiện
  "permission denied".
- **Problem**: UX — AUTHOR/CONTRIBUTOR thấy cấu trúc menu đầy đủ nhưng nhiều mục trống. Không
  phải lỗ hổng — backend enforce đúng.
- **Recommended fix**: tùy chọn — hiển thị badge role ở header; gom menu theo role. Backlog UX.
- **Auto-fix allowed**: No · **NEEDS_CONFIRMATION**: No.

### F7 — `PERMISSION_MATRIX.md` mô tả sai tầng Spring Security của `/api/v1/admin/**`

- **Severity**: Low · **Type**: `DOC_STALE`
- **Location**: `docs/engineering/PERMISSION_MATRIX.md:49`
- **Evidence**: doc ghi "`/api/v1/admin/**` | `ROLE_ADMIN` in Spring Security, with
  controller-level permission checks". Thực tế `SecurityConfig.java:91` chỉ
  `.authenticated()`, **không** `hasRole("ADMIN")`.
- **Problem**: Doc mô tả sai cơ chế tầng URL → gây hiểu nhầm khi thêm endpoint mới.
- **Fix đã áp dụng**: cập nhật mô tả `/api/v1/admin/**` cho khớp `SecurityConfig` sau khi F1
  được fix (URL gate = `isAuthenticated() and !hasRole('CUSTOMER')`).
- **Status**: FIXED.

---

## 12. Recommended RBAC Source of Truth

- **`PERMISSION_MATRIX.md` đã tồn tại** — giữ làm tài liệu boundary. Sau audit này: đã sửa
  dòng mô tả `/api/v1/admin/**` cho khớp code (F7).
- **Generate permission matrix từ annotation**: hiện không khả thi vì authorization là
  `requirePermission()` runtime, không phải annotation. → Nếu sau này chuyển sang
  `@EnableMethodSecurity` + `@PreAuthorize`, có thể generate matrix tự động từ annotation.
- **Chuẩn hóa role constant**: backend nên có một enum/constant chung cho 7 authority
  `ROLE_*` thay vì string ghép trong `JwtAuthFilter`/`SecurityConfig` — giảm nguy cơ lệch tên.
- **Document public/admin/customer boundary**: bổ sung vào `PERMISSION_MATRIX.md` một bảng
  liệt kê rõ endpoint public (không auth) để mỗi PR mới đối chiếu.
- **Test template 401/403/IDOR**: dùng `RbacSecurityTest` (mục 13) làm khuôn cho endpoint mới.

---

## 13. Fix Plan

### Đã fix (verified — full suite 1176 test pass)

| ID | Hành động | File |
|---|---|---|
| F1 | URL gate `/api/v1/admin/**` → `WebExpressionAuthorizationManager("isAuthenticated() and !hasRole('CUSTOMER')")` — chặn customer, vẫn cho mọi admin role (built-in + custom) | `SecurityConfig.java` |
| F2 | `requirePermission()` ném `UnauthorizedException` ngay khi principal là `CustomerPrincipal`, không rơi vào nhánh dev-header | `DevAdminAuthService.java` |
| F5 | Thêm test class `RbacSecurityTest`: customer session → admin (403), no-token → admin (401), IDOR owner vs non-owner (address), public lookup sai key (404) | `RbacSecurityTest.java` |
| F7 | Sửa `PERMISSION_MATRIX.md` mô tả admin URL guard cho khớp `SecurityConfig` | `docs/engineering/PERMISSION_MATRIX.md` |

### Backlog non-blocking (cần quyết định / ngoài phạm vi phase này)

| ID | Hành động đề xuất | Ghi chú |
|---|---|---|
| F3 | Rate-limit riêng cho `/warranties/lookup`; cân nhắc yêu cầu định danh phụ | Cần quyết định business |
| F4 | web/mobile xử lý 401/403 → redirect login + thông báo rõ | Backlog UI |
| F6 | Admin UI hiển thị role / gom menu theo role | Backlog UX |
| F2+ | Document `BIGBIKE_AUTH_DEV_HEADER_ENABLED` chỉ cho test; cân nhắc gỡ hẳn dev-header path | Hardening |

### Test coverage fixes (backlog)

- Thêm test 403 cho admin thiếu permission cụ thể (vd EDITOR gọi `settings.write`).
- Thêm test return/wishlist non-owner.
- Thêm test session sau khi account bị disable.

### UI guard fixes (backlog)

- F4: web/mobile xử lý 401/403 → redirect/login + thông báo tường minh.
- F6: admin hiển thị role; tùy chọn gom menu theo role.

### Documentation fixes

- F7 (đã làm). Bổ sung bảng public-endpoint boundary vào `PERMISSION_MATRIX.md` (đề xuất).

### Product / permission decisions cần xác nhận

- F3: có yêu cầu thêm định danh phụ cho warranty lookup không?
- F2: có giữ dev-header path trong production code không, hay gỡ hẳn?
- EDITOR `inventory.read`: business xác nhận EDITOR content-only thì gỡ (đã ghi trong
  `PERMISSION_MATRIX.md` V121 note).

---

## 14. Acceptance Criteria

| Tiêu chí | Trạng thái |
|---|---|
| Không có endpoint admin public | ✅ Đạt — 170/170 admin endpoint sau `/api/v1/admin/**` `.authenticated()` + `requirePermission()` |
| Không có customer endpoint thiếu ownership check | ✅ Đạt — 10/10 surface enforce (mục 5) |
| Không có IDOR nghiêm trọng | ✅ Đạt — không phát hiện IDOR |
| UI guard và backend guard không lệch | ✅ Đạt — admin UI permission khớp backend; web/mobile không có khái niệm role |
| Role/authority naming thống nhất | ✅ Đạt — `ROLE_*` nhất quán; admin client check permission, không check role |
| 401/403 response predictable | ✅ Đạt — JSON envelope chuẩn, không leak stacktrace |
| Public endpoint không leak data nhạy cảm | ✅ Đạt — không PII; ⚠️ F3 (enumeration, không PII) |
| Endpoint nhạy cảm có test 401/403 | ⚠️ Một phần — customer→admin 401/403 có qua `RbacSecurityTest`; test 403 per-permission còn backlog |
| Endpoint owner-based có test owner/non-owner | ⚠️ Một phần — address có; order/return/wishlist còn backlog |
| Permission matrix được document rõ | ✅ Đạt — `PERMISSION_MATRIX.md` đã sync (F7) |
| Defense-in-depth ở tầng URL cho admin | ✅ Đạt — F1 đã fix (URL gate chặn `ROLE_CUSTOMER`) |
| Không có đường leo quyền customer → admin | ✅ Đạt — F2 đã fix (phòng thủ 2 tầng) |

**Verdict cuối: `RBAC_READY`**

Hệ thống an toàn để production. Không có lỗ hổng đang khai thác được, không có IDOR, không
có endpoint admin lộ. Hai điểm yếu defense-in-depth (F1, F2) đã được vá và verified bằng
full test suite (**1176 test pass, 0 failure**). Backlog còn lại — F3 (warranty enumeration,
không leak PII, cần quyết định business), F4/F6 (UX), test coverage owner/non-owner cho
return/wishlist — đều **non-blocking**.
