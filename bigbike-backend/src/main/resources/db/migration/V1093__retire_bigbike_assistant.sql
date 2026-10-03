-- CHAT_RULE_070: retire the assistant without purging retained customer history.
-- Existing chat tables and private objects keep their original expiry dates.
delete from site_settings
where setting_group = 'ai_assistant' or setting_key like 'ai\_assistant\_%' escape '\';

delete from role_permissions
where permission in ('chat.read', 'chat.reply', 'chat.handle');
