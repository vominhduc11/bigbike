-- Migration: Import WordPress video CPT posts into home_videos
-- Source: WP SQL dump bigbike_vn__2026_04_17/sqldump.sql
-- WP post_type: video | ACF field: youtube_url
-- WP homepage (page-home.php) shows latest 5 video posts; we import all for admin management.
-- embed_url and auto_thumbnail_url are computed at runtime in Java (PublicHomeVideoResponse.from).
-- Sorted by WP post ID desc (most recent first = lowest sort_order).
-- Generated: 2026-05-10T16:49:14.326Z
-- Total: 59 videos
--
-- To apply: run against BigBike PostgreSQL database.
-- Note: sort_order has UNIQUE constraint (V72 migration). Run DELETE first to clear old data.

-- Clear existing WP-imported videos (identified by hv-wp- prefix)
DELETE FROM home_videos WHERE id LIKE 'hv-wp-%';

INSERT INTO home_videos
  (id, sort_order, title, video_url, youtube_id, thumbnail, is_active, created_at, updated_at)
VALUES
  ('hv-wp-fa4cc07c', 1, '354', 'https://www.youtube.com/shorts/bNmDaq37ghI', 'bNmDaq37ghI', NULL, TRUE, NOW(), NOW()),
  ('hv-wp-4703eaa7', 2, 'forma low', 'https://youtube.com/shorts/WhWzlp3NH14?si=Tz26NOmLeea66z9x', 'WhWzlp3NH14', NULL, TRUE, NOW(), NOW()),
  ('hv-wp-a13cf3c3', 3, 'ray man', 'https://youtube.com/shorts/zgTqj7kk7Pk?si=BV8tI1uN33ePWESL', 'zgTqj7kk7Pk', NULL, TRUE, NOW(), NOW()),
  ('hv-wp-cda6d77f', 4, 'smk', 'https://youtube.com/shorts/eW5QmxrfcU4?si=oyya2Sip0vIYF1-w', 'eW5QmxrfcU4', NULL, TRUE, NOW(), NOW()),
  ('hv-wp-5e3db53b', 5, 'oneal', 'https://youtube.com/shorts/LCYklvgozTE?si=EfTbt-2K50yqB56N', 'LCYklvgozTE', NULL, TRUE, NOW(), NOW()),
  ('hv-wp-9c730ffd', 6, 'fog city', 'https://youtube.com/shorts/eSpi99XtuVU?si=fyJdw9LPAOXTAwF0', 'eSpi99XtuVU', NULL, TRUE, NOW(), NOW()),
  ('hv-wp-d8833058', 7, 'smk retro', 'https://youtube.com/shorts/YNdT6t0rQOY?si=xIhkoSJ5iWbUF4gf', 'YNdT6t0rQOY', NULL, TRUE, NOW(), NOW()),
  ('hv-wp-04048020', 8, 'nic', 'https://youtube.com/shorts/dWU6TjSWuoI?si=OrzHLlXAH1bjnBeR', 'dWU6TjSWuoI', NULL, TRUE, NOW(), NOW()),
  ('hv-wp-a4a5b1b6', 9, 's9x', 'https://youtube.com/shorts/8F_fFy6IKVY?si=yCzNG54puo4Zwtoc', '8F_fFy6IKVY', NULL, TRUE, NOW(), NOW()),
  ('hv-wp-c0ea64c4', 10, 'ff900', 'https://youtube.com/shorts/rakQPmBZ6zE?si=QF9rToAaQvc2zuDP', 'rakQPmBZ6zE', NULL, TRUE, NOW(), NOW()),
  ('hv-wp-510b1111', 11, 's12', 'https://youtube.com/shorts/md8HGuadbsU?si=Xz6gyVpcHgpWILD4', 'md8HGuadbsU', NULL, TRUE, NOW(), NOW()),
  ('hv-wp-0bbed331', 12, 'spyke sahara', 'https://youtube.com/shorts/FVDV2f9OPNM?si=s7BcOCcDJLGgYCOW', 'FVDV2f9OPNM', NULL, TRUE, NOW(), NOW()),
  ('hv-wp-29f632df', 13, 'ls2 of610', 'https://youtube.com/shorts/_wVNaTG1lac?si=oNY3D03oYELmU-27', '_wVNaTG1lac', NULL, TRUE, NOW(), NOW()),
  ('hv-wp-9fe5cf35', 14, 'hjc is2v', 'https://youtube.com/shorts/kuekGgAhtSQ?si=5l0KSJK5COcHqRfM', 'kuekGgAhtSQ', NULL, TRUE, NOW(), NOW()),
  ('hv-wp-69c1b627', 15, 'compass spyke', 'https://youtube.com/shorts/MLpNDP_Kvuk?si=msn_n1OG-pFVTwyp', 'MLpNDP_Kvuk', NULL, TRUE, NOW(), NOW()),
  ('hv-wp-84582593', 16, 'carberg', 'https://youtube.com/shorts/p4KynR5fy9o?si=76psqogk3KWKriuq', 'p4KynR5fy9o', NULL, TRUE, NOW(), NOW()),
  ('hv-wp-01c011ed', 17, 'găng tay269', 'https://youtube.com/shorts/BQwxLDE7jmQ?si=W0VY5-_VDi1RY2s2', 'BQwxLDE7jmQ', NULL, TRUE, NOW(), NOW()),
  ('hv-wp-bd462fe9', 18, 'giáp chân 819 690', 'https://youtube.com/shorts/Enk6U5jMcVg?si=d_nss0Fhokzc2K01', 'Enk6U5jMcVg', NULL, TRUE, NOW(), NOW()),
  ('hv-wp-ba204c84', 19, 's8x', 'https://youtube.com/shorts/0neCIvdDioY?si=5SNBLOTUjPSBaxIi', '0neCIvdDioY', NULL, TRUE, NOW(), NOW()),
  ('hv-wp-dd977ba6', 20, 'áo taichi 335', 'https://youtube.com/shorts/gqgPWRhDIGk?si=LioYX7gfWcgvuNQt', 'gqgPWRhDIGk', NULL, TRUE, NOW(), NOW()),
  ('hv-wp-79c46873', 21, 'KOMINE 177', 'https://youtube.com/shorts/_8T8fu1EkG0?si=HeQ93GAQghkDr5Bw', '_8T8fu1EkG0', NULL, TRUE, NOW(), NOW()),
  ('hv-wp-00d227ef', 22, 'GĂNG TAY KOMINE 265', 'https://youtube.com/shorts/MTsq4MyCR_o?si=f4WluvdLK1Fwh_eG', 'MTsq4MyCR_o', NULL, TRUE, NOW(), NOW()),
  ('hv-wp-0a27f5fe', 23, 'GĂNG TAY KOMINE 269', 'https://youtube.com/shorts/2ZQ6KAzeQeo?si=gh1hd3nhXEGq_r3m', '2ZQ6KAzeQeo', NULL, TRUE, NOW(), NOW()),
  ('hv-wp-af1dd150', 24, 'DAINESE LADY', 'https://youtube.com/shorts/1cHOyiK2vo0?si=SGfe5NpmVFwPDKuf', '1cHOyiK2vo0', NULL, TRUE, NOW(), NOW()),
  ('hv-wp-79f6d90e', 25, 's7x', 'https://youtube.com/shorts/g3F8YAn_MZY?si=fISpr7r4nsvJooV0', 'g3F8YAn_MZY', NULL, TRUE, NOW(), NOW()),
  ('hv-wp-89445c1c', 26, 'dây rokstrap', 'https://youtube.com/shorts/lah7jyfrfKY?si=giO15WQ_zfteJ45P', 'lah7jyfrfKY', NULL, TRUE, NOW(), NOW()),
  ('hv-wp-1ebe9976', 27, 'trùm đầu ego', 'https://youtube.com/shorts/enn70TOAdNw?si=GeS9uGtpxNHfBKXc', 'enn70TOAdNw', NULL, TRUE, NOW(), NOW()),
  ('hv-wp-d5b7e994', 28, 'giáp komine lv2 tay vai', 'https://youtube.com/shorts/JHumQ66WtTI?si=FTUTL804We7oUBx3', 'JHumQ66WtTI', NULL, TRUE, NOW(), NOW()),
  ('hv-wp-ae926cc9', 29, 'Găng tay LS2 SparkMan mang vào đua ngay !', 'https://youtu.be/6HQWKDaI9Nw', '6HQWKDaI9Nw', NULL, TRUE, NOW(), NOW()),
  ('hv-wp-59e9ab7b', 30, 'Găng tay moto LS2 RustMan da dê cổ điển siêu êm ái', 'https://youtu.be/OPweEG4Rt4w', 'OPweEG4Rt4w', NULL, TRUE, NOW(), NOW()),
  ('hv-wp-0a2e8903', 31, 'Găng tay LS2 RayMan lắm lỗ, bảo hộ cái gì ?', 'https://youtu.be/YY0et-y-yDc', 'YY0et-y-yDc', NULL, TRUE, NOW(), NOW()),
  ('hv-wp-c0e70393', 32, 'Găng tay đua Moto LS2 Swift Racing full da xịn xò quá !', 'https://youtu.be/YY0et-y-yDc', 'YY0et-y-yDc', NULL, TRUE, NOW(), NOW()),
  ('hv-wp-37c07471', 33, 'Găng tay LS2 Dartman, BigBike City Boy cần có !', 'https://youtu.be/pkqLpKRjYt4', 'pkqLpKRjYt4', NULL, TRUE, NOW(), NOW()),
  ('hv-wp-2206eb62', 34, 'MẶC FULL BẢO HỘ DA ALPINESTARS ĐÚNG CÁCH NHƯ THẾ NÀO ? HƯỚNG DẪN !', 'https://youtu.be/R6eeL8OR7dU', 'R6eeL8OR7dU', NULL, TRUE, NOW(), NOW()),
  ('hv-wp-aa5a1a72', 35, 'REVIEW MŨ BẢO HIỂM HOT NHẤT 2020 \\"LS2 FF800\\" CHẤT LIỆU KPA SIÊU NHẸ !', 'https://youtu.be/AeXLr1qLM40', 'AeXLr1qLM40', NULL, TRUE, NOW(), NOW()),
  ('hv-wp-e0f83d17', 36, 'Áo giáp bảo hộ BMW Raceflow cho mùa hè', 'https://youtu.be/fO-pF84RMjY', 'fO-pF84RMjY', NULL, TRUE, NOW(), NOW()),
  ('hv-wp-f5e2df24', 37, 'SCS S-3 KẾT NỐI BLUETOOTH 2 ĐIỆN THOẠI 1 LÚC & CÁCH INTERCOM 4 MÁY', 'https://www.youtube.com/watch?v=Ut2qGqWurpI', 'Ut2qGqWurpI', NULL, TRUE, NOW(), NOW()),
  ('hv-wp-6b1eafb2', 38, 'Túi hít bình xăng khủng nhất cho ae biker PKL. Menat MB018', 'https://www.youtube.com/watch?v=fWep3FuYdSI', 'fWep3FuYdSI', NULL, TRUE, NOW(), NOW()),
  ('hv-wp-d3daf21a', 39, 'GẮN TÚI YÊN XE GIVI XS313 CHẠY HOÀI KHÔNG THẤY RỚT ! HƯỚNG DẪN CÁCH GẮN', 'https://www.youtube.com/watch?v=wiDaLImsv6Y', 'wiDaLImsv6Y', NULL, TRUE, NOW(), NOW()),
  ('hv-wp-198b9474', 40, 'Áo bảo hộ túi khí Helite của Pháp nổ tốc độ siêu thanh, bảo vệ tối ưu cho Biker !', 'https://www.youtube.com/watch?v=mlleLJ71LhM', 'mlleLJ71LhM', NULL, TRUE, NOW(), NOW()),
  ('hv-wp-7866b235', 41, 'FULLFACE 10 TRIỆU ! LS2 FF327 CARBON 2019 ĐẲNG CẤP. REVIEW', 'https://www.youtube.com/watch?v=3dDZyskm1oo&t=3s', '3dDZyskm1oo', NULL, TRUE, NOW(), NOW()),
  ('hv-wp-91d95291', 42, 'KHÔNG CÓ ĐỐI THỦ ! SENA 30K BLUETOOTH INTERCOM.', 'https://www.youtube.com/watch?v=l2Mc2s11yB0&t=100s', 'l2Mc2s11yB0', NULL, TRUE, NOW(), NOW()),
  ('hv-wp-a22bbf9b', 43, 'Fullface của bạn chưa đủ đẳng cấp nếu thiếu Sena 20S Evo', 'https://www.youtube.com/watch?v=sZOg4uyh0dM&t=325s', 'sZOg4uyh0dM', NULL, TRUE, NOW(), NOW()),
  ('hv-wp-6ba73861', 44, 'HUYỀN THOẠI LUÔN TỒN TẠI ! Tai nghe bluetooth Sena 10S cao cấp gắn mũ bảo hiểm', 'https://www.youtube.com/watch?v=9uUSSa-2Png&t=315s', '9uUSSa-2Png', NULL, TRUE, NOW(), NOW()),
  ('hv-wp-4f7eb4d5', 45, 'CHỈ 690K ! TAI NGHE BLUETOOTH SCS S-6 ĐỦ THOẢ MÃN NHU CẦU CỦA BẠN !', 'https://www.youtube.com/watch?v=jtzz9Th50Tg&t=56s', 'jtzz9Th50Tg', NULL, TRUE, NOW(), NOW()),
  ('hv-wp-97042736', 46, 'Hướng dẫn lắp đặt + kết nối 2 smartphone cho 1 tai nghe SCS S-6 và test loa', 'https://www.youtube.com/watch?v=C7_JasHZtpQ', 'C7_JasHZtpQ', NULL, TRUE, NOW(), NOW()),
  ('hv-wp-42780d7a', 47, 'Tại sao phải gắn tai nghe bluetooth SCS S-6 cho mũ bảo hiểm 3/4 ?', 'https://www.youtube.com/watch?v=H_3UpQR7qoE&t=70s', 'H_3UpQR7qoE', NULL, TRUE, NOW(), NOW()),
  ('hv-wp-90dc7d03', 48, 'SCS S-9 Tai nghe bluetooth intercom cho mũ bảo hiểm fullface', 'https://www.youtube.com/watch?v=SRHj8xhghYk', 'SRHj8xhghYk', NULL, TRUE, NOW(), NOW()),
  ('hv-wp-45186c0f', 49, 'Xịn xò thế nào? SCS S-9 Tai nghe bluetooth intercom cho mũ bảo hiểm này', 'https://www.youtube.com/watch?v=YujSP3_Pvy4', 'YujSP3_Pvy4', NULL, TRUE, NOW(), NOW()),
  ('hv-wp-f375e72d', 50, 'Làm sao kết nối INTERCOM 4 bikers với SCS S-9 ?', 'https://www.youtube.com/watch?v=2G7zJ0rDZwE', '2G7zJ0rDZwE', NULL, TRUE, NOW(), NOW()),
  ('hv-wp-c6557515', 51, 'SCS S9 Lắp đặt lên nón và kết nối', 'https://www.youtube.com/watch?v=2IV0fSIpnaQ', '2IV0fSIpnaQ', NULL, TRUE, NOW(), NOW()),
  ('hv-wp-a8930bc5', 52, 'SCS S 7 Review Full + lắp đặt + kết nối 2 smartphone', 'https://www.youtube.com/watch?v=NOQBmaTB3ZI&t=1s', 'NOQBmaTB3ZI', NULL, TRUE, NOW(), NOW()),
  ('hv-wp-2f7f1d22', 53, 'Bluetooth intercom cho mũ fullface SCS S3', 'https://www.youtube.com/watch?v=wQcCidH5prE', 'wQcCidH5prE', NULL, TRUE, NOW(), NOW()),
  ('hv-wp-b7120aae', 54, 'GĂNG TAY XỊN SAO RẺ THẾ ! ALPINESTARS INTERTIAL AIR GLOVES', 'https://www.youtube.com/watch?v=MHT4rTCThlE', 'MHT4rTCThlE', NULL, TRUE, NOW(), NOW()),
  ('hv-wp-d19c05d0', 55, 'ÁO BẢO HỘ MÔ TÔ CHÍNH HÃNG ALPINESTARS AXEL AIR', 'https://www.youtube.com/watch?v=5DmxRiljuwc', '5DmxRiljuwc', NULL, TRUE, NOW(), NOW()),
  ('hv-wp-b449d66d', 56, 'Hướng dẫn lắp túi SW Motech chống nước lên xe', 'https://www.youtube.com/watch?v=r4jEzTFYvR4', 'r4jEzTFYvR4', NULL, TRUE, NOW(), NOW()),
  ('hv-wp-aa3a4d94', 57, 'Túi đuôi xe CUCYMA, chạy 299 còn nguyên !', 'https://www.youtube.com/watch?v=eobqt5I9pD4', 'eobqt5I9pD4', NULL, TRUE, NOW(), NOW()),
  ('hv-wp-7ef558ca', 58, 'TEST QUAY VIDEO 4K TRÊN SIÊU PHẨM SENA 10C EVO !', 'https://www.youtube.com/watch?v=rnhy62TGPlw&t=2s', 'rnhy62TGPlw', NULL, TRUE, NOW(), NOW()),
  ('hv-wp-fa3c6dcd', 59, 'LIỆU CÓ ỔN KHÔNG ? Sena 10C EVO Bluetooth Intercom quay Video 4K', 'https://www.youtube.com/watch?v=6Vc4kTk8-0Q&t=65s', '6Vc4kTk8-0Q', NULL, TRUE, NOW(), NOW());

-- Verify
SELECT id, sort_order, youtube_id, LEFT(title, 60) AS title FROM home_videos ORDER BY sort_order LIMIT 20;
