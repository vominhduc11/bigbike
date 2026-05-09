-- Remove PREORDER and CONTACT_FOR_STOCK stock states.
-- Recompute to IN_STOCK / LOW_STOCK / OUT_OF_STOCK based on actual quantity.
-- Threshold mirrors InventoryPolicyService.FALLBACK_THRESHOLD = 5.

UPDATE products
SET stock_state = CASE
    WHEN stock_quantity IS NULL OR stock_quantity <= 0 THEN 'OUT_OF_STOCK'
    WHEN stock_quantity <= 5                           THEN 'LOW_STOCK'
    ELSE                                                    'IN_STOCK'
END
WHERE stock_state IN ('PREORDER', 'CONTACT_FOR_STOCK');

UPDATE product_variants
SET stock_state = CASE
    WHEN quantity_on_hand IS NULL OR quantity_on_hand <= 0 THEN 'OUT_OF_STOCK'
    WHEN quantity_on_hand <= 5                             THEN 'LOW_STOCK'
    ELSE                                                        'IN_STOCK'
END
WHERE stock_state IN ('PREORDER', 'CONTACT_FOR_STOCK');
