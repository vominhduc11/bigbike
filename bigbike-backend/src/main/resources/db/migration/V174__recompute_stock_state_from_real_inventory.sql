-- V174: Recompute stock_state from real inventory (remove WP-import "còn hàng ảo").
--
-- Context (see BUSINESS_RULES.md STOCK_RULE_001/003, DATA_CONTRACT.md
-- "stockState — derived field"):
-- The legacy WordPress importer mapped WooCommerce `instock` straight to
-- IN_STOCK without counting real quantity/serials, so imported products and
-- variants showed "Còn hàng" while quantity_on_hand / stock_quantity was 0 and
-- no IN_STOCK serial existed. The importer has since been fixed (commit
-- 9846c196: every imported product/variant starts OUT_OF_STOCK until real
-- stock arrives), but that only affects future imports — existing rows kept the
-- fake IN_STOCK state. This migration backfills the derived field for the
-- already-imported data so every environment converges.
--
-- Rule applied (derived field, qty-based — manage_stock does NOT exempt a row):
--   stockState = OUT_OF_STOCK  when quantity <= 0 AND no IN_STOCK serial
-- Rows with real stock (quantity > 0 OR an IN_STOCK serial) are left untouched.
-- forceOutOfStock (STOCK_RULE_004) is a separate purchase override and is not
-- considered here.
--
-- Idempotent: the `stock_state <> 'OUT_OF_STOCK'` guard makes a second run a
-- 0-row no-op. On environments already cleaned via re-import this is a no-op.

-- ── 1. Variants ───────────────────────────────────────────────────────────────
-- The product-level aggregate trigger (V174's predecessor V165,
-- trg_product_state_from_variants) fires on these stock_state changes and
-- recomputes products.stock_state for products that HAVE variants.
UPDATE product_variants v
SET stock_state = 'OUT_OF_STOCK'
WHERE v.stock_state <> 'OUT_OF_STOCK'
  AND COALESCE(v.quantity_on_hand, 0) <= 0
  AND NOT EXISTS (
        SELECT 1 FROM product_serials ps
        WHERE ps.product_variant_id = v.id
          AND ps.status = 'IN_STOCK'
  );

-- ── 2. Variant-less (simple) products ────────────────────────────────────────
-- Products with NO variants are not reached by the aggregate trigger; their
-- stock_state derives from products.stock_quantity (DATA_CONTRACT.md). Fix them
-- directly. Products WITH variants are excluded — the trigger owns those.
UPDATE products p
SET stock_state = 'OUT_OF_STOCK',
    updated_at = now()
WHERE p.stock_state <> 'OUT_OF_STOCK'
  AND NOT EXISTS (SELECT 1 FROM product_variants v WHERE v.product_id = p.id)
  AND COALESCE(p.stock_quantity, 0) <= 0
  AND NOT EXISTS (
        SELECT 1 FROM product_serials ps
        WHERE ps.product_id = p.id
          AND ps.status = 'IN_STOCK'
  );
