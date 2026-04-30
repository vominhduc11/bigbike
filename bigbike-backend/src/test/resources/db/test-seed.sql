-- Test seed data — H2-compatible, idempotent (SELECT WHERE NOT EXISTS)
-- Mirrors the minimal subset needed by Phase1BSchemaTest and SliderRepositoryTest.

-- ── Site settings ──────────────────────────────────────────────────────────
INSERT INTO site_settings (id, setting_key, setting_value, setting_group, is_public, description, created_at, updated_at)
SELECT '00000000-0000-0000-0000-000000000101', 'site.name', '"BigBike"', 'general', true, 'Site name', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM site_settings WHERE setting_key = 'site.name');

INSERT INTO site_settings (id, setting_key, setting_value, setting_group, is_public, description, created_at, updated_at)
SELECT '00000000-0000-0000-0000-000000000102', 'site.url', '"http://localhost:3000"', 'general', true, 'Public base URL', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM site_settings WHERE setting_key = 'site.url');

INSERT INTO site_settings (id, setting_key, setting_value, setting_group, is_public, description, created_at, updated_at)
SELECT '00000000-0000-0000-0000-000000000103', 'site.currency', '"VND"', 'commerce', true, 'Currency', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM site_settings WHERE setting_key = 'site.currency');

INSERT INTO site_settings (id, setting_key, setting_value, setting_group, is_public, description, created_at, updated_at)
SELECT '00000000-0000-0000-0000-000000000104', 'site.contact_email', '"info@bigbike.vn"', 'general', true, 'Contact email', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM site_settings WHERE setting_key = 'site.contact_email');

INSERT INTO site_settings (id, setting_key, setting_value, setting_group, is_public, description, created_at, updated_at)
SELECT '00000000-0000-0000-0000-000000000105', 'facebook_url', 'https://www.facebook.com/bigbikegear', 'contact', true, 'Facebook URL', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM site_settings WHERE setting_key = 'facebook_url');

INSERT INTO site_settings (id, setting_key, setting_value, setting_group, is_public, description, created_at, updated_at)
SELECT '00000000-0000-0000-0000-000000000106', 'zalo_url', 'https://zalo.me/bigbikegear', 'contact', true, 'Zalo URL', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM site_settings WHERE setting_key = 'zalo_url');

INSERT INTO site_settings (id, setting_key, setting_value, setting_group, is_public, description, created_at, updated_at)
SELECT '00000000-0000-0000-0000-000000000107', 'footer_tagline', 'BIGBIKE MONG DUOC LANG NGHE', 'general', true, 'Footer tagline', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM site_settings WHERE setting_key = 'footer_tagline');

-- ── Menus ──────────────────────────────────────────────────────────────────
INSERT INTO menus (id, location, name, status, created_at, updated_at)
SELECT '00000000-0000-0000-0000-000000000201', 'primary', 'Primary Navigation', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM menus WHERE location = 'primary');

INSERT INTO menus (id, location, name, status, created_at, updated_at)
SELECT '00000000-0000-0000-0000-000000000202', 'footer', 'Footer Navigation', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM menus WHERE location = 'footer');

INSERT INTO menus (id, location, name, status, created_at, updated_at)
SELECT '00000000-0000-0000-0000-000000000203', 'guide', 'Buying Guide Menu', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM menus WHERE location = 'guide');

-- ── Shipping zone ──────────────────────────────────────────────────────────
INSERT INTO shipping_zones (id, legacy_id, name, region_code, sort_order, enabled, created_at, updated_at)
SELECT '00000000-0000-0000-0000-000000000301', 1, 'Vietnam', 'VN', 0, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM shipping_zones WHERE id = '00000000-0000-0000-0000-000000000301');

-- ── Shipping methods ───────────────────────────────────────────────────────
INSERT INTO shipping_methods (id, zone_id, legacy_id, method_code, title, description, cost, min_order_amount, enabled, sort_order, created_at, updated_at)
SELECT '00000000-0000-0000-0000-000000000401', '00000000-0000-0000-0000-000000000301', 1, 'cod', 'Thanh toan khi nhan hang (COD)', 'Thanh toan tien mat.', 0, 0, true, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM shipping_methods WHERE id = '00000000-0000-0000-0000-000000000401');

