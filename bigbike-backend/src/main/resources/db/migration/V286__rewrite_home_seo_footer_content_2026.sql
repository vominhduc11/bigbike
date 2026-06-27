-- V286: Cải biên nội dung 2026 ("Bạn đồng hành phượt") cho các mục site_settings
-- hiển thị công khai — SEO trang chủ + chữ footer + link mạng xã hội. Song ngữ:
-- setting_value (VI) + setting_value_en (EN). Đây là REWRITE có chủ đích nên GHI ĐÈ
-- giá trị cũ (khác V202 chỉ vá khi EN còn trống). Dùng INSERT ... ON CONFLICT DO UPDATE
-- để chạy được dù hàng đã tồn tại hay chưa (rebuild/VPS đồng bộ).

-- ── SEO trang chủ (seo) ──
insert into site_settings (id, setting_key, setting_value, setting_value_en, setting_group, is_public, description, created_at, updated_at)
values (gen_random_uuid(), 'seo_home_title',
        'Shop Bảo Hộ Mô Tô Chính Hãng Tại TP.HCM | Bigbike.vn',
        'Authorized Motorcycle Gear Shop in Ho Chi Minh City | Bigbike.vn',
        'seo', true, 'Homepage SEO title.', now(), now())
on conflict (setting_key) do update
set setting_value = excluded.setting_value, setting_value_en = excluded.setting_value_en,
    setting_group = excluded.setting_group, is_public = excluded.is_public, updated_at = now();

insert into site_settings (id, setting_key, setting_value, setting_value_en, setting_group, is_public, description, created_at, updated_at)
values (gen_random_uuid(), 'seo_home_description',
        'Bigbike.vn — shop bảo hộ mô tô chính hãng tại TP.HCM từ 2014. Phân phối AGV, LS2, Komine, Taichi, Scoyco. Tư vấn thật, giá tốt, bảo hành đầy đủ. Ghé 79/30/52 Âu Cơ hoặc Zalo 0764 640 679.',
        'Bigbike.vn — authorized motorcycle gear in Ho Chi Minh City since 2014. Stocking AGV, LS2, Komine, Taichi, Scoyco. Honest advice, fair prices, full warranty. Visit 79/30/52 Âu Cơ or Zalo 0764 640 679.',
        'seo', true, 'Homepage SEO description.', now(), now())
on conflict (setting_key) do update
set setting_value = excluded.setting_value, setting_value_en = excluded.setting_value_en,
    setting_group = excluded.setting_group, is_public = excluded.is_public, updated_at = now();

insert into site_settings (id, setting_key, setting_value, setting_value_en, setting_group, is_public, description, created_at, updated_at)
values (gen_random_uuid(), 'home_content_bottom_html',
        '<h2><strong>Shop bảo hộ mô tô chính hãng tại TP. Hồ Chí Minh</strong></h2><p>Shop bảo hộ mô tô Bigbike — địa chỉ quen thuộc của cộng đồng biker Sài Gòn từ năm 2014. Hơn 11 năm hoạt động, shop không nằm ở mặt tiền hào nhoáng — nhưng đó chính là lý do anh em được tư vấn kỹ hơn và giá tốt hơn.</p><p>Bigbike phân phối chính hãng đồ bảo hộ từ các thương hiệu: AGV, LS2, Caberg, HJC (mũ bảo hiểm) — Komine, Taichi, Scoyco, ILM (áo giáp, găng tay, giày). Đầy đủ danh mục: mũ fullface, mũ lật hàm, áo giáp touring, găng tay, giày bảo hộ, balo phượt, tai nghe Bluetooth và phụ kiện mô tô.</p><p>Mọi sản phẩm đều có tem nhãn chính hãng kiểm tra được. Nhân viên tư vấn thật — kể cả nhược điểm — để anh mua đúng ngay lần đầu.</p><p>Ghé shop tại 79/30/52 Âu Cơ, Phường Hòa Bình, TP. HCM (T2–T7: 9:00–21:00 | CN: 9:00–18:00). Hoặc nhắn Zalo 0764 640 679 (Mrs. Thư) để được tư vấn trước khi đến.</p>',
        '<h2><strong>Authorized motorcycle protective gear shop in Ho Chi Minh City</strong></h2><p>Bigbike — Ho Chi Minh City''s trusted motorcycle protective gear shop since 2014. For over 11 years, the shop has operated out of a private alley rather than a prime shopfront — and that''s exactly why customers get better advice and better prices.</p><p>Bigbike is an authorized retailer of: AGV, LS2, Caberg, HJC (helmets) — Komine, Taichi, Scoyco, ILM (jackets, gloves, boots). Full range available: full-face helmets, flip-up helmets, touring jackets, gloves, protective boots, riding backpacks, Bluetooth intercoms and motorcycle accessories.</p><p>Every product carries verifiable manufacturer authentication. Staff advise honestly — including product limitations — so you get it right on the first purchase.</p><p>Visit the store at 79/30/52 Âu Cơ, Hòa Bình Ward, Ho Chi Minh City (Mon–Sat: 9:00 AM–9:00 PM | Sun: 9:00 AM–6:00 PM). Or message Zalo 0764 640 679 (Mrs. Thư) for advice before you visit.</p>',
        'seo', true, 'Homepage bottom SEO content block HTML.', now(), now())
