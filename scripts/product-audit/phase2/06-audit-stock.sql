-- =============================================================================
-- STEP 6: Stock Audit — READ-ONLY
-- Compares WP legacy stock_quantity (product level) vs
-- product_variants.quantity_on_hand after V30 backfill.
-- Goal: identify products where WP reported stock > 0 but variants all show 0.
-- No DB changes. Report only.
-- =============================================================================

\echo '============================================================'
\echo 'STEP 6: Stock Audit — WP vs Variant quantity_on_hand'
\echo '============================================================'

\echo ''
\echo '--- Overall variant stock distribution ---'
SELECT
  COUNT(*) AS total_variants,
  COUNT(*) FILTER (WHERE quantity_on_hand > 0)  AS in_stock_variants,
  COUNT(*) FILTER (WHERE quantity_on_hand = 0)  AS zero_qty_variants,
  COUNT(*) FILTER (WHERE quantity_on_hand < 0)  AS negative_qty_variants,
  SUM(quantity_on_hand) FILTER (WHERE quantity_on_hand > 0) AS total_units_in_stock
FROM product_variants;

\echo ''
\echo '--- Product-level WP stock vs aggregated variant stock ---'
SELECT
  COUNT(*) AS total_products,
  COUNT(*) FILTER (WHERE p.manage_stock = true AND p.stock_quantity > 0) AS wp_says_in_stock,
  COUNT(*) FILTER (WHERE p.manage_stock = true AND p.stock_quantity > 0
                     AND agg.total_variant_qty = 0)                      AS wp_in_stock_but_variant_zero,
  COUNT(*) FILTER (WHERE p.manage_stock = false OR p.manage_stock IS NULL) AS not_managed
FROM products p
LEFT JOIN (
  SELECT product_id, SUM(quantity_on_hand) AS total_variant_qty
  FROM product_variants
  GROUP BY product_id
) agg ON agg.product_id = p.id;

\echo ''
\echo '--- Products: WP stock_quantity > 0 but all variants quantity_on_hand = 0 ---'
\echo '    (Top 30 by WP stock, ordered by stock desc)'
SELECT
  p.id,
  LEFT(p.name, 55) AS product_name,
  p.sku,
  p.stock_quantity AS wp_stock_qty,
  p.manage_stock,
  agg.variant_count,
  agg.total_variant_qty,
  agg.max_variant_qty,
  p.stock_state AS product_stock_state,
  p.publish_status
FROM products p
JOIN (
  SELECT product_id,
         COUNT(*)               AS variant_count,
         SUM(quantity_on_hand)  AS total_variant_qty,
         MAX(quantity_on_hand)  AS max_variant_qty
  FROM product_variants
  GROUP BY product_id
) agg ON agg.product_id = p.id
WHERE p.manage_stock = true
  AND p.stock_quantity > 0
  AND agg.total_variant_qty = 0
ORDER BY p.stock_quantity DESC
LIMIT 30;

\echo ''
\echo '--- Products with variant stock > 0 (correctly migrated, sample 20) ---'
SELECT
  p.id,
  LEFT(p.name, 55) AS product_name,
  p.stock_quantity AS wp_stock_qty,
  agg.total_variant_qty,
  agg.variant_count,
  p.publish_status
FROM products p
JOIN (
  SELECT product_id,
         COUNT(*)              AS variant_count,
         SUM(quantity_on_hand) AS total_variant_qty
  FROM product_variants
  WHERE quantity_on_hand > 0
  GROUP BY product_id
) agg ON agg.product_id = p.id
ORDER BY agg.total_variant_qty DESC
LIMIT 20;

\echo ''
\echo '--- Variants with stock > 0 (breakdown by stock_state) ---'
SELECT
  pv.stock_state,
  COUNT(*) AS variant_count,
  SUM(pv.quantity_on_hand) AS total_qty,
  AVG(pv.quantity_on_hand)::numeric(10,1) AS avg_qty
FROM product_variants pv
WHERE pv.quantity_on_hand > 0
GROUP BY pv.stock_state
ORDER BY total_qty DESC;

\echo ''
\echo '--- Products where manage_stock=false but variants have qty > 0 ---'
SELECT COUNT(*) AS count
FROM products p
JOIN product_variants pv ON pv.product_id = p.id
WHERE (p.manage_stock = false OR p.manage_stock IS NULL)
  AND pv.quantity_on_hand > 0;

\echo '============================================================'
\echo 'STEP 6: DONE — no DB changes made'
\echo '============================================================'
