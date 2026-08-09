-- V1016: Bi AI sales assistant — conversations, messages, consented leads and settings.
-- Owner decision 2026-08-09; BUSINESS_RULES.md CHAT_RULE_001..014.
--
-- Version 1016 is intentional: both the repository and the running development database
-- are at V1015. Production loads only db/migration, but using a globally unique next
-- number prevents the collision class already seen twice in this repository.

create table chat_conversations (
    id                    uuid primary key default gen_random_uuid(),
    customer_id           uuid references customers(id) on delete set null,
    locale                varchar(2) not null,
    turn_count            integer not null default 0,
    ai_call_count         integer not null default 0,
    consecutive_off_topic integer not null default 0,
    lead_offer_status     varchar(16) not null default 'NONE',
    ended_reason          varchar(32),
    started_at            timestamptz not null default now(),
    last_message_at       timestamptz not null default now(),
    expires_at            timestamptz not null default (now() + interval '90 days'),
    created_at            timestamptz not null default now(),
    updated_at            timestamptz not null default now(),
    constraint ck_chat_conversation_locale check (locale in ('vi', 'en')),
    constraint ck_chat_conversation_turn_count check (turn_count between 0 and 12),
    constraint ck_chat_conversation_ai_count check (ai_call_count >= 0),
    constraint ck_chat_conversation_off_topic check (consecutive_off_topic >= 0),
    constraint ck_chat_conversation_lead_status
        check (lead_offer_status in ('NONE', 'OFFERED', 'ACCEPTED', 'DECLINED')),
    constraint ck_chat_conversation_ended_reason check (
        ended_reason is null or ended_reason in (
            'TURN_LIMIT', 'OFF_TOPIC', 'HANDOFF', 'AI_UNAVAILABLE',
            'DAILY_LIMIT_REACHED', 'DISABLED'
        )
    )
);

create table chat_messages (
    id              uuid primary key default gen_random_uuid(),
    conversation_id uuid not null references chat_conversations(id) on delete cascade,
    role            varchar(16) not null,
    content         text not null,
    source          varchar(24) not null,
    ai_called       boolean not null default false,
    products_json   jsonb,
    created_at      timestamptz not null default now(),
    constraint ck_chat_message_role check (role in ('CUSTOMER', 'ASSISTANT')),
    constraint ck_chat_message_source check (source in ('AI', 'TEMPLATE', 'TOOL', 'CONTACT_FALLBACK'))
);

create table chat_leads (
    id              uuid primary key default gen_random_uuid(),
    conversation_id uuid not null unique references chat_conversations(id) on delete cascade,
    name            varchar(100),
    phone           varchar(32) not null,
    note            varchar(500),
    consented_at    timestamptz not null,
    created_at      timestamptz not null default now()
);

create index idx_chat_conversations_last_message
    on chat_conversations(last_message_at desc);
create index idx_chat_conversations_expires_at
    on chat_conversations(expires_at);
create index idx_chat_conversations_customer_id
    on chat_conversations(customer_id) where customer_id is not null;
create index idx_chat_messages_conversation_created
    on chat_messages(conversation_id, created_at);
create index idx_chat_messages_ai_called_created
    on chat_messages(created_at) where ai_called = true;
create index idx_chat_leads_created_at
    on chat_leads(created_at desc);

insert into site_settings (
    id, setting_key, setting_value, setting_value_en, setting_group,
    is_public, description, created_at, updated_at
)
values
    (gen_random_uuid(), 'ai_assistant_enabled', 'true', null, 'ai_assistant', false,
     'Bật trợ lý bán hàng Bi. Khi tắt, widget trở về bảng Hotline–Zalo–Messenger.', now(), now()),
    (gen_random_uuid(), 'ai_assistant_daily_limit', '60', null, 'ai_assistant', false,
     'Số lượt trả lời có gọi AI tối đa mỗi ngày theo giờ Việt Nam. Đặt 0 để tắt phần AI.', now(), now()),
    (gen_random_uuid(), 'ai_assistant_greeting',
     'Em là Bi, trợ lý ảo AI của BigBike. Em có thể giúp anh/chị chọn sản phẩm, xem chính sách hoặc kiểm tra đơn hàng đã đăng nhập.',
     'I’m Bi, BigBike’s AI assistant. I can help you choose products, check store policies, or view orders on your signed-in account.',
     'ai_assistant', false, 'Câu chào đầu khung chat của Bi.', now(), now()),
    (gen_random_uuid(), 'ai_assistant_quick_prompts',
     E'Tìm mũ bảo hiểm theo ngân sách\nTư vấn chọn size\nChính sách đổi trả\nKiểm tra đơn hàng của tôi',
     E'Find a helmet within my budget\nHelp me choose a size\nReturn policy\nCheck my orders',
     'ai_assistant', false, 'Mỗi dòng là một nút gợi ý nhanh; widget dùng tối đa 4 dòng.', now(), now())
on conflict (setting_key) do update
set setting_group = excluded.setting_group,
    is_public = false,
    description = excluded.description,
    updated_at = now();
