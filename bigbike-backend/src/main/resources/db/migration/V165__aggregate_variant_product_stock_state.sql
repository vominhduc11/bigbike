-- V165: Maintain product-level stock_state as an aggregate of its variants.
--
-- Context (see BUSINESS_RULES.md STOCK_RULE_008):
-- For products WITH variants, the storefront product-level badge reads
-- products.stock_state. Nothing kept it in sync with the variants: V108 set it
-- from stock_quantity (null/0 for variant products), so variant products were
-- stuck at OUT_OF_STOCK permanently -- the web showed "Hết hàng" even while a
-- variant still had stock. Variant stock changes flow through two paths and
-- BOTH only touch product_variants, never the parent product:
--   1. Serial-tracked: fn_sync_qty_from_serial_lifecycle (V89) updates the
--      variant's quantity_on_hand + stock_state from the IN_STOCK serial count.
--   2. Non-serial: Java InventoryPolicyService.recomputeStockState(variant)
--      then variantRepo.save(...) issues UPDATE product_variants ... stock_state.
--
-- This trigger fires on the variant row (the single choke point both paths hit)
-- and recomputes the parent product's stock_state aggregate:
--   any variant IN_STOCK  -> IN_STOCK
--   else any LOW_STOCK     -> LOW_STOCK
--   else                   -> OUT_OF_STOCK   (only when ALL variants are out)
-- forceOutOfStock is a separate purchase override (STOCK_RULE_004) and is NOT
-- considered here.

-- ── 1. Aggregate trigger function ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_sync_product_state_from_variants()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
    v_product_id VARCHAR(255);
    v_has_in     BOOLEAN;
    v_has_low    BOOLEAN;
BEGIN
    v_product_id := COALESCE(NEW.product_id, OLD.product_id);
    IF v_product_id IS NULL THEN
        RETURN COALESCE(NEW, OLD);
    END IF;

    SELECT
        bool_or(stock_state = 'IN_STOCK'),
        bool_or(stock_state = 'LOW_STOCK')
    INTO v_has_in, v_has_low
    FROM product_variants
    WHERE product_id = v_product_id;

    -- No variant rows left (e.g. last variant deleted): leave the product's
    -- stock_state to the no-variant paths instead of clobbering it.
    IF v_has_in IS NULL THEN
        RETURN COALESCE(NEW, OLD);
    END IF;

    UPDATE products
    SET stock_state = CASE
            WHEN v_has_in  THEN 'IN_STOCK'
            WHEN v_has_low THEN 'LOW_STOCK'
            ELSE                'OUT_OF_STOCK'
        END,
        updated_at = now()
    WHERE id = v_product_id;

    RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_product_state_from_variants ON product_variants;
CREATE TRIGGER trg_product_state_from_variants
    AFTER INSERT OR UPDATE OF stock_state OR DELETE
    ON product_variants
    FOR EACH ROW
    EXECUTE FUNCTION fn_sync_product_state_from_variants();

-- ── 2. One-time backfill for already-stuck variant products ───────────────────
-- Without this, products that already drifted (like the imported LS2 FF800)
-- stay wrong until their next variant stock change.
UPDATE products p
SET stock_state = CASE
        WHEN EXISTS (SELECT 1 FROM product_variants v
                     WHERE v.product_id = p.id AND v.stock_state = 'IN_STOCK')  THEN 'IN_STOCK'
        WHEN EXISTS (SELECT 1 FROM product_variants v
                     WHERE v.product_id = p.id AND v.stock_state = 'LOW_STOCK') THEN 'LOW_STOCK'
        ELSE 'OUT_OF_STOCK'
    END,
    updated_at = now()
WHERE EXISTS (SELECT 1 FROM product_variants v WHERE v.product_id = p.id);
