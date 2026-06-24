-- V281: Chuẩn hoá địa chỉ ảnh trong bài viết về kho MinIO của mình (đường dẫn /media/...).
--
-- Bối cảnh: ảnh bài viết WP-import đang trỏ lung tung — cột body (web hiển thị) hotlink website
-- WordPress cũ (bigbike.vn/wp-content/uploads), còn body_blocks (lớp chỉnh sửa) trỏ địa chỉ máy
-- nội bộ (localhost:9000/bigbike-media). Ảnh đã có sẵn trong MinIO nên gom hết về proxy /media/.
--
-- Quy đổi:
--   https://bigbike.vn/wp-content/uploads/  ->  /media/wp-uploads/
--   http://localhost:9000/bigbike-media/    ->  /media/
-- GIỮ NGUYÊN (không có trong kho — đổi sẽ thành ảnh hỏng):
--   - mua-giay-scoyco-alpinestar-1024x772.png (khôi phục về link ngoài sau khi replace)
--   - bigbike.vn/media/wysiwyg/* (di sản Magento, không đụng tới)
--   - hotlink ngoài thật: c.cdnmp.net, motogear.my, motoworld.com.sg, youtube embed
--
-- Chỉ chuẩn hoá URL; KHÔNG dựng lại body từ blocks (giữ HTML gốc). Idempotent: chạy lại vô hại.

UPDATE articles
SET body = replace(replace(replace(body,
      'https://bigbike.vn/wp-content/uploads/', '/media/wp-uploads/'),
      'http://localhost:9000/bigbike-media/', '/media/'),
      '/media/wp-uploads/2021/05/mua-giay-scoyco-alpinestar-1024x772.png',
      'https://bigbike.vn/wp-content/uploads/2021/05/mua-giay-scoyco-alpinestar-1024x772.png')
WHERE body LIKE '%bigbike.vn/wp-content/uploads/%'
   OR body LIKE '%localhost:9000/bigbike-media/%';

UPDATE articles
SET body_blocks = replace(replace(replace(body_blocks::text,
      'https://bigbike.vn/wp-content/uploads/', '/media/wp-uploads/'),
      'http://localhost:9000/bigbike-media/', '/media/'),
      '/media/wp-uploads/2021/05/mua-giay-scoyco-alpinestar-1024x772.png',
      'https://bigbike.vn/wp-content/uploads/2021/05/mua-giay-scoyco-alpinestar-1024x772.png')::jsonb
WHERE body_blocks::text LIKE '%bigbike.vn/wp-content/uploads/%'
   OR body_blocks::text LIKE '%localhost:9000/bigbike-media/%';
