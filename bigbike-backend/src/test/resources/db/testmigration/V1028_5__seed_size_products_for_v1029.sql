-- Testcontainers starts from an intentionally empty catalog, while production migration V1029
-- validates the 109 real products that existed when its data mapping was authored. Seed 109
-- synthetic, non-customer products only in the tc profile so the immutable production migration
-- can run and the PostgreSQL integration contexts can reach the schema they actually test.

INSERT INTO products (
    id, sku, slug, name, retail_price, currency, stock_state,
    publish_status, homepage_block, available, discontinued, size_scale_id,
    created_at, updated_at
)
SELECT
    'tc-size-product-' || lpad(value::text, 3, '0'),
    'TC-SIZE-SKU-' || lpad(value::text, 3, '0'),
    'tc-size-product-' || lpad(value::text, 3, '0'),
    'TC size product ' || value,
    100000,
    'VND',
    'IN_STOCK',
    'PUBLISHED',
    'NONE',
    true,
    false,
    'size-scale-helmet-letter',
    now(),
    now()
FROM generate_series(1, 109) AS value
ON CONFLICT (id) DO NOTHING;

INSERT INTO product_category_map (product_id, category_id, sort_order)
SELECT
    'tc-size-product-' || lpad(value::text, 3, '0'),
    'tc-dummy-cat',
    0
FROM generate_series(1, 109) AS value
ON CONFLICT (product_id, category_id) DO NOTHING;

INSERT INTO product_variants (
    id, product_id, sku, name, retail_price, currency, stock_state,
    is_available, sort_order
)
SELECT
    'tc-size-variant-' || lpad(value::text, 3, '0'),
    'tc-size-product-' || lpad(value::text, 3, '0'),
    'TC-SIZE-VARIANT-' || lpad(value::text, 3, '0'),
    'M',
    100000,
    'VND',
    'IN_STOCK',
    true,
    0
FROM generate_series(1, 109) AS value
ON CONFLICT (id) DO NOTHING;

INSERT INTO product_variant_options (variant_id, sort_order, option_name, option_value)
SELECT
    'tc-size-variant-' || lpad(value::text, 3, '0'),
    0,
    'Size',
    'M'
FROM generate_series(1, 109) AS value;
