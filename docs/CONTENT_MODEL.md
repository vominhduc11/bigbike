# CONTENT_MODEL.md — bigbike.vn

Mapping content + dữ liệu từ WordPress hiện tại sang data model mới cho backend + main-fe + admin-fe.

Mục tiêu: cung cấp schema đầy đủ, có thể implement trên PostgreSQL (hoặc MySQL) thẳng. Ưu tiên 3NF cho dữ liệu cấu trúc, JSONB cho block content và metadata mở rộng.

Nguồn tham chiếu: [DATA_CONTRACT.md](DATA_CONTRACT.md), [WORDPRESS_AUDIT.md](WORDPRESS_AUDIT.md).

---

## 1. Nguyên tắc mapping

1. Giữ **stable id** WordPress như một field `legacy_id` trên mọi entity để redirect / debug.
2. `post_status` WordPress (publish/draft/pending/private/trash) → field `status` enum trong entity mới.
3. `post_name` (slug) WordPress → field `slug` trong entity mới, **unique per entity type + per locale**.
4. `post_date` / `post_modified` → `created_at` / `updated_at`.
5. Content HTML từ `post_content` → lưu nguyên bản ở `content_html`; thêm `content_blocks` (JSONB) cho cấu trúc block nếu parse được (phase 2).
6. ACF fields có tên riêng biệt → columns dedicated nếu được tái sử dụng thường xuyên, còn lại gộp vào `metadata` JSONB.
7. Tất cả media reference đổi từ `attachment_id` → `media_id` (FK).
8. Taxonomies mapping 1-1: `product_cat → ProductCategory`, `pwb-brand → Brand`, `pa_color → Color`, `pa_size → Size`, `category → BlogCategory`, `post_tag → BlogTag`, `product_tag → ProductTag`.

---

## 2. Entity mới đề xuất

```
Entity overview
  User
  ├── UserRole (PERMISSION_MATRIX.md, AUTH_RBAC.md)
  ├── UserProfile (phone/dob/gender)
  └── Address (billing/shipping)

  Product
  ├── ProductVariation
  ├── ProductCategory
  ├── ProductTag
  ├── Brand
  ├── Attribute + AttributeValue (Color, Size, ...)
  ├── ProductImage (Media ref)
  ├── ProductSEO
  └── ProductReview (nếu bật; hiện tắt)

  Order
  ├── OrderLineItem
  ├── OrderShippingItem
  ├── OrderFeeItem
  ├── OrderAddress (billing/shipping)
  ├── OrderPayment
  ├── OrderStatusHistory
  └── OrderNote

  BlogPost
  ├── BlogCategory
  ├── BlogTag
  └── BlogPostSEO

  Page (CMS-style)
  └── PageSEO

  Media (attachment)

  Menu
  └── MenuItem

  Coupon

  Video (CPT)
  Review (CPT — NEEDS_CONFIRMATION)
  Slider (section data cho home page)

  Redirect
  ContactSubmission
```

---

## 3. Mapping chi tiết

### 3.1 Product

