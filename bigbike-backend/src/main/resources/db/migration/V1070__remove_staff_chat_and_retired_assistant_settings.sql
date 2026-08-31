-- Owner decision 2026-08-30: BigBike Assistant is AI-only for customer chat.
-- The live transcript and handoff queue were cleared on 2026-08-29 before this migration.
-- Keep these assertions ahead of destructive DDL so an unexpected live record blocks deploy
-- instead of silently deleting a customer conversation or staff assignment.

do $$
begin
    if to_regclass('public.chat_handoff_requests') is not null
            and exists (select 1 from chat_handoff_requests) then
        raise exception 'V1070 blocked: chat_handoff_requests is not empty';
    end if;

    if to_regclass('public.chat_messages') is not null
            and exists (
                select 1
                from chat_messages
                where role = 'STAFF'
                   or staff_user_id is not null
                   or staff_display_name is not null
            ) then
        raise exception 'V1070 blocked: staff chat messages or assignments still exist';
    end if;

    if to_regclass('public.chat_conversations') is not null
            and exists (select 1 from chat_conversations where ended_reason = 'HANDOFF') then
        raise exception 'V1070 blocked: HANDOFF conversation state still exists';
    end if;
end
$$;

-- Chat-related bell rows and the obsolete write permission must not survive the removal.
delete from admin_notifications where type like 'CHAT_%';
delete from role_permissions where permission in ('chat.reply', 'chat.handle');

drop table if exists chat_handoff_requests;

alter table if exists chat_messages
    drop constraint if exists ck_chat_message_staff_shape,
    drop constraint if exists ck_chat_message_role,
    drop column if exists staff_user_id,
    drop column if exists staff_display_name;

alter table if exists chat_messages
    add constraint ck_chat_message_role check (role in ('CUSTOMER', 'ASSISTANT', 'SYSTEM'));

alter table if exists chat_conversations
    drop constraint if exists ck_chat_conversation_ended_reason;

alter table if exists chat_conversations
    add constraint ck_chat_conversation_ended_reason check (
        ended_reason is null or ended_reason in (
            'TURN_LIMIT', 'CONTINUED', 'OFF_TOPIC', 'AI_UNAVAILABLE',
            'DAILY_LIMIT_REACHED', 'DISABLED', 'CLOSED'
        )
    );

-- Retired UI switches and their persisted values. Image quotas remain software policy:
-- one image per message, three per conversation, twenty per shop/day, maximum 8 MB.
delete from site_settings
where setting_key in (
    'ai_assistant_image_enabled',
    'ai_assistant_greeting',
    'ai_assistant_quick_prompts',
    'ai_assistant_conversation_turn_limit',
    'ai_assistant_business_hours',
    'ai_assistant_handoff_email_enabled',
    'ai_assistant_handoff_email_recipient',
    'ai_assistant_image_daily_limit',
    'ai_assistant_image_conversation_limit'
);
