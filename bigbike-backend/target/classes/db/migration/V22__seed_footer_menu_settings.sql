-- V22: Seed public footer/guide menu content and contact settings.
-- Corrects incomplete imported menu data where footer items had empty labels/URLs.

-- ============================================================
-- 1. PUBLIC SETTINGS USED BY FOOTER
-- ============================================================

insert into site_settings (id, setting_key, setting_value, setting_group, is_public, description, created_at, updated_at)
select '00000000-0000-0000-0000-000000000530', 'site_name',
       'BigBike', 'general', true, 'Public site name displayed in the header/footer.', now(), now()
where not exists (select 1 from site_settings where setting_key = 'site_name');

insert into site_settings (id, setting_key, setting_value, setting_group, is_public, description, created_at, updated_at)
select '00000000-0000-0000-0000-000000000531', 'contact_email',
       'info@bigbike.vn', 'contact', true, 'Public contact email displayed in the footer.', now(), now()
where not exists (select 1 from site_settings where setting_key = 'contact_email');

insert into site_settings (id, setting_key, setting_value, setting_group, is_public, description, created_at, updated_at)
select '00000000-0000-0000-0000-000000000532', 'contact_address',
       '79/30/52 Âu Cơ, Phường 14, Quận 11, TP.HCM', 'contact', true,
       'Public store address displayed in the footer.', now(), now()
where not exists (select 1 from site_settings where setting_key = 'contact_address');

update site_settings
set setting_value = 'BigBike',
    updated_at = now()
where setting_key = 'site_name'
  and trim(setting_value) = '';

update site_settings
set setting_value = 'info@bigbike.vn',
    updated_at = now()
where setting_key = 'contact_email'
  and trim(setting_value) = '';

update site_settings
set setting_value = '79/30/52 Âu Cơ, Phường 14, Quận 11, TP.HCM',
    updated_at = now()
where setting_key = 'contact_address'
  and trim(setting_value) = '';

-- ============================================================
-- 2. MENU LOCATIONS
-- ============================================================

insert into menus (id, location, name, status, created_at, updated_at)
select '00000000-0000-0000-0000-000000000540', 'footer', 'Footer Navigation', 'ACTIVE', now(), now()
where not exists (select 1 from menus where location = 'footer');

-- Some WordPress imports create "guide-menu"; canonical app location is "guide".
update menus
set location = 'guide',
    name = 'Guide Navigation',
    updated_at = now()
where location = 'guide-menu'
  and not exists (select 1 from menus where location = 'guide');

insert into menus (id, location, name, status, created_at, updated_at)
select '00000000-0000-0000-0000-000000000541', 'guide', 'Guide Navigation', 'ACTIVE', now(), now()
where not exists (select 1 from menus where location = 'guide');

-- Remove unusable blank imported items for footer/guide menus only.
delete from menu_items
where menu_id in (select id from menus where location in ('footer', 'guide', 'guide-menu'))
  and trim(coalesce(label, '')) = ''
  and trim(coalesce(url, '')) = '';

-- ============================================================
-- 3. FOOTER MENU ITEMS
-- ============================================================

insert into menu_items (id, menu_id, parent_id, label, url, target_type, target_id, sort_order, open_in_new_tab, css_class, status, legacy_id, created_at, updated_at)
select '00000000-0000-0000-0000-000000000550', m.id, null,
       'Giới thiệu', '/gioi-thieu.html', 'CUSTOM_URL', null, 0, false, 'footer-about', 'ACTIVE', null, now(), now()
from menus m
where m.location = 'footer'
  and not exists (
      select 1 from menu_items existing
      where existing.id = '00000000-0000-0000-0000-000000000550'
         or (existing.menu_id = m.id and existing.url = '/gioi-thieu.html')
  );

insert into menu_items (id, menu_id, parent_id, label, url, target_type, target_id, sort_order, open_in_new_tab, css_class, status, legacy_id, created_at, updated_at)
select '00000000-0000-0000-0000-000000000551', m.id, null,
       'Liên hệ', '/lien-he.html', 'CUSTOM_URL', null, 1, false, 'footer-about', 'ACTIVE', null, now(), now()
from menus m
where m.location = 'footer'
  and not exists (
      select 1 from menu_items existing
      where existing.id = '00000000-0000-0000-0000-000000000551'
         or (existing.menu_id = m.id and existing.url = '/lien-he.html')
  );

insert into menu_items (id, menu_id, parent_id, label, url, target_type, target_id, sort_order, open_in_new_tab, css_class, status, legacy_id, created_at, updated_at)
select '00000000-0000-0000-0000-000000000552', m.id, null,
       'Tin tức', '/tin-tuc/', 'CUSTOM_URL', null, 2, false, 'footer-about', 'ACTIVE', null, now(), now()
from menus m
where m.location = 'footer'
  and not exists (
      select 1 from menu_items existing
      where existing.id = '00000000-0000-0000-0000-000000000552'
         or (existing.menu_id = m.id and existing.url = '/tin-tuc/')
  );

