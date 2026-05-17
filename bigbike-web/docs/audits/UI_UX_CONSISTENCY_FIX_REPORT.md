# BigBike Web — UI/UX Consistency Fix Report

> Ngày: 2026-05-17
> Phạm vi: `bigbike-web` (Next.js storefront)
> Liên quan: [`docs/DESIGN_SYSTEM_CONSISTENCY.md`](../DESIGN_SYSTEM_CONSISTENCY.md)

---

## 1. Tổng quan vấn đề đã phát hiện

Đợt rà soát này kiểm tra design token, component dùng chung và mức độ tuân thủ
chuẩn trên toàn bộ `bigbike-web`. **Kết luận chính: codebase đã có một design system
trưởng thành và tương đối nhất quán** — không phải tình trạng "ghép từ nhiều template".

Bằng chứng từ audit tự động (toàn bộ `app/` + `components/`):

| Hạng mục kiểm tra | Kết quả |
|---|---|
| Tailwind built-in color (`bg-red-500`…) thay vì brand token | **0** vi phạm |
| `rounded-sm/md/lg/xl` (sai chuẩn radius `0`) | **0** vi phạm |
| Hardcode hex trong JSX | **2** — đều là brand color nền tảng thứ ba (Facebook, Zalo) |
| Arbitrary px trong JSX (`-[14px]`…) | **322** — phần lớn là pixel-match WP-parity có chủ đích |
| Component UI dùng chung | đầy đủ trong `components/ui` & `components/layout` |
| Token gốc | tập trung tại `styles/brand-tokens.css` + `globals.css` |

Vấn đề thực sự phát hiện được tập trung ở **3 nhóm**:

1. **Mojibake (vỡ mã UTF-8)** trong `app/globals.css` — gồm cả 1 lỗi hiển thị thật.
2. **Lệch typography nhỏ** giữa các component trạng thái và `Card`.
3. **Nợ kiến trúc CSS** — `globals.css` còn ~1.578 class `.bb-*` (legacy WP-parity).
   Đây là nợ lớn, **không thuộc phạm vi** một đợt consistency fix (xem mục 9).

---

## 2. Design System rules đã tạo / cập nhật

Đã tạo tài liệu luật chung canonical:
[`docs/DESIGN_SYSTEM_CONSISTENCY.md`](../DESIGN_SYSTEM_CONSISTENCY.md) — gồm 8 phần:

1. **Color system** — bảng màu ngữ nghĩa, màu trạng thái, màu theo state tương tác,
   danh sách cấm (kèm ngoại lệ brand color nền tảng thứ ba).
2. **Typography system** — font family, type scale, quy tắc uppercase/weight/hierarchy.
3. **Spacing system** — thang 4px, padding chuẩn cho page/section/card/form/modal/table.
4. **Radius / shadow / border system** — radius `0`, cấp shadow, độ dày border.
5. **Layout / grid rules** — container 1200px, breakpoints, table overflow.
6. **Component state rules** — default/hover/active/focus/disabled/loading/empty/error/
   success; quy tắc chống layout shift; rule riêng cho button/input/card/table/modal/toast.
7. **Navigation UX rules** — active menu, breadcrumb, back, mobile nav, redirect sau action,
   route cần quyền, chống dead-end.
8. **UI state update UX rules** — loading sau submit, chống double submit, success/error
   feedback, confirm, optimistic update, empty state, chống stale UI/flicker.

Kèm checklist review cho mọi page/component mới.

---

## 3. File / component đã sửa

| File | Thay đổi |
|---|---|
| `app/globals.css` | Sửa toàn bộ mojibake: `—`, `–`, `≥`, `→` (xem mục 4) |
| `components/ui/EmptyState.tsx` | Tiêu đề `<h2>` đổi sang `font-heading` + uppercase, weight 600 |
| `components/ui/ErrorState.tsx` | Tiêu đề `<h2>` đổi sang `font-heading` + uppercase, weight 600 |
| `docs/DESIGN_SYSTEM_CONSISTENCY.md` | **Mới** — tài liệu luật chung |
| `docs/audits/UI_UX_CONSISTENCY_FIX_REPORT.md` | **Mới** — báo cáo này |

