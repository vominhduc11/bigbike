-- Phase 3A: substantive-turn cap is owner-configurable and conversations can continue.
-- Canonical evidence: CHAT_RULE_009 (owner decision 2026-08-25).

alter table chat_conversations
    drop constraint if exists ck_chat_conversation_turn_count;

alter table chat_conversations
    add column if not exists counted_turns integer not null default 0,
    add column if not exists thread_id uuid,
    add column if not exists continued_from_id uuid references chat_conversations(id) on delete set null;

update chat_conversations
set counted_turns = greatest(0, turn_count),
    thread_id = id
where counted_turns = 0 or thread_id is null;

alter table chat_conversations
    alter column thread_id set not null,
    add constraint ck_chat_conversation_turn_count check (turn_count >= 0),
    add constraint ck_chat_conversation_counted_turns check (counted_turns between 0 and 100);

alter table chat_conversations
    drop constraint if exists ck_chat_conversation_ended_reason;
alter table chat_conversations
    add constraint ck_chat_conversation_ended_reason check (
        ended_reason is null or ended_reason in (
            'TURN_LIMIT', 'CONTINUED', 'OFF_TOPIC', 'HANDOFF', 'AI_UNAVAILABLE',
            'DAILY_LIMIT_REACHED', 'DISABLED', 'CLOSED'
        )
    );

create index if not exists idx_chat_conversations_thread
    on chat_conversations(thread_id, started_at);

insert into site_settings (
    id, setting_key, setting_value, setting_value_en, setting_group,
    is_public, description, created_at, updated_at
) values (
    gen_random_uuid(), 'ai_assistant_conversation_turn_limit', '40', null,
    'ai_assistant', false,
    'Số lượt tư vấn có nội dung tối đa trong một hội thoại; từ 10 đến 100. Vòng làm rõ không tính.',
    now(), now()
) on conflict (setting_key) do update
set setting_group = excluded.setting_group,
    is_public = false,
    description = excluded.description,
    updated_at = now();
