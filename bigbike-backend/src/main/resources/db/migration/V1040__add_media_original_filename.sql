ALTER TABLE media
    ADD COLUMN IF NOT EXISTS original_filename text;

UPDATE media
SET original_filename = NULLIF(regexp_replace(file_path, '^.*/', ''), '')
WHERE original_filename IS NULL
  AND file_path IS NOT NULL;
