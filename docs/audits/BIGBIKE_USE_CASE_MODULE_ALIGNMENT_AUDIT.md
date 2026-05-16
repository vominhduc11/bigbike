# BigBike — System Use Case / Module / Feature Alignment Audit

> **Ngày audit:** 2026-05-16
> **Phạm vi:** Đối chiếu từng module/feature với use case thật của hệ thống — module có phục vụ đúng use case không, có lệch vai trò/workflow/business rule/permission/data contract không, có dư thừa hay thiếu use case không.
> **KHÔNG nằm trong phạm vi:** Completeness từng module (đã audit tại [BIGBIKE_MODULE_FEATURE_COMPLETENESS_AUDIT.md](BIGBIKE_MODULE_FEATURE_COMPLETENESS_AUDIT.md)) và workflow end-to-end (đã audit tại [BIGBIKE_FULL_E2E_WORKFLOW_AUDIT.md](BIGBIKE_FULL_E2E_WORKFLOW_AUDIT.md)). Audit này là góc nhìn **alignment** — không lặp lại 2 audit kia.
> **Phương pháp:** Đọc docs business/engineering làm source of truth, đối chiếu với source thật — controllers (`api/admin`, `api/public_`, `api/customer`, `api/order`…), `bigbike-admin/src/App.jsx` (nav + route + permission), web routes `bigbike-web/app`, mobile features `bigbike_mobile/lib/features`, permission gating thực tế trong controller.
> **Quy tắc sửa:** Audit này KHÔNG sửa code. Mọi thay đổi đề xuất chạm business rule / API contract / DB schema / permission / state machine đều đánh dấu `NEEDS_CONFIRMATION`.

---

## 0. Cách đọc báo cáo

- **Use case status:** `COMPLETE` / `PARTIAL` / `BROKEN` / `UNUSED` / `UNKNOWN`.
- **Finding severity:** `P0` (chặn launch) / `P1` (xử lý trước launch) / `P2` (xử lý sớm) / `P3` (cosmetic / post-launch).
- **Alignment verdict mỗi finding:** `ALIGNED` / `MISALIGNED_PERMISSION` / `MISALIGNED_ROLE` / `MISALIGNED_DATA` / `OVER_ENGINEERED` / `MISSING_USE_CASE` / `DEAD_SCAFFOLD`.

---

## 1. Business context của BigBike

| Câu hỏi | Kết luận | Evidence |
|---|---|---|
| BigBike là hệ thống gì? | Sàn thương mại điện tử **bán đồ bảo hộ mô tô + phụ kiện cho người lái** (mũ bảo hiểm, giáp, găng tay…). KHÔNG bán xe. | `docs/business/PROJECT_OVERVIEW.md:3`; memory `project_bigbike_domain` |
| Bán kênh nào? | Cả **online** (web/mobile) lẫn **walk-in tại shop** (POS admin). | `PROJECT_OVERVIEW.md` POS row; memory `project_bigbike_sales_channels` |
| Thanh toán? | Không cổng tự động. Online: `COD` + `BACS` (chuyển khoản đối soát thủ công). POS: `CASH`/`CARD_TERMINAL`/`CREDIT`. SePay đã gỡ (V59). | `PROJECT_OVERVIEW.md:32`; `BUSINESS_PROCESS.md:52-53` |
| 4 surface | `bigbike-web` (Next.js, public + account), `bigbike-admin` (Vite, nội bộ), `bigbike-backend` (Spring Boot, API + rule), `bigbike_mobile` (Flutter, đồng hành web). | `PROJECT_OVERVIEW.md:7-12` |
| Core business | Catalog, Cart/Checkout, Order, POS, Inventory/Serial, Return/Refund, Coupon. | `MODULE_CATALOG.md`, `BUSINESS_PROCESS.md` |
| Support / admin / internal | Media, Settings, Menu, Slider, Home-video, Redirect, Admin users, Roles, Audit log, Reports, Notification center, Contact inbox, Shipping config, Accounts Receivable. | `MODULE_CATALOG.md` Admin Platform Modules |
| SEO / content / marketing | Content/Article/Page, Page hero, Redirect, Coupon gift campaign. | `MODULE_CATALOG.md` |
| Legacy / chưa dùng | `api/webhook/` package rỗng (xem AL-06); `receivables.export` permission không endpoint (xem AL-05). | repo scan |

