-- =============================================================================
-- Product Data Fill - APPLY
-- Transaction-wrapped. Rolls back on ANY error.
-- Safe: only fills NULL/empty fields, never overwrites existing data.
-- Run via: docker exec -i bigbike-postgres psql -U bigbike -d bigbike
-- =============================================================================

\echo '============================================================'
\echo 'FILL APPLY: STARTING TRANSACTION'
\echo '============================================================'

BEGIN;

-- ---------------------------------------------------------------------------
-- Pre-flight safety checks
-- ---------------------------------------------------------------------------

\echo ''
\echo '--- Pre-flight: Confirm no schema drift ---'
DO $$
BEGIN
  -- Make sure required columns exist
  ASSERT (SELECT COUNT(*) FROM information_schema.columns
          WHERE table_name='products' AND column_name='seo_canonical_url') = 1,
         'products.seo_canonical_url missing';
  ASSERT (SELECT COUNT(*) FROM information_schema.columns
          WHERE table_name='products' AND column_name='seo_title') = 1,
         'products.seo_title missing';
  ASSERT (SELECT COUNT(*) FROM information_schema.columns
          WHERE table_name='brands' AND column_name='seo_canonical_url') = 1,
         'brands.seo_canonical_url missing';
  ASSERT (SELECT COUNT(*) FROM information_schema.columns
          WHERE table_name='categories' AND column_name='seo_canonical_url') = 1,
         'categories.seo_canonical_url missing';
  RAISE NOTICE 'Pre-flight checks passed';
END $$;

-- ---------------------------------------------------------------------------
-- A. products.seo_canonical_url
--    Fill all 1231 products (all currently NULL)
-- ---------------------------------------------------------------------------

\echo ''
\echo '--- [A] Filling products.seo_canonical_url ---'

UPDATE products
SET seo_canonical_url = 'https://bigbike.vn/product/' || slug,
    updated_at        = now()
WHERE seo_canonical_url IS NULL
  AND slug IS NOT NULL AND slug <> '';

\echo 'Done: products.seo_canonical_url'

-- ---------------------------------------------------------------------------
-- B. products.seo_title
--    Fill products missing SEO title from product name
-- ---------------------------------------------------------------------------

\echo ''
\echo '--- [B] Filling products.seo_title ---'

UPDATE products
SET seo_title  = LEFT(name || ' | BigBike Vietnam', 255),
    updated_at = now()
WHERE (seo_title IS NULL OR seo_title = '')
  AND name IS NOT NULL AND name <> '';

\echo 'Done: products.seo_title'

-- ---------------------------------------------------------------------------
-- C. products.seo_description
--    Fill from short_description (if exists) or name + brand tagline
-- ---------------------------------------------------------------------------

\echo ''
\echo '--- [C] Filling products.seo_description ---'

UPDATE products
SET seo_description = LEFT(
      CASE
        WHEN short_description IS NOT NULL AND short_description <> ''
          THEN short_description
        ELSE name || ' - Mua sắm tại BigBike Vietnam, chuyên phụ kiện xe máy, mũ bảo hiểm và bảo hộ chính hãng.'
      END,
      160
    ),
    updated_at = now()
WHERE (seo_description IS NULL OR seo_description = '')
  AND name IS NOT NULL AND name <> '';

\echo 'Done: products.seo_description'

-- ---------------------------------------------------------------------------
-- D. products.image_alt
--    Fill the 1 product with image_url but no alt
-- ---------------------------------------------------------------------------

\echo ''
\echo '--- [D] Filling products.image_alt ---'

UPDATE products
SET image_alt  = LEFT(name, 255),
    updated_at = now()
WHERE (image_alt IS NULL OR image_alt = '')
  AND image_url IS NOT NULL
  AND name IS NOT NULL AND name <> '';

\echo 'Done: products.image_alt'

-- ---------------------------------------------------------------------------
-- E. products.sku
--    Generate deterministic SKU: BB-{CAT_CODE_5}-{PRODUCT_ID_6_DIGITS}
--    Only for products with NULL/empty sku.
--    Uniqueness guaranteed: product IDs are globally unique.
-- ---------------------------------------------------------------------------

\echo ''
\echo '--- [E] Filling products.sku ---'

-- Verify uniqueness of generated SKUs before updating
DO $$
DECLARE
  v_total   integer;
  v_distinct integer;
