-- Phase 3D: disclosed same-device memory, never fingerprint/IP.
-- Canonical evidence: CHAT_RULE_049 (2026-08-25).

create table if not exists chat_visitors (
    id uuid primary key,
    token_hash char(64) not null unique,
    memory_enabled boolean not null default true,
    last_seen_at timestamptz not null default now(),
    remembered_until timestamptz not null default (now() + interval '30 days'),
    created_at timestamptz not null default now()
);

alter table chat_conversations
    add column if not exists visitor_id uuid references chat_visitors(id) on delete cascade;
create index if not exists idx_chat_conversations_visitor
    on chat_conversations(visitor_id, last_message_at desc)
    where visitor_id is not null;
create index if not exists idx_chat_visitors_remembered_until
    on chat_visitors(remembered_until);

insert into site_settings (
    id, setting_key, setting_value, setting_value_en, setting_group,
    is_public, description, created_at, updated_at
) values (
    gen_random_uuid(), 'ai_assistant_memory_days', '30', null, 'ai_assistant', false,
    'Số ngày tối đa trợ lý nối ngữ cảnh cùng thiết bị; giai đoạn 3 dùng 30 ngày.', now(), now()
) on conflict (setting_key) do update
set setting_group = excluded.setting_group,
    is_public = false,
    description = excluded.description,
    updated_at = now();
