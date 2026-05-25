-- Xóa placeholder videos từ V1006 (Rick Astley, Gangnam Style, v.v.)
DELETE FROM home_videos WHERE id IN (
    'hv-dev-0001','hv-dev-0002','hv-dev-0003','hv-dev-0004'
);

-- 5 BigBike YouTube Shorts thật (WP post_dates 2025-05-20, sorted newest-first = sort_order 1)
INSERT INTO home_videos (id, sort_order, title, video_url, youtube_id, thumbnail, is_active, created_at, updated_at)
VALUES
  ('hv-shorts-001', 1,
   'DAINESE LADY',
   'https://youtube.com/shorts/1cHOyiK2vo0',
   '1cHOyiK2vo0',
   NULL, TRUE, NOW(), NOW()),

  ('hv-shorts-002', 2,
   's7x',
   'https://youtube.com/shorts/g3F8YAn_MZY',
   'g3F8YAn_MZY',
   NULL, TRUE, NOW(), NOW()),

  ('hv-shorts-003', 3,
   'dây rokstrap',
   'https://youtube.com/shorts/lah7jyfrfKY',
   'lah7jyfrfKY',
   NULL, TRUE, NOW(), NOW()),

  ('hv-shorts-004', 4,
   'trùm đầu ego',
   'https://youtube.com/shorts/enn70TOAdNw',
   'enn70TOAdNw',
   NULL, TRUE, NOW(), NOW()),

  ('hv-shorts-005', 5,
   'giáp komine lv2 tay vai',
   'https://youtube.com/shorts/JHumQ66WtTI',
   'JHumQ66WtTI',
   NULL, TRUE, NOW(), NOW());
