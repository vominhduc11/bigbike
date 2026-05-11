-- Persistent admin notification inbox so offline admins don't miss order events.
-- WebSocket push is still the primary real-time channel; this table is the fallback.
CREATE TABLE admin_notifications (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type        VARCHAR(100) NOT NULL,
    order_id    UUID REFERENCES orders(id) ON DELETE SET NULL,
    order_number VARCHAR(100),
    payload     TEXT,
    is_read     BOOLEAN NOT NULL DEFAULT false,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_admin_notifications_unread ON admin_notifications(is_read, created_at DESC);
