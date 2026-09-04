-- Owner decision 2026-09-01: review invitations are automatic and no longer
-- configurable through site_settings. Keep the invitation ledgers; remove only
-- the three retired settings rows so GET /admin/settings cannot return them.
DELETE FROM site_settings
WHERE setting_key IN (
    'review_invitation_enabled',
    'review_invitation_delay_days',
    'review_invitation_daily_limit'
);
