-- ATTRIBUTE_RULE_001 / CATALOG_RULE_014 (owner decision 2026-09-20).
-- Keep product-facing Vietnamese labels, slugs, variant links and visual-facet
-- matching intact. This migration only fills approved English display data and
-- the display-only terms used by English screen-reader color labels.

CREATE TABLE IF NOT EXISTS catalog_visual_display_terms (
    source_label VARCHAR(160) PRIMARY KEY,
    label_en VARCHAR(160) NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE
);

INSERT INTO catalog_visual_display_terms (source_label, label_en, active)
VALUES
    ('SỌC', 'Stripe', TRUE),
    ('XANH NHẠT', 'Light Blue', TRUE),
    ('XANH RÊU', 'Olive', TRUE),
    ('XANH ĐẬM', 'Dark Blue', TRUE),
    ('tem-do', 'Red decal', TRUE),
    ('tem-trang', 'White decal', TRUE),
    ('tem-xam', 'Gray decal', TRUE)
ON CONFLICT (source_label) DO UPDATE
SET label_en = EXCLUDED.label_en,
    active = EXCLUDED.active;

DO $$
DECLARE
    bo_id VARCHAR(64);
    bo_count INTEGER;
    value_count INTEGER;
    expected_slugs TEXT[] := ARRAY[
        'tay', 'vai', 'lung', 'combo-3', 'ao', 'quan', '5f-dual',
        'chan-ghi-dong', 'mai-che', 'non-che', 'num-khoa-chong-trom',
        'cai', 'cap', 'cd-single'
    ];
BEGIN
    SELECT count(*) INTO bo_count FROM attributes WHERE code = 'bo';

    -- Databases without the legacy Bo attribute remain valid and need no data update.
    IF bo_count = 0 THEN
        RETURN;
    END IF;

    IF bo_count <> 1 THEN
        RAISE EXCEPTION 'V1090 stopped: expected exactly one Bo attribute, found %', bo_count;
    END IF;

    SELECT id INTO bo_id FROM attributes WHERE code = 'bo';
    SELECT count(*) INTO value_count FROM attribute_values WHERE attribute_id = bo_id;

    IF value_count <> cardinality(expected_slugs)
            OR EXISTS (
                SELECT 1
                FROM attribute_values
                WHERE attribute_id = bo_id
                  AND slug <> ALL (expected_slugs)
            )
            OR EXISTS (
                SELECT 1
                FROM unnest(expected_slugs) AS expected(slug)
                WHERE NOT EXISTS (
                    SELECT 1
                    FROM attribute_values
                    WHERE attribute_id = bo_id AND slug = expected.slug
                )
            ) THEN
        RAISE EXCEPTION 'V1090 stopped: Bo values do not match the approved immutable slug set';
    END IF;

    UPDATE attributes
    SET name_en = 'Part'
    WHERE id = bo_id
      AND name_en IS DISTINCT FROM 'Part';

    UPDATE attribute_values AS value
    SET label_en = approved.label_en
    FROM (VALUES
        ('tay', 'Arms'),
        ('vai', 'Shoulders'),
        ('lung', 'Back'),
        ('combo-3', 'Set of 3'),
        ('ao', 'Top'),
        ('quan', 'Pants'),
        ('5f-dual', 'Set of 2'),
        ('chan-ghi-dong', 'Handlebar end'),
        ('mai-che', 'Canopy'),
        ('non-che', 'Cover cap'),
        ('num-khoa-chong-trom', 'Anti-theft lock knob'),
        ('cai', 'Piece'),
        ('cap', 'Pair'),
        ('cd-single', 'Single')
    ) AS approved(slug, label_en)
    WHERE value.attribute_id = bo_id
      AND value.slug = approved.slug
      AND value.label_en IS DISTINCT FROM approved.label_en;
END $$;
