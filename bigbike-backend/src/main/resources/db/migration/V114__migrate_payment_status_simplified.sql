-- Migrate order payment_status to simplified 4-value set: UNPAID | PAID | REFUNDED | CANCELLED
-- Removed: PENDING → UNPAID, PARTIALLY_PAID → UNPAID, FAILED → CANCELLED, PARTIALLY_REFUNDED → REFUNDED

UPDATE orders SET payment_status = 'UNPAID'   WHERE payment_status IN ('PENDING', 'PARTIALLY_PAID');
UPDATE orders SET payment_status = 'CANCELLED' WHERE payment_status = 'FAILED';
UPDATE orders SET payment_status = 'REFUNDED'  WHERE payment_status = 'PARTIALLY_REFUNDED';
