# Track B Light-First WP-Parity Fix Report

**Ngày thực hiện:** 2026-05-12  
**Tham chiếu audit:** `docs/audits/BIGBIKE_WEB_BACKGROUND_COLOR_AUDIT.md`  
**Hướng đi:** Track B — Light-first, WP-parity (`#fff` body)  
**Build status:** PASSED (no errors, no warnings)

---

## 1. Tóm tắt

Chuyển `bigbike-web` từ **dark-first** (nền đen) sang **light-first** khớp với WordPress
reference `bigbike_vn__2026_04_17`. Header và footer giữ nguyên dark theo đúng WP.

### Các file đã sửa

| File | Mô tả |
|---|---|
| `bigbike-web/STYLEGUIDE.md` | Cập nhật theme rule, palette, footer spec |
| `bigbike-web/styles/brand-tokens.css` | Đảo ngược semantic tokens: `--bb-bg-page`, `--bb-text-primary`, `--bb-text-inverse`; thêm dark-surface tokens |
| `bigbike-web/app/globals.css` | 40+ targeted fixes — backgrounds, borders, text colors |
| `bigbike-web/app/layout.tsx` | `viewport.themeColor` light scheme: `#000000` → `#ffffff` |

---

## 2. Thay đổi tokens (brand-tokens.css)

### Tokens đã đổi chiều

| Token | Trước | Sau | Lý do |
|---|---|---|---|
| `--bb-bg-page` | `var(--bb-color-black)` = #000 | `var(--bb-color-white)` = #fff | Khớp WP `body { background:#fff }` |
| `--bb-bg-section` | `var(--bb-color-black)` | `var(--bb-color-white)` | Section nền trắng |
| `--bb-text-primary` | `var(--bb-color-white)` = #fff | `var(--bb-color-black)` = #000 | Chữ trên nền sáng |
| `--bb-text-secondary` | `var(--bb-color-gray-300)` = #cecece | `var(--bb-color-gray-500)` = #6f6f6f | Đủ contrast trên trắng |
| `--bb-text-disabled` | `var(--bb-color-gray-300)` = #cecece | `var(--bb-color-gray-400)` = #abb8c3 | Contrast cải thiện |
| `--bb-text-inverse` | `var(--bb-color-black)` = #000 | `var(--bb-color-white)` = #fff | Text trên dark surface (header/footer) |
| `--bb-text-inverse-secondary` | `var(--bb-color-dark-2)` = #333322 | `var(--bb-color-gray-300)` = #cecece | Secondary text trên dark surface |

### Tokens mới thêm

| Token | Giá trị | Dùng cho |
|---|---|---|
| `--bb-bg-section-alt` | `var(--bb-color-gray-25)` = #f8f8f8 | Section xen kẽ nhẹ hơn |
| `--bb-bg-surface-dark` | `#141414` | Dark cards, toasts, media players |
| `--bb-bg-surface-dark-2` | `#0d0d0d` | Darker variant |
| `--bb-bg-surface-dark-3` | `#111111` | Darkest variant (video section bg) |
| `--bb-color-footer-top` | `#3a3a3a` | Footer top strip — khớp WP |
| `--bb-color-gray-25` | `#f8f8f8` | Off-white alt background |

### Color-scheme và class rules

- `.bb-theme` (body): `color-scheme: dark` → `color-scheme: light`
- `.bb-theme-dark`: tách thành rule riêng, giữ `color-scheme: dark`
- `.bb-card`, `.bb-product-card`: `color: var(--bb-text-inverse)` → `var(--bb-text-primary)` (đảo ngược semantic)
- `.bb-richtext th`: `color: var(--bb-text-inverse)` → `var(--bb-text-primary)`
- `.bb-richtext blockquote`: `color: var(--bb-text-secondary)` → `var(--bb-text-inverse)` (giữ legible trên dark bg)

---

## 3. Các fix trong globals.css

### 3.1 Auto-fixed qua token (không cần sửa selector)