---

## 4. Visual inconsistency đã fix

### 4.1 Mojibake trong `globals.css` (vỡ mã UTF-8)

`globals.css` chứa nhiều ký tự bị vỡ mã do lưu nhầm encoding:

- **Lỗi hiển thị thật** — dòng `.bb-news-section--home .bb-news-cta-btn::after`:
  `content: "â†’"` → đã sửa thành `content: "→"`. Trước khi sửa, nút "Xem tin tức"
  ở trang chủ render ra ký tự rác `â†'` thay vì mũi tên `→`.
- **Mojibake trong comment** (~11 dòng): `â€"` → `—`, `â€"` → `–`, `â‰¥` → `≥`.
  Không hiển thị ra UI nhưng vi phạm quy tắc UTF-8 của repo — đã sửa hết.

Đã verify lại: không còn chuỗi mojibake nào trong file.

### 4.2 Lệch typography ở component trạng thái

`EmptyState` và `ErrorState` render tiêu đề bằng `font-bold` (Barlow body), trong khi
`CardTitle` và mọi heading khác dùng `font-heading` (Oswald) + uppercase. Đã đồng bộ:
tiêu đề empty/error state nay dùng `font-heading text-base font-semibold uppercase`,
khớp quy tắc "heading dùng Oswald uppercase, weight 600" trong design system.

---

## 5. Component đã polish

- **`EmptyState` / `ErrorState`** — tiêu đề nhất quán với hệ heading; giữ nguyên cấu trúc
  `aria-live` / `role="alert"` (đã có sẵn, đúng chuẩn accessibility).

Các component UI lõi (`button`, `card`, `input`, `dialog`, `select`…) đã được kiểm tra
và **đạt chuẩn** — không cần sửa: button có đủ 7 variant + 4 size, focus-visible rõ,
disabled state đúng, không layout shift; input có focus ring + `aria-invalid` state;
card đúng radius/border/shadow.

---

## 6. UI refinement đã làm

- Chuẩn hóa typography heading cho trạng thái empty/error để toàn bộ heading nhìn cùng
  một hệ thống.
- Sửa lỗi hiển thị mũi tên ở CTA trang tin tức (trang chủ) — bỏ ký tự rác.
- Đóng góp lớn nhất về refinement là tài liệu `DESIGN_SYSTEM_CONSISTENCY.md`: từ nay
  mọi refinement có một chuẩn tham chiếu thay vì quyết định cảm tính.

---

## 7. Navigation flow UX issue đã fix

Không phát hiện navigation bug rõ ràng trong phạm vi audit tự động. Quy tắc navigation
đã được hệ thống hóa thành luật trong `DESIGN_SYSTEM_CONSISTENCY.md` §7 để các thay đổi
sau bám theo. Việc kiểm tra sâu từng flow điều hướng cần test thủ công — xem mục 10.

---

## 8. UI state update UX issue đã fix

Không sửa code logic state trong đợt này (đúng yêu cầu: không đụng business logic /
API / data contract). Quy tắc UI state update đã được hệ thống hóa thành luật trong
`DESIGN_SYSTEM_CONSISTENCY.md` §8 (loading sau submit, chống double submit, success/error
feedback, chống stale UI…). Việc verify từng thao tác cần test thủ công — xem mục 10.

---

## 9. Vấn đề CHƯA fix — cần xác nhận / tách task riêng

### 9.1 `NEEDS_CONFIRMATION` — Legacy CSS layer trong `globals.css`

