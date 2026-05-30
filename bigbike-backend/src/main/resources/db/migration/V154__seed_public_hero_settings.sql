-- V153: Seed PUBLIC_HERO settings for listing-page hero banners.
-- Covers /san-pham (products), /brands (brands), /tin-tuc (news).
-- valueType is resolved by SettingDefinitionRegistry in code — not stored in DB.

insert into site_settings (id, setting_key, setting_value, setting_group, is_public, description, created_at, updated_at)
values
    -- ── Tất cả sản phẩm (/san-pham) ──────────────────────────────────────────
    (gen_random_uuid(), 'hero_products_image_url',        '', 'public_hero', true,  'Ảnh nền hero trang Tất cả sản phẩm (/san-pham). Ảnh nằm ngang rộng, ví dụ 1920×600px.', now(), now()),
    (gen_random_uuid(), 'hero_products_mobile_image_url', '', 'public_hero', true,  'Ảnh mobile hero trang Tất cả sản phẩm — portrait ~768×900px cho viewport ≤767px.', now(), now()),
    (gen_random_uuid(), 'hero_products_image_alt',        '', 'public_hero', true,  'Alt text ảnh hero trang Tất cả sản phẩm.', now(), now()),
    (gen_random_uuid(), 'hero_products_title',            '', 'public_hero', true,  'Tiêu đề hero trang Tất cả sản phẩm.', now(), now()),
    (gen_random_uuid(), 'hero_products_description',      '', 'public_hero', true,  'Mô tả ngắn dưới tiêu đề hero trang Tất cả sản phẩm.', now(), now()),
    (gen_random_uuid(), 'hero_products_kicker',           '', 'public_hero', true,  'Kicker (chip nhỏ trên tiêu đề) hero trang Tất cả sản phẩm.', now(), now()),

    -- ── Thương hiệu (/brands) ────────────────────────────────────────────────
    (gen_random_uuid(), 'hero_brands_image_url',          '', 'public_hero', true,  'Ảnh nền hero trang Thương hiệu (/brands). Ảnh nằm ngang rộng, ví dụ 1920×600px.', now(), now()),
    (gen_random_uuid(), 'hero_brands_mobile_image_url',   '', 'public_hero', true,  'Ảnh mobile hero trang Thương hiệu — portrait ~768×900px cho viewport ≤767px.', now(), now()),
    (gen_random_uuid(), 'hero_brands_image_alt',          '', 'public_hero', true,  'Alt text ảnh hero trang Thương hiệu.', now(), now()),
    (gen_random_uuid(), 'hero_brands_title',              '', 'public_hero', true,  'Tiêu đề hero trang Thương hiệu.', now(), now()),
    (gen_random_uuid(), 'hero_brands_description',        '', 'public_hero', true,  'Mô tả ngắn dưới tiêu đề hero trang Thương hiệu.', now(), now()),
    (gen_random_uuid(), 'hero_brands_kicker',             '', 'public_hero', true,  'Kicker hero trang Thương hiệu.', now(), now()),

    -- ── Tin tức (/tin-tuc) ───────────────────────────────────────────────────
    (gen_random_uuid(), 'hero_news_image_url',            '', 'public_hero', true,  'Ảnh nền hero trang Tin tức (/tin-tuc). Ảnh nằm ngang rộng, ví dụ 1920×600px.', now(), now()),
    (gen_random_uuid(), 'hero_news_mobile_image_url',     '', 'public_hero', true,  'Ảnh mobile hero trang Tin tức — portrait ~768×900px cho viewport ≤767px.', now(), now()),
    (gen_random_uuid(), 'hero_news_image_alt',            '', 'public_hero', true,  'Alt text ảnh hero trang Tin tức.', now(), now()),
    (gen_random_uuid(), 'hero_news_title',                '', 'public_hero', true,  'Tiêu đề hero trang Tin tức.', now(), now()),
    (gen_random_uuid(), 'hero_news_description',          '', 'public_hero', true,  'Mô tả ngắn dưới tiêu đề hero trang Tin tức.', now(), now()),
    (gen_random_uuid(), 'hero_news_kicker',               '', 'public_hero', true,  'Kicker hero trang Tin tức.', now(), now())
on conflict (setting_key) do nothing;
