# Thống Kê Font Size — bigbike-web

> **Mục đích:** Kiểm kê 100% các kích thước chữ được sử dụng trong toàn bộ `bigbike-web`, phân loại theo breakpoint.  
> **Nguồn:** `bigbike-web/app/globals.css`, `bigbike-web/app/home-news-parity.css`, `bigbike-web/styles/brand-tokens.css`  
> **Ngày audit:** 2026-05-30

---

## 1. Hệ Thống Token — Không Thay Đổi Theo Breakpoint

Font size của hệ canonical dùng `clamp()` — scale **liên tục** theo viewport width, **không nhảy cứng tại breakpoint**. Một token = một `clamp(min, preferred, max)`.

### 1.1 Canonical Fluid Scale (`--fs-*`)

| Tailwind class | CSS variable | clamp() | Min (≈320px) | Max (≈1280px) | Vai trò |
|---|---|---|---|---|---|
| `text-overline` | `--fs-overline` | `clamp(0.75rem, 0.728rem + 0.094vw, 0.8125rem)` | 12px | 13px | Label phụ |
| `text-caption` | `--fs-caption` | `clamp(0.875rem, 0.853rem + 0.094vw, 0.9375rem)` | 14px | 15px | Caption |
| `text-button` | `--fs-button` | `clamp(0.9375rem, 0.916rem + 0.094vw, 1rem)` | 15px | 16px | Button / CTA |
| `text-body` | `--fs-body` | `clamp(1rem, 0.956rem + 0.188vw, 1.125rem)` | 16px | 18px | Body text |
| `text-body-lg` | `--fs-body-lg` | `clamp(1.125rem, 1.081rem + 0.188vw, 1.25rem)` | 18px | 20px | Body lớn |
| `text-h4` | `--fs-h4` | `clamp(1.125rem, 1.061rem + 0.275vw, 1.5rem)` | 18px | 24px | H4 |
| `text-h3` | `--fs-h3` | `clamp(1.25rem, 1.143rem + 0.458vw, 1.875rem)` | 20px | 30px | H3 |
| `text-h2` | `--fs-h2` | `clamp(1.5rem, 1.328rem + 0.732vw, 2.5rem)` | 24px | 40px | H2 |
| `text-h1` | `--fs-h1` | `clamp(1.875rem, 1.596rem + 1.19vw, 3.5rem)` | 30px | 56px | H1 |
| `text-display` | `--fs-display` | `clamp(2.5rem, 1.985rem + 2.197vw, 5.5rem)` | 40px | 88px | Display |
| `text-display-xl` | `--fs-display-xl` | `clamp(3rem, 2.313rem + 2.93vw, 7rem)` | 48px | 112px | Display XL |

### 1.2 WP-Parity Heading Tokens (`--bb-text-*`) — Fluid

| Token | clamp() | Min | Max | Vai trò |
|---|---|---|---|---|
| `--bb-text-h1` | `clamp(1.25rem, 0.794rem + 1.945vw, 2rem)` | 20px | 32px | H1 WP |
| `--bb-text-h2` | `clamp(1.125rem, 0.897rem + 0.972vw, 1.5rem)` | 18px | 24px | H2 WP |
| `--bb-text-hero` | `clamp(1.125rem, 0.669rem + 1.945vw, 1.875rem)` | 18px | 30px | Hero phụ |
| `--bb-text-section-title` | `clamp(1.875rem, 1.115rem + 3.241vw, 3.125rem)` | 30px | 50px | Section heading |
| `--bb-text-footer-slogan` | `clamp(2.875rem, 1.842rem + 4.408vw, 3.429rem)` | 46px | 54.86px | Footer slogan |
| `--bb-text-22` | `clamp(1.125rem, 0.659rem + 1.99vw, 1.375rem)` | 18px | 22px | Numeric WP |
| `--bb-text-26` | `clamp(1.25rem, 1.022rem + 0.972vw, 1.625rem)` | 20px | 26px | Numeric WP |
| `--bb-text-32` | `clamp(1.5rem, 1.196rem + 1.297vw, 2rem)` | 24px | 32px | Numeric WP |
| `--bb-text-40` | `clamp(1.625rem, 1.093rem + 2.269vw, 2.5rem)` | 26px | 40px | Numeric WP |
| `--bb-text-50` | `clamp(1.875rem, 1.115rem + 3.241vw, 3.125rem)` | 30px | 50px | Numeric WP |

### 1.3 WP-Parity Tokens — Cố Định (không scale)

| Token | Giá trị | Vai trò |
|---|---|---|
| `--bb-text-h3` | `18px` | H3 WP |
| `--bb-text-section-kicker` | `16px` | Section label |
| `--bb-text-news-title` | `20px` | Tiêu đề bài viết |
| `--bb-text-product-title` | `16px` | Tiêu đề sản phẩm |
| `--bb-text-xs` | `12px` | Extra small |
| `--bb-text-sm` | `14px` | Small |
| `--bb-text-base` | `16px` | Base |
| `--bb-text-md` | `16px` | Medium |
| `--bb-text-lg` | `18px` | Large |
| `--bb-text-xl` | `20px` | X-Large |
| `--bb-text-3xl` | `30px` | 3XL |
| `--bb-text-9` / `--bb-text-10` / `--bb-text-11` | `12px` | Meta / badge nhỏ nhất |
| `--bb-text-13` | `14px` | Meta phụ |
| `--bb-text-15` | `15px` | Label nhỏ |
| `--bb-text-17` | `17px` | Nav |

---

## 2. Font Size Theo Breakpoint (Override)

Các breakpoint dưới đây có ít nhất một rule `font-size`. Sắp xếp từ nhỏ → lớn.

---

### 2.1 `max-width: 600px` — Mobile rất nhỏ (≤ 600px)

**Nguồn:** `globals.css` dòng 4026

| Selector | font-size |
|---|---|
| `.bb-cart-heading-row h1` | `2rem` (32px) |

---

### 2.2 `max-width: 639px` — Mobile nhỏ (≤ 639px)

**Nguồn:** `globals.css` dòng 6254

| Selector | font-size | line-height |
|---|---|---|
| `.bb-hero-title, .bb-cat-hero-title, .bb-news-hero h1, .bb-article-h1` | `18px` | `27px` |

---

### 2.3 `max-width: 767px` — Mobile (≤ 767px)

**Nguồn:** `globals.css` (nhiều block: dòng 7435, 9163, 10900, 11137, 11258, 12462, 13741)  
và `home-news-parity.css`

#### Page / Layout chung

