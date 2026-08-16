-- Data-driven size catalog. Public size grouping must not infer meaning from a
-- numeric value: a product is assigned one explicit scale and each scale value
-- carries its display order, subgroup and filter namespace.

CREATE TABLE IF NOT EXISTS catalog_size_groups (
    id              varchar(64) PRIMARY KEY,
    group_key       varchar(64) NOT NULL UNIQUE,
    label           varchar(255) NOT NULL,
    label_en        varchar(255) NOT NULL,
    sort_order      integer NOT NULL,
    active          boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS catalog_size_scales (
    id                  varchar(64) PRIMARY KEY,
    code                varchar(64) NOT NULL UNIQUE,
    name                varchar(255) NOT NULL,
    name_en             varchar(255) NOT NULL,
    group_id            varchar(64) NOT NULL,
    filter_namespace    varchar(64) NOT NULL,
    sort_order          integer NOT NULL,
    active              boolean NOT NULL DEFAULT true,
    CONSTRAINT fk_catalog_size_scales_group
        FOREIGN KEY (group_id) REFERENCES catalog_size_groups (id)
);

CREATE TABLE IF NOT EXISTS catalog_size_values (
    id                  varchar(64) PRIMARY KEY,
    scale_id            varchar(64) NOT NULL,
    value_key           varchar(64) NOT NULL,
    label               varchar(255) NOT NULL,
    label_en            varchar(255) NOT NULL,
    subgroup_key        varchar(64),
    subgroup_label      varchar(255),
    subgroup_label_en   varchar(255),
    sort_order          integer NOT NULL,
    active              boolean NOT NULL DEFAULT true,
    CONSTRAINT fk_catalog_size_values_scale
        FOREIGN KEY (scale_id) REFERENCES catalog_size_scales (id),
    CONSTRAINT uq_catalog_size_values_scale_key
        UNIQUE (scale_id, value_key)
);

ALTER TABLE products
    ADD COLUMN IF NOT EXISTS size_scale_id varchar(64);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_products_size_scale'
    ) THEN
        ALTER TABLE products
            ADD CONSTRAINT fk_products_size_scale
            FOREIGN KEY (size_scale_id) REFERENCES catalog_size_scales (id);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_products_size_scale_id
    ON products (size_scale_id);
CREATE INDEX IF NOT EXISTS idx_catalog_size_values_scale_order
    ON catalog_size_values (scale_id, sort_order);

INSERT INTO catalog_size_groups (id, group_key, label, label_en, sort_order)
VALUES
    ('size-group-clothing-letter', 'clothing-letter', 'Cỡ đồ mặc (chữ)', 'Apparel letter sizes', 10),
    ('size-group-shoe', 'shoe', 'Cỡ giày', 'Shoe sizes', 20),
    ('size-group-pants-number', 'pants-number', 'Cỡ quần theo số', 'Numeric pants sizes', 30)
ON CONFLICT (group_key) DO UPDATE
SET label = EXCLUDED.label,
    label_en = EXCLUDED.label_en,
    sort_order = EXCLUDED.sort_order,
    active = true;

INSERT INTO catalog_size_scales (id, code, name, name_en, group_id, filter_namespace, sort_order)
VALUES
    ('size-scale-helmet-letter', 'helmet-letter', 'Cỡ chữ mũ bảo hiểm', 'Helmet letter sizes', 'size-group-clothing-letter', 'clothing-letter', 10),
    ('size-scale-glove-letter', 'glove-letter', 'Cỡ chữ găng tay', 'Glove letter sizes', 'size-group-clothing-letter', 'clothing-letter', 20),
    ('size-scale-apparel-letter', 'apparel-letter', 'Cỡ chữ đồ mặc', 'Apparel letter sizes', 'size-group-clothing-letter', 'clothing-letter', 30),
    ('size-scale-shoe-eu', 'shoe-eu', 'Cỡ giày châu Âu', 'European shoe sizes', 'size-group-shoe', 'shoe', 40),
    ('size-scale-waist-inch', 'waist-inch', 'Cỡ vòng eo inch', 'Waist inch sizes', 'size-group-pants-number', 'pants-waist', 50),
    ('size-scale-apparel-eu', 'apparel-eu', 'Cỡ đồ mặc châu Âu', 'European apparel sizes', 'size-group-pants-number', 'pants-eu', 60)
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name,
    name_en = EXCLUDED.name_en,
    group_id = EXCLUDED.group_id,
    filter_namespace = EXCLUDED.filter_namespace,
    sort_order = EXCLUDED.sort_order,
    active = true;

