ALTER TABLE reviews
    ADD COLUMN first_approved_at TIMESTAMPTZ NULL;

UPDATE reviews
SET first_approved_at = COALESCE(updated_at, created_at, CURRENT_TIMESTAMP)
WHERE status = 'APPROVED'
  AND first_approved_at IS NULL;
