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

-- Shipping zones/methods removed (owner decision 2026-06-23) — see V264 (tables dropped).

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

-- Nhóm setting `seo` (SEO trang chủ) gỡ hẳn V337 — không seed nữa.

-- ── Brands ────────────────────────────────────────────────────────────────────
INSERT INTO brands (id, slug, name, is_visible, show_on_homepage, created_at, updated_at)
SELECT 'brand_ls2', 'ls2', 'LS2 Helmets', true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM brands WHERE id = 'brand_ls2');

INSERT INTO brands (id, slug, name, is_visible, show_on_homepage, created_at, updated_at)
SELECT 'brand_kyt', 'kyt', 'KYT Helmets', true, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM brands WHERE id = 'brand_kyt');

-- ── Catalog categories ────────────────────────────────────────────────────────
INSERT INTO categories (id, slug, name, is_visible, show_on_homepage, sort_order, created_at, updated_at)
SELECT 'cat_helmet', 'mu-bao-hiem', 'Mu bao hiem', true, true, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE id = 'cat_helmet');

INSERT INTO categories (id, slug, name, is_visible, show_on_homepage, sort_order, created_at, updated_at)
SELECT 'cat_jacket', 'ao-giap-bao-ho', 'Ao giap bao ho', true, true, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE id = 'cat_jacket');

-- Mirrors V292/V304 (real migrations don't run in tests — spring.flyway.enabled=false, schema
-- comes from Hibernate ddl-auto=create-drop instead). id = slug on both, matching the real seed,
-- since ProductImportService/CatalogRequestValidator look these literals up by id and by slug.
INSERT INTO categories (id, slug, name, is_visible, show_on_homepage, sort_order, created_at, updated_at)
SELECT 'uncategorized', 'uncategorized', 'Chua phan loai', false, false, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE id = 'uncategorized');

INSERT INTO brands (id, slug, name, is_visible, show_on_homepage, created_at, updated_at)
SELECT 'uncategorized-brand', 'uncategorized-brand', 'Chua phan loai', false, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM brands WHERE id = 'uncategorized-brand');

-- ── Products ──────────────────────────────────────────────────────────────────
INSERT INTO products (id, slug, name, brand_id, retail_price, currency, stock_state, publish_status, homepage_block, rating, image_url, version, created_at, updated_at)
SELECT 'prod_ls2_ff800', 'mu-bao-hiem-ls2-ff800', 'LS2 FF800 Storm', 'brand_ls2', 3290000, 'VND', 'IN_STOCK', 'PUBLISHED', 'FEATURED_GRID', 4.5, 'https://cdn.bigbike.local/products/ls2-ff800.jpg', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM products WHERE id = 'prod_ls2_ff800');

INSERT INTO products (id, slug, name, brand_id, retail_price, currency, stock_state, publish_status, homepage_block, rating, version, created_at, updated_at)
SELECT 'prod_ls2_jacket_city', 'ao-giap-ls2-city-rider', 'Ao giap LS2 City Rider', 'brand_ls2', 1890000, 'VND', 'IN_STOCK', 'PUBLISHED', 'NONE', 4.8, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM products WHERE id = 'prod_ls2_jacket_city');

INSERT INTO product_category_map (product_id, category_id, sort_order)
SELECT 'prod_ls2_ff800', 'cat_helmet', 0
WHERE NOT EXISTS (
    SELECT 1 FROM product_category_map
    WHERE product_id = 'prod_ls2_ff800' AND category_id = 'cat_helmet'
);

INSERT INTO product_category_map (product_id, category_id, sort_order)
SELECT 'prod_ls2_jacket_city', 'cat_jacket', 0
WHERE NOT EXISTS (
    SELECT 1 FROM product_category_map
    WHERE product_id = 'prod_ls2_jacket_city' AND category_id = 'cat_jacket'
);

-- ── Content categories ────────────────────────────────────────────────────────
INSERT INTO content_categories (id, slug, name)
SELECT 'cc_trai_nghiem', 'trai-nghiem', 'Trai nghiem'
WHERE NOT EXISTS (SELECT 1 FROM content_categories WHERE id = 'cc_trai_nghiem');

