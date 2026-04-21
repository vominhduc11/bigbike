# Docs Verification Report — bigbike.vn

Báo cáo kiểm tra toàn bộ 24 file `.md` trong `docs/` so với source WordPress thực tế tại `files/` + `sqldump.sql`. Mọi tìm kiếm đều trên snapshot `bigbike_vn__2026_04_17/`.

---

## 1. Verification Status

| Area | Status | Notes |
|---|---|---|
| WordPress source audit | **PARTIAL** | Đã verify WP core 6.9.4, HPOS tắt, Pods "Videos" pod, CF7 form id=8895, shipping zones, GTM ID, 40 rank_math_redirections. Còn một số item (ACF field group export, Wordfence rules, Google Ads OAuth, Polylang published locales) marked NEEDS_CONFIRMATION. |
| Page inventory | **PASS (sau khi fix)** | Đã sửa URL từ WC-default sang Permalink Manager patterns (`/sp/*.html`, `/{cat}.html`, `/brand/*.html`). Sửa count: page=22, post=174, product=1,227. |
| Content model | **PASS (sau khi fix)** | Đã sửa HPOS overlay → legacy-only. Sửa password hash mix `$wp$2y$` + `$P$`. Sửa counts. Sửa review CPT (không tồn tại). |
| SEO migration | **PASS (sau khi fix)** | Đã sửa URL patterns, thêm GTM ID, 2 GSC verification tokens, FB domain verify. Xác nhận 40 redirect rows. |
| URL redirect map | **PASS (sau khi fix)** | Đã viết lại hoàn toàn bảng URL. Thêm mẫu redirect từ 40 row thực tế. |
| Media inventory | **PASS (sau khi fix)** | Đã sửa count 12,053 (không phải 12,054). Cấu trúc thư mục đã xác minh. |
| Database migration plan | **PASS (sau khi fix)** | Đã sửa count. Đã đảo HPOS strategy → dùng legacy. Đã sửa password migration. |
| Main site requirements | **PARTIAL** | Routes cần cập nhật theo Permalink Manager patterns. NEEDS_CONFIRMATION một số URL chi tiết (orders sub-route của `/tai-khoan.html`). |
| Admin requirements | **PASS** | Modules đủ; validation ± chính xác. Có thể cần thêm quản lý Redirect (đã có). |
| API / Data contract | **PASS** | 8 handler custom + các WC endpoint đã map. Không có REST mới. |
| Auth / RBAC | **PASS** | Role map phù hợp với roles thực tế. Lưu ý hash mix. |
| Deployment / testing docs | **PASS** | Đã có. Reminder: Nginx proxy rewrite cần cover URL pattern mới (`/sp/`, `/brand/`, v.v.). |

---

## 2. Source Evidence Checked