| Old Source | Old Field/Meta Key | New Entity | New Field | Type | Required | Note |
|---|---|---|---|---|---|---|
| `kd_posts` | ID | Product | legacy_id | int | Yes | For URL redirect + audit |
| `kd_posts` | post_title | Product | name | varchar(255) | Yes | |
| `kd_posts` | post_name | Product | slug | varchar(255) unique | Yes | Giữ slug cũ cho SEO |
| `kd_posts` | post_status | Product | status | enum(`publish`,`draft`,`pending`,`private`,`trash`) | Yes | Default `publish` |
| `kd_posts` | post_content | Product | description_html | text | No | Long description |
| `kd_posts` | post_excerpt | Product | short_description | text | No | |
| `kd_posts` | post_date | Product | created_at | timestamptz | Yes | |
| `kd_posts` | post_modified | Product | updated_at | timestamptz | Yes | |
| `kd_postmeta` | `_sku` | Product | sku | varchar(64) unique | Yes | |
| `kd_postmeta` | `_regular_price` | Product | regular_price | decimal(15,2) | No | VND, num_decimals=0 |
| `kd_postmeta` | `_sale_price` | Product | sale_price | decimal(15,2) | No | |
| `kd_postmeta` | `_price` | derived | — | — | — | Computed from above |
| `kd_postmeta` | `_stock_status` | Product | stock_status | enum(`instock`,`outofstock`,`onbackorder`) | Yes | |
| `kd_postmeta` | `_manage_stock` | Product | manage_stock | bool | Yes | |
| `kd_postmeta` | `_stock` | Product | stock_quantity | int | No | |
| `kd_postmeta` | `_backorders` | Product | backorders | enum(`no`,`notify`,`yes`) | Yes | |
| `kd_postmeta` | `_weight`/`_length`/`_width`/`_height` | Product | weight, length, width, height | decimal(10,3) | No | |
| `kd_postmeta` | `_downloadable` | Product | is_downloadable | bool | Yes | false default |
| `kd_postmeta` | `_virtual` | Product | is_virtual | bool | Yes | false default |
| `kd_postmeta` | `_product_attributes` | ProductAttributeLink | — | FK graph | — | De-serialize |
| `kd_postmeta` | `_thumbnail_id` | Product | featured_image_id | FK Media | No | |
| `kd_postmeta` | `_product_image_gallery` | ProductImage | (FK list) | FK Media array | No | |
| `kd_postmeta` | `product_of_stock` (custom) | Product | force_out_of_stock | bool | No | Giữ flag theme; deprecate dần |
| `kd_postmeta` | `prouduct_of_stock` (typo `simple.php:25`) | — | — | — | — | IGNORE (typo — xem BR-06) |
| `kd_postmeta` | `salediscount` (custom) | Product | discount_percent_override | int | No | Percent override |
| `kd_postmeta` | `_yoast_wpseo_primary_product_cat` | Product | primary_category_id | FK ProductCategory | No | Yoast legacy — migrate |
| `kd_postmeta` | `_yoast_wpseo_title` | ProductSEO | meta_title | varchar(255) | No | |
| `kd_postmeta` | `_yoast_wpseo_metadesc` | ProductSEO | meta_description | varchar(500) | No | |
| `kd_postmeta` | `rank_math_title` | ProductSEO | meta_title | varchar(255) | No | RankMath winner |
| `kd_postmeta` | `rank_math_description` | ProductSEO | meta_description | varchar(500) | No | |
| `kd_postmeta` | `rank_math_focus_keyword` | ProductSEO | focus_keyword | varchar(255) | No | |
| ACF | `content_bottom` | Product | content_bottom_html | text | No | |
| ACF | `rating` | Product | rating_display | decimal(2,1) | No | Cosmetic, default 4.5 |
| ACF | `rating_count` | Product | rating_count_display | int | No | Cosmetic, default 124 |
| ACF | `videos` | Product | videos (JSONB list) | JSONB | No | NEEDS_CONFIRMATION field shape |
| `kd_term_relationships` taxonomy=product_cat | term_id(s) | Product ↔ ProductCategory | M:N | — | — | |
| `kd_term_relationships` taxonomy=pwb-brand | term_id(s) | Product ↔ Brand | M:N | — | — | |
| `kd_term_relationships` taxonomy=product_tag | term_id(s) | Product ↔ ProductTag | M:N | — | — | |
| `kd_term_relationships` taxonomy=product_visibility | `featured`, `exclude-from-search`, `exclude-from-catalog`, `outofstock` | Product | is_featured, hide_from_search, hide_from_catalog | bool flags | — | Split theo term |

### 3.2 ProductVariation

