-- ARTICLE_RULE_004: restore the manual "Tin nổi bật" selection after the
-- superseded GA4-ranking migration. Keep migration history immutable so any
-- environment that already applied V1088 recovers safely.

ALTER TABLE articles
    ADD COLUMN IF NOT EXISTS featured BOOLEAN NOT NULL DEFAULT FALSE;

DROP TABLE IF EXISTS article_view_metrics;
DROP TABLE IF EXISTS article_view_sync_state;
