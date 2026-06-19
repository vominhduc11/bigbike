-- V228: Seed khối "3 dòng cam kết" hiển thị dưới nút mua hàng trên MỌI trang chi tiết sản phẩm
-- (bigbike-web). Nội dung dùng chung toàn bộ sản phẩm, admin sửa được qua Cài đặt → Trang sản phẩm
-- (nhóm public_product). Mỗi dòng gồm tiêu đề + mô tả; icon (giao hàng / đổi trả / bảo hành) cố định
-- ở web. valueType/public do SettingDefinitionRegistry cung cấp; bảng chỉ giữ value/value_en/group/is_public.
-- Để trống tiêu đề một dòng → web tự ẩn dòng đó. Seed = đúng nội dung mockup (VI + EN).

insert into site_settings
    (id, setting_key, setting_value, setting_value_en, setting_group, is_public, description, created_at, updated_at)
values
    (gen_random_uuid(), 'product_commitment_1_title',
        'Giao toàn quốc 2–3 ngày',
        'Nationwide delivery in 2–3 days',
        'public_product', true, 'Trang sản phẩm — cam kết dòng 1 (giao hàng): tiêu đề.', now(), now()),
    (gen_random_uuid(), 'product_commitment_1_subtitle',
        'Hà Nội, TP.HCM và các tỉnh · Thanh toán khi nhận (COD)',
        'Hanoi, HCMC and provinces · Cash on delivery (COD)',
        'public_product', true, 'Trang sản phẩm — cam kết dòng 1 (giao hàng): mô tả.', now(), now()),
    (gen_random_uuid(), 'product_commitment_2_title',
        'Đổi size miễn phí 30 ngày',
        'Free size exchange within 30 days',
        'public_product', true, 'Trang sản phẩm — cam kết dòng 2 (đổi trả): tiêu đề.', now(), now()),
    (gen_random_uuid(), 'product_commitment_2_subtitle',
        'Lỗi nhà sản xuất · Không vừa size',
        'Manufacturer defects · Wrong fit',
        'public_product', true, 'Trang sản phẩm — cam kết dòng 2 (đổi trả): mô tả.', now(), now()),
    (gen_random_uuid(), 'product_commitment_3_title',
        'Bảo hành 2 năm chính hãng',
        '2-year official warranty',
        'public_product', true, 'Trang sản phẩm — cam kết dòng 3 (bảo hành): tiêu đề.', now(), now()),
    (gen_random_uuid(), 'product_commitment_3_subtitle',
        'Tại BigBike.vn',
        'At BigBike.vn',
        'public_product', true, 'Trang sản phẩm — cam kết dòng 3 (bảo hành): mô tả.', now(), now())
on conflict (setting_key) do nothing;
