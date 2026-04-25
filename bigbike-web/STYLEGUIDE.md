# BigBike — Hướng dẫn giao diện & thương hiệu

> Tài liệu này rút gọn từ `Bigbike Design System/README.md` và `SKILL.md`. Mọi quyết định giao diện đều phải tuân thủ các nguyên tắc dưới đây.

---

## Nguyên tắc bất biến (non-negotiables)

| Nguyên tắc | Áp dụng |
|---|---|
| Tiếng Việt đầy đủ dấu | Mọi copy trên UI. Chỉ slogan và label tiện ích mới dùng Latin |
| Đỏ racing `#F90606` là màu accent duy nhất | Không dùng màu accent thứ hai. Các màu warning/info/success chỉ dùng cho badge |
| Display dùng **Bungee**, body dùng **Exo** | Không dùng Google Fonts, không dùng font thay thế |
| Không emoji bao giờ | Dùng typography, màu đỏ, icon SVG để truyền cảm xúc |
| Dark-first | Toàn site chạy `bb-theme-dark`. Nền trang là `#0a0a0a` |
| Card hover: viền đỏ + lift, KHÔNG scale | `transform: translateY(-2px)` + `border-color → red`. Không `scale()` |

---

## Palette màu

### Accent chính
```css
--bb-brand-primary: #F90606          /* Racing red — CTA, giá, kicker, nav hover */
--bb-brand-primary-hover: #d90404    /* Button hover */
--bb-brand-primary-active: #b80303   /* Button press */
```

### Dark surfaces (thứ tự từ tối đến sáng)
```css
--bb-bg-page:           #0a0a0a   /* Nền trang */
--bb-bg-surface:        #141414   /* Card, panel */
--bb-bg-surface-raised: #202020   /* Input, nâng lên */
--bb-bg-surface-hover:  #292929   /* Hover state */
```

### Gray scale
`#f7f7f8` (50) → ... → `#171717` (900)

### Màu trạng thái (chỉ dùng badge, KHÔNG dùng làm accent)
- Success: `#62bb46`
- Warning: `#f99d1c`
- Info (floating chat): `#20c4f4`
- Danger = brand red

---

## Typography

### Font loading
- Fonts nằm trong `public/fonts/*.ttf`, load qua `next/font/local` trong `app/layout.tsx`
- Biến CSS: `--font-bungee`, `--font-exo`

### Quy tắc casing
| Vị trí | Casing |
|---|---|
| Display / hero title / section heading / nav / CTA | **ALL CAPS** |
| Kicker (nhãn nhỏ trên heading) | **ALL CAPS + letter-spacing rộng** |
| Body text / mô tả sản phẩm / bài viết | Sentence case |
| Tên sản phẩm trên card | ALL CAPS (qua CSS `text-transform`) |
| Brand name | **BigBike** hoặc **BIGBIKE** (không "Big Bike") |

### Typography classes (từ `styles/brand-tokens.css`)
```css
.bb-h1            /* Bungee 4xl, tight, uppercase — tiêu đề trang */
.bb-h2            /* Bungee 3xl, heading, uppercase — section heading */
.bb-h3            /* Bungee 2xl, heading, uppercase — sub-heading */
.bb-heading-racing /* Bungee xl, tight, uppercase — racing title nhỏ */
.bb-display       /* Bungee, tight, display letter-spacing, uppercase */
.bb-heading       /* Bungee, heading line-height */
.bb-body          /* Exo 400, body line-height */
.bb-kicker        /* Exo bold xs, ALL CAPS, red, wide tracking */
.bb-meta          /* Exo 400 xs, muted — ngày tháng, tag phụ */
.bb-text-muted    /* color: muted */
.bb-text-brand    /* color: red */
```

### Ký tự đặc biệt
- Rating: `★★★★★` (U+2605 Unicode) — **không** dùng SVG
- Phân cách nav: `•` màu đỏ
- Giá tiền: `formatVnd(2590000)` → `2.590.000 ₫` (period thousands, ₫ trailing)

---

## Spacing

Thang 4px base: `--bb-space-1` (4px) → `--bb-space-32` (128px)

```css
/* Ví dụ hay dùng */
--bb-space-2:  8px   /* gap icon-text */
--bb-space-4:  16px  /* padding nhỏ */
--bb-space-6:  24px  /* gap card */
--bb-space-10: 40px  /* section padding */
--bb-space-20: 80px  /* section spacing lớn */
```

Container: max `1440px`, padding 16/24/32px (mobile/tablet/desktop)

---

## Border radius

| Context | Giá trị |
|---|---|
| Button, input | `sm = 4px` |
| Card | `md = 8px` |
| Variant chip, badge | `pill = 999px` |
| **Không dùng** `xl = 16px` trên UI chính | Trông quá "consumer-soft" |

---

## Shadows

```css
--bb-shadow-sm: 0 2px 8px rgba(0,0,0,0.24)    /* card rest */
--bb-shadow-md: 0 8px 24px rgba(0,0,0,0.32)   /* card hover */
--bb-shadow-lg: 0 18px 48px rgba(0,0,0,0.42)  /* modal */
--bb-shadow-brand: 0 12px 30px rgba(249,6,6,0.22)  /* primary button */
```

