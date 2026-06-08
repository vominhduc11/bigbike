-- Remove newsletter module: drop subscriber table, drop customer opt-in column, remove permissions
DELETE FROM role_permissions WHERE permission = 'newsletter.read';

ALTER TABLE customers DROP COLUMN IF EXISTS newsletter_subscribed;

DROP TABLE IF EXISTS newsletter_subscribers;
