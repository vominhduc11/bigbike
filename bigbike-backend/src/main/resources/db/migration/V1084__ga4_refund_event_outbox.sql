-- Durable GA4 revenue correction for an order's first transition to CANCELLED.
-- This is a reporting outbox only; it does not add a financial refund lifecycle.

CREATE TABLE ga4_event_outbox (
    id UUID PRIMARY KEY,
    order_id UUID NOT NULL,
    event_name VARCHAR(32) NOT NULL,
    payload_json TEXT NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'PENDING',
    attempt_count INTEGER NOT NULL DEFAULT 0,
    next_attempt_at TIMESTAMPTZ NOT NULL,
    last_attempt_at TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,
    last_error_code VARCHAR(64),
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT fk_ga4_event_outbox_order
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE RESTRICT,
    CONSTRAINT ck_ga4_event_outbox_event
        CHECK (event_name = 'refund'),
    CONSTRAINT ck_ga4_event_outbox_status
        CHECK (status IN ('PENDING', 'SENDING', 'SENT', 'FAILED')),
    CONSTRAINT ck_ga4_event_outbox_attempt_count
        CHECK (attempt_count >= 0),
    CONSTRAINT ux_ga4_event_outbox_order_event
        UNIQUE (order_id, event_name)
);

CREATE INDEX ix_ga4_event_outbox_dispatch
    ON ga4_event_outbox (next_attempt_at, id)
    WHERE status = 'PENDING';
