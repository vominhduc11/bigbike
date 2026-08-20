-- The audit source is a legacy Givi EA129B URL. The first repair used a shortened
-- slug, but the published product's actual English slug is the full canonical slug.
-- Guard the update by the exact V1042 target so later admin changes are preserved.
UPDATE redirects
SET target_url = '/en/product/givi-ea129b-motorcycle-backpack',
    updated_at = NOW()
WHERE source_pattern = '/en/product/ba-lo-moto-phuot-givi-15-lit-ea129b'
  AND target_url = '/en/product/givi-ea129b'
  AND enabled = true
  AND status_code = 301;
