-- Remove seo_no_index from all tables — field was never used (all rows NULL/false, verified 2026-05-28).
ALTER TABLE products    DROP COLUMN IF EXISTS seo_no_index;
ALTER TABLE categories  DROP COLUMN IF EXISTS seo_no_index;
ALTER TABLE brands      DROP COLUMN IF EXISTS seo_no_index;
ALTER TABLE articles    DROP COLUMN IF EXISTS seo_no_index;
ALTER TABLE pages       DROP COLUMN IF EXISTS seo_no_index;
