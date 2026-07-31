-- V362: Add one optimistic-concurrency token for the full homepage highlights configuration.
-- The three slot rows are replaced as a single logical configuration, so the token
-- must not live on an individual slot row.
CREATE TABLE home_highlights_config (
    id         SMALLINT PRIMARY KEY CHECK (id = 1),
    version    BIGINT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO home_highlights_config (id, version)
VALUES (1, 0)
ON CONFLICT (id) DO NOTHING;
