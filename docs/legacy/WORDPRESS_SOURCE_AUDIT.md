# WordPress Source Audit

Discovery date: 2026-04-20

This document is a sanitized source audit for the local legacy WordPress export. It is intended to unblock the rebuild without copying raw WordPress source, SQL dump rows, secrets, or customer data into the new repository.

## Guardrails

- Legacy source path is local-only: `bigbike_vn__2026_04_17/files`.
- SQL dump path is local-only: `bigbike_vn__2026_04_17/sqldump.sql`.
- `wp-config.php` was not copied and no secret values are documented here.
- No user, customer, order, email, phone, address, session, token, API key, password hash, or order key values are documented here.
- All findings below are structural facts: theme/plugin names, file paths, post type names, taxonomy names, route patterns, table names, field names, and aggregate counts.

## WordPress Runtime

Observed source version:

- WordPress version: `6.9.4`
- Database prefix from dump: `kd_`
- Active theme from `kd_options`: `bigbike`
- Theme directory: `wp-content/themes/bigbike`
- Theme header: `Theme Name: bigbike`, `Text Domain: bigbike`

The theme is a custom Underscores-based WooCommerce theme with many WooCommerce template overrides and project-specific AJAX handlers.

## Active Plugins

Active plugins from the sanitized `active_plugins` option:

- `woocommerce/woocommerce.php`
- `flexible-shipping/flexible-shipping.php`
- `devvn-woocommerce-price-filter/devvn-woocommerce-price-filter.php`
- `perfect-woocommerce-brands/perfect-woocommerce-brands.php`
- `woo-product-variation-gallery/woo-product-variation-gallery.php`
- `google-listings-and-ads/google-listings-and-ads.php`
- `seo-by-rank-math/rank-math.php`
- `breadcrumb-navxt/breadcrumb-navxt.php`
- `permalink-manager-pro/permalink-manager.php`
- `simple-post-type-permalinks/simple-post-type-permalinks.php`
- `polylang/polylang.php`
- `advanced-custom-fields-pro/acf.php`
- `pods/init.php`
- `contact-form-7/wp-contact-form-7.php`
- `contact-form-cfdb7/contact-form-cfdb-7.php`
- `wordfence/wordfence.php`
- `autoptimize/autoptimize.php`
- `w3-total-cache/w3-total-cache.php`
- `tiny-compress-images/tiny-compress-images.php`
- `auto-image-attributes-from-filename-with-bulk-updater/iaff_image-attributes-from-filename.php`
- `add-html-to-pages/html-on-pages.php`
- `classic-editor/classic-editor.php`
- `classic-widgets/classic-widgets.php`
- `disable-comments/disable-comments.php`
- `disable-feeds-wp/disable-feeds-wp.php`
- `disable-xml-rpc-api/disable-xml-rpc-api.php`
- `tinymce-advanced/tinymce-advanced.php`

## Plugin Roles

Commerce:

- WooCommerce is the product, cart, checkout, order, coupon, customer lookup, and variation core.
- Flexible Shipping is active and legacy custom quick-buy code references a flexible shipping method id.
- DevVN WooCommerce Price Filter supports storefront price filtering.
- Perfect WooCommerce Brands registers the `pwb-brand` taxonomy and brand metadata.
- Woo Product Variation Gallery contributes variation/gallery behavior.
- Google Listings and Ads contributes Google merchant/listing tables.

SEO and routing:

- Rank Math is the active SEO plugin.
- Breadcrumb NavXT is active for breadcrumb behavior.
- Permalink Manager Pro and Simple Post Type Permalinks are active and affect route/permalink behavior.
- Historical Yoast tables exist in the dump, but Yoast is not in the active plugin list.
- Rank Math redirection tables and an `fg_redirect` table exist. Do not export redirect rows until a dedicated sanitized redirect pass is defined.

Auth, account, and social login:

- WooCommerce account pages are present.
- The theme implements custom AJAX login/register/profile update in `inc/ajax-functions.php`.
- `nextend-facebook-connect` exists in the plugin directory and `kd_social_users` exists in the schema, but Nextend is not in the active plugin list from the dump. Treat social login as historical or inactive until verified against production behavior.
- Wordfence is active for security.

Content and custom fields:

- ACF Pro is active and heavily used by page templates, product templates, term templates, and WooCommerce product tabs.
- Pods is active and appears to provide custom post type registration capability.
- Polylang is active and contributes language/translation taxonomies.
- Contact Form 7 and CFDB7 support the contact form and stored form submissions.

## Custom Post Types

Observed post type counts from `kd_posts`, with aggregate counts only:

| Post type | Count | Notes |
|---|---:|---|
| `product` | 1227 | WooCommerce products. |
| `product_variation` | 4040 | WooCommerce product variations. |
| `shop_order` | 1061 | Legacy order posts. Do not export raw rows. |
| `shop_coupon` | 1 | WooCommerce coupon. |
| `post` | 174 | Blog/news content. |
| `page` | 22 | Static and commerce pages. |
| `attachment` | 12054 | Media library. |
| `slider` | 2 | Homepage slider content queried by theme and likely registered through Pods. |
| `video` | 62 | Product/experience video content queried by theme and likely registered through Pods. |
| `wpcf7_contact_form` | 1 | Contact Form 7 form definition. |
| `acf-field-group` | 10 | ACF field groups. |
| `acf-field` | 40 | ACF fields. |
| `_pods_pod` | 1 | Pods config object. |
| Other internal post types | Various | Revisions, nav menu items, custom CSS, Rank Math editor entries, wpcode. |

