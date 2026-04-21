# DATABASE_MIGRATION_PLAN.md — bigbike.vn

Kế hoạch migrate dữ liệu từ MySQL WordPress (`kd_` prefix) sang DB của hệ thống mới (PostgreSQL khuyến nghị — xem [TECH_STACK.md](TECH_STACK.md)).

---

## 1. Danh sách bảng WordPress liên quan

Trích từ `sqldump.sql`. Group theo mục đích:

### 1.1 WordPress core
- `kd_posts` — products, variations, posts, pages, attachments, nav_menu_item, shop_order (legacy), shop_coupon, CPT (slider, video, review), wpcf7_contact_form
- `kd_postmeta` — metadata cho tất cả post_type
- `kd_users`, `kd_usermeta`
- `kd_terms`, `kd_term_taxonomy`, `kd_term_relationships`, `kd_termmeta`
- `kd_options`
- `kd_comments`, `kd_commentmeta` — WooCommerce order_note dùng `comment_type='order_note'`
- `kd_links` — unused legacy

### 1.2 WooCommerce
- `kd_woocommerce_sessions` — cart sessions (**KHÔNG migrate** — ephemeral)
- `kd_woocommerce_order_items`, `kd_woocommerce_order_itemmeta` — line items
- `kd_woocommerce_shipping_zones`, `kd_woocommerce_shipping_zone_locations`, `kd_woocommerce_shipping_zone_methods`
- `kd_woocommerce_tax_rates`, `kd_woocommerce_tax_rate_locations`
- `kd_woocommerce_payment_tokens`, `kd_woocommerce_payment_tokenmeta`
- `kd_woocommerce_api_keys`
- `kd_woocommerce_attribute_taxonomies` — product attribute definitions
- `kd_woocommerce_downloadable_product_permissions`
- `kd_woocommerce_log` — WC logs (không cần migrate)

### 1.3 WooCommerce HPOS (High-Performance Order Storage)
- `kd_wc_orders` — **primary source-of-truth cho order** nếu HPOS enabled
- `kd_wc_orders_meta`
- `kd_wc_order_addresses` — billing + shipping rows per order
- `kd_wc_order_operational_data` — order_key, cart_hash, new_order_email_sent, ...
- `kd_wc_order_product_lookup`, `kd_wc_order_stats`, `kd_wc_order_tax_lookup`, `kd_wc_order_coupon_lookup` — analytics lookup
- `kd_wc_customer_lookup`
- `kd_wc_category_lookup`
- `kd_wc_product_attributes_lookup`, `kd_wc_product_meta_lookup`
- `kd_wc_product_download_directories`
- `kd_wc_rate_limits`
- `kd_wc_webhooks`
- `kd_wc_admin_note_actions`, `kd_wc_admin_notes`

### 1.4 WooCommerce Action Scheduler
- `kd_actionscheduler_actions`, `kd_actionscheduler_claims`, `kd_actionscheduler_groups`, `kd_actionscheduler_logs`

### 1.5 SEO
- `kd_rank_math_404_logs`
- `kd_rank_math_analytics_gsc`
- `kd_rank_math_analytics_keyword_manager`
- `kd_rank_math_analytics_objects`
- `kd_rank_math_internal_links`, `kd_rank_math_internal_meta`
- `kd_rank_math_redirections`, `kd_rank_math_redirections_cache`
- `kd_yoast_indexable`, `kd_yoast_indexable_hierarchy`, `kd_yoast_migrations`, `kd_yoast_primary_term`, `kd_yoast_prominent_words`, `kd_yoast_seo_links`, `kd_yoast_seo_meta`

