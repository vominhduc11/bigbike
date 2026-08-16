-- Explicit product-to-scale classification for the 109 currently published,
-- non-discontinued products that expose a size option. The mapping is a data
-- decision, not a runtime category/numeric-range heuristic.

CREATE TEMP TABLE catalog_size_scale_assignment (
    product_id varchar(64) PRIMARY KEY,
    scale_code varchar(64) NOT NULL
) ON COMMIT DROP;

INSERT INTO catalog_size_scale_assignment (product_id, scale_code) VALUES
    ('prod_142e652f62944f459638dbe853f855d9','glove-letter'),
    ('prod_174431e77b5f417698ecf12d72fc8e8d','apparel-letter'),
    ('prod_17c08ac41c5142e3af191aa553a42c0e','helmet-letter'),
    ('prod_1c665dd6661d41a4a413101de88abf58','shoe-eu'),
    ('prod_3238a07286ce44e68cab92e74d0f756b','shoe-eu'),
    ('prod_3ab5e39eab5f444a9e1a31ab8feb24fa','apparel-letter'),
    ('prod_4932272e9cdb4a439066ffca85d98a33','glove-letter'),
    ('prod_4bb98db9ec274d6ba5e8f92017bb4232','apparel-letter'),
    ('prod_55d003bc20fc4421bbded4d10eac3ab6','shoe-eu'),
    ('prod_5a3a65f3ab7e4b3e84853825e886e5f0','helmet-letter'),
    ('prod_678a19bea5c84462b5dc8084a60b341c','apparel-letter'),
    ('prod_67ae8bfe3c054b2abe215e81ef3f2f16','glove-letter'),
    ('prod_6f6b1286a52544ae865d54a8102057ee','glove-letter'),
    ('prod_7c08708fb2344fca8763c956e8ad4e49','shoe-eu'),
    ('prod_7dd73628213f4a8bb62be5353ce17156','apparel-eu'),
    ('prod_7f722545e5d04d8fb8b15c9f06a40994','apparel-letter'),
    ('prod_84233123474747d09fbb4f0aa69db2d6','apparel-letter'),
    ('prod_9a28df3adcf34f5caa7cdfc6946d6ee7','apparel-letter'),
    ('prod_9e6c40024f574782a7b78f887403ccb0','apparel-letter'),
    ('prod_b41f618ef7d44e2aba972a40fc97a19e','helmet-letter'),
    ('prod_b9139bb31ae7465a834e6c200b934b85','glove-letter'),
    ('prod_c99ca09325f44009afb2d2764630bedb','apparel-letter'),
    ('prod_ca1e209d57ab46909ae9b8318f9cd53a','glove-letter'),
    ('prod_ccd00833554e411d88d5291e0372e34c','apparel-letter'),
    ('prod_d07cb902468540de8f3be4b3aa45f7bf','shoe-eu'),
    ('prod_d2b1b5806c9a4287bd5cfb226c4aa572','helmet-letter'),
    ('prod_d6a45f4a86f64ac8a4a13ed3c2a8bd86','apparel-letter'),
    ('prod_d7c50d11fb2c4f23a5127fdeb6bb9397','helmet-letter'),
    ('prod_dad9edb85e34410eaa2fea069826e343','apparel-letter'),
    ('prod_e0427dac5dbd4de6acefb8639fa94695','shoe-eu'),
    ('prod_fdacebfea9cf4621b3091387ec47a164','shoe-eu'),
    ('wp-prod-25206','helmet-letter'),
    ('wp-prod-25207','helmet-letter'),
    ('wp-prod-26948','apparel-eu'),
    ('wp-prod-27034','glove-letter'),
    ('wp-prod-27153','apparel-letter'),
    ('wp-prod-28881','apparel-letter'),
    ('wp-prod-30587','shoe-eu'),
    ('wp-prod-30856','shoe-eu'),
    ('wp-prod-30996','apparel-letter'),
    ('wp-prod-31028','glove-letter'),
    ('wp-prod-31361','apparel-letter'),
    ('wp-prod-31573','apparel-letter'),
    ('wp-prod-31628','apparel-letter'),
    ('wp-prod-32164','apparel-letter'),
    ('wp-prod-32398','waist-inch'),
    ('wp-prod-32727','glove-letter'),
    ('wp-prod-33960','apparel-letter'),
    ('wp-prod-34009','apparel-letter'),
    ('wp-prod-34021','apparel-letter'),
    ('wp-prod-34033','apparel-letter'),
    ('wp-prod-34064','glove-letter'),
    ('wp-prod-34222','shoe-eu'),
    ('wp-prod-34243','shoe-eu'),
    ('wp-prod-34297','apparel-letter'),
    ('wp-prod-34503','glove-letter'),
    ('wp-prod-34620','apparel-letter'),
    ('wp-prod-34662','apparel-letter'),
    ('wp-prod-34803','apparel-letter'),
    ('wp-prod-35044','apparel-letter'),
    ('wp-prod-35061','apparel-letter'),
    ('wp-prod-35222','shoe-eu'),
    ('wp-prod-35343','glove-letter'),
    ('wp-prod-35346','helmet-letter'),
    ('wp-prod-36296','helmet-letter'),
    ('wp-prod-36322','helmet-letter'),
    ('wp-prod-36357','helmet-letter'),
    ('wp-prod-36609','apparel-letter'),
    ('wp-prod-36900','apparel-letter'),
    ('wp-prod-36901','apparel-letter'),
    ('wp-prod-37104','helmet-letter'),
    ('wp-prod-37368','helmet-letter'),
    ('wp-prod-37433','helmet-letter'),
    ('wp-prod-37520','glove-letter'),
    ('wp-prod-37733','apparel-letter'),
    ('wp-prod-37734','apparel-letter'),
    ('wp-prod-38283','apparel-letter'),
    ('wp-prod-38470','apparel-letter'),
    ('wp-prod-38870','apparel-letter'),
    ('wp-prod-38871','apparel-letter'),
    ('wp-prod-38995','apparel-letter'),
    ('wp-prod-39004','apparel-letter'),
    ('wp-prod-39356','apparel-letter'),
    ('wp-prod-39511','apparel-letter'),
    ('wp-prod-39530','apparel-letter'),
    ('wp-prod-39532','apparel-letter'),
    ('wp-prod-39534','apparel-letter'),
    ('wp-prod-39536','apparel-letter'),
    ('wp-prod-39542','apparel-letter'),
    ('wp-prod-39548','waist-inch'),
    ('wp-prod-39835','helmet-letter'),
    ('wp-prod-39912','glove-letter'),
    ('wp-prod-40013','glove-letter'),
    ('wp-prod-40018','glove-letter'),
    ('wp-prod-40089','shoe-eu'),
    ('wp-prod-40314','apparel-eu'),
    ('wp-prod-40469','apparel-letter'),
    ('wp-prod-40471','apparel-letter'),
    ('wp-prod-40473','apparel-letter'),
    ('wp-prod-40496','helmet-letter'),
    ('wp-prod-40559','helmet-letter'),
    ('wp-prod-40706','helmet-letter'),
    ('wp-prod-41213','glove-letter'),
    ('wp-prod-41260','glove-letter'),
    ('wp-prod-41359','helmet-letter'),
    ('wp-prod-4168','apparel-letter'),
    ('wp-prod-42618','glove-letter'),
    ('wp-prod-8240','apparel-letter'),
    ('wp-prod-8478','helmet-letter');

