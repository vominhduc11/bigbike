CREATE TABLE home_videos (
    id          VARCHAR(64)  PRIMARY KEY,
    sort_order  INT          NOT NULL DEFAULT 0,
    title       VARCHAR(255) NOT NULL,
    video_url   TEXT         NOT NULL,
    thumbnail   JSON,
    is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_home_videos_active_sort
    ON home_videos (is_active, sort_order)
    WHERE is_active = TRUE;
