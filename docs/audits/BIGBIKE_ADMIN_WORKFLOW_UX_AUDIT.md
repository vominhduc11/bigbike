# BigBike Admin Workflow UX Audit

> Phạm vi: `bigbike-admin/` — toàn bộ source code SPA admin (React 19 + Vite).
> Loại audit: AUDIT + TRACE + REPORT. Không refactor, không fix hàng loạt.
> Ngày: 2026-05-16. Người thực hiện: Senior Product UX Engineer / Frontend Architect / Workflow Auditor.
> Phương pháp: đọc code trực tiếp, trace UI action → API → cache update. Mọi finding đều "inferred from code" trừ khi ghi khác.

---

## 1. Executive Summary

**Overall status: PARTIAL** — admin có thể vận hành hầu hết nghiệp vụ, nhưng còn một số lỗ hổng an toàn workflow cần xử lý trước khi coi là production-ready.

### Admin workflow hiện đã đủ production chưa?
Gần đủ. Các workflow lớn (Order, Product, POS, Receivables, Serial, Return) đều có loading/error/success state, confirm cho phần lớn action nguy hiểm, permission gating ở cả menu/route/button. Tuy nhiên có **2 lỗ hổng self-lockout** (admin tự khoá quyền của chính mình) và **vài action tài chính/đổi trạng thái thiếu confirm** — đây là nhóm phải xử lý trước.

### Top workflow risks
1. **Self-lockout ở quản lý Admin Users** — admin có thể tự đổi role / tự vô hiệu hoá tài khoản chính mình (không có guard so sánh với user đang đăng nhập).
2. **Self-lockout ở quản lý Roles** — admin (không phải SUPER_ADMIN) có thể gỡ `roles.write` khỏi chính role của mình.
3. **Đổi trạng thái thanh toán đơn hàng không có confirm** — nút "Huỷ thanh toán" và "Xác nhận đã thu tiền" thực thi ngay khi bấm.
4. **Cập nhật trạng thái đổi trả (REFUNDED/REJECTED) không confirm và không validate số tiền hoàn** — có thể hoàn tiền nhầm số.
5. **State machine map hardcode ở frontend** (payment, serial, return) — dễ lệch với backend khi rule đổi.

### Top missing / unclear admin actions
- Không có màn hình **duyệt yêu cầu huỷ đơn** (approve/reject cancel request) — cần xác minh nghiệp vụ với backend/web.
- **Warranty**: không có tìm kiếm theo khách/serial; chỉ filter theo trạng thái. Không có action kích hoạt/gia hạn — chỉ "huỷ phiếu".
- Order không có **timeline lịch sử đổi trạng thái** ngay trong màn chi tiết (chỉ có Notes + Audit Log toàn cục).

### Top unsafe actions
- "Huỷ thanh toán" (payment → CANCELLED) — không confirm.
- "Xác nhận đã thu tiền" (payment → PAID) — không confirm, ghi nhận tiền thật.
- Cập nhật đổi trả → REFUNDED — không confirm, `refundAmount` không bắt buộc/không validate.
- ConfirmDialog dùng chung luôn hiển thị nút đỏ "danger" + chữ "Xác nhận" cho cả action không nguy hiểm (vd khôi phục sản phẩm) — gây nhầm mức độ.

---

## 2. Audit Scope

### Folders/files đã kiểm tra
- `bigbike-admin/src/App.jsx` — routing, route guard, permission gating, nav groups.
- `bigbike-admin/src/lib/` — `auth.jsx`, `authStorage.js`, `adminApi.js` (interceptor 401, error class, các hàm order/return/receivable), `confirm.js`, `serialStateMachine.js`.
- `bigbike-admin/src/components/` — `ConfirmDialog.jsx`, `AdminShell.jsx` (mount point ConfirmDialog).
- `bigbike-admin/src/screens/` — đã đọc đầy đủ: `LoginScreen`, `OrderListScreen`, `OrderDetailScreen`, `ProductListScreen`, `ProductDetailScreen` (phần save/publish), `CategoryListScreen` (phần đầu), `SerialListScreen`, `WarrantyListScreen`, `ReturnListScreen`, `ReceivablesListScreen`, `ReceivableDetailScreen`, `AdminUsersScreen`, `RolesScreen`, `SettingsScreen`, `PosScreen`. Đọc một phần: `InventoryScreen` (handlers), `ContentDetailScreen` (handlers).
- `main.jsx` — Toaster (sonner), QueryClientProvider.

### Scripts đã chạy
- `npx eslint .` — **PASS**, không có lỗi/cảnh báo.

### Phần chưa kiểm tra được / lý do
- Backend (`bigbike-backend`) — không trong phạm vi; mọi giả định về backend reject/state machine đều đánh dấu `NEEDS_BACKEND_VERIFICATION`.
- `bigbike-web` / `bigbike_mobile` — không kiểm tra; cross-app contract đánh dấu `NEEDS_WEB_VERIFICATION` / `NEEDS_MOBILE_VERIFICATION`.
- `DashboardScreen`, `AuditLogListScreen`, `MediaLibraryScreen`, `MenuScreen`, `SliderListScreen`, `HomeVideoListScreen`, `RedirectListScreen`, `CouponListScreen`, `ReviewListScreen/ReviewDetailScreen`, `BrandListScreen/BrandDetailScreen`, `ContactInboxScreen`, `ShippingScreen`, `ReportsScreen`, `CategoryDetailScreen` — chỉ xem cấu trúc/route, **chưa trace chi tiết từng action**. Không kết luận FAIL/PASS cho các màn này.
- `InventoryScreen` (1901 dòng) — chỉ trace handler chính (stock-in, import serial, đổi trạng thái serial), chưa đọc toàn bộ.

---

## 3. Admin Workflow Inventory

| Workflow | Route/screen | Actor | Main goal | Main states | Main actions | APIs/hooks | UX status | Notes |
|---|---|---|---|---|---|---|---|---|
| Đăng nhập / session | `LoginScreen`, `auth.jsx`, `adminApi` interceptor | Mọi admin | Vào hệ thống, giữ phiên | initializing/unauthenticated/authenticated/error | login, silent refresh, logout | `loginAdmin`, `refreshAccessToken`, `fetchCurrentAdminUser` | PASS | 401 → refresh → logout tự động; form lost khi session hết hạn |
| Dashboard | `/admin/dashboard` `DashboardScreen` | Sales/quản lý | Tổng quan vận hành | — | xem KPI | (chưa trace) | NOT_AUDITED | — |
| Product list | `/admin/products` `ProductListScreen` | Catalog | Lọc, xoá mềm, khôi phục, sao chép | DRAFT/PUBLISHED/HIDDEN/TRASH | delete, restore, duplicate, export | `fetchProducts`, `softDeleteProduct`, `restoreProduct` | PASS | Confirm đủ cho delete/restore |
| Product create/edit | `/admin/products/new`, `/:id` `ProductDetailScreen` | Catalog | Tạo/sửa/đăng sản phẩm | DRAFT/PUBLISHED/HIDDEN/TRASH | save draft, publish (có checklist), validate | `createProduct`, `updateProduct`, zod schema | PASS | Autosave + beforeunload + draft recovery + publish checklist |
| Category | `/admin/categories` `CategoryListScreen` | Catalog | Quản lý cây danh mục, sắp xếp | visibility | drag-sort, edit | `fetchCategories`, `updateCategory` | PARTIAL | Detail chưa trace; sort dùng DnD |
| Order list | `/admin/orders` `OrderListScreen` | Sales | Lọc/tìm đơn | 7 trạng thái đơn | xem detail, export CSV | `fetchOrders`, WS `/topic/admin/orders` | PASS | Thiếu cột trạng thái thanh toán |
| Order detail | `/admin/orders/:id` `OrderDetailScreen` | Sales | Đổi trạng thái, vận chuyển, ghi chú, refund, RMA | order/payment/fulfillment status | status change, payment change, fulfillment, note, refund, create return | `updateOrderStatus`, `fetchOrderAllowedTransitions`, `updateOrderPaymentStatus`, `updateOrderFulfillment`, `RefundModal` | PARTIAL | Order status dùng allowed-transitions từ BE (tốt); payment status thiếu confirm |
| Cancel / approve-cancel | (không có màn riêng) | — | Duyệt yêu cầu huỷ đơn | — | — | — | MISSING | Chỉ có transition CANCELLED trực tiếp; xem §9 |
| Payment / Debt (công nợ) | `/admin/receivables`, `/:id` | Kế toán | Ghi nhận thu, xoá nợ | OPEN/PARTIALLY_PAID/OVERDUE/CLOSED/WRITTEN_OFF | record payment, write-off | `recordReceivablePayment`, `writeOffReceivable` | PASS | Validate số tiền tốt, write-off có cảnh báo irreversible |
| POS (bán tại quầy) | `/admin/pos` `PosScreen` | Nhân viên quầy | Bán hàng, thu tiền, hoàn tiền | cart → order → receipt | add cart, override price, checkout (CASH/CARD/CREDIT), refund | `posCreateOrder`, `posCreateRefund`, `fetchCustomerCredit` | PASS | Idempotency key, credit gating, refund gating tốt |
| Inventory / stock-in | `/admin/inventory` `InventoryScreen` | Kho | Nhập kho, import serial, đổi trạng thái serial | serial status | adjustStock, import serial, status change | `adjustStock`, import API | PARTIAL | Logic đổi trạng thái serial bị lặp với SerialListScreen |
| Serial | `/admin/serials` `SerialListScreen` | Kho | Tra cứu & đổi trạng thái serial | IN_STOCK/RESERVED/SOLD/RETURNED/INSPECTION/DAMAGED/SCRAPPED | đổi trạng thái (có note bắt buộc, confirm terminal) | `fetchAllSerials`, `updateSerialStatus`, `serialStateMachine.js` | PASS | State machine hardcode FE |
| Warranty | `/admin/warranties` `WarrantyListScreen` | Hậu mãi | Tra & huỷ phiếu BH | ACTIVE/EXPIRED/VOIDED | void warranty | `fetchWarranties`, `voidWarranty` | PARTIAL | Không có search; chỉ filter status |
| Return / RMA | `/admin/returns` `ReturnListScreen` | Sales | Xử lý đổi trả | PENDING/APPROVED/REJECTED/RECEIVED/COMPLETED/REFUNDED | update status | `fetchReturns`, `updateReturnStatus` | PARTIAL | Thiếu confirm; refundAmount không validate |
| Customer | `/admin/customers`, `/:id` | Sales | Xem/sửa khách, tín dụng | — | (chưa trace chi tiết) | `fetchCustomers` | NOT_AUDITED | — |
| Admin Users | `/admin/admin-users` `AdminUsersScreen` | SUPER_ADMIN | Tạo/sửa tài khoản admin | ACTIVE/DISABLED/SUSPENDED | create, edit role/status/password | `createAdminUser`, `updateAdminUser` | FAIL | Không chặn self-lockout — xem §7 ISSUE-01 |
| Roles & permissions | `/admin/roles` `RolesScreen` | SUPER_ADMIN | Tạo/sửa/xoá role, gán quyền | system/custom | edit perms, create, delete role | `fetchRoles`, `updateRolePermissions`, `createRole`, `deleteRole` | PARTIAL | Confirm tốt; nhưng không chặn self-lockout — xem §7 ISSUE-02 |
| Content / Banner | `/admin/content`, `/sliders`, `/home-videos` | Editor | Tạo/đăng nội dung | DRAFT/PUBLISHED/... | save, publish, archive | (trace 1 phần `ContentDetailScreen`) | PARTIAL | Archive có confirm |
| Settings | `/admin/settings` `SettingsScreen` | SUPER_ADMIN | Cấu hình hệ thống | dirty/clean per field | batch save, discard | `fetchSettings`, `batchUpdateSettings` | PARTIAL | Save không confirm; field tài chính không validate kỹ |

