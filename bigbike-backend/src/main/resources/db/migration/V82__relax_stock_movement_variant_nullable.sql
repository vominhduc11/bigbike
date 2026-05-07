-- V82: Relax stock_movements.product_variant_id nullable + add product_id
-- Allows product-level (no variant) stock restore movements to be written.

-- 1. Make variant FK nullable
ALTER TABLE stock_movements ALTER COLUMN product_variant_id DROP NOT NULL;

-- 2. Add product_id column for product-level movements (no FK — denormalised for speed)
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS product_id VARCHAR(255);

-- 3. Drop old combined idempotency index (cannot enforce uniqueness when product_variant_id is NULL,
--    because PostgreSQL treats every NULL as distinct — two (NULL, ref_id) rows would not conflict)
DROP INDEX IF EXISTS idx_stock_movements_order_cancel_unique;

-- 4. Variant-level ORDER_CANCEL idempotency: one restore per variant per order
CREATE UNIQUE INDEX IF NOT EXISTS idx_stock_mv_cancel_variant_unique
    ON stock_movements (product_variant_id, reference_id)
    WHERE reference_type = 'ORDER_CANCEL' AND product_variant_id IS NOT NULL;

-- 5. Product-level ORDER_CANCEL idempotency: one restore per product per order
CREATE UNIQUE INDEX IF NOT EXISTS idx_stock_mv_cancel_product_unique
    ON stock_movements (product_id, reference_id)
    WHERE reference_type = 'ORDER_CANCEL' AND product_variant_id IS NULL AND product_id IS NOT NULL;

-- 6. Variant-level ORDER_REFUND idempotency
CREATE UNIQUE INDEX IF NOT EXISTS idx_stock_mv_refund_variant_unique
    ON stock_movements (product_variant_id, reference_id)
    WHERE reference_type = 'ORDER_REFUND' AND product_variant_id IS NOT NULL;

-- 7. Product-level ORDER_REFUND idempotency
CREATE UNIQUE INDEX IF NOT EXISTS idx_stock_mv_refund_product_unique
    ON stock_movements (product_id, reference_id)
    WHERE reference_type = 'ORDER_REFUND' AND product_variant_id IS NULL AND product_id IS NOT NULL;
