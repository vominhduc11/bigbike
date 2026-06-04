-- Adds product_variant_pk (the varchar primary key from product_variants) to
-- order_line_items.  This is the variant-side counterpart to V74, which added
-- product_pk for the product side.
--
-- product_variants.id is a varchar string PK ("wp-var-*" for migrated WordPress
-- catalog, "var_<hex>" for admin-created variants), so order_line_items.product_variant_id
-- (UUID) is NULL for every non-UUID variant.  That NULL made the stock-restore paths
-- (OrderStockRestoreService for cancel/refund, AdminReturnService for returns) skip every
-- variant line, leaking inventory on each cancel / refund / completed return (BUG-2).
--
-- Going forward the variant's string id is snapshotted here at line creation on the paths
-- that decrement the variant directly by its string id (POS sale + storefront quick-buy),
-- so restore can resolve the exact variant the same way the sell path does:
-- ProductVariantJpaRepository.findByIdForUpdate(varchar).
--
-- Historical rows keep product_variant_pk = NULL (the id was never captured); those orders
-- fall back to product-level restore, matching how their stock was originally decremented.

ALTER TABLE order_line_items ADD COLUMN IF NOT EXISTS product_variant_pk varchar(64);

CREATE INDEX IF NOT EXISTS idx_order_line_items_product_variant_pk
    ON order_line_items (product_variant_pk);