---

## 4. Workflow Trace Matrix

### 4.1 Order — Đổi trạng thái đơn hàng
| Step | UI location | User action | Component/function | API/hook | Request payload | Response expected | UI update | Error handling | Risk |
|---|---|---|---|---|---|---|---|---|---|
| 1 | `OrderDetailScreen` mục "Trạng thái đơn hàng" | Bấm nút trạng thái (vd "Hoàn thành đơn") | `handleStatusChange(s)` | — | — | — | — | — | — |
| 2 | — | Nếu CANCELLED/COMPLETED/REFUNDED hoặc BACS ON_HOLD→PROCESSING | `showConfirm()` | — | — | — | Mở ConfirmDialog | — | Confirm có; nội dung rõ |
| 3 | — | — | `updateOrderStatus(orderId, newStatus)` | `PATCH /admin/orders/:id/status` | `{ status }` | `{ data: { item } }` | `applyOrderUpdate()` patch cache `['order',id]` + invalidate `['orders']` | `catch` → `toast.error(err.message)` | Mismatch nếu BE đổi state machine — nhưng allowed-transitions lấy từ BE nên thấp |
| 4 | useEffect deps `order.orderStatus` | — | `fetchOrderAllowedTransitions(orderId)` | `GET /admin/orders/:id/allowed-transitions` | — | `{ data: [transitions] }` | `setAllowedTransitions` | `.catch` → `setAllowedTransitions([])` | **Network error → hiện "không có chuyển trạng thái" giả** (xem ISSUE-09) |

### 4.2 Order — Đổi trạng thái thanh toán
| Step | UI location | User action | Component/function | API/hook | Payload | Response | UI update | Error | Risk |
|---|---|---|---|---|---|---|---|---|---|
| 1 | `OrderDetailScreen` mục "Thanh toán" | Bấm "Xác nhận đã thu tiền" / "Huỷ thanh toán" | `handlePaymentStatusChange(s)` | — | — | — | — | — | **Không có `showConfirm` ở bước này** |
| 2 | — | — | `updateOrderPaymentStatus(orderId, newStatus)` | `PATCH /admin/orders/:id/payment-status` | `{ paymentStatus }` | `{ data: { item } }` | `applyOrderUpdate` | `toast.error` | Ghi nhận/huỷ tiền tức thì, không undo (ISSUE-03) |

### 4.3 Receivables — Ghi nhận thanh toán công nợ
| Step | UI location | User action | Component/function | API/hook | Payload | Response | UI update | Error | Risk |
|---|---|---|---|---|---|---|---|---|---|
| 1 | `ReceivablesListScreen`/`ReceivableDetailScreen` | Bấm "Ghi nhận thanh toán" | `setPaymentTarget(item)` → `RecordPaymentModal` | — | — | — | Mở modal | — | — |
| 2 | Modal | Nhập số tiền (`min 1`, `max outstanding`), method, ref, note | client guard `validAmount = >0 && <=outstanding` | — | — | — | Nút disable khi invalid | — | Validate client tốt |
| 3 | — | Xác nhận | `recordReceivablePayment(id, body)` | `POST /admin/receivables/:id/payments` | `{ amount, paymentMethod, referenceNumber?, note? }` | `{ data: receivable }` | invalidate `['receivable',id]`, `['receivables']`, `['receivable-summary']` | `onError → setError` hiện trong modal | Tốt — đầy đủ |

### 4.4 Return / RMA — Cập nhật trạng thái
| Step | UI location | User action | Component/function | API/hook | Payload | Response | UI update | Error | Risk |
|---|---|---|---|---|---|---|---|---|---|
| 1 | `ReturnListScreen` → `ReturnDetailModal` | Bấm "Cập nhật trạng thái" | mở form, `setNewStatus(next[0])` | — | — | — | — | — | `NEXT_STATUSES` hardcode FE |
| 2 | Form | Chọn status mới; nếu REFUNDED nhập `refundAmount` (optional) | `handleSubmit` | — | — | — | — | — | **REFUNDED không bắt buộc số tiền; không confirm** |
| 3 | — | Xác nhận | `updateReturnStatus(id, body)` | `PATCH /admin/returns/:id/status` | `{ status, adminNote?, refundAmount? }` | return object | `setDetail`, `onUpdate` → invalidate `['returns']` | `catch → setError` | ISSUE-04 |

### 4.5 Serial — Đổi trạng thái
| Step | UI location | User action | Component/function | API/hook | Payload | Response | UI update | Error | Risk |
|---|---|---|---|---|---|---|---|---|---|
| 1 | `SerialListScreen` → `SerialDetailModal` | "Đổi trạng thái" | `SERIAL_ALLOWED_TRANSITIONS[status]` | — | — | — | hiện danh sách transition hợp lệ | — | Map hardcode FE (`serialStateMachine.js`) |
| 2 | Form | Chọn status; DAMAGED/SCRAPPED bắt buộc note; SCRAPPED cần bấm xác nhận lần 2 | `handleStatusChange` | — | — | — | — | — | Confirm terminal tốt |
| 3 | — | — | `updateSerialStatus(id, status, note?)` | (mutation) | `{ status, note? }` | `{ item }` | invalidate `['serials']`, `setSelected` | `catch → setError` trong modal | Logic này lặp lại ở `InventoryScreen` (ISSUE-06) |

### 4.6 POS — Tạo đơn bán tại quầy
| Step | UI location | User action | Component/function | API/hook | Payload | Response | UI update | Error | Risk |
|---|---|---|---|---|---|---|---|---|---|
| 1 | `PosScreen` | Thêm sản phẩm vào giỏ | `addToCart` | — | — | — | cart persist localStorage (TTL 8h, userId check) | — | — |
| 2 | `PaymentModal` | Chọn method, KH, xác nhận | `handleSubmit` | `posCreateOrder(payload)` | `{ paymentMethod, items[], posIdempotencyKey, customerId?, ... }` | order | `onSuccess` → clear cart, mở ReceiptModal | `catch → setError` | Idempotency key có; CREDIT check eligibility/limit |
| 3 | `ReceiptModal` | In hoá đơn / hoàn tiền | `printReceipt` / `RefundDialog` | `posCreateRefund` | `{ refundAmount, reason, note? }` | — | toast + cập nhật `refundedAmount` | `catch → toast.error` | Refund full-only, gated `canRefund` |

---

