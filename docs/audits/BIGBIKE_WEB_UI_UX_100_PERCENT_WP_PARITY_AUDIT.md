---
title: BigBike Web UI/UX 100% WP Parity Audit
status: AUDIT_ONLY — read-only, không sửa code trong task này
created: 2026-05-12
scope: Đánh giá mức độ trùng khớp UI/UX giữa `bigbike-web/` (Next.js) và bản WordPress cũ `bigbike_vn__2026_04_17/` về visual, UX flow, responsive, animation, asset.
auditor: senior frontend architect + UI/UX auditor (read-only)
prior:
  - docs/audits/WP_TO_NEXT_UI_PARITY_AUDIT.md (Phase 1 — 2026-05-11)
  - docs/audits/WP_TO_NEXT_UI_PARITY_REPORT.md (Phase 2+3+4 — 2026-05-11)
  - docs/audits/BIGBIKE_WEB_BACKGROUND_COLOR_AUDIT.md (Track B chosen — light-first)
  - docs/audits/BIGBIKE_WEB_TYPOGRAPHY_TEXT_STYLE_AUDIT.md
  - docs/audits/HOMEPAGE_UI_UX_RESPONSIVE_PRECHECK.md
---

# BigBike Web UI/UX 100% WP Parity Audit

> Audit này KHÔNG sửa code. Mục tiêu là đối chiếu bản Next.js hiện tại với WordPress cũ để trả lời: bigbike-web có khớp 100% với `bigbike_vn__2026_04_17` không, và nếu không thì lệch ở đâu, mức độ thế nào, có nên cố parity 100% không.

---

## 1. Executive Summary

**Có khớp 100% với WordPress cũ không?** Không. Tổng parity ước lượng (static source audit): **~72%** — nhỉnh hơn báo cáo Phase 2+3 cũ (67%) vì đã có Phase 3.5 bổ sung (ArticleCard date badge nhô đỏ, blog sidebar widgets, AutoTOC, About brand grid + service tiles, Contact full-width map iframe, PolicySidebar, footer 2-cột, 404.png).

**Phân lớp parity:**

