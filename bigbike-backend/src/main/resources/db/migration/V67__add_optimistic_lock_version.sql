-- V67: Add optimistic-locking version columns to returns and orders.
-- JPA @Version prevents concurrent mutation races (e.g. double-refund on rapid clicks).
-- ADD COLUMN ... NOT NULL DEFAULT 0 is safe: existing rows get version=0 on the spot.
-- A second concurrent UPDATE will fail with ObjectOptimisticLockingFailureException → 409.

ALTER TABLE returns
    ADD COLUMN IF NOT EXISTS version BIGINT NOT NULL DEFAULT 0;

ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS version BIGINT NOT NULL DEFAULT 0;
