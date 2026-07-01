-- Variant display name is no longer admin-entered (see
-- AdminCatalogMutationService.deriveVariantName): it is always derived from
-- the variant's own attribute option values, joined in option order.
-- Backfills every existing product_variants.name to that same convention,
-- preferring the dictionary attribute_values.label (human label, e.g. "Đen
-- bóng") over the raw option_value text (which for legacy WordPress-imported
-- rows is a lowercase slug, e.g. "den-bong").

WITH option_display AS (
    SELECT
        o.variant_id,
        o.sort_order,
        COALESCE(NULLIF(TRIM(av.label), ''), NULLIF(TRIM(o.option_value), '')) AS disp
    FROM product_variant_options o
    LEFT JOIN attribute_values av ON av.id = o.attribute_value_id
),
option_agg AS (
    SELECT variant_id, STRING_AGG(disp, ' - ' ORDER BY sort_order) AS derived_name
    FROM option_display
    WHERE disp IS NOT NULL
    GROUP BY variant_id
),
fallback AS (
    -- Variants with no resolvable option value (none exist today, but a
    -- future attribute-less variant could) fall back to the same positional
    -- placeholder the backend uses ("Biến thể N", 1-based within the product).
    SELECT
        id AS variant_id,
        'Biến thể ' || ROW_NUMBER() OVER (PARTITION BY product_id ORDER BY sort_order, id) AS fallback_name
    FROM product_variants
)
UPDATE product_variants pv
SET name = COALESCE(oa.derived_name, f.fallback_name)
FROM fallback f
LEFT JOIN option_agg oa ON oa.variant_id = f.variant_id
WHERE f.variant_id = pv.id
  AND pv.name IS DISTINCT FROM COALESCE(oa.derived_name, f.fallback_name);
