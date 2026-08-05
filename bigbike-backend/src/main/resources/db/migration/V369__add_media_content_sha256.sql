-- Content-addressed media identity for the live WordPress migration.
-- Existing rows stay NULL until their MinIO objects are verified and backfilled;
-- PostgreSQL permits multiple NULL values in the partial unique index.
ALTER TABLE media
    ADD COLUMN IF NOT EXISTS content_sha256 varchar(64);

ALTER TABLE media
    DROP CONSTRAINT IF EXISTS ck_media_content_sha256;

ALTER TABLE media
    ADD CONSTRAINT ck_media_content_sha256
        CHECK (content_sha256 IS NULL OR content_sha256 ~ '^[0-9a-f]{64}$');

CREATE UNIQUE INDEX IF NOT EXISTS ux_media_content_sha256
    ON media (content_sha256)
    WHERE content_sha256 IS NOT NULL;

-- Rollback (only after verifying no migration/media process depends on this key):
--   DROP INDEX IF EXISTS ux_media_content_sha256;
--   ALTER TABLE media DROP CONSTRAINT IF EXISTS ck_media_content_sha256;
--   ALTER TABLE media DROP COLUMN IF EXISTS content_sha256;
