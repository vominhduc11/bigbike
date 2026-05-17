# BigBike Admin — Dashboard UX Fix Report

**Ngày:** 2026-05-17
**Phạm vi:** Module Tổng quan / Dashboard của `bigbike-admin`
**Mục tiêu:** Cải thiện UI/UX dashboard theo hướng production-ready admin dashboard, giữ dark theme và accent đỏ thương hiệu.

---

## 1. Vấn đề đã phát hiện

| # | Vấn đề | Mức độ |
|---|--------|--------|
| 1 | KPI cards **không hiển thị trend** dù backend đã trả về `todayRevenuePct` và `todayOrdersDelta` trong `KpiResponse`. Dữ liệu so sánh kỳ trước bị bỏ phí. | Cao |
| 2 | KPI cards nằm **dưới** section "Việc cần xử lý" → KPI quan trọng bị đẩy khỏi above-the-fold trên desktop. | Cao |
| 3 | "Việc cần xử lý" dùng `SummaryCard` grid → mỗi item chiếm chiều cao lớn, không có severity rõ, không phân biệt mức khẩn. | Cao |
| 4 | Bảng dùng class `admin-table` có `min-width: 760px` cứng → trên section card hẹp (50% width) **luôn phát sinh horizontal scroll trên desktop**, cột bị che. | Cao |
| 5 | Tên sản phẩm dài (`dash-cell-product`) **không truncate** → phá layout bảng. Email khách hàng dài cũng không có tooltip. | Trung bình |
| 6 | Top products dùng `fmtMillions` → doanh thu hiển thị dạng "119.7M" khó đọc, **không nhất quán** với cột tổng tiền bảng đơn hàng (hiển thị đầy đủ ₫). | Trung bình |
| 7 | **Không có empty state**: dashboard render bảng/chart rỗng khi không có dữ liệu → trông như lỗi hệ thống. | Trung bình |
| 8 | Biểu đồ doanh thu trục Y chỉ hiển thị số "M" — **không ghi đơn vị**. | Trung bình |
| 9 | Text phụ (`summary-card-hint`, axis tick) dùng `--admin-color-text-muted` — trên nền dark (`#6e7681`) **contrast yếu**, khó đọc. | Trung bình |
| 10 | Logic format tiền (`fmtVndCompact`) **định nghĩa riêng trong DashboardScreen**, trùng chức năng với `formatters.js`. | Thấp |
| 11 | Section "Việc cần xử lý" luôn render kể cả khi rỗng, dùng `StatePanel` toàn chiều rộng → tốn chiều cao. | Thấp |

---

## 2. File đã sửa

| File | Thay đổi |
|------|----------|
| `bigbike-admin/src/lib/formatters.js` | Thêm utility dùng chung `formatVndShort(amount)` — format VND đầy đủ nhóm số + hậu tố ₫, fallback `—`. |
| `bigbike-admin/src/screens/DashboardScreen.jsx` | Rewrite: KPI lên trên fold + trend pill; attention dạng action list compact có severity; empty state cho 4 vùng; chart subtitle đơn vị; truncate + tooltip; bỏ format helper trùng lặp. |
| `bigbike-admin/src/components/layout/SummaryCard.jsx` | Thêm prop `trend` — node render dưới value (dùng cho trend pill). |
| `bigbike-admin/src/styles/admin-layout.css` | Thêm CSS: `.dash-trend*`, `.dash-attention-*`, `.dash-empty*`, `.dash-table*`; sửa `summary-card-hint` sang `text-secondary`; bỏ `.dash-compact-table` (thay bằng `.dash-table` không có min-width cứng). |
| `bigbike-admin/src/locales/vi.json` + `en.json` | Thêm key: `kpi.trend*`, `kpi.ordersDelta*`, `attention.severity*` + `emptyDesc`, `*.empty/emptyDesc`, `revenueChart.subtitle`, `periodLabel`. |

---

## 3. Hướng xử lý

