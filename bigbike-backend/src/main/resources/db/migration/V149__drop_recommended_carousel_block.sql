-- V149: Remove RECOMMENDED_CAROUSEL homepage block.
-- The web storefront never rendered this block; it was invisible to customers
-- and confusing for admins. All products currently in this block are moved to NONE.

UPDATE products
SET homepage_block = 'NONE',
    homepage_order = NULL,
    updated_at     = now()
WHERE homepage_block = 'RECOMMENDED_CAROUSEL';

-- Drop and recreate the check constraint to enforce only NONE|FEATURED_GRID.
ALTER TABLE products DROP CONSTRAINT IF EXISTS ck_products_homepage_block;
ALTER TABLE products
    ADD CONSTRAINT ck_products_homepage_block
        CHECK (homepage_block IN ('NONE', 'FEATURED_GRID'));
