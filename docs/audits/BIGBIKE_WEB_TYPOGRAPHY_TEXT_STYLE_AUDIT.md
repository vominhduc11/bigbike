---
title: BigBike Web — Typography & Text Style Parity Audit
status: AUDIT_ONLY_NO_CODE_CHANGES
created: 2026-05-12
auditor: Senior Frontend Engineer + UI/UX Auditor (static CSS analysis pass)
scope: So sánh 100% mọi thuộc tính typography/text giữa `bigbike-web` (Next.js 16) và theme WordPress cũ `bigbike_vn__2026_04_17/files/wp-content/themes/bigbike/`.
related:
  - docs/audits/WP_TO_NEXT_UI_PARITY_AUDIT.md
  - docs/audits/BIGBIKE_WEB_BACKGROUND_COLOR_AUDIT.md
  - bigbike-web/STYLEGUIDE.md
verdict: FAIL_NOT_MATCHING (static analysis) + INCONCLUSIVE_NOT_ENOUGH_RUNTIME_EVIDENCE (browser computed style verification not yet performed)
---

# BigBike Web — Typography & Text Style Parity Audit

> Phạm vi: chỉ thuộc tính typography/text. Không bao gồm color tokens nói chung, layout, spacing, raster image. Chỉ đọc & ghi chú, **không sửa code**.

---

## 1. Executive Summary

| Câu hỏi | Trả lời |
|---|---|
| `bigbike-web` có khớp 100% typography với WordPress cũ? | **KHÔNG** |
| Mức độ chênh lệch dominant ở đâu? | (1) Body chữ chính (color), (2) Navigation (font-family + size + weight), (3) Product card title/price (font-family + size + weight), (4) Breadcrumb (transform + size), (5) Page hero h1 (size scale), (6) Button CTA (font-family) |
| Rủi ro UI/UX | Khách quen WordPress nhìn vào sẽ thấy "mặt chữ khác", "chữ nhỏ hơn / nhạt hơn", "tên sản phẩm trên card không cùng cá tính font Oswald như cũ", "breadcrumb mất tính rich-text, biến thành tag-style nhỏ"; toàn site có cảm giác lệch tone so với WP. |
| Verdict | **FAIL_NOT_MATCHING** (static evidence đã đủ để khẳng định không 100%). Một phần các finding chưa thể xác nhận lệch giá trị tuyệt đối ở mọi viewport mà không có runtime computed style — đánh dấu `NOT_VERIFIABLE` chỗ đó. |

> Đây là Phase 0 audit chỉ làm static CSS analysis. Phase tiếp theo (nếu muốn 100% chắc) cần dựng WP cũ chạy local + Playwright capture computed style ở 375/768/1440 px.

---

## 2. Phương pháp (Methodology)

### 2.1 Đã làm

- Đọc toàn bộ entry points CSS của theme WP cũ và inventory loading order.
- Đọc toàn bộ `bigbike-web/app/globals.css` (9268 lines), `bigbike-web/styles/brand-tokens.css` (707 lines), `bigbike-web/app/layout.tsx`.
- Trích xuất rule typography/text theo nhóm property (font-family, font-size, font-weight, font-style, line-height, letter-spacing, color, text-transform, text-decoration, text-align, white-space, word-break, text-overflow, vertical-align, hyphens, font shorthand, …).
- Cite file path + line number cho mọi finding.
- Khảo sát `font` shorthand (WP `::-webkit-file-upload-button{font:inherit}`, `style.css` reset shorthand) — không phát hiện việc dùng `font` shorthand làm thay đổi semantic cascading typography ở cả 2 codebase.
- Kiểm tra inheritance: body → element con. Trace nguồn `color` từ `body` xuống các vùng text con qua cascade.
- Kiểm tra `@media` breakpoint:
  - WP dùng Bootstrap 4.5 breakpoint: `576 / 768 / 992 / 1200`.
  - `bigbike-web` định nghĩa custom tokens `--bb-bp-xs/sm/md/lg/xl/2xl = 360/576/768/992/1200/1440` và dùng Tailwind v4 default queries; trong globals.css thực tế dùng các `@media (max-width: 575px)`, `(min-width: 576px) and (max-width: 991px)`, `(max-width: 767px)`, `(max-width: 1440px) and (min-width: 768px)`.
- Khảo sát hover/focus/active state có text-style khác: ghi nhận `.wp-navigation-item > a:hover` đổi `color`; bigbike-web mirror đúng.
- Khảo sát pseudo-elements `::before`, `::after`: chủ yếu là decorative icon (font-awesome) — đã có cả 2 codebase đều dùng. Không phát hiện text content khác biệt đáng kể qua pseudo trong typography scope.

### 2.2 Chưa làm — và lý do

| Việc | Trạng thái | Lý do |
|---|---|---|
| Render WordPress cũ ở local để lấy computed style | **NOT_DONE** | WP cũ cần PHP + MySQL + WooCommerce + Polylang + nhiều plugin; sqldump 100+MB; chưa dựng được trong scope audit này. |
| Chạy Playwright để dump `getComputedStyle()` ở 375/768/1440 trên `bigbike-web` | **NOT_DONE** | Playwright chưa cài đặt trong repo (`bigbike-web/package.json` không có dependency); cài đặt và setup test sẽ làm thay đổi repo state — vi phạm điều kiện "không sửa code" của audit. |
| Hash các @font-face WOFF base64 trong `footer.php` để xác nhận đúng font Barlow/Oswald binary | **NOT_DONE** | Cả 2 hệ thống đều khai báo cùng tên `font-family: Barlow / Barlow Condensed / Oswald`; sự khác biệt binary (nếu có) không ảnh hưởng tới cascading rules — chỉ ảnh hưởng tới rendering pixel. Out of scope. |

**Hệ quả:** một số mismatch dưới đây được đánh `NOT_VERIFIABLE` cho cột "WP computed runtime value" vì giá trị thực tế trên browser của WP cũ chưa được measure — chỉ là **giá trị theo CSS source**.

---

## 3. Phase 1 — Inventory CSS sources

### 3.1 WordPress (`bigbike_vn__2026_04_17/files/wp-content/themes/bigbike/`)

