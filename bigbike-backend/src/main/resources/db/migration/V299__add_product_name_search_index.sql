-- Admin product search (buildProductSpec) does LIKE '%q%' on name/slug/sku — a leading
-- wildcard defeats a plain B-tree index. pg_trgm + GIN lets Postgres use an index for
-- substring search instead of a full table scan. Not urgent at today's row count (~300
-- products) but the filter currently runs entirely in Java for the public storefront list
-- (see CatalogReadService) — this is prep for pushing that filter down to SQL, and already
-- helps the admin search endpoint today.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_products_name_trgm ON products USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_products_slug_trgm ON products USING gin (slug gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_products_sku_trgm ON products USING gin (sku gin_trgm_ops);
