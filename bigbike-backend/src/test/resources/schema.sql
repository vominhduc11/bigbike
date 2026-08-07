-- Hibernate cannot create media_tags because it is intentionally accessed via JDBC
-- rather than a JPA entity. Production gets the canonical table from Flyway V85;
-- the H2 test profile has Flyway disabled, so reproduce only that table here.
CREATE TABLE IF NOT EXISTS media_tags (
    media_id UUID NOT NULL,
    tag VARCHAR(80) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (media_id, tag)
);

CREATE INDEX IF NOT EXISTS idx_media_tags_tag ON media_tags(tag);
