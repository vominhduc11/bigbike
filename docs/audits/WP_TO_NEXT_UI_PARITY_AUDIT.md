---
title: WordPress → Next.js UI Parity Audit
status: PHASE_1_AUDIT
created: 2026-05-11
scope: Rebuild `bigbike-web` UI to visually match the old WordPress theme `bigbike_vn__2026_04_17/themes/bigbike/` while preserving Next.js architecture, data fetching, SEO, and business logic.
related:
  - docs/audits/HOMEPAGE_UI_UX_RESPONSIVE_PRECHECK.md
  - docs/audits/WEB_MODULE_FULL_COMPLETION_AUDIT.md
  - docs/audits/ISR_CSR_HYBRID_REVALIDATION_AUDIT.md
  - bigbike-web/STYLEGUIDE.md
---

# WordPress → Next.js UI Parity Audit

> Phase 1 deliverable of the **"Rebuild bigbike-web UI 1:1 với WP cũ"** task.
> Không code presentation cho đến khi audit này được người duyệt.

---

## 0. ⚠️ Xung đột Design System — **PHẢI QUYẾT ĐỊNH TRƯỚC PHASE 2**

| Dimension | WordPress cũ | bigbike-web hiện tại | Mâu thuẫn |
|---|---|---|---|
| Theme nền | **Sáng** (`#fff` / `#f8f8f8`) | **Tối** (`#0a0a0a`, gradient đen) | ⛔ Trực tiếp |
| Màu nhấn chính | `#ff0c09` (đỏ) | `#F90606` (đỏ) | Gần giống (chấp nhận) |
| Font tiêu đề | **Oswald** SemiBold, UPPERCASE | **Bungee** Regular, UPPERCASE | ⛔ Mặt chữ khác hẳn |
| Font body | **Barlow** Light/Regular/Bold | **Exo** | ⛔ Mặt chữ khác |
| Hover product card | **Scale 1.05** ảnh + slide-up cart button | **Lift `-2px` + viền đỏ**, *cấm scale* | ⛔ Quy định ngược nhau |
| Tone tổng thể | Cleán, sáng, biker e-commerce kiểu 2020 | Aggressive dark "race spec", modern 2026 | ⛔ Cảm giác hoàn toàn khác |
| Grid breakpoints | Bootstrap 4 (576/768/992/1200) | Tailwind v4 mặc định (640/768/1024/1280) | Khác nhỏ, có thể sửa |
| Container | `1200px` | Tailwind container default | Có thể sửa |
| Heading sizes | 16–40px | Lớn hơn (display 2.5rem+) | Có thể sửa |
| Sale badge | Hộp đỏ skew-X(-20deg) | Pill outline-light | ⛔ Hình dạng khác |

**Bằng chứng:**

- WP styles: `bigbike_vn__2026_04_17/files/wp-content/themes/bigbike/styles/main.css`, `home.css`, `product.css`, `fonts.css` (Barlow + Oswald @font-face).
- Next.js styles: `bigbike-web/styles/brand-tokens.css` + `bigbike-web/STYLEGUIDE.md` (bắt buộc dark + Bungee + no-scale).

**Kết luận:** Nếu làm UI giống WP cũ thì PHẢI **bỏ STYLEGUIDE.md hiện tại** (vốn là kết quả của re-brand 2026). Hai bộ quy tắc không thể cùng tồn tại. Cần xác nhận với chủ sản phẩm:

- (A) Override STYLEGUIDE.md, làm light theme giống WP — **mất nhận diện brand mới 2026**.
- (B) Giữ STYLEGUIDE.md (dark + Bungee), chỉ port **bố cục/section/layout/grid** của WP — UI khác hẳn về visual nhưng giữ được brand identity 2026.
- (C) Light theme nhưng dùng **font Bungee** thay cho Oswald → vẫn lệch với WP cũ nhưng giữ tinh thần brand mới.

Mỗi phương án sẽ ra audit/parity-report khác nhau ở Phase 4.

---

## 1. Phương pháp

