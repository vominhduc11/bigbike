-- V60: Reviews status integrity
-- 1. Normalize any existing rows with null/blank/unknown status to 'PENDING'
--    before adding the check constraint (handles legacy or migrated data with unexpected values).
UPDATE reviews
SET status = 'PENDING'
WHERE status IS NULL
   OR UPPER(TRIM(status)) NOT IN ('APPROVED', 'PENDING', 'SPAM', 'TRASH');

-- 2. Add CHECK constraint (idempotent guard via DO block).
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'ck_reviews_status'
          AND conrelid = 'reviews'::regclass
    ) THEN
        ALTER TABLE reviews
            ADD CONSTRAINT ck_reviews_status
            CHECK (status IN ('APPROVED', 'PENDING', 'SPAM', 'TRASH'));
    END IF;
END
$$;
