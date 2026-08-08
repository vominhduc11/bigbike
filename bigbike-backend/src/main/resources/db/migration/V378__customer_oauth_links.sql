-- Social login: a customer may link BOTH Google and Facebook.
--
-- V129 put a single (oauth_provider, oauth_subject) pair on `customers`, so linking a second
-- provider silently overwrote the first — and there was no way to list or unlink identities.
-- Move the identities to their own table; the V129 columns stay for backward compatibility and
-- are kept in sync by CustomerOAuthService until a later migration drops them.

CREATE TABLE customer_oauth_links (
    id          uuid PRIMARY KEY,
    customer_id uuid        NOT NULL REFERENCES customers (id) ON DELETE CASCADE,
    provider    varchar(20) NOT NULL,
    subject     varchar(255) NOT NULL,
    linked_at   timestamptz NOT NULL DEFAULT now()
);

-- One provider identity maps to at most one customer account (same guarantee as ux_customers_oauth).
CREATE UNIQUE INDEX ux_customer_oauth_links_identity
    ON customer_oauth_links (provider, subject);

-- A customer links a given provider at most once.
CREATE UNIQUE INDEX ux_customer_oauth_links_customer_provider
    ON customer_oauth_links (customer_id, provider);

CREATE INDEX idx_customer_oauth_links_customer
    ON customer_oauth_links (customer_id);

-- Backfill the existing single-pair links. Empty on every environment at the time of writing
-- (0 rows with oauth_provider IS NOT NULL), so this is a no-op safety net.
INSERT INTO customer_oauth_links (id, customer_id, provider, subject, linked_at)
SELECT gen_random_uuid(), c.id, c.oauth_provider, c.oauth_subject, COALESCE(c.updated_at, now())
FROM customers c
WHERE c.oauth_provider IS NOT NULL
  AND c.oauth_subject IS NOT NULL;
