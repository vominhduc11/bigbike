-- V337: Gỡ 3 ô SEO trang chủ khỏi nhóm setting `seo` (quyết định chủ shop 2026-07-12):
-- seo_home_title (SEO Title), seo_home_description (SEO Description), og_image_url (ảnh
-- chia sẻ mạng xã hội). Web (bigbike-web/app/page.tsx): title/description trang chủ rơi
-- về site_name, bỏ og:image mặc định. Gỡ cùng: 3 khai báo trong SettingDefinitionRegistry
-- + các entry liên quan trong admin constants.js. GIỮ nguyên home_content_bottom_html
-- (ô "Nội dung SEO cuối trang chủ") và tab "SEO website". Khác hẳn SEO per-entity
-- (category/product/article) — không đụng. Idempotent.

delete from site_settings
where setting_key in (
    'seo_home_title',
    'seo_home_description',
    'og_image_url'
);
