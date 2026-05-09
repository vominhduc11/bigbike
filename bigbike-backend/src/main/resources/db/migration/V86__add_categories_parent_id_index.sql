-- V86: Index on categories.parent_id
--
-- Storefront and admin tree-build queries filter children by parent_id
-- (e.g. "list direct children of a category", "build category tree").
-- Without this index Postgres seq-scans the categories table on every
-- such lookup, which becomes painful as the catalog grows beyond a few
-- hundred rows.

create index if not exists idx_categories_parent_id
    on categories (parent_id);