## 5. State-Based Action Findings

| State | Allowed actions (kỳ vọng) | Current UI actions | Wrong/missing | Risk | Recommended fix |
|---|---|---|---|---|---|
| Order — mọi trạng thái | Chỉ transition hợp lệ | `OrderDetailScreen` chỉ render nút trong `allowedTransitions` lấy từ BE | Đúng | Thấp | Giữ nguyên — pattern chuẩn |
| Order — CANCELLED/FAILED/REFUNDED | Không đổi payment status | Nút payment ẩn khi `orderStatus ∈ {CANCELLED,FAILED,REFUNDED}` (`OrderDetailScreen` dòng 407) | Đúng | Thấp | — |
| Payment — UNPAID | → PAID, → CANCELLED | `PAYMENT_TRANSITIONS` hardcode FE | Map cố định, không lấy từ BE | Trung bình | Lấy allowed payment transitions từ BE, hoặc đối chiếu `docs/business/STATE_MACHINES.md` |
| Payment — PAID | → UNPAID (và Refund qua modal) | Có nút "Đặt lại chưa thanh toán" + Refund section | Đúng | Thấp | — |
| Fulfillment — UNFULFILLED | → PROCESSING (không nhảy thẳng SHIPPED) | Chỉ hiện "Bắt đầu chuẩn bị hàng" | Đúng, chặn nhảy bước | Thấp | — |
| Fulfillment — PROCESSING | → SHIPPED (bắt buộc mã vận đơn) | Form ship yêu cầu trackingNumber | `required` ở input nhưng `handleFulfillmentUpdate` vẫn gửi nếu trống (chỉ thêm field khi `.trim()` có giá trị) → BE phải reject | Trung bình | Validate trackingNumber ở FE trước khi gọi API |
| Serial — SCRAPPED (terminal) | Không action | `transitions = []`, không hiện nút | Đúng | Thấp | — |
| Serial — DAMAGED/SCRAPPED | Bắt buộc lý do | `NOTE_REQUIRED_STATUSES` enforce | Đúng | Thấp | — |
| Return — PENDING | → APPROVED / REJECTED | `NEXT_STATUSES.PENDING` đúng | Không confirm khi REJECTED | Trung bình | Thêm confirm cho REJECTED |
| Return — RECEIVED | → COMPLETED / REFUNDED | Đúng | REFUNDED không confirm, không validate tiền | Cao | Confirm + bắt buộc refundAmount > 0 |
| Warranty — ACTIVE | Có thể VOID | Nút "Huỷ phiếu bảo hành" + confirm inline | Đúng | Thấp | — |
| Warranty — VOIDED | Không action | Nút void ẩn khi `status === 'VOIDED'` | Đúng | Thấp | — |
| Product — TRASH | restore, không cho delete tiếp | Nút delete `disabled` khi `isTrashed`; nút restore hiện | Đúng | Thấp | — |
| AR (receivable) — CLOSED/WRITTEN_OFF | Không record payment / write-off | `closed` ẩn cả 2 nút | Đúng | Thấp | — |

**Đánh giá chung State-Based UX:** tốt. Điểm mạnh nhất là Order status dùng endpoint `allowed-transitions` của backend — UI không tự đoán. Điểm yếu: payment/serial/return vẫn dùng map hardcode FE (ISSUE-05).

---

## 6. Permission UX Findings

| Role/permission assumption | Menu/page/action affected | Current behavior | Problem | Recommended fix | Needs BE verify? |
|---|---|---|---|---|---|
| `permissions` chứa `*` hoặc key cụ thể | Toàn bộ nav + route | `App.jsx` `hasPermission` + `visibleNavGroups` ẩn nav item không có quyền; route guard chặn page với `StatePanel` "Permission denied" | Đúng, nhất quán 3 lớp (menu/route + button props) | — | Không |
| Action-level write | Nút trên từng screen | Phần lớn gated bằng prop `canUpdate`/`canRecordPayment`/... từ `App.jsx` `hasPermission(...)` | Hợp lý | — | Không |
| 403 sau khi bấm | Mọi mutation | `requestJson` không xử lý riêng 403 — ném `ApiClientError` → `toast.error(message)` từ backend | Vì button đã gated theo quyền nên 403-after-click hiếm; thông báo dựa vào message backend (có thể là tiếng Anh) | Map 403 sang câu giải thích tiếng Việt thống nhất ("Bạn không có quyền thực hiện thao tác này.") | Có (kiểm tra message BE) |
| Disabled action không có lý do | `ProductListScreen` nút "Thêm sản phẩm" | Khi `!canUpdate`: nút disable + `title` = "yêu cầu quyền" + label đổi thành "Không có quyền" | Tốt | — | Không |
| Self-permission | `RolesScreen` | Admin sửa được role mình đang thuộc | Có thể tự gỡ `roles.write` của chính role mình → mất quyền quản trị | Chặn sửa role mà current user đang mang, hoặc cảnh báo; SUPER_ADMIN không sửa được nên vẫn còn "đường thoát" | Có (BE có guard?) |
| Self-account | `AdminUsersScreen` | Admin sửa được chính tài khoản mình (role/status) | Tự đổi role thấp hơn hoặc tự DISABLE → tự khoá | Truyền `currentUserId`, khoá field role/status khi `editUser.id === currentUserId` | Có (BE có guard?) |
| `audit-logs.read` | Route `/admin/audit-logs` | `AuditLogListScreen` render không qua `routePermission` check riêng (`routePermission` trả `'audit-logs.read'` — có) | Đúng | — | Không |

**Nhận xét:** RBAC ở tầng điều hướng rất chắc (3 lớp). Lỗ hổng nằm ở chỗ **không phân biệt "user khác" và "chính mình"** trong 2 màn quản trị nhạy cảm nhất.

---

## 7. Critical Workflow Issues

### ISSUE-01 — Admin có thể tự khoá tài khoản / tự hạ quyền chính mình
- **Severity:** HIGH
- **Workflow:** Admin User Management
- **Location:** `bigbike-admin/src/screens/AdminUsersScreen.jsx` (`openEdit`, `submitEdit`, `requestEditSubmit`); `bigbike-admin/src/App.jsx` dòng 404–405 (`<AdminUsersScreen canUpdate=... />`).
- **Description:** Màn `AdminUsersScreen` không nhận `userId` của người đang đăng nhập. Admin có quyền `admin-users.write` có thể mở chính tài khoản mình và đổi `status` sang `DISABLED`/`SUSPENDED` hoặc đổi `role` sang role thấp hơn. Có confirm cho "sensitive change" nhưng confirm không phân biệt đây là tài khoản của chính mình.
- **Evidence from code:** `App.jsx` truyền `userId` cho `PosScreen` và `ContactInboxScreen` nhưng **không** cho `AdminUsersScreen`. `submitEdit` gửi thẳng `updateAdminUser(editUser.id, payload)` không kiểm tra `editUser.id` có phải current user.
- **Impact:** Admin tự khoá quyền → mất truy cập, phải nhờ SUPER_ADMIN/devops khôi phục. Trong shop nhỏ chỉ 1 admin có thể gây lockout toàn hệ thống.
- **Recommended fix:** Truyền `currentUserId={authState.user?.id}` vào `AdminUsersScreen`; khi `editUser.id === currentUserId` thì khoá (disable) field `role` và `status`, hiện ghi chú "Không thể tự đổi quyền/khoá tài khoản của chính bạn".
- **Can auto-fix safely?** NO — đụng prop từ `App.jsx` + logic permission.
- **Needs confirmation?** YES (`NEEDS_CONFIRMATION` + `NEEDS_BACKEND_VERIFICATION` — backend có thể đã chặn; nếu có thì đây thuần là UX gap).

### ISSUE-02 — Admin có thể tự gỡ quyền của role mình đang mang (self-lockout qua Roles)
- **Severity:** HIGH
- **Workflow:** Roles & Permissions
- **Location:** `bigbike-admin/src/screens/RolesScreen.jsx` (`handleSave`, `RoleDetail`); `App.jsx` dòng 420–421.
- **Description:** `RolesScreen` không biết role của người đang đăng nhập. Một admin không phải SUPER_ADMIN có thể chọn role của chính mình (vd `ADMIN`), gỡ `roles.write` (hoặc bất kỳ quyền nào) rồi lưu → tất cả user mang role đó mất quyền tương ứng.
- **Evidence from code:** `handleToggle`/`applyToggle` cho phép bỏ mọi permission; `handleSave` gọi `updateRolePermissions(selected.id, Array.from(draft))` không cảnh báo nếu `selected.id` là role của current user. `RoleDetail` chỉ chặn sửa `SUPER_ADMIN` (`isSuperAdmin`).
- **Impact:** Mất quyền quản trị diện rộng. Có giảm nhẹ: `SUPER_ADMIN` không sửa được nên vẫn còn "đường thoát" qua tài khoản super admin.
- **Recommended fix:** Truyền role hiện tại; khi sửa role mà current user đang mang, cảnh báo rõ trong `SaveSummaryDialog` ("Bạn đang sửa role của chính mình — gỡ quyền có thể khiến bạn mất truy cập"), và chặn gỡ `roles.read`/`roles.write` khỏi role đó.
- **Can auto-fix safely?** NO.
- **Needs confirmation?** YES (`NEEDS_BACKEND_VERIFICATION`).