| Selector | font-size |
|---|---|
| `.bb-page h1, .bb-page-head h1, .bb-news-hero h1` | `var(--fs-h1)` (30px sàn) |
| `.bb-page-subtitle, .bb-page-head .sub, .bb-news-hero p` | `var(--fs-caption)` (14px sàn) |

#### Header / Search / Nav

| Selector | font-size | Ghi chú |
|---|---|---|
| `.bb-header-search-input` | `16px !important` | Bắt buộc ≥16px để tránh Safari auto-zoom |
| `.bb-mobile-search-section > p` | `11px` | |
| `.bb-mobile-search-chips button` | `13px` | |
| `.bb-mobile-search-grid span` | `13px` | |
| `.bb-mobile-search-grid small` | `10px` | |
| `.bb-mobile-nav-link` | `14px` | |
| `.bb-site-header .bb-cart-badge` | `9px` | Badge số lượng giỏ hàng |
| `.bb-bottom-nav-item span` | `10px` | Label bottom nav |

#### Mobile Cart (drawer)

| Selector | font-size |
|---|---|
| `.bb-mobile-cart-title` | `18px` |
| `.bb-mobile-cart-empty h3` | `18px` |
| `.bb-mobile-cart-line-copy h3` | `13px` |
| `.bb-mobile-cart-qty span` | `13px` |
| `.bb-mobile-cart-line-bottom strong` | `14px` |
| `.bb-mobile-cart-total strong` | `22px` |

#### Homepage

| Selector | font-size |
|---|---|
| `body .bb-home .block-title h2, h3` | `var(--bb-text-section-title)` (30px sàn) |
| `.bb-home .about-bigbike .block-title h2` | `var(--bb-text-section-title)` (30px sàn) |
| `.bb-home .videos-slide .bb-home-video-title` | `var(--fs-h3)` (20px sàn) |
| `.bb-mobile-section-header h2, .bb-home-products-parity .bb-products-title, .bb-home .bb-experience-title, body .bb-home .bb-home-news-parity .block-title h2` | `24px` |
| `.bb-home-products-parity .bb-products-header .bb-kicker` | `10px` |
| `.bb-home-products-parity .bb-fp-title, .bb-home-products-parity .bb-fp-title a` | `14px` |
| `.bb-home .bb-home-news-parity .news--item-inside .title-post` | `15px` |
| `.bb-home .bb-home-news-parity .news--item-inside p:not(.title-post)` | `13px` |
| `body .bb-home .bb-home-news-parity .block-title h2` *(home-news-parity.css)* | `28px` |
| `.bb-home .bb-home-news-parity .news--item-desc .news-date p` *(home-news-parity.css)* | `12px` |

#### Main Banner

| Selector | font-size |
|---|---|
| `.bb-main-banner-kicker` | `10px` |
| `.bb-main-banner-copy h2` | `38px` |
| `.bb-main-banner-copy span` | `14px` |

#### Product Archive / Danh mục sản phẩm

| Selector | font-size |
|---|---|
| `.bb-product-archive .product-list-filter .result` | `14px` |
| `.bb-product-archive .form-control, .bb-product-archive .filter-mobile p` | `12px` |
| `.bb-archive-product-cart a` | `11px` |
| `.bb-archive-product-title` | `14px` |
| `.bb-archive-product-price, .bb-archive-product-price p` | `14px` |
| `.bb-archive-rating` | `14px` |
| `.bb-brand-mobile-cell` | `12px` |

#### WP PDP (mobile)

| Selector | font-size |
|---|---|
| `.bb-wp-pdp .product-information .title h1` | `24px` |
| `.bb-wp-pdp .product-information .desc p, li, .short-description` | `15px` |
| `.bb-wp-pdp .product-information .size .group-label label` | `18px` |

#### PDP Sticky / FAQ

| Selector | font-size |
|---|---|
| `.bb-pdp-anchor-btn` | `12px` |
| `.bb-pdp-sticky-add` | `14px` |
| `.bb-pdp-sticky-consult` | `13px` |
| `.bb-wp-pdp .bb-wp-tabs .tab-panel::before` | `18px` |
| `.bb-pdp-faq-q` | `15px` |
| `.bb-pdp-faq-q::after` | `20px` |
| `.bb-pdp-faq-a` | `var(--fs-caption)` (14px) |

#### Blog / Article

| Selector | font-size |
|---|---|
| `.bb-article-detail-parity .page-title h1` | `2rem` (32px) |
| `.bb-article-detail-parity .related--title h3.big` | `24px` |
| `.bb-blog-listing-parity .page-title h1` | `28px` |
| `.bb-article-detail-parity .blog-content, .bb-article-detail-parity .bb-article-wyswyg` | `var(--fs-body)` (16px sàn) |

#### Cart Page

| Selector | font-size |
|---|---|
| `.bb-cart-heading-row h1` | `28px` |
| `.cart-table .table--items-item.cart-information h3` | `15px` |

#### Checkout

| Selector | font-size |
|---|---|
| `.bb-checkout-page .check-out-step-title h2` | `18px` |
| `.bb-checkout-page label, .bb-checkout-label` | `13px` |
| `.bb-checkout-method-block h3, .checkout-summary-title h3` | `16px` |
| `.payment_box` | `14px` |
| `.form-submit.place-order .button` | `14px` |

#### Account / Auth

| Selector | font-size |
|---|---|
| `.bb-account-header h1, .bb-account-header h2` | `20px` |
| `.bb-page--auth .bb-auth-wrap h1, .bb-auth-wrap h1` | `24px` |

#### Footer

| Selector | font-size |
|---|---|
| `body > footer .bg-footer-top a` | `var(--fs-h3)` (20px sàn) |
| `body > footer .bg-footer-top ul a` | `1rem` (16px) |

---

### 2.4 `max-width: 768px` — Mobile (≤ 768px)

**Nguồn:** `globals.css` dòng 702

| Selector | font-size |
|---|---|
| `.bb-page h1` | `2rem` (32px) |

---

### 2.5 `max-width: 1023px` — Tablet & Mobile (≤ 1023px)

**Nguồn:** `globals.css` dòng 9001

| Selector | font-size |
|---|---|
| `.bb-wp-pdp .product-information .title h1` | `26px` |

---

### 2.6 `min-width: 640px` và `max-width: 1023px` — Tablet (640px–1023px)

**Nguồn:** `globals.css` dòng 6278

| Selector | font-size | line-height |
|---|---|---|
| `.bb-hero-title, .bb-cat-hero-title, .bb-news-hero h1, .bb-article-h1` | `24px` | `36px` |

---