-- V1028 seeded the women's subgroup on apparel-letter only, but the catalog
-- also sells a women's glove line (Taichi RST462 ships in WL), so glove-letter
-- needs the same subgroup. Facets are built from real product values, so the
-- unsold WS/WM entries stay out of the public filter until stock exists.
INSERT INTO catalog_size_values
    (id, scale_id, value_key, label, label_en, subgroup_key, subgroup_label, subgroup_label_en, sort_order)
VALUES
    ('size-value-glove-ws', 'size-scale-glove-letter', 'WS', 'WS', 'WS', 'women', 'Nữ', 'Women', 110),
    ('size-value-glove-wm', 'size-scale-glove-letter', 'WM', 'WM', 'WM', 'women', 'Nữ', 'Women', 120),
    ('size-value-glove-wl', 'size-scale-glove-letter', 'WL', 'WL', 'WL', 'women', 'Nữ', 'Women', 130)
ON CONFLICT (scale_id, value_key) DO UPDATE
SET subgroup_key = EXCLUDED.subgroup_key,
    subgroup_label = EXCLUDED.subgroup_label,
    subgroup_label_en = EXCLUDED.subgroup_label_en,
    sort_order = EXCLUDED.sort_order,
    active = true;

UPDATE products p
SET size_scale_id = s.id
FROM catalog_size_scale_assignment a
JOIN catalog_size_scales s ON s.code = a.scale_code
WHERE p.id = a.product_id;

