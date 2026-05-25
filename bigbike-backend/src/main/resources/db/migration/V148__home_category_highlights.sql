-- V148: Bảng cấu hình 3 slot highlights danh mục trang chủ.
-- Admin cấu hình qua PUT /api/v1/admin/home/category-highlights.
-- Web fetch qua GET /api/v1/home/category-highlights (public, 5-min cache).

CREATE TABLE home_category_highlights (
    slot        SMALLINT    PRIMARY KEY CHECK (slot BETWEEN 1 AND 3),
    product_id  VARCHAR(64) NOT NULL REFERENCES products(id),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed 3 slot mặc định khớp với hardcode cũ trong page.tsx.
-- ON CONFLICT DO NOTHING để migration idempotent khi chạy lại (test env).
INSERT INTO home_category_highlights (slot, product_id)
SELECT 1, id FROM products WHERE slug = 'balo-moto-phuot-chinh-hang-taichi-rs278-chong-nuoc' LIMIT 1
ON CONFLICT (slot) DO NOTHING;

INSERT INTO home_category_highlights (slot, product_id)
SELECT 2, id FROM products WHERE slug = 'ao-t-sps-superair' LIMIT 1
ON CONFLICT (slot) DO NOTHING;

INSERT INTO home_category_highlights (slot, product_id)
SELECT 3, id FROM products WHERE slug = 'mu-bao-hiem-ls2-ff800-storm' LIMIT 1
ON CONFLICT (slot) DO NOTHING;

-- Seed permissions. SUPER_ADMIN đã có wildcard (*), không cần thêm.
INSERT INTO role_permissions (role_id, permission) VALUES
    ('ADMIN',        'home_highlights.read'),
    ('ADMIN',        'home_highlights.write'),
    ('EDITOR',       'home_highlights.read'),
    ('EDITOR',       'home_highlights.write'),
    ('SHOP_MANAGER', 'home_highlights.read')
ON CONFLICT (role_id, permission) DO NOTHING;
