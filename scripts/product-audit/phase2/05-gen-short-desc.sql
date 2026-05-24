-- =============================================================================
-- STEP 5: Short Description Draft — READ-ONLY CSV Export
-- Generates draft short_description for products missing it.
-- Scope: products with name + category_id + brand_id filled (publish-ready
--        data) but short_description IS NULL or empty.
-- NO DB changes — CSV export only. Operator must review and apply.
-- =============================================================================

\echo '============================================================'
\echo 'STEP 5: Short Description Draft — Export Only'
\echo '============================================================'

\echo ''
\echo '--- Summary: short_description coverage ---'
SELECT
  COUNT(*) FILTER (WHERE short_description IS NOT NULL AND TRIM(short_description) <> '') AS has_short_desc,
  COUNT(*) FILTER (WHERE short_description IS NULL OR TRIM(short_description) = '')       AS missing_short_desc,
  COUNT(*) FILTER (WHERE short_description IS NULL OR TRIM(short_description) = ''
                     AND category_id IS NOT NULL AND brand_id IS NOT NULL)               AS missing_with_cat_and_brand,
  COUNT(*) FILTER (WHERE short_description IS NULL OR TRIM(short_description) = ''
                     AND category_id IS NOT NULL AND brand_id IS NULL)                   AS missing_cat_only,
  COUNT(*) FILTER (WHERE short_description IS NULL OR TRIM(short_description) = ''
                     AND category_id IS NULL)                                            AS missing_no_cat
FROM products;

\echo ''
\echo '--- Draft short_description for missing products ---'
\echo '    Copy this output as CSV to docs/audits/product-short-description-review.csv'
\echo ''

SELECT
  p.id,
  p.name,
  p.sku,
  p.publish_status,
  c.name AS category,
  b.name AS brand,
  CASE
    WHEN b.name IS NOT NULL AND c.name IS NOT NULL THEN
      p.name || ' là sản phẩm ' || c.name || ' chính hãng từ thương hiệu ' || b.name || '. Mua tại BigBike Vietnam với chất lượng đảm bảo, bảo hành chính hãng.'
    WHEN b.name IS NULL AND c.name IS NOT NULL THEN
      p.name || ' là sản phẩm ' || c.name || ' chất lượng cao. Mua tại BigBike Vietnam với chất lượng đảm bảo, bảo hành chính hãng.'
    WHEN b.name IS NOT NULL AND c.name IS NULL THEN
      p.name || ' là sản phẩm chính hãng từ thương hiệu ' || b.name || '. Mua tại BigBike Vietnam với chất lượng đảm bảo, bảo hành chính hãng.'
    ELSE
      p.name || ' là sản phẩm phụ kiện xe máy chất lượng cao. Mua tại BigBike Vietnam với chất lượng đảm bảo, bảo hành chính hãng.'
  END AS draft_short_description
FROM products p
LEFT JOIN categories c ON c.id = p.category_id
LEFT JOIN brands b ON b.id = p.brand_id
WHERE p.short_description IS NULL OR TRIM(p.short_description) = ''
ORDER BY
  -- Publish-ready first (name + category + brand + price + image)
  CASE
    WHEN p.retail_price > 0
      AND p.category_id IS NOT NULL
      AND p.brand_id IS NOT NULL
      AND (p.image_url IS NOT NULL OR p.image_id IS NOT NULL)
    THEN 1 ELSE 2
  END,
  c.name NULLS LAST, b.name NULLS LAST, p.name;

\echo ''
\echo '--- Stats: draft quality breakdown ---'
SELECT
  CASE
    WHEN b.name IS NOT NULL AND c.name IS NOT NULL THEN 'brand + category (best)'
    WHEN b.name IS NULL AND c.name IS NOT NULL     THEN 'category only'
    WHEN b.name IS NOT NULL AND c.name IS NULL     THEN 'brand only'
    ELSE 'name only (weakest)'
  END AS draft_quality,
  COUNT(*) AS product_count
FROM products p
LEFT JOIN categories c ON c.id = p.category_id
LEFT JOIN brands b ON b.id = p.brand_id
WHERE p.short_description IS NULL OR TRIM(p.short_description) = ''
GROUP BY 1
ORDER BY product_count DESC;

\echo '============================================================'
\echo 'STEP 5: DONE — no DB changes made'
\echo '============================================================'