INSERT INTO content_categories (id, slug, name)
SELECT 'cc_blog', 'blog', 'Blog'
WHERE NOT EXISTS (SELECT 1 FROM content_categories WHERE id = 'cc_blog');

-- ── Articles (3 trai-nghiem + 3 blog + 1 specific for AdminReadApiTest) ───────
INSERT INTO articles (id, slug, title, body, category_id, publish_status, published_at, created_at, updated_at, featured, seo_no_index, home_experience)
SELECT 'article_chon_mu_fullface', 'chon-mu-fullface-phu-hop', 'Chon mu bao hiem fullface phu hop', '<p>Huong dan chon mu.</p>', 'cc_trai_nghiem', 'PUBLISHED', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, false, false, false
WHERE NOT EXISTS (SELECT 1 FROM articles WHERE id = 'article_chon_mu_fullface');

INSERT INTO articles (id, slug, title, body, category_id, publish_status, published_at, created_at, updated_at, featured, seo_no_index, home_experience)
SELECT 'article_trai_nghiem_2', 'trai-nghiem-mu-bao-hiem-2', 'Trai nghiem mu bao hiem 2', '<p>Bai viet 2.</p>', 'cc_trai_nghiem', 'PUBLISHED', DATEADD(SECOND, -1, CURRENT_TIMESTAMP), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, false, false, false
WHERE NOT EXISTS (SELECT 1 FROM articles WHERE id = 'article_trai_nghiem_2');

INSERT INTO articles (id, slug, title, body, category_id, publish_status, published_at, created_at, updated_at, featured, seo_no_index, home_experience)
SELECT 'article_trai_nghiem_3', 'trai-nghiem-mu-bao-hiem-3', 'Trai nghiem mu bao hiem 3', '<p>Bai viet 3.</p>', 'cc_trai_nghiem', 'PUBLISHED', DATEADD(SECOND, -2, CURRENT_TIMESTAMP), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, false, false, false
WHERE NOT EXISTS (SELECT 1 FROM articles WHERE id = 'article_trai_nghiem_3');

INSERT INTO articles (id, slug, title, body, category_id, publish_status, published_at, created_at, updated_at, featured, seo_no_index, home_experience)
SELECT 'article_blog_1', 'blog-tin-tuc-xe-may-1', 'Blog tin tuc xe may 1', '<p>Blog 1.</p>', 'cc_blog', 'PUBLISHED', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, false, false, false
WHERE NOT EXISTS (SELECT 1 FROM articles WHERE id = 'article_blog_1');

INSERT INTO articles (id, slug, title, body, category_id, publish_status, published_at, created_at, updated_at, featured, seo_no_index, home_experience)
SELECT 'article_blog_2', 'blog-tin-tuc-xe-may-2', 'Blog tin tuc xe may 2', '<p>Blog 2.</p>', 'cc_blog', 'PUBLISHED', DATEADD(SECOND, -1, CURRENT_TIMESTAMP), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, false, false, false
WHERE NOT EXISTS (SELECT 1 FROM articles WHERE id = 'article_blog_2');

INSERT INTO articles (id, slug, title, body, category_id, publish_status, published_at, created_at, updated_at, featured, seo_no_index, home_experience)
SELECT 'article_blog_3', 'blog-tin-tuc-xe-may-3', 'Blog tin tuc xe may 3', '<p>Blog 3.</p>', 'cc_blog', 'PUBLISHED', DATEADD(SECOND, -2, CURRENT_TIMESTAMP), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, false, false, false
WHERE NOT EXISTS (SELECT 1 FROM articles WHERE id = 'article_blog_3');

INSERT INTO articles (id, slug, title, body, category_id, publish_status, created_at, updated_at, featured, seo_no_index, home_experience)
SELECT 'article_draft_1', 'bai-viet-nhap-1', 'Bai viet nhap 1', '<p>Draft.</p>', 'cc_blog', 'DRAFT', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, false, false, false
WHERE NOT EXISTS (SELECT 1 FROM articles WHERE id = 'article_draft_1');