### ISSUE-03 — Đổi trạng thái thanh toán đơn hàng không có xác nhận
- **Severity:** HIGH
- **Workflow:** Order Management — Payment
- **Location:** `bigbike-admin/src/screens/OrderDetailScreen.jsx` `handlePaymentStatusChange` (dòng 252–263).
- **Description:** Nút "Xác nhận đã thu tiền" (UNPAID→PAID) và "Huỷ thanh toán" (UNPAID→CANCELLED) gọi API ngay khi bấm, không qua `showConfirm`. Trong khi đó đổi *order status* nguy hiểm thì có confirm. Việc đánh dấu PAID = ghi nhận tiền thật; "Huỷ thanh toán" cũng là thao tác tài chính.
- **Evidence from code:** `handleStatusChange` (dòng 210) có `showConfirm` cho DANGEROUS/BACS; `handlePaymentStatusChange` hoàn toàn không có bước confirm.
- **Impact:** Bấm nhầm → ghi nhận sai dòng tiền, ảnh hưởng đối soát (BigBike không có cổng thanh toán tự động — admin tự đối soát, xem memory `project_bigbike_no_auto_payment`).
- **Recommended fix:** Thêm `showConfirm` cho cả `PAID` và `CANCELLED`, nội dung nêu rõ hệ quả tài chính và mã đơn.
- **Can auto-fix safely?** NO (thay đổi UX của thao tác tài chính — cần product duyệt wording).
- **Needs confirmation?** YES.

### ISSUE-04 — Cập nhật đổi trả sang REFUNDED không confirm & không validate số tiền hoàn
- **Severity:** HIGH
- **Workflow:** Return / RMA
- **Location:** `bigbike-admin/src/screens/ReturnListScreen.jsx` `ReturnDetailModal.handleSubmit` (dòng 80–102), form REFUNDED (dòng 225–231).
- **Description:** Khi chuyển return sang `REFUNDED`, ô `refundAmount` là tuỳ chọn (`min="0"`, không `required`). `handleSubmit` gửi `refundAmount: refundAmount ? Number(refundAmount) : undefined`. Không có confirm. Admin có thể submit REFUNDED với số tiền trống/0/sai mà không cảnh báo. `REJECTED` (từ chối khách) cũng không confirm.
- **Evidence from code:** form không validate `refundAmount > 0`; nút submit chỉ `disabled={saving || !newStatus}`.
- **Impact:** Hoàn tiền sai số hoặc bỏ sót số tiền hoàn; từ chối đổi trả nhầm.
- **Recommended fix:** Bắt buộc `refundAmount > 0` khi status = REFUNDED; thêm confirm cho REFUNDED và REJECTED nêu mã RMA + số tiền.
- **Can auto-fix safely?** NO (đụng workflow tài chính).
- **Needs confirmation?** YES (`NEEDS_BACKEND_VERIFICATION` — BE có thể tự suy ra refundAmount).

### ISSUE-05 — State-machine map hardcode ở frontend (payment / serial / return)
- **Severity:** MEDIUM
- **Workflow:** Order payment, Serial, Return
- **Location:** `OrderDetailScreen.jsx` `PAYMENT_TRANSITIONS` (dòng 21–26); `lib/serialStateMachine.js` `SERIAL_ALLOWED_TRANSITIONS`; `ReturnListScreen.jsx` `NEXT_STATUSES` (dòng 44–48).
- **Description:** Ba state machine này cố định trong code FE. Order *status* đã chuyển sang lấy từ BE (`allowed-transitions`) nhưng 3 cái còn lại thì chưa. Comment trong `serialStateMachine.js` tự ghi "Backend source of truth: AdminSerialService.validateTransition()".
- **Evidence from code:** so sánh `fetchOrderAllowedTransitions` (động) với 3 map tĩnh.
- **Impact:** Khi backend đổi rule, UI cho bấm action không hợp lệ → backend reject → admin bối rối; hoặc thiếu action mới.
- **Recommended fix:** Lý tưởng: thêm endpoint allowed-transitions cho payment/serial/return. Tối thiểu: đối chiếu định kỳ với `docs/business/STATE_MACHINES.md` và `docs/business/SERIAL_INVENTORY_RULES.md`.
- **Can auto-fix safely?** NO.
- **Needs confirmation?** YES (`NEEDS_BACKEND_VERIFICATION`).

### ISSUE-06 — Logic đổi trạng thái serial bị lặp ở 2 màn
- **Severity:** MEDIUM
- **Workflow:** Serial / Inventory
- **Location:** `SerialListScreen.jsx` `SerialDetailModal.handleStatusChange`; `InventoryScreen.jsx` `handleStatusChange` (dòng 1179).
- **Description:** Cả 2 màn đều cho đổi trạng thái serial nhưng chỉ `SerialListScreen` import `serialStateMachine.js`. `InventoryScreen` có logic riêng (`statusChangeValue`, kiểm tra note). Hai chỗ dễ phân kỳ (vd quy tắc note bắt buộc, danh sách transition).
- **Evidence from code:** `InventoryScreen` không import từ `serialStateMachine.js` (chỉ dùng `SERIAL_STATUS_LABELS`).
- **Impact:** Hành vi đổi trạng thái serial khác nhau tuỳ màn → admin nhầm lẫn.
- **Recommended fix:** Tách 1 component/hook `useSerialStatusChange` dùng chung; cả 2 màn import cùng `serialStateMachine.js`.
- **Can auto-fix safely?** NO (refactor cross-screen).
- **Needs confirmation?** NO.

### ISSUE-07 — Không có màn duyệt yêu cầu huỷ đơn
- **Severity:** MEDIUM
- **Workflow:** Order cancellation
- **Location:** `App.jsx` route map; `OrderDetailScreen.jsx`.
- **Description:** Admin chỉ có thể chuyển đơn sang `CANCELLED` trực tiếp (nếu transition cho phép). Không có hàng đợi / màn "yêu cầu huỷ đơn chờ duyệt" với approve/reject. Trạng thái đơn không có `CANCEL_REQUESTED` (`OrderListScreen.ORDER_STATUS_KEYS` chỉ gồm 7 trạng thái).
- **Evidence from code:** không tìm thấy route/screen/status nào liên quan "cancel request".
- **Impact:** Nếu khách (web/mobile) có thể gửi yêu cầu huỷ, admin không có nơi xử lý → yêu cầu bị bỏ sót.
- **Recommended fix:** Xác minh nghiệp vụ — nếu có luồng yêu cầu huỷ thì cần màn duyệt; nếu không thì xác nhận đây là thiết kế cố ý.
- **Can auto-fix safely?** NO.
- **Needs confirmation?** YES (`NEEDS_BACKEND_VERIFICATION`, `NEEDS_WEB_VERIFICATION`, `NEEDS_MOBILE_VERIFICATION`).

### ISSUE-08 — ConfirmDialog dùng chung luôn là nút "danger" + chữ "Xác nhận"
- **Severity:** MEDIUM
- **Workflow:** Toàn hệ thống (mọi `showConfirm`)
- **Location:** `bigbike-admin/src/components/ConfirmDialog.jsx` (dòng 38), `lib/confirm.js`.
- **Description:** `showConfirm(message, title)` không có tham số variant/label. Nút xác nhận luôn `variant="danger"` (đỏ) và label `t('common.confirm')` ("Xác nhận"). Các action không nguy hiểm cũng dùng nó — vd `ProductListScreen.handleRestore` ("Khôi phục sản phẩm") hiện nút đỏ; `RolesScreen.handleSelectRole` confirm "Huỷ thay đổi?" cũng đỏ.
- **Evidence from code:** `ConfirmDialog.jsx` hardcode `variant="danger"`; mọi caller chỉ truyền `(message, title)`.
- **Impact:** Mất tín hiệu phân biệt mức độ nguy hiểm — admin quen thấy nút đỏ ở mọi nơi sẽ bấm theo phản xạ, làm giảm tác dụng cảnh báo cho action thật sự huỷ hoại dữ liệu.
- **Recommended fix:** Mở rộng `showConfirm` nhận `{ variant, confirmLabel }`; mặc định danger giữ nguyên, action không phá huỷ dùng variant thường + label phù hợp ("Khôi phục", "Bỏ thay đổi").
- **Can auto-fix safely?** NO (đụng API dùng chung nhiều nơi).
- **Needs confirmation?** NO.

