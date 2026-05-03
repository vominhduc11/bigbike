-- Seed new site settings: Google Maps embed URL and homepage H1 heading.
-- site_name and bct_url already exist from earlier migrations (V22, V24).

insert into site_settings (id, setting_key, setting_value, setting_group, is_public, description, created_at, updated_at)
values
    (gen_random_uuid(), 'google_maps_url', '', 'contact', true,  'URL nhúng bản đồ Google Maps hiển thị trên trang Liên hệ. Lấy từ Google Maps → Chia sẻ → Nhúng bản đồ → copy URL trong thẻ src.', now(), now()),
    (gen_random_uuid(), 'seo_home_h1',     '', 'seo',     true,  'Tiêu đề H1 chính trên trang chủ (heading lớn nhất, quan trọng cho SEO). Nên khác với tiêu đề Google.', now(), now())
on conflict (setting_key) do nothing;
