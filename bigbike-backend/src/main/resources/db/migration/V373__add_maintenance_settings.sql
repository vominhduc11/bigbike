-- V373: planned maintenance state and two independent storefront switches.
-- Keep the rows in the existing flat site_settings table so current admin settings
-- screens, audit snapshots and the public settings registry remain the single path.

insert into site_settings (id, setting_key, setting_value, setting_group, is_public, description, created_at, updated_at)
values
    (gen_random_uuid(), 'maintenance_mode', 'NORMAL', 'maintenance', false,
     'Trạng thái vận hành: Bình thường, Sắp bảo trì hoặc Đang bảo trì.', now(), now()),
    (gen_random_uuid(), 'maintenance_notice_enabled', 'false', 'maintenance', false,
     'Công tắc hiển thị dải thông báo bảo trì trên storefront.', now(), now()),
    (gen_random_uuid(), 'maintenance_orders_paused', 'false', 'maintenance', false,
     'Công tắc tạm ngưng nhận đơn; backend vẫn bắt buộc chặn checkout.', now(), now()),
    (gen_random_uuid(), 'maintenance_notice_content', 'Website đang được nâng cấp', 'maintenance', false,
     'Nội dung dải thông báo bảo trì trên storefront.', now(), now()),
    (gen_random_uuid(), 'maintenance_expected_at', '', 'maintenance', false,
     'Thời điểm ISO-8601 dự kiến khoá để hiển thị đếm ngược.', now(), now())
on conflict (setting_key) do update
set setting_group = excluded.setting_group,
    is_public = false,
    description = excluded.description,
    updated_at = now();
