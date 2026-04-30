-- Two manual-fill ACF-parity fields carried over from the legacy WP product pages:
--   rating_count   — integer matching the on-page "(N đánh giá)" suffix beside the
--                    star strip. Distinct from any computed reviews aggregate.
--   content_bottom — long-form rich HTML SEO copy that WP renders below the
--                    related-products grid (e.g. "Shop bán đồ phượt moto…").
alter table products
    add column rating_count integer,
    add column content_bottom text;