**Lưu ý domain quan trọng (đã ghi memory):** BigBike bán đồ bảo hộ, không bán xe. Module Serial + Warranty và các field `chassisNumber`/`engineNumber` mang dấu vết thiết kế "cho xe cộ" — xem AL-08.

---

## 2. Actor của hệ thống

Đối chiếu `USER_ROLES.md` với `SecurityConfig` + `AdminRolePermissions`. **Không có** actor Dealer / Distributor / NPP, không có Support Agent role, không có Warehouse role — chỉ là role nghiệp vụ chung map vào built-in role.

| Actor | Loại | Use case chính | Status |
|---|---|---|---|
| Guest / Visitor | Người dùng | Xem catalog/content, search, cart, checkout guest, quick-buy, order lookup, contact, đọc review. | `CONFIRMED_FROM_CODE` |
| Customer | Người dùng | Đăng ký/đăng nhập, xác minh email, quản lý profile/address, checkout, xem đơn, tạo return, wishlist, gửi review. | `CONFIRMED_FROM_CODE` |
| Admin (+ built-in roles) | Nội bộ | Vận hành catalog/order/POS/inventory/content/marketing/settings. Sub-role: Super Admin, Shop Manager, Editor, Author, Contributor, SEO Editor. | `CONFIRMED_FROM_CODE` |
| System | Tự động | Validate checkout, tạo order/payment, trừ/hoàn kho, audit, notification, WebSocket push, coupon expiry scheduler, auto-cancel. | `CONFIRMED_FROM_CODE` |
| Email Service / MinIO | Third-party | Gửi email giao dịch / lưu media. | `CONFIRMED_FROM_CODE` |
| Payment Provider / Shipping Provider | Third-party | **Không tồn tại** — out of scope / chưa tích hợp. | `NOT_FOUND_IN_REPO` |

**Finding actor (AL-09):** Hệ thống có module **Accounts Receivable + Credit policy + POS credit sale** (bán nợ, công nợ, hạn mức tín dụng, aging report) nhưng **không có actor Dealer/B2B** nào. Module công nợ phục vụ khách lẻ mua nợ tại quầy — xem AL-09 về mức độ phù hợp giai đoạn launch.

---

## 3. Use Case inventory theo actor

Status mỗi use case: đối chiếu entry point → API → controller → permission → test. Hầu hết `COMPLETE` (đã xác nhận chéo bởi 2 audit completeness/E2E). Bảng dưới chỉ liệt kê tóm tắt; các use case `PARTIAL`/lệch được mổ chi tiết ở Section 4.

### 3.1. Guest / Visitor

| Use case | UI | API | Status |
|---|---|---|---|
| Xem catalog (sản phẩm/danh mục/thương hiệu) | web `/san-pham`,`/danh-muc-san-pham`,`/brands`; mobile | `GET /api/v1/products…` (`CatalogController`) | `COMPLETE` |
| Xem content (bài viết/trang chính sách/hướng dẫn) | web `/tin-tuc`,`/chinh-sach`,`/huong-dan` | `ContentController` | `COMPLETE` |
| Search + suggest | web `/tim-kiem`; mobile `search` | `PublicSearchController` | `COMPLETE` |
| Cart guest | web `/gio-hang`; mobile `cart` | `CartController` | `COMPLETE` |
| Checkout guest + quick-buy | web `/thanh-toan` | `CheckoutController` | `COMPLETE` |
| Order lookup (tra cứu đơn không cần login) | web `/don-hang` | `OrderLookupController` | `COMPLETE` |
| Gửi contact | web `/lien-he`; mobile `contact` | `ContactController` | `COMPLETE` |
| Tra cứu bảo hành | web `/bao-hanh` | `PublicWarrantyController` | `PARTIAL` — không có trên mobile (AL-08) |