### ISSUE-09 — `allowed-transitions` lỗi mạng bị nuốt → hiện "không có thao tác" giả
- **Severity:** MEDIUM
- **Workflow:** Order detail
- **Location:** `OrderDetailScreen.jsx` useEffect dòng 195–208; `adminApi.fetchOrderAllowedTransitions` dòng 912–925.
- **Description:** Nếu gọi `/allowed-transitions` lỗi (mạng/timeout/5xx), cả `.catch` của useEffect và bản thân `fetchOrderAllowedTransitions` đều nuốt lỗi và trả `[]`. UI khi đó hiện "Không có chuyển trạng thái khả dụng" — nhưng thực ra do lỗi tải, không phải do nghiệp vụ.
- **Evidence from code:** `.catch(() => setAllowedTransitions([]))` + trong API `catch → return { transitions: [] }`.
- **Impact:** Admin tưởng đơn không thể đổi trạng thái, không thao tác được mà không biết là lỗi tạm thời.
- **Recommended fix:** Phân biệt "đã tải, rỗng" vs "lỗi tải"; khi lỗi hiện thông báo + nút thử lại.
- **Can auto-fix safely?** NO (đổi error UX).
- **Needs confirmation?** NO.

### ISSUE-10 — `fetchReturnsByOrder` nuốt lỗi → đơn hiện "chưa có đổi trả" giả
- **Severity:** LOW
- **Workflow:** Order detail — mục RMA
- **Location:** `adminApi.fetchReturnsByOrder` (dòng 2248–2256); dùng ở `OrderDetailScreen` useEffect dòng 188–193.
- **Description:** `fetchReturnsByOrder` `catch { return [] }`. Nếu API lỗi, mục "Đổi trả (RMA)" hiện "Chưa có yêu cầu đổi trả nào" dù thực tế có thể có.
- **Impact:** Admin bỏ sót yêu cầu đổi trả đang tồn tại.
- **Recommended fix:** Hiện trạng thái lỗi riêng cho khối RMA.
- **Can auto-fix safely?** NO (đổi error UX, cần thêm state).
- **Needs confirmation?** NO.

### ISSUE-11 — Lưu Settings không có xác nhận; field tài chính validate yếu
- **Severity:** MEDIUM
- **Workflow:** Settings
- **Location:** `SettingsScreen.jsx` `handleSave`, `validateValue`.
- **Description:** Lưu batch setting (gồm `tax_rate`, `order_min_amount`, `low_stock_threshold`) không có confirm. `validateValue` chỉ kiểm email/url/phone — không kiểm `tax_rate` là số hợp lệ trong [0,1], không kiểm `order_min_amount` là số ≥ 0. Một giá trị sai ở `tax_rate` ảnh hưởng trực tiếp giá checkout của web.
- **Evidence from code:** `validateValue` không có nhánh cho threshold/rate/amount dù `INPUT_TYPE_MAP` map chúng sang `type="number"`.
- **Impact:** Nhập sai thuế suất/ngưỡng → sai giá, sai cảnh báo tồn kho.
- **Recommended fix:** Validate range cho field số; thêm confirm khi lưu nhóm setting tài chính/vận hành.
- **Can auto-fix safely?** NO.
- **Needs confirmation?** YES (`NEEDS_BACKEND_VERIFICATION` — backend cũng nên validate).

### ISSUE-12 — Order list không có cột trạng thái thanh toán dù có filter
- **Severity:** LOW
- **Workflow:** Order list
- **Location:** `OrderListScreen.jsx` `columns` (dòng 85–109), filter `paymentStatus`.
- **Description:** Có bộ lọc "Thanh toán" (`paymentStatus`) và được gửi tới API (`adminApi.fetchOrders` dòng 874), nhưng bảng không có cột hiển thị trạng thái thanh toán. Lọc xong admin không phân biệt được các dòng.
- **Impact:** Khó đối soát trực quan.
- **Recommended fix:** Thêm cột "Thanh toán" vào bảng đơn.
- **Can auto-fix safely?** YES về kỹ thuật (chỉ thêm 1 cột render từ field đã có trong response) nhưng cần xác nhận `paymentStatus` luôn có trong `normalizeOrder`.
- **Needs confirmation?** YES (xác nhận data shape — không tự thêm trong phase audit).

---

## 8. Workflow-by-Workflow Detail

### 8.1 Product Management Workflow
- **Create/Edit:** `ProductDetailScreen` rất chắc — zod validation (`createProductSchema`), `focusFirstError`, autosave vào storage theo `autosaveKey`, `beforeunload` guard khi `isDirty`, draft recovery, status pill dirty/clean. Sao chép sản phẩm qua `sessionStorage` (`ProductListScreen.handleDuplicate`).
- **Publish/unpublish:** publish lần đầu kích hoạt `showPublishChecklist` (quality checklist) trước khi lưu (`handleSave` dòng 1706 → `confirmPublish`). Nút "Lưu nháp" + nút publish/update tách biệt rõ. PASS.
- **Featured/homepage:** `ProductListScreen` cảnh báo khi số sản phẩm trong khối homepage vượt `HOMEPAGE_BLOCK_LIMITS` (FEATURED_GRID 12, RECOMMENDED_CAROUSEL 10) — surplus bị web bỏ qua âm thầm. UX chủ động tốt. Cảnh báo có cảnh báo cross-app rõ ràng.
- **Delete/restore:** soft delete + restore, đều có `showConfirm`, có `deletingId`/`restoringId` để disable nút, nút delete `disabled` khi đã TRASH. PASS.
- **Image/media/specs:** dùng `MediaPickerModal`/`ImageUrlInput` (chưa trace sâu).
- **Contract web/backend:** homepage block limit là mirror thủ công của `bigbike-web/app/page.tsx` — `NEEDS_WEB_VERIFICATION` khi web đổi.
- **Verdict: PASS.**

### 8.2 Category Management Workflow
- `CategoryListScreen` có tree view, drag-sort (`@dnd-kit`), breadcrumb map, highlight search. `CategoryDetailScreen` (785 dòng) **chưa trace chi tiết** — không kết luận.
- Theo memory `project_bigbike_product_module_cleanup`: sản phẩm khoá 1 danh mục (single-category). Cần đối chiếu khi audit `CategoryDetailScreen`.
- Lỗi khi xoá category đang được dùng: chưa trace — `NOT_AUDITED`.
- **Verdict: PARTIAL (chưa đủ dữ liệu cho detail/delete).**

### 8.3 Order Management Workflow
- **List/detail:** `OrderListScreen` có search debounce 250ms, filter status/payment/date, sort, pagination, export CSV, WS realtime invalidate `['orders']` (chỉ khi ở trang đầu, filter mặc định). Detail dùng `fetchOrderDetail` + `applyOrderUpdate` patch cache.
- **Confirm/approve order:** dùng nút trong `allowedTransitions` từ BE. PASS.
- **Update status:** confirm cho CANCELLED/COMPLETED/REFUNDED và cho BACS ON_HOLD→PROCESSING (nêu rõ auto-mark PAID). PASS.
- **Cancel order:** chỉ transition CANCELLED trực tiếp. Approve/reject cancel request: **không có** — xem ISSUE-07.
- **Payment status:** thiếu confirm — ISSUE-03.
- **Shipping/fulfillment:** chỉ hiện cho `fulfillmentType === 'DELIVERY'`; chặn nhảy bước UNFULFILLED→PROCESSING→SHIPPED→DELIVERED; mã vận đơn yêu cầu khi SHIPPED (nhưng validate FE chưa chặt — xem §5).
- **Serial assignment:** không thấy trong Order detail — gán serial diễn ra ở luồng khác (POS/Inventory). `NEEDS_BACKEND_VERIFICATION`.
- **Timeline/audit:** Order detail có Notes + timestamps + lịch sử RMA, nhưng **không có lịch sử đổi trạng thái đơn** ngay tại màn (có Audit Log toàn cục riêng).
- **Verdict: PARTIAL** (vì ISSUE-03, ISSUE-07, ISSUE-09).

### 8.4 Payment / Debt Workflow (Receivables)
- `ReceivablesListScreen` + `ReceivableDetailScreen` dùng react-query, SummaryCard KPI bấm để filter, tab ALL/OPEN/OVERDUE/CLOSED.
- **Record payment:** `RecordPaymentModal` validate `amount > 0 && amount <= outstanding`, nút disable khi invalid, hiện số dư sau thu, invalidate đủ 3 query key. PASS.
- **Write-off:** `WriteOffModal` bắt buộc lý do, hiển thị banner "không thể hoàn tác", nút `variant="danger"`. PASS.
- **Refund/cancel payment:** không thuộc màn này (refund ở Order/POS).
- **Quan hệ order completed/unpaid:** receivable tạo từ đơn CREDIT/POS (`createdFrom`). Không cho thao tác khi CLOSED/WRITTEN_OFF.
- **Verdict: PASS** — đây là module workflow chắc chắn nhất.

### 8.5 Inventory / Serial Workflow
- **Stock-in:** `InventoryScreen.adjustStock(variantId, qty, 'IN', note, serials)` — nhập kho có thể kèm serial.
- **Import serial:** parse từ Excel/text, hiển thị `inserted`/`skipped`, retry skipped. Toast rõ số lượng.
- **Đổi trạng thái serial:** 2 nơi (`SerialListScreen`, `InventoryScreen`) — logic lặp, ISSUE-06. `SerialListScreen` chuẩn hơn (dùng `serialStateMachine.js`, note bắt buộc DAMAGED/SCRAPPED, double-confirm cho terminal SCRAPPED).
- **Chống trùng serial / gán serial không khả dụng:** logic nằm ở backend; FE chỉ hiển thị transition hợp lệ. `NEEDS_BACKEND_VERIFICATION`.
- **Quan hệ order/warranty:** `SerialDetailModal` có `SerialWarrantyPanel` lazy-load warranty theo serial (xử lý 404/403 riêng). PASS phần này.
- **Verdict: PARTIAL** (ISSUE-06 + chưa trace toàn bộ `InventoryScreen`).

