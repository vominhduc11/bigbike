-- Minimal size-scale fixture for H2 tests that exercise product variants.
-- Production requires every Size option to resolve through a configured scale;
-- Flyway is disabled in the default H2 test profile, so seed the same contract here.
INSERT INTO catalog_size_groups (id, group_key, label, label_en, sort_order, active)
SELECT 'size-group-clothing-letter', 'clothing-letter', 'Cỡ đồ mặc (chữ)', 'Apparel letter sizes', 10, true
WHERE NOT EXISTS (
    SELECT 1 FROM catalog_size_groups WHERE id = 'size-group-clothing-letter'
);

INSERT INTO catalog_size_scales
    (id, code, name, name_en, group_id, filter_namespace, sort_order, active)
SELECT 'size-scale-helmet-letter', 'helmet-letter', 'Cỡ chữ mũ bảo hiểm', 'Helmet letter sizes',
       'size-group-clothing-letter', 'clothing-letter', 10, true
WHERE NOT EXISTS (
    SELECT 1 FROM catalog_size_scales WHERE id = 'size-scale-helmet-letter'
);

INSERT INTO catalog_size_values
    (id, scale_id, value_key, label, label_en, sort_order, active)
SELECT 'size-value-helmet-' || lower(v.value_key), 'size-scale-helmet-letter',
       v.value_key, v.value_key, v.value_key, v.sort_order, true
FROM (
    SELECT 'S' AS value_key, 20 AS sort_order
    UNION ALL SELECT 'M', 30
    UNION ALL SELECT 'L', 40
    UNION ALL SELECT 'XL', 50
    UNION ALL SELECT 'XXL', 60
) v
WHERE NOT EXISTS (
    SELECT 1
    FROM catalog_size_values existing
    WHERE existing.scale_id = 'size-scale-helmet-letter'
      AND existing.value_key = v.value_key
);
