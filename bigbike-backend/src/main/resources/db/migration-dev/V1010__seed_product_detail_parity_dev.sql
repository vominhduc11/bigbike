-- V1010 (dev-only seed): unblock product-detail visual parity audit.
--
-- Scope:
-- - Publish the exact FF327 product used by the provided PDP designs.
-- - Seed the missing PDP data surfaces: video tab, technical specs tab,
--   content_bottom, and enough related products in the same category.
-- - Keep this local/dev-only: this file lives in db/migration-dev and should
--   not run in production Flyway locations.
--
-- Contract evidence:
-- - Public catalog only returns products with publish_status = PUBLISHED.
-- - DRAFT -> PUBLISHED is an allowed product transition.
-- - description / promotion_content / content_bottom are existing PDP fields.
-- - stock_state is derived from quantity; this seed keeps quantity and state
--   aligned for the FF327 variants it touches.

-- 1) Publish the exact product from the design and make it purchasable in dev.
update products
set publish_status = 'PUBLISHED',
    stock_state = 'IN_STOCK',
    stock_quantity = 48,
    force_out_of_stock = false,
    weight_kg = 3.0000,
    length_cm = 40.0000,
    width_cm = 70.0000,
    height_cm = 40.0000,
    rating = 5.00,
    rating_count = coalesce(rating_count, 5),
    short_description = 'Áp dụng trả góp lãi suất 0%. Bảo hành chính hãng 2 năm tại BigBike. Chất liệu full carbon nặng khoảng 1350g, đạt chuẩn an toàn ECE/R22-05 và phù hợp nhu cầu đi phố, touring lẫn phượt xa.',
    updated_at = now()
where id = 'wp-prod-6093'
and (
    publish_status <> 'PUBLISHED'
    or stock_state <> 'IN_STOCK'
    or stock_quantity is distinct from 48
    or force_out_of_stock is distinct from false
    or weight_kg is distinct from 3.0000
    or length_cm is distinct from 40.0000
    or width_cm is distinct from 70.0000
    or height_cm is distinct from 40.0000
    or rating_count is null
    or short_description is distinct from 'Áp dụng trả góp lãi suất 0%. Bảo hành chính hãng 2 năm tại BigBike. Chất liệu full carbon nặng khoảng 1350g, đạt chuẩn an toàn ECE/R22-05 và phù hợp nhu cầu đi phố, touring lẫn phượt xa.'
);

update product_variants
set stock_state = 'IN_STOCK',
    is_available = true,
    quantity_on_hand = 12
where product_id = 'wp-prod-6093'
and (
    stock_state <> 'IN_STOCK'
    or is_available is distinct from true
    or quantity_on_hand is distinct from 12
);

-- 2) Publish FF327 siblings so the related-products carousel has enough cards.
update products
set publish_status = 'PUBLISHED',
    updated_at = now()
where id in (
    'wp-prod-27498', -- FF327 Challenger Carbon Alloy
    'wp-prod-27614', -- FF327 Challenger Carbon Fold
    'wp-prod-6124',  -- FF327 Challenger Flex Black
    'wp-prod-6705'   -- FF327 Challenger sợi thủy tinh
)
and publish_status <> 'PUBLISHED';

-- 3) Seed product videos. There were no product_videos rows in runtime data.
-- These reuse existing home-video YouTube URLs plus FF327 thumbnails so the
-- Video tab can render with real contract data instead of UI hardcoding.
insert into product_videos (
    product_id,
    sort_order,
    video_id,
    video_url,
    title,
    provider,
    thumbnail_url,
    thumbnail_alt,
    thumbnail_width,
    thumbnail_height,
    thumbnail_mime_type
)
select
    'wp-prod-6093',
    seed.sort_order,
    seed.video_id,
    seed.video_url,
    seed.title,
    'YOUTUBE',
    seed.thumbnail_url,
    seed.thumbnail_alt,
    1000,
    1000,
    'image/jpeg'
from (
    values
        (0, 'ff327-parity-video-1', 'https://www.youtube.com/shorts/bNmDaq37ghI', 'Review mũ bảo hiểm LS2 FF327 Challenger Carbon', 'http://localhost:9000/bigbike-media/wp-uploads/2019/03/mu_bao_hiem_ls2_carbon_ff327_challenger-04.jpg', 'Video LS2 FF327 Challenger Carbon'),
        (1, 'ff327-parity-video-2', 'https://youtube.com/shorts/WhWzlp3NH14', 'Chi tiết form mũ và kính chắn gió LS2 FF327', 'http://localhost:9000/bigbike-media/wp-uploads/2019/03/mu_bao_hiem_ls2_carbon_ff327_challenger-02.jpg', 'Chi tiết LS2 FF327 Challenger Carbon'),
        (2, 'ff327-parity-video-3', 'https://youtube.com/shorts/zgTqj7kk7Pk', 'Trải nghiệm đội mũ LS2 FF327 cho touring', 'http://localhost:9000/bigbike-media/wp-uploads/2019/03/mu_bao_hiem_ls2_carbon_ff327_challenger-05.jpg', 'Trải nghiệm LS2 FF327 Challenger Carbon'),
        (3, 'ff327-parity-video-4', 'https://youtube.com/shorts/eW5QmxrfcU4', 'Hướng dẫn chọn size LS2 FF327 Challenger Carbon', 'http://localhost:9000/bigbike-media/wp-uploads/2019/03/mu_bao_hiem_ls2_carbon_ff327_challenger-06.jpg', 'Chọn size LS2 FF327 Challenger Carbon')
) as seed(sort_order, video_id, video_url, title, thumbnail_url, thumbnail_alt)
where exists (select 1 from products where id = 'wp-prod-6093')
  and not exists (
    select 1
    from product_videos existing
    where existing.product_id = 'wp-prod-6093'
      and existing.video_id = seed.video_id
);

-- 4) Seed technical specifications for the Additional information tab.
insert into product_specifications (
    product_id,
    sort_order,
    name,
    spec_value,
    group_name
)
select
    'wp-prod-6093',
    seed.sort_order,
    seed.name,
    seed.spec_value,
    seed.group_name
from (
    values
        (0, 'Weight', '3 kg', 'Thông số kỹ thuật'),
        (1, 'Dimensions', '40 x 70 x 40 cm', 'Thông số kỹ thuật'),
        (2, 'Chất liệu vỏ', 'Carbon fiber', 'Thông số kỹ thuật'),
        (3, 'Chuẩn an toàn', 'ECE/R22-05', 'Thông số kỹ thuật'),
        (4, 'Kích thước', 'M, L, XL, XXL', 'Thông số kỹ thuật')
) as seed(sort_order, name, spec_value, group_name)
where exists (select 1 from products where id = 'wp-prod-6093')
  and not exists (
    select 1
    from product_specifications existing
    where existing.product_id = 'wp-prod-6093'
      and existing.name = seed.name
);

