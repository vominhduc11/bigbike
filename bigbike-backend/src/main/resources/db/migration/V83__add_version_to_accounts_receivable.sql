-- V83: Add optimistic-locking version column to accounts_receivable.
-- ReceivableEntity declares @Version Long version; V75 created the table without it,
-- so Hibernate schema validation fails on boot. Same pattern as V67 (orders, returns).
-- ADD COLUMN ... NOT NULL DEFAULT 0 is safe: existing rows get version=0 on the spot.

ALTER TABLE accounts_receivable
    ADD COLUMN IF NOT EXISTS version BIGINT NOT NULL DEFAULT 0;
