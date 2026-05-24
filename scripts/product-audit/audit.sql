-- =============================================================================
-- Product Data Completeness Audit
-- READ-ONLY: No INSERT / UPDATE / DELETE
-- Run via: docker exec -i bigbike-postgres psql -U bigbike -d bigbike
-- =============================================================================

\echo '============================================================'
\echo 'BIGBIKE PRODUCT DATA COMPLETENESS AUDIT'
\echo '============================================================'

-- ---------------------------------------------------------------------------
-- 1. PRODUCTS TABLE
-- ---------------------------------------------------------------------------

\echo ''
\echo '--- [1] PRODUCTS: Status Distribution ---'
SELECT
  publish_status,
  COUNT(*) AS count
FROM products
GROUP BY publish_status
ORDER BY count DESC;

\echo ''
\echo '--- [2] PRODUCTS: Missing Field Summary ---'
SELECT
  COUNT(*)                                                          AS total_products,
  COUNT(*) FILTER (WHERE publish_status = 'PUBLISHED')             AS published,
  COUNT(*) FILTER (WHERE publish_status = 'DRAFT')                 AS draft,
  COUNT(*) FILTER (WHERE publish_status NOT IN ('PUBLISHED','DRAFT')) AS other_status,
  COUNT(*) FILTER (WHERE sku IS NULL OR sku = '')                   AS missing_sku,
  COUNT(*) FILTER (WHERE brand_id IS NULL)                          AS missing_brand,
  COUNT(*) FILTER (WHERE image_url IS NULL AND image_id IS NULL)    AS missing_image_completely,
  COUNT(*) FILTER (WHERE image_url IS NULL AND image_id IS NOT NULL) AS image_url_fillable_from_media,
  COUNT(*) FILTER (WHERE image_url IS NOT NULL)                     AS has_image_url,
  COUNT(*) FILTER (WHERE image_alt IS NULL OR image_alt = '')       AS missing_image_alt,
  COUNT(*) FILTER (WHERE short_description IS NULL OR short_description = '') AS missing_short_desc,
  COUNT(*) FILTER (WHERE description IS NULL OR description = '')    AS missing_description,
  COUNT(*) FILTER (WHERE seo_title IS NULL OR seo_title = '')        AS missing_seo_title,
  COUNT(*) FILTER (WHERE seo_description IS NULL OR seo_description = '') AS missing_seo_description,
  COUNT(*) FILTER (WHERE seo_canonical_url IS NULL)                  AS missing_seo_canonical,
  COUNT(*) FILTER (WHERE retail_price IS NULL OR retail_price <= 0)  AS invalid_or_zero_price,
  COUNT(*) FILTER (WHERE category_id IS NULL)                        AS missing_category
FROM products;

\echo ''
\echo '--- [3] PRODUCTS: Image fillable from media (sample) ---'
SELECT
  COUNT(*) AS products_image_url_fillable
FROM products p
JOIN media m ON m.id::text = p.image_id
WHERE p.image_url IS NULL
  AND p.image_id IS NOT NULL
  AND m.public_url IS NOT NULL;

\echo ''
\echo '--- [4] PRODUCTS: image_url NULL but image_id points to media with NULL public_url ---'
SELECT
  COUNT(*) AS products_image_id_but_media_no_url
FROM products p
JOIN media m ON m.id::text = p.image_id
WHERE p.image_url IS NULL
  AND p.image_id IS NOT NULL
  AND m.public_url IS NULL;

\echo ''
\echo '--- [5] PRODUCTS: SEO fillable summary ---'
SELECT
  COUNT(*) FILTER (WHERE (seo_title IS NULL OR seo_title = '') AND name IS NOT NULL) AS seo_title_fillable,
  COUNT(*) FILTER (WHERE (seo_description IS NULL OR seo_description = '') AND name IS NOT NULL) AS seo_desc_fillable,
  COUNT(*) FILTER (WHERE seo_canonical_url IS NULL AND slug IS NOT NULL) AS canonical_fillable,
  COUNT(*) FILTER (WHERE (image_alt IS NULL OR image_alt = '') AND image_url IS NOT NULL AND name IS NOT NULL) AS image_alt_fillable