| Old Source | Old Field/Meta Key | New Entity | New Field | Type | Required | Note |
|---|---|---|---|---|---|---|
| `kd_posts` post_type=product_variation | ID | ProductVariation | legacy_id | int | Yes | |
| `kd_posts` post_parent | → Product | product_id | FK | Yes | |
| `kd_postmeta` `attribute_pa_color` | ProductVariation | attribute_values | JSONB `{color: "do", size: "l"}` | Yes | Ít nhất 1 attr |
| `kd_postmeta` `_price` etc | same as Product | | | | |
| `kd_postmeta` `_stock_status`, `_stock` | same as Product | | | | |
| `kd_postmeta` `_thumbnail_id` | ProductVariation | image_id | FK Media | No | |
| Derived | — | sku | varchar | No | Variation SKU optional |

### 3.3 ProductCategory

| Old Source | Field | New Field | Type | Required | Note |
|---|---|---|---|---|---|
| `kd_terms` + `kd_term_taxonomy` (taxonomy='product_cat') | term_id | legacy_id | int | Yes | |
| | name | name | varchar(255) | Yes | |
| | slug | slug | varchar(255) unique | Yes | URL `/danh-muc-san-pham/{slug}/` |
| `kd_term_taxonomy.parent` | parent_term_id | parent_id | FK self | No | |
| `kd_term_taxonomy.description` | description | description_html | text | No | |
| `kd_termmeta.thumbnail_id` | WC core | image_id | FK Media | No | |
| `kd_termmeta.ordering` | custom | sort_order | int | No | Default 0 |
| `kd_termmeta.show_on_homepage` | custom | show_on_homepage | bool | Yes | Default false |
| `kd_termmeta._yoast_wpseo_title` | Yoast legacy | seo.meta_title | varchar(255) | No | |
| `kd_termmeta._yoast_wpseo_metadesc` | Yoast legacy | seo.meta_description | varchar(500) | No | |
| ACF top_image | ACF | top_image_id | FK Media | No | |
| ACF image_left | ACF | top_product_image_id | FK Media | No | |
| ACF content_bottom | ACF | content_bottom_html | text | No | |

### 3.4 Brand (pwb-brand)

| Old Source | Field | New Field | Type | Required | Note |
|---|---|---|---|---|---|
| `kd_terms` + taxonomy=pwb-brand | term_id | legacy_id | int | Yes | |
| | name, slug, description | name, slug, description_html | | Yes/No | |
| `kd_termmeta.pwb_brand_image` (ACF) | attachment id | logo_id | FK Media | No | |

### 3.5 Attribute + AttributeValue

Thay cho `pa_*` taxonomies + `_product_attributes`.

| Entity | Fields |
|---|---|
| Attribute | id, code (`pa_color`→`color`), name, kind (`select`, `color`, `numeric`), is_variation, legacy_attribute_taxonomy_id |
| AttributeValue | id, attribute_id, slug, label, legacy_term_id, extras JSONB (color hex, swatch_image_id) |

Đặc biệt cho `pa_color`: AttributeValue có `color_hex` + `swatch_image_id` (lấy từ ACF `color`, `image` trên term).

### 3.6 Media

| Old Source | Old Field | New Entity | New Field | Type | Required | Note |
|---|---|---|---|---|---|---|
| `kd_posts` post_type=attachment | ID | Media | legacy_id | int | Yes | |
| | post_title | Media | title | varchar(255) | No | |
| | post_name | Media | slug | varchar(255) | No | Not SEO-critical |
| | post_mime_type | Media | mime_type | varchar(64) | Yes | |
| `kd_postmeta._wp_attached_file` | | file_path | varchar(500) | Yes | Giữ `YYYY/MM/filename.ext` |
| `kd_postmeta._wp_attachment_metadata` | serialized | sizes (JSONB), width, height, filesize | JSONB + int | — | |
| `kd_postmeta._wp_attachment_image_alt` | | alt_text | varchar(500) | No | NB theme override nếu attachment thuộc product |
| `kd_postmeta._wp_attachment_backup_sizes` | | — | — | — | Không migrate |
| derived | — | | original_url | varchar(500) | Yes | `/wp-content/uploads/<file_path>` hoặc CDN URL mới |

### 3.7 Page (CMS)

