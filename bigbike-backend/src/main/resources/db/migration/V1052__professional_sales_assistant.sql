-- V1052: phase 2 — professional sales guidance, durable staff handoff and 7-day attribution.
-- Canonical evidence: BUSINESS_RULES.md CHAT_RULE_037..044 (owner decision 2026-08-24).

alter table chat_conversations
    add column if not exists sales_stage varchar(24) not null default 'BROWSING',
    add column if not exists last_next_step_type varchar(48),
    add column if not exists declined_next_step_type varchar(48),
    add constraint ck_chat_conversation_sales_stage check (
        sales_stage in ('BROWSING', 'CHOOSING', 'DECIDING', 'POST_PURCHASE')
    );

alter table chat_messages
    add column if not exists sales_stage varchar(24),
    add column if not exists outcome_code varchar(48),
    add column if not exists lead_offer_reason varchar(32),
    add column if not exists next_step_type varchar(48),
    add column if not exists cross_sell_products_json jsonb,
    add constraint ck_chat_message_sales_stage check (
        sales_stage is null or sales_stage in ('BROWSING', 'CHOOSING', 'DECIDING', 'POST_PURCHASE')
    );

alter table chat_leads
    add column if not exists purpose varchar(32);

alter table chat_interactions
    add column if not exists product_slug varchar(255),
    add column if not exists source_interaction_id uuid
        references chat_interactions(id) on delete set null,
    add column if not exists cart_item_id uuid
        references cart_items(id) on delete set null,
    drop constraint if exists ck_chat_interaction_type,
    drop constraint if exists ck_chat_interaction_shape;

alter table chat_interactions
    add constraint ck_chat_interaction_type check (
        interaction_type in ('LEAD_PROMPT_VIEWED', 'ACTION_CLICKED', 'PRODUCT_VIEWED', 'CART_ADDED')
    ),
    add constraint ck_chat_interaction_shape check (
        (interaction_type = 'LEAD_PROMPT_VIEWED'
            and lead_prompt_sequence is not null and action_type is null and product_slug is null)
        or
        (interaction_type = 'ACTION_CLICKED'
            and lead_prompt_sequence is null and action_type is not null and product_slug is null)
        or
        (interaction_type in ('PRODUCT_VIEWED', 'CART_ADDED')
            and lead_prompt_sequence is null and action_type is null and product_slug is not null)
    );

create index if not exists idx_chat_interactions_funnel_created
    on chat_interactions(interaction_type, created_at);
create index if not exists idx_chat_interactions_product_created
    on chat_interactions(product_slug, created_at)
    where product_slug is not null;
create unique index if not exists uk_chat_cart_add_source_line
    on chat_interactions(cart_item_id, source_interaction_id)
    where interaction_type = 'CART_ADDED'
      and cart_item_id is not null
      and source_interaction_id is not null;

alter table cart_items
    add column if not exists assistant_attributed_at timestamptz;

alter table chat_order_attributions
    add column if not exists product_slug varchar(255),
    add column if not exists touch_at timestamptz,
    add column if not exists attribution_window_hours integer not null default 168,
    add constraint ck_chat_order_attribution_window check (attribution_window_hours = 168);

create table if not exists chat_handoff_requests (
    id                 uuid primary key default gen_random_uuid(),
    request_id         uuid not null unique,
    conversation_id    uuid not null references chat_conversations(id) on delete cascade,
    status             varchar(24) not null default 'WAITING',
    trigger_source     varchar(24) not null,
    customer_kind      varchar(24) not null,
    question_summary   text,
    products_json      jsonb,
    contact_present    boolean not null default false,
    requested_at       timestamptz not null default now(),
    acknowledged_at    timestamptz,
    acknowledged_by    uuid references admin_users(id) on delete set null,
    constraint ck_chat_handoff_status check (status in ('WAITING', 'ACKNOWLEDGED')),
    constraint ck_chat_handoff_trigger check (trigger_source in ('BUTTON', 'MESSAGE')),
    constraint ck_chat_handoff_customer_kind check (
        customer_kind in ('SIGNED_IN', 'GUEST')
    ),
    constraint ck_chat_handoff_ack_shape check (
        (status = 'WAITING' and acknowledged_at is null and acknowledged_by is null)
        or
        (status = 'ACKNOWLEDGED' and acknowledged_at is not null and acknowledged_by is not null)
    )
);

create unique index if not exists uk_chat_handoff_waiting_conversation
    on chat_handoff_requests(conversation_id)
    where status = 'WAITING';
create index if not exists idx_chat_handoff_waiting_requested
    on chat_handoff_requests(requested_at)
    where status = 'WAITING';

insert into site_settings (
    id, setting_key, setting_value, setting_value_en, setting_group,
    is_public, description, created_at, updated_at
)
values
    (gen_random_uuid(), 'ai_assistant_handoff_email_enabled', 'true', null,
     'ai_assistant', false,
     'Gửi email ngay khi khách xin gặp nhân viên. Tắt để chỉ dùng cảnh báo trong màn quản trị.',
     now(), now()),
    (gen_random_uuid(), 'ai_assistant_handoff_email_recipient', '', null,
     'ai_assistant', false,
     'Email nhận yêu cầu gặp nhân viên; để trống dùng BIGBIKE_MAIL_ADMIN.',
     now(), now())
on conflict (setting_key) do update
set setting_group = excluded.setting_group,
    is_public = false,
    description = excluded.description,
    updated_at = now();
