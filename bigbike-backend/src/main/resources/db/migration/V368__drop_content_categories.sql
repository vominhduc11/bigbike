-- Remove the article content-category feature (owner decision 2026-08-03).
--
-- This is intentionally a forward-only migration. Rollback requires restoring the
-- pre-V368 PostgreSQL snapshot because the historical category membership is discarded.
-- Product categories and article_tags are unrelated and remain untouched.

DELETE FROM article_category_map;

ALTER TABLE articles
    DROP CONSTRAINT IF EXISTS fk_articles_category_id;

DROP INDEX IF EXISTS idx_articles_category_id;

ALTER TABLE articles
    DROP COLUMN IF EXISTS category_id;

DROP TABLE IF EXISTS article_category_map;
DROP TABLE IF EXISTS content_categories;