- Đọc thủ công 21 file template PHP, 12 file CSS theme WP, toàn bộ cây `bigbike-web/app/`, `components/`, `lib/`, `styles/`.
- Cross-reference với 6 audit docs hiện hữu (xem [§7](#7-risk-list)).
- Không suy diễn — tất cả token/URL/class đều có path bằng chứng.

---

## 2. WP screens × Next.js routes — mapping

| # | WP screen / template | Next.js route | Component(s) hiện tại | Status | Notes |
|---|---|---|---|---|---|
| 1 | `page-templates/page-home.php` (Homepage: banner Swiper → featured 3 → about → carousel 5 → category grid 4 → banner ads → blog carousel 3) | `/` ([app/page.tsx](bigbike-web/app/page.tsx)) | HeroSlider, BrandCarousel, FeaturedProductsCarousel, ExperienceCarousel, HomeVideoCarousel | **Khác cấu trúc** — Next có video carousel/brand carousel, WP có featured 3-tile + about + banner ads. Section order khác. | Cần resequence + thêm section "about block" + "banner-ads single" + "category grid 4-col" |
| 2 | `woocommerce/archive-product.php` (Shop all) | `/san-pham` | CatalogFilters, ProductCard, CatalogSortSelect, PaginationNav | Cấu trúc tương đương | Đổi presentation product card + filter sidebar position (WP filter ở sidebar trái, full grid bên phải) |
| 3 | `woocommerce/single-product.php` (PDP) | `/product/[slug]` | ProductGallery, PricingPanel, VariantSelector, ReviewsSection, RecentlyViewedSection | Tương đương | Layout WP: gallery trái 380×380 + thumb 380×120 dưới, info phải, "thông số kỹ thuật" tab dưới, "review" tab, related products carousel cuối |
| 4 | `category.php` (blog category archive) | `/danh-muc-san-pham/[slug]` (product cat) **AND** missing for blog category | PageHero, CatalogFilters, ProductCard | WP category dùng cho **blog**, không phải product. Product category WP đi qua `archive-product.php`. | Cần làm rõ: WP blog category template áp cho route `/tin-tuc/danh-muc/[slug]` chưa tồn tại |
| 5 | `single.php` (blog post detail) | `/tin-tuc/[slug]` | PageHero + ArticleCard (related) | Layout WP: 8/4 col, sidebar có featured/recent posts, table-of-contents tự sinh từ h2/h3/h4, 4 related cuối bài | Cần thêm: sidebar widgets, auto TOC, related 4 items |
| 6 | `page-templates/page-news.php` (blog index) | `/tin-tuc` | ArticleCard grid, PaginationNav | Tương đương | WP grid 3-col, mỗi card có date badge nhô lên trên ảnh (-21px), shadow rõ |
| 7 | `page-templates/page-about.php` | `/gioi-thieu` | Generic page | WP: page-title banner + 3-col về chúng tôi + brand grid 8 logo + service quality | Cần thêm brand grid + service quality blocks |
| 8 | `page-templates/page-contact.php` | `/lien-he` | ContactForm | WP: full-width iframe map + 2-col (info trái + form phải, info có icon list cho phone/address/hours) | Cần thêm map iframe + redesign info column |
| 9 | `page-templates/page-static.php` (policy) | `/chinh-sach/[slug]`, `/bao-hanh`, `/huong-dan-mua-hang` | PageHero + rich text | WP layout 3/9 col với sidebar nav `.static-navigation` link tới các policy | Cần shared "policy sidebar" component |
| 10 | `page-templates/page-cart.php` (WooCommerce cart) | `/gio-hang` | CartIcon + cart page | WP: breadcrumb + title + cart-table layout | Layout khác hẳn (Next.js dùng dark theme card). Resequence |
| 11 | `page-templates/page-checkout.php` (WooCommerce checkout) | `/thanh-toan` (3-step) | 3-step form | WP: 1 trang cart-table + customer details columns | Phải quyết: giữ 3-step Next.js (UX tốt hơn) hay copy WP 1-page? — đề xuất **giữ 3-step**, chỉ đổi visual |
| 12 | `page-templates/page-login.php` | `/dang-nhap` | login form | WP: split layout (social login icons + email/password) | Cần thêm "social login" UI nếu có Google/Facebook (hiện không có) |
| 13 | `page-templates/page-register.php` | `/dang-ky` | register form | WP layout split + terms checkbox | Tương đương |
| 14 | `page-templates/page-profile.php` (`my-account`) | `/tai-khoan` + sub-routes | AccountShell | Tương đương cấu trúc 3/9 col | Sidebar item names có thể đồng bộ với WP |
| 15 | `page-templates/page-guide.php` | `/huong-dan`, `/huong-dan/[...sub]` | catch-all | Tương đương | Layout giống policy (3/9 col) |
| 16 | `search.php` | `/tim-kiem` | search page | WP dùng archive-product layout cho search | Tương đương |
| 17 | `archive.php` (blog archive generic) | thiếu — chỉ có `/tin-tuc` | — | Có thể bỏ qua, gộp vào `/tin-tuc` | — |
| 18 | `404.php` | `app/not-found.tsx` | NotFound component | WP có ảnh 404.png lớn + "về trang chủ" CTA | Có thể nâng cấp |
| 19 | `single-review.php` | không có route tương đương | — | Review của WP là CPT riêng, hiện không port | Skip |
| 20 | `single-video.php` | không có route tương đương | HomeVideoCarousel | Tương đương "video showcase" | Skip page; giữ carousel ở home |

---

## 3. Design tokens trích xuất từ WP

> Tham chiếu: `styles/main.css`, `home.css`, `product.css`, `fonts.css`, `style.css`. Đây là **token gốc của WP**. Việc map vào Tailwind/CSS-var sẽ làm ở Phase 2 nếu chọn phương án (A) hoặc (C).

### 3.1 Colors

| Token | Value | Source |
|---|---|---|
| `--wp-primary-red` | `#ff0c09` | `home.css`, `product.css` (sale badge, CTA hover) |
| `--wp-black` | `#000000` | brand text, header logo |
| `--wp-white` | `#ffffff` | bg page, card bg, header text trên scroll |
| `--wp-text-body` | `#404040` | body text |
| `--wp-text-dark` | `#3a3a3a` / `#4b4b4b` | nav text, heading dark |
| `--wp-text-muted` | `#7e7e7e` / `#717171` / `#777` | footer text, meta |
| `--wp-text-mute-soft` | `#6f6f6f` | submenu link |
| `--wp-bg-soft` | `#f8f8f8` / `#f7f7f7` / `#f2f2f2` | category item bg |
| `--wp-bg-soft-2` | `#e4e4e4` / `#eee` | divider area |
| `--wp-border` | `#cecece` / `#dfdfdf` / `#ccc` | input border, card border |
| `--wp-border-strong` | `#707070` | strong divider |
| `--wp-link` | `royalblue` | mặc định a |
| `--wp-link-visited` | `purple` | mặc định a:visited |
| `--wp-link-hover` | `midnightblue` | mặc định a:hover |
| `--wp-error` | `#e45649` / `#721c24` | toast/alert |
| `--wp-success` | `#50a14f` | toast |
| `--wp-overlay-1` | `rgba(0,0,0,.05–.64)` (nhiều mức) | shadow/overlay |

### 3.2 Typography

| Token | Value | Source |
|---|---|---|
| `--wp-font-body` | `Barlow, sans-serif` | `fonts.css` |
| `--wp-font-condensed` | `Barlow Condensed, sans-serif` | hiếm dùng |
| `--wp-font-display` | `Oswald, sans-serif` | headings, buttons, product titles, prices |
| Font weights | 300 (Light), 400, 500 (Medium), 600 (SemiBold), 700 | Barlow + Oswald `.woff` files |
| `--wp-text-xs` | 12px / 0.75rem | meta |
| `--wp-text-sm` | 14px / 0.875rem | submenu, table |
| `--wp-text-base` | 16px / 1rem | body |
| `--wp-text-md` | 18px / 1.143rem | block title small |
| `--wp-text-lg` | 20px / 1.25rem | nav, h3 |
| `--wp-text-xl` | 22–24px | h2, block title |
| `--wp-text-2xl` | 35px / 2.143rem | h1 page-title |
| `--wp-text-3xl` | 40–50px | hero |
| Body line-height | 1.5 | normalize |
| Heading line-height | 1.214rem / 1.357rem / 1.625rem | Oswald headings |

Fonts đều là Google Fonts → **không cần copy `.woff`**, load qua `next/font/google` cho Barlow + Oswald.

### 3.3 Spacing / container / breakpoints

| Token | Value | Source |
|---|---|---|
| `--wp-container-max` | `1200px` | Bootstrap 4 default + custom |
| `--wp-section-y` | `60px` | section padding-y |
| `--wp-card-padding` | `15px` / `20px` / `30px` / `41px` | product/news cards |
| Form input padding | `3px` to `10px / 15px` | input/select |
| Button padding | `0 20px` đến `0 30px` | CTA |
| Spacing scale | 4/8/16/24/48 px | tương đương Tailwind |
| Breakpoint sm | 576px | Bootstrap 4 |
| Breakpoint md | 768px | Bootstrap 4 |
| Breakpoint lg | 992px | Bootstrap 4 |
| Breakpoint xl | 1200px | Bootstrap 4 |

> Hiện Next.js dùng Tailwind v4 breakpoints `640/768/1024/1280`. **Khác Bootstrap 4**. Đề xuất giữ Tailwind default; chỉ chỉnh container max-width = 1200px.

### 3.4 Border radius, shadows, transitions

| Token | Value | Source |
|---|---|---|
| `--wp-radius-sm` | `3px` / `4px` | button, input |
| `--wp-radius-md` | `10px` | card |
| `--wp-radius-full` | `50%` | avatar, pill |
| `--wp-shadow-sm` | `0 3px 3px rgba(0,0,0,.2)` | nav/button |
| `--wp-shadow-card` | `0 3px 6px rgba(0,0,0,.16)` | news card, product card |
| `--wp-shadow-lg` | `0 0 30px rgba(0,0,0,.16)` | dropdown |
| `--wp-shadow-dropdown` | `0 0 40px -4px rgba(17,17,17,.7)` | header dropdown |
| `--wp-transition-fast` | `.3s ease` | hover |
| `--wp-transition-cart` | `.32s ease` | add-to-cart slide |
| `--wp-transition-slow` | `.7s ease` | carousel fade |

### 3.5 Button variants

| Class | Bg | Color | Border | Notes |
|---|---|---|---|---|
| `.btn` (base) | — | — | — | width 170px, height 40–50px, line-height đồng bộ height, uppercase, Oswald 600 |
| `.btn-red` | `#ff0c09` | `#fff` | none | Hover: tối đỏ hoặc invert |
| `.btn-white` | `#fff` | `#000` | `1px solid #ccc` | |
| `.btn-outline` | transparent | brand | `1px solid #ff0c09` | |
| `.btn-larger` | — | — | — | height 50px, padding `0 30px` |
| Product add-to-cart | `#000` | `#fff` | none | height 51px, slide-up từ `bottom:-51px`, ẩn cho đến `.product--item:hover` |

### 3.6 Product card

```
.product--item                                 (relative, overflow: hidden)
├── .product--item-thumbnail                   (margin-bottom: 20px, overflow: hidden)
│   └── <img>                                  (transform: scale(1) → 1.05 on parent:hover)
├── .product--item-sale                        (abs top-left, bg #ff0c09, w 70 × h 42, skewX(-20deg) pseudo)
├── .product--item-cart  ("Thêm vào giỏ")      (abs bottom:-51px → bottom:0 on hover, bg #000, color #fff, h 51px)
└── .product--item-desc
    └── .product--item-inside
        ├── .product--item-category            (Oswald 600, color #ff0c09)
        ├── .product--item-title               (Oswald 600, color #000, 1rem)
        └── .product--item-price               (Oswald 600, color #000, text-right; old strikethrough #cecece)
```

### 3.7 News/blog card

```
.news--item                                    (shadow 0 3px 6px rgba(0,0,0,.16))
├── .news--item-thumbnail                      (lazy bg-image)
└── .news--item-desc                           (padding 41px 20px 30px)
    ├── .news-date                             (abs top:-21px, bg #ff0c09, color #fff)
    └── .news--item-inside
        ├── title                              (Oswald 600)
        └── excerpt                            (Barlow, min-height 104px)
```

### 3.8 Header

| Property | Value |
|---|---|
| Position | fixed (`.headroom` lib auto-hide-on-scroll) |
| Bg khi top | trong suốt |
| Bg khi scroll | trắng `#fff` + shadow nhẹ |
| Logo padding | 15px top khi scrolled |
| Nav link color | `#fff` khi trên hero, `#000` khi scroll |
| Nav font | Oswald 600, 1.25–1.43rem |
| Nav padding | `22px 10px 23px` |
| Submenu | bg `#fff`, border `1px solid #dfdfdf`, link padding `15px 30px`, font 14px/600 color `#6f6f6f`, hover `#ff0c09` |
| Mobile burger | width 44px, font 1.5rem, slide panel `.information-slide-bigbike` |
| Search | icon click → overlay `.search-form-wrapper` expand 100% width |
| Cart icon | đếm `wc_get_cart_contents_count()` |

### 3.9 Footer

| Property | Value |
|---|---|
| Layout | 2 cột `col-md-6` (đơn giản hơn footer hiện tại 5 cột) |
| Bg | dark (suy ra từ `.footer p { color: #7e7e7e; }`) |
| Text color | `#7e7e7e` |
| Link hover | `#ff0c09` |
| Logo width | 200px |

> WP footer **chỉ 2 cột**, còn Next.js đang dùng 5 cột. Đây là điểm visual khác biệt rõ ràng — sẽ cần resequence nếu muốn parity.

---

## 4. Asset inventory — WP

> Path gốc: `bigbike_vn__2026_04_17/files/wp-content/themes/bigbike/`

### 4.1 Static images cần port sang `bigbike-web/public/wp/`

| Asset | WP source | Next target usage | Notes |
|---|---|---|---|
| Logo desktop | `images/logo.png` (cần verify) hoặc trong `wp-content/uploads/` | `public/wp/logo.png` | Header desktop |
| Logo mobile | tương tự | `public/wp/logo-mobile.png` | Header mobile (smaller) |
| Banner ads home | `images/banner-ads.png` / `banner-ads.jpg` | `public/wp/banner-ads.jpg` | Section sau category grid |
| Banner generic | `images/banner.png` | optional | placeholder hero |
| 404 illustration | `images/404.png` | `app/not-found.tsx` | |
| Contact icons | `contact-call-icon.png`, `contact-marker-icon.png`, `contact-calendar-icon.png` | `public/wp/icons/` | Có thể thay bằng SVG inline (lucide) |
| Sale skew shape | CSS pseudo, không cần asset | — | |
| Cart thumbnail | `cart-thumbnail.png` | `public/wp/cart-thumbnail.png` | empty-cart illustration |
| Brand login icons | `facebook-login.svg`, `google-login.svg` | `public/wp/icons/social/` | nếu bật social login |
| Generic icons | `icon-1.svg` … `icon-10.svg` | `public/wp/icons/` | dùng cho features section |

**Khuyến nghị:** chỉ port 5-7 ảnh thực sự cần (logo, banner-ads, 404, cart-thumbnail). Tất cả icon nhỏ → dùng `lucide-react` hoặc SVG inline để tiết kiệm bundle.

### 4.2 Fonts

- Barlow (300/400/700) — load qua `next/font/google` (đã có trong package?) → cần kiểm tra `app/layout.tsx`. Nếu chưa có, thêm vào.
- Oswald (500/600) — tương tự, đã có khai báo trong `brand-tokens.css` làm fallback display.

### 4.3 Logo & brand

- WP có logo riêng (xem `wp-content/uploads/`). bigbike-web hiện đang dùng text "BIGBIKE" Bungee. **Cần quyết:** dùng lại logo bitmap cũ hay giữ logotype mới?

---

## 5. Data & API contracts — KHÔNG ĐƯỢC PHÁ

> Đây là phần "không-được-đụng-vào" khi rebuild UI. Tham chiếu: `lib/api/public-api.ts`, `lib/api/client-api.ts`, `lib/contracts/`, `app/api/revalidate/route.ts`.

### 5.1 Server-side fetches phải giữ nguyên

| Endpoint helper | Used by | Notes |
|---|---|---|
| `listProducts()` | `/`, `/san-pham`, `/danh-muc-san-pham/[slug]`, `/brands/[slug]`, `/tim-kiem` | giữ params `{ page, limit, category, brand, color, priceMin, priceMax, sort }` |
| `getProductBySlug()` | `/product/[slug]` | `revalidate: 3600`, prerender top 100 |
| `listArticles()` | `/`, `/tin-tuc` | |
| `getArticleBySlug()` | `/tin-tuc/[slug]` | |
| `getCategoryBySlug()` | `/danh-muc-san-pham/[slug]` | |
| `listBrands()`, `getBrandBySlug()` | `/`, `/brands`, `/brands/[slug]` | |
| `listHomeSliders()` | `/` | |
| `listHomeVideos()` | `/` | |
| `listPublicSettings()` | `/`, layout (hotline, biz info) | |

### 5.2 Client-side mutations phải giữ nguyên

- CSRF token (`bb_csrf` cookie + `X-CSRF-Token` header) — mọi POST.
- Idempotency-Key header — checkout, quick-buy.
- Session cookie — auth flows.
- `/api/products/[id]/snapshot` — fresh price/stock on PDP.

### 5.3 SEO infrastructure phải giữ nguyên

- `generateMetadata()` của tất cả route động.
- `generateStaticParams()` của: `/product/[slug]`, `/danh-muc-san-pham/[slug]`, `/brands/[slug]`, `/tin-tuc/[slug]`, `/chinh-sach/[slug]`.
- JSON-LD builders trong `lib/seo/json-ld.ts` — Product, Article, Breadcrumb, Organization, LocalBusiness, FAQ.
- `app/sitemap.ts` và `app/robots.ts`.
- ISR `revalidate: 3600` + tag-based revalidation.

### 5.4 URL slug schema phải giữ nguyên

| Hiện tại | KHÔNG đổi |
|---|---|
| `/san-pham` | shop listing |
| `/product/[slug]` | PDP — **lưu ý**: WP cũ dùng `/san-pham/<slug>` nhưng Next.js đã chọn `/product/[slug]`. Đổi sẽ phá link/SEO. Cần check redirect map. |
| `/danh-muc-san-pham/[slug]` | category |
| `/tin-tuc`, `/tin-tuc/[slug]` | blog |
| `/gio-hang`, `/thanh-toan` | cart/checkout |
| `/dang-nhap`, `/dang-ky`, `/tai-khoan/*` | auth |
| `/lien-he`, `/gioi-thieu`, `/chinh-sach/[slug]`, `/bao-hanh`, `/huong-dan-mua-hang` | content |

**Verify:** xem `next.config.ts` có redirect `/san-pham/[slug] → /product/[slug]` không. Nếu có thì giữ. Nếu không thì là gap SEO so với WP cũ — flag riêng.

---

## 6. Component plan (foundation cho Phase 2)

| Component | Status hiện tại | Thay đổi UI (giả định phương án A — light theme giống WP) |
|---|---|---|
| `SiteHeader` | dark, Bungee, 5-col footer | white khi scroll, transparent on top, Oswald nav, mobile slide panel |
| `SiteFooter` | 5-col dark gradient | 2-col dark đơn giản (theo WP) hoặc giữ 5-col nhưng style light |
| `PageHero` | dark hero | banner image trắng + breadcrumb dưới |
| `Container` | Tailwind container default | max-width 1200px |
| `Section` | mới | wrapper `py-15` (60px) cho tất cả landing sections |
| `Button` | Bungee, đỏ | Oswald uppercase, variants: `red` / `white` / `outline` / `dark` |
| `ProductCard` | lift + viền đỏ, no scale | scale 1.05 ảnh, slide-up cart button đen 51px, sale badge skew-X |
| `ArticleCard` | đơn giản | shadow rõ, date badge nhô top:-21px bg đỏ |
| `Breadcrumb` | có | tone trắng trên banner hero |
| `PaginationNav` | có | bo tròn 3px, Oswald, active đỏ |
| `Form controls` | dark | white bg, border `#cecece`, focus `#111`, radius 3px |
| `SaleBadge` | mới | viewport-skew |
| `BannerAds` | mới | banner-ads.jpg single image link |
| `BrandGrid` | mới (home + about) | 4-col / 8-col grid với placeholder bg `#f2f2f2` |
| `PolicySidebar` | mới | `.static-navigation` cho `/chinh-sach/*`, `/bao-hanh`, `/huong-dan-mua-hang` |
| `BlogSidebar` | mới | featured + recent posts widget cho `/tin-tuc/[slug]` |
| `AutoTOC` (table-of-contents) | mới | JS sinh từ h2/h3/h4 nội dung blog detail |
| `ContactMapEmbed` | mới | iframe Google Maps (URL từ admin settings) |

---

## 7. Risk list

### 7.1 SEO risks

| Risk | Mức | Mitigation |
|---|---|---|
| Đổi class/markup mà JSON-LD builder dựa vào | Trung | JSON-LD lấy data từ API, không phụ thuộc markup → an toàn |
| Bỏ heading hierarchy (h1 → h2 → h3) khi resequence | Cao | Phase 3 phải audit heading per page |
| Đổi URL slug khi rebuild | Cao | Cấm — list trong [§5.4](#54-url-slug-schema-phải-giữ-nguyên) |
| Mất `alt` của ảnh khi đổi component | Trung | Mọi `<Image>` mới phải có `alt={product.name}` v.v. |
| ISR revalidate bị bỏ khi đổi `page.tsx` | Cao | Cấm sửa `export const revalidate = …` và `generateStaticParams()` |
| Static page mới có metadata thiếu canonical | Trung | Bắt buộc `buildPublicMetadata({...})` |

### 7.2 Data contract risks

| Risk | Mức | Mitigation |
|---|---|---|
| Đổi tên trường product khi adapt UI | Cao | Cấm — UI nhận props từ `lib/contracts/public.ts` |
| Adapter thêm "nội bộ" che mất field gốc | Trung | Adapter phải là `function adaptToWpCard(product: Product): WpCardProps` đặt cùng component |
| Mock data thay backend trong rebuild | Cao | Cấm — chỉ giữ mock cho fallback build-time như hiện tại |
| Hardcode hotline/ĐKKD vào UI | **Đã nợ** | Audit [HOMEPAGE_UI_UX_RESPONSIVE_PRECHECK.md](HOMEPAGE_UI_UX_RESPONSIVE_PRECHECK.md) flag — rebuild phải **lấy từ `listPublicSettings()`**, không hardcode |

### 7.3 Responsive risks

| Risk | Mức | Mitigation |
|---|---|---|
| Breakpoint WP (576/768/992/1200) ≠ Tailwind (640/768/1024/1280) | Trung | Dùng Tailwind default; rebuild theo logic mobile-first |
| `.product--item-cart` chỉ hiện trên hover (desktop) — không touch | Cao | Audit đã flag. Mobile: **luôn hiển thị** add-to-cart, không ẩn |
| Tap target < 44px | Trung | Audit cũ đã flag — bảo đảm ≥ 44px |
| `.swiper-container` không scale tốt < 360px | Thấp | Test trên iPhone SE |

### 7.4 Performance risks

| Risk | Mức | Mitigation |
|---|---|---|
| Import toàn bộ CSS WP vào global | Cao | Cấm — chỉ port token, viết lại component-level |
| Thêm Swiper.js cho carousel | Trung | Đã có Embla; không thêm dependency mới |
| Ảnh `banner-ads.jpg` lớn | Thấp | Dùng `next/image` priority + size cố định |
| Font `Barlow` 5 weights = nhiều file | Trung | Chỉ load 300/400/700 thay vì 5 weights |
| LCP shift do header transparent → trắng on scroll | Trung | CSS-only transition, không re-render |

### 7.5 Maintainability risks

| Risk | Mức | Mitigation |
|---|---|---|
| Hai design system song song (Bungee + Oswald) | Cao | Phải chốt phương án A/B/C ở [§0](#0--xung-đột-design-system--phải-quyết-định-trước-phase-2) |
| Class name lẫn lộn (WP `.product--item` + Tailwind utility) | Cao | Bắt buộc 1 trong 2: hoặc full-Tailwind, hoặc full BEM. Đề xuất: **Tailwind + tên-namespace `wp-*`** cho component lifting style WP |
| STYLEGUIDE.md mâu thuẫn code mới | Cao | Update STYLEGUIDE.md cùng PR rebuild — không "code-first, doc-fix-later" (CLAUDE.md cấm) |
| File CSS legacy không xóa | Trung | Phase 4 phải dọn `brand-tokens.css` không dùng |

---

## 8. Bằng chứng & docs cần đọc trước khi sửa

- [bigbike-web/STYLEGUIDE.md](../../bigbike-web/STYLEGUIDE.md) — quy tắc brand hiện hữu (sẽ mâu thuẫn).
- [docs/audits/HOMEPAGE_UI_UX_RESPONSIVE_PRECHECK.md](HOMEPAGE_UI_UX_RESPONSIVE_PRECHECK.md) — vấn đề trust/hardcode hotline phải fix song song khi rebuild.
- [docs/audits/WEB_MODULE_FULL_COMPLETION_AUDIT.md](WEB_MODULE_FULL_COMPLETION_AUDIT.md) — trạng thái sẵn sàng production.
- [docs/audits/ISR_CSR_HYBRID_REVALIDATION_AUDIT.md](ISR_CSR_HYBRID_REVALIDATION_AUDIT.md) — ISR map không được sửa.
- [docs/business/USER_ROLES.md](../business/USER_ROLES.md), [docs/business/WORKFLOW_OVERVIEW.md](../business/WORKFLOW_OVERVIEW.md) — đảm bảo redesign không phá flow.
- [docs/engineering/API_CONTRACT.md](../engineering/API_CONTRACT.md), [docs/engineering/API_FLOW_MAP.md](../engineering/API_FLOW_MAP.md) — data shape.

---

## 9. Quyết định cần xin trước khi vào Phase 2

| # | Quyết định | Lựa chọn |
|---|---|---|
| D1 | Design direction | (A) Light WP cũ thuần / (B) Dark hiện tại giữ nguyên, chỉ port section layout / (C) Light WP nhưng dùng font Bungee thay Oswald |
| D2 | Logo | Dùng lại logo bitmap WP cũ hay giữ logotype Bungee mới? |
| D3 | Cart/Checkout UX | Giữ 3-step Next.js hay copy WP 1-page? |
| D4 | Footer | 2 cột (WP) hay 5 cột (hiện tại)? |
| D5 | Slug `/san-pham/[slug]` vs `/product/[slug]` | Có cần thêm redirect WP-style `/san-pham/...` → `/product/...` không? |
| D6 | Social login | Có port "Đăng nhập Google/Facebook" buttons từ WP không? |
| D7 | Scope thực hiện | Làm hết Phase 2-5 trong cùng PR (rất lớn) hay chia nhỏ theo từng nhóm route? |

---

**Phase 1 — DONE.** Chờ chốt D1–D7 trước khi bắt đầu Phase 2.
