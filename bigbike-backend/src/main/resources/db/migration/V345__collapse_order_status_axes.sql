-- Collapse the legacy order, payment and fulfillment axes into one order status.
-- Payment records, paid_amount/paid_at and shipment tracking columns are retained.

-- Drop the OLD status CHECK before normalizing: the normalization below writes
-- 'SHIPPING', a value the pre-collapse constraint doesn't allow, so leaving it in
-- place until after the UPDATEs fails on any real order that is already shipped
-- (ck_orders_status violation on BB-20260515-CCE009 in dev).
ALTER TABLE orders DROP CONSTRAINT IF EXISTS ck_orders_status;

-- Normalize legacy order values first so the new CHECK constraint can be applied.
UPDATE orders
   SET status = 'PROCESSING'
 WHERE status = 'ON_HOLD';

UPDATE orders
   SET status = CASE
       WHEN completed_at IS NOT NULL THEN 'COMPLETED'
       ELSE 'SHIPPING'
   END
 WHERE status NOT IN ('COMPLETED', 'CANCELLED')
   AND fulfillment_status IN ('SHIPPED', 'DELIVERED');

UPDATE orders
   SET status = 'CANCELLED',
       cancelled_at = COALESCE(cancelled_at, updated_at)
 WHERE status NOT IN ('COMPLETED', 'CANCELLED')
   AND fulfillment_status = 'CANCELLED';

UPDATE orders
   SET status = 'PENDING'
 WHERE status = 'PENDING_PAYMENT';

ALTER TABLE orders
    ADD CONSTRAINT ck_orders_status
        CHECK (status IN ('PENDING', 'PROCESSING', 'SHIPPING', 'COMPLETED', 'CANCELLED'));

ALTER TABLE orders DROP CONSTRAINT IF EXISTS ck_orders_payment_status;
ALTER TABLE orders DROP CONSTRAINT IF EXISTS ck_orders_fulfillment_status;
DROP INDEX IF EXISTS idx_orders_payment_status;
DROP INDEX IF EXISTS idx_orders_fulfillment_status;
ALTER TABLE orders DROP COLUMN IF EXISTS payment_status;
ALTER TABLE orders DROP COLUMN IF EXISTS fulfillment_status;
