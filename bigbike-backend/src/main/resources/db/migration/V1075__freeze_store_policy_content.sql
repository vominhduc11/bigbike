-- Owner decision 2026-09-01 supersedes the 2026-08-23 admin-editable policy settings.
-- The four policy documents now live in backend resources; this is intentionally idempotent.
DELETE FROM site_settings
WHERE setting_key IN (
    'policy_warranty_title',
    'policy_warranty_body_html',
    'policy_return_exchange_title',
    'policy_return_exchange_body_html'
);
