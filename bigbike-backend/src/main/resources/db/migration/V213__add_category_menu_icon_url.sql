-- V213: Thêm cột riêng cho icon line đơn sắc của danh mục, dùng cho menu header và bộ lọc
-- "Danh mục sản phẩm" ở trang archive. Trước đây icon này được gắn theo class slug trong CSS
-- theme WP (.{slug}>a::before) và map slug cứng ở backend (CATEGORY_SLUG_ICON_MAP) — phụ thuộc
-- tên slug nên khi slug bị đổi lúc import thì icon biến mất. Chuyển sang lưu theo danh mục trong
-- DB (khoá theo id, không theo slug) để cả menu lẫn sidebar dùng chung một nguồn.
--
-- KHÔNG dùng lại cột icon_url: cột đó đang là ảnh minh hoạ hero của trang danh mục (WP ACF
-- "image_left"), khác vai trò với icon line này.
--
-- Backfill giữ đúng ánh xạ icon gốc của WP (dist/home.css: .{slug}>a::before mask-image icon-N.svg),
-- map theo slug HIỆN TẠI trong DB. Danh mục mới "Giá đỡ điện thoại - phụ kiện camera" (WP chưa có)
-- tạm dùng icon-9 (phụ kiện) — đổi sau nếu cần.

alter table categories add column if not exists menu_icon_url text;

-- Guard "coalesce(...,'') = ''" để không đè giá trị đã có (idempotent, không phá admin set sau này).
update categories
set    menu_icon_url = case slug
           when 'san-pham-khuyen-mai'                            then '/wp/icon-10.svg'
           when 'non-bao-hiem-moto'                              then '/wp/icon-2.svg'
           when 'quan-ao-bao-ho-moto-phuot'                      then '/wp/icon-3.svg'
           when 'gang-tay'                                       then '/wp/icon-4.svg'
           when 'giay-bao-ho-moto-phuot'                         then '/wp/icon-5.svg'
           when 'giap-bao-ho-tay-chan-dai-lung-phu-kien-giap'    then '/wp/icon-6.svg'
           when 'balo-tui-deo-tui-treo-xe'                       then '/wp/icon-7.svg'
           when 'tai-nghe-bluetooth-gan-mu-bao-hiem'             then '/wp/icon-8.svg'
           when 'gia-do-dien-thoai-phu-kien-camera'              then '/wp/icon-9.svg'
           when 'phu-kien-khac-do-lot-do-mua'                    then '/wp/icon-10.svg'
       end,
       updated_at = now()
where  slug in (
           'san-pham-khuyen-mai',
           'non-bao-hiem-moto',
           'quan-ao-bao-ho-moto-phuot',
           'gang-tay',
           'giay-bao-ho-moto-phuot',
           'giap-bao-ho-tay-chan-dai-lung-phu-kien-giap',
           'balo-tui-deo-tui-treo-xe',
           'tai-nghe-bluetooth-gan-mu-bao-hiem',
           'gia-do-dien-thoai-phu-kien-camera',
           'phu-kien-khac-do-lot-do-mua'
       )
  and  coalesce(menu_icon_url, '') = '';
