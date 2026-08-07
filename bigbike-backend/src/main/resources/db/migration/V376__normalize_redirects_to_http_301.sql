-- Managed redirects have one behavior: HTTP 301. Normalize historical rows
-- before removing the obsolete status/type columns.
UPDATE redirects
SET redirect_type = 'PERMANENT',
    status_code = 301;

DROP INDEX IF EXISTS idx_redirects_status_code;

ALTER TABLE redirects
    DROP CONSTRAINT IF EXISTS ck_redirects_status_code;

ALTER TABLE redirects
    DROP COLUMN IF EXISTS status_code,
    DROP COLUMN IF EXISTS redirect_type;
