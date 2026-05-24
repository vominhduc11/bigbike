-- =============================================================================
-- STEP 3: Duplicate Variant SKU Fix — DRY RUN (READ-ONLY)
-- =============================================================================

\echo '============================================================'
\echo 'STEP 3: Duplicate Variant SKUs — Dry Run'
\echo '============================================================'

\echo ''
\echo '--- Current duplicates with context ---'
WITH dups AS (
  SELECT sku FROM product_variants
  WHERE sku IS NOT NULL AND sku <> ''
  GROUP BY sku HAVING COUNT(*) > 1
),
ranked AS (
  SELECT pv.sku, pv.id AS variant_id, pv.name AS variant_name,
         pv.product_id, LEFT(p.name, 50) AS product_name, p.sku AS product_sku,
         pv.stock_state, pv.quantity_on_hand,
         ROW_NUMBER() OVER (PARTITION BY pv.sku ORDER BY pv.product_id ASC) AS row_num
  FROM product_variants pv
  JOIN products p ON p.id = pv.product_id
  JOIN dups d ON d.sku = pv.sku
)
SELECT sku, variant_id, variant_name, product_id, product_name,
       stock_state, quantity_on_hand, row_num,
       CASE WHEN row_num = 1 THEN 'KEEP (older product)' ELSE 'RENAME (newer product)' END AS action
FROM ranked
ORDER BY sku, row_num;

\echo ''
\echo '--- Preview: new SKUs for row_num=2 variants ---'
WITH dups AS (
  SELECT sku FROM product_variants
  WHERE sku IS NOT NULL AND sku <> ''
  GROUP BY sku HAVING COUNT(*) > 1
),
ranked AS (
  SELECT pv.id AS variant_id, pv.sku AS old_sku,
         pv.sku || '-' || LPAD(REGEXP_REPLACE(pv.id, '[^0-9]', '', 'g'), 6, '0') AS new_sku,
         ROW_NUMBER() OVER (PARTITION BY pv.sku ORDER BY pv.product_id ASC) AS row_num
  FROM product_variants pv
  JOIN dups d ON d.sku = pv.sku
)
SELECT variant_id, old_sku, new_sku
FROM ranked
WHERE row_num = 2
ORDER BY old_sku;

\echo ''
\echo '--- Safety check: order_line_items references for these SKUs ---'
SELECT oli.sku, COUNT(*) AS order_refs
FROM order_line_items oli
WHERE oli.sku IN (
  SELECT sku FROM product_variants
  WHERE sku IS NOT NULL AND sku <> ''
  GROUP BY sku HAVING COUNT(*) > 1
)
GROUP BY oli.sku;

\echo '(0 rows = safe to proceed)'

\echo ''
\echo '--- Safety check: return_items references ---'
SELECT ri.sku, COUNT(*) AS return_refs
FROM return_items ri
WHERE ri.sku IN (
  SELECT sku FROM product_variants
  WHERE sku IS NOT NULL AND sku <> ''
  GROUP BY sku HAVING COUNT(*) > 1
)
GROUP BY ri.sku;

\echo '(0 rows = safe to proceed)'

\echo ''
\echo '--- Uniqueness check: will generated SKUs be unique? ---'
WITH dups AS (
  SELECT sku FROM product_variants
  WHERE sku IS NOT NULL AND sku <> ''
  GROUP BY sku HAVING COUNT(*) > 1
),
new_skus AS (
  SELECT pv.sku || '-' || LPAD(REGEXP_REPLACE(pv.id, '[^0-9]', '', 'g'), 6, '0') AS gen_sku,
         ROW_NUMBER() OVER (PARTITION BY pv.sku ORDER BY pv.product_id ASC) AS row_num
  FROM product_variants pv JOIN dups d ON d.sku = pv.sku
  WHERE ROW_NUMBER() OVER (PARTITION BY pv.sku ORDER BY pv.product_id ASC) = 2
)
SELECT 'collision_with_existing' AS check_type,
       COUNT(*) AS conflicts
FROM new_skus ns
WHERE ns.row_num = 2
  AND ns.gen_sku IN (
    SELECT sku FROM product_variants WHERE sku IS NOT NULL AND sku <> ''
  );
