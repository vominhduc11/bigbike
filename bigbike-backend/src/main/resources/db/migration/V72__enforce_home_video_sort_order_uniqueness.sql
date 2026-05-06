DROP TABLE IF EXISTS home_video_sort_rebuild_tmp;

CREATE TEMPORARY TABLE home_video_sort_rebuild_tmp AS
SELECT
    id,
    ROW_NUMBER() OVER (ORDER BY sort_order ASC, created_at ASC, id ASC) - 1 AS new_sort_order
FROM home_videos;

UPDATE home_videos
SET sort_order = (
    SELECT tmp.new_sort_order
    FROM home_video_sort_rebuild_tmp tmp
    WHERE tmp.id = home_videos.id
)
WHERE EXISTS (
    SELECT 1
    FROM home_video_sort_rebuild_tmp tmp
    WHERE tmp.id = home_videos.id
      AND tmp.new_sort_order <> home_videos.sort_order
);

DROP TABLE home_video_sort_rebuild_tmp;

ALTER TABLE home_videos
    ADD CONSTRAINT uq_home_videos_sort_order UNIQUE (sort_order);