### 1.6 Plugin data
- `kd_db7_forms` — CF7 form submissions
- `kd_fg_redirect` — FG plugin redirect (Magento importer)
- `kd_gla_*` — Google Listings & Ads
- `kd_pmxe_*` — WP All Export
- `kd_podsrel` — Pods relationships
- `kd_social_users` — Nextend Social Login
- `kd_duplicator_*` — Duplicator Pro backup metadata (**SKIP**)
- `kd_ewwwio_images`, `kd_ewwwio_queue` — EWWW image optim (**SKIP**)
- `kd_wpr_rocket_cache`, `kd_wpr_rucss_used_css` — WP Rocket cache (**SKIP**)
- `kd_wf*` (kd_wfsecurityevents, kd_wfpendingissues, kd_wftrafficrates, kd_wfsnipcache, kd_wfreversecache, kd_wfwaffailures, kd_wfstatus) — Wordfence logs (**SKIP**, có thể export riêng để audit)

---

## 2. Mapping bảng cũ → entity mới

| WordPress Table | Old Data | New Table / Entity | Migration Rule | Notes |
|---|---|---|---|---|
| `kd_posts` (post_type=product) | **1,227** publish (verified; tổng có cả draft ~ lớn hơn) | `product` | 1 row per `kd_posts.ID` | — |
| `kd_posts` (post_type=product_variation) | 4,040 | `product_variation` | 1:1 | Link qua `post_parent` → product.id |
| `kd_posts` (post_type=page) | **22** | `page` | 1:1 | `_wp_page_template` → `template_key` |
| `kd_posts` (post_type=post) | **174** | `blog_post` | 1:1 | |
| `kd_posts` (post_type=attachment) | **12,053** | `media` | 1:1 | Xem [MEDIA_ASSET_INVENTORY.md](MEDIA_ASSET_INVENTORY.md) |
| `kd_posts` (post_type=nav_menu_item) | 46 | `menu_item` | 1:1 | Dùng meta `_menu_item_*` để resolve target |
| `kd_posts` (post_type=shop_order) | **825** | `order` | **Legacy là source-of-truth** (HPOS chưa bật) | `kd_wc_orders` rỗng hoặc stale — không migrate từ bảng đó |
| `kd_posts` (post_type=shop_coupon) | 1 | `coupon` | 1:1 | |
| `kd_posts` (post_type=slider) | 2 | integrate vào home ACF `sliders` | Không entity riêng | |
| `kd_posts` (post_type=video) | **62** | `video` | 1:1 | Pods pod "Videos" id=7920; field shape NEEDS_CONFIRMATION |
| `kd_posts` (post_type=review) | **0** | n/a | Không migrate | CPT không tồn tại; nội dung review có thể nằm trong `post` với category `review` |
| `kd_posts` (post_type=wpcf7_contact_form) | 1 (id=8895) | `contact_form` | 1:1 | Form fields verified: `your_name`, `your_email`, `your_phone`, `your_message` |
| `kd_posts` (post_type=revision) | 2,522 | n/a | **SKIP** | WP revision không cần migrate |
| `kd_posts` (post_type=_pods_pod) | 1 (Pods config) | n/a | **SKIP** | Chỉ để đăng ký CPT, không phải dữ liệu end-user |
| `kd_posts` (post_type=oembed_cache, custom_css, polylang_mo, wp_navigation, rm_content_editor, wpcode) | cache/metadata nội bộ | n/a | **SKIP** | |
| `kd_users` | **3,997** | `user` | 1:1 | Password mix `$wp$2y$12$...` (WP 6.9 bcrypt wrapper) + `$P$...` (phpass legacy). Cần adapter support cả 2. |
| `kd_postmeta` | — | split per target entity | Mapping cụ thể xem [CONTENT_MODEL.md](CONTENT_MODEL.md) | |
| `kd_users` | — | `user` | 1:1 | Password: phpass string → `password_hash` column; re-hash on first login |
| `kd_usermeta` | — | `user_profile` + `address` | Split | |
| `kd_terms` + `kd_term_taxonomy` (product_cat) | — | `product_category` | 1:1 | |
| `kd_terms` + `kd_term_taxonomy` (category) | — | `blog_category` | 1:1 | |
| `kd_terms` + `kd_term_taxonomy` (pwb-brand) | — | `brand` | 1:1 | |
| `kd_terms` + `kd_term_taxonomy` (pa_*) | — | `attribute` + `attribute_value` | 1 `attribute` per taxonomy, N `attribute_value` | |
| `kd_terms` + `kd_term_taxonomy` (post_tag) | — | `blog_tag` | 1:1 | |
| `kd_terms` + `kd_term_taxonomy` (product_tag) | — | `product_tag` | 1:1 | |
| `kd_term_relationships` | — | mapping M:N | 1 row per relationship | |
| `kd_termmeta` | — | split per target entity | | |
| `kd_options` | — | `site_setting` (key/value JSONB) | Chỉ migrate key cần thiết (permalinks, site info, currency, payment gateway, shipping) | |
| `kd_wc_orders` | — | n/a | **KHÔNG migrate từ đây** — HPOS tắt, bảng stale | `woocommerce_custom_orders_table_enabled='no'` |
| `kd_wc_orders_meta` | — | n/a | **KHÔNG migrate** | |
| `kd_wc_order_addresses` | — | n/a | **KHÔNG migrate** | Dữ liệu thật nằm trong `kd_postmeta` keys `_billing_*` / `_shipping_*` |
| `kd_wc_order_operational_data` | — | n/a | **KHÔNG migrate** | order_key nằm trong `kd_postmeta._order_key` |
| `kd_postmeta` (keys `_order_key`, `_billing_*`, `_shipping_*`, `_order_total`, `_payment_method`, `_payment_method_title`, `_customer_user`, v.v.) | — | `order` + `order_address` | **Primary source** | |
| `kd_woocommerce_order_items` | — | `order_line_item` / `order_shipping_item` / `order_fee_item` / `order_coupon_applied` | Split theo `order_item_type` | |
| `kd_woocommerce_order_itemmeta` | — | merge vào line item metadata | Key-value | |
| `kd_woocommerce_shipping_zones` + ..._methods + ..._locations | — | `shipping_zone`, `shipping_method`, `shipping_zone_location` | | |
| `kd_woocommerce_tax_rates` | — | skip nếu `calc_taxes=no` | Hiện tại tax=no | |
| `kd_woocommerce_payment_tokens` | — | `payment_token` | NEEDS_CONFIRMATION có dùng không | |
| `kd_woocommerce_attribute_taxonomies` | — | `attribute` (thêm info bổ sung: label, order_by) | Merge với `pa_*` terms | |
| `kd_comments` (comment_type=order_note) | — | `order_note` | | |
| `kd_commentmeta` | — | `order_note.metadata` JSONB | | |
| `kd_rank_math_redirections` | — | `redirect` | | |
| `kd_rank_math_*` SEO postmeta/termmeta | — | `*_seo` relation per entity | Ưu tiên |
| `kd_yoast_*` SEO postmeta/termmeta | — | fallback merge vào `*_seo` | |
| `kd_db7_forms` | — | `contact_submission` | Deserialize `form_value` |
| `kd_social_users` | — | `user.linked_socials` JSONB | Nếu cần giữ liên kết Nextend (hiện plugin tắt) |
| `kd_podsrel` | — | Integrate tùy theo Pods CPT | NEEDS_CONFIRMATION |
| Action Scheduler tables | — | Nếu backend mới dùng queue khác (Sidekiq, BullMQ, Spring Batch) → **SKIP** migrate | Chỉ migrate job pending nếu có |