CREATE SEQUENCE IF NOT EXISTS return_number_seq START WITH 1000 INCREMENT BY 1;

-- ── System roles + permissions (mirrors Flyway V49/V58/V78/V79) ──────────────
-- Flyway is disabled in H2 test env; seed the role catalog so DB-backed
-- AdminPermissionService.getPermissionsForRole() returns non-empty for built-in roles.
-- Only SUPER_ADMIN and ADMIN are system roles; the remaining records are
-- custom-role fixtures used by authorization tests.

INSERT INTO admin_roles (id, name, description, is_system, created_at, updated_at)
SELECT 'SUPER_ADMIN', 'Super Admin', 'Full system access', TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM admin_roles WHERE id = 'SUPER_ADMIN');

INSERT INTO admin_roles (id, name, description, is_system, created_at, updated_at)
SELECT 'ADMIN', 'Admin', 'Full business operations', TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM admin_roles WHERE id = 'ADMIN');

INSERT INTO admin_roles (id, name, description, is_system, created_at, updated_at)
SELECT 'SHOP_MANAGER', 'Shop Manager', 'Orders, catalog, customers', FALSE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM admin_roles WHERE id = 'SHOP_MANAGER');

INSERT INTO admin_roles (id, name, description, is_system, created_at, updated_at)
SELECT 'EDITOR', 'Editor', 'Content and catalog editor', FALSE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM admin_roles WHERE id = 'EDITOR');

-- AUTHOR / CONTRIBUTOR / SEO_EDITOR are no longer production built-in roles
-- (removed by V211__reduce_default_roles.sql). They are kept here purely as
-- test fixtures for DB-driven RBAC tests (AdminRedirectApiTest uses SEO_EDITOR;
-- Phase1KInventoryP0FixApiTest uses CONTRIBUTOR as a minimal-permission principal).
INSERT INTO admin_roles (id, name, description, is_system, created_at, updated_at)
SELECT 'AUTHOR', 'Author', 'Content author', FALSE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM admin_roles WHERE id = 'AUTHOR');

INSERT INTO admin_roles (id, name, description, is_system, created_at, updated_at)
SELECT 'CONTRIBUTOR', 'Contributor', 'Read-only content', FALSE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM admin_roles WHERE id = 'CONTRIBUTOR');

INSERT INTO admin_roles (id, name, description, is_system, created_at, updated_at)
SELECT 'SEO_EDITOR', 'SEO Editor', 'Content and redirects', FALSE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM admin_roles WHERE id = 'SEO_EDITOR');

UPDATE admin_roles
   SET is_system = FALSE,
       updated_at = CURRENT_TIMESTAMP
 WHERE is_system = TRUE
   AND id NOT IN ('SUPER_ADMIN', 'ADMIN');

-- SUPER_ADMIN wildcard
INSERT INTO role_permissions (role_id, permission)
SELECT 'SUPER_ADMIN', '*' WHERE NOT EXISTS (SELECT 1 FROM role_permissions WHERE role_id = 'SUPER_ADMIN' AND permission = '*');

