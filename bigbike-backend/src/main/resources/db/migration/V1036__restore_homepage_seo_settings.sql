-- Owner decision 2026-08-16: reopen the three homepage SEO fields that V337 removed.
-- Keep the migration idempotent and never overwrite an existing administrator value.

insert into site_settings (
    id, setting_key, setting_value, setting_value_en, setting_group,
    is_public, description, created_at, updated_at
)
values
    (
        gen_random_uuid(),
        'seo_home_title',
        'Shop Đồ Bảo Hộ Moto Chính Hãng TP.HCM | BigBike.vn',
        'Genuine Motorcycle Gear Shop in Ho Chi Minh City | BigBike',
        'seo', true,
        'Tiêu đề SEO trang chủ; để trống sẽ dùng tên shop.',
        now(), now()
    ),
    (
        gen_random_uuid(),
        'seo_home_description',
        'BigBike bán mũ bảo hiểm, áo giáp, găng tay, giày bảo hộ moto chính hãng từ 2014 tại TP.HCM. Tư vấn thật, cân mũ tại shop, giao toàn quốc.',
        'BigBike has sold genuine motorcycle helmets, jackets, gloves and boots in Ho Chi Minh City since 2014. Honest advice, in-store fitting, nationwide delivery.',
        'seo', true,
        'Mô tả SEO trang chủ; để trống sẽ dùng mô tả trang chủ theo ngôn ngữ.',
        now(), now()
    ),
    (
        gen_random_uuid(),
        'seo_home_h1',
        'Shop Bảo Hộ Moto Uy Tín Tại TP.HCM',
        'Trusted Motorcycle Protective Gear Shop in Ho Chi Minh City',
        'seo', true,
        'Tiêu đề chính duy nhất hiển thị trên trang chủ; để trống sẽ dùng tên shop.',
        now(), now()
    )
on conflict (setting_key) do update
set setting_group = excluded.setting_group,
    is_public = excluded.is_public,
    description = excluded.description,
    setting_value = case
        when nullif(trim(site_settings.setting_value), '') is null then excluded.setting_value
        else site_settings.setting_value
    end,
    setting_value_en = case
        when nullif(trim(site_settings.setting_value_en), '') is null then excluded.setting_value_en
        else site_settings.setting_value_en
    end,
    updated_at = now();
