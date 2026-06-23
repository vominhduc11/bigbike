-- V263: Remove the accounts-receivable / customer-credit (công nợ) feature entirely.
--
-- Reverses V75 (credit columns on customers + accounts_receivable table),
-- V83 (version column) and the receivables.* permission rows seeded by V79/V122.
-- The POS CREDIT payment method has been dropped from the application; no order
-- can be created UNPAID via POS anymore, so the receivables ledger is dead data.
--
-- Idempotent: every statement guards with IF EXISTS so a re-run is a no-op.

-- ── (1) Drop the accounts_receivable ledger table (indexes/constraints go with it) ──
DROP TABLE IF EXISTS accounts_receivable CASCADE;

-- ── (2) Drop the customer credit profile (V75) ──────────────────────────────────────
ALTER TABLE customers DROP CONSTRAINT IF EXISTS chk_customers_credit_status;

ALTER TABLE customers
    DROP COLUMN IF EXISTS credit_enabled,
    DROP COLUMN IF EXISTS credit_limit,
    DROP COLUMN IF EXISTS payment_terms_days,
    DROP COLUMN IF EXISTS credit_status,
    DROP COLUMN IF EXISTS credit_note;

-- ── (3) Remove all receivables.* permissions from every role ────────────────────────
-- role_permissions is the only permission-catalog table (no separate `permissions`
-- table exists in this schema), so deleting the role grants fully retires the keys.
DELETE FROM role_permissions WHERE permission LIKE 'receivables.%';
