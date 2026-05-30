# BIGBIKE-WEB — Typography System

Tài liệu chuẩn (source of truth) cho typography của `bigbike-web`. Đây là bản đã **áp dụng vào repo** (Tailwind v4 `@theme inline`, token `--bb-font-*` + `--fs-*`), hợp nhất từ tài liệu thiết kế gốc `BIGBIKE_TYPOGRAPHY`.

Root = 16px. Toàn bộ size dùng `rem` + `clamp()`.

---

## 1. Bộ phông chữ — một superfamily, hai vai trò

Dùng họ **Barlow** xuyên suốt để nhất quán DNA chữ. **Không dùng Oswald** (đã gỡ bỏ — trước đây trùng vai trò với Barlow Condensed).

| Vai trò | Phông | Nguồn | Đặc tính |
|---|---|---|---|
| Display / Heading / Nav / Button / Label | **Barlow Condensed** | next/font/google | Condensed grotesque, thể thao — dùng kèm `UPPERCASE` |
| Body / Nội dung / UI text | **Barlow** | next/font/google | Grotesque trung tính, dễ đọc |
| Icon | icomoon | self-host | Giữ nguyên |

Cả hai đều có subset `vietnamese` → hỗ trợ đầy đủ dấu thanh.

---

## 2. Cài đặt — `app/fonts.ts`

`next/font` tự self-host (không gọi runtime Google), preload, sinh fallback metric-adjusted chống CLS. Barlow / Barlow Condensed là font tĩnh → bắt buộc khai báo `weight`.

Weight thực nạp (đúng nhu cầu, không dư):

- **Barlow**: `400` body · `500` medium · `600` strong/semibold · `700` bold.
- **Barlow Condensed**: `500` footer slogan · `600` heading/nav/CTA · `700` h1/h2/display.

```ts
// app/fonts.ts
import { Barlow, Barlow_Condensed } from "next/font/google";

export const barlow = Barlow({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-barlow",
});

export const barlowCondensed = Barlow_Condensed({
  subsets: ["latin", "vietnamese"],
  weight: ["500", "600", "700"],
  display: "swap",
  variable: "--font-barlow-condensed",
});
```

Gắn biến vào `<html>` trong `app/layout.tsx`:

```tsx
<html lang={locale} className={`${barlow.variable} ${barlowCondensed.variable} …`}>
```

`lang="vi"` để trình duyệt ngắt dòng đúng tiếng Việt.

---

## 3. Token (CSS variables)

### Font family — `styles/brand-tokens.css`

```css
--bb-font-display: var(--font-barlow-condensed), "Barlow Condensed", "Arial Narrow", sans-serif;
--bb-font-heading: var(--font-barlow-condensed), "Barlow Condensed", "Arial Narrow", sans-serif;
--bb-font-cta:     var(--font-barlow-condensed), "Barlow Condensed", "Barlow", sans-serif;
--bb-font-nav:     var(--font-barlow-condensed), "Barlow Condensed", "Barlow", sans-serif;
--bb-font-body:    var(--font-barlow), "Barlow", "Segoe UI", -apple-system, BlinkMacSystemFont, sans-serif;
--bb-font-link:    var(--font-barlow), "Barlow", "Segoe UI", -apple-system, BlinkMacSystemFont, sans-serif;
```

### Size — fluid clamp (`--fs-*`), `styles/brand-tokens.css`

**Một token = một `clamp()`**, khai báo một lần. Content/UI chốt trần ~1440px; Display/Heading scale tới 2560px.

