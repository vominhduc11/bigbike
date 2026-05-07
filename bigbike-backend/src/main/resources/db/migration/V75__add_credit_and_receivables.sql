-- V75: Accounts Receivable module
-- (1) Credit profile columns on customers
-- (2) accounts_receivable table

-- ── (1) Customer credit profile ───────────────────────────────────────────────
ALTER TABLE customers
    ADD COLUMN IF NOT EXISTS credit_enabled     BOOLEAN          NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS credit_limit        NUMERIC(19, 2),
    ADD COLUMN IF NOT EXISTS payment_terms_days  INTEGER,
    ADD COLUMN IF NOT EXISTS credit_status       VARCHAR(50)      NOT NULL DEFAULT 'ACTIVE',
    ADD COLUMN IF NOT EXISTS credit_note         TEXT;

-- Only ACTIVE/SUSPENDED/BLOCKED are valid credit statuses
ALTER TABLE customers
    ADD CONSTRAINT chk_customers_credit_status
        CHECK (credit_status IN ('ACTIVE', 'SUSPENDED', 'BLOCKED'));

-- ── (2) Accounts receivable ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS accounts_receivable (
    id                      UUID            NOT NULL DEFAULT gen_random_uuid(),
    order_id                UUID            NOT NULL REFERENCES orders(id),
    customer_id             UUID            REFERENCES customers(id),
    customer_name           VARCHAR(255),
    customer_phone          VARCHAR(50),
    original_amount         NUMERIC(19, 2)  NOT NULL,
    paid_amount             NUMERIC(19, 2)  NOT NULL DEFAULT 0,
    outstanding_amount      NUMERIC(19, 2)  NOT NULL,
    written_off_amount      NUMERIC(19, 2)  NOT NULL DEFAULT 0,
    status                  VARCHAR(50)     NOT NULL DEFAULT 'OPEN',
    due_date                DATE,
    payment_terms_days      INTEGER,
    credit_limit_snapshot   NUMERIC(19, 2),
    created_from            VARCHAR(50)     NOT NULL DEFAULT 'ADMIN_ORDER',
    note                    TEXT,
    write_off_reason        TEXT,
    written_off_at          TIMESTAMPTZ,
    created_by_admin_id     UUID,
    created_at              TIMESTAMPTZ     NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ     NOT NULL DEFAULT now(),

    CONSTRAINT pk_accounts_receivable PRIMARY KEY (id),
    CONSTRAINT uq_accounts_receivable_order UNIQUE (order_id),
    CONSTRAINT chk_ar_status CHECK (status IN ('OPEN','PARTIALLY_PAID','OVERDUE','CLOSED','WRITTEN_OFF')),
    CONSTRAINT chk_ar_created_from CHECK (created_from IN ('POS','ADMIN_ORDER','MIGRATION')),
    CONSTRAINT chk_ar_amounts_non_negative
        CHECK (paid_amount >= 0 AND outstanding_amount >= 0 AND written_off_amount >= 0)
);

CREATE INDEX IF NOT EXISTS idx_ar_customer_id   ON accounts_receivable(customer_id);
CREATE INDEX IF NOT EXISTS idx_ar_status        ON accounts_receivable(status);
CREATE INDEX IF NOT EXISTS idx_ar_due_date      ON accounts_receivable(due_date);
CREATE INDEX IF NOT EXISTS idx_ar_created_at    ON accounts_receivable(created_at);
