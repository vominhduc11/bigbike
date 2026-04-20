# Legacy Database Schema

Discovery date: 2026-04-20

This document summarizes the legacy WordPress SQL dump in schema-only form. It intentionally excludes raw rows, customer/order data, email, phone, address, password hashes, session values, token values, API keys, webhook secrets, and order keys.

## Dump Facts

- Local dump path: `bigbike_vn__2026_04_17/sqldump.sql`
- Dump size observed locally: about 133 MB
- Table prefix: `kd_`
- Tables found: 111
- Active theme options point to `bigbike`
- WordPress permalink structure: `/tin-tuc/%postname%.html`
- WooCommerce product base: `/product`
- WooCommerce product category base: `danh-muc-san-pham`
- WooCommerce product tag base: `tu-khoa-san-pham`

## Full Table Inventory

```text
kd_actionscheduler_actions
kd_actionscheduler_claims
kd_actionscheduler_groups
kd_actionscheduler_logs
kd_commentmeta
kd_comments
kd_db7_forms
kd_duplicator_backups
kd_duplicator_entities
kd_duplicator_packages
kd_ewwwio_images
kd_ewwwio_queue
kd_fg_redirect
kd_gla_attribute_mapping_rules
kd_gla_budget_recommendations
kd_gla_merchant_issues
kd_gla_merchant_price_benchmarks
kd_gla_shipping_rates
kd_gla_shipping_times
kd_links
kd_options
kd_pmxe_exports
kd_pmxe_google_cats
kd_pmxe_posts
kd_pmxe_templates
kd_podsrel
kd_postmeta
kd_posts
kd_rank_math_404_logs
kd_rank_math_analytics_gsc
kd_rank_math_analytics_keyword_manager
kd_rank_math_analytics_objects
kd_rank_math_internal_links
kd_rank_math_internal_meta
kd_rank_math_redirections
kd_rank_math_redirections_cache
kd_social_users
kd_term_relationships
kd_term_taxonomy
kd_termmeta
kd_terms
kd_usermeta
kd_users
kd_wc_admin_note_actions
kd_wc_admin_notes
kd_wc_category_lookup
kd_wc_customer_lookup
kd_wc_download_log
kd_wc_order_addresses
kd_wc_order_coupon_lookup
kd_wc_order_operational_data
kd_wc_order_product_lookup
kd_wc_order_stats
kd_wc_order_tax_lookup
kd_wc_orders
kd_wc_orders_meta
kd_wc_product_attributes_lookup
kd_wc_product_download_directories
kd_wc_product_meta_lookup
kd_wc_rate_limits
kd_wc_reserved_stock
kd_wc_tax_rate_classes
kd_wc_webhooks
kd_wfauditevents
kd_wfblockediplog
kd_wfblocks7
kd_wfconfig
kd_wfcrawlers
kd_wffilechanges
kd_wffilemods
kd_wfhits
kd_wfhoover
kd_wfissues
kd_wfknownfilelist
kd_wflivetraffichuman
kd_wflocs
kd_wflogins
kd_wfls_2fa_secrets
kd_wfls_role_counts
kd_wfls_settings
kd_wfnotifications
kd_wfpendingissues
kd_wfreversecache
kd_wfsecurityevents
kd_wfsnipcache
kd_wfstatus
kd_wftrafficrates
kd_wfwaffailures
kd_woocommerce_api_keys
kd_woocommerce_attribute_taxonomies
kd_woocommerce_downloadable_product_permissions
kd_woocommerce_log
kd_woocommerce_order_itemmeta
kd_woocommerce_order_items
kd_woocommerce_payment_tokenmeta
kd_woocommerce_payment_tokens
kd_woocommerce_sessions
kd_woocommerce_shipping_zone_locations
kd_woocommerce_shipping_zone_methods
kd_woocommerce_shipping_zones
kd_woocommerce_tax_rate_locations
kd_woocommerce_tax_rates
kd_wpr_rocket_cache
kd_wpr_rucss_used_css
kd_yoast_indexable
kd_yoast_indexable_hierarchy
kd_yoast_migrations
kd_yoast_primary_term
kd_yoast_prominent_words
kd_yoast_seo_links
kd_yoast_seo_meta
```

## Safe Aggregate Row Counts

These are tuple counts from `INSERT` statements only. No row values were extracted.