### 8.6 Warranty Workflow
- `WarrantyListScreen` chỉ có filter trạng thái, **không có ô tìm kiếm** theo email/SĐT/serial → khó tra cứu phiếu cụ thể khi hỗ trợ khách (xem §9).
- Action duy nhất: **void** (huỷ phiếu) — confirm inline rõ "không thể hoàn tác", disable nút khi đang xử lý. PASS phần action.
- **Không có** action kích hoạt/gia hạn warranty — suy ra warranty được tạo tự động (theo serial/order). `NEEDS_BACKEND_VERIFICATION` xem có cần kích hoạt thủ công không.
- **Verdict: PARTIAL** (thiếu search).

### 8.7 Customer/User Management Workflow
- `CustomerListScreen`/`CustomerDetailScreen` **chưa trace chi tiết** — `CustomerDetailScreen` nhận `canUpdate` + `hasPermission` (có credit management). `NOT_AUDITED`.
- POS có nhánh tra cứu customer + tín dụng (`fetchCustomerCredit`) — đã trace, hoạt động tốt.
- **Verdict: NOT_AUDITED.**

### 8.8 Admin Role/Permission Workflow
- **Create role:** `CreateRoleDialog` auto-gen ID từ tên, validate name/id bắt buộc.
- **Edit permissions:** checkbox theo nhóm; permission "sensitive" có `ConfirmSensitiveDialog` khi toggle; trước khi lưu có `SaveSummaryDialog` liệt kê added/removed + cảnh báo nếu có sensitive. Rất tốt.
- **Delete role:** `DeleteRoleDialog` confirm; role `isSystem` không cho xoá; `SUPER_ADMIN` không sửa được.
- **Prevent self-lockout:** **KHÔNG có** — ISSUE-02. SUPER_ADMIN uneditable là giảm nhẹ một phần.
- **Unknown permissions:** hiển thị riêng nhóm "quyền khác" khi BE có quyền FE catalog chưa biết — xử lý chủ động tốt.
- **Verdict: PARTIAL** (vì ISSUE-02).

### 8.9 Content/Banner/Homepage Workflow
- `ContentDetailScreen` có `publishStatus` (DRAFT/PUBLISHED/...), save → toast, archive → `showConfirm` (dòng 346). `SliderListScreen`/`HomeVideoListScreen`/`RedirectListScreen` dùng `showConfirm` — chưa trace chi tiết.
- Preview trước publish: chưa trace.
- Contract với `bigbike-web`: `NEEDS_WEB_VERIFICATION`.
- **Verdict: PARTIAL.**

### 8.10 Settings/Config Workflow
- `SettingsScreen` tab theo nhóm, dirty per-field, badge số thay đổi/tab, batch save all-or-nothing, discard theo tab. Ẩn nhóm `SECURITY` và field `store_currency`/`store_timezone`/`tax_label` (hợp lý cho shop VN).
- **Thiếu confirm khi lưu**; **validate field số yếu** — ISSUE-11.
- Lỗi save: do batch all-or-nothing nên gán lỗi lên *tất cả* field dirty (không map được lỗi từng field) — chấp nhận được với batch.
- Không có history/audit hiển thị trong màn.
- **Verdict: PARTIAL.**

---

## 9. Missing Workflow UX

| Workflow | Vì sao cần | Impact nếu thiếu | Đề xuất | Priority |
|---|---|---|---|---|
| Duyệt yêu cầu huỷ đơn (approve/reject cancel) | Khách có thể yêu cầu huỷ trước khi giao | Yêu cầu huỷ bị bỏ sót | Xác minh nghiệp vụ; nếu có thì thêm hàng đợi + màn duyệt | P1 (sau khi verify BE/web) |
| Tìm kiếm trong Warranty | Hỗ trợ khách cần tra phiếu theo serial/email/SĐT | Không tra được phiếu cụ thể, phải lướt tay | Thêm ô search vào `WarrantyListScreen` | P1 |
| Lịch sử đổi trạng thái đơn ngay trong Order detail | Admin cần biết ai/khi nào đổi trạng thái | Phải mở Audit Log toàn cục, mất ngữ cảnh | Thêm timeline trạng thái trong `OrderDetailScreen` (BE có thể đã có dữ liệu) | P2 |
| Cột trạng thái thanh toán ở Order list | Có filter nhưng không có cột | Lọc xong không phân biệt được dòng | Thêm cột "Thanh toán" | P2 |
| Confirm có phân biệt mức độ | Mọi confirm đang là nút đỏ | Loãng cảnh báo | Mở rộng `showConfirm` (ISSUE-08) | P2 |
| Phân biệt "tài khoản/role của chính mình" | Tránh self-lockout | Mất truy cập | ISSUE-01/02 | P0 |

---

## 10. Unsafe / Ambiguous Actions

| Action | Location | Vì sao unsafe/ambiguous | Current behavior | Expected safer UX | Recommended fix |
|---|---|---|---|---|---|
| Huỷ thanh toán (payment→CANCELLED) | `OrderDetailScreen.handlePaymentStatusChange` | Thao tác tài chính, không undo | Chạy ngay khi bấm | Confirm nêu mã đơn + hệ quả | ISSUE-03 |
| Xác nhận đã thu tiền (payment→PAID) | nt | Ghi nhận tiền thật | Chạy ngay khi bấm | Confirm nêu số tiền | ISSUE-03 |
| Cập nhật return → REFUNDED | `ReturnListScreen.ReturnDetailModal` | Hoàn tiền, số tiền không bắt buộc | Submit ngay, refundAmount optional | Bắt buộc số tiền > 0 + confirm | ISSUE-04 |
| Cập nhật return → REJECTED | nt | Từ chối khách | Submit ngay | Confirm | ISSUE-04 |
| Tự sửa role/khoá tài khoản mình | `AdminUsersScreen` | Self-lockout | Cho phép, chỉ confirm chung | Khoá field cho chính mình | ISSUE-01 |
| Tự gỡ quyền role mình mang | `RolesScreen` | Self-lockout | Cho phép | Cảnh báo + chặn gỡ `roles.*` | ISSUE-02 |
| Khôi phục sản phẩm | `ProductListScreen.handleRestore` | Không nguy hiểm nhưng nút confirm màu đỏ "danger" | Confirm đỏ | Nút thường + label "Khôi phục" | ISSUE-08 |
| Lưu Settings tài chính | `SettingsScreen.handleSave` | `tax_rate` sai ảnh hưởng giá web | Lưu ngay, không confirm | Confirm + validate range | ISSUE-11 |
| Đổi trạng thái vận chuyển → SHIPPED khi tracking trống | `OrderDetailScreen.handleFulfillmentUpdate` | Input `required` nhưng handler vẫn gửi nếu trống | Dựa vào BE reject | Validate FE trước khi gọi API | §5 dòng Fulfillment-PROCESSING |

---

## 11. Loading / Error / Success State Gaps

| Workflow | Missing loading | Missing error | Missing success feedback | Risk | Recommended fix |
|---|---|---|---|---|---|
| Order — allowed-transitions | Không có loading riêng | Lỗi tải bị nuốt → hiện "không có thao tác" | n/a | Admin tưởng đơn không đổi được trạng thái | ISSUE-09 |
| Order — RMA trong detail | — | `fetchReturnsByOrder` nuốt lỗi → "chưa có đổi trả" | n/a | Bỏ sót RMA | ISSUE-10 |
| Order — status/payment buttons | Có `disabled` chung khi `saving`, không có spinner trên nút đang chạy | — | Có toast | LOW — admin không biết nút nào đang chạy | Thêm trạng thái loading cho đúng nút vừa bấm |
| POS — search sản phẩm | Có `searching` flag | `.catch → setResults([])` (lỗi = rỗng) | — | Lỗi mạng hiện như "không có kết quả" | Phân biệt lỗi vs rỗng |
| Settings — save | Có (`saving`) | Lỗi gán lên mọi field dirty | Có toast "Đã lưu" | Chấp nhận được | — |
| Roles/AdminUsers list | Có | Có `StatePanel` error | Có toast/inline | OK | — |
| Receivables | Có | Có | Modal đóng khi thành công (feedback gián tiếp) | OK | Có thể thêm toast success |

Đa số screen xử lý loading/error/empty tốt qua `StatePanel`/`useAdminList`. Gap chính là **nuốt lỗi → trạng thái rỗng giả** (ISSUE-09, ISSUE-10) và pattern `.catch → []` ở POS search.

---

## 12. Data/API Contract Risks

