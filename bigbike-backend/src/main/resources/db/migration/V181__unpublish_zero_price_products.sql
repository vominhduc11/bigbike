-- V181: Unpublish PUBLISHED products that have no sellable price.
--
-- Context:
-- The audit of variant-less products confirmed that "simple" products (no
-- variant) are a supported, by-design pattern — CartService.addItem prices them
-- from the product's own retail/sale price and skips variant resolution. So the
-- 57 variant-less published products are NOT a defect.
--
-- The real residual problem: 4 PUBLISHED products carry retail_price = 0 and
-- have no variant with a valid price, so they cannot be sold meaningfully:
--   * wp-prod-41176 Dual Sport WS-902 Helmet     (0 variants)
--   * wp-prod-39542 QUẦN BẢO HỘ ILM BJN01         (0 variants)
--   * wp-prod-39534 ÁO BẢO HỘ ILM JAM1            (10 variants, all unpriced)
--   * wp-prod-39532 ÁO BẢO HỘ ILM JRF4            (10 variants, all unpriced)
-- The two variant-less ones are worse than cosmetic: resolveUnitPrice only
-- rejects a price < 0 (not 0), and validateQuantityAgainstStock skips the stock
-- gate for manage_stock = false simple products, so they could be added to cart
-- and "sold" for 0₫.
--
-- The correct price is unknown and cannot be invented, so this migration only
-- takes them off the storefront (PUBLISHED -> DRAFT). PUBLISHED -> DRAFT is an
-- allowed publish transition (AdminMutationValidators: "DRAFT <-> PUBLISHED <->
-- HIDDEN"). Staff re-publish each product after entering a real price.
--
-- Idempotent: the publish_status = 'PUBLISHED' guard plus the price condition
-- make a second run a 0-row no-op; once a real price is entered the row no longer
-- matches even if re-published.

UPDATE products p
SET publish_status = 'DRAFT',
    updated_at = now()
WHERE p.publish_status = 'PUBLISHED'
  AND COALESCE(p.retail_price, 0) <= 0
  AND NOT EXISTS (
        SELECT 1 FROM product_variants v
        WHERE v.product_id = p.id AND COALESCE(v.retail_price, 0) > 0
  );