### 3.1 KPI trend (dùng dữ liệu backend có sẵn)
- `TrendPill` đọc `kpi.todayRevenuePct` và `kpi.todayOrdersDelta` từ response.
- Trend có 3 trạng thái: tăng (xanh, ↑), giảm (đỏ, ↓), không đổi (xám, –).
- Khi backend trả `null` (chưa đủ dữ liệu kỳ trước) → hiển thị **"Chưa đủ dữ liệu so sánh"**, **không bịa số 0%**.

### 3.2 Bố cục above-the-fold
- Thứ tự mới: `Header → KPI cards → Việc cần xử lý → Charts → Tables`.
- KPI 4 thẻ nằm ngay sau header, hiển thị trong vùng đầu màn hình desktop.

### 3.3 Attention action items
- Thay grid card bằng **list dòng compact** (`dash-attention-list`): icon + label + severity badge + hint + số lượng lớn + CTA "Xử lý ngay →".
- **Severity** 3 mức: `high` (đỏ) / `medium` (cam) / `low` (xanh), viền trái màu theo severity, **sort theo độ khẩn**.
- Quy tắc severity: công nợ quá hạn = high; tồn kho có mã hết hàng = high, chỉ cảnh báo sắp hết = medium; đơn chờ > ngưỡng 5 = high; đổi trả chờ duyệt = low.
- Rỗng → empty state compact "Tuyệt vời! Không có việc nào tồn đọng" thay vì `StatePanel` toàn chiều rộng.

### 3.4 Bảng không bị cắt cột
- Class mới `.dash-table` dùng `table-layout: fixed`, **không có `min-width` cứng** trên desktop → không horizontal scroll.
- Cột số (`dash-col-num`) căn phải; cột rank cố định 48px; cột tổng tiền / doanh thu có width cố định; cột khách hàng / sản phẩm là cột co giãn và truncate.
- Trên `≤720px`: bảng nhận `min-width: 480px` + `overflow-x: auto` (`dash-table-wrap`) — horizontal scroll chỉ ở mobile/tablet.

### 3.5 Truncate + tooltip
- `dash-cell-truncate` (email khách) và `dash-cell-product` (tên SP): `max-width: 0` trong table fixed → ellipsis cuối dòng; thuộc tính `title` cung cấp tooltip native.

### 3.6 Định dạng tiền nhất quán
- Bỏ `fmtMillions` / `fmtVndCompact` trong DashboardScreen.
- Mọi giá trị tiền (KPI, bảng đơn, doanh thu top products, tooltip) dùng chung `formatVndShort` từ `formatters.js`.
- Trục Y chart vẫn scale về triệu (đơn vị dày đặc) — đây là ngoại lệ hợp lý cho axis, và **đã ghi rõ đơn vị** ở subtitle.

### 3.7 Empty state
- Component `SectionEmpty` (giữ khung card, không giống lỗi hệ thống) cho: doanh thu rỗng, đơn hàng rỗng, top products rỗng, cơ cấu đơn hàng rỗng.
- Revenue chart kiểm tra `hasRevenue` (có ít nhất 1 ngày doanh thu > 0) mới render chart.

### 3.8 Chart
- Subtitle "Đơn vị: triệu ₫" dưới tiêu đề biểu đồ doanh thu.
- Donut: legend dạng list rõ ràng (đã có sẵn) — dot màu + tên + số + %; tooltip bật sẵn.
- Tick axis đổi từ `text-muted` sang `text-secondary` để tăng contrast trên dark.

### 3.9 Accessibility
- Text phụ (`summary-card-hint`, `dash-attention-hint`, `dash-empty-desc`, axis tick) chuyển sang `text-secondary` — sáng hơn trên nền dark.
- Action item / pie legend / KPI card đều có `:hover` và `:focus-visible` rõ (viền/box-shadow brand).
- Attention item có `aria-label` mô tả đầy đủ "{label}: {count}. Xử lý ngay".
- Trend pill: icon đi kèm chữ (không chỉ dựa màu).

