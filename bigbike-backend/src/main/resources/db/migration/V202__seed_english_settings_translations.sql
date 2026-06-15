-- V202: Điền sẵn bản tiếng Anh (setting_value_en) cho các mục cài đặt NỘI DUNG hiển thị cho khách
-- đang trống tiếng Anh. Web đọc setting_value_en khi khách xem bằng tiếng Anh (pick theo lang);
-- trước đây để trống nên khách tiếng Anh thấy nguyên văn tiếng Việt.
--
-- Phạm vi: CHỈ các mục is_public = true và là text hiển thị (tiêu đề, mô tả, giờ mở cửa, footer,
-- SEO). KHÔNG đụng các mục kỹ thuật/cấu hình (số, true/false), URL/email/số điện thoại/handle mạng
-- xã hội, tên thương hiệu (giữ nguyên), và nhãn nội bộ admin (product_assign_* — admin khoá tiếng Việt).
--
-- Guard "coalesce(setting_value_en,'') = ''" để KHÔNG đè bản tiếng Anh ai đó đã tự nhập qua màn Cài đặt.

-- ── Liên hệ (contact) ──
update site_settings set setting_value_en = '79/30/52 Au Co, Ward 14, District 11, Ho Chi Minh City', updated_at = now()
where setting_key = 'contact_address' and coalesce(setting_value_en,'') = '';

update site_settings set setting_value_en = 'Mon - Fri: 09:00 - 21:00', updated_at = now()
where setting_key = 'opening_hours_weekday' and coalesce(setting_value_en,'') = '';

update site_settings set setting_value_en = 'Sat / Sun: 09:00 - 18:00', updated_at = now()
where setting_key = 'opening_hours_weekend' and coalesce(setting_value_en,'') = '';

update site_settings set setting_value_en = 'Holidays / Tet: Closed', updated_at = now()
where setting_key = 'opening_hours_holiday' and coalesce(setting_value_en,'') = '';

update site_settings set setting_value_en = '0764 640 679 - Mrs. Thu / Zalo', updated_at = now()
where setting_key = 'hotline_2' and coalesce(setting_value_en,'') = '';

-- ── Chung / Footer (general) ──
update site_settings set setting_value_en = 'Business Registration Certificate No.: 41K8017383 | Issued on March 8, 2016 | Issued by: People''s Committee of District 11', updated_at = now()
where setting_key = 'business_registration' and coalesce(setting_value_en,'') = '';

update site_settings set setting_value_en = 'Bigbike.vn specializes in motorcycle protective and touring gear: full-face helmets, modular (flip-up) helmets, 3/4 open-face helmets, motocross helmets, body armour and protective pants, gloves, backpacks, motorcycle bags and fashion accessories....', updated_at = now()
where setting_key = 'footer_description' and coalesce(setting_value_en,'') = '';

update site_settings set setting_value_en = 'BIGBIKE HOPES TO LISTEN AND UNDERSTAND YOU BETTER', updated_at = now()
where setting_key = 'footer_tagline' and coalesce(setting_value_en,'') = '';

-- ── Hero các trang listing (public_hero) ──
update site_settings set setting_value_en = 'Brands', updated_at = now()
where setting_key = 'hero_brands_title' and coalesce(setting_value_en,'') = '';

update site_settings set setting_value_en = 'News', updated_at = now()
where setting_key = 'hero_news_title' and coalesce(setting_value_en,'') = '';

update site_settings set setting_value_en = 'All Products', updated_at = now()
where setting_key = 'hero_products_title' and coalesce(setting_value_en,'') = '';

-- ── Trang chủ (public_home) ──
update site_settings set setting_value_en = 'FEATURED PRODUCTS', updated_at = now()
where setting_key = 'home_featured_kicker' and coalesce(setting_value_en,'') = '';

update site_settings set setting_value_en = 'FEATURED PRODUCTS AT BIGBIKE', updated_at = now()
where setting_key = 'home_featured_title' and coalesce(setting_value_en,'') = '';

update site_settings set setting_value_en = 'LATEST NEWS', updated_at = now()
where setting_key = 'home_news_kicker' and coalesce(setting_value_en,'') = '';

update site_settings set setting_value_en = 'STAY UPDATED WITH BIGBIKE', updated_at = now()
where setting_key = 'home_news_title' and coalesce(setting_value_en,'') = '';

update site_settings set setting_value_en = 'EXPERIENCE OUR PRODUCTS WITH BIGBIKE.VN', updated_at = now()
where setting_key = 'home_videos_title' and coalesce(setting_value_en,'') = '';

-- ── SEO trang chủ (seo) ──
update site_settings set setting_value_en = 'Motorcycle Protective & Touring Gear Shop - Premium Riding Accessories', updated_at = now()
where setting_key = 'seo_home_title' and coalesce(setting_value_en,'') = '';

update site_settings set setting_value_en = 'Bigbike is a trusted motorcycle touring and protective gear shop in Ho Chi Minh City, providing genuine, high-quality protective gear and riding accessories.', updated_at = now()
where setting_key = 'seo_home_description' and coalesce(setting_value_en,'') = '';