### 3.2. Customer

| Use case | UI | API | Status |
|---|---|---|---|
| Đăng ký / đăng nhập / xác minh email / quên mật khẩu | web `/dang-ky`,`/dang-nhap`,`/quen-mat-khau`,`/xac-nhan-email`; mobile `auth` | `CustomerAuthController` | `COMPLETE` |
| Quản lý profile + address | web `/tai-khoan` | `CustomerController`, `CustomerAddressController` | `COMPLETE` |
| Xem đơn hàng + tạo/đọc return | web `/tai-khoan/don-hang`,`/doi-tra`; mobile `account` | `CustomerOrderController` | `COMPLETE` |
| Wishlist | web `/tai-khoan/yeu-thich` | `CustomerWishlistController` | `PARTIAL` — không có trên mobile (AL-08) |
| Gửi review sản phẩm | web product page | `PublicReviewController` POST | `PARTIAL` — mobile chỉ đọc, không submit (AL-08) |

### 3.3. Admin (built-in roles)

| Use case | Admin screen | Permission gating thực tế | Status |
|---|---|---|---|
| Dashboard | `DashboardScreen` | `orders.read` | `COMPLETE` — lệch nhẹ (AL-07) |
| Quản lý đơn / cập nhật trạng thái / refund | `OrderListScreen`,`OrderDetailScreen` | `orders.read`/`orders.write` | `COMPLETE` |
| POS bán tại quầy (CASH/CARD/CREDIT) | `PosScreen` | `pos.read`/`pos.write`/`pos.refund`/`pos.price_override` | `COMPLETE` |
| Quản lý khách hàng | `CustomerListScreen`,`CustomerDetailScreen` | `customers.read`/`customers.write` | `COMPLETE` |
| Contact inbox | `ContactInboxScreen` | `contact.read`/`contact.write` | `COMPLETE` (mới thêm 2026-05-16) |
| Quản lý đổi/trả | `ReturnListScreen` | `orders.read`/`orders.write` | `COMPLETE` — không có permission riêng (AL-04) |
| Công nợ phải thu | `ReceivablesListScreen`,`ReceivableDetailScreen` | `receivables.*` | `COMPLETE` — xem AL-09 |
| Duyệt review | `ReviewListScreen`,`ReviewDetailScreen` | `reviews.read`/`reviews.write` | `COMPLETE` |
| Coupon + coupon gift campaign | `CouponListScreen` | `coupons.read`/`coupons.write` | `COMPLETE` |
| Quản lý sản phẩm/danh mục/thương hiệu | `Product/Category/Brand…Screen` | `products.*`/`catalog.*` | `COMPLETE` |
| Tồn kho (adjustment, CSV export) | `InventoryScreen` | `products.read`/`products.update` | `COMPLETE` — **lệch permission (AL-03)** |
| Serial | `SerialListScreen` | `products.read`/`products.update` | `COMPLETE` — **lệch permission (AL-03)** |
| Bảo hành (list, void) | `WarrantyListScreen` | `inventory.read`/`inventory.write` | `COMPLETE` — **lệch permission (AL-03)** |
| Content / Article / Page | `ContentListScreen`,`ContentDetailScreen` | `content.read`/`content.update` | `COMPLETE` |
| Media library | `MediaLibraryScreen` | `media.read`/`media.write`/`*` | `COMPLETE` |
| Slider / Home-video / Menu / Redirect | các screen tương ứng | `sliders.*`/`home_videos.*`/`menus.*`/`redirects.*` | `COMPLETE` |
| Settings | `SettingsScreen` | `settings.read`/`settings.write` | `COMPLETE` |
| Shipping zone/method | `ShippingScreen` | `shipping.read`/`shipping.write` | `COMPLETE` |
| Admin users / Roles / Permissions | `AdminUsersScreen`,`RolesScreen` | `admin-users.*`/`roles.*` | `COMPLETE` |
| Audit log | `AuditLogListScreen` | `audit-logs.read` | `COMPLETE` |
| Reports (orders/customers/products + CSV) | `ReportsScreen` | `reports.read`/`reports.export` | `COMPLETE` |
| Notification center | `NotificationBell` | `orders.read` | `COMPLETE` |

