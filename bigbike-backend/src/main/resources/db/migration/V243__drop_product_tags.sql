-- Remove the product tag feature entirely.
-- The storefront never consumed these tags (no tag-filter page / search was wired),
-- and the admin tag editor has been removed. Drop the join table first (FK), then the
-- tag table. product_tag_map indexes (V123) and FKs are dropped with the table.
drop table if exists product_tag_map;
drop table if exists product_tags;