| Table | Safe count |
|---|---:|
| `kd_posts` | 21276 |
| `kd_postmeta` | 244396 |
| `kd_terms` | 6238 |
| `kd_term_taxonomy` | 6238 |
| `kd_term_relationships` | 24102 |
| `kd_termmeta` | 4382 |
| `kd_users` | 1940 |
| `kd_usermeta` | 44610 |
| `kd_comments` | 476 |
| `kd_commentmeta` | 31 |
| `kd_wc_customer_lookup` | 822 |
| `kd_wc_order_product_lookup` | 1307 |
| `kd_wc_order_stats` | 1061 |
| `kd_wc_product_meta_lookup` | 8194 |
| `kd_wc_product_attributes_lookup` | 6102 |
| `kd_woocommerce_order_items` | 2651 |
| `kd_woocommerce_order_itemmeta` | 18765 |
| `kd_woocommerce_attribute_taxonomies` | 6 |
| `kd_rank_math_redirections` | 40 |
| `kd_rank_math_redirections_cache` | 63 |
| `kd_fg_redirect` | 19516 |

WooCommerce HPOS tables `kd_wc_orders`, `kd_wc_orders_meta`, and `kd_wc_order_addresses` exist but had no inserted rows in this dump. Legacy order data appears to be stored primarily in `kd_posts` as `shop_order`, plus lookup/item tables.

## Product, Category, Media, And Meta Tables

| Concern | Legacy table(s) | Schema-only notes |
|---|---|---|
| Product core | `kd_posts` | `post_type=product`, title/content/excerpt/slug/status/date fields. |
| Product variations | `kd_posts`, `kd_postmeta` | `post_type=product_variation`, parent product through `post_parent`, variation attributes in meta keys. |
| Product meta | `kd_postmeta` | Prices, stock, SKU, gallery, ACF, SEO, and import residue live in meta rows. |
| Product lookup | `kd_wc_product_meta_lookup` | SKU, min/max price, stock quantity/status, rating, total sales. |
| Product attributes | `kd_woocommerce_attribute_taxonomies`, `kd_wc_product_attributes_lookup` | Attribute definitions and product/term lookup. |
| Categories/tags/brands | `kd_terms`, `kd_term_taxonomy`, `kd_term_relationships`, `kd_termmeta` | `product_cat`, `product_tag`, `pwb-brand`, product attributes, term media/SEO/custom fields. |
| Media | `kd_posts`, `kd_postmeta` | Attachments use `post_type=attachment`; file paths and image metadata are in postmeta. |
| SEO meta | `kd_postmeta`, `kd_termmeta`, Rank Math tables | Rank Math is active; Yoast table residue also exists. |

## Order And Customer Tables

| Concern | Legacy table(s) | Sensitivity |
|---|---|---|
| Order core | `kd_posts` with `post_type=shop_order` | Sensitive. Do not export raw rows. |
| Order stats | `kd_wc_order_stats` | Sensitive aggregate/order data. Do not export raw rows without a sanitizer. |
| Order products | `kd_wc_order_product_lookup`, `kd_woocommerce_order_items`, `kd_woocommerce_order_itemmeta` | Contains order line items. Do not export raw rows. |
| Customer lookup | `kd_wc_customer_lookup` | Contains names/emails/location fields. Do not export raw rows. |
| User accounts | `kd_users`, `kd_usermeta` | Contains login, hash, email, profile, billing/shipping metadata. Do not export raw rows. |
| Comments/reviews | `kd_comments`, `kd_commentmeta` | Contains author/email/IP/content fields. Do not export raw rows. |
| Sessions/tokens/API | `kd_woocommerce_sessions`, `kd_woocommerce_api_keys`, `kd_woocommerce_payment_tokens`, `kd_wc_webhooks` | Sensitive. Never migrate raw values. |

## Key Schema Summaries

`kd_posts`:

- Columns: `ID`, `post_author`, `post_date`, `post_date_gmt`, `post_content`, `post_title`, `post_excerpt`, `post_status`, `comment_status`, `ping_status`, `post_password`, `post_name`, `to_ping`, `pinged`, `post_modified`, `post_modified_gmt`, `post_content_filtered`, `post_parent`, `guid`, `menu_order`, `post_type`, `post_mime_type`, `comment_count`
- Important indexes: primary key on `ID`, indexes on `post_name`, `post_parent`, `post_author`, and combined `post_type/post_status/post_date/ID`

`kd_postmeta`:

- Columns: `meta_id`, `post_id`, `meta_key`, `meta_value`
- Important indexes: primary key on `meta_id`, indexes on `post_id` and `meta_key`

`kd_terms`:

- Columns: `term_id`, `name`, `slug`, `term_group`
- Important indexes: primary key on `term_id`, indexes on `slug` and `name`

`kd_term_taxonomy`:

- Columns: `term_taxonomy_id`, `term_id`, `taxonomy`, `description`, `parent`, `count`
- Important indexes: primary key on `term_taxonomy_id`, unique key on `term_id/taxonomy`, index on `taxonomy`

`kd_term_relationships`:

- Columns: `object_id`, `term_taxonomy_id`, `term_order`
- Important indexes: primary key on `object_id/term_taxonomy_id`, index on `term_taxonomy_id`

`kd_termmeta`:

