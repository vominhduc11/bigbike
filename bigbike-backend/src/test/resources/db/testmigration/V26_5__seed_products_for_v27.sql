-- Test-only migration (tc profile only).
-- V27 UPDATEs sliders to set product_id = 'wp-prod-XXXXX', which triggers the FK
-- to the products table.  On a fresh Testcontainers database those products do not
-- exist, so V27 would fail with a FK violation.
-- This migration seeds the 7 minimal product rows + one dummy category that V27 needs.
-- It uses WHERE NOT EXISTS so it is idempotent and never overwrites real data.

-- Minimal category (products.category_id NOT NULL → FK to categories)
INSERT INTO categories (id, slug, name, is_visible, created_at, updated_at)
SELECT 'tc-dummy-cat', 'tc-dummy-cat', 'TC Dummy Category', true, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE id = 'tc-dummy-cat');

-- 7 products referenced by V27
INSERT INTO products (id, slug, name, category_id, retail_price, currency, stock_state, publish_status, created_at, updated_at)
SELECT 'wp-prod-38469', 'wp-prod-38469-scs-s9xm', 'SCS S9XM', 'tc-dummy-cat', 0, 'VND', 'IN_STOCK', 'PUBLISHED', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM products WHERE id = 'wp-prod-38469');

INSERT INTO products (id, slug, name, category_id, retail_price, currency, stock_state, publish_status, created_at, updated_at)
SELECT 'wp-prod-37433', 'wp-prod-37433-ilm-mf509', 'ILM MF509', 'tc-dummy-cat', 0, 'VND', 'IN_STOCK', 'PUBLISHED', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM products WHERE id = 'wp-prod-37433');

INSERT INTO products (id, slug, name, category_id, retail_price, currency, stock_state, publish_status, created_at, updated_at)
SELECT 'wp-prod-39156', 'wp-prod-39156-ilm-jc08', 'ILM JC08', 'tc-dummy-cat', 0, 'VND', 'IN_STOCK', 'PUBLISHED', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM products WHERE id = 'wp-prod-39156');

INSERT INTO products (id, slug, name, category_id, retail_price, currency, stock_state, publish_status, created_at, updated_at)
SELECT 'wp-prod-38995', 'wp-prod-38995-ls2-garda', 'LS2 Garda Air', 'tc-dummy-cat', 0, 'VND', 'IN_STOCK', 'PUBLISHED', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM products WHERE id = 'wp-prod-38995');

INSERT INTO products (id, slug, name, category_id, retail_price, currency, stock_state, publish_status, created_at, updated_at)
SELECT 'wp-prod-36772', 'wp-prod-36772-scs-s9x', 'SCS S9X', 'tc-dummy-cat', 0, 'VND', 'IN_STOCK', 'PUBLISHED', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM products WHERE id = 'wp-prod-36772');

INSERT INTO products (id, slug, name, category_id, retail_price, currency, stock_state, publish_status, created_at, updated_at)
SELECT 'wp-prod-35026', 'wp-prod-35026-scs-s7x', 'SCS S7X', 'tc-dummy-cat', 0, 'VND', 'IN_STOCK', 'PUBLISHED', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM products WHERE id = 'wp-prod-35026');

INSERT INTO products (id, slug, name, category_id, retail_price, currency, stock_state, publish_status, created_at, updated_at)
SELECT 'wp-prod-33022', 'wp-prod-33022-spyke-sahara', 'Spyke Sahara', 'tc-dummy-cat', 0, 'VND', 'IN_STOCK', 'PUBLISHED', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM products WHERE id = 'wp-prod-33022');
