-- V117: Auto-enable serial tracking — backfill existing serials
-- Removes the manual enable/disable toggle in favour of auto-activation on first serial add.
-- Any product or variant that already has rows in product_serials must have track_serials = true
-- so the DB trigger correctly maintains quantity_on_hand going forward.

-- Variants with serials
UPDATE product_variants
SET track_serials = true
WHERE track_serials = false
  AND id IN (
      SELECT DISTINCT product_variant_id
      FROM product_serials
      WHERE product_variant_id IS NOT NULL
  );

-- No-variant products with serials
UPDATE products
SET track_serials = true
WHERE track_serials = false
  AND id IN (
      SELECT DISTINCT product_id
      FROM product_serials
      WHERE product_variant_id IS NULL
  );

-- Recompute quantity_on_hand for variants now entering serial-tracking mode.
-- The trigger fn_sync_qty_from_serial_lifecycle fires on status UPDATE; a one-off
-- SELECT COUNT is safer here to avoid N trigger re-fires.
UPDATE product_variants pv
SET quantity_on_hand = (
        SELECT COUNT(*)
        FROM product_serials ps
        WHERE ps.product_variant_id = pv.id
          AND ps.status = 'IN_STOCK'
    ),
    stock_state = CASE
        WHEN (SELECT COUNT(*) FROM product_serials ps WHERE ps.product_variant_id = pv.id AND ps.status = 'IN_STOCK') <= 0
            THEN 'OUT_OF_STOCK'
        WHEN (SELECT COUNT(*) FROM product_serials ps WHERE ps.product_variant_id = pv.id AND ps.status = 'IN_STOCK')
             <= COALESCE((SELECT CAST(setting_value AS INT) FROM site_settings WHERE setting_key = 'low_stock_threshold' LIMIT 1), 5)
            THEN 'LOW_STOCK'
        ELSE 'IN_STOCK'
    END
WHERE pv.track_serials = true;

-- Recompute for no-variant products.
UPDATE products p
SET stock_quantity = (
        SELECT COUNT(*)
        FROM product_serials ps
        WHERE ps.product_id = p.id
          AND ps.product_variant_id IS NULL
          AND ps.status = 'IN_STOCK'
    ),
    stock_state = CASE
        WHEN (SELECT COUNT(*) FROM product_serials ps WHERE ps.product_id = p.id AND ps.product_variant_id IS NULL AND ps.status = 'IN_STOCK') <= 0
            THEN 'OUT_OF_STOCK'
        WHEN (SELECT COUNT(*) FROM product_serials ps WHERE ps.product_id = p.id AND ps.product_variant_id IS NULL AND ps.status = 'IN_STOCK')
             <= COALESCE((SELECT CAST(setting_value AS INT) FROM site_settings WHERE setting_key = 'low_stock_threshold' LIMIT 1), 5)
            THEN 'LOW_STOCK'
        ELSE 'IN_STOCK'
    END
WHERE p.track_serials = true;
