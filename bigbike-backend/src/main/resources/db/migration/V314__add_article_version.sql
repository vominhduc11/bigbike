-- V314: Add optimistic-locking version column to articles.
-- ArticleEntity declares @Version Integer version (added alongside the V312
-- en_overrides removal), so the schema must expose the column.

ALTER TABLE articles
    ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 0;
