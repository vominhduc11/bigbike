-- V259: Remove serial-number management from the whole platform.
--
-- Business decision (2026-06-23, shop owner): drop per-unit serial tracking entirely.
--   • Inventory switches to MANUAL quantity (the legacy quantity_on_hand / stock_quantity path
--     that already existed for non-serial items). Stock numbers are preserved by backfilling
--     from the current IN_STOCK serial counts before the serial tables are dropped.
--   • Warranty is kept but is no longer keyed by serial. warranty_records is repointed to the
--     order (order_number) + customer phone for lookup. Existing warranty rows are preserved and
--     backfilled with order_number / product_name so they remain searchable.
--   • Default warranty period raised 12 -> 24 months (2 years).
--
-- This migration ships together with the code change that deletes the serial entities and the
-- track_serials mappings, so Hibernate schema validation stays consistent after it runs.

-- ── 1. Preserve stock numbers: backfill manual quantity from IN_STOCK serial counts ──────────
-- The DB trigger has been keeping these synced, but recompute defensively before dropping it.

UPDATE product_variants v
SET quantity_on_hand = sub.cnt,
    stock_state = CASE
        WHEN sub.cnt <= 0 THEN 'OUT_OF_STOCK'
        WHEN sub.cnt <= COALESCE((SELECT CAST(setting_value AS INT) FROM site_settings
                                  WHERE setting_key = 'low_stock_threshold' LIMIT 1), 5) THEN 'LOW_STOCK'
        ELSE 'IN_STOCK'
    END
FROM (
    SELECT product_variant_id, COUNT(*) AS cnt
    FROM product_serials
    WHERE product_variant_id IS NOT NULL AND status = 'IN_STOCK'
    GROUP BY product_variant_id
) sub
WHERE v.id = sub.product_variant_id AND v.track_serials = true;

-- Product-level (no-variant) serial products: set stock_quantity from serial count and turn on
-- manage_stock so the legacy decrement path keeps working after serials are gone.
UPDATE products p
SET manage_stock = true,
    stock_quantity = COALESCE((
        SELECT COUNT(*) FROM product_serials ps
        WHERE ps.product_id = p.id AND ps.product_variant_id IS NULL AND ps.status = 'IN_STOCK'
    ), 0)
WHERE p.track_serials = true;

UPDATE products p
SET stock_state = CASE
        WHEN COALESCE(p.stock_quantity, 0) <= 0 THEN 'OUT_OF_STOCK'
        WHEN COALESCE(p.stock_quantity, 0) <= COALESCE((SELECT CAST(setting_value AS INT) FROM site_settings
                                  WHERE setting_key = 'low_stock_threshold' LIMIT 1), 5) THEN 'LOW_STOCK'
        ELSE 'IN_STOCK'
    END
WHERE p.track_serials = true;

-- ── 2. Repoint warranty_records off serial, onto order_number + phone ─────────────────────────
ALTER TABLE warranty_records
    ADD COLUMN IF NOT EXISTS order_id     UUID,
    ADD COLUMN IF NOT EXISTS order_number VARCHAR(64),
    ADD COLUMN IF NOT EXISTS product_name TEXT;

-- Backfill the new lookup columns for existing warranties from their order line item.
UPDATE warranty_records w
SET order_id     = oli.order_id,
    order_number = o.order_number,
    product_name = oli.product_name
FROM order_line_items oli
JOIN orders o ON o.id = oli.order_id
WHERE w.order_line_item_id = oli.id
  AND w.order_id IS NULL;

-- Drop the serial linkage (unique constraint + index + FK column).
ALTER TABLE warranty_records DROP CONSTRAINT IF EXISTS uq_wr_serial;
DROP INDEX IF EXISTS idx_wr_serial;
ALTER TABLE warranty_records DROP COLUMN IF EXISTS serial_id;

-- Lookup indexes for the new order/phone search.
CREATE INDEX IF NOT EXISTS idx_wr_order_number   ON warranty_records (order_number);
CREATE INDEX IF NOT EXISTS idx_wr_customer_phone ON warranty_records (customer_phone);

-- ── 3. Drop the serial -> quantity sync trigger and its function ──────────────────────────────
DROP TRIGGER IF EXISTS trg_serial_lifecycle_sync ON product_serials;
DROP FUNCTION IF EXISTS fn_sync_qty_from_serial_lifecycle();

-- ── 4. Drop the serial tables (bridge tables first, then the lifecycle table) ─────────────────
DROP TABLE IF EXISTS order_line_item_serials CASCADE;
DROP TABLE IF EXISTS return_item_serials     CASCADE;
DROP TABLE IF EXISTS stock_movement_serials  CASCADE;
DROP TABLE IF EXISTS product_serials         CASCADE;

-- ── 5. Drop the track_serials flags ───────────────────────────────────────────────────────────
ALTER TABLE product_variants DROP COLUMN IF EXISTS track_serials;
ALTER TABLE products         DROP COLUMN IF EXISTS track_serials;

-- ── 6. Settings cleanup: remove dead serial settings, raise default warranty to 24 months ─────
DELETE FROM site_settings WHERE setting_key IN ('reservation_ttl_minutes', 'serial_inventory_only');

UPDATE site_settings
SET setting_value = '24', updated_at = now()
WHERE setting_key = 'default_warranty_months';

INSERT INTO site_settings (id, setting_key, setting_value, setting_group, is_public, description, created_at, updated_at)
SELECT gen_random_uuid(), 'default_warranty_months', '24', 'inventory', false,
       'Default warranty duration in months', now(), now()
WHERE NOT EXISTS (SELECT 1 FROM site_settings WHERE setting_key = 'default_warranty_months');
