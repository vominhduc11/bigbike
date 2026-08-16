-- CATALOG_RULE_007/008 (owner decision 2026-08-15): display-only,
-- data-driven base colors and paint finishes. Product/variant raw data is untouched.
CREATE TABLE catalog_visual_facets (
    facet_type VARCHAR(20) NOT NULL,
    facet_key VARCHAR(80) NOT NULL,
    label_vi VARCHAR(120) NOT NULL,
    label_en VARCHAR(120) NOT NULL,
    swatch VARCHAR(7),
    sort_order INTEGER NOT NULL DEFAULT 0,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    PRIMARY KEY (facet_type, facet_key),
    CONSTRAINT ck_catalog_visual_facet_type CHECK (facet_type IN ('COLOR', 'FINISH')),
    CONSTRAINT ck_catalog_visual_facet_swatch CHECK (
        swatch IS NULL OR (facet_type = 'COLOR' AND swatch ~ '^#[0-9A-Fa-f]{6}$')
    )
);

CREATE TABLE catalog_visual_alias_mappings (
    alias_key VARCHAR(160) NOT NULL,
    facet_type VARCHAR(20) NOT NULL,
    facet_key VARCHAR(80) NOT NULL,
    PRIMARY KEY (alias_key, facet_type, facet_key),
    CONSTRAINT fk_catalog_visual_alias_facet
        FOREIGN KEY (facet_type, facet_key)
        REFERENCES catalog_visual_facets (facet_type, facet_key)
        ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE INDEX ix_catalog_visual_alias_key
    ON catalog_visual_alias_mappings (alias_key);

INSERT INTO catalog_visual_facets
    (facet_type, facet_key, label_vi, label_en, swatch, sort_order)
VALUES
    ('COLOR', 'den', 'Đen', 'Black', '#111111', 10),
    ('COLOR', 'trang', 'Trắng', 'White', '#FFFFFF', 20),
    ('COLOR', 'xam', 'Xám', 'Gray', '#808080', 30),
    ('COLOR', 'bac', 'Bạc', 'Silver', '#C0C0C0', 40),
    ('COLOR', 'do', 'Đỏ', 'Red', '#FF0C09', 50),
    ('COLOR', 'cam', 'Cam', 'Orange', '#F97316', 60),
    ('COLOR', 'vang', 'Vàng', 'Yellow', '#FACC15', 70),
    ('COLOR', 'nau', 'Nâu', 'Brown', '#7C4A2D', 80),
    ('COLOR', 'xanh-duong', 'Xanh dương', 'Blue', '#007BFF', 90),
    ('COLOR', 'xanh-la', 'Xanh lá', 'Green', '#15803D', 100),
    ('COLOR', 'khaki-reu', 'Khaki/Rêu', 'Khaki/Olive', '#6B7D3E', 110),
    ('COLOR', 'camo', 'Camo', 'Camo', '#68734A', 120),
    ('FINISH', 'bong', 'Bóng', 'Gloss', NULL, 10),
    ('FINISH', 'nham', 'Nhám', 'Matte', NULL, 20),
    ('FINISH', 'carbon', 'Carbon', 'Carbon', NULL, 30),
    ('FINISH', 'phan-quang', 'Phản quang', 'Reflective', NULL, 40);

-- A raw alias may map to several base colors. Numeric suffixes are stripped by
-- the reader before this lookup, preserving legacy den-2/xam-3 URLs.
INSERT INTO catalog_visual_alias_mappings (alias_key, facet_type, facet_key)
SELECT alias_key, 'COLOR', 'den' FROM unnest(ARRAY[
    'den','den-bong','den-cam','den-camo','den-camo-do','den-camo-trang','den-do',
    'den-do-trang','den-hong','den-nau','den-nham','den-phan-quang','den-trang',
    'den-trang-do','den-xam','den-xanh-duong','den-xanh-la','den-khaki','den-neon',
    'xanh-reu-den','gloss-black','matt-black','black-gray','juzhen-black-red',
    'carbon','carbon-3k-bong','carbon-3k-nham','carbon-9k-bong','carbon-forged-bong',
    'carbon-forged-nham','carbon-tem-bac','carbon-tem-do','forged-cacbon-nham',
    'nguyen-ban-carbon'
]) AS alias_key;

INSERT INTO catalog_visual_alias_mappings (alias_key, facet_type, facet_key)
SELECT alias_key, 'COLOR', 'trang' FROM unnest(ARRAY[
    'trang','trang-bong','trang-vang','trang-xam','trang-xanh-la','trang-guong',
    'cam-den-trang','den-camo-trang','den-do-trang','den-trang','den-trang-do',
    'do-trang-xanh','tem-trang'
]) AS alias_key;

INSERT INTO catalog_visual_alias_mappings (alias_key, facet_type, facet_key)
SELECT alias_key, 'COLOR', 'xam' FROM unnest(ARRAY[
    'xam','xam-bong','xam-do','xam-vang','xam-xanh-duong','trang-xam','den-xam',
    'xanh-la-xam','tem-xam','war-damaged-gray','cyborg-gray','silver-gray',
    'black-gray','gunmetal'
]) AS alias_key;

INSERT INTO catalog_visual_alias_mappings (alias_key, facet_type, facet_key)
SELECT alias_key, 'COLOR', 'bac' FROM unnest(ARRAY[
    'bac','mythology-silver','silver-gray','carbon-tem-bac','trang-guong'
]) AS alias_key;

INSERT INTO catalog_visual_alias_mappings (alias_key, facet_type, facet_key)
SELECT alias_key, 'COLOR', 'do' FROM unnest(ARRAY[
    'do','do-trang-xanh','den-camo-do','den-do','den-do-trang','den-trang-do',
    'xam-do','tem-do','carbon-tem-do','mythology-red','ronin-red','super-mecha-red',
    'juzhen-black-red','namib-do'
]) AS alias_key;

INSERT INTO catalog_visual_alias_mappings (alias_key, facet_type, facet_key)
SELECT alias_key, 'COLOR', 'cam' FROM unnest(ARRAY[
    'cam','cam-den-trang','den-cam','xanh-duong-cam','day1-orange'
]) AS alias_key;

INSERT INTO catalog_visual_alias_mappings (alias_key, facet_type, facet_key)
SELECT alias_key, 'COLOR', 'vang' FROM unnest(ARRAY[
    'vang','vang-neon','trang-vang','xam-vang','xanh-vang','mythology-gold',
    'super-mecha-gold'
]) AS alias_key;

INSERT INTO catalog_visual_alias_mappings (alias_key, facet_type, facet_key)
SELECT alias_key, 'COLOR', 'nau' FROM unnest(ARRAY['nau','den-nau']) AS alias_key;

INSERT INTO catalog_visual_alias_mappings (alias_key, facet_type, facet_key)
SELECT alias_key, 'COLOR', 'xanh-duong' FROM unnest(ARRAY[
    'xanh','xanh-duong','xanh-dam','xanh-dam-om','xanh-dam-suong','xanh-duong-cam',
    'xanh-mecha','xanh-nhat','xanh-nhat-om','xanh-nhat-suong','xanh-om','xanh-vang',
    'den-xanh-duong','do-trang-xanh','xam-xanh-duong','cyborg-blue','ronin-blue',
    'navy','xanh-navy','blue'
]) AS alias_key;

INSERT INTO catalog_visual_alias_mappings (alias_key, facet_type, facet_key)
SELECT alias_key, 'COLOR', 'xanh-la' FROM unnest(ARRAY[
    'xanh-la','xanh-la-xam','den-xanh-la','trang-xanh-la','day1-green','green'
]) AS alias_key;

INSERT INTO catalog_visual_alias_mappings (alias_key, facet_type, facet_key)
SELECT alias_key, 'COLOR', 'khaki-reu' FROM unnest(ARRAY[
    'khaki','xanh-army','xanh-reu','xanh-reu-den','den-khaki','olive'
]) AS alias_key;

INSERT INTO catalog_visual_alias_mappings (alias_key, facet_type, facet_key)
SELECT alias_key, 'COLOR', 'camo' FROM unnest(ARRAY[
    'camo','camo-nhat','den-camo','den-camo-do','den-camo-trang'
]) AS alias_key;

INSERT INTO catalog_visual_alias_mappings (alias_key, facet_type, facet_key)
SELECT alias_key, 'FINISH', 'bong' FROM unnest(ARRAY[
    'den-bong','trang-bong','xam-bong','carbon-3k-bong','carbon-9k-bong',
    'carbon-forged-bong','guong','trang-guong','gloss-black'
]) AS alias_key;

INSERT INTO catalog_visual_alias_mappings (alias_key, facet_type, facet_key)
SELECT alias_key, 'FINISH', 'nham' FROM unnest(ARRAY[
    'den-nham','carbon-3k-nham','carbon-forged-nham','forged-cacbon-nham','matt-black'
]) AS alias_key;

INSERT INTO catalog_visual_alias_mappings (alias_key, facet_type, facet_key)
SELECT alias_key, 'FINISH', 'carbon' FROM unnest(ARRAY[
    'carbon','carbon-3k-bong','carbon-3k-nham','carbon-9k-bong','carbon-forged-bong',
    'carbon-forged-nham','carbon-tem-bac','carbon-tem-do','forged-cacbon-nham',
    'nguyen-ban-carbon'
]) AS alias_key;

INSERT INTO catalog_visual_alias_mappings (alias_key, facet_type, facet_key)
SELECT alias_key, 'FINISH', 'phan-quang' FROM unnest(ARRAY[
    'den-phan-quang','phan-quang','reflective'
]) AS alias_key;

-- Neutral wording only; helmet, glove and apparel scales keep the shared
-- clothing-letter namespace approved on 2026-08-14.
UPDATE catalog_size_groups
SET label = 'Cỡ chữ', label_en = 'Letter sizes'
WHERE group_key = 'clothing-letter';