BEGIN
  SELECT COUNT(*), COUNT(DISTINCT gen_sku)
  INTO v_total, v_distinct
  FROM (
    SELECT 'BB-' ||
             UPPER(SUBSTRING(REPLACE(c.slug, '-', ''), 1, 5)) ||
             '-' ||
             LPAD(REGEXP_REPLACE(p.id, '[^0-9]', '', 'g'), 6, '0') AS gen_sku
    FROM products p
    JOIN categories c ON c.id = p.category_id
    WHERE (p.sku IS NULL OR p.sku = '')
  ) t;

  IF v_total <> v_distinct THEN
    RAISE EXCEPTION 'Product SKU generation would produce % duplicates (total=%, distinct=%). Aborting.',
                    v_total - v_distinct, v_total, v_distinct;
  END IF;

  RAISE NOTICE 'Product SKU uniqueness check passed: % unique SKUs to generate', v_distinct;
END $$;

UPDATE products p
SET sku        = 'BB-' ||
                   UPPER(SUBSTRING(REPLACE(c.slug, '-', ''), 1, 5)) ||
                   '-' ||
                   LPAD(REGEXP_REPLACE(p.id, '[^0-9]', '', 'g'), 6, '0'),
    updated_at = now()
FROM categories c
WHERE p.category_id = c.id
  AND (p.sku IS NULL OR p.sku = '');

\echo 'Done: products.sku'

-- ---------------------------------------------------------------------------
-- F. product_variants.sku
--    Generate: {product_sku}-{variant_numeric_id_6_digits}
--    Uses variant's own numeric ID suffix for guaranteed uniqueness.
--    IMPORTANT: Must run AFTER products.sku fill (step E) so COALESCE
--    can pick up newly-set product SKUs.
-- ---------------------------------------------------------------------------

\echo ''
\echo '--- [F] Filling product_variants.sku ---'

-- Verify uniqueness before updating
DO $$
DECLARE
  v_total    integer;
  v_distinct integer;
  v_conflict integer;
BEGIN
  SELECT COUNT(*), COUNT(DISTINCT gen_sku)
  INTO v_total, v_distinct
  FROM (
    SELECT
      COALESCE(NULLIF(p.sku, ''),
        'BB-' || UPPER(SUBSTRING(REPLACE(c.slug, '-', ''), 1, 5)) || '-' ||
        LPAD(REGEXP_REPLACE(p.id, '[^0-9]', '', 'g'), 6, '0')
      ) || '-' ||
      LPAD(REGEXP_REPLACE(pv.id, '[^0-9]', '', 'g'), 6, '0') AS gen_sku
    FROM product_variants pv
    JOIN products p  ON p.id = pv.product_id
    JOIN categories c ON c.id = p.category_id
    WHERE (pv.sku IS NULL OR pv.sku = '')
  ) t;

  IF v_total <> v_distinct THEN
    RAISE EXCEPTION 'Variant SKU generation would produce % duplicates (total=%, distinct=%). Aborting.',
                    v_total - v_distinct, v_total, v_distinct;
  END IF;

  -- Check conflict with existing variant SKUs
  SELECT COUNT(*) INTO v_conflict
  FROM (
    SELECT
      COALESCE(NULLIF(p.sku, ''),
        'BB-' || UPPER(SUBSTRING(REPLACE(c.slug, '-', ''), 1, 5)) || '-' ||
        LPAD(REGEXP_REPLACE(p.id, '[^0-9]', '', 'g'), 6, '0')
      ) || '-' ||
      LPAD(REGEXP_REPLACE(pv.id, '[^0-9]', '', 'g'), 6, '0') AS gen_sku
    FROM product_variants pv
    JOIN products p  ON p.id = pv.product_id
    JOIN categories c ON c.id = p.category_id
    WHERE (pv.sku IS NULL OR pv.sku = '')
  ) g
  WHERE g.gen_sku IN (
    SELECT sku FROM product_variants WHERE sku IS NOT NULL AND sku <> ''
  );

  IF v_conflict > 0 THEN
    RAISE EXCEPTION 'Variant SKU generation conflicts with % existing SKUs. Aborting.', v_conflict;
  END IF;

  RAISE NOTICE 'Variant SKU uniqueness check passed: % unique SKUs, 0 conflicts', v_distinct;
END $$;

UPDATE product_variants pv
SET sku = COALESCE(NULLIF(p.sku, ''),
            'BB-' || UPPER(SUBSTRING(REPLACE(c.slug, '-', ''), 1, 5)) || '-' ||
            LPAD(REGEXP_REPLACE(p.id, '[^0-9]', '', 'g'), 6, '0')
          ) || '-' ||
          LPAD(REGEXP_REPLACE(pv.id, '[^0-9]', '', 'g'), 6, '0')
