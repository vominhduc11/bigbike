-- V95: Add homepage_order column to products.
-- Lets admin manually pin the order of products inside the homepage "Sản phẩm nổi bật"
-- (is_featured=true) and "Sản phẩm trang chủ" (show_on_homepage=true) blocks instead of
-- relying solely on created_at DESC. Lower number = appears earlier; NULL = unpinned and
-- falls to the end (sorted by created_at DESC as before).
--
-- This column is read by both blocks because admin operationally manages a single
-- "homepage priority" (rather than two independent priorities — keeps it simple and
-- matches the admin UI which shows one input field).

alter table products add column if not exists homepage_order integer;

create index if not exists idx_products_homepage_order
    on products (homepage_order)
    where homepage_order is not null;
