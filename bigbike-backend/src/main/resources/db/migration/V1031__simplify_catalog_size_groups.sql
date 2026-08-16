-- Simplify the public size catalog without changing product/variant identity.
-- V1028/V1029 already created six scales and 73 configured values. This
-- migration only changes their display grouping and removes subgroup data.

INSERT INTO catalog_size_groups (id, group_key, label, label_en, sort_order, active)
VALUES
    ('size-group-pants-waist-inch', 'pants-waist', 'Cỡ vòng eo', 'Waist size', 30, true),
    ('size-group-pants-eu', 'pants-eu', 'Cỡ EU', 'EU size', 40, true)
ON CONFLICT (group_key) DO UPDATE
SET label = EXCLUDED.label,
    label_en = EXCLUDED.label_en,
    sort_order = EXCLUDED.sort_order,
    active = true;

UPDATE catalog_size_groups
SET active = false
WHERE group_key = 'pants-number';

UPDATE catalog_size_scales
SET group_id = 'size-group-pants-waist-inch',
    filter_namespace = 'pants-waist'
WHERE code = 'waist-inch';

UPDATE catalog_size_scales
SET group_id = 'size-group-pants-eu',
    filter_namespace = 'pants-eu'
WHERE code = 'apparel-eu';

-- Scale/value English labels are no longer separately authored. Keep the
-- compatibility columns populated with the same user-entered symbol.
UPDATE catalog_size_scales
SET name_en = name;

UPDATE catalog_size_values
SET label_en = label,
    subgroup_key = NULL,
    subgroup_label = NULL,
    subgroup_label_en = NULL;

DO $$
DECLARE
    scale_count integer;
    value_count integer;
    subgroup_count integer;
BEGIN
    SELECT count(*) INTO scale_count FROM catalog_size_scales WHERE active = true;
    SELECT count(*) INTO value_count FROM catalog_size_values WHERE active = true;
    SELECT count(*) INTO subgroup_count
    FROM catalog_size_values
    WHERE subgroup_key IS NOT NULL
       OR subgroup_label IS NOT NULL
       OR subgroup_label_en IS NOT NULL;

    IF scale_count <> 6 OR value_count <> 73 OR subgroup_count <> 0 THEN
        RAISE EXCEPTION
            'Size catalog simplification check failed: active scales=%, active values=%, subgroup rows=%',
            scale_count, value_count, subgroup_count;
    END IF;
END $$;
