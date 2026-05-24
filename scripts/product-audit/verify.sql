-- =============================================================================
-- Product Data Completeness Verify (Post-Fill)
-- READ-ONLY: Compare state after fill against before-fill baseline.
-- Run via: docker exec -i bigbike-postgres psql -U bigbike -d bigbike
-- =============================================================================

\echo '============================================================'
\echo 'VERIFICATION: POST-FILL STATE'
\echo '============================================================'

\echo ''
\echo '--- PRODUCTS: Current Missing Field Summary (after fill) ---'
SELECT
  COUNT(*)                                                          AS total_products,
  COUNT(*) FILTER (WHERE publish_status = 'PUBLISHED')             AS published,
  COUNT(*) FILTER (WHERE publish_status = 'DRAFT')                 AS draft,
  COUNT(*) FILTER (WHERE sku IS NULL OR sku = '')                  AS missing_sku,
  COUNT(*) FILTER (WHERE brand_id IS NULL)                         AS missing_brand,
  COUNT(*) FILTER (WHERE image_url IS NULL AND image_id IS NULL)   AS missing_image_completely,
  COUNT(*) FILTER (WHERE image_url IS NULL)                        AS missing_image_url,
  COUNT(*) FILTER (WHERE image_alt IS NULL OR image_alt = '')      AS missing_image_alt,
  COUNT(*) FILTER (WHERE short_description IS NULL OR short_description = '') AS missing_short_desc,
  COUNT(*) FILTER (WHERE description IS NULL OR description = '')  AS missing_description,
  COUNT(*) FILTER (WHERE seo_title IS NULL OR seo_title = '')      AS missing_seo_title,
  COUNT(*) FILTER (WHERE seo_description IS NULL OR seo_description = '') AS missing_seo_desc,
  COUNT(*) FILTER (WHERE seo_canonical_url IS NULL)                AS missing_seo_canonical,
  COUNT(*) FILTER (WHERE retail_price IS NULL OR retail_price <= 0) AS invalid_price
FROM products;

\echo ''
\echo '--- BEFORE vs AFTER comparison (target zeros marked) ---'
SELECT
  'missing_sku'           AS field,
  290                     AS before_fill,
  COUNT(*) FILTER (WHERE sku IS NULL OR sku = '') AS after_fill,
  290 - COUNT(*) FILTER (WHERE sku IS NULL OR sku = '') AS filled
FROM products
UNION ALL
SELECT 'missing_seo_title', 479,
  COUNT(*) FILTER (WHERE seo_title IS NULL OR seo_title = ''),
  479 - COUNT(*) FILTER (WHERE seo_title IS NULL OR seo_title = '')
FROM products
UNION ALL
SELECT 'missing_seo_description', 357,
  COUNT(*) FILTER (WHERE seo_description IS NULL OR seo_description = ''),
  357 - COUNT(*) FILTER (WHERE seo_description IS NULL OR seo_description = '')
FROM products
UNION ALL
SELECT 'missing_seo_canonical', 1231,
  COUNT(*) FILTER (WHERE seo_canonical_url IS NULL),
  1231 - COUNT(*) FILTER (WHERE seo_canonical_url IS NULL)
FROM products
UNION ALL
SELECT 'missing_image_alt', 213,
  COUNT(*) FILTER (WHERE image_alt IS NULL OR image_alt = ''),
  213 - COUNT(*) FILTER (WHERE image_alt IS NULL OR image_alt = '')
FROM products
ORDER BY field;

\echo ''
\echo '--- PRODUCT VARIANTS: After fill ---'
SELECT
  COUNT(*)                                            AS total_variants,
  COUNT(*) FILTER (WHERE sku IS NULL OR sku = '')    AS missing_sku,
  COUNT(*) FILTER (WHERE image_url IS NULL)          AS missing_image_url,
  COUNT(*) FILTER (WHERE quantity_on_hand = 0)       AS zero_stock,
  COUNT(*) FILTER (WHERE stock_state = 'OUT_OF_STOCK') AS out_of_stock
FROM product_variants;

\echo ''
\echo '--- VARIANTS BEFORE vs AFTER ---'
SELECT 'variant_missing_sku' AS field, 2838 AS before_fill,
  COUNT(*) FILTER (WHERE sku IS NULL OR sku = '') AS after_fill,
  2838 - COUNT(*) FILTER (WHERE sku IS NULL OR sku = '') AS filled
