-- Remove shipping-method management (owner decision 2026-06-23).
--
-- Online checkout no longer asks the customer to pick a shipping method, online orders carry no
-- shipping fee (shipping_amount stays on the order as a generic financial column, always 0), and the
-- admin "Vận chuyển" (shipping zones/methods) module is removed entirely.
--
-- order_shipping_items is KEPT as a historical snapshot for legacy/imported orders (it stores the
-- denormalised method_code/method_title/amount), but its FK link to shipping_methods is dropped.

-- 1) Drop the per-order link to the methods table (keeps the snapshot columns).
ALTER TABLE order_shipping_items DROP COLUMN IF EXISTS shipping_method_id;

-- 2) Drop the admin-managed shipping configuration tables.
--    shipping_methods references shipping_zones, so drop it first.
DROP TABLE IF EXISTS shipping_methods CASCADE;
DROP TABLE IF EXISTS shipping_zones CASCADE;

-- 3) Remove the now-orphaned shipping permissions from every role.
DELETE FROM role_permissions WHERE permission IN ('shipping.read', 'shipping.write');