-- ADMIN (matches AdminRolePermissions.MAP exactly, including pos/reports from V78)
INSERT INTO role_permissions (role_id, permission) SELECT 'ADMIN', 'products.read'               WHERE NOT EXISTS (SELECT 1 FROM role_permissions WHERE role_id='ADMIN' AND permission='products.read');
INSERT INTO role_permissions (role_id, permission) SELECT 'ADMIN', 'products.update'             WHERE NOT EXISTS (SELECT 1 FROM role_permissions WHERE role_id='ADMIN' AND permission='products.update');
INSERT INTO role_permissions (role_id, permission) SELECT 'ADMIN', 'catalog.read'                WHERE NOT EXISTS (SELECT 1 FROM role_permissions WHERE role_id='ADMIN' AND permission='catalog.read');
INSERT INTO role_permissions (role_id, permission) SELECT 'ADMIN', 'catalog.update'              WHERE NOT EXISTS (SELECT 1 FROM role_permissions WHERE role_id='ADMIN' AND permission='catalog.update');
INSERT INTO role_permissions (role_id, permission) SELECT 'ADMIN', 'content.read'                WHERE NOT EXISTS (SELECT 1 FROM role_permissions WHERE role_id='ADMIN' AND permission='content.read');
INSERT INTO role_permissions (role_id, permission) SELECT 'ADMIN', 'content.update'              WHERE NOT EXISTS (SELECT 1 FROM role_permissions WHERE role_id='ADMIN' AND permission='content.update');
INSERT INTO role_permissions (role_id, permission) SELECT 'ADMIN', 'orders.read'                 WHERE NOT EXISTS (SELECT 1 FROM role_permissions WHERE role_id='ADMIN' AND permission='orders.read');
INSERT INTO role_permissions (role_id, permission) SELECT 'ADMIN', 'orders.write'                WHERE NOT EXISTS (SELECT 1 FROM role_permissions WHERE role_id='ADMIN' AND permission='orders.write');
INSERT INTO role_permissions (role_id, permission) SELECT 'ADMIN', 'customers.read'              WHERE NOT EXISTS (SELECT 1 FROM role_permissions WHERE role_id='ADMIN' AND permission='customers.read');
INSERT INTO role_permissions (role_id, permission) SELECT 'ADMIN', 'customers.write'             WHERE NOT EXISTS (SELECT 1 FROM role_permissions WHERE role_id='ADMIN' AND permission='customers.write');
INSERT INTO role_permissions (role_id, permission) SELECT 'ADMIN', 'media.read'                  WHERE NOT EXISTS (SELECT 1 FROM role_permissions WHERE role_id='ADMIN' AND permission='media.read');
INSERT INTO role_permissions (role_id, permission) SELECT 'ADMIN', 'media.write'                 WHERE NOT EXISTS (SELECT 1 FROM role_permissions WHERE role_id='ADMIN' AND permission='media.write');
INSERT INTO role_permissions (role_id, permission) SELECT 'ADMIN', 'settings.read'               WHERE NOT EXISTS (SELECT 1 FROM role_permissions WHERE role_id='ADMIN' AND permission='settings.read');
INSERT INTO role_permissions (role_id, permission) SELECT 'ADMIN', 'settings.write'              WHERE NOT EXISTS (SELECT 1 FROM role_permissions WHERE role_id='ADMIN' AND permission='settings.write');
INSERT INTO role_permissions (role_id, permission) SELECT 'ADMIN', 'menus.read'                  WHERE NOT EXISTS (SELECT 1 FROM role_permissions WHERE role_id='ADMIN' AND permission='menus.read');
INSERT INTO role_permissions (role_id, permission) SELECT 'ADMIN', 'menus.write'                 WHERE NOT EXISTS (SELECT 1 FROM role_permissions WHERE role_id='ADMIN' AND permission='menus.write');
INSERT INTO role_permissions (role_id, permission) SELECT 'ADMIN', 'sliders.read'                WHERE NOT EXISTS (SELECT 1 FROM role_permissions WHERE role_id='ADMIN' AND permission='sliders.read');
INSERT INTO role_permissions (role_id, permission) SELECT 'ADMIN', 'sliders.write'               WHERE NOT EXISTS (SELECT 1 FROM role_permissions WHERE role_id='ADMIN' AND permission='sliders.write');
INSERT INTO role_permissions (role_id, permission) SELECT 'ADMIN', 'shipping.read'               WHERE NOT EXISTS (SELECT 1 FROM role_permissions WHERE role_id='ADMIN' AND permission='shipping.read');
INSERT INTO role_permissions (role_id, permission) SELECT 'ADMIN', 'shipping.write'              WHERE NOT EXISTS (SELECT 1 FROM role_permissions WHERE role_id='ADMIN' AND permission='shipping.write');
INSERT INTO role_permissions (role_id, permission) SELECT 'ADMIN', 'reviews.read'                WHERE NOT EXISTS (SELECT 1 FROM role_permissions WHERE role_id='ADMIN' AND permission='reviews.read');
INSERT INTO role_permissions (role_id, permission) SELECT 'ADMIN', 'reviews.write'               WHERE NOT EXISTS (SELECT 1 FROM role_permissions WHERE role_id='ADMIN' AND permission='reviews.write');
INSERT INTO role_permissions (role_id, permission) SELECT 'ADMIN', 'admin-users.read'            WHERE NOT EXISTS (SELECT 1 FROM role_permissions WHERE role_id='ADMIN' AND permission='admin-users.read');
INSERT INTO role_permissions (role_id, permission) SELECT 'ADMIN', 'admin-users.write'           WHERE NOT EXISTS (SELECT 1 FROM role_permissions WHERE role_id='ADMIN' AND permission='admin-users.write');
INSERT INTO role_permissions (role_id, permission) SELECT 'ADMIN', 'roles.read'                  WHERE NOT EXISTS (SELECT 1 FROM role_permissions WHERE role_id='ADMIN' AND permission='roles.read');
INSERT INTO role_permissions (role_id, permission) SELECT 'ADMIN', 'roles.write'                 WHERE NOT EXISTS (SELECT 1 FROM role_permissions WHERE role_id='ADMIN' AND permission='roles.write');
INSERT INTO role_permissions (role_id, permission) SELECT 'ADMIN', 'audit-logs.read'             WHERE NOT EXISTS (SELECT 1 FROM role_permissions WHERE role_id='ADMIN' AND permission='audit-logs.read');
INSERT INTO role_permissions (role_id, permission) SELECT 'ADMIN', 'home_videos.read'            WHERE NOT EXISTS (SELECT 1 FROM role_permissions WHERE role_id='ADMIN' AND permission='home_videos.read');
INSERT INTO role_permissions (role_id, permission) SELECT 'ADMIN', 'home_videos.write'           WHERE NOT EXISTS (SELECT 1 FROM role_permissions WHERE role_id='ADMIN' AND permission='home_videos.write');
INSERT INTO role_permissions (role_id, permission) SELECT 'ADMIN', 'redirects.read'              WHERE NOT EXISTS (SELECT 1 FROM role_permissions WHERE role_id='ADMIN' AND permission='redirects.read');
INSERT INTO role_permissions (role_id, permission) SELECT 'ADMIN', 'redirects.write'             WHERE NOT EXISTS (SELECT 1 FROM role_permissions WHERE role_id='ADMIN' AND permission='redirects.write');
INSERT INTO role_permissions (role_id, permission) SELECT 'ADMIN', 'pos.refund'                  WHERE NOT EXISTS (SELECT 1 FROM role_permissions WHERE role_id='ADMIN' AND permission='pos.refund');
INSERT INTO role_permissions (role_id, permission) SELECT 'ADMIN', 'reports.read'                WHERE NOT EXISTS (SELECT 1 FROM role_permissions WHERE role_id='ADMIN' AND permission='reports.read');
INSERT INTO role_permissions (role_id, permission) SELECT 'ADMIN', 'reports.export'              WHERE NOT EXISTS (SELECT 1 FROM role_permissions WHERE role_id='ADMIN' AND permission='reports.export');
INSERT INTO role_permissions (role_id, permission) SELECT 'ADMIN', 'inventory.read'              WHERE NOT EXISTS (SELECT 1 FROM role_permissions WHERE role_id='ADMIN' AND permission='inventory.read');
INSERT INTO role_permissions (role_id, permission) SELECT 'ADMIN', 'inventory.write'             WHERE NOT EXISTS (SELECT 1 FROM role_permissions WHERE role_id='ADMIN' AND permission='inventory.write');