| Workflow | Field/API | Current usage | Risk | Needs BE verify? | Recommended fix |
|---|---|---|---|---|---|
| Order payment | `PAYMENT_TRANSITIONS` (FE) vs `ALLOWED_PAYMENT_TRANSITIONS` (BE) | Map hardcode FE | Lệch khi BE đổi | YES | ISSUE-05 |
| Serial | `SERIAL_ALLOWED_TRANSITIONS` vs `AdminSerialService.validateTransition()` | Comment tự nhận BE là source of truth | Lệch | YES | ISSUE-05 |
| Return | `NEXT_STATUSES` (FE) | Map hardcode FE | Lệch | YES | ISSUE-05 |
| Return REFUNDED | `refundAmount` | Gửi `undefined` nếu trống | BE có thể tự tính hoặc reject | YES | ISSUE-04 |
| Order list | `paymentStatus` trong `normalizeOrder` | Filter gửi đi nhưng UI không render cột | Cần chắc field có trong response | YES | ISSUE-12 |
| Order fulfillment | `trackingNumber` khi SHIPPED | Chỉ gửi khi `.trim()` có giá trị | BE phải reject nếu thiếu | YES | Validate FE |
| Roles | FE `BUILTIN_CATALOG` vs `PermissionCatalog.java` | FE có fallback catalog "keep in sync" thủ công | Lệch danh sách quyền | YES | Luôn ưu tiên `fetchPermissionCatalog` (đã làm); kiểm định kỳ |
| Homepage block | `HOMEPAGE_BLOCK_LIMITS` mirror `bigbike-web/app/page.tsx` | Hardcode FE admin | Lệch khi web đổi cap | `NEEDS_WEB_VERIFICATION` | Đồng bộ qua setting hoặc API |
| Dev mock fallback | `shouldFallbackToMockOnLiveError()` = `IS_DEV` | Khi dev, lỗi live → trả mock kèm `warning` | Chỉ ảnh hưởng dev; production ném lỗi thật | NO | — (chấp nhận; `ReadOnlyBanner` hiển thị warning) |

---

## 13. Prioritized Action Plan

### P0 — Must fix before production
| Task | Workflow | Files likely affected | Risk | Complexity | Owner |
|---|---|---|---|---|---|
| Chặn self-lockout tài khoản admin (ISSUE-01) | Admin Users | `App.jsx`, `AdminUsersScreen.jsx` | Mất truy cập hệ thống | S | Fullstack (verify BE) |
| Chặn self-lockout qua Roles (ISSUE-02) | Roles | `App.jsx`, `RolesScreen.jsx` | Mất quyền quản trị | M | Fullstack |
| Thêm confirm cho đổi trạng thái thanh toán đơn (ISSUE-03) | Order | `OrderDetailScreen.jsx` | Ghi nhận sai dòng tiền | S | FE |
| Confirm + validate số tiền cho return REFUNDED/REJECTED (ISSUE-04) | Return | `ReturnListScreen.jsx` | Hoàn tiền sai | S | FE (verify BE refundAmount) |

### P1 — Should fix soon
| Task | Workflow | Files | Risk | Complexity | Owner |
|---|---|---|---|---|---|
| Phân biệt lỗi tải vs rỗng cho allowed-transitions (ISSUE-09) | Order | `OrderDetailScreen.jsx`, `adminApi.js` | Admin tưởng không thao tác được | S | FE |
| Thêm search cho Warranty | Warranty | `WarrantyListScreen.jsx` + API | Khó tra cứu hậu mãi | M | Fullstack |
| Xác minh & (nếu cần) thêm màn duyệt huỷ đơn (ISSUE-07) | Order cancel | mới | Bỏ sót yêu cầu khách | L | Product + Fullstack |
| Validate range field số trong Settings (ISSUE-11) | Settings | `SettingsScreen.jsx` | Sai thuế/ngưỡng | S | FE |
| Đồng bộ state machine FE↔BE (ISSUE-05) | Order payment/Serial/Return | `adminApi.js` + BE endpoints | Action lệch state | M | Fullstack |

### P2 — Improve later
| Task | Workflow | Files | Risk | Complexity | Owner |
|---|---|---|---|---|---|
| `showConfirm` hỗ trợ variant/label (ISSUE-08) | Toàn hệ thống | `confirm.js`, `ConfirmDialog.jsx` | Loãng cảnh báo | M | FE |
| Gộp logic đổi trạng thái serial (ISSUE-06) | Serial/Inventory | `SerialListScreen.jsx`, `InventoryScreen.jsx` | Hành vi không nhất quán | M | FE |
| Hiển thị lỗi riêng cho khối RMA trong Order detail (ISSUE-10) | Order | `OrderDetailScreen.jsx` | Bỏ sót RMA | S | FE |
| Thêm cột trạng thái thanh toán Order list (ISSUE-12) | Order list | `OrderListScreen.jsx` | Khó đối soát | S | FE (verify data shape) |
| Timeline đổi trạng thái trong Order detail | Order | `OrderDetailScreen.jsx` + API | Thiếu ngữ cảnh | M | Fullstack |
| Validate trackingNumber ở FE khi SHIPPED | Order fulfillment | `OrderDetailScreen.jsx` | 409/400 sau khi bấm | S | FE |
| Spinner đúng nút đang chạy (order status/payment) | Order | `OrderDetailScreen.jsx` | Mơ hồ action nào chạy | S | FE |

---

## 14. Fixes Applied

> Cập nhật 2026-05-16 — sau phase audit, user yêu cầu fix toàn bộ. Các sửa đổi dưới đây
> là **frontend-only**, không đổi API payload, không đổi business rule/state machine của
> backend. `npm run lint` PASS, `npm run build` PASS sau khi sửa.

| Issue | File changed | What changed | Why safe | Kết quả |
|---|---|---|---|---|
| ISSUE-08 | `lib/confirm.js`, `components/ConfirmDialog.jsx` | `showConfirm` nhận tham số thứ 3 `{ variant, confirmLabel, cancelLabel }`; nút xác nhận dùng đúng variant; thêm `whitespace-pre-line` để message nhiều dòng hiển thị đúng | Backward-compatible — mọi caller cũ `(message, title)` vẫn chạy, mặc định variant `danger` giữ nguyên hành vi cũ | Done |
| ISSUE-08 | `screens/ProductListScreen.jsx` | Confirm khôi phục sản phẩm dùng `variant: 'default'` + label "Khôi phục" | Action không phá huỷ dữ liệu | Done |
| ISSUE-01 | `App.jsx`, `screens/AdminUsersScreen.jsx` | Truyền `currentUserId`; khoá field Role + Status khi sửa chính mình; banner cảnh báo; `submitEdit` không gửi role/status cho tài khoản của chính mình | Guard thuần UX; không đổi API; backend vẫn là lớp chốt | Done |
| ISSUE-02 | `App.jsx`, `screens/RolesScreen.jsx` | Truyền `currentUserRoles`; chặn gỡ `roles.read`/`roles.write` khỏi role của chính mình + toast; banner cảnh báo trong `SaveSummaryDialog` | Guard UX; không đổi payload `updateRolePermissions` | Done |
| ISSUE-03 | `screens/OrderDetailScreen.jsx` | `handlePaymentStatusChange` thêm `showConfirm` cho `PAID` và `CANCELLED` | Chỉ thêm bước xác nhận, không đổi API | Done |
| ISSUE-04 | `screens/ReturnListScreen.jsx` | Bắt buộc `refundAmount > 0` khi REFUNDED; confirm cho REFUNDED và REJECTED; nút submit disable khi REFUNDED thiếu số tiền; label số tiền đánh dấu bắt buộc | Validation FE + confirm; payload không đổi | Done |
| ISSUE-09 | `screens/OrderDetailScreen.jsx` | Thêm state `transitionsError` + nút "Thử lại"; phân biệt lỗi tải vs danh sách rỗng | Chỉ thêm error UX | Done |
| ISSUE-10 | `lib/adminApi.js`, `screens/OrderDetailScreen.jsx` | `fetchReturnsByOrder` không nuốt lỗi nữa; màn Order detail hiện thông báo lỗi riêng cho khối RMA | `fetchReturnsByOrder` chỉ dùng ở 1 nơi | Done |
| ISSUE-11 | `screens/SettingsScreen.jsx` | `validateValue` validate `rate` ∈ [0,1] và `threshold`/`amount` ≥ 0; confirm khi lưu nhóm STORE/TAX | Validation FE + confirm; backend nên validate lại | Done |
| ISSUE-12 | `screens/OrderListScreen.jsx` | Thêm cột "Thanh toán" (đã xác nhận `paymentStatus` có trong `normalizeOrder`) | Field đã có sẵn trong response | Done |
| (§5 Fulfillment) | `screens/OrderDetailScreen.jsx` | Validate `trackingNumber` ở FE trước khi chuyển SHIPPED | Chỉ chặn sớm, không đổi API | Done |
| (§11 spinner) | `screens/OrderDetailScreen.jsx` | Thêm `pendingTarget` — nút status/payment đang chạy hiển thị "Đang lưu…" | Chỉ cải thiện feedback | Done |
| ISSUE-06 | `screens/InventoryScreen.jsx` | **Re-verify:** `InventoryScreen` thực ra ĐÃ import chung `serialStateMachine.js` — không có phân kỳ state machine như nghi ngờ ban đầu. Chỉ thêm confirm cho SCRAPPED để đồng nhất với `SerialListScreen` | Logic state machine vốn đã dùng chung | Done (downgrade) |
| i18n | `locales/vi.json`, `locales/en.json` | Thêm key `orders.colPaymentStatus`, `adminUsers.selfEditLocked`, `roles.selfLockoutBlocked`, `roles.saveOwnRoleWarning` | Chỉ thêm key mới | Done |