FROM products;

\echo ''
\echo '--- [6] PRODUCTS: SKU fillable ---'
SELECT COUNT(*) AS sku_fillable
FROM products p
JOIN categories c ON c.id = p.category_id
WHERE (p.sku IS NULL OR p.sku = '');

\echo ''
\echo '--- [7] PRODUCTS: Publish-ready DRAFT products ---'
SELECT
  COUNT(*) AS draft_ready_to_publish
FROM products
WHERE publish_status = 'DRAFT'
  AND name IS NOT NULL AND name <> ''
  AND slug IS NOT NULL AND slug <> ''
  AND image_url IS NOT NULL
  AND retail_price > 0
  AND category_id IS NOT NULL;

\echo ''
\echo '--- [8] PRODUCTS: Price distribution by stock_state ---'
SELECT stock_state, COUNT(*) AS count, MIN(retail_price) AS min_price, MAX(retail_price) AS max_price
FROM products
GROUP BY stock_state
ORDER BY count DESC;

\echo ''
\echo '--- [9] PRODUCTS: Category coverage ---'
SELECT c.name AS category_name, COUNT(p.id) AS product_count
FROM products p
LEFT JOIN categories c ON c.id = p.category_id
GROUP BY c.name
ORDER BY product_count DESC
LIMIT 20;

-- ---------------------------------------------------------------------------
-- 2. PRODUCT VARIANTS
-- ---------------------------------------------------------------------------

\echo ''
\echo '--- [10] PRODUCT VARIANTS: Missing Field Summary ---'
SELECT
  COUNT(*)                                                             AS total_variants,
  COUNT(*) FILTER (WHERE sku IS NULL OR sku = '')                     AS missing_sku,
  COUNT(*) FILTER (WHERE image_url IS NULL AND image_id IS NULL)      AS missing_image_completely,
  COUNT(*) FILTER (WHERE image_url IS NULL AND image_id IS NOT NULL)  AS image_url_fillable,
  COUNT(*) FILTER (WHERE image_url IS NOT NULL)                       AS has_image_url,
  COUNT(*) FILTER (WHERE image_alt IS NULL OR image_alt = '')         AS missing_image_alt,
  COUNT(*) FILTER (WHERE quantity_on_hand = 0)                        AS zero_stock,
  COUNT(*) FILTER (WHERE stock_state = 'IN_STOCK')                    AS in_stock,
  COUNT(*) FILTER (WHERE stock_state = 'OUT_OF_STOCK')                AS out_of_stock,
  COUNT(*) FILTER (WHERE is_available = false)                        AS unavailable
FROM product_variants;

-- ---------------------------------------------------------------------------
-- 3. PRODUCT GALLERY IMAGES
-- ---------------------------------------------------------------------------

\echo ''
\echo '--- [11] PRODUCT GALLERY IMAGES ---'
SELECT
  COUNT(*) AS total_gallery_images,
  COUNT(*) FILTER (WHERE image_url IS NULL OR image_url = '') AS missing_url,
  COUNT(*) FILTER (WHERE image_url IS NULL AND image_id IS NOT NULL) AS fillable_from_media,
  COUNT(*) FILTER (WHERE image_alt IS NULL OR image_alt = '') AS missing_alt
FROM product_gallery_images;

-- ---------------------------------------------------------------------------
-- 4. PRODUCT VARIANT GALLERY IMAGES
-- ---------------------------------------------------------------------------

\echo ''
\echo '--- [12] VARIANT GALLERY IMAGES ---'
SELECT
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE image_url IS NULL OR image_url = '') AS missing_url,
  COUNT(*) FILTER (WHERE image_url IS NULL AND image_id IS NOT NULL) AS fillable_from_media
FROM product_variant_gallery_images;

-- ---------------------------------------------------------------------------
-- 5. BRANDS
-- ---------------------------------------------------------------------------

