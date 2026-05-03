-- V50: Inventory integrity guards
-- 1. Unique partial index on stock_movements: một đơn hàng chỉ được khôi phục kho một lần
--    (ngăn double-restore khi admin cancel thủ công + job timeout chạy cùng lúc)
CREATE UNIQUE INDEX IF NOT EXISTS idx_stock_movements_order_cancel_unique
    ON stock_movements (product_variant_id, reference_id)
    WHERE reference_type = 'ORDER_CANCEL';

-- 2. Check constraint: số lượng tồn kho không được âm
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'chk_qty_on_hand_non_negative'
          AND conrelid = 'product_variants'::regclass
    ) THEN
        ALTER TABLE product_variants
            ADD CONSTRAINT chk_qty_on_hand_non_negative
            CHECK (quantity_on_hand >= 0);
    END IF;
END
$$;
