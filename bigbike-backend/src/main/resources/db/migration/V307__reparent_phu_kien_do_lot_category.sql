-- V307: Owner-confirmed category re-parenting (2026-07-03). "Phụ kiện đồ lót" (wp-cat-305)
-- duplicated the "Đồ lót" portion of "Phụ kiện khác - Đồ lót - Đồ mưa" (wp-cat-299)'s own
-- name while sitting as its own top-level root; nest it under wp-cat-299 as a proper child,
-- matching how "Phụ kiện đi mưa" (wp-cat-297) already covers the "Đồ mưa" portion there.

update categories
set parent_id = 'wp-cat-299'
where id = 'wp-cat-305'
  and parent_id is null;