INSERT INTO shipping_methods (id, zone_id, legacy_id, method_code, title, description, cost, min_order_amount, enabled, sort_order, created_at, updated_at)
SELECT '00000000-0000-0000-0000-000000000402', '00000000-0000-0000-0000-000000000301', 2, 'flat_rate', 'Phi van chuyen co dinh', 'Phi van chuyen 30000 VND.', 30000, 0, false, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM shipping_methods WHERE id = '00000000-0000-0000-0000-000000000402');

-- ── Home sliders (8 entries) ───────────────────────────────────────────────
INSERT INTO sliders (id, sort_order, location, is_active, desktop_image, mobile_image, product_id, external_link, created_at, updated_at)
SELECT 'slider_home_0', 0, 'home', true, '{"url":"https://cdn.bigbike.local/sliders/home-0-desktop.jpg","alt":"Slide 0","width":1920,"height":720}', '{"url":"https://cdn.bigbike.local/sliders/home-0-mobile.jpg","alt":"Slide 0","width":768,"height":960}', null, null, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM sliders WHERE id = 'slider_home_0');

INSERT INTO sliders (id, sort_order, location, is_active, desktop_image, mobile_image, product_id, external_link, created_at, updated_at)
SELECT 'slider_home_1', 1, 'home', true, '{"url":"https://cdn.bigbike.local/sliders/home-1-desktop.jpg","alt":"Slide 1","width":1920,"height":720}', '{"url":"https://cdn.bigbike.local/sliders/home-1-mobile.jpg","alt":"Slide 1","width":768,"height":960}', null, null, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM sliders WHERE id = 'slider_home_1');

INSERT INTO sliders (id, sort_order, location, is_active, desktop_image, mobile_image, product_id, external_link, created_at, updated_at)
SELECT 'slider_home_2', 2, 'home', true, '{"url":"https://cdn.bigbike.local/sliders/home-2-desktop.jpg","alt":"Slide 2","width":1920,"height":720}', null, null, null, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM sliders WHERE id = 'slider_home_2');

INSERT INTO sliders (id, sort_order, location, is_active, desktop_image, mobile_image, product_id, external_link, created_at, updated_at)
SELECT 'slider_home_3', 3, 'home', true, '{"url":"https://cdn.bigbike.local/sliders/home-3-desktop.jpg","alt":"Slide 3","width":1920,"height":720}', '{"url":"https://cdn.bigbike.local/sliders/home-3-mobile.jpg","alt":"Slide 3","width":768,"height":960}', null, null, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM sliders WHERE id = 'slider_home_3');

INSERT INTO sliders (id, sort_order, location, is_active, desktop_image, mobile_image, product_id, external_link, created_at, updated_at)
SELECT 'slider_home_4', 4, 'home', true, '{"url":"https://cdn.bigbike.local/sliders/home-4-desktop.jpg","alt":"Slide 4","width":1920,"height":720}', '{"url":"https://cdn.bigbike.local/sliders/home-4-mobile.jpg","alt":"Slide 4","width":768,"height":960}', null, null, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM sliders WHERE id = 'slider_home_4');

INSERT INTO sliders (id, sort_order, location, is_active, desktop_image, mobile_image, product_id, external_link, created_at, updated_at)
SELECT 'slider_home_5', 5, 'home', true, '{"url":"https://cdn.bigbike.local/sliders/home-5-desktop.jpg","alt":"Slide 5","width":1920,"height":720}', '{"url":"https://cdn.bigbike.local/sliders/home-5-mobile.jpg","alt":"Slide 5","width":768,"height":960}', null, null, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM sliders WHERE id = 'slider_home_5');

INSERT INTO sliders (id, sort_order, location, is_active, desktop_image, mobile_image, product_id, external_link, created_at, updated_at)
SELECT 'slider_home_6', 6, 'home', true, '{"url":"https://cdn.bigbike.local/sliders/home-6-desktop.jpg","alt":"Slide 6","width":1920,"height":720}', '{"url":"https://cdn.bigbike.local/sliders/home-6-mobile.jpg","alt":"Slide 6","width":768,"height":960}', null, null, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM sliders WHERE id = 'slider_home_6');

