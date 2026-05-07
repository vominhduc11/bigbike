-- Safe unique constraint on redirects.source_pattern.
-- Step 1: Among duplicate source_pattern rows keep the most-recently-updated one.
DELETE FROM redirects
WHERE id NOT IN (
    SELECT DISTINCT ON (source_pattern) id
    FROM redirects
    ORDER BY source_pattern, updated_at DESC NULLS LAST, id
);

-- Step 2: Replace the non-unique index with a unique constraint
--         (the index is covered by the constraint and dropped implicitly on most DBs,
--          but we drop it explicitly first to avoid a naming conflict on re-run).
DROP INDEX IF EXISTS idx_redirects_source_pattern;

ALTER TABLE redirects
    ADD CONSTRAINT uq_redirects_source_pattern UNIQUE (source_pattern);
