-- Add per-customer coupon restriction.
-- NULL = shared (anyone may use); UUID = only that customer may use.
ALTER TABLE coupons
    ADD COLUMN customer_id UUID NULL REFERENCES customers(id) ON DELETE SET NULL;

CREATE INDEX idx_coupons_customer_id ON coupons(customer_id) WHERE customer_id IS NOT NULL;
