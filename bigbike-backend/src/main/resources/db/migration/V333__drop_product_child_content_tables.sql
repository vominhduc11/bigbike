-- V332 migrated all product_faqs/product_commitments/product_highlights rows into the new
-- products.faqs/commitments/highlights JSONB columns (added at V331) — safe to drop now.
DROP TABLE IF EXISTS product_faqs;
DROP TABLE IF EXISTS product_commitments;
DROP TABLE IF EXISTS product_highlights;
