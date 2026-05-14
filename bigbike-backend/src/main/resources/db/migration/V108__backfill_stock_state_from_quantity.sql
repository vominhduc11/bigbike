-- V108: Backfill stock_state from actual quantity for all products and variants.
--
-- Context: stockState was previously a manually-set field on the catalog create/update API.
-- This led to drift where IN_STOCK was stored while quantity_on_hand = 0 (and vice versa).
-- Going forward, stockState is a derived field — always computed from quantity.
-- This migration corrects all existing rows.
--
-- Threshold mirrors InventoryPolicyService.FALLBACK_THRESHOLD = 5.
-- (Runtime reads from site_settings.low_stock_threshold; migrations use the hardcoded fallback.)

-- ── product_variants ──────────────────────────────────────────────────────────

UPDATE product_variants
SET stock_state = CASE
    WHEN quantity_on_hand <= 0 THEN 'OUT_OF_STOCK'
    WHEN quantity_on_hand <= 5 THEN 'LOW_STOCK'
    ELSE                            'IN_STOCK'
END;

-- ── products (no-variant / product-level stock) ───────────────────────────────

UPDATE products
SET stock_state = CASE
    WHEN stock_quantity IS NULL OR stock_quantity <= 0 THEN 'OUT_OF_STOCK'
    WHEN stock_quantity <= 5                           THEN 'LOW_STOCK'
    ELSE                                                    'IN_STOCK'
END;
