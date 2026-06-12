# UI/UX Audit — bigbike-admin

> Ngày audit: 2026-06-12 · Phạm vi: 21 module / 5 nhóm chức năng · Phương pháp: đọc trực tiếp source từng screen, đối chiếu shared design system, cite `file:line`.
> Đây là **Phase 1 (Audit)**. Phase 2 (Fix) chỉ thực hiện sau khi được xác nhận.

---

## Tóm tắt điều hành

**Kết luận chung: hệ thống admin đã well-architected.** Shell (`AdminShell`) và bộ shared primitives (`Screen`, `ScreenHeader`, `FilterBar`, `AdminTable`, `StatePanel`, `StatusBadge`, `ConfirmDialog`, `ReadOnlyBanner`…) đặt nền tảng nhất quán mạnh: sidebar 5 nhóm khớp đúng 5 nhóm nghiệp vụ, active state + breadcrumb + mobile drawer + tooltip + nav badge + focus-mode + theme/lang/global-search/notification đều có sẵn ở tầng shell. Phần lớn module đạt ✅ về giao diện và điều hướng.

**Giá trị của audit nằm ở các khoảng trống per-module**: thiếu validation form, thiếu toast xác nhận, chuỗi tiếng Việt hardcode chưa qua i18n, một feature export bị hỏng, và vài chỗ tự dựng UI thay vì dùng component chung.

### Bảng điểm tổng quan theo module

| Nhóm | Module | Trạng thái |
|---|---|---|
| **1 — Bán hàng** | Đơn hàng | ✅ Tốt |
| | Trả hàng | ✅ Tốt |
| | Khách hàng | ⚠️ Cần cải thiện |
| | Mã giảm giá | ⚠️ Cần cải thiện |
| | Đánh giá | ⚠️ Cần cải thiện |
| **2 — Sản phẩm** | Sản phẩm | ✅ Tốt |
| | Thuộc tính | ⚠️ Cần cải thiện (khoảng trống kiến trúc) |
| | Danh mục | ✅ Tốt |
| | Thương hiệu | ⚠️ Cần cải thiện |
| | Serial Number | ✅ Tốt |
| | Bảo hành | ✅ Tốt |
| | Tồn kho | ⚠️ Cần cải thiện |
| **3 — Nội dung & Marketing** | Bài viết | ✅ Tốt |
| | Thẻ/Chuyên mục | ✅ Tốt |
| | Menu | ⚠️ Cần cải thiện |
| | Thư viện Media | ⚠️ Cần cải thiện |
| | Chuyển hướng | ✅ Tốt |
| | Trang chủ/Marketing (Slider, Video, Highlights) | ⚠️ Cần cải thiện |
| **4 — Báo cáo** | Báo cáo doanh thu | ⚠️ Cần cải thiện |
| | Báo cáo sản phẩm | ⚠️ Cần cải thiện |
| | Báo cáo khách hàng | ⚠️ Cần cải thiện |
| | Tổng quan/Dashboard (bonus) | ✅ Tốt |
| **5 — Hệ thống** | Vận chuyển | ✅ Tốt |
| | Cài đặt | ✅ Tốt |
| | Quản trị viên | ⚠️ Cần cải thiện |
| | Phân quyền | ✅ Tốt |
| | Nhật ký | ✅ Tốt |

---

## 🔴 Vấn đề nghiêm trọng (❌) — cần xử lý trước

1. **Báo cáo → Xuất CSV bị hỏng.** Nút "Xuất đơn hàng (CSV)" gọi `exportOrdersCsv(...)` không `await` và vứt blob trả về (`ReportsScreen.jsx:173`) → không tải file, không toast, không báo lỗi. Người dùng bấm mà không có phản hồi nào. Đã có sẵn component `ExportButton` làm đúng (tải file + toast + loading) nhưng không được dùng. Ngoài ra **không có nút export cho báo cáo sản phẩm và khách hàng** dù API `exportProductsCsv` / `exportCustomersCsv` đã tồn tại.

2. **Khách hàng → màn Chi tiết thiếu validation form (❌ Form & Validation).** Form sửa hồ sơ và form hồ sơ tín dụng gửi thẳng không kiểm tra (`CustomerDetailScreen.jsx:139-174`): số điện thoại không kiểm định dạng, hạn mức/kỳ hạn tín dụng không ép số dương, không đánh dấu field bắt buộc, không có thông báo lỗi cạnh field. Đây là màn có thao tác tài chính (công nợ) nên rủi ro nhập sai cao.

3. **Thuộc tính sản phẩm không có màn quản trị riêng (khoảng trống kiến trúc, không chặn).** Thuộc tính và giá trị màu là dữ liệu dùng chung toàn hệ thống nhưng chỉ truy cập gián tiếp qua biến thể của một sản phẩm (`ProductDetailScreen.jsx:986-1176`); không xóa được thuộc tính/giá trị thừa, không xem được màu nào đang dùng ở đâu. Đủ dùng cho luồng nhập sản phẩm nhưng thiếu khả năng quản trị catalog.

> Lưu ý: ngoài 3 mục trên, **không phát hiện lỗi chặn nào khác**. Không có mojibake hay tiếng Việt mất dấu trong toàn bộ codebase admin.

---

## Chủ đề xuyên suốt (các ⚠️ lặp lại nhiều module)

| Chủ đề | Mô tả | Module bị ảnh hưởng |
|---|---|---|
| **Chuỗi tiếng Việt hardcode chưa qua i18n** | Nhiều label/placeholder/toast viết thẳng tiếng Việt thay vì `t()` → admin chế độ EN sẽ thấy lẫn lộn Việt-Anh | CustomerDetail (nặng), Coupons, InventoryScreen (modal serial — nặng), MenuScreen, HomeVideoListScreen |
| **Thiếu toast xác nhận sau hành động thành công** | Thao tác chạy xong chỉ reload danh sách, không có phản hồi thị giác | Đánh giá (list), Vận chuyển, Quản trị viên |
| **Thiếu ReadOnlyBanner khi không có quyền ghi** | Chỉ ẩn nút chứ không giải thích vì sao user chỉ-đọc mất chức năng | Đơn hàng (detail), Menu, Slider, Redirect, Shipping, Settings |
| **List dùng `<table>` thô thay vì `AdminTable` shared** | Mất sort/bulk/skeleton sẵn có; đây là quyết định kiến trúc chung của codebase | Đơn hàng, Trả hàng, Khách hàng, Coupons, các Report table, Audit log (không set `sortable`) |
| **Inline `style` px/hex lẻ thay vì Tailwind token** | Lệch nhẹ rule design-system (đa số vẫn tham chiếu `var(--bb-*)`) | ProductList, Dashboard (legend pie), Slider, Settings |
| **Tự dựng overlay/button thay vì component chung** | Roles tự dựng dialog `roles-confirm-*`; Slider/Video dùng raw `bb-btn` cho nút xóa | Phân quyền, Slider, Video |

**Điểm sáng nổi bật** (giữ nguyên, không động vào ở Phase 2):
- **Bảo mật/self-protection xuất sắc**: Admin Users chặn tự đổi role/status mình; Roles chặn tự gỡ quyền quản trị phân quyền + tóm tắt 2 bước trước khi lưu.
- **Form phức tạp xử lý tốt**: ProductDetail & ContentDetail có autosave + draft-recovery + StickyActionBar + tab đếm lỗi + `beforeunload` guard.
- **State-machine khớp backend**: Orders/Returns/Serial lấy `allowedTransitions` động, confirm + lý do bắt buộc cho hành động nặng.
- **Media & Inventory**: upload tiến trình %/file, import serial từ CSV/Excel, QR tem, validate trùng/đủ số lượng.
- **Dashboard**: KPI có trend, "Cần chú ý" gom công nợ/tồn thấp/đơn chờ với CTA, auto-refresh nền, responsive mobile.

