-- Remove duplicate cart_coupons rows, keeping only the one with the latest created_at per cart.
-- In practice cart_coupons already enforces unique(cart_id, coupon_code) from V20 and the service
-- enforces one-coupon-per-cart at apply time, so duplicates should not exist in production.
DELETE FROM cart_coupons
WHERE id NOT IN (
    SELECT DISTINCT ON (cart_id) id
    FROM cart_coupons
    ORDER BY cart_id, created_at DESC
);

-- Enforce one coupon per cart at the DB level.
ALTER TABLE cart_coupons ADD CONSTRAINT uq_cart_coupons_cart_id UNIQUE (cart_id);
