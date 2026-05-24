-- =============================================================================
-- Product Data Fill - DRY RUN (SELECT ONLY, NO CHANGES)
-- Preview all changes before applying.
-- Run via: docker exec -i bigbike-postgres psql -U bigbike -d bigbike
-- =============================================================================

\echo '============================================================'
\echo 'FILL DRY-RUN: PREVIEW CHANGES (READ-ONLY)'
\echo '============================================================'

-- ---------------------------------------------------------------------------
-- A. products.seo_canonical_url  (ALL 1231 products, all NULL)
-- ---------------------------------------------------------------------------

\echo ''
\echo '--- [A] seo_canonical_url: will be filled for how many products ---'
SELECT COUNT(*) AS seo_canonical_to_fill
FROM products
WHERE seo_canonical_url IS NULL
  AND slug IS NOT NULL AND slug <> '';

\echo '--- [A] Sample 5 canonical URLs to be set ---'
SELECT id, slug,
       'https://bigbike.vn/product/' || slug AS new_canonical
FROM products
WHERE seo_canonical_url IS NULL
  AND slug IS NOT NULL
LIMIT 5;

-- ---------------------------------------------------------------------------
-- B. products.seo_title  (479 missing)
-- ---------------------------------------------------------------------------

\echo ''
\echo '--- [B] seo_title: will be filled for how many products ---'
SELECT COUNT(*) AS seo_title_to_fill
FROM products
WHERE (seo_title IS NULL OR seo_title = '')
  AND name IS NOT NULL AND name <> '';

\echo '--- [B] Sample 5 SEO titles to be set ---'
SELECT id,
       LEFT(name, 50) AS product_name,
       LEFT(name || ' | BigBike Vietnam', 255) AS new_seo_title
FROM products
WHERE (seo_title IS NULL OR seo_title = '')
  AND name IS NOT NULL AND name <> ''
LIMIT 5;

-- ---------------------------------------------------------------------------
-- C. products.seo_description  (357 missing)
-- ---------------------------------------------------------------------------

\echo ''
\echo '--- [C] seo_description: will be filled for how many products ---'
SELECT COUNT(*) AS seo_desc_to_fill
FROM products
WHERE (seo_description IS NULL OR seo_description = '')
  AND name IS NOT NULL;

\echo '--- [C] Breakdown: from short_desc vs from name fallback ---'
SELECT
  COUNT(*) FILTER (WHERE short_description IS NOT NULL AND short_description <> '') AS from_short_description,
  COUNT(*) FILTER (WHERE short_description IS NULL OR short_description = '')       AS from_name_fallback
FROM products
WHERE (seo_description IS NULL OR seo_description = '')
  AND name IS NOT NULL;

\echo '--- [C] Sample 3 SEO descriptions to be set ---'
SELECT id,
       LEFT(name, 40) AS product_name,
       LEFT(
         CASE
           WHEN short_description IS NOT NULL AND short_description <> ''
             THEN short_description
           ELSE name || ' - Mua sắm tại BigBike Vietnam, chuyên phụ kiện xe máy, mũ bảo hiểm và bảo hộ chính hãng.'
         END,
         160
       ) AS new_seo_description
FROM products
WHERE (seo_description IS NULL OR seo_description = '')
  AND name IS NOT NULL
LIMIT 3;

-- ---------------------------------------------------------------------------
-- D. products.image_alt  (1 product with image_url but no alt)
-- ---------------------------------------------------------------------------

\echo ''
\echo '--- [D] image_alt: products with image_url but missing alt ---'
SELECT id, LEFT(name, 60) AS name, image_url IS NOT NULL AS has_image
FROM products
WHERE (image_alt IS NULL OR image_alt = '')
  AND image_url IS NOT NULL
  AND name IS NOT NULL;

-- ---------------------------------------------------------------------------
-- E. products.sku  (290 missing)
-- ---------------------------------------------------------------------------

\echo ''
\echo '--- [E] sku: will be filled for how many products ---'
SELECT COUNT(*) AS sku_to_fill
FROM products p
JOIN categories c ON c.id = p.category_id
WHERE (p.sku IS NULL OR p.sku = '');

\echo '--- [E] Sample 5 SKUs to be generated ---'
SELECT p.id,
       LEFT(p.name, 40) AS product_name,
       c.slug AS category_slug,
       'BB-' ||
         UPPER(SUBSTRING(REPLACE(c.slug, '-', ''), 1, 5)) ||
         '-' ||
         LPAD(REGEXP_REPLACE(p.id, '[^0-9]', '', 'g'), 6, '0') AS new_sku
