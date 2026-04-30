-- Seed home_videos for dev/demo environment.
-- All videos are BigBike-style motorbike gear review/experience content on YouTube.

INSERT INTO home_videos (id, sort_order, title, video_url, youtube_id, thumbnail, is_active, created_at, updated_at)
VALUES
  ('hv-dev-0001', 1,
   'Trải nghiệm mũ bảo hiểm Arai Signet-X - Xứng đáng với giá tiền?',
   'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
   'dQw4w9WgXcQ',
   NULL,
   TRUE, NOW(), NOW()),

  ('hv-dev-0002', 2,
   'Review áo giáp Alpinestars GP Plus R V3 Airflow - Bảo vệ toàn diện',
   'https://www.youtube.com/watch?v=9bZkp7q19f0',
   '9bZkp7q19f0',
   NULL,
   TRUE, NOW(), NOW()),

  ('hv-dev-0003', 3,
   'Găng tay Dainese Carbon 4 Short - Cảm giác lái đỉnh cao',
   'https://www.youtube.com/watch?v=ScMzIvxBSi4',
   'ScMzIvxBSi4',
   NULL,
   TRUE, NOW(), NOW()),

  ('hv-dev-0004', 4,
   'Giày moto Sidi Mag-1 - Công nghệ từ đua xe vào đường phố',
   'https://www.youtube.com/watch?v=kJQP7kiw5Fk',
   'kJQP7kiw5Fk',
   NULL,
   TRUE, NOW(), NOW());
