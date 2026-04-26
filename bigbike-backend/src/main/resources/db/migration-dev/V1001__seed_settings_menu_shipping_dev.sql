-- Site settings (dev baseline)
insert into site_settings (id, setting_key, setting_value, setting_group, is_public, description, created_at, updated_at)
select '00000000-0000-0000-0000-000000000105', 'facebook_url',
       'https://www.facebook.com/bigbikegear', 'contact', true,
       'Facebook page URL displayed in the footer.', '2026-04-21T00:00:00Z', '2026-04-21T00:00:00Z'
where not exists (select 1 from site_settings where setting_key = 'facebook_url');

insert into site_settings (id, setting_key, setting_value, setting_group, is_public, description, created_at, updated_at)
select '00000000-0000-0000-0000-000000000106', 'zalo_url',
       'https://zalo.me/bigbikegear', 'contact', true,
       'Zalo contact URL displayed in the footer.', '2026-04-21T00:00:00Z', '2026-04-21T00:00:00Z'
where not exists (select 1 from site_settings where setting_key = 'zalo_url');

insert into site_settings (id, setting_key, setting_value, setting_group, is_public, description, created_at, updated_at)
select '00000000-0000-0000-0000-000000000107', 'footer_tagline',
       'BIGBIKE MONG ĐƯỢC LẮNG NGHE VÀ THẤU HIỂU BẠN HƠN', 'general', true,
       'Tagline displayed as the heading in the footer brand column.', '2026-04-21T00:00:00Z', '2026-04-21T00:00:00Z'
where not exists (select 1 from site_settings where setting_key = 'footer_tagline');

insert into site_settings (id, setting_key, setting_value, setting_group, is_public, description, created_at, updated_at)
select '00000000-0000-0000-0000-000000000108', 'footer_description',
       'BigBike chuyên cung cấp gear moto chính hãng — mũ bảo hiểm, áo giáp, găng tay, intercom và phụ kiện touring. Được chọn lọc kỹ lưỡng theo tinh thần garage cao cấp: rõ ràng, đáng tin, tư vấn kỹ.', 'general', true,
       'Short description paragraph in the footer brand column.', '2026-04-21T00:00:00Z', '2026-04-21T00:00:00Z'
where not exists (select 1 from site_settings where setting_key = 'footer_description');

insert into site_settings (id, setting_key, setting_value, setting_group, is_public, description, created_at, updated_at)
select '00000000-0000-0000-0000-000000000109', 'hotline',
       '0906.90.2404', 'contact', true,
       'Main hotline number displayed in the header and footer.', '2026-04-21T00:00:00Z', '2026-04-21T00:00:00Z'
where not exists (select 1 from site_settings where setting_key = 'hotline');

insert into site_settings (id, setting_key, setting_value, setting_group, is_public, description, created_at, updated_at)
select '00000000-0000-0000-0000-000000000110', 'hotline_2',
       '0764.640.679', 'contact', true,
       'Secondary hotline number displayed in the footer.', '2026-04-21T00:00:00Z', '2026-04-21T00:00:00Z'
where not exists (select 1 from site_settings where setting_key = 'hotline_2');

insert into site_settings (id, setting_key, setting_value, setting_group, is_public, description, created_at, updated_at)
select '00000000-0000-0000-0000-000000000111', 'bct_url',
       'https://online.gov.vn', 'general', true,
       'URL linking to the online.gov.vn registration page for the BCT trust badge.', '2026-04-21T00:00:00Z', '2026-04-21T00:00:00Z'
where not exists (select 1 from site_settings where setting_key = 'bct_url');

insert into site_settings (id, setting_key, setting_value, setting_group, is_public, description, created_at, updated_at) values
(
    '00000000-0000-0000-0000-000000000101',
    'site.name',
    '"BigBike"',
    'general',
    true,
    'Site name displayed in title and meta',
    '2026-04-21T00:00:00Z',
    '2026-04-21T00:00:00Z'
),
(
    '00000000-0000-0000-0000-000000000102',
    'site.url',
    '"http://localhost:3000"',
    'general',
    true,
    'Public base URL of the site',
    '2026-04-21T00:00:00Z',
    '2026-04-21T00:00:00Z'
),
(
    '00000000-0000-0000-0000-000000000103',
    'site.currency',
    '"VND"',
    'commerce',
    true,
    'Default currency code',
    '2026-04-21T00:00:00Z',
    '2026-04-21T00:00:00Z'
),
(
    '00000000-0000-0000-0000-000000000104',
    'site.contact_email',
    '"info@bigbike.vn"',
    'general',
    true,
    'Public contact email',
    '2026-04-21T00:00:00Z',
    '2026-04-21T00:00:00Z'
);

-- Menus (dev baseline)
insert into menus (id, location, name, status, created_at, updated_at)
select '00000000-0000-0000-0000-000000000201',
       'primary',
       'Primary Navigation',
       'ACTIVE',
       '2026-04-21T00:00:00Z',
       '2026-04-21T00:00:00Z'
where not exists (select 1 from menus where location = 'primary');

insert into menus (id, location, name, status, created_at, updated_at)
select '00000000-0000-0000-0000-000000000202',
       'footer',
       'Footer Navigation',
       'ACTIVE',
       '2026-04-21T00:00:00Z',
       '2026-04-21T00:00:00Z'
where not exists (select 1 from menus where location = 'footer');

insert into menus (id, location, name, status, created_at, updated_at)
select '00000000-0000-0000-0000-000000000203',
       'guide',
       'Buying Guide Menu',
       'ACTIVE',
       '2026-04-21T00:00:00Z',
       '2026-04-21T00:00:00Z'
where not exists (select 1 from menus where location = 'guide');

-- Shipping zone: Vietnam
insert into shipping_zones (id, legacy_id, name, region_code, sort_order, enabled, created_at, updated_at) values
(
    '00000000-0000-0000-0000-000000000301',
    1,
    'Vietnam',
    'VN',
    0,
    true,
    '2026-04-21T00:00:00Z',
    '2026-04-21T00:00:00Z'
);

-- Shipping method: COD
insert into shipping_methods (id, zone_id, legacy_id, method_code, title, description, cost, min_order_amount, enabled, sort_order, created_at, updated_at) values
(
    '00000000-0000-0000-0000-000000000401',
    '00000000-0000-0000-0000-000000000301',
    1,
    'cod',
    'Thanh toán khi nhận hàng (COD)',
    'Thanh toán tiền mặt khi nhận hàng.',
    0,
    0,
    true,
    0,
    '2026-04-21T00:00:00Z',
    '2026-04-21T00:00:00Z'
),
(
    '00000000-0000-0000-0000-000000000402',
    '00000000-0000-0000-0000-000000000301',
    2,
    'flat_rate',
    'Phí vận chuyển cố định',
    'Phí vận chuyển 30,000 VND cho mọi đơn hàng.',
    30000,
    0,
    false,
    1,
    '2026-04-21T00:00:00Z',
    '2026-04-21T00:00:00Z'
);
