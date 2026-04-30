-- V29: Seed TAX/VAT configuration settings and STORE operational settings.

-- ── TAX settings ─────────────────────────────────────────────────────────────

insert into site_settings (id, setting_key, setting_value, setting_group, is_public, description, created_at, updated_at)
select '00000000-0000-0000-0000-000000000600', 'tax_enabled',
       'false', 'TAX', false,
       'Enable automatic tax calculation on orders. Set to true to activate.',
       now(), now()
where not exists (select 1 from site_settings where setting_key = 'tax_enabled');

insert into site_settings (id, setting_key, setting_value, setting_group, is_public, description, created_at, updated_at)
select '00000000-0000-0000-0000-000000000601', 'tax_rate',
       '0.10', 'TAX', false,
       'Default VAT rate as a decimal (e.g. 0.10 = 10%). Applied when tax_enabled = true.',
       now(), now()
where not exists (select 1 from site_settings where setting_key = 'tax_rate');

insert into site_settings (id, setting_key, setting_value, setting_group, is_public, description, created_at, updated_at)
select '00000000-0000-0000-0000-000000000602', 'tax_inclusive',
       'false', 'TAX', false,
       'Whether product prices already include tax. true = tax-inclusive pricing.',
       now(), now()
where not exists (select 1 from site_settings where setting_key = 'tax_inclusive');

insert into site_settings (id, setting_key, setting_value, setting_group, is_public, description, created_at, updated_at)
select '00000000-0000-0000-0000-000000000603', 'tax_label',
       'VAT', 'TAX', true,
       'Display label shown on invoices and order summaries (e.g. VAT, GST).',
       now(), now()
where not exists (select 1 from site_settings where setting_key = 'tax_label');

insert into site_settings (id, setting_key, setting_value, setting_group, is_public, description, created_at, updated_at)
select '00000000-0000-0000-0000-000000000604', 'tax_registration_number',
       '', 'TAX', false,
       'Business tax registration / MST number shown on invoices.',
       now(), now()
where not exists (select 1 from site_settings where setting_key = 'tax_registration_number');

-- ── STORE operational settings ────────────────────────────────────────────────

insert into site_settings (id, setting_key, setting_value, setting_group, is_public, description, created_at, updated_at)
select '00000000-0000-0000-0000-000000000610', 'store_currency',
       'VND', 'STORE', true,
       'Default currency code used for all orders and displays.',
       now(), now()
where not exists (select 1 from site_settings where setting_key = 'store_currency');

insert into site_settings (id, setting_key, setting_value, setting_group, is_public, description, created_at, updated_at)
select '00000000-0000-0000-0000-000000000611', 'store_timezone',
       'Asia/Ho_Chi_Minh', 'STORE', false,
       'Timezone used for order timestamps and scheduled jobs.',
       now(), now()
where not exists (select 1 from site_settings where setting_key = 'store_timezone');

insert into site_settings (id, setting_key, setting_value, setting_group, is_public, description, created_at, updated_at)
select '00000000-0000-0000-0000-000000000612', 'order_min_amount',
       '0', 'STORE', false,
       'Minimum order total required to check out (in base currency units).',
       now(), now()
where not exists (select 1 from site_settings where setting_key = 'order_min_amount');

insert into site_settings (id, setting_key, setting_value, setting_group, is_public, description, created_at, updated_at)
select '00000000-0000-0000-0000-000000000613', 'low_stock_threshold',
       '5', 'STORE', false,
       'Quantity at which a variant is flagged as low-stock in the admin dashboard.',
       now(), now()
where not exists (select 1 from site_settings where setting_key = 'low_stock_threshold');

-- ── SECURITY settings ─────────────────────────────────────────────────────────

insert into site_settings (id, setting_key, setting_value, setting_group, is_public, description, created_at, updated_at)
select '00000000-0000-0000-0000-000000000620', 'login_max_attempts',
       '5', 'SECURITY', false,
       'Maximum consecutive failed login attempts before account is temporarily locked.',
       now(), now()
where not exists (select 1 from site_settings where setting_key = 'login_max_attempts');

insert into site_settings (id, setting_key, setting_value, setting_group, is_public, description, created_at, updated_at)
select '00000000-0000-0000-0000-000000000621', 'session_timeout_minutes',
       '60', 'SECURITY', false,
       'Admin session idle timeout in minutes.',
       now(), now()
where not exists (select 1 from site_settings where setting_key = 'session_timeout_minutes');
