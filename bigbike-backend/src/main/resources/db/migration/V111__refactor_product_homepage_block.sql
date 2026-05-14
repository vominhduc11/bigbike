-- V111: Replace boolean pair (is_featured, show_on_homepage) with single
-- enum column homepage_block. Decision recorded 2026-05-14.
--
-- Why: admins could toggle both flags independently even though the web
-- frontend dedupes — when both were on, the carousel flag was silently
-- ineffective (the featured grid won). This created a "I bật rồi mà không
-- thấy" support pattern. Single enum makes the placement explicit and
-- removes the dedupe logic on the web side.
--
-- Backfill rule (mirrors prior web dedupe at app/page.tsx):
--   is_featured=true                              -> 'FEATURED_GRID'
--   else show_on_homepage=true                    -> 'RECOMMENDED_CAROUSEL'
--   else                                          -> 'NONE'

-- 1. Add new column with default so existing rows are valid immediately.
alter table products
    add column if not exists homepage_block varchar(32) not null default 'NONE';

-- 2. Backfill from the two booleans being dropped.
update products
set homepage_block = case
    when is_featured = true then 'FEATURED_GRID'
    when show_on_homepage = true then 'RECOMMENDED_CAROUSEL'
    else 'NONE'
end;

-- 3. Enforce the enum domain at the database level.
alter table products
    add constraint ck_products_homepage_block
    check (homepage_block in ('NONE', 'FEATURED_GRID', 'RECOMMENDED_CAROUSEL'));

-- 4. Drop the legacy boolean columns now that no code reads them.
alter table products drop column if exists is_featured;
alter table products drop column if exists show_on_homepage;

-- 5. Replace the existing homepage_order partial index with one keyed on the
--    new column so the filter "block != NONE" can use it for the homepage queries.
drop index if exists idx_products_homepage_order;
create index if not exists idx_products_homepage_block_order
    on products (homepage_block, homepage_order)
    where homepage_block <> 'NONE';
