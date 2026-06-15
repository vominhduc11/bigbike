-- V204: Điền sẵn ô ảnh Open Graph (og_image_url) đang trống để admin không còn ô trống và để mạng
-- xã hội có ảnh khi chia sẻ trang chủ. Dùng đúng logo website đang dùng
-- (https://bigbike.vn/wp-content/themes/bigbike/images/logo.png — verify 200 image/png), URL tuyệt
-- đối nên cả admin xem trước lẫn crawler mạng xã hội đều tải được.
--
-- Guard "coalesce(...,'') = ''" để KHÔNG đè giá trị admin đã tự nhập.

update site_settings
set    setting_value = 'https://bigbike.vn/wp-content/themes/bigbike/images/logo.png',
       updated_at = now()
where  setting_key = 'og_image_url' and coalesce(setting_value, '') = '';
