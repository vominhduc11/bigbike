-- Owner decision 2026-08-12: Bi may read a bounded, redacted history from the same
-- conversation to understand follow-up wording. Zero restores the previous no-history mode.
insert into site_settings (
    id, setting_key, setting_value, setting_value_en, setting_group,
    is_public, description, created_at, updated_at
)
values (
    gen_random_uuid(),
    'ai_assistant_recent_turn_pairs',
    '3',
    null,
    'ai_assistant',
    false,
    'Số cặp hỏi–đáp gần nhất gửi cho Bi sau khi che thông tin riêng tư; 0 để tắt, tối đa 3.',
    now(),
    now()
)
on conflict (setting_key) do update
set setting_group = excluded.setting_group,
    is_public = false,
    description = excluded.description,
    updated_at = now();
