-- Nhóm "Hero trang" (public_hero) có 20 ô nhưng tất cả đang rỗng nên admin không thấy
-- dữ liệu nào. Seed các ô ĐANG được web tiêu thụ (WpCategoryHero: title + ảnh nền + ảnh
-- minh hoạ) bằng đúng giá trị mặc định trang đang hiển thị, để admin nhìn thấy & sửa được.
-- Các row đã tồn tại (rỗng) nên dùng UPDATE; chỉ set khi còn trống để không đè chỉnh tay.

update site_settings set setting_value = '/wp-content/themes/bigbike/images/page-title-bg.png', updated_at = now()
where setting_key = 'hero_default_bg_url' and coalesce(setting_value, '') = '';

update site_settings set setting_value = '/wp-content/themes/bigbike/images/mu-bao-hiem.png', updated_at = now()
where setting_key = 'hero_default_illustration_url' and coalesce(setting_value, '') = '';

update site_settings set setting_value = 'Tất cả sản phẩm', updated_at = now()
where setting_key = 'hero_products_title' and coalesce(setting_value, '') = '';

update site_settings set setting_value = 'Tin tức', updated_at = now()
where setting_key = 'hero_news_title' and coalesce(setting_value, '') = '';

update site_settings set setting_value = 'Thương hiệu', updated_at = now()
where setting_key = 'hero_brands_title' and coalesce(setting_value, '') = '';