-- SHOP_MANAGER
INSERT INTO role_permissions (role_id, permission) SELECT 'SHOP_MANAGER', 'products.read'              WHERE NOT EXISTS (SELECT 1 FROM role_permissions WHERE role_id='SHOP_MANAGER' AND permission='products.read');
INSERT INTO role_permissions (role_id, permission) SELECT 'SHOP_MANAGER', 'products.update'            WHERE NOT EXISTS (SELECT 1 FROM role_permissions WHERE role_id='SHOP_MANAGER' AND permission='products.update');
INSERT INTO role_permissions (role_id, permission) SELECT 'SHOP_MANAGER', 'catalog.read'               WHERE NOT EXISTS (SELECT 1 FROM role_permissions WHERE role_id='SHOP_MANAGER' AND permission='catalog.read');
INSERT INTO role_permissions (role_id, permission) SELECT 'SHOP_MANAGER', 'orders.read'                WHERE NOT EXISTS (SELECT 1 FROM role_permissions WHERE role_id='SHOP_MANAGER' AND permission='orders.read');
INSERT INTO role_permissions (role_id, permission) SELECT 'SHOP_MANAGER', 'orders.write'               WHERE NOT EXISTS (SELECT 1 FROM role_permissions WHERE role_id='SHOP_MANAGER' AND permission='orders.write');
INSERT INTO role_permissions (role_id, permission) SELECT 'SHOP_MANAGER', 'customers.read'             WHERE NOT EXISTS (SELECT 1 FROM role_permissions WHERE role_id='SHOP_MANAGER' AND permission='customers.read');
INSERT INTO role_permissions (role_id, permission) SELECT 'SHOP_MANAGER', 'customers.write'            WHERE NOT EXISTS (SELECT 1 FROM role_permissions WHERE role_id='SHOP_MANAGER' AND permission='customers.write');
INSERT INTO role_permissions (role_id, permission) SELECT 'SHOP_MANAGER', 'shipping.read'              WHERE NOT EXISTS (SELECT 1 FROM role_permissions WHERE role_id='SHOP_MANAGER' AND permission='shipping.read');
INSERT INTO role_permissions (role_id, permission) SELECT 'SHOP_MANAGER', 'reviews.read'               WHERE NOT EXISTS (SELECT 1 FROM role_permissions WHERE role_id='SHOP_MANAGER' AND permission='reviews.read');
INSERT INTO role_permissions (role_id, permission) SELECT 'SHOP_MANAGER', 'reviews.write'              WHERE NOT EXISTS (SELECT 1 FROM role_permissions WHERE role_id='SHOP_MANAGER' AND permission='reviews.write');
INSERT INTO role_permissions (role_id, permission) SELECT 'SHOP_MANAGER', 'reports.read'               WHERE NOT EXISTS (SELECT 1 FROM role_permissions WHERE role_id='SHOP_MANAGER' AND permission='reports.read');
INSERT INTO role_permissions (role_id, permission) SELECT 'SHOP_MANAGER', 'reports.export'             WHERE NOT EXISTS (SELECT 1 FROM role_permissions WHERE role_id='SHOP_MANAGER' AND permission='reports.export');
INSERT INTO role_permissions (role_id, permission) SELECT 'SHOP_MANAGER', 'inventory.read'             WHERE NOT EXISTS (SELECT 1 FROM role_permissions WHERE role_id='SHOP_MANAGER' AND permission='inventory.read');
INSERT INTO role_permissions (role_id, permission) SELECT 'SHOP_MANAGER', 'inventory.write'            WHERE NOT EXISTS (SELECT 1 FROM role_permissions WHERE role_id='SHOP_MANAGER' AND permission='inventory.write');

