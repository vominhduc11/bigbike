-- CHAT_RULE_057, 066–069: additive only; retain existing transcript and daily usage.
alter table chat_images
    add column attachment_position smallint not null default 0,
    add column quota_reserved_on date,
    add column analysis_json jsonb,
    add column analysis_deadline_at timestamptz;
alter table chat_images drop constraint if exists uq_chat_image_customer_message;
create unique index uq_chat_image_message_position on chat_images(customer_message_id, attachment_position)
    where customer_message_id is not null;
alter table chat_images add constraint ck_chat_image_position check (attachment_position between 0 and 2);
alter table chat_images drop constraint if exists ck_chat_image_status;
alter table chat_images add constraint ck_chat_image_status check (status in (
    'PENDING', 'ATTACHED', 'PROCESSING', 'READY', 'UNRECOGNIZED',
    'ANALYSIS_FAILED', 'REJECTED_UNSAFE', 'LIMIT_SKIPPED', 'DELETING', 'DELETED'));
alter table admin_notifications add column chat_message_id uuid
    references chat_messages(id) on delete cascade;
create unique index uq_admin_notification_chat_message on admin_notifications(chat_message_id)
    where chat_message_id is not null;
insert into site_settings(id, setting_key, setting_value, setting_group, is_public, description, created_at, updated_at)
values (gen_random_uuid(), 'ai_assistant_image_daily_limit', '60', 'ai_assistant', false,
    'Số ảnh đọc tối đa mỗi ngày theo giờ Việt Nam. Đặt 0 để tạm dừng đọc ảnh.', now(), now())
on conflict (setting_key) do update set setting_value = '60', is_public = false, updated_at = now();
