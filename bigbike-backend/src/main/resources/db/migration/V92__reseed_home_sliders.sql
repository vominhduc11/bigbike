-- V92: Reseed home sliders if missing.
-- V19 inserted 8 sliders, V27/V33 corrected them, but the rows have since been
-- lost (admin UI shows "Chưa có banner ở vị trí home"). This migration is
-- idempotent — it only inserts when slider_home_N is missing.
-- Data source: WP post 12 ACF "sliders" (kd_postmeta) + manual SCS S9XM addition.

insert into sliders (id, sort_order, location, desktop_image, mobile_image, product_id, external_link, is_active, created_at, updated_at)
select 'slider_home_0', 0, 'home',
    '{"url":"https://bigbike.vn/wp-content/uploads/2025/08/tro-chuyen-doi-ket-noi-mai-s9xm-4.jpg","alt":"SCS S9XM Bluetooth Intercom","width":1920,"height":720}'::json,
    '{"url":"https://bigbike.vn/wp-content/uploads/2025/08/tro-chuyen-doi-ket-noi-mai-s9xm-doc.jpg","alt":"SCS S9XM Bluetooth Intercom","width":768,"height":960}'::json,
    case when exists (select 1 from products where id = 'wp-prod-38469') then 'wp-prod-38469' else null end,
    null, true,
    now(), now()
where not exists (select 1 from sliders where id = 'slider_home_0');

insert into sliders (id, sort_order, location, desktop_image, mobile_image, product_id, external_link, is_active, created_at, updated_at)
select 'slider_home_1', 1, 'home',
    '{"url":"https://bigbike.vn/wp-content/uploads/2025/08/csbrdve-1.jpg","alt":"ILM Racing Helmet MF509","width":1920,"height":720}'::json,
    '{"url":"https://bigbike.vn/wp-content/uploads/2025/08/adfgsf-1.jpg","alt":"ILM Racing Helmet MF509","width":768,"height":960}'::json,
    case when exists (select 1 from products where id = 'wp-prod-37433') then 'wp-prod-37433' else null end,
    null, true,
    now(), now()
where not exists (select 1 from sliders where id = 'slider_home_1');

insert into sliders (id, sort_order, location, desktop_image, mobile_image, product_id, external_link, is_active, created_at, updated_at)
select 'slider_home_2', 2, 'home',
    '{"url":"https://bigbike.vn/wp-content/uploads/2025/08/jlm-jc08.jpg","alt":"ILM JC08 Gloves","width":1920,"height":720}'::json,
    null,
    case when exists (select 1 from products where id = 'wp-prod-39156') then 'wp-prod-39156' else null end,
    null, true,
    now(), now()
where not exists (select 1 from sliders where id = 'slider_home_2');

insert into sliders (id, sort_order, location, desktop_image, mobile_image, product_id, external_link, is_active, created_at, updated_at)
select 'slider_home_3', 3, 'home',
    '{"url":"https://bigbike.vn/wp-content/uploads/2025/08/ls2-como-vs-garda.jpg","alt":"LS2 Garda Air","width":1920,"height":720}'::json,
    '{"url":"https://bigbike.vn/wp-content/uploads/2025/08/ls2-como-vs-garda-doc.jpg","alt":"LS2 Garda Air","width":768,"height":960}'::json,
    case when exists (select 1 from products where id = 'wp-prod-38995') then 'wp-prod-38995' else null end,
    null, true,
    now(), now()
where not exists (select 1 from sliders where id = 'slider_home_3');

insert into sliders (id, sort_order, location, desktop_image, mobile_image, product_id, external_link, is_active, created_at, updated_at)
select 'slider_home_4', 4, 'home',
    '{"url":"https://bigbike.vn/wp-content/uploads/2024/10/scs-s9x.jpg","alt":"SCS S9X Bluetooth","width":1920,"height":720}'::json,
    '{"url":"https://bigbike.vn/wp-content/uploads/2024/10/scs-s9x-bia-2.jpg","alt":"SCS S9X Bluetooth","width":768,"height":960}'::json,
    case when exists (select 1 from products where id = 'wp-prod-36772') then 'wp-prod-36772' else null end,
    null, true,
    now(), now()
where not exists (select 1 from sliders where id = 'slider_home_4');

insert into sliders (id, sort_order, location, desktop_image, mobile_image, product_id, external_link, is_active, created_at, updated_at)
select 'slider_home_5', 5, 'home',
    '{"url":"https://bigbike.vn/wp-content/uploads/2024/06/scs-s7x-banner-1.jpg","alt":"SCS S7X Bluetooth","width":1920,"height":720}'::json,
    '{"url":"https://bigbike.vn/wp-content/uploads/2024/06/scs-s7x-banner-doc-1-1.jpg","alt":"SCS S7X Bluetooth","width":768,"height":960}'::json,
    case when exists (select 1 from products where id = 'wp-prod-35026') then 'wp-prod-35026' else null end,
    null, true,
    now(), now()
where not exists (select 1 from sliders where id = 'slider_home_5');

insert into sliders (id, sort_order, location, desktop_image, mobile_image, product_id, external_link, is_active, created_at, updated_at)
select 'slider_home_6', 6, 'home',
    '{"url":"https://bigbike.vn/wp-content/uploads/2023/12/spyke.jpg","alt":"ADV Spyke Sahara","width":1920,"height":720}'::json,
    '{"url":"https://bigbike.vn/wp-content/uploads/2023/12/spyke2.jpg","alt":"ADV Spyke Sahara","width":768,"height":960}'::json,
    case when exists (select 1 from products where id = 'wp-prod-33022') then 'wp-prod-33022' else null end,
    null, true,
    now(), now()
where not exists (select 1 from sliders where id = 'slider_home_6');

insert into sliders (id, sort_order, location, desktop_image, mobile_image, product_id, external_link, is_active, created_at, updated_at)
select 'slider_home_7', 7, 'home',
    '{"url":"https://bigbike.vn/wp-content/uploads/2023/08/SCS-NEW-03-03-2.png","alt":"Tai nghe Bluetooth SCS gan mu bao hiem","width":1920,"height":720}'::json,
    '{"url":"https://bigbike.vn/wp-content/uploads/2023/08/SCS-NEW-02-1.png","alt":"Tai nghe Bluetooth SCS gan mu bao hiem","width":768,"height":960}'::json,
    null, '/tai-nghe-bluetooth-gan-mu-bao-hiem.html', true,
    now(), now()
where not exists (select 1 from sliders where id = 'slider_home_7');
