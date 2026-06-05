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

**Một token = một `clamp()`**, khai báo một lần. Anchor 375px (sàn) → 2560px (trần): Content/UI **scale tới 2560px** (trước đây chốt ~1440px khiến body/caption quá nhỏ trên màn 3xl/4xl showroom); Display/Heading cũng tới 2560px.

```css
--fs-overline:   clamp(0.75rem, 0.729rem + 0.092vw, 0.875rem);     /* 12→14 */
--fs-caption:    clamp(0.875rem, 0.843rem + 0.137vw, 1.0625rem);   /* 14→17 */
--fs-button:     clamp(0.9375rem, 0.905rem + 0.137vw, 1.125rem);   /* 15→18 */
--bb-text-nav:   clamp(1.0625rem, 0.3125rem + 0.625vw, 1.3125rem); /* 17→21 @1920→2560 — header primary nav; giữ 17px tới hết Full HD, chỉ lớn trên 4xl */
--fs-body:       clamp(1rem, 0.936rem + 0.275vw, 1.375rem);        /* 16→22 */
--fs-body-lg:    clamp(1.125rem, 1.061rem + 0.275vw, 1.5rem);      /* 18→24 */
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
| `body-lg` | 18 | 24 | 1.6 | — | Barlow | 400 | none | Lead, mô tả nổi bật |
| `body` | 16 | 22 | 1.6 | — | Barlow | 400 | none | Văn bản chính, **form input** |
| `button` | 15 | 18 | 1.2 | 0.01em | Condensed | 600 | UPPER | Nút, CTA |
| `caption` | 14 | 17 | 1.4 | — | Barlow | 400 | none | Chú thích, meta, giá phụ |
| `overline` | 12 | 14 | 1.4 | 0.06em | Condensed | 600 | UPPER | Badge, eyebrow, label nhỏ |

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

Còn lại (~195 px) **GIỮ NGUYÊN có chủ đích**: nhãn/kicker/badge/button/CTA uppercase, giá, rating, breadcrumb, input, icon, số, avatar initials, related-product title (compact 14px), và override px theo breakpoint. Trong `home-news-parity.css`: section heading (`.block-title h2`), card title (`.title-post`) và excerpt đã **token-hóa sang single `clamp()`/`--fs-body`** (gỡ override `font-size` theo @media 768/1920/2560/mobile, đúng §6); chỉ còn `.news-date p` (badge UPPERCASE) giữ px theo WP-parity.

---

## 9. Section header pattern — eyebrow + title (class dùng chung)

Mọi **section header** (cặp subtitle/kicker + tiêu đề section) trên toàn site dùng **hai class chung** trong [`lib/ui-classes.ts`](../lib/ui-classes.ts) — không viết inline mỗi nơi một kiểu:

| Vai trò | Class | Giá trị canonical |
|---|---|---|
| Subtitle / kicker / eyebrow | `sectionEyebrow` | `text-[var(--bb-text-muted)]` (xám muted) · `font-cta` (Condensed) · `text-[length:var(--bb-text-section-kicker)]` (13→18px) · `tracking-[0.15em]` · `font-black` · `leading-none` · `uppercase` |
| Tiêu đề section (h2-level) | `sectionHeading` | `font-heading` (Condensed) · `text-[length:var(--bb-text-section-title)]` (**30→50px**) · `font-semibold` · `leading-[1.2]` · `tracking-normal` · `uppercase` · `text-foreground` |

**Lưu ý chốt (giải quyết mâu thuẫn cũ):** tiêu đề section dùng token `--bb-text-section-title` (30→50), **không** dùng `text-h2` (24→40). Bảng §5 (`h2 = 24→40`) là thang chữ chung; riêng tiêu đề section đã chốt cỡ lớn hơn theo `--bb-text-section-title`. Kicker thống nhất **một màu xám muted** (không dùng đỏ brand cho kicker section).

Dùng: `className={sectionHeading}` hoặc `cn(sectionHeading, "mb-4")`; `className={cn(sectionEyebrow, "mb-3")}`. **Ngoại lệ có chủ đích — KHÔNG ép theo:** tiêu đề rail compact trong trang chi tiết (RecentlyViewed dùng `text-h4`, related products), tên bài trong card bài viết (giữ `normal-case`), và các biến thể card/giá/nút khác cỡ theo ngữ cảnh. (Tiêu đề **khối** blog — "Danh mục tin tức", "Có thể bạn quan tâm" — đã chuyển sang `sectionHeading` IN HOA 30→50 cho khớp toàn site.)

---

## 10. Hai nhóm chữ — "mọi chữ phải thuộc một nhóm"

Mọi text trong dự án thuộc **đúng một** trong hai nhóm; không có giá trị tùy tiện lạc lõng ngoài hai nhóm này:

1. **Nhóm chữ đọc (fluid)** — heading, section title/eyebrow, body, lead, caption, meta. **Bắt buộc** dùng token fluid (`text-h1…h4`, `text-body`, `text-caption`, `text-overline`, `--bb-text-section-title`/`-kicker`) hoặc class chung trong `lib/ui-classes.ts`. Không hardcode px/hex.
2. **Nhóm chữ cố định (UI vận hành)** — nút/CTA, badge, giá, ô nhập số (stepper giỏ hàng), nhãn dày đặc trong panel (search, mobile cart sheet), breadcrumb, pagination, số/rating. Kích thước cần chính xác, **không** co giãn. Dùng bộ token **`text-ui-N`** (`text-ui-9/10/11/12/13/14/16/18/20/22/24/30/35`) — **tên đúng px** (`text-ui-14` = đúng 14px). **Không** viết raw `text-[Npx]` trong className nữa.

**Màu chữ:** luôn dùng token (`text-foreground` = đen brand, `text-muted-foreground` = xám, `text-brand`…). **Cấm** hex hardcode (`text-[#6f6f6f]`) và màu Tailwind mặc định (`text-red-500`). *Ngoại lệ cơ chế giữ nguyên:* `FloatingChat` (widget chat) và `MobileHeaderMenu` (drawer mobile light-on-dark) còn dùng hex/px theo cơ chế riêng — đã ghi nhận.

**⚠️ Hai bộ token số — đừng nhầm:**
- **`text-ui-N`** (mới, trong `@theme inline`): **= đúng N px cố định.** Dùng cho nhóm chữ cố định.
- **`text-9/10/11/13/22/26…`** (legacy, từ `--bb-text-*`): tên **SAI** giá trị (`text-13`=14px, `text-22`=clamp). Chỉ còn vài chỗ cũ dùng; **không dùng cho code mới** — thay bằng `text-ui-N` (cố định) hoặc token fluid (chữ đọc).

**Ngoại lệ còn raw `text-[…]` có chủ đích:** vài giá trị rem lẻ kế thừa WooCommerce ở trang giỏ hàng (`1.143rem`/`1.429rem`/`1.714rem`/`1em` — stepper số lượng, coupon) không khớp thang px chẵn → giữ nguyên; và `FloatingChat` (cơ chế chat).

**Ngoại lệ scale-lên ở 3xl/4xl — bảng gợi ý tìm kiếm (search panel):** Tuy thuộc nhóm chữ cố định, panel tìm kiếm desktop (`SearchToggle.tsx`) được phép **phóng to cả khung lẫn chữ ở ≥3xl (1920px) và ≥4xl (2560px)** để không lọt thỏm trên màn lớn — khung mở rộng `770 → 940 → 1120px`, ô nhập `24 → 28 → 32px`, và các nhãn/chip/giá/tiêu đề gợi ý tăng một bậc `text-ui-N` mỗi mốc (dùng biến thể `3xl:`/`4xl:`). Đây là exception có chủ đích **chỉ cho riêng panel này** — không áp cho nhãn cố định ở nơi khác. (Các dòng "đọc" trong panel — lịch sử tìm kiếm, tên sản phẩm — vẫn dùng `text-caption` fluid nên đã tự scale.)

---

*Source of truth typography cho bigbike-web. Anchor: 375px (sàn) · 2560px (trần — cả content lẫn display, để chữ không quá nhỏ trên màn 3xl/4xl). Root 16px.*
