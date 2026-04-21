-- Site settings (dev baseline)
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
insert into menus (id, location, name, status, created_at, updated_at) values
(
    '00000000-0000-0000-0000-000000000201',
    'primary',
    'Primary Navigation',
    'ACTIVE',
    '2026-04-21T00:00:00Z',
    '2026-04-21T00:00:00Z'
),
(
    '00000000-0000-0000-0000-000000000202',
    'footer',
    'Footer Navigation',
    'ACTIVE',
    '2026-04-21T00:00:00Z',
    '2026-04-21T00:00:00Z'
),
(
    '00000000-0000-0000-0000-000000000203',
    'guide',
    'Buying Guide Menu',
    'ACTIVE',
    '2026-04-21T00:00:00Z',
    '2026-04-21T00:00:00Z'
);

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