---

## 4. Điểm cần Backend / API hỗ trợ thêm

> Các mục dưới đây **chưa làm UI giả**. Bộ lọc thời gian hiện giữ nguyên 3 tab `7d / 30d / 90d` vì backend `GET /admin/dashboard?period=` chỉ hỗ trợ 3 giá trị này (`AdminDashboardService.parseDays`).

### 4.1 TODO — mở rộng bộ lọc thời gian
Yêu cầu UX là có thêm: hôm nay, tháng này, năm nay, custom date range. Để hỗ trợ cần backend mở rộng:

**Recommended API contract:**
```
GET /admin/dashboard?period={today|7d|30d|mtd|ytd}
GET /admin/dashboard?from=YYYY-MM-DD&to=YYYY-MM-DD   (custom range)
```
- `period`: thêm `today`, `mtd` (month-to-date), `ytd` (year-to-date).
- Hoặc cặp `from`/`to` cho custom range — service đã có sẵn pattern tính theo `Instant` khoảng ngày, chỉ cần parse thêm tham số.
- `revenueData` series cần trả đúng số ngày của khoảng được chọn.
- Khi có contract này, FE chỉ cần bổ sung tab + `DateRangePicker` (component `bigbike-admin` đã có sẵn).

**Trạng thái hiện tại:** giữ 3 tab cũ — không thêm tab giả khi backend chưa trả dữ liệu tương ứng.

### 4.2 Đã đủ — không cần thay đổi backend
- KPI trend (`todayRevenuePct`, `todayOrdersDelta`) — backend **đã trả sẵn**, FE chỉ chưa hiển thị. Đã xử lý.
- `todayPaidRevenue` — đã có, dùng cho hint card doanh thu.

---

## 5. Checklist nghiệm thu

- [x] Desktop: KPI chính (doanh thu, đơn hàng, đơn chờ, sản phẩm) hiển thị ngay vùng đầu màn hình.
- [x] "Việc cần xử lý" là action list compact, không chiếm chiều cao dư thừa.
- [x] Mỗi action item có severity (Khẩn / Cần lưu ý / Theo dõi), icon, số lượng, CTA xử lý.
- [x] Cảnh báo tồn kho lớn → severity `Khẩn` khi có mã hết hàng + CTA tới `/admin/inventory`.
- [x] Bảng "Đơn hàng gần nhất" không mất cột trên desktop, không horizontal scroll.
- [x] Bảng "Sản phẩm bán chạy" hiển thị rõ: rank, sản phẩm, đã bán, doanh thu.
- [x] Tên sản phẩm / email dài truncate bằng ellipsis + tooltip native (`title`).
- [x] Horizontal scroll chỉ xuất hiện ở `≤720px`, có `overflow-x` affordance.
- [x] Empty state cho: doanh thu rỗng, đơn hàng rỗng, top products rỗng, cơ cấu đơn rỗng.
- [x] KPI trend hiển thị tăng/giảm/không đổi; fallback "Chưa đủ dữ liệu" khi backend trả null — không fake số.
- [x] Biểu đồ doanh thu ghi rõ đơn vị "triệu ₫"; donut có legend + tooltip.
- [x] Text phụ chuyển sang `text-secondary` — contrast tốt hơn trên dark theme.
- [x] Interactive element có hover/focus-visible rõ; attention item có `aria-label`.
- [x] Dark theme + accent đỏ BigBike giữ nguyên, mọi màu tham chiếu token `--admin-*`.
- [x] `npm run build` pass; `eslint` pass trên các file đã sửa.
- [ ] **Cần test thủ công:** mở dashboard live trên desktop/tablet/mobile, kiểm tra không có console error và sidebar drawer hoạt động (sidebar/header không bị sửa — giữ nguyên).
- [ ] **Chờ backend:** time filter mở rộng (mục 4.1) — chưa triển khai UI cho tới khi có API.
