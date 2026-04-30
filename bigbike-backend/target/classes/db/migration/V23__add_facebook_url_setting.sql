-- V23: Add facebook_url and backfill zalo_url for footer/floating-chat social links.

insert into site_settings (id, setting_key, setting_value, setting_group, is_public, description, created_at, updated_at)
select '00000000-0000-0000-0000-000000000533', 'facebook_url',
       'https://www.facebook.com/bigbikegear', 'contact', true,
       'Facebook page URL displayed in the footer.', now(), now()
where not exists (select 1 from site_settings where setting_key = 'facebook_url');

-- zalo_url was seeded empty in V18; patch it with the real URL.
update site_settings
set    setting_value = 'https://zalo.me/bigbikegear',
       updated_at    = now()
where  setting_key   = 'zalo_url'
  and  trim(setting_value) = '';