### 2.7 `min-width: 768px` và `max-width: 991px` — Tablet (768px–991px)

**Nguồn:** `home-news-parity.css`

| Selector | font-size |
|---|---|
| `body .bb-home .bb-home-news-parity .block-title h2` | `34px` |

---

### 2.8 `min-width: 768px` và `max-width: 1023px` — Tablet (768px–1023px)

**Nguồn:** `globals.css` dòng 11084

| Selector | font-size |
|---|---|
| `.bb-home .videos-slide .bb-home-video-title` | `var(--fs-h2)` (24px sàn) |

---

### 2.9 `min-width: 992px` — Desktop trở lên (≥ 992px)

**Nguồn:** `globals.css` dòng 6518  
Comment trong code: *"RESPONSIVE TYPOGRAPHY — fluid body text scale. Áp dụng cho các .bb-\* class dạng raw px cố định."*

| Selector | Default (mobile) | Override (≥992px) |
|---|---|---|
| `.bb-news-excerpt` | `var(--fs-caption)` ≈ 14px | `15px` |
| `.bb-pdp-review-comment` | `var(--fs-caption)` ≈ 14px | `15px` |
| `.bb-page-head .sub` | `var(--fs-caption)` ≈ 14px | `15px` |

---

### 2.10 `min-width: 1536px` — 2xl (≥ 1536px)

**Nguồn:** `globals.css` dòng 2890

| Selector | font-size |
|---|---|
| `.bb-cat-list-desc` | `18px` |

---

### 2.11 `min-width: 1920px` — 3xl (≥ 1920px)

**Nguồn:** `home-news-parity.css`

| Selector | font-size |
|---|---|
| `body .bb-home .bb-home-news-parity .block-title h2` | `50px` |
| `.bb-home .bb-home-news-parity .news--item-inside .title-post` | `22px` |

---

### 2.12 `min-width: 2560px` — 4xl (≥ 2560px)

**Nguồn:** `globals.css` dòng 2899, `home-news-parity.css`

| Selector | font-size |
|---|---|
| `.bb-cat-list-desc` | `20px` |
| `body .bb-home .bb-home-news-parity .block-title h2` | `56px` |
| `.bb-home .bb-home-news-parity .news--item-inside .title-post` | `22px` |

---

## 3. Top-Level — Không Có Breakpoint (Luôn Áp Dụng)

Font-size cố định hoặc qua token, không bị override theo breakpoint ngoại trừ các element đã liệt kê ở Phần 2.

### 3.1 Base

| Selector | font-size |
|---|---|
| `body` | `var(--fs-body)` (16→18px) |

### 3.2 Header / Nav / Search

| Selector | font-size |
|---|---|
| `.bb-header-nav-item` | `var(--bb-text-17)` (17px) |
| `.bb-header-nav-button` | `1.286rem` (~20.6px) |
| `.bb-header-badge` | `11px` |
| `.bb-header-search-icon` | `24px` |
| `.bb-header-search-result-name` | `var(--fs-caption)` (14→15px) |
| `.bb-header-search-result-price` | `13px` |
| `.bb-header-search-filter` | `13px` |
| `.bb-header-search-results-label` | `10px` |
| `.bb-header-search-result-article .bb-header-search-result-name` | `13px` |
| `.bb-header-search-result-category` | `11px` |
| `.bb-header-search-results-empty` | `var(--fs-caption)` (14→15px) |
| `.bb-search-pre-label-row span` | `10px` |
| `.bb-search-pre-clear` | `12px` |
| `.bb-search-pre-item` | `var(--fs-caption)` (14→15px) |
| `.bb-search-pre-pill-box` | `12px` |
| `.bb-header-user-greeting` | `14px` |
| `.bb-header-user-name` | `14px` |
| `.bb-header-info-logout` | `14px` |
| `.bb-header-info-desc p` | `var(--fs-caption)` (14→15px) |
| `.bb-header-info-contact h2` | `16px` |

### 3.3 Kicker / Section title

| Selector | font-size |
|---|---|
| `.bb-kicker` | `var(--bb-text-xs)` (12px) |
| `.bb-section-head .bb-kicker` | `var(--bb-text-section-kicker)` (16px) |
| `.bb-section-title` | `var(--bb-text-section-title)` (30→50px) |

### 3.4 Page Head / Breadcrumb

| Selector | font-size | Override |
|---|---|---|
| `.bb-page h1` | `var(--bb-text-h1)` (20→32px) | ≤768px → `2rem` |
| `.bb-breadcrumb` | `16px` | — |
| `.bb-page-head .kicker` | `14px` | — |
| `.bb-page-head h1` | `var(--fs-h1)` (30→56px) | — |
| `.bb-page-head .sub` | `var(--fs-caption)` (14→15px) | ≥992px → `15px` |
| `.bb-cat-hero-breadcrumb` | `14px` | — |
| `.bb-cat-hero-title` | `clamp(2.5rem, 5vw, 4.375rem)` (40→70px) | ≤639px → `18px` / 640–1023px → `24px` |

### 3.5 Richtext / WYSIWYG

| Selector | font-size |
|---|---|
| `.bb-richtext` | `var(--bb-text-base)` (16px) |
| `.bb-richtext h1` | `var(--fs-h2)` (24→40px) |
| `.bb-richtext h2` | `var(--fs-h3)` (20→30px) |
| `.bb-richtext h3, h4, h5, h6` | `var(--bb-text-h3)` (18px) |
| `.bb-article-detail-page .bb-article-wyswyg h1` | `2.5rem` (40px) |
| `.bb-article-detail-page .bb-article-wyswyg h2` | `2rem` (32px) |
| `.bb-article-detail-page .bb-article-wyswyg h3` | `1.75rem` (28px) |
| `.bb-article-detail-page .bb-article-wyswyg h4` | `1.5rem` (24px) |
| `.bb-article-detail-page .bb-article-wyswyg h5` | `1.25rem` (20px) |
| `.bb-article-detail-page .bb-article-wyswyg h6` | `1rem` (16px) |
| `.bb-article-detail-page .bb-article-wyswyg p` | `var(--fs-caption)` (14→15px) |

### 3.6 PDP (Trang sản phẩm)

