# BIGBIKE-WEB — Typography System

Tài liệu chuẩn (source of truth) cho typography của `bigbike-web`. Đây là bản đã **áp dụng vào repo** (Tailwind v4 `@theme inline`, token `--bb-font-*` + `--fs-*`), hợp nhất từ tài liệu thiết kế gốc `BIGBIKE_TYPOGRAPHY`.

Root = 16px. Cỡ chữ **CỐ ĐỊNH theo px thực của WordPress gốc** (rem neo 16px), **KHÔNG `clamp()`/`vw`**, không scale theo màn lớn — khớp đúng những gì site WP cũ render (cập nhật 2026-06-08, WP-parity). Breakpoint type **duy nhất = 768px** (Bootstrap md của WP), chỉ áp cho *section title*.

---

## 1. Bộ phông chữ — hybrid: Barlow Condensed + font hệ thống

Hệ thống dùng **Barlow Condensed** cho display/heading/CTA/nav, và **font hệ thống Arial/Helvetica** cho body/link — parity với WP cũ (WP dùng Bootstrap Reboot default = Arial/Helvetica cho body text).

| Vai trò | Phông | Nguồn | Đặc tính |
|---|---|---|---|
| Display / Heading / Nav / Button / Label | **Barlow Condensed** | next/font/google | Condensed grotesque, thể thao — dùng kèm `UPPERCASE` |
| Body / Nội dung / Link | **Arial, Helvetica, "Helvetica Neue", sans-serif** | Hệ thống | Parity WP cũ — không tải webfont cho body |
| Icon | icomoon | self-host | Giữ nguyên |

Cả hai font đều hỗ trợ đầy đủ dấu tiếng Việt.

---

## 2. Cài đặt — `app/fonts.ts`

`next/font` tự self-host Barlow Condensed (không gọi runtime Google), preload, sinh fallback metric-adjusted chống CLS. Font tĩnh → bắt buộc khai báo `weight`. Body/link dùng font hệ thống — không cần load Barlow Regular.

Weight thực nạp:
- **Barlow Condensed**: `500` footer slogan · `600` heading/nav/CTA · `700` h1/h2/display.

```ts
// app/fonts.ts
import { Barlow_Condensed } from "next/font/google";

export const barlowCondensed = Barlow_Condensed({
  subsets: ["latin", "vietnamese"],
  weight: ["500", "600", "700"],
  display: "swap",
  variable: "--font-barlow-condensed",
});
```

Gắn biến vào `<html>` trong `app/layout.tsx`:

```tsx
<html lang={locale} className={`${barlowCondensed.variable} h-full antialiased`}>
```

`lang="vi"` để trình duyệt ngắt dòng đúng tiếng Việt.

---

## 3. Token (CSS variables)

### Font family — `styles/brand-tokens.css`

```css
--bb-font-display: var(--font-barlow-condensed), "Barlow Condensed", "Arial Narrow", sans-serif;
--bb-font-heading: var(--font-barlow-condensed), "Barlow Condensed", "Arial Narrow", sans-serif;
--bb-font-body:    Arial, Helvetica, "Helvetica Neue", sans-serif;
--bb-font-link:    Arial, Helvetica, "Helvetica Neue", sans-serif;
--bb-font-cta:     var(--font-barlow-condensed), "Barlow Condensed", sans-serif;
--bb-font-nav:     var(--font-barlow-condensed), "Barlow Condensed", sans-serif;
```

### Size — cố định WP-parity (`--fs-*`), `styles/brand-tokens.css`

**Một token = một giá trị cố định** (rem neo 16px = px_WP / 16). KHÔNG `clamp()`, KHÔNG `vw`, không scale theo màn. Chữ giữ nguyên cỡ từ desktop trở lên — đúng cách WP cũ render.

