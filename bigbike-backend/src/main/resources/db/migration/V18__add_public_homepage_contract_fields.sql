alter table products
    add column if not exists rating numeric(3, 2);

alter table products
    add constraint ck_products_rating
    check (rating is null or (rating >= 0 and rating <= 5));

alter table categories
    add column if not exists show_on_homepage boolean;

create index if not exists idx_products_is_featured on products (is_featured);
create index if not exists idx_products_show_on_homepage on products (show_on_homepage);
create index if not exists idx_categories_show_on_homepage on categories (show_on_homepage);
create index if not exists idx_categories_sort_order on categories (sort_order);

insert into content_categories (id, slug, name)
select 'wp-content-category-365', 'trai-nghiem', 'Trai nghiem'
where not exists (select 1 from content_categories where slug = 'trai-nghiem');

insert into content_categories (id, slug, name)
select 'wp-content-category-361', 'blog', 'Blog'
where not exists (select 1 from content_categories where slug = 'blog');

update site_settings
set is_public = true,
    setting_group = case setting_key
        when 'zalo_url' then 'public_home'
        when 'hotline' then 'public_home'
        when 'promo_title' then 'public_home'
        when 'promo_off' then 'public_home'
        when 'promo_href' then 'public_home'
        when 'promo_image_url' then 'public_home'
        when 'seo_home_title' then 'seo'
        when 'seo_home_description' then 'seo'
        when 'og_image_url' then 'seo'
        else setting_group
    end,
    description = case setting_key
        when 'zalo_url' then 'Homepage floating contact Zalo URL.'
        when 'hotline' then 'Public hotline displayed on the website.'
        when 'promo_title' then 'Homepage promotional banner title.'
        when 'promo_off' then 'Homepage promotional discount label.'
        when 'promo_href' then 'Homepage promotional banner target URL.'
        when 'promo_image_url' then 'Homepage promotional banner image URL.'
        when 'seo_home_title' then 'Homepage SEO title.'
        when 'seo_home_description' then 'Homepage SEO description.'
        when 'og_image_url' then 'Default Open Graph image URL.'
        else description
    end,
    updated_at = now()
where setting_key in (
    'zalo_url',
    'hotline',
    'promo_title',
    'promo_off',
    'promo_href',
    'promo_image_url',
    'seo_home_title',
    'seo_home_description',
    'og_image_url'
);

insert into site_settings (id, setting_key, setting_value, setting_group, is_public, description, created_at, updated_at)
select '00000000-0000-0000-0000-000000000501', 'zalo_url', '', 'public_home', true, 'Homepage floating contact Zalo URL.', now(), now()
where not exists (select 1 from site_settings where setting_key = 'zalo_url');

insert into site_settings (id, setting_key, setting_value, setting_group, is_public, description, created_at, updated_at)
select '00000000-0000-0000-0000-000000000502', 'hotline', '028.62797251', 'public_home', true, 'Public hotline displayed on the website.', now(), now()
where not exists (select 1 from site_settings where setting_key = 'hotline');

insert into site_settings (id, setting_key, setting_value, setting_group, is_public, description, created_at, updated_at)
select '00000000-0000-0000-0000-000000000503', 'promo_title', 'LS2 DUAL SPORT MX436 PIONEER', 'public_home', true, 'Homepage promotional banner title.', now(), now()
where not exists (select 1 from site_settings where setting_key = 'promo_title');

insert into site_settings (id, setting_key, setting_value, setting_group, is_public, description, created_at, updated_at)
select '00000000-0000-0000-0000-000000000504', 'promo_off', '20% OFF', 'public_home', true, 'Homepage promotional discount label.', now(), now()
where not exists (select 1 from site_settings where setting_key = 'promo_off');

insert into site_settings (id, setting_key, setting_value, setting_group, is_public, description, created_at, updated_at)
select '00000000-0000-0000-0000-000000000505', 'promo_href', '/san-pham', 'public_home', true, 'Homepage promotional banner target URL.', now(), now()
where not exists (select 1 from site_settings where setting_key = 'promo_href');

insert into site_settings (id, setting_key, setting_value, setting_group, is_public, description, created_at, updated_at)
select '00000000-0000-0000-0000-000000000506', 'promo_image_url', '', 'public_home', true, 'Homepage promotional banner image URL.', now(), now()
where not exists (select 1 from site_settings where setting_key = 'promo_image_url');

insert into site_settings (id, setting_key, setting_value, setting_group, is_public, description, created_at, updated_at)
select '00000000-0000-0000-0000-000000000507', 'seo_home_title', 'BigBike - Do bao ho moto chinh hang', 'seo', true, 'Homepage SEO title.', now(), now()
where not exists (select 1 from site_settings where setting_key = 'seo_home_title');

insert into site_settings (id, setting_key, setting_value, setting_group, is_public, description, created_at, updated_at)
select '00000000-0000-0000-0000-000000000508', 'seo_home_description', 'BigBike - shop do bao ho moto uy tin tai TP.HCM.', 'seo', true, 'Homepage SEO description.', now(), now()
where not exists (select 1 from site_settings where setting_key = 'seo_home_description');

insert into site_settings (id, setting_key, setting_value, setting_group, is_public, description, created_at, updated_at)
select '00000000-0000-0000-0000-000000000509', 'og_image_url', '', 'seo', true, 'Default Open Graph image URL.', now(), now()
where not exists (select 1 from site_settings where setting_key = 'og_image_url');