| Old Source | Field | New Entity | New Field | Type | Required | Note |
|---|---|---|---|---|---|---|
| `kd_posts` post_type=page | ID | Page | legacy_id | int | Yes | |
| | post_title | title | varchar(255) | Yes | |
| | post_name | slug | varchar(255) unique | Yes | |
| | post_content | content_html | text | No | |
| | post_status | status | enum | Yes | |
| | post_parent | parent_id | FK self | No | |
| `kd_postmeta._wp_page_template` | | template_key | varchar(255) | No | Giữ để map component (home, about, guide, contact, login, register, profile, news, cart, checkout, static) |
| ACF fields theo template | | extra JSONB | JSONB | No | `sliders`, `about_us`, `blog_content`, `contact_form`, `iframe_maps`, `note`, `content_bottom` |
| Rank Math postmeta | | seo (relation) | | No | |
| Polylang translations | | translation_group_id | uuid | No | Group các bản dịch |

### 3.8 BlogPost

| Old Source | Field | New Entity | New Field | Type | Required | Note |
|---|---|---|---|---|---|---|
| `kd_posts` post_type=post | ID | BlogPost | legacy_id | int | Yes | |
| | post_title | title | varchar(255) | Yes | |
| | post_name | slug | varchar(255) unique | Yes | URL `/tin-tuc/{slug}.html` |
| | post_content | content_html | text | Yes | |
| | post_excerpt | excerpt | text | No | |
| | post_status | status | enum | Yes | |
| | post_date | published_at | timestamptz | Yes | |
| | post_modified | updated_at | timestamptz | Yes | |
| | post_author | author_id | FK User | Yes | |
| `kd_postmeta._thumbnail_id` | | featured_image_id | FK Media | No | |
| `kd_term_relationships` taxonomy=category | | categories | M:N BlogCategory | — | |
| `kd_term_relationships` taxonomy=post_tag | | tags | M:N BlogTag | — | |
| Rank Math / Yoast postmeta | | seo (relation) | | No | |

### 3.9 User + UserProfile + Address

| Old Source | Field | New Entity | New Field | Type | Required | Note |
|---|---|---|---|---|---|---|
| `kd_users` | ID | User | legacy_id | int | Yes | |
| | user_login | User | login | varchar(60) unique | Yes | Với user tạo qua API-01: phone là login |
| | user_email | User | email | varchar(100) | Yes | |
| | user_pass | User | password_hash | varchar(255) | Yes | **Hash mix**: `$wp$2y$12$...` (WP 6.9+ bcrypt wrapper — verify với `password_verify` sau khi strip `$wp$` prefix) HOẶC `$P$...` (phpass legacy — verify với phpass lib). Cả 2 format cần adapter. Re-hash sang argon2id sau lần login đầu. |
| | user_registered | User | created_at | timestamptz | Yes | |
| | display_name | User | display_name | varchar(255) | No | |
| `kd_usermeta.first_name` | | UserProfile | first_name | varchar(255) | No | |
| `kd_usermeta.last_name` | | UserProfile | last_name | varchar(255) | No | |
| `kd_usermeta.phone` (custom) | | UserProfile | phone | varchar(20) | No | 10 digits theo BR-01 |
| `kd_usermeta.gender` (custom) | | UserProfile | gender | enum(`male`,`female`,`other`) | No | |
| `kd_usermeta.dob` (custom) | | UserProfile | date_of_birth | date | No | |
| `kd_usermeta.wp_capabilities` (`kd_capabilities`) | | UserRole | roles | varchar[] | Yes | Map sang role mới (xem AUTH_RBAC.md) |
| `kd_usermeta.billing_*` | | Address | billing (row) | — | No | |
| `kd_usermeta.shipping_*` | | Address | shipping (row) | — | No | |
| Synthetic (Quick Buy) | login=`<phone>@liveevil.vn` | User | is_synthetic | bool | Yes | Set true nếu login match pattern + không có thông tin xác thực; không cho login cho đến khi claim |

### 3.10 Order (LEGACY is source-of-truth)

