-- BigBike Assistant phase 4: runtime model choice, auditable cost/evaluation data,
-- and private customer-image lifecycle. No customer payload is seeded here.

alter table chat_messages
    add column if not exists requested_model varchar(120),
    add column if not exists served_model varchar(120),
    add column if not exists fallback_used boolean not null default false,
    add column if not exists fallback_reason varchar(40);

alter table chat_messages
    drop constraint if exists ck_chat_messages_fallback_reason;
alter table chat_messages
    add constraint ck_chat_messages_fallback_reason check (
        fallback_reason is null or fallback_reason in (
            'TIMEOUT', 'RATE_LIMIT', 'PROVIDER_5XX', 'NETWORK',
            'EMPTY_RESPONSE', 'INVALID_RESPONSE'
        )
    );

create table if not exists chat_evaluation_runs (
    id uuid primary key default gen_random_uuid(),
    dataset_version varchar(80) not null,
    dataset_checksum char(64) not null,
    model_ids jsonb not null,
    max_cost_usd numeric(19,8) not null,
    actual_cost_usd numeric(19,8) not null default 0,
    status varchar(24) not null,
    failure_code varchar(48),
    created_by uuid references admin_users(id) on delete set null,
    started_at timestamptz not null default now(),
    completed_at timestamptz,
    created_at timestamptz not null default now(),
    constraint ck_chat_eval_run_cap check (max_cost_usd > 0 and max_cost_usd <= 2.00),
    constraint ck_chat_eval_run_actual_cost check (actual_cost_usd >= 0),
    constraint ck_chat_eval_run_status check (
        status in ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'COST_LIMIT_REACHED')
    )
);

create table if not exists chat_evaluation_model_results (
    id uuid primary key default gen_random_uuid(),
    run_id uuid not null references chat_evaluation_runs(id) on delete cascade,
    model_id varchar(120) not null,
    total_cases integer not null default 0,
    passed_cases integer not null default 0,
    numeric_case_count integer not null default 0,
    numeric_accuracy numeric(8,6) not null default 0,
    intent_accuracy numeric(8,6) not null default 0,
    non_fabrication_case_count integer not null default 0,
    non_fabrication_rate numeric(8,6) not null default 0,
    give_up_rate numeric(8,6) not null default 0,
    p50_latency_ms integer,
    p95_latency_ms integer,
    input_tokens bigint not null default 0,
    output_tokens bigint not null default 0,
    thinking_tokens bigint not null default 0,
    fallback_count integer not null default 0,
    estimated_cost_usd numeric(19,8) not null default 0,
    created_at timestamptz not null default now(),
    constraint uq_chat_eval_model_result unique (run_id, model_id),
    constraint ck_chat_eval_model_metrics check (
        numeric_case_count between 0 and total_cases
        and non_fabrication_case_count between 0 and total_cases
        and numeric_accuracy between 0 and 1
        and intent_accuracy between 0 and 1
        and non_fabrication_rate between 0 and 1
        and give_up_rate between 0 and 1
    )
);

create table if not exists chat_ai_usage_events (
    id uuid primary key default gen_random_uuid(),
    conversation_id uuid references chat_conversations(id) on delete set null,
    message_id uuid references chat_messages(id) on delete set null,
    evaluation_run_id uuid references chat_evaluation_runs(id) on delete set null,
    category varchar(24) not null,
    model_id varchar(120) not null,
    requested_model varchar(120) not null,
    provider_request_count integer not null default 0,
    input_tokens integer not null default 0,
    output_tokens integer not null default 0,
    thinking_tokens integer not null default 0,
    image_count integer not null default 0,
    estimated_cost_usd numeric(19,8) not null default 0,
    price_effective_from date not null,
    fallback boolean not null default false,
    success boolean not null default true,
    latency_ms integer not null default 0,
    created_at timestamptz not null default now(),
    constraint ck_chat_ai_usage_category check (
        category in ('CUSTOMER_TEXT', 'CUSTOMER_IMAGE', 'PRODUCT_IMAGE_INDEX', 'EVALUATION')
    ),
    constraint ck_chat_ai_usage_nonnegative check (
        provider_request_count >= 0 and input_tokens >= 0 and output_tokens >= 0
        and thinking_tokens >= 0 and image_count >= 0 and estimated_cost_usd >= 0
        and latency_ms >= 0
    )
);
create index if not exists ix_chat_ai_usage_created_category
    on chat_ai_usage_events(created_at, category);
