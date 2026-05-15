-- Add channel restriction to coupons: ALL (default) | ONLINE | POS
ALTER TABLE coupons
    ADD COLUMN channel VARCHAR(20) NOT NULL DEFAULT 'ALL';

ALTER TABLE coupons
    ADD CONSTRAINT coupons_channel_check CHECK (channel IN ('ALL', 'ONLINE', 'POS'));
