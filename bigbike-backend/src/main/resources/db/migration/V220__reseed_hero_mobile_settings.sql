-- Bổ sung lại 3 ô "ảnh nền hero cho điện thoại" cho các trang listing (/san-pham,
-- /brands, /tin-tuc). V199 từng xoá vì component WpCategoryHero chưa hỗ trợ ảnh mobile
-- riêng; nay web đã render art-direction (ảnh dọc riêng cho viewport ≤767px) nên đưa lại.
-- Các key cũng đã được thêm lại vào SettingDefinitionRegistry (valueType = IMAGE_URL).
-- Seed rỗng để admin nhìn thấy & cấu hình; on conflict do nothing để không đè chỉnh tay.

insert into site_settings (id, setting_key, setting_value, setting_group, is_public, description, created_at, updated_at)
values
    (gen_random_uuid(), 'hero_products_mobile_image_url', '', 'public_hero', true, 'Ảnh nền hero trang Tất cả sản phẩm cho điện thoại (viewport ≤767px). Ảnh dọc ~750×1125px. Bỏ trống sẽ dùng ảnh desktop.', now(), now()),
    (gen_random_uuid(), 'hero_brands_mobile_image_url',   '', 'public_hero', true, 'Ảnh nền hero trang Thương hiệu cho điện thoại (viewport ≤767px). Ảnh dọc ~750×1125px. Bỏ trống sẽ dùng ảnh desktop.', now(), now()),
    (gen_random_uuid(), 'hero_news_mobile_image_url',     '', 'public_hero', true, 'Ảnh nền hero trang Tin tức cho điện thoại (viewport ≤767px). Ảnh dọc ~750×1125px. Bỏ trống sẽ dùng ảnh desktop.', now(), now())
on conflict (setting_key) do nothing;
