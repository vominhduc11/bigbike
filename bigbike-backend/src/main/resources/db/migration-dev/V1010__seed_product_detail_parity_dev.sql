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
    available = true,
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
    or available is distinct from true
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
-- (2026-07-08) product_videos bảng con đã gộp vào cột JSONB products.videos
-- (V334-V336) — set thẳng cả mảng thay vì INSERT nhiều dòng. Guard idempotent
-- bằng điều kiện "chưa có video nào" (tương đương ý định NOT EXISTS gốc).
update products
set videos = jsonb_build_array(
    jsonb_build_object(
        'id', 'ff327-parity-video-1',
        'url', 'https://www.youtube.com/shorts/bNmDaq37ghI',
        'title', 'Review mũ bảo hiểm LS2 FF327 Challenger Carbon',
        'thumbnail', jsonb_build_object(
            'id', null,
            'url', 'http://localhost:9000/bigbike-media/wp-uploads/2019/03/mu_bao_hiem_ls2_carbon_ff327_challenger-04.jpg',
            'alt', 'Video LS2 FF327 Challenger Carbon',
            'width', 1000,
            'height', 1000,
            'mimeType', 'image/jpeg'
        ),
        'provider', 'YOUTUBE',
        'description', null
    ),
    jsonb_build_object(
        'id', 'ff327-parity-video-2',
        'url', 'https://youtube.com/shorts/WhWzlp3NH14',
        'title', 'Chi tiết form mũ và kính chắn gió LS2 FF327',
        'thumbnail', jsonb_build_object(
            'id', null,
            'url', 'http://localhost:9000/bigbike-media/wp-uploads/2019/03/mu_bao_hiem_ls2_carbon_ff327_challenger-02.jpg',
            'alt', 'Chi tiết LS2 FF327 Challenger Carbon',
            'width', 1000,
            'height', 1000,
            'mimeType', 'image/jpeg'
        ),
        'provider', 'YOUTUBE',
        'description', null
    ),
    jsonb_build_object(
        'id', 'ff327-parity-video-3',
        'url', 'https://youtube.com/shorts/zgTqj7kk7Pk',
        'title', 'Trải nghiệm đội mũ LS2 FF327 cho touring',
        'thumbnail', jsonb_build_object(
            'id', null,
            'url', 'http://localhost:9000/bigbike-media/wp-uploads/2019/03/mu_bao_hiem_ls2_carbon_ff327_challenger-05.jpg',
            'alt', 'Trải nghiệm LS2 FF327 Challenger Carbon',
            'width', 1000,
            'height', 1000,
            'mimeType', 'image/jpeg'
        ),
        'provider', 'YOUTUBE',
        'description', null
    ),
    jsonb_build_object(
        'id', 'ff327-parity-video-4',
        'url', 'https://youtube.com/shorts/eW5QmxrfcU4',
        'title', 'Hướng dẫn chọn size LS2 FF327 Challenger Carbon',
        'thumbnail', jsonb_build_object(
            'id', null,
            'url', 'http://localhost:9000/bigbike-media/wp-uploads/2019/03/mu_bao_hiem_ls2_carbon_ff327_challenger-06.jpg',
            'alt', 'Chọn size LS2 FF327 Challenger Carbon',
            'width', 1000,
            'height', 1000,
            'mimeType', 'image/jpeg'
        ),
        'provider', 'YOUTUBE',
        'description', null
    )
)
where id = 'wp-prod-6093'
  and (videos is null or jsonb_array_length(videos) = 0);

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

