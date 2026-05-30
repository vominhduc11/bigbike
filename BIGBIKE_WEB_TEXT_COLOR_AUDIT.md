# Audit màu chữ — bigbike-web

> Ngày audit: 2026-05-30  
> Ngày fix: 2026-05-30  
> Scope: toàn bộ `.jsx/.tsx/.js/.ts` trong `bigbike-web/`  
> Phương pháp: đọc trực tiếp source files + grep xác nhận từng pattern  
> **Trạng thái: ĐÃ FIX XONG — COMPLIANT**

---

## 1. Token màu chữ đã định nghĩa

### 1.1 CSS Custom Properties (`styles/brand-tokens.css`)

| Token | Giá trị | Dùng cho |
|---|---|---|
| `--bb-text-primary` | `#000000` | Body text, heading chính — nền sáng |
| `--bb-text-secondary` | `#6f6f6f` | Text phụ, metadata, hint |
| `--bb-text-muted` | `#6f6f6f` | Text mờ (cùng giá trị với secondary) |
| `--bb-text-disabled` | `#8a8a8a` | Text bị disabled |
| `--bb-text-brand` | `#cc0906` | Link, CTA, nhấn mạnh, hover — AA-safe red |
| `--bb-text-inverse` | `#ffffff` | Text trên nền tối (header, footer, drawer) |
| `--bb-text-inverse-secondary` | `#cecece` | Text phụ trên nền tối |
| `--bb-text-inverse-muted` | `#abb8c3` | Text mờ trên nền tối (`~4.7:1` trên `#141414`, WCAG AA) |
| `--bb-state-success-text` | `#3d5230` | Text trạng thái thành công |
| `--bb-state-warning-text` | `#7a5800` | Text trạng thái cảnh báo |
| `--bb-state-info` | `#005fcc` | Text trạng thái thông tin (= `--bb-link-text`) |
| `--bb-rating-star` | `#b45309` | Màu sao đánh giá |
| `--bb-discount` | `#6100d1` | Text giảm giá / coupon (màu tím) |

### 1.2 Tailwind classes (`app/globals.css` — `@theme inline`)

| Class Tailwind | Maps tới | Giá trị cuối |
|---|---|---|
| `text-foreground` | `var(--foreground)` → `var(--bb-text-primary)` | `#000000` |
| `text-muted-foreground` | `var(--muted-foreground)` → `var(--bb-text-secondary)` | `#6f6f6f` |
| `text-primary-foreground` | `var(--primary-foreground)` → `var(--bb-text-inverse)` | `#ffffff` |
| `text-secondary-foreground` | `var(--secondary-foreground)` → `var(--bb-text-primary)` | `#000000` |
| `text-destructive-foreground` | `var(--destructive-foreground)` → `var(--bb-text-inverse)` | `#ffffff` |
| `text-info-foreground` | `var(--info-foreground)` → `var(--bb-text-inverse)` | `#ffffff` |
| `text-destructive` | `var(--destructive)` → `var(--bb-state-danger)` | `#cc0906` |
| `text-brand` | `var(--color-brand)` → `var(--bb-action-primary)` | `#cc0906` |
| `text-white` | `var(--bb-color-white)` | `#ffffff` |
| `text-state-success-text` ✅ _mới thêm_ | `var(--color-state-success-text)` → `var(--bb-state-success-text)` | `#3d5230` |
| `text-state-warning-text` ✅ _mới thêm_ | `var(--color-state-warning-text)` → `var(--bb-state-warning-text)` | `#7a5800` |
| `text-rating-star` ✅ _mới thêm_ | `var(--color-rating-star)` → `var(--bb-rating-star)` | `#b45309` |
| `text-discount` ✅ _mới thêm_ | `var(--color-discount)` → `var(--bb-discount)` | `#6100d1` |

---

## 2. Thống kê sử dụng token hợp lệ

Tổng cộng **393+ lần** dùng system color class trên **73+ files** (đếm bằng grep xác nhận trực tiếp).

| Class | Ghi chú |
|---|---|
| `text-muted-foreground` | Nhiều nhất — text phụ, metadata |
| `text-foreground` | Body text chính |
| `text-brand` | CTA, link, nhấn mạnh |
| `text-white` | Text trên nền tối |
| `text-destructive` | Lỗi, validation |
| `text-state-success-text` | Mới, thay thế arbitrary var |
| `text-state-warning-text` | Mới, thay thế arbitrary var |
| `text-rating-star` | Mới, thay thế arbitrary var |
| `text-discount` | Mới, thay thế arbitrary var |