**HPOS chưa bật** (`woocommerce_custom_orders_table_enabled='no'`). Nguồn chính: `kd_posts` (post_type='shop_order') + `kd_postmeta`. Không migrate từ `kd_wc_orders*`.

| Old Source | Field | New Entity | New Field | Type | Required | Note |
|---|---|---|---|---|---|---|
| `kd_posts` (shop_order) | ID | Order | legacy_id | int | Yes | |
| | post_status | Order | status | enum (`wc-pending`, `wc-processing`, `wc-on-hold`, `wc-completed`, `wc-cancelled`, `wc-refunded`, `wc-failed`) — strip `wc-` prefix | Yes | |
| | post_date_gmt | Order | created_at | timestamptz | Yes | |
| | post_modified_gmt | Order | updated_at | timestamptz | Yes | |
| | post_author | Order | customer_id | FK User | No | 0 = guest |
| | post_excerpt | Order | customer_note | text | No | |
| `kd_postmeta._order_key` | — | Order | order_key | varchar(255) unique | Yes | Dùng cho URL `?key=` |
| `kd_postmeta._order_total` | — | Order | total_amount | decimal(15,2) | Yes | |
| `kd_postmeta._order_currency` | — | Order | currency | char(3) | Yes | VND |
| `kd_postmeta._order_shipping` | — | Order | shipping_total | decimal(15,2) | Yes | |
| `kd_postmeta._cart_discount` | — | Order | discount_total | decimal(15,2) | Yes | |
| `kd_postmeta._customer_user` | — | Order | customer_id | FK User | No | Có thể duplicate với post_author |
| `kd_postmeta._billing_email` | — | Order | billing_email | varchar(255) | No | |
| `kd_postmeta._payment_method` | — | Order | payment_method | varchar(50) | Yes | `bacs`, `cod`, `paypal`... |
| `kd_postmeta._payment_method_title` | — | Order | payment_method_title | varchar(255) | Yes | |
| `kd_postmeta._transaction_id` | — | Order | transaction_id | varchar(255) | No | |
| `kd_postmeta._customer_ip_address` | — | Order | ip_address | varchar(45) | No | |
| `kd_postmeta._customer_user_agent` | — | Order | user_agent | varchar(500) | No | |
| `kd_postmeta._billing_first_name/_last_name/_address_1/_address_2/_city/_state/_postcode/_country/_phone/_email/_company` | — | OrderAddress (billing) | name/address/phone | | | |
| `kd_postmeta._shipping_first_name/_last_name/_address_1/_address_2/_city/_state/_postcode/_country/_phone` | — | OrderAddress (shipping) | name/address/phone | | | |
| `kd_woocommerce_order_items` order_item_type=line_item | | OrderLineItem | rows | | | product_id, variation_id, name, quantity, subtotal, total — qua `kd_woocommerce_order_itemmeta` |
| `kd_woocommerce_order_items` order_item_type=shipping | | OrderShippingItem | rows | | | method_id (`flexible_shipping_single:9`), title, cost |
| `kd_woocommerce_order_items` order_item_type=fee | | OrderFeeItem | rows | | | |
| `kd_woocommerce_order_items` order_item_type=coupon | | OrderCouponApplied | rows | | | |
| `kd_comments` `comment_type=order_note` | | OrderNote | rows | | | Audit trail |

### 3.11 Menu + MenuItem

| Old Source | Field | New Entity | New Field | Type | Required | Note |
|---|---|---|---|---|---|---|
| `kd_term_taxonomy` taxonomy=nav_menu | term_id | Menu | legacy_id | int | Yes | |
| | name | Menu | name | varchar(255) | Yes | |
| Theme location | `king_setup` | Menu | location | enum(`primary`,`footer`,`guide`) | Yes | |
| `kd_posts` post_type=nav_menu_item | ID | MenuItem | legacy_id | int | Yes | |
| `kd_postmeta._menu_item_title` | — | title | varchar(255) | Yes | |
| `kd_postmeta._menu_item_url` | — | url | varchar(500) | No | |
| `kd_postmeta._menu_item_object` | post/page/product_cat/... | target_type | varchar(50) | Yes | |
| `kd_postmeta._menu_item_object_id` | FK | target_id | int | No | |
| `kd_postmeta._menu_item_menu_item_parent` | parent menu item | parent_id | FK self | No | |
| `menu_order` | sort | sort_order | int | Yes | |