---

# NHÓM 1 — BÁN HÀNG

### Đơn hàng (Orders)
**Trạng thái tổng quan**: ✅ Tốt

| Tiêu chí | Trạng thái | Ghi chú |
|---|---|---|
| Giao diện nhất quán | ✅ | `bb-screen-header`, `bb-card`, `StatusBadge` cho order/payment/return/fulfillment (OrderListScreen.jsx:269-272; OrderDetailScreen.jsx:430-432). Inline style px nhưng tham chiếu `var(--bb-*)` token. |
| Điều hướng | ✅ | List eyebrow/title/desc + 3 nút action (OrderListScreen.jsx:109-131). Detail có back link + nút "Quay lại" (OrderDetailScreen.jsx:421-442). "Tạo đơn mới" trỏ POS. |
| Thao tác CRUD | ✅ | Chuyển trạng thái theo `allowedTransitions` từ backend (OrderDetailScreen.jsx:463-478); confirm/lý do bắt buộc cho COMPLETED/REFUNDED/CANCELLED (301-326). |
| Form & Validation | ✅ | Modal lý do validate bắt buộc + lỗi cạnh field (42-63); tracking number bắt buộc khi SHIPPED (376-378); dấu `*` rõ. |
| Table & Filter | ✅ | Status tabs, lọc payment, sort, search theo mã/khách (137-186), empty state + nút xóa lọc (198-201), sync URL. |
| Feedback & Toast | ✅ | `toast` sonner đầy đủ; skeleton (232-237); error StatePanel + retry; WebSocket live-refresh (224-230). |

**Điểm mạnh**: State-machine động khớp backend; reason bắt buộc cho CANCELLED/FAILED; live-update WS; `canUpdate` ẩn panel hành động.
**Điểm yếu**: List dùng `<table>` thô + checkbox tự chế thay vì `AdminTable` (OrderListScreen.jsx:208-278); `BulkActionBar` hiển thị nhưng không có action thực (188-191), chỉ đếm/clear. `!canUpdate` ở detail không có `ReadOnlyBanner`.
**Gợi ý cải thiện**: Thêm action thật vào `BulkActionBar` hoặc bỏ (OrderListScreen.jsx:188-191). Thêm `ReadOnlyBanner` khi `!canUpdate` (OrderDetailScreen.jsx:449).

### Trả hàng (Returns)
**Trạng thái tổng quan**: ✅ Tốt

| Tiêu chí | Trạng thái | Ghi chú |
|---|---|---|
| Giao diện nhất quán | ✅ | `StatusBadge type="return"` nhất quán (ReturnListScreen.jsx:467,287); shadcn Alert/Button/Select/Input/Textarea. |
| Điều hướng | ⚠️ | Có ScreenHeader nhưng không nút action (383-389); detail là modal; link chéo sang đơn tốt (147-155). Không create (đúng nghiệp vụ). |
| Thao tác CRUD | ✅ | Chuyển trạng thái theo `NEXT_STATUSES` mirror backend (30-35); confirm cho REFUNDED/REJECTED (90-102); QC từng item PASS/FAIL (125-137). |
| Form & Validation | ✅ | Validate refund > 0 và khớp `orderRefundableAmount` (81-89), lỗi cạnh field (331); ẩn REFUNDED khi chưa phủ toàn đơn + cảnh báo (54,194-198). |
| Table & Filter | ⚠️ | Lọc status + search + page size (393-412), empty guidance (418-420). Thiếu lọc ngày; cột không sort. |
| Feedback & Toast | ✅ | `toast.success` (117); error trong modal (331); skeleton (441-447); error StatePanel + retry. |

**Điểm mạnh**: Logic refund khớp chặt backend (full-coverage, exact-match); QC step; lịch sử trạng thái bằng badge; gating ẩn nút khi `!canUpdate` (236,305).
**Điểm yếu**: Skeleton dùng class `dash-skeleton-block` (444) thay vì `bb-skeleton-block` — không nhất quán. Thiếu lọc ngày. Detail-as-modal khó share link.
**Gợi ý cải thiện**: Thống nhất `bb-skeleton-block` (ReturnListScreen.jsx:444). Thêm lọc khoảng ngày tạo RMA (393-412).

### Khách hàng (Customers)
**Trạng thái tổng quan**: ⚠️ Cần cải thiện

| Tiêu chí | Trạng thái | Ghi chú |
|---|---|---|
| Giao diện nhất quán | ⚠️ | List dùng KPI cards + `bb-table` + badge token tốt. Detail không dùng `StatusBadge` shared; `SegmentBadge`/`CreditStatusBadge` dùng `rounded-full` cho badge chữ (CustomerDetailScreen.jsx:28,45) — admin theo token bo, không nên `rounded-full`. |
| Điều hướng | ✅ | List ScreenHeader + Export CSV (80-95). Detail eyebrow/title + "Quay lại danh sách" (185-196). Không create (đúng). |
| Thao tác CRUD | ⚠️ | Sửa hồ sơ/đổi status/sửa tín dụng đều có. Nhưng đổi status qua `<Select>` không confirm dù BLOCKED là hành động nặng (117-128). |
| Form & Validation | ❌ | Form sửa hồ sơ & tín dụng không validate (139-174); SĐT không kiểm định dạng; không đánh dấu `*`; không lỗi cạnh field; không StickyActionBar. |
| Table & Filter | ⚠️ | Lọc status + search + page size + empty guidance tốt (136-168). Thiếu lọc segment/chi tiêu; cột không sort. |
| Feedback & Toast | ✅ | `toast` đầy đủ; skeleton (187-192); error StatePanel + retry (162-163). |

**Điểm mạnh**: KPI tổng quan trực quan (98-131); gating tốt — credit/coupon section ẩn theo `hasPermission` (67-69,339,479), nút sửa disabled khi `!canUpdate` (231).
**Điểm yếu**: **Nhiều chuỗi tiếng Việt hardcode chưa qua i18n** trong Detail ("Chỉnh sửa hồ sơ", "Hồ sơ tín dụng (Công nợ)", "Mã giảm giá của khách hàng", toast — CustomerDetailScreen.jsx:206,229,341-507,146,168; `CREDIT_STATUS_LABELS`:34). Đổi status BLOCKED không confirm. Form không validate.
**Gợi ý cải thiện**: Đưa chuỗi hardcode về i18n (206-507). Thêm `showConfirm` khi chuyển BLOCKED/DISABLED (handleStatusChange:117). Validate SĐT + đánh dấu bắt buộc (235-263) và hạn mức/term số dương (433-453).

### Mã giảm giá (Coupons)
**Trạng thái tổng quan**: ⚠️ Cần cải thiện

| Tiêu chí | Trạng thái | Ghi chú |
|---|---|---|
| Giao diện nhất quán | ⚠️ | `bb-card`/`bb-table`/badge token + shadcn tốt. Nhưng icon nút bật/tắt trạng thái dùng `Copy` (CouponListScreen.jsx:597) — sai ngữ nghĩa (giống "sao chép"). |
| Điều hướng | ✅ | ScreenHeader + 3 nút (Gửi nhóm/Gửi hàng loạt/Tạo mã) nổi bật, gated `canUpdate` (250-274). Sửa qua inline form. |
| Thao tác CRUD | ✅ | Tạo/sửa/xóa/bật-tắt; delete có `showConfirm` + xử lý lỗi 409 "đã dùng trong đơn" (117-133); gửi hàng loạt confirm 2 lần (205-220). |
| Form & Validation | ⚠️ | Tạo validate code/name + map lỗi field (137-163). Field khác chỉ dựa `required`/`min` HTML; form sửa không validate ngoài backend (182-203); label `<span>` không đánh dấu `*`. |
| Table & Filter | ⚠️ | Lọc status + search + page size + empty guidance (500-530). Thiếu lọc theo kênh/loại giảm dù có cột Kênh; cột không sort. |
| Feedback & Toast | ✅ | `toast` cho xóa/gửi hàng loạt; `Alert` cho lỗi; skeleton (552-557); error StatePanel + retry. |