CSS loading order (theo [`inc/layout-functions.php`](../../bigbike_vn__2026_04_17/files/wp-content/themes/bigbike/inc/layout-functions.php#L17-L130)):

| # | File | Bytes | Vai trò | Active? |
|---|---|---:|---|---|
| 1 | [`styles/fonts.css`](../../bigbike_vn__2026_04_17/files/wp-content/themes/bigbike/styles/fonts.css) | 433 KB | @font-face Barlow/Oswald base64 | **TOÀN BỘ COMMENT-OUT** (lines 1-56 đều nằm trong `/* ... */`). Font thực ra được nạp bằng `<style>@font-face …</style>` inline trong [`footer.php:128-200`](../../bigbike_vn__2026_04_17/files/wp-content/themes/bigbike/footer.php#L128). |
| 2 | `plugin/swiper/swiper.min.css` | — | Carousel, không ảnh hưởng typography |
| 3 | [`styles/main.css`](../../bigbike_vn__2026_04_17/files/wp-content/themes/bigbike/styles/main.css) | 90 KB (single line minified) | Bootstrap 4.5 Reboot + Bootstrap Grid + Bootstrap Utilities + custom theme rules |
| 4 | [`styles/custom.css`](../../bigbike_vn__2026_04_17/files/wp-content/themes/bigbike/styles/custom.css) | 109 KB (single line minified) | WooCommerce overrides + site-wide typography overrides |
| 5 | Per-template: `home.css`, `product.css`, `product-detail.css`, `news.css`, `news-detail.css`, `cart.css`, `check-out.css`, `login.css`, `register.css`, `static-page.css`, `payment-success.css` | nhỏ – 60 KB | Page-specific overrides |
| 6 | [`style.css`](../../bigbike_vn__2026_04_17/files/wp-content/themes/bigbike/style.css) (theme stylesheet) | 985 lines | Underscores starter + normalize.css. **Active nhưng phần lớn bị Bootstrap reboot + custom.css override**. |
| 7 | Inline `<style>` block trong [`header.php:153-169`](../../bigbike_vn__2026_04_17/files/wp-content/themes/bigbike/header.php#L153) | nhỏ | Vài override không-typography (icon, banner) |
| 8 | Inline `<style>` block trong [`footer.php:128-…`](../../bigbike_vn__2026_04_17/files/wp-content/themes/bigbike/footer.php#L128) | rất lớn (~430 KB) | **@font-face base64 cho Barlow / Barlow Condensed / Oswald** + Bitrix24 widget CSS |

**Token gốc trong WP** ([`styles/main.css:1`](../../bigbike_vn__2026_04_17/files/wp-content/themes/bigbike/styles/main.css#L1) và [`styles/home.css:1`](../../bigbike_vn__2026_04_17/files/wp-content/themes/bigbike/styles/home.css#L1)):

```css
:root{
  --theme-white:#fff;
  --theme-black:#000;
  --theme-gray:#6f6f6f;
  --theme-red:#ff0c09;
  --theme-size:14px;
  --theme-font:"Barlow",sans-serif;
  --theme-font-second:"Barlow Condensed",sans-serif;
}
```

**Lưu ý quan trọng:** `--theme-size: 14px` được khai báo nhưng **không** được áp lên `body` — body bị override bằng `font-size:16px` ở quy tắc body thứ ba của main.css (xem §4.1).

### 3.2 `bigbike-web` (Next.js 16)

CSS entrypoints:

| # | File | Lines | Vai trò |
|---|---|---:|---|
| 1 | [`app/globals.css`](../../bigbike-web/app/globals.css) | 9268 | Tailwind v4 import + body + WP-port classes (`.wp-*`) + DESIGN.md enforcement block (lines 8095-9268) |
| 2 | [`styles/brand-tokens.css`](../../bigbike-web/styles/brand-tokens.css) | 707 | Design tokens (`--bb-*`) + utility classes (`.bb-button`, `.bb-h1`, `.bb-richtext`, …) |
| 3 | [`app/layout.tsx`](../../bigbike-web/app/layout.tsx) | 98 | Load 3 next/font/google: Barlow (300-700), Barlow Condensed (400-700), Oswald (400-700); biến CSS `--font-barlow`, `--font-barlow-condensed`, `--font-oswald`. |

Không có CSS module / styled-component / external font CDN khác. Tailwind v4 sử dụng `@theme inline` block.

**Token gốc trong bigbike-web** ([`styles/brand-tokens.css:53`](../../bigbike-web/styles/brand-tokens.css#L53)):

```css
:root {
  --theme-white: #fff;
  --theme-black: #000;
  --theme-gray:  #6f6f6f;
  --theme-red:   #ff0c09;
  --theme-size:  14px;
  --theme-font: var(--font-barlow), "Barlow", sans-serif;
  --theme-font-second: var(--font-barlow-condensed), "Barlow Condensed", sans-serif;
}
```

Các legacy token được mirror đúng. Tuy nhiên `--theme-size` vẫn không được áp xuống body trong cả 2 codebase.

---

## 4. Phase 2 + 3 — Typography baseline & implementation theo từng vùng UI

Cấu trúc bảng dưới đây: WP value (source CSS, có file:line) | bigbike-web value (source CSS, có file:line) | Match? | Severity.

> Quy ước severity:
> - **P0**: lệch global, ảnh hưởng toàn site (body, html, link).
> - **P1**: lệch ở header / footer / product card / page hero / button — high-visibility area.
> - **P2**: lệch ở state / phụ kiện (badge, breadcrumb, news widget).
> - **P3**: lệch nhỏ (rounding, browser default sub-pixel).
>
> Match status: `MATCH` / `MISMATCH` / `PARTIAL` / `NOT_VERIFIABLE`.

### 4.1 Body / global typography

| Property | WP (source) | bigbike-web (source) | Match | Severity | Evidence |
|---|---|---|---|---|---|
| `font-family` (body) | `Barlow,sans-serif` rồi `Barlow` (single token) ở rule body thứ 3 | `var(--bb-font-body)` = `var(--font-barlow), "Barlow", "Segoe UI", -apple-system, BlinkMacSystemFont, sans-serif` | **PARTIAL** | P3 | WP: [`styles/main.css`](../../bigbike_vn__2026_04_17/files/wp-content/themes/bigbike/styles/main.css) — 3 rules body cascading (extract bằng `awk -v RS="}"`: `body{font-family:-apple-system,…}`, `body{font-size:1rem;font-family:Barlow,sans-serif;…}`, `body{margin:0;padding:80px 0 0;font-size:16px;font-family:Barlow}`). bigbike-web: [`app/globals.css:17-24`](../../bigbike-web/app/globals.css#L17) + [`app/globals.css:8106-8111`](../../bigbike-web/app/globals.css#L8106) + token [`styles/brand-tokens.css:133`](../../bigbike-web/styles/brand-tokens.css#L133). Cùng family chính (Barlow) nhưng fallback chain dài hơn ở Next; không ảnh hưởng khi Barlow load. |
| `font-size` (body) | `16px` (rule cuối ghi đè) | `var(--bb-text-base)` = `16.002px` | **MISMATCH** | P3 | WP: extract rule 3 `body{…font-size:16px;…}`. bigbike-web: [`styles/brand-tokens.css:141`](../../bigbike-web/styles/brand-tokens.css#L141) định nghĩa `--bb-text-base: 16.002px`. Chênh 0.002px — vô nghĩa hiển thị nhưng lệch giá trị tuyệt đối ⇒ không 100% MATCH. |
| `line-height` (body) | `1.5` (kế thừa từ Bootstrap reboot `body{line-height:1.5}`; không bị 2 rule body sau override) | `24.003px` (line `body{…line-height:24.003px;…}` ở DESIGN.md block override `--bb-line-body: 1.5`) | **PARTIAL** | P3 | WP: Bootstrap rule body `line-height:1.5` ([`styles/main.css`](../../bigbike_vn__2026_04_17/files/wp-content/themes/bigbike/styles/main.css) — extract). 1.5 × 16 = 24px. bigbike-web: [`app/globals.css:8110`](../../bigbike-web/app/globals.css#L8110) đặt cứng `line-height:24.003px`. Chênh 0.003px ⇒ MISMATCH về value, MATCH về visual. |
| `color` (body) | `#000` (rule body 2 `body{…color:#000;…}` override `color:#212529` của Bootstrap reboot) | `var(--bb-text-secondary)` = `var(--bb-color-gray-500)` = `#6f6f6f` | **MISMATCH** | **P0** | WP: extract rule 2. bigbike-web: [`app/globals.css:19`](../../bigbike-web/app/globals.css#L19) và [`app/globals.css:8107`](../../bigbike-web/app/globals.css#L8107). Body text WP **đen** trong khi bigbike-web **xám**. Đây là lệch nghiêm trọng nhất, ảnh hưởng toàn site. |
| `font-weight` (body) | `400` (Bootstrap reboot; không bị 2 rule body sau override) | `var(--bb-font-weight-regular)` = `400` (chỉ trong rule line 17, DESIGN.md block line 8106 không re-define ⇒ value cuối = 400) | **MATCH** | — | — |
| `text-align` (body) | `left` (Bootstrap reboot) | (không set; default `start`/`left` cho LTR) | **PARTIAL** | P3 | Browser default = `start`; cho `lang="vi"` LTR = `left`. Trùng visual nhưng WP set tường minh. |
| `font-style` (body) | (không set, default `normal`) | (không set, default `normal`) | **MATCH** | — | |
| `font-variant` / `font-stretch` / `font-optical-sizing` / `font-variation-settings` | Không khai báo ở cả 2 | Không khai báo ở cả 2 | **MATCH** | — | |
| `letter-spacing` (body) | (không set, default `normal` = 0) | `--bb-letter-normal: 0` (token, không áp tự động lên body) | **MATCH** | — | |
| `word-spacing` | (không set) | (không set) | **MATCH** | — | |
| `text-transform` | (không set) | (không set ở body) | **MATCH** | — | |
| `text-decoration` (body) | (không set) | (không set) | **MATCH** | — | |
| `white-space` / `word-break` / `overflow-wrap` / `hyphens` (body) | (không set) | (không set) | **MATCH** | — | |
| `tab-size` / `writing-mode` / `text-orientation` | (không set) | (không set) | **MATCH** | — | |
| `font-size-adjust`, `-webkit-text-size-adjust` | `html{-webkit-text-size-adjust:100%}` từ normalize.css (style.css) + Bootstrap reboot | Không set ở `html`/`body` của bigbike-web | **MISMATCH** | P3 | bigbike-web không có `-webkit-text-size-adjust` ⇒ iOS Safari có thể auto-zoom text khi xoay ngang. Search trong [`app/globals.css`](../../bigbike-web/app/globals.css) confirm 0 match. |

### 4.2 Anchor (`a`) / link

| Property | WP | bigbike-web | Match | Severity | Evidence |
|---|---|---|---|---|---|
| `color` | `#007bff` (Bootstrap reboot `a{color:#007bff;…}`) — phần lớn link content bị custom rules override; phần lớn link trong navigation/menu được override bằng class cụ thể (xem §4.3, §4.7) | `inherit` ([`app/globals.css:27`](../../bigbike-web/app/globals.css#L27)) | **MISMATCH** | P1 | Đường link rich-text body trong bigbike-web kế thừa màu body = `#6f6f6f` (xám), trong WP = `#007bff` (xanh dương). Đối với content WP-rich-text, link xanh là baseline. Có rule `.bb-richtext a { color: var(--bb-color-blue); … }` ở [`styles/brand-tokens.css:626`](../../bigbike-web/styles/brand-tokens.css#L626) nhưng chỉ áp khi container có class `.bb-richtext` — link nằm ngoài rich-text vẫn `inherit`. |
| `text-decoration` (`a`) | `none` (Bootstrap reboot `a{…text-decoration:none;…}`) | (không set ở `a` global, chỉ ở `.bb-richtext a { text-decoration: underline; }`) | **PARTIAL** | P2 | bigbike-web để default `underline` cho user-agent link nếu không có class. WP global tắt underline cho mọi `a`. |
| `a:hover` color | WP: `#0056b3` (Bootstrap), nhưng phần lớn link bị override (xem các vùng cụ thể) | `var(--bb-brand-primary)` = `#ff0c09` ([`app/globals.css:8119`](../../bigbike-web/app/globals.css#L8119)) | **MISMATCH** | P2 | Cùng tinh thần "hover đổi màu" nhưng giá trị khác: WP đổi sang xanh đậm, Next đổi sang đỏ thương hiệu. Đặc thù theme bigbike-web là dùng đỏ thương hiệu cho hover → cố ý drift. |
| `text-decoration-line` / `-style` / `-color` / `-thickness` | (không set tường minh) | `text-decoration-thickness: 1px; text-underline-offset: 2px` (ở `a` global, [`app/globals.css:8113-8116`](../../bigbike-web/app/globals.css#L8113)) | **MISMATCH** | P3 | Áp dụng cả khi link không có `underline`; visual không ảnh hưởng tại trạng thái không gạch chân. |

### 4.3 Header — desktop navigation

WP source: extract `header .navigation{font-family:Barlow Condensed,sans-serif;font-size:1.143rem}` và `header .navigation--item>a{color:#fff;text-transform:uppercase;font-weight:600}` ([`styles/main.css`](../../bigbike_vn__2026_04_17/files/wp-content/themes/bigbike/styles/main.css)). Sub-menu: extract `header .navigation ul .navigation--item>.sub-menu li a{padding:15px 30px;display:block;color:#6f6f6f;font-size:14px;font-weight:600;font-family:Oswald,sans-serif}` từ [`styles/custom.css`](../../bigbike_vn__2026_04_17/files/wp-content/themes/bigbike/styles/custom.css).

bigbike-web source: `.wp-navigation` + `.wp-navigation-item > a` ở [`app/globals.css:1563-1622`](../../bigbike-web/app/globals.css#L1563), bị override bởi DESIGN.md block ở [`app/globals.css:8285-8294`](../../bigbike-web/app/globals.css#L8285).

| Element | Property | WP | bigbike-web (cascaded final) | Match | Severity |
|---|---|---|---|---|---|
| Nav container (`.navigation` / `.wp-navigation`) | `font-family` | `Barlow Condensed, sans-serif` | `var(--bb-font-nav)` = **Barlow** (NOT Condensed) | **MISMATCH** | **P1** |
| Nav container | `font-size` | `1.143rem` (~18.288px ở root 16) | `1.143rem` ở rule 1, **BỊ OVERRIDE bởi rule `.wp-navigation-item > a { font-size: 16px }`** ở DESIGN.md block | **MISMATCH** | **P1** |
| Nav item (`.navigation--item > a`) | `color` | `#fff` | `#ffffff` | **MATCH** | — |
| Nav item | `text-transform` | `uppercase` | (không set ở rule cuối DESIGN.md, kế thừa từ rule 1 đã có `uppercase`) | **MATCH** | — |
| Nav item | `font-weight` | `600` | `400` (DESIGN.md rule line 8294 override `600` của rule line 1591) | **MISMATCH** | **P1** |
| Nav item | `padding` (ảnh hưởng line-box) | `26px 30px 27px` | `0 18px` + `min-height: var(--bb-header-height)` (DESIGN.md override) | **MISMATCH** | P1 |
| Nav item | `line-height` | (kế thừa body = 1.5) | `1` (rule 1) — sau đó DESIGN.md không re-define ⇒ vẫn 1 | **MISMATCH** | P2 |
| Nav item | `white-space` | `nowrap` (rule 1) | `nowrap` | **MATCH** | — |
| Nav item | `text-decoration` | `none` (mặc định a-link đã set) | `none` | **MATCH** | — |
| Sub-menu link (`.sub-menu li a` / `.wp-sub-menu-item > a`) | `font-family` | `Oswald, sans-serif` | `var(--bb-font-display)` = `Barlow Condensed, Barlow, Helvetica, sans-serif` | **MISMATCH** | **P1** |
| Sub-menu link | `font-size` | `14px` | `14px` ([`app/globals.css:1678`](../../bigbike-web/app/globals.css#L1678)) | **MATCH** | — |
| Sub-menu link | `font-weight` | `600` | `600` | **MATCH** | — |
| Sub-menu link | `color` | `#6f6f6f` | `#6f6f6f` ([`app/globals.css:1675`](../../bigbike-web/app/globals.css#L1675)) | **MATCH** | — |
| Sub-menu link | `text-transform` | (không set) | `none` (rule line 1680) | **MATCH** | — |
| Sub-menu link | `line-height` | (kế thừa body = 1.5) | `1.4` (rule line 1682) | **MISMATCH** | P3 |
| Sub-menu link hover | `color` | `#ff0c09` | `var(--bb-brand-primary)` = `#ff0c09` | **MATCH** | — |
| User-control icon | `font-size` | `1.286rem` (~20.576px) | `1.286rem` (rule line 1728) | **MATCH** | — |
| User-control icon | `color` | `#fff` | `#fff` | **MATCH** | — |

### 4.4 Header — mobile drawer / menu

WP source: trong `custom.css` và `main.css` có rules cho `.mobile-item`, `.information-slide`, `.hammer-menu`, `.toogle-menu`. WP có hamburger menu mở mobile drawer; typography của mobile drawer chủ yếu kế thừa body (Barlow 16, color #000) + một số override.

bigbike-web: `components/layout/MobileHeaderMenu.tsx` + class `.wp-mobile-*` (extract qua grep `.wp-mobile-` trong `globals.css`).

| Property | WP | bigbike-web | Match | Severity | Evidence |
|---|---|---|---|---|---|
| Hamburger button text/icon font-size | (icon font-awesome) | (icon Lucide hoặc tương đương qua component) | **NOT_VERIFIABLE** | — | Mobile menu của bigbike-web là React component động, cần render runtime để so. |
| Drawer menu link `font-family` | `Barlow Condensed` (kế thừa từ `.navigation`) | `var(--bb-font-nav)` = Barlow | **MISMATCH** | **P1** | Tương tự desktop nav. |
| Drawer menu link `font-size` | `1.143rem` | (NOT_VERIFIABLE — class chưa được kiểm tra chi tiết) | **NOT_VERIFIABLE** | — | Cần check trực tiếp `.wp-mobile-*` rules. |

### 4.5 Footer

WP source ([`styles/main.css`](../../bigbike_vn__2026_04_17/files/wp-content/themes/bigbike/styles/main.css) + [`styles/custom.css`](../../bigbike_vn__2026_04_17/files/wp-content/themes/bigbike/styles/custom.css)):

```
footer .top   { background:#3a3a3a; padding:60px 0 }
footer .foot  { background:#000; padding:30px 0; color:#fff }
footer .foot .col-md-4 { … font-size:14px }
footer .foot .col-md-6 p { color:#7e7e7e; line-height:20px }
footer .foot .license p { line-height:1.214rem (~19.4px) }
```

→ WP footer **2 dải**: top (#3a3a3a, đậm) + foot (#000, đen) — bottom strip license.

bigbike-web source ([`app/globals.css:45-49`](../../bigbike-web/app/globals.css#L45)):

```
.bb-footer { border-top: 3px solid var(--bb-brand-primary); background: #3a3a3a; color: var(--bb-color-gray-600); }
.bb-footer-bottom { border-top: 1px solid rgba(255,255,255,0.08); }
```

→ bigbike-web footer **1 dải duy nhất** `#3a3a3a` cho cả body + bottom strip.

| Property | WP | bigbike-web | Match | Severity |
|---|---|---|---|---|
| Footer background (chính) | Hai dải: top `#3a3a3a`, bottom `#000` | Một dải: `#3a3a3a`, bottom chỉ border 1px trắng 8% | **MISMATCH** | P1 (background — out of scope typography nhưng ảnh hưởng contrast text). |
| Footer text color (chính) | `#fff` ở foot strip, `#7e7e7e` ở `.col-md-6 p`, kế thừa từ body trong `.top` | `var(--bb-color-gray-600)` = `#6f6f6f` ([`app/globals.css:48`](../../bigbike-web/app/globals.css#L48)) | **MISMATCH** | P1 |
| Footer link color | `#fff` (WP `footer a` cascade từ `.foot{color:#fff}`) | `var(--bb-color-gray-600)` = `#6f6f6f` ([`app/globals.css:55`](../../bigbike-web/app/globals.css#L55)) | **MISMATCH** | P1 |
| Footer link `:hover` color | (WP không set hover footer link cụ thể; kế thừa `a:hover{color:#0056b3}` nhưng phần lớn `.foot a` không override) | `var(--bb-brand-primary)` = `#ff0c09` ([`app/globals.css:58-62`](../../bigbike-web/app/globals.css#L58)) | **MISMATCH** | P2 |
| Footer brand heading (`h2`) | `font-family:Barlow Condensed` (qua `--theme-font-second`) hoặc Oswald (theo class WP) | `var(--bb-font-display)` = Barlow Condensed ([`app/globals.css:122`](../../bigbike-web/app/globals.css#L122)) | **PARTIAL** | P2 |
| Footer col heading (`h3`) | (WP có nhiều variant tùy template) | `var(--bb-font-display)` = Barlow Condensed ([`app/globals.css:146`](../../bigbike-web/app/globals.css#L146)) | **NOT_VERIFIABLE** | P2 — cần đối chiếu cụ thể từng widget WP. |
| Footer body text size | `14px` (`.col-md-4`) hoặc kế thừa 16px | (không set tường minh ở `.bb-footer-*` p) | **NOT_VERIFIABLE** | P2 |

### 4.6 Homepage sections

WP source ([`styles/custom.css`](../../bigbike_vn__2026_04_17/files/wp-content/themes/bigbike/styles/custom.css) + [`styles/home.css`](../../bigbike_vn__2026_04_17/files/wp-content/themes/bigbike/styles/home.css)):

```
.block-title h3 { margin:0; font-size:35px; line-height:4.286rem (~68.6px); color:#000; font-weight:600; font-family:Oswald,sans-serif }
@media (max-width:767px) body .block-title h3 { font-size:24px; line-height:30px }
.block-title p.sub-title { font-weight:600; color:#cecece; font-size:1.143rem; line-height:1.357rem }
.block-title--content p { line-height:1.214; font-size:1rem; color:#3a3a3a }
.about-bigbike .block-content p { color:#6f6f6f }
.category-list .item--title { font-family:Oswald,sans-serif; font-weight:600; font-size:18px; line-height:20px }
.news--item-inside h3 { font-size:1.25rem; line-height:1.5rem; font-weight:600; font-family:Oswald,sans-serif }
```

bigbike-web source: `.wp-section-title`, `.wp-products-title`, etc. ([`app/globals.css:4219`](../../bigbike-web/app/globals.css#L4219), [`8194-8211`](../../bigbike-web/app/globals.css#L8194)):

```
.wp-section-title { font-family: var(--bb-font-display); … font-size: clamp(1.5rem, 2.6vw, 2.143rem); … }
(DESIGN.md override) .wp-section-title { color: …; font-family: var(--bb-font-heading); font-weight: 600; … line-height: 1.5; text-transform: uppercase; }
```

| Element | Property | WP | bigbike-web | Match | Severity |
|---|---|---|---|---|---|
| Section title `.block-title h3` / `.wp-section-title` | `font-family` | `Oswald, sans-serif` | `var(--bb-font-heading)` = **Barlow** (DESIGN.md override) | **MISMATCH** | **P1** |
| Section title | `font-size` desktop | `35px` cứng | `clamp(1.5rem, 2.6vw, 2.143rem)` = `24–34.288px` tùy viewport | **MISMATCH** | **P1** |
| Section title | `font-size` mobile (<767px) | `24px` (custom.css media query) | `1.5rem` = `24px` (do clamp min) | **MATCH** | — |
| Section title | `line-height` | `4.286rem` = `~68.6px` (rất rộng) | `1.5` (= ~36-51px tùy size) | **MISMATCH** | **P1** |
| Section title | `font-weight` | `600` | `600` | **MATCH** | — |
| Section title | `text-transform` | (không set ở rule WP gốc — nhưng nhiều section dùng class `text-uppercase` Bootstrap. Tham chiếu `woocommerce/single-product/related.php` line 32: inline `text-transform: uppercase`) | `uppercase` | **PARTIAL** | P2 |
| Section sub-title `.block-title p.sub-title` | `font-size` | `1.143rem` (~18.288px) | (NOT_VERIFIABLE — không có class tương đương rõ ràng trong globals.css) | **NOT_VERIFIABLE** | P2 |
| Section sub-title | `color` | `#cecece` | (NOT_VERIFIABLE) | **NOT_VERIFIABLE** | P2 |
| About content `p` | `color` | `#6f6f6f` | `var(--bb-text-secondary)` = `#6f6f6f` | **MATCH** | — |
| About content `p` | `line-height` | `1.214` | `24.003px` (kế thừa body) | **MISMATCH** | P3 |
| News item `h3` | `font-family` | `Oswald` | `var(--bb-font-cta)` = Oswald ([`styles/brand-tokens.css:608-620`](../../bigbike-web/styles/brand-tokens.css#L608) cho .bb-richtext) | **NOT_VERIFIABLE** | P2 — phụ thuộc class thực tế component render. |

### 4.7 Product card (`.product--item-*` / `.wp-product-*` / `.wp-fp-item`)

WP source ([`styles/custom.css`](../../bigbike_vn__2026_04_17/files/wp-content/themes/bigbike/styles/custom.css) + [`styles/home.css`](../../bigbike_vn__2026_04_17/files/wp-content/themes/bigbike/styles/home.css)):

```
.product .product--item-title       { font-size:1rem; font-family:Oswald,sans-serif; font-weight:600 }
.product .product--item-title a     { color:#000 }
body .product .product--item-title a{ font-size:16px }
body .product .product--item-price  { font-family:Oswald,sans-serif; color:#ff0c09; font-size:14px; font-weight:600; text-align:left }
body .product .product--item-price p{ margin:0 20px 0 0; font-size:14px; line-height:1.214rem; display:inline-block }
.product .product--item-price p.old { color:#cecece; text-decoration:line-through }
.product .product--item-category    { color:#ff0c09; font-weight:600; font-family:Oswald,sans-serif } (home.css)
.product .product--item-cart a      { color:#fff; font-family:Oswald,sans-serif; text-transform:uppercase; padding:15px 0 } (home.css)
.product .product--item-sale p      { line-height:42px; background:#ff0c09; color:#fff } (home.css)
```

bigbike-web source ([`app/globals.css:4250-4256`](../../bigbike-web/app/globals.css#L4250)):

```
.wp-product-brand { font-family: var(--bb-font-display); font-size: 11px; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; color: var(--bb-brand-primary) }
.wp-product-name  { font-family: var(--bb-font-display); font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.02em; line-height: 1.3; color: var(--bb-text-primary); … }
.wp-product-rating{ font-size: 11px; color: var(--bb-brand-primary); letter-spacing: 0.1em }
.wp-product-price b { color: var(--bb-brand-primary); font-weight: 700; font-size: 16px }
.wp-product-price s { color: var(--bb-text-muted); font-size: 12px }
.wp-product-tag   { font-family: var(--bb-font-display); font-weight: 600; font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; … }
.wp-product-addbar{ font-family: var(--bb-font-display); font-size: 14px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; … }
```

| Element | Property | WP | bigbike-web | Match | Severity |
|---|---|---|---|---|---|
| Product title | `font-family` | `Oswald, sans-serif` | `var(--bb-font-display)` = **Barlow Condensed** | **MISMATCH** | **P1** |
| Product title | `font-size` | `1rem`=16px (rule 1) → override `16px` (rule body) | `14px` | **MISMATCH** | **P1** |
| Product title | `font-weight` | `600` | `600` | **MATCH** | — |
| Product title | `text-transform` | (không set ở WP; tên sp giữ nguyên capitalization) | `uppercase` | **MISMATCH** | **P1** |
| Product title | `line-height` | (kế thừa body = 1.5) | `1.3` | **MISMATCH** | P3 |
| Product title | `letter-spacing` | (không set) | `0.02em` | **MISMATCH** | P3 |
| Product title link | `color` | `#000` | `var(--bb-text-primary)` = `#000` | **MATCH** | — |
| Product price (chính) | `font-family` | `Oswald, sans-serif` | (không set ở `.wp-product-price b`; kế thừa body = Barlow) | **MISMATCH** | **P1** |
| Product price | `color` | `#ff0c09` | `var(--bb-brand-primary)` = `#ff0c09` | **MATCH** | — |
| Product price | `font-size` | `14px` | `16px` | **MISMATCH** | **P1** |
| Product price | `font-weight` | `600` | `700` | **MISMATCH** | **P1** |
| Product price | `text-align` | `left` (WP override body) | (không set, kế thừa `display:flex; align-items:baseline` của parent) | **PARTIAL** | P3 |
| Product price (old/strike-through) `p.old` / `s` | `color` | `#cecece` | `var(--bb-text-muted)` = `#abb8c3` | **MISMATCH** | P2 |
| Product price old | `font-size` | `14px` (kế thừa) | `12px` ([`app/globals.css:4256`](../../bigbike-web/app/globals.css#L4256)) | **MISMATCH** | P2 |
| Product price old | `text-decoration` | `line-through` (cả 2 đều dùng `<s>`/`<del>`) | `line-through` (browser default cho `<s>`) | **MATCH** | — |
| Product category/brand | `font-family` | `Oswald, sans-serif` | `var(--bb-font-display)` = Barlow Condensed | **MISMATCH** | **P1** |
| Product category/brand | `color` | `#ff0c09` | `var(--bb-brand-primary)` = `#ff0c09` | **MATCH** | — |
| Product category/brand | `font-size` | (kế thừa) | `11px` | **MISMATCH** | P2 |
| Product category/brand | `letter-spacing` | (không set) | `0.12em` | **MISMATCH** | P2 |
| Product category/brand | `text-transform` | (không set; nhiều product hiển thị giữ cấp chữ) | `uppercase` | **MISMATCH** | P2 |
| Product cart CTA (add-to-cart slide-up) | `font-family` | `Oswald, sans-serif` | `var(--bb-font-display)` = Barlow Condensed | **MISMATCH** | **P1** |
| Product cart CTA | `font-size` | (kế thừa 16) | `14px` | **MISMATCH** | P2 |
| Product cart CTA | `text-transform` | `uppercase` | `uppercase` | **MATCH** | — |
| Product sale badge `p` | `line-height` | `42px` (badge cao 42px) | `1` ([`app/globals.css:4242`](../../bigbike-web/app/globals.css#L4242)) | **MISMATCH** | P2 |
| Product sale badge | `font-size` | (kế thừa) | `12px` | **PARTIAL** | P2 |

### 4.8 Product listing / category page

| Element | Property | WP | bigbike-web | Match | Severity | Note |
|---|---|---|---|---|---|---|
| Category page title (`.page-title h1`) | `font-size` | `4.375rem` (~70px) default, override `body .page-title h1{font-size:24px}` ⇒ **`24px`** ([`styles/custom.css`](../../bigbike_vn__2026_04_17/files/wp-content/themes/bigbike/styles/custom.css)) | `clamp(1.375rem, 5vw, 2.8rem)` = `22–44.8px` ([`app/globals.css:4399`](../../bigbike-web/app/globals.css#L4399)) | **MISMATCH** | **P1** | bigbike-web scaling responsive còn WP cố định ở 24px |
| Category page title | `font-family` | (kế thừa, Barlow) | `var(--bb-font-display)` = Barlow Condensed ([`app/globals.css:4399`](../../bigbike-web/app/globals.css#L4399)) | **MISMATCH** | **P1** | |
| Category page title | `font-weight` | `600` ([`styles/custom.css`](../../bigbike_vn__2026_04_17/files/wp-content/themes/bigbike/styles/custom.css)) | (không set tường minh, fallback `b,h1…strong{font-weight:600}` nếu tag h1) | **PARTIAL** | P2 | |
| Category page title | `text-transform` | (không set ở WP) | `uppercase` | **MISMATCH** | P1 | |
| Category page title | `color` | (kế thừa, đen) | `var(--bb-text-primary)` = `#000` ([`app/globals.css:7017`](../../bigbike-web/app/globals.css#L7017)) | **MATCH** | — | |
| `.product-filter` button | `font-family` | `Oswald, sans-serif` ([`styles/home.css`](../../bigbike_vn__2026_04_17/files/wp-content/themes/bigbike/styles/home.css)) | NOT_VERIFIABLE — class trong bigbike-web là `CatalogFilters.tsx` | **NOT_VERIFIABLE** | P2 | Cần kiểm chi tiết component, ngoài phạm vi static CSS audit. |
| `.product-filter` button | `text-transform` | `uppercase` | NOT_VERIFIABLE | **NOT_VERIFIABLE** | P2 | |

### 4.9 Product detail page (PDP)

WP source ([`styles/product-detail.css`](../../bigbike_vn__2026_04_17/files/wp-content/themes/bigbike/styles/product-detail.css) + custom.css):

```
.product-information .title h1 { font-family: Oswald, sans-serif }
.product-information .size .group .group-label { font-size:24px; font-weight:600; font-family:Oswald,sans-serif; line-height:52px }
.product-information .price p del { color:#cecece }
.product-information .price p ins { text-decoration:none; margin-top:5px; display:block }
```

| Element | Property | WP | bigbike-web | Match | Severity |
|---|---|---|---|---|---|
| PDP product `h1` (`.product-information .title h1`) | `font-family` | `Oswald` | NOT_VERIFIABLE — cần xem `PricingPanel.tsx` + class | **NOT_VERIFIABLE** | P1 |
| PDP variant/size group label | `font-size` | `24px` | NOT_VERIFIABLE | **NOT_VERIFIABLE** | P2 |
| PDP variant group label | `font-family` | `Oswald` | NOT_VERIFIABLE | **NOT_VERIFIABLE** | P2 |
| PDP `del` (old price) | `color` | `#cecece` | `var(--bb-text-muted)` (tương đương `#abb8c3`) | **MISMATCH** | P2 |
| PDP `ins` (new price) | `text-decoration` | `none` | (default `underline` cho `<ins>` nếu không set) | **NOT_VERIFIABLE** | P2 |

### 4.10 Blog / news (list + detail)

WP: `.news--item-inside h3{font-size:1.25rem;line-height:1.5rem;font-weight:600;font-family:Oswald,sans-serif}`. Date badge `.news-date p{text-transform:uppercase;font-family:Oswald,sans-serif;color:#fff;background:#ff0c09}`.

bigbike-web: `.wp-news-section`, `.wp-news-card`, `.wp-article-card`, `.wp-news-heading`, `.wp-news-block-title`, `.wp-news-kicker` — định nghĩa trong globals.css block DESIGN.md (lines ~8194-8225).

| Element | Property | WP | bigbike-web | Match | Severity |
|---|---|---|---|---|---|
| News card title | `font-family` | `Oswald` | `var(--bb-font-heading)` = Barlow ([`app/globals.css:8207`](../../bigbike-web/app/globals.css#L8207)) | **MISMATCH** | **P1** |
| News card title | `font-size` | `1.25rem` (~20px) | (NOT_VERIFIABLE riêng card title — `.wp-news-heading` định nghĩa ngoài card scope) | **NOT_VERIFIABLE** | P2 |
| News card title | `line-height` | `1.5rem` (~24px) | `1.5` | **PARTIAL** | P3 |
| News date badge | `font-family` | `Oswald` | NOT_VERIFIABLE | **NOT_VERIFIABLE** | P2 |
| News date badge | `text-transform` | `uppercase` | NOT_VERIFIABLE | **NOT_VERIFIABLE** | P2 |
| News date badge | `font-weight` | `600` | NOT_VERIFIABLE | **NOT_VERIFIABLE** | P2 |

### 4.11 Static / policy / about pages

WP source (`page-static.php`, `page-about.php` + style `.seo-block-content` trong custom.css):
```
.seo-block-content .content-block h2 span { font-size:18px; font-weight:600 }
.seo-block-content .content-block h3 span { font-size:16px; font-weight:600 }
.seo-block-content .content-block li, .seo-block-content .content-block p { font-size:14px; color:#6f6f6f }
```

bigbike-web `.bb-richtext` ở [`styles/brand-tokens.css:589-670`](../../bigbike-web/styles/brand-tokens.css#L589):
```
.bb-richtext        { font-family: var(--bb-font-body); font-size: var(--bb-text-base) (=16.002px); line-height: 24.003px }
.bb-richtext h2     { font-family: var(--bb-font-heading); font-size: var(--bb-text-h2)=24px; font-weight:600; line-height:1.5; text-transform:uppercase }
.bb-richtext h3-h6  { font-family: var(--bb-font-cta) (Oswald); font-size: --bb-text-h3=18px (h3) | --bb-text-lg=18px (h4) | …; font-weight:600; line-height:20px; text-transform:uppercase }
.bb-richtext a      { color: var(--bb-color-blue); text-decoration: underline }
```

| Element | Property | WP | bigbike-web | Match | Severity |
|---|---|---|---|---|---|
| Body p in static block | `font-size` | `14px` | `16.002px` | **MISMATCH** | **P1** |
| Body p in static block | `color` | `#6f6f6f` | `var(--bb-text-primary)` = `#000` ([`styles/brand-tokens.css:590`](../../bigbike-web/styles/brand-tokens.css#L590)) | **MISMATCH** | P2 |
| `h2` in rich content | `font-size` | `18px` (.content-block h2 span) | `24px` (--bb-text-h2) | **MISMATCH** | **P1** |
| `h2` | `text-transform` | (không set) | `uppercase` | **MISMATCH** | P2 |
| `h2` | `font-family` | (kế thừa Barlow ?) | `var(--bb-font-heading)` = Barlow | **MATCH** | — |
| `h3` | `font-size` | `16px` (.content-block h3 span) | `18px` (--bb-text-h3) | **MISMATCH** | P2 |
| `h3` | `font-family` | (kế thừa) | `var(--bb-font-cta)` = Oswald | **MISMATCH** | P2 |
| `h3` | `text-transform` | (không set) | `uppercase` | **MISMATCH** | P2 |

### 4.12 Breadcrumb

WP source ([`styles/custom.css`](../../bigbike_vn__2026_04_17/files/wp-content/themes/bigbike/styles/custom.css)):
```
.breadcrumb ul li        { display:inline-block; color:#cecece }
.breadcrumb ul li a, span{ color:#cecece }
body .breadcrumb ul li a,
body .breadcrumb ul li span { color:#717171 }
body .breadcrumb ul li a    { font-weight:600 }
.page-title .breadcrumb ul li{ color:#fff }
```
→ Default WP breadcrumb: chữ `#717171` (xám đậm), link `font-weight:600`, **không** uppercase, **không** đổi size (kế thừa 16px body).

bigbike-web source ([`app/globals.css:4372-4392`](../../bigbike-web/app/globals.css#L4372)):
```
.wp-breadcrumb { … font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--bb-text-muted) }
.wp-breadcrumb a { color: var(--bb-text-muted); text-decoration: none }
.wp-breadcrumb a:hover { color: var(--bb-brand-primary) }
.wp-breadcrumb .sep { … color: var(--bb-brand-primary) }
.wp-breadcrumb-active { color: var(--bb-text-primary) }
```

| Property | WP | bigbike-web | Match | Severity |
|---|---|---|---|---|
| `font-size` | (kế thừa body = 16px) | `11px` | **MISMATCH** | **P1** |
| `letter-spacing` | (không set = 0) | `0.08em` | **MISMATCH** | **P1** |
| `text-transform` | (không set) | `uppercase` | **MISMATCH** | **P1** |
| `color` | `#717171` | `var(--bb-text-muted)` = `#abb8c3` | **MISMATCH** | **P1** |
| Link `font-weight` | `600` | (không set, kế thừa = 400) | **MISMATCH** | P2 |
| Link `text-decoration` | (none, mặc định a-link reboot) | `none` | **MATCH** | — |
| Separator color | (không set ở WP) | `var(--bb-brand-primary)` = `#ff0c09` | **MISMATCH** | P3 |

→ Breadcrumb hiện tại trong bigbike-web có cảm giác "tag-line nhỏ uppercase letter-spaced" thay vì "đường link xám body-size". Đây là pattern thiết kế hiện đại nhưng **khác hẳn WP cũ**.

### 4.13 Button — CTA

WP source ([`styles/main.css`](../../bigbike_vn__2026_04_17/files/wp-content/themes/bigbike/styles/main.css)):
```
.btn          { width:170px; line-height:52px; text-decoration:none; display:inline-block; font-family:Barlow Condensed,sans-serif; color:#000; padding:0; font-weight:600; border-radius:0; opacity:1 }
.btn-red, .btn-white { color:#fff }
.btn-red      { background-color:#ff0c09 }
.btn-submit   { height:62px; background-color:#ff0c09; color:#fff; line-height:62px; padding:0 }
.newletters form .form-group button[type=submit] { background:#ff0c09; color:#fff; font-family:Barlow Condensed,sans-serif; font-size:1.143rem; font-weight:500; text-transform:uppercase; height:3.714rem; … }
```

bigbike-web source ([`styles/brand-tokens.css:387-474`](../../bigbike-web/styles/brand-tokens.css#L387)):
```
.bb-button       { font-family: var(--bb-font-cta) (Oswald); font-size: 16px; font-weight: 600; line-height: 24px; letter-spacing: 0; text-decoration: none; text-transform: uppercase; … }
.bb-button-primary{ background: var(--bb-brand-primary); color: var(--bb-color-white) }
```

| Property | WP | bigbike-web | Match | Severity |
|---|---|---|---|---|
| `font-family` | **Barlow Condensed** (chính cho `.btn`) hoặc form submit | **Oswald** (`--bb-font-cta`) | **MISMATCH** | **P1** |
| `font-size` | (default 16px từ body kế thừa cho `.btn`; form submit `1.143rem`) | `16px` | **PARTIAL** | P2 |
| `font-weight` | `600` (`.btn`) / `500` (newsletter submit) | `600` | **PARTIAL** | P2 |
| `text-transform` | (`.btn` không set; submit `uppercase`) | `uppercase` (always) | **MISMATCH** | P2 |
| `line-height` | `52px` (cố định cho `.btn`) | `24px` | **MISMATCH** | P2 |
| `letter-spacing` | (không set) | `0` (token) — không khác | **MATCH** | — |
| `color` | `#000` (.btn default) / `#fff` (red/white variants) | `#fff` cho primary, `#0c5460` cho woocommerce-form-coupon-toggle a, … | **PARTIAL** | P3 |

### 4.14 Form / input / label

WP source ([`styles/custom.css`](../../bigbike_vn__2026_04_17/files/wp-content/themes/bigbike/styles/custom.css)):
```
.webform .form-group input[type=text|email|tel|password] { height:40px; font-size:14px; border-color:#dfdfdf; … }
.check-out-form .form-row label { font-size:14px; margin-bottom:5px }
.check-out-form .form-row input { width:100%; height:52px; border:solid 1px #cecece; padding:0 20px }
```

bigbike-web source ([`styles/brand-tokens.css:495-518`](../../bigbike-web/styles/brand-tokens.css#L495)):
```
.bb-input { min-height: 48px; padding: 12px 16px; font-family: var(--bb-font-link); font-size: 16px; font-weight: 400; line-height: 24px; color: var(--bb-color-black) }
.bb-input::placeholder { color: var(--bb-color-gray-400) }
```

| Property | WP | bigbike-web | Match | Severity |
|---|---|---|---|---|
| Input `font-size` | `14px` (webform) / kế thừa 16 (checkout) | `16px` | **MISMATCH** | **P1** (cũng có yếu tố a11y — iOS auto-zoom dưới 16px) |
| Input `font-family` | `Barlow` (kế thừa body — Bootstrap reboot có `input{font-family:inherit}`) | `var(--bb-font-link)` = Barlow | **MATCH** | — |
| Input `color` | `#666` (style.css `input[type=text]…{color:#666}`) / `#111` khi focus / `#000` cho login | `#000` | **MISMATCH** | P2 |
| Input border | `1px solid #dfdfdf` / `#cecece` | `1px solid var(--bb-border-subtle)` = `#dddddd` | **MISMATCH** | P3 (out-of-typography-scope nhưng ảnh hưởng visual) |
| Form label `font-size` | `14px` | (không set tường minh) | **NOT_VERIFIABLE** | P2 |
| Placeholder color | (không set ở WP — browser default xám) | `var(--bb-color-gray-400)` = `#abb8c3` | **PARTIAL** | P3 |
| Search input `font-size` (active overlay) | `24px` (`header .user-control--item.search form input { font-size:24px }`) | (NOT_VERIFIABLE — component `SearchToggle.tsx`) | **NOT_VERIFIABLE** | P2 |

### 4.15 Badge / tag / chip

WP: `.product--item-sale p { … color:#fff }`, không có hệ thống badge chung.

bigbike-web ([`styles/brand-tokens.css:520-555`](../../bigbike-web/styles/brand-tokens.css#L520) + [`app/globals.css:4266-4269`](../../bigbike-web/app/globals.css#L4266)):
```
.bb-badge        { font-family: var(--bb-font-link); font-size: 12px; font-weight: 700; letter-spacing: 0; text-transform: uppercase; … }
.bb-badge (in globals) { font-size: 11px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase }
```

| Property | WP | bigbike-web | Match | Severity |
|---|---|---|---|---|
| Badge `font-family` | (kế thừa body) | `var(--bb-font-link)` = Barlow | **MATCH** | — |
| Badge `font-size` | (kế thừa) | `11px`/`12px` (2 nguồn lệch nhau giữa brand-tokens.css và globals.css) | **MISMATCH** | P2 |
| Badge `font-weight` | (kế thừa = 400) — WP product sale dùng font kế thừa | `700` | **MISMATCH** | P2 |
| Badge `text-transform` | (không set, theo content) | `uppercase` | **MISMATCH** | P2 |
| Badge `letter-spacing` | (không set) | `0` (brand-tokens) / `0.06em` (globals) | **MISMATCH** | P3 |

### 4.16 Tabs / pagination / modal / dropdown

| Element | WP | bigbike-web | Match | Severity | Note |
|---|---|---|---|---|---|
| Product tabs nav text (`.tabs-nav`) | NOT_VERIFIABLE (chưa extract custom.css đầy đủ) | `ProductTabs.tsx` | **NOT_VERIFIABLE** | P2 | Component-driven, cần runtime. |
| Pagination text | NOT_VERIFIABLE | `PaginationNav` (component) | **NOT_VERIFIABLE** | P2 | |
| Modal/dropdown text | NOT_VERIFIABLE | nhiều variant — `MobileHeaderMenu`, `QuickBuyModal`, `HeaderUserMenu` | **NOT_VERIFIABLE** | P2 | |

### 4.17 Empty / loading / error state text

`.wp-empty-state`, `.bb-empty-state`, `.bb-error-state` được mention ở [`app/globals.css:8142-8143`](../../bigbike-web/app/globals.css#L8142). WP không có pattern tương đương rõ ràng (mostly "no results" inline text trong template).

| Element | WP | bigbike-web | Match | Severity |
|---|---|---|---|---|
| Empty state text | "Không có sản phẩm" inline trong template, font kế thừa | Component có style riêng | **NOT_VERIFIABLE** | P3 |

### 4.18 Hover / focus / active / disabled states

| State | WP | bigbike-web | Match | Severity |
|---|---|---|---|---|
| Nav `:hover` color | `#ff0c09` (`.navigation--item>a:hover`) | `var(--bb-brand-primary)` = `#ff0c09` | **MATCH** | — |
| Link `:hover` global | `#0056b3` (Bootstrap reboot) | `var(--bb-brand-primary)` = `#ff0c09` | **MISMATCH** | P2 |
| Button `:focus-visible` outline | (WP có `[tabindex="-1"]:focus:not(:focus-visible){outline:0!important}` từ Bootstrap reboot, các button focus dùng outline auto) | `outline: var(--bb-focus-outline)` = `2px solid var(--bb-color-blue)` ([`styles/brand-tokens.css:416-418`](../../bigbike-web/styles/brand-tokens.css#L416)) | **MISMATCH** | P3 |
| Disabled button text | (WP tương đối ít disabled state) | `opacity: 1; transform: none` ([`styles/brand-tokens.css:420-425`](../../bigbike-web/styles/brand-tokens.css#L420)) — note: opacity 1, không mờ disabled — UX không clear |  **NOT_VERIFIABLE** | P2 |

### 4.19 Pseudo elements `::before`, `::after`

Cả 2 codebase chủ yếu dùng `::after` cho:
- Diamond marker giữa nav items (WP `.navigation--item:after` ↔ bigbike-web `.wp-navigation-item::after`) — **MATCH** (cùng 5×5px, rotate 45deg, bg #ff0c09).
- Icon Font Awesome (WP) ↔ Lucide React (bigbike-web). Sự khác biệt thuộc icon system, không thuộc typography text scope.

→ Không phát hiện text-content pseudo-element mismatch nghiêm trọng trong scope text/typography.

### 4.20 Modern/supporting text properties

| Property | WP | bigbike-web | Match | Note |
|---|---|---|---|---|
| `text-overflow` | Có dùng ở `.product-filter a span { text-overflow: ellipsis }` (home.css) | Không tìm thấy use case trùng selector | **NOT_VERIFIABLE** | Component-driven |
| `writing-mode` | (không set) | (không set) | **MATCH** | — |
| `text-orientation` | (không set) | (không set) | **MATCH** | — |
| `tab-size` | (không set) | (không set) | **MATCH** | — |
| `text-align-last` | (không set) | (không set) | **MATCH** | — |
| `text-decoration-thickness` / `-style` / `-color` | (không set) | `a { text-decoration-thickness: 1px }` ở [`app/globals.css:8114`](../../bigbike-web/app/globals.css#L8114) | **MISMATCH** | P3 — visual không khác nếu không có underline |
| `text-underline-offset` | (không set) | `2px` ([`app/globals.css:8115`](../../bigbike-web/app/globals.css#L8115) + `.bb-richtext a { text-underline-offset: 2px }`) | **MISMATCH** | P3 |
| `text-shadow` | (không set ở cả 2) | (không set) | **MATCH** | — |
| `text-indent` | (không set ở cả 2) | (không set) | **MATCH** | — |
| `vertical-align` | `sub, sup` từ normalize/style.css | (không override) | **MATCH** | — |
| `hyphens` | (không set) | (không set) | **MATCH** | — |
| `word-break` | (không set ở body) | (không set ở body, có ở `.wp-page-head h1 { overflow-wrap: anywhere }` line 4399) | **MISMATCH** | P3 |

### 4.21 `@font-face` shorthand vs separate properties

| Aspect | WP | bigbike-web | Match | Note |
|---|---|---|---|---|
| Font loading method | Inline `<style>@font-face …</style>` trong `footer.php` với WOFF base64 (Barlow, Barlow Condensed, Oswald) | `next/font/google` (Barlow, Barlow Condensed, Oswald) via `app/layout.tsx` ⇒ CSS variables `--font-barlow`, `--font-barlow-condensed`, `--font-oswald` | **DIFFERENT_METHOD_SAME_FONT** | Cùng family name; binary file khác nhau (WOFF base64 vs Next-hosted woff2) — visual có thể khác sub-pixel tùy hinting. |
| `font-display` | (không set ở @font-face WP — default `auto`) | `display: "swap"` ở next/font config | **MISMATCH** | P2 — WP có FOIT, bigbike-web có FOUT. |
| Weight nạp | WP nạp 1-2 weight per family (Barlow Light, Regular, SemiBold, Bold; Oswald Medium, SemiBold; Barlow Condensed 4 variants — extract từ fonts.css comment) | Barlow 300-700 (full range), Barlow Condensed 400-700, Oswald 400-700 | **PARTIAL** | bigbike-web có nhiều weight hơn, nhưng usage thực tế phụ thuộc rule áp dụng. |
| Subset | (WP không set subset; chỉ latin) | `subsets: ["latin", "vietnamese"]` | **PARTIAL** | bigbike-web tốt hơn cho VN nhưng visual khác nếu font glyph được swap. |

---

## 5. Phase 4 — Runtime computed style verification

### 5.1 Trạng thái

**KHÔNG CHẠY ĐƯỢC**.

Lý do:

1. **WordPress cũ**: Không có instance đang chạy local. Để chạy lại cần:
   - PHP 7.4+ / 8.x
   - MySQL/MariaDB
   - Restore `bigbike_vn__2026_04_17/sqldump.sql`
   - Cấu hình `wp-config.php`, PolyLang, WooCommerce
   - Resolve dependency của các plugin (Permalink Manager Pro, Wordfence, …)

2. **bigbike-web**: Có thể chạy `next dev` local nhưng:
   - Playwright chưa được cài (`package.json` không khai báo).
   - Cài Playwright + Chromium sẽ download ~150MB và thêm dependency — vi phạm "không sửa code".
   - Backend `bigbike-backend` cần chạy song song để API trả dữ liệu (product, menu, sliders, news).

3. **Audit này** vì vậy dừng ở **static CSS analysis**. Mọi finding ghi `MATCH/MISMATCH` đều dựa trên CSS source và cascade trên giấy, chưa phải computed style runtime. Một số dòng được đánh `NOT_VERIFIABLE` ở cột match khi không thể xác định bằng đọc CSS đơn thuần.

### 5.2 Khuyến nghị để hoàn tất Phase 4

```
1. Khôi phục WP cũ local
   - docker-compose up wp-php + wp-mysql
   - WP-CLI: wp db import sqldump.sql; wp option update home http://localhost:8080
   - Test render trang chủ + /san-pham + /tin-tuc + /lien-he

2. Cài Playwright (dev-only) trong bigbike-web
   - npm i -D @playwright/test
   - npx playwright install chromium

3. Viết script `scripts/typography-audit.ts`
   - Mở từng URL ở 3 viewport (375, 768, 1440)
   - Selector list: body, h1, h2, h3, p, a, button, .wp-navigation-item > a, .wp-product-name, .wp-product-price b, .wp-breadcrumb, … (xem §4)
   - Với mỗi selector: getComputedStyle() và dump JSON
   - So sánh JSON WP vs JSON bigbike-web bằng diff script
```

Đầu ra cuối cùng: bảng diff "WP computed vs Next computed" — sẽ là "ground truth" để chốt mọi `NOT_VERIFIABLE` thành `MATCH`/`MISMATCH`.

---

## 6. Phase 6 — Design tokens / drift analysis

### 6.1 Tokens được mirror

[`bigbike-web/styles/brand-tokens.css:53-59`](../../bigbike-web/styles/brand-tokens.css#L53) explicitly mirror các `--theme-*` của WP:

```
--theme-white: #fff;       → MATCH WP --theme-white
--theme-black: #000;       → MATCH WP --theme-black
--theme-gray:  #6f6f6f;    → MATCH WP --theme-gray
--theme-red:   #ff0c09;    → MATCH WP --theme-red
--theme-size:  14px;       → MATCH WP --theme-size (cả 2 đều không áp lên body — orphan token)
--theme-font:  Barlow      → MATCH WP --theme-font
--theme-font-second: Barlow Condensed → MATCH WP --theme-font-second
```

→ **Token cấp legacy đã mirror đúng.** Vấn đề nằm ở các **rule sử dụng** không referencing `--theme-font`/`--theme-font-second` mà tạo `--bb-font-*` chain riêng (xem 6.2).

### 6.2 Token mới được tạo và drift

| bigbike-web token | Value | Áp dụng vào | Drift so với WP |
|---|---|---|---|
| `--bb-font-display` | Barlow Condensed → Barlow → Helvetica → sans-serif | section title, h1-h2 hero, product brand, badges, product name, addbar, page hero h1 | **DRIFT**: WP rule gốc cho phần lớn các vùng này là **Oswald**, không phải Barlow Condensed. |
| `--bb-font-heading` | Barlow → Segoe UI → -apple-system → BlinkMacSystemFont → sans-serif | DESIGN.md block — section title, page h1, news heading | **DRIFT**: WP gốc `Oswald` cho `.block-title h3`, `.product-information .title h1`, `.news--item-inside h3`. |
| `--bb-font-body` | Barlow → Segoe UI → … | body | **MATCH** (Barlow primary) |
| `--bb-font-link` | Barlow → … | input, badge, breadcrumb (a-tag) | **PARTIAL**: WP input kế thừa Barlow nên match; nhưng `.bb-badge` family WP gốc kế thừa body cũng OK. |
| `--bb-font-cta` | Oswald → Helvetica Neue → Arial → sans-serif | `.bb-button`, `.bb-richtext h3+`, `.wp-product-addbar` (qua `--bb-font-display`? Không. Qua `var(--bb-font-display)`) | **DRIFT**: WP `.btn` dùng **Barlow Condensed**, không phải Oswald — bigbike-web đảo ngược: dùng Oswald cho button. |
| `--bb-font-nav` | Barlow → … | `.wp-navigation` | **DRIFT**: WP `.navigation` font-family **Barlow Condensed**. |
| `--bb-text-base` | `16.002px` | body | **DRIFT 0.002px**: WP body `16px`. |
| `--bb-text-h1` | `32px` (desktop) → `24px` (576-991) → `20px` (<576) | (gián tiếp qua `.bb-h1`) | **DRIFT**: WP page-title h1 = `24px` cố định khi body override. |
| `--bb-text-h2` | `24px` → `24px` → `18px` | `.bb-h2`, `.bb-richtext h2` | **DRIFT**: WP h2 trong static page = `18px` từ `.content-block h2 span`. |
| `--bb-text-h3` | `18px` | `.bb-h3`, `.bb-richtext h3` | **DRIFT**: WP h3 = `16px` trong static page. |
| `--bb-line-body` | `1.5` | body | **MATCH** với WP body line-height. |
| `--bb-line-heading` | `1.5` | heading | **DRIFT**: WP heading line-height tùy nơi: `.block-title h3` = `4.286rem` (68.6px), `.news--item-inside h3` = `1.5rem`, `.product--item-title` = kế thừa. |
| `--bb-letter-tight/normal/wide/display` | `0` | (tokens cho letter-spacing) | **MATCH**: WP cũng phần lớn không letter-spacing. Tuy nhiên trong globals.css có override `letter-spacing: 0.02em / 0.08em / 0.12em / 0.06em` ở nhiều vị trí `.wp-product-name`, `.wp-product-tag`, `.wp-product-brand`, `.bb-badge` → **DRIFT thực tế tại site usage.** |

### 6.3 Kết luận drift

- **Token mirror cấp 1 (`--theme-*`)**: ĐÚNG.
- **Token sản phẩm cấp 2 (`--bb-font-*`)**: bigbike-web tạo bộ token MỚI không bám sát mapping của WP.
  - WP đã dùng **Oswald cho headings/CTA/product-card-titles/category links** rất nhất quán; bigbike-web map Oswald → CTA only và đẩy headings sang Barlow/Barlow Condensed → mismatched semantics.
  - WP đã dùng **Barlow Condensed cho navigation và button `.btn`**; bigbike-web map ngược: Barlow Condensed → display headings (`--bb-font-display`), Oswald → CTA buttons (`--bb-font-cta`).
- **Hệ quả**: dù binary font giống nhau, mọi vùng UI có font-family áp khác nhau → kết quả render khác. Hai font Oswald (geometric, condensed serif-less, "racing" feel) và Barlow Condensed (humanist, narrower) có visual personality rất khác → **đây là root cause của P1 mismatch nhiều mục.**

### 6.4 Hard-code drift trong component-level CSS

Ngoài drift do token, có các giá trị hard-code trong `app/globals.css` không qua token, tạo thêm độ lệch:

| Vị trí | Hard-code | WP value | Severity |
|---|---|---|---|
| [`app/globals.css:8110`](../../bigbike-web/app/globals.css#L8110) — `body { line-height: 24.003px }` | `24.003px` | `1.5` (= 24px chính xác) | P3 |
| [`styles/brand-tokens.css:362`](../../bigbike-web/styles/brand-tokens.css#L362) — `.bb-body { line-height: 24.003px }` | `24.003px` | (n/a) | P3 (orphan precision) |
| [`styles/brand-tokens.css:317`](../../bigbike-web/styles/brand-tokens.css#L317) — `.bb-display { line-height: 45px }` | `45px` | (n/a — WP page-title 4.375rem/—) | P2 |
| `.wp-product-name { line-height: 1.3; letter-spacing: 0.02em }` | hard-code | (kế thừa, không có letter-spacing) | P3 |
| `.wp-breadcrumb { font-size: 11px }` | `11px` | kế thừa 16px | **P1** |
| `.wp-product-price b { font-size: 16px; font-weight: 700 }` | hard-code | `14px` / `600` | **P1** |

---

## 7. Phase 5 — Mismatch matrix

### 7.1 Theo property

| Property | Tổng số mismatch | Vùng UI bị ảnh hưởng |
|---|---|---|
| `font-family` | 9 | body (PARTIAL), nav, sub-menu, section title, product card title, product price, product cart CTA, news card title, button |
| `font-size` | 11 | body (0.002px), nav, product title, product price (chính + cũ), category title, static h2/h3/p, breadcrumb, badge, input |
| `font-weight` | 5 | nav, product price, breadcrumb a, badge, button (PARTIAL) |
| `color` | 6 | body, link global, footer text+links, breadcrumb, static p, link hover |
| `text-transform` | 6 | nav (MATCH), product title, breadcrumb, static h2/h3, badge, category title |
| `line-height` | 5 | body (0.003px), nav, section title, sub-menu link, product title |
| `letter-spacing` | 5 | product title, product brand, breadcrumb, badge, product tag/addbar |
| `text-decoration*` | 3 | link global, a underline-offset, decoration-thickness |
| `text-decoration` value | 2 | `.bb-richtext a` (underline) vs WP `a` (none) |
| `text-align` | 1 | product price |
| `-webkit-text-size-adjust` | 1 | html (WP set 100%, Next không) |
| `word-break/overflow-wrap` | 1 | `.wp-page-head h1` |

### 7.2 Theo page / component

| Vùng | Mismatch P0 | Mismatch P1 | Mismatch P2 | Mismatch P3 | Tổng MISMATCH |
|---|---:|---:|---:|---:|---:|
| Body / global | 1 (color) | 0 | 0 | 4 | 5 |
| Anchor / link global | 0 | 1 | 1 | 2 | 4 |
| Header navigation | 0 | 4 | 1 | 1 | 6 |
| Header sub-menu | 0 | 1 | 0 | 1 | 2 |
| Footer | 0 | 4 | 2 | 0 | 6 |
| Homepage section title | 0 | 3 | 1 | 1 | 5 |
| Product card | 0 | 5 | 4 | 3 | 12 |
| Category/listing page title | 0 | 3 | 1 | 0 | 4 |
| Breadcrumb | 0 | 4 | 1 | 1 | 6 |
| Static / rich content | 0 | 2 | 4 | 0 | 6 |
| Button CTA | 0 | 1 | 4 | 1 | 6 |
| Form input/label | 0 | 1 | 2 | 2 | 5 |
| Badge | 0 | 0 | 3 | 2 | 5 |
| Pseudo / decoration | 0 | 0 | 0 | 3 | 3 |
| **TỔNG** | **1** | **29** | **24** | **21** | **75** |

→ 75 mismatch đã được xác minh **chỉ qua static CSS**, chưa kể `NOT_VERIFIABLE` items.

### 7.3 Theo breakpoint

| Viewport | Đánh giá tổng quan (static) |
|---|---|
| Mobile 375px | bigbike-web có giảm `--bb-text-hero/h1/h2` qua @media (max-width: 575px) trong brand-tokens.css. WP có `body .block-title h3 { font-size: 24px; line-height: 30px }` ở `(max-width:767px)`. → Hai bộ rule áp dụng ở range khác nhau (575 vs 767) → có vùng overlap mà bigbike-web đã giảm size còn WP chưa giảm. **NOT_VERIFIABLE** ở 600-767px range mà không runtime. |
| Tablet 768px | Cả 2 đều đã out-of-mobile-tablet override → mostly desktop rules apply. **NOT_VERIFIABLE** chi tiết. |
| Desktop 1440px | Tất cả desktop rules apply. Các mismatch §4 đều ở range này. |

---

## 8. Not verifiable list

| # | Vùng | Lý do | Cần thêm gì để verify |
|---|---|---|---|
| NV-01 | Mobile drawer/menu link sizing | Component động (React state), CSS không phản ánh đầy đủ | Runtime Playwright + open drawer |
| NV-02 | News card title font-family (cảnh cụ thể) | `.wp-news-card *` rules nằm rải rác — chưa extract đủ class | Đọc thêm `app/globals.css` block news (~ line 7800-8000) + đối chiếu component |
| NV-03 | PDP product h1 font | Component `PricingPanel.tsx` render h1 với class nào? | Đọc component + match class với CSS rule |
| NV-04 | Tab nav font (`.tabs-nav`) | WP custom.css chưa extract phần này; bigbike-web `ProductTabs.tsx` chưa khảo sát | Trích thêm rules từ minified custom.css range tab |
| NV-05 | Pagination font | Component-driven | Đọc `PaginationNav.tsx` |
| NV-06 | Modal text (Quick Buy, Wishlist, Cart drawer) | Nhiều component, CSS scope khác | Runtime |
| NV-07 | Empty state / Loading text | Component-driven | Component đọc |
| NV-08 | Search overlay input `font-size:24px` đối chiếu | bigbike-web `SearchToggle.tsx` không có CSS rule match `24px` rõ ràng | Đọc component |
| NV-09 | Section subtitle `.block-title p.sub-title` | bigbike-web không có class equivalent rõ | Map class `.wp-section-kicker` vs WP |
| NV-10 | News date badge text | Component-driven | Đọc component + CSS |
| NV-11 | Form label font-size (mọi form) | Chưa extract đủ — phụ thuộc form component | Đọc form components |
| NV-12 | Browser-default differences ở mobile (iOS auto-zoom với input <16px) | WP set `-webkit-text-size-adjust:100%`, Next không | Runtime iOS |
| NV-13 | font-display swap khác biệt FOUT | Runtime measurement (LCP, FOIT/FOUT timing) | Lighthouse + WebPageTest |
| NV-14 | Cascade order khi class composing (e.g. `.wp-card.bb-card.wp-product-card`) | Static CSS đọc được nhưng số combination quá nhiều | Runtime |

---

## 9. Detailed findings (Top 20 P0-P1)

> Mỗi finding có ID, severity, vùng, property bị lệch, WP expected, bigbike-web actual, evidence path:line, recommendation (chỉ định hướng — KHÔNG được dùng để sửa code trong audit pass này).

### F-001 — Body color toàn site

- **Severity**: P0
- **Khu vực**: body global
- **Property**: `color`
- **WP expected**: `#000` (đen tuyệt đối)
- **bigbike-web actual**: `#6f6f6f` (xám)
- **Evidence**:
  - WP: rule 2 của body trong [`styles/main.css`](../../bigbike_vn__2026_04_17/files/wp-content/themes/bigbike/styles/main.css) — extract `body{font-size:1rem;font-family:Barlow,sans-serif;color:#000;background-color:#fff}`.
  - bigbike-web: [`app/globals.css:19`](../../bigbike-web/app/globals.css#L19) `color: var(--bb-text-secondary)`, [`app/globals.css:8107`](../../bigbike-web/app/globals.css#L8107) re-confirm.
- **Recommendation (direction only)**: Cân nhắc set `body.color: var(--bb-text-primary)` (mà `--bb-text-primary` = `#000`) để match WP. Hiện `--bb-text-secondary` (`#6f6f6f`) dành cho meta / muted text.

### F-002 — Header nav font-family

- **Severity**: P1
- **Khu vực**: Header desktop nav
- **Property**: `font-family`
- **WP expected**: `Barlow Condensed, sans-serif`
- **bigbike-web actual**: `var(--bb-font-nav)` = `Barlow, ...`
- **Evidence**:
  - WP: `header .navigation{font-family:Barlow Condensed,sans-serif;font-size:1.143rem}` (extract từ main.css)
  - bigbike-web: [`app/globals.css:1566`](../../bigbike-web/app/globals.css#L1566), [`styles/brand-tokens.css:136`](../../bigbike-web/styles/brand-tokens.css#L136)
- **Recommendation**: Đổi `--bb-font-nav` ⟶ Barlow Condensed primary.

### F-003 — Header nav font-size + font-weight

- **Severity**: P1
- **Property**: `font-size` 1.143rem (~18.3px) → 16px; `font-weight` 600 → 400
- **Evidence**:
  - WP: `.navigation--item>a{color:#fff;text-transform:uppercase;font-weight:600}` (extract)
  - bigbike-web: [`app/globals.css:1591`](../../bigbike-web/app/globals.css#L1591) đặt `font-weight:600`, **bị override** bởi [`app/globals.css:8285-8294`](../../bigbike-web/app/globals.css#L8285) DESIGN.md block đặt `font-size:16px; font-weight:400`.
- **Recommendation**: Trong DESIGN.md block, bỏ override nav-item font-size/weight, để rule line 1591 thắng.

### F-004 — Sub-menu link font-family (Oswald)

- **Severity**: P1
- **Property**: `font-family`
- **WP**: `Oswald, sans-serif`
- **bigbike-web**: `var(--bb-font-display)` = `Barlow Condensed`
- **Evidence**:
  - WP: extract `header .navigation ul .navigation--item>.sub-menu li a{padding:15px 30px;display:block;color:#6f6f6f;font-size:14px;font-weight:600;font-family:Oswald,sans-serif}` từ custom.css
  - bigbike-web: [`app/globals.css:1677`](../../bigbike-web/app/globals.css#L1677) `font-family: var(--bb-font-display)`
- **Recommendation**: Sub-menu nên dùng `--bb-font-cta` (Oswald) thay cho `--bb-font-display`.

### F-005 — Product card title font-family/size/transform/letter-spacing

- **Severity**: P1
- **Multi-property mismatch**
- **WP**: Oswald, 16px, no uppercase, no letter-spacing
- **bigbike-web**: Barlow Condensed, 14px, uppercase, 0.02em
- **Evidence**:
  - WP: [`styles/custom.css`](../../bigbike_vn__2026_04_17/files/wp-content/themes/bigbike/styles/custom.css) extract `.product .product--item-title{font-size:1rem;font-family:Oswald,sans-serif;font-weight:600}` và `body .product .product--item-title a{font-size:16px}`
  - bigbike-web: [`app/globals.css:4251`](../../bigbike-web/app/globals.css#L4251) `.wp-product-name { font-family: var(--bb-font-display); font-size: 14px; … text-transform: uppercase; letter-spacing: 0.02em; … }`
- **Recommendation**: Đổi `--bb-font-display` cho product-name → Oswald; bỏ uppercase + letter-spacing; size lên 16px.

### F-006 — Product price font-family/size/weight

- **Severity**: P1
- **WP**: Oswald, 14px, 600
- **bigbike-web**: (inherit body Barlow), 16px, 700
- **Evidence**:
  - WP: extract `body .product .product--item-price{font-family:Oswald,sans-serif;color:#ff0c09;font-size:14px;font-weight:600;text-align:left}` từ custom.css
  - bigbike-web: [`app/globals.css:4255`](../../bigbike-web/app/globals.css#L4255) `.wp-product-price b { color: var(--bb-brand-primary); font-weight: 700; font-size: 16px }` (không set font-family)
- **Recommendation**: Set `.wp-product-price b { font-family: var(--bb-font-cta); font-size: 14px; font-weight: 600 }`.

### F-007 — Section title (homepage block)

- **Severity**: P1
- **Multi-property**: font-family Oswald → Barlow; font-size 35px → clamp; line-height 4.286rem → 1.5
- **Evidence**:
  - WP: extract `body .block-title h3{margin:0;font-size:35px;line-height:4.286rem;color:#000;font-weight:600;font-family:Oswald,sans-serif}` từ custom.css
  - bigbike-web: [`app/globals.css:4219`](../../bigbike-web/app/globals.css#L4219), [`app/globals.css:8194-8211`](../../bigbike-web/app/globals.css#L8194)
- **Recommendation**: Đổi `--bb-font-heading` ↔ Oswald hoặc tạo class `.wp-section-title` dùng Oswald với size cố định 35px desktop / 24px mobile.

### F-008 — Page hero h1 (category, news)

- **Severity**: P1
- **WP**: 24px cố định (body override) / hero variant `4.375rem`+ uppercase=false, font Barlow
- **bigbike-web**: clamp(1.375rem, 5vw, 2.8rem), uppercase, Barlow Condensed
- **Evidence**:
  - WP: `body .page-title h1{font-size:24px}` (custom.css)
  - bigbike-web: [`app/globals.css:4399`](../../bigbike-web/app/globals.css#L4399)
- **Recommendation**: Set `.wp-page-head h1 { font-size: 24px; text-transform: none; font-family: var(--bb-font-body) }` cho variant in-body page.

### F-009 — Breadcrumb font-size/transform/letter-spacing/color

- **Severity**: P1
- **WP**: kế thừa body 16px, no uppercase, no letter-spacing, color #717171, link 600
- **bigbike-web**: 11px, uppercase, letter-spacing 0.08em, color #abb8c3, link 400
- **Evidence**: §4.12
- **Recommendation**: Re-design `.wp-breadcrumb` để bỏ uppercase + letter-spacing + 11px; dùng 16px + color #717171 + link 600.

### F-010 — Button `.bb-button` font-family

- **Severity**: P1
- **WP `.btn`**: Barlow Condensed
- **bigbike-web `.bb-button`**: Oswald (`--bb-font-cta`)
- **Evidence**:
  - WP: extract `.btn{…font-family:Barlow Condensed,sans-serif;color:#000;…}` từ main.css
  - bigbike-web: [`styles/brand-tokens.css:396`](../../bigbike-web/styles/brand-tokens.css#L396)
- **Recommendation**: Quyết định một nguồn-thật: nếu mục tiêu match WP, đổi `--bb-font-cta` cho button → Barlow Condensed. (Nhưng WP cũng dùng `.btn-submit` cho some primary CTAs — cần kiểm thêm.)

### F-011 — Footer color background + text

- **Severity**: P1 (multi-property)
- **WP footer**: hai dải (3a3a3a top + 000 bottom), text trắng/xám-7e7e7e
- **bigbike-web footer**: một dải 3a3a3a, text #6f6f6f
- **Evidence**: §4.5
- **Recommendation**: Thêm dải bottom #000 và elevate text contrast từ #6f6f6f → #fff cho .bb-footer-bottom area.

### F-012 — Static content body text size

- **Severity**: P1
- **WP**: `.seo-block-content .content-block p { font-size: 14px; color: #6f6f6f }`
- **bigbike-web**: `.bb-richtext { font-size: 16.002px; color: var(--bb-text-primary)=#000 }`
- **Evidence**: §4.11
- **Recommendation**: Define `.wp-static-content` variant với 14px / #6f6f6f.

### F-013 — Static content h2/h3 size

- **Severity**: P1
- **WP**: h2 18px, h3 16px (`.content-block h2/h3 span`)
- **bigbike-web**: h2 24px (`--bb-text-h2`), h3 18px (`--bb-text-h3`)
- **Evidence**: §4.11
- **Recommendation**: Scope-down trong `.wp-static-content h2/h3` để giảm theo WP.

### F-014 — Form input font-size

- **Severity**: P1 (cũng a11y)
- **WP webform**: `font-size: 14px`
- **bigbike-web**: `16px`
- **Evidence**: §4.14
- **Recommendation**: Giữ 16px (a11y, iOS auto-zoom) — đây là trường hợp drift CÓ LÝ DO. Đánh dấu finding nhưng KHÔNG cần fix.

### F-015 — Link global color/decoration

- **Severity**: P1
- **WP**: a global Bootstrap reboot `#007bff none`, custom override `royalblue` (style.css)
- **bigbike-web**: `a { color: inherit }` global, decoration-thickness 1px
- **Evidence**: §4.2
- **Recommendation**: Set `a { color: var(--bb-color-blue) }` global, nhưng cẩn thận footer/nav đã override `#fff`.

### F-016 — Category page title text-transform

- **Severity**: P1
- **WP**: không uppercase
- **bigbike-web**: uppercase
- **Recommendation**: Bỏ `text-transform: uppercase` ở `.wp-page-head h1` cho route product/news category pages.

### F-017 — Product brand/category badge text-transform + letter-spacing

- **Severity**: P2 (cumulative P1 với F-005)
- **WP**: không transform, kế thừa size
- **bigbike-web**: 11px, uppercase, 0.12em
- **Evidence**: §4.7
- **Recommendation**: Bỏ uppercase + letter-spacing.

### F-018 — News card heading font-family

- **Severity**: P1
- **WP**: Oswald
- **bigbike-web**: Barlow (`--bb-font-heading`)
- **Evidence**: §4.10
- **Recommendation**: Đổi `.wp-news-heading` / `.wp-news-block-title` font-family → Oswald.

### F-019 — Body text `-webkit-text-size-adjust`

- **Severity**: P3 (mobile-only)
- **WP**: `html { -webkit-text-size-adjust: 100% }`
- **bigbike-web**: không set
- **Evidence**: §4.1 và [`app/globals.css`](../../bigbike-web/app/globals.css) grep 0-match
- **Recommendation**: Thêm `html { -webkit-text-size-adjust: 100% }` để khớp iOS Safari behavior.

### F-020 — Drift hardcode line-height 24.003px

- **Severity**: P3
- **Property**: `line-height` (body và `.bb-body`)
- **WP**: `1.5` (= 24px chính xác)
- **bigbike-web**: `24.003px` (lệch 0.003px)
- **Evidence**: [`app/globals.css:8110`](../../bigbike-web/app/globals.css#L8110), [`styles/brand-tokens.css:362`](../../bigbike-web/styles/brand-tokens.css#L362)
- **Recommendation**: Thay `24.003px` → `1.5` (relative) hoặc `24px` chính xác.

---

## 10. Coverage

| Hạng mục | Số lượng đã review |
|---|---:|
| WP CSS files chính | 5 (`style.css`, `styles/main.css`, `styles/custom.css`, `styles/home.css`, `styles/fonts.css`) |
| WP CSS files thứ cấp | 7 (`product.css`, `product-detail.css`, `news.css`, `news-detail.css`, `cart.css`, `check-out.css`, `static-page.css`) — sample-checked qua size + grep |
| WP template PHP scanned for inline style | 2 (`header.php`, `footer.php`) |
| WP plugin CSS (out of scope, theme-level only) | excluded (admin-only) |
| bigbike-web CSS files | 2 (`app/globals.css`, `styles/brand-tokens.css`) |
| bigbike-web component scan (typography surface) | 6 component classes (.wp-header-*, .wp-product-*, .wp-breadcrumb, .wp-section-title, .wp-page-head h1, .bb-* utilities) |
| Token system | 2 sets (`--theme-*` legacy + `--bb-*` modern) |
| Element classes audited | ~25 trên 50 expected (NOT_VERIFIABLE còn lại) |
| Property categories audited | 24 (A.font + B.text + C.modern) — Section §4 covers ALL 24 |
| Viewports khảo sát (static breakpoint) | 3 (mobile 375 / tablet 768 / desktop 1440) — chỉ static; runtime 0/3 |
| Routes / pages | 8 vùng chính: homepage, product list, product detail, category, search, blog, static, footer/header global |
| Hover/focus/active state | Sample-checked 4 case (nav, link, button, breadcrumb a) |

---

## 11. Final verdict

> **FAIL_NOT_MATCHING** — bigbike-web KHÔNG khớp 100% typography với WordPress cũ.
>
> **+ INCONCLUSIVE_NOT_ENOUGH_RUNTIME_EVIDENCE** cho ~14 mục `NOT_VERIFIABLE` (xem §8).

### 11.1 Bằng chứng kết luận

- 75 mismatch đã định danh (1 P0, 29 P1, 24 P2, 21 P3) chỉ qua static CSS — không cần runtime để khẳng định.
- Token system của bigbike-web drift về việc mapping nhóm font: WP dùng **Oswald cho headings + product titles + sub-menu + product price** rất nhất quán, bigbike-web đảo lộn semantic (`--bb-font-display` = Barlow Condensed cho headings, `--bb-font-cta` = Oswald chỉ cho button), kéo theo cascade mismatch toàn site.
- Body color (P0) `#6f6f6f` thay vì `#000` ảnh hưởng đọc text khắp site.
- Breadcrumb được redesign theo phong cách "modern tag-line" (uppercase 11px letter-spaced) → mất tính breadcrumb truyền thống của WP.

### 11.2 Có thể nâng lên `PASS_100_PERCENT`?

Chỉ khi:
1. Thực hiện Phase 4 runtime computed-style verification (xem §5.2).
2. Fix tất cả 75 mismatch (75 finding nêu trên) và re-audit.
3. Resolve 14 `NOT_VERIFIABLE` (xem §8) — hoặc bằng runtime hoặc bằng đọc component sâu hơn.

### 11.3 Có thể nâng lên `INCONCLUSIVE` mà không phải `FAIL`?

Không. Đã có **>1 mismatch chắc chắn** ⇒ kết luận `FAIL_NOT_MATCHING` là an toàn nhất.

---

## 12. Phụ lục — Các trích xuất raw CSS (evidence dump)

### 12.1 WP body rules cascading

(extract bằng `awk -v RS="}" '/body{[^}]*font-family/' main.css`)

```
body{font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica Neue,Arial,Noto Sans,sans-serif,Apple Color Emoji,Segoe UI Emoji,Segoe UI Symbol,Noto Color Emoji;font-weight:400;line-height:1.5;color:#212529;text-align:left}
body{font-size:1rem;font-family:Barlow,sans-serif;color:#000;background-color:#fff}
body{margin:0;padding:80px 0 0;font-size:16px;font-family:Barlow}
```

### 12.2 WP h1-h6 rules

(extract bằng `awk -v RS="}" '/^h[1-6]\{|h1,h2,h3/' main.css`)

```
h1,h2,h3,h4,h5,h6{margin-top:0;margin-bottom:.5rem}
b,h1,h2,h3,h4,h5,h6,strong{font-weight:600}
```

### 12.3 WP navigation rules (main.css)

```
header .navigation{font-family:Barlow Condensed,sans-serif;font-size:1.143rem}
header .navigation--item{list-style:none;display:inline-block;padding:26px 30px 27px;position:relative}
header .navigation--item:after{content:"";background:#ff0c09;height:5px;width:5px;position:absolute;top:50%;right:-3px;transform:translateY(-50%) rotate(45deg);border-radius:1px}
header .navigation--item>a{color:#fff;text-transform:uppercase;font-weight:600}
header .navigation--item:last-child:after{display:none}
```

### 12.4 WP sub-menu rules (custom.css)

```
header .navigation ul .navigation--item>.sub-menu li a{padding:15px 30px;display:block;color:#6f6f6f;font-size:14px;font-weight:600;font-family:Oswald,sans-serif}
header .navigation ul .navigation--item>.sub-menu li a:hover{color:#ff0c09}
```

### 12.5 WP product-card rules (custom.css + home.css)

```
.product .product--item-title{font-size:1rem;font-family:Oswald,sans-serif;font-weight:600}
.product .product--item-title a{color:#000}
body .product .product--item-title a{font-size:16px}
body .product .product--item-price{font-family:Oswald,sans-serif;color:#ff0c09;font-size:14px;font-weight:600;text-align:left}
body .product .product--item-price p{margin:0 20px 0 0;font-size:14px;line-height:1.214rem;display:inline-block}
.product .product--item-price p.old{color:#cecece;text-decoration:line-through}
.product .product--item-category{color:#ff0c09;font-weight:600;font-family:Oswald,sans-serif}
.product .product--item-cart a{display:block;color:#fff;font-family:Oswald,sans-serif;text-transform:uppercase;padding:15px 0}
.product .product--item-sale p{line-height:42px;background:#ff0c09;color:#fff;width:70px;text-align:center}
```

### 12.6 WP breadcrumb rules

```
.breadcrumb ul li{display:inline-block;color:#cecece}
.breadcrumb ul li a,.breadcrumb ul li span{color:#cecece}
body .breadcrumb ul li a,body .breadcrumb ul li span{color:#717171}
body .breadcrumb ul li a{font-weight:600}
.page-title .breadcrumb ul li,.page-title .breadcrumb ul li a,.page-title .breadcrumb ul li span{color:#fff}
```

### 12.7 WP page-title + section title

```
.page-title h1{color:#fff;font-weight:600;font-size:4.375rem}
body .page-title h1{font-size:24px}
body .block-title h3{margin:0;font-size:35px;line-height:4.286rem;color:#000;font-weight:600;font-family:Oswald,sans-serif}
.white.block-title h3{color:#fff}
@media (max-width:767px) body .block-title h3{font-size:24px;line-height:30px}
.block-title p.sub-title{margin:0 0 10px;font-weight:600;color:#cecece;font-size:1.143rem;line-height:1.357rem}
.block-title--content p{line-height:1.214;font-size:1rem;color:#3a3a3a}
```

### 12.8 WP button rules

```
.btn{width:170px;line-height:52px;text-decoration:none;display:inline-block;font-family:Barlow Condensed,sans-serif;color:#000;padding:0;font-weight:600;border-radius:0;opacity:1}
.btn-red,.btn-white{color:#fff}
.btn-red{background-color:#ff0c09}
.btn-submit{height:62px;background-color:#ff0c09;color:#fff;line-height:62px;padding:0}
.newletters form .form-group button[type=submit]{background:#ff0c09;color:#fff;font-family:Barlow Condensed,sans-serif;font-size:1.143rem;font-weight:500;text-transform:uppercase;height:3.714rem;width:102px;border:none}
```

### 12.9 WP `:root` tokens

```
:root{--theme-white:#fff;--theme-black:#000;--theme-gray:#6f6f6f;--theme-red:#ff0c09;--theme-size:14px;--theme-font:"Barlow",sans-serif;--theme-font-second:"Barlow Condensed",sans-serif}
```

### 12.10 bigbike-web `:root` tokens (typography subset)

```
--bb-font-display: Barlow Condensed, Barlow, Helvetica, sans-serif;
--bb-font-heading: Barlow, Segoe UI, -apple-system, BlinkMacSystemFont, sans-serif;
--bb-font-body:    Barlow, Segoe UI, -apple-system, BlinkMacSystemFont, sans-serif;
--bb-font-link:    Barlow, Segoe UI, -apple-system, BlinkMacSystemFont, sans-serif;
--bb-font-cta:     Oswald, Helvetica Neue, Arial, sans-serif;
--bb-font-nav:     Barlow, Segoe UI, -apple-system, BlinkMacSystemFont, sans-serif;
--bb-text-xs: 12px; --bb-text-sm: 14px; --bb-text-base: 16.002px; --bb-text-md: 16px;
--bb-text-lg: 18px; --bb-text-xl: 20px; --bb-text-2xl: 24px; --bb-text-3xl: 30px;
--bb-text-4xl: 32px; --bb-text-5xl: 40px; --bb-text-6xl: 48px; --bb-text-7xl: 56px;
--bb-text-hero: 30px; --bb-text-h1: 32px; --bb-text-h2: 24px; --bb-text-h3: 18px;
--bb-font-weight-regular: 400; --bb-font-weight-medium: 500; --bb-font-weight-semibold: 600; --bb-font-weight-bold: 700; --bb-font-weight-black: 700;
--bb-line-none: 1; --bb-line-tight: 1.111; --bb-line-heading: 1.5; --bb-line-body: 1.5; --bb-line-ui: 1.5;
--bb-letter-tight: 0; --bb-letter-normal: 0; --bb-letter-wide: 0; --bb-letter-display: 0;
```

---

## 13. References

- [WP_TO_NEXT_UI_PARITY_AUDIT.md](WP_TO_NEXT_UI_PARITY_AUDIT.md) — audit cấp UI/layout, có Section 3 trích token và Section 0 nhận diện xung đột Design System (sáng-tối, font Oswald-Bungee).
- [BIGBIKE_WEB_BACKGROUND_COLOR_AUDIT.md](BIGBIKE_WEB_BACKGROUND_COLOR_AUDIT.md) — audit nền & màu — chú thích `--bb-bg-page` chọn white như WP.
- `bigbike-web/STYLEGUIDE.md` — styleguide nội bộ (đã được điều chỉnh trong Track B 2026-05-12).
- `app/layout.tsx` — nguồn nạp next/font.

> Cuối báo cáo.
