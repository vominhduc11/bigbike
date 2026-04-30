alter table articles
    add column if not exists product_image_url text;

alter table articles
    add column if not exists product_image_alt varchar(500);

insert into site_settings (id, setting_key, setting_value, setting_group, is_public, description, created_at, updated_at)
select '00000000-0000-0000-0000-000000000520', 'home_exp_subtitle', 'GÓC TRẢI NGHIỆM CÙNG BIGBIKE', 'public_home', true, 'Homepage experience section kicker/subtitle text.', now(), now()
where not exists (select 1 from site_settings where setting_key = 'home_exp_subtitle');

insert into site_settings (id, setting_key, setting_value, setting_group, is_public, description, created_at, updated_at)
select '00000000-0000-0000-0000-000000000521', 'home_exp_title', 'PHỤ KIỆN ĐI PHƯỢT MOTO CAO CẤP', 'public_home', true, 'Homepage experience section heading title.', now(), now()
where not exists (select 1 from site_settings where setting_key = 'home_exp_title');

insert into site_settings (id, setting_key, setting_value, setting_group, is_public, description, created_at, updated_at)
select '00000000-0000-0000-0000-000000000522', 'home_exp_desc', 'Tại shop bán đồ phượt moto Bigbike, các sản phẩm đồ bảo hộ moto và phụ kiện phượt rất đa dạng về mẫu mã và kiểu dáng với giá cả vô cùng phải chăng. Ngoài ra, đội ngũ nhân viên của cửa hàng rất am hiểu sản phẩm, sẵn sàng tư vấn và chăm sóc khách hàng khi cần thiết.', 'public_home', true, 'Homepage experience section description paragraph.', now(), now()
where not exists (select 1 from site_settings where setting_key = 'home_exp_desc');

update site_settings
set is_public = true,
    setting_group = 'public_home',
    description = case setting_key
        when 'home_exp_subtitle' then 'Homepage experience section kicker/subtitle text.'
        when 'home_exp_title' then 'Homepage experience section heading title.'
        when 'home_exp_desc' then 'Homepage experience section description paragraph.'
        else description
    end,
    updated_at = now()
where setting_key in ('home_exp_subtitle', 'home_exp_title', 'home_exp_desc');