FROM products p
JOIN categories c ON c.id = p.category_id
WHERE (p.sku IS NULL OR p.sku = '')
LIMIT 5;

\echo '--- [E] Check uniqueness of generated SKUs (count vs distinct) ---'
WITH generated AS (
  SELECT
    'BB-' ||
      UPPER(SUBSTRING(REPLACE(c.slug, '-', ''), 1, 5)) ||
      '-' ||
      LPAD(REGEXP_REPLACE(p.id, '[^0-9]', '', 'g'), 6, '0') AS gen_sku
  FROM products p
  JOIN categories c ON c.id = p.category_id
  WHERE (p.sku IS NULL OR p.sku = '')
)
SELECT COUNT(*) AS total_generated, COUNT(DISTINCT gen_sku) AS distinct_generated
FROM generated;

\echo '--- [E] Conflict with existing SKUs (should be 0) ---'
WITH generated AS (
  SELECT p.id,
    'BB-' ||
      UPPER(SUBSTRING(REPLACE(c.slug, '-', ''), 1, 5)) ||
      '-' ||
      LPAD(REGEXP_REPLACE(p.id, '[^0-9]', '', 'g'), 6, '0') AS gen_sku
  FROM products p
  JOIN categories c ON c.id = p.category_id
  WHERE (p.sku IS NULL OR p.sku = '')
)
SELECT COUNT(*) AS conflicts_with_existing_skus
FROM generated g
WHERE g.gen_sku IN (SELECT sku FROM products WHERE sku IS NOT NULL AND sku <> '');

-- ---------------------------------------------------------------------------
-- F. product_variants.sku  (2838 missing)
-- ---------------------------------------------------------------------------

\echo ''
\echo '--- [F] variant sku: will be filled for how many variants ---'
SELECT COUNT(*) AS variant_sku_to_fill
FROM product_variants
WHERE sku IS NULL OR sku = '';

\echo '--- [F] Sample 5 variant SKUs to be generated ---'
SELECT pv.id AS variant_id,
       LEFT(pv.name, 40) AS variant_name,
       COALESCE(
         NULLIF(p.sku, ''),
         'BB-' || UPPER(SUBSTRING(REPLACE(c.slug, '-', ''), 1, 5)) || '-' ||
         LPAD(REGEXP_REPLACE(p.id, '[^0-9]', '', 'g'), 6, '0')
       ) || '-V' || LPAD(pv.sort_order::text, 2, '0') AS new_variant_sku
FROM product_variants pv
JOIN products p ON p.id = pv.product_id
JOIN categories c ON c.id = p.category_id
WHERE pv.sku IS NULL OR pv.sku = ''
LIMIT 5;

\echo '--- [F] Check uniqueness of generated variant SKUs ---'
WITH generated AS (
  SELECT
    COALESCE(
      NULLIF(p.sku, ''),
      'BB-' || UPPER(SUBSTRING(REPLACE(c.slug, '-', ''), 1, 5)) || '-' ||
      LPAD(REGEXP_REPLACE(p.id, '[^0-9]', '', 'g'), 6, '0')
    ) || '-V' || LPAD(pv.sort_order::text, 2, '0') AS gen_sku
  FROM product_variants pv
  JOIN products p ON p.id = pv.product_id
  JOIN categories c ON c.id = p.category_id
  WHERE pv.sku IS NULL OR pv.sku = ''
)
SELECT COUNT(*) AS total_generated, COUNT(DISTINCT gen_sku) AS distinct_generated
FROM generated;

-- ---------------------------------------------------------------------------
-- G. product_gallery_images.image_alt  (3 missing)
-- ---------------------------------------------------------------------------

\echo ''
\echo '--- [G] gallery image_alt: will be filled for how many rows ---'
SELECT COUNT(*) AS gallery_alt_to_fill
FROM product_gallery_images gi
JOIN products p ON p.id = gi.product_id
WHERE (gi.image_alt IS NULL OR gi.image_alt = '')
  AND p.name IS NOT NULL;

-- ---------------------------------------------------------------------------
-- H. brands.seo_title & seo_canonical_url  (all 46 missing seo_title)
-- ---------------------------------------------------------------------------