---

## Animation

| Tên | Duration | Dùng khi |
|---|---|---|
| instant | 80ms | Ripple, immediate feedback |
| fast | 140ms | Hover, focus |
| normal | 220ms | Card lift, slide |
| slow | 360ms | Modal open, drawer |

Easing chuẩn: `cubic-bezier(0.2,0,0,1)`. Luôn honor `prefers-reduced-motion`.

---

## Layout signatures (KHÔNG được đơn giản hóa)

### 1. Sticky header 72px + trapezoid logo panel
```css
/* Logo panel bên trái dùng clip-path */
clip-path: polygon(0 0, 100% 0, calc(100% - 28px) 100%, 0 100%);
```
Header có `backdrop-filter: blur(8px)` — là nơi DUY NHẤT dùng blur.

### 2. Hero radial halo
```css
background:
  radial-gradient(circle at 88% 22%, rgba(249,6,6,0.22), transparent 28%),
  radial-gradient(circle at 20%  0%, rgba(255,255,255,0.12), transparent 42%),
  linear-gradient(145deg, #0d0d0d 0%, #171717 48%, #1f1f1f 100%);
```
Hero overlay image: `90deg rgba(10,10,10,0.96) → 0.32`

### 3. Product card hover
```css
border-color: var(--bb-border-brand);  /* đỏ */
transform: translateY(-2px);
box-shadow: var(--bb-shadow-md);
/* Black bar "THÊM VÀO GIỎ HÀNG" slide lên từ dưới */
```

### 4. Promo banner
```css
background: linear-gradient(135deg, #c00, #8b0000);
/* Watermark "BIGBIKE" opacity thấp */
```

### 5. Article image filter (red wash)
```css
filter: saturate(1.4) brightness(0.72);
/* Overlay: rgba(160,0,0,0.35) */
```

### 6. Floating chat
- Color: `#20c4f4` (màu này ĐƯỢC PHÉP vì đây là chat bubble)
- 52px tròn, bottom-right
- Zalo hoặc tel: link

---

## Bộ icon

- **48 icon proprietary** trong `public/brand/icons/bigbike-icon-01.svg` → `48.svg`
  - Dạng: white glyph trên red tile, không recolor
  - Dùng cho: category card, feature block
- **Inline Lucide-style** cho UI chrome (search, cart, hamburger, arrow)
  - 20×20 hoặc 24×24, `stroke-width="2"`, `stroke="currentColor"`, `stroke-linecap="round"`
- **Không** import icon library ngoài
- **Không** icon fonts

---

## Logo & favicon

| Asset | Đường dẫn | Dùng khi |
|---|---|---|
| Logo chính (mascot + wordmark) | `public/brand/logo-primary.png` | Dark background |
| Logo mono trắng | `public/brand/logo-mono-white.png` | Background đã có màu đỏ |
| Wordmark ngang | `public/brand/logo-wordmark.png` | Header/footer slot hẹp |
| Slogan | `public/brand/slogan.png` | Hero frame, signage |
| Favicon mặc định | `public/brand/favicon/SVG/BIGBIKE_FAVICON-01.svg` | H-block đỏ |

---

## Copy (giọng văn)

**Xưng hô:** "bạn" với khách hàng, "anh em biker" để tạo cảm giác cộng đồng. Không "quý khách".

**Ví dụ thực tế từ production:**
- Kicker: `SẢN PHẨM NỔI BẬT`
- Hero title: `SẢN PHẨM NỔI BẬT TẠI BIGBIKE`
- About: `Bigbike tự hào là một trong những shop chuyên bán đồ phượt, đồ bảo hộ moto đáng tin cậy tại TP HCM…`
- CTA: `MUA NGAY`, `THÊM VÀO GIỎ HÀNG`, `XEM TẤT CẢ →`
- Promo: `HOT OFFER · LS2 DUAL SPORT MX436 PIONEER · 20% OFF`
- Stock labels: `Còn hàng` / `Sắp hết hàng` / `Hết hàng` / `Đặt trước` / `Liên hệ tồn kho`

---

## Cách dùng CSS token (ví dụ)

```tsx
// Nút primary
<button className="bb-button bb-button-primary">MUA NGAY</button>

// Kicker + heading
<p className="bb-kicker">SẢN PHẨM NỔI BẬT</p>
<h2 className="bb-h2">MŨ BẢO HIỂM CHÍNH HÃNG</h2>

// Giá
<span className="bb-price">{formatVnd(2590000)}</span>
<span className="bb-price-compare">{formatVnd(2990000)}</span>

// Card với hover
<div className="bb-product-card bb-card-hover">...</div>

// Meta
<span className="bb-meta">15 tháng 4, 2026 · Tin tức</span>

// CSS thuần
background: var(--bb-bg-surface);
color: var(--bb-text-primary);
border: 1px solid var(--bb-border-default);
border-radius: var(--bb-radius-card);
```

---

## Tỷ lệ ảnh

| Loại | Tỷ lệ |
|---|---|
| Hero slider | 16:5.5 |
| Product tile | 1:1 |
| Article card | 16:9 |
| Experience block | 4:3 |
