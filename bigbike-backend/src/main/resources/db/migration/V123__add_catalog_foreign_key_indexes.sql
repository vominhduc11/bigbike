-- V123: Add indexes on catalog foreign-key columns left unindexed since V1/V15/V41.
-- Each index backs a real FK join / filter path used by catalog read endpoints
-- (product list, product detail, variant + option resolution) and speeds up the
-- ON DELETE CASCADE child cleanup. IF NOT EXISTS keeps the migration idempotent.

-- products: filter by brand / category, brand & category page joins
create index if not exists idx_products_brand_id on products (brand_id);
create index if not exists idx_products_category_id on products (category_id);

-- product child collections: fetched per product, cascade-deleted with product
create index if not exists idx_product_gallery_images_product_id on product_gallery_images (product_id);
create index if not exists idx_product_videos_product_id on product_videos (product_id);
create index if not exists idx_product_specifications_product_id on product_specifications (product_id);
create index if not exists idx_product_variants_product_id on product_variants (product_id);

-- variant options: fetched per variant, FK to the attribute/value dictionary
create index if not exists idx_product_variant_options_variant_id on product_variant_options (variant_id);
create index if not exists idx_product_variant_options_attribute_id on product_variant_options (attribute_id);
create index if not exists idx_product_variant_options_attribute_value_id on product_variant_options (attribute_value_id);

-- variant gallery images: fetched per variant, cascade-deleted with variant
create index if not exists idx_product_variant_gallery_images_variant_id on product_variant_gallery_images (variant_id);

-- product_tag_map: PK (product_id, tag_id) already covers product_id;
-- index tag_id for the reverse lookup (products of a tag) and FK delete check.
create index if not exists idx_product_tag_map_tag_id on product_tag_map (tag_id);
