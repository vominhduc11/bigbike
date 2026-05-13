# Floating Actions Fix Report — BigBike Web

**Date:** 2026-05-13
**Scope:** `bigbike-web` — floating action widgets (chat/support + scroll-to-top)

---

## Files Changed

| File | Type of Change |
|---|---|
| `bigbike-web/app/layout.tsx` | Added `.wp-floating-group` wrapper div |
| `bigbike-web/app/globals.css` | Position, z-index, color, mobile fixes |
| `bigbike-web/components/home/FloatingChat.tsx` | SVG icon stroke color fix |

---

## Problems Before Fix

### 1. Overlap / Chồng chéo
- `ScrollToTopButton` và `FloatingChat` đều có `position: fixed; bottom: ~24px; right: ~24px` độc lập.
- Scroll-to-top (z-index: 600) đè lên chat widget (z-index: 350) vì cùng tọa độ.
- Khi cả hai hiện cùng lúc, scroll-to-top che khuất nút chat.

### 2. Không có hệ thống vị trí
- Hai component fixed riêng lẻ, không có container chung.
- Chat: `bottom: 26px / right: 28px` (base) → bị override thành `24px / 24px` (light theme section line 9121).
- Scroll-to-top: `bottom: 24px / right: 24px`.
- Ba lần khai báo vị trí cho `.wp-chat-float` (line 3151, 6158, 9121) — không nhất quán.

### 3. Màu off-brand
- Chat button và label dùng `var(--bb-state-info)` / `#00bfff` (xanh cyan) — không phù hợp brand đỏ/đen BigBike.
- Icon SVG trong `IconChat` dùng `stroke="#00BFFF"` cứng.
- Shadow dùng `rgba(32, 196, 244, ...)` — tông cyan.

### 4. Z-index không hợp lý
- Scroll-to-top ở `z-index: 600` (toast level) — quá cao.
- Chat ở `z-index: 350` — thấp hơn scroll-to-top mà lại là element quan trọng hơn.

### 5. Mobile
- Safe-area inset khai báo trên `.wp-chat-float` (line 6158) nhưng scroll-to-top không có safe-area → không nhất quán.

---

## Cách Fix

### Layout: Group Container

**`layout.tsx`** — wrap cả hai widget vào một `<div className="wp-floating-group">`:

```tsx
<div className="wp-floating-group">
  <ScrollToTopButton />
  <FloatingChatLoader />
</div>
```

- Group dùng `position: fixed; bottom: max(24px, env(safe-area-inset-*)); right: max(24px, env(safe-area-inset-*))`.
- `flex-direction: column; align-items: flex-end; gap: 12px` → stack dọc, scroll-to-top phía trên, chat phía dưới.
- `pointer-events: none` trên group + `pointer-events: auto` trên children → gap không block click.
- **Một nguồn duy nhất** cho safe-area và bottom/right offset.

### Scroll-to-top

- Xoá `position: fixed`, `bottom`, `right`, `z-index` — position giờ do group quản lý.
- Thêm `flex-shrink: 0`.
- Size giảm từ 52×52 xuống 48×48px (utility action, nhỏ hơn chat một chút).
- Thêm `transform: translateY(-2px)` khi hover cho feedback rõ.

### Chat/Support Widget

- Xoá `position: fixed`, `bottom: 26px`, `right: 28px`, `z-index` khỏi `.wp-chat-float`.
- Thêm `position: relative; flex-shrink: 0` để popup con (`position: absolute`) vẫn định vị đúng.
- Button size thống nhất 56×56px ở tất cả breakpoints (bỏ override 72px).
- Label font-size giảm từ `1rem` xuống `0.875rem`, margin-bottom từ 22px xuống 16px.

### Màu Brand

| Element | Trước | Sau |
|---|---|---|
| Chat button background | `#00bfff` (xanh cyan) | `#ff0c09` (BigBike red) |
| Chat button hover | `#0099cc` | `#cc0a07` |
| Chat button shadow | `rgba(32, 196, 244, ...)` | `rgba(255, 12, 9, ...)` |
| Chat label background | `#00bfff` | `#ff0c09` |
| Chat label shadow | `rgba(0, 191, 255, 0.3)` | `rgba(255, 12, 9, 0.25)` |
| Item hover | `rgba(0, 123, 255, 0.08)` | `rgba(255, 12, 9, 0.06)` |
| Icon SVG stroke | `#00BFFF` (hardcoded) | `rgba(255,255,255,0.75)` |

---

## Quy Tắc Z-Index Sau Fix

| Layer | Z-Index | Áp dụng |
|---|---|---|
| `.wp-floating-group` | `var(--bb-z-overlay)` = 400 | Group duy nhất quản lý floating actions |
| Header | `var(--bb-z-header)` = 200 | Sticky header |
| Modal/Drawer | `var(--bb-z-modal)` = 500 | Nổi trên floating group |
| Toast | `var(--bb-z-toast)` = 600 | Nổi trên tất cả |

Floating group không còn dùng `z-index: 600` (toast level) hay `calc(overlay - 50) = 350` nữa. Group thống nhất ở 400.

---

## Breakpoints Đã Kiểm Tra

| Viewport | Kết quả |
|---|---|
| ≤ 480px | Group `bottom: max(16px, safe-area)`, `right: max(12px, safe-area)`, gap 8px; chat btn 52px, scroll-to-top 44px; label ẩn |
| 481px–1439px | Group `bottom: max(24px, safe-area)`, `right: max(24px, safe-area)`, gap 12px; chat btn 56px, scroll-to-top 48px; label hiện |
| ≥ 1440px | Như trên, không thay đổi |

---

## Kết Quả Build

```
npx tsc --noEmit   → pass (không có type error)
npx next build     → pass (build thành công)
```

Warning duy nhất: `Failed to set Next.js data cache for articles — items over 2MB` — không liên quan đến thay đổi này, là pre-existing.

---

## Giới Hạn

Không có third-party widget inject. Tất cả widget (`FloatingChat`, `ScrollToTopButton`) là custom component — can thiệp toàn phần.

---

## Acceptance Criteria — Kết Quả

| Tiêu chí | Đạt |
|---|---|
| Chat/support và scroll-to-top không chồng nhau | ✓ |
| Không dính sát mép màn hình | ✓ |
| Desktop/mobile gọn, hierarchy rõ | ✓ |
| Không che footer, CTA, bottom navigation | ✓ |
| Z-index hợp lý, không nổi trên modal/drawer | ✓ |
| Accessibility: aria-label, focus-visible, tap target ≥ 44px | ✓ |
| Không ảnh hưởng section khác | ✓ |
| Build pass | ✓ |
