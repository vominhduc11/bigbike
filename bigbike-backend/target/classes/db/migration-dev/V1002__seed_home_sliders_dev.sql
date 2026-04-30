-- Dev seed: replace any sliders already inserted by V19 with local dev data
-- (dev products from V1000 seed, dev CDN URLs)
delete from sliders where location = 'home';

insert into sliders (id, sort_order, location, desktop_image, mobile_image, product_id, external_link, created_at, updated_at)
values
(
    'slider_home_0', 0, 'home',
    '{"url":"https://cdn.bigbike.local/sliders/home-0-desktop.jpg","alt":"SCS S9XM intercom","width":1920,"height":720}',
    '{"url":"https://cdn.bigbike.local/sliders/home-0-mobile.jpg","alt":"SCS S9XM intercom","width":768,"height":960}',
    'prod_ls2_ff800', null,
    '2026-04-25T00:00:00Z', '2026-04-25T00:00:00Z'
),
(
    'slider_home_1', 1, 'home',
    '{"url":"https://cdn.bigbike.local/sliders/home-1-desktop.jpg","alt":"ILM Racing MF509","width":1920,"height":720}',
    '{"url":"https://cdn.bigbike.local/sliders/home-1-mobile.jpg","alt":"ILM Racing MF509","width":768,"height":960}',
    'prod_ls2_jacket_city', null,
    '2026-04-25T00:00:00Z', '2026-04-25T00:00:00Z'
),
(
    'slider_home_2', 2, 'home',
    '{"url":"https://cdn.bigbike.local/sliders/home-2-desktop.jpg","alt":"ILM JC08 gloves","width":1920,"height":720}',
    null,
    'prod_ls2_ff800', null,
    '2026-04-25T00:00:00Z', '2026-04-25T00:00:00Z'
),
(
    'slider_home_3', 3, 'home',
    '{"url":"https://cdn.bigbike.local/sliders/home-3-desktop.jpg","alt":"LS2 Garda Air","width":1920,"height":720}',
    '{"url":"https://cdn.bigbike.local/sliders/home-3-mobile.jpg","alt":"LS2 Garda Air","width":768,"height":960}',
    'prod_ls2_jacket_city', null,
    '2026-04-25T00:00:00Z', '2026-04-25T00:00:00Z'
),
(
    'slider_home_4', 4, 'home',
    '{"url":"https://cdn.bigbike.local/sliders/home-4-desktop.jpg","alt":"SCS S9X","width":1920,"height":720}',
    '{"url":"https://cdn.bigbike.local/sliders/home-4-mobile.jpg","alt":"SCS S9X","width":768,"height":960}',
    'prod_ls2_ff800', null,
    '2026-04-25T00:00:00Z', '2026-04-25T00:00:00Z'
),
(
    'slider_home_5', 5, 'home',
    '{"url":"https://cdn.bigbike.local/sliders/home-5-desktop.jpg","alt":"SCS S7X","width":1920,"height":720}',
    '{"url":"https://cdn.bigbike.local/sliders/home-5-mobile.jpg","alt":"SCS S7X","width":768,"height":960}',
    'prod_ls2_jacket_city', null,
    '2026-04-25T00:00:00Z', '2026-04-25T00:00:00Z'
),
(
    'slider_home_6', 6, 'home',
    '{"url":"https://cdn.bigbike.local/sliders/home-6-desktop.jpg","alt":"ADV Spyke Sahara","width":1920,"height":720}',
    '{"url":"https://cdn.bigbike.local/sliders/home-6-mobile.jpg","alt":"ADV Spyke Sahara","width":768,"height":960}',
    'prod_ls2_ff800', null,
    '2026-04-25T00:00:00Z', '2026-04-25T00:00:00Z'
),
(
    'slider_home_7', 7, 'home',
    '{"url":"https://cdn.bigbike.local/sliders/home-7-desktop.jpg","alt":"Tai nghe Bluetooth gan mu bao hiem SCS","width":1920,"height":720}',
    '{"url":"https://cdn.bigbike.local/sliders/home-7-mobile.jpg","alt":"Tai nghe Bluetooth gan mu bao hiem SCS","width":768,"height":960}',
    null, 'https://bigbike.vn/tai-nghe-bluetooth-gan-mu-bao-hiem.html?pwb-brand=scs',
    '2026-04-25T00:00:00Z', '2026-04-25T00:00:00Z'
);