**Điểm mạnh**: Gửi mã hàng loạt UX kỹ (chọn → preview đối tượng → confirm không-hoàn-tác, 284-377); xử lý 409 nghiệp vụ; channel badge online/POS phù hợp bán đa kênh.
**Điểm yếu**: Icon `Copy` cho bật/tắt sai nghĩa (597,657). **Nhiều chuỗi hardcode** ("Gửi mã theo nhóm", "Kênh áp dụng", "Tất cả kênh/Chỉ online/Chỉ tại quầy", toast — 24,257-264,119-131,424-431).
**Gợi ý cải thiện**: Đổi icon bật/tắt sang `Power`/`ToggleLeft` (597,657). i18n hóa chuỗi kênh/bulk/toast (24,257-264,119-131,424-431). Thêm filter theo kênh (500-521).

### Đánh giá (Reviews)
**Trạng thái tổng quan**: ⚠️ Cần cải thiện

| Tiêu chí | Trạng thái | Ghi chú |
|---|---|---|
| Giao diện nhất quán | ⚠️ | List card + summary đẹp; badge token. Nhưng `Stars` tự vẽ ký tự `★` (ReviewListScreen.jsx:28-36); Detail dùng shadcn `Badge` (ReviewDetailScreen.jsx:17) khác `StatusBadge` list — 2 cơ chế badge cho cùng review status. |
| Điều hướng | ✅ | List ScreenHeader (không cần create). Detail back button (118-120) + nút mở sản phẩm (143-147). |
| Thao tác CRUD | ✅ | Duyệt/spam/xóa cả list và detail; delete có `showConfirm` (ReviewListScreen.jsx:92; ReviewDetailScreen.jsx:64). |
| Form & Validation | ✅ | Không có form nhập (chỉ đổi trạng thái); nút disabled khi `busy` (160-171). |
| Table & Filter | ⚠️ | Status tabs + search + page size + empty guidance (204-250). Thiếu lọc theo sao/sản phẩm; phân bố sao tính chỉ trên trang hiện tại (112-122). |
| Feedback & Toast | ⚠️ | Detail dùng `toast` (55,57,70,73). Nhưng **List KHÔNG có toast** — duyệt/spam thành công im lặng, chỉ lỗi mới hiện Alert (78-100). |

**Điểm mạnh**: Summary + "Cần xử lý" (chờ duyệt, 1-sao) định hướng hành động (145-201); phân bố sao từ data thật; gating `canUpdate` ẩn nút (304-318).
**Điểm yếu**: List thiếu toast khi duyệt/spam (78-89); 2 cơ chế badge khác nhau; avatar color theo index đổi khi đổi trang (269); summary tính trên trang hiện tại dễ hiểu nhầm là toàn cục.
**Gợi ý cải thiện**: Thêm `toast.success` sau `handleStatusChange` ở list (81-85). Thống nhất `StatusBadge` ở detail (15-23). Ghi rõ "trên trang này" cho summary hoặc lấy distribution từ API tổng.

---

# NHÓM 2 — SẢN PHẨM

### Sản phẩm (Products) — ProductList, ProductDetail, FeaturedProducts
**Trạng thái tổng quan**: ✅ Tốt

| Tiêu chí | Trạng thái | Ghi chú |
|---|---|---|
| Giao diện nhất quán | ✅ | List `bb-screen-header`/`bb-card`/`bb-table`, `PublishStatusBadge`/`StockStatusBadge`, ảnh `loading="lazy"` (ProductListScreen.jsx:271-294,504). Detail `Screen`/`ScreenHeader`/`SectionCard`/`Tabs` (2700-2812). Vài inline px nhỏ. |
| Điều hướng | ✅ | List ScreenHeader + tạo nổi bật + Export CSV (278-294). Detail `X`/`handleClose` xác nhận khi dirty (2742-2751). |
| Thao tác CRUD | ✅ | Tạo/sửa/xóa mềm + khôi phục + nhân bản, `showConfirm` trước xóa/khôi phục (131-177), bulk delete/restore (245-267). Featured drag-drop reorder `SortableList` (202-220). |
| Form & Validation | ✅ | Lỗi gần field, tab hiển thị count lỗi (2806-2811), zod + scroll/focus field lỗi, **autosave + draft-recovery** (2251-2384), `beforeunload` guard, **StickyActionBar** 3 trạng thái (3444-3497), ReadOnly badge + banner (2732-2761). |
| Table & Filter | ✅ | Responsive ẩn cột, lọc category/brand/publish/stock/sort + search + page size (299-362), empty riêng cho TRASH (179-187,396-404), URL sync. |
| Feedback & Toast | ✅ | `toast` sonner đầy đủ; skeleton (438-443); StatePanel error + retry; cảnh báo vượt FEATURED_GRID (371-384). |

**Điểm mạnh**: ProductDetail form phức tạp xử lý rất tốt — autosave, draft-recovery, sticky save 3 trạng thái, tab đếm lỗi, gating qua `isReadOnly`. List đầy đủ lọc/sort/bulk/trash/restore.
**Điểm yếu**: Vài inline `style` px lẻ. Row menu (`bb-row-menu`) là dropdown thủ công thay vì shadcn `DropdownMenu` (515-550) trong khi Detail đã dùng shadcn DropdownMenu (3472-3495) — thiếu nhất quán.
**Gợi ý cải thiện**: Thay dropdown thủ công (ProductListScreen.jsx:515-550) bằng shadcn `DropdownMenu`. Chuyển `style={{ fontSize: 12.5 }}` (498,612) sang Tailwind.

### Thuộc tính (Attributes) — quản lý trong ProductDetailScreen
**Trạng thái tổng quan**: ⚠️ Cần cải thiện (khoảng trống kiến trúc, không phải lỗi)

| Tiêu chí | Trạng thái | Ghi chú |
|---|---|---|
| Giao diện nhất quán | ✅ | Quản lý thuộc tính/biến thể trong tab "Biến thể": `VariantsEditor`/`VariantCard` (ProductDetailScreen.jsx:1355-1529); đổi tên/giá trị màu qua `AttributeRenameModal`/`AttributeValueManagerModal` dùng shadcn (986-1176). |
| Điều hướng | ⚠️ | **Không có màn Thuộc tính riêng.** Chỉ truy cập qua biến thể của một sản phẩm (nút Pencil cạnh Select, 1251-1328). Quản lý đổi tên là thao tác cấp catalog nhưng ẩn trong form sản phẩm. |
| Thao tác CRUD | ⚠️ | Có tạo màu/đổi tên thuộc tính/đổi tên giá trị (986-1175). **Không xóa thuộc tính/giá trị, không tạo thuộc tính mới** (chỉ chọn từ danh sách). |
| Form & Validation | ✅ | Modal đổi tên label rõ, song ngữ VI/EN, nút Lưu chỉ bật khi dirty (1005-1058). |
| Table & Filter | ❌ | Không áp dụng — không có danh sách thuộc tính độc lập để lọc/tìm/sắp xếp. |
| Feedback & Toast | ✅ | `toast.success`/`error` + invalidate cache (997-1122). |