insert into menu_items (id, menu_id, parent_id, label, url, target_type, target_id, sort_order, open_in_new_tab, css_class, status, legacy_id, created_at, updated_at)
select '00000000-0000-0000-0000-000000000553', m.id, null,
       'Chính sách bảo mật', '/chinh-sach/bao-mat/', 'CUSTOM_URL', null, 3, false, 'footer-policy', 'ACTIVE', null, now(), now()
from menus m
where m.location = 'footer'
  and not exists (
      select 1 from menu_items existing
      where existing.id = '00000000-0000-0000-0000-000000000553'
         or (existing.menu_id = m.id and existing.url = '/chinh-sach/bao-mat/')
  );

insert into menu_items (id, menu_id, parent_id, label, url, target_type, target_id, sort_order, open_in_new_tab, css_class, status, legacy_id, created_at, updated_at)
select '00000000-0000-0000-0000-000000000554', m.id, null,
       'Chính sách bảo hành', '/chinh-sach/bao-hanh/', 'CUSTOM_URL', null, 4, false, 'footer-policy', 'ACTIVE', null, now(), now()
from menus m
where m.location = 'footer'
  and not exists (
      select 1 from menu_items existing
      where existing.id = '00000000-0000-0000-0000-000000000554'
         or (existing.menu_id = m.id and existing.url = '/chinh-sach/bao-hanh/')
  );

insert into menu_items (id, menu_id, parent_id, label, url, target_type, target_id, sort_order, open_in_new_tab, css_class, status, legacy_id, created_at, updated_at)
select '00000000-0000-0000-0000-000000000555', m.id, null,
       'Chính sách đổi trả', '/chinh-sach/doi-tra/', 'CUSTOM_URL', null, 5, false, 'footer-policy', 'ACTIVE', null, now(), now()
from menus m
where m.location = 'footer'
  and not exists (
      select 1 from menu_items existing
      where existing.id = '00000000-0000-0000-0000-000000000555'
         or (existing.menu_id = m.id and existing.url = '/chinh-sach/doi-tra/')
  );

insert into menu_items (id, menu_id, parent_id, label, url, target_type, target_id, sort_order, open_in_new_tab, css_class, status, legacy_id, created_at, updated_at)
select '00000000-0000-0000-0000-000000000556', m.id, null,
       'Điều khoản sử dụng', '/chinh-sach/dieu-khoan/', 'CUSTOM_URL', null, 6, false, 'footer-policy', 'ACTIVE', null, now(), now()
from menus m
where m.location = 'footer'
  and not exists (
      select 1 from menu_items existing
      where existing.id = '00000000-0000-0000-0000-000000000556'
         or (existing.menu_id = m.id and existing.url = '/chinh-sach/dieu-khoan/')
  );

-- ============================================================
-- 4. GUIDE MENU ITEMS
-- ============================================================

insert into menu_items (id, menu_id, parent_id, label, url, target_type, target_id, sort_order, open_in_new_tab, css_class, status, legacy_id, created_at, updated_at)
select '00000000-0000-0000-0000-000000000560', m.id, null,
       'Hướng dẫn mua hàng', '/huong-dan/mua-hang/', 'CUSTOM_URL', null, 0, false, 'footer-guide', 'ACTIVE', null, now(), now()
from menus m
where m.location = 'guide'
  and not exists (
      select 1 from menu_items existing
      where existing.id = '00000000-0000-0000-0000-000000000560'
         or (existing.menu_id = m.id and existing.url = '/huong-dan/mua-hang/')
  );

insert into menu_items (id, menu_id, parent_id, label, url, target_type, target_id, sort_order, open_in_new_tab, css_class, status, legacy_id, created_at, updated_at)
select '00000000-0000-0000-0000-000000000561', m.id, null,
       'Cách đo size mũ', '/huong-dan/size-mu/', 'CUSTOM_URL', null, 1, false, 'footer-guide', 'ACTIVE', null, now(), now()
from menus m
where m.location = 'guide'
  and not exists (
      select 1 from menu_items existing
      where existing.id = '00000000-0000-0000-0000-000000000561'
         or (existing.menu_id = m.id and existing.url = '/huong-dan/size-mu/')
  );

insert into menu_items (id, menu_id, parent_id, label, url, target_type, target_id, sort_order, open_in_new_tab, css_class, status, legacy_id, created_at, updated_at)
select '00000000-0000-0000-0000-000000000562', m.id, null,
       'Cách đo size găng tay', '/huong-dan/size-gang-tay/', 'CUSTOM_URL', null, 2, false, 'footer-guide', 'ACTIVE', null, now(), now()
from menus m
where m.location = 'guide'
  and not exists (
      select 1 from menu_items existing
      where existing.id = '00000000-0000-0000-0000-000000000562'
         or (existing.menu_id = m.id and existing.url = '/huong-dan/size-gang-tay/')
  );