**Kết luận Section 3:** Mọi use case lõi đều có module phục vụ thật — không có use case nào `BROKEN` hay `UNUSED`. Các use case `PARTIAL` đều do thiếu surface mobile, không phải lỗi chức năng. Trọng tâm audit nằm ở Section 4 (alignment).

---

## 4. Findings — Alignment

### AL-01 — Mọi module đều phục vụ use case thật (không có module mồ côi use case)

- **Verdict:** `ALIGNED`
- **Kết quả:** 39 module trong completeness audit đều trace được về ít nhất một use case của một actor cụ thể. Không có module "tồn tại nhưng không rõ phục vụ ai". Các module admin-only (Inventory, Serial, Reports, Audit log, Notification, Receivable) phục vụ actor Admin/System — đúng thiết kế nội bộ, không phải dư thừa.
- **Severity:** —

### AL-02 — Không có feature trùng lặp / duplicate

- **Verdict:** `ALIGNED`
- **Kết quả:** Không phát hiện 2 module cùng giải quyết một use case. Cart vs POS là 2 kênh bán khác nhau (online self-service vs walk-in admin) — không trùng. Order admin vs POS dùng chung `OrderEntity` nhưng khác entry point/workflow — đúng thiết kế. Notification center (REST persistent) + WebSocket feed bổ trợ nhau, không trùng.
- **Severity:** —

### AL-03 — Permission `inventory.*` gate nhầm module (lệch permission) ⚠️

- **Verdict:** `MISALIGNED_PERMISSION`
- **Mô tả:** Permission key `inventory.read` / `inventory.write` **không gate module Inventory**. Chúng gate module **Warranty**:
  - `AdminWarrantyController.java:36,48` dùng `inventory.read`; `:57` dùng `inventory.write`.
  - `AdminInventoryController.java:69-241` — toàn bộ endpoint tồn kho (list/summary/movement/**manual adjustment**/CSV export) gate bằng `products.read` / `products.update`.
  - `AdminSerialController` không tồn tại — endpoint serial nằm trong `AdminInventoryController`, cũng gate bằng `products.*`.
  - Admin UI khớp đúng lệch này: `App.jsx:79` route Inventory yêu cầu `products.read`; `App.jsx:81` route Warranty yêu cầu `inventory.read`; `App.jsx:223` warranty screen `routePermission` trả `inventory.read`.
- **Hệ quả nghiệp vụ:**
  1. Cấp permission tên `inventory` cho một custom role → mở **màn Bảo hành**, KHÔNG mở màn Tồn kho. Gây hiểu nhầm khi phân quyền.
  2. Muốn cho nhân viên kho chỉnh tồn kho mà KHÔNG cho sửa catalog sản phẩm → **không làm được**, vì manual adjustment gate bằng `products.update` (cùng quyền sửa sản phẩm). Không tách được "nhân viên kho" khỏi "nhân viên sản phẩm".
- **Severity:** `P2`
- **Recommended fix (`NEEDS_CONFIRMATION` — chạm permission contract):** Hoặc (a) đổi `AdminInventoryController` adjustment endpoints sang `inventory.write` và list/movement sang `inventory.read`, đổi Warranty sang một cặp permission riêng (`warranty.read/write`); hoặc (b) đổi tên `inventory.*` thành `warranty.*` cho khớp module nó thực sự gate. Đồng thời sửa `App.jsx` route permission. Cần cập nhật `PERMISSION_MATRIX.md` + `AdminRolePermissions` + `test-seed.sql` trong cùng PR.

### AL-04 — Module Return không có permission riêng — dùng chung `orders.*`

