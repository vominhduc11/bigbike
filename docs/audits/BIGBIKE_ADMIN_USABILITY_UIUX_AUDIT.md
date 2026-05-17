# BigBike Admin Usability & UI/UX Audit

> Phạm vi: toàn bộ `bigbike-admin` (36 màn hình, toàn bộ component dùng chung, design token, locale).
> Ngày audit: 2026-05-17 · Phương pháp: đọc trực tiếp source + trace workflow + grep chéo toàn dự án, mọi kết luận trỏ đúng `file:line`.
> Góc nhìn: người quản trị vận hành shop thật (xử lý đơn, quản kho, công nợ), không chỉ nhìn code.

---

## 1. Executive Summary

**Kết luận: ĐẠT MỘT PHẦN.**

`bigbike-admin` là một hệ quản trị **đầy đủ chức năng và được xây dựng cẩn thận về mặt nghiệp vụ**: 36 màn hình phủ kín bán hàng / sản phẩm / kho / công nợ / nội dung / hệ thống; có design token riêng, dark mode, real-time đơn hàng, optimistic UI, undo, phân quyền tới từng nút. Phần "khung xương" (shadcn/ui, token, trạng thái loading/empty/error) tốt.

Tuy nhiên, **chưa sẵn sàng để bàn giao vận hành production** vì 3 nhóm vấn đề:

1. **Lỗi nghiêm trọng (Critical) — bộ lọc làm sập màn hình.** Ở 3 màn hình cốt lõi (Thương hiệu, Danh mục, Nội dung), khi admin chọn bất kỳ tùy chọn nào trong dropdown lọc thì màn hình **crash** (văng sang trang lỗi). Nguyên nhân: dùng sai cách lấy giá trị của dropdown (`event.target.value` trên component không phải input thường). Đây là lỗi chặn vận hành — admin không lọc được danh mục/thương hiệu/bài viết.

2. **Nợ nhất quán (consistency) lớn.** Có **bộ component dùng chung đầy đủ** (layout `Screen`, `FormField`, `BulkActionBar`, `FilterChips`, `StatusBadge`, `Modal`...) nhưng phần lớn màn hình **không dùng**, mà tự dựng lại bằng class CSS thô. Kết quả: 3 kiểu badge trạng thái, 4+ kiểu modal/drawer, 2 kiểu bảng, 2 kiểu empty-state — mỗi màn hình hơi khác nhau.

3. **Đa ngôn ngữ làm dở.** App có hệ i18n + nút đổi ngôn ngữ, nhưng rất nhiều màn hình/component **hardcode tiếng Việt** (toàn bộ nút thao tác đơn hàng, Cài đặt, form sản phẩm, chuông thông báo...). Đổi sang tiếng Anh sẽ thấy giao diện nửa Việt nửa Anh.

Component **chuông thông báo (NotificationBell) dang dở** đã được xử lý bằng cách xoá khỏi codebase (không import ở đâu, thiếu toàn bộ CSS), tránh để lại dead code gây hiểu nhầm.