create index if not exists ix_chat_ai_usage_conversation
    on chat_ai_usage_events(conversation_id) where conversation_id is not null;

create table if not exists chat_image_daily_usage (
    usage_date date primary key,
    used_count integer not null default 0,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint ck_chat_image_daily_usage_nonnegative check (used_count >= 0)
);

create table if not exists chat_images (
    id uuid primary key default gen_random_uuid(),
    request_id uuid not null unique,
    conversation_id uuid not null references chat_conversations(id) on delete restrict,
    customer_message_id uuid references chat_messages(id) on delete set null,
    storage_bucket varchar(255) not null,
    storage_object_key varchar(512) not null unique,
    mime_type varchar(40) not null,
    width integer not null,
    height integer not null,
    size_bytes bigint not null,
    sha256 char(64) not null,
    status varchar(32) not null,
    intent_code varchar(32),
    safety_code varchar(32),
    expires_at timestamptz not null,
    deleted_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint ck_chat_image_mime check (mime_type in ('image/jpeg', 'image/png', 'image/webp')),
    constraint ck_chat_image_dimensions check (width > 0 and height > 0),
    constraint ck_chat_image_size check (size_bytes > 0 and size_bytes <= 8388608),
    constraint ck_chat_image_status check (status in (
        'PENDING', 'ATTACHED', 'PROCESSING', 'READY', 'UNRECOGNIZED',
        'REJECTED_UNSAFE', 'LIMIT_SKIPPED', 'DELETING', 'DELETED'
    )),
    constraint uq_chat_image_customer_message unique (customer_message_id)
);
create index if not exists ix_chat_images_conversation_created
    on chat_images(conversation_id, created_at);
create index if not exists ix_chat_images_expires_at
    on chat_images(expires_at) where status <> 'DELETED';

create table if not exists chat_product_image_fingerprints (
    id uuid primary key default gen_random_uuid(),
    product_id varchar(64) not null references products(id) on delete cascade,
    media_id uuid references media(id) on delete cascade,
    image_ref varchar(512) not null,
    source_version_hash char(64) not null,
    fingerprint_version varchar(40) not null,
    dhash_hex char(16) not null,
    color_histogram text not null,
    aspect_ratio numeric(12,6) not null,
    indexed_at timestamptz not null default now(),
    constraint ck_chat_product_fingerprint_aspect check (aspect_ratio > 0),
    constraint ck_chat_product_fingerprint_dhash check (dhash_hex ~ '^[0-9a-f]{16}$'),
    constraint uq_chat_product_fingerprint unique (product_id, fingerprint_version)
);
create index if not exists ix_chat_product_fingerprint_media
    on chat_product_image_fingerprints(media_id);

insert into site_settings (
    id, setting_key, setting_value, setting_value_en, setting_group, is_public,
    description, created_at, updated_at
) values
    (gen_random_uuid(), 'ai_assistant_model', 'gemini-2.5-flash', null,
     'ai_assistant', false,
     'Model Gemini tạo câu trả lời cho Trợ lý BigBike; được validate bằng account live.', now(), now()),
    (gen_random_uuid(), 'ai_assistant_image_enabled', 'false', null,
     'ai_assistant', false,
     'Bật đọc ảnh khách gửi; mặc định tắt.', now(), now()),
    (gen_random_uuid(), 'ai_assistant_image_daily_limit', '20', null,
     'ai_assistant', false,
     'Trần số ảnh được xử lý mỗi ngày theo giờ Việt Nam.', now(), now()),
    (gen_random_uuid(), 'ai_assistant_image_conversation_limit', '3', null,
     'ai_assistant', false,
     'Trần số ảnh trong một hội thoại.', now(), now())
on conflict (setting_key) do nothing;