- **Verdict:** `MISALIGNED_PERMISSION` (mức nhẹ)
- **Mô tả:** `AdminReturnController.java:52-100` gate toàn bộ bằng `orders.read` / `orders.write`. Không có `returns.*`. Admin UI `App.jsx:68,222` cũng dùng `orders.read`.
- **Hệ quả:** Không tách được vai trò "nhân viên xử lý đổi trả" khỏi "nhân viên xử lý đơn". Ai xem được đơn thì xem được return; ai sửa đơn thì sửa được return.
- **Đánh giá:** Với shop quy mô hiện tại, return là một phần của vận hành đơn hàng — gộp permission là **chấp nhận được cho v1**. Chỉ thành vấn đề khi cần phân quyền tinh.
- **Severity:** `P3`
- **Recommended fix (`NEEDS_CONFIRMATION`):** Giữ nguyên cho launch. Nếu sau này cần vai trò CSKH chuyên đổi trả thì tách `returns.read/write`.

### AL-05 — Permission `receivables.export` khai báo nhưng không endpoint nào dùng

- **Verdict:** `DEAD_SCAFFOLD`
- **Mô tả:** `receivables.export` có trong `PermissionCatalog`; `PERMISSION_MATRIX.md` tự ghi "Reserved for future CSV/PDF export". Không endpoint nào kiểm tra permission này.
- **Severity:** `P3`
- **Recommended fix (`NEEDS_CONFIRMATION` — business decision):** Nếu có kế hoạch export công nợ trong sprint gần → giữ. Nếu không → gỡ khỏi `PermissionCatalog` để permission list khớp 1-1 với endpoint thật. (Đã ghi nhận ở completeness audit MOD-18; nhắc lại ở đây vì là lệch permission contract.)

### AL-06 — Package `api/webhook/` rỗng — scaffold chết còn sót sau khi gỡ SePay

- **Verdict:** `DEAD_SCAFFOLD`
- **Mô tả:** `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/webhook/` chỉ chứa thư mục con `dto/` **rỗng**, không có class Java nào. Grep `webhook` trên toàn bộ `src/main/java` → 0 kết quả. Đây là vết tích của tích hợp thanh toán SePay đã bị gỡ ở V59.
- **Hệ quả:** Gợi ý sai rằng hệ thống có cơ chế webhook (thanh toán/vận chuyển). `USER_ROLES.md` và `PROJECT_OVERVIEW.md` đều khẳng định không có payment/shipping provider — package rỗng này mâu thuẫn ngầm với docs.
- **Severity:** `P3`
- **Recommended fix:** Xoá thư mục `api/webhook/` (rỗng, không reference). **Đây là bug nhỏ chắc chắn, không chạm rule/contract/schema** — nằm trong phạm vi được phép sửa của task. Tuy nhiên đề xuất xác nhận trước khi xoá để chắc không có nhánh feature đang dở.

### AL-07 — Dashboard gate bằng `orders.read`

- **Verdict:** `MISALIGNED_PERMISSION` (mức rất nhẹ — đã được docs ghi nhận)
- **Mô tả:** `App.jsx:63,189` — Dashboard yêu cầu `orders.read`. Không thể cho một role xem Dashboard mà không cho xem danh sách đơn.
- **Đánh giá:** Dashboard hiển thị số đơn + doanh thu → việc gắn với `orders.read` là hợp lý về mặt dữ liệu. `LAUNCH_READINESS_SUMMARY.md:130` (FULL-14) đã ghi "Đủ cho v1".
- **Severity:** `P3` — không cần xử lý trước launch.

### AL-08 — Mobile thiếu 5 feature so với web (lệch surface, không lệch chức năng)

