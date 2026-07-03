-- V311: Gỡ hẳn nhóm setting public_home — 4 khối trang chủ (banner promo, trải nghiệm,
-- giới thiệu, kicker/tiêu đề Sản phẩm nổi bật/Tin tức/Video) đã hardcode thẳng trong
-- bigbike-web (quyết định chủ shop 2026-07-03). Gỡ cùng: khai báo trong
-- SettingDefinitionRegistry, tab "Trang chủ" + các entry liên quan trong admin constants.js.
-- Idempotent.

delete from site_settings
where setting_key in (
    'promo_title', 'promo_off', 'promo_href', 'promo_image_url',
    'home_exp_subtitle', 'home_exp_title', 'home_exp_desc',
    'about_title', 'about_subtitle', 'about_content_html',
    'home_featured_kicker', 'home_featured_title',
    'home_news_kicker', 'home_news_title',
    'home_videos_title'
);
