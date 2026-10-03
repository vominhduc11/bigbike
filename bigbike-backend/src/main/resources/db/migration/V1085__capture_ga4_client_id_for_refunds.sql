-- Pseudonymous browser identifier used only to associate a later GA4 cancellation correction
-- with the original web purchase. It is not exposed by order APIs and contains no entered PII.

ALTER TABLE orders
    ADD COLUMN ga4_client_id VARCHAR(128);

ALTER TABLE orders
    ADD CONSTRAINT ck_orders_ga4_client_id
        CHECK (ga4_client_id IS NULL OR ga4_client_id ~ '^[0-9]+\.[0-9]+$');
