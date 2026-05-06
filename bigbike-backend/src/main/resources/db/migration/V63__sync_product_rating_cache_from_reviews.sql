-- Phase 2D source-of-truth shift:
--   reviews.status='APPROVED' is the runtime source-of-truth for product rating.
--   products.rating / products.rating_count remain as denormalized cache fields
--   for fast catalog/detail reads and must be backfilled from approved reviews.
update products p
set rating = (
        select case
                 when count(*) = 0 then null
                 else cast(round(avg(cast(r.rating as numeric(10, 2))), 1) as numeric(3, 2))
               end
        from reviews r
        where r.product_id = p.id
          and r.status = 'APPROVED'
    ),
    rating_count = (
        select cast(count(*) as integer)
        from reviews r
        where r.product_id = p.id
          and r.status = 'APPROVED'
    );
