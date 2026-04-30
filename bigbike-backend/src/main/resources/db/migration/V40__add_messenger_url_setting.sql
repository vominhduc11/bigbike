-- V40: Add messenger_url setting for the floating-chat popup (matches WP sudovn widget).

insert into site_settings (id, setting_key, setting_value, setting_group, is_public, description, created_at, updated_at)
select '00000000-0000-0000-0000-000000000539', 'messenger_url',
       'https://m.me/bigbikegear', 'contact', true,
       'Facebook Messenger deep link displayed in the floating chat popup.', now(), now()
where not exists (select 1 from site_settings where setting_key = 'messenger_url');
