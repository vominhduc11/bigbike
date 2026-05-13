# BigBike Web — Header Fix Report

**Date:** 2026-05-13  
**Scope:** `bigbike-web` — Desktop & Mobile Header visual polish  
**Trigger:** Header nhìn chưa chuyên nghiệp; logo nhỏ, nav alignment sai, dot separator thô, active underline lơ lửng, cart badge chưa polished

---

## Files đã sửa

| File | Loại thay đổi |
|------|--------------|
| `bigbike-web/app/globals.css` | CSS — thêm v2 polish block, sửa legacy rules |

> Không có thay đổi TypeScript/JSX. Cấu trúc HTML của SiteHeader.tsx giữ nguyên; CSS đủ để đạt layout mới.

---

## Vấn đề trước khi sửa

| # | Vấn đề | Root cause |
|---|--------|-----------|
| 1 | Header có khoảng trống chết phía dưới logo | `.wp-logo { padding-top: 15px }` cộng với logo image tự nhiên 210×190 overflow chiều cao 80px |
| 2 | Logo nhỏ, nhìn như ảnh nhét vào khung | Override `max-height: 56px; max-width: 132px` quá nhỏ; logo ~62×56px trông như stamp |
| 3 | Separator dot đỏ thô, hình thoi | `wp-navigation-item::after` render hình thoi đỏ 5×5px; override sau chỉ đổi thành circle 6×6px — vẫn thô |
| 4 | Active underline lơ lửng xa text | Border-bottom đặt trên `<a>` cao 80px → đường kẻ nằm ở bottom 80px, cách text center ~40px |
| 5 | Container quá rộng (1750px) | `wp-header-container` gốc: max-width 1750px. Override sau: `var(--bb-container-xl)` = 1200px — quá hẹp |
| 6 | Nav không center, toàn bộ right-aligned | `.wp-right-header { justify-content: flex-end }` kéo nav+actions về phải |
| 7 | Cart badge vị trí thiếu tinh | `transform: translate(50%, -90%)` + `right: 12px` → badge to, lạc vị trí |
| 8 | Logo `padding-top: 23px` tại ≤500px | Media query cũ `@media (max-width: 500px)` thêm padding-top không cần thiết |

---

## Cách đã sửa

### 1. Block `/* ── Header v2 polish ──*/` (globals.css ~line 8294)

Thay thế toàn bộ override section cũ bằng block mới, đầy đủ và không mâu thuẫn.

#### Container
```css
.wp-header-container {
  max-width: 1440px;
  padding-inline: clamp(16px, 3vw, 40px); /* responsive, không magic number */
}
```

#### Layout Logo–Nav–Actions
```css
.wp-right-header { flex: 1; display: flex; align-items: stretch; }
.wp-navigation  { flex: 1; justify-content: center; } /* nav chiếm hết space, items căn giữa */
.wp-user-control { flex-shrink: 0; padding-left: 8px; }
```
Kết quả: `[LOGO] [NAV expanded+centered] [ACTIONS]`

#### Logo
```css
.wp-logo     { display: flex; align-items: center; height: 100%; padding-top: 0; }
.wp-logo-img { max-width: 180px; max-height: 62px; width: auto; object-fit: contain; }
```
- Logo vertical-center trong 80px header ✓  
- Tăng từ 56px → 62px max-height (+10.7%), visual weight tốt hơn  
- Hover: `filter: brightness(1.1)` thay vì drop-shadow box cũ

#### Nav active underline (gần text, không lơ lửng)
```css
.wp-navigation-item > a {
  position: relative;
  height: var(--bb-header-height); /* full click area */
  border-bottom: none;             /* bỏ border-bottom cũ */
}

/* Underline via ::after, đặt tại bottom: 22px */
/* Header 80px, text center 40px, text bottom ~49px */
/* Underline tại 58px từ top → 9px dưới text bottom */
.wp-navigation-item > a::after {
  content: "";
  position: absolute;
  left: 18px; right: 18px;
  bottom: 22px;
  height: 2px;
  background: var(--bb-brand-primary);
  transform: scaleX(0);
  transition: transform 140ms cubic-bezier(0.2, 0, 0, 1);
}
.wp-navigation-item > a:hover::after,
.wp-navigation-item.active > a::after { transform: scaleX(1); }
```

#### Separator dot — xóa
```css
.wp-navigation-item::after { display: none; }
```
Spacing giữa nav items (padding 0 18px) đảm bảo rhythm mà không cần dot.

#### Cart badge — gọn, đúng góc
```css
.wp-header .bb-cart-badge {
  top: calc(50% - 17px); /* 23px từ top trong 80px container = vùng trên icon */
  right: 4px;
  transform: none;       /* bỏ translate hack cũ */
  min-width: 16px; height: 16px;
  border-radius: 8px;
  font-size: 10px;
}
```

