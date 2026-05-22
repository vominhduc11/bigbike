-- V144: Add optimistic-locking version column to products.
-- ProductEntity declares @Version Long version, so the schema must expose
-- the column on both fresh databases and older databases that already
-- received the column through a prior manual or partial rollout.

ALTER TABLE products
    ADD COLUMN IF NOT EXISTS version BIGINT NOT NULL DEFAULT 0;