```css
--fs-overline:   clamp(0.75rem, 0.728rem + 0.094vw, 0.8125rem);
--fs-caption:    clamp(0.875rem, 0.853rem + 0.094vw, 0.9375rem);
--fs-button:     clamp(0.9375rem, 0.916rem + 0.094vw, 1rem);
--fs-body:       clamp(1rem, 0.956rem + 0.188vw, 1.125rem);
--fs-body-lg:    clamp(1.125rem, 1.081rem + 0.188vw, 1.25rem);
--fs-h4:         clamp(1.125rem, 1.061rem + 0.275vw, 1.5rem);
--fs-h3:         clamp(1.25rem, 1.143rem + 0.458vw, 1.875rem);
--fs-h2:         clamp(1.5rem, 1.328rem + 0.732vw, 2.5rem);
--fs-h1:         clamp(1.875rem, 1.596rem + 1.19vw, 3.5rem);
--fs-display:    clamp(2.5rem, 1.985rem + 2.197vw, 5.5rem);
--fs-display-xl: clamp(3rem, 2.313rem + 2.93vw, 7rem);
```

`body` dùng `var(--fs-body)` (rem-based, **không** hardcode 16px). Sàn `1rem` đảm bảo form input ≥16px → không bị iOS auto-zoom khi focus.

---

## 4. Tailwind utilities (Tailwind v4 — `app/globals.css` `@theme inline`)

Dự án dùng Tailwind v4: token expose qua `@theme inline`, **không** có `tailwind.config.ts`.

```css
@theme inline {
  --font-display: var(--font-barlow-condensed);   /* font-display = Barlow Condensed */
  --font-body:    var(--bb-font-body);

  /* fluid scale → text-display, text-h4, text-body, text-button, text-caption, text-overline… */
  --text-display-xl: var(--fs-display-xl);
  --text-display:    var(--fs-display);
  --text-h4:         var(--fs-h4);
  --text-body-lg:    var(--fs-body-lg);
  --text-body:       var(--fs-body);
  --text-button:     var(--fs-button);
  --text-caption:    var(--fs-caption);
  --text-overline:   var(--fs-overline);
}
```

Dùng: `text-display`, `text-h1`…`text-h4`, `text-body`, `text-button`, `text-caption`, `text-overline`. Weight áp qua utility: `font-bold` (700) / `font-semibold` (600).

---

## 5. Bảng Type Scale (lõi)

| Token | @375 | Trần | LH | Letter-spacing | Family | Weight | Transform | Dùng cho |
|---|---:|---:|---|---|---|---|---|---|
| `display-xl` | 48 | 112 | 1.0 | -0.02em | Condensed | 700 | UPPER | Mega hero / showroom |
| `display` | 40 | 88 | 1.05 | -0.015em | Condensed | 700 | UPPER | Hero sản phẩm, section lớn |
| `h1` | 30 | 56 | 1.1 | -0.01em | Condensed | 700 | UPPER | Tiêu đề trang |
| `h2` | 24 | 40 | 1.15 | — | Condensed | 700 | UPPER | Tiêu đề section |
| `h3` | 20 | 30 | 1.2 | — | Condensed | 600 | UPPER | Tên sản phẩm, card title |
| `h4` | 18 | 24 | 1.25 | — | Condensed | 600 | UPPER | Sub-heading |
| `body-lg` | 18 | 20 | 1.6 | — | Barlow | 400 | none | Lead, mô tả nổi bật |
| `body` | 16 | 18 | 1.6 | — | Barlow | 400 | none | Văn bản chính, **form input** |
| `button` | 15 | 16 | 1.2 | 0.01em | Condensed | 600 | UPPER | Nút, CTA |
| `caption` | 14 | 15 | 1.4 | — | Barlow | 400 | none | Chú thích, meta, giá phụ |
| `overline` | 12 | 13 | 1.4 | 0.06em | Condensed | 600 | UPPER | Badge, eyebrow, label nhỏ |

---

## 6. Quy tắc bắt buộc

- **Form input dùng `body` (≥16px)** — tránh iOS auto-zoom.
- **`rem`-only cho type** (WCAG). Không hardcode `px`, kể cả `body`.
- **Một token = một `clamp()`.** Không override font-size theo breakpoint cho cùng element. `clamp` phải là `rem + vw`, không `vw` thuần.
- Heading / nav / nút / eyebrow → **Barlow Condensed** + `UPPERCASE`.
- Nội dung đọc → **Barlow**, chữ thường, line-height ≥ 1.5.
- Không dùng đồng thời Oswald (đã gỡ).