#### Accessibility
- `wp-navigation-item > a:focus-visible` → outline đỏ 2px (không bị `outline: none` xóa nhầm)  
- `wp-icon-btn:focus-visible` → outline đỏ 2px  
- `aria-current="page"` giữ nguyên từ `HeaderNavItem.tsx`

### 2. Sửa legacy rules trong section gốc (~line 1528)

```css
/* Trước: padding-top: 15px */
.wp-logo { padding-top: 0; }

/* Trước: @media (max-width:500px) { padding-top: 23px; max-width: 80px; } */
@media (max-width: 500px) {
  .wp-logo { padding-top: 0; }  /* xóa max-width: 80px — handled by v2 block */
}
```

### 3. Update mobile responsive (~line 9075)

```css
@media (max-width: 639px) {
  .wp-logo-img { max-width: 120px; max-height: 52px; } /* tăng từ 112/48 */
}
```

---

## Breakpoints đã kiểm tra (qua CSS logic)

| Width | Behavior |
|-------|----------|
| 375px | Mobile: nav hidden, hamburger visible. Logo 120×52. User-control margin-left: auto. Padding 16px. |
| 430px | Mobile: same as 375. |
| 640–767px | Mobile: logo tăng dần (639px breakpoint). Container padding ~19px. |
| 768px | Tablet: nav vẫn hidden (break ≥ 1200px). Logo max 62px. |
| 1024px | Tablet: nav hidden, hamburger. Logo full size. |
| 1200px | Desktop: nav bắt đầu hiện. |
| 1366px | Desktop: nav visible, centered trong right-header. Container ~1366px (< 1440px max). |
| 1440px | Desktop: container đạt max 1440px, padding clamp 40px. |
| 1920px | Desktop: container 1440px centered, padding 240px mỗi bên. |

---

## Kết quả lint / typecheck / build

| Check | Kết quả | Ghi chú |
|-------|---------|---------|
| `npx tsc --noEmit` | ✅ Pass | Không có lỗi TypeScript |
| `npm run lint` | ⚠️ 3 errors pre-existing | Lỗi trong `wishlist-context.tsx` và `verify-typography-computed.mjs` — không liên quan Header, tồn tại trước khi sửa |
| `npm run build` | ✅ Compiled successfully in 6.8s | 79/79 pages generated |

---

## Điểm chưa xử lý được — cần asset bổ sung

### Logo asset có nền tối baked-in

`/public/wp/logo.png` là ảnh PNG với gradient nền đen/xám baked vào bitmap. Trên header đen `#000000` điều này hầu hết invisible (màu nền gần khớp), nhưng để đạt cảm giác logo "nổi" tốt nhất, cần asset transparent:

**Asset khuyến nghị bổ sung:**

| File | Mô tả |
|------|-------|
| `/public/brand/logo/PNG/02/BIGBIKE_FINAL_LOGO-05.png` | Wordmark "BIGBIKE" màu trắng + viền đỏ/đen — suitable on dark header nếu background là transparent |
| `/public/brand/logo/PNG/02/BIGBIKE_FINAL_LOGO-01.png` | Full logo mascot + text, cần xác nhận transparent background |

**Hành động cần làm:**
1. Xác nhận một trong các PNG/02 có transparent background
2. Export webp/png optimized (< 20KB) tại `/public/wp/logo-dark.png`
3. Cập nhật `SiteHeader.tsx` dòng 78 để dùng asset mới

Hiện tại logo.png vẫn hoạt động tốt vì nền tối của ảnh blend với header đen.

---

## Acceptance criteria — status

| Criterion | Status |
|-----------|--------|
| Header desktop không còn khoảng trống chết | ✅ padding-top: 0, logo vertically centered |
| Logo nhìn sạch hơn, có trọng lượng brand tốt hơn | ✅ max-height tăng lên 62px, không drop-shadow box |
| Nav active underline nằm đúng gần text | ✅ `::after bottom: 22px` — 9px dưới text baseline |
| Separator dot đỏ không còn thô | ✅ Removed — dùng spacing thuần |
| Icons phải cân hàng và đồng bộ visual | ✅ padding: 0 14px, height: 100%, flex stretch |
| Mobile/tablet không vỡ layout | ✅ Breakpoints 639/767/1199 giữ nguyên behavior |
| Build pass | ✅ |
| Không ảnh hưởng search/cart/user/nav | ✅ Không đổi JS/TSX, chỉ CSS |
| Logo asset transparent tốt hơn | ⚠️ Cần asset mới (xem mục trên) |