`globals.css` dài ~7.293 dòng, trong đó ~1.578 class `.bb-*` định nghĩa thủ công. Điều
này mâu thuẫn với quy tắc CLAUDE.md ("globals.css chỉ chứa token + reset + shadcn
override; không thêm class mới khi Tailwind đủ").

- **Tại sao chưa fix:** đây là di sản của bản port WP-parity. Di chuyển ~1.578 class sang
  inline Tailwind là một cuộc refactor lớn, **vượt phạm vi** một đợt UI/UX consistency
  fix và có rủi ro regression cao trên nhiều màn hình.
- **Cập nhật 2026-05-17:** đã mở task migration riêng — xem
  [`CSS_BB_MIGRATION_PROGRESS.md`](CSS_BB_MIGRATION_PROGRESS.md). Phase 0 (kiểm kê) và
  Phase 2 (xóa 138 class CSS chết — 292 rule, −680 dòng globals.css, build xanh) đã
  xong. Phần di trú sang inline Tailwind theo cụm còn lại.

### 9.2 `NEEDS_CONFIRMATION` — 322 arbitrary px values trong JSX

Phần lớn là pixel-match có chủ đích với giao diện WordPress gốc (`px-[14px]`, `py-[7px]`…).
Thay máy móc sang thang 4px sẽ **phá WP-parity**.

- **Đề xuất:** không thay hàng loạt. Khi nào có quyết định bỏ ràng buộc WP-parity ở một
  màn hình cụ thể thì mới chuẩn hóa cụm đó về thang spacing.

### 9.3 Brand color nền tảng thứ ba

`app/tin-tuc/[slug]/page.tsx` dùng `bg-[#1877f2]` (Facebook) và `bg-[#0068ff]` (Zalo)
cho nút share. Đây là **màu thương hiệu của nền tảng thứ ba**, không thuộc palette
BigBike — giữ nguyên là hợp lý. `DESIGN_SYSTEM_CONSISTENCY.md` §1.4 đã ghi nhận đây là
ngoại lệ được phép; khuyến nghị thêm comment ghi rõ tại chỗ dùng.

---

## 10. Checklist test thủ công

Các đợt sau hoặc QA cần verify thủ công những mục dưới đây (audit tự động không thay thế
được test render thật):

**Desktop / Tablet / Mobile**
- [ ] Trang chủ — slider, product grid, news CTA (kiểm tra mũi tên `→` đã hiển thị đúng).
- [ ] Danh mục sản phẩm — filter, sort, pagination, grid 3/2/1 cột theo breakpoint.
- [ ] Trang sản phẩm chi tiết — gallery, variant selector, add-to-cart.
- [ ] Giỏ hàng / thanh toán — table responsive, không overflow ngang trên mobile.
- [ ] Tài khoản — đơn hàng, địa chỉ, đổi/trả.

**Forms**
- [ ] Đăng nhập / đăng ký / quên mật khẩu — loading khi submit, disable nút, error message.
- [ ] Form liên hệ, form đánh giá — validation, error inline.

**Navigation**
- [ ] Active menu phản ánh đúng route hiện tại.
- [ ] Mobile drawer mở/đóng, touch target ≥ 44px.
- [ ] Deep-link trực tiếp vào route con hoạt động.
- [ ] Route cần đăng nhập → redirect đúng kèm returnUrl.

**Loading / Error / Empty states**
- [ ] `EmptyState` / `ErrorState` — kiểm tra tiêu đề Oswald uppercase hiển thị đúng.
- [ ] Skeleton khi tải danh sách sản phẩm / tin tức.
- [ ] Trạng thái lỗi mạng có nút "Thử lại".

**Theme**
- [ ] Dự án chỉ có **light-first** (header/footer dark). Không có dark mode toggle —
      không cần test dark theme.

---

## 11. Validation đã chạy

| Lệnh | Kết quả |
|---|---|
| `npx eslint` (file đã sửa) | ✅ PASS |
| `npx tsc --noEmit` | ✅ PASS |
| `npm run build` | ✅ PASS (exit 0 — toàn bộ route compile thành công) |

Toàn bộ thay đổi code chỉ ở mức CSS content string và Tailwind className — không đụng
type, không đụng logic, không thêm thư viện.
