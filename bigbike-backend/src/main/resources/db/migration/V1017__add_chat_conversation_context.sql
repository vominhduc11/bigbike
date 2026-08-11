alter table chat_conversations
    add column if not exists context_json jsonb;

alter table chat_messages
    add column if not exists ai_retry_count integer not null default 0;
