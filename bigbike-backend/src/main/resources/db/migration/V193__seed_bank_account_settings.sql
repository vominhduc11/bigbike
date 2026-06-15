-- V192: Seed bank-transfer account settings (group 'payment', public).
--
-- BigBike has no payment gateway — admin reconciles bank transfers manually and
-- maintains these account details by hand (see AGENTS.md / no-auto-payment rule).
-- Values are seeded empty; the storefront only shows the bank box on a BACS order
-- confirmation once the account holder/number are filled in by an admin.
-- is_public=true so the values are exposed via GET /api/v1/settings/public.

insert into site_settings (id, setting_key, setting_value, setting_group, is_public, description, created_at, updated_at)
select gen_random_uuid(), 'bank_account_holder', '', 'payment', true,
       'Tên chủ tài khoản ngân hàng nhận chuyển khoản.', now(), now()
where not exists (select 1 from site_settings where setting_key = 'bank_account_holder');

insert into site_settings (id, setting_key, setting_value, setting_group, is_public, description, created_at, updated_at)
select gen_random_uuid(), 'bank_account_number', '', 'payment', true,
       'Số tài khoản ngân hàng nhận chuyển khoản.', now(), now()
where not exists (select 1 from site_settings where setting_key = 'bank_account_number');

insert into site_settings (id, setting_key, setting_value, setting_group, is_public, description, created_at, updated_at)
select gen_random_uuid(), 'bank_name', '', 'payment', true,
       'Tên ngân hàng (vd: Vietcombank).', now(), now()
where not exists (select 1 from site_settings where setting_key = 'bank_name');

insert into site_settings (id, setting_key, setting_value, setting_group, is_public, description, created_at, updated_at)
select gen_random_uuid(), 'bank_branch', '', 'payment', true,
       'Chi nhánh ngân hàng (không bắt buộc).', now(), now()
where not exists (select 1 from site_settings where setting_key = 'bank_branch');