-- Canonicalize only option rows that are semantically size options. This keeps
-- the old attribute/value contract usable by the PDP and admin editor.
UPDATE product_variant_options
SET option_value = CASE
    WHEN upper(regexp_replace(trim(option_value), '[[:space:]]+', '', 'g')) = '2XL' THEN 'XXL'
    WHEN upper(regexp_replace(trim(option_value), '[[:space:]]+', '', 'g')) = 'XXXL' THEN '3XL'
    WHEN lower(regexp_replace(trim(option_value), '[[:space:]]+', '', 'g')) = 'm' THEN 'M'
    ELSE regexp_replace(trim(option_value), '[[:space:]]+', '', 'g')
END
WHERE lower(regexp_replace(unaccent(trim(option_name)), '[[:space:]_-]+', '', 'g')) IN ('size','kichco','kichthuoc');

UPDATE product_variant_options pvo
SET attribute_id = a.id,
    attribute_value_id = av.id
FROM attributes a
JOIN attribute_values av ON av.attribute_id = a.id
WHERE a.code = 'size'
  AND av.slug = btrim(lower(regexp_replace(unaccent(pvo.option_value), '[^a-zA-Z0-9]+', '-', 'g')), '-')
  AND lower(regexp_replace(unaccent(trim(pvo.option_name)), '[[:space:]_-]+', '', 'g')) IN ('size','kichco','kichthuoc');

DO $$
DECLARE
    expected_count integer;
    assigned_count integer;
    invalid_values integer;
BEGIN
    SELECT count(*) INTO expected_count
    FROM (
        SELECT DISTINCT p.id
        FROM products p
        JOIN product_variants v ON v.product_id = p.id
        JOIN product_variant_options o ON o.variant_id = v.id
        WHERE p.publish_status = 'PUBLISHED'
          AND p.discontinued = false
          AND lower(regexp_replace(unaccent(trim(o.option_name)), '[[:space:]_-]+', '', 'g')) IN ('size','kichco','kichthuoc')
    ) sized_products;

    SELECT count(*) INTO assigned_count
    FROM products p
    WHERE p.publish_status = 'PUBLISHED'
      AND p.discontinued = false
      AND p.size_scale_id IS NOT NULL;

    IF expected_count <> 109 OR assigned_count < expected_count THEN
        RAISE EXCEPTION 'Size scale backfill expected 109 assigned products; expected %, assigned %', expected_count, assigned_count;
    END IF;

    SELECT count(*) INTO invalid_values
    FROM products p
    JOIN product_variants v ON v.product_id = p.id
    JOIN product_variant_options o ON o.variant_id = v.id
    WHERE p.publish_status = 'PUBLISHED'
      AND p.discontinued = false
      AND lower(regexp_replace(unaccent(trim(o.option_name)), '[[:space:]_-]+', '', 'g')) IN ('size','kichco','kichthuoc')
      AND NOT EXISTS (
          SELECT 1
          FROM catalog_size_scales s
          JOIN catalog_size_values sv ON sv.scale_id = s.id AND sv.active = true
          WHERE s.id = p.size_scale_id
            AND upper(regexp_replace(trim(o.option_value), '[[:space:]]+', '', 'g')) = sv.value_key
      );

    IF invalid_values > 0 THEN
        RAISE EXCEPTION 'Size scale backfill found % product size values outside their assigned scale', invalid_values;
    END IF;
END $$;
