-- Partial unique indexes allow multiple NULL values (PostgreSQL semantics) while
-- enforcing uniqueness among non-null emails and phones.
-- If this migration fails with a unique-constraint violation, there are existing
-- duplicate emails/phones in the customers table that must be resolved first.

CREATE UNIQUE INDEX IF NOT EXISTS customers_email_unique
    ON customers (email)
    WHERE email IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS customers_phone_unique
    ON customers (phone)
    WHERE phone IS NOT NULL;