- **Verdict:** `MISSING_USE_CASE` (chỉ trên surface mobile)
- **Mô tả:** Mobile (`bigbike_mobile/lib/features/`: account, articles, auth, brands, cart, categories, checkout, contact, content, home, products, search, shell) **không có** wishlist, warranty lookup, submit review, home-video widget, page hero. Backend đã sẵn API cho tất cả.
- **Hệ quả:** Khách dùng app có trải nghiệm hẹp hơn web ở các feature phụ trợ. Luồng commerce lõi (browse → cart → checkout → account → order → return) đầy đủ.
- **Severity:** `P2` (tổng hợp) — đã có trong `LAUNCH_READINESS_SUMMARY.md` Mobile Caveats, **không chặn launch**.
- **Recommended fix (`NEEDS_CONFIRMATION` — product decision):** Quyết định phạm vi parity mobile vs web. Khuyến nghị: wishlist + home-video lên mobile ở sprint 1-2 sau launch (đúng kế hoạch đã ghi); warranty lookup nên đưa lên mobile vì là feature tra cứu nhanh hợp với điện thoại.

### AL-09 — Cụm Accounts Receivable + Credit + POS credit sale: nặng so với actor hiện có

- **Verdict:** `OVER_ENGINEERED` (cần xác nhận)
- **Mô tả:** Hệ thống có một cụm công nợ khá đầy đủ: `ReceivableEntity`, `CreditPolicyService`, `ReceivableQueryService`, `ReceivableNotificationService`, aging report, write-off, customer credit profile, hạn mức tín dụng (`receivables.override_limit`), POS credit sale tạo receivable (V75). 2 admin screen riêng (`ReceivablesListScreen`, `ReceivableDetailScreen`).
- **Vì sao đặt câu hỏi alignment:** Đây là nghiệp vụ **bán nợ / công nợ** — thường phục vụ khách B2B/đại lý/sỉ. Nhưng `USER_ROLES.md` xác nhận hệ thống **không có actor Dealer/Distributor/NPP** (Section 13: `NOT_FOUND_IN_REPO`). Vậy cụm công nợ này chỉ phục vụ **khách lẻ mua nợ tại quầy POS**. Đây là use case có thật (memory `project_bigbike_sales_channels` xác nhận bán walk-in) nhưng cần xác nhận mức độ cần thiết cho launch:
  - Một shop đồ bảo hộ bán lẻ có thực sự cho khách lẻ nợ tiền + theo dõi hạn mức tín dụng + aging report không?
  - Hay credit sale chủ yếu dành cho một nhóm khách quen / đại lý nhỏ chưa được mô hình hoá thành actor riêng?
- **Đây KHÔNG phải lỗi code** — cụm này hoạt động và đã test (`AdminReceivableApiTest`). Vấn đề là **alignment giữa độ phức tạp feature và nhu cầu giai đoạn hiện tại**.
- **Severity:** `P2` (business alignment, không phải defect)
- **Recommended fix (`NEEDS_CONFIRMATION` — business decision):**
  1. Nếu công nợ là nhu cầu thật → cân nhắc bổ sung actor "Khách công nợ / Đại lý" vào `USER_ROLES.md` cho khớp (hiện feature có, actor không có → lệch tài liệu actor).
  2. Nếu credit sale ít dùng → cân nhắc ẩn POS credit + Receivable khỏi v1 (hide, không xoá), bật lại khi có nhu cầu rõ. Giảm bề mặt vận hành/đào tạo nhân viên.

### AL-10 — Module Serial + Warranty mang dấu vết thiết kế "cho xe", áp lên đồ bảo hộ

- **Verdict:** `MISALIGNED_DATA`
- **Mô tả:** BigBike bán mũ/giáp/găng — không bán xe (memory `project_bigbike_domain`). Nhưng có module theo dõi **serial từng đơn vị** + **tra cứu bảo hành theo serial**, và data contract còn field `chassisNumber` / `engineNumber` (tên của xe máy).
- **Đánh giá:**
  - Theo dõi serial + bảo hành cho **mũ bảo hiểm** là hợp lý (mũ có số seri và chính sách bảo hành thật).
  - Nhưng tên field `chassisNumber`/`engineNumber` là **lệch data contract** rõ ràng — đặt sai domain.
  - Cần xác nhận: serial tracking per-unit có áp cho **mọi** loại sản phẩm (găng tay, áo giáp giá thấp) không, hay chỉ mũ/sản phẩm giá trị cao. Nếu bật cho mọi sản phẩm → over-tracking.
