-- Mỗi trang listing (/san-pham, /brands, /tin-tuc) được một ảnh "gear" (ảnh minh hoạ
-- cut-out góc phải hero) RIÊNG, thay vì cả 3 trang dùng chung hero_default_illustration_url.
-- Cascade khi render: ảnh riêng của trang → hero_default_illustration_url → ảnh cứng trong
-- WpCategoryHero. Seed rỗng để admin nhìn thấy & cấu hình; on conflict do nothing để không
-- đè chỉnh tay. Các key cũng được đăng ký trong SettingDefinitionRegistry (IMAGE_URL, publicAllowed).

insert into site_settings (id, setting_key, setting_value, setting_group, is_public, description, created_at, updated_at)
values
    (gen_random_uuid(), 'hero_products_illustration_url', '', 'public_hero', true, 'Ảnh minh hoạ (gear) góc phải hero trang Tất cả sản phẩm. PNG nền trong, tỷ lệ ~700×600px. Bỏ trống sẽ dùng ảnh gear mặc định chung.', now(), now()),
    (gen_random_uuid(), 'hero_brands_illustration_url',   '', 'public_hero', true, 'Ảnh minh hoạ (gear) góc phải hero trang Thương hiệu. PNG nền trong, tỷ lệ ~700×600px. Bỏ trống sẽ dùng ảnh gear mặc định chung.', now(), now()),
    (gen_random_uuid(), 'hero_news_illustration_url',     '', 'public_hero', true, 'Ảnh minh hoạ (gear) góc phải hero trang Tin tức. PNG nền trong, tỷ lệ ~700×600px. Bỏ trống sẽ dùng ảnh gear mặc định chung.', now(), now())
on conflict (setting_key) do nothing;
