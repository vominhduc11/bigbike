-- Remove the coupon / promo-code feature entirely (owner decision 2026-06-23).
-- Drops the three coupon tables FK-safe (CASCADE handles indexes/constraints/FKs)
-- and revokes the coupon permissions from every role. discountAmount columns on
-- carts/orders are intentionally kept (now always ZERO) to keep contracts stable.
--
-- Renumbered to V267 to clear a V265 collision with the parallel POS-removal
-- migration (V265__remove_pos.sql); V264 shipping / V266 warranty also landed
-- around the same time, so this picks the next free number above all of them.

DROP TABLE IF EXISTS cart_coupons CASCADE;
DROP TABLE IF EXISTS order_applied_coupons CASCADE;
DROP TABLE IF EXISTS coupons CASCADE;

DELETE FROM role_permissions WHERE permission IN ('coupons.read', 'coupons.write');
