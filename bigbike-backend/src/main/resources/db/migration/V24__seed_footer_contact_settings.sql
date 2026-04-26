-- V24: Seed footer brand tagline/description, hotline_2, and BCT badge URL.

-- Footer tagline (heading in brand column)
insert into site_settings (id, setting_key, setting_value, setting_group, is_public, description, created_at, updated_at)
select '00000000-0000-0000-0000-000000000534', 'footer_tagline',
       'BIGBIKE MONG ĐƯỢC LẮNG NGHE VÀ THẤU HIỂU BẠN HƠN', 'general', true,
       'Tagline displayed as the heading in the footer brand column.', now(), now()
where not exists (select 1 from site_settings where setting_key = 'footer_tagline');

-- Footer description (short paragraph below tagline)
insert into site_settings (id, setting_key, setting_value, setting_group, is_public, description, created_at, updated_at)
select '00000000-0000-0000-0000-000000000535', 'footer_description',
       'BigBike chuyên cung cấp gear moto chính hãng — mũ bảo hiểm, áo giáp, găng tay, intercom và phụ kiện touring. Được chọn lọc kỹ lưỡng theo tinh thần garage cao cấp: rõ ràng, đáng tin, tư vấn kỹ.', 'general', true,
       'Short description paragraph in the footer brand column.', now(), now()
where not exists (select 1 from site_settings where setting_key = 'footer_description');

-- Main hotline (seed if missing; only patch when empty)
insert into site_settings (id, setting_key, setting_value, setting_group, is_public, description, created_at, updated_at)
select '00000000-0000-0000-0000-000000000536', 'hotline',
       '0906.90.2404', 'contact', true,
       'Main hotline number displayed in the header and footer.', now(), now()
where not exists (select 1 from site_settings where setting_key = 'hotline');

update site_settings
set    setting_value = '0906.90.2404',
       updated_at    = now()
where  setting_key   = 'hotline'
  and  trim(setting_value) = '';

-- Second hotline
insert into site_settings (id, setting_key, setting_value, setting_group, is_public, description, created_at, updated_at)
select '00000000-0000-0000-0000-000000000537', 'hotline_2',
       '0764.640.679', 'contact', true,
       'Secondary hotline number displayed in the footer.', now(), now()
where not exists (select 1 from site_settings where setting_key = 'hotline_2');

-- BCT badge URL (Đã thông báo Bộ Công Thương — update with exact registration URL when known)
insert into site_settings (id, setting_key, setting_value, setting_group, is_public, description, created_at, updated_at)
select '00000000-0000-0000-0000-000000000538', 'bct_url',
       'https://online.gov.vn', 'general', true,
       'URL linking to the online.gov.vn registration page for the BCT trust badge.', now(), now()
where not exists (select 1 from site_settings where setting_key = 'bct_url');