**Điểm mạnh**: Gắn thuộc tính/màu ngay tại nơi tạo biến thể giảm context-switch.
**Điểm yếu**: Thuộc tính/giá trị màu là dữ liệu dùng chung toàn hệ thống nhưng không có trang quản trị riêng — dọn dẹp phải mở một sản phẩm bất kỳ rồi mò vào biến thể; không xóa được thừa, không xem được dùng ở đâu.
**Gợi ý cải thiện**: Cân nhắc màn "Thuộc tính" riêng (list + đếm số biến thể dùng + đổi tên/xóa an toàn). Hiện đủ dùng cho luồng nhập, không chặn (ProductDetailScreen.jsx:986-1176).

### Danh mục (Categories)
**Trạng thái tổng quan**: ✅ Tốt

| Tiêu chí | Trạng thái | Ghi chú |
|---|---|---|
| Giao diện nhất quán | ✅ | List `bb-screen-header`/`StatusBadge`/shadcn, tree-view thumbnail + hover popover (CategoryListScreen.jsx:488-636). Detail `bb-card`/`form-field`/shadcn/`RichTextEditor`/`ImageUrlInput`. |
| Điều hướng | ✅ | List header + tạo (700-713). Detail back "← Quay lại" + breadcrumb path + "Xem trên web" + copy ID (455-518), Esc → back. |
| Thao tác CRUD | ✅ | Tạo/sửa, **drag-drop reorder** optimistic + rollback (343-395), bulk visibility leaves-first (271-315), hard-delete cảnh báo số con (313-323) + `showConfirm`. |
| Form & Validation | ✅ | Lỗi gần field, zod + scroll/focus (347-371), chống chọn parent là con cháu (200-233), `beforeunload` guard. |
| Table & Filter | ✅ | Tree + flat mode, search highlight + auto-expand ancestors (97-113), lọc visibility/sort, FilterChips (663-694), empty riêng cho search/trống (833-856). |
| Feedback & Toast | ✅ | `toast` + **Undo** sau toggle ẩn/hiện (228-239), bulk result theo tone, skeleton (822-831). |

**Điểm mạnh**: Tree + flat dual-mode, drag-reorder optimistic, bulk leaves-first thông minh, Undo toggle, banner nhắc cập nhật menu. Rất chỉn chu.
**Điểm yếu**: Rất ít — vài inline `style` px (463,488).
**Gợi ý cải thiện**: Không có vấn đề chặn.

### Thương hiệu (Brands)
**Trạng thái tổng quan**: ⚠️ Cần cải thiện

| Tiêu chí | Trạng thái | Ghi chú |
|---|---|---|
| Giao diện nhất quán | ✅ | List `bb-screen-header`/`bb-card`/`bb-table`/`StatusBadge`, responsive MobileCard. Detail `bb-card`/shadcn/`RichTextEditor`/`ImageUrlInput`. |
| Điều hướng | ✅ | List header + tạo (74-82). Detail back link + ẩn + Save (266-304). |
| Thao tác CRUD | ⚠️ | Tạo/sửa/ẩn (soft delete = ẩn) có `showConfirm` (281-289). List không có cột số sản phẩm, không bulk, không reorder. |
| Form & Validation | ✅ | Lỗi gần field, zod, `beforeunload`, song ngữ. **Không scroll-to-error** như Category/Product (211-226 chỉ setValidationErrors). |
| Table & Filter | ⚠️ | Search + lọc visibility + sort + page size (87-117). Thiếu sort tên Z-A; description cắt không giới hạn dòng. |
| Feedback & Toast | ✅ | `toast` đầy đủ (177-198), skeleton (156-161), StatePanel error + retry. |

**Điểm mạnh**: Cấu trúc nhất quán với Category, song ngữ, media đầy đủ (logo/banner/mobile banner).
**Điểm yếu**: Detail thiếu scroll-to-first-error (kém hơn Category/Product). List không hiển thị số sản phẩm thuộc brand → không biết brand nào đang dùng trước khi ẩn.
**Gợi ý cải thiện**: Thêm scroll/focus tới field lỗi (BrandDetailScreen.jsx:218-221) theo mẫu CategoryDetailScreen.jsx:359-369. Thêm cột "số sản phẩm" vào BrandListScreen.

### Serial Number
**Trạng thái tổng quan**: ✅ Tốt

| Tiêu chí | Trạng thái | Ghi chú |
|---|---|---|
| Giao diện nhất quán | ✅ | `bb-screen-header`/`bb-card`/`bb-table`, `SerialStatusPill` màu theo state machine + i18n, responsive MobileCard, modal shadcn (SerialListScreen.jsx:30-39,162-263). |
| Điều hướng | ✅ | Header rõ; chi tiết qua modal click hàng (362,402-410). |
| Thao tác CRUD | ✅ | Đổi trạng thái theo `SERIAL_ALLOWED_TRANSITIONS`, terminal (SCRAPPED) xác nhận 2 bước (139-249), ghi chú bắt buộc cho status nhất định (135-138). |
| Form & Validation | ✅ | Note bắt buộc có `*` (236), validate lý do trước đổi (135-138), lỗi gần nút (250). |
| Table & Filter | ⚠️ | Search + lọc status + page size (304-323). Thiếu lọc theo sản phẩm/biến thể; không sort cột. Empty state có mô tả (334-336). |
| Feedback & Toast | ✅ | `toast.success` (153), error inline, panel bảo hành lazy-load (49-113) với loading/empty/forbidden/error. |

**Điểm mạnh**: Tôn trọng state machine, xác nhận terminal, panel bảo hành gắn liền, gating `canReadWarranty`.
**Điểm yếu**: Không lọc theo sản phẩm; không sort — kho lớn nhiều serial tìm theo product có thể chậm.
**Gợi ý cải thiện**: Thêm filter theo sản phẩm/brand (SerialListScreen.jsx:304-323).

### Bảo hành (Warranty)
**Trạng thái tổng quan**: ✅ Tốt

| Tiêu chí | Trạng thái | Ghi chú |
|---|---|---|
| Giao diện nhất quán | ✅ | `bb-screen-header`/`bb-card`/`bb-table`, `StatusBadge` warranty, responsive MobileCard, modal shadcn (51-120,188-261). |
| Điều hướng | ✅ | Header rõ; chi tiết qua modal "Xem" (222-224). |
| Thao tác CRUD | ✅ | Void bảo hành 2 bước (93-116); không tạo thủ công (đúng — sinh từ đơn). |
| Form & Validation | ✅ | Void có confirm inline + error (100-111). |
| Table & Filter | ✅ | Search + lọc status (ACTIVE/EXPIRED/VOIDED) + page size (159-178), cột đầy đủ, empty state. |
| Feedback & Toast | ✅ | `toast.success` (43), skeleton (206-211), StatePanel retry. |

**Điểm mạnh**: Đơn giản, đúng nghiệp vụ (read + void), i18n đầy đủ, void có xác nhận.
**Điểm yếu**: Không đáng kể.
**Gợi ý cải thiện**: Cân nhắc thêm lọc theo ngày hết hạn để lọc bảo hành sắp hết. Không có vấn đề chặn.

### Tồn kho (Inventory)
**Trạng thái tổng quan**: ⚠️ Cần cải thiện