```css
--fs-overline:   0.75rem;    /* 12px */
--fs-caption:    0.875rem;   /* 14px — meta/desc (WP 14px) */
--fs-button:     1rem;       /* 16px */
--bb-text-nav:   1rem;       /* 16px — header .navigation (WP) */
--fs-body:       1rem;       /* 16px — body (WP body = 16px) */
--fs-body-lg:    1.125rem;   /* 18px */
--fs-h4:         1.125rem;   /* 18px */
--fs-h3:         1.25rem;    /* 20px */
--fs-h2:         1.5rem;     /* 24px */
--fs-h1:         1.5rem;     /* 24px — page banner (WP body .page-title h1 = 24px mọi màn hình) */
--fs-display:    2.5rem;     /* 40px — trang trí */
--fs-display-xl: 5rem;       /* 80px — trang trí (404) */
```

`body` dùng `var(--fs-body)` = 16px (rem-based, **không** hardcode px). 16px đảm bảo form input không bị iOS auto-zoom khi focus.

**Section title nhảy bậc một lần @768px** (WP `body .block-title h3`):

```css
--bb-text-section-title: 1.5rem;              /* 24px mobile (≤767) */
@media (min-width: 768px) {
  :root { --bb-text-section-title: 2.1875rem; } /* 35px desktop (≥768) */
}
```

---

## 4. Tailwind utilities (Tailwind v4 — `app/globals.css` `@theme inline`)

Dự án dùng Tailwind v4: token expose qua `@theme inline`, **không** có `tailwind.config.ts`.

