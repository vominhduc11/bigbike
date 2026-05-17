# Order Module P0 Fix Report

**Date:** 2026-05-17  
**Scope:** bigbike-admin — Order List + Order Detail screens  
**Build result:** ✅ `vite build` — 0 errors, 0 warnings (pre-existing chunk size warning không liên quan)

---

## Files changed

| File | Thay đổi |
|---|---|
| `bigbike-admin/src/lib/contracts.js` | Bỏ email/phone fallback khỏi `customerName` |
| `bigbike-admin/src/components/DateRangePicker.jsx` | Thêm i18n; sửa popup position |
| `bigbike-admin/src/locales/vi.json` | Thêm `common.dateRangePlaceholder`, `common.dateRangeClear` |
| `bigbike-admin/src/locales/en.json` | Thêm `common.dateRangePlaceholder`, `common.dateRangeClear` |

---

## Fix chi tiết

### Fix 1 — Customer name không còn hiển thị email (P0-5)

**File:** `src/lib/contracts.js` — hàm `normalizeOrder`

`customerName` có fallback chain: `customerName → customer.fullName → … → customerEmail → customerPhone`. Khi backend không trả về tên thực, field Name hiển thị email, gây trùng lặp với field Email ở cùng màn hình.

**Fix:** Xoá bỏ `customerEmail` và `customerPhone` khỏi fallback. Khi không có tên thực, `customerName = undefined` → UI hiển thị `—`.

> **NEEDS_BACKEND_CHANGE:** Backend nên trả về tên khách hàng trong response đơn hàng (`customerName` hoặc `customer.fullName`). Không có tên → hiển thị `—` là chấp nhận được về mặt UX nhưng vẫn nên có dữ liệu thực từ backend.

---

### Fix 2 — DateRangePicker i18n: bỏ hardcode tiếng Việt (P0-8)

**File:** `src/components/DateRangePicker.jsx`

Hai chuỗi hardcode tiếng Việt:
- `placeholder = 'Tất cả thời gian'` (default prop)  
- `'Xoá bộ lọc ngày'` (nút clear bên trong calendar)

Khi chuyển ngôn ngữ sang EN, hai chuỗi này vẫn hiển thị tiếng Việt.

**Fix:** Thêm `useTranslation`, dùng `t('common.dateRangePlaceholder')` và `t('common.dateRangeClear')`. Prop `placeholder` vẫn được hỗ trợ (override) cho callers cần custom text.

Thêm keys vào cả `vi.json` và `en.json` trong section `common`.

---

### Fix 3 — DateRangePicker popup bị cắt phải tại ~1100px (P0-7)

**File:** `src/components/DateRangePicker.jsx`

Popup calendar dùng `left-0` (căn trái với button). Trong filter bar, DateRangePicker nằm ở vị trí thứ 4 (sau Search, Status, Payment). Tại viewport ~1100px với sidebar ~220px, button có thể nằm ở khoảng x≈700px trong content area — popup mở rộng thêm ~300px về phải sẽ vượt ra ngoài content (1000px > 880px).

**Fix:** Đổi `left-0` → `right-0`. Popup căn phải với button, mở rộng sang trái — tránh được right-overflow.

---

## Trạng thái từng P0

| # | P0 | Trạng thái |
|---|---|---|
| 1 | Order detail table responsive | ✅ Đã có sẵn trong code (`overflow-x-auto` + `minWidth: 480px`) |
| 2 | Confirm FAILED action | ✅ Đã có sẵn (`REASON_REQUIRED = new Set(['CANCELLED', 'FAILED'])` → `ReasonConfirmModal`) |
| 3 | Reason bắt buộc | ✅ Đã có sẵn (validate trong `ReasonConfirmModal`; API nhận `reason` param) |
| 4 | Payment status i18n | ✅ Đã có sẵn (`StatusBadge` dùng `t('status.payment.${status}')`, đủ keys) |
| 5 | Customer name hiển thị email | ✅ **Fixed** (bỏ email fallback) + ⚠️ NEEDS_BACKEND_CHANGE |
| 6 | Currency formatting | ✅ Đã có sẵn (`formatCurrencyVnd` dùng nhất quán) |
| 7 | DateRangePicker popup clip | ✅ **Fixed** (`right-0`) |
| 8 | i18n EN còn sót | ✅ **Fixed** (2 chuỗi hardcode trong DateRangePicker) |
| 9 | Light mode | ✅ Không cần sửa — `:root` trong `admin-tokens.css` IS light mode; toggle hoạt động đúng |

---

## NEEDS_BACKEND_CHANGE

**Customer name (P0-5):** Backend cần trả `customerName` hoặc `customer.fullName` trong response `GET /orders/:id` và `GET /orders`. Hiện tại các field này rỗng/null → frontend không có dữ liệu để hiển thị.