---

## 3. Mapping post_type → entity

| post_type | Entity mới | post_status mapping |
|---|---|---|
| `post` | `blog_post` | publish→`published`, draft→`draft`, pending→`pending`, private→`private`, trash→`trash`, future→`scheduled` |
| `page` | `page` | tương tự |
| `product` | `product` | tương tự (nhưng `outofstock` ≠ status — nằm ở stock_status) |
| `product_variation` | `product_variation` | theo parent product |
| `attachment` | `media` | publish→`active`, inherit→`active` |
| `nav_menu_item` | `menu_item` | publish→`active` |
| `shop_order` | `order` | Xem [STATE_MACHINES.md#sm-04](STATE_MACHINES.md#sm-04--woocommerce-order-status-global-wc-enum); post_status `wc-*` → enum order status |
| `shop_coupon` | `coupon` | |
| `slider` | (merge vào home ACF) | |
| `video` | `video` | |
| `review` | `review` | |
| `wpcf7_contact_form` | `contact_form` | |

---

## 4. Mapping taxonomy

| Taxonomy | Entity mới |
|---|---|
| `category` | `blog_category` |
| `post_tag` | `blog_tag` |
| `product_cat` | `product_category` |
| `product_tag` | `product_tag` |
| `product_type` | enum on `product.type` (`simple`, `variable`, `external`, `grouped`) |
| `product_visibility` | boolean flags on `product` (`is_featured`, `hide_from_catalog`, `hide_from_search`, `outofstock` — map cuối sang stock_status) |
| `pwb-brand` | `brand` |
| `pa_*` | `attribute` + `attribute_value` |
| `language`, `post_translations`, `term_translations` | Polylang: convert sang `locale` + `translation_group_id` (xem [CONTENT_MODEL.md#9-polylang-translation](CONTENT_MODEL.md#9-polylang-translation)) |
| `nav_menu` | `menu` |

---

## 5. Mapping post meta quan trọng

Full bảng trong [CONTENT_MODEL.md](CONTENT_MODEL.md). Các key đặc biệt:

| meta_key | Entity đích | Field | Xử lý |
|---|---|---|---|
| `_sku` | product | `sku` | trim, generate synthetic `BB-{legacy_id}` nếu rỗng |
| `_price`, `_regular_price`, `_sale_price` | product | `price`, `regular_price`, `sale_price` | cast decimal |
| `_stock_status` | product | `stock_status` | enum |
| `_stock` | product | `stock_quantity` | cast int, NULL nếu không manage |
| `_manage_stock` | product | `manage_stock` | `'yes'`→true |
| `_product_image_gallery` | product | `gallery_media_ids` | split `,` → array |
| `_thumbnail_id` | any | `featured_image_id` | FK |
| `_product_attributes` | product | — | deserialize PHP → resolve `attribute_id` + `attribute_value_id` per attribute |
| `attribute_pa_color`, `attribute_pa_size`, … | product_variation | `attribute_values` JSONB | map slug→attribute_value |
| `product_of_stock` (custom) | product | `force_out_of_stock` | `'1'`→true |
| `salediscount` (custom) | product | `discount_percent_override` | cast int |
| `_yoast_wpseo_primary_product_cat` | product | `primary_category_id` | FK resolve |
| `_yoast_wpseo_title` / `rank_math_title` | product_seo | `meta_title` | RankMath ưu tiên |
| `_yoast_wpseo_metadesc` / `rank_math_description` | product_seo | `meta_description` | |
| `billing_phone`, `billing_first_name`, ... | user_profile + address | split | |
| `phone` (custom), `gender`, `dob` | user_profile | | |
| `wp_capabilities` / `kd_capabilities` (serialized array of roles) | user | `roles[]` | map sang role mới (xem [AUTH_RBAC.md](AUTH_RBAC.md)) |
| `_menu_item_*` | menu_item | title, url, target_type, target_id, parent_id | |

---

## 6. Data cleaning rules

### 6.1 Encoding
- Tất cả text assume UTF-8. `DB_CHARSET=utf8mb4` → OK. Đảm bảo import vào PostgreSQL `UTF8`.

### 6.2 Datetime
- WP dùng `post_date` (local time theo `gmt_offset=7`) + `post_date_gmt`. Migrate dùng `post_date_gmt` làm source, cast sang `timestamptz`.

### 6.3 Serialized PHP arrays trong postmeta
- Dùng lib như `php-serialize` (Node) / Jackson custom (Java) / `phpserialize` (Python).
- Các key serialize hay gặp: `_product_attributes`, `_wp_attachment_metadata`, `_wpcf7_*`, ACF repeater.

### 6.4 HTML trong `post_content`
Rule cleaning:
1. Trim khoảng trắng đầu cuối.
2. Strip `<script>` không thuộc allowlist (GTM emit từ template, không nằm trong content).
3. Strip `<style>` inline — giữ nếu cần format legacy, discard ở phase 2.
4. Loại bỏ `<div class="woocommerce">` wrapper (theme đã làm runtime).
5. Rewrite inline image src → absolute URL trên storage mới (nếu chọn Option B trong [MEDIA_ASSET_INVENTORY.md](MEDIA_ASSET_INVENTORY.md)).
6. Remove empty `<p></p>` liên tiếp.
7. Normalize self-closing tag (`<br>`, `<hr>`, `<img>`).
8. Sanitize với allowlist (bleach / DOMPurify-server / jsoup) trước khi lưu `content_html`.

### 6.5 Slug normalization
Xem [CONTENT_MODEL.md#7-slug-normalisation](CONTENT_MODEL.md#7-slug-normalisation).

### 6.6 Duplicate handling

| Trường hợp | Xử lý |
|---|---|
| Product SKU trùng | Keep row mới nhất, rename các row cũ thành `{sku}-dup-{legacy_id}` |
| Product slug trùng (sau slug normalize) | Append `-{legacy_id}` |
| User email trùng (không nên xảy ra nhưng import legacy có thể) | Keep user đầu tiên, flag duplicate |
| Category slug trùng giữa `product_cat` và `category` | Prefix entity type trong URL (đã khác nhau) |
| Attachment file_path trùng | Dedupe: keep legacy_id nhỏ nhất, các row khác → soft delete |

### 6.7 Missing data

| Thiếu | Hành động |
|---|---|
| Product không có variation nhưng `_product_attributes` có `is_variation=1` | Set product type `simple`, bỏ attribute |
| Variation không có ít nhất 1 `attribute_*` meta | Skip variation, log |
| Order không có `billing_email` và `customer_id` NULL | Giữ, flag `incomplete_address=true` |
| Media không có file trên disk | Giữ DB row, flag `missing_file=true` để audit sau |
| Page `template_key` không support | Fallback `page-static` |

---

## 7. Migration steps

### Phase 0 — Preparation
1. Confirm HPOS là source-of-truth cho order. Kiểm tra `kd_options.woocommerce_custom_orders_table_enabled` và đồng bộ `kd_wc_orders` vs legacy `kd_posts.shop_order`.
2. Rotate DB password + WP auth salts trên môi trường nhận file `wp-config.php` (an toàn).
3. Snapshot DB + uploads lần cuối trước khi lock content.
4. Export RankMath settings + ACF field groups + Pods config + Permalink Manager rules → JSON.

### Phase 1 — Schema setup
1. Tạo schema PostgreSQL mới theo [CONTENT_MODEL.md](CONTENT_MODEL.md).
2. Thêm column `legacy_id` mọi entity để tracking.
3. Thêm index trên `legacy_id`, `slug`, `sku`, `email`, `file_path`.

### Phase 2 — Reference data
1. Migrate `options` (chỉ key cần) → `site_setting`.
2. Migrate `attribute_taxonomies` + `pa_*` terms → `attribute` + `attribute_value`.
3. Migrate `product_cat` → `product_category`.
4. Migrate `pwb-brand` → `brand`.
5. Migrate `category` / `post_tag` / `product_tag`.

### Phase 3 — Users
1. Migrate `kd_users` → `user` (phpass hash giữ nguyên).
2. Migrate `kd_usermeta` → `user_profile` + `address`.
3. Map WP role → new role (xem [AUTH_RBAC.md](AUTH_RBAC.md)).
4. Flag synthetic user (login match `<phone>@liveevil.vn`) với `is_synthetic=true`.

### Phase 4 — Media
1. Migrate `kd_posts` attachment → `media`.
2. Audit filesystem vs DB.
3. Setup reverse proxy (Option A) hoặc sync to S3 (Option B).

### Phase 5 — Content
1. Migrate `page` → `page`.
2. Migrate `blog_post` → `blog_post` + resolve categories/tags.
3. Migrate `video`, `review`, `coupon`, `contact_form`.
4. Migrate SEO metadata (RankMath preferred + Yoast fallback merge).
5. Re-link `featured_image_id`, `gallery_media_ids` theo Media mới.

### Phase 6 — Products
1. Migrate `product` (21,678 rows).
2. Migrate `product_variation` (4,040 rows) và link parent.
3. Link product ↔ category, product ↔ brand, product ↔ tag.
4. Resolve `_product_attributes` serialized → attribute link table.
5. Migrate SEO.

### Phase 7 — Menu
1. Migrate `nav_menu` → `menu` + `menu_item` (resolve target entity refs).
2. Assign location theo theme: primary / footer / guide.

### Phase 8 — Orders
1. Migrate `kd_wc_orders` → `order`.
2. Merge `kd_wc_orders_meta`, `kd_wc_order_operational_data` vào order.
3. Migrate `kd_wc_order_addresses` → `order_address`.
4. Migrate `kd_woocommerce_order_items` + `kd_woocommerce_order_itemmeta` → line/shipping/fee/coupon items.
5. Migrate `kd_comments` (comment_type=order_note) → `order_note`.

### Phase 9 — SEO / Redirect
1. Migrate `kd_rank_math_redirections` → `redirect`.
2. Migrate sitemap config (chỉ để tham chiếu — Next.js tự build).

### Phase 10 — Validation
Xem §9.

### Phase 11 — Cutover
1. Lock WordPress admin (không cho edit content mới).
2. Run final delta sync (chỉ items updated_at > last sync).
3. Switch DNS.

---

## 8. Cách chạy

Công cụ đề xuất:
- **Node.js/TypeScript** với `mysql2` + `pg` + `@types/*`. Script được chia nhỏ theo phase.
- Alternative: **Python** với `sqlalchemy` + `phpserialize`.
- Alternative: **Java** với Spring Batch + `mysql-connector-j` + `org.postgresql`.

Cấu trúc script đề xuất:

```
migration/
├── config/
│   ├── source.ts       (mysql connection)
│   └── target.ts       (postgres connection)
├── lib/
│   ├── php-unserialize.ts
│   ├── slug.ts
│   ├── sanitize.ts
│   └── logger.ts
├── phase-01-options.ts
├── phase-02-taxonomy.ts
├── phase-03-users.ts
├── phase-04-media.ts
├── phase-05-content.ts
├── phase-06-products.ts
├── phase-07-menu.ts
├── phase-08-orders.ts
├── phase-09-seo-redirects.ts
├── validate.ts
└── index.ts            (orchestrator)
```

Mỗi phase idempotent — chạy lại nhiều lần cho kết quả giống nhau (UPSERT by `legacy_id`). Log lỗi sang `migration/logs/YYYY-MM-DD.log`.

---

## 9. Validation steps

### 9.1 Count check
So sánh COUNT theo entity. Số verified từ dump qua regex `,'post_type','',0)`:

| Entity | Expected (verified) | Điều kiện |
|---|---|---|
| product (all status) | 1,227 publish + draft (lớn hơn 1,227 chút, NEEDS_CONFIRMATION tổng) | ± 0 |
| product_variation | 4,040 | ± 0 |
| blog_post (post, all status) | 174 | ± 0 |
| page | 22 | ± 0 |
| attachment | 12,053 | ± 0 |
| user | 3,997 | ± 0 |
| order (shop_order, all wc-* status) | 825 | ± 0 |
| video (CPT) | 62 | ± 0 |
| slider (CPT) | 2 | ± 0 |
| shop_coupon | 1 | 0 |
| nav_menu_item | 46 | 0 |
| wpcf7_contact_form | 1 (id=8895) | 0 |
| product_category terms | NEEDS_CONFIRMATION | |
| brand terms | NEEDS_CONFIRMATION | |
| blog_category terms | NEEDS_CONFIRMATION | |
| pa_color, pa_size terms | NEEDS_CONFIRMATION | |
| rank_math_redirections (active) | 40 tổng (mix active/inactive) | ± 0 |

### 9.2 Integrity check
- Mọi `product.featured_image_id` → `media.id` tồn tại.
- Mọi `order.customer_id` (nếu không NULL) → `user.id` tồn tại.
- Mọi `order_line_item.product_id` → `product.id` tồn tại (hoặc soft-missing với log).
- Tất cả `slug` unique.
- Tất cả `email` user unique.

### 9.3 Spot check
- 100 product ngẫu nhiên: so sánh price/stock/SKU/category/thumbnail.
- 50 post ngẫu nhiên: so sánh title/content/featured image.
- 20 order ngẫu nhiên: total amount + line items match.
- 10 menu item: target URL render đúng.

### 9.4 SEO check
- Random 50 product: `meta_title` và `meta_description` không rỗng (hoặc rỗng nhất quán với source).
- Tất cả redirect active: test HTTP với target URL.

### 9.5 Cross-link check
- Variation `product_id` đúng.
- Menu item target_id trỏ entity đúng.
- Featured image id ↔ media.

---

## 10. Rollback plan

| Mốc | Hành động rollback |
|---|---|
| Trước cutover DNS | DB mới giữ song song, không ảnh hưởng production |
| Sau cutover DNS (trong 24h) | Revert DNS về WordPress origin. DB mới đóng băng. |
| Sau cutover (> 24h, content mới đã publish trên admin-fe) | Export delta từ DB mới → import ngược về WordPress (tốn công). Khuyến nghị: không rollback sau 24h; thay vào đó fix forward |

Snapshot trước cutover:
1. `mysqldump --single-transaction --quick -u bigbike_admin -p bigbike_main > backup-pre-cutover.sql`
2. `rsync -a wp-content/uploads/ backup-uploads-pre-cutover/`
3. Export `kd_options.active_plugins` + `kd_usermeta` roles (để rebuild nếu cần).

---

## 11. Rủi ro DB migration

| # | Rủi ro | Mitigation |
|---|---|---|
| DB1 | ACF serialized arrays parse sai | Test parser trên 100 sample ACF row trước khi chạy full |
| DB2 | Variation attribute meta `attribute_pa_*` key dynamic theo taxonomy | Build map `pa_*` → attribute ở Phase 2; validate không có orphan key |
| DB3 | HPOS ↔ legacy order tables không đồng bộ | Force sync trước khi migrate; chọn HPOS làm primary |
| DB4 | Polylang translation group cross-entity | Phase 1 chỉ migrate `vi`; phase 2 migrate translations |
| DB5 | User password hash phpass không tương thích với nhiều lib mới | Giữ nguyên; re-hash on first login; có sẵn lib `phpass` ports |
| DB6 | `kd_options` có >20,000 rows — nhiều rác | Chỉ allowlist key cần migrate |
| DB7 | Content HTML referensce URL tuyệt đối `https://bigbike.vn/wp-content/uploads/*` | Phase 1 giữ path; phase 2 có script re-write |
| DB8 | Comment order_note có metadata dạng `_order_note_type` | Giữ `type` trong `order_note` mới |
| DB9 | Unicode NFC vs NFD trong tên file | Normalize tất cả sang NFC |
| DB10 | Thời gian import full ~ vài giờ trên 8GB media + 20k product | Phase theo batch 1000 rows, chạy trong maintenance window |
