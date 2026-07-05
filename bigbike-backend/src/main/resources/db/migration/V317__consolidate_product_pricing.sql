-- Consolidate product pricing model from 4 fields down to 2 (retail_price + sale_price).
-- compare_at_price and cost_price are retired entirely — see BUSINESS_RULES.md PRODUCT_RULE_012
-- and DATA_CONTRACT.md "Product pricing model". cost_price had zero populated rows in production
-- (POS module that needed it was already removed, V265). compare_at_price had become redundant
-- with retail_price/sale_price in practice: wherever it differed meaningfully from retail_price
-- (a real, currently-displayed discount), retail_price already equaled sale_price (or sale_price
-- was unset) — i.e. compare_at_price carried the "was" price while retail_price carried the "is"
-- price, which is exactly what the 2-field model expresses directly.

-- Backfill: fold historical compare_at_price discounts into the 2-field model BEFORE dropping
-- columns. Lossless per the pre-migration data audit (rows where compare_at_price <= retail_price
-- are inert today and need no change; only rows with a real, currently-visible discount are touched).
UPDATE products
SET sale_price = COALESCE(sale_price, retail_price),
    retail_price = compare_at_price
WHERE compare_at_price IS NOT NULL AND compare_at_price > retail_price;

UPDATE product_variants
SET sale_price = COALESCE(sale_price, retail_price),
    retail_price = compare_at_price
WHERE compare_at_price IS NOT NULL AND compare_at_price > retail_price;

-- Drop retired columns. Postgres auto-drops CHECK constraints defined solely on a dropped
-- column (chk_products_cost_price_nonneg, chk_variants_cost_price_nonneg from V195 go away
-- with cost_price) — no separate DROP CONSTRAINT needed.
ALTER TABLE products DROP COLUMN compare_at_price;
ALTER TABLE products DROP COLUMN cost_price;
ALTER TABLE product_variants DROP COLUMN compare_at_price;
ALTER TABLE product_variants DROP COLUMN cost_price;
