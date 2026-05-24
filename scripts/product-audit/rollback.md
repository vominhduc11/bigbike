# Rollback Instructions

## Backup Created
- Path: `backups/product-data-audit/20260524-133806-before-fill.sql`
- Size: 47.6 MB
- Tables covered: products, product_variants, product_gallery_images,
  product_variant_gallery_images, product_videos, product_specifications,
  product_faqs, product_tags, product_tag_map, product_related_product_map,
  brands, categories, media, attributes, attribute_values, reviews

## Restore Command

```powershell
# From project root (e:\Project\bigbike):
Get-Content "backups\product-data-audit\20260524-133806-before-fill.sql" |
  docker exec -i bigbike-postgres psql -U bigbike -d bigbike
```

## What Was Changed

The following fields were filled (nullable → populated):

| Table | Field | Rows Changed |
|-------|-------|-------------|
| products | seo_canonical_url | 1231 |
| products | seo_title | 478 |
| products | seo_description | 356 |
| products | image_alt | 1 |
| products | sku | 290 |
| product_variants | sku | 2838 |
| product_gallery_images | image_alt | 3 |
| brands | seo_title | 46 |
| brands | seo_canonical_url | 46 |
| categories | seo_title | 45 |
| categories | seo_canonical_url | 45 |

## What Was NOT Changed

- publish_status (no mass publish)
- slug (never modified)
- id, created_at (never modified)
- short_description, description (no fake content)
- brand_id (no auto-assign)
- retail_price (no fake prices)
- inventory / serials (no fake stock)
- image_url (no fake image URLs)