- **Severity:** `P3` (đổi tên field = data contract, task riêng — đã ghi memory + completeness audit MOD-02)
- **Recommended fix (`NEEDS_CONFIRMATION`):** Đổi tên `chassisNumber`/`engineNumber` thành tên trung lập (`serialNumber`/`secondaryIdentifier`) trong một task data-contract riêng. Xác nhận phạm vi sản phẩm cần serial.

### AL-11 — Use case quan trọng chưa có module phục vụ (gap nghiệp vụ thật)

- **Verdict:** `MISSING_USE_CASE`
- **Mô tả:** `BUSINESS_PROCESS.md:49-62` (Operational Reality Gaps) đã liệt kê trung thực các use case nghiệp vụ một shop TMĐT Việt Nam thường cần nhưng repo chưa có. Audit này xác nhận và xếp ưu tiên alignment:

| Use case thiếu | Mức độ | Ghi chú |
|---|---|---|
| Hoá đơn điện tử (NĐ 123/2020) | `P1` pháp lý | Không có invoice entity/service/provider. Refund/cancel không tác động hoá đơn. Cần chủ shop/kế toán quyết trước go-live. |
| Xuất/xoá dữ liệu cá nhân khách (NĐ 13/2023) | `P2` pháp lý | Không có `GET /customer/me/export` hay `DELETE /customer/me`. |
| Hỗ trợ khách / xử lý khiếu nại có quy trình | `P2` | Chỉ có form contact + inbox trạng thái. Không ticketing/SLA/escalation. Đủ cho v1 nhỏ. |
| Tích hợp vận chuyển (GHN/GHTK/ViettelPost) | `P2` | `fulfillmentStatus` field tồn tại nhưng không có carrier integration → fulfillment chạy offline. |
| Refund/đổi trả tại quầy POS | `P2` | POS sale tạo `COMPLETED+PAID`; không có flow return-at-counter riêng. POS refund phải đi qua order refund. |

- **Severity:** `P1` cho hoá đơn điện tử (rủi ro pháp lý), còn lại `P2`.
- **Recommended fix:** Không sửa trong audit này — đây là quyết định business/pháp lý, đã được `LAUNCH_DECISION_CHECKLIST.md` theo dõi. Audit này chỉ xác nhận đây là use case thiếu thật, không phải thiếu sót do bỏ quên.

---

## 5. Tổng hợp: nên thêm / gộp / tách / ẩn / bỏ

| Hành động | Đối tượng | Lý do | Verdict | Cần confirm |
|---|---|---|---|---|
| **Bỏ** | Package `api/webhook/` (rỗng) | Scaffold chết sau khi gỡ SePay (AL-06) | `DEAD_SCAFFOLD` | Nhẹ — xác nhận không có nhánh dở |
| **Bỏ hoặc giữ-reserved** | Permission `receivables.export` | Không endpoint dùng (AL-05) | `DEAD_SCAFFOLD` | **Có** — business |
| **Sửa (đổi tên/đổi gate)** | Permission `inventory.*` ↔ module Inventory/Warranty | Permission gate nhầm module (AL-03) | `MISALIGNED_PERMISSION` | **Có** — permission contract |
| **Tách (về sau)** | `returns.*` permission khỏi `orders.*` | Khi cần vai trò CSKH chuyên đổi trả (AL-04) | `MISALIGNED_PERMISSION` nhẹ | **Có** — chỉ khi cần |
| **Ẩn hoặc xác nhận** | POS credit sale + Accounts Receivable | Nặng so với actor hiện có; không có actor Dealer (AL-09) | `OVER_ENGINEERED` | **Có** — business |
| **Thêm actor** | "Khách công nợ / Đại lý" vào `USER_ROLES.md` | Nếu giữ cụm công nợ — feature có, actor không (AL-09) | Lệch tài liệu actor | **Có** — business |
| **Thêm (post-launch)** | Mobile: wishlist, warranty lookup, home-video, submit review | Parity với web (AL-08) | `MISSING_USE_CASE` (mobile) | **Có** — product |
| **Thêm (pháp lý)** | Hoá đơn điện tử; xuất/xoá dữ liệu cá nhân | Yêu cầu NĐ 123/2020 + NĐ 13/2023 (AL-11) | `MISSING_USE_CASE` | **Có** — pháp lý |
| **Đổi tên (task riêng)** | Field `chassisNumber`/`engineNumber` | Sai domain — BigBike bán đồ bảo hộ (AL-10) | `MISALIGNED_DATA` | **Có** — data contract |
| **Không gộp / không tách / không bỏ** | Tất cả module còn lại | Đều phục vụ use case thật, không trùng (AL-01, AL-02) | `ALIGNED` | Không |