| Selector | font-size |
|---|---|
| `.bb-pdp-info-title` | `var(--fs-h2)` (24→40px) |
| `.bb-pdp-rating` | `var(--fs-caption)` (14→15px) |
| `.bb-pdp-stock-badge-label` | `13px` |
| `.bb-pdp-rating-score` | `28px` |
| `.bb-pdp-rating-count` | `var(--fs-caption)` (14→15px) |
| `.bb-pdp-review-author` | `var(--fs-caption)` (14→15px) |
| `.bb-pdp-review-date` | `var(--fs-caption)` (14→15px) |
| `.bb-pdp-review-comment` | `var(--fs-caption)` (14px) → ≥992px: `15px` |
| `.bb-review-open-btn` | `14px` |
| `.bb-review-form-title` | `14px` |
| `.bb-review-form-field label` | `14px` |
| `.bb-review-done` | `var(--fs-caption)` (14→15px) |
| `.bb-pdp-related-title` | `var(--fs-h2)` (24→40px) |
| `.bb-pdp-related-header .bb-kicker` | `0.95rem` (~15px) |
| `.bb-pdp-share-label` | `15px` |
| `.bb-pdp-short-desc` | `var(--bb-text-sm)` (14px) |

### 3.7 WP PDP (Legacy)

| Selector | font-size | Override |
|---|---|---|
| `.bb-wp-pdp .product-information .title h1` | `30px` | ≤1023px → `26px` / ≤767px → `24px` |
| `.bb-wp-pdp .product-information .rating` | `14px` | — |
| `.bb-wp-pdp .product-information .rating-star` | `18px` | — |
| `.bb-wp-pdp .product-information .rating p` | `14px` | — |
| `.bb-wp-pdp .product-information .desc p, li` | `1.1rem` (~17.6px) | ≤767px → `15px` |
| `.bb-wp-pdp .product-information .size .group-label label` | `24px` | ≤767px → `18px` |
| `.bb-wp-pdp .variation-radios .bb-wp-variant-label` | `1.5rem` (24px) | — |
| `.bb-wp-pdp .quantity-group .quantity input` | `1.5rem` (24px) | — |
| `.bb-wp-pdp .quantity-group .button button` | `0.625rem` (10px) | — |
| `.bb-wp-pdp .product-information .add-to-cart .btn` | `16px` | — |
| `.bb-wp-pdp .bb-breadcrumb a, span` | `14px` | — |
| `.bb-wp-tabs .nav-link` | `16px` | — |
| `.bb-wp-tabs .tab-pane, .tab-panel` | `var(--fs-body)` (16→18px) | — |

### 3.8 News / Blog / Article

| Selector | font-size | Override |
|---|---|---|
| `.bb-news-hero h1` | `var(--fs-h1)` (30→56px) | — |
| `.bb-news-kicker` | `14px` | — |
| `.bb-news-date` | `14px` | — |
| `.bb-news-excerpt` | `var(--fs-caption)` (14px) | ≥992px → `15px` |
| `.bb-news-read-more` | `14px` | — |
| `.bb-article-meta-updated` | `var(--bb-text-17)` (17px) | — |
| `.bb-article-share-label` | `14px` | — |
| `.bb-article-share-btn` | `14px` | — |
| `.bb-article-listing-title` | `var(--bb-text-section-title)` (30→50px) | — |
| `.bb-article-detail-parity .page-title h1` | *(desktop default)* | ≤767px → `2rem` |

### 3.9 Homepage — Block Title

| Selector | font-size | Override |
|---|---|---|
| `.bb-home .block-title p.sub-title` | `var(--bb-text-section-kicker)` (16px) | — |
| `body .bb-home .block-title h2, h3` | `var(--bb-text-section-title)` (30→50px) | ≤767px: giữ token |
| `.bb-home .category-list .item--title` | `var(--fs-h4)` (18→24px) | — |
| `.bb-home .about-bigbike .block-content p` | `var(--fs-body)` (16→18px) | — |
| `.bb-home .news--item-inside .title-post` | `var(--bb-text-news-title)` (20px) | — |
| `.bb-home .news--item-inside p` | `var(--fs-caption)` (14→15px) | — |
| `.bb-home-video-title` | `var(--fs-h1)` (30→56px) | 768–1023px → `var(--fs-h2)` / ≤767px → `var(--fs-h3)` |
| `.bb-home .videos-slide--inner-item-desc h3` | `var(--fs-h4)` (18→24px) | — |
| `.bb-home .content-bottom.wyswyg p, li` | `var(--fs-body)` (16→18px) | — |
| `.bb-home .content-bottom.wyswyg h1` | `var(--fs-h2)` (24→40px) | — |
| `.bb-home .content-bottom.wyswyg h2` | `var(--fs-h3)` (20→30px) | — |
| `.bb-home .content-bottom.wyswyg h3–h6` | `var(--fs-h4)` (18→24px) | — |
| `.bb-home #main-banner .swiper-pagination` | `16px` | — |

### 3.10 Home News Parity (file riêng: `home-news-parity.css`)

| Selector | Default | ≤767px | 768–991px | ≥1920px | ≥2560px |
|---|---|---|---|---|---|
| `body .bb-home .bb-home-news-parity .block-title h2` | `44px` | `28px` | `34px` | `50px` | `56px` |
| `.bb-home .bb-home-news-parity .news--item-inside .title-post` | `20px` | — | — | `22px` | `22px` |
| `.bb-home .bb-home-news-parity .news--item-inside p:not(.title-post)` | `16px` | — | — | — | — |
| `.bb-home .bb-home-news-parity .news--item-desc .news-date p` | `14px` | `12px` | — | — | — |

### 3.11 WP Related Products (Legacy)

| Selector | font-size |
|---|---|
| `.bb-wp-related .block-title .sub-title` | `35px` |
| `.bb-wp-related .block-title .related_heading` | `14px` |
| `.bb-wp-related .product--item-cart a` | `13px` |
| `.bb-wp-related .product--item-title` | `14px` |
| `.bb-wp-related .product--item-price` | `14px` |
| `.bb-wp-related .rating` | `14px` |

### 3.12 Cart Page

| Selector | font-size |
|---|---|
| `.bb-cart-item-title` | `14px` |
| `.bb-cart-summary-label` | `1.5rem` (24px) |
| `.bb-cart-summary-save` | `12px` |
| `.bb-cart-coupon-input` | `14px` |
| `.bb-cart-coupon-apply` | `18px` |
| `.bb-cart-coupon-error` | `1.143rem` (~18px) |
| `.bb-cart-coupon-success` | `1.143rem` (~18px) |

### 3.13 Checkout

| Selector | font-size |
|---|---|
| `.bb-checkout-section h3` | `16px` |
| `.bb-checkout-section h3 .badge` | `14px` |
| `.bb-order-summary h3` | `15px` |
| `.bb-checkout-form-title` | `14px` |
| `.bb-checkout-step-label` | `0.75rem` (12px) |
| `.bb-checkout-step-number` | `1.25rem` (20px) |
| `.bb-checkout-next-button` | `16px` |
| `.bb-checkout-pay-now` | `14px` |
| `.bb-checkout-summary-total, .bb-checkout-summary-subtotal` | `1.5rem` (24px) |

