-- Owner decisions 2026-09-05.
-- 1) BUSINESS_RULES.md CHAT_RULE_001/060 + DATA_CONTRACT.md `chat_messages`:
--    the assistant already writes 'RULE' (deterministic backend answers: greeting, policy,
--    shop info, polite refusal) and 'PROVIDER_UNAVAILABLE' (apology when the AI provider fails).
--    ck_chat_message_source never listed them, so every one of those replies was composed and
--    then rejected at insert time and the customer saw an error screen. Widen the constraint to
--    the nine values ChatMessageSource declares; ChatMessageSourcePostgresTest keeps the two in
--    sync from now on.
-- 2) BUSINESS_RULES.md CHAT_RULE_049: the assistant only remembers inside the open browser
--    session. Drop the long-term memory switch, shrink the remembered window and clear every
--    stored device identifier once. Transcripts keep their 90-day retention (CHAT_RULE_013):
--    chat_conversations.visitor_id is nulled first, never cascaded.

alter table chat_messages
    drop constraint if exists ck_chat_message_source;

alter table chat_messages
    add constraint ck_chat_message_source check (source in (
        'AI', 'RULE', 'TEMPLATE', 'TOOL', 'CONTACT_FALLBACK',
        'PROVIDER_UNAVAILABLE', 'OUT_OF_SCOPE', 'CONTENT_REFUSAL', 'ROLE_DEFENSE'
    ));

-- Session-only visitor identity.
update chat_conversations set visitor_id = null where visitor_id is not null;
delete from chat_visitors;

alter table chat_visitors
    drop column if exists memory_enabled;

alter table chat_visitors
    alter column remembered_until set default now() + interval '12 hours';