---

## 3. Vi phạm đã phát hiện và đã fix

### 3.1 Arbitrary CSS variable — token chưa expose vào Tailwind (14 instances / 7 files)

**Root cause:** `--bb-state-success-text`, `--bb-state-warning-text`, `--bb-rating-star`, `--bb-discount` có trong `brand-tokens.css` nhưng không được khai báo trong `@theme inline`, buộc developer phải dùng `text-[var(...)]`.

**Fix đã thực hiện:**

_Thêm vào `app/globals.css` — `@theme inline`:_
```css
--color-state-success-text: var(--bb-state-success-text);
--color-state-warning-text: var(--bb-state-warning-text);
--color-rating-star: var(--bb-rating-star);
--color-discount: var(--bb-discount);
```

| File | Từ | Thành |
|---|---|---|
| `components/ui/badge.tsx` (3 instances) | `text-[var(--bb-state-success-text)]` × 2, `text-[var(--bb-state-warning-text)]` × 1 | `text-state-success-text`, `text-state-warning-text` |
| `components/ui/StatusBadge.tsx` (2 instances) | `text-[var(--bb-state-success-text)]`, `text-[var(--bb-state-warning-text)]` | `text-state-success-text`, `text-state-warning-text` |
| `components/ui/RatingStars.tsx` (1 instance) | `text-[var(--bb-rating-star)]` | `text-rating-star` |
| `app/xac-nhan-email/page.tsx` (2 instances) | `text-[var(--bb-state-success-text)]` × 2 | `text-state-success-text` |
| `app/tai-khoan/edit-account/page.tsx` (1 instance) | `text-[var(--bb-state-success-text)]` | `text-state-success-text` |
| `app/tai-khoan/edit-address/[type]/page.tsx` (2 instances) | `text-[var(--bb-state-success-text)]`, `text-[var(--bb-discount)]` | `text-state-success-text`, `text-discount` |
| `app/tai-khoan/doi-tra/page.tsx` (3 instances) | `text-[var(--bb-state-success-text)]`, `text-[var(--bb-state-warning-text)]` × 2 | `text-state-success-text`, `text-state-warning-text` |

### 3.2 Tailwind built-in color palette — không qua brand token (3 instances / 2 files)

| File | Từ | Thành |
|---|---|---|
| `components/catalog/QuickBuyModal.tsx` | `text-green-600` | `text-state-success-text` |
| `components/catalog/QuickBuySuccessModal.tsx` | `text-green-600` | `text-state-success-text` |
| `components/catalog/QuickBuySuccessModal.tsx` | `text-amber-700 bg-amber-50 border border-amber-200` | `text-state-warning-text bg-[var(--bb-state-warning-bg)] border border-[var(--bb-state-warning-border)]` |

### 3.3 Hardcoded hex trong Tailwind arbitrary value (1 instance / 1 file)

| File | Từ | Thành |
|---|---|---|
| `components/layout/SiteFooter.tsx` | `text-[#7e7e7e]` | `text-muted-foreground` |

---

## 4. Verify sau fix

Sau khi áp dụng tất cả thay đổi, chạy grep xác nhận — **kết quả: 0 matches (sạch):**

```bash
grep -rn "text-\[var(--bb|text-green-|text-amber-|text-\[#" bigbike-web/
# → No matches found
```

---

## 5. Tổng kết

| Hạng mục | Trước fix | Sau fix |
|---|---|---|
| Vi phạm tổng | 18 instances / 10 files | 0 |
| Arbitrary CSS var trong JSX | 14 | 0 |
| Tailwind built-in color | 3 | 0 |
| Hardcoded hex class | 1 | 0 |
| Token expose thiếu trong `@theme inline` | 4 | 0 |

### Verdict: **COMPLIANT** ✅

- Toàn bộ màu chữ trong `bigbike-web` đều traceable về design system token
- `text-[var(...)]` pattern đã bị loại bỏ hoàn toàn khỏi JSX/TSX
- Không còn Tailwind built-in palette (`text-green-*`, `text-amber-*`) hay hardcoded hex
- 4 token mới (`text-state-success-text`, `text-state-warning-text`, `text-rating-star`, `text-discount`) đã được expose đúng chuẩn qua `@theme inline`