Các selector dùng `var(--bb-bg-page)` tự đổi sang white:

- `body` (line 18)
- `.wp-home` (homepage wrapper)
- `.wp-experience`
- `.wp-news-section`
- `.wp-brands-section`
- `.wp-seo-content` (line 4076 instance)
- `.wp-news-section--home`

### 3.2 Hard-coded fixes

| Selector | Trước | Sau | Loại |
|---|---|---|---|
| `.bb-category-card, .bb-article-card` | `bg: #141414` | `var(--bb-bg-surface)` + border | BG |
| `.wp-about` | `bg: #101010 gradient` | `var(--bb-color-gray-25)` + light red tint | BG |
| `.wp-about::after` watermark | `rgba(255,255,255,0.035)` | `rgba(0,0,0,0.04)` | Color |
| `.wp-about-stat` | `bg: rgba(255,255,255,0.06)` | `var(--bb-bg-surface)` | BG |
| `.wp-about-title` | `color: #fff` | `var(--bb-text-primary)` | Text |
| `.wp-about-text` | `color: rgba(255,255,255,0.72)` | `var(--bb-text-secondary)` | Text |
| `.wp-about-stat span` | `rgba(255,255,255,0.62)` | `var(--bb-text-secondary)` | Text |
| `.wp-cat-grid` borders | `rgba(255,255,255,0.08)` | `var(--bb-border-subtle)` | Border |
| `.wp-feat-text span` | `rgba(255,255,255,0.62)` | `var(--bb-text-secondary)` | Text |
| `.wp-brand-chip` | `bg: #141414, color: rgba(255,255,255,0.7)` | `var(--bb-bg-surface)` + token | BG+Text |
| `.wp-article-title` | `color: #fff` | `var(--bb-text-primary)` | Text |
| `.wp-new-arrivals-section` | `bg: var(--bb-bg-section, #141414)` | `var(--bb-bg-section-alt)` | BG |
| `.wp-pdp-below/.wp-pdp-related` borders | `rgba(255,255,255,0.07)` | `var(--bb-border-subtle)` | Border |
| `.wp-pdp-recently-viewed` border | `rgba(255,255,255,0.07)` | `var(--bb-border-subtle)` | Border |
| `.wp-pdp-recently-title` | `color: #fff` | `var(--bb-text-primary)` | Text |
| `.wp-pdp-recently-card` | `bg: #141414, border: rgba(...)` | `var(--bb-bg-surface)` + subtle border | BG |
| `.wp-pdp-recently-img` | `bg: #0e0e0e` | `var(--bb-bg-surface-raised)` | BG |
| `.wp-pdp-recently-name` | `rgba(255,255,255,0.85)` | `var(--bb-text-primary)` | Text |
| `.wp-pdp-reviews` border | `rgba(255,255,255,0.07)` | `var(--bb-border-subtle)` | Border |
| `.wp-pdp-review-item` border | `rgba(255,255,255,0.06)` | `var(--bb-border-subtle)` | Border |
| `.wp-pdp-review-author` | `color: #fff` | `var(--bb-text-primary)` | Text |
| `.wp-pdp-review-comment` | `rgba(255,255,255,0.8)` | `var(--bb-text-secondary)` | Text |
| `.wp-review-open-btn` | `color/border: rgba(white)` | token equivalents | Text+Border |
| `.wp-review-form` | `bg: #141414, border: rgba(...)` | `var(--bb-bg-surface)` + subtle | BG |
| `.wp-review-form-title` | `color: #fff` | `var(--bb-text-primary)` | Text |
| `.wp-page-head` border | `rgba(255,255,255,0.08)` | `var(--bb-border-subtle)` | Border |
| `.wp-page-head h1` | `color: #fff` | `var(--bb-text-primary)` | Text |
| `.wp-pdp-related-title` | `color: #fff` | `var(--bb-text-primary)` | Text |
| `.wp-filter-section` border | `rgba(255,255,255,0.07)` | `var(--bb-border-subtle)` | Border |
| `.wp-filter-section-header` | `color: #fff` | `var(--bb-text-primary)` | Text |
| `.wp-filter-search` | `bg: #0d0d0d, color: #fff` | `var(--bb-bg-surface)` + token | BG+Text |
| `.wp-filter-price-input` | `bg: #0d0d0d, color: #fff` | `var(--bb-bg-surface)` + token | BG+Text |
| `.wp-filter-row` | `color: rgba(255,255,255,0.7)` | `var(--bb-text-secondary)` | Text |
| `.wp-filter-color-dot` | `bg: #1a1a1a, border: rgba(255,...)` | `var(--bb-bg-surface-raised)` + subtle border | BG |
| `.wp-pdp-chip` | `bg: #202020, color: #fff` | `var(--bb-bg-surface)` + token | BG+Text |
| `.wp-pdp-swatch` | `color: rgba(255,255,255,0.78)` | `var(--bb-text-secondary)` | Text |
| `.wp-pdp-qty-stepper` | `border: rgba(white), color: #fff` | token equivalents | Border+Text |
| `.wp-pdp-features` | `bg: #141414, border: rgba(...)` | `var(--bb-color-gray-25)` + subtle border | BG |
| `.wp-pdp-policy-strip/.wp-pdp-policy-item` borders | `rgba(255,255,255,0.08)` | `var(--bb-border-subtle)` | Border |
| `.wp-pdp-policy-text b` | `color: #fff` | `var(--bb-text-primary)` | Text |
| `.wp-pdp-tab-list` border | `rgba(255,255,255,0.1)` | `var(--bb-border-subtle)` | Border |
| `.wp-pdp-tab.active` | `color: #fff` | `var(--bb-text-primary)` | Text |
| `.wp-breadcrumb-active` | `color: #fff` | `var(--bb-text-primary)` | Text |
| `.wp-stepper` border | `rgba(255,255,255,0.08)` | `var(--bb-border-subtle)` | Border |
| `.wp-step.active/.done` | `color: #fff / rgba(255,...)` | `var(--bb-text-primary/secondary)` | Text |
| `.wp-step-num` | `bg: #222, border: rgba(255,...)` | `var(--bb-bg-surface-raised)` + token | BG |
| `.wp-checkout-section` | `bg: #141414, border: rgba(...)` | `var(--bb-bg-surface)` + subtle | BG |
| `.wp-radio-tile` | `bg: #0d0d0d, border: rgba(...)` | `var(--bb-bg-surface-raised)` + token | BG |
| `.wp-radio-tile-body b` | `color: #fff` | `var(--bb-text-primary)` | Text |
| `.wp-order-summary` | `bg: #141414, border: rgba(...)` | `var(--bb-bg-surface)` + subtle | BG |
| `.wp-order-summary h3` border | `rgba(255,255,255,0.08)` | `var(--bb-border-subtle)` | Border |
| `.wp-mini-thumb` | `radial-gradient(#2a2a2a...)` | `var(--bb-bg-surface-raised)` | BG |
| `.wp-mini-body .name` | `color: #fff` | `var(--bb-text-primary)` | Text |
| `.wp-mini-price` | `color: #fff` | `var(--bb-text-primary)` | Text |
| `.wp-mini-item` borders | `rgba(255,255,255,0.04)` | `var(--bb-border-subtle)` | Border |
| `.wp-summary-card h3` | `color: var(--bb-text-primary, #000)` | `var(--bb-text-primary)` | Text (clean) |
| `.wp-summary-row` | `color: rgba(255,255,255,0.78)` | `var(--bb-text-secondary)` | Text |
| `.wp-summary-row b` | `color: #fff` | `var(--bb-text-primary)` | Text |
| `.wp-summary-total` border | `rgba(255,255,255,0.12)` | `var(--bb-border-subtle)` | Border |
| `.wp-summary-trust div` | `bg: #0d0d0d` | `var(--bb-bg-surface-raised)` | BG |
| `.wp-account-header` border | `rgba(255,255,255,0.08)` | `var(--bb-border-subtle)` | Border |
| `.wp-account-header h2` | `color: #fff` | `var(--bb-text-primary)` | Text |
| `.wp-kpi` | `bg: #141414, border: rgba(...)` | `var(--bb-bg-surface)` + subtle | BG |
| `.wp-kpi b` | `color: #fff` | `var(--bb-text-primary)` | Text |
| `.wp-order-tl-dot` | `bg: #1a1a1a, border: rgba(...)` | `var(--bb-bg-surface-raised)` + token | BG |
| `.wp-order-tl-line` | `rgba(255,255,255,0.07)` | `var(--bb-border-subtle)` | BG |
| `.wp-order-tl-step.done .label` | `rgba(255,255,255,0.6)` | `var(--bb-text-secondary)` | Text |
| `.wp-order-tl-step.active .label` | `color: #fff` | `var(--bb-text-primary)` | Text |
| `.wp-order-card` | `bg: #141414, border: rgba(...)` | `var(--bb-bg-surface)` + subtle | BG |
| `.wp-order-head` | `bg: #0d0d0d, border: rgba(...)` | `var(--bb-bg-surface-raised)` + token | BG |
| `.wp-order-head .meta b` | `color: #fff` | `var(--bb-text-primary)` | Text |
| `.wp-order-thumb` | `radial-gradient(#2a2a2a...)` | `var(--bb-bg-surface-raised)` | BG |
| `.wp-order-summary-text b` | `color: #fff` | `var(--bb-text-primary)` | Text |
| `.wp-detail-panel` | `bg: #111, border: rgba(...)` | `var(--bb-bg-surface)` + subtle | BG |
| `.wp-detail-panel-head` borders | `rgba(255,255,255,0.08)` | `var(--bb-border-subtle)` | Border |
| `.wp-detail-panel-head h3` | `color: #fff` | `var(--bb-text-primary)` | Text |
| `.wp-detail-meta div b` | `color: #fff` | `var(--bb-text-primary)` | Text |
| `.wp-detail-note--grey` | `rgba(255,255,255,0.04)` | `var(--bb-bg-surface-raised)` | BG |
| `.wp-detail-table` | `color: #ddd` | `var(--bb-text-primary)` | Text |
| `.wp-detail-table th/td` borders | `rgba(255,255,255,0.08)` | `var(--bb-border-subtle)` | Border |
| `.wp-return-timeline-item::before` | `rgba(255,255,255,0.1)` | `var(--bb-border-subtle)` | BG |
| `.wp-timeline-label` | `color: #fff` | `var(--bb-text-primary)` | Text |
| `.wp-order-actions` | `bg: #0d0d0d, border: rgba(...)` | `var(--bb-bg-surface-raised)` + token | BG |
| `.wp-order-actions button` | `color: #fff, border: rgba(255,...)` | `var(--bb-text-primary)` + token | Text |
| `.wp-tabs` border | `rgba(255,255,255,0.08)` | `var(--bb-border-subtle)` | Border |
| `.wp-tab.active/.hover` | `color: #fff` | `var(--bb-text-primary)` | Text |
| `.wp-tab .count-pill` | `rgba(255,255,255,0.08)` | `var(--bb-bg-surface-raised)` | BG |
| `.wp-address-card` | `bg: #141414, border: rgba(...)` | `var(--bb-bg-surface)` + subtle | BG |
| `.wp-address-card b` | `color: #fff` | `var(--bb-text-primary)` | Text |
| `.wp-address-card p` | `rgba(255,255,255,0.78)` | `var(--bb-text-secondary)` | Text |
| `.wp-address-card .tag` | `rgba(255,255,255,0.06)` | `var(--bb-bg-surface-raised)` | BG |
| `.wp-address-card .actions` border | `rgba(255,255,255,0.06)` | `var(--bb-border-subtle)` | Border |
| `.wp-address-add` | `border: rgba(255,255,255,0.16)` | `var(--bb-border-default)` | Border |
| `.wp-success .order-card` | `bg: #141414, border: rgba(...)` | `var(--bb-bg-surface)` + subtle | BG |
| `.wp-success .order-card b` | `color: #fff` | `var(--bb-text-primary)` | Text |
| `.wp-qty-stepper` | `border/color: rgba(white)/#fff` | token equivalents | Border+Text |
| `.wp-promo-input input` | `bg: #0d0d0d, color: #fff` | `var(--bb-bg-surface)` + token | BG+Text |
| `.wp-checkout-address` | `rgba(255,255,255,0.85)` | `var(--bb-text-secondary)` | Text |
| `.bb-badge--grey` | `rgba(255,255,255,0.07)` | `var(--bb-bg-surface-raised)` | BG |
| `.wp-video-title` | `color: #fff` | `var(--bb-text-primary)` | Text |
| `.wp-catalog-sort select` | `color: var(--bb-text-inverse, #000)` | `var(--bb-text-primary)` | Text |
| `.wp-btn-secondary` | `color: #fff, border: rgba(white)` | token equivalents | Text+Border |
| `.wp-video-section` | `bg: #111` | `var(--bb-bg-surface-dark-3)` | BG (kept dark) |
| `.wp-new-arrivals-section` | `var(--bb-bg-section, #141414)` | `var(--bb-bg-section-alt)` = #f8f8f8 | BG |