on conflict (setting_key) do update
set setting_value = excluded.setting_value, setting_value_en = excluded.setting_value_en,
    setting_group = excluded.setting_group, is_public = excluded.is_public, updated_at = now();

-- ── Footer (general) ──
insert into site_settings (id, setting_key, setting_value, setting_value_en, setting_group, is_public, description, created_at, updated_at)
values (gen_random_uuid(), 'footer_tagline',
        'BIGBIKE MONG ĐƯỢC LẮNG NGHE VÀ THẤU HIỂU BẠN HƠN',
        'BIGBIKE WANTS TO LISTEN AND UNDERSTAND YOU BETTER',
        'general', true, 'Footer tagline heading.', now(), now())
on conflict (setting_key) do update
set setting_value = excluded.setting_value, setting_value_en = excluded.setting_value_en,
    setting_group = excluded.setting_group, is_public = excluded.is_public, updated_at = now();

insert into site_settings (id, setting_key, setting_value, setting_value_en, setting_group, is_public, description, created_at, updated_at)
values (gen_random_uuid(), 'footer_description',
        'Shop Bảo Hộ Bigbike.vn hoạt động từ 2014 tại 79/30/52 Âu Cơ, Phường Hòa Bình, TP. Hồ Chí Minh. Chuyên phân phối chính hãng mũ bảo hiểm, áo giáp, găng tay, giày bảo hộ và phụ kiện mô tô từ AGV, LS2, Komine, Taichi, Scoyco, Caberg, HJC, ILM — phục vụ cộng đồng biker TP.HCM và giao hàng toàn quốc.',
        'Bigbike.vn Protective Gear Shop has been operating since 2014 at 79/30/52 Âu Cơ, Hòa Bình Ward, Ho Chi Minh City. Authorized retailer of helmets, jackets, gloves, boots and motorcycle accessories from AGV, LS2, Komine, Taichi, Scoyco, Caberg, HJC, ILM — serving the Ho Chi Minh City biker community with nationwide delivery.',
        'general', true, 'Footer descriptive paragraph.', now(), now())
on conflict (setting_key) do update
set setting_value = excluded.setting_value, setting_value_en = excluded.setting_value_en,
    setting_group = excluded.setting_group, is_public = excluded.is_public, updated_at = now();

-- ── Mạng xã hội footer (contact) — handle chính thức theo nội dung 2026 ──
insert into site_settings (id, setting_key, setting_value, setting_group, is_public, description, created_at, updated_at)
values (gen_random_uuid(), 'youtube_url', 'https://www.youtube.com/@bigbike-shop', 'contact', true, 'URL kênh YouTube.', now(), now())
on conflict (setting_key) do update
set setting_value = excluded.setting_value, setting_group = excluded.setting_group, is_public = excluded.is_public, updated_at = now();

insert into site_settings (id, setting_key, setting_value, setting_group, is_public, description, created_at, updated_at)
values (gen_random_uuid(), 'tiktok_url', 'https://www.tiktok.com/@bigbike.vn', 'contact', true, 'URL profile TikTok.', now(), now())
on conflict (setting_key) do update
set setting_value = excluded.setting_value, setting_group = excluded.setting_group, is_public = excluded.is_public, updated_at = now();

-- shopee_url: khóa MỚI (đăng ký ở SettingDefinitionRegistry cùng PR).
insert into site_settings (id, setting_key, setting_value, setting_group, is_public, description, created_at, updated_at)
values (gen_random_uuid(), 'shopee_url', 'https://shopee.vn/shopbaohobigbike', 'contact', true, 'URL gian hàng Shopee.', now(), now())
on conflict (setting_key) do update
set setting_value = excluded.setting_value, setting_group = excluded.setting_group, is_public = excluded.is_public, updated_at = now();
