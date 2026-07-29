-- Canonicalize the read-only payment snapshot vocabulary (PAY_RULE_003).
-- Payment records do not control the order lifecycle.

UPDATE payments
SET status = CASE
    WHEN upper(btrim(status)) IN ('UNPAID', 'PENDING', 'PARTIALLY_PAID')
        THEN 'PENDING'
    WHEN upper(btrim(status)) IN ('PAID', 'SUCCEEDED')
        THEN 'SUCCEEDED'
    WHEN upper(btrim(status)) = 'FAILED'
        THEN 'FAILED'
    WHEN upper(btrim(status)) IN ('CANCELLED', 'CANCELED', 'REFUNDED', 'PARTIALLY_REFUNDED')
        THEN 'CANCELLED'
    ELSE upper(btrim(status))
END;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM payments
        WHERE status IS NULL
           OR status NOT IN ('PENDING', 'SUCCEEDED', 'FAILED', 'CANCELLED')
    ) THEN
        RAISE EXCEPTION
            'V353 cannot infer one or more payments.status values; manual classification is required';
    END IF;
END
$$;

ALTER TABLE payments DROP CONSTRAINT IF EXISTS ck_payments_status;
ALTER TABLE payments
    ADD CONSTRAINT ck_payments_status
        CHECK (status IN ('PENDING', 'SUCCEEDED', 'FAILED', 'CANCELLED'));