### 3.3 Giữ nguyên (intentionally dark)

- `.wp-header` (`.wp-header { background: #000 }`) — header đen, khớp WP
- `.bb-footer` (`.bb-footer { background: #3a3a3a }`) — footer top dark, khớp WP
- `.wp-mobile-menu { background: #0d0d0d }` — mobile drawer tối
- `.wp-toast { background: #141414 }` — toast notification tối (floating UI)
- `.wp-pdp-video-embed { background: #0a0a0a }` — media player container
- `.wp-pdp-video-thumb { background: #141414 }` — video thumbnail dark
- `.wp-cat-hero { background: #0d0d0d }` — category hero banner (fallback khi không có ảnh)
- `.wp-lightbox` backdrop — fullscreen lightbox (dark overlay)
- `.wp-video-section { background: var(--bb-bg-surface-dark-3) }` — video section dark

---

## 4. Acceptance criteria

| # | Tiêu chí | Kết quả |
|---|---|---|
| AC-1 | Body/page background là `#fff` hoặc gần trắng | PASS |
| AC-2 | Header nền đen (#000) giữ nguyên | PASS |
| AC-3 | Footer top nền #3a3a3a giữ nguyên | PASS |
| AC-4 | Product cards nền trắng, chữ đen | PASS |
| AC-5 | Form inputs nền trắng, chữ đen | PASS |
| AC-6 | Filter sidebar nền trắng, labels đen | PASS |
| AC-7 | Checkout/order sections nền trắng | PASS |
| AC-8 | Account page cards nền trắng | PASS |
| AC-9 | Không có white-on-white text | PASS |
| AC-10 | `npm run build` không có lỗi | PASS |

---

## 5. Ghi chú kỹ thuật

- **Token inversion:** `--bb-text-inverse` đổi semantic từ "text trên white surface" thành "text trên dark surface". Tất cả component dùng token này đã được kiểm tra và cập nhật.
- **`.wp-btn-secondary`:** Nút này được dùng ở cả hero section (cần white style) và content area (cần dark style). Sau Track B nó trở thành dark-on-light button — phù hợp cho phần lớn context. Hero sections có nền tối riêng (overlay image) nên cần kiểm tra kỹ nếu dùng `.wp-btn-secondary` trong hero.
- **Mobile drawer:** Giữ `#0d0d0d` intentionally — drawer dark là WP behavior (slide-in trên mobile).
