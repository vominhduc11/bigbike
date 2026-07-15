-- Per-admin read state for the admin notification inbox (AUD-018/AUD-019).
-- Before: admin_notifications.is_read was a single global flag — one admin opening the
-- bell marked every notification read for EVERY admin, so others missed new orders.
-- Now each admin keeps their own high-water mark: everything created after last_read_at
-- is unread for that admin. "Mark all read" only advances the caller's own marker, and
-- the shared backlog is never mutated, so nobody loses history.
CREATE TABLE admin_notification_reads (
    admin_id     UUID PRIMARY KEY,
    last_read_at TIMESTAMPTZ NOT NULL,
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- The legacy admin_notifications.is_read column is kept (backward-compat, no data loss)
-- but is no longer read or written by the application.