FROM products p
JOIN categories c ON c.id = p.category_id
WHERE pv.product_id = p.id
  AND (pv.sku IS NULL OR pv.sku = '');

\echo 'Done: product_variants.sku'

-- ---------------------------------------------------------------------------
-- G. product_gallery_images.image_alt  (3 rows)
--    Fill alt text from parent product name
-- ---------------------------------------------------------------------------

\echo ''
\echo '--- [G] Filling product_gallery_images.image_alt ---'

UPDATE product_gallery_images gi
SET image_alt = LEFT(p.name, 255)
FROM products p
WHERE p.id = gi.product_id
  AND (gi.image_alt IS NULL OR gi.image_alt = '')
  AND p.name IS NOT NULL AND p.name <> '';

\echo 'Done: product_gallery_images.image_alt'

-- ---------------------------------------------------------------------------
-- H. brands: seo_title and seo_canonical_url  (all 46 brands)
-- ---------------------------------------------------------------------------

\echo ''
\echo '--- [H] Filling brands.seo_title ---'

UPDATE brands
SET seo_title  = LEFT(name || ' | BigBike Vietnam', 255),
    updated_at = now()
WHERE (seo_title IS NULL OR seo_title = '')
  AND name IS NOT NULL AND name <> '';

\echo '--- [H] Filling brands.seo_canonical_url ---'

UPDATE brands
SET seo_canonical_url = 'https://bigbike.vn/brands/' || slug,
    updated_at        = now()
WHERE seo_canonical_url IS NULL
  AND slug IS NOT NULL AND slug <> '';

\echo 'Done: brands SEO'

-- ---------------------------------------------------------------------------
-- I. categories: seo_title and seo_canonical_url  (all 45 categories)
-- ---------------------------------------------------------------------------

\echo ''
\echo '--- [I] Filling categories.seo_title ---'

UPDATE categories
SET seo_title  = LEFT(name || ' | BigBike Vietnam', 255),
    updated_at = now()
WHERE (seo_title IS NULL OR seo_title = '')
  AND name IS NOT NULL AND name <> '';

\echo '--- [I] Filling categories.seo_canonical_url ---'

UPDATE categories
SET seo_canonical_url = 'https://bigbike.vn/danh-muc-san-pham/' || slug,
    updated_at        = now()
WHERE seo_canonical_url IS NULL
  AND slug IS NOT NULL AND slug <> '';

\echo 'Done: categories SEO'

-- ---------------------------------------------------------------------------
-- Final integrity check before COMMIT
-- ---------------------------------------------------------------------------

\echo ''
\echo '--- Final integrity check ---'
DO $$
DECLARE
  v_canonical_null   integer;
  v_product_sku_dup  integer;
  v_preexist_var_dup integer;
BEGIN
  -- All products with a slug must now have a canonical URL
  SELECT COUNT(*) INTO v_canonical_null
  FROM products
  WHERE seo_canonical_url IS NULL AND slug IS NOT NULL;

  IF v_canonical_null > 0 THEN
    RAISE EXCEPTION '% products still have NULL canonical URL after fill. Aborting.', v_canonical_null;
  END IF;

  -- Product SKU uniqueness (our filled SKUs use unique product IDs so this must be 0)
  SELECT COUNT(*) - COUNT(DISTINCT sku) INTO v_product_sku_dup
  FROM products
  WHERE sku IS NOT NULL AND sku <> '';

  IF v_product_sku_dup > 0 THEN
    RAISE EXCEPTION '% duplicate product SKUs detected after fill. Aborting.', v_product_sku_dup;
  END IF;

  -- Note: variant SKU uniqueness for newly generated rows was verified in the
  -- pre-flight DO block inside step F. The 12 pre-existing duplicate variant
  -- SKUs in this DB are legacy WP import data (JK63W-m, LS2METROFF324-xl, etc.)
  -- and are not modified by this script — they are tracked in the audit report.
  SELECT COUNT(*) - COUNT(DISTINCT sku) INTO v_preexist_var_dup
  FROM product_variants
  WHERE sku IS NOT NULL AND sku <> '';

  RAISE NOTICE 'All integrity checks passed. % pre-existing duplicate variant SKUs (legacy WP data, not touched by this fill). Committing.', v_preexist_var_dup;
END $$;

COMMIT;

\echo ''
\echo '============================================================'
\echo 'FILL APPLY: COMMITTED SUCCESSFULLY'
\echo '============================================================'
