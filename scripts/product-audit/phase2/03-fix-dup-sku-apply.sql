-- =============================================================================
-- STEP 3: Duplicate Variant SKU Fix — APPLY
-- Renames row_num=2 variant in each duplicate group.
-- Strategy: keep older variant (lower product_id ASC, then lower variant id ASC),
--           rename newer variant by appending -VVVVVV (6-digit variant ID suffix).
-- SKU is denormalized string in order/return/receipt tables — zero cascading risk.
-- =============================================================================

\echo '============================================================'
\echo 'STEP 3: Duplicate Variant SKUs — APPLY'
\echo '============================================================'

BEGIN;

-- Safety gate: confirm 0 order references before proceeding
DO $$
DECLARE v_order_refs integer;
        v_return_refs integer;
BEGIN
  SELECT COUNT(*) INTO v_order_refs
  FROM order_line_items oli
  WHERE oli.sku IN (
    SELECT sku FROM product_variants
    WHERE sku IS NOT NULL AND sku <> ''
    GROUP BY sku HAVING COUNT(*) > 1
  );

  SELECT COUNT(*) INTO v_return_refs
  FROM return_items ri
  WHERE ri.sku IN (
    SELECT sku FROM product_variants
    WHERE sku IS NOT NULL AND sku <> ''
    GROUP BY sku HAVING COUNT(*) > 1
  );

  IF v_order_refs > 0 OR v_return_refs > 0 THEN
    RAISE EXCEPTION 'Duplicate SKUs referenced in orders (%) or returns (%). Aborting.', v_order_refs, v_return_refs;
  END IF;
  RAISE NOTICE 'Safety gate passed: 0 order refs, 0 return refs.';
END $$;

-- Uniqueness check: confirm new SKUs do not collide with existing SKUs
DO $$
DECLARE v_conflicts integer;
BEGIN
  WITH dups AS (
    SELECT sku FROM product_variants
    WHERE sku IS NOT NULL AND sku <> ''
    GROUP BY sku HAVING COUNT(*) > 1
  ),
  to_rename AS (
    SELECT pv.id,
           pv.sku || '-' || LPAD(REGEXP_REPLACE(pv.id, '[^0-9]', '', 'g'), 6, '0') AS new_sku,
           ROW_NUMBER() OVER (
             PARTITION BY pv.sku
             ORDER BY pv.product_id ASC, pv.id ASC
           ) AS row_num
    FROM product_variants pv JOIN dups d ON d.sku = pv.sku
  )
  SELECT COUNT(*) INTO v_conflicts
  FROM to_rename r
  WHERE r.row_num = 2
    AND r.new_sku IN (
      SELECT sku FROM product_variants WHERE sku IS NOT NULL AND sku <> ''
    );

  IF v_conflicts > 0 THEN
    RAISE EXCEPTION 'Generated SKUs conflict with % existing SKUs. Aborting.', v_conflicts;
  END IF;
  RAISE NOTICE 'Uniqueness check passed: 0 conflicts with existing SKUs.';
END $$;

-- Apply: rename row_num=2 variant in each duplicate group
WITH dups AS (
  SELECT sku FROM product_variants
  WHERE sku IS NOT NULL AND sku <> ''
  GROUP BY sku HAVING COUNT(*) > 1
),
to_rename AS (
  SELECT pv.id,
         pv.sku || '-' || LPAD(REGEXP_REPLACE(pv.id, '[^0-9]', '', 'g'), 6, '0') AS new_sku,
         ROW_NUMBER() OVER (
           PARTITION BY pv.sku
           ORDER BY pv.product_id ASC, pv.id ASC
         ) AS row_num
  FROM product_variants pv JOIN dups d ON d.sku = pv.sku
)
UPDATE product_variants pv
SET sku = r.new_sku
FROM to_rename r
WHERE pv.id = r.id AND r.row_num = 2;

\echo 'Renamed duplicate variant SKUs.'

-- Verify: 0 duplicates remain
DO $$
DECLARE v_remaining integer;
BEGIN
  SELECT COUNT(*) INTO v_remaining
  FROM (
    SELECT sku FROM product_variants
    WHERE sku IS NOT NULL AND sku <> ''
    GROUP BY sku HAVING COUNT(*) > 1
  ) t;

  IF v_remaining > 0 THEN
    RAISE EXCEPTION '% duplicate variant SKUs still remain after fix. Aborting.', v_remaining;
  END IF;
  RAISE NOTICE 'All duplicate variant SKUs resolved. 0 duplicates remain.';
END $$;

COMMIT;

\echo ''
\echo '--- Verification: duplicate count after fix ---'
SELECT COUNT(*) AS remaining_duplicates
FROM (
  SELECT sku FROM product_variants
  WHERE sku IS NOT NULL AND sku <> ''
  GROUP BY sku HAVING COUNT(*) > 1
) t;

\echo ''
\echo '--- Renamed variants (for audit trail) ---'
SELECT pv.id AS variant_id, pv.sku AS new_sku, LEFT(p.name, 50) AS product_name
FROM product_variants pv
JOIN products p ON p.id = pv.product_id
WHERE pv.sku LIKE '%-0%'  -- suffixed format: ends with 6-digit numeric suffix
  AND LENGTH(pv.sku) > 10
  AND pv.sku ~ '-[0-9]{6}$'
ORDER BY pv.sku;

\echo '============================================================'
\echo 'STEP 3: DONE'
\echo '============================================================'