### 3.12 Coupon

| Old | Field | New | Type |
|---|---|---|---|
| `kd_posts` post_type=shop_coupon | ID | Coupon.legacy_id | int |
| post_title | code | varchar |
| `kd_postmeta.discount_type` | type | enum(`percent`,`fixed_cart`,`fixed_product`) |
| `kd_postmeta.coupon_amount` | amount | decimal |
| `kd_postmeta.date_expires` | expires_at | timestamptz |
| `kd_postmeta.usage_limit` | usage_limit | int |
| `kd_postmeta.usage_count` | usage_count | int |
| `kd_postmeta.minimum_amount` | min_order_amount | decimal |
| `kd_postmeta.product_ids` | applies_to_products | int[] |
| `kd_postmeta.excluded_product_ids` | excluded_products | int[] |
| `kd_postmeta.product_categories` | applies_to_categories | int[] |

Hiện có 1 coupon trong dump. NEEDS_CONFIRMATION nội dung.

### 3.13 ContactSubmission (CF7 → CFDB7)

| Old Source | Field | New Field | Type | Note |
|---|---|---|---|---|
| `kd_db7_forms` | form_id | legacy_form_id | int | |
| | form_date | submitted_at | timestamptz | |
| | form_value | payload | JSONB | Deserialize |

Hiện chỉ có 1 form CF7. NEEDS_CONFIRMATION số lượng submissions.

### 3.14 Redirect

| Old Source | Field | New Field | Type | Note |
|---|---|---|---|---|
| `kd_rank_math_redirections` | sources (serialized array of URLs/patterns) | match_patterns | JSONB | |
| | url_to | target_url | varchar(500) | |
| | header_code | status_code | int (301/302/307/410) | |
| | hits | — | int | Analytics, optional |
| | status | status | enum(`active`,`inactive`) | |

Hiện count=1 INSERT statement — NEEDS_CONFIRMATION số redirect thực tế.

### 3.15 Slider / Video / Review (CPTs)

NEEDS_CONFIRMATION nguồn đăng ký (Pods?). Đề xuất:

- **Slider**: coi là section data của Home, không cần entity riêng. Gộp vào ACF repeater `sliders` (đã có trên page_id=12).
- **Video**: entity `Video { id, legacy_id, title, slug, description_html, youtube_id, thumbnail_id, product_id (FK optional), published_at }`.
- **Review**: entity `Review { id, legacy_id, title, slug, content_html, rating, author_name, product_id (FK optional), image_id, published_at }`.

### 3.16 SEO metadata (relation 1:1 per content entity)

```
PageSEO     (page_id FK, meta_title, meta_description, focus_keyword, canonical_url, og_image_id, og_title, og_description, twitter_card, robots_noindex, robots_nofollow, jsonld_override)
ProductSEO  (product_id FK, ...)
BlogPostSEO (post_id FK, ...)
CategorySEO (category_id FK, ...)
BrandSEO    (brand_id FK, ...)
```

Migration source: ưu tiên `rank_math_*` > fallback `_yoast_wpseo_*` > derive from name.

---

## 4. Tổng hợp mapping đơn giản (rút gọn)

