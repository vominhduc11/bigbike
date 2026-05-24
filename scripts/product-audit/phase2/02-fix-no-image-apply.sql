-- =============================================================================
-- STEP 2: No-image products
-- Part A: Dry-run — show 2 promotable products
-- Part B: Apply — promote first gallery image as main image (2 products only)
-- Part C: Export list of 210 remaining products with no image source
-- =============================================================================

\echo '============================================================'
\echo 'STEP 2: No-Image Products — Promote Gallery Images'
\echo '============================================================'

\echo ''
\echo '--- Part A: Products CAN be auto-fixed (have gallery images) ---'
SELECT p.id, LEFT(p.name, 60) AS name, p.slug,
       gi.image_url AS will_become_main_image,
       gi.image_width, gi.image_height
FROM products p
JOIN product_gallery_images gi ON gi.product_id = p.id
WHERE p.image_url IS NULL AND p.image_id IS NULL
  AND gi.sort_order = (
    SELECT MIN(sort_order) FROM product_gallery_images gi2
    WHERE gi2.product_id = p.id
  );

\echo ''
\echo '--- Part B: APPLYING — promote first gallery image as main image ---'

BEGIN;

UPDATE products p
SET image_url       = gi.image_url,
    image_width     = gi.image_width,
    image_height    = gi.image_height,
    image_mime_type = gi.image_mime_type,
    image_alt       = COALESCE(NULLIF(p.image_alt, ''), NULLIF(gi.image_alt, ''), LEFT(p.name, 255)),
    updated_at      = now()
FROM product_gallery_images gi
WHERE p.id = gi.product_id
  AND p.image_url IS NULL
  AND p.image_id IS NULL
  AND gi.sort_order = (
    SELECT MIN(sort_order) FROM product_gallery_images gi2
    WHERE gi2.product_id = p.id
  );

\echo 'Promoted gallery images for products with gallery but no main image.'

-- Verify
DO $$
DECLARE v_remaining integer;
BEGIN
  SELECT COUNT(*) INTO v_remaining
  FROM products p
  WHERE p.image_url IS NULL AND p.image_id IS NULL
    AND EXISTS (
      SELECT 1 FROM product_gallery_images gi WHERE gi.product_id = p.id
    );
  IF v_remaining > 0 THEN
    RAISE EXCEPTION '% products still missing image despite having gallery. Aborting.', v_remaining;
  END IF;
  RAISE NOTICE 'All promotable products now have main image.';
END $$;

COMMIT;

\echo ''
\echo '--- Part C: Products with NO image source at all (no gallery, no image_id) ---'
SELECT COUNT(*) AS products_still_no_image
FROM products
WHERE image_url IS NULL AND image_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM product_gallery_images gi WHERE gi.product_id = products.id
  );
