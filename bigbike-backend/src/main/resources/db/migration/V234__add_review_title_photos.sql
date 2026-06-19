-- Review title + customer photos (REVIEW_RULE_005).
-- Optional review heading and an array of customer-uploaded photo URLs (MinIO /media/reviews/...).
-- Both nullable, no backfill: legacy / WordPress-imported reviews stay NULL.
ALTER TABLE reviews ADD COLUMN title  varchar(160);
ALTER TABLE reviews ADD COLUMN photos jsonb;