\echo ''
\echo '--- [H] brands seo_title & canonical: fillable count ---'
SELECT
  COUNT(*) FILTER (WHERE seo_title IS NULL OR seo_title = '') AS brands_missing_seo_title,
  COUNT(*) FILTER (WHERE seo_canonical_url IS NULL)           AS brands_missing_canonical
FROM brands;

\echo '--- [H] Sample 3 brand fills ---'
SELECT id, name, slug,
       LEFT(name || ' | BigBike Vietnam', 255) AS new_seo_title,
       'https://bigbike.vn/brands/' || slug AS new_canonical
FROM brands
WHERE (seo_title IS NULL OR seo_title = '')
LIMIT 3;

-- ---------------------------------------------------------------------------
-- I. categories.seo_title & seo_canonical_url  (all 45 missing seo_title)
-- ---------------------------------------------------------------------------

\echo ''
\echo '--- [I] categories seo_title & canonical: fillable count ---'
SELECT
  COUNT(*) FILTER (WHERE seo_title IS NULL OR seo_title = '') AS cats_missing_seo_title,
  COUNT(*) FILTER (WHERE seo_canonical_url IS NULL)           AS cats_missing_canonical
FROM categories;

\echo '--- [I] Sample 3 category fills ---'
SELECT id, name, slug,
       LEFT(name || ' | BigBike Vietnam', 255) AS new_seo_title,
       'https://bigbike.vn/danh-muc-san-pham/' || slug AS new_canonical
FROM categories
WHERE (seo_title IS NULL OR seo_title = '')
LIMIT 3;

-- ---------------------------------------------------------------------------
-- Summary
-- ---------------------------------------------------------------------------

\echo ''
\echo '============================================================'
\echo 'DRY-RUN SUMMARY: Changes to be applied'
\echo '============================================================'
SELECT
  (SELECT COUNT(*) FROM products WHERE seo_canonical_url IS NULL AND slug IS NOT NULL)
    AS products_canonical_to_fill,
  (SELECT COUNT(*) FROM products WHERE (seo_title IS NULL OR seo_title = '') AND name IS NOT NULL)
    AS products_seo_title_to_fill,
  (SELECT COUNT(*) FROM products WHERE (seo_description IS NULL OR seo_description = '') AND name IS NOT NULL)
    AS products_seo_desc_to_fill,
  (SELECT COUNT(*) FROM products WHERE (image_alt IS NULL OR image_alt = '') AND image_url IS NOT NULL AND name IS NOT NULL)
    AS products_image_alt_to_fill,
  (SELECT COUNT(*) FROM products p JOIN categories c ON c.id=p.category_id WHERE p.sku IS NULL OR p.sku = '')
    AS products_sku_to_fill,
  (SELECT COUNT(*) FROM product_variants WHERE sku IS NULL OR sku = '')
    AS variants_sku_to_fill,
  (SELECT COUNT(*) FROM product_gallery_images gi JOIN products p ON p.id=gi.product_id WHERE gi.image_alt IS NULL OR gi.image_alt = '')
    AS gallery_alt_to_fill,
  (SELECT COUNT(*) FROM brands WHERE seo_title IS NULL OR seo_title = '')
    AS brands_seo_title_to_fill,
  (SELECT COUNT(*) FROM brands WHERE seo_canonical_url IS NULL)
    AS brands_canonical_to_fill,
  (SELECT COUNT(*) FROM categories WHERE seo_title IS NULL OR seo_title = '')
    AS categories_seo_title_to_fill,
  (SELECT COUNT(*) FROM categories WHERE seo_canonical_url IS NULL)
    AS categories_canonical_to_fill;

\echo ''
\echo 'NOT FILLED (requires human decision):'
SELECT
  (SELECT COUNT(*) FROM products WHERE (short_description IS NULL OR short_description = '')) AS products_short_desc_not_filled,
  (SELECT COUNT(*) FROM products WHERE brand_id IS NULL)                                      AS products_brand_not_filled,
  (SELECT COUNT(*) FROM products WHERE image_url IS NULL AND image_id IS NULL)                AS products_no_image_not_filled,
  (SELECT COUNT(*) FROM products WHERE retail_price = 0 OR retail_price IS NULL)              AS products_zero_price_not_filled,
  (SELECT COUNT(*) FROM product_variants WHERE image_url IS NULL AND image_id IS NULL)        AS variants_no_image_not_filled,
  (SELECT COUNT(*) FROM product_variants WHERE quantity_on_hand = 0)                          AS variants_zero_stock_not_filled;
