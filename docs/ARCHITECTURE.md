# ARCHITECTURE.md — bigbike.vn

> Reverse-engineered from source snapshot taken `2026-04-17T12:53:25+07:00`.
> Snapshot root: `bigbike_vn__2026_04_17/`.
> Original server path: `/var/www/vhosts/bigbike.vn/httpdocs` (from `meta.json`).

---

## 1. Project overview

`bigbike.vn` is a Vietnamese e-commerce site selling motorcycle helmets and related gear. It is a **WordPress + WooCommerce monolith** running on PHP (shared hosting under Plesk). Traffic is served by a single WordPress instance fronted by multiple caching layers (W3 Total Cache, Autoptimize, WP Rocket — evidence of multiple competing cache plugins in `files/wp-content/` below).

- Storefront language: Vietnamese (multilingual via Polylang — `WPLANG = vi`).
- Theme (presentation): custom theme `bigbike` (internal name `king` per `package`/`textdomain`).
- Commerce layer: WooCommerce + ~15 auxiliary plugins.
- Admin UI: default `wp-admin` (custom admin bar hidden on front-end).
- Status: **production** — `ENVIROMENT = 'production'` in [wp-config.php:47](files/wp-config.php#L47).
- **WordPress core version: 6.9.4** (verified in [files/wp-includes/version.php](files/wp-includes/version.php), `$wp_version = '6.9.4'`).
- `$required_php_version = '7.2.24'` (minimum; actual runtime PHP = NEEDS_CONFIRMATION từ server).
- **HPOS (High-Performance Order Storage) chưa bật**: `kd_options.woocommerce_custom_orders_table_enabled='no'`, `woocommerce_feature_custom_order_tables_enabled='no'`, `woocommerce_custom_orders_table_data_sync_enabled='no'`. Nghĩa là nguồn đơn hàng source-of-truth là legacy `kd_posts.post_type='shop_order'` + `kd_postmeta`. Bảng `kd_wc_orders/kd_wc_order_*` tồn tại nhưng rỗng/chưa sync.

**Evidence**
- File: [files/wp-config.php](files/wp-config.php)
- File: [files/wp-content/themes/bigbike/functions.php](files/wp-content/themes/bigbike/functions.php)
- File: [files/wp-includes/version.php](files/wp-includes/version.php)
- File: [sqldump.sql](sqldump.sql) — `option_name='siteurl' → https://bigbike.vn`, `blogname='Bigbike.vn'`, `WPLANG='vi'`, `woocommerce_custom_orders_table_enabled='no'`

---

## 2. Runtime / request lifecycle

Standard WordPress flow, with theme-level customizations:

```
1.  Web server (Apache/Nginx under Plesk) routes request to /index.php.
2.  WordPress bootstraps via wp-load.php → wp-settings.php.
3.  Active MU/Drop-ins: wp-content/db.php, wp-content/object-cache.php,
    wp-content/advanced-cache.php — caching layers may short-circuit rendering.
4.  WordPress parses query_vars against rewrite rules:
      - `permalink_structure = "/tin-tuc/%postname%.html"`   (blog/posts)
      - `woocommerce_permalinks.product_base = "/product"` (WC default — BỊ OVERRIDE)
      - `woocommerce_permalinks.category_base = "danh-muc-san-pham"` (WC default — BỊ OVERRIDE)
      - `woocommerce_permalinks.tag_base = "tu-khoa-san-pham"`
      - **Permalink Manager Pro override là URL thực tế hiển thị.** Theo map URI đã lưu trong option `permalink-manager_uris` (serialized) và các rule mẫu trong `kd_rank_math_redirections`:
          - Product detail:   `/sp/{slug}.html`    (pattern `sp/%postname%.html`)
          - Product category: `/{cat-slug}.html` (root) hoặc `/{parent-cat}/{child-cat}.html` (hierarchical) — pattern `%product_cat%.html`
          - Brand (`pwb-brand`): `/brand/{slug}.html` — pattern `brand/%pwb-brand%.html`
          - Blog category:    `/{category}.html`  (pattern `%category%.html`)
          - Video CPT:        `/video/{slug}.html` hoặc `/{video_slug}/{video}.html` (pattern `video/%postname%.html`, `%video_slug%/%video%.html`)
          - Page:             `/{slug}.html`      (pattern `%pagename%.html`) — bao gồm page chính sách, gio-hang, thanh-toan, v.v. Nhưng page-id=1 "Tất cả sản phẩm" slug=`san-pham` có URL thực tế là `/danh-muc-san-pham.html` (shop listing root).
          - Blog post:        `/tin-tuc/{slug}.html`
      - Cấu hình Premmerce Permalink Manager (option `premmerce_permalink_manager`): `category=hierarchical`, `product=slug`, `use_primary_category=on`, `canonical=on`.
      - Polylang `vi/`, `en/` prefix đã dừng phát hành — tất cả URL có prefix `vi/` hay `en/` đều 301 về URL không prefix (xem `kd_rank_math_redirections` entries 3, 5, 14, 15, 16, 17, 22, 23, 24, 25, 26, 27, 28, 39).
5.  Template hierarchy picks a PHP file from theme bigbike.
    WooCommerce intercepts via wc_get_template() for shop / product /
    cart / checkout / my-account URLs.
6.  Theme enqueues assets per context (see §6).
7.  Content is buffered (ob_start at 'init', see functions.php:134-137)
    and post-processed by plugins (Autoptimize, WP Rocket, RankMath).
8.  AJAX calls from the browser hit /wp-admin/admin-ajax.php
    with obj_ajax.ajaxurl defined in header.php:48.
```

**Evidence**
- [files/wp-content/themes/bigbike/functions.php:134-137](files/wp-content/themes/bigbike/functions.php#L134-L137) — `ob_start()` on `init`.
- [files/wp-content/themes/bigbike/header.php:48](files/wp-content/themes/bigbike/header.php#L48) — `obj_ajax.ajaxurl`.
- `kd_options.permalink_structure` / `woocommerce_permalinks` in sqldump.sql.

---

## 3. Repository / filesystem structure

```
bigbike_vn__2026_04_17/
├── CLAUDE.md
├── meta.json                # snapshot metadata + dbPrefix 'kd_'
├── sqldump.sql              # full DB dump, prefix 'kd_'
└── files/                   # WordPress installation root
    ├── wp-admin/            # WordPress core admin (vendor)
    ├── wp-includes/         # WordPress core (vendor)
    ├── wp-config.php        # DB credentials + AUTH/NONCE salts + ENVIROMENT
    ├── index.php            # standard WP entry
    └── wp-content/
        ├── advanced-cache.php / object-cache.php / db.php   # drop-ins
        ├── cache/, wphb-cache/, w3tc-config/, wp-rocket-config/
        ├── plugins/         # 27 installed, see §8
        ├── themes/
        │   ├── bigbike/     # ACTIVE theme (template + stylesheet = 'bigbike')
        │   └── index.php
        └── uploads/         # user-uploaded media
```

### Theme `bigbike` layout

```
themes/bigbike/
├── functions.php                        # theme bootstrap, requires inc/*
├── header.php / footer.php / sidebar.php / searchform.php / index.php
├── archive.php / category.php / search.php / single.php / page.php
├── single-review.php / single-video.php   # custom post types
├── inc/
│   ├── layout-functions.php             # asset enqueue strategy + Polylang strings
│   ├── ajax-functions.php               # all 8 custom AJAX handlers
│   ├── woo-functions.php                # WooCommerce hooks, filters, walkers, SEO title/desc overrides
│   └── utils-functions.php              # price / variation / pagination helpers
├── page-templates/                      # ACF/Polylang-driven landing pages
│   ├── page-home.php  page-cart.php  page-checkout.php
│   ├── page-login.php  page-register.php  page-profile.php
│   ├── page-contact.php  page-about.php  page-guide.php
│   ├── page-news.php  page-static.php
├── template-parts/                      # rendered via get_custom_template()
│   ├── content-*.php  product-filter.php
├── woocommerce/                         # full WooCommerce template override layer
│   ├── archive-product.php  taxonomy-product_cat.php  taxonomy-pwb-brand.php
│   ├── single-product.php   content-single-product.php  content-product.php
│   ├── cart/  checkout/  myaccount/  order/  single-product/  loop/  global/
├── scripts/                             # dev JS (source + vendor libs)
│   ├── bigbike.main.js                  # main front-end JS (front_app namespace)
│   ├── pages/product-detail.js / home.js
│   └── jquery.*.js, swiper.min.js, sweetalert2, toastr, mobile-detect, elevateZoom
├── plugin/                              # vendor folders: fancybox, jquery, select2, swiper
├── styles/                              # dev CSS (main.css, custom.css, product-detail.css, ...)
├── dist/                                # Gulp-built production bundles (see §7)
│   ├── home.min.js / home.min.css
│   ├── product-page.min.js / product-page.min.css
│   ├── product-category.min.js / product-category.min.css
│   └── general-page.min.js / general-page.min.css
├── images/   fonts/   favicon/
├── gulpfile.js  package.json  package-lock.json
└── style.css                            # WP theme header (required)
```

**Evidence**
- Repo listing (ls) of `files/wp-content/themes/bigbike/`.
- [files/wp-content/themes/bigbike/functions.php:141-144](files/wp-content/themes/bigbike/functions.php#L141-L144).

---

## 4. Template hierarchy implications

The active theme uses a mix of WordPress template hierarchy AND WooCommerce overrides:

URL dưới đây đã verify qua `kd_rank_math_redirections` (40 row active trong dump) + cấu hình `permalink-manager_uris`.

| Request | Template resolved | Notes |
|---|---|---|
| `/` | page-templates/page-home.php (page_id=12 "Trang chủ", slug `home`) | Home là Page; ACF sections + featured products. |
| `/sp/{slug}.html` | woocommerce/single-product.php → content-single-product.php | Pattern Permalink Manager `sp/%postname%.html`. VD `/sp/giay-di-moto-phuot-tcx-ro4d-waterproof.html`. |
| `/{cat-slug}.html` hoặc `/{parent-cat}/{child-cat}.html` | woocommerce/taxonomy-product_cat.php | Pattern `%product_cat%.html`. VD `/mu-bao-hiem.html`, `/ao-quan-bao-ho/ao-bao-ho-tui-khi.html`, `/phu-kien-khac.html`. |
| `/danh-muc-san-pham.html` (page_id=1, slug `san-pham`) | woocommerce/archive-product.php | Shop listing root. Kết hợp `?pwb-brand=…`, `?filter_color=…`, `?filter_gender=…`, `?min_price=…`, `?max_price=…`, `?paged=…`. |
| `/brand/{slug}.html` | woocommerce/taxonomy-pwb-brand.php | Pattern `brand/%pwb-brand%.html`. **Không dùng `/pwb-brand/` mặc định**. |
| `/?s=...` | search.php với filter `posts_search` mở rộng sang product_cat + pwb-brand | [functions.php:215-254](files/wp-content/themes/bigbike/functions.php#L215-L254). |
| `/tin-tuc/{slug}.html` | single.php | `permalink_structure='/tin-tuc/%postname%.html'`. |
| `/{blog-category-slug}.html` | category.php | Pattern `%category%.html`. URL chính xác per blog category NEEDS_CONFIRMATION. |
| `/video/{slug}.html` hoặc `/{video_slug}/{video}.html` | single-video.php | CPT `video` (Pods-generated, 62 posts). Pattern có 2 variant trong `permalink-manager_uris`. NEEDS_CONFIRMATION variant nào live. |
| `/gio-hang.html` (page id 2, slug `gio-hang`) | page-templates/page-cart.php | `post_content` = `[woocommerce_cart]` (verified). |
| `/thanh-toan.html` (page id 3, slug `thanh-toan`) | page-templates/page-checkout.php | `post_content` = `[woocommerce_checkout]` (verified). |
| `/tai-khoan.html` (page id 4, slug `tai-khoan`) | default WC → woocommerce/myaccount/my-account.php | WC My Account. |
| `/lien-he.html` (slug `lien-he`) | page-templates/page-contact.php | CF7 form id=8895. |
| `/dang-nhap.html` (page id 7970, slug `dang-nhap`) | page-templates/page-login.php | Custom AJAX login. |
| `/dang-ky.html` (page id 7968, slug `dang-ky`) | page-templates/page-register.php | Custom AJAX register. |
| `/quen-mat-khau.html` (page id 10155, slug `quen-mat-khau`) | page-static / page-template có `[lost_password_form]` | Shortcode [utils-functions.php:441](files/wp-content/themes/bigbike/inc/utils-functions.php#L441). |
| `/gioi-thieu.html` (slug `gioi-thieu`) | page-templates/page-about.php | |
| `/huong-dan.html` (slug `huong-dan`) | page-templates/page-guide.php | |
| `/huong-dan-mua-hang.html` (page id 11, slug `huong-dan-mua-hang`) | page.php hoặc page-static.php | Content verified trong `kd_posts`. |
| `/thanh-toan/order-received/{id}?key=...` | woocommerce/checkout/thankyou.php | WC endpoint; Quick Buy hard-code URL này [ajax-functions.php:436](files/wp-content/themes/bigbike/inc/ajax-functions.php#L436). |

**Status:** URL patterns verified qua `kd_rank_math_redirections` (40 row) + pattern lưu trong `permalink-manager_uris`. Page slugs verified từ `kd_posts`. Một số page chính sách (bảo mật/đổi trả/giao hàng/điều khoản) không có trong 22 page publish của snapshot → NEEDS_CONFIRMATION.

**Evidence**
- `kd_options`: `woocommerce_shop_page_id=1`, `woocommerce_cart_page_id=2`, `woocommerce_checkout_page_id=3`, `woocommerce_myaccount_page_id=4`.
- [files/wp-content/themes/bigbike/page-templates/page-login.php:11-12](files/wp-content/themes/bigbike/page-templates/page-login.php#L11-L12) references `pll_get_post(7968 …)` and `pll_get_post(10155 …)`.
- [files/wp-content/themes/bigbike/inc/ajax-functions.php:436](files/wp-content/themes/bigbike/inc/ajax-functions.php#L436) — hard-coded path `/thanh-toan/order-received/...`.

---

## 5. Theme / Plugin / Core separation

### 5.1 Core platform
- `wp-admin/`, `wp-includes/`, `wp-config.php`, `wp-load.php`, `wp-settings.php`: standard WordPress. Not customised.
- Salts/keys present in plaintext in `wp-config.php` (see §13 Risks).

### 5.2 Business layer (plugins)
Business logic is distributed across WooCommerce and roughly 27 active plugins (from `kd_options.active_plugins`).

Critical business plugins (ordered by blast radius):

| Plugin | Role in business logic |
|---|---|
| `woocommerce/woocommerce.php` | Entire cart/checkout/order/product domain. |
| `advanced-custom-fields-pro/acf.php` | Home page sections, product videos, top_image, content_bottom. Used on every page template. |
| `polylang/polylang.php` | Multilingual strings (`pll_e`, `pll_register_string`, `pll_get_post`, `pll_get_term`). Drives login/register/blog permalinks per language. |
| `perfect-woocommerce-brands/perfect-woocommerce-brands.php` | `pwb-brand` taxonomy — used in search, category filter, home brand carousel. |
| `permalink-manager-pro/permalink-manager.php` | URL rewriting source-of-truth. Serialize map lưu ở option `permalink-manager_uris`. Confirmed patterns: `sp/%postname%.html`, `%product_cat%.html`, `brand/%pwb-brand%.html`, `%pagename%.html`, `video/%postname%.html`, `%video_slug%/%video%.html`, `%category%.html`. |
| `simple-post-type-permalinks/simple-post-type-permalinks.php` | Plugin id 3.3.5 present (option `cptp_version=3.3.5`). Bổ trợ cho Permalink Manager. |
| `seo-by-rank-math/rank-math.php` | Primary SEO engine. `rank_math_modules` bao gồm: link-counter, analytics, seo-analysis, sitemap, rich-snippet, woocommerce, buddypress, bbpress, acf, web-stories, instant-indexing, role-manager, redirections, 404-monitor. Theme cũng đọc `_yoast_wpseo_title/_yoast_wpseo_metadesc/_yoast_wpseo_primary_product_cat` (Yoast legacy) [woo-functions.php:505](files/wp-content/themes/bigbike/inc/woo-functions.php#L505). |
| `flexible-shipping/flexible-shipping.php` | Shipping method IDs used by quick-buy (`flexible_shipping_single:9` in [ajax-functions.php:427](files/wp-content/themes/bigbike/inc/ajax-functions.php#L427)). Shipping zone duy nhất: zone id=2 "Việt Nam" + country=VN, 4 methods trong zone (free_shipping id=6, flat_rate id=7, flexible_shipping_single id=9, flat_rate id=10). |
| `contact-form-7` + `contact-form-cfdb7` | 1 form active id=8895 (verified). Fields: `your_name`, `your_email`, `your_phone`, `your_message`. Bảng `kd_db7_forms` có 1 INSERT statement trong dump. |
| `devvn-woocommerce-price-filter` | Price-range sidebar filter on shop/category. |
| `woo-product-variation-gallery` | Variation gallery JS — explicitly deregistered in `layout-functions.php:60-63`. |
| `pods/init.php` | Pods config post-type `_pods_pod` với ít nhất 1 pod: "Videos" (confirmed row `(7920,1,…,'video','',…,'_pods_pod',…)`). Drive CPT `video`. CPT `slider` (2 posts) có thể cũng do Pods, NEEDS_CONFIRMATION. **Không có CPT `review`** — `single-review.php` template có thể dùng cho blog category `review` thay vì CPT. |
| `nextend-facebook-connect` | Thư mục plugin có trong `wp-content/plugins/` nhưng KHÔNG có trong `active_plugins` serialized. Login form trong theme vẫn reference `?loginSocial=facebook` — feature hiện tại không hoạt động. |
| `google-listings-and-ads`, `breadcrumb-navxt`, `autoptimize`, `w3-total-cache`, `wordfence`, `classic-editor`, `classic-widgets`, `tinymce-advanced`, `add-html-to-pages`, `disable-comments`, `disable-feeds-wp`, `disable-xml-rpc-api`, `auto-image-attributes-from-filename-with-bulk-updater`, `tiny-compress-images` | Non-commerce auxiliary. |

**Evidence (active plugins):** `kd_options` id=33 `active_plugins` serialized in sqldump.sql. Array thiếu index 16 (plugin bị gỡ nhưng option chưa re-index) — 26 plugin active thực tế, không phải 27.

### 5.3 Presentation layer (theme `bigbike`)
- All WordPress templates are present; WooCommerce templates are heavily overridden.
- Business leaks into the theme via `inc/ajax-functions.php` — see §10.
- **Warning:** Theme contains both production-ready logic AND commented-out legacy code (`woocommerce_template_single_title` removed & re-added; `content-product_bk.php`, `content-product_cat.php`, `header_bk.php`, `footer_bk.php`, `related_bk.php`, `review-order.php.new` — backup files not cleaned up).

### 5.4 Data / content layer
- MySQL database, table prefix `kd_`.
- Tables of interest: `kd_posts`, `kd_postmeta`, `kd_terms`, `kd_term_taxonomy`, `kd_term_relationships`, `kd_termmeta`, `kd_options`, `kd_users`, `kd_usermeta`, `kd_comments`, `kd_commentmeta`, `kd_woocommerce_order_items` + `kd_woocommerce_order_itemmeta` (line items legacy), `kd_db7_forms` (CF7 submissions), `kd_social_users` (Nextend), `kd_rank_math_*`, `kd_yoast_*` (Yoast tables legacy — còn schema, postmeta/termmeta `_yoast_wpseo_*` vẫn có), `kd_podsrel` (Pods).
- **Order authority**: HPOS tables (`kd_wc_orders`, `kd_wc_orders_meta`, `kd_wc_order_addresses`, `kd_wc_order_operational_data`) tồn tại nhưng HPOS chưa bật (`woocommerce_custom_orders_table_enabled='no'` + `woocommerce_custom_orders_table_data_sync_enabled='no'`) → **nguồn chính là legacy `kd_posts` (post_type='shop_order') + `kd_postmeta`** (825 orders verified). Không migrate từ `kd_wc_orders` — có thể rỗng hoặc stale.
- WC Analytics lookup tables: `kd_wc_order_stats`, `kd_wc_order_product_lookup`, `kd_wc_order_tax_lookup`, `kd_wc_order_coupon_lookup`, `kd_wc_customer_lookup`, `kd_wc_category_lookup`, `kd_wc_product_attributes_lookup`, `kd_wc_product_meta_lookup`.
- `kd_actionscheduler_*`, `kd_wfsnipcache/wflogs/wftrafficrates/...` (Wordfence), `kd_wpr_*` (WP Rocket), `kd_ewwwio_*` (EWWW image optim), `kd_pmxe_*` (WP All Export), `kd_fg_redirect`, `kd_gla_*` (Google Listings & Ads).
- `uploads/` holds user-uploaded product images.

**Evidence:** `grep "^-- Table structure for table \`kd_" sqldump.sql` lists all tables.

---

## 6. Asset loading strategy

Controlled centrally by `bigbike_enqueue_page_template_styles()` hooked on `wp_enqueue_scripts` in [inc/layout-functions.php:6-139](files/wp-content/themes/bigbike/inc/layout-functions.php#L6-L139).

Rules:

| Page context | In production (`ENVIROMENT=production`) | In dev |
|---|---|---|
| Home (`is_page_template('page-home.php')`) | `dist/home.min.{js,css}` | vendor libs + `scripts/bigbike.main.js` + separate CSS files |
| Product detail (`is_product()`) | `dist/product-page.min.{js,css}` | dev bundle + `scripts/pages/product-detail.js` + elevateZoom + toastr + mobile-detect |
| Shop / product cat / brand / search | dev bundle only (production branch commented out at [layout-functions.php:66-69](files/wp-content/themes/bigbike/inc/layout-functions.php#L66-L69)) | sticky + rating + main.js |
| Any other | `dist/general-page.min.{js,css}` or dev bundle |
| Login template | + jquery.validate, sweetalert2, toastr |
| Register template | + same as login + register.css |
| Contact template | keeps CF7 script (contact-form-7 deregistered on every other page at [layout-functions.php:134-137](files/wp-content/themes/bigbike/inc/layout-functions.php#L134-L137)) |
| Cart / Checkout / Category / Singular | extra dedicated stylesheet |

Additional asset/optimization tricks:
- WooCommerce default CSS + scripts **always** deregistered globally: [layout-functions.php:143-167](files/wp-content/themes/bigbike/inc/layout-functions.php#L143-L167). This includes `wc-cart-fragments`, `woocommerce`, `wc-add-to-cart` — which is why the site needs its own AJAX cart/add-to-cart (§10).
- `jquery` is explicitly deregistered for non-admin pages at [layout-functions.php:11](files/wp-content/themes/bigbike/inc/layout-functions.php#L11). The theme re-enqueues its own bundled jQuery from `plugin/jquery/jquery.min.js`.
- `woo-product-variation-gallery` is deregistered on shop/category/brand/search pages.
- `dashicons`, `wp-block-library`, `wc-block-style` removed from front-end (see `my_deregister_styles`).
- oEmbed discovery, RSS feed links, emoji detection, generator meta removed.
- Custom lightweight lazy-load via `lozad.min.js` + filter `add_data_src_to_content` that rewrites `<img src=...>` → `<img class='lazy' data-src=...>` on the fly ([utils-functions.php:472-481](files/wp-content/themes/bigbike/inc/utils-functions.php#L472-L481)).
- `change_attachement_image_attributes` forces `alt`/`title` on every product attachment to the product title ([functions.php:174-193](files/wp-content/themes/bigbike/functions.php#L174-L193)).

**Risk:** The production path for shop/category/brand/search is commented out, so those pages always ship dev bundles (unminified). Migration should keep this behaviour or formally switch — do not assume `dist/product-category.min.*` are wired.

---

## 7. Build pipeline (Gulp)

- `themes/bigbike/gulpfile.js` + `package.json` + `package-lock.json` — not inspected line by line; names of `dist/*.min.{js,css,map}` indicate a Gulp task per page (home, product-page, product-category, general-page).
- Source maps (`.map`) are shipped in `dist/`.
- **Needs verification:** Gulp commands (build/watch/minify) and whether `general-page`/`home`/`product-page` bundles are up to date with `scripts/` sources.

---

## 8. Plugin dependency map (runtime)

Direct theme → plugin function calls:

| Function in theme | Plugin that owns it | Used in |
|---|---|---|
| `pll_e`, `pll_register_string`, `pll_get_post`, `pll_get_term`, `pll_current_language` | Polylang | layout-functions.php, utils-functions.php, page-login.php, page-register.php, page-home.php |
| `get_field`, `the_field`, `have_rows` | ACF Pro | page-home.php, page-contact.php, product archives/detail (top_image, image_left, content_bottom, rating, rating_count, sliders, about_us, blog_content, contact_form, iframe_maps, note) |
| `get_term_link(..., 'pwb-brand')`, taxonomy `pwb-brand` | Perfect WooCommerce Brands | functions.php:228, page-home.php:300, woo-functions.php:461 |
| `wc_*`, `WC()`, `WC_Product*`, `WC_Order_Item_Shipping`, `wc_create_order` | WooCommerce | Everywhere commerce-related |
| `flexible_shipping_single:9` method id | Flexible Shipping | ajax-functions.php:427 (quick buy) |
| `[lost_password_form]` shortcode | Custom in `utils-functions.php:436-441` (calls `wc_get_template` on WC template) | Page 10155 |
| `'nsl'` data attributes, `?loginSocial=facebook` | Nextend Social Login | page-login.php:56, page-register.php:66 — but plugin not in active list |

---

## 9. AJAX lifecycle

```
Browser:
  $.ajax({ url: obj_ajax.ajaxurl, type: 'POST', dataType: 'json',
           data: { action: 'custom_*', ... } })
      ↓
/wp-admin/admin-ajax.php
      ↓
do_action('wp_ajax_nopriv_<action>')   (guest)
do_action('wp_ajax_<action>')          (logged-in)
      ↓
Handler in inc/ajax-functions.php
      ↓
wp_send_json_success({ error, error_code, action, command, title, message, ... })
wp_send_json_error ({ error, error_code, action, command, title, message })
```

- `obj_ajax.ajaxurl` is inlined into the `<head>` at [header.php:48](files/wp-content/themes/bigbike/header.php#L48). Value is `get_site_url() . '/wp-admin/admin-ajax.php'`.
- The generic form handler at [scripts/bigbike.main.js:280-325](files/wp-content/themes/bigbike/scripts/bigbike.main.js#L280-L325) (`processSubmitFormFront`) auto-wires **any form with class `js-form-submit-data`** to POST its serialized data to `admin-ajax.php`. The `action` is read from a hidden `<input name="action">` inside the form. Used by login, register, quick-buy.
- **No nonce** is attached to these AJAX requests. Every handler in `ajax-functions.php` registers both `wp_ajax_*` and `wp_ajax_nopriv_*` — i.e. open to guests — and none of them call `check_ajax_referer`, `wp_verify_nonce`, or `current_user_can`. See §PERMISSION_MATRIX / §API_CONTRACT.

---

## 10. Where business logic lives

| Domain | Where in code | Notes |
|---|---|---|
| Custom login (Phone/Email + Password) | `inc/ajax-functions.php:custom_login_user` | Validates against `user_login` OR `user_email`, then `wp_set_auth_cookie`. |
| Custom register | `inc/ajax-functions.php:custom_register_user` + `register_validation_update` | Uses phone (10 digits) as `user_login`. Stores phone in `user_meta.phone`. |
| Update profile | `inc/ajax-functions.php:update_user_infomation` | Updates `first_name`, `display_name`, `user_meta.gender`, `user_meta.dob`, optional password change. |
| Add to cart (simple + variation) | `inc/ajax-functions.php:custom_add_to_cart` | Uses `WC()->cart->add_to_cart()`. |
| Remove cart item | `inc/ajax-functions.php:remove_item_from_cart` | `WC()->cart->remove_cart_item()` + re-renders `template-parts/header-cart.php`. |
| Update cart quantity | `inc/ajax-functions.php:update_cart_item_quantity` | `WC()->cart->set_quantity()`. |
| Quick buy (one-click order) | `inc/ajax-functions.php:buy_quickly` | Auto-creates user, creates WC_Order, attaches flexible_shipping_single:9, forces status `processing`, sets payment method `bacs`. Redirects to thank-you URL. |
| Variation lookup | `inc/ajax-functions.php:find_variation_product` + `bigbike_find_matching_product_variation` (in utils) | Returns `variation_id`, `price`, `regular_price`. |
| Variation UI (radios instead of dropdown) | `inc/woo-functions.php:variation_radio_buttons` | Hooks `woocommerce_dropdown_variation_attribute_options_html` to replace `<select>` with styled radios; reads `get_field('color', $term)` + `get_field('image', $term)` for `pa_color`. |
| Checkout field tweaks | `inc/woo-functions.php:custom_override_checkout_fields` + `add_custom_class_to_checkout_field` | Removes company/country/state/postcode; adds 10-digit phone validation. |
| Shop SEO title/description | `inc/woo-functions.php:custom_document_title` + `custom_document_title_heading` + `custom_document_description` | Hooked on `wpseo_title` + `wpseo_metadesc` + `woocommerce_page_title`. Reads `_yoast_wpseo_title` / `_yoast_wpseo_metadesc` postmeta/termmeta. |
| Related products | `inc/utils-functions.php:custom_related_products` | By `_yoast_wpseo_primary_product_cat`. |
| Pagination | `inc/utils-functions.php:kdc_pagination` | |
| Search extension | `functions.php:woocommerce_search_product_tag_extended` + `request` filter | Extends WP search to match `product_cat` and `pwb-brand` taxonomies. |
| Redirect on empty search | `functions.php:no_products_found_redirect` | Redirects to `home_url('/?s=...')`. |
| Lost password form | `utils-functions.php:wc_custom_lost_password_form` shortcode `[lost_password_form]` |
| Reset password → login redirect | `utils-functions.php:woocommerce_new_pass_redirect` on `woocommerce_customer_reset_password` |
| Brand carousel on home | `page-home.php:297-327` — first 5 `pwb-brand` terms |
| Home featured products | `page-home.php:57-69` — `product_visibility = featured` tax query |
| Home category cards | `page-home.php:104-117` — products_categories with `show_on_homepage` meta_query |
| Home sliders | `page-home.php:10-54` — ACF `sliders` field on the Home page (with possible fallback to `post_type=slider`) |

---

## 11. SEO / Cache / i18n notes

### SEO
- Legacy Yoast metadata (`_yoast_wpseo_*`) still read even though active SEO plugin is RankMath.
  - `custom_document_title` at [woo-functions.php:501-540](files/wp-content/themes/bigbike/inc/woo-functions.php#L501-L540) reads `_yoast_wpseo_title` from shop/category meta, but hooks into `wpseo_title` (Yoast's filter) — the primary SEO plugin is RankMath. **Risk: SEO titles may be swallowed by one plugin and not the other.** Needs verification in production.
- Shop page canonical override is hard-coded to `https://bigbike.vn/` on search pages in [layout-functions.php:297-303](files/wp-content/themes/bigbike/inc/layout-functions.php#L297-L303) via direct `<meta name="canonical">`. That is **not** the standard `<link rel="canonical">`, so engines may ignore it.
- `wpseo_next_rel_link` + `wpseo_prev_rel_link` are forced to return false.
- Breadcrumb: Breadcrumb NavXT plugin + `template-parts/content-breadcrumbs.php`.
- robots.txt: not present in snapshot (virtual by WordPress). `blog_public=1`.
- Structured data:
  - Organisation JSON-LD in `header.php`.
  - `dataLayer.push` events in `content-single-product.php`, `cart.php`, `thankyou.php` (GTM integration).

### Cache
- Multiple cache plugins installed and partially configured:
  - W3 Total Cache (active) — `WP_CACHE=true`, `advanced-cache.php` present.
  - Autoptimize — active.
  - WP Rocket — `wp-rocket-config/` present, but `wp-rocket` is NOT in `active_plugins`. Residual config.
  - WP Hummingbird — `wphb-cache/`, `wphb-logs/` present, plugin NOT active. Residual.
- `object-cache.php` + `db.php` drop-ins exist — verify their owner (could be W3 Total Cache memcached, OPcache, or a custom implementation). **Needs verification** before migration.

### i18n
- Polylang. Vietnamese is primary (`WPLANG=vi`).
- Theme does NOT hard-code a second language fallback, but uses `pll_get_post()` to resolve the login/register/forgot page IDs per current language. Implies English (or another locale) pages exist via Polylang.
- Translatable strings registered in `layout-functions.php:178-200` (labels for Read More, Hotline, CORNER_EXPERIENCE_WITH_BIGBIKE, etc.).

---

## 12. Architecture risks (for migration)

| # | Risk | Evidence |
|---|---|---|
| A1 | DB credentials and WP auth salts committed in plaintext in the snapshot. | [files/wp-config.php:57,89-103](files/wp-config.php#L57-L103) |
| A2 | All custom AJAX endpoints are open to guests (`wp_ajax_nopriv_*`) and none verify a nonce. | [inc/ajax-functions.php:1-25](files/wp-content/themes/bigbike/inc/ajax-functions.php#L1-L25) |
| A3 | `update_user_infomation` uses raw `$_POST['old_password']` comparison and `wp_set_password` without a nonce or capability check — mass password-change surface. | [ajax-functions.php:161-222](files/wp-content/themes/bigbike/inc/ajax-functions.php#L161-L222) |
| A4 | `buy_quickly` auto-creates a WooCommerce user + order from un-authenticated POST with no rate limiting, no CAPTCHA, no nonce. | [ajax-functions.php:354-447](files/wp-content/themes/bigbike/inc/ajax-functions.php#L354-L447) |
| A5 | `buy_quickly` generates `user_email` as `$phone.'@liveevil.vn'` when missing, and the email assignment for `$email` uses `$_REQUEST['product_id']` — a bug, not a feature ([ajax-functions.php:364](files/wp-content/themes/bigbike/inc/ajax-functions.php#L364)). |
| A6 | Variation lookup echoes raw `$_REQUEST['data']` into DB queries through `bigbike_find_matching_product_variation`. Relies on WC data-store sanitisation. | [ajax-functions.php:449-475](files/wp-content/themes/bigbike/inc/ajax-functions.php#L449-L475) |
| A7 | Three active cache layers + residual config from two more can double-cache or serve stale HTML. | `wp-content/` listing. |
| A8 | HPOS **chưa bật** (`woocommerce_custom_orders_table_enabled='no'`). `kd_wc_orders/kd_wc_order_*` có schema nhưng không phải source-of-truth. **Nguồn thật** là `kd_posts` post_type=shop_order + `kd_postmeta` + `kd_woocommerce_order_items` + `kd_woocommerce_order_itemmeta`. | `sqldump.sql` `woocommerce_custom_orders_table_enabled` option |
| A9 | Yoast meta keys (`_yoast_wpseo_*`) still read even though RankMath is the active SEO plugin — migration must carry both sets OR consolidate. | [inc/woo-functions.php:505](files/wp-content/themes/bigbike/inc/woo-functions.php#L505) |
| A10 | Hard-coded shipping method id `flexible_shipping_single:9` — brittle across environments. | [ajax-functions.php:427](files/wp-content/themes/bigbike/inc/ajax-functions.php#L427) |
| A11 | Hard-coded Polylang post IDs (7968, 7970, 10155, 361, 365, 287). Migration must preserve these or re-map. | [page-login.php:11-12](files/wp-content/themes/bigbike/page-templates/page-login.php#L11-L12), [utils-functions.php:445](files/wp-content/themes/bigbike/inc/utils-functions.php#L445), [page-home.php:189-234](files/wp-content/themes/bigbike/page-templates/page-home.php#L189-L234) |
| A12 | `buy_quickly` sets the order to `processing` immediately without any payment verification — any automated call can create a confirmed order. | [ajax-functions.php:435](files/wp-content/themes/bigbike/inc/ajax-functions.php#L435) |
| A13 | Free-shipping cutoff `>= 2_000_000 VND` is hard-coded in `buy_quickly`. | [ajax-functions.php:419-421](files/wp-content/themes/bigbike/inc/ajax-functions.php#L419-L421) |

---

## 13. Migration implications (Next.js / Spring Boot)

Before any rewrite is attempted, the following WordPress-specific behaviour must be replicated or replaced:

1. **Routing.**
   - Product URLs under `/product/{slug}/`, categories under `/danh-muc-san-pham/`, brands under `/pwb-brand/`, blog under `/tin-tuc/{slug}.html`.
   - Additional rules from `permalink-manager-pro` and `simple-post-type-permalinks` must be exported from WP admin (not in source) and manually encoded. **Needs verification**.

2. **Content model.**
   - ACF Field Groups provide home-page sections, product extras, page top images. Export the ACF JSON (`acf-json/` not present in snapshot — check plugin options table). **Needs verification**.
   - Pods custom content types (sliders, videos, reviews) are driven by Pods plugin — see `kd_podsrel`. **Needs verification**.
   - Polylang translation tables live in `kd_term_taxonomy` as `language` + `post_translations`/`term_translations`.

3. **Commerce.**
   - WooCommerce pricing, stock, tax, coupons, shipping zones → re-implement or import.
   - Orders use HPOS tables (`kd_wc_orders`). Choose HPOS as source of truth.
   - Quick-buy path must be recreated with fraud controls and proper payment flow (BACS alone is risky as today).
   - Reference `flexible-shipping` plugin UI for shipping method config export.

4. **Sessions / Auth.**
   - Replace WP auth cookies + nonce scheme with a standard JWT/OAuth flow.
   - Social login currently relies on Nextend (inactive): decide to drop or migrate to native OAuth.

5. **SEO.**
   - Re-do title/description logic using a single engine (RankMath or a standalone SEO library).
   - Preserve all existing URLs — they are indexed under `/tin-tuc/*.html` and Vietnamese slugs.

6. **Assets.**
   - Replace Gulp → Vite / Next build.
   - Keep lazy-load pattern (currently `lozad` + `data-src`).

7. **Third-party integrations to preserve:**
   - GTM (`dataLayer`) events for `view_item`, `view_cart`, `purchase`.
   - Google Listings & Ads feed.
   - Facebook domain verification meta in `<head>`.

---

## 14. Evidence index

| Fact | Evidence |
|---|---|
| Project is WordPress + WooCommerce | `files/wp-config.php`, `files/wp-content/plugins/woocommerce/` |
| Table prefix `kd_` | `meta.json.dbPrefix`, `wp-config.php:119`, all SQL tables |
| Site URL `https://bigbike.vn` | `kd_options.siteurl`, `kd_options.home` |
| Currency VND | `kd_options.woocommerce_currency` |
| Ship-to-countries empty → defaults to all allowed | `kd_options.woocommerce_allowed_countries = all`, `kd_options.woocommerce_ship_to_countries = ''` |
| Guest checkout enabled | `kd_options.woocommerce_enable_guest_checkout = yes` |
| WooCommerce taxes disabled | `kd_options.woocommerce_calc_taxes = no` |
| Ship to destination: billing | `kd_options.woocommerce_ship_to_destination = billing` |
| Coupons enabled | `kd_options.woocommerce_enable_coupons = yes` |
| Reviews disabled | `kd_options.woocommerce_enable_reviews = no` |
| Stock management enabled | `kd_options.woocommerce_manage_stock = yes` |
| Production environment flag | `wp-config.php:47 ENVIROMENT='production'` |

---

## 15. Missing inputs / Needs verification

1. Actual rewrite rules output (`wp rewrite list`) — permalink-manager-pro config is in DB options but not dumped as human-readable.
2. ACF field groups export (`acf-json/` or `postmeta` for `acf-field-group`).
3. Pods configuration (which CPTs they expose: `slider`, `video`, `review` assumed).
4. WP Rocket / W3 Total Cache page-rule set.
5. Current WooCommerce shipping zones and methods (`kd_woocommerce_shipping_*` tables are present but not inspected for this pass).
6. RankMath settings vs. leftover Yoast meta — which one actually renders the `<title>` in production.
7. Active cron jobs (`kd_options.cron`, Action Scheduler queue in `kd_actionscheduler_actions`).
8. Social login status (Nextend plugin folder present but plugin not listed as active).
9. Scope of manual DB edits (the login/register/forgot Polylang post IDs: 7968, 7970, 10155).
10. Full user-role matrix (`kd_usermeta.wp_capabilities`) — the dump contains only 1 `INSERT INTO kd_users`; the full user list may be split across multiple inserts.