| Tiêu chí | Trạng thái | Ghi chú |
|---|---|---|
| Giao diện nhất quán | ⚠️ | KPI banner + `StockStatusBadge` + shadcn + QR. Nhưng placeholder hết hàng dùng ký tự `◻`/`✕` thô (68,486); bảng serial/movement dùng `<table>` Tailwind thủ công thay `bb-table` (941,1177,1704). |
| Điều hướng | ✅ | Header + Export CSV (1831-1852); thao tác qua modal. |
| Thao tác CRUD | ✅ | Nhập kho (StockInModal), import serial CSV/Excel (213-238), đổi trạng thái + confirm SCRAPPED (1113-1144), in QR; validate số lượng vs serial khớp (572-587). |
| Form & Validation | ✅ | Nhãn + `*` (337-339,745-748), lỗi gần field, preview/đếm serial trùng/trống/vượt (401-463), giới hạn file 5MB. |
| Table & Filter | ⚠️ | Search + lọc stockState + page size (1871-1891). Thiếu lọc brand/category. Banner giải thích stockState tốt (1856-1867). |
| Feedback & Toast | ✅ | `toast` đầy đủ, skeleton, KPI summary, import result + bảng lỗi + retry skipped (986-1023). |

**Điểm mạnh**: Module nặng nhất xử lý rất kỹ — import serial từ file, QR tem, gom biến thể theo màu, movement history, validate trùng/đủ số lượng, serialOnlyMode banner.
**Điểm yếu**: **Rất nhiều chuỗi tiếng Việt hardcode chưa qua i18n** trong modal serial/inventory (tiêu đề, tab, header bảng, AddSerialsPanel, banner stockState — 837-839,1180,1209-1289,1707,1849-1865) trong khi Serial/Warranty đã i18n đầy đủ → admin EN thấy lẫn lộn. Bảng serial/movement dùng `<table>` thủ công.
**Gợi ý cải thiện**: i18n hóa toàn bộ chuỗi hardcode (InventoryScreen.jsx:837-839,893-1023,1150-1289,1707,1849-1865).

---

# NHÓM 3 — NỘI DUNG & MARKETING

### Bài viết (Articles/Content)
**Trạng thái tổng quan**: ✅ Tốt

| Tiêu chí | Trạng thái | Ghi chú |
|---|---|---|
| Giao diện nhất quán | ✅ | List `bb-screen-header`/`bb-card`/`bb-table`/`PublishStatusBadge` (79-105,223). Detail `Screen`/`ScreenHeader`/`SectionCard` + token (641-676). Màu SERP Google cố ý (923-942). |
| Điều hướng | ✅ | List ScreenHeader + tạo khớp tab loại (95-103). Detail nút đóng/back (664-674) + back trong StatePanel lỗi (563,575). |
| Thao tác CRUD | ✅ | Create/edit/delete; xóa (archive) qua `showConfirm` (629-637). |
| Form & Validation | ✅ | Label qua `Field`, lỗi dưới field, `*` bắt buộc (132-145); draft/auto-save localStorage TTL 1h + banner khôi phục (255-282); `beforeunload` (437-442); ReadOnlyBanner khi `!canUpdate` (679-684); tab nhảy tới lỗi (517-518). |
| Table & Filter | ✅ | Cột quan trọng, tab ARTICLE/PAGE, lọc publishStatus, search debounce, page size; empty + reset (160-168). |
| Feedback & Toast | ✅ | `toast` sonner (472-493); skeleton (187-193); StickyActionBar chỉ báo saving/dirty/saved (599-608). |

**Điểm mạnh**: Editor hoàn thiện — auto-save, SERP preview, checklist SEO, song ngữ VI/EN, tab gom theo vai trò.
**Điểm yếu**: Vài trường page lộ tên kỹ thuật trong label ("parentId", 1046; "pageType", 767).
**Gợi ý cải thiện**: Bỏ "(parentId)"/"(pageType)" khỏi label hiển thị (ContentDetailScreen.jsx:1046,767).

### Thẻ / Chuyên mục bài viết (ContentCategoryManagerModal)
**Trạng thái tổng quan**: ✅ Tốt

| Tiêu chí | Trạng thái | Ghi chú |
|---|---|---|
| Giao diện nhất quán | ✅ | `Modal` chung + shadcn `Button`/`Input`, token (111-211). Mở từ nút "Danh mục" trên header (86-94). |
| Điều hướng | ✅ | Modal tiêu đề + nút đóng; gọi từ list. |
| Thao tác CRUD | ⚠️ | Create/edit; **không delete** (backend chỉ POST/PATCH — 32-33). Giới hạn backend, không phải lỗi UI. |
| Form & Validation | ✅ | Label rõ, slug tự sinh từ tên (19-28), validate name/slug, lỗi dưới field (181,195). |
| Table & Filter | ✅ | Danh sách + loading/error/empty (123-160). Phạm vi nhỏ không cần filter. |
| Feedback & Toast | ✅ | `toast` success/error (55-65), spinner khi lưu (205). |

**Điểm mạnh**: Gọn, đủ luồng, tự sinh slug an toàn cho tiếng Việt.
**Điểm yếu**: Không cho xóa danh mục (giới hạn backend).
**Gợi ý cải thiện**: Nếu backend bổ sung DELETE, thêm nút xóa + ConfirmDialog (147-156).

### Menu
**Trạng thái tổng quan**: ⚠️ Cần cải thiện

| Tiêu chí | Trạng thái | Ghi chú |
|---|---|---|
| Giao diện nhất quán | ⚠️ | `bb-screen-header` (637-643) nhưng bảng/hàng dùng class CSS riêng (`menu-table`, `menu-slot-tab`…) thay `AdminTable`/`bb-table`; form dùng `form-field`/`form-grid` legacy thay `Field` shadcn (205-282). |
| Điều hướng | ✅ | ScreenHeader; slots tab cố định (đúng thiết kế); "Thêm mục" nổi bật (703-708). |
| Thao tác CRUD | ✅ | Create/edit/delete + drag-drop cùng cấp (DndContext, 755-797); xóa qua `showConfirm` (559) + chặn xóa khi còn con (554-557). |
| Form & Validation | ⚠️ | Có label + validate URL/label (165-168), nhưng lỗi chỉ disable nút submit, không hiện cạnh field (trừ URL 240-242). ReadOnlyBanner không hiện khi `!canUpdate` (warning rỗng, 380,645). |
| Table & Filter | ⚠️ | Cột hợp lý + search tên/URL (713-733). Không cột trạng thái riêng. Empty + nút thêm (738-749). |
| Feedback & Toast | ✅ | `toast` success/error đầy đủ (439-506). |

**Điểm mạnh**: Cây menu đa cấp, kéo thả, song ngữ nhãn, chặn xóa khi có con.
**Điểm yếu**: Nhiều chuỗi hardcode (`SLOT_CONTEXT_NOTES` 170-174, placeholder/title 236,302,328,331,720); dùng class CSS legacy thay primitive/Tailwind.
**Gợi ý cải thiện**: Đưa chuỗi hardcode vào i18n (170-174,236,302,328,331,720,752); cân nhắc chuyển form sang `Field`/FormField chung.

### Thư viện Media
**Trạng thái tổng quan**: ⚠️ Cần cải thiện

| Tiêu chí | Trạng thái | Ghi chú |
|---|---|---|
| Giao diện nhất quán | ✅ | `bb-screen-header` + shadcn + FilterChips/BulkActionBar chung, token Tailwind (362-389). |
| Điều hướng | ✅ | ScreenHeader + Upload nổi bật + Thùng rác (369-388); detail panel bên phải (623-639). |
| Thao tác CRUD | ✅ | Upload/edit/xóa mềm/khôi phục/xóa cứng + bulk (delete/restore/move/hard-delete) + drag-drop upload; mọi delete qua `showConfirm` (203-283). |
| Form & Validation | ✅ | Validate MIME + dung lượng ≤50MB (157-162), sửa alt/title/caption; gating `canUpdate`/`canHardDelete`. |
| Table & Filter | ✅ | Filter mạnh: type/usage/sort + nâng cao (ngày/dung lượng/kích thước), search, grid/list, folder sidebar, chips, empty + reset (582-585). |
| Feedback & Toast | ✅ | `toast` sonner; **thanh tiến trình upload %/file** (653-683) + báo lỗi từng file; skeleton (579). |

