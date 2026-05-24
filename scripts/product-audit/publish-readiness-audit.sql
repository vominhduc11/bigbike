-- =============================================================================
-- Publish Readiness Audit — READ-ONLY
-- Phase 3: Classifies all products into publish-readiness buckets.
-- 9 hard gates: name, category, brand, image, retail_price>0,
--               seo_title, seo_description, seo_canonical_url, short_description
-- No DB changes.
-- =============================================================================

\echo '============================================================'
\echo 'Publish Readiness Audit'
\echo '============================================================'

-- ── Core CTE: per-product gate evaluation ──────────────────────────────────
-- Reused across all queries below via a WITH clause.

\echo ''
\echo '--- Summary: products per readiness bucket ---'
WITH gate AS (
  SELECT
    p.id,
    p.publish_status,
    -- Hard gate flags (true = FAILING the gate = problem)
    (p.name IS NULL OR TRIM(p.name) = '')                                                         AS fail_name,
    (p.category_id IS NULL)                                                                        AS fail_category,
    (p.brand_id IS NULL)                                                                           AS fail_brand,
    (p.image_url IS NULL AND p.image_id IS NULL)                                                   AS fail_image,
    (p.retail_price IS NULL OR p.retail_price <= 0)                                                AS fail_price,
    (p.seo_title IS NULL OR TRIM(p.seo_title) = '')                                                AS fail_seo_title,
    (p.seo_description IS NULL OR TRIM(p.seo_description) = '')                                    AS fail_seo_desc,
    (p.seo_canonical_url IS NULL OR TRIM(p.seo_canonical_url) = '')                                AS fail_seo_canonical,
    (p.short_description IS NULL OR TRIM(p.short_description) = '')                                AS fail_short_desc,
    -- Stock info (informational, not a hard gate)
    COALESCE(agg.total_variant_qty, 0) = 0                                                         AS all_variants_oos
  FROM products p
  LEFT JOIN (
    SELECT product_id, SUM(quantity_on_hand) AS total_variant_qty
    FROM product_variants
    GROUP BY product_id
  ) agg ON agg.product_id = p.id
),
classified AS (
  SELECT *,
    (fail_name::int + fail_category::int + fail_brand::int + fail_image::int +
     fail_price::int + fail_seo_title::int + fail_seo_desc::int + fail_seo_canonical::int +
     fail_short_desc::int) AS issue_count,
    NOT (fail_name OR fail_category OR fail_brand OR fail_image OR fail_price OR
         fail_seo_title OR fail_seo_desc OR fail_seo_canonical OR fail_short_desc) AS publish_ready
  FROM gate
)
SELECT
  CASE
    WHEN publish_ready                  THEN '1_publish_ready_strict'
    WHEN issue_count = 1 AND fail_short_desc AND NOT fail_brand AND NOT fail_image AND NOT fail_price
                                        THEN '2_ready_except_short_desc'
    WHEN issue_count = 1 AND fail_brand AND NOT fail_short_desc AND NOT fail_image AND NOT fail_price
                                        THEN '3_ready_except_brand'
    WHEN issue_count = 1 AND fail_price THEN '4_ready_except_price'
    WHEN issue_count = 1 AND fail_image THEN '5_ready_except_image'
    WHEN issue_count >= 2               THEN '6_multiple_issues'
    ELSE                                     '7_other_single_issue'
  END AS bucket,
  COUNT(*) AS product_count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 1) AS pct_of_total
FROM classified
GROUP BY 1
ORDER BY 1;

\echo ''
\echo '--- Hard gate failures: count per gate ---'
WITH gate AS (
  SELECT
    (p.name IS NULL OR TRIM(p.name) = '')                                     AS fail_name,
    (p.category_id IS NULL)                                                    AS fail_category,
    (p.brand_id IS NULL)                                                       AS fail_brand,
    (p.image_url IS NULL AND p.image_id IS NULL)                               AS fail_image,
    (p.retail_price IS NULL OR p.retail_price <= 0)                            AS fail_price,
    (p.seo_title IS NULL OR TRIM(p.seo_title) = '')                            AS fail_seo_title,
    (p.seo_description IS NULL OR TRIM(p.seo_description) = '')                AS fail_seo_desc,
    (p.seo_canonical_url IS NULL OR TRIM(p.seo_canonical_url) = '')            AS fail_seo_canonical,
    (p.short_description IS NULL OR TRIM(p.short_description) = '')            AS fail_short_desc
  FROM products p
)
SELECT gate_name, failures, total,
       ROUND(failures * 100.0 / total, 1) AS pct_failing
FROM (
  SELECT 'name'           AS gate_name, SUM(fail_name::int)           AS failures, COUNT(*) AS total FROM gate
  UNION ALL
  SELECT 'category',      SUM(fail_category::int),      COUNT(*) FROM gate
  UNION ALL
  SELECT 'brand',         SUM(fail_brand::int),         COUNT(*) FROM gate
  UNION ALL
  SELECT 'image',         SUM(fail_image::int),         COUNT(*) FROM gate
  UNION ALL
  SELECT 'retail_price',  SUM(fail_price::int),         COUNT(*) FROM gate
  UNION ALL
  SELECT 'seo_title',     SUM(fail_seo_title::int),     COUNT(*) FROM gate
  UNION ALL
  SELECT 'seo_description',SUM(fail_seo_desc::int),     COUNT(*) FROM gate
  UNION ALL
  SELECT 'seo_canonical', SUM(fail_seo_canonical::int), COUNT(*) FROM gate
  UNION ALL
  SELECT 'short_description', SUM(fail_short_desc::int), COUNT(*) FROM gate
) t
ORDER BY failures DESC;