\echo ''
\echo '--- [13] BRANDS: Missing Field Summary ---'
SELECT
  COUNT(*) AS total_brands,
  COUNT(*) FILTER (WHERE logo_url IS NULL) AS missing_logo_url,
  COUNT(*) FILTER (WHERE seo_title IS NULL OR seo_title = '') AS missing_seo_title,
  COUNT(*) FILTER (WHERE description IS NULL OR description = '') AS missing_description,
  COUNT(*) FILTER (WHERE is_visible = false) AS hidden_brands
FROM brands;

-- ---------------------------------------------------------------------------
-- 6. CATEGORIES
-- ---------------------------------------------------------------------------

\echo ''
\echo '--- [14] CATEGORIES: Missing Field Summary ---'
SELECT
  COUNT(*) AS total_categories,
  COUNT(*) FILTER (WHERE image_url IS NULL) AS missing_image,
  COUNT(*) FILTER (WHERE seo_title IS NULL OR seo_title = '') AS missing_seo_title,
  COUNT(*) FILTER (WHERE description IS NULL OR description = '') AS missing_description,
  COUNT(*) FILTER (WHERE is_visible = false) AS hidden_categories
FROM categories;

-- ---------------------------------------------------------------------------
-- 7. CONTENT TABLES
-- ---------------------------------------------------------------------------

\echo ''
\echo '--- [15] CONTENT: Specifications, FAQs, Videos ---'
SELECT
  (SELECT COUNT(*) FROM product_specifications) AS total_specifications,
  (SELECT COUNT(*) FROM product_faqs)           AS total_faqs,
  (SELECT COUNT(*) FROM product_videos)         AS total_videos,
  (SELECT COUNT(DISTINCT product_id) FROM product_specifications) AS products_with_specs,
  (SELECT COUNT(DISTINCT product_id) FROM product_faqs)           AS products_with_faqs,
  (SELECT COUNT(DISTINCT product_id) FROM product_videos)         AS products_with_videos;

-- ---------------------------------------------------------------------------
-- 8. INVENTORY
-- ---------------------------------------------------------------------------

\echo ''
\echo '--- [16] INVENTORY: Stock Movements & Serials ---'
SELECT
  (SELECT COUNT(*) FROM stock_movements) AS total_stock_movements,
  (SELECT COUNT(*) FROM product_serials) AS total_serials,
  (SELECT COUNT(*) FILTER (WHERE status = 'IN_STOCK') FROM product_serials) AS serials_in_stock,
  (SELECT COUNT(*) FILTER (WHERE status = 'SOLD') FROM product_serials)     AS serials_sold;

-- ---------------------------------------------------------------------------
-- 9. TAGS & RELATIONS
-- ---------------------------------------------------------------------------

\echo ''
\echo '--- [17] TAGS & RELATIONS ---'
SELECT
  (SELECT COUNT(*) FROM product_tags)               AS total_tags,
  (SELECT COUNT(*) FROM product_tag_map)            AS total_tag_mappings,
  (SELECT COUNT(DISTINCT product_id) FROM product_tag_map) AS products_with_tags,
  (SELECT COUNT(*) FROM product_related_product_map) AS total_related_mappings,
  (SELECT COUNT(DISTINCT product_id) FROM product_related_product_map) AS products_with_related;

-- ---------------------------------------------------------------------------
-- 10. MEDIA
-- ---------------------------------------------------------------------------

\echo ''
\echo '--- [18] MEDIA: URL Status ---'
SELECT
  COUNT(*) AS total_media,
  COUNT(*) FILTER (WHERE public_url IS NOT NULL) AS has_public_url,
  COUNT(*) FILTER (WHERE public_url IS NULL)     AS missing_public_url,
  COUNT(*) FILTER (WHERE status = 'ACTIVE' OR status IS NULL) AS active_media
FROM media;

\echo ''
\echo '============================================================'
\echo 'AUDIT COMPLETE'
\echo '============================================================'
