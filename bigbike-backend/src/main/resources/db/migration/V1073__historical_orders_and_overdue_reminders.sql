-- Owner decision 2026-08-31: keep imported orders intact while separating them
-- from day-to-day operations. This migration creates empty audit/notification
-- ledgers only; it never classifies or updates an order row.

CREATE TABLE IF NOT EXISTS order_history_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_key VARCHAR(100) NOT NULL UNIQUE,
    label_vi VARCHAR(255) NOT NULL,
    label_en VARCHAR(255) NOT NULL,
    reason_vi TEXT NOT NULL,
    reason_en TEXT NOT NULL,
    criteria_json JSONB NOT NULL,
    expected_total INTEGER NOT NULL CHECK (expected_total >= 0),
    expected_pending INTEGER NOT NULL CHECK (expected_pending >= 0),
    expected_processing INTEGER NOT NULL CHECK (expected_processing >= 0),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    activated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deactivated_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_order_history_batches_active
    ON order_history_batches(active)
    WHERE active = TRUE;

CREATE TABLE IF NOT EXISTS order_history_batch_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id UUID NOT NULL REFERENCES order_history_batches(id) ON DELETE RESTRICT,
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
    classified_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_order_history_batch_order UNIQUE (batch_id, order_id),
    CONSTRAINT uq_order_history_order UNIQUE (order_id)
);

CREATE INDEX IF NOT EXISTS idx_order_history_batch_orders_batch
    ON order_history_batch_orders(batch_id, order_id);

CREATE TABLE IF NOT EXISTS order_overdue_reminder_runs (
    run_date DATE PRIMARY KEY,
    threshold_days INTEGER NOT NULL CHECK (threshold_days >= 1),
    cutoff_at TIMESTAMPTZ NOT NULL,
    candidate_count INTEGER NOT NULL DEFAULT 0 CHECK (candidate_count >= 0),
    notification_id UUID NULL REFERENCES admin_notifications(id) ON DELETE SET NULL,
    completed_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_overdue_runs_notification
    ON order_overdue_reminder_runs(notification_id)
    WHERE notification_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS order_overdue_reminder_orders (
    order_id UUID PRIMARY KEY REFERENCES orders(id) ON DELETE RESTRICT,
    run_date DATE NOT NULL REFERENCES order_overdue_reminder_runs(run_date) ON DELETE RESTRICT,
    reminded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_overdue_reminder_orders_run
    ON order_overdue_reminder_orders(run_date, reminded_at);

INSERT INTO site_settings (
    id, setting_key, setting_value, setting_value_en, setting_group,
    is_public, description, created_at, updated_at
)
VALUES (
    gen_random_uuid(),
    'order_overdue_days',
    '2',
    NULL,
    'order_operations',
    FALSE,
    'Số ngày một đơn vận hành còn chờ xác nhận trước khi được nhắc; mặc định 2.',
    now(),
    now()
)
ON CONFLICT (setting_key) DO UPDATE
SET setting_group = EXCLUDED.setting_group,
    is_public = FALSE,
    description = EXCLUDED.description,
    updated_at = now();