\echo ''
\echo '--- Publish-ready products (all 9 gates pass) ---'
SELECT
  COUNT(*) FILTER (WHERE publish_status = 'DRAFT')     AS ready_draft,
  COUNT(*) FILTER (WHERE publish_status = 'PUBLISHED') AS ready_published,
  COUNT(*) FILTER (WHERE publish_status = 'HIDDEN')    AS ready_hidden
FROM products p
WHERE (p.name IS NOT NULL AND TRIM(p.name) <> '')
  AND p.category_id IS NOT NULL
  AND p.brand_id IS NOT NULL
  AND (p.image_url IS NOT NULL OR p.image_id IS NOT NULL)
  AND p.retail_price > 0
  AND (p.seo_title IS NOT NULL AND TRIM(p.seo_title) <> '')
  AND (p.seo_description IS NOT NULL AND TRIM(p.seo_description) <> '')
  AND (p.seo_canonical_url IS NOT NULL AND TRIM(p.seo_canonical_url) <> '')
  AND (p.short_description IS NOT NULL AND TRIM(p.short_description) <> '');

\echo ''
\echo '--- Stock cross-cut: all variants OUT_OF_STOCK (informational) ---'
SELECT
  COUNT(*) FILTER (WHERE COALESCE(agg.qty, 0) = 0)  AS products_all_oos,
  COUNT(*) FILTER (WHERE COALESCE(agg.qty, 0) > 0)  AS products_some_in_stock
FROM products p
LEFT JOIN (
  SELECT product_id, SUM(quantity_on_hand) AS qty
  FROM product_variants
  GROUP BY product_id
) agg ON agg.product_id = p.id;

\echo ''
\echo '--- Per-product detail: missing gates (first 40, publish_status=DRAFT) ---'
SELECT
  p.id,
  LEFT(p.name, 45) AS name,
  LEFT(c.name, 20) AS category,
  LEFT(b.name, 15) AS brand,
  p.publish_status,
  CASE WHEN p.brand_id IS NULL THEN 'brand ' ELSE '' END ||
  CASE WHEN p.image_url IS NULL AND p.image_id IS NULL THEN 'image ' ELSE '' END ||
  CASE WHEN p.retail_price IS NULL OR p.retail_price <= 0 THEN 'price ' ELSE '' END ||
  CASE WHEN p.short_description IS NULL OR TRIM(p.short_description)='' THEN 'short_desc ' ELSE '' END ||
  CASE WHEN p.seo_title IS NULL OR TRIM(p.seo_title)='' THEN 'seo_title ' ELSE '' END ||
  CASE WHEN p.seo_description IS NULL OR TRIM(p.seo_description)='' THEN 'seo_desc ' ELSE '' END ||
  CASE WHEN p.seo_canonical_url IS NULL OR TRIM(p.seo_canonical_url)='' THEN 'seo_canonical ' ELSE '' END
  AS missing_gates
FROM products p
LEFT JOIN categories c ON c.id = p.category_id
LEFT JOIN brands b ON b.id = p.brand_id
WHERE p.publish_status = 'DRAFT'
  AND (
    p.brand_id IS NULL
    OR (p.image_url IS NULL AND p.image_id IS NULL)
    OR (p.retail_price IS NULL OR p.retail_price <= 0)
    OR (p.short_description IS NULL OR TRIM(p.short_description) = '')
    OR (p.seo_title IS NULL OR TRIM(p.seo_title) = '')
    OR (p.seo_description IS NULL OR TRIM(p.seo_description) = '')
    OR (p.seo_canonical_url IS NULL OR TRIM(p.seo_canonical_url) = '')
  )
ORDER BY
  -- most complete first (fewest issues)
  (CASE WHEN p.brand_id IS NULL THEN 1 ELSE 0 END +
   CASE WHEN p.image_url IS NULL AND p.image_id IS NULL THEN 1 ELSE 0 END +
   CASE WHEN p.retail_price IS NULL OR p.retail_price <= 0 THEN 1 ELSE 0 END +
   CASE WHEN p.short_description IS NULL OR TRIM(p.short_description)='' THEN 1 ELSE 0 END) ASC,
  c.name, p.name
LIMIT 40;

\echo ''
\echo '--- Operator action summary ---'
SELECT
  'Enter short_description'   AS action_needed,
  COUNT(*) AS products_affected
FROM products WHERE short_description IS NULL OR TRIM(short_description) = ''
UNION ALL
SELECT 'Assign brand',          COUNT(*) FROM products WHERE brand_id IS NULL
UNION ALL
SELECT 'Enter retail price',    COUNT(*) FROM products WHERE retail_price IS NULL OR retail_price <= 0
UNION ALL
SELECT 'Upload main image',     COUNT(*) FROM products WHERE image_url IS NULL AND image_id IS NULL
UNION ALL
SELECT 'Fill SEO fields',       COUNT(*) FROM products WHERE
  seo_title IS NULL OR TRIM(seo_title) = '' OR
  seo_description IS NULL OR TRIM(seo_description) = '' OR
  seo_canonical_url IS NULL OR TRIM(seo_canonical_url) = ''
ORDER BY products_affected DESC;

\echo '============================================================'
\echo 'Publish Readiness Audit — DONE'
\echo '============================================================'
