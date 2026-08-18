-- Owner decision 2026-08-18; BUSINESS_RULES.md CHAT_RULE_005..029.
-- Adds idempotency, guarded rich answers, telemetry and line-level assisted revenue.

alter table chat_messages
    drop constraint if exists ck_chat_message_source;

alter table chat_messages
    add constraint ck_chat_message_source check (source in (
        'AI', 'TEMPLATE', 'TOOL', 'CONTACT_FALLBACK',
        'OUT_OF_SCOPE', 'CONTENT_REFUSAL', 'ROLE_DEFENSE'
    ));

alter table chat_messages
    add column request_id uuid,
    add column answer_format varchar(24) not null default 'PLAIN_TEXT',
    add column result_kind varchar(24) not null default 'ANSWER',
    add column action_metadata jsonb,
    add column input_tokens integer,
    add column output_tokens integer,
    add column thinking_tokens integer,
    add column provider_request_count integer,
    add column latency_ms integer,
    add column estimated_cost_usd numeric(19, 8),
    add constraint ck_chat_message_answer_format
        check (answer_format in ('PLAIN_TEXT', 'MARKDOWN')),
    add constraint ck_chat_message_result_kind
        check (result_kind in ('ANSWER', 'PRODUCT_RESULTS', 'CLARIFICATION', 'REFUSAL', 'CONTACT')),
    add constraint ck_chat_message_input_tokens check (input_tokens is null or input_tokens >= 0),
    add constraint ck_chat_message_output_tokens check (output_tokens is null or output_tokens >= 0),
    add constraint ck_chat_message_thinking_tokens check (thinking_tokens is null or thinking_tokens >= 0),
    add constraint ck_chat_message_provider_requests
        check (provider_request_count is null or provider_request_count between 0 and 4),
    add constraint ck_chat_message_latency check (latency_ms is null or latency_ms >= 0),
    add constraint ck_chat_message_cost check (estimated_cost_usd is null or estimated_cost_usd >= 0);

create unique index uk_chat_messages_request_role
    on chat_messages(request_id, role)
    where request_id is not null;

create index idx_chat_messages_request_id
    on chat_messages(request_id)
    where request_id is not null;

alter table cart_items
    add column assistant_conversation_id uuid
        references chat_conversations(id) on delete set null;

create index idx_cart_items_assistant_conversation
    on cart_items(assistant_conversation_id)
    where assistant_conversation_id is not null;

create table chat_order_attributions (
    id                    uuid primary key default gen_random_uuid(),
    order_id              uuid not null references orders(id) on delete cascade,
    order_line_item_id    uuid not null references order_line_items(id) on delete cascade,
    conversation_id       uuid references chat_conversations(id) on delete set null,
    attributed_amount     numeric(19, 2) not null,
    currency              varchar(10) not null,
    created_at            timestamptz not null default now(),
    constraint uk_chat_order_attribution_line unique (order_line_item_id),
    constraint ck_chat_order_attribution_amount check (attributed_amount >= 0)
);

create index idx_chat_order_attributions_order
    on chat_order_attributions(order_id);
create index idx_chat_order_attributions_conversation
    on chat_order_attributions(conversation_id)
    where conversation_id is not null;
create index idx_chat_order_attributions_created
    on chat_order_attributions(created_at);

-- Compare-and-set updates preserve owner customisation.
update site_settings
set setting_value = '120',
    description = 'Số lượt trả lời có gọi AI tối đa mỗi ngày theo giờ Việt Nam. Đặt 0 để tắt phần AI; không có trần tiền tháng.',
    updated_at = now()
where setting_key = 'ai_assistant_daily_limit'
  and setting_value = '60';

update site_settings
set setting_value = '12',
    description = 'Số cặp hỏi–đáp gần nhất gửi cho Trợ lý BigBike sau khi che thông tin riêng tư; 0 để tắt, tối đa 12.',
    updated_at = now()
where setting_key = 'ai_assistant_recent_turn_pairs'
  and setting_value = '3';

update site_settings
set setting_value = E'Mũ bảo hiểm nào dưới 2 triệu phù hợp đi phố?\nMũ bảo hiểm nào từ 2 đến 5 triệu đáng cân nhắc?\nHướng dẫn tôi chọn size phù hợp.\nChính sách đổi trả của BigBike như thế nào?',
    setting_value_en = E'Which helmets under VND 2 million suit city riding?\nWhich helmets from VND 2 to 5 million should I consider?\nHelp me choose the right size.\nWhat is BigBike''s return policy?',
    updated_at = now()
where setting_key = 'ai_assistant_quick_prompts'
  and setting_value = E'Tìm mũ bảo hiểm theo ngân sách\nTư vấn chọn size\nChính sách đổi trả\nKiểm tra đơn hàng của tôi'
  and setting_value_en = E'Find a helmet within my budget\nHelp me choose a size\nReturn policy\nCheck my orders';
