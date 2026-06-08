-- V153: Remove content author feature (author field never used on web UI, no data)
ALTER TABLE articles DROP CONSTRAINT IF EXISTS fk_articles_author_id;
ALTER TABLE articles DROP COLUMN IF EXISTS author_id;
DROP TABLE IF EXISTS content_authors;
