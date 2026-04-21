# WORDPRESS_AUDIT.md — bigbike.vn

Audit chi tiết WordPress hiện tại. Dùng làm nền để migrate sang Next.js + admin site.

Snapshot: `bigbike_vn__2026_04_17/` (archive ngày 2026-04-17T12:53:25+07:00). Path gốc server: `/var/www/vhosts/bigbike.vn/httpdocs`.

---

## 1. WordPress structure

| Thành phần | Giá trị |
|---|---|
| Bản WordPress | **6.9.4** (verified tại [files/wp-includes/version.php](files/wp-includes/version.php) — `$wp_version='6.9.4'`, `$tinymce_version='49110-20250317'`). |
| PHP required minimum | `$required_php_version='7.2.24'` (từ `version.php`). Runtime PHP thực tế trên server: NEEDS_CONFIRMATION. |
| HPOS | **Tắt** — `woocommerce_custom_orders_table_enabled='no'`, `woocommerce_feature_custom_order_tables_enabled='no'`, `woocommerce_custom_orders_table_data_sync_enabled='no'`. Order source-of-truth: legacy `kd_posts` + `kd_postmeta`. |
| MySQL | NEEDS_CONFIRMATION (`DB_CHARSET='utf8mb4'`, collation để trống → follow server default) |
| Table prefix | `kd_` — khác mặc định `wp_`. Mọi query custom trong theme không hard-code prefix (dùng `$wpdb->posts` v.v.) — an toàn. |
| `siteurl` / `home` | `https://bigbike.vn` |
| Timezone | `gmt_offset=7`, `timezone_string=''` → Asia/Ho_Chi_Minh hiệu dụng |
| `date_format` | `j F, Y` |
| `WPLANG` | `vi` |
| `blog_public` | `1` (cho phép index) |
| `users_can_register` | `0` (nhưng custom AJAX register vẫn tạo user — xem [BUSINESS_RULES.md#br-22](BUSINESS_RULES.md#br-22--wp-native-registration-is-disabled-ajax-register-is-the-only-path)) |
| `default_role` | `subscriber` |
| `WP_CACHE` | `true` |
| `DISALLOW_FILE_MODS` | `true` |
| `DISALLOW_FILE_EDIT` | `true` |
| `CONCATENATE_SCRIPTS` | `false` |
| `FS_METHOD` | `direct` |
| `ENVIROMENT` (const riêng của dự án) | `production` |
| Drop-ins | `wp-content/advanced-cache.php`, `wp-content/db.php`, `wp-content/object-cache.php` (NEEDS_CONFIRMATION: chủ sở hữu — khả năng W3 Total Cache) |
| Cache dirs residual | `wp-content/cache/`, `wp-content/w3tc-config/`, `wp-content/wp-rocket-config/`, `wp-content/wphb-cache/`, `wp-content/wphb-logs/` |
| Backups dir | `wp-content/backups-dup-pro/` (artifact từ Duplicator Pro) |
| Maintenance | `wp-content/maintenance/`, `wp-content/maintenance.php` present |

---

## 2. Theme

| Trường | Giá trị |
|---|---|
| Active theme | `bigbike` (cả `template` và `stylesheet` cùng `bigbike`) |
| Child theme | **Không có** — nhưng tên nội bộ là `king` (textdomain + code prefix) cho thấy theme base được fork từ template tên "king" |
| Assets build pipeline | Gulp (`gulpfile.js`, `package.json`, `package-lock.json`) — sinh `dist/*.min.{js,css}` |
| Sidecar libs | `plugin/fancybox`, `plugin/jquery`, `plugin/select2`, `plugin/swiper` — vendor libraries bundled vào theme |
| Backup file chưa dọn | `footer_bk.php`, `header_bk.php`, `content-product_bk.php`, `content-product_cat.php`, `related_bk.php`, `review-order.php.new` |

### 2.1 File theme quan trọng

| File | Vai trò |
|---|---|
| [functions.php](files/wp-content/themes/bigbike/functions.php) | Theme bootstrap, required `inc/*`. Hook SEO, checkout fields, search extend |
| [inc/layout-functions.php](files/wp-content/themes/bigbike/inc/layout-functions.php) | Enqueue assets per context; deregister WooCommerce core CSS/JS globally |
| [inc/woo-functions.php](files/wp-content/themes/bigbike/inc/woo-functions.php) | WooCommerce hooks, variation radio UI, SEO title/desc override, category walker |
| [inc/ajax-functions.php](files/wp-content/themes/bigbike/inc/ajax-functions.php) | **8 AJAX endpoint custom** — toàn bộ logic auth/cart/quickbuy |
| [inc/utils-functions.php](files/wp-content/themes/bigbike/inc/utils-functions.php) | Helpers: price, discount, pagination, lost_password shortcode, related products, lazy-load transform |
| [header.php](files/wp-content/themes/bigbike/header.php) | Schema.org JSON-LD tổ chức, GTM dataLayer, favicon, `obj_ajax.ajaxurl` |
| [footer.php](files/wp-content/themes/bigbike/footer.php) | Footer + GTM noscript (NEEDS_CONFIRMATION) |
| [page-templates/page-*.php](files/wp-content/themes/bigbike/page-templates/) | 11 template: home, cart, checkout, login, register, profile, contact, news, about, guide, static |
| [template-parts/](files/wp-content/themes/bigbike/template-parts/) | 15 partial: breadcrumbs, search, review, video, blog, product (featured/grid/swipe), `product-filter.php` (2 dòng — empty shell, NEEDS_CONFIRMATION), product-tech-spec, content-page |
| [woocommerce/](files/wp-content/themes/bigbike/woocommerce/) | Override nặng: archive-product, single-product, content-single-product, cart/cart.php, checkout/form-checkout.php, myaccount/*, single-product/add-to-cart/* |

### 2.2 Template part referenced nhưng không tìm thấy

| Referenced at | Expected file | Trạng thái |
|---|---|---|
| `get_custom_template('header-cart')` ở [ajax-functions.php:306](files/wp-content/themes/bigbike/inc/ajax-functions.php#L306) | `template-parts/header-cart.php` | **KHÔNG có trong snapshot** — NEEDS_CONFIRMATION |
| `get_custom_template('content-videos-product', ['product'])` | `template-parts/content-videos-product.php` | CÓ |
| `get_custom_template('content-thong-so-ki-thuat', ['product'])` | `template-parts/content-thong-so-ki-thuat.php` | CÓ |

---

## 3. Plugins

Tất cả 27 plugin trong `kd_options.active_plugins`:

| # | Plugin | Vai trò | Ảnh hưởng migration |
|---|---|---|---|
| 1 | polylang/polylang.php | i18n | Quan trọng: resolve post id theo ngôn ngữ; translation tables trong `kd_term_taxonomy` |
| 2 | add-html-to-pages/html-on-pages.php | Cho phép insert HTML vào page | Thường dùng cho embed tracker. NEEDS_CONFIRMATION vai trò thực tế |
| 3 | advanced-custom-fields-pro/acf.php | Custom fields | Rất quan trọng: hầu hết landing page và product detail dùng ACF fields (`content_bottom`, `sliders`, `about_us`, `blog_content`, `top_image`, `image_left`, `rating`, `rating_count`, `videos`, `contact_form`, `iframe_maps`, `note`) |
| 4 | auto-image-attributes-from-filename-with-bulk-updater/* | Auto alt từ filename | Không cần migrate (đã có rule alt=product title trong theme) |
| 5 | autoptimize/autoptimize.php | Minify HTML/CSS/JS | Không migrate |
| 6 | breadcrumb-navxt/breadcrumb-navxt.php | Breadcrumb | Template `template-parts/content-breadcrumbs.php` dùng — cần reimplement trong main-fe |
| 7 | classic-editor/classic-editor.php | Editor cổ điển | Không migrate (admin-fe tự xây editor) |
| 8 | classic-widgets/classic-widgets.php | Widget editor cổ điển | Không migrate |
| 9 | **contact-form-7/wp-contact-form-7.php** | CF7 | Chỉ có 1 contact form (`wpcf7_contact_form` count=1). Cần recreate form trong admin-fe. |
| 10 | **contact-form-cfdb7/contact-form-cfdb-7.php** | Lưu CF7 submissions | Bảng `kd_db7_forms` — cần migrate historical submissions (NEEDS_CONFIRMATION quy mô) |
| 11 | **devvn-woocommerce-price-filter** | Price range filter shop sidebar | Cần reimplement filter giá trong main-fe |
| 12 | disable-comments/disable-comments.php | Tắt comment | Không migrate (main-fe không có comment) |
| 13 | disable-feeds-wp/disable-feeds-wp.php | Tắt RSS | Không migrate |
| 14 | disable-xml-rpc-api/disable-xml-rpc-api.php | Tắt XML-RPC | Không migrate |
| 15 | **flexible-shipping/flexible-shipping.php** | Shipping methods | Quan trọng: method id `flexible_shipping_single:9` hard-code trong quick-buy. Export rule trước khi migrate |
| 16 | google-listings-and-ads/* | Merchant Center feed | NEEDS_CONFIRMATION OAuth + feed; có thể migrate hoặc bỏ |
| 17 | — (thiếu index 16 trong serialized, có thể plugin đã bị gỡ — NEEDS_CONFIRMATION) | | |
| 18 | **perfect-woocommerce-brands/perfect-woocommerce-brands.php** | Taxonomy `pwb-brand` | Phải migrate toàn bộ term + termmeta `pwb_brand_image` |
| 19 | **permalink-manager-pro/permalink-manager.php** | Custom permalink rules | Rule set chỉ có trong DB options — NEEDS_CONFIRMATION export |
| 20 | **pods/init.php** | Custom post types + relationships | `kd_podsrel` dùng; khả năng `slider`, `video`, `review` do Pods cấu hình (NEEDS_CONFIRMATION) |
| 21 | **seo-by-rank-math/rank-math.php** | SEO chính | Migrate SEO metadata + sitemap + redirect |
| 22 | simple-post-type-permalinks/simple-post-type-permalinks.php | Permalink cho CPT | Có thể đang drive `/tin-tuc/%postname%.html` cho post |
| 23 | tiny-compress-images/tiny-compress-images.php | Compress image | Không migrate |
| 24 | tinymce-advanced/tinymce-advanced.php | Editor nâng cao | Không migrate |
| 25 | w3-total-cache/w3-total-cache.php | Cache | Không migrate |
| 26 | **woo-product-variation-gallery/woo-product-variation-gallery.php** | Gallery theo variation | Theme đang deregister JS/CSS của plugin này trên shop/category — NEEDS_CONFIRMATION feature có còn dùng |
| 27 | **woocommerce/woocommerce.php** | Commerce | Toàn bộ commerce domain |
| 28 | wordfence/wordfence.php | Security/WAF | Không migrate |

Plugins có mặt trong `wp-content/plugins/` nhưng KHÔNG active: `nextend-facebook-connect` (social login button còn trong template `page-login.php`/`page-register.php`, nhưng plugin inactive).

### 3.1 Plugin ảnh hưởng SEO

| Plugin | Ghi chú |
|---|---|
| `seo-by-rank-math` | Engine chính — migrate `kd_rank_math_redirections`, `kd_rank_math_404_logs`, `kd_rank_math_internal_*`, postmeta `rank_math_*`, termmeta `rank_math_*` |
| Yoast (không active) | Postmeta/termmeta `_yoast_wpseo_*` vẫn có và vẫn được theme đọc. Migrate cả hai |
| `breadcrumb-navxt` | Breadcrumb (SEO schema) |
| `simple-post-type-permalinks` | Ảnh hưởng URL structure |
| `permalink-manager-pro` | Ảnh hưởng URL structure |

### 3.2 Plugin ảnh hưởng content / page builder

- **Không** có page builder (Elementor/WPBakery/Divi) — toàn bộ layout trang là template PHP + ACF fields.
- ACF là nguồn chính của custom content trên landing pages.
- Pods dùng cho CPT (slider, video, review — NEEDS_CONFIRMATION).
- `add-html-to-pages` cho phép gắn HTML vào page.

### 3.3 Plugin ảnh hưởng form / contact / ecommerce

- **Contact Form 7** + **CFDB7**: 1 form đang dùng (ACF field `contact_form` trên page Contact).
- **WooCommerce**: toàn bộ commerce.
- **Flexible Shipping**: shipping methods.
- **Perfect WooCommerce Brands**: taxonomy brand.
- **devvn-woocommerce-price-filter**: filter giá.
- **Woo Product Variation Gallery**: gallery biến thể.
- Không phát hiện plugin thanh toán cổng nội địa (VNPay, OnePay, Momo). Payment methods active: **BACS** (chuyển khoản) + **COD** (tiền mặt). Cheque disabled (NEEDS_CONFIRMATION). PayPal settings có nhưng status NEEDS_CONFIRMATION.

---

## 4. Custom Post Types (CPT)

Phát hiện qua `kd_posts.post_type` count **chính xác** (đếm kết thúc INSERT row `,'post_type','',0)`):

| post_type | Số lượng | Nguồn đăng ký | Template hiển thị |
|---|---|---|---|
| `product` | **1,227** | WooCommerce | `woocommerce/single-product.php`, archive |
| `product_variation` | **4,040** | WooCommerce | n/a (child post) |
| `attachment` | **12,053** | WordPress core | n/a (post_status đa số là `inherit`) |
| `post` | **174** | WordPress core | `single.php`, URL `/tin-tuc/{slug}.html` |
| `shop_order` | **825** | WooCommerce legacy (HPOS chưa bật) | admin only |
| `revision` | 2,522 | WordPress core | n/a, không migrate |
| `page` | **22** | WordPress core | `page.php` hoặc `page-templates/*` |
| `video` | **62** | Pods (pod "Videos" lưu tại `kd_posts._pods_pod` id=7920) | `single-video.php` |
| `nav_menu_item` | 46 | WordPress core | không render trực tiếp |
| `slider` | 2 | NEEDS_CONFIRMATION source (có thể Pods hoặc code khác không thấy trong theme) | Consumed trong page-home.php (fallback `WP_Query('slider')`). |
| `wpcf7_contact_form` | 1 | Contact Form 7 | n/a. Form id=8895, fields: `your_name`, `your_email`, `your_phone`, `your_message` (verified). |
| `shop_coupon` | 1 | WooCommerce | admin only |
| `oembed_cache` | 6 | WP core | cache |
| `wpcode` | 3 | WPCode plugin (NEEDS_CONFIRMATION có đang active) | snippet |
| `_pods_pod` | 1 | Pods config | pod definition "Videos" |
| `wp_navigation` | 1 | WP block theme (residual) | không dùng |
| `rm_content_editor` | 1 | RankMath content editor doc | internal |
| `polylang_mo` | 1 | Polylang translations blob | internal |
| `custom_css` | 1 | WP Customizer | theme_mods_bigbike referenced post_id 29751 |

**CPT `review` KHÔNG tồn tại** trong `kd_posts.post_type`. Template `single-review.php` có thể dành cho blog category có slug/name `review` (verified row trong `kd_term_relationships` có value `(569,'review',4986,3)`). NEEDS_CONFIRMATION mối liên hệ chính xác.

Pods "Videos" pod id=7920 đăng ký CPT `video`. CPT `slider` chưa xác định nguồn — NEEDS_CONFIRMATION có pod khác hay code custom.

Status counts (post_status `'closed','closed'`):
- `publish`: 4,679 rows (publish posts + products + pages + videos + nav_menu_item + shop_coupon)
- `inherit`: 11,730 (attachment phần lớn)
- `draft`: 696
- `wc-completed`: 61
- `wc-cancelled`: 16
- `auto-draft`: 3
- `private`: 2
- `pending`: 1
- Còn lại order trong status khác (`wc-processing`, `wc-on-hold`, v.v.) trong 825 - 61 - 16 = 748 rows, NEEDS_CONFIRMATION breakdown chính xác.

---

## 5. Custom Taxonomies

| Taxonomy | Nguồn | Dùng ở đâu |
|---|---|---|
| `category` | WordPress core | Blog |
| `post_tag` | WordPress core | Blog |
| `product_cat` | WooCommerce | Shop |
| `product_tag` | WooCommerce | Shop |
| `product_type` | WooCommerce | Internal (simple/variable) |
| `product_visibility` | WooCommerce | Flags (`featured`, `exclude-from-search`...) |
| `pa_color`, `pa_size`, các `pa_*` khác | WooCommerce attributes | Variation |
| `pwb-brand` | Perfect WooCommerce Brands | Home carousel, search, filter |
| `language`, `post_translations`, `term_translations`, `language_translation` | Polylang | i18n |

---

## 6. Custom fields / post meta quan trọng

Xem đầy đủ trong [DATA_CONTRACT.md](DATA_CONTRACT.md). Tóm tắt:

### Product (`kd_postmeta`)
- `_sku`, `_price`, `_regular_price`, `_sale_price`, `_stock_status`, `_manage_stock`, `_stock` — WC core
- `product_of_stock` (custom, int) — override stock UI
- `prouduct_of_stock` (custom, typo trong `simple.php:25`) — NEEDS_CONFIRMATION có dữ liệu hay không
- `salediscount` (custom, int percent override)
- `_yoast_wpseo_primary_product_cat` (Yoast cũ, vẫn dùng)
- `_yoast_wpseo_title`, `_yoast_wpseo_metadesc` (Yoast cũ)
- `rank_math_*` (RankMath)
- ACF: `content_bottom`, `rating`, `rating_count`, `videos`

### Product category (`kd_termmeta`)
- `thumbnail_id` (WC core), `ordering` (custom int), `show_on_homepage` (custom bool)
- `_yoast_wpseo_title`, `_yoast_wpseo_metadesc` (Yoast cũ)
- ACF: `top_image`, `image_left`, `content_bottom`

### `pwb-brand` term
- `pwb_brand_image` (ACF field trên term)

### `pa_color` term
- ACF `color` (hex/css), `image` (attachment)

### User (`kd_usermeta`)
- WP core: `wp_capabilities`, `session_tokens`, billing_* / shipping_*
- Custom: `phone`, `gender`, `dob`

### Page (Home) ACF
- `sliders` (repeater: image, image_mobile, product, link)
- `about_us` (repeater: sub_title, title, content)
- `blog_content` (repeater: sub_title, title, content)
- `content_bottom` (WYSIWYG)

### Page (Contact) ACF
- `contact_form` (text — CF7 shortcode)
- `iframe_maps` (text — Google Maps iframe HTML)
- `note` (text)

---

## 7. Shortcodes

### Do WordPress/WooCommerce/plugin cung cấp (được sử dụng trong page content)
- `[woocommerce_cart]` — page Cart (page_id=2)
- `[woocommerce_checkout]` — page Checkout (page_id=3)
- `[woocommerce_my_account]` — page My Account (page_id=4)
- Contact Form 7 shortcode (trong ACF field `contact_form` của page Contact)

### Do theme định nghĩa
- `[lost_password_form]` — đăng ký tại [utils-functions.php:441](files/wp-content/themes/bigbike/inc/utils-functions.php#L441) → render `woocommerce/myaccount/form-lost-password.php`

Không phát hiện shortcode khác tự định nghĩa trong theme.

---

## 8. Template PHP đặc biệt

| File | Ý nghĩa |
|---|---|
| [page-templates/page-home.php](files/wp-content/themes/bigbike/page-templates/page-home.php) | Home — 327 dòng, nhiều section dùng ACF |
| [page-templates/page-news.php](files/wp-content/themes/bigbike/page-templates/page-news.php) | Chỉ có 1 dòng — template rỗng (NEEDS_CONFIRMATION có được dùng không) |
| [template-parts/product-filter.php](files/wp-content/themes/bigbike/template-parts/product-filter.php) | Chỉ 2 dòng — empty shell, thực tế filter render ở đâu? NEEDS_CONFIRMATION |
| [woocommerce/content-single-product.php](files/wp-content/themes/bigbike/woocommerce/content-single-product.php) | Layout product detail — mobile/desktop branch |
| [woocommerce/archive-product.php](files/wp-content/themes/bigbike/woocommerce/archive-product.php) | Shop archive |
| [woocommerce/taxonomy-product_cat.php](files/wp-content/themes/bigbike/woocommerce/taxonomy-product_cat.php) | Product category |
| [woocommerce/taxonomy-pwb-brand.php](files/wp-content/themes/bigbike/woocommerce/taxonomy-pwb-brand.php) | Brand archive |

---

## 9. Hooks / actions / filters quan trọng trong `functions.php` và `inc/*.php`

Liệt kê theo filter/action được hook (thứ tự theo file):

### `functions.php`
- `after_setup_theme` → `king_setup` (menus, thumbnails, i18n)
- `after_setup_theme` → `king_content_width` priority 0
- `widgets_init` → `king_widgets_init`
- `wpseo_opengraph_image_size` → `set_custom_facebook_image_size`
- `wpcf7_autop_or_not` → `__return_false`
- `init` → `do_output_buffer` (ob_start)
- `woocommerce_checkout_fields` → `add_custom_class_to_checkout_field` (thêm `shipping_phone`)
- `wp_get_attachment_image_attributes` priority 20 → `change_attachement_image_attributes` (alt/title = product title)
- `get_post_metadata` → `get_alt_for_thumbs_flexslider` (virtual alt = post title)
- `woocommerce_single_product_image_thumbnail_html` → `add_class_to_thumbs`
- `posts_search` priority 999 → `woocommerce_search_product_tag_extended` (search mở rộng cat + brand)
- `template_redirect` → `no_products_found_redirect`
- `request` → append ` s` cho single-word search
- `wp` priority 999 → remove `gallery_template_override` callback (quan trọng)

### `inc/layout-functions.php`
- `wp_enqueue_scripts` → `bigbike_enqueue_page_template_styles` (asset chiến lược)
- `wp_enqueue_scripts` → `bigbike_disable_woocommerce_loading_css_js` (deregister WC core JS/CSS)
- `wpcf7_form_elements` → bỏ `<span class="wpcf7-form-control-wrap">` và `<br />`
- `init` → `pll_register_string` (17 strings)
- `the_content` priority 100 → `lenny_remove_div_class_woocommerce`
- `embed_oembed_discover` → `__return_false`
- `wp_head` → `mysite_header_additions` (canonical meta search)
- `wpseo_next_rel_link`, `wpseo_prev_rel_link` → `__return_false`
- `wp_print_styles` priority 100 → `my_deregister_styles`
- `post_thumbnail_html`, `image_send_to_editor` → `remove_width_attribute`
- Remove: `wp_head` generator/rsd/wlw/shortlink/feeds/emoji/rest/oembed

### `inc/woo-functions.php`
- `after_setup_theme` → `bigbike_woocommerce_setup` (`add_theme_support('woocommerce')`)
- `woocommerce_get_image_size_gallery_thumbnail` → size 150x150
- `woocommerce_output_related_products_args` → 4 columns
- `woocommerce_enqueue_styles` → `__return_false`
- `woocommerce_checkout_fields` → `custom_override_checkout_fields` (bỏ company/address_2/postcode/country/state)
- `woocommerce_checkout_process` → `phone_custom_checkout_field_process` (regex 10 digit)
- Remove/add: các `woocommerce_before_shop_loop_item_*`, `woocommerce_single_product_summary`, `woocommerce_product_thumbnails`, ...
- `woocommerce_shipping_calculator_enable_country/state/city` → `__return_false`
- `woocommerce_after_add_to_cart_form` → `add_quick_buy_form` (inject quick-buy modal)
- `woocommerce_currency_symbol` → `change_existing_currency_symbol` (VND = "đ")
- Custom `woocommerce_product_loop_start/_end`
- `woocommerce_before_variations_form` → `kdc_woocommerce_before_variations_form` (thông báo "Vui lòng chọn size/màu sắc")
- `loop_shop_per_page` → 24
- Custom action hooks (tự định nghĩa): `bigbike_single_product_title`, `bigbike_single_product_price`, `bigbike_single_product_thumbnail`, `bigbike_after_shop_loop_item_image_thumb`
- `woocommerce_share` → `bigbike_share_content`
- `woocommerce_dropdown_variation_attribute_options_html` → `variation_radio_buttons`
- `woocommerce_variation_is_active` → `variation_check`
- `woocommerce_product_tabs` → `bigbike_more_tab` (thêm Videos + Thông số kĩ thuật, bỏ additional_information)
- `woocommerce_available_variation` priority 99 → strip `availability_html`
- `woocommerce_product_categories_widget_args` → custom walker
- `wpseo_title` priority 100 → `custom_document_title`
- `woocommerce_page_title` → `custom_document_title_heading`
- `wpseo_metadesc` → `custom_document_description`
- `woocommerce_loop_add_to_cart_args` → `remove_rel`

### `inc/ajax-functions.php`
8 AJAX actions — đã audit đầy đủ trong [API_CONTRACT.md](API_CONTRACT.md).

### `inc/utils-functions.php`
- `bigbike_after_shop_loop_item_image_thumb` priority 10 → `show_percent_sale_discount`
- `woocommerce_cart_item_thumbnail` priority 10 → `custom_new_product_image`
- `woocommerce_customer_reset_password` → `woocommerce_new_pass_redirect`
- `the_content`, `get_the_content` priority 9999 → `add_data_src_to_content` (lazy load transform)
- `post_thumbnail_html`, `image_send_to_editor` priority 10 → `remove_wps_width_attribute`
- Shortcode `lost_password_form`

---

## 10. Business logic nằm trong WordPress

| Chức năng | Nơi code | Migrate về đâu |
|---|---|---|
| Register / Login custom AJAX | `inc/ajax-functions.php` | backend API + admin-fe auth |
| Update profile | `inc/ajax-functions.php` | backend API |
| Cart add/remove/update | `inc/ajax-functions.php` | backend API + main-fe |
| Quick Buy | `inc/ajax-functions.php` + `inc/woo-functions.php:add_quick_buy_form` | backend API (bắt buộc thêm CAPTCHA) |
| Variation lookup | `inc/ajax-functions.php` + `inc/utils-functions.php:bigbike_find_matching_product_variation` | backend API |
| SEO title/desc override cho shop/category | `inc/woo-functions.php` | main-fe metadata + data từ SEO engine mới |
| Related products theo Yoast primary cat | `inc/utils-functions.php:custom_related_products` | backend API |
| Shop title override theo filter query (brand/gender/color/price/paged) | `inc/woo-functions.php:bigbike_title_override` | main-fe |
| Breadcrumb | `template-parts/content-breadcrumbs.php` + Breadcrumb NavXT | main-fe |
| Variation radio UI với color swatch ACF | `inc/woo-functions.php:variation_radio_buttons` | main-fe component |
| Free shipping rule > 2M VND trong Quick Buy | `inc/ajax-functions.php:417-421` | backend API (business rule, config hóa) |
| Lazy-load transform | `inc/utils-functions.php:add_data_src_to_content` | main-fe `next/image` |
| Polylang per-language post id resolve (7968, 7970, 10155) | `page-login.php`, `page-register.php`, `utils-functions.php` | admin-fe config mapping |

---

## 11. Những phần chưa xác định (UNKNOWN / NEEDS_CONFIRMATION)

1. ~~WordPress core version~~ — **đã verify: 6.9.4**.
2. PHP version runtime (chỉ có required minimum 7.2.24, server thực tế chưa rõ).
3. ~~Permalink Manager rule set~~ — **đã verify patterns chính**: `sp/%postname%.html`, `%product_cat%.html`, `brand/%pwb-brand%.html`, `video/%postname%.html`, `%video_slug%/%video%.html`, `%pagename%.html`, `%category%.html`. Chi tiết từng row URI map cần export riêng.
4. ACF field groups export JSON — chưa có.
5. ~~Pods CPT configuration~~ — **đã verify pod "Videos" id=7920** trong `kd_posts._pods_pod`. `slider` pod chưa thấy — NEEDS_CONFIRMATION.
6. Template `template-parts/header-cart.php` (được theme gọi nhưng KHÔNG tồn tại trong snapshot theme). Confirmed NOT_FOUND_IN_SOURCE.
7. `template-parts/product-filter.php` chỉ 2 dòng — empty shell. Thực tế filter do `devvn-woocommerce-price-filter` widget + custom sidebar render. Cần verify nơi render thực.
8. `page-templates/page-news.php` chỉ 1 dòng — không gán cho page nào trong 22 page publish. Confirmed page template rỗng/chưa dùng.
9. ~~Active shipping zones + methods~~ — **đã verify**: 1 zone id=2 "Việt Nam" với location country=VN + 4 method id (free_shipping=6, flat_rate=7, flexible_shipping_single=9, flat_rate=10). Zone id=0 rest-of-world có methods id 3,4,5 default.
10. Wordfence WAF rules đang hoạt động ra sao trên `admin-ajax.php` — NEEDS_CONFIRMATION từ dashboard Wordfence.
11. Google Listings & Ads OAuth credentials — trong DB nhưng chưa đọc.
12. `kd_social_users` nội dung và số row — NEEDS_CONFIRMATION.
13. Bảng `kd_wcpdf_*` không có trong dump → không dùng invoice PDF.
14. ~~User count~~ — **đã verify: 3,997 rows trong `kd_users`**. Password hash mix: `$wp$2y$12$...` (WP 6.9 native bcrypt wrapper) + `$P$...` (phpass legacy). Migration cần support cả hai.
15. ~~Shipping zones~~ — đã verify (mục 9).
16. VNPay / OnePay / Momo / ZaloPay: **xác nhận không có**. Chỉ 3 gateway trong `woocommerce_gateway_order`: `bacs` + `cod` (enabled=yes, verified settings) + `paypal` (settings có nhưng status chưa verify). `cheque` cũng có trong gateway order but có thể disabled. Các plugin payment nội địa không active.
17. GTM ID: **GTM-5BKZL3K** (verified trong `header.php:150`).
18. Social: Facebook page chính thức `https://www.facebook.com/bigbikegear/` (verified `header.php:128`).
19. `rank_math_redirections`: 40 row active trong dump — xem `SEO_MIGRATION.md` và `URL_REDIRECT_MAP.md`.
20. Sitemap RankMath đã được cache (option `rank_math_sitemap_cache_files`) — file `.xml` lưu tại `wp-content/uploads/rank-math/`.
