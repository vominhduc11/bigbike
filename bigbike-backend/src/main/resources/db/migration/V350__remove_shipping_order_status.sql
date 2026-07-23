-- V350: Collapse SHIPPING out of the order status axis; drop shipment tracking fields.
--
-- Owner decision (2026-07-23): the delivery hand-off step is dropped from the order
-- lifecycle. New flow is PENDING -> PROCESSING -> COMPLETED, with CANCELLED branching
-- from PENDING or PROCESSING only. Mirrors the FAILED removal in V344 and the axis
-- collapse in V345: data is preserved, in-flight SHIPPING orders are moved forward to
-- COMPLETED (not backward to PROCESSING) so no order appears to regress, and
-- completed_at is backfilled where missing. Shipment tracking columns
-- (tracking_number, shipping_carrier, shipped_at) are dropped entirely -- the feature
-- is removed, not hidden.

-- 1. Backfill: SHIPPING -> COMPLETED
UPDATE orders
   SET status = 'COMPLETED',
       completed_at = COALESCE(completed_at, updated_at)
 WHERE status = 'SHIPPING';

-- 2. Refresh CHECK constraint to drop SHIPPING
ALTER TABLE orders DROP CONSTRAINT IF EXISTS ck_orders_status;
ALTER TABLE orders
    ADD CONSTRAINT ck_orders_status
        CHECK (status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'CANCELLED'));

-- 3. Drop shipment tracking columns (feature removed, not hidden)
ALTER TABLE orders DROP COLUMN IF EXISTS tracking_number;
ALTER TABLE orders DROP COLUMN IF EXISTS shipping_carrier;
ALTER TABLE orders DROP COLUMN IF EXISTS shipped_at;