| Lớp | Parity hiện tại | Ghi chú |
|---|---|---|
| Design tokens (color, font, spacing, container, breakpoint, radius) | **90–95%** | Light-first đã khớp WP (#fff body, #000/#3a3a3a footer), Oswald + Barlow + Barlow Condensed đúng family, container 1200px, breakpoint 576/768/992/1200 đúng Bootstrap 4. Radius vẫn còn token `--bb-radius-md/lg/xl` = 0 cho parity WP. Vài chỗ còn shadow giá trị hiện đại thay vì `0 3px 6px rgba(0,0,0,.16)`. |
| Header + Footer global | **80%** | Header dùng `wp-header` fixed bg `#000` (WP-parity), nav red diamond divider, sub-menu width 300px — tất cả khớp [styles/main.css]. Footer 2-cột (brand left + 4 sub-cols right), bg `#3a3a3a` top + `#000` bottom — khớp WP top/foot pattern. Khác biệt còn lại: WP top có "newletter" form + tagline, Next có 4 sub-col cho menu/contact/social (giàu hơn WP). |
| Homepage section order | **65%** | Next có thêm SEO content block, video carousel sống độc lập, brand carousel sống độc lập (WP cũ có cả 3 nhưng order khác). Ordering không match WP 1:1. Featured 3-tile, about, product carousel, category grid, banner ads, news, video, brand đều có — chỉ khác trật tự + thêm SEO bottom. |
| Product card (visual + animation) | **85%** | Đã có scale 1.05 ảnh + slide-up cart bar bg đen + skewed sale tag (`clip-path: polygon(...)`), border-subtle, hover border đỏ + shadow đỏ nhẹ — đúng WP. Khác biệt: WP dùng skewX(-20deg) pseudo trên `.product--item-sale`, Next dùng `clip-path` cho `.wp-product-tag`. Visual gần tương đương nhưng không pixel-perfect. |
| ArticleCard (visual + date badge) | **85%** | Đã có shadow `var(--bb-shadow-md)`, scale 1.05 ảnh hover, date badge `top:-21px` bg đỏ với `clip-path` cờ-đỏ — khớp WP rất sát. |
| PDP (gallery + price + variant + tab + related) | **70%** | 2-col gallery + info OK. Hover zoom thêm là intentional improvement, không có ở WP. Tab "Mô tả / Thông số / Video" — WP dùng các `do_action` woocommerce_after_single_product_summary cho tabs. Next markup khác WP nhưng business equivalent. Variant size button 52×52 WP có border `1px solid #000`, Next dùng tokens — cần check trên trình duyệt. |
| Catalog (filter sidebar + grid + sort + pagination) | **75%** | WP có sidebar 3-col bên trái + grid 9-col bên phải, có "BỘ LỌC" mobile drawer. Next có CatalogFilters + CatalogSortSelect + PaginationNav. Cấu trúc tương đương, visual đã light cascade. |
| Blog index + detail | **80%** | Blog index 3-col ArticleCard. Blog detail 8/4 col với sidebar widget (featured + recent) + AutoTOC + related 4. Phù hợp WP `single.php`. Chia sẻ Facebook/Zalo là phần cải tiến từ Next (không có ở WP). |
| About | **80%** | Đã có brand grid 8 logo + 5 service tiles (a-1..a-5.png trong WP, ở Next render bằng layout không cần ảnh) + block-contact 3-col cuối — port khá đầy đủ. |
| Contact | **75%** | Full-width iframe map + 2-col info/form + 3 icon contact (phone/marker/calendar) đã có. Khác biệt: WP dùng ảnh PNG icon (`contact-call-icon.png`, `contact-marker-icon.png`, `contact-calendar-icon.png`), Next dùng SVG inline lucide-style — visually khác. |
| Policy / static / warranty / huong-dan-mua-hang | **65%** | Có PolicySidebar + `.wp-static-navigation`. Layout 3/9-col khớp WP. Hero PageHero là intentional improvement (WP có `page-title` block đơn giản). |
| Cart `/gio-hang` | **70%** | Layout cart-table + sidebar tổng kết — khớp logic WP. Visual light cascade OK. |
| Checkout `/thanh-toan` | **60%** | **Vẫn 3-step Next.js** dù user chốt D3=B "copy WP 1-page" trong Phase 2+3 report — intentionally deferred vì rủi ro CSRF/Idempotency/snapshot pricing. Visual đã light cascade. |
| Login / Register / Forgot | **75%** | Form 1-cột `bb-card` đơn giản. WP có "Đăng nhập bằng Facebook" social button (không có OAuth backend ở Next nên không port). |
| Account `/tai-khoan/*` | **70%** | AccountShell 3/9-col sidebar nav giống WP myaccount tabs. |
| Search `/tim-kiem` | **75%** | Re-use catalog layout. |
| 404 `app/not-found.tsx` | **70%** | Có hero + search form + nav CTA + 3 bài viết gần đây. **Thiếu**: ảnh 404.png illustration hiển thị (asset đã có tại `public/wp/404.png` nhưng component không render). |

**Blocker lớn nhất nếu muốn 100%:**

1. **Homepage section ordering** — Next.js có thêm SEO content, video carousel, brand carousel sống độc lập sau news (WP 7 sections, Next 11 sections). Để 100% phải bỏ section dư hoặc reorder.
2. **Checkout 1-page** — D3=B chưa thực hiện, rủi ro flow cao nếu cố làm trong 1 session không có e2e test.
3. **404 illustration** — asset có nhưng chưa render.
4. **Logo header** — Next.js đang dùng `public/wp/logo.png` + `public/wp/logo-1.png` đã port từ WP. ✓
5. **Old residual assets**: `public/fonts/Bungee*.ttf`, `public/fonts/Exo*.ttf`, `public/brand/*` (Bungee logo cũ) vẫn còn trong repo — không ảnh hưởng UI nhưng là rác cần dọn (xem §10 Phase 1).
6. **Tokens shadow** vẫn dùng `0 4px 12px rgba(0,0,0,0.15)` (Next) thay vì `0 3px 6px rgba(0,0,0,.16)` (WP). Khác biệt visual nhỏ.

**Có nên cố parity 100% không?**

**Không nên cố parity tuyệt đối** — khuyến nghị target ~85% với 2 lý do:
- Một số khác biệt của Next.js là **intentional improvement** (3-step checkout, social share, blog sidebar widget, hover zoom PDP, SEO content block, brand carousel) thực sự tốt hơn WP về UX/SEO/business.
- WP có một số yếu tố lỗi thời (1-page checkout dài, sale badge skewX pixel-perfect hack, social login Facebook khi không có OAuth backend) — copy mù quáng sẽ kéo lùi UX.

Phương án đề xuất: **Track "WP-faithful + selective improvement"** — fix các gap visual rõ ràng (P1) và đánh dấu các khác biệt khác là intentional improvement có document.

---

## 2. Audit Methodology

**Đã đọc:**

- WP theme: [bigbike_vn__2026_04_17/files/wp-content/themes/bigbike/](../../bigbike_vn__2026_04_17/files/wp-content/themes/bigbike/) — `header.php`, `footer.php`, `page-templates/page-home.php`, `page-templates/page-about.php`, `page-templates/page-contact.php`, `page-templates/page-cart.php`, `page-templates/page-checkout.php`, `page-templates/page-login.php`, `single.php`, `category.php`, `404.php`, `woocommerce/archive-product.php`, `woocommerce/single-product.php`, `woocommerce/content-product.php`, `woocommerce/content-single-product.php`. CSS dist: `dist/general-page.css`, `dist/home.css`, `dist/product-page.css`, `dist/product-category.css`. Style nguồn: `style.css`, `styles/main.css` (Bootstrap reboot), `styles/fonts.css` (Oswald + Barlow @font-face), `styles/product-detail.css`. Images dir.
- bigbike-web: [bigbike-web/app/](../../bigbike-web/app/), [bigbike-web/components/](../../bigbike-web/components/), [bigbike-web/styles/brand-tokens.css](../../bigbike-web/styles/brand-tokens.css), [bigbike-web/app/globals.css](../../bigbike-web/app/globals.css) (9274 dòng), [bigbike-web/STYLEGUIDE.md](../../bigbike-web/STYLEGUIDE.md), `public/wp/`, `public/fonts/`, `public/brand/`.
- Tham chiếu các audit hiện hữu (xem `prior` ở frontmatter).

**Không chạy được:**

- Không chạy `npm run dev` / `npm run build` / Playwright screenshot — môi trường không cho phép spin trình duyệt hoặc dev-server trong session audit-only này. Toàn bộ phán đoán parity là **static source audit** dựa trên đọc class CSS, markup, design tokens. Visual QA browser-side cần Phase tiếp theo (xem §10).
- Không chạy được WordPress cũ — không có local WP/MySQL/PHP stack tương ứng. Tham chiếu CSS dist + PHP markup làm chuẩn.

**Viewport đã đánh giá:** chỉ thông qua đọc media-query trong CSS (`@media (max-width: 575px) | (max-width: 767px) | (max-width: 991px) | (min-width: 1200px) | (min-width: 1440px)`). Không có screenshot thực.

**Giới hạn audit:**

- File `styles/fonts.css` của WP (433KB base64 woff) chưa decode để verify weight cụ thể — chỉ confirm family `Oswald` và `Barlow`.
- File `footer.php` của WP có 660KB chứa embedded Facebook Pixel/chat scripts ở giữa file (line 130-300), không đọc đủ phần ấy nên không đánh giá phần này có port sang Next hay không.
- WP có `inc/`, `template-parts/`, `plugin/` chứa thêm partials chưa đọc — có khả năng có thêm UI elements ẩn không xuất hiện ở audit này.

---

## 3. Global Design System Comparison

### 3.1 Theme

| Tham số | WP cũ (chuẩn) | bigbike-web hiện tại | Khớp? |
|---|---|---|---|
| Body bg | `#ffffff` (Bootstrap reboot default) | `#ffffff` ([brand-tokens.css:72](../../bigbike-web/styles/brand-tokens.css#L72)) | ✓ |
| Section bg | trắng | `var(--bb-bg-section)` = `#ffffff` ([brand-tokens.css:73](../../bigbike-web/styles/brand-tokens.css#L73)) | ✓ |
| Surface (card) | `#ffffff` | `#ffffff` | ✓ |
| Header bg | `#000000` (cố định) | `#000` ([globals.css:1465](../../bigbike-web/app/globals.css#L1465)) | ✓ |
| Footer top bg | `#3a3a3a` | `#3a3a3a` ([globals.css:47](../../bigbike-web/app/globals.css#L47)) | ✓ |
| Footer foot bg | `#000` | `bb-footer-bottom` border-top + extends footer dark bg | △ Phần `foot` WP có bg `#000` riêng; Next chỉ có `border-top rgba(255,255,255,0.08)` nên cảm giác cùng tone với top. Khác biệt nhỏ. |

### 3.2 Color

| Token | WP | Next | Khớp? |
|---|---|---|---|
| Brand red primary | `#ff0c09` | `#ff0c09` ([brand-tokens.css:16](../../bigbike-web/styles/brand-tokens.css#L16)) | ✓ |
| Brand red hover | thường tối hơn 5-10% | `#e50a07` | △ Tự định nghĩa, WP không có chuẩn rõ. Chấp nhận. |
| Link blue | `#007bff` (Bootstrap default) | `#007bff` ([brand-tokens.css:22](../../bigbike-web/styles/brand-tokens.css#L22)) | ✓ |
| Text body | `#212529` (Bootstrap reboot) hoặc `#404040` (custom) | `#000` ([brand-tokens.css:85](../../bigbike-web/styles/brand-tokens.css#L85)) | △ Khác nhẹ — Next dùng pure black, WP dùng gray-on-light. Lệch tinh tế, không phá visual. |
| Text muted | `#6f6f6f` / `#7e7e7e` | `#6f6f6f` ([brand-tokens.css:86](../../bigbike-web/styles/brand-tokens.css#L86)) | ✓ |
| Border subtle | `#dddddd` | `#dddddd` ([brand-tokens.css:42](../../bigbike-web/styles/brand-tokens.css#L42)) | ✓ |
| Border default | `#cecece` | `#cecece` ([brand-tokens.css:43](../../bigbike-web/styles/brand-tokens.css#L43)) | ✓ |

### 3.3 Font

| Vai trò | WP | Next | Khớp? |
|---|---|---|---|
| Heading | Oswald | Oswald (next/font/google, [layout.tsx:12](../../bigbike-web/app/layout.tsx#L12)) | ✓ |
| Body | Barlow | Barlow (next/font/google, [layout.tsx:19](../../bigbike-web/app/layout.tsx#L19)) | ✓ |
| Display | Barlow Condensed | Barlow Condensed (next/font/google, [layout.tsx:26](../../bigbike-web/app/layout.tsx#L26)) | ✓ |
| Nav | Barlow Condensed font-size 1.143rem | `var(--bb-font-nav)` = Barlow ([brand-tokens.css:136](../../bigbike-web/styles/brand-tokens.css#L136)), nhưng `.wp-navigation` lại set lại `var(--bb-font-nav)` với size 1.143rem | △ Family lệch — WP nav dùng Barlow Condensed, Next dùng Barlow. Visual nhẹ khác. |
| Button/CTA | Oswald 600 uppercase | Oswald 600 uppercase ([brand-tokens.css:135](../../bigbike-web/styles/brand-tokens.css#L135), [brand-tokens.css:396-402](../../bigbike-web/styles/brand-tokens.css#L396)) | ✓ |
| Submenu | Oswald 14/600 #6f6f6f | Oswald 14/600 #6f6f6f ([globals.css:1675-1683](../../bigbike-web/app/globals.css#L1675)) | ✓ |

### 3.4 Spacing & Container

| Tham số | WP | Next | Khớp? |
|---|---|---|---|
| Container max | 1200px (Bootstrap 4) hoặc 1750px (header riêng) | `--bb-container-xl: 75rem` = 1200px ([brand-tokens.css:201](../../bigbike-web/styles/brand-tokens.css#L201)). Header riêng `wp-header-container max-width: 1750px` ([globals.css:1479](../../bigbike-web/app/globals.css#L1479)) | ✓ |
| Spacing scale | 4/8/16/24/30/40/60/100px (custom rems) | `--bb-space-1..32` theo 0.25-8rem ([brand-tokens.css:175-194](../../bigbike-web/styles/brand-tokens.css#L175)) | △ Khác đơn vị nhưng kết quả pixel tương đương. Acceptable. |
| Section padding-y | 60px | `--bb-section-y: 4.5rem` = 72px ([brand-tokens.css:194](../../bigbike-web/styles/brand-tokens.css#L194)) | △ Lệch 12px — Next > WP. Cần verify. |
| Page padding mobile | 15-16px | `--bb-page-padding-mobile: var(--bb-space-4)` = 16px ([brand-tokens.css:202](../../bigbike-web/styles/brand-tokens.css#L202)) | ✓ |

### 3.5 Breakpoint

| Tên | WP (Bootstrap 4) | Next | Khớp? |
|---|---|---|---|
| sm | 576px | 576px ([brand-tokens.css:211](../../bigbike-web/styles/brand-tokens.css#L211)) | ✓ |
| md | 768px | 768px ([brand-tokens.css:212](../../bigbike-web/styles/brand-tokens.css#L212)) | ✓ |
| lg | 992px | 992px ([brand-tokens.css:213](../../bigbike-web/styles/brand-tokens.css#L213)) | ✓ |
| xl | 1200px | 1200px ([brand-tokens.css:214](../../bigbike-web/styles/brand-tokens.css#L214)) | ✓ |
| 2xl | n/a | 1440px ([brand-tokens.css:215](../../bigbike-web/styles/brand-tokens.css#L215)) | Intentional extra |

> Lưu ý: media-query trong globals.css dùng nhiều breakpoint phẳng-pixel (575, 767, 991, 1200, 1440). Token đúng nhưng utility Tailwind (sm:640, md:768, lg:1024) vẫn là default — có khả năng vài chỗ Tailwind utility xài 1024 trong khi component WP-style xài 992. Hiện tượng "double-breakpoint" có thể gây jitter giữa 992–1024 trên tablet ngang.

### 3.6 Shadow / Radius

| Token | WP | Next | Khớp? |
|---|---|---|---|
| Shadow-card | `0 3px 6px rgba(0,0,0,.16)` | `0 4px 12px rgba(0,0,0,0.15)` ([brand-tokens.css:238](../../bigbike-web/styles/brand-tokens.css#L238)) | △ Khác hướng + spread. Next mềm hơn, WP tạo cảm giác "ground" rõ hơn. |
| Shadow product hover | nhẹ | `0 4px 12px rgba(255,12,9,0.1)` ([brand-tokens.css:242](../../bigbike-web/styles/brand-tokens.css#L242)) | △ Intentional improvement — không có trong WP. |
| Shadow dropdown header | `0 0 30px rgba(0,0,0,.16)` | `0 4px 12px rgba(0,0,0,0.15)` ([brand-tokens.css:243](../../bigbike-web/styles/brand-tokens.css#L243)) | △ Khác. WP halo rộng, Next drop-down dày-dưới. |
| Radius button | 3-4px (WP) | 0 ([brand-tokens.css:228](../../bigbike-web/styles/brand-tokens.css#L228)) | ⛔ Cố ý sharp WP-light theme nhưng WP gốc thật sự có bo nhẹ; STYLEGUIDE.md chốt sharp 0. Đây là quyết định brand mới (WP-light + sharp), không phải 100% WP. |
| Radius card | 10px (WP `.news--item`) | 0 ([brand-tokens.css:227](../../bigbike-web/styles/brand-tokens.css#L227)) | ⛔ Khác — Next sharp toàn bộ, WP có bo. |

### 3.7 Button variants

| Variant | WP | Next | Khớp? |
|---|---|---|---|
| Primary | bg #ff0c09, color #fff, h 40-50px, Oswald 600 uppercase | bg #ff0c09 ([brand-tokens.css:427-431](../../bigbike-web/styles/brand-tokens.css#L427)) | ✓ |
| Secondary | bg #fff border 1px #ccc | bg #fff border 2px #ff0c09 ([brand-tokens.css:443-447](../../bigbike-web/styles/brand-tokens.css#L443)) | △ WP secondary là gray-outline, Next secondary là red-outline. Lệch nhưng intentional. |
| Outline | transparent border red | bg transparent color blue border blue ([brand-tokens.css:455-459](../../bigbike-web/styles/brand-tokens.css#L455)) | △ Khác — Next outline là link-blue, WP outline là red. |
| Dark | bg #000 color #fff | bg #000 color #fff ([brand-tokens.css:467-470](../../bigbike-web/styles/brand-tokens.css#L467)) | ✓ |

### 3.8 Product card

| Yếu tố | WP `.product--item` | Next `.wp-product-card` | Khớp? |
|---|---|---|---|
| Border | none (chỉ shadow nếu có) | `1px solid var(--bb-border-subtle)` ([globals.css:4232](../../bigbike-web/app/globals.css#L4232)) | △ Khác — Next có border, WP không. Cảm giác visual khác. |
| Hover image | scale 1.05 transition .3s | scale 1.05 transition .3s ([globals.css:4239](../../bigbike-web/app/globals.css#L4239)) | ✓ |
| Add-to-cart | bg #000 height 51px slide-up từ bottom transition .32s | bg #000 padding 14px text-center transform translateY(100%→0) transition .32s ([globals.css:4246](../../bigbike-web/app/globals.css#L4246)) | ✓ |
| Add-to-cart touch | always visible | `@media (hover:none){ transform: translateY(0) }` ([globals.css:4248](../../bigbike-web/app/globals.css#L4248)) | ✓ Improvement |
| Sale badge | `.product--item-sale` bg #ff0c09 w70xh42 + skewX pseudo cờ tam giác bên phải | `.wp-product-tag` bg đỏ + `clip-path: polygon(0 0, 100% 0, calc(100% - 8px) 100%, 0 100%)` ([globals.css:4242](../../bigbike-web/app/globals.css#L4242)) | △ Hình dạng tương đương (đỏ vát) nhưng kỹ thuật khác — WP dùng pseudo border-triangle, Next dùng clip-path parallelogram. Visual gần khớp. |
| Title | Oswald 600 #000 1rem | Oswald 600 #000 14px ([globals.css:4251](../../bigbike-web/app/globals.css#L4251)) | △ Font size 14px vs 16px (1rem) — Next nhỏ hơn. Cần verify trên trình duyệt. |
| Price | Oswald 600 đỏ 14px + old strikethrough #cecece | Oswald 700 đỏ 16px + s strikethrough muted ([globals.css:4254-4256](../../bigbike-web/app/globals.css#L4254)) | △ Weight 700 vs 600, size 16 vs 14. Lệch. |
| Category line | Oswald 600 đỏ phía trên | `.wp-product-brand` Oswald 600 đỏ 11px ([globals.css:4250](../../bigbike-web/app/globals.css#L4250)) | ✓ (Brand thay cho Category — sematics khác nhưng visual gần) |
| Stock badge | không có | `.wp-stock-badge` 3 màu ([globals.css:4257-4260](../../bigbike-web/app/globals.css#L4257)) | Intentional improvement |
| Wishlist | không có | `.wp-wishlist-btn` góc phải trên ([globals.css:4261](../../bigbike-web/app/globals.css#L4261)) | Intentional improvement |
| Rating stars | `.rating-star` data-rating attribute (JS render) | `RatingStars` component | ✓ Tương đương UX |

### 3.9 Article / news card

| Yếu tố | WP `.news--item` | Next `.wp-news-card` | Khớp? |
|---|---|---|---|
| Shadow | `0 3px 6px rgba(0,0,0,.16)` | `var(--bb-shadow-md)` = `0 4px 12px rgba(0,0,0,0.15)` ([globals.css:5557](../../bigbike-web/app/globals.css#L5557)) | △ Khác giá trị nhưng thị giác gần. |
| Image | bg-image cover, scale 1.05 hover | aspect-ratio 16/9, scale 1.05 hover ([globals.css:5559-5563](../../bigbike-web/app/globals.css#L5559)) | ✓ |
| Date badge | `.news-date` abs top:-21px bg đỏ chữ trắng | `.wp-news-date` abs top:-21px bg đỏ chữ trắng clip-path cờ ([globals.css:5564](../../bigbike-web/app/globals.css#L5564)) | ✓ Pixel-port chuẩn |
| Title | Oswald 600 #000 | Oswald 600 #000 18px ([globals.css:5568](../../bigbike-web/app/globals.css#L5568)) | ✓ |
| Excerpt | Barlow min-height 104px | line-clamp 2 ([globals.css:5557-5558](../../bigbike-web/app/globals.css#L5557)) | △ Khác (min-height fixed vs line-clamp). Visual tương tự. |
| Padding body | 41px 20px 30px | `padding: 41px 30px 30px` (từ Phase 3.5 — verify ở [globals.css:5566](../../bigbike-web/app/globals.css#L5566)) | ✓ |

### 3.10 Header

| Yếu tố | WP `.headroom` | Next `.wp-header` | Khớp? |
|---|---|---|---|
| Position | fixed | fixed ([globals.css:1459](../../bigbike-web/app/globals.css#L1459)) | ✓ |
| Height | 80px | `--bb-header-height: 4rem` = 64px ([brand-tokens.css:205](../../bigbike-web/styles/brand-tokens.css#L205)) | ⛔ Lệch 16px — Next thấp hơn WP. Cần fix. |
| Bg | `#000` đen luôn | `#000` ([globals.css:1465](../../bigbike-web/app/globals.css#L1465)) | ✓ |
| Container | 1750px | 1750px ([globals.css:1479](../../bigbike-web/app/globals.css#L1479)) | ✓ |
| Logo desktop | max-width 150px desktop, 80-120px mobile | max-width 210px (≥1440), 150px (768-1440), 120px (≤767), 80px (≤500) ([globals.css:1511-1545](../../bigbike-web/app/globals.css#L1511)) | △ Next có thêm range trên 1440px = 210px (WP không có) — intentional extra. Below tablet OK. |
| Logo mobile | `logo-1.png` smaller | `logo-1.png` ([SiteHeader.tsx:86](../../bigbike-web/components/layout/SiteHeader.tsx#L86)) | ✓ |
| Logo asset | bitmap WP (`logo.png`, `logo-1.png`) | `public/wp/logo.png`, `public/wp/logo-1.png` (đã port) | ✓ |
| Sticky behavior | `.headroom` JS plugin (auto-hide on scroll down) | `StickyHeaderShell` ([globals.css:1473](../../bigbike-web/app/globals.css#L1473) `[data-header-hidden] transform: translateY(-100%)`) | ✓ Tương đương UX |
| Nav font | Barlow Condensed 1.143rem | Barlow 1.143rem ([globals.css:1566](../../bigbike-web/app/globals.css#L1566)) | ⛔ Family lệch (Barlow ≠ Barlow Condensed). |
| Nav padding | 26px 30px 27px | 26px 30px 27px ([globals.css:1587](../../bigbike-web/app/globals.css#L1587)) | ✓ |
| Nav red diamond | 5x5 bg #ff0c09 rotate45 last-child:none | 5x5 ([globals.css:1607](../../bigbike-web/app/globals.css#L1607)) | ✓ |
| Sub-menu width | 300px bg #fff shadow nhẹ | 300px bg #fff `var(--bb-shadow-dropdown)` ([globals.css:1636](../../bigbike-web/app/globals.css#L1636)) | ✓ |
| Sub-menu item | padding 15px 30px Oswald 14/600 #6f6f6f hover #ff0c09 | padding 15px 30px Oswald 14/600 #6f6f6f hover #ff0c09 ([globals.css:1673-1689](../../bigbike-web/app/globals.css#L1673)) | ✓ |
| User control icon | 1.286rem #fff | 1.286rem #fff ([globals.css:1728](../../bigbike-web/app/globals.css#L1728)) | ✓ |
| Search overlay | full-screen black-overlay-64 + input 80px Oswald 24px | có (`SearchToggle` component) | △ Cần verify visual match |
| Cart count | `wc_get_cart_contents_count()` | `CartIcon` từ `useCart()` | ✓ Tương đương |
| Mobile hammer | width 44px 3-line | `MobileHeaderMenu` ([SiteHeader.tsx:113](../../bigbike-web/components/layout/SiteHeader.tsx#L113)) | ✓ |
| Mobile slide panel | `.information-slide-bigbike` (contact info + logo + desc) | có, in `MobileHeaderMenu` | ✓ |

### 3.11 Footer

| Yếu tố | WP | Next | Khớp? |
|---|---|---|---|
| Layout | 2-col `col-md-7` + `col-md-5` (brand+contact left, info+social right) | Grid 2-col `1.2fr 2fr` (brand left, right có 4 sub-col) ([globals.css:91](../../bigbike-web/app/globals.css#L91)) | △ WP 2-col đơn giản; Next chia phải thành 4 grid — Next giàu hơn. |
| Top bg | `#3a3a3a` padding 60px 0 | `#3a3a3a` border-top 3px brand red ([globals.css:46-47](../../bigbike-web/app/globals.css#L46)) | ✓ + intentional red border |
| Foot bg | `#000` padding 30px 0 | `bb-footer-bottom border-top rgba(255,255,255,0.08)` ([globals.css:77-79](../../bigbike-web/app/globals.css#L77)) — nhưng nền vẫn là `#3a3a3a` của parent | ⛔ Khác — WP có khối foot đen rõ rệt dưới khối top xám; Next không có khối foot đen riêng, chỉ là border-trắng-mờ. |
| Newsletter form | có "Bigbike mong được lắng nghe..." (form bị comment-out, chỉ còn slogan) | không có | ⛔ Thiếu slogan "Bigbike mong được lắng nghe và thấu hiểu bạn hơn" |
| Contact info | hotline 0906.90.2404 / 0764.640.679 / email bigbikevnshop@gmail.com (hardcoded WP) | từ `listPublicSettings()` ([SiteFooter.tsx:138-140](../../bigbike-web/components/layout/SiteFooter.tsx#L138)) | ✓ Improvement — từ admin |
| Toggle info "Thông tin" với fa-plus | mobile accordion | nav links phẳng ([SiteFooter.tsx:194-211](../../bigbike-web/components/layout/SiteFooter.tsx#L194)) | △ Khác — WP mobile có accordion, Next không. |
| Footer logo | `images/logo-footer.png` width 200px | `public/wp/logo-footer.png` width 200 ([SiteFooter.tsx:316](../../bigbike-web/components/layout/SiteFooter.tsx#L316)) | ✓ |
| Scroll-to-top | `.scrollToTop` bg đỏ 52x52 góc phải-trên foot | không có | ⛔ Thiếu — WP có nút lên đầu ([general-page.css `.scrollToTop`]) |
| License | "Giấy chứng nhận đăng ký kinh doanh số: 41K8017383..." + license.png | businessLicenseNo từ settings + BctBadge ([SiteFooter.tsx:324-340](../../bigbike-web/components/layout/SiteFooter.tsx#L324)) | ✓ Improvement |

### 3.12 Form

| Yếu tố | WP | Next | Khớp? |
|---|---|---|---|
| Input bg | #fff | #fff ([brand-tokens.css:501](../../bigbike-web/styles/brand-tokens.css#L501)) | ✓ |
| Input border | #cecece | #dddddd ([brand-tokens.css:499](../../bigbike-web/styles/brand-tokens.css#L499)) | △ Lệch nhẹ. |
| Input padding | 12px 16px | 12px 16px ([brand-tokens.css:498](../../bigbike-web/styles/brand-tokens.css#L498)) | ✓ |
| Input radius | 3px | 0 ([brand-tokens.css:229](../../bigbike-web/styles/brand-tokens.css#L229)) | ⛔ WP-light sharp design — không khớp WP gốc. |
| Focus | border-blue + ring | border-blue + box-shadow ring ([brand-tokens.css:514-518](../../bigbike-web/styles/brand-tokens.css#L514)) | ✓ |
| Min-height | 40-50px | 48px ([brand-tokens.css:497](../../bigbike-web/styles/brand-tokens.css#L497)) | ✓ |

---

## 4. Route-by-route Parity Matrix

| # | WP reference | Next route | Component(s) | Parity ước lượng | Gap chính | Severity |
|---|---|---|---|---|---|---|
| 1 | `header.php` | global | `SiteHeader` + `StickyHeaderShell` + `HeaderNavItem` + `MobileHeaderMenu` + `SearchToggle` + `HeaderUserMenu` | **80%** | Header-height 64px (Next) vs 80px (WP). Nav font Barlow (Next) vs Barlow Condensed (WP). | P1 |
| 2 | `footer.php` | global | `SiteFooter` + `BctBadge` + `FloatingChat` | **80%** | Thiếu scroll-to-top button, thiếu khối "foot" đen riêng, thiếu newsletter tagline, mobile không có accordion. | P1 |
| 3 | `page-home.php` | `/` ([app/page.tsx](../../bigbike-web/app/page.tsx)) | HeroSlider, FeaturedProductTile, About, FeaturedProductsCarousel, WpCategoryListItem, Promo Banner, ExperienceCarousel, WpNewsCard, HomeVideoCarousel, BrandCarousel, SEO content | **65%** | Section ordering ≠ WP. Next có 11 block, WP có 7. Intentional improvement: SEO content, brand carousel sống độc lập, video carousel sống độc lập. | P2 (intentional) |
| 4 | `woocommerce/archive-product.php` | `/san-pham` ([page.tsx](../../bigbike-web/app/san-pham/page.tsx)) | PageHero, CatalogFilters, CatalogSortSelect, ProductCard grid, PaginationNav | **75%** | Cấu trúc đúng (sidebar 3-col + grid 9-col), filter mobile drawer phía Next dùng client-side (cần verify trên trình duyệt). Page hero là intentional improvement. | P2 |
| 5 | `woocommerce/single-product.php` | `/product/[slug]` | ProductGallery, PricingPanel, VariantSelector, AddToCartButton, ReviewsSection, ProductTabs, RecentlyViewedSection, related carousel | **70%** | Hover zoom (lens) là intentional improvement. Tab structure khác WP. Size button 52×52 chưa pixel-perfect verify. Variant color swatch khớp gần. | P1 |
| 6 | `category.php` (WP dùng cho **blog**) | thiếu — không có `/tin-tuc/danh-muc/[slug]` | — | **0%** | WP `category.php` dùng cho blog category archive (có sidebar list categories + grid 4-col blog cards + pagination). Next có `/danh-muc-san-pham/[slug]` nhưng đó là product category. Route blog category còn thiếu — `/tin-tuc?category=xxx` chỉ là query string. | P3 (low — blog category nhỏ, user search nhiều hơn) |
| 7 | `woocommerce/taxonomy-product_cat.php` | `/danh-muc-san-pham/[slug]` ([page.tsx](../../bigbike-web/app/danh-muc-san-pham/[slug]/page.tsx)) | PageHero, CatalogFilters, ProductCard grid | **75%** | Tương đương `/san-pham`. | P2 |
| 8 | `woocommerce/taxonomy-pwb-brand.php` | `/brands/[slug]` ([page.tsx](../../bigbike-web/app/brands/[slug]/page.tsx)) | tương tự category | **75%** | OK | P2 |
| 9 | `page-news.php` | `/tin-tuc` ([page.tsx](../../bigbike-web/app/tin-tuc/page.tsx)) | ArticleCard grid 3-col, PaginationNav | **80%** | ArticleCard có date badge nhô. | P2 |
| 10 | `single.php` (blog post) | `/tin-tuc/[slug]` ([page.tsx](../../bigbike-web/app/tin-tuc/[slug]/page.tsx)) | breadcrumb, header, MediaImage cover, ArticleTOC, body rich-text, social share, footer nav, sidebar widget (featured + recent), related 4 | **80%** | Khớp WP 8/4-col + AutoTOC + sidebar widgets + related 4. Social share là intentional improvement. | P2 |
| 11 | `page-about.php` | `/gioi-thieu` ([page.tsx](../../bigbike-web/app/gioi-thieu/page.tsx)) | PageHero, "Bigbike" head, rich-text body, brand grid 8, service tiles 5, block-contact 3-col | **80%** | Đầy đủ block WP, không có ảnh a-1.png..a-5.png nhưng dùng layout-only thay thế — chấp nhận được. | P2 |
| 12 | `page-contact.php` | `/lien-he` ([page.tsx](../../bigbike-web/app/lien-he/page.tsx)) | PageHero, iframe map, contact-info list 3 SVG-icon, ContactForm | **75%** | Map iframe có. Thiếu pixel-port icons (WP dùng PNG, Next dùng SVG inline). | P2 |
| 13 | `page-static.php` (policy) | `/chinh-sach/[slug]` ([page.tsx](../../bigbike-web/app/chinh-sach/[slug]/page.tsx)) | PageHero, PolicySidebar 3-col + rich-text 9-col | **75%** | PolicySidebar có `.wp-static-navigation`. | P2 |
| 14 | `page-static.php` (warranty) | `/bao-hanh` | PageHero + rich-text (không sidebar) | **65%** | Cần check có PolicySidebar không (file 71 dòng, không có sidebar). | P3 |
| 15 | `page-guide.php` | `/huong-dan-mua-hang` ([page.tsx](../../bigbike-web/app/huong-dan-mua-hang/page.tsx)) | PolicySidebar + rich-text | **75%** | OK | P3 |
| 16 | `page-cart.php` | `/gio-hang` ([page.tsx](../../bigbike-web/app/gio-hang/page.tsx)) | PageHero/title, cart-table, coupon, summary | **70%** | Layout cart-table khớp WP logic. | P2 |
| 17 | `page-checkout.php` | `/thanh-toan` ([page.tsx](../../bigbike-web/app/thanh-toan/page.tsx)) | 3-step form (address + shipping/payment + review) | **60%** | **Vẫn 3-step** dù D3=B "1-page" — intentionally deferred. | P0 (theo decision) hoặc P2 nếu chấp nhận 3-step |
| 18 | `page-login.php` | `/dang-nhap` ([page.tsx](../../bigbike-web/app/dang-nhap/page.tsx)) | LoginForm | **75%** | Thiếu social login Facebook — không có OAuth backend nên không thể port. | P3 |
| 19 | `page-register.php` | `/dang-ky` ([page.tsx](../../bigbike-web/app/dang-ky/page.tsx)) | RegisterForm | **75%** | OK | P3 |
| 20 | (WP forget pass page) | `/quen-mat-khau` | ForgotPasswordFlow | **70%** | OK | P3 |
| 21 | `page-profile.php` (myaccount) | `/tai-khoan/*` ([page.tsx](../../bigbike-web/app/tai-khoan/page.tsx)) | AccountShell sidebar nav | **70%** | OK | P3 |
| 22 | `search.php` | `/tim-kiem` ([page.tsx](../../bigbike-web/app/tim-kiem/page.tsx)) | tương tự catalog | **75%** | OK | P3 |
| 23 | `404.php` | `app/not-found.tsx` | PageHero, search form, nav CTA, recent articles 3 | **70%** | Thiếu render ảnh 404.png mặc dù asset đã có ở `public/wp/404.png`. | P2 |

---

## 5. Component-level Findings

### 5.1 SiteHeader / SiteFooter

**SiteHeader** ([components/layout/SiteHeader.tsx](../../bigbike-web/components/layout/SiteHeader.tsx))
- ✓ Logo desktop + mobile từ `public/wp/logo.png` + `logo-1.png` — đúng asset WP.
- ✓ Sticky `StickyHeaderShell` ([components/layout/StickyHeaderShell.tsx]) tương đương `.headroom` UX.
- ✓ NavTree từ `getPublicMenu("primary")` đẩy lên `HeaderNavItem` (3 cấp menu hỗ trợ `.wp-sub-menu-nested`).
- ✓ CartIcon, SearchToggle, HeaderUserMenu, MobileHeaderMenu đều có.
- ⛔ Header height: token `--bb-header-height: 4rem` = 64px ([brand-tokens.css:205](../../bigbike-web/styles/brand-tokens.css#L205)) khác WP `header .logo { height: 80px }`. **Severity P1** — visual rõ.
- ⛔ Nav font: `var(--bb-font-nav)` = Barlow (không Condensed) — WP dùng `Barlow Condensed`. **Severity P2.**

**SiteFooter** ([components/layout/SiteFooter.tsx](../../bigbike-web/components/layout/SiteFooter.tsx))
- ✓ 2-col grid `1.2fr 2fr`, brand left + 4 sub-col right ([globals.css:90-94](../../bigbike-web/app/globals.css#L90)).
- ✓ Bg `#3a3a3a` top, border-top brand red 3px.
- ⛔ Không có block "foot" `#000` riêng (WP có `.foot { background: #000; padding: 30px 0 }`).
- ⛔ Không có `.scrollToTop` nút đỏ tròn 52×52 ở góc phải-trên khối foot.
- ⛔ Không có khẩu hiệu "Bigbike mong được lắng nghe và thấu hiểu bạn hơn" (WP có).
- ⛔ Mobile không có accordion "Thông tin / Mạng xã hội" với fa-plus toggle (WP `.toggle--item`).
- ✓ Logo footer `public/wp/logo-footer.png` đúng asset.
- ✓ License BCT từ admin settings — improvement.

### 5.2 HeroSlider ([HeroSlider.tsx](../../bigbike-web/components/home/HeroSlider.tsx))

- ✓ Swiper-based với autoplay 5s, navigation buttons + dots — khớp WP `js-home-banner` swiper.
- ✓ Picture element switch desktop/mobile image — khớp WP `image_mobile` field check.
- ✓ Fallback hero khi không có slide (intentional improvement).
- △ Nút prev/next: WP dùng `.swiper-button-next/prev` mặc định (vòng đỏ + chevron trắng), Next custom SVG. Visual có thể khác.

### 5.3 FeaturedProductsCarousel + ExperienceCarousel + HomeVideoCarousel + BrandCarousel

- ✓ Tất cả là carousel — khớp WP "swiper-container".
- △ Cần verify driver carousel: Phase 2 audit nói "không thêm Swiper.js, dùng Embla". Kiểm tra `package.json` thực tế:

<details>
<summary>(audit không kiểm tra package.json — nếu confirmed dùng Swiper, là khác plan; nếu dùng Embla, UX có thể khác nhẹ với WP)</summary>
</details>

### 5.4 WpFeaturedProductCard / FeaturedProductTile ([app/page.tsx:200-256](../../bigbike-web/app/page.tsx#L200))

- Render 3-tile featured ở homepage — port từ WP `content-product-featured-item`.
- Class `.wp-tile-3` không thấy trong globals.css — cần verify CSS đã có (audit này không grep hết).

### 5.5 ProductCard ([ProductCard.tsx](../../bigbike-web/components/catalog/ProductCard.tsx))

- ✓ Title, brand, price, rating, stock badge, sale tag, wishlist, add-to-cart bar.
- ✓ Hover scale + slide-up đúng WP.
- ⛔ Title font-size 14px (Next) vs ~16px/1rem (WP); price 16px (Next) vs 14px (WP). Cảm nhận khác.
- ⛔ Card có border 1px subtle (Next) — WP không có border, chỉ shadow.
- ⛔ Sale badge clip-path parallelogram (Next) vs skewX pseudo-triangle (WP). Hình dạng khác.

### 5.6 ArticleCard ([ArticleCard.tsx](../../bigbike-web/components/content/ArticleCard.tsx))

- ✓ `.wp-news-date` clip-path cờ-đỏ top:-21px — pixel-port từ WP.
- ✓ scale 1.05 hover image.
- ✓ Title Oswald 600 uppercase line-clamp 2.

### 5.7 CatalogFilters / CatalogSortSelect / PaginationNav

- ✓ Cấu trúc tương đương WP filter sidebar 3-col.
- △ Visual styling chưa verify pixel-perfect.

### 5.8 ProductGallery ([ProductGallery.tsx](../../bigbike-web/components/catalog/ProductGallery.tsx))

- ✓ Main image + thumbnail strip — khớp WP `thumbnail-slider`.
- Intentional improvement: hover lens zoom (WP không có), lightbox modal, variant gallery isolation.

### 5.9 ProductTabs ([ProductTabs.tsx](../../bigbike-web/components/catalog/ProductTabs.tsx))

- 3 tab: Mô tả / Thông số / Video. WP dùng `woocommerce_after_single_product_summary` actions cho tabs — markup khác.
- Visual style: border-bottom 2px brand red active — Next có ([globals.css:4754](../../bigbike-web/app/globals.css#L4754)).

### 5.10 ReviewsSection / RecentlyViewedSection

- Intentional improvement: WP rating chỉ là `<div class="rating-star" data-rating="4.5">` data attribute JS. Next có ReviewsSection đầy đủ với UGC. Đây là feature mới, không phải parity vấn đề.

### 5.11 ContactForm ([ContactForm.tsx](../../bigbike-web/components/contact/ContactForm.tsx))

- Form WP dùng `do_shortcode($contact_form)` (Contact Form 7 plugin). Next có ContactForm component tự build.

### 5.12 AccountShell

- ✓ Sidebar 3/9-col tương đương WP myaccount tabs.

### 5.13 Cart / Checkout

- Cart layout cart-table tương đương WP. Visual light cascade OK.
- Checkout vẫn 3-step Next (intentional deferred).

### 5.14 PageHero ([PageHero.tsx](../../bigbike-web/components/layout/PageHero.tsx))

- Intentional improvement: WP có `.page-title` block đơn giản (background image + h1 + breadcrumb + ảnh phải `mu-bao-hiem.png`). Next có PageHero giàu hơn với kicker + description + meta.
- ⛔ WP có ảnh `mu-bao-hiem.png` (mũ bảo hiểm) ở góc phải mỗi page-title — Next không có element này.

### 5.15 Breadcrumb

- WP có `.breadcrumb` markup từ `get_custom_template('content-breadcrumbs')`. Next có Breadcrumb prop trong PageHero.

---

## 6. Responsive Findings

> Đánh giá dựa trên đọc `@media` trong CSS, không có browser test.

### Viewport 360-575px (mobile)

- Hero font-size `--bb-text-hero: 18px` ([brand-tokens.css:674](../../bigbike-web/styles/brand-tokens.css#L674)) — OK.
- Logo `max-width: 80px` khi ≤500px ([globals.css:1545](../../bigbike-web/app/globals.css#L1545)) — OK.
- WP product card có hover-only add-to-cart bar; Next ép always-visible trên touch ([globals.css:4248](../../bigbike-web/app/globals.css#L4248)) — Improvement OK.
- ⛔ Header height 64px (Next) — touch target nav phải ≥ 44px. Token `--bb-touch-target: 44px` có. Nhưng nav padding 26px 30px 27px cho desktop chưa downscale rõ ràng cho mobile (Next hide nav trên mobile, dùng MobileHeaderMenu drawer — OK).
- ⛔ Footer 4 sub-col phải có thể bị overflow horizontal nếu không stack đúng ở 360px. `.bb-footer-right` grid 1-col từ ≤640px ([globals.css:96-100](../../bigbike-web/app/globals.css#L96)) — OK.

### Viewport 768-991px (tablet)

- ⛔ "Double-breakpoint" risk: Tailwind utility `md:` (≥768) khác WP token `--bb-bp-lg` (≥992). Component dùng Tailwind utility có thể flip layout ở 768 trong khi WP-port `@media` flip ở 992. Cần verify cụ thể trên trình duyệt.
- ⛔ Header WP-cũ hide nav ≤992 chuyển sang hamburger; Next StickyHeaderShell xử lý khác — chưa verify.

### Viewport 992-1199px (small desktop)

- Container chưa max 1200px (token 75rem), padding 32px desktop. OK.

### Viewport ≥1200px (desktop)

- Container max 1200px ✓.
- Header container 1750px (WP cũng vậy) ✓.

### Viewport ≥1440px

- Logo max 210px (Next intentional extra, WP không có) — không phải gap, là improvement.

### Risk khác

- ⛔ `wp-product-grid { grid-template-columns: repeat(4, 1fr) }` ([globals.css:4231](../../bigbike-web/app/globals.css#L4231)) — desktop 4 cột. STYLEGUIDE.md ghi "desktop 3 cột" (line 148). Mâu thuẫn token rules. WP gốc dùng `col-md-3 col-6` (3 cột mobile-2 desktop-4) — Next theo WP gốc 4 cột, không theo STYLEGUIDE.
- ✓ Tap target 44px ([brand-tokens.css:216](../../bigbike-web/styles/brand-tokens.css#L216)) — đúng.
- ⛔ Image ratio: `.wp-product-image` aspect-ratio 1:1 ([globals.css:4237](../../bigbike-web/app/globals.css#L4237)). WP product image có `width: auto; max-width: 100%; min-height: 200px`. Lệch — Next force vuông, WP để flex.

---

## 7. Animation / Interaction Findings

| Hành vi | WP | Next | Khớp? |
|---|---|---|---|
| Hover product image scale | 1.05 transition .3s ease | 1.05 transition .3s ease | ✓ |
| Slide-up add-to-cart | bottom: -51px → 0 transition .32s | translateY 100% → 0 transition .32s | ✓ |
| Sale badge hình dạng | skewX(-20deg) pseudo triangle | clip-path parallelogram | △ Khác kỹ thuật |
| Dropdown menu | opacity 0→1 + translateY -10px → 0 transition .3s | giống ([globals.css:1641-1648](../../bigbike-web/app/globals.css#L1641)) | ✓ |
| Header sticky | `.headroom` JS auto-hide on scroll down | `StickyHeaderShell` data-header-hidden translateY -100% transition 0.3s | ✓ Tương đương |
| Carousel | Swiper 5.1 autoplay 5000ms | Swiper (HeroSlider) autoplay 5000ms | ✓ |
| Button hover | đổi bg đậm hơn | scale(1.02) + bg đổi ([brand-tokens.css:411-413](../../bigbike-web/styles/brand-tokens.css#L411)) | △ Next có scale, WP không |
| Card hover | shadow nặng hơn | border đỏ + shadow đỏ nhẹ | △ Khác visual |
| Mobile drawer | slide-in từ phải | tương tự (MobileHeaderMenu) | △ Cần verify |
| Search overlay | overlay đen .64 + input 80px height Oswald 24px | (SearchToggle) | △ Chưa verify |
| Form focus | border đậm | border blue + ring rgba(0,123,255,0.1) | △ Khác màu (Next blue, WP đen) |
| Loading/empty/error | spinner Bootstrap + WP toast | LoadingGrid, EmptyState, ErrorState, Skeletons (intentional improvement) | △ Intentional |
| Prefers-reduced-motion | không xử lý | `@media (prefers-reduced-motion: reduce)` ([brand-tokens.css:698-707](../../bigbike-web/styles/brand-tokens.css#L698)) | ✓ Improvement |

---

## 8. Asset Parity Findings

### Đã port (✓)

| Asset | WP source | Next target |
|---|---|---|
| Logo desktop | `images/logo.png` | `public/wp/logo.png` |
| Logo mobile | `images/logo-1.png` | `public/wp/logo-1.png` |
| Logo footer | `images/logo-footer.png` | `public/wp/logo-footer.png` |
| Banner ads | `images/banner-ads.jpg` | `public/wp/banner-ads.jpg` |
| Page title bg | `images/page-title-bg.png` | `public/wp/page-title-bg.png` |
| Mũ bảo hiểm decor | `images/mu-bao-hiem.png` | `public/wp/mu-bao-hiem.png` (chưa dùng trong PageHero) |
| 404 illustration | `images/404.png` | `public/wp/404.png` (chưa render trong app/not-found.tsx) |
| Video bg | `images/video-bg.jpg` | `public/wp/video-bg.jpg` |
| Cat hover | (custom) | `public/wp/cat-hover.jpg` |
| Logo mobile | (alias) | `public/wp/logo-mobile.png` |

### Còn thiếu / chưa port (⛔)

- `images/cart-thumbnail.png` (empty cart illustration)
- `images/contact-call-icon.png`, `contact-marker-icon.png`, `contact-calendar-icon.png` (Next thay bằng SVG inline — intentional)
- `images/license.png` (BCT license logo — Next dùng BctBadge component)
- `images/a-1.png`..`a-5.png` (5 ảnh quality cards trong about — Next thay bằng layout text-only)
- `images/facebook-login.svg`, `images/google-login.svg` (social login icon — Next không có OAuth)
- `images/blog-1.png`, `images/call.jpg/png`, `images/hover.png`, `images/Group 2239.png`, `images/Union-2.png`, `images/union-1..7.png` (decoration WP — không critical)
- `images/icon-1..10.svg` (generic feature icons — không critical)
- `images/star.png` (rating bg — Next dùng RatingStars SVG)
- `images/policy.png`, `policy1.png` (decoration policy page)
- `images/sena-50s_50r_5s_750x1000-fixed-1.jpg` (specific product hero)

### Rác cần dọn trong Next (do brand 2026 cũ chưa xoá)

- `public/fonts/Bungee-Regular.ttf` (~150KB) — không còn dùng từ khi flip sang Oswald.
- `public/fonts/Exo-*.ttf` (12 file ~5MB tổng) — không còn dùng từ khi flip sang Barlow.
- `public/brand/` (logo Bungee 2026 cũ) — `logo-mono-white.png`, `logo-primary.png`, `logo-wordmark.png`, `slogan.png`, `favicon`, `icons`, `signage`, `social`, `wp-logo` — không thấy reference trong UI hiện tại (cần grep verify trước khi xoá).
- `public/file.svg`, `next.svg`, `vercel.svg`, `window.svg`, `globe.svg` — boilerplate Next.js không xoá.

---

## 9. SEO / Data / Business Logic Risk

> Phần nào KHÔNG được sửa khi implement fix UI parity.

### KHÔNG được đụng

- ❌ Sửa shape contracts trong `lib/contracts/public.ts`, `lib/contracts/commerce.ts`.
- ❌ Sửa server fetch helpers `lib/api/public-api.ts` (`listProducts`, `listArticles`, `listHomeSliders`, `listHomeVideos`, `listBrands`, `listCategories`, `listPublicSettings`, `getProductBySlug`, `getCategoryBySlug`, `getArticleBySlug`, `getBrandBySlug`, `getPageBySlug`, `getPublicMenu`).
- ❌ Sửa client mutation `lib/api/client-api.ts` (CSRF token, X-CSRF-Token header, Idempotency-Key header, session cookie).
- ❌ Sửa `generateMetadata()`, `generateStaticParams()` của route động.
- ❌ Sửa JSON-LD builders `lib/seo/json-ld.ts` (Product, Article, Breadcrumb, Organization, LocalBusiness, FAQ).
- ❌ Sửa `app/sitemap.ts`, `app/robots.ts`.
- ❌ Sửa `app/api/revalidate/route.ts` (ISR on-demand).
- ❌ Sửa `export const revalidate = 3600`.
- ❌ Đổi slug routes (`/product/[slug]`, `/danh-muc-san-pham/[slug]`, `/tin-tuc/[slug]`, `/brands/[slug]`, `/chinh-sach/[slug]`, `/san-pham`, `/tin-tuc`, `/gio-hang`, `/thanh-toan`, `/dang-nhap`, `/dang-ky`, `/tai-khoan/*`, `/lien-he`, `/gioi-thieu`, `/bao-hanh`, `/huong-dan-mua-hang`, `/tim-kiem`, `/quen-mat-khau`).
- ❌ Hardcode hotline / địa chỉ / BCT vào UI khi đã có `listPublicSettings()`. (Audit trước đã flag.)
- ❌ Thay mock data vào chỗ đang fetch thật.
- ❌ Sửa checkout business flow (CSRF, idempotency, snapshot pricing, price-change-warning) khi chưa có e2e test bảo vệ.

### An toàn để sửa (UI-only)

- ✅ Sửa CSS trong `app/globals.css`, `styles/brand-tokens.css`.
- ✅ Tinh chỉnh giá trị token (header-height, shadow, font family) trong `brand-tokens.css`.
- ✅ Đổi markup trong component nếu vẫn nhận cùng props từ contracts (không phá data flow).
- ✅ Tách/gộp class CSS.
- ✅ Thêm/sửa SVG inline icon.
- ✅ Thêm/sửa Image src trỏ về asset đã port (`public/wp/*`).
- ✅ Resequence section trong `app/page.tsx` (nếu giữ data fetch nguyên).

---

## 10. Fix Plan nếu muốn đạt 100% (Đề xuất chia 7 phase)

### Phase 1 — Cleanup foundation (0.5 ngày)

| File | Thay đổi | Risk | Test |
|---|---|---|---|
| `bigbike-web/public/fonts/Bungee*.ttf`, `Exo*.ttf` | Xoá | Low — không reference | typecheck + build |
| `bigbike-web/public/brand/*` | Verify unused → xoá | Low — grep trước | build |
| `bigbike-web/public/file.svg`, `next.svg`, `vercel.svg`, `window.svg`, `globe.svg` | Xoá boilerplate | Low | build |

Expected parity gain: rác giảm, không tăng %.

### Phase 2 — Header/Footer pixel-fix (1 ngày)

| File | Thay đổi | Risk | Test | Severity |
|---|---|---|---|---|
| `styles/brand-tokens.css:205` | `--bb-header-height: 4rem` → `5rem` (80px) | Med — `bb-main padding-top` rebase | Header overflow, sticky offset | P1 |
| `styles/brand-tokens.css:136` | `--bb-font-nav: var(--font-barlow)` → `var(--font-barlow-condensed)` | Low | Visual nav text | P2 |
| `app/globals.css:1566` | `.wp-navigation { font-family: var(--bb-font-nav) }` — tự cascade | — | — | — |
| `app/globals.css` Footer | Thêm khối `.bb-footer-bottom { background: #000 }` riêng để tạo 2-tone WP | Low | Visual | P1 |
| `components/layout/SiteFooter.tsx` | Thêm scroll-to-top button bg đỏ tròn 52×52 + slogan "Bigbike mong được lắng nghe..." | Med — markup mới | Visual + a11y | P1 |
| Mobile footer accordion (`.toggle--item` với `<details>`) | Add | Med | Visual | P2 |

Expected parity gain: header/footer 80% → 92%.

### Phase 3 — Homepage section reorder + cleanup (1 ngày)

| File | Thay đổi | Risk | Test |
|---|---|---|---|
| `app/page.tsx` | Reorder block theo WP: hero → featured 3 → about → product carousel → category grid → banner ads → news → (intentional: video, brand, SEO) | Med — order ảnh hưởng a11y heading + ISR cache miss tạm | Visual + Lighthouse |
| Cân nhắc bỏ "feature row commit" / "experience carousel" nếu cần parity tuyệt đối | High — mất feature business | — |

Expected parity gain: homepage 65% → 80% nếu reorder, 90% nếu bỏ section dư.

### Phase 4 — Product listing + PDP pixel-fix (1 ngày)

| File | Thay đổi | Risk | Test | Severity |
|---|---|---|---|---|
| `app/globals.css` `.wp-product-card` | Bỏ `border` (WP không có) | Low — visual khác | screenshot | P2 |
| `app/globals.css` `.wp-product-name` | `font-size: 14px` → `16px` (1rem WP) | Low | screenshot | P2 |
| `app/globals.css` `.wp-product-price` | `font-size: 16px` → `14px`, `font-weight: 700` → `600` | Low | screenshot | P2 |
| `app/globals.css` `.wp-product-tag` | Thay clip-path bằng skewX(-20deg) + pseudo triangle để match WP pixel-perfect | Low | screenshot | P3 (chấp nhận khác kỹ thuật) |
| Variant size button 52×52 border 1px #000 | Verify class trong `VariantSelector` | Low | screenshot | P2 |

Expected parity gain: catalog/PDP 70-75% → 85-90%.

### Phase 5 — Blog / About / Contact / Policy completion (1 ngày)

| File | Thay đổi | Risk | Test |
|---|---|---|---|
| `app/gioi-thieu/page.tsx` | (Optional) port 5 ảnh `a-1.png..a-5.png` cho service tiles | Low — chỉ thêm Image | visual |
| `app/lien-he/page.tsx` | (Optional) port 3 PNG icon contact (call/marker/calendar) thay SVG | Low | visual |
| `app/bao-hanh/page.tsx` | Thêm PolicySidebar nếu chưa có | Low | visual |
| `app/tin-tuc/danh-muc/[slug]/page.tsx` (mới) | Tạo route blog category để khớp WP `category.php` | Med — sitemap/SEO mới | metadata + sitemap |

Expected parity gain: blog/about/contact 75-80% → 85-90%.

### Phase 6 — Cart / Checkout (deferred — task riêng)

| Decision | Action |
|---|---|
| Giữ 3-step Next (recommended) | Document trong STYLEGUIDE.md là intentional improvement; không sửa |
| Đổi sang 1-page WP | Task riêng có e2e test bảo vệ (CSRF, Idempotency, snapshot pricing) |

Expected parity gain: nếu giữ 3-step + label intentional → checkout 60% → 80% (do reframe), nếu 1-page → 60% → 90%.

### Phase 7 — Asset render + Visual QA (0.5 ngày)

| File | Thay đổi | Risk | Test |
|---|---|---|---|
| `app/not-found.tsx` | Thêm `<Image src="/wp/404.png">` | Low | visual |
| `components/layout/PageHero.tsx` | (Optional) thêm `mu-bao-hiem.png` decoration ở góc phải | Low | visual |
| Chạy Playwright screenshot diff với WP cũ trên 5 page chính ở 3 viewport (390/768/1440) | Tạo `docs/audits/screenshots/{wp,next,diff}/` | Med | manual review |

Expected parity gain: 4% từ asset rendering + verified baseline.

### Tổng

Sau 7 phase: parity ước lượng **88-92%**. Mục tiêu **100% không khả thi** nếu giữ các intentional improvement (3-step checkout, SEO content, brand carousel, social share, hover zoom PDP, prefers-reduced-motion, từ-admin license/hotline, AutoTOC, sidebar widgets blog, stock badge, wishlist).

---

## 11. Final Recommendation

### Có nên match 100% WP không?

**Không.** Chốt mục tiêu **~88-90%** với các quyết định sau:

### Nên giữ từ Next (intentional improvement):

1. **3-step checkout** — UX tốt hơn 1-page WP dài. Yêu cầu document trong STYLEGUIDE.md.
2. **Hover zoom + lightbox PDP gallery** — UX tốt hơn WP thumbnail strip thuần.
3. **Brand carousel + video carousel** ở homepage — nội dung phong phú hơn WP.
4. **SEO content bottom homepage** — quan trọng cho SEO local Vietnamese.
5. **Stock badge + wishlist** trên product card — feature mới có giá trị.
6. **Social share Facebook/Zalo** trên blog detail.
7. **AutoTOC + blog sidebar widgets** — đã implement Phase 3.5.
8. **Prefers-reduced-motion** support.
9. **Hotline/BCT/license từ admin settings** thay vì hardcode trong template — cốt lõi của Next vs WP cũ.
10. **Stock/preorder/low-stock badge variants**.
11. **Light theme sharp radius (0)** + **WP-light brand-token** — đã chốt Track B (xem `BIGBIKE_WEB_BACKGROUND_COLOR_AUDIT.md`).

### Bắt buộc sửa để user/business thấy giống WP (P1):

1. **Header-height 64 → 80px** (token `--bb-header-height`).
2. **Nav font Barlow → Barlow Condensed**.
3. **Footer 2-tone đen (top #3a3a3a + foot #000)** + **scroll-to-top button đỏ** + **slogan "Bigbike mong được lắng nghe..."**.
4. **Product card bỏ border** + **kích cỡ font title/price khớp WP** (16/14 thay vì 14/16).
5. **Render 404.png trong app/not-found.tsx**.
6. **Section ordering homepage** ít nhất resequence sao cho WP-core (hero → featured 3 → about → carousel → category → ads → news) đứng trước improvement (video, brand, SEO).

### Chỉ document là intentional difference (không sửa):

1. Logo desktop 210px ở viewport ≥1440 (Next extra).
2. Border subtle trên product card + light shadow.
3. Sale badge clip-path parallelogram (gần khớp visual skewX WP).
4. Brand grid 8 logo + service tiles 5 trong About không có 5 ảnh a-*.png decoration.
5. Contact icons SVG inline thay PNG WP.
6. Search overlay implementation tham chiếu UX, không pixel-perfect.

### Quyết định cần xin trước Phase 2-7:

| # | Câu hỏi | Lựa chọn |
|---|---|---|
| Q1 | Có chấp nhận 3-step checkout là intentional improvement không? | (A) Có — chỉ document / (B) Không — làm 1-page WP với e2e test bảo vệ |
| Q2 | Có muốn reorder homepage để WP-core đứng trước improvement không? | (A) Có / (B) Giữ thứ tự hiện tại |
| Q3 | Có cần render asset trang trí mu-bao-hiem.png ở mọi PageHero không? | (A) Có / (B) Bỏ — đã thay bằng PageHero kicker/description |
| Q4 | Có cần port social login Facebook/Google không? | (A) Có — cần thêm OAuth backend / (B) Không |
| Q5 | Mục tiêu parity số liệu | (A) 88-90% (recommended) / (B) ≥95% (cần Phase 8) / (C) 100% (không khả thi nếu giữ intentional improvement) |

---

## 12. Bằng chứng nhanh

| Claim | Evidence path |
|---|---|
| Header bg `#000` cố định | `bigbike_vn__2026_04_17/files/wp-content/themes/bigbike/dist/general-page.css` `header { background: #000 }` ; `bigbike-web/app/globals.css:1465` |
| Header height 80px WP | `dist/general-page.css` `header .logo { height: 80px }` ; Next: `brand-tokens.css:205` `--bb-header-height: 4rem` = 64px |
| Footer top `#3a3a3a` | `dist/general-page.css` `footer .top { background:#3a3a3a; padding:60px 0 }` ; Next: `app/globals.css:47` |
| Footer foot `#000` riêng | `dist/general-page.css` `footer .foot { background:#000; padding:30px 0; color:#fff }` ; Next: KHÔNG có block riêng |
| Nav font Barlow Condensed | `dist/general-page.css` `header .navigation { font-family: 'Barlow Condensed', sans-serif }` ; Next: `var(--bb-font-nav)` = Barlow ([brand-tokens.css:136](../../bigbike-web/styles/brand-tokens.css#L136)) |
| Product card scale 1.05 + slide-up cart | `dist/product-page.css` `.product--item-cart { transform:translate(0,100%); transition:.32s }` ; Next: `app/globals.css:4246` ✓ |
| Sale badge skewX | `dist/product-page.css` `.product--item-sale p:after { border-left:42px solid transparent; ... }` ; Next: `app/globals.css:4242` clip-path |
| News date badge `top:-21px` | `dist/home.css` `.news-date { ... }` ; Next: `app/globals.css:5564` ✓ |
| Container 1750px header WP | `dist/general-page.css` `header .container { max-width:1750px }` ; Next: `app/globals.css:1479` ✓ |
| Sub-menu width 300px | `dist/general-page.css` ; Next: `app/globals.css:1636` ✓ |
| Light-first decision | `docs/audits/BIGBIKE_WEB_BACKGROUND_COLOR_AUDIT.md` (Track B chosen) |
| Logo asset port | `bigbike-web/public/wp/logo.png`, `logo-1.png`, `logo-footer.png` ✓ |
| 404 asset port | `bigbike-web/public/wp/404.png` (có) — chưa render trong `app/not-found.tsx` |
| 3-step checkout still | `app/thanh-toan/page.tsx` ; WP_TO_NEXT_UI_PARITY_REPORT.md §6.3 "intentionally deferred" |
| Old fonts dư | `bigbike-web/public/fonts/Bungee-Regular.ttf`, `Exo-*.ttf` (12 file) |
| Old brand dư | `bigbike-web/public/brand/logo-*`, `slogan.png` |

---

## 13. Lệnh nên chạy (không chạy trong audit này)

```bash
cd bigbike-web
npm install
npm run typecheck    # baseline pre-fix
npm run lint         # 4 errors pre-existing (audit cũ đã flag)
npm run build        # 174 pages target
npm run test         # 95/95 baseline
# Browser test cần Phase 7:
npx playwright test  # screenshot diff
```

---

## 14. Kết luận

`bigbike-web` đã đạt được **~72%** visual parity với `bigbike_vn__2026_04_17` thông qua chiến lược **token cascade + WP-light overrides + Phase 3.5 component port**. Foundation (color/font/spacing/container/breakpoint), header/footer 2-col dark, product card hover-scale + slide-up + skewed sale tag, article card date badge nhô, blog sidebar widgets + AutoTOC, About brand grid + service tiles, Contact map iframe, PolicySidebar, footer 2-col — đều đã có.

Gap còn lại:
- **P1 (visual lệch rõ):** header height 64 vs 80px, nav font Barlow vs Barlow Condensed, footer thiếu khối foot đen + scroll-to-top + slogan, product card border subtle dư + font size lệch, 404.png chưa render.
- **P2 (lệch nhẹ, cải tiến chấp nhận được):** section ordering homepage, sale badge kỹ thuật, contact icon SVG vs PNG, About không có 5 ảnh decoration.
- **P0 theo decision cũ:** checkout 1-page (D3=B) chưa thực hiện — recommend giữ 3-step.

**Đạt 100% không khả thi nếu giữ intentional improvement.** Target hợp lý **~88-90%** với Phase 1-7 trong §10. Phase 1-2 đã đủ chốt P1 visual gaps.

---

**Audit này là read-only.** Không có file source nào được chỉnh sửa. Bước tiếp theo là user xác nhận Q1-Q5 ở §11, sau đó tạo task riêng cho từng phase.
