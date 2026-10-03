-- ARTICLE_RULE_009: retire manual article-featured placement and persist the
-- last successful GA4 30-completed-day article-view snapshot.

ALTER TABLE articles DROP COLUMN IF EXISTS featured;

CREATE TABLE IF NOT EXISTS article_view_metrics (
    article_id VARCHAR(64) PRIMARY KEY,
    views_last_30_days BIGINT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT ck_article_view_metrics_non_negative CHECK (views_last_30_days >= 0),
    CONSTRAINT fk_article_view_metrics_article
        FOREIGN KEY (article_id) REFERENCES articles (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS article_view_sync_state (
    state_key VARCHAR(64) PRIMARY KEY,
    last_successful_at TIMESTAMPTZ NOT NULL,
    window_start DATE NOT NULL,
    window_end DATE NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT ck_article_view_sync_window CHECK (window_end >= window_start)
);