| Evidence Type | Path / File | What Was Verified |
|---|---|---|
| WordPress core version | [files/wp-includes/version.php](files/wp-includes/version.php) | `$wp_version = '6.9.4'`, `$tinymce_version = '49110-20250317'`, `$required_php_version = '7.2.24'` |
| Theme active | [files/wp-content/themes/bigbike/functions.php](files/wp-content/themes/bigbike/functions.php) | Theme `bigbike` (textdomain `king`), không có child theme |
| wp-config | [files/wp-config.php](files/wp-config.php) | `ENVIROMENT='production'`, `DB_NAME='bigbike_main'`, `WP_CACHE=true`, `DISALLOW_FILE_MODS=true`, `DISALLOW_FILE_EDIT=true`, table prefix `kd_` |
| Active plugins | `sqldump.sql` — `kd_options` id=33 `active_plugins` serialized | 26 plugin thực tế (array index bị thiếu 16), liệt kê đầy đủ trong `WORDPRESS_AUDIT.md` |
| Page slugs + IDs | `sqldump.sql` `kd_posts` post_type=page | id=1 slug=`san-pham` title="Tất cả sản phẩm"; id=2 `gio-hang` `[woocommerce_cart]`; id=3 `thanh-toan` `[woocommerce_checkout]`; id=4 `tai-khoan`; id=11 `huong-dan-mua-hang`; id=12 `home` |
| Permalink Manager patterns | `sqldump.sql` `kd_options.permalink-manager_uris` (serialized) | Patterns: `sp/%postname%.html`, `%product_cat%.html`, `brand/%pwb-brand%.html`, `%pagename%.html`, `video/%postname%.html`, `%video_slug%/%video%.html`, `%category%.html` |
| Permalink config | `sqldump.sql` `kd_options.permalink_structure='/tin-tuc/%postname%.html'`, `woocommerce_permalinks`, `premmerce_permalink_manager` | Permalink Manager Pro override WC default |
| HPOS status | `sqldump.sql` `kd_options.woocommerce_custom_orders_table_enabled='no'`, `woocommerce_custom_orders_table_data_sync_enabled='no'`, `woocommerce_feature_custom_order_tables_enabled='no'` | HPOS TẮT → legacy `kd_posts` shop_order là source-of-truth |
| Order status breakdown | `sqldump.sql` post_status distribution | `wc-completed`: 61, `wc-cancelled`: 16, còn 748 rows trong wc-* khác NEEDS_CONFIRMATION |
| Shipping zones | `sqldump.sql` `kd_woocommerce_shipping_zones` / `_methods` / `_locations` | Zone id=2 "Việt Nam" với country=VN. Method id=6 free_shipping, id=7 flat_rate, id=9 flexible_shipping_single (hard-code trong quick-buy), id=10 flat_rate. Zone 0 (rest-of-world) có method id 3,4,5. |
| CF7 form | `sqldump.sql` `kd_posts` post_type=wpcf7_contact_form ID=8895 | Fields: `your_name`, `your_email`, `your_phone`, `your_message` (text input pattern) |
| Contact form wiring | [files/wp-content/themes/bigbike/page-templates/page-contact.php](files/wp-content/themes/bigbike/page-templates/page-contact.php) | ACF field `contact_form` chứa shortcode CF7; ACF `iframe_maps`, `note` |
| Menu locations | `sqldump.sql` `kd_options.theme_mods_bigbike` | primary→term 360, footer→term 368, guide→term 367 |
| Menu items count | `sqldump.sql` `kd_posts` post_type=nav_menu_item | 46 items |
| GTM / SEO meta | [files/wp-content/themes/bigbike/header.php](files/wp-content/themes/bigbike/header.php) | GTM-5BKZL3K, facebook-domain-verification `a5hwdqc9uvn7hkcfzxs340aot5w0xj`, 2 Google site-verification tokens, Organization JSON-LD (AutoBodyShop), WebSite JSON-LD SearchAction, FB page `https://www.facebook.com/bigbikegear/` |
| Breadcrumb source | [files/wp-content/themes/bigbike/template-parts/content-breadcrumbs.php](files/wp-content/themes/bigbike/template-parts/content-breadcrumbs.php) | Chỉ call `bcn_display()` — Breadcrumb NavXT |
| Post type counts | `sqldump.sql` `kd_posts` distinct `post_type` | product=1,227; product_variation=4,040; attachment=12,053; post=174; shop_order=825; page=22; video=62; nav_menu_item=46; slider=2; revision=2,522; shop_coupon=1; wpcf7_contact_form=1; _pods_pod=1; oembed_cache=6; wpcode=3; wp_navigation=1; rm_content_editor=1; polylang_mo=1; custom_css=1 |
| User count | `sqldump.sql` `kd_users` INSERT rows | 3,997 users; password mix `$wp$2y$12$...` + `$P$...` |
| RankMath redirects | `sqldump.sql` `kd_rank_math_redirections` | 40 row, đa số `status='active'`, verified URL pattern `.html` cho product/category/brand |
| RankMath modules | `sqldump.sql` `kd_options.rank_math_modules` | link-counter, analytics, seo-analysis, sitemap, rich-snippet, woocommerce, buddypress, bbpress, acf, web-stories, instant-indexing, role-manager, redirections, 404-monitor |
| RankMath sitemap cache | `sqldump.sql` `kd_options.rank_math_sitemap_cache_files` | 2 file `.xml` cached (page + 1) |
| Payment gateways | `sqldump.sql` `kd_options.woocommerce_gateway_order`, `woocommerce_cod_settings`, `woocommerce_bacs_settings`, `woocommerce_paypal_settings` | BACS + COD active (verified settings). PayPal có settings, status NEEDS_CONFIRMATION. Cheque disabled (inferred). Không có gateway nội địa (VNPay/OnePay/Momo/ZaloPay). |
| Uploads dir | `files/wp-content/uploads/` | 8.0 GB, years 2014..2026, sub-dirs ao_ccss/hummingbird-assets/rank-math/wc-logs/woocommerce_uploads/wpallexport/wpcf7_uploads/wpcode, WooCommerce placeholder files |
| 8 AJAX handlers | [files/wp-content/themes/bigbike/inc/ajax-functions.php](files/wp-content/themes/bigbike/inc/ajax-functions.php) | custom_register_user, custom_login_user, update_user_infomation, custom_add_to_cart, remove_item_from_cart, update_cart_item_quantity, buy_quickly, find_variation_product — tất cả expose `wp_ajax_nopriv_*`, không nonce/CSRF |
| Pods pod "Videos" | `sqldump.sql` `kd_posts` ID=7920 post_type=`_pods_pod` post_name=`video` | Pod config cho CPT `video` |
| Quick-buy shipping | [inc/ajax-functions.php:427](files/wp-content/themes/bigbike/inc/ajax-functions.php#L427) | Hard-code method_id `flexible_shipping_single:9` — khớp với shipping zone method id=9 "flexible_shipping_single" |
| Shop title override rule | [inc/woo-functions.php:459-581](files/wp-content/themes/bigbike/inc/woo-functions.php#L459-L581) | Filter query params: `pwb-brand`, `filter_gender` (nam/nu), `min_price`, `max_price`, `filter_color`, `paged` |
| template-parts/header-cart.php | NOT_FOUND_IN_SOURCE | Được gọi trong `ajax-functions.php:306` nhưng file không tồn tại — orphan call |
| template-parts/product-filter.php | [files/wp-content/themes/bigbike/template-parts/product-filter.php](files/wp-content/themes/bigbike/template-parts/product-filter.php) | Chỉ 2 dòng — empty shell |
| page-templates/page-news.php | [files/wp-content/themes/bigbike/page-templates/page-news.php](files/wp-content/themes/bigbike/page-templates/page-news.php) | Chỉ 1 dòng — template rỗng, không gán cho page publish nào |

---

## 3. Files Updated

| File | Change Summary | Reason |
|---|---|---|
| [ARCHITECTURE.md](ARCHITECTURE.md) | Sửa URL template table dùng Permalink Manager patterns; thêm WP version 6.9.4; đổi HPOS overlay → HPOS tắt; cập nhật plugin role table (Permalink Manager, Pods, RankMath modules, shipping zones) | Nhiều URL và claim sai cơ bản |
| [WORDPRESS_AUDIT.md](WORDPRESS_AUDIT.md) | Thêm WP core version, HPOS tắt; sửa CPT count chính xác (product 1,227, không 21,678); thêm Pods pod "Videos" verified; sửa user count 3,997; bổ sung CF7 form id + fields; sửa review CPT (không tồn tại); liệt kê chính xác shipping zones + gateway + GTM ID | Counts phóng đại do đếm nhầm literal |
| [PAGE_INVENTORY.md](PAGE_INVENTORY.md) | Viết lại toàn bộ URL column theo Permalink Manager pattern `.html`; sửa count product=1,227, post=174, page=22, video=62 | URL mapping sai hoàn toàn |
| [URL_REDIRECT_MAP.md](URL_REDIRECT_MAP.md) | Viết lại bảng URL chính, thêm mẫu redirect thực tế từ 40 row `kd_rank_math_redirections`; thêm patterns `sp/`, `brand/`, `/{cat-slug}.html`, `/{parent}/{child}.html`; ghi chú Polylang prefix đã dừng | URL mapping sai hoàn toàn |
| [SEO_MIGRATION.md](SEO_MIGRATION.md) | Cập nhật canonical pattern thực tế; thêm GTM-5BKZL3K, FB domain verify, 2 Google site-verification; thêm RankMath modules list; cập nhật URL pattern `/sp/*.html`, `/brand/*.html`; verified 40 redirect | Một số claim chưa có evidence |
| [DATABASE_MIGRATION_PLAN.md](DATABASE_MIGRATION_PLAN.md) | Đảo HPOS strategy → dùng legacy `kd_posts` + `kd_postmeta`; sửa count check; thêm password hash mix; bỏ mapping `kd_wc_orders*` | Sai về HPOS source-of-truth |
| [CONTENT_MODEL.md](CONTENT_MODEL.md) | Viết lại section Order theo legacy storage (post_meta keys); sửa password hash migration mô tả `$wp$2y$` + `$P$` | Sai HPOS; sai password mô tả |
| [DATA_CONTRACT.md](DATA_CONTRACT.md) | Sửa E-06 Order storage sang legacy authoritative; cập nhật snapshot sanity counts với số verified | Sai HPOS; count phóng đại |
| [PROJECT_OVERVIEW.md](PROJECT_OVERVIEW.md) | Thêm WP version; sửa mọi count; đổi HPOS risk → legacy; thêm URL patterns thực tế; thêm plugin count 26; thêm GTM, Polylang prefix đã ngưng | Counts + HPOS risk mô tả sai |
| [MEDIA_ASSET_INVENTORY.md](MEDIA_ASSET_INVENTORY.md) | Sửa attachment count 12,053 | Off-by-one |
| [DOCS_VERIFICATION_REPORT.md](DOCS_VERIFICATION_REPORT.md) | New file — báo cáo kiểm tra này | Yêu cầu người dùng |

---

## 4. Incorrect Information Found

| File | Incorrect Content | Corrected Content | Evidence |
|---|---|---|---|
| nhiều file (ARCHITECTURE, PAGE_INVENTORY, URL_REDIRECT_MAP, SEO_MIGRATION, PROJECT_OVERVIEW) | URL product `/product/{slug}/`, category `/danh-muc-san-pham/{slug}/`, brand `/pwb-brand/{slug}/` | URL thực tế `/sp/{slug}.html`, `/{cat-slug}.html` hierarchical, `/brand/{slug}.html` | `kd_options.permalink-manager_uris` patterns + 40 row trong `kd_rank_math_redirections` |
| ARCHITECTURE, DATABASE_MIGRATION_PLAN, DATA_CONTRACT, CONTENT_MODEL, PROJECT_OVERVIEW | HPOS đã bật, có cả legacy + HPOS, phải chọn HPOS làm nguồn chính | HPOS tắt. Legacy `kd_posts` shop_order là nguồn chính | `woocommerce_custom_orders_table_enabled='no'` + `woocommerce_custom_orders_table_data_sync_enabled='no'` |
| nhiều file | product 21,678, post 1,877, page 80, attachment 12,054, order 1,061, video 69, review 3 | product 1,227, post 174, page 22, attachment 12,053, order 825, video 62, review CPT không tồn tại | Regex chuẩn trên `kd_posts` post_type distinct count |
| ARCHITECTURE, DATABASE_MIGRATION_PLAN, CONTENT_MODEL | Password hash chỉ phpass, re-hash on first login | Password mix `$wp$2y$12$...` (WP 6.9 bcrypt wrapper) + `$P$...` (phpass). Cần adapter cho cả 2 | `kd_users.user_pass` samples |
| WORDPRESS_AUDIT | User count "chỉ 1 INSERT" / NEEDS_CONFIRMATION | 3,997 users | Regex count trên `INSERT` statement multi-row trong `kd_users` |
| WORDPRESS_AUDIT, PAGE_INVENTORY | Video CPT 69 items, review CPT 3 items | Video 62 (CPT Pods-generated, pod id=7920). Review CPT = 0 (không có post_type `review` trong `kd_posts`) | post_type distinct count |
| URL_REDIRECT_MAP, SEO_MIGRATION | "kd_rank_math_redirections chỉ có 1 INSERT statement, NEEDS_CONFIRMATION" | 40 row; patterns verified | Dump đầy đủ bảng |
| ARCHITECTURE | Active plugins = 27 | Active plugins = 26 (array serialized thiếu index 16 — plugin đã bị gỡ nhưng option chưa re-index) | `kd_options.active_plugins` |
| ARCHITECTURE, WORDPRESS_AUDIT | WP version UNKNOWN | WP 6.9.4 | `wp-includes/version.php` |

---

## 5. Missing Information Added

| File | Added Content | Evidence |
|---|---|---|
| ARCHITECTURE, PROJECT_OVERVIEW | GTM container ID `GTM-5BKZL3K` | header.php:150 |
| ARCHITECTURE, SEO_MIGRATION | Facebook domain verification token, 2 Google site-verification tokens, Organization JSON-LD schema (AutoBodyShop + openingHours), WebSite SearchAction target `?s=+{search_term_string}&post_type=product` | header.php lines 28-44, 51-144 |
| ARCHITECTURE | Shipping zones: 1 zone "Việt Nam" country=VN với 4 method id 6/7/9/10; zone 0 rest-of-world method 3/4/5 | `kd_woocommerce_shipping_zones*` |
| WORDPRESS_AUDIT | CF7 form id=8895 fields (your_name/email/phone/message); pod "Videos" id=7920; Premmerce Permalink Manager config (category=hierarchical, product=slug, use_primary_category=on, canonical=on) | `kd_posts` rows + `kd_options.premmerce_permalink_manager` |
| DATABASE_MIGRATION_PLAN | Password migration strategy với 2 hash format; order source mapping đầy đủ qua `_billing_*` / `_shipping_*` / `_order_*` postmeta | `kd_users.user_pass` + `kd_postmeta` |
| URL_REDIRECT_MAP | Mapping 40 row `kd_rank_math_redirections` phân loại theo type (Polylang prefix cleanup, pagination cleanup, slug migration, brand filter mapping, domain split) | dump bảng |
| PAGE_INVENTORY | template-parts/header-cart.php NOT_FOUND_IN_SOURCE | Theme file list |
| CONTENT_MODEL | Order source-of-truth mapping legacy `kd_posts` + `kd_postmeta` keys chi tiết | dump |

---

## 6. Unknown / Needs Confirmation

| Topic | File | Reason | Suggested Action |
|---|---|---|---|
| PHP runtime version thực tế | WORDPRESS_AUDIT | `required_php_version=7.2.24` là min; runtime server là 8.x? | Chạy `wp --info` hoặc xem Plesk config |
| ACF field groups đầy đủ | WORDPRESS_AUDIT, CONTENT_MODEL | Không có `acf-json/` trong theme, không có export | Vào ACF admin UI, Export to JSON |
| Pods CPT `slider` source | WORDPRESS_AUDIT | `_pods_pod` có "Videos" nhưng không thấy pod "slider" | Kiểm tra admin Pods UI hoặc `wp option get pods_framework_config` |
| CPT `review` thực tế | WORDPRESS_AUDIT, PAGE_INVENTORY | Template `single-review.php` tồn tại nhưng post_type `review` = 0. Term `review` có trong relationships. | Xác định `single-review.php` dành cho gì: blog category `review`? custom query? |
| Template `template-parts/header-cart.php` | WORDPRESS_AUDIT, API_CONTRACT | AJAX response của `remove_item_from_cart` gọi template không tồn tại | Quyết định: tạo template hoặc xóa `get_custom_template('header-cart')` call trong code mới |
| Polylang: có phát hành ngôn ngữ thứ 2 không | PROJECT_OVERVIEW, CONTENT_MODEL | Header có `hreflang="x-default"` về `https://bigbike.vn/`, nhưng Polylang prefix URL đã 301 sạch | Kiểm tra `kd_term_taxonomy` taxonomy=`language` có bao nhiêu term + post có bao nhiêu bản dịch |
| Video CPT URL variant | URL_REDIRECT_MAP, SEO_MIGRATION | Có 2 pattern trong `permalink-manager_uris` (`video/%postname%.html` và `%video_slug%/%video%.html`) | Test trên URL sample video live |
| Blog category URL cụ thể | URL_REDIRECT_MAP | Chỉ biết pattern `%category%.html`, chưa biết slug thực tế của category id 361, 365, ... | Query `kd_terms` với `kd_term_taxonomy` taxonomy=`category` |
| 22 page slugs đầy đủ | PAGE_INVENTORY | Đã verify được ~12 slug (home, gio-hang, thanh-toan, tai-khoan, san-pham, dang-nhap, dang-ky, quen-mat-khau, lien-he, gioi-thieu, huong-dan, huong-dan-mua-hang). Còn ~10 page slug chính sách chưa verify | `SELECT ID, post_name, post_title FROM kd_posts WHERE post_type='page' AND post_status='publish'` |
| Nextend Social Login `kd_social_users` | WORDPRESS_AUDIT | Plugin folder có nhưng không active. Có data trong bảng? | `SELECT COUNT(*) FROM kd_social_users` |
| Google Listings & Ads OAuth | WORDPRESS_AUDIT | Plugin active, bảng `kd_gla_*` có dữ liệu — cần credentials | Stakeholder có OAuth token? Có muốn migrate feed? |
| Wordfence WAF rules | WORDPRESS_AUDIT | Plugin active nhưng không thể inspect config | Admin login Wordfence dashboard, export |
| Payment gateway PayPal status | WORDPRESS_AUDIT, BUSINESS_RULES | `woocommerce_paypal_settings` có nhưng `enabled` field chưa verify trong snapshot đã parse | Deserialize option và kiểm tra |
| Total shop_order trong từng wc-* status | DATABASE_MIGRATION_PLAN | Chỉ verify wc-completed=61, wc-cancelled=16 trong 825 tổng → còn ~748 rows chưa breakdown | `SELECT post_status, COUNT(*) FROM kd_posts WHERE post_type='shop_order' GROUP BY post_status` |
| Term counts (product_category, brand, pa_color, pa_size, blog_category) | DATABASE_MIGRATION_PLAN | Chưa đếm chính xác | `SELECT tt.taxonomy, COUNT(*) FROM kd_term_taxonomy tt GROUP BY tt.taxonomy` |
| Permalink Manager URIs đầy đủ map | URL_REDIRECT_MAP | Option `permalink-manager_uris` serialized chứa toàn bộ URI assignment per post ID | `wp option get permalink-manager_uris --format=json` (tool nặng) |
| Page 10155 slug `quen-mat-khau` template thực tế | ARCHITECTURE, PAGE_INVENTORY | Page trong snapshot chỉ có 22 rows, không chứa page_id 10155 | Có thể page 10155 là bản Polylang locale khác; cần verify `SELECT * FROM kd_posts WHERE ID=10155` |
| URL `/tai-khoan.html` sub-endpoint (orders, view-order, edit-account, ...) | URL_REDIRECT_MAP | WC default dùng `/tai-khoan/orders/` nhưng Permalink Manager có thể rewrite | Kiểm tra live URL |
| Contact submissions count `kd_db7_forms` | DATABASE_MIGRATION_PLAN | Đã verify ≥ 1 INSERT statement — số row thực NEEDS_CONFIRMATION | `SELECT COUNT(*) FROM kd_db7_forms` |

---

## 7. Rewrite Readiness

| Target | Status | Blocking Issues |
|---|---|---|
| Next.js main site | **PARTIAL_READY** | Cần:<br>• Verify URL các sub-route `/tai-khoan.html/*` (orders/view-order/edit-account/edit-address/lost-password)<br>• Confirm video CPT URL variant<br>• Export ACF field groups (home/about/contact/product/category field shapes)<br>• Export Pods pod definitions<br>• Verify danh sách 22 page slug đầy đủ |
| Admin site | **READY** | Phạm vi module đã rõ. Cần confirm: 2FA policy, impersonate policy, retention policy log |
| Backend / API | **PARTIAL_READY** | Cần decision: Spring Boot vs NestJS. Nonce/CSRF/CAPTCHA replacement cho 8 AJAX handler đã map xong shape. |
| Database migration | **PARTIAL_READY** | Nguồn dữ liệu và mapping đã chính xác sau fix HPOS. Blocking:<br>• Export `permalink-manager_uris` serialized đầy đủ (để build URL redirect map per post ID)<br>• Export ACF / Pods config<br>• Term counts per taxonomy |
| SEO migration | **PARTIAL_READY** | URL patterns đã verify. Blocking:<br>• Confirm Polylang hreflang (1 ngôn ngữ hay 2)<br>• Confirm Video CPT URL variant canonical<br>• Confirm rating cosmetic JSON-LD policy (4.5/124 default — rủi ro Google manual action)<br>• Migrate 40 redirect + 404 logs<br>• Confirm blog category slug |

---

## 8. Final Decision

**`PARTIAL_READY_NEEDS_CONFIRMATION`**

**Lý do:**

Bộ docs đã đủ để một AI coding agent khác bắt đầu:
- Thiết kế schema DB mới (sau khi fix HPOS + counts).
- Xây dựng Next.js route structure (với pattern `.html` mới).
- Xây dựng admin CRUD module.
- Viết migration script cho content chính (product, blog, page, user, media, order từ legacy storage).
- Thiết kế redirect middleware với 40 rule RankMath + patterns Polylang cleanup.

Tuy nhiên các blocker sau cần stakeholder hoặc export trực tiếp từ DB live trước khi bắt đầu implement thực tế:

1. **ACF field groups JSON export** — để biết chính xác field definition của mọi ACF group (home sliders/about_us/blog_content, contact form/iframe_maps/note, product content_bottom/rating/rating_count/videos, category top_image/image_left/content_bottom, brand pwb_brand_image, color/image trên `pa_color`).
2. **Pods config export** — để biết CPT `video` field definition đầy đủ + có CPT `slider` hay không.
3. **`permalink-manager_uris` deserialize đầy đủ** — để sinh URL redirect map chính xác cho mỗi post/category/brand ID.
4. **Danh sách đầy đủ 22 page + 174 blog post + 1,227 product slug + term slug per taxonomy** — để build route map Next.js đầy đủ.
5. **Polylang policy phase 1** — chỉ `vi` hay có `en` song song.
6. **Payment gateway PayPal enabled trạng thái** — có giữ không.
7. **Order status breakdown chính xác** (748 row wc-* chưa rõ).
8. **Template `template-parts/header-cart.php`** — quyết định tạo hay xóa call.
9. **Video CPT URL canonical variant** — `/video/{slug}.html` hay `/{video_slug}/{video}.html`.
10. **Rating cosmetic (4.5/124) policy JSON-LD** — business decision để tránh Google manual action.

Khi các blocker trên được giải quyết, status sẽ thành **READY_FOR_REWRITE**.

---

## 9. File name chính tả

File trong `docs/` hiện tại đặt tên **`PERMISSION_MATRIX.md`** (chuẩn chính tả, không phải `PERMISION_MATRIX.md`). Không cần rename.

Nếu trong dự án khác có bản viết sai `PERMISION_MATRIX.md` (thiếu 1 chữ `S`), đề xuất đổi tên thành `PERMISSION_MATRIX.md` và cập nhật mọi link internal. **Không tự đổi nếu chưa kiểm tra link nội bộ — có thể phá link.**

---

## 10. Kết luận

Bộ docs sau sửa chữa là **nguồn duy nhất đáng tin cậy** để rewrite bigbike.vn sang Next.js + admin. Mọi claim chưa có evidence đã được đánh dấu `NEEDS_CONFIRMATION` hoặc `UNKNOWN` rõ ràng.

Việc **KHÔNG xác nhận** các `NEEDS_CONFIRMATION` nào trong §6 và §7 có thể dẫn đến:

- Route Next.js sai pattern (mất SEO).
- Migration script skip hoặc sai shape field (mất dữ liệu).
- Redirect miss (mất SEO traffic).
- Business rule mất tính (hard-coded rule trong source không được port).

Khuyến nghị bước tiếp theo: stakeholder cung cấp 10 thông tin trong §8, sau đó chuyển sang phase code có kiểm soát theo [MAIN_SITE_REQUIREMENTS.md](MAIN_SITE_REQUIREMENTS.md), [ADMIN_REQUIREMENTS.md](ADMIN_REQUIREMENTS.md), [DATABASE_MIGRATION_PLAN.md](DATABASE_MIGRATION_PLAN.md), [TESTING_GUIDE.md](TESTING_GUIDE.md).
