-- Đưa các chuỗi trước đây hardcode trong bigbike-web (i18n/theme) vào site_settings để
-- admin sửa được: dòng đăng ký kinh doanh ở footer, giờ mở cửa, và tiêu đề các khu trang chủ
-- (Sản phẩm nổi bật / Tin tức / Video). Giá trị seed = đúng nội dung đang hiển thị.
-- valueType/public do SettingDefinitionRegistry cung cấp; bảng chỉ giữ value/group/is_public.

insert into site_settings (id, setting_key, setting_value, setting_group, is_public, description, created_at, updated_at)
values
    (gen_random_uuid(), 'business_registration',
        'Giấy chứng nhận đăng ký kinh doanh số: 41K8017383 | Ngày cấp 8 tháng 3 năm 2016 | Nơi cấp: Ủy Ban Nhân Dân Quận 11',
        'general', true, 'Dòng giấy chứng nhận đăng ký kinh doanh hiển thị ở footer.', now(), now()),

    (gen_random_uuid(), 'opening_hours_weekday', 'T2 - T6: 09h00 - 21h00', 'contact', true,
        'Giờ mở cửa thứ 2–thứ 6.', now(), now()),
    (gen_random_uuid(), 'opening_hours_weekend', 'T7 / CN: 09h00 - 18h00', 'contact', true,
        'Giờ mở cửa thứ 7 / Chủ nhật.', now(), now()),
    (gen_random_uuid(), 'opening_hours_holiday', 'Lễ / Tết: nghỉ', 'contact', true,
        'Lịch nghỉ lễ / Tết.', now(), now()),

    (gen_random_uuid(), 'home_featured_kicker', 'SẢN PHẨM NỔI BẬT', 'public_home', true,
        'Kicker khu Sản phẩm nổi bật trên trang chủ.', now(), now()),
    (gen_random_uuid(), 'home_featured_title', 'SẢN PHẨM NỔI BẬT TẠI BIGBIKE', 'public_home', true,
        'Tiêu đề khu Sản phẩm nổi bật trên trang chủ.', now(), now()),
    (gen_random_uuid(), 'home_news_kicker', 'TIN TỨC MỚI UPDATE', 'public_home', true,
        'Kicker khu Tin tức trên trang chủ.', now(), now()),
    (gen_random_uuid(), 'home_news_title', 'CẬP NHẬT XU HƯỚNG CÙNG BIGBIKE', 'public_home', true,
        'Tiêu đề khu Tin tức trên trang chủ.', now(), now()),
    (gen_random_uuid(), 'home_videos_title', 'TRẢI NGHIỆM SẢN PHẨM CÙNG BIGBIKE.VN', 'public_home', true,
        'Tiêu đề khu Video trải nghiệm trên trang chủ.', now(), now())
on conflict (setting_key) do nothing;
