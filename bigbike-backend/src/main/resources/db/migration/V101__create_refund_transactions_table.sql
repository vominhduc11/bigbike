-- ORD-007: Each call to applyRefund() appends a row here.
-- Replaces the overwrite-on-refund pattern on orders.refunded_at.
CREATE TABLE refund_transactions (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id    UUID        NOT NULL REFERENCES orders(id),
    payment_id  UUID        REFERENCES payments(id),
    amount      NUMERIC(19,2) NOT NULL CHECK (amount > 0),
    currency    VARCHAR(10) NOT NULL DEFAULT 'VND',
    reason      TEXT,
    note        TEXT,
    admin_id    UUID,
    ip_address  VARCHAR(100),
    user_agent  TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_refund_transactions_order_id ON refund_transactions(order_id);
