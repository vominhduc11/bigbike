-- V156: Seed global hero default image settings.
-- hero_default_bg_url      — replaces hardcoded WP_HERO_BG_SOLID fallback.
-- hero_default_illustration_url — replaces hardcoded WP_HERO_ILLUSTRATION gear fallback.

insert into site_settings (id, setting_key, setting_value, setting_group, is_public, description, created_at, updated_at)
values
    (gen_random_uuid(), 'hero_default_bg_url',            '', 'public_hero', true,
     'Ảnh nền mặc định cho hero banner khi trang không cấu hình ảnh riêng. Ảnh nằm ngang, ví dụ 1920×600px.', now(), now()),
    (gen_random_uuid(), 'hero_default_illustration_url',  '', 'public_hero', true,
     'Ảnh minh hoạ cut-out mặc định góc phải hero (thay ảnh gear cố định). PNG nền trong, tỷ lệ ~700×600px.', now(), now())
on conflict (setting_key) do nothing;
