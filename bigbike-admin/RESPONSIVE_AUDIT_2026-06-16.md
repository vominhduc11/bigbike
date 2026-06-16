# Responsive Design Audit — bigbike-admin (Mobile <640px) — Re-audit 2026-06-16

> Static analysis của class names, inline styles và CSS patterns. Không sửa code, không chạy app.
> Phạm vi: 28 screens + 9 layout components + ~44 feature components.
>
> ⚠️ **Lưu ý:** Repo đã có sẵn [`RESPONSIVE_AUDIT.md`](RESPONSIVE_AUDIT.md) — nhật ký audit + remediation Phase 1/Phase 2 (2026-06-02 → 06-05). File này là **bản re-audit độc lập 2026-06-16**, không ghi đè lịch sử đó. Kết quả "0 Critical" dưới đây phần lớn nhờ Phase 2 trước đã xử lý.

## Tóm tắt

| Mức độ | Số lượng | Ý nghĩa |
|---|---|---|
| 🔴 Critical (layout vỡ) | **0** | Không màn hình nào vỡ layout trên mobile |
| 🟡 Warning (UX kém / overflow) | **4** | Nguy cơ tràn ngang hoặc nội dung bị chèn ép |
| 🟢 Minor | **~15** | Touch target nhỏ, no-wrap nhưng vẫn vừa, cleanup nhỏ |

**Kết luận:** Hệ thống responsive của admin **đã được xây dựng tốt**. Hạ tầng CSS (`admin-layout.css`, `admin-prototype.css`, `index.css`) cung cấp đầy đủ primitive responsive, và phần lớn screen/component **wire đúng**:

- **Sidebar** → drawer + hamburger + overlay ở ≤1024px (AdminShell — verified hoạt động đúng).
- **Bảng dữ liệu** → `AdminTable` với prop `mobileCard` chuyển sang card ở <640px; nhiều list screen tự dựng cặp `hide-on-mobile` + `MobileCardList`.
- **Modal** → tất cả dùng shadcn `DialogContent` base `w-[calc(100%-2rem)]` → co vừa màn hình điện thoại (kể cả khi set `max-w-[480px]`).
- **Grid/KPI/filter/tabs** → `.bb-kpi-grid`, `.bb-grid-2/3/2-1`, `.bb-filter-bar`, `.bb-seg`, `.summary-card-grid` collapse/scroll đúng.
- **Charts** (Dashboard, Reports) → bọc trong `ResponsiveContainer width="100%"`.
- **POS split-panel** (màn phức tạp nhất) → `.pos-layout` stack 1 cột ở ≤1024px — **responsive đúng**.

4 issue 🟡 dưới đây là điểm cần xử lý thực sự; còn lại là tinh chỉnh nhỏ.

---

## 🔴 Critical

_Không có._

---

## 🟡 Warning

