-- Adds product_pk (the varchar primary key from the products table) to both
-- cart_items and order_line_items.  This resolves the UUID / varchar(64) mismatch
-- that caused order_line_items.product_id (UUID) to be null for all products
-- created via the admin UI (which use a "prod_<hex32>" string PK, not a UUID).
--
-- Going forward:
--   cart_items.product_pk    = products.id (varchar) set at cart-add time
--   order_line_items.product_pk = products.id (varchar) copied from cart or set at
--                                  quick-buy / POS time
--
-- Historical rows keep product_pk = NULL.  The dashboard top-products query
-- filters on product_pk IS NOT NULL so old rows are simply excluded, which is the
-- same behaviour as before (product_id IS NOT NULL also excluded them).

ALTER TABLE cart_items        ADD COLUMN IF NOT EXISTS product_pk varchar(64);
ALTER TABLE order_line_items  ADD COLUMN IF NOT EXISTS product_pk varchar(64);

CREATE INDEX IF NOT EXISTS idx_order_line_items_product_pk ON order_line_items (product_pk);
