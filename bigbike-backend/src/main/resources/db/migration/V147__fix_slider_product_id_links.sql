-- V147: Fix home slider product_id links.
-- V27 attempted to set product_id for sliders 0-6 but ran before WP products were imported
-- via the Java importer (ArticleImporter/ProductImporter run after Flyway). All conditions
-- evaluated to FALSE (product rows did not exist yet), so all sliders kept product_id=null
-- and category-level external_link values from V19.
-- Now that products exist, we set product_id and clear external_link for sliders 0-6.

-- Slider 0: SCS S9XM Bluetooth Intercom
update sliders
set    product_id    = 'wp-prod-38469',
       external_link = null,
       updated_at    = now()
where  id = 'slider_home_0'
  and  product_id is null
  and  exists (select 1 from products where id = 'wp-prod-38469');

-- Slider 1: ILM Racing Helmet MF509
update sliders
set    product_id    = 'wp-prod-37433',
       external_link = null,
       updated_at    = now()
where  id = 'slider_home_1'
  and  product_id is null
  and  exists (select 1 from products where id = 'wp-prod-37433');

-- Slider 2: ILM JC08 Gloves
update sliders
set    product_id    = 'wp-prod-39156',
       external_link = null,
       updated_at    = now()
where  id = 'slider_home_2'
  and  product_id is null
  and  exists (select 1 from products where id = 'wp-prod-39156');

-- Slider 3: LS2 Garda Air jacket
update sliders
set    product_id    = 'wp-prod-38995',
       external_link = null,
       updated_at    = now()
where  id = 'slider_home_3'
  and  product_id is null
  and  exists (select 1 from products where id = 'wp-prod-38995');

-- Slider 4: SCS S9X Bluetooth
update sliders
set    product_id    = 'wp-prod-36772',
       external_link = null,
       updated_at    = now()
where  id = 'slider_home_4'
  and  product_id is null
  and  exists (select 1 from products where id = 'wp-prod-36772');

-- Slider 5: SCS S7X Bluetooth
update sliders
set    product_id    = 'wp-prod-35026',
       external_link = null,
       updated_at    = now()
where  id = 'slider_home_5'
  and  product_id is null
  and  exists (select 1 from products where id = 'wp-prod-35026');

-- Slider 6: ADV Spyke Sahara Vented set
update sliders
set    product_id    = 'wp-prod-33022',
       external_link = null,
       updated_at    = now()
where  id = 'slider_home_6'
  and  product_id is null
  and  exists (select 1 from products where id = 'wp-prod-33022');

-- Slider 7: SCS brand category page — no product, keep external_link as-is.
