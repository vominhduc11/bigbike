-- Phase 3E: customer quality feedback and weekly topic reporting.
-- Canonical evidence: CHAT_RULE_050 (2026-08-25).

create table if not exists chat_message_feedback (
    id uuid primary key default gen_random_uuid(),
    message_id uuid not null unique references chat_messages(id) on delete cascade,
    conversation_id uuid not null references chat_conversations(id) on delete cascade,
    rating varchar(16) not null,
    reason varchar(32),
    topic_code varchar(48) not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint ck_chat_feedback_rating check (rating in ('HELPFUL', 'UNHELPFUL')),
    constraint ck_chat_feedback_shape check (
        (rating = 'HELPFUL' and reason is null)
        or (rating = 'UNHELPFUL' and reason in (
            'WRONG_ANSWER', 'MISUNDERSTOOD', 'MISSING_INFORMATION', 'OFF_TOPIC'
        ))
    )
);
create index if not exists idx_chat_feedback_created
    on chat_message_feedback(created_at, topic_code, rating);