INSERT INTO catalog_size_values
    (id, scale_id, value_key, label, label_en, subgroup_key, subgroup_label, subgroup_label_en, sort_order)
VALUES
    -- Helmet letters. Pair values sit after the base value they extend.
    ('size-value-helmet-xs', 'size-scale-helmet-letter', 'XS', 'XS', 'XS', NULL, NULL, NULL, 10),
    ('size-value-helmet-xs-s', 'size-scale-helmet-letter', 'XS/S', 'XS/S', 'XS/S', NULL, NULL, NULL, 15),
    ('size-value-helmet-s', 'size-scale-helmet-letter', 'S', 'S', 'S', NULL, NULL, NULL, 20),
    ('size-value-helmet-m', 'size-scale-helmet-letter', 'M', 'M', 'M', NULL, NULL, NULL, 30),
    ('size-value-helmet-m-l', 'size-scale-helmet-letter', 'M/L', 'M/L', 'M/L', NULL, NULL, NULL, 35),
    ('size-value-helmet-l', 'size-scale-helmet-letter', 'L', 'L', 'L', NULL, NULL, NULL, 40),
    ('size-value-helmet-xl', 'size-scale-helmet-letter', 'XL', 'XL', 'XL', NULL, NULL, NULL, 50),
    ('size-value-helmet-xl-2xl', 'size-scale-helmet-letter', 'XL/2XL', 'XL/2XL', 'XL/2XL', NULL, NULL, NULL, 55),
    ('size-value-helmet-xxl', 'size-scale-helmet-letter', 'XXL', 'XXL', 'XXL', NULL, NULL, NULL, 60),

    -- Glove letters.
    ('size-value-glove-xs', 'size-scale-glove-letter', 'XS', 'XS', 'XS', NULL, NULL, NULL, 10),
    ('size-value-glove-xs-s', 'size-scale-glove-letter', 'XS/S', 'XS/S', 'XS/S', NULL, NULL, NULL, 15),
    ('size-value-glove-s', 'size-scale-glove-letter', 'S', 'S', 'S', NULL, NULL, NULL, 20),
    ('size-value-glove-m', 'size-scale-glove-letter', 'M', 'M', 'M', NULL, NULL, NULL, 30),
    ('size-value-glove-m-l', 'size-scale-glove-letter', 'M/L', 'M/L', 'M/L', NULL, NULL, NULL, 35),
    ('size-value-glove-l', 'size-scale-glove-letter', 'L', 'L', 'L', NULL, NULL, NULL, 40),
    ('size-value-glove-xl', 'size-scale-glove-letter', 'XL', 'XL', 'XL', NULL, NULL, NULL, 50),
    ('size-value-glove-xxl', 'size-scale-glove-letter', 'XXL', 'XXL', 'XXL', NULL, NULL, NULL, 60),
    ('size-value-glove-3xl', 'size-scale-glove-letter', '3XL', '3XL', '3XL', NULL, NULL, NULL, 70),

    -- Apparel letters: regular, women and big-size subgroups.
    ('size-value-apparel-xs', 'size-scale-apparel-letter', 'XS', 'XS', 'XS', NULL, NULL, NULL, 10),
    ('size-value-apparel-s', 'size-scale-apparel-letter', 'S', 'S', 'S', NULL, NULL, NULL, 20),
    ('size-value-apparel-m', 'size-scale-apparel-letter', 'M', 'M', 'M', NULL, NULL, NULL, 30),
    ('size-value-apparel-l', 'size-scale-apparel-letter', 'L', 'L', 'L', NULL, NULL, NULL, 40),
    ('size-value-apparel-xl', 'size-scale-apparel-letter', 'XL', 'XL', 'XL', NULL, NULL, NULL, 50),
    ('size-value-apparel-xxl', 'size-scale-apparel-letter', 'XXL', 'XXL', 'XXL', NULL, NULL, NULL, 60),
    ('size-value-apparel-3xl', 'size-scale-apparel-letter', '3XL', '3XL', '3XL', NULL, NULL, NULL, 70),
    ('size-value-apparel-4xl', 'size-scale-apparel-letter', '4XL', '4XL', '4XL', NULL, NULL, NULL, 80),
    ('size-value-apparel-5xl', 'size-scale-apparel-letter', '5XL', '5XL', '5XL', NULL, NULL, NULL, 90),
    ('size-value-apparel-ws', 'size-scale-apparel-letter', 'WS', 'WS', 'WS', 'women', 'Nữ', 'Women', 110),
    ('size-value-apparel-wm', 'size-scale-apparel-letter', 'WM', 'WM', 'WM', 'women', 'Nữ', 'Women', 120),
    ('size-value-apparel-wl', 'size-scale-apparel-letter', 'WL', 'WL', 'WL', 'women', 'Nữ', 'Women', 130),
    ('size-value-apparel-bm', 'size-scale-apparel-letter', 'BM', 'BM', 'BM', 'big-size', 'Big size', 'Big size', 210),
    ('size-value-apparel-bl', 'size-scale-apparel-letter', 'BL', 'BL', 'BL', 'big-size', 'Big size', 'Big size', 220),
    ('size-value-apparel-bxl', 'size-scale-apparel-letter', 'BXL', 'BXL', 'BXL', 'big-size', 'Big size', 'Big size', 230),
    ('size-value-apparel-2bm', 'size-scale-apparel-letter', '2BM', '2BM', '2BM', 'big-size', 'Big size', 'Big size', 240),
    ('size-value-apparel-2bl', 'size-scale-apparel-letter', '2BL', '2BL', '2BL', 'big-size', 'Big size', 'Big size', 250),

    -- European shoes.
    ('size-value-shoe-36', 'size-scale-shoe-eu', '36', '36', '36', NULL, NULL, NULL, 10),
    ('size-value-shoe-37', 'size-scale-shoe-eu', '37', '37', '37', NULL, NULL, NULL, 20),
    ('size-value-shoe-38', 'size-scale-shoe-eu', '38', '38', '38', NULL, NULL, NULL, 30),
    ('size-value-shoe-39', 'size-scale-shoe-eu', '39', '39', '39', NULL, NULL, NULL, 40),
    ('size-value-shoe-40', 'size-scale-shoe-eu', '40', '40', '40', NULL, NULL, NULL, 50),
    ('size-value-shoe-41', 'size-scale-shoe-eu', '41', '41', '41', NULL, NULL, NULL, 60),
    ('size-value-shoe-42', 'size-scale-shoe-eu', '42', '42', '42', NULL, NULL, NULL, 70),
    ('size-value-shoe-43', 'size-scale-shoe-eu', '43', '43', '43', NULL, NULL, NULL, 80),
    ('size-value-shoe-44', 'size-scale-shoe-eu', '44', '44', '44', NULL, NULL, NULL, 90),
    ('size-value-shoe-45', 'size-scale-shoe-eu', '45', '45', '45', NULL, NULL, NULL, 100),

    -- Waist sizes in inches.
    ('size-value-waist-28', 'size-scale-waist-inch', '28', '28', '28', 'waist-inch', 'Vòng eo (inch)', 'Waist (inch)', 10),
    ('size-value-waist-30', 'size-scale-waist-inch', '30', '30', '30', 'waist-inch', 'Vòng eo (inch)', 'Waist (inch)', 20),
    ('size-value-waist-32', 'size-scale-waist-inch', '32', '32', '32', 'waist-inch', 'Vòng eo (inch)', 'Waist (inch)', 30),
    ('size-value-waist-33', 'size-scale-waist-inch', '33', '33', '33', 'waist-inch', 'Vòng eo (inch)', 'Waist (inch)', 35),
    ('size-value-waist-34', 'size-scale-waist-inch', '34', '34', '34', 'waist-inch', 'Vòng eo (inch)', 'Waist (inch)', 40),
    ('size-value-waist-36', 'size-scale-waist-inch', '36', '36', '36', 'waist-inch', 'Vòng eo (inch)', 'Waist (inch)', 50),
    ('size-value-waist-38', 'size-scale-waist-inch', '38', '38', '38', 'waist-inch', 'Vòng eo (inch)', 'Waist (inch)', 60),
    ('size-value-waist-40', 'size-scale-waist-inch', '40', '40', '40', 'waist-inch', 'Vòng eo (inch)', 'Waist (inch)', 70),
    ('size-value-waist-42', 'size-scale-waist-inch', '42', '42', '42', 'waist-inch', 'Vòng eo (inch)', 'Waist (inch)', 80),

    -- European apparel: regular EU values followed by the observed paired values.
    ('size-value-apparel-eu-46', 'size-scale-apparel-eu', '46', '46', '46', 'europe', 'Châu Âu', 'Europe', 10),
    ('size-value-apparel-eu-48', 'size-scale-apparel-eu', '48', '48', '48', 'europe', 'Châu Âu', 'Europe', 20),
    ('size-value-apparel-eu-50', 'size-scale-apparel-eu', '50', '50', '50', 'europe', 'Châu Âu', 'Europe', 30),
    ('size-value-apparel-eu-52', 'size-scale-apparel-eu', '52', '52', '52', 'europe', 'Châu Âu', 'Europe', 40),
    ('size-value-apparel-eu-54', 'size-scale-apparel-eu', '54', '54', '54', 'europe', 'Châu Âu', 'Europe', 50),
    ('size-value-apparel-eu-56', 'size-scale-apparel-eu', '56', '56', '56', 'europe', 'Châu Âu', 'Europe', 60),
    ('size-value-apparel-eu-58', 'size-scale-apparel-eu', '58', '58', '58', 'europe', 'Châu Âu', 'Europe', 70),
    ('size-value-apparel-eu-60', 'size-scale-apparel-eu', '60', '60', '60', 'europe', 'Châu Âu', 'Europe', 80),
    ('size-value-apparel-eu-62', 'size-scale-apparel-eu', '62', '62', '62', 'europe', 'Châu Âu', 'Europe', 90),
    ('size-value-apparel-eu-30-44', 'size-scale-apparel-eu', '30/44', '30/44', '30/44', 'europe', 'Châu Âu', 'Europe', 110),
    ('size-value-apparel-eu-31-46', 'size-scale-apparel-eu', '31/46', '31/46', '31/46', 'europe', 'Châu Âu', 'Europe', 120),
    ('size-value-apparel-eu-32-48', 'size-scale-apparel-eu', '32/48', '32/48', '32/48', 'europe', 'Châu Âu', 'Europe', 130),
    ('size-value-apparel-eu-34-50', 'size-scale-apparel-eu', '34/50', '34/50', '34/50', 'europe', 'Châu Âu', 'Europe', 140),
    ('size-value-apparel-eu-36-52', 'size-scale-apparel-eu', '36/52', '36/52', '36/52', 'europe', 'Châu Âu', 'Europe', 150),
    ('size-value-apparel-eu-38-54', 'size-scale-apparel-eu', '38/54', '38/54', '38/54', 'europe', 'Châu Âu', 'Europe', 160),
    ('size-value-apparel-eu-40-56', 'size-scale-apparel-eu', '40/56', '40/56', '40/56', 'europe', 'Châu Âu', 'Europe', 170)
ON CONFLICT (scale_id, value_key) DO UPDATE
SET label = EXCLUDED.label,
    label_en = EXCLUDED.label_en,
    subgroup_key = EXCLUDED.subgroup_key,
    subgroup_label = EXCLUDED.subgroup_label,
    subgroup_label_en = EXCLUDED.subgroup_label_en,
    sort_order = EXCLUDED.sort_order,
    active = true;