### 3.14 Order / Success

| Selector | font-size |
|---|---|
| `.bb-success h1` | `var(--bb-text-40)` (26→40px) |
| `.bb-success .kicker` | `14px` |
| `.bb-success .order-card .label` | `14px` |
| `.bb-success .order-card b` | `16px` |
| `.bb-order-head .meta div` | `14px` |
| `.bb-order-head .meta b` | `14px` |

### 3.15 Auth / Account

| Selector | font-size |
|---|---|
| `.bb-auth-title` | `var(--fs-h2)` (24→40px) |
| `.bb-auth-footer` | `var(--bb-text-sm)` (14px) |
| `.bb-sidebar-heading` | `var(--bb-text-lg)` (18px) |
| `.bb-account-avatar` | `0.875rem` (14px) |
| `.bb-thumb-initials` | `14px` |

### 3.16 About / Promo

| Selector | font-size |
|---|---|
| `.bb-about .bb-kicker` | `1.143rem` (~18px) |
| `.bb-about-title` | `var(--fs-h1)` (30→56px) |
| `.bb-about-richtext, .bb-about-text` | `1rem` (16px) |
| `.bb-promo-subtitle` | `0.875rem` (14px) |
| `.bb-promo-title` | `var(--fs-h2)` (24→40px) |
| `.bb-promo-bg-text` | `clamp(8rem, 14vw, 13.75rem)` (128→220px) |

### 3.17 Category SEO Prose

| Selector | font-size |
|---|---|
| `.bb-cat-seo-prose` | `var(--fs-caption)` (14→15px) |
| `.bb-cat-seo-prose h1, h2, h3` | `1.143rem` (~18px) |
| `.bb-cat-seo-prose h1` | `1.4rem` (~22px) |
| `.bb-catalog-count` | `var(--fs-caption)` (14→15px) |

### 3.18 Entity / Misc

| Selector | font-size |
|---|---|
| `.bb-entity-desc` | `var(--fs-caption)` (14→15px) |
| `.bb-error-text` | `var(--bb-text-sm)` (14px) |
| `.bb-updated-date` | `var(--bb-text-xs)` (12px) |

---

## 4. Bảng Tổng Hợp Breakpoints Có Font-Size Override

| # | Breakpoint | Điều kiện | Số rules | Khu vực |
|---|---|---|---|---|
| 1 | Mobile rất nhỏ | `max-width: 600px` | 1 | Cart heading |
| 2 | Mobile nhỏ | `max-width: 639px` | 1 | Hero title group |
| 3 | Mobile | `max-width: 767px` | ~45 | Toàn site: header, nav, cart drawer, homepage, archive, PDP, blog, checkout, account, footer |
| 4 | Mobile | `max-width: 768px` | 1 | `.bb-page h1` |
| 5 | Tablet & Mobile | `max-width: 1023px` | 1 | WP PDP title |
| 6 | Tablet | `640px – 1023px` | 1 | Hero title group |
| 7 | Tablet | `768px – 991px` | 1 | Home news block title (home-news-parity) |
| 8 | Tablet | `768px – 1023px` | 1 | Video section title |
| 9 | Desktop+ | `min-width: 992px` | 3 | Caption text scale up (news excerpt, PDP review, page sub) |
| 10 | 2xl | `min-width: 1536px` | 1 | Category list desc |
| 11 | 3xl | `min-width: 1920px` | 2 | Home news title + block title |
| 12 | 4xl | `min-width: 2560px` | 3 | Category list desc + home news |

---

## 5. Ghi Chú Quan Trọng

1. **Canonical token system** (`--fs-*`) dùng `clamp()` — không có breakpoint, scale liên tục. Đây là hệ đúng, component mới phải dùng hệ này.

2. **Hai token H1 song song với range khác nhau:**
   - `--fs-h1` (canonical): `30px → 56px`
   - `--bb-text-h1` (WP-parity): `20px → 32px`
   Cùng gọi là "H1" nhưng kết quả visual khác nhau đáng kể.

3. **`home-news-parity.css`** dùng scheme nhảy bậc theo WP cũ với 5 giá trị px riêng biệt cho block title h2: `28 / 34 / 44 / 50 / 56px` tại 5 breakpoint khác nhau — không dùng `clamp()`.