```css
@theme inline {
  --font-display: var(--bb-font-display);   /* font-display = Arial/Helvetica */
  --font-body:    var(--bb-font-body);

  /* fixed WP-parity scale → text-display, text-h4, text-body, text-button, text-caption, text-overline… */
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

Cỡ CỐ ĐỊNH (WP-parity) — không scale theo màn. Chỉ `section-title` nhảy bậc @768px.

| Token | px (WP) | LH | Weight | Transform | Dùng cho |
|---|---:|---|---|---|---|
| `display-xl` | 80 | 1.0 | 700 | UPPER | Trang trí (số 404) |
| `display` | 40 | 1.05 | 700 | UPPER | Hero trang trí |
| `h1` | **24** | 1.2 | 600 | UPPER | Tiêu đề trang / page banner (WP `body .page-title h1` = 24px mọi màn hình) |
| `section-title` | **24 → 35 @768** | 1.2 | 600 | UPPER | Tiêu đề section (WP `body .block-title h3`) |
| `h2` | 24 | 1.2 | 600 | UPPER | Heading |
| `h3` | 20 | 1.2 | 600 | UPPER | Sub-heading |
| `h4` | 18 | 1.25 | 600 | — | Card / sub-heading |
| `body-lg` | 18 | 1.5 | 400 | none | Lead |
| `body` | 16 | 1.5 | 400 | none | Văn bản chính, **form input** (WP body 16px) |
| `kicker` (section) | 16 | 1.2 | 600 | UPPER | Eyebrow section (WP `.block-title p.sub-title`) |
| `button` | 16 | 1.2 | 600 | UPPER | Nút / CTA phụ |
| `caption` | 14 | 1.4 | 400 | none | Chú thích, meta, desc (WP 14px) |
| `overline` | 12 | 1.4 | 600 | UPPER | Badge, label nhỏ |
| `footer-slogan` | 48 | 1.2 | 500 | UPPER | Slogan footer (WP `.newletters form h3`) |

> Phông chữ: xem §1 (đang được cập nhật riêng). Cột Family đã bỏ khỏi bảng này để bảng chỉ nói về **cỡ** (WP-parity).

---

## 6. Quy tắc bắt buộc

- **KHÔNG `clamp()`, KHÔNG `vw`, KHÔNG fluid** cho cỡ chữ — cỡ CỐ ĐỊNH theo px thực của WP (rem neo 16px). Không scale theo màn lớn (kể cả ≥1920/2560).
- **Breakpoint type duy nhất = 768px**, CHỈ cho `section-title` (24 → 35px). Mọi token khác cố định, không nhảy bậc theo breakpoint.
- **`rem`-based cho type đọc** (WCAG zoom-safe). Nhãn/UI cố định dùng `text-ui-N` (px chính xác).
- **Form input ≥ 16px** (`body`) — tránh iOS auto-zoom.
- Ngoại lệ giữ `vw`/`clamp`: **chữ trang trí** (`select-none`, opacity thấp) — watermark `PageHero.tsx`, số "404" nền `not-found.tsx`, `.bb-promo-bg-text`.
- Heading / nav / nút / eyebrow → **Barlow Condensed** + `UPPERCASE`.
- Nội dung đọc / body / link → **Arial/Helvetica** (font hệ thống, parity WP cũ), chữ thường, line-height ≥ 1.5.
- Không dùng Barlow Regular — body đã là Arial. Không dùng Oswald.

---

## 7. Tiếng Việt (UPPERCASE heading)

Heading `UPPERCASE` + Condensed + line-height thấp (1.0–1.2): dấu trên chữ hoa (Ặ, Ẫ, Ự, Ỹ, Ằ) dễ bị clip mép trên. Khi gặp: nới line-height nhẹ hoặc thêm `padding-top` nhỏ — không giảm dưới ngưỡng vỡ nhịp dọc. Giữ `lang="vi"`.

---

## 8. Trạng thái migration (transitional)

Đã áp dụng:

- ✅ Body/link → font hệ thống Arial/Helvetica (parity WP cũ — WP không set font-family cho body).
- ✅ Display/heading/CTA/nav → Barlow Condensed (BigBike design system).
- ✅ Chỉ load Barlow Condensed qua next/font — không load Barlow Regular (body đã là Arial).
- ✅ Gỡ Oswald hoàn toàn.
- ✅ **WP-parity de-fluidization (2026-06-08):** gỡ TOÀN BỘ `clamp()`/`vw` khỏi thang chữ. Mọi token `--fs-*` + `--bb-text-*` (nav/22/26/32/40/50/hero/section-kicker/footer-slogan/h1/h2) → **cố định** theo px thực WP (rem neo 16px).
- ✅ `body` → `var(--fs-body)` = **16px cố định** (WP body 16px).
- ✅ **Page banner** (`--fs-h1`, `.bb-page-head h1`, `.bb-cat-hero-title`) = **24px cố định mọi màn hình** — đúng cách WP render (`body .page-title h1` đè cỡ lớn xuống 24px).
- ✅ **Section title** (`--bb-text-section-title`) = 24px (≤767) → **35px @768** (WP `body .block-title h3`) — breakpoint type DUY NHẤT.
- ✅ Component bypass đã gỡ fluid: `.bb-cat-hero-title` (globals), iconBtn (`text-ui-18`), homepage category/exp/news card titles (`text-ui-N`).
- ✅ **Hết `clamp()`/`vw` trong thang chữ** — chỉ còn 2 chữ trang trí cố ý (PageHero watermark, số 404).

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
| Subtitle / kicker / eyebrow | `sectionEyebrow` | `text-[var(--bb-text-muted)]` (xám muted) · `font-cta` · `text-[length:var(--bb-text-section-kicker)]` (**16px** cố định, WP) · `tracking-[0.15em]` · `font-black` · `leading-none` · `uppercase` |
| Tiêu đề section (h2-level) | `sectionHeading` | `font-heading` · `text-[length:var(--bb-text-section-title)]` (**24px → 35px @768**, WP) · `font-semibold` · `leading-[1.2]` · `tracking-normal` · `uppercase` · `text-foreground` |

**Lưu ý chốt:** tiêu đề section dùng token `--bb-text-section-title` (**24 → 35px @768**, WP `body .block-title h3`), **không** dùng `text-h2` (24px cố định). Kicker = `--bb-text-section-kicker` (**16px**, WP `.sub-title`), thống nhất **một màu xám muted**.

Dùng: `className={sectionHeading}` hoặc `cn(sectionHeading, "mb-4")`; `className={cn(sectionEyebrow, "mb-3")}`. **Ngoại lệ có chủ đích — KHÔNG ép theo:** tiêu đề rail compact trong trang chi tiết (RecentlyViewed dùng `text-h4`, related products), tên bài trong card bài viết (giữ `normal-case`), và các biến thể card/giá/nút khác cỡ theo ngữ cảnh. (Tiêu đề **khối** blog — "Danh mục tin tức", "Có thể bạn quan tâm" — đã chuyển sang `sectionHeading` IN HOA 30→50 cho khớp toàn site.)

---

## 10. Hai nhóm chữ — "mọi chữ phải thuộc một nhóm"

Mọi text trong dự án thuộc **đúng một** trong hai nhóm; không có giá trị tùy tiện lạc lõng ngoài hai nhóm này:

1. **Nhóm chữ đọc (WP-parity cố định)** — heading, section title/eyebrow, body, lead, caption, meta. **Bắt buộc** dùng token (`text-h1…h4`, `text-body`, `text-caption`, `text-overline`, `--bb-text-section-title`/`-kicker`) hoặc class chung trong `lib/ui-classes.ts`. Cỡ cố định theo WP, **không** `clamp()`/`vw`/hardcode px-hex.
2. **Nhóm chữ cố định (UI vận hành)** — nút/CTA, badge, giá, ô nhập số (stepper giỏ hàng), nhãn dày đặc trong panel (search, mobile cart sheet), breadcrumb, pagination, số/rating. Kích thước cần chính xác, **không** co giãn. Dùng bộ token **`text-ui-N`** (`text-ui-9/10/11/12/13/14/16/18/20/22/24/30/35`) — **tên đúng px** (`text-ui-14` = đúng 14px). **Không** viết raw `text-[Npx]` trong className nữa.

**Màu chữ:** luôn dùng token (`text-foreground` = đen brand, `text-muted-foreground` = xám, `text-brand`…). **Cấm** hex hardcode (`text-[#6f6f6f]`) và màu Tailwind mặc định (`text-red-500`). *Ngoại lệ cơ chế giữ nguyên:* `FloatingChat` (widget chat) và `MobileHeaderMenu` (drawer mobile light-on-dark) còn dùng hex/px theo cơ chế riêng — đã ghi nhận.

**⚠️ Hai bộ token số — đừng nhầm:**
- **`text-ui-N`** (mới, trong `@theme inline`): **= đúng N px cố định.** Dùng cho nhóm chữ cố định.
- **`text-9/10/11/13/22/26…`** (legacy, từ `--bb-text-*`): tên **SAI** giá trị (`text-13`=14px, `text-22`=18px — nay đều cố định, không còn clamp). Chỉ còn vài chỗ cũ dùng; **không dùng cho code mới** — thay bằng `text-ui-N` (cố định) hoặc token chữ đọc.

**Ngoại lệ còn raw `text-[…]` có chủ đích:** vài giá trị rem lẻ kế thừa WooCommerce ở trang giỏ hàng (`1.143rem`/`1.429rem`/`1.714rem`/`1em` — stepper số lượng, coupon) không khớp thang px chẵn → giữ nguyên; và `FloatingChat` (cơ chế chat).

**Ngoại lệ scale-lên ở 3xl/4xl — bảng gợi ý tìm kiếm (search panel):** Tuy thuộc nhóm chữ cố định, panel tìm kiếm desktop (`SearchToggle.tsx`) được phép **phóng to cả khung lẫn chữ ở ≥3xl (1920px) và ≥4xl (2560px)** để không lọt thỏm trên màn lớn — khung mở rộng `770 → 940 → 1120px`, ô nhập `24 → 28 → 32px`, và các nhãn/chip/giá/tiêu đề gợi ý tăng một bậc `text-ui-N` mỗi mốc (dùng biến thể `3xl:`/`4xl:`). Đây là exception có chủ đích **chỉ cho riêng panel này** — không áp cho nhãn cố định ở nơi khác. (Các dòng "đọc" trong panel — lịch sử tìm kiếm, tên sản phẩm — vẫn dùng `text-caption` fluid nên đã tự scale.)

---

*Source of truth typography cho bigbike-web. Mô hình: cỡ chữ CỐ ĐỊNH theo px thực của WordPress gốc (WP-parity), root 16px, KHÔNG `clamp()`/`vw`/scale-theo-màn. Breakpoint type duy nhất = 768px (chỉ section title). Cập nhật 2026-06-08.*
