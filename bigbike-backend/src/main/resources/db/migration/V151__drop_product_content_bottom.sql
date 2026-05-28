-- Remove content_bottom and content_bottom_en columns from products.
-- Field was never rendered on bigbike-web; all rows had NULL values (verified 2026-05-28).
ALTER TABLE products
    DROP COLUMN IF EXISTS content_bottom,
    DROP COLUMN IF EXISTS content_bottom_en;
