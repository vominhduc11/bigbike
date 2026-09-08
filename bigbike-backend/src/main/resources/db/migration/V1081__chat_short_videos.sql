-- CHAT_RULE_062–065: private short clips, independent daily allowance; no existing data changes.
create table chat_videos (
    id uuid primary key default gen_random_uuid(),
    request_id uuid not null unique,
    conversation_id uuid not null references chat_conversations(id) on delete restrict,
    customer_message_id uuid unique references chat_messages(id) on delete set null,
    storage_bucket varchar(255) not null,
    storage_object_key varchar(512) not null unique,
    mime_type varchar(40) not null check (mime_type = 'video/mp4'),
    size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 41943040),
    duration_seconds double precision not null check (duration_seconds > 0 and duration_seconds <= 15),
    has_audio boolean not null,
    sha256 varchar(64) not null,
    status varchar(32) not null check (status in (
        'PENDING', 'ATTACHED', 'PROCESSING', 'READY', 'UNRECOGNIZED',
        'REJECTED_UNSAFE', 'LIMIT_SKIPPED', 'TIMED_OUT', 'DELETING', 'DELETED')),
    intent_code varchar(32),
    safety_code varchar(32),
    received_at timestamptz not null,
    deadline_at timestamptz not null,
    expires_at timestamptz not null,
    deleted_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
create index ix_chat_videos_conversation_created on chat_videos(conversation_id, created_at);
create index ix_chat_videos_expiry on chat_videos(expires_at) where deleted_at is null;
create table chat_video_daily_usage (
    usage_date date primary key,
    used_count integer not null check (used_count >= 0),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