4. **`@media (max-width: 767px)`** bị tách thành nhiều block rải rác trong `globals.css** (dòng 7435, 9163, 10900, 11137, 11258, 12462, 13741...) — cùng điều kiện, khác section code.

5. **iOS anti-zoom:** `.bb-header-search-input` được set `16px !important` trên mobile — Safari sẽ auto-zoom input nếu `font-size < 16px`.

6. **WP-parity code** (đang migrate dần) dùng nhiều px hardcode không qua token — đây là nguồn gốc của phần lớn sự không đồng nhất trong bảng thống kê.

---

## 6. Tổng Hợp Theo Thẻ Heading (h1–h6)

> Liệt kê **toàn bộ** selector CSS có chứa thẻ `h1`–`h6` kèm `font-size`.  
> Cột "Override" ghi lại breakpoint thay đổi giá trị so với default.

---

### 6.1 Tất Cả `h1`

| Selector | font-size default | Override breakpoint |
|---|---|---|
| `.bb-page h1` | `var(--bb-text-h1)` = 20→32px | `≤768px` → `2rem` (32px) |
| `.bb-page-head h1` | `var(--fs-h1)` = 30→56px | — |
| `.bb-news-hero h1` | `var(--fs-h1)` = 30→56px | `≤639px` → `18px` / `640–1023px` → `24px` |
| `.bb-article-h1` | `var(--bb-text-hero)` = 18→30px | `≤639px` → `18px` / `640–1023px` → `24px` |
| `.bb-article-detail-parity .page-title h1` | `4.375rem` (70px) | `≤767px` → `2rem` (32px) |
| `.bb-wp-pdp .product-information .title h1` | `30px` | `≤1023px` → `26px` / `≤767px` → `24px` |
| `.bb-page--auth .bb-auth-wrap h1` | `var(--bb-text-32)` = 24→32px | `≤575px` → `24px` |
| `.bb-account-header h1, .bb-account-header h2` | `22px` | `≤575px` → `20px` |
| `.bb-cart-heading-row h1` | `2.5rem` (40px) | `≤600px` → `2rem` (32px) |
| `.bb-success h1` | `var(--bb-text-40)` = 26→40px | — |
| `.bb-richtext h1` | `var(--fs-h2)` = 24→40px | — |
| `.bb-cat-seo-prose h1` | `1.4rem` (~22px) | — |
| `.bb-home .content-bottom.wyswyg h1` | `var(--fs-h2)` = 24→40px | `≥1200px` → `28px` |
| `.bb-seo-content h1` (first-child) | `var(--fs-h2)` = 24→40px | — |

**Quan sát:**
- `h1` có **6 giá trị token khác nhau** + thêm các giá trị px cố định — không có một quy chuẩn thống nhất.
- `.bb-page h1` dùng `--bb-text-h1` (max 32px), `.bb-page-head h1` dùng `--fs-h1` (max 56px) — cùng ngữ cảnh "page heading" nhưng token khác nhau.
- `.bb-richtext h1` được render bằng `--fs-h2` (24→40px) — h1 trong nội dung nhỏ hơn h1 trong page head.

---

### 6.2 Tất Cả `h2`

| Selector | font-size default | Override breakpoint |
|---|---|---|
| `.bb-account-header h1, .bb-account-header h2` | `22px` | `≤575px` → `20px` |
| `.bb-header-info-contact h2` | `16px` | — |
| `.bb-richtext h2` | `var(--fs-h3)` = 20→30px | — |
| `.bb-cat-seo-prose h1, h2, h3` | `1.143rem` (~18px) | — |
| `.bb-cart-page .cart_totals h2` | `1.5rem` (24px) | — |
| `body .bb-home .block-title h2` | `var(--bb-text-section-title)` = 30→50px | — |
| `body .bb-home .bb-home-news-parity .block-title h2` | `44px` | `≤767px` → `28px` / `768–991px` → `34px` / `≥1920px` → `50px` / `≥2560px` → `56px` |
| `.bb-home .about-bigbike .block-title h2` | `var(--bb-text-section-title)` = 30→50px | — |
| `.bb-home .content-bottom.wyswyg h2` | `var(--fs-h3)` = 20→30px | `≥1200px` → `26px` |
| `.bb-home .content-bottom.bb-seo-content h2` | `var(--fs-h3)` = 20→30px | `≥1200px` → `26px` |
| `.bb-product-archive .product .desc h2` | `16px` | — |
| `.bb-article-detail-page .bb-article-wyswyg h2` | `2rem` (32px) | — |
| `.bb-seo-content h2` (không phải first-child) | `var(--fs-h3)` = 20→30px | — |
| `.bb-main-banner-copy h2` | *(desktop không rõ)* | `≤767px` → `38px` |
| `.bb-checkout-page .check-out-step-title h2` | *(desktop default)* | `≤767px` → `18px` |

**Quan sát:**
- `body .bb-home .bb-home-news-parity .block-title h2` có **5 giá trị khác nhau** tại 5 breakpoint (28/34/44/50/56px) — đây là element biến động nhiều nhất.
- `h2` trong richtext/wyswyg được render bằng `--fs-h3` (20→30px) — nhỏ hơn nhiều so với section title h2.

---

### 6.3 Tất Cả `h3`

| Selector | font-size default | Override breakpoint |
|---|---|---|
| `.bb-category-body h3` | `var(--bb-text-base)` (16px) | — |
| `.bb-checkout-section h3` | `16px` | `≤575px` → `15px` |
| `.bb-order-summary h3` | `15px` | — |
| `.bb-richtext h3` | `var(--bb-text-h3)` (18px) | — |
| `body .bb-home .block-title h3` | `var(--bb-text-section-title)` = 30→50px | — |
| `.bb-home .videos-slide--inner-item-desc h3` | `var(--fs-h4)` = 18→24px | — |
| `.bb-article-detail-parity .related--title h3.big` | `2.143rem` (~34px) | `≤991px` → `24px` |
| `.bb-article-detail-parity.single-post .news--item-inside h3` | `14px` | — |
| `.bb-product-archive .widget--title h3` | `1.5rem` (24px) | — |
| `.bb-home .content-bottom.wyswyg h3` | `var(--fs-h4)` = 18→24px | `≥1200px` → `20px` |
| `.bb-article-detail-page .bb-article-wyswyg h3` | `1.75rem` (28px) | — |
| `.bb-checkout-summary-title h3` | `var(--fs-h4)` = 18→24px | — |
| `.cart-table .table--items-item.cart-information h3` | `1rem` (16px) | `≤1023px` → `15px` |
| `.bb-cat-seo-prose h1, h2, h3` | `1.143rem` (~18px) | — |
| `.bb-seo-content h3` | `var(--fs-h4)` = 18→24px | `≥1200px` → `20px` |

**Quan sát:**
- `h3` có range rộng nhất: từ **14px** (article sidebar news item) đến **34px** (related title).
- Checkout dùng `h3` cho section label với size nhỏ (15–16px) — gần với body text, không có hierarchy heading rõ ràng.

---

### 6.4 Tất Cả `h4`

| Selector | font-size default | Override breakpoint |
|---|---|---|
| `.bb-richtext h4, h5, h6` | `var(--bb-text-h3)` (18px) | — |
| `.bb-richtext h4` | `var(--bb-text-lg)` (18px) | — |
| `.bb-home .content-bottom.wyswyg h4` | `var(--fs-h4)` = 18→24px | `≥1200px` → `20px` |
| `.bb-article-detail-page .bb-article-wyswyg h4` | `1.5rem` (24px) | — |
| `.bb-seo-content h3, h4, h5, h6` | `var(--fs-h4)` = 18→24px | `≥1200px` → `20px` |

---

### 6.5 Tất Cả `h5`

| Selector | font-size default | Override breakpoint |
|---|---|---|
| `.bb-richtext h4, h5, h6` | `var(--bb-text-h3)` (18px) | — |
| `.bb-home .content-bottom.wyswyg h5` | `var(--fs-h4)` = 18→24px | `≥1200px` → `20px` |
| `.bb-article-detail-page .bb-article-wyswyg h5` | `1.25rem` (20px) | — |
| `.bb-seo-content h3, h4, h5, h6` | `var(--fs-h4)` = 18→24px | `≥1200px` → `20px` |

---

### 6.6 Tất Cả `h6`

| Selector | font-size default | Override breakpoint |
|---|---|---|
| `.bb-richtext h4, h5, h6` | `var(--bb-text-h3)` (18px) | — |
| `.bb-home .content-bottom.wyswyg h6` | `var(--fs-h4)` = 18→24px | `≥1200px` → `20px` |
| `.bb-article-detail-page .bb-article-wyswyg h6` | `1rem` (16px) | — |
| `.bb-seo-content h3, h4, h5, h6` | `var(--fs-h4)` = 18→24px | `≥1200px` → `20px` |

---

### 6.7 Tóm Tắt Range Font-Size Theo Cấp Heading

| Thẻ | Min thực tế | Max thực tế | Token canonical | Ghi chú |
|---|---|---|---|---|
| `h1` | 18px | 70px | `--fs-h1` (30→56px) | 14 selector khác nhau, 6 token khác nhau |
| `h2` | 16px | 56px | `--fs-h2` (24→40px) | Home news parity nhảy 5 bậc (28→56px) |
| `h3` | 14px | ~34px | `--fs-h3` (20→30px) | Range rộng nhất tính theo tỉ lệ |
| `h4` | 18px | 24px | `--fs-h4` (18→24px) | Nhất quán nhất |
| `h5` | 18px | 20px | `--fs-h4` (18→24px) | Ít selector nhất |
| `h6` | 16px | 18px | `--fs-h4` (18→24px) | Gần với body text |

---

## 7. Font Size Thực Tế Tại Từng Viewport (Dạng A)

> **Cách đọc bảng:**
> - `~Npx` = giá trị **xấp xỉ** từ `clamp()` fluid — tự scale theo vw, không cố định
> - `Npx` = giá trị **cố định** — hoặc từ @media override, hoặc token đã chạm ceiling/floor
> - Cột đại diện cho viewport: **< 640px** ≈ 375px · **640–767px** ≈ 700px · **768–1023px** ≈ 900px · **≥ 1024px** ≈ 1280px · **≥ 1920px** = 1920px · **≥ 2560px** = 2560px
> - Tham chiếu token: `--fs-h1` = clamp(30→56px) · `--fs-h2` = clamp(24→40px) · `--fs-h3` = clamp(20→30px) · `--fs-h4` = clamp(18→24px) · `--fs-body` = clamp(16→18px) · `--fs-caption` = clamp(14→15px)

---

### 7.1 Thẻ H1

| Selector | Ngữ cảnh | < 640px | 640–767px | 768–1023px | ≥ 1024px | ≥ 1920px | ≥ 2560px |
|---|---|---|---|---|---|---|---|
| `.bb-page-head h1` | Tiêu đề trang chuẩn | ~30px | ~34px | ~36px | ~41px | ~48px | 56px |
| `.bb-page h1` | Page wrapper WP ¹ | 32px | 32px | ~28–32px | 32px | 32px | 32px |
| `.bb-news-hero h1` | Hero tin tức / bài viết ² | 18px | 24px | 24px | ~41px | ~48px | 56px |
| `.bb-article-h1` | Class heading bài viết ² | 18px | 24px | 24px | ~30px | 30px | 30px |
| `.bb-article-detail-parity .page-title h1` | Trang bài viết WP | 32px | 32px | 70px | 70px | 70px | 70px |
| `.bb-wp-pdp .product-information .title h1` | Tên sản phẩm WP PDP | 24px | 24px | 26px | 30px | 30px | 30px |
| `.bb-success h1` | Trang xác nhận đơn hàng | ~26px | ~33px | ~38px | 40px | 40px | 40px |
| `.bb-cart-heading-row h1` | Tiêu đề trang giỏ hàng ³ | 28px | 28px | 40px | 40px | 40px | 40px |
| `.bb-richtext h1` | H1 trong nội dung richtext | ~24px | ~26px | ~28px | ~31px | ~35px | 40px |
| `.bb-home .content-bottom.wyswyg h1` | H1 SEO content trang chủ ⁴ | ~24px | ~26px | ~28px | ~31px | 28px | 28px |

> ¹ `.bb-page h1`: override `≤768px → 32px` (ép token lên max); tại 769–991px fluid ~28–32px; ≥992px đạt ceiling 32px.  
> ² `.bb-news-hero h1` và `.bb-article-h1`: override `≤639px → 18px`, `640–1023px → 24px`; chỉ lấy fluid `--fs-h1` từ ≥1024px.  
> ³ `.bb-cart-heading-row h1`: default 40px, override `≤767px → 28px`; tại `≤600px` có thêm rule `32px` nhưng cascade phụ thuộc thứ tự trong file.  
> ⁴ `.bb-home .content-bottom.wyswyg h1`: override `≥1200px → 28px` — kích thước giảm ở desktop lớn (WP-parity legacy).

---

### 7.2 Thẻ H2

| Selector | Ngữ cảnh | < 640px | 640–767px | 768–1023px | ≥ 1024px | ≥ 1920px | ≥ 2560px |
|---|---|---|---|---|---|---|---|
| `body .bb-home .block-title h2` | Section heading trang chủ | ~30px | ~41px | ~47px | 50px | 50px | 50px |
| `body .bb-home .bb-home-news-parity .block-title h2` | Home news heading ⁵ | 28px | 28px | 34px | 44px | 50px | 56px |
| `.bb-richtext h2` | H2 trong nội dung richtext | ~20px | ~22px | ~22px | ~24px | ~27px | 30px |
| `.bb-article-detail-page .bb-article-wyswyg h2` | H2 trong bài viết | 32px | 32px | 32px | 32px | 32px | 32px |
| `.bb-home .content-bottom.wyswyg h2` | H2 SEO content trang chủ ⁶ | ~20px | ~22px | ~22px | ~24px | 26px | 26px |
| `.bb-home .about-bigbike .block-title h2` | Heading About us | ~30px | ~41px | ~47px | 50px | 50px | 50px |
| `.bb-account-header h2` | Tiêu đề trang tài khoản | 20px | 22px | 22px | 22px | 22px | 22px |
| `.bb-cart-page .cart_totals h2` | Tổng tiền giỏ hàng | 24px | 24px | 24px | 24px | 24px | 24px |
| `.bb-seo-content h2` | H2 trong SEO prose | ~20px | ~22px | ~22px | ~24px | ~27px | 30px |
| `.bb-product-archive .product .desc h2` | Tên sp trong danh mục | 16px | 16px | 16px | 16px | 16px | 16px |
| `.bb-checkout-page .check-out-step-title h2` | Bước checkout | 18px | 18px | 18px | 18px ⁷ | 18px | 18px |

> ⁵ Selector dùng file `home-news-parity.css` với 5 mức px cố định tại 5 breakpoint: `≤767px → 28px`, `768–991px → 34px`, `992–1919px → 44px`, `≥1920px → 50px`, `≥2560px → 56px`.  
> ⁶ Override `≥1200px → 26px` — giảm khi desktop lớn (WP-parity).  
> ⁷ Override `≤767px → 18px`; desktop không có rule riêng — giữ 18px.

---

### 7.3 Thẻ H3

| Selector | Ngữ cảnh | < 640px | 640–767px | 768–1023px | ≥ 1024px | ≥ 1920px | ≥ 2560px |
|---|---|---|---|---|---|---|---|
| `body .bb-home .block-title h3` | Section heading trang chủ | ~30px | ~41px | ~47px | 50px | 50px | 50px |
| `.bb-home .videos-slide .bb-home-video-title` | Tiêu đề section video ⁸ | ~20px | ~22px | ~28px | ~41px | ~48px | 56px |
| `.bb-richtext h3` | H3 trong nội dung richtext | 18px | 18px | 18px | 18px | 18px | 18px |
| `.bb-article-detail-parity .related--title h3.big` | Tiêu đề bài liên quan | 24px | 24px | 24px | 34px | 34px | 34px |
| `.bb-checkout-section h3` | Label bước checkout ⁹ | 15px | 16px | 16px | 16px | 16px | 16px |
| `.bb-order-summary h3` | Tiêu đề tóm tắt đơn | 15px | 15px | 15px | 15px | 15px | 15px |
| `.bb-article-detail-page .bb-article-wyswyg h3` | H3 trong bài viết | 28px | 28px | 28px | 28px | 28px | 28px |
| `.cart-table .table--items-item.cart-information h3` | Tên sản phẩm trong giỏ | 15px | 15px | 15px | 16px | 16px | 16px |
| `.bb-home .videos-slide--inner-item-desc h3` | Tiêu đề video card | ~18px | ~19px | ~20px | ~21px | ~22px | 24px |
| `.bb-category-body h3` | Heading thân danh mục | 16px | 16px | 16px | 16px | 16px | 16px |
| `.bb-seo-content h3` | H3 trong SEO prose ¹⁰ | ~18px | ~19px | ~20px | ~21px | 20px | 20px |

> ⁸ `.bb-home .videos-slide .bb-home-video-title`: override `≤767px → --fs-h3` (fluid 20→30px), `768–1023px → --fs-h2` (fluid 24→40px), `≥1024px → --fs-h1` (fluid 30→56px) — dùng 3 token khác nhau tại 3 dải.  
> ⁹ `.bb-checkout-section h3`: override `≤575px → 15px`; ≥576px → 16px.  
> ¹⁰ Override `≥1200px → 20px` (WP-parity giới hạn max).

---

### 7.4 Thẻ H4 / H5 / H6

| Selector | Thẻ | < 640px | 640–767px | 768–1023px | ≥ 1024px | ≥ 1920px | ≥ 2560px |
|---|---|---|---|---|---|---|---|
| `.bb-richtext h4, h5, h6` | h4/h5/h6 | 18px | 18px | 18px | 18px | 18px | 18px |
| `.bb-article-detail-page .bb-article-wyswyg h4` | h4 | 24px | 24px | 24px | 24px | 24px | 24px |
| `.bb-article-detail-page .bb-article-wyswyg h5` | h5 | 20px | 20px | 20px | 20px | 20px | 20px |
| `.bb-article-detail-page .bb-article-wyswyg h6` | h6 | 16px | 16px | 16px | 16px | 16px | 16px |
| `.bb-home .content-bottom.wyswyg h4, h5, h6` | h4/h5/h6 ¹¹ | ~18px | ~19px | ~20px | ~21px | 20px | 20px |
| `.bb-seo-content h4, h5, h6` | h4/h5/h6 ¹¹ | ~18px | ~19px | ~20px | ~21px | 20px | 20px |

> ¹¹ Default `--fs-h4` fluid 18→24px; override `≥1200px → 20px` (WP-parity giới hạn).

---

### 7.5 Body Text & Caption

| Selector | Ngữ cảnh | < 640px | 640–767px | 768–1023px | ≥ 1024px | ≥ 1920px | ≥ 2560px |
|---|---|---|---|---|---|---|---|
| `body` | Toàn bộ body text | ~16px | ~17px | ~17px | ~18px | 18px | 18px |
| `.bb-news-excerpt` | Tóm tắt bài viết | ~14px | ~14px | ~14px | 15px | 15px | 15px |
| `.bb-pdp-review-comment` | Nội dung review sản phẩm | ~14px | ~14px | ~14px | 15px | 15px | 15px |
| `.bb-page-head .sub` | Subtitle dưới page heading | ~14px | ~14px | ~14px | 15px | 15px | 15px |
| `.bb-cat-hero-title` | Hero title trang danh mục ¹² | 18px | 24px | ~36px | ~56px | ~70px | 70px |
| `.bb-pdp-info-title` | Tên sản phẩm (PDP mới) | ~24px | ~26px | ~28px | ~31px | ~35px | 40px |
| `.bb-section-title` | Tiêu đề section | ~30px | ~41px | ~47px | 50px | 50px | 50px |

> ¹² `.bb-cat-hero-title`: dùng `clamp(2.5rem, 5vw, 4.375rem)` — fluid theo 5vw. Override `≤639px → 18px`, `640–1023px → 24px`.

---

### 7.6 Token Tham Chiếu — Giá Trị Xấp Xỉ Tại Từng Cột

| Token | < 640px (~375px) | 640–767px (~700px) | 768–1023px (~900px) | ≥ 1024px (~1280px) | ≥ 1920px | ≥ 2560px |
|---|---|---|---|---|---|---|
| `--fs-h1` | ~30px | ~34px | ~36px | ~41px | ~48px | 56px |
| `--fs-h2` | ~24px | ~26px | ~28px | ~31px | ~35px | 40px |
| `--fs-h3` | ~20px | ~22px | ~22px | ~24px | ~27px | 30px |
| `--fs-h4` | ~18px | ~19px | ~20px | ~21px | ~22px | 24px |
| `--fs-body` | ~16px | ~17px | ~17px | ~18px | 18px | 18px |
| `--fs-caption` | ~14px | ~14px | ~14px | ~15px | 15px | 15px |
| `--bb-text-h1` | ~20px | ~26px | ~30px | 32px | 32px | 32px |
| `--bb-text-h2` | ~18px | ~21px | ~23px | 24px | 24px | 24px |
| `--bb-text-hero` | ~18px | ~24px | ~28px | 30px | 30px | 30px |
| `--bb-text-section-title` | ~30px | ~41px | ~47px | 50px | 50px | 50px |
| `--bb-text-40` | ~26px | ~33px | ~38px | 40px | 40px | 40px |
