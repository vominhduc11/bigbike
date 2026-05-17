# UI/UX Consistency Fix Report — bigbike-admin

**Ngày:** 2026-05-17
**Phạm vi:** Toàn bộ `bigbike-admin` (36 screens, ~30 shared component, layout, token).
**Loại:** Audit hệ thống + chuẩn hóa design system + fix có chọn lọc.

---

## 1. Tổng quan vấn đề đã phát hiện

Kết quả audit khác với kỳ vọng ban đầu: **`bigbike-admin` đã có kiến trúc UI tốt và
tương đối nhất quán** — không phải tình trạng "ghép từ nhiều template".

Hệ thống hiện có:
- Token tập trung tại `admin-tokens.css` (224 dòng) — đủ màu/spacing/radius/shadow/z-index,
  có dark mode đầy đủ qua `[data-theme="dark"]`.
- shadcn/ui (`components/ui/`, 14 component) map từ token.
- `index.css` (5623 dòng) có cấu trúc, chia section rõ, dùng token nhất quán.
- Layout component dùng chung (`components/layout/`).

**Mức độ lệch chuẩn thực tế thấp.** Chỉ phát hiện các điểm cụ thể sau:

| # | Vấn đề | Mức độ |
|---|---|---|
| 1 | Hardcode hex màu brand `#e8281e` trong chart ReportsScreen (4 chỗ) | Thấp |
| 2 | Hardcode hex status colors trong DashboardScreen — pie chart không theo dark mode | Trung bình |
| 3 | 2 lint error: import `cn` thừa (PosScreen, SliderListScreen) | Thấp |
| 4 | 3 file CSS module trong cụm Media Library — lệch khỏi quy ước "không CSS module" | Trung bình — chưa fix (xem mục 9) |
| 5 | Chưa có tài liệu luật design system canonical | — đã tạo |

Inline `style={{}}` trong screens (17 chỗ) đã kiểm tra: **tất cả là giá trị động hợp lệ**
(progress %, depth padding, grid template, drag transform) — không phải lệch chuẩn, giữ nguyên.

---

## 2. Design System rules đã tạo

Tạo mới: **[`docs/DESIGN_SYSTEM_CONSISTENCY.md`](../DESIGN_SYSTEM_CONSISTENCY.md)** —
luật canonical cho toàn bộ UI admin, gồm 9 mục:

1. Kiến trúc style (token → index.css → JSX).
2. Color system — brand, surface, border, text, status, state, charts.
3. Typography — font, type scale, heading hierarchy, weight/line-height.
4. Spacing — thang 4/8/12/16/20/24/32/40, padding chuẩn theo ngữ cảnh.
5. Radius / shadow / border.
6. Layout / grid — breakpoints, table overflow.
7. Component state rules — 9 trạng thái (default → success).
8. Navigation UX rules.
9. UI state update UX rules + danh sách CẤM.

Tài liệu mô tả lại hệ thống **đang có** làm chuẩn — không phát minh token mới, không phá
kiến trúc hiện tại.

---

## 3. File / component đã sửa

**Đợt 1 — chart token + lint:**

| File | Thay đổi |
|---|---|
| `src/screens/ReportsScreen.jsx` | 4× `#e8281e` → `var(--admin-color-brand-red)` |
| `src/screens/DashboardScreen.jsx` | `ORDER_STATUS_COLORS` 7 hex + 1 fallback → `var(--admin-color-status-*)` |
| `src/screens/PosScreen.jsx` | Gỡ import `cn` thừa |
| `src/screens/SliderListScreen.jsx` | Gỡ import `cn` thừa |
| `docs/DESIGN_SYSTEM_CONSISTENCY.md` | Tạo mới — rulebook |
| `docs/audits/UI_UX_CONSISTENCY_FIX_REPORT.md` | Tạo mới — report này |

**Đợt 2 — bỏ CSS module Media Library + Button loading:**

| File | Thay đổi |
|---|---|
| `src/index.css` | +~860 dòng class global cho Media Library (3 section có tiền tố) |
| `src/components/ui/button.jsx` | Thêm prop `loading` (spinner + tự disable + aria-busy) |
| `src/screens/MediaLibraryScreen.jsx` | Bỏ `import styles`, đổi class module → global |
| `src/components/MediaCard.jsx`, `MediaListRow.jsx`, `MediaDetailPanel.jsx`, `MediaFolderSidebar.jsx` | Bỏ `import styles`, đổi class; 2 nút trong DetailPanel dùng `loading` |
| 3 file `*.module.css` (MediaLibraryScreen / MediaDetailPanel / MediaFolderSidebar) | **Đã xóa** |
| ~20 màn hình form (Category/Brand/Content/Product Detail, Order Detail, POS, Settings, Roles, Coupon, Menu, Inventory, Login, Slider, Receivables, Redirect, Return, Serial, Shipping, AdminUsers, ContactInbox, HomeVideo) | Nút submit/save/confirm dùng prop `loading` |

---

## 4. Visual inconsistency đã fix

- **Chart không theo dark mode:** ReportsScreen (area/bar) và DashboardScreen (pie + legend)
  trước đây dùng hex cố định. Ở dark mode các màu này (vd `#92400e`, `#15803d`) bị tối,
  contrast yếu trên nền tối. Sau khi đổi sang token `var(--admin-color-...)`, chart tự
  đổi màu theo light/dark — đồng bộ với phần còn lại của giao diện.
- **Brand red rải rác:** màu đỏ thương hiệu trong chart giờ tham chiếu 1 token duy nhất.

---

## 5. Component polish

**Đợt 1:** `components/ui/` và `components/layout/` đã đạt chuẩn (button đủ variant + size,
focus ring, disabled state) — không cần sửa.

