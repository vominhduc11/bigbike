-- V125: Newsletter email subscribers.
--
-- Stores emails submitted via the storefront footer signup form so the shop
-- can build a mailing list. One row per unique email (case-insensitive);
-- duplicate submissions are idempotent and never error.

CREATE TABLE newsletter_subscribers (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email       VARCHAR(255) NOT NULL,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX uq_newsletter_subscribers_email
    ON newsletter_subscribers (LOWER(email));

CREATE INDEX idx_newsletter_subscribers_created_at
    ON newsletter_subscribers (created_at DESC);

-- Permission for admins to view the subscriber list.
INSERT INTO role_permissions (role_id, permission) VALUES
    ('ADMIN',        'newsletter.read'),
    ('SHOP_MANAGER', 'newsletter.read')
ON CONFLICT (role_id, permission) DO NOTHING;
