-- Backfill product_variant_options.attribute_id / attribute_value_id for
-- rows that were inserted before the importer/admin write path linked
-- those FKs (or whose source data didn't carry a matching taxonomy term).
-- Without these links, the read repo falls back to the raw slug stored
-- in option_value and the storefront cannot render colour swatches —
-- the per-term color_hex / swatch_image_id live on attribute_values.

-- 1. Link attribute_id when option_name matches an attribute code.
update product_variant_options pvo
set attribute_id = a.id
from attributes a
where pvo.attribute_id is null
  and a.code = pvo.option_name;

-- 2. Link attribute_value_id by joining (attribute code, value slug).
--    A NULL attribute_id from step 1 means no matching taxonomy exists,
--    so this row stays unlinked — that's fine, the read repo's preferLabel
--    fallback still renders a working text chip.
update product_variant_options pvo
set attribute_value_id = av.id
from attribute_values av
join attributes a on a.id = av.attribute_id
where pvo.attribute_value_id is null
  and a.code = pvo.option_name
  and av.slug = pvo.option_value;
