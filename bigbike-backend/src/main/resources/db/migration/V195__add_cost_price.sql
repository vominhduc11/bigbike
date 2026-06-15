-- V195: cost price for products and variants.
-- Used by the POS below-cost guard: a price override below the resolved cost is rejected
-- unless the staff has pos.sell_below_cost. NULL = cost unknown → no enforcement.
ALTER TABLE products         ADD COLUMN IF NOT EXISTS cost_price numeric(19, 2);
ALTER TABLE product_variants ADD COLUMN IF NOT EXISTS cost_price numeric(19, 2);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_products_cost_price_nonneg') THEN
        ALTER TABLE products ADD CONSTRAINT chk_products_cost_price_nonneg
            CHECK (cost_price IS NULL OR cost_price >= 0);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_variants_cost_price_nonneg') THEN
        ALTER TABLE product_variants ADD CONSTRAINT chk_variants_cost_price_nonneg
            CHECK (cost_price IS NULL OR cost_price >= 0);
    END IF;
END $$;