**Điểm mạnh**: Module media chất lượng cao — upload tiến trình, keyboard nav, bulk move/restore, usage tracking, copy URL.
**Điểm yếu**: `aria-label="Dismiss"` còn tiếng Anh (664); không có cảnh báo dimension khi upload ảnh quá nhỏ (chỉ gợi ý text 394).
**Gợi ý cải thiện**: i18n cho "Dismiss" (664) và bulk-move popover; cân nhắc cảnh báo dimension khi upload.

### Chuyển hướng (Redirects)
**Trạng thái tổng quan**: ✅ Tốt

| Tiêu chí | Trạng thái | Ghi chú |
|---|---|---|
| Giao diện nhất quán | ✅ | `bb-screen-header`/`bb-card`/`bb-table`/`bb-badge` + shadcn (203-216,348-398). |
| Điều hướng | ✅ | ScreenHeader + "Tạo chuyển hướng" gated `canUpdate` (209-215); form inline. |
| Thao tác CRUD | ✅ | Create/edit inline + delete qua `showConfirm` (165-175). |
| Form & Validation | ✅ | Validate source/target bắt buộc, lỗi qua `Alert` (231) + `formError` (187-194). |
| Table & Filter | ✅ | Cột đầy đủ (có hitCount); lọc enabled + statusCode + search; empty + CTA tạo/reset (333-341). |
| Feedback & Toast | ✅ | `toast` success/error (115-130); skeleton (362-368). |

**Điểm mạnh**: Đầy đủ, lọc tốt, có cột lượt truy cập.
**Điểm yếu**: Label loại hiển thị tiếng Anh ("Permanent"/"Temporary", 246-260) trong UI khóa tiếng Việt.
**Gợi ý cải thiện**: Việt hóa option loại chuyển hướng — đã có `normalizeRedirectTypeLabel` nhưng không dùng cho dropdown (RedirectListScreen.jsx:246-248).

### Trang chủ / Marketing blocks (Slider + Video + Highlights)
**Trạng thái tổng quan**: ⚠️ Cần cải thiện

| Tiêu chí | Trạng thái | Ghi chú |
|---|---|---|
| Giao diện nhất quán | ⚠️ | Cả 3 dùng `bb-screen-header`/`bb-card`/`bb-badge` + shadcn. Nhưng Slider & Video nhiều inline `style` (SliderListScreen.jsx:43,57,77-93; HomeVideoListScreen.jsx:172-176). Highlights sạch nhất (Tailwind thuần). |
| Điều hướng | ✅ | Cả 3 ScreenHeader + nút tạo/lưu nổi bật (Slider 298-308, Video 555-565, Highlights 187-199). |
| Thao tác CRUD | ⚠️ | Create/edit/delete + toggle + drag-drop reorder; Video có bulk. Nút xóa là raw `<button className="bb-btn">` với `style` thay shadcn `Button variant="danger"` (Slider 104, Video 194). Delete qua `showConfirm` ✅. |
| Form & Validation | ⚠️ | Có label + validate (Slider link/product + URL an toàn 248-260; Video title/URL YouTube 323-346). Lỗi chỉ là `formError` đầu form, không cạnh field. Video & Highlights có `<ReadOnlyBanner />`; Slider không. |
| Table & Filter | ⚠️ | Slider chỉ lọc location, không search. Video có search + filter trạng thái (459-482). Highlights 3 slot cố định. Empty đều có. |
| Feedback & Toast | ✅ | `toast` đầy đủ cả 3; loading/error StatePanel; reorder optimistic. |

**Điểm mạnh**: Highlights gọn đẹp; Video có bulk + preview modal + YouTube thumbnail; reorder optimistic mượt.
**Điểm yếu**: Nhiều chuỗi hardcode trong HomeVideoListScreen (465-517,480); import thừa `MediaDimensionWarning` (26); raw `bb-btn` cho xóa thay shadcn `Button` (Slider 98-104, Video 188-194); Slider inline px (63,71).
**Gợi ý cải thiện**: i18n chuỗi filter/bulk (HomeVideoListScreen.jsx:465-517); xóa import thừa (26); thay raw `bb-btn` xóa bằng `Button variant="danger"`; chuyển inline px sang token (SliderListScreen.jsx:43-93).

---

# NHÓM 4 — BÁO CÁO

### Báo cáo doanh thu (Revenue)
**Trạng thái tổng quan**: ⚠️ Cần cải thiện

| Tiêu chí | Trạng thái | Ghi chú |
|---|---|---|
| Giao diện nhất quán | ✅ | `bb-screen-header`/`bb-kpi-grid`/`bb-card`, màu KPI theo ngữ nghĩa (200-205); biểu đồ tô token `var(--admin-color-primary)` (223-249). |
| Điều hướng | ✅ | Header eyebrow/title/desc (132-137); preset 7d/30d/90d/Tuỳ chọn là `role="tablist"` + `aria-selected` (139-152). |
| Thao tác CRUD (export/date) | ❌ | Nút "Xuất đơn hàng (CSV)" gọi `exportOrdersCsv` không await, vứt blob (173) — không download/toast/lỗi. Đã có `ExportButton` làm đúng nhưng không dùng. Không có nút làm mới thủ công. |
| Form & Validation | ✅ | Khoảng ngày tuỳ chọn validate `from > to` → lỗi `reports.dateRangeError` (100-105). |
| Table & Filter | ⚠️ | Chỉ lọc khoảng ngày; thiếu lọc kênh (online/POS)/danh mục. Không phân trang (dữ liệu tổng hợp — chấp nhận). |
| Feedback & Toast | ⚠️ | Có StatePanel loading (187-189) + error (191-193). Nhưng export không feedback gì. |

**Điểm mạnh**: KPI + biểu đồ area dùng token nhất quán, validate khoảng ngày, có loading/error rõ.
**Điểm yếu**: Export thực chất không hoạt động với người dùng. Tooltip dùng `dash-tooltip` (admin-layout.css) trong khi Dashboard dùng `bb-dash-tooltip` — lệch hệ class.
**Gợi ý cải thiện**: Thay bằng `<ExportButton onExport={() => exportOrdersCsv({ from, to })} filename="bao-cao-don-hang.csv" />` (ReportsScreen.jsx:170-176). Đồng bộ tooltip về `bb-dash-tooltip` (22-25).

### Báo cáo sản phẩm (Top products)
**Trạng thái tổng quan**: ⚠️ Cần cải thiện

| Tiêu chí | Trạng thái | Ghi chú |
|---|---|---|
| Giao diện nhất quán | ✅ | Biểu đồ cột ngang + `RankTable` dùng `bb-card`/`bb-table`, màu token (285,291). |
| Điều hướng | ✅ | Trong cùng screen header/preset chung. |
| Thao tác CRUD (export) | ❌ | **Không có nút xuất riêng** dù `exportProductsCsv` có sẵn (adminApi.js:1620). |
| Form & Validation | ✅ | Dùng chung khoảng ngày + validate của screen. |
| Table & Filter | ⚠️ | Bảng có cột sản phẩm/đã bán/doanh thu + dòng "Không có dữ liệu" (48-51). Không sort (table thô), không lọc danh mục, không phân trang. |
| Feedback & Toast | ⚠️ | Có empty trong bảng; biểu đồ cột rỗng biến mất không có empty-state (260). Dùng chung loading/error. |