-- EDITOR
INSERT INTO role_permissions (role_id, permission) SELECT 'EDITOR', 'products.read'   WHERE NOT EXISTS (SELECT 1 FROM role_permissions WHERE role_id='EDITOR' AND permission='products.read');
INSERT INTO role_permissions (role_id, permission) SELECT 'EDITOR', 'catalog.read'    WHERE NOT EXISTS (SELECT 1 FROM role_permissions WHERE role_id='EDITOR' AND permission='catalog.read');
INSERT INTO role_permissions (role_id, permission) SELECT 'EDITOR', 'content.read'    WHERE NOT EXISTS (SELECT 1 FROM role_permissions WHERE role_id='EDITOR' AND permission='content.read');
INSERT INTO role_permissions (role_id, permission) SELECT 'EDITOR', 'content.update'  WHERE NOT EXISTS (SELECT 1 FROM role_permissions WHERE role_id='EDITOR' AND permission='content.update');
INSERT INTO role_permissions (role_id, permission) SELECT 'EDITOR', 'media.read'      WHERE NOT EXISTS (SELECT 1 FROM role_permissions WHERE role_id='EDITOR' AND permission='media.read');
INSERT INTO role_permissions (role_id, permission) SELECT 'EDITOR', 'media.write'     WHERE NOT EXISTS (SELECT 1 FROM role_permissions WHERE role_id='EDITOR' AND permission='media.write');
INSERT INTO role_permissions (role_id, permission) SELECT 'EDITOR', 'menus.read'      WHERE NOT EXISTS (SELECT 1 FROM role_permissions WHERE role_id='EDITOR' AND permission='menus.read');
INSERT INTO role_permissions (role_id, permission) SELECT 'EDITOR', 'menus.write'     WHERE NOT EXISTS (SELECT 1 FROM role_permissions WHERE role_id='EDITOR' AND permission='menus.write');
INSERT INTO role_permissions (role_id, permission) SELECT 'EDITOR', 'sliders.read'    WHERE NOT EXISTS (SELECT 1 FROM role_permissions WHERE role_id='EDITOR' AND permission='sliders.read');
INSERT INTO role_permissions (role_id, permission) SELECT 'EDITOR', 'sliders.write'   WHERE NOT EXISTS (SELECT 1 FROM role_permissions WHERE role_id='EDITOR' AND permission='sliders.write');

