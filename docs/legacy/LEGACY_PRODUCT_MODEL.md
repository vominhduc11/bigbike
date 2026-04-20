# Legacy Product Model

Discovery date: 2026-04-20

This document maps the legacy WooCommerce product model into a sanitized implementation reference. It intentionally uses table names, post types, taxonomies, meta key names, and aggregate counts only.

## Product Entities

| Legacy entity | Source | Count | Notes |
|---|---|---:|---|
| Product | `kd_posts.post_type=product` | 1227 | 279 published, 947 draft, 1 pending. |
| Product variation | `kd_posts.post_type=product_variation` | 4040 | Parent is stored in `post_parent`. |
| Product category | `kd_term_taxonomy.taxonomy=product_cat` | 50 | Category metadata drives hero/category presentation. |
| Product tag | `kd_term_taxonomy.taxonomy=product_tag` | 2895 | Large tag set. Treat as SEO/filtering data. |
| Brand | `kd_term_taxonomy.taxonomy=pwb-brand` | 45 | From Perfect WooCommerce Brands. |
| Product attributes | `kd_woocommerce_attribute_taxonomies` | 6 | `size`, `color`, `dungtich`, `bo`, `model`, `gender`. |
| Media | `kd_posts.post_type=attachment` | 12054 | Image files and alt metadata in postmeta. |
| Video | `kd_posts.post_type=video` | 62 | Used by homepage and product video sections. |
| Slider | `kd_posts.post_type=slider` | 2 | Homepage slider content; homepage also reads ACF repeater `sliders`. |

## Core Product Fields

| New concept | Legacy source | Notes |
|---|---|---|
| `legacyId` | `kd_posts.ID` | Keep as import trace only; do not expose publicly as canonical id. |
| `name` | `kd_posts.post_title` | Product title. |
| `slug` | `kd_posts.post_name` | Public URL slug under `/product/{slug}/`. |
| `descriptionHtml` | `kd_posts.post_content` | Sanitize before rendering. |
| `shortDescriptionHtml` | `kd_posts.post_excerpt` | Sanitize before rendering. |
| `status` | `kd_posts.post_status` | Map `publish`, `draft`, `pending` to new product publish state. |
| `createdAt`, `updatedAt` | post date fields | Preserve if importing content history. |
| `primaryCategory` | `_yoast_wpseo_primary_product_cat`, fallback product terms | Legacy code uses Yoast primary category meta despite Rank Math being active. |
| `categories` | `product_cat` relationships | Preserve hierarchy and slugs. |
| `tags` | `product_tag` relationships | Preserve if SEO/search requires tags. |
| `brand` | `pwb-brand` relationship | Preserve brand slug and media. |

## Price And Stock

| New concept | Legacy source | Notes |
|---|---|---|
| `regularPrice` | `_regular_price` | Convert to integer VND in the new contract. |
| `salePrice` | `_sale_price` | Empty means no sale price. |
| `price` | `_price`, lookup `min_price/max_price` | Backend must calculate canonical price. |
| `sku` | `_sku`, lookup `sku` | Preserve uniqueness rules in the new backend. |
| `stockQuantity` | `_stock`, lookup `stock_quantity` | Can be null for unmanaged stock. |
| `stockStatus` | `_stock_status`, lookup `stock_status` | Map to canonical stock states. |
| `manageStock` | `_manage_stock` | WooCommerce yes/no style data. |
| `backorders` | `_backorders` | Preserve only if business rules support it. |
| `manualOutOfStockFlag` | `product_of_stock` | Theme reads this custom meta before showing product purchase note. |

## Media

| New concept | Legacy source | Notes |
|---|---|---|
| `image.url` | `_thumbnail_id` -> attachment | Canonical new field should remain `image.url`. |
| `image.alt` | `_wp_attachment_image_alt` | Auto image attribute plugin populated many alt fields. |
| `gallery[]` | `_product_image_gallery`, `rtwpvg_images` | Include variation gallery plugin data if importing variant galleries. |
| `videos[]` | ACF `videos` and `video` post type with `youtube_url` | Product page has a custom video tab. |
| `brand.image` | term meta `pwb_brand_image` | Brand logos are used on homepage and brand pages. |
| `category.heroImage` | term meta `top_image`, `image_left` | Used by shop/category/brand headers. |

## Attributes And Variations

Attribute taxonomy definitions:

| Attribute | Legacy taxonomy | Label | Public |
|---|---|---|---|
| Size | `pa_size` | `Size` | Yes |
| Color | `pa_color` | `Color` | Yes |
| Dung tich | `pa_dungtich` | `Dung tich` | Yes |
| Bo | `pa_bo` | `Bo` | Yes |
| Model | `pa_model` | `Model` | No |
| Gender | `pa_gender` | `Gender` | No |

Variation meta keys observed:

- `attribute_pa_size`
- `attribute_pa_color`
- `_variation_description`
- `_regular_price`
- `_sale_price`
- `_price`
- `_stock`
- `_stock_status`
- `_sku`

Theme behavior:

- Variation dropdowns are converted to radio controls.
- Color options may use variation image first, then ACF term `image`, then ACF term `color`.
- Out-of-stock variations are disabled in the UI.
- `find_variation_product` resolves selected attributes to a variation id.

## Product Presentation Fields

ACF/product meta used by templates:

- `rating`
- `rating_count`
- `product_more_infomation`
- `videos`
- `content_bottom`
- `featured`

Term meta used by category/brand pages:

- `top_image`
- `image_left`
- `content_bottom`
- `content_top`
- `show_on_homepage`
- `ordering`
- `image_sidebar`
- `pwb_brand_image`
- `pwb_brand_banner`
- `color`
- `image`

## Product Listing Behavior

Legacy listing pages include:

- Shop archive: `/san-pham/`
- Product category: `/danh-muc-san-pham/{slug}/`
- Product tag: `/tu-khoa-san-pham/{slug}/`
- Brand archive: `/brands/{slug}/` if the default Perfect WooCommerce Brands route is live
- Search: `/?s={query}`

Observed filters and query inputs:

- `min_price`
- `max_price`
- `pwb-brand`
- `filter_gender`
- `filter_color`
- `paged`

SEO title/description generation adds filter context for brand, gender, price range, page number, and color.

## Migration Notes

- Do not import product rows directly into app fixtures without a sanitizer.
- Preserve legacy slugs during initial migration unless `SEO_REDIRECT_MAP.csv` is updated.
- Convert all money values to integer VND in the new canonical contract.
- Keep `legacyId` and source table references internal-only for traceability.
- Before implementing product storage, update `docs/contracts/DATA_CONTRACT.md` with the canonical product/category/brand/media/variant fields.