**Điểm mạnh**: Biểu đồ + bảng song song, empty-state trong bảng, cắt tên dài gọn.
**Điểm yếu**: Không export riêng; bảng không sort/filter/paginate; biểu đồ rỗng biến mất.
**Gợi ý cải thiện**: Thêm export qua `exportProductsCsv` (khu vực 170-181). Cân nhắc `AdminTable` cho `RankTable` (34-68). Empty-state cho biểu đồ khi rỗng (260).

### Báo cáo khách hàng (Top customers)
**Trạng thái tổng quan**: ⚠️ Cần cải thiện

| Tiêu chí | Trạng thái | Ghi chú |
|---|---|---|
| Giao diện nhất quán | ✅ | `RankTable`/`bb-card`, cột email/số đơn/chi tiêu, tiền qua `formatCurrencyVnd` (310-319). |
| Điều hướng | ✅ | Trong cùng screen, `bb-grid-2` cạnh bảng sản phẩm (299). |
| Thao tác CRUD (export) | ❌ | **Không có nút xuất** dù `exportCustomersCsv` có sẵn (adminApi.js:1616). |
| Form & Validation | ✅ | Dùng chung khoảng ngày/validate. |
| Table & Filter | ⚠️ | Cột quan trọng + empty; không sort/lọc/paginate; hàng không click sang chi tiết khách. |
| Feedback & Toast | ⚠️ | Chỉ empty + loading/error chung; không toast. |

**Điểm mạnh**: Hiển thị gọn top khách theo chi tiêu, có empty-state, định dạng tiền chuẩn.
**Điểm yếu**: Không export riêng; bảng tĩnh.
**Gợi ý cải thiện**: Thêm export qua `exportCustomersCsv`; cho hàng điều hướng tới `/admin/customers/...` (310-319).

### Tổng quan / Dashboard (bonus)
**Trạng thái tổng quan**: ✅ Tốt

| Tiêu chí | Trạng thái | Ghi chú |
|---|---|---|
| Giao diện nhất quán | ✅ | KPI cards icon + màu ngữ nghĩa (325-375), biểu đồ area + pie tô token (42-50,393-397). |
| Điều hướng | ✅ | Lời chào theo giờ + ngày (275-276), period 7d/30d/90d `role="tablist"` (279-292), KPI/legend click sang module (325,442,473,576). |
| Thao tác CRUD (refresh) | ✅ | react-query polling 90s + refetch khi focus (139-167); error có "Thử lại" gọi `refetch()` (296-304). |
| Form & Validation | ✅ | Chỉ chọn period qua tab; không form nhập (N/A). |
| Table & Filter | ✅ | Đơn gần đây + top sản phẩm desktop table + `MobileCardList` responsive (563-678), rank badge, StatusBadge. |
| Feedback & Toast | ✅ | Skeleton (306-319), `SectionEmpty` từng khối, error StatePanel retry; "Cần chú ý" sắp theo nghiêm trọng (222-268). |

**Điểm mạnh**: Màn analytics hoàn chỉnh — KPI trend pill, biểu đồ doanh thu + phân bổ trạng thái đơn, "Cần chú ý" gom công nợ quá hạn/tồn thấp/đơn chờ/trả hàng + CTA; responsive; auto-refresh nền không nháy.
**Điểm yếu**: Legend pie dùng inline `style` px (469-489). Dashboard gắn `orders.read` chứ không quyền riêng (App.jsx:209).
**Gợi ý cải thiện**: Chuyển legend pie sang `bb-*`/Tailwind (DashboardScreen.jsx:469-489).

> **Ghi chú perf (ngoài bảng):** Reports dùng `useEffect` + state thủ công, **không cache** (mỗi lần đổi preset gọi lại API) trong khi Dashboard dùng react-query. Charts (`recharts`) import tĩnh, không lazy. Biểu đồ thiếu legend/aria cho screen reader; trục chỉ có nhãn "M" (triệu) không kèm đơn vị.

---

# NHÓM 5 — HỆ THỐNG

### Vận chuyển (Shipping)
**Trạng thái tổng quan**: ✅ Tốt

| Tiêu chí | Trạng thái | Ghi chú |
|---|---|---|
| Giao diện nhất quán | ✅ | `bb-screen-header` + `bb-card` + `bb-badge`, token đúng hệ (163-169,312-314). |
| Điều hướng | ✅ | Sidebar 3 vùng MB/MT/MN active state rõ (193-200); nút thêm phương thức nổi bật (251-259). |
| Thao tác CRUD | ✅ | Tạo/sửa/xóa; xóa có `showConfirm` (126-128); kéo-thả sắp xếp có rollback (144-159). |
| Form & Validation | ✅ | Label + `*` (216), validate phí/ngưỡng không âm (87-91), nút disabled khi lưu (237). |
| Table & Filter | ⚠️ | Bảng tốt, empty + hướng dẫn (268-270); không search/sort (chấp nhận vì danh sách nhỏ theo vùng). |
| Feedback & Toast | ⚠️ | Lỗi qua `Alert` (173-177), loading StatePanel, **nhưng không toast khi tạo/sửa/xóa/sắp xếp thành công** (grep toast = 0). |

**Điểm mạnh**: Kéo-thả an toàn (optimistic + rollback), gating `canUpdate` nhất quán (251,278,296,316,349), song ngữ tên phương thức.
**Điểm yếu**: Thiếu toast thành công; thiếu `ReadOnlyBanner` khi `!canUpdate`.
**Gợi ý cải thiện**: Thêm toast sau create/update/delete (ShippingScreen.jsx:113-132). `ReadOnlyBanner` khi `!canUpdate` (sau dòng 169).

### Cài đặt (Settings)
**Trạng thái tổng quan**: ✅ Tốt

| Tiêu chí | Trạng thái | Ghi chú |
|---|---|---|
| Giao diện nhất quán | ✅ | Tab sidebar icon + label theo nhóm (608-632), `bb-card`; vài inline `style` px/hex (338,342,346). |
| Điều hướng | ✅ | Nhóm chia tab theo `TAB_ORDER`, badge số thay đổi chưa lưu/tab (625-629). |
| Thao tác CRUD | ✅ | Lưu theo lô từng tab; xác nhận tab nhạy cảm STORE/TAX (530-536); nút Huỷ (421-423). |
| Form & Validation | ✅ | Label tiếng Việt dễ hiểu (147-225), validate email/url/phone/rate/số (66-95), lỗi cạnh field (379-381), chấm "chưa lưu" per-field (286-291). |
| Table & Filter | n/a | Dạng form, không bảng. |
| Feedback & Toast | ✅ | Banner "lưu thành công" role=status tự ẩn (637-645), nút lưu hiện số thay đổi (424-426). |

**Điểm mạnh**: UX form dài tốt — gom tab, đếm thay đổi per-tab/per-field, xác nhận riêng cho cài đặt ảnh hưởng giá/checkout, ẩn nhóm kỹ thuật (SECURITY/SePay 122-131), gating super-admin cho PRODUCT_ASSIGN (466).
**Điểm yếu**: Inline `style` px/borderRadius thô (338,342,346,380). `ReadOnlyBanner` chỉ hiện khi backend trả `warning`.
**Gợi ý cải thiện**: Thay inline style (SettingsScreen.jsx:336-349) bằng Tailwind token. Cân nhắc `ReadOnlyBanner` chủ động khi `!canUpdate` (sau dòng 600).

### Quản trị viên (Admin Users)
**Trạng thái tổng quan**: ⚠️ Cần cải thiện