## Taxonomies

Observed taxonomy counts from `kd_term_taxonomy`, with aggregate counts only:

| Taxonomy | Count | Notes |
|---|---:|---|
| `product_cat` | 50 | Product categories. |
| `product_tag` | 2895 | Product tags. |
| `product_type` | 5 | WooCommerce product type taxonomy. |
| `product_visibility` | 9 | WooCommerce visibility states. |
| `pwb-brand` | 45 | Perfect WooCommerce Brands taxonomy. |
| `product_brand` | 1 | WooCommerce brand taxonomy/table residue; verify before mapping. |
| `pa_size` | 59 | Product attribute taxonomy. |
| `pa_color` | 122 | Product attribute taxonomy. |
| `pa_dungtich` | 4 | Product attribute taxonomy. |
| `pa_bo` | 14 | Product attribute taxonomy. |
| `pa_model` | 41 | Product attribute taxonomy. |
| `pa_gender` | 2 | Product attribute taxonomy. |
| `category` | 5 | Blog category taxonomy. |
| `post_tag` | 18 | Blog tag taxonomy. |
| `language`, `term_language`, translations | Various | Polylang language/translation support. |
| `nav_menu` | 3 | WordPress menus. |

## Important Theme Files

Core theme includes:

- `functions.php`
- `inc/layout-functions.php`
- `inc/utils-functions.php`
- `inc/ajax-functions.php`
- `inc/woo-functions.php`
- `header.php`
- `footer.php`
- `search.php`
- `category.php`
- `single.php`
- `single-review.php`
- `single-video.php`

Page templates:

- `page-templates/page-home.php`
- `page-templates/page-about.php`
- `page-templates/page-cart.php`
- `page-templates/page-checkout.php`
- `page-templates/page-contact.php`
- `page-templates/page-guide.php`
- `page-templates/page-login.php`
- `page-templates/page-news.php`
- `page-templates/page-profile.php`
- `page-templates/page-register.php`
- `page-templates/page-static.php`

WooCommerce overrides:

- `woocommerce/archive-product.php`
- `woocommerce/single-product.php`
- `woocommerce/content-single-product.php`
- `woocommerce/content-product.php`
- `woocommerce/taxonomy-product_cat.php`
- `woocommerce/taxonomy-pwb-brand.php`
- `woocommerce/cart/*`
- `woocommerce/checkout/*`
- `woocommerce/myaccount/*`
- `woocommerce/order/*`
- `woocommerce/single-product/*`

## Important Theme Behaviors

AJAX actions in `inc/ajax-functions.php`:

- `custom_register_user`
- `custom_login_user`
- `update_user_infomation`
- `custom_add_to_cart`
- `remove_item_from_cart`
- `update_cart_item_quantity`
- `buy_quickly`
- `find_variation_product`

Commerce behavior in `inc/woo-functions.php`:

- Adds WooCommerce theme support.
- Overrides checkout fields by removing company, postcode, country/state fields in selected billing/shipping groups.
- Validates billing phone as a 10 digit value.
- Disables default WooCommerce styles.
- Replaces product loop price rendering.
- Replaces variation dropdowns with radio controls.
- Adds custom product tabs for videos and technical information.
- Customizes product/category/shop SEO title and description through SEO filters.
- Adds quick-buy form that creates WooCommerce orders directly.

Search behavior in `functions.php`:

- Product search is extended to include taxonomy matches for `pwb-brand` and `product_cat`.
- No-products search redirect behavior exists through `template_redirect`.

Asset behavior in `inc/layout-functions.php`:

- Different CSS/JS bundles are enqueued for homepage, product page, product listing/search/category/brand pages, login/register, cart, checkout, news, and static pages.

## ACF Usage Hotspots

Observed ACF field names used by templates and WooCommerce overrides:

- Page and term presentation: `top_image`, `image_left`, `content_bottom`, `content_top`, `show_on_homepage`, `ordering`, `image_sidebar`
- Homepage: `sliders`, `about_us`, `blog_content`
- Product: `rating`, `rating_count`, `product_more_infomation`, `videos`
- Video: `youtube_url`
- Review/content: `product_image`
- Brand: `pwb_brand_image`, `pwb_brand_banner`
- Attribute term display: `color`, `image`
- Contact page: `contact_form`, `iframe_maps`, `note`

## Discovery Gaps

- Do a later sanitized redirect extraction for Rank Math redirects and `kd_fg_redirect`; this pass only documents table presence and row counts.
- Confirm whether production still uses Nextend social login, because the plugin source and table exist but the plugin is not active in the dump option.
- Confirm final new-stack URL policy before changing any route. Until then, preserve legacy public routes.