| Old Source | Old Field/Meta Key | New Entity | New Field | Type | Required | Note |
|---|---|---|---|---|---|---|
| `kd_posts` (product) | ID, post_title, post_name, post_content, post_excerpt, post_status, post_date, post_modified | Product | legacy_id, name, slug, description_html, short_description, status, created_at, updated_at | | Yes | |
| `kd_postmeta` | `_sku`, `_regular_price`, `_sale_price`, `_stock_status`, `_manage_stock`, `_stock`, `_thumbnail_id`, `_product_image_gallery` | Product | sku, regular_price, sale_price, stock_status, manage_stock, stock_quantity, featured_image_id, gallery_media_ids | | Mixed | |
| `kd_postmeta` (custom) | `product_of_stock`, `salediscount`, `_yoast_wpseo_primary_product_cat` | Product | force_out_of_stock, discount_percent_override, primary_category_id | | No | |
| `kd_postmeta` (ACF product) | `rating`, `rating_count`, `videos`, `content_bottom` | Product | rating_display, rating_count_display, videos(JSONB), content_bottom_html | | No | |
| `kd_posts` (page) | ID, post_title, post_name, post_content, post_status, post_parent | Page | legacy_id, title, slug, content_html, status, parent_id | | Yes | |
| `kd_postmeta._wp_page_template` | | Page | template_key | varchar | No | |
| `kd_posts` (post) | ID, post_title, post_name, post_content, post_excerpt, post_date, post_author | BlogPost | legacy_id, title, slug, content_html, excerpt, published_at, author_id | | Yes | |
| `kd_posts` (attachment) | ID, post_title, post_mime_type | Media | legacy_id, title, mime_type | | Yes | |
| `kd_postmeta` (attachment) | `_wp_attached_file`, `_wp_attachment_metadata`, `_wp_attachment_image_alt` | Media | file_path, sizes(JSONB), alt_text | | Mixed | |
| `kd_posts` (nav_menu_item) + meta | | MenuItem | legacy_id, title, url, target_type, target_id, parent_id, sort_order | | | |
| `kd_terms` + `kd_term_taxonomy` (product_cat) | | ProductCategory | legacy_id, name, slug, parent_id, description_html | | Yes | |
| `kd_terms` + `kd_term_taxonomy` (pwb-brand) | | Brand | legacy_id, name, slug, description_html, logo_id | | Yes | |
| `kd_terms` + `kd_term_taxonomy` (category) | | BlogCategory | legacy_id, name, slug | | Yes | |
| `kd_terms` + `kd_term_taxonomy` (post_tag / product_tag) | | BlogTag / ProductTag | legacy_id, name, slug | | Yes | |
| `kd_users` | | User | legacy_id, login, email, password_hash (phpass), created_at, display_name | | Yes | Re-hash on first login |
| `kd_usermeta` (billing_*, shipping_*, phone, gender, dob) | | UserProfile / Address | phone, gender, dob + Address rows | | No | |
| `kd_wc_orders` + `kd_wc_order_operational_data` + `kd_wc_order_addresses` + `kd_woocommerce_order_items` | | Order + OrderLineItem + OrderShippingItem + OrderAddress | — | | Yes | HPOS preferred |
| `kd_db7_forms` | | ContactSubmission | form_id, submitted_at, payload(JSONB) | | Yes | |
| `kd_rank_math_redirections` | | Redirect | match_patterns(JSONB), target_url, status_code, status | | Yes | |
| `kd_rank_math_*` postmeta / termmeta | | PageSEO/ProductSEO/... | meta_title, meta_description, focus_keyword, og_*, twitter_*, robots_* | | No | |
| `kd_yoast_*` postmeta / termmeta | (legacy) | (fallback) | — | No | Merge if RankMath empty |
| `kd_posts` (wpcf7_contact_form) | form config serialized | ContactForm | legacy_id, name, fields(JSONB), mail_config(JSONB) | | Yes | 1 form active |

---

## 5. Ràng buộc dữ liệu đáng chú ý

