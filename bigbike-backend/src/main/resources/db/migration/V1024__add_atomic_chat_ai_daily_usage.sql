-- CHAT_RULE_010 (2026-08-14): one atomic logical-AI slot per Vietnamese calendar day.
-- Applied migrations V1016..V1023 are intentionally left untouched.

create table chat_ai_daily_usage (
    usage_date date primary key,
    used_count integer not null default 0,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint ck_chat_ai_daily_usage_count check (used_count >= 0)
);

insert into chat_ai_daily_usage (usage_date, used_count, created_at, updated_at)
select (created_at at time zone 'Asia/Ho_Chi_Minh')::date,
       count(*) filter (where role = 'ASSISTANT' and ai_called = true),
       now(),
       now()
from chat_messages
group by (created_at at time zone 'Asia/Ho_Chi_Minh')::date
having count(*) filter (where role = 'ASSISTANT' and ai_called = true) > 0;