### 1. CategoryListScreen.jsx — bảng cây danh mục không có fallback mobile
- **File**: [CategoryListScreen.jsx](src/screens/CategoryListScreen.jsx)
- **Dòng**: 868-895 (tree), 929-962 (flat) → class `.cat-tree-table` ([index.css:1746](src/index.css#L1746), 1785-1800)
- **Vấn đề**: Khác các list screen khác, Categories **không có `mobileCard`/`MobileCardList`**. `.cat-tree-table` là `table-layout: fixed` với width **phần trăm** và **không có `min-width`**, trong `.table-scroll-wrap` (`overflow-x:auto`). Ở <640px bảng 6-7 cột (drag handle + checkbox + thumbnail + tên / mô tả / hiển thị / sort / cập nhật / 2 nút) **bị nén thay vì scroll** → cột mô tả và cụm action bị bóp nát.
- **Đề xuất fix**: Thêm `min-width` (vd `720px`) cho `.cat-tree-table` để `.table-scroll-wrap` scroll ngang thật; HOẶC render card fallback bằng `MobileCardList`.
- **Ghi chú**: File lịch sử [`RESPONSIVE_AUDIT.md`](RESPONSIVE_AUDIT.md) (mục Phase 2) ghi rõ CategoryList & Menu **cố ý giữ chế độ cuộn ngang** (card phá vỡ cấu trúc cây/drag). Nếu đúng vậy thì đây là vấn đề **min-width còn thiếu** chứ không phải thiếu card — chỉ cần thêm `min-width`.

### 2. HomeVideoListScreen.jsx — cụm nút action không xuống dòng
- **File**: [HomeVideoListScreen.jsx](src/screens/HomeVideoListScreen.jsx)
- **Dòng**: 186-199 (action group) trong card row 123-199
- **Vấn đề**: `VideoCard` là hàng `display:flex` (inline, dòng 129): checkbox+grip + thumbnail cố định `w-24` + khối text + cụm 3 nút (Ẩn/Sửa/Xóa, `flex gap-2`, `flexShrink:0`). Cụm nút không wrap → ở <640px khối tiêu đề/URL (`flex:1 minWidth:0`) bị bóp rất hẹp, nút có thể tràn ngang khỏi card.
- **Đề xuất fix**: Cho card row `flex-wrap` để action rớt xuống dòng riêng trên mobile, hoặc gộp 3 text-button thành icon/overflow menu dưới `sm:`.

### 3. SliderListScreen.jsx — cụm nút action + ảnh cố định, không wrap
- **File**: [SliderListScreen.jsx](src/screens/SliderListScreen.jsx)
- **Dòng**: 101-113 (action group) trong card row 48
- **Vấn đề**: `SliderCard` là hàng `display:flex` (inline, dòng 48): grip + ảnh stack cố định (`width:100`/`width:60`, dòng 68/76) + khối info + cụm 3 nút (`flex gap-2`, `flexShrink:0`, dòng 102). Action group không wrap, ảnh cố định 100px → ở <640px khối info bị bóp, 3 nút có thể tràn ngang.
- **Đề xuất fix**: Thêm `flex-wrap` vào card row, hoặc chuyển 3 nút thành icon/overflow menu dưới `sm:`.

### 4. MediaPreviewLightbox.jsx — hộp preview audio tràn trên màn hình hẹp
- **File**: [MediaPreviewLightbox.jsx](src/components/MediaPreviewLightbox.jsx)
- **Dòng**: 99
- **Vấn đề**: Nhánh audio dùng `min-w-[320px]` + padding overlay `p-8` của parent (dòng 44, 32px mỗi bên) → cần ~384px, vượt màn hình điện thoại 360px → tràn/clip. (Ảnh/video an toàn nhờ `max-w-[90vw]`.)
- **Đề xuất fix**: Đổi thành `min-w-0 w-[min(320px,90vw)]` (hoặc `max-w-[90vw]`); cân nhắc `p-8` → `p-4` trên màn nhỏ.

---

## 🟢 Minor

| File | Dòng | Vấn đề | Đề xuất |
|---|---|---|---|
| [SerialListScreen.jsx](src/screens/SerialListScreen.jsx) | 88, 172 | Info trong modal dùng `grid grid-cols-2` không responsive → cặp label/value hơi chật (field dài đã `col-span-2`) | `grid-cols-1 sm:grid-cols-2` |
| [WarrantyListScreen.jsx](src/screens/WarrantyListScreen.jsx) | 54 | `WarrantyDetailModal` info `grid grid-cols-2 gap-2.5` không responsive | `grid-cols-1 sm:grid-cols-2` |
| [ReceivableDetailScreen.jsx](src/screens/ReceivableDetailScreen.jsx) | 80-86 | `<h1>` gói title + mã đơn mono + badge; đã `flexWrap:wrap`, chỉ rủi ro mã đơn rất dài không ngắt | `wordBreak:'break-word'` cho span mã đơn (optional) |
| [ReviewListScreen.jsx](src/screens/ReviewListScreen.jsx) | 286 | Hàng action review-card không wrap; tối đa 4 nút có thể tràn ở <360px | Thêm `flex-wrap` (optional) |
| [PosScreen.jsx](src/screens/PosScreen.jsx) | cart-item ([index.css:2811](src/index.css#L2811)), JSX 1031-1086 | Hàng giỏ `grid 1fr auto auto` không collapse; subtotal `min-width:72px` → chật ~320px nhưng không vỡ | Optional: ở `≤400px` cho row wrap |
| [MenuScreen.jsx](src/screens/MenuScreen.jsx) | bảng items ([index.css:862](src/index.css#L862)) | Bảng items chỉ scroll ngang (có `min-width:580px`) — chấp nhận được, không card parity | Optional: thêm card fallback |
| [FilterBar.jsx](src/components/FilterBar.jsx) | 5-12 | `FilterField` set inline `gridColumn: span N` nhưng parent `.bb-filter-bar` là `flex` → style **vô hiệu** (no-op) | Cleanup: bỏ prop `span` |
| [FilterSearchInput.jsx](src/components/FilterSearchInput.jsx) | 31 | Input `h-[30px]` < 44px touch target | Cố ý theo scale dense — không bắt buộc |
| [FilterSelect.jsx](src/components/FilterSelect.jsx) | 29 | Trigger `h-[30px] w-auto` < 44px | Như trên |
| [PaginationControls.jsx](src/components/PaginationControls.jsx) | 29 | `.bb-row` bọc jump-form + pager không `flex-wrap` (pager bên trong vẫn wrap, vẫn vừa ≥320px) | Optional: thêm `flex-wrap` |
| [ImageUrlInput.jsx](src/components/ImageUrlInput.jsx) | 49 ([index.css:1365](src/index.css#L1365)) | `.image-url-input-row` flex không wrap; chỉ 2 nút ngắn nên vừa ≥320px | Optional: `flex-wrap` |
| [TagInput.jsx](src/components/TagInput.jsx) | 95 | Input `min-w-[80px]`; container đã `flex-wrap` | Không cần |
| [NotificationBell.jsx](src/components/NotificationBell.jsx) | 142 | Nút chuông `size-9` (36px) < 44px | Optional: `size-10/11` |
| [Tabs.jsx](src/components/layout/Tabs.jsx) | 160 (CSS) | `.seg-tabs-tab` `min-height:32px` < 44px | Cố ý cho segmented control dày |

---

## ✅ Đã verify CLEAN

**Screens:** AuditLogListScreen (swap card riêng ≤768px), AdminUsersScreen, OrderListScreen, ReceivablesListScreen, CustomerListScreen, ProductListScreen, FeaturedProductsScreen, HomeHighlightsScreen, ReviewDetailScreen (`auto-fit minmax(280px,1fr)`), RolesScreen (`.roles-layout` master-detail collapse ≤1024px), DashboardScreen, InventoryScreen (`overflow-x-auto` + ẩn cột tiến trình), MediaLibraryScreen (sidebar `flex-direction:column` ≤1024px, grid `auto-fill minmax(200px,1fr)`), ReportsScreen, ShippingScreen (`grid-cols-1 lg:grid-cols-[...]`), LoginScreen (`.bb-login-shell` → 1 cột, panel trái ẩn), PosScreen (split-panel stack đúng).

**Layout components:** Screen, Tabs, StickyActionBar, MobileCardList, FormField, Modal (base `w-[calc(100%-2rem)]`), ScreenHeader, SummaryCard, FilterBar.

**Feature components:** AdminShell (hamburger/drawer/overlay verified), AdminTable, BulkActionBar (`flex-wrap`), FilterChips (`flex-wrap`), DateRangePicker (single-month, `max-w-[calc(100vw-2rem)]`), PageSizeSelect, GlobalSearch (`w-full`, trigger ẩn trên mobile), ConfirmDialog (`max-w-sm`), **RefundModal** (`max-w-[480px]` nhưng base `w-[calc(100%-2rem)]` → co đúng), ExportButton, StatePanel, StatusBadge, ReadOnlyBanner, DetailSection, DropdownPopover (Radix tự constrain), Sortable, MediaCard, MediaDetailModal/Panel (`width:420px; max-width:100vw`), MediaFolderSidebar, MediaListRow (`flex-wrap` ≤768px), MediaPickerModal/VideoPickerModal (`.mpicker-modal` = `min(960px, 100vw-2rem)`), CustomerPickerModal, ProductPickerCombobox, ContentCategoryManagerModal, OrderNotificationToast (`w-[min(340px,100vw-2rem)]`), NotificationBell (panel `max-w-[calc(100vw-2rem)]`).

---

## Phụ lục — Hạ tầng responsive (tham chiếu)

| Primitive | File / dòng | Hành vi mobile |
|---|---|---|
| Sidebar drawer + hamburger + overlay | [admin-prototype.css:1174-1252](src/styles/admin-prototype.css#L1174) | `≤1024px`: sidebar `position:fixed` trượt vào, overlay che, hamburger hiện |
| `.bb-kpi-grid` | admin-prototype.css:1192-1202 | 2 cột ≤1024, 1 cột ≤640, 6 cột ≥1280 |
| `.bb-grid-2 / 3 / 2-1` | admin-prototype.css:1197, 1221-1224 | collapse 1 cột |
| `.bb-filter-bar` | admin-prototype.css:1198 | `flex-direction:column` ở ≤640 |
| `.bb-seg` / `.seg-tabs` | admin-layout.css:198-207 | scroll ngang ở ≤640 |
| `.summary-card-grid` | admin-layout.css:124-133 | 2 cột ở ≤640 |
| `.info-grid` / `.bb-info-grid` | admin-layout.css:389; admin-prototype.css:1129 | 1 cột ở ≤640 |
| `.sticky-action-bar` | admin-layout.css:337-343 | nút `flex:1` full-width ở ≤640 |
| `MobileCardList` / `hide-on-mobile` | admin-layout.css:300-309 | bảng → card ở ≤640 |
| `Modal` / `DialogContent` | ui/dialog.jsx:28 | base `w-[calc(100%-2rem)] max-w-lg max-h-[90vh]` |
| `.pos-layout` | index.css:2645-2649 | split-panel → 1 cột ở ≤1024 |
| `.medialib-layout` / `.mediafolder-sidebar` | index.css:3698, 4746 | flex-column + sidebar full-width ở ≤1024 |