- Columns: `meta_id`, `term_id`, `meta_key`, `meta_value`
- Important indexes: primary key on `meta_id`, indexes on `term_id` and `meta_key`

`kd_wc_product_meta_lookup`:

- Columns: `product_id`, `sku`, `virtual`, `downloadable`, `min_price`, `max_price`, `onsale`, `stock_quantity`, `stock_status`, `rating_count`, `average_rating`, `total_sales`, `tax_status`, `tax_class`, `global_unique_id`
- Important indexes: primary key on `product_id`, indexes on price, stock, SKU, and sales fields

`kd_wc_product_attributes_lookup`:

- Columns: `product_id`, `product_or_parent_id`, `taxonomy`, `term_id`, `is_variation_attribute`, `in_stock`
- Important indexes: primary key on `product_or_parent_id/term_id/product_id/taxonomy`

`kd_woocommerce_attribute_taxonomies`:

- Columns: `attribute_id`, `attribute_name`, `attribute_label`, `attribute_type`, `attribute_orderby`, `attribute_public`
- Attribute definitions observed: `size`, `color`, `dungtich`, `bo`, `model`, `gender`

`kd_wc_order_stats`:

- Columns: `order_id`, `parent_id`, `date_created`, `date_created_gmt`, `num_items_sold`, `total_sales`, `tax_total`, `shipping_total`, `net_total`, `returning_customer`, `status`, `customer_id`, `date_paid`, `date_completed`
- Sensitive: do not export raw rows.

`kd_woocommerce_order_items`:

- Columns: `order_item_id`, `order_item_name`, `order_item_type`, `order_id`
- Sensitive: do not export raw rows.

`kd_woocommerce_order_itemmeta`:

- Columns: `meta_id`, `order_item_id`, `meta_key`, `meta_value`
- Sensitive: do not export raw rows.

`kd_users`:

- Columns include `user_login`, `user_pass`, `user_email`, and `display_name`
- Sensitive: do not export raw rows or password hashes.

`kd_usermeta`:

- Columns: `umeta_id`, `user_id`, `meta_key`, `meta_value`
- Sensitive: includes profile, billing, shipping, session, and historical migration metadata. Do not export raw rows.

## Post Type Counts

| Post type | Count | Status summary |
|---|---:|---|
| `product` | 1227 | 279 publish, 947 draft, 1 pending |
| `product_variation` | 4040 | 4040 publish |
| `shop_order` | 1061 | 597 completed, 433 pending, 26 cancelled, 5 on-hold |
| `shop_coupon` | 1 | 1 publish |
| `post` | 174 | 167 publish plus drafts/private/autodrafts |
| `page` | 22 | 21 publish, 1 draft |
| `attachment` | 12054 | 12054 inherit |
| `slider` | 2 | 2 publish |
| `video` | 62 | 62 publish |

## Taxonomy Counts

| Taxonomy | Count |
|---|---:|
| `product_cat` | 50 |
| `product_tag` | 2895 |
| `product_type` | 5 |
| `product_visibility` | 9 |
| `pwb-brand` | 45 |
| `product_brand` | 1 |
| `pa_size` | 59 |
| `pa_color` | 122 |
| `pa_dungtich` | 4 |
| `pa_bo` | 14 |
| `pa_model` | 41 |
| `pa_gender` | 2 |
| `category` | 5 |
| `post_tag` | 18 |
| Polylang translation/language taxonomies | present |

## High-Value Meta Keys

Product and content meta keys observed by name only:

- Price/stock: `_price`, `_regular_price`, `_sale_price`, `_stock`, `_stock_status`, `_manage_stock`, `_backorders`, `product_of_stock`
- Product identity: `_sku`, `_product_version`, `_product_attributes`
- Media: `_thumbnail_id`, `_product_image_gallery`, `rtwpvg_images`, `_wp_attached_file`, `_wp_attachment_metadata`, `_wp_attachment_image_alt`
- SEO: `rank_math_seo_score`, `rank_math_focus_keyword`, `rank_math_description`, `rank_math_title`, `_yoast_wpseo_metadesc`, `_yoast_wpseo_primary_product_cat`
- ACF/product presentation: `rating`, `rating_count`, `product_more_infomation`, `videos`, `content_bottom`, `featured`
- Term presentation: `top_image`, `image_left`, `content_bottom`, `show_on_homepage`, `ordering`, `image_sidebar`, `pwb_brand_image`, `pwb_brand_banner`, `color`, `image`

Sensitive meta keys exist for orders and users, including billing/shipping/contact/session fields. They must not be copied into repository artifacts.

## Schema Mapping Targets

- Product/category/media mapping belongs in `docs/contracts/DATA_CONTRACT.md` before implementation.
- Route changes must update `docs/legacy/SEO_REDIRECT_MAP.csv`.
- Any future data samples must be generated through a sanitizer and placed only under approved sanitized artifact paths.
