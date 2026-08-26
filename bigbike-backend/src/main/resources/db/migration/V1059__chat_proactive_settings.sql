-- Phase 3F: restrained proactive prompts, disabled by default.
-- Canonical evidence: CHAT_RULE_051 (2026-08-25).

insert into site_settings (
    id, setting_key, setting_value, setting_value_en, setting_group,
    is_public, description, created_at, updated_at
) values
    (gen_random_uuid(), 'ai_assistant_proactive_enabled', 'false', null, 'ai_assistant', false,
     'Cho phép Trợ lý chủ động mở lời đúng một lần mỗi phiên; mặc định tắt.', now(), now()),
    (gen_random_uuid(), 'ai_assistant_proactive_product_seconds', '45', null, 'ai_assistant', false,
     'Số giây khách ở trang sản phẩm trước khi gợi ý; từ 15 đến 600.', now(), now()),
    (gen_random_uuid(), 'ai_assistant_proactive_cart_seconds', '120', null, 'ai_assistant', false,
     'Số giây giỏ có hàng chưa thanh toán trước khi gợi ý; từ 15 đến 600.', now(), now())
on conflict (setting_key) do update
set setting_group = excluded.setting_group,
    is_public = false,
    description = excluded.description,
    updated_at = now();
