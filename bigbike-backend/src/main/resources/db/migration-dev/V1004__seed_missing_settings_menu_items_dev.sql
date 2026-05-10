-- Fix contact email to match WP (bigbikevnshop@gmail.com)
update site_settings
set setting_value = 'bigbikevnshop@gmail.com', updated_at = now()
where setting_key in ('contact_email', 'site.contact_email');

-- Add YouTube URL
insert into site_settings (id, setting_key, setting_value, setting_group, is_public, description, created_at, updated_at)
select '00000000-0000-0000-0000-000000000113', 'youtube_url',
       'https://www.youtube.com/@bigbikegear', 'contact', true,
       'YouTube channel URL displayed in the footer.', now(), now()
where not exists (select 1 from site_settings where setting_key = 'youtube_url');

-- Add TikTok URL
insert into site_settings (id, setting_key, setting_value, setting_group, is_public, description, created_at, updated_at)
select '00000000-0000-0000-0000-000000000114', 'tiktok_url',
       'https://www.tiktok.com/@bigbikegear', 'contact', true,
       'TikTok profile URL displayed in the footer.', now(), now()
where not exists (select 1 from site_settings where setting_key = 'tiktok_url');

-- Add Instagram URL
insert into site_settings (id, setting_key, setting_value, setting_group, is_public, description, created_at, updated_at)
select '00000000-0000-0000-0000-000000000115', 'instagram_url',
       'https://www.instagram.com/bigbikegear', 'contact', true,
       'Instagram profile URL displayed in the footer.', now(), now()
where not exists (select 1 from site_settings where setting_key = 'instagram_url');

-- Seed primary navigation menu items (from WP primary nav)
-- Uses a subquery for menu_id to handle whichever ID was assigned to the primary menu
-- (V84 uses ...000840, V1001-dev uses ...000201; the EXISTS guard prevents duplicates)
insert into menu_items (id, menu_id, parent_id, label, url, target_type, target_id, sort_order, open_in_new_tab, css_class, status, legacy_id, created_at, updated_at)
select t.id, m.id, t.parent_id, t.label, t.url, t.target_type, t.target_id, t.sort_order, t.open_in_new_tab, t.css_class, t.status, t.legacy_id, now(), now()
from (values
  ('00000000-0000-0000-0001-000000000001'::uuid, null::uuid, 'Mũ Bảo Hiểm',   '/danh-muc-san-pham/non-bao-hiem-moto/', 'CUSTOM_URL'::varchar, null::uuid, 1, false, null::varchar, 'ACTIVE'::varchar, null::bigint),
  ('00000000-0000-0000-0001-000000000002'::uuid, null::uuid, 'Áo Giáp',        '/danh-muc-san-pham/quan-ao-bao-ho-moto/', 'CUSTOM_URL'::varchar, null::uuid, 2, false, null::varchar, 'ACTIVE'::varchar, null::bigint),
  ('00000000-0000-0000-0001-000000000003'::uuid, null::uuid, 'Găng Tay',       '/danh-muc-san-pham/gang-tay/', 'CUSTOM_URL'::varchar, null::uuid, 3, false, null::varchar, 'ACTIVE'::varchar, null::bigint),
  ('00000000-0000-0000-0001-000000000004'::uuid, null::uuid, 'Giày Bảo Hộ',   '/danh-muc-san-pham/giay-bao-ho/', 'CUSTOM_URL'::varchar, null::uuid, 4, false, null::varchar, 'ACTIVE'::varchar, null::bigint),
  ('00000000-0000-0000-0001-000000000005'::uuid, null::uuid, 'Phụ Kiện',      '/danh-muc-san-pham/phu-kien-di-mua/', 'CUSTOM_URL'::varchar, null::uuid, 5, false, null::varchar, 'ACTIVE'::varchar, null::bigint),
  ('00000000-0000-0000-0001-000000000006'::uuid, null::uuid, 'Tin Tức',        '/tin-tuc/', 'CUSTOM_URL'::varchar, null::uuid, 6, false, null::varchar, 'ACTIVE'::varchar, null::bigint),
  ('00000000-0000-0000-0001-000000000007'::uuid, null::uuid, 'Liên Hệ',        '/lien-he/', 'CUSTOM_URL'::varchar, null::uuid, 7, false, null::varchar, 'ACTIVE'::varchar, null::bigint)
) as t(id, parent_id, label, url, target_type, target_id, sort_order, open_in_new_tab, css_class, status, legacy_id)
cross join (select id from menus where location = 'primary' limit 1) as m
where not exists (select 1 from menu_items mi
                  join menus mn on mi.menu_id = mn.id
                  where mn.location = 'primary');
