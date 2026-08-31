-- Owner decision 2026-08-31: invite only native orders completed after a fresh
-- enable cutoff; one email per order, permanent opt-out, paced no-retry sending.

ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS locale VARCHAR(2) NOT NULL DEFAULT 'vi';

ALTER TABLE orders
    DROP CONSTRAINT IF EXISTS ck_orders_locale;

ALTER TABLE orders
    ADD CONSTRAINT ck_orders_locale CHECK (locale IN ('vi', 'en'));

CREATE TABLE review_invitation_campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    activated_at TIMESTAMPTZ NOT NULL,
    deactivated_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_review_invitation_campaign_dates CHECK (
        deactivated_at IS NULL OR deactivated_at >= activated_at
    )
);

CREATE UNIQUE INDEX uq_review_invitation_active_campaign
    ON review_invitation_campaigns ((TRUE))
    WHERE deactivated_at IS NULL;

CREATE TABLE review_invitation_deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL
        REFERENCES review_invitation_campaigns(id) ON DELETE RESTRICT,
    order_id UUID NOT NULL
        REFERENCES orders(id) ON DELETE RESTRICT,
    order_number VARCHAR(100) NOT NULL,
    customer_id UUID NULL,
    recipient_email VARCHAR(255) NOT NULL,
    recipient_email_normalized VARCHAR(255) NOT NULL,
    locale VARCHAR(2) NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'PENDING',
    completed_at TIMESTAMPTZ NOT NULL,
    due_at TIMESTAMPTZ NOT NULL,
    attempted_at TIMESTAMPTZ NULL,
    provider_accepted_at TIMESTAMPTZ NULL,
    unsubscribe_token_hash CHAR(64) NULL,
    skip_reason VARCHAR(40) NULL,
    failure_code VARCHAR(64) NULL,
    failure_message VARCHAR(500) NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    version BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT uq_review_invitation_delivery_order UNIQUE (order_id),
    CONSTRAINT uq_review_invitation_unsubscribe_hash UNIQUE (unsubscribe_token_hash),
    CONSTRAINT ck_review_invitation_delivery_locale CHECK (locale IN ('vi', 'en')),
    CONSTRAINT ck_review_invitation_delivery_status CHECK (
        status IN ('PENDING', 'SENDING', 'SENT', 'FAILED', 'UNCERTAIN', 'SKIPPED')
    ),
    CONSTRAINT ck_review_invitation_delivery_due CHECK (due_at >= completed_at)
);

CREATE INDEX idx_review_invitation_delivery_dispatch
    ON review_invitation_deliveries(status, due_at, created_at);

CREATE INDEX idx_review_invitation_delivery_campaign
    ON review_invitation_deliveries(campaign_id, status);

CREATE INDEX idx_review_invitation_delivery_recipient
    ON review_invitation_deliveries(recipient_email_normalized, status);

CREATE TABLE review_invitation_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    delivery_id UUID NOT NULL
        REFERENCES review_invitation_deliveries(id) ON DELETE CASCADE,
    product_id VARCHAR(64) NOT NULL,
    invite_token_hash CHAR(64) NULL,
    review_id BIGINT NULL REFERENCES reviews(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_review_invitation_item_product UNIQUE (delivery_id, product_id),
    CONSTRAINT uq_review_invitation_item_token_hash UNIQUE (invite_token_hash)
);

CREATE INDEX idx_review_invitation_item_product
    ON review_invitation_items(product_id, reviewed_at);

CREATE TABLE review_invitation_opt_outs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL,
    email_normalized VARCHAR(255) NOT NULL UNIQUE,
    source VARCHAR(32) NOT NULL DEFAULT 'EMAIL_LINK',
    opted_out_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_review_invitation_opt_out_source CHECK (source IN ('EMAIL_LINK'))
);

CREATE TABLE review_invitation_daily_quotas (
    send_date DATE PRIMARY KEY,
    attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO site_settings (
    id, setting_key, setting_value, setting_value_en, setting_group,
    is_public, description, created_at, updated_at
)
VALUES
    (gen_random_uuid(), 'review_invitation_enabled', 'false', NULL, 'review_invitation', FALSE,
     'Bật/tắt thư mời đánh giá sau mua; mỗi lần bật tạo một mốc bắt đầu mới.', now(), now()),
    (gen_random_uuid(), 'review_invitation_delay_days', '7', NULL, 'review_invitation', FALSE,
     'Số ngày chờ sau khi đơn hoàn tất trước khi gửi thư mời đánh giá (1-90).', now(), now()),
    (gen_random_uuid(), 'review_invitation_daily_limit', '20', NULL, 'review_invitation', FALSE,
     'Số lần thử gửi thư mời đánh giá tối đa mỗi ngày giờ Việt Nam (1-50).', now(), now())
ON CONFLICT (setting_key) DO UPDATE
SET setting_group = EXCLUDED.setting_group,
    is_public = FALSE,
    description = EXCLUDED.description,
    updated_at = now();
