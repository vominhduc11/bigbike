-- V219: Hoàn thiện icon menu + banner hero cho danh mục theo hướng DATA-DRIVEN, áp dụng tự động
-- trên MỌI môi trường khi deploy (local + VPS) — không cần thao tác tay.
--
-- Bối cảnh:
--  • V217 backfill menu_icon_url theo SLUG, nhưng nhiều slug đã đổi sau đó (vd
--    'giay-bao-ho-moto-phuot' → 'giay-bao-ho') nên không khớp → các mục đó còn NULL,
--    admin/web mất icon. Migration này khoá theo ID danh mục (wp-cat-NNN — ổn định từ WP
--    import, không đổi như slug) nên áp dụng đúng bất kể slug đã drift.
--  • Icon line + banner đều là FILE TĨNH trong repo web (bigbike-web/public/wp/*), web phục vụ
--    trực tiếp; admin proxy /wp/ → bigbike-web để xem được (xem bigbike-admin/nginx.conf).
--  • Banner hero trước đây là ảnh hardcode DEFAULT_BG (page-title-bg.png) trong WpCategoryHero.tsx;
--    nay đưa vào DB (banner_url) để ô "Ảnh banner hero" trong admin hiển thị + sửa được, web y nguyên.
--
-- Guard chỉ ghi đè giá trị NULL hoặc giá-trị-mặc-định-cũ (/wp/* hoặc /media/uploads/wp-icons|wp-banners/*)
-- → KHÔNG đè icon/banner mà admin tự đặt (URL khác). Idempotent — chạy lại nhiều lần vẫn an toàn.

-- 1) Icon line đơn sắc cho menu header + sidebar bộ lọc "Danh mục sản phẩm" (map ID → /wp/icon-N).
update categories
set    menu_icon_url = case id
           when 'wp-cat-287' then '/wp/icon-1.png'          -- Khuyến mãi hot (ngọn lửa)
           when 'wp-cat-289' then '/wp/icon-2.svg'           -- Mũ bảo hiểm
           when 'wp-cat-290' then '/wp/icon-3.svg'           -- Quần áo bảo hộ
           when 'wp-cat-291' then '/wp/icon-4.svg'           -- Găng tay
           when 'wp-cat-292' then '/wp/icon-5.svg'           -- Giày bảo hộ
           when 'wp-cat-293' then '/wp/icon-6.svg'           -- Giáp bảo hộ tay chân
           when 'wp-cat-294' then '/wp/icon-7.svg'           -- Balô - túi đeo - túi treo xe
           when 'wp-cat-295' then '/wp/icon-8.svg'           -- Tai nghe bluetooth
           when 'wp-cat-296' then '/wp/icon-10.svg'          -- Vệ sinh đồ bảo hộ
           when 'wp-cat-297' then '/wp/icon-9.svg'           -- Phụ kiện đi mưa
           when 'wp-cat-298' then '/wp/icon-10.svg'          -- Pinlock / kính chống sương
           when 'wp-cat-299' then '/wp/icon-10.svg'          -- Phụ kiện khác
           when 'wp-cat-305' then '/wp/abdominals.png'       -- Phụ kiện đồ lót (icon riêng)
       end,
       updated_at = now()
where  id in ('wp-cat-287','wp-cat-289','wp-cat-290','wp-cat-291','wp-cat-292','wp-cat-293',
              'wp-cat-294','wp-cat-295','wp-cat-296','wp-cat-297','wp-cat-298','wp-cat-299','wp-cat-305')
  and  (menu_icon_url is null
        or menu_icon_url like '/wp/%'
        or menu_icon_url like '/media/uploads/wp-icons/%');

-- 2) Banner hero dùng chung (ảnh mặc định page-title-bg.png) → đưa vào DB cho mọi danh mục, để ô
--    "Ảnh banner hero" trong admin hiển thị/sửa được. Web nhìn y nguyên (cùng file tĩnh).
update categories
set    banner_url = '/wp/page-title-bg.png',
       updated_at = now()
where  banner_url is null
   or  banner_url like '/media/uploads/wp-banners/%'
   or  banner_url = '/wp/page-title-bg.png';

-- 3) Ảnh minh hoạ hero (icon_url, ACF "image_left"): đổi URL ngoài bigbike.vn → đường dẫn nội bộ
--    /media-proxy/wp-uploads (ảnh đã có trong MinIO từ WP import) để admin xem/sửa + không phụ thuộc
--    production. Idempotent — no-op nếu đã đổi.
update categories
set    icon_url = replace(icon_url, 'https://bigbike.vn/wp-content/uploads/', '/media-proxy/wp-uploads/'),
       updated_at = now()
where  icon_url like 'https://bigbike.vn/wp-content/uploads/%';