FROM product_variants;

\echo ''
\echo '--- BRANDS: After fill ---'
SELECT
  COUNT(*) AS total_brands,
  COUNT(*) FILTER (WHERE seo_title IS NULL OR seo_title = '')      AS missing_seo_title,
  COUNT(*) FILTER (WHERE seo_canonical_url IS NULL)                AS missing_canonical
FROM brands;

\echo ''
\echo '--- CATEGORIES: After fill ---'
SELECT
  COUNT(*) AS total_categories,
  COUNT(*) FILTER (WHERE seo_title IS NULL OR seo_title = '')  AS missing_seo_title,
  COUNT(*) FILTER (WHERE seo_canonical_url IS NULL)            AS missing_canonical
FROM categories;

\echo ''
\echo '--- GALLERY IMAGES: After fill ---'
SELECT
  COUNT(*) AS total_gallery_images,
  COUNT(*) FILTER (WHERE image_alt IS NULL OR image_alt = '') AS missing_alt
FROM product_gallery_images;

\echo ''
\echo '--- PUBLISH READINESS: DRAFT products now publish-ready ---'
SELECT
  COUNT(*) FILTER (WHERE publish_status = 'DRAFT') AS total_draft,
  COUNT(*) FILTER (WHERE publish_status = 'DRAFT'
    AND name IS NOT NULL AND name <> ''
    AND slug IS NOT NULL AND slug <> ''
    AND image_url IS NOT NULL
    AND retail_price > 0
    AND category_id IS NOT NULL) AS draft_ready_to_publish
FROM products;

\echo ''
\echo '--- SEO CANONICAL SAMPLE (spot check) ---'
SELECT id, LEFT(name, 50) AS name, seo_canonical_url
FROM products
WHERE seo_canonical_url IS NOT NULL
ORDER BY updated_at DESC
LIMIT 5;

\echo ''
\echo '--- SKU SAMPLE (spot check) ---'
SELECT id, sku, LEFT(name, 40) AS name
FROM products
WHERE sku IS NOT NULL
ORDER BY updated_at DESC
LIMIT 5;

\echo ''
\echo '--- VARIANT SKU SAMPLE (spot check) ---'
SELECT pv.id, pv.sku, LEFT(pv.name, 40) AS variant_name
FROM product_variants pv
WHERE pv.sku IS NOT NULL
ORDER BY pv.id DESC
LIMIT 5;

\echo ''
\echo '--- PRE-EXISTING VARIANT SKU DUPLICATES (legacy WP data, NOT touched by fill) ---'
SELECT sku, COUNT(*) AS cnt
FROM product_variants
WHERE sku IS NOT NULL AND sku <> ''
GROUP BY sku
HAVING COUNT(*) > 1
ORDER BY cnt DESC;

\echo ''
\echo '--- FIELDS STILL MISSING (requires human decision) ---'
SELECT
  'short_description'       AS field,
  COUNT(*) FILTER (WHERE short_description IS NULL OR short_description = '') AS missing_count,
  'Cannot safely infer — requires product knowledge' AS reason
FROM products
UNION ALL
SELECT 'brand_id',
  COUNT(*) FILTER (WHERE brand_id IS NULL),
  'Cannot safely assign without brand name matching rules'
FROM products
UNION ALL
SELECT 'image_url (no image at all)',
  COUNT(*) FILTER (WHERE image_url IS NULL AND image_id IS NULL),
  'No image_id or image_url in source data'
FROM products
UNION ALL
SELECT 'retail_price zero/null',
  COUNT(*) FILTER (WHERE retail_price IS NULL OR retail_price <= 0),
  'Cannot infer price — needs operator review'
FROM products
UNION ALL
SELECT 'variant images (no image at all)',
  COUNT(*) FILTER (WHERE image_url IS NULL AND image_id IS NULL),
  'No variant image source in this DB'
FROM product_variants
UNION ALL
SELECT 'variant quantity_on_hand=0',
  COUNT(*) FILTER (WHERE quantity_on_hand = 0),
  'Real stock data needed — cannot fabricate'
FROM product_variants;

\echo ''
\echo '============================================================'
\echo 'VERIFICATION COMPLETE'
\echo '============================================================'
