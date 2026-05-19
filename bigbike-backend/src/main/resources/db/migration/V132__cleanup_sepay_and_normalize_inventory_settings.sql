-- V132: Clean up leftover SePay settings + normalize the inventory settings group
--
-- (1) Remove dead payment_sepay.* settings rows.
--     The SePay payment gateway was removed in V59 (V59__remove_sepay_payment_artifacts.sql),
--     but payment_sepay settings rows survived in some environments. They have no consumer
--     and surfaced as a stray "PAYMENT_SEPAY" tab in the admin settings screen.
--     Deleting by setting_group catches every leftover key regardless of key prefix.
--
-- (2) Normalize the inventory settings group name to lowercase.
--     site_settings holds two groups that differ only by case — 'INVENTORY' and 'inventory'.
--     Every other group ('general', 'contact', 'seo', 'store', 'tax', ...) is lowercase, so
--     fold 'INVENTORY' into 'inventory' for consistency. The admin screen already merges
--     them case-insensitively; this makes the stored data match.
--
-- Both statements are idempotent — safe to run when the data is already clean.

DELETE FROM site_settings
WHERE setting_group = 'payment_sepay';

UPDATE site_settings
SET setting_group = 'inventory',
    updated_at = now()
WHERE setting_group = 'INVENTORY';
