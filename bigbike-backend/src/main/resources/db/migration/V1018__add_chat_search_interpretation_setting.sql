-- Đợt 2 trợ lý Bi: công tắc vận hành để quay ngay về cơ chế tìm hàng cũ.
-- Mặc định true theo quyết định owner 2026-08-11; không ghi đè giá trị nếu
-- một môi trường đã có dòng này từ lần triển khai thử trước đó.
insert into site_settings (
    id, setting_key, setting_value, setting_value_en, setting_group,
    is_public, description, created_at, updated_at
)
values (
    gen_random_uuid(),
    'ai_assistant_search_ai_interpretation_enabled',
    'true',
    null,
    'ai_assistant',
    false,
    'Cho AI diễn giải cách nói tự nhiên khi tìm hàng; backend vẫn đối chiếu từng bộ lọc. Tắt để quay về cách kiểm chứng cũ.',
    now(),
    now()
)
on conflict (setting_key) do update
set setting_group = excluded.setting_group,
    is_public = false,
    description = excluded.description,
    updated_at = now();