**Đợt 2 (đã thực hiện) — `Button` loading state:**
- Thêm prop `loading` cho `Button` (`components/ui/button.jsx`): hiện spinner `Loader2`
  (animate-spin), tự `disabled` khi loading (chống double-click), `aria-busy`. Nút `size="icon"`
  khi loading sẽ thay icon bằng spinner thay vì hiện cả hai.
- Áp dụng `loading` cho **~35 nút submit/save/confirm** trên ~20 màn hình, bỏ kiểu đổi text
  thủ công (`isSubmitting ? 'Đang lưu' : 'Lưu'`) — nhãn nút giữ cố định, spinner truyền tải
  trạng thái. MenuScreen bỏ spinner tự chế, dùng prop chung.

---

## 6. UI refinement

- Chart đồng bộ theme → giảm cảm giác "lệch hệ thống" giữa Dashboard/Reports và các screen khác.
- Codify design system thành tài liệu → các thay đổi UI sau này có chuẩn để chiếu vào,
  giảm trôi dạt (drift) theo thời gian.

---

## 7. Navigation flow UX

Không phát hiện navigation bug trong phạm vi audit tĩnh. Sidebar active state, drawer mobile,
back trên detail screen đều đã có trong `index.css` + layout component. Việc kiểm tra sâu
luồng (deep link, guard route, redirect sau action) cần chạy app thực tế — đưa vào checklist
test thủ công ở mục 10.

---

## 8. UI state update UX

Không sửa. Quan sát: project dùng React Query (`@tanstack/react-query`) cho data fetching,
`sonner` cho toast, `ConfirmDialog`/`showConfirm` cho xác nhận xóa, `StatePanel` cho
loading/error/empty. Hạ tầng đã đúng hướng. Kiểm tra hành vi runtime cụ thể (double-submit,
stale UI sau mutation) cần test thủ công — đưa vào checklist mục 10.

---

## 9. Trạng thái các mục từng hoãn

| Mã | Nội dung | Trạng thái |
|---|---|---|
| NEEDS_CONFIRMATION-1 | 3 file CSS module Media Library (~1055 dòng) lệch quy ước "không CSS module" | ✅ **Đã xử lý (đợt 2)** — gộp vào `index.css` thành class global có tiền tố (`medialib-`, `mediadetail-`, `mediafolder-`); xóa 3 file `.module.css`; cập nhật 5 file JSX. Tiện thể sửa màu indigo `rgba(99,102,241,...)` (fallback sai) → token brand đỏ; vá lỗi tiềm ẩn `var(--c-text)` (token không tồn tại) → `var(--c-text-primary)`; class con `.primary/.secondary` (plain string không khớp module hash) → class có tiền tố. |
| RECOMMENDATION-1 | Thêm prop `loading` cho `Button` | ✅ **Đã xử lý (đợt 2)** — xem mục 5. |

Không phát hiện vấn đề business rule / API contract / data contract / permission trong
phạm vi UI đã đụng tới.

---

## 10. Checklist test thủ công

> Chạy app (`docker compose` hoặc `npm run dev`) và kiểm tra.

### Desktop
- [ ] Dashboard: KPI card, area chart, pie chart hiển thị đúng, màu theo theme.
- [ ] Reports: đổi preset 7d/30d/90d/custom, chart cập nhật, export CSV.
- [ ] Sidebar: mục active highlight đúng route.

### Tablet (~900–1200px)
- [ ] Sidebar thu gọn icon+text.
- [ ] Dashboard grid về 2 cột.
- [ ] Table không tràn ngang.

### Mobile (≤900px / ≤480px)
- [ ] Hamburger mở/đóng drawer; tap mục đóng drawer + điều hướng.
- [ ] Table → card list.
- [ ] KPI grid về 1 cột (≤480px).

### Light / Dark theme
- [ ] Toggle theme: chart Dashboard + Reports đổi màu đúng, contrast đủ.
- [ ] Status badge, button, input đổi theme không lỗi chữ chìm.

### Main flows
- [ ] Product / Order / Category: list → detail → quay lại.
- [ ] POS: tìm sản phẩm, thêm giỏ, thanh toán.
- [ ] Media Library: upload, chọn, xem chi tiết.

### Forms
- [ ] Submit form: nút disable khi gửi, không double-submit.
- [ ] Validation: error text hiển thị rõ.
- [ ] Xóa dữ liệu: hiện ConfirmDialog.

### Navigation
- [ ] Tạo mới → redirect hợp lý.
- [ ] Cập nhật → ở lại detail.
- [ ] Xóa → list cập nhật / count giảm.
- [ ] Deep link thẳng vào route detail.

### Loading / error / empty
- [ ] StatePanel loading hiển thị khi fetch.
- [ ] Error state nói rõ lỗi.
- [ ] Empty state có hướng dẫn hành động.

---

## 11. Validation đã chạy

| Command | Kết quả (đợt 1) | Kết quả (đợt 2) |
|---|---|---|
| `npm run lint` | ✅ PASS — 0 error | ✅ PASS — 0 error |
| `npm run build` | ✅ PASS — ~10s | ✅ PASS — ~10s |
| `npm test` | — không có script test trong `package.json` | — |

Project không có script `typecheck` riêng (JSX, không TypeScript) và không có script
`format`.

### Kiểm tra thủ công bổ sung cho đợt 2
- **Media Library:** mở màn Thư viện ảnh — lưới + danh sách, panel chi tiết (animation
  trượt vào), sidebar thư mục/tag; so light/dark + thu nhỏ ≤900px/≤1100px → phải giống hệt trước.
- **Button loading:** submit form bất kỳ — nút hiện spinner, tự khoá, bấm liên tục không
  gửi trùng; submit lỗi → nút trở lại bình thường.
