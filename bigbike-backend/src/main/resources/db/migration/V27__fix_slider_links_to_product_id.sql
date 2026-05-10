-- V27: Fix homepage slider links to use product_id instead of external_link.
-- WP ACF data (post 12, kd_postmeta) had product IDs for slides 0–6.
-- Backend SliderReadService generates productLink = "/sp/{slug}.html" from product_id,
-- which redirects to /product/{slug}/ via the SEO redirect map.
--
-- Slide 7 has no product (SCS brand category filter) — external_link kept as-is.

-- Slide 0: SCS S9XM Bluetooth Intercom (wp-prod-38469)
update sliders
set    product_id    = 'wp-prod-38469',
       external_link = null,
       updated_at    = now()
where  id = 'slider_home_0'
  and  product_id is distinct from 'wp-prod-38469'
  and  exists (select 1 from products where id = 'wp-prod-38469');

-- Slide 1: ILM Racing Helmet MF509 (wp-prod-37433)
update sliders
set    product_id    = 'wp-prod-37433',
       external_link = null,
       updated_at    = now()
where  id = 'slider_home_1'
  and  product_id is distinct from 'wp-prod-37433'
  and  exists (select 1 from products where id = 'wp-prod-37433');

-- Slide 2: ILM JC08 Gloves (wp-prod-39156)
update sliders
set    product_id    = 'wp-prod-39156',
       external_link = null,
       updated_at    = now()
where  id = 'slider_home_2'
  and  product_id is distinct from 'wp-prod-39156'
  and  exists (select 1 from products where id = 'wp-prod-39156');

-- Slide 3: LS2 Garda Air jacket (wp-prod-38995)
update sliders
set    product_id    = 'wp-prod-38995',
       external_link = null,
       updated_at    = now()
where  id = 'slider_home_3'
  and  product_id is distinct from 'wp-prod-38995'
  and  exists (select 1 from products where id = 'wp-prod-38995');

-- Slide 4: SCS S9X Bluetooth (wp-prod-36772)
update sliders
set    product_id    = 'wp-prod-36772',
       external_link = null,
       updated_at    = now()
where  id = 'slider_home_4'
  and  product_id is distinct from 'wp-prod-36772'
  and  exists (select 1 from products where id = 'wp-prod-36772');

-- Slide 5: SCS S7X Bluetooth (wp-prod-35026)
update sliders
set    product_id    = 'wp-prod-35026',
       external_link = null,
       updated_at    = now()
where  id = 'slider_home_5'
  and  product_id is distinct from 'wp-prod-35026'
  and  exists (select 1 from products where id = 'wp-prod-35026');

-- Slide 6: ADV Spyke Sahara Vented set (wp-prod-33022)
update sliders
set    product_id    = 'wp-prod-33022',
       external_link = null,
       updated_at    = now()
where  id = 'slider_home_6'
  and  product_id is distinct from 'wp-prod-33022'
  and  exists (select 1 from products where id = 'wp-prod-33022');

-- Slide 7: SCS brand category page — no product, keep external_link
-- (WP had ?pwb-brand=scs which is plugin-specific; drop query param, keep category link)
update sliders
set    external_link = '/tai-nghe-bluetooth-gan-mu-bao-hiem.html',
       updated_at    = now()
where  id = 'slider_home_7'
  and  external_link is distinct from '/tai-nghe-bluetooth-gan-mu-bao-hiem.html';
