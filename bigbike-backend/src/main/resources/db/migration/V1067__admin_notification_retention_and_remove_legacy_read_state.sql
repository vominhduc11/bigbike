-- Retain the shared admin notification backlog for six calendar months.
-- Read state is per-admin in admin_notification_reads; the old shared flag is not used.
DROP INDEX IF EXISTS idx_admin_notifications_unread;

ALTER TABLE admin_notifications
    DROP COLUMN IF EXISTS is_read;

CREATE INDEX idx_admin_notifications_created_at_id
    ON admin_notifications (created_at, id);
