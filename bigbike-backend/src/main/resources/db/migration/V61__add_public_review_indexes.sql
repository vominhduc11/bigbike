-- V61: Speed up public review aggregates + pagination
-- Public reviews always filter by product_id + APPROVED status and sort newest first.
create index if not exists idx_reviews_product_status_created_at
    on reviews (product_id, status, created_at desc, id desc);
