-- V1044: complete the BigBike sales-assistant funnel, action attribution and owner settings.
-- Canonical evidence: CHAT_RULE_003/009/010/012/014/017/029..033 (2026-08-20).

alter table chat_conversations
    drop constraint if exists ck_chat_conversation_turn_count;

alter table chat_conversations
    add constraint ck_chat_conversation_turn_count check (turn_count between 0 and 20),
    add column if not exists lead_offer_count smallint not null default 0,
    add constraint ck_chat_conversation_lead_offer_count check (lead_offer_count between 0 and 2);

alter table chat_messages
    drop constraint if exists ck_chat_message_result_kind;

alter table chat_messages
    add constraint ck_chat_message_result_kind check (
        result_kind in ('ANSWER', 'PRODUCT_RESULTS', 'CLARIFICATION', 'OUT_OF_SCOPE', 'REFUSAL', 'CONTACT')
    );

create table if not exists chat_interactions (
    id                   uuid primary key default gen_random_uuid(),
    client_event_id      uuid not null unique,
    conversation_id      uuid not null references chat_conversations(id) on delete cascade,
    assistant_message_id uuid not null references chat_messages(id) on delete cascade,
    interaction_type     varchar(32) not null,
    lead_prompt_sequence smallint,
    action_type          varchar(48),
    created_at           timestamptz not null default now(),
    constraint ck_chat_interaction_type check (
        interaction_type in ('LEAD_PROMPT_VIEWED', 'ACTION_CLICKED')
    ),
    constraint ck_chat_interaction_sequence check (
        lead_prompt_sequence is null or lead_prompt_sequence between 1 and 2
    ),
    constraint ck_chat_interaction_shape check (
        (interaction_type = 'LEAD_PROMPT_VIEWED'
            and lead_prompt_sequence is not null and action_type is null)
        or
        (interaction_type = 'ACTION_CLICKED'
            and lead_prompt_sequence is null and action_type is not null)
    )
);

create unique index if not exists uk_chat_interaction_prompt_view
    on chat_interactions(conversation_id, assistant_message_id, lead_prompt_sequence)
    where interaction_type = 'LEAD_PROMPT_VIEWED';
create index if not exists idx_chat_interactions_action_created
    on chat_interactions(action_type, created_at)
    where interaction_type = 'ACTION_CLICKED';

alter table chat_messages
    add column if not exists origin_interaction_id uuid
        references chat_interactions(id) on delete set null;
create index if not exists idx_chat_messages_origin_interaction
    on chat_messages(origin_interaction_id)
    where origin_interaction_id is not null;

alter table cart_items
    add column if not exists assistant_interaction_id uuid
        references chat_interactions(id) on delete set null;
create index if not exists idx_cart_items_assistant_interaction
    on cart_items(assistant_interaction_id)
    where assistant_interaction_id is not null;

alter table chat_order_attributions
    add column if not exists interaction_id uuid
        references chat_interactions(id) on delete set null,
    add column if not exists action_type varchar(48);
create index if not exists idx_chat_order_attributions_action_created
    on chat_order_attributions(action_type, created_at)
    where action_type is not null;

-- Compare-and-set: keep every owner-customized daily limit unchanged.
update site_settings
set setting_value = '400',
    description = 'Số lượt trả lời có gọi AI tối đa mỗi ngày theo giờ Việt Nam. Đặt 0 để tắt phần AI.',
    updated_at = now()
where setting_key = 'ai_assistant_daily_limit'
  and setting_value = '120';

insert into site_settings (
    id, setting_key, setting_value, setting_value_en, setting_group,
    is_public, description, created_at, updated_at
)
values
    (gen_random_uuid(), 'ai_assistant_monthly_cost_warning_usd', '0', null,
     'ai_assistant', false,
     'Ngưỡng cảnh báo tổng chi phí AI theo tháng dương lịch (USD, giờ Việt Nam). Đặt 0 để tắt cảnh báo.',
     now(), now()),
    (gen_random_uuid(), 'ai_assistant_abbreviations', $json$
[
  {"locale":"vi","phrase":"mu bh","expansion":"mu bao hiem","enabled":true},
  {"locale":"vi","phrase":"mbh","expansion":"mu bao hiem","enabled":true},
  {"locale":"vi","phrase":"non","expansion":"mu bao hiem","enabled":true},
  {"locale":"vi","phrase":"kieng","expansion":"kinh","enabled":true},
  {"locale":"vi","phrase":"mu ff","expansion":"mu fullface","enabled":true},
  {"locale":"vi","phrase":"tn","expansion":"tai nghe","enabled":true},
  {"locale":"vi","phrase":"bh","expansion":"bao hanh","enabled":true},
  {"locale":"vi","phrase":"sdt","expansion":"so dien thoai","enabled":true},
  {"locale":"vi","phrase":"cty","expansion":"cong ty","enabled":true},
  {"locale":"vi","phrase":"ship","expansion":"giao hang","enabled":true},
  {"locale":"vi","phrase":"sz","expansion":"size","enabled":true},
  {"locale":"vi","phrase":"bnhieu","expansion":"bao nhieu","enabled":true},
  {"locale":"vi","phrase":"bn","expansion":"bao nhieu","enabled":true},
  {"locale":"vi","phrase":"hok","expansion":"khong","enabled":true},
  {"locale":"vi","phrase":"khong","expansion":"khong","enabled":true},
  {"locale":"vi","phrase":"ko","expansion":"khong","enabled":true},
  {"locale":"vi","phrase":"ntn","expansion":"nhu the nao","enabled":true},
  {"locale":"vi","phrase":"dc","expansion":"duoc","enabled":true},
  {"locale":"vi","phrase":"ae","expansion":"anh em","enabled":true},
  {"locale":"vi","phrase":"ad","expansion":"admin","enabled":true},
  {"locale":"vi","phrase":"z","expansion":"vay","enabled":true},
  {"locale":"vi","phrase":"j","expansion":"gi","enabled":true}
]
$json$, null, 'ai_assistant', false,
     'Tối đa 100 từ/cụm viết tắt; backend khớp nguyên cụm, ưu tiên cụm dài và chặn va chạm catalog.',
     now(), now()),
    (gen_random_uuid(), 'ai_assistant_answer_templates', '[]', null,
     'ai_assistant', false,
     'Tối đa 50 câu mẫu song ngữ; trigger dài nhất duy nhất và nội dung phải qua bộ lọc an toàn.',
     now(), now())
on conflict (setting_key) do update
set setting_group = excluded.setting_group,
    is_public = false,
    description = excluded.description,
    updated_at = now();
