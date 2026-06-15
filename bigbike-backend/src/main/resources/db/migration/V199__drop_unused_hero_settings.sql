-- Gỡ hẳn 9 ô cấu hình hero không được web tiêu thụ: mẫu hero (WpCategoryHero) chỉ hiển thị
-- tiêu đề + ảnh nền + ảnh minh hoạ, không có kicker / mô tả / ảnh mobile riêng. Các key này
-- cũng đã được xoá khỏi SettingDefinitionRegistry, nên xoá luôn dòng dữ liệu cho sạch.

delete from site_settings
where setting_key in (
    'hero_products_kicker', 'hero_products_description', 'hero_products_mobile_image_url',
    'hero_brands_kicker',   'hero_brands_description',   'hero_brands_mobile_image_url',
    'hero_news_kicker',     'hero_news_description',     'hero_news_mobile_image_url'
);