INSERT INTO sliders (id, sort_order, location, is_active, desktop_image, mobile_image, product_id, external_link, created_at, updated_at)
SELECT 'slider_home_7', 7, 'home', true, '{"url":"https://cdn.bigbike.local/sliders/home-7-desktop.jpg","alt":"Slide 7","width":1920,"height":720}', '{"url":"https://cdn.bigbike.local/sliders/home-7-mobile.jpg","alt":"Slide 7","width":768,"height":960}', null, 'https://bigbike.vn/tai-nghe-bluetooth.html', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM sliders WHERE id = 'slider_home_7');

-- ── Additional site settings (homepage public API) ─────────────────────────
INSERT INTO site_settings (id, setting_key, setting_value, setting_group, is_public, description, created_at, updated_at)
SELECT '00000000-0000-0000-0000-000000000108', 'hotline', '"1900 6835"', 'contact', true, 'Hotline', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM site_settings WHERE setting_key = 'hotline');

INSERT INTO site_settings (id, setting_key, setting_value, setting_group, is_public, description, created_at, updated_at)
SELECT '00000000-0000-0000-0000-000000000109', 'promo_title', '"Sieu sale thang 4"', 'promo', true, 'Promo title', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM site_settings WHERE setting_key = 'promo_title');

INSERT INTO site_settings (id, setting_key, setting_value, setting_group, is_public, description, created_at, updated_at)
SELECT '00000000-0000-0000-0000-000000000110', 'promo_off', '"Giam 30%"', 'promo', true, 'Promo off text', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM site_settings WHERE setting_key = 'promo_off');

INSERT INTO site_settings (id, setting_key, setting_value, setting_group, is_public, description, created_at, updated_at)
SELECT '00000000-0000-0000-0000-000000000111', 'promo_href', '"/sale"', 'promo', true, 'Promo link', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM site_settings WHERE setting_key = 'promo_href');

INSERT INTO site_settings (id, setting_key, setting_value, setting_group, is_public, description, created_at, updated_at)
SELECT '00000000-0000-0000-0000-000000000112', 'promo_image_url', '"https://cdn.bigbike.local/promo.jpg"', 'promo', true, 'Promo image', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM site_settings WHERE setting_key = 'promo_image_url');

INSERT INTO site_settings (id, setting_key, setting_value, setting_group, is_public, description, created_at, updated_at)
SELECT '00000000-0000-0000-0000-000000000113', 'seo_home_title', '"BigBike - Do bao ho xe may"', 'seo', true, 'Home SEO title', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM site_settings WHERE setting_key = 'seo_home_title');

INSERT INTO site_settings (id, setting_key, setting_value, setting_group, is_public, description, created_at, updated_at)
SELECT '00000000-0000-0000-0000-000000000114', 'seo_home_description', '"BigBike cung cap do bao ho xe may chinh hang"', 'seo', true, 'Home SEO description', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM site_settings WHERE setting_key = 'seo_home_description');

INSERT INTO site_settings (id, setting_key, setting_value, setting_group, is_public, description, created_at, updated_at)
SELECT '00000000-0000-0000-0000-000000000115', 'og_image_url', '"https://cdn.bigbike.local/og-image.jpg"', 'seo', true, 'OG image URL', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM site_settings WHERE setting_key = 'og_image_url');

-- ── Brands ────────────────────────────────────────────────────────────────────
INSERT INTO brands (id, slug, name, is_visible, created_at, updated_at)
SELECT 'brand_ls2', 'ls2', 'LS2 Helmets', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM brands WHERE id = 'brand_ls2');

-- ── Catalog categories ────────────────────────────────────────────────────────
INSERT INTO categories (id, slug, name, is_visible, show_on_homepage, sort_order, created_at, updated_at)
SELECT 'cat_helmet', 'mu-bao-hiem', 'Mu bao hiem', true, true, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE id = 'cat_helmet');

INSERT INTO categories (id, slug, name, is_visible, show_on_homepage, sort_order, created_at, updated_at)
SELECT 'cat_jacket', 'ao-giap-bao-ho', 'Ao giap bao ho', true, true, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE id = 'cat_jacket');