| Tiêu chí | Trạng thái | Ghi chú |
|---|---|---|
| Giao diện nhất quán | ✅ | `bb-screen-header`, `bb-badge` cho role/status, avatar token (55-77). |
| Điều hướng | ✅ | "Tạo" nổi bật (286-288); sửa qua Modal drawer; phân trang (451-456). |
| Thao tác CRUD | ⚠️ | Tạo + sửa tốt; không xóa (vô hiệu hóa qua status — hợp lý cho audit). Hai nút (Pencil + MoreHorizontal) đều mở `openEdit` (401-406) — nút "..." thừa/gây nhầm. |
| Form & Validation | ⚠️ | Label đầy đủ; map lỗi field backend (259-261). Nhưng mật khẩu mới khi sửa không validate độ mạnh client (chỉ hint 540); email/tên chỉ `required` HTML. |
| Table & Filter | ✅ | Cột User/Role/Status/Lần đăng nhập cuối; lọc role + status + search debounce (296-322); empty phân biệt filter (335-352). |
| Feedback & Toast | ⚠️ | Thành công sửa hiện text trong drawer (480-482); **không toast toàn cục** sau tạo/sửa (grep toast = 0). Skeleton (370-376). |

**Điểm mạnh**: Self-protection chuẩn — chặn sửa role/status của chính mình ở UI (`disabled={isSelf}` 503,519), banner cảnh báo (486-490), payload không gửi role/status (223-227); xác nhận khi vô hiệu hóa/đổi role (206-212).
**Điểm yếu**: Nút `MoreHorizontal` lặp hành vi Pencil (404-406,441-443); thiếu toast nhất quán.
**Gợi ý cải thiện**: Bỏ/biến `MoreHorizontal` thành menu thực (404-406). Thêm toast sau `createAdminUser` (250-257). Validate độ dài mật khẩu trước submit (244-255).

### Phân quyền (Roles/Permissions)
**Trạng thái tổng quan**: ✅ Tốt

| Tiêu chí | Trạng thái | Ghi chú |
|---|---|---|
| Giao diện nhất quán | ⚠️ | Tailwind token + shadcn tốt; nhưng dialog tự dựng overlay `roles-confirm-overlay`/`roles-confirm-dialog` (216-222) thay vì shadcn Dialog/Modal — lệch chuẩn. Header `bb-screen-header` nhất quán. |
| Điều hướng | ✅ | Hai panel sidebar/detail, back mobile (1054-1062), `aria-current` cho role đang chọn (511). |
| Thao tác CRUD | ✅ | Tạo/sửa/xóa role; xóa có `DeleteRoleDialog` (459-491) + xử lý 409 khi đang dùng (973-975); SUPER_ADMIN không sửa/xóa (681); role hệ thống không xóa (688). |
| Form & Validation | ✅ | Ma trận quyền checkbox theo nhóm (544-609), `*` bắt buộc (378,408), auto-gen ID (339-344), banner dirty (715-719), tóm tắt thay đổi trước lưu (243-326). |
| Table & Filter | n/a | Master-detail, không bảng/filter. |
| Feedback & Toast | ✅ | `Toast` riêng tự ẩn 4s (167-185), gọi sau lưu/tạo/xóa (934,950,971); loading/error/empty (1028-1048). |

**Điểm mạnh**: Bảo mật xuất sắc — chặn tự gỡ quyền `roles.read/write` của role mình (`SELF_PROTECTED_PERMS` 139,888-896), cảnh báo khi sửa role mình (309-315), xác nhận quyền nhạy cảm (897-901) + tóm tắt 2 bước; hiển thị quyền "lạ" backend (751-775); fallback catalog khi API lỗi (14-83).
**Điểm yếu**: 4 dialog tự dựng overlay `roles-confirm-*` thay vì tái dùng `Modal`/shadcn Dialog — không nhất quán stack.
**Gợi ý cải thiện**: Chuyển dialog (RolesScreen.jsx:206-491) sang `Modal` chung hoặc shadcn `Dialog`.

### Nhật ký (Audit Logs)
**Trạng thái tổng quan**: ✅ Tốt

| Tiêu chí | Trạng thái | Ghi chú |
|---|---|---|
| Giao diện nhất quán | ✅ | `bb-screen-header`, `Badge` shadcn cho module, `AdminTable` + card mobile; tô đậm hành động nguy hiểm (176-180,311). |
| Điều hướng | ✅ | Click hàng mở drawer chi tiết, deep-link `?detail=` (115-120,550-554). |
| Thao tác CRUD | n/a | Read-only theo bản chất nhật ký — đúng. |
| Form & Validation | n/a | Không form nhập. |
| Table & Filter | ⚠️ | Lọc mạnh: search + module + actor + khoảng ngày + preset (today/7d/30d/month) + page size (663-765), URL-synced. **Nhưng cột KHÔNG sortable** — columns không set `sortable:true`, không truyền `onSortChange` (563-589,821-829) dù AdminTable hỗ trợ. |
| Feedback & Toast | ✅ | Skeleton bảng + card (834-839), error/empty StatePanel phân biệt filter (797-815), summary đếm (787-794), export CSV BOM UTF-8 (89-90). |

**Điểm mạnh**: Lọc theo ngày/actor/action/entity đầy đủ; capture diff before/after + raw JSON toggle (290-353); đánh dấu hành động nguy hiểm (xóa/hủy/refund); audit ghi đủ action quan trọng (DANGEROUS_ACTIONS 18-27).
**Điểm yếu**: Bảng không sắp xếp cột; filter "action" chỉ gián tiếp qua search.
**Gợi ý cải thiện**: Thêm `sortable: true` cho cột `createdAt` + truyền `sortKey/sortDir/onSortChange` (AuditLogListScreen.jsx:563-589,821-829). Cân nhắc dropdown lọc theo action.

---

## Phase 2 — Thứ tự sửa đề xuất (chỉ thực hiện sau khi xác nhận)

Theo yêu cầu: **layout shell → shared components → từng module theo nhóm**. Không refactor logic, không đổi tên/xóa component. Comment rõ tại block đã sửa.

1. **Fix nghiêm trọng (❌) trước:**
   - Sửa export Báo cáo: dùng `ExportButton` cho doanh thu + thêm export sản phẩm/khách hàng (ReportsScreen.jsx).
   - Thêm validation form Khách hàng (SĐT, số dương, đánh dấu bắt buộc, lỗi cạnh field) — CustomerDetailScreen.jsx.

2. **Shared/cross-cutting (ảnh hưởng nhiều module):**
   - i18n hóa chuỗi hardcode (ưu tiên CustomerDetail, InventoryScreen, Coupons, MenuScreen, HomeVideoListScreen).
   - Thêm toast xác nhận thành công nơi còn thiếu (Reviews list, Shipping, AdminUsers).
   - Thêm `ReadOnlyBanner` chủ động khi `!canUpdate` (Shipping, Settings, Menu, Slider, Redirect, Order detail).

3. **Per-module polish:**
   - Audit log + Report tables: bật sort / dùng `AdminTable`.
   - Đổi icon `Copy` → `Power`/`ToggleLeft` ở Coupons; thay raw `bb-btn` xóa bằng shadcn `Button variant="danger"` ở Slider/Video; chuyển dialog Roles sang `Modal`/shadcn.
   - Chuyển inline `style` px lẻ sang Tailwind token (ProductList, Dashboard legend, Slider, Settings).
   - Brand detail: thêm scroll-to-first-error.

4. **Cân nhắc lớn hơn (cần quyết định nghiệp vụ, không tự làm):**
   - Màn quản trị "Thuộc tính" riêng.
   - Reports chuyển sang react-query để cache + lazy-load charts.
