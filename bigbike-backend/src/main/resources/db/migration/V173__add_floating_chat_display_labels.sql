-- V173: Add display-text settings for the floating-chat popup (WP sudovn parity).
-- The popup previously derived its Zalo/Messenger labels from the URL slug
-- (both showed "bigbikegear"). WP showed the Zalo phone number and a friendly
-- Messenger name instead. These keys hold that display text; the storefront falls
-- back to the URL slug when a key is empty.

-- Zalo display text: phone number shown in WP (0764640679).
insert into site_settings (id, setting_key, setting_value, setting_group, is_public, description, created_at, updated_at)
select '00000000-0000-0000-0000-000000000570', 'zalo_display',
       '0764640679', 'contact', true,
       'Display text for the Zalo line in the floating chat popup.', now(), now()
where not exists (select 1 from site_settings where setting_key = 'zalo_display');

-- Messenger display text: friendly name shown in WP (Bigbike.vn).
insert into site_settings (id, setting_key, setting_value, setting_group, is_public, description, created_at, updated_at)
select '00000000-0000-0000-0000-000000000571', 'messenger_display',
       'Bigbike.vn', 'contact', true,
       'Display text for the Messenger line in the floating chat popup.', now(), now()
where not exists (select 1 from site_settings where setting_key = 'messenger_display');