1. `slug` phải unique trong phạm vi (entity, locale). Polylang hiện cho phép slug trùng nếu khác ngôn ngữ.
2. `Product.sku` unique. **Cảnh báo**: dump có ~21k product, khả năng có SKU rỗng hoặc trùng — cần validate khi import.
3. `User.login` unique. Với Quick Buy synthetic users (login=`<phone>@liveevil.vn`), nếu một phone số đặt nhiều đơn, user đầu tiên được tạo và user_id đó được tái dùng (xem [ajax-functions.php:381](files/wp-content/themes/bigbike/inc/ajax-functions.php#L381)).
4. `Media.file_path` unique — là đường dẫn tương đối trong uploads.
5. `Order.order_key` unique, dùng cho URL `?key=`.
6. Redirect: không cho phép cycle (A→B→A).
7. Menu: tree depth max 3 (theo UI hiện tại của theme). NEEDS_CONFIRMATION thực tế.

---

## 6. HTML / richtext cleaning rules

Áp dụng khi migrate `post_content`, `post_excerpt`, mọi ACF richtext:

1. Strip các `<div class="woocommerce">` wrapper (đã có rule `lenny_remove_div_class_woocommerce` trong theme).
2. Rewrite image src `<img src=...>` → giữ nguyên (không rewrite sang `data-src=` như theme đang làm runtime — đó là trách nhiệm của component FE).
3. Strip inline `width="..."` / `height="..."` (theme đã strip runtime; migration cũng strip).
4. Chuyển các shortcode core nếu xuất hiện thành HTML hoặc giữ marker để FE render.
5. Validate link: các URL nội bộ cần được map sang URL mới sau migration (xem [URL_REDIRECT_MAP.md](URL_REDIRECT_MAP.md)).
6. Strip script trừ khi được allowlist (GTM markers được emit bởi template, không nằm trong post_content).

---

## 7. Slug normalisation

1. Lowercase.
2. Remove dấu tiếng Việt → ASCII (theo bảng Polylang) chỉ khi slug cũ chứa dấu. Trường hợp slug đã không dấu thì giữ nguyên.
3. Replace non-alphanumeric bằng `-`, collapse `-` liên tiếp.
4. Trim `-` đầu/cuối.
5. Giữ tương đương 1-1 với slug cũ. **Không đổi slug nếu không cần** (để không 301).

---

## 8. Duplicate / missing data handling

| Trường hợp | Xử lý |
|---|---|
| Product không có SKU | Generate SKU synthetic `BB-{legacy_id}` và đánh flag `sku_generated=true` |
| Product có SKU trùng | Giữ product có `updated_at` mới nhất làm primary, các row còn lại đánh suffix `-dup{legacy_id}` |
| User có login trùng (đã unique ở WP, an toàn) | n/a |
| Order thiếu `customer_id` | Map về guest (customer_id=NULL), giữ email/phone trong OrderAddress |
| Variation không có ít nhất 1 `attribute_*` | Skip variation, log cảnh báo |
| Attachment không có `_wp_attached_file` | Skip, log cảnh báo |
| Page có template_key không khớp code FE | Fallback template `page-static` |
| Term parent không tồn tại | Set parent_id=NULL, log cảnh báo |
| Menu item trỏ `target_id` không còn tồn tại | Convert sang URL direct, giữ link cũ |

---

## 9. Polylang translation

Polylang lưu quan hệ bản dịch qua 2 taxonomy ẩn: `post_translations` và `term_translations`. Mỗi post/term thuộc 1 `language` term.

Mapping:
- `Post.language` → `BlogPost.locale` (enum `vi`, `en`, ...).
- `post_translations` term → `translation_group_id` uuid chia sẻ giữa các bản dịch.
- Cùng logic cho term (category, product_cat, ...).

Phase 1: nếu chỉ support `vi`, bỏ qua bản dịch và đánh flag `locale='vi'` trên mọi row.

---

## 10. Các điểm chưa quyết (NEEDS_CONFIRMATION)

1. Cấu trúc chính xác ACF field `videos` trên product.
2. Schema Pods cho `slider`, `video`, `review`.
3. Có migrate historical CF7 submissions trong `kd_db7_forms` không.
4. Chiến lược password: (a) re-hash phpass lần đầu user login trên hệ thống mới, hay (b) force reset password cho tất cả user.
5. Có giữ `product_of_stock` custom meta như business rule riêng không, hay consolidate về `stock_status`.
6. Giữ `rating_display`/`rating_count_display` "giả" (default 4.5/124) hay bỏ và thay bằng review thật.
7. Có migrate OAuth credentials của Google Listings & Ads không.