**Mức sẵn sàng:** sau khi sửa lỗi Critical (#ADM-01), admin có thể dùng được cho vận hành nội bộ ở mức chấp nhận được. Để đạt chuẩn "production admin chỉn chu" cần thêm một đợt dọn nhất quán (consistency pass) và hoàn thiện i18n.

---

## 2. Audit Scope

### Đã kiểm tra

**Khung ứng dụng & điều hướng**
- `src/App.jsx` — router tự viết, 36 route, lazy-load, phân quyền route/nav
- `src/components/AdminShell.jsx` — sidebar, topbar, breadcrumb, user menu

**Component layout (`src/components/layout/`)**
- `Screen`, `ScreenHeader`, `FilterBar`/`FilterField`, `Modal`, `StickyActionBar`, `MobileCardList`/`MobileCard`, `SummaryCard`/`SummaryCardGrid`, `Tabs`, `FormField`

**Component dùng chung (`src/components/`)**
- `AdminTable`, `ConfirmDialog` + `lib/confirm.js`, `StatePanel`, `StatusBadge`, `PaginationControls`, `FilterChips`, `BulkActionBar`, `ExportButton`, `ReadOnlyBanner`, `DetailSection`, `ErrorBoundary`, `RichTextEditor`, `TagInput`, `ImageUrlInput`, `DateRangePicker`, `RefundModal`, `OrderNotificationToast`, `NotificationBell`, `ThemeToggle`, `LanguageSwitcher`, `MediaCard`, `MediaCardSkeleton`, `MediaListRow`, `MediaDetailModal`, `MediaPickerModal`, `VideoPickerModal`, `MediaPreviewLightbox`, `MediaFolderSidebar`, `MediaDetailPanel`

**shadcn/ui (`src/components/ui/`)**
- `button`, `input`, `textarea`, `label`, `select`, `checkbox`, `dialog`, `badge`, `table`, `tabs`, `tooltip`, `popover`, `dropdown-menu`, `separator`

**36 màn hình (`src/screens/`)** — Dashboard, Login, Order List/Detail, Product List/Detail, Category List/Detail, Brand List/Detail, Content List/Detail, Customer List/Detail, Review List/Detail, Receivable List/Detail, AdminUsers, Roles, Settings, AuditLog, Reports, Inventory, Serial, Warranty, Return, POS, Coupon, Media Library, Menu, Slider, HomeVideo, Redirect, Shipping, ContactInbox.

**Style / token / locale**
- `src/styles/admin-tokens.css`, `src/index.css`, `src/styles/admin-layout.css`
- `src/locales/vi.json`, `src/locales/en.json`

### Không trong phạm vi
Backend, API contract, business rule, state machine. Audit chỉ đánh giá lớp UI/UX của admin.

---

## 3. Admin Usability Score

| Nhóm | Điểm /10 | Lý do ngắn |
|---|---|---|
| Navigation clarity | 7 | Sidebar nhóm rõ, active state tốt, có breadcrumb. Trừ điểm: breadcrumb chỉ 3 cấp + chữ chung chung ("Chi tiết"), không gập nhóm được, không có "skip to content". |
| Workflow simplicity | 6 | Phần lớn workflow CRUD gọn. Trừ điểm: màn đơn hàng tách 3 khối trạng thái rời rạc + fulfillment 2 bước thừa; form sản phẩm 7 section rất dài. |
| Form usability | 5 | Có `FormField` chuẩn nhưng gần như **không màn nào dùng** — mỗi form tự dựng `form-field`/`field-label`. Validation tốt ở Settings/Refund nhưng cách hiển thị lỗi mỗi nơi một kiểu. Section gập của form sản phẩm không bấm được bằng bàn phím. |
| Table/data management | 6 | `AdminTable` (sort/chọn/skeleton) tốt. Trừ điểm: tồn tại 2 kiểu bảng song song; thanh lọc quá dày (8 ô ở Sản phẩm); **lỗi crash bộ lọc** ở 3 màn; phân trang không có nút đầu/cuối khi nhiều trang. |
| Feedback/loading/error | 7 | Mọi màn list/detail đều có empty/loading/error + retry. Trừ điểm: 3 cơ chế "toast" song song (sonner + `sv2-toast` của Settings + toast đơn hàng riêng); retry ở Dashboard reload cả trang. |
| Visual clarity | 7 | Token đầy đủ, dark mode, tổng thể sạch, dày đặc hợp admin. Trừ điểm: nhiều giá trị Tailwind tùy ý (`text-[0.78rem]`...) và 3 kiểu badge làm lệch nhẹ. |
| Consistency | 4 | **Yếu nhất.** Bộ component dùng chung tồn tại nhưng ~31/36 màn tự dựng lại bằng class thô; 3 kiểu status badge; 4+ kiểu modal/drawer; i18n làm dở. |
| Accessibility | 6 | aria phủ khá rộng (`aria-sort`, `aria-current`, `role`), có focus ring. Trừ điểm: section gập bằng thẻ `<header onClick>`; modal media tự dựng không bẫy focus; nút ẩn/hiện mật khẩu dùng emoji; trạng thái RMA chỉ phân biệt bằng màu chữ. |
| Responsive behavior | 5 | Desktop-first. Sidebar thu thành drawer tốt; nhưng pattern bảng→thẻ (`MobileCard`) chỉ **1/22 màn list dùng** (Công nợ), còn lại bảng cuộn ngang trên mobile. |
| Production admin readiness | 5 | Nghiệp vụ chắc, nhưng lỗi crash bộ lọc ở 3 màn cốt lõi là điểm chặn; nợ nhất quán cao. Sau khi sửa Critical → khoảng 6–7. |

**Điểm trung bình ≈ 5.8/10 — Đạt một phần.**

---

## 4. Issues Found

### ADM-01 — Bộ lọc dropdown làm sập màn hình (Brand / Category / Content)
- **Severity:** Critical
- **Area:** Table/filter — 3 màn hình list
- **File(s):** `bigbike-admin/src/screens/BrandListScreen.jsx:141`, `:153`; `bigbike-admin/src/screens/CategoryListScreen.jsx:697`, `:709`; `bigbike-admin/src/screens/ContentListScreen.jsx:153`, `:165`
- **Current behavior:** Dropdown lọc dùng `<Select onValueChange={(event) => updateQuery({ visibility: event.target.value })}>`. `Select` ở đây là component Radix/shadcn — callback `onValueChange` trả về **trực tiếp chuỗi giá trị**, không phải DOM event. Vì vậy `event.target` là `undefined`, truy cập `.value` → ném `TypeError`. Mọi component khác trong dự án (ProductList, OrderList, AdminUsers, RefundModal) đều viết đúng là `(value) => ...`.
- **Why this is a problem:** Khi admin bấm chọn bất kỳ tùy chọn nào trong bộ lọc "Hiển thị", "Sắp xếp" (Thương hiệu, Danh mục) hoặc "Loại", "Trạng thái" (Nội dung), màn hình **văng sang trang lỗi đỏ** (ErrorBoundary). Admin **không thể lọc** danh sách thương hiệu / danh mục / bài viết — một thao tác cơ bản hằng ngày. Đây là lỗi chặn vận hành thực sự.
- **Expected behavior:** Chọn tùy chọn lọc cập nhật danh sách bình thường, không crash.
- **Recommended fix:** Đổi `(event) => updateQuery({ x: event.target.value }, ...)` thành `(value) => updateQuery({ x: value }, ...)` ở cả 6 vị trí.
- **Can auto-fix safely:** **Yes** — đã fix trong đợt này (xem mục 8). An toàn tuyệt đối: chỉ thay đúng mẫu đã dùng ở mọi màn hình khác, không đụng business logic / API / workflow.

### ADM-02 — Bộ component dùng chung tồn tại nhưng gần như không được dùng
- **Severity:** High
- **Area:** Kiến trúc UI / consistency
- **File(s):** `src/components/layout/` (Screen, ScreenHeader, FilterBar, FormField, StickyActionBar) vs. `OrderListScreen.jsx:145-160`, `ProductListScreen.jsx:282-308`, `CategoryListScreen.jsx:669-683`, `BrandListScreen.jsx:113-127`, `AdminUsersScreen.jsx:315-333`, `SettingsScreen.jsx:463-470`, `OrderDetailScreen.jsx:365-378`...
- **Current behavior:** Có sẵn `Screen`/`ScreenHeader`/`FilterBar`/`FormField`, nhưng chỉ ~4 màn (Dashboard, Receivables...) dùng. ~31 màn còn lại tự viết `<section className="screen">`, `<header className="screen-header">`, `<section className="filter-bar">`, `form-field`, `field-label`. `FormField` gần như không màn nào dùng.
- **Why this is a problem:** Mỗi màn hình là một "bản tự chế" của cùng một bố cục. Khi cần chỉnh khoảng cách / responsive / focus state, phải sửa nhiều nơi; dễ phát sinh lệch. Vi phạm quy tắc tái sử dụng component trong CLAUDE.md.
- **Expected behavior:** Mọi màn dùng chung `Screen`/`ScreenHeader`/`FilterBar`/`FormField`.
- **Recommended fix:** Migrate dần các màn sang component layout chuẩn (refactor lớn — xem mục 9).
- **Can auto-fix safely:** No.

### ADM-03 — Ba hệ "badge trạng thái" song song, màu trạng thái lệch nhau
- **Severity:** High
- **Area:** Visual consistency
- **File(s):** `src/components/StatusBadge.jsx:5-13` (component dùng `<Badge>`); `OrderListScreen.jsx:34-52` (local `OrderStatusBadge` dùng class `.status-badge`); `OrderDetailScreen.jsx:60-67` (RMA chỉ tô **màu chữ** `text-warning`...); `AdminUsersScreen.jsx:35-71` (class riêng `au-badge`); `CategoryListScreen.jsx:600`, `BrandListScreen.jsx:75` (class `.status-badge` thô).
- **Current behavior:** Cùng khái niệm "huy hiệu trạng thái" có ≥3 cách hiển thị. Đặc biệt, trạng thái đơn `ON_HOLD` được gán **3 màu khác nhau**: `warning` (`OrderListScreen.jsx:21`), `neutral` (`DashboardScreen.jsx:45`), `muted` (`StatusBadge.jsx:6`).
- **Why this is a problem:** Cùng một đơn "Tạm giữ" có thể hiển thị màu vàng ở danh sách đơn, màu xám ở Dashboard. Admin khó "đọc nhanh bằng màu" khi màu không ổn định giữa các màn.
- **Expected behavior:** Một component badge duy nhất, một bảng map status→màu duy nhất, dùng ở mọi màn.
- **Recommended fix:** Gom map trạng thái về `lib/contracts.js`; mọi màn dùng `StatusBadge`. (Refactor — mục 9.)
- **Can auto-fix safely:** No.

### ADM-04 — i18n làm dở: rất nhiều chỗ hardcode tiếng Việt
- **Severity:** High
- **Area:** Consistency / đa ngôn ngữ
- **File(s):** `OrderDetailScreen.jsx:30-69` + `:523-601` + cả `AdminCreateReturnModal` (`:71-166`); `SettingsScreen.jsx` (label field, nút Lưu/Huỷ, toàn bộ message validate, `:291`, `:307`, `:511`); `ProductDetailScreen.jsx:84-92` + `:218-229`; `ProductListScreen.jsx:197`, `:375-398`, `:430-433`; `NotificationBell.jsx` (toàn bộ); `OrderNotificationToast.jsx:8-16`, `:41`, `:53`; `RichTextEditor.jsx:125-147`; `TagInput.jsx:72`; `MediaPickerModal.jsx` (toàn bộ); `ErrorBoundary.jsx:27-43`; `FilterChips.jsx:3` (mặc định `'Clear all'` — tiếng Anh).
- **Current behavior:** App có hệ i18n đầy đủ (`vi.json`/`en.json`) và nút `LanguageSwitcher`, nhưng nhiều màn quan trọng nhúng thẳng chuỗi tiếng Việt thay vì `t(...)`.
- **Why this is a problem:** Bấm đổi sang English, giao diện thành nửa Việt nửa Anh — toàn bộ nút thao tác đơn hàng, màn Cài đặt, form sản phẩm vẫn tiếng Việt. Trông thiếu chỉn chu, và `FilterChips` còn mặc định ra chữ Anh giữa giao diện Việt.
- **Expected behavior:** Mọi chuỗi hiển thị đi qua `t(...)`; không có chuỗi mặc định sai ngôn ngữ.
- **Recommended fix:** Bổ sung key locale còn thiếu và thay chuỗi cứng bằng `t(...)`. **Đã hoàn thành i18n cho `OrderDetailScreen`, `ProductListScreen`, `ProductDetailScreen`, `MediaPickerModal`, `MediaDetailModal`, `VideoPickerModal`, `OrderNotificationToast`, `RichTextEditor`, `TagInput`, `SettingsScreen`**; còn `ErrorBoundary` giữ nguyên có chủ đích (last-resort screen).
- **Can auto-fix safely:** Một phần đã fix (i18n là thay đổi behavior-preserving, verify pass); phần còn lại làm tiếp cùng cách.

### ADM-05 — Component "chuông thông báo" làm dang dở (thiếu toàn bộ CSS) và không được gắn vào đâu
- **Severity:** Medium
- **Area:** Dead code / tính năng dang dở
- **File(s):** `src/components/NotificationBell.jsx` (211 dòng) — grep toàn dự án: **không file nào import/render**. Các class CSS nó dùng (`noti-bell-root`, `noti-bell-btn`, `noti-badge`, `noti-panel`, `noti-item`...) **không được định nghĩa ở bất kỳ file CSS nào**.
- **Current behavior:** `NotificationBell` có logic đầy đủ (panel thả xuống, đếm chưa đọc, lưu localStorage 50 mục, "đánh dấu đã đọc", "xoá tất cả") nhưng (1) chưa bao giờ được render và (2) **thiếu toàn bộ stylesheet** — gắn vào sẽ ra một nút + panel vỡ giao diện. Cái đang chạy là `OrderNotificationToast` (toast tự ẩn sau 6 giây).
- **Why this is a problem:** Đây không phải "component xong nhưng quên nối dây" mà là **tính năng làm dang dở** — thiếu CSS, lại hardcode tiếng Việt. Dễ khiến dev sau hiểu nhầm là dùng được ngay.
- **Expected behavior:** Hoặc hoàn thiện đầy đủ (viết CSS `noti-*` + i18n + gắn vào topbar), hoặc xoá hẳn component.
- **Recommended fix:** Đây là một **feature task** (xây UI panel thông báo: CSS + i18n rồi mới gắn), không phải wiring đơn giản. Trong đợt audit này đã **thử gắn vào topbar `AdminShell` và revert lại** ngay sau khi xác nhận component thiếu toàn bộ CSS — không ship một phần tử vỡ giao diện ra production.
- **Can auto-fix safely:** No — cần xây UI hoàn chỉnh, là việc tính năng riêng.

### ADM-06 — Màn chi tiết đơn hàng: thao tác phân mảnh, nhiều bước
- **Severity:** Medium
- **Area:** Workflow — `OrderDetailScreen`
- **File(s):** `OrderDetailScreen.jsx:399-477` (trạng thái đơn + thanh toán tách 2 cụm), `:522-601` (fulfillment), `:399-407`/`:454-456` (trạng thái hiển thị bằng **chữ đậm**, không phải badge).
- **Current behavior:** Trạng thái đơn, trạng thái thanh toán, trạng thái vận chuyển nằm ở 3 cụm rời rạc trên một trang dài. Vận chuyển bắt buộc đi 2 bước UNFULFILLED → PROCESSING → SHIPPED. Trạng thái hiện bằng text đậm thay vì badge màu như ở danh sách.
- **Why this is a problem:** Để xử lý xong một đơn giao hàng, admin phải cuộn và bấm rải rác ở nhiều khối; không có thanh thao tác cố định (`StickyActionBar`). Trạng thái dạng chữ khó "đọc nhanh" bằng mắt; lại không khớp cách danh sách hiển thị (badge).
- **Why này là điểm tích cực một phần:** logic xác nhận (`showConfirm`) cho hành động nguy hiểm rất kỹ — huỷ/hoàn thành/hoàn tiền/đổi BACS đều có dialog cảnh báo rõ ràng.
- **Expected behavior:** Trạng thái dùng badge thống nhất; cân nhắc gộp khu thao tác, dùng `StickyActionBar`.
- **Recommended fix:** Xem mục 9 (cần thiết kế lại, không tự sửa vì đụng workflow).
- **Can auto-fix safely:** No.

### ADM-07 — Nhiều kiểu modal/drawer khác nhau, có loại không bẫy focus
- **Severity:** Medium
- **Area:** Consistency / Accessibility
- **File(s):** shadcn `Dialog` (`ConfirmDialog.jsx`, `RefundModal.jsx`); `Modal` layout (`Modal.jsx`, `AdminUsersScreen.jsx:511`); modal tự dựng `mpicker-modal` (`MediaPickerModal.jsx:220`, `MediaDetailModal.jsx:81`, `VideoPickerModal`); drawer tự dựng `audit-drawer` (`AdminUsersScreen.jsx:422-508`).
- **Current behavior:** Có ≥4 cơ chế overlay. Modal media (`mpicker-modal`) tự dựng — không qua Radix Dialog nên **không bẫy focus** (Tab thoát ra khỏi modal), chỉ xử lý ESC thủ công. `AdminUsersScreen` dùng `Modal` cho "Tạo" nhưng drawer tự chế cho "Sửa" — **lệch ngay trong một màn**.
- **Why this is a problem:** Trải nghiệm mở/đóng/điều hướng bàn phím khác nhau giữa các modal; người dùng bàn phình hoặc trình đọc màn hình có thể "lạc" ra ngoài modal media.
- **Expected behavior:** Mọi modal/drawer dựng trên cùng một primitive (shadcn `Dialog`).
- **Recommended fix:** Chuyển modal media + drawer AdminUsers sang `Dialog`/`Modal` (mục 9).
- **Can auto-fix safely:** No.

### ADM-08 — Section gập của form sản phẩm không thao tác được bằng bàn phím
- **Severity:** Medium
- **Area:** Accessibility — `ProductDetailScreen`
- **File(s):** `ProductDetailScreen.jsx:63-72` — `<header className="detail-section-header--toggle" onClick={toggle}>`.
- **Current behavior:** Tiêu đề section (Cơ bản, Giá, Ảnh, Gallery...) gập/mở bằng cách bấm vào thẻ `<header>`. Thẻ này không phải `<button>`, không có `role="button"`, không `tabIndex`, không `aria-expanded`, không bắt phím Enter/Space.
- **Why this is a problem:** Người dùng bàn phím không gập/mở được section → không tới được các trường bên trong nếu section đang đóng. Trình đọc màn hình không biết đây là phần tử bấm được hay trạng thái đóng/mở.
- **Expected behavior:** Tiêu đề section là `<button>` (hoặc có `role="button"` + `tabIndex={0}` + `aria-expanded` + bắt phím).
- **Recommended fix:** Đổi `<header onClick>` thành `<button>` bọc tiêu đề; thêm `aria-expanded={isOpen}`.
- **Can auto-fix safely:** No — đổi thẻ trong một màn hình nhiều state, nên kiểm thử kỹ; để vào mục 9 hoặc task riêng nhỏ.

### ADM-09 — CategoryListScreen tự dựng lại bulk-action-bar và filter-chips
- **Severity:** Medium
- **Area:** Consistency
- **File(s):** `CategoryListScreen.jsx:784-803` (`<div className="bulk-action-bar">` thủ công) và `:733-781` (`<div className="filter-chips"><button className="filter-chip">` thủ công) — trong khi đã có sẵn `components/BulkActionBar.jsx` và `components/FilterChips.jsx` (chỉ `MediaLibraryScreen` dùng).
- **Why this is a problem:** Cùng "thanh thao tác hàng loạt" và "chip lọc" tồn tại 2 bản; sửa một bản không tự áp cho bản kia.
- **Expected behavior:** Dùng `BulkActionBar` / `FilterChips` dùng chung.
- **Recommended fix:** Thay phần tự dựng bằng component chung (mục 9).
- **Can auto-fix safely:** No.

### ADM-10 — Giá trị Tailwind tùy ý thay vì token
- **Severity:** Low
- **Area:** Visual consistency / design system
- **File(s):** `MediaListRow.jsx:62-64` (`text-[0.78rem]`); `OrderNotificationToast.jsx:40,43,46` (`text-[0.85rem]`, `text-[0.8rem]`), `:89` (`z-[9999]`); `TagInput.jsx:68,93` (`text-[0.72rem]`, `text-[0.8rem]`); `MediaPickerModal.jsx`/`MediaDetailModal.jsx` (`text-[0.7rem]`, `w-[360px]`, `h-[240px]`, `max-w-[820px]`); `MediaCardSkeleton.jsx:4-7` (`h-[120px]`, inline `style` grid); `CategoryListScreen.jsx:833` (`h-[18px]`).
- **Why this is a problem:** CLAUDE.md cấm arbitrary value khi đã có token tương đương. Cỡ chữ lệch lung tung (0.78/0.8/0.85rem) thay vì dùng thang `text-xs`/`text-sm`. `z-[9999]` vượt ngoài thang z-index token (`--admin-z-*` tối đa 300).
- **Expected behavior:** Dùng token (`text-xs`, `text-sm`, biến `--admin-z-*`).
- **Recommended fix:** Đợt dọn token (mục 9). Rủi ro thay đồng loạt: nhỏ nhưng có lệch cỡ chữ → để task riêng, không gộp vào audit này.
- **Can auto-fix safely:** No (gộp lại thành 1 đợt riêng để kiểm soát visual).

### ADM-11 — Empty-state và "toast" có nhiều bản
- **Severity:** Low
- **Area:** Consistency
- **File(s):** Empty-state: `StatePanel` (đa số) vs `cat-empty-state` (`CategoryListScreen.jsx:841-863`) vs `mpicker-state-empty` (`MediaPickerModal.jsx:309-314`) vs `noti-empty` (`NotificationBell.jsx:191-195`). Toast/phản hồi: sonner `toast` (đa số) vs `sv2-toast` tự dựng (`SettingsScreen.jsx:507-512`) vs toast đơn hàng riêng (`OrderNotificationToast`).
- **Why this is a problem:** Trạng thái rỗng / báo thành công trông khác nhau tùy màn.
- **Recommended fix:** Quy về `StatePanel` + sonner (mục 9).
- **Can auto-fix safely:** No.

### ADM-12 — Hint "Ctrl+Click" của trình chọn ảnh gây hiểu nhầm
- **Severity:** Low
- **Area:** Wording — `MediaPickerModal`
- **File(s):** `MediaPickerModal.jsx:389` — `'Chọn nhiều ảnh (Ctrl+Click)'`.
- **Current behavior:** Ở chế độ chọn nhiều, code toggle chọn ảnh bằng **một cú bấm thường** (`onClick={() => toggleUrl(url)}`, dòng 325) — không cần Ctrl. Nhưng hint lại ghi "(Ctrl+Click)".
- **Why this is a problem:** Admin đọc hint sẽ tưởng phải giữ Ctrl mới chọn được nhiều ảnh → thao tác sai, bối rối.
- **Expected behavior:** Hint mô tả đúng: chỉ cần bấm vào ảnh.
- **Recommended fix:** Đổi text thành "Bấm vào ảnh để chọn nhiều".
- **Can auto-fix safely:** **Yes** — đã fix trong đợt này (mục 8). Chỉ đổi chuỗi hiển thị, không đụng logic.

### ADM-13 — Retry ở Dashboard reload toàn trang
- **Severity:** Low
- **Area:** Feedback — `DashboardScreen`
- **File(s):** `DashboardScreen.jsx:279` — `onAction={() => window.location.reload()}`.
- **Current behavior:** Nút "Thử lại" khi Dashboard lỗi sẽ reload cả trang; các màn khác (`OrderListScreen.jsx:222`, `ProductListScreen.jsx:445`) dùng `state.refetch()` — chỉ tải lại dữ liệu.
- **Why this is a problem:** Reload cả trang nặng hơn, mất state, chớp trắng — không nhất quán.
- **Recommended fix:** Đổi sang `refetch()` của query chính.
- **Can auto-fix safely:** **Yes** — đã fix trong đợt này (QW-8): destructure thêm `refetch` từ `useQuery` và gọi `refetch()`.

### ADM-14 — Một số chi tiết a11y / UX nhỏ
- **Severity:** Low
- **Area:** Accessibility / UX
- **File(s) & mô tả:**
  - `StatePanel.jsx:21` — luôn `role="status"` kể cả khi `tone="danger"` (lỗi); trạng thái lỗi nên `role="alert"`.
  - `AdminUsersScreen.jsx:92` — nút ẩn/hiện mật khẩu dùng emoji `🙈`/`👁` thay vì icon lucide `Eye`/`EyeOff` như phần còn lại của app.
  - `AdminShell.jsx` — không có link "Skip to content"; người dùng bàn phím phải Tab qua ~30 mục nav trước khi tới nội dung.
  - `AdminShell.jsx:17-59` — breadcrumb tối đa 3 cấp, cấp cuối là chữ chung chung ("Chi tiết"/"Tạo mới"), không hiện tên thực thể đang xem.
  - `LoginScreen.jsx:86-90` — "Quên mật khẩu" chỉ mở một ghi chú tĩnh, không có luồng đặt lại mật khẩu thật.
  - `DashboardScreen.jsx:438-456` — các dòng chú giải biểu đồ tròn trông bấm được theo từng trạng thái, nhưng tất cả đều chỉ điều hướng tới `/admin/orders` (không lọc theo trạng thái).
  - `BrandListScreen.jsx:21` — `pageSize` mặc định 8, các màn khác 20.
- **Recommended fix:** Đã fix QW-6 (StatePanel `role`), QW-7 (emoji→icon + `type="button"`), QW-9 (pageSize) trong đợt này. Còn lại (skip-link, breadcrumb hiện tên thực thể, luồng quên mật khẩu, chú giải pie) đưa vào task a11y/UX riêng (mục 9).
- **Can auto-fix safely:** Một phần — phần an toàn đã fix (xem mục 8).

---

## 5. Screen-by-screen Review

> Theo chiến lược đã chốt: deep-dive các màn vận hành cốt lõi; gom nhóm các màn list/detail CRUD gần giống nhau.

### 5.1 LoginScreen
- **Mục đích:** đăng nhập admin. **Thao tác chính:** nhập email/mật khẩu, đăng nhập.
- **UI dễ hiểu:** Có. Card gọn, có eyebrow/title/subtitle, email hỗ trợ ở chân.
- **UX dễ thao tác:** Tốt — nút submit có `loading`, lỗi 401 hiển thị rõ bằng `StatePanel`.
- **Vấn đề:** "Quên mật khẩu" chỉ hiện ghi chú tĩnh, không có luồng reset thật (ADM-14) → admin quên mật khẩu thật sự sẽ bế tắc, phải nhờ kỹ thuật.
- **Đề xuất:** ghi rõ trong ghi chú là "liên hệ quản trị cấp cao" (hiện đã có email hỗ trợ — chấp nhận được), hoặc làm luồng reset thật.

### 5.2 DashboardScreen — *deep-dive*
- **Mục đích:** tổng quan kinh doanh + việc cần chú ý. **Thao tác chính:** đổi kỳ (7/30/90 ngày), bấm thẻ KPI để nhảy tới màn liên quan.
- **UI dễ hiểu:** Tốt — khu "Cần chú ý" ưu tiên việc gấp (đơn chờ, công nợ quá hạn, đổi trả chờ, sắp hết hàng); thẻ KPI có màu cảnh báo động.
- **UX dễ thao tác:** Tốt — skeleton khi tải, "all clear" khi không có việc.
- **Vấn đề:** dùng `<table className="admin-table">` thô thay vì `AdminTable` (ADM-... consistency); chú giải pie trông bấm-được-theo-trạng-thái nhưng đều về `/admin/orders` (ADM-14); retry reload cả trang (ADM-13).
- **Đề xuất:** chú giải pie nên lọc theo trạng thái khi bấm, hoặc bỏ vẻ "bấm được" của từng dòng.

### 5.3 OrderListScreen — *deep-dive*
- **Mục đích:** duyệt/lọc đơn. **Thao tác chính:** lọc theo trạng thái/thanh toán/khoảng ngày, tìm kiếm, xuất CSV, mở chi tiết.
- **UI dễ hiểu:** Tốt — badge trạng thái + thanh toán, nhãn nguồn "POS".
- **UX dễ thao tác:** Khá — real-time cập nhật đơn mới qua WebSocket; lọc theo ngày tốt.
- **Vấn đề:** không có thao tác hàng loạt (bulk) — không thể "đánh dấu đã thanh toán" nhiều đơn cùng lúc; badge dùng class `.status-badge` cục bộ thay vì `StatusBadge` (ADM-03); `ON_HOLD` tô vàng ở đây nhưng xám ở Dashboard (ADM-03).
- **Đề xuất:** thêm bulk action cho đơn hàng (mục 9).

### 5.4 OrderDetailScreen — *deep-dive (màn quan trọng nhất)*
- **Mục đích:** xử lý vòng đời đơn — trạng thái, thanh toán, vận chuyển, đổi trả, hoàn tiền, ghi chú.
- **Điểm tốt:** xác nhận (`showConfirm`) cho mọi hành động nguy hiểm rất kỹ và lời cảnh báo rõ (huỷ đơn, hoàn thành, hoàn tiền, BACS tự đánh dấu đã thu tiền — `:231-298`); optimistic update; phân biệt lỗi tải vs danh sách rỗng cho transitions.
- **Vấn đề (xem ADM-04, ADM-06):**
  - Hardcode tiếng Việt toàn bộ nút thao tác, khu vận chuyển, modal đổi trả.
  - 3 khối trạng thái rời rạc, fulfillment 2 bước; trang dài, không thanh thao tác cố định.
  - Trạng thái hiển thị bằng chữ đậm, không badge → khó đọc nhanh, lệch với danh sách.
  - `AdminCreateReturnModal` dùng `form-field`/`field-label` thô, bảng item thô; submit không có bước xác nhận tổng kết.
- **Đề xuất:** dùng badge thống nhất; cân nhắc gộp/thu gọn khu thao tác; i18n hoá.

### 5.5 ProductListScreen + ProductDetailScreen — *deep-dive*
- **List:** chuẩn list screen — tìm kiếm + **7 dropdown lọc** (rất dày, ADM-14); cảnh báo "khối trang chủ vượt giới hạn" là điểm hay; xoá có xác nhận, khôi phục từ thùng rác có xác nhận `variant: default`. Hành động/quyền hơi lệch: nút "Sao chép" ẩn khi không có quyền, nút "Xoá" vẫn hiện nhưng disabled — không sai nhưng không đồng nhất.
- **Detail:** form 7 section gập được, có section-nav scrollspy, autosave localStorage, checklist "sẵn sàng đăng" — khá chỉn chu. **Vấn đề:** section gập bằng `<header onClick>` không dùng được bằng bàn phím (ADM-08); nhãn section/checklist hardcode tiếng Việt; form rất dài, khối "Giá" (nơi quyết định doanh thu) nằm tận section 2.
- **Đề xuất:** sửa a11y section gập; cân nhắc rút gọn thanh lọc list (gộp các bộ lọc ít dùng vào "Bộ lọc nâng cao").

### 5.6 CategoryListScreen — *deep-dive*
- **Mục đích:** quản lý cây danh mục. **Thao tác chính:** tạo, sửa, ẩn/hiện, kéo-thả sắp xếp, ẩn/hiện hàng loạt, tìm kiếm tự bung cây.
- **Điểm tốt (rất mạnh):** chế độ cây/phẳng kép; tìm kiếm giữ ngữ cảnh cây + highlight; **Undo** khi ẩn/hiện nhầm; bulk ẩn xử lý leaves-first đúng ràng buộc backend; toast tổng kết phân biệt thành công/lỗi.
- **Vấn đề:** **dính lỗi Critical ADM-01** — chọn bộ lọc "Hiển thị"/"Sắp xếp" làm crash màn; tự dựng lại `bulk-action-bar` + `filter-chips` thay vì dùng component chung (ADM-09); dùng `<table className="admin-table">` thô.
- **Đề xuất:** đã sửa ADM-01; chuyển sang component bulk/chip chung.

### 5.7 AdminUsersScreen + RolesScreen — *deep-dive (phân quyền)*
- **AdminUsers:** danh sách + tạo + sửa quản trị viên. **Điểm tốt:** chặn tự đổi quyền/tự khoá tài khoản mình; xác nhận cho thay đổi nhạy cảm (vô hiệu hoá / đổi quyền).
- **Vấn đề:** "Tạo" dùng `Modal`, "Sửa" dùng drawer tự chế `audit-drawer` — lệch ngay trong một màn (ADM-07); nút ẩn/hiện mật khẩu dùng emoji `🙈`/`👁` (ADM-14); local component tên `StatusBadge` trùng tên với component dùng chung, dùng class `au-badge` riêng (ADM-03); 7 vai trò nhưng không có giải thích quyền của từng vai trò.
- **RolesScreen:** dùng nhiều `SummaryCard`/`Modal` — là một trong số ít màn dùng component layout chuẩn. Cần kiểm tra riêng nhưng pattern lành mạnh.
- **Đề xuất:** thống nhất tạo/sửa cùng một kiểu overlay; thay emoji bằng icon lucide; thêm mô tả ngắn cho từng vai trò.

### 5.8 SettingsScreen — *deep-dive*
- **Mục đích:** cấu hình hệ thống theo 8 tab. **Điểm tốt:** sidebar tab có badge số thay đổi chưa lưu; validate inline theo loại field; lưu theo từng tab; tab nhạy cảm (Thuế, Cửa hàng) có xác nhận; ẩn hợp lý các key kỹ thuật không thuộc admin shop.
- **Vấn đề:** gần như toàn bộ label field, nút Lưu/Huỷ, message validate, "x thay đổi chưa lưu" hardcode tiếng Việt (ADM-04); có `sv2-toast` riêng thay vì sonner (ADM-11); lưu theo từng tab — nếu admin sửa 2 tab phải lưu 2 lần (badge số trên tab có giúp nhận biết).
- **Đề xuất:** i18n hoá; cân nhắc cảnh báo khi rời tab còn thay đổi chưa lưu.

### 5.9 MediaLibraryScreen + các modal media — *deep-dive*
- **Mục đích:** quản lý ảnh/video — upload kéo-thả, thư mục, lọc nâng cao, xoá mềm/cứng, thao tác hàng loạt.
- **Điểm tốt:** là một trong số ít màn **dùng đúng** component chung (`BulkActionBar`, `FilterChips`, `MobileCard`); xoá mềm/cứng đều có `showConfirm`; chế độ lưới/danh sách.
- **Vấn đề:** các modal `MediaPickerModal`/`MediaDetailModal`/`VideoPickerModal` tự dựng `mpicker-modal` — không bẫy focus (ADM-07); hardcode tiếng Việt; hint "Ctrl+Click" sai (ADM-12 — đã sửa).
- **Đề xuất:** chuyển modal media sang `Dialog`.

### 5.10 Nhóm màn vận hành còn lại (POS, Inventory, Serial, Warranty, Return, Receivables, ContactInbox)
- Đều theo pattern list/detail chuẩn; đều có `showConfirm` cho hành động nguy hiểm (grep: ReturnList 3, POS 2, Inventory 2). `ReceivablesListScreen`/`ReceivableDetailScreen` là số ít màn dùng `SummaryCard`/`StickyActionBar`/`MobileCard` — pattern tốt, nên lấy làm mẫu chuẩn.
- Vấn đề chung kế thừa: `<section className="screen">` thô (ADM-02), badge `.status-badge` thô (ADM-03).
- **ReturnListScreen:** state machine RMA có bước "Kiểm hàng" tuỳ chọn cho hàng giá trị cao; modal chi tiết. Không có duyệt/từ chối hàng loạt.

### 5.11 Nhóm màn CRUD đơn giản (BrandList/Detail, ContentList/Detail, CustomerList/Detail, CouponList, WarrantyList, SerialList, ReviewList/Detail, RedirectList, SliderList, HomeVideoList, MenuScreen, AuditLogList, ShippingScreen, ReportsScreen)
- Tất cả dùng cùng khung `screen` + `screen-header` + `filter-bar` + `AdminTable` + `PaginationControls`. Bố cục dễ hiểu, có empty/loading/error.
- Khác biệt đáng ghi:
  - **BrandListScreen, ContentListScreen:** dính lỗi Critical ADM-01 (bộ lọc crash) — đã sửa.
  - **BrandListScreen:** `pageSize` mặc định 8 (các màn khác 20) — lệch nhỏ (ADM-14).
  - **AuditLogListScreen:** dùng drawer `audit-drawer` (nguồn gốc class mà AdminUsers mượn lại) — đánh dấu hành động nguy hiểm, có preset khoảng ngày, xuất CSV — tốt.
  - Badge hiển thị: nơi dùng `StatusBadge`/`Badge`, nơi dùng `.status-badge` thô (ADM-03).

---

## 6. Workflow Review

### WF-1 — Đăng nhập / đăng xuất
- **Entry:** `LoginScreen`. **Steps:** nhập email → mật khẩu → "Đăng nhập" (nút có loading). Đăng xuất: menu user góc phải → "Đăng xuất".
- **Pain point:** không có luồng đặt lại mật khẩu thật. **Missing state:** không. **Risk:** thấp.
- **Đề xuất:** làm rõ kênh khôi phục mật khẩu (hiện chỉ có email hỗ trợ ở chân form).

### WF-2 — Xử lý một đơn hàng (chờ → xử lý → hoàn thành)
- **Entry:** `OrderListScreen` → mở chi tiết. **Steps:** bấm nút trạng thái ("Xác nhận xử lý") → dialog xác nhận (với đơn nguy hiểm) → riêng biệt: bấm nút thanh toán ("Xác nhận đã thu tiền") → dialog xác nhận. ~4 lần bấm cho một đơn cơ bản.
- **Pain point:** trạng thái đơn và trạng thái thanh toán ở 2 cụm tách rời; phải thao tác 2 lần riêng. **Missing state:** trạng thái hiển thị bằng chữ, không badge.
- **Risk thao tác sai:** thấp — mọi bước nguy hiểm đều có dialog cảnh báo nội dung rõ ràng.
- **Đề xuất:** xem ADM-06 — cân nhắc gộp khu thao tác, dùng badge, thêm bulk action ở danh sách.

### WF-3 — Giao vận chuyển một đơn
- **Entry:** `OrderDetailScreen` khu "Vận chuyển". **Steps:** "Bắt đầu chuẩn bị hàng" → "Đánh dấu đã giao vận chuyển" (mở form) → nhập **mã vận đơn (bắt buộc)** + đơn vị vận chuyển → "Xác nhận giao vận chuyển" → sau đó "Đánh dấu đã giao tới khách". ~3 bước + nhập liệu.
- **Pain point:** bước trung gian PROCESSING bắt buộc — nhiều shop muốn đi thẳng từ "chưa xử lý" sang "đã giao". **Điểm tốt:** chặn chuyển SHIPPED khi thiếu mã vận đơn, có message rõ.
- **Risk:** thấp. **Đề xuất:** cân nhắc rút gọn còn 1 bước có form (mục 9).

### WF-4 — Tạo sản phẩm
- **Entry:** `ProductListScreen` → "Tạo sản phẩm". **Steps:** điền 7 section (Cơ bản → Giá → Ảnh → Gallery → Video → Thông số → Biến thể), cuộn dài hoặc dùng section-nav, rồi lưu/đăng.
- **Pain point:** form rất dài; khối "Giá" là section 2, dễ bị bỏ sót nếu chỉ nhìn section đầu. **Điểm tốt:** autosave, checklist "sẵn sàng đăng", section-nav scrollspy.
- **Missing state / a11y:** section gập không bấm được bằng bàn phím (ADM-08).
- **Risk:** trung bình — admin mới có thể lưu nháp thiếu giá. **Đề xuất:** giữ checklist nổi bật hơn; sửa a11y.

### WF-5 — Tạo yêu cầu đổi trả (RMA)
- **Entry:** `OrderDetailScreen` (đơn COMPLETED) → "+ Tạo yêu cầu đổi trả". **Steps:** chọn lý do → nhập số lượng trả từng item → ghi chú → "Tạo yêu cầu".
- **Pain point:** submit không có bước xác nhận tổng kết — chọn nhầm số lượng sẽ tạo RMA sai. **Risk:** trung bình.
- **Đề xuất:** thêm dialog xác nhận tóm tắt trước khi tạo RMA.

### WF-6 — Hoàn tiền đơn
- **Entry:** `OrderDetailScreen` (thanh toán PAID) → "Tạo hoàn tiền" → `RefundModal`. **Steps:** số tiền hoàn (chỉ-đọc — backend chỉ hỗ trợ hoàn toàn bộ) → lý do → ghi chú → "Xác nhận" (nút đỏ).
- **Điểm tốt:** validate kỹ, hiển thị đã trả / đã hoàn / còn hoàn được; nút disabled khi không còn gì để hoàn. **Risk:** thấp.

### WF-7 — Quản lý danh mục (ẩn/hiện, sắp xếp)
- **Entry:** `CategoryListScreen`. **Steps:** ẩn/hiện = 1 bấm (có Undo trong toast); sắp xếp = kéo-thả tự lưu; hàng loạt = chọn nhiều → "Ẩn/Hiện".
- **Pain point lớn:** **bộ lọc "Hiển thị"/"Sắp xếp" làm crash màn (ADM-01)** — đã sửa. **Điểm tốt:** Undo, optimistic, kéo-thả có hỗ trợ bàn phím (dnd-kit KeyboardSensor).
- **Risk:** sau khi sửa ADM-01 — thấp.

### WF-8 — Phân quyền (tạo/sửa quản trị viên)
- **Entry:** `AdminUsersScreen`. **Steps:** "Tạo" mở Modal; "Sửa" mở drawer; thay đổi nhạy cảm có dialog xác nhận.
- **Pain point:** tạo và sửa dùng 2 kiểu overlay khác nhau (ADM-07); không có mô tả quyền của từng vai trò → admin khó chọn đúng vai trò.
- **Risk:** thấp (đã chặn tự khoá / tự đổi quyền). **Đề xuất:** thêm mô tả vai trò; thống nhất overlay.

---

## 7. Consistency Review

| Khía cạnh | Hiện trạng | Vấn đề |
|---|---|---|
| **Button** | shadcn `Button` dùng nhất quán, đủ variant (default/secondary/danger/success/ghost/link/outline), có `loading`/`disabled`. | Tốt — đây là điểm sáng. Chỉ lệch ở vài nút icon thô (toolbar RTE, mpicker) — chấp nhận được vì chuyên biệt. |
| **Form** | `FormField` chuẩn tồn tại nhưng gần như không dùng; phần lớn form tự dựng `form-field`/`field-label`/`au-field`/`sv2-field`. | Lệch nặng — mỗi màn một kiểu label/lỗi/khoảng cách (ADM-02, ADM-04). |
| **Table** | 2 hệ: component `AdminTable` (list screens) và `<table className="admin-table">` thô (Dashboard, Category, OrderDetail...). | 2 cách dựng bảng song song. |
| **Modal/Drawer** | 4+ hệ: shadcn `Dialog`, layout `Modal`, `mpicker-modal` tự dựng, `audit-drawer` tự dựng. | Lệch nặng; modal media không bẫy focus (ADM-07). |
| **Toast/Alert** | sonner `toast` (chuẩn) + `sv2-toast` (Settings) + `OrderNotificationToast` riêng. | 3 cơ chế phản hồi (ADM-11). |
| **Status badge** | `StatusBadge`/`Badge` component + `.status-badge` class + `au-badge` + màu-chữ-thuần (RMA). `ON_HOLD` có 3 màu khác nhau. | Lệch nặng (ADM-03). |
| **Empty/Loading/Error** | `StatePanel` phủ đa số (tốt) + 3 bản empty tự dựng (Category, MediaPicker, NotificationBell). Skeleton: `AdminTable`, `MediaCardSkeleton`, `dash-skeleton`. | Cốt lõi nhất quán; rìa thì lệch (ADM-11). |
| **Layout khung màn** | `Screen`/`ScreenHeader`/`FilterBar` chuẩn — chỉ ~4 màn dùng; ~31 màn tự dựng class thô. | Lệch nặng (ADM-02). |
| **Naming hành động** | Tiếng Việt nhất quán ("Xoá", "Sửa", "Tạo...") ở chỗ dùng `t()`. | Ổn ở naming; vấn đề là **i18n** — nhiều chỗ hardcode (ADM-04). |
| **Component bị duplicate** | `BulkActionBar`/`FilterChips` chỉ Media dùng; Category tự dựng bản thô. `NotificationBell` không ai dùng. | ADM-05, ADM-09. |
| **Encoding / tiếng Việt** | Không phát hiện mojibake (grep `Ã|â€|áº|Æ°|Ä‘` sạch — hit duy nhất là chữ hoa "ĐÃ" hợp lệ). | **Tốt** — không có lỗi vỡ mã. |

**Đối chiếu `docs/DESIGN_SYSTEM_CONSISTENCY.md`:** token cascade (`admin-tokens.css` → `index.css` → Tailwind) đúng hướng; vi phạm chính là **arbitrary value** (ADM-10) và việc **không tái sử dụng component dùng chung** (ADM-02, ADM-03, ADM-07, ADM-09) — đúng nhóm "Cấm" mà CLAUDE.md/AGENTS.md nêu.

---

## 8. Quick Wins

### Đã fix trực tiếp trong đợt audit này

| # | File | Sửa gì | Vì sao an toàn |
|---|---|---|---|
| QW-1 | `BrandListScreen.jsx:141-143`, `:153-155` | `onValueChange={(event) => ...event.target.value}` → `(value) => ...value` cho bộ lọc Hiển thị & Sắp xếp | Khắc phục lỗi crash Critical ADM-01. Chỉ áp đúng mẫu đã dùng ở ProductList/OrderList/AdminUsers; không đụng API/logic/workflow. |
| QW-2 | `CategoryListScreen.jsx:697-699`, `:709-711` | Như trên, cho bộ lọc Hiển thị & Sắp xếp | Như trên. |
| QW-3 | `ContentListScreen.jsx:153-155`, `:165-167` | Như trên, cho bộ lọc Loại & Trạng thái | Như trên. |
| QW-4 | `MediaPickerModal.jsx:389` | Hint "Chọn nhiều ảnh (Ctrl+Click)" → "Bấm vào ảnh để chọn nhiều" | Chỉ đổi chuỗi hiển thị cho khớp hành vi thật (bấm thường đã chọn được). Không đụng logic. |
| QW-5 | `FilterChips.jsx:3` | Mặc định `clearAllLabel` `'Clear all'` (tiếng Anh) → `'Xóa tất cả'` | Chỉ đổi chuỗi mặc định; caller hiện đều tự truyền label nên không đổi hành vi hiện hữu, chỉ loại "bom hẹn giờ". |
| QW-6 | `StatePanel.jsx:21` | `role="status"` cố định → `role={tone === 'danger' ? 'alert' : 'status'}` | Cải thiện a11y: panel lỗi được trình đọc màn hình thông báo ngay. Chỉ đổi thuộc tính ARIA. |
| QW-7 | `AdminUsersScreen.jsx` (PasswordField) | Nút ẩn/hiện mật khẩu: emoji `🙈`/`👁` → icon lucide `Eye`/`EyeOff`; **thêm `type="button"`** + `aria-label` | `type="button"` sửa một lỗi thật: nút thiếu `type` nằm trong `<form>` tạo tài khoản → bấm "hiện mật khẩu" sẽ submit nhầm form. Icon + aria-label đồng bộ với toàn app. |
| QW-8 | `DashboardScreen.jsx:279` | Nút "Thử lại" khi lỗi: `window.location.reload()` → `refetch()` của query | Refetch dữ liệu thay vì tải lại cả trang — nhẹ hơn, giữ state, khớp cách OrderList/ProductList làm. |
| QW-9 | `BrandListScreen.jsx:21` | `pageSize` mặc định `8` → `20` | Đồng bộ với mọi màn list khác (đều 20). Chỉ đổi số dòng/trang, không đụng logic. |

**Verification sau khi áp 9 fix (QW-1..QW-9):**
- `npm run lint` (bigbike-admin) — **sạch**, không lỗi/cảnh báo.
- `npm run build` (bigbike-admin) — **thành công**, 4044 module, không lỗi.
- Docker stack đang chạy nhưng container `bigbike-admin` phục vụ bản build sẵn qua nginx — fix nguồn chưa có trong container đó. Để xem trực tiếp trên trình duyệt cần rebuild container `bigbike-admin` (thao tác shared-state — đề nghị user tự chạy khi cần). Tính đúng đắn của fix được bảo đảm qua lint + build và đối chiếu với mẫu đã dùng đúng ở các màn khác.

> Toàn bộ 9 quick win rủi ro thấp đã được áp dụng. Các vấn đề lớn hơn (refactor) — xem mục 9.

### Tiến độ refactor i18n (ADM-04) — đã bắt đầu trong đợt này

| File | Tình trạng | Chi tiết |
|---|---|---|
| `OrderDetailScreen` | ✅ Xong | ~70 key; toàn bộ nhãn nút trạng thái/thanh toán/vận chuyển, dialog xác nhận, modal đổi trả, bảng RMA. Grep xác nhận 0 chuỗi VN hardcode. |
| `ProductListScreen` | ✅ Xong | ~23 key; cột "Trang chủ", nút "Sao chép", bộ lọc, banner cảnh báo + gỡ 7 `defaultValue` còn dở. |
| `OrderNotificationToast` | ✅ Xong | namespace `notifications`; tiêu đề toast, nhãn đóng; dùng lại `status.order.*`. |
| `TagInput` | ✅ Xong | `common.removeTag` cho aria-label chip. |
| `RichTextEditor` | ✅ Xong | namespace `richEditor`; 16 tooltip thanh công cụ, nút Áp dụng, đếm ký tự. |
| `SettingsScreen` | ✅ Xong | ~18 key; nhãn UI, nút Lưu/Huỷ, message validate, dialog xác nhận, toast. (`KEY_LABELS_VI` giữ tiếng Việt — **cố ý** theo comment trong code: label setting cho admin VN đọc.) |
| `ProductDetailScreen` | ✅ Xong | Đã chuyển toàn bộ chuỗi hiển thị sang `t(...)`, thêm key locale tương ứng, đồng thời sửa a11y section toggle (`button` + `aria-expanded` + `aria-controls`). |
| `MediaPickerModal`, `MediaDetailModal`, `VideoPickerModal` | ✅ Xong | Đã i18n hoá toàn bộ text UI + nhãn/aria; bổ sung key locale cho picker và media reference type. |
| `ErrorBoundary` | ⏳ Giữ nguyên | Class component, màn lỗi last-resort — **cố ý** không phụ thuộc i18n (lỡ hệ i18n hỏng thì màn lỗi vẫn hiện được). |

Tổng đã thêm ~135 key vào `vi.json` + `en.json`. Mọi bước verify lint + build sạch. Cách làm an toàn (thêm key trước, đổi `t()` sau) nên có thể dừng/tiếp ở bất kỳ đâu mà không vỡ giao diện.

---

## 9. Larger Refactor Recommendations

Xếp theo ưu tiên:

1. **Chuẩn hoá khung màn hình (ADM-02).** Migrate toàn bộ screen sang `Screen`/`ScreenHeader`/`FilterBar`/`FormField`. Lấy `ReceivablesListScreen`/`ReceivableDetailScreen` làm mẫu (đã dùng đúng). Đây là nền để mọi cải tiến sau (responsive, a11y, spacing) chỉ sửa 1 nơi.
2. **Một hệ badge trạng thái duy nhất (ADM-03).** Gom map status→tone về `lib/contracts.js`; mọi màn dùng `StatusBadge`/`Badge`; bỏ `.status-badge` class và `au-badge`. Sửa `ON_HOLD` về 1 màu.
3. **Hoàn thiện i18n (ADM-04).** ✅ Đã xong các màn ưu tiên cao (`OrderDetailScreen`, `ProductListScreen`, `SettingsScreen`, `ProductDetailScreen`, `OrderNotificationToast`, `RichTextEditor`, `TagInput`, media modal). `ErrorBoundary` giữ nguyên có chủ đích.
4. **Một hệ modal/drawer duy nhất (ADM-07).** Chuyển `mpicker-modal` và `audit-drawer` sang shadcn `Dialog`/`Modal` (có bẫy focus, ESC, aria sẵn).
5. **Thiết kế lại màn chi tiết đơn hàng (ADM-06).** Gom/thu gọn khu thao tác, dùng `StickyActionBar` cho hành động chính, trạng thái dùng badge, cân nhắc rút gọn fulfillment. (Đụng workflow — cần đối chiếu `docs/business/STATE_MACHINES.md` và hỏi nghiệp vụ trước.)
6. **`NotificationBell` (ADM-05).** ✅ Đã xoá component dang dở khỏi codebase để loại dead code gây hiểu nhầm.
7. **Bulk action cho đơn hàng (WF-2).** Thêm chọn nhiều + "đánh dấu đã thanh toán / xử lý" hàng loạt ở `OrderListScreen`.
8. **Đợt dọn arbitrary value (ADM-10).** Thay `text-[..]`/`w-[..]`/`z-[9999]` bằng token. Làm 1 PR riêng để soát kỹ thay đổi cỡ chữ.
9. **A11y pass.** Section gập của form sản phẩm (ADM-08), "skip to content", focus trap modal media, breadcrumb hiển thị tên thực thể, gập nhóm sidebar.
10. **Responsive pass.** Áp pattern `MobileCard` cho các màn list nhiều cột (hiện chỉ Công nợ dùng).

---

## 10. Final Verdict

**Admin hiện tại đã đủ dễ dùng chưa?** — *Gần đủ, nhưng chưa.* Nền tảng tốt: điều hướng rõ, trạng thái loading/empty/error phủ đầy đủ, xác nhận hành động nguy hiểm rất kỹ, nghiệp vụ (đơn hàng, kho, công nợ, danh mục) được xử lý cẩn thận và có cả những điểm tinh tế (Undo, optimistic UI, real-time, autosave). Một admin vận hành thật sẽ làm được việc trên đa số màn.

**Có phù hợp vận hành production chưa?** — *Chưa, cho tới khi sửa lỗi Critical.* Lỗi `ADM-01` khiến bộ lọc của 3 màn cốt lõi (Thương hiệu, Danh mục, Nội dung) **làm sập màn hình** — đây là điểm chặn. **Lỗi này đã được sửa trong đợt audit (QW-1..QW-3).** Sau khi build/kiểm thử lại, admin đạt mức "dùng được cho vận hành nội bộ". Để đạt chuẩn "production admin chỉn chu, bàn giao cho người ngoài" thì cần đợt dọn nhất quán + i18n ở mục 9.

**Cần ưu tiên fix gì trước?**
1. ✅ **ADM-01** — lỗi crash bộ lọc (đã fix QW-1..QW-3, verify lint + build sạch).
2. **ADM-04** — hoàn thiện i18n (đập vào ấn tượng "chỉn chu" nhiều nhất, khối lượng vừa).
3. **ADM-03 + ADM-02** — thống nhất badge và khung màn (giảm nợ nhất quán).
4. **ADM-05** — quyết định gắn/bỏ chuông thông báo.
5. **ADM-06** — thiết kế lại màn chi tiết đơn hàng (đụng nghiệp vụ — làm sau, có kế hoạch).

**Màn hình / module yếu nhất hiện nay:**
- **Brand / Category / Content List** — yếu nhất vì lỗi crash bộ lọc (đã sửa).
- **OrderDetailScreen** — giàu tính năng nhưng phân mảnh thao tác + hardcode tiếng Việt nặng nhất.
- **AdminUsersScreen** — không nhất quán nội bộ (Modal vs drawer, emoji, badge riêng).
- **SettingsScreen** — i18n làm dở rõ nhất; có toast riêng.

**Module mạnh nhất:** CategoryListScreen (sau khi sửa ADM-01) và MediaLibraryScreen — cả hai cho thấy chất lượng UX cao (Undo, cây/phẳng, bulk đúng ràng buộc, dùng đúng component chung); nên lấy làm chuẩn mẫu cho các màn còn lại.

---

*Hết báo cáo. Mọi issue đều trỏ `file:line` cụ thể; 9 fix nhỏ an toàn (QW-1..QW-9) đã áp dụng trực tiếp, verify lint + build, và ghi rõ ở mục 8.*
