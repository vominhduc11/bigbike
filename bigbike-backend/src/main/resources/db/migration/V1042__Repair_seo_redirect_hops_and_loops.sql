-- Owner-approved SEO redirect repairs verified against the 2026-08-20 live audit.
-- Keep the redirect registry as the source of truth; do not repair these rows manually.

-- The neutral product aliases were shadowing the preferred English slug and formed
-- three two-way loops through the product page's EN canonical redirect. Disable only
-- those neutral aliases and preserve their hit history.
UPDATE redirects
SET enabled = false,
    updated_at = NOW()
WHERE source_pattern IN (
    '/product/ilm-m1006-touring-motorcycle-boots',
    '/product/komine-bk-300-touring-motorcycle-boots',
    '/product/komine-jk-1143-lady-summer-motorcycle-jacket'
);

-- English legacy sources are stored with /en/ intact so the proxy can resolve them
-- before translating the path to the neutral Vietnamese registry key. The targets are
-- already the current English canonical slugs, so each request takes one 301.
INSERT INTO redirects (id, source_pattern, target_url, enabled, hit_count, created_at, updated_at, status_code)
VALUES
    (gen_random_uuid(), '/en/categories/quan-ao-bao-ho-moto', '/en/categories/motorcycle-jackets-riding-pants', true, 0, NOW(), NOW(), 301),
    (gen_random_uuid(), '/en/categories/giay-bao-ho', '/en/categories/motorcycle-riding-shoes', true, 0, NOW(), NOW(), 301),
    (gen_random_uuid(), '/en/categories/non-bao-hiem-moto', '/en/categories/motorcycle-helmets', true, 0, NOW(), NOW(), 301),
    (gen_random_uuid(), '/en/categories/gang-tay', '/en/categories/motorcycle-gloves', true, 0, NOW(), NOW(), 301),
    (gen_random_uuid(), '/en/categories/giap-bao-ho-tay-chan-dai-lung-phu-kien-giap', '/en/categories/body-armour-and-protectors', true, 0, NOW(), NOW(), 301),
    (gen_random_uuid(), '/en/product/ba-lo-moto-phuot-givi-15-lit-ea129b', '/en/product/givi-ea129b', true, 0, NOW(), NOW(), 301)
ON CONFLICT (source_pattern) DO UPDATE
SET target_url = EXCLUDED.target_url,
    enabled = true,
    status_code = 301,
    updated_at = NOW();
