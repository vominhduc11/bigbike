-- V201: Hai ô ảnh mặc định hero (hero_default_bg_url, hero_default_illustration_url) được V198
-- seed bằng đường dẫn theme nội bộ "/wp-content/themes/bigbike/images/...". Đường dẫn này chỉ tồn
-- tại trong static folder của bigbike-web nên màn Cài đặt của admin (khác origin; nginx admin chỉ
-- proxy /media và /media-proxy, KHÔNG proxy /wp-content) không tải được ảnh để xem trước → field
-- báo "URL ảnh không hợp lệ" dù storefront vẫn hiển thị bình thường.
--
-- Ghi lại bằng URL production tuyệt đối để CẢ HAI surface phân giải được: storefront giữ nguyên URL
-- bigbike.vn /wp-content/themes/... (resolveMediaUrl chỉ rewrite /wp-content/uploads/, không đụng
-- /themes/), còn admin tải ảnh trực tiếp. Đã verify HTTP 200 image/png tại cả 2 URL. Cùng convention
-- với V194 (seed promo banner image).
--
-- Guard "= đúng đường dẫn relative cũ" để KHÔNG đè ảnh admin đã tự chọn qua màn Cài đặt.

update site_settings
set    setting_value = 'https://bigbike.vn/wp-content/themes/bigbike/images/page-title-bg.png',
       updated_at = now()
where  setting_key = 'hero_default_bg_url'
  and  setting_value = '/wp-content/themes/bigbike/images/page-title-bg.png';

update site_settings
set    setting_value = 'https://bigbike.vn/wp-content/themes/bigbike/images/mu-bao-hiem.png',
       updated_at = now()
where  setting_key = 'hero_default_illustration_url'
  and  setting_value = '/wp-content/themes/bigbike/images/mu-bao-hiem.png';