**Test sau pass 1:** `npm run lint` → PASS (0 lỗi/cảnh báo). `npm run build` → PASS.

---

### Pass 2 (2026-05-16) — kiểm tra backend & xử lý 3 issue còn lại

Sau pass 1, user yêu cầu kiểm tra backend (`bigbike-backend`) và fix nốt ISSUE-05, ISSUE-07, §9.

**ISSUE-07 — màn duyệt yêu cầu huỷ đơn → KHÔNG phải lỗi, không cần fix.**
Đọc `CustomerOrderCancelService.java`: BigBike **không có** khái niệm "yêu cầu huỷ chờ duyệt". Khách tự huỷ đơn của chính mình (self-service) khi đơn còn `UNPAID` và chưa `SHIPPED`/`DELIVERED` — huỷ có hiệu lực ngay, không qua admin. Khi đã thu tiền/đã giao thì khách phải liên hệ shop và xử lý qua luồng hoàn tiền/đổi trả (RMA). Vì vậy **không có gì để "duyệt"** — admin không cần màn approval. Đây là thiết kế cố ý. Audit ISSUE-07 được đóng với verdict: *no missing workflow*.

**ISSUE-05 — đồng bộ state machine: kiểm tra từng cái.**
- **Payment:** `AdminOrderService.ALLOWED_PAYMENT_TRANSITIONS` = `{UNPAID:[PAID,CANCELLED], PAID:[UNPAID], REFUNDED:[], CANCELLED:[]}` — **khớp chính xác** với FE `PAYMENT_TRANSITIONS`. Không drift.
- **Serial:** `AdminSerialService.validateTransition()` — FE `serialStateMachine.js` là tập con đúng (FE cố tình bỏ RESERVED/SOLD vì đó là transition checkout-only, admin không thao tác tay). Không drift.
- **Return:** `AdminReturnService.TRANSITIONS` có `RECEIVED → [INSPECTING, COMPLETED, REFUNDED]` và state `INSPECTING → [COMPLETED, REFUNDED]`, kèm bước kiểm tra QC từng món (`PATCH /admin/returns/{id}/items/{itemId}/inspect`, đã có sẵn từ V104). **FE thiếu hoàn toàn state INSPECTING** — đây là drift thật. Đã fix ở FE (xem dưới). Backend đã đầy đủ, không cần sửa.

| Issue | File changed | What changed | Kết quả |
|---|---|---|---|
| ISSUE-05 (return) | `screens/ReturnListScreen.jsx` | Thêm `INSPECTING` vào `STATUSES`, `NEXT_STATUSES`, `STATUS_COLORS`, `STATUS_LABELS_VI`; thêm cột "Kiểm tra QC" trong modal chi tiết với nút Đạt/Không đạt từng sản phẩm; hiển thị kết quả kiểm tra; cảnh báo khi còn món chưa kiểm tra | Done |
| ISSUE-05 (return) | `lib/adminApi.js` | Thêm `inspectReturnItem(returnId, itemId, { result, note })` → `PATCH /admin/returns/{id}/items/{itemId}/inspect` | Done |
| §9 — tìm kiếm Warranty | `WarrantyRecordJpaRepository.java`, `AdminWarrantyService.java`, `AdminWarrantyController.java` | Thêm tham số `q` — tìm theo `customerEmail` / `customerPhone` (LIKE, không phân biệt hoa thường) | Done |
| §9 — tìm kiếm Warranty | `lib/adminApi.js`, `screens/WarrantyListScreen.jsx` | `fetchWarranties` gửi `q`; thêm ô tìm kiếm có debounce 250ms vào màn Bảo hành | Done |
| §9 — docs | `docs/engineering/API_CONTRACT.md` | Cập nhật entry `GET /admin/warranties` thêm tham số `q` | Done |

> Ghi chú §9: tìm kiếm theo **số serial** chưa làm — `WarrantyRecordEntity` chỉ lưu `serialId` (UUID), số serial nằm ở `ProductSerialEntity`, cần join. Phạm vi hiện tại phủ tra cứu theo email/SĐT (kịch bản hỗ trợ khách phổ biến nhất). Tra theo số serial có thể bổ sung sau.

**Test sau pass 2:** Frontend `npm run lint` → PASS, `npm run build` → PASS. Backend `./mvnw compile` → BUILD SUCCESS.

### Còn lại — cải tiến tương lai (không phải lỗi chặn)
| Hạng mục | Ghi chú |
|---|---|
| Endpoint `allowed-transitions` cho payment/serial/return | Hiện FE và BE đang khớp; có thể expose sau để chống drift về lâu dài. Không gấp. |
| Tìm kiếm warranty theo số serial | Cần join `ProductSerialEntity`. Bổ sung khi có nhu cầu. |

---

## 15. Commands Run

| Command | Result | Notes |
|---|---|---|
| `npx eslint .` (trong `bigbike-admin/`) | PASS — không output lỗi/cảnh báo | Codebase sạch theo `eslint.config.js` |
| `git status` (đọc snapshot ban đầu) | Nhiều file `M` ở `bigbike-admin/` | Là thay đổi đang dở của repo, không phải do audit này |
| Đọc file (Read/Grep) | — | Không chạy `npm run build`/`test` — `package.json` không có script `test`; `build` không cần thiết cho audit đọc-code và đã có `eslint` xác nhận. |

> Không chạy `npm run build` vì phase này là audit đọc-code; eslint đã xác nhận không lỗi cú pháp/hook. Có thể chạy `npm run build` riêng nếu cần xác nhận bundle.

---

## 16. Final Verdict

**bigbike-admin workflow UX đã đủ an toàn cho admin vận hành chưa?**
**Gần đủ — PARTIAL.** Phần lớn workflow vận hành tốt: state-based action chuẩn (đặc biệt Order status dùng allowed-transitions từ backend), permission gating nhất quán 3 lớp, confirm cho hầu hết action phá huỷ dữ liệu, Receivables/POS/Product là các module chắc chắn. **Chưa nên coi là production-ready** cho đến khi xử lý nhóm P0.

**Workflow nào nguy hiểm nhất?**
1. **Admin Users & Roles** — self-lockout (ISSUE-01, ISSUE-02): admin có thể tự khoá quyền của mình.
2. **Đổi trạng thái thanh toán đơn hàng & hoàn tiền đổi trả** — thiếu confirm, ảnh hưởng dòng tiền thật (ISSUE-03, ISSUE-04). Đặc biệt rủi ro vì BigBike đối soát thủ công, không có cổng thanh toán tự động.

**Workflow nào thiếu rõ ràng nhất?**
- **Duyệt huỷ đơn** — không có màn riêng, không rõ là thiếu hay cố ý (ISSUE-07).
- **Warranty** — không có tìm kiếm, không có action nào ngoài "huỷ phiếu"; luồng kích hoạt không hiển thị.
- **Confirm dialog** — mọi xác nhận trông giống nhau (nút đỏ), không truyền tải mức độ nguy hiểm.

**Workflow nào cần backend/web/mobile verify thêm?**
- `NEEDS_BACKEND_VERIFICATION`: self-lockout có guard BE không (ISSUE-01/02); state machine payment/serial/return (ISSUE-05); `refundAmount` của return (ISSUE-04); luồng gán serial vào đơn; warranty có cần kích hoạt thủ công không.
- `NEEDS_WEB_VERIFICATION`: contract homepage block limit; publish content/banner hiển thị đúng trên web.
- `NEEDS_WEB_VERIFICATION` + `NEEDS_MOBILE_VERIFICATION`: có luồng khách yêu cầu huỷ đơn không (ISSUE-07).

**Thứ tự xử lý đề xuất:**
1. **P0** — ISSUE-01, ISSUE-02 (self-lockout) → ISSUE-03, ISSUE-04 (action tài chính thiếu confirm).
2. **P1** — ISSUE-09 (lỗi tải bị nuốt) → search Warranty → verify & xử lý ISSUE-07 → ISSUE-11 (validate Settings) → ISSUE-05 (đồng bộ state machine).
3. **P2** — ISSUE-08 (confirm phân loại) → ISSUE-06 (gộp logic serial) → ISSUE-10, ISSUE-12 và các cải thiện polish còn lại.

> Các màn chưa trace (`DashboardScreen`, `CategoryDetailScreen`, `CustomerListScreen/DetailScreen`, `AuditLogListScreen`, `MediaLibraryScreen`, `MenuScreen`, `SliderListScreen`, `HomeVideoListScreen`, `RedirectListScreen`, `CouponListScreen`, `Review*`, `Brand*`, `ContactInboxScreen`, `ShippingScreen`, `ReportsScreen`, phần lớn `InventoryScreen`) cần một vòng audit tiếp theo trước khi kết luận PASS toàn hệ thống.
