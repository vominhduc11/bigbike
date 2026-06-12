-- Adds product_variant_pk (the varchar primary key from product_variants) to cart_items.
-- Cart-side counterpart of order_line_items.product_variant_pk (V158) and cart_items.product_pk (V74).
--
-- product_variants.id is a varchar string PK ("wp-var-*" for migrated WordPress catalog, UUID-style
-- for admin-created), so the legacy UUID column cart_items.product_variant_id is NULL for every
-- migrated variant. That NULL made CheckoutService's stock-validate and stock-apply passes skip the
-- whole cart line (both guard on the UUID product_id), so a wp-* product bought through the cart was
-- never validated against stock and never decremented/reserved — a silent oversell on the main
-- storefront purchase path. cart_items.product_pk already existed; this adds the variant side so
-- checkout can resolve and decrement the exact variant by its string id.

ALTER TABLE cart_items ADD COLUMN IF NOT EXISTS product_variant_pk varchar(64);

-- Backfill 1 (exact): regular variants whose string PK is a UUID kept it in product_variant_id.
UPDATE cart_items
SET product_variant_pk = product_variant_id::text
WHERE product_variant_pk IS NULL AND product_variant_id IS NOT NULL;

-- Backfill 2 (best-effort): in-flight wp-* cart rows never stored the variant string id, but
-- product_pk + variant_name identify it — only apply when the match is unambiguous (exactly one).
UPDATE cart_items ci
SET product_variant_pk = (
        SELECT pv.id FROM product_variants pv
        WHERE pv.product_id = ci.product_pk AND pv.name = ci.variant_name)
WHERE ci.product_variant_pk IS NULL
  AND ci.product_variant_id IS NULL
  AND ci.product_pk IS NOT NULL
  AND ci.variant_name IS NOT NULL
  AND (SELECT count(*) FROM product_variants pv
       WHERE pv.product_id = ci.product_pk AND pv.name = ci.variant_name) = 1;

CREATE INDEX IF NOT EXISTS idx_cart_items_product_variant_pk
    ON cart_items (product_variant_pk);