-- ── Products ──────────────────────────────────────────────────────────────────
INSERT INTO products (id, slug, name, category_id, brand_id, retail_price, currency, stock_state, publish_status, is_featured, rating, image_url, created_at, updated_at)
SELECT 'prod_ls2_ff800', 'mu-bao-hiem-ls2-ff800', 'LS2 FF800 Storm', 'cat_helmet', 'brand_ls2', 3290000, 'VND', 'IN_STOCK', 'PUBLISHED', true, 4.5, 'https://cdn.bigbike.local/products/ls2-ff800.jpg', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM products WHERE id = 'prod_ls2_ff800');

INSERT INTO products (id, slug, name, category_id, brand_id, retail_price, currency, stock_state, publish_status, is_featured, rating, created_at, updated_at)
SELECT 'prod_ls2_jacket_city', 'ao-giap-ls2-city-rider', 'Ao giap LS2 City Rider', 'cat_jacket', 'brand_ls2', 1890000, 'VND', 'IN_STOCK', 'PUBLISHED', false, 4.8, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM products WHERE id = 'prod_ls2_jacket_city');

-- ── Content categories ────────────────────────────────────────────────────────
INSERT INTO content_categories (id, slug, name)
SELECT 'cc_trai_nghiem', 'trai-nghiem', 'Trai nghiem'
WHERE NOT EXISTS (SELECT 1 FROM content_categories WHERE id = 'cc_trai_nghiem');

INSERT INTO content_categories (id, slug, name)
SELECT 'cc_blog', 'blog', 'Blog'
WHERE NOT EXISTS (SELECT 1 FROM content_categories WHERE id = 'cc_blog');

-- ── Articles (3 trai-nghiem + 3 blog + 1 specific for AdminReadApiTest) ───────
INSERT INTO articles (id, slug, title, body, category_id, publish_status, published_at, created_at, updated_at)
SELECT 'article_chon_mu_fullface', 'chon-mu-fullface-phu-hop', 'Chon mu bao hiem fullface phu hop', '<p>Huong dan chon mu.</p>', 'cc_trai_nghiem', 'PUBLISHED', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM articles WHERE id = 'article_chon_mu_fullface');

INSERT INTO articles (id, slug, title, body, category_id, publish_status, published_at, created_at, updated_at)
SELECT 'article_trai_nghiem_2', 'trai-nghiem-mu-bao-hiem-2', 'Trai nghiem mu bao hiem 2', '<p>Bai viet 2.</p>', 'cc_trai_nghiem', 'PUBLISHED', DATEADD(SECOND, -1, CURRENT_TIMESTAMP), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM articles WHERE id = 'article_trai_nghiem_2');

INSERT INTO articles (id, slug, title, body, category_id, publish_status, published_at, created_at, updated_at)
SELECT 'article_trai_nghiem_3', 'trai-nghiem-mu-bao-hiem-3', 'Trai nghiem mu bao hiem 3', '<p>Bai viet 3.</p>', 'cc_trai_nghiem', 'PUBLISHED', DATEADD(SECOND, -2, CURRENT_TIMESTAMP), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM articles WHERE id = 'article_trai_nghiem_3');

INSERT INTO articles (id, slug, title, body, category_id, publish_status, published_at, created_at, updated_at)
SELECT 'article_blog_1', 'blog-tin-tuc-xe-may-1', 'Blog tin tuc xe may 1', '<p>Blog 1.</p>', 'cc_blog', 'PUBLISHED', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM articles WHERE id = 'article_blog_1');

INSERT INTO articles (id, slug, title, body, category_id, publish_status, published_at, created_at, updated_at)
SELECT 'article_blog_2', 'blog-tin-tuc-xe-may-2', 'Blog tin tuc xe may 2', '<p>Blog 2.</p>', 'cc_blog', 'PUBLISHED', DATEADD(SECOND, -1, CURRENT_TIMESTAMP), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM articles WHERE id = 'article_blog_2');

INSERT INTO articles (id, slug, title, body, category_id, publish_status, published_at, created_at, updated_at)
SELECT 'article_blog_3', 'blog-tin-tuc-xe-may-3', 'Blog tin tuc xe may 3', '<p>Blog 3.</p>', 'cc_blog', 'PUBLISHED', DATEADD(SECOND, -2, CURRENT_TIMESTAMP), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM articles WHERE id = 'article_blog_3');
