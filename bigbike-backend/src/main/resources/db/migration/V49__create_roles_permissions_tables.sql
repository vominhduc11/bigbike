-- Dynamic roles & permissions (Phase 1 — role management UI)
-- Replaces hardcoded AdminRolePermissions.MAP

CREATE TABLE admin_roles (
    id          VARCHAR(50)  PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,
    description TEXT,
    is_system   BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE role_permissions (
    role_id    VARCHAR(50)  NOT NULL REFERENCES admin_roles(id) ON DELETE CASCADE,
    permission VARCHAR(100) NOT NULL,
    PRIMARY KEY (role_id, permission)
);

-- Seed the 7 built-in system roles
INSERT INTO admin_roles (id, name, description, is_system, created_at, updated_at) VALUES
('SUPER_ADMIN',   'Super Admin',   'Toàn quyền hệ thống',                             TRUE, NOW(), NOW()),
('ADMIN',         'Admin',         'Quản trị tất cả nghiệp vụ chính',                  TRUE, NOW(), NOW()),
('SHOP_MANAGER',  'Shop Manager',  'Quản lý cửa hàng, đơn hàng, khách hàng, sản phẩm', TRUE, NOW(), NOW()),
('EDITOR',        'Editor',        'Biên tập nội dung, danh mục, media',               TRUE, NOW(), NOW()),
('AUTHOR',        'Author',        'Viết bài và quản lý media',                        TRUE, NOW(), NOW()),
('CONTRIBUTOR',   'Contributor',   'Chỉ xem nội dung và media',                        TRUE, NOW(), NOW()),
('SEO_EDITOR',    'SEO Editor',    'Phụ trách nội dung và chuyển hướng SEO',           TRUE, NOW(), NOW());

-- SUPER_ADMIN: wildcard
INSERT INTO role_permissions (role_id, permission) VALUES ('SUPER_ADMIN', '*');

-- ADMIN
INSERT INTO role_permissions (role_id, permission) VALUES
('ADMIN', 'products.read'),   ('ADMIN', 'products.update'),
('ADMIN', 'catalog.read'),    ('ADMIN', 'catalog.update'),
('ADMIN', 'content.read'),    ('ADMIN', 'content.update'),
('ADMIN', 'orders.read'),     ('ADMIN', 'orders.write'),
('ADMIN', 'customers.read'),  ('ADMIN', 'customers.write'),
('ADMIN', 'media.read'),      ('ADMIN', 'media.write'),
('ADMIN', 'settings.read'),   ('ADMIN', 'settings.write'),
('ADMIN', 'menus.read'),      ('ADMIN', 'menus.write'),
('ADMIN', 'sliders.read'),    ('ADMIN', 'sliders.write'),
('ADMIN', 'coupons.read'),    ('ADMIN', 'coupons.write'),
('ADMIN', 'shipping.read'),   ('ADMIN', 'shipping.write'),
('ADMIN', 'reviews.read'),    ('ADMIN', 'reviews.write'),
('ADMIN', 'admin-users.read'),('ADMIN', 'admin-users.write'),
('ADMIN', 'audit-logs.read'),
('ADMIN', 'home_videos.read'),('ADMIN', 'home_videos.write');

-- SHOP_MANAGER
INSERT INTO role_permissions (role_id, permission) VALUES
('SHOP_MANAGER', 'products.read'),  ('SHOP_MANAGER', 'products.update'),
('SHOP_MANAGER', 'catalog.read'),
('SHOP_MANAGER', 'orders.read'),    ('SHOP_MANAGER', 'orders.write'),
('SHOP_MANAGER', 'customers.read'), ('SHOP_MANAGER', 'customers.write'),
('SHOP_MANAGER', 'coupons.read'),   ('SHOP_MANAGER', 'coupons.write'),
('SHOP_MANAGER', 'shipping.read'),
('SHOP_MANAGER', 'reviews.read'),   ('SHOP_MANAGER', 'reviews.write');

-- EDITOR
INSERT INTO role_permissions (role_id, permission) VALUES
('EDITOR', 'products.read'),  ('EDITOR', 'catalog.read'),
('EDITOR', 'content.read'),   ('EDITOR', 'content.update'),
('EDITOR', 'media.read'),     ('EDITOR', 'media.write'),
('EDITOR', 'menus.read'),     ('EDITOR', 'menus.write'),
('EDITOR', 'sliders.read'),   ('EDITOR', 'sliders.write');

-- AUTHOR
INSERT INTO role_permissions (role_id, permission) VALUES
('AUTHOR', 'content.read'), ('AUTHOR', 'content.update'),
('AUTHOR', 'media.read'),   ('AUTHOR', 'media.write');

-- CONTRIBUTOR
INSERT INTO role_permissions (role_id, permission) VALUES
('CONTRIBUTOR', 'content.read'),
('CONTRIBUTOR', 'media.read');

-- SEO_EDITOR
INSERT INTO role_permissions (role_id, permission) VALUES
('SEO_EDITOR', 'content.read'),   ('SEO_EDITOR', 'content.update');
