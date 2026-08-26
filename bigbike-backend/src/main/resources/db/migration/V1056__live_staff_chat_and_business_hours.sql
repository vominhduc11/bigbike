-- Phase 3B: atomic staff takeover, ordered live messages, separate reply permission and hours.
-- Canonical evidence: CHAT_RULE_040 and CHAT_RULE_045..047 (2026-08-25).

alter table chat_messages
    drop constraint if exists ck_chat_message_role;
alter table chat_messages
    add column if not exists sequence_no bigint,
    add column if not exists staff_user_id uuid references admin_users(id) on delete set null,
    add column if not exists staff_display_name varchar(120),
    add constraint ck_chat_message_role check (role in ('CUSTOMER', 'ASSISTANT', 'STAFF', 'SYSTEM')),
    add constraint ck_chat_message_staff_shape check (
        (role = 'STAFF' and staff_display_name is not null)
        or (role <> 'STAFF' and staff_user_id is null and staff_display_name is null)
    );

with numbered as (
    select id, row_number() over (partition by conversation_id order by created_at, id) as seq
    from chat_messages
)
update chat_messages message
set sequence_no = numbered.seq
from numbered
where message.id = numbered.id and message.sequence_no is null;

alter table chat_messages alter column sequence_no set not null;
create unique index if not exists uk_chat_message_conversation_sequence
    on chat_messages(conversation_id, sequence_no);
create sequence if not exists chat_message_sequence;
select setval(
    'chat_message_sequence',
    greatest(1, (select coalesce(max(sequence_no), 0) + 1 from chat_messages)),
    false
);

alter table chat_handoff_requests
    drop constraint if exists ck_chat_handoff_status,
    drop constraint if exists ck_chat_handoff_ack_shape;

alter table chat_handoff_requests
    add column if not exists assigned_at timestamptz,
    add column if not exists assigned_admin_id uuid references admin_users(id) on delete set null,
    add column if not exists assigned_display_name varchar(120),
    add column if not exists resolved_at timestamptz,
    add column if not exists resolution varchar(20),
    add column if not exists within_business_hours boolean not null default false,
    add column if not exists next_open_at timestamptz;

update chat_handoff_requests
set status = 'CLOSED',
    assigned_at = acknowledged_at,
    assigned_admin_id = acknowledged_by,
    assigned_display_name = coalesce(
        (select admin.display_name from admin_users admin where admin.id = acknowledged_by),
        'Nhân viên BigBike'
    ),
    resolved_at = coalesce(acknowledged_at, requested_at),
    resolution = 'CLOSED'
where status = 'ACKNOWLEDGED';

drop index if exists uk_chat_handoff_waiting_conversation;
alter table chat_handoff_requests
    add constraint ck_chat_handoff_status check (
        status in ('WAITING', 'ACTIVE', 'RETURNED_TO_AI', 'CLOSED')
    ),
    add constraint ck_chat_handoff_live_shape check (
        (status = 'WAITING' and assigned_at is null and assigned_admin_id is null
            and resolved_at is null and resolution is null)
        or (status = 'ACTIVE' and assigned_at is not null and assigned_admin_id is not null
            and assigned_display_name is not null and resolved_at is null and resolution is null)
        or (status in ('RETURNED_TO_AI', 'CLOSED') and resolved_at is not null
            and resolution = status)
    );
create unique index if not exists uk_chat_handoff_live_conversation
    on chat_handoff_requests(conversation_id)
    where status in ('WAITING', 'ACTIVE');
create index if not exists idx_chat_handoff_live_requested
    on chat_handoff_requests(status, requested_at);

insert into role_permissions (role_id, permission)
select role_id, 'chat.reply'
from role_permissions
where permission = 'chat.handle'
on conflict do nothing;
delete from role_permissions where permission = 'chat.handle';

insert into site_settings (
    id, setting_key, setting_value, setting_value_en, setting_group,
    is_public, description, created_at, updated_at
) values (
    gen_random_uuid(), 'ai_assistant_business_hours',
    '{"timezone":"Asia/Ho_Chi_Minh","days":{"MON":{"enabled":true,"open":"09:00","close":"21:00"},"TUE":{"enabled":true,"open":"09:00","close":"21:00"},"WED":{"enabled":true,"open":"09:00","close":"21:00"},"THU":{"enabled":true,"open":"09:00","close":"21:00"},"FRI":{"enabled":true,"open":"09:00","close":"21:00"},"SAT":{"enabled":true,"open":"09:00","close":"18:00"},"SUN":{"enabled":true,"open":"09:00","close":"18:00"}}}',
    null, 'ai_assistant', false,
    'Lịch trực nhân viên theo tuần, múi giờ Asia/Ho_Chi_Minh.', now(), now()
) on conflict (setting_key) do update
set setting_group = excluded.setting_group,
    is_public = false,
    description = excluded.description,
    updated_at = now();
