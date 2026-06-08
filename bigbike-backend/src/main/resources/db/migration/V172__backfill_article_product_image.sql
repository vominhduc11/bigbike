-- V172: Backfill article product_image_url from WP ACF product_image field.
-- Mapping extracted from bigbike_vn__2026_04_17/sqldump.sql postmeta rows
-- where meta_key = 'product_image'. 35 articles total.
-- article.id = 'wp-art-{post_id}', joined to media via legacy_id = attachment_id.
with wp_mapping (post_id, media_legacy_id) as (
    values
    (8118, 10177),
    (8679, 8678),
    (8682, 8681),
    (8110, 10180),
    (8686, 8685),
    (8078, 10183),
    (8689, 8688),
    (8073, 10186),
    (8692, 8691),
    (8693, 8690),
    (8016, 10189),
    (8696, 8695),
    (8698, 8697),
    (8700, 8699),
    (8702, 8701),
    (10178, 10177),
    (10181, 10180),
    (10184, 10183),
    (10187, 10186),
    (10190, 10189),
    (25696, 10177),
    (27317, 10180),
    (27319, 10189),
    (27332, 10189),
    (27575, 10189),
    (31649, 10180),
    (38083, 10186),
    (38637, 10180),
    (38641, 10177),
    (38704, 10180),
    (38705, 10180),
    (38706, 10180),
    (38710, 10180),
    (38713, 10180),
    (38714, 10180)
)
update articles a
set
    product_image_url = m.public_url,
    product_image_alt = m.alt_text
from wp_mapping wm
join media m on m.legacy_id = wm.media_legacy_id
where a.id = 'wp-art-' || wm.post_id
  and m.public_url is not null
  and a.product_image_url is distinct from m.public_url;