---

## 7. Tiếng Việt (UPPERCASE heading)

Heading `UPPERCASE` + Condensed + line-height thấp (1.0–1.2): dấu trên chữ hoa (Ặ, Ẫ, Ự, Ỹ, Ằ) dễ bị clip mép trên. Khi gặp: nới line-height nhẹ hoặc thêm `padding-top` nhỏ — không giảm dưới ngưỡng vỡ nhịp dọc. Giữ `lang="vi"`.

---

## 8. Trạng thái migration (transitional)

Đã áp dụng:

- ✅ Gỡ Oswald khỏi toàn bộ code active; heading dùng Barlow Condensed.
- ✅ `app/fonts.ts` + chỉ 2 biến font vào `<html>`.
- ✅ Bộ token `--fs-*` + Tailwind `text-*` fluid.
- ✅ `body` → `var(--fs-body)` fluid.
- ✅ Heading token (`--bb-text-h1/h2/hero/section-title/footer-slogan`) → single `clamp()`, xoá override @media.
- ✅ Numeric token `--bb-text-22/26/32/40/50` → single `clamp()` (xoá nốt override @media).
- ✅ **Hết `vw` thuần ở giữa `clamp()`** (mục 6): toàn bộ heading/title đọc được (page-head, news/cat hero, PDP title, promo, auth, richtext, footer hotline, homepage section/video/experience title, article card, recently-viewed…) → token `--fs-*`.

Ngoại lệ cố ý giữ `vw` thuần — **chữ trang trí** (không phải text đọc, `pointer-events:none`/`select-none`, opacity ~0.06–0.07, cỡ 128–220px): `.bb-promo-bg-text` (globals.css), watermark trong `PageHero.tsx`, số "404" mờ nền trong `not-found.tsx`.

### Quy tắc khi migrate px cố định (đang làm dần)

**CHỈ chuyển sang token loại text này** (đổi size nhẹ, fluid, zoom-safe):
- Body/đoạn văn đọc 16px → `--fs-body`; caption/meta phụ (muted/secondary, **không** uppercase) 13–14px → `--fs-caption`; heading → `--fs-h1…h4`.

**GIỮ NGUYÊN px** (token sẽ méo size hoặc sai vai trò):
- Nhãn / kicker / badge / button / CTA **UPPERCASE** (có `letter-spacing` + `text-transform: uppercase`) — token button(15→16)/overline(12→13) lệch size, hoặc đây là nhãn cố định cố ý.
- Badge/label **≤ 11px** — không có token dưới 12px; map sẽ phóng to.
- Breadcrumb, số (rating/giá), avatar initials, size phục vụ layout/icon.

Đã rà toàn bộ `globals.css` (248 → ~206 khai báo px), chuyển ~42 chỗ text đọc:
- **caption** (`--fs-caption`): review meta, entity-desc, page-head .sub, cat-seo-prose, catalog-count, news-excerpt, search result/empty/suggestion, info-desc, mobile account/contact, error message, figcaption, FAQ answer, woocommerce-info, product desc, block-title paragraph.
- **body** (`--fs-body`): seo-content p/ul, blog body text, no-results, hero subtitle, wp-tabs content, about paragraph, content-bottom prose, article-detail body.
- **heading** (`--fs-h1…h4`): seo-content + content-bottom h1–h6, checkout section title, related-products title, và **tiêu đề product/category/slide** (product-name, fp-title, archive-product-title, home-category-title, category item-title, videos-slide desc, exp-slide-title).

Còn lại (~195 px) **GIỮ NGUYÊN có chủ đích**: nhãn/kicker/badge/button/CTA uppercase, giá, rating, breadcrumb, input, icon, số, avatar initials, related-product title (compact 14px), và override px theo breakpoint. Size px trong `home-news-parity.css` giữ theo WP-parity.

---

*Source of truth typography cho bigbike-web. Anchor: 375px (sàn) · 1440px (trần content) · 2560px (trần display). Root 16px.*
