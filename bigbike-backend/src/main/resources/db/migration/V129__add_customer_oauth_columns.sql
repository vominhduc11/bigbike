-- Social login (OAuth2) account linking + remember-me session lifetime.
-- oauth_provider/oauth_subject identify the Google/Facebook account a customer
-- is linked to; customer_sessions.remember drives the refresh-cookie lifetime.

ALTER TABLE customers
    ADD COLUMN oauth_provider varchar(20),
    ADD COLUMN oauth_subject  varchar(255);

-- One provider identity maps to at most one customer account.
CREATE UNIQUE INDEX ux_customers_oauth
    ON customers (oauth_provider, oauth_subject)
    WHERE oauth_provider IS NOT NULL;

ALTER TABLE customer_sessions
    ADD COLUMN remember boolean NOT NULL DEFAULT false;
