-- =============================================================================
-- STEP 4: Brand Assignment — HIGH confidence only
-- Strategy:
--   HIGH: brand.name (trimmed, uppercase) is substring of product.name (uppercase)
--         Tie-break: longest brand name wins (most specific match)
--   MEDIUM: brand.slug appears in product.slug (but NOT in product.name)
--   Only HIGH confidence is applied. MEDIUM exported for review.
-- Safety: never overwrites existing brand_id.
-- =============================================================================

\echo '============================================================'
\echo 'STEP 4: Brand Assignment — Dry Run + Apply'
\echo '============================================================'

\echo ''
\echo '--- DRY RUN: Total products to be matched ---'
WITH matches AS (
  SELECT p.id AS product_id,
         b.id AS brand_id,
         b.name AS brand_name,
         CASE
           WHEN UPPER(p.name) LIKE '%' || UPPER(TRIM(b.name)) || '%' THEN 'HIGH'
           WHEN p.slug LIKE '%' || TRIM(b.slug) || '%' THEN 'MEDIUM'
         END AS confidence
  FROM products p
  CROSS JOIN brands b
  WHERE p.brand_id IS NULL
    AND (
      UPPER(p.name) LIKE '%' || UPPER(TRIM(b.name)) || '%'
      OR p.slug LIKE '%' || TRIM(b.slug) || '%'
    )
),
deduped AS (
  SELECT *,
    ROW_NUMBER() OVER (
      PARTITION BY product_id
      ORDER BY
        CASE confidence WHEN 'HIGH' THEN 1 WHEN 'MEDIUM' THEN 2 END ASC,
        LENGTH(brand_name) DESC
    ) AS rn
  FROM matches
)
SELECT confidence, COUNT(*) AS product_count
FROM deduped WHERE rn = 1
GROUP BY confidence ORDER BY confidence;

\echo ''
\echo '--- DRY RUN: Sample HIGH confidence matches (first 20) ---'
WITH matches AS (
  SELECT p.id AS product_id, LEFT(p.name, 60) AS product_name,
         b.id AS brand_id, b.name AS brand_name,
         CASE
           WHEN UPPER(p.name) LIKE '%' || UPPER(TRIM(b.name)) || '%' THEN 'HIGH'
           WHEN p.slug LIKE '%' || TRIM(b.slug) || '%' THEN 'MEDIUM'
         END AS confidence
  FROM products p
  CROSS JOIN brands b
  WHERE p.brand_id IS NULL
    AND (
      UPPER(p.name) LIKE '%' || UPPER(TRIM(b.name)) || '%'
      OR p.slug LIKE '%' || TRIM(b.slug) || '%'
    )
),
deduped AS (
  SELECT *, ROW_NUMBER() OVER (
    PARTITION BY product_id
    ORDER BY CASE confidence WHEN 'HIGH' THEN 1 WHEN 'MEDIUM' THEN 2 END ASC,
             LENGTH(brand_name) DESC
  ) AS rn FROM matches
)
SELECT product_id, product_name, brand_name, confidence
FROM deduped WHERE rn = 1 AND confidence = 'HIGH'
ORDER BY brand_name, product_name
LIMIT 20;

\echo ''
\echo '--- APPLYING HIGH confidence brand assignments ---'

BEGIN;

WITH matches AS (
  SELECT p.id AS product_id,
         b.id AS brand_id,
         b.name AS brand_name,
         CASE
           WHEN UPPER(p.name) LIKE '%' || UPPER(TRIM(b.name)) || '%' THEN 'HIGH'
           WHEN p.slug LIKE '%' || TRIM(b.slug) || '%' THEN 'MEDIUM'
         END AS confidence
  FROM products p
  CROSS JOIN brands b
  WHERE p.brand_id IS NULL
    AND (
      UPPER(p.name) LIKE '%' || UPPER(TRIM(b.name)) || '%'
      OR p.slug LIKE '%' || TRIM(b.slug) || '%'
    )
),
deduped AS (
  SELECT *,
    ROW_NUMBER() OVER (
      PARTITION BY product_id
      ORDER BY
        CASE confidence WHEN 'HIGH' THEN 1 WHEN 'MEDIUM' THEN 2 END ASC,
        LENGTH(brand_name) DESC
    ) AS rn
  FROM matches
)
UPDATE products p
SET brand_id   = d.brand_id,
    updated_at = now()
FROM deduped d
WHERE p.id = d.product_id
  AND d.rn = 1
  AND d.confidence = 'HIGH'
  AND p.brand_id IS NULL;

COMMIT;

\echo ''
\echo '--- After apply: remaining missing brand ---'
SELECT COUNT(*) AS products_still_no_brand FROM products WHERE brand_id IS NULL;

\echo ''
\echo '--- Brand distribution after fill ---'
SELECT b.name AS brand, COUNT(p.id) AS product_count
FROM products p
LEFT JOIN brands b ON b.id = p.brand_id
WHERE b.id IS NOT NULL
GROUP BY b.name
ORDER BY product_count DESC
LIMIT 15;

\echo '============================================================'
\echo 'STEP 4: DONE'
\echo '============================================================'