---

## 6. Bảng hành động

| ID | Việc | Severity | Loại | Cần confirm |
|---|---|---|---|---|
| AL-03 | Sửa lệch permission `inventory.*` (gate nhầm Warranty thay vì Inventory) + sửa `App.jsx` route permission + `PERMISSION_MATRIX.md` | P2 | Permission | **Có** |
| AL-06 | Xoá package rỗng `api/webhook/` | P3 | Code (dead scaffold) | Nhẹ |
| AL-05 | Quyết định `receivables.export`: giữ reserved hay gỡ | P3 | Permission | **Có** |
| AL-09 | Quyết định giữ/ẩn POS credit + Receivable cho v1; nếu giữ → bổ sung actor công nợ vào `USER_ROLES.md` | P2 | Business | **Có** |
| AL-10 | Đổi tên field `chassisNumber`/`engineNumber`; xác nhận phạm vi sản phẩm cần serial | P3 | Data contract | **Có** |
| AL-08 | Quyết định parity mobile (wishlist/warranty/home-video/review submit) | P2 | Product | **Có** |
| AL-11 | Quyết định hoá đơn điện tử + xuất/xoá dữ liệu cá nhân trước go-live | P1 (hoá đơn) | Pháp lý/Business | **Có** |
| AL-04 | (Sau launch) Tách `returns.*` permission nếu cần vai trò CSKH riêng | P3 | Permission | **Có** |

---

## 7. Kết luận

**BigBike căn chỉnh use case ↔ module ở mức tốt.** Mọi module đều trace được về use case thật của một actor cụ thể; không có module mồ côi, không có feature trùng lặp, không có UI treo thiếu backend (xác nhận chéo bởi completeness + E2E audit cùng ngày).

**Các điểm lệch tìm được đều là lệch *cấu hình/đặt tên/phạm vi*, không phải lệch *logic*:**

- **Lệch permission (AL-03)** — đáng xử lý nhất: permission tên `inventory.*` lại gate module Warranty, còn Inventory dùng `products.*`. Gây hiểu nhầm khi phân quyền và không tách được vai trò nhân viên kho. `P2`, cần confirm vì chạm permission contract.
- **Dead scaffold (AL-06, AL-05)** — package webhook rỗng và permission `receivables.export` không dùng. Nhỏ, dọn được.
- **Câu hỏi alignment business (AL-09)** — cụm công nợ/credit khá nặng nhưng không có actor Dealer tương ứng. Không phải lỗi, nhưng cần chủ shop xác nhận có cần cho launch không.
- **Lệch data contract domain (AL-10)** — field tên cho xe máy áp lên đồ bảo hộ.
- **Use case thiếu thật (AL-11)** — hoá đơn điện tử, dữ liệu cá nhân, vận chuyển: đều là quyết định business/pháp lý đã được docs theo dõi minh bạch, không phải bỏ quên.

**Không có finding `P0`.** Hệ thống đạt alignment đủ điều kiện vận hành; các finding còn lại là quyết định business/permission hoặc dọn dẹp nhỏ — không chặn launch về mặt kỹ thuật.

> Audit này chỉ báo cáo. Không sửa code. Mọi thay đổi đề xuất chạm permission/data contract/business rule đều đánh dấu `NEEDS_CONFIRMATION` và cần xử lý trong PR riêng kèm cập nhật docs tương ứng.
