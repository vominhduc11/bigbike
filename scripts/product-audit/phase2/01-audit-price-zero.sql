-- =============================================================================
-- STEP 1: Audit 73 products with retail_price = 0
-- READ-ONLY. Outputs data to be exported as CSV.
-- =============================================================================

\echo '============================================================'
\echo 'STEP 1: Price-Zero Products Audit'
\echo '============================================================'

\echo ''
\echo '--- Summary: price breakdown for zero-price products ---'
SELECT
  COUNT(*) AS total_zero_price,
  COUNT(*) FILTER (WHERE compare_at_price > 0) AS has_compare_price_nonzero,
  COUNT(*) FILTER (WHERE sale_price > 0)        AS has_sale_price_nonzero,
  COUNT(*) FILTER (WHERE compare_at_price > 0 OR sale_price > 0) AS has_any_price_source,
  COUNT(*) FILTER (WHERE compare_at_price IS NULL AND sale_price IS NULL) AS all_prices_null,
  COUNT(*) FILTER (WHERE compare_at_price = 0 AND (sale_price IS NULL OR sale_price = 0)) AS all_prices_zero
FROM products
WHERE retail_price IS NULL OR retail_price <= 0;

\echo ''
\echo '--- Full list of zero-price products (for CSV export) ---'
SELECT
  p.id,
  p.name,
  p.sku,
  c.name AS category,
  b.name AS brand,
  p.retail_price,
  p.compare_at_price,
  p.sale_price,
  p.stock_quantity AS wp_stock_qty,
  p.publish_status,
  p.image_url IS NOT NULL AS has_image,
  p.legacy_id,
  -- Suggested price: use compare_at_price if > 0, else sale_price if > 0, else NULL
  CASE
    WHEN p.compare_at_price > 0 THEN p.compare_at_price
    WHEN p.sale_price > 0        THEN p.sale_price
    ELSE NULL
  END AS suggested_price,
  CASE
    WHEN p.compare_at_price > 0 THEN 'from compare_at_price'
    WHEN p.sale_price > 0        THEN 'from sale_price'
    ELSE 'no_source_manual_input_required'
  END AS suggestion_reason
FROM products p
LEFT JOIN categories c ON c.id = p.category_id
LEFT JOIN brands b ON b.id = p.brand_id
WHERE p.retail_price IS NULL OR p.retail_price <= 0
ORDER BY c.name, b.name NULLS LAST, p.name;

\echo ''
\echo '--- Category breakdown of zero-price products ---'
SELECT c.name AS category, COUNT(*) AS count
FROM products p
LEFT JOIN categories c ON c.id = p.category_id
WHERE p.retail_price IS NULL OR p.retail_price <= 0
GROUP BY c.name
ORDER BY count DESC;

\echo ''
\echo '--- Brand breakdown (branded ones easier to price externally) ---'
SELECT b.name AS brand, COUNT(*) AS count
FROM products p
LEFT JOIN brands b ON b.id = p.brand_id
WHERE p.retail_price IS NULL OR p.retail_price <= 0
GROUP BY b.name
ORDER BY count DESC;