-- AUTHOR
INSERT INTO role_permissions (role_id, permission) SELECT 'AUTHOR', 'content.read'   WHERE NOT EXISTS (SELECT 1 FROM role_permissions WHERE role_id='AUTHOR' AND permission='content.read');
INSERT INTO role_permissions (role_id, permission) SELECT 'AUTHOR', 'content.update' WHERE NOT EXISTS (SELECT 1 FROM role_permissions WHERE role_id='AUTHOR' AND permission='content.update');
INSERT INTO role_permissions (role_id, permission) SELECT 'AUTHOR', 'media.read'     WHERE NOT EXISTS (SELECT 1 FROM role_permissions WHERE role_id='AUTHOR' AND permission='media.read');
INSERT INTO role_permissions (role_id, permission) SELECT 'AUTHOR', 'media.write'    WHERE NOT EXISTS (SELECT 1 FROM role_permissions WHERE role_id='AUTHOR' AND permission='media.write');

-- CONTRIBUTOR
INSERT INTO role_permissions (role_id, permission) SELECT 'CONTRIBUTOR', 'content.read' WHERE NOT EXISTS (SELECT 1 FROM role_permissions WHERE role_id='CONTRIBUTOR' AND permission='content.read');
INSERT INTO role_permissions (role_id, permission) SELECT 'CONTRIBUTOR', 'media.read'   WHERE NOT EXISTS (SELECT 1 FROM role_permissions WHERE role_id='CONTRIBUTOR' AND permission='media.read');

-- SEO_EDITOR
INSERT INTO role_permissions (role_id, permission) SELECT 'SEO_EDITOR', 'content.read'    WHERE NOT EXISTS (SELECT 1 FROM role_permissions WHERE role_id='SEO_EDITOR' AND permission='content.read');
INSERT INTO role_permissions (role_id, permission) SELECT 'SEO_EDITOR', 'content.update'  WHERE NOT EXISTS (SELECT 1 FROM role_permissions WHERE role_id='SEO_EDITOR' AND permission='content.update');
INSERT INTO role_permissions (role_id, permission) SELECT 'SEO_EDITOR', 'redirects.read'  WHERE NOT EXISTS (SELECT 1 FROM role_permissions WHERE role_id='SEO_EDITOR' AND permission='redirects.read');
INSERT INTO role_permissions (role_id, permission) SELECT 'SEO_EDITOR', 'redirects.write' WHERE NOT EXISTS (SELECT 1 FROM role_permissions WHERE role_id='SEO_EDITOR' AND permission='redirects.write');
