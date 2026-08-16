-- Redirect, product-history and storefront catalog rules from the 2026-08-13 SEO brief.
-- This migration is intentionally data-driven: do not repair these rows manually in a live DB.

ALTER TABLE products
    ADD COLUMN IF NOT EXISTS discontinued boolean NOT NULL DEFAULT false;

ALTER TABLE redirects
    ADD COLUMN IF NOT EXISTS status_code integer NOT NULL DEFAULT 301;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ck_redirects_status_code'
    ) THEN
        ALTER TABLE redirects
            ADD CONSTRAINT ck_redirects_status_code CHECK (status_code IN (301, 410));
    END IF;
END $$;

INSERT INTO brands (
    id, slug, name, is_visible, show_on_homepage, seo_no_index, seo_no_index_en,
    created_at, updated_at
)
VALUES
    ('brand_alpinestars', 'alpinestar', 'Alpinestars', true, false, false, false, NOW(), NOW()),
    ('brand_kriega', 'kriega', 'Kriega', true, false, false, false, NOW(), NOW())
ON CONFLICT (slug) DO NOTHING;

-- Việc A: the two still-sellable products must land on their current published PDPs.
UPDATE redirects
SET target_url = '/product/giay-moto-phuot-chong-nuoc-taichi-rss010-drymaster-combat/',
    enabled = true, status_code = 301, updated_at = NOW()
WHERE source_pattern = '/sp/giay-moto-phuot-chong-nuoc-taichi-rss010-suede-drymaster-combat.html';

UPDATE redirects
SET target_url = '/product/caberg-drift-evo-ii-carbon/',
    enabled = true, status_code = 301, updated_at = NOW()
WHERE source_pattern = '/sp/mu-bao-hiem-fullface-caberg-drift-evo-ii-carbon.html';

-- Việc B + Việc 8: dynamic category aliases are owned by the admin redirect table.
UPDATE redirects
SET target_url = CASE source_pattern
        WHEN '/danh-muc-san-pham/giap-bao-ho-tay-chan-dai-lung-phu-kien-giap'
            THEN '/danh-muc/giap-bao-ho-tay-chan/'
        WHEN '/danh-muc-san-pham/tui-deo-hong-tui-bao-tu'
            THEN '/danh-muc/tui-deo-hong-tui-deo-dui/'
        WHEN '/danh-muc-san-pham/ao-quan-bao-ho-moto-phuot-adventure'
            THEN '/danh-muc/ao-quan-moto-adventure/'
        WHEN '/danh-muc-san-pham/gang-tay'
            THEN '/danh-muc/gang-tay-xe-may-moto/'
        WHEN '/danh-muc-san-pham/non-bao-hiem-moto'
            THEN '/danh-muc/mu-bao-hiem/'
        WHEN '/danh-muc-san-pham/phu-kien-di-mua'
            THEN '/danh-muc/ao-mua-do-di-mua-moto/'
        WHEN '/danh-muc-san-pham/tui-deo-dui'
            THEN '/danh-muc/tui-deo-hong-tui-deo-dui/'
        WHEN '/danh-muc-san-pham/ao-lot'
            THEN '/danh-muc/do-lot-the-thao-trum-dau-moto/'
        WHEN '/danh-muc-san-pham/trum-dau'
            THEN '/danh-muc/do-lot-the-thao-trum-dau-moto/'
        ELSE target_url
    END,
    enabled = true, status_code = 301, updated_at = NOW()
WHERE source_pattern IN (
    '/danh-muc-san-pham/giap-bao-ho-tay-chan-dai-lung-phu-kien-giap',
    '/danh-muc-san-pham/tui-deo-hong-tui-bao-tu',
    '/danh-muc-san-pham/ao-quan-bao-ho-moto-phuot-adventure',
    '/danh-muc-san-pham/gang-tay',
    '/danh-muc-san-pham/non-bao-hiem-moto',
    '/danh-muc-san-pham/phu-kien-di-mua',
    '/danh-muc-san-pham/tui-deo-dui',
    '/danh-muc-san-pham/ao-lot',
    '/danh-muc-san-pham/trum-dau'
);

-- Việc C: English legacy rows are looked up with their /en/ source intact.
INSERT INTO redirects (id, source_pattern, target_url, enabled, hit_count, created_at, updated_at, status_code)
VALUES
    (gen_random_uuid(), '/en/sp/bluetooth-intercom-headset-for-couples-scs-s10x.html', '/en/product/scs-s10x-motorcycle-helmet-bluetooth-intercom/', true, 0, NOW(), NOW(), 301),
    (gen_random_uuid(), '/en/sp/motorcycle-protective-jacket-for-women-ls2-zoom-lady-for-cold-weather.html', '/en/product/ls2-zoom-lady-motorcycle-summer-jacket/', true, 0, NOW(), NOW(), 301)
ON CONFLICT (source_pattern) DO UPDATE
SET target_url = EXCLUDED.target_url, enabled = true, status_code = 301, updated_at = NOW();

-- Owner decision 3: keep the existing summer-jacket destination for both locale sources.
INSERT INTO redirects (id, source_pattern, target_url, enabled, hit_count, created_at, updated_at, status_code)
VALUES (
    gen_random_uuid(),
    '/sp/motorcycle-protective-jacket-for-women-ls2-zoom-lady-for-cold-weather.html',
    '/product/ls2-zoom-lady-motorcycle-summer-jacket/',
    true, 0, NOW(), NOW(), 301
)
ON CONFLICT (source_pattern) DO UPDATE
SET target_url = EXCLUDED.target_url, enabled = true, status_code = 301, updated_at = NOW();

-- No published Apollo/Koku PDP was found in the current catalog; these are terminal 410s.
INSERT INTO redirects (id, source_pattern, target_url, enabled, hit_count, created_at, updated_at, status_code)
VALUES
    (gen_random_uuid(), '/sp/ls2-apollo-man.html', '/', true, 0, NOW(), NOW(), 410),
    (gen_random_uuid(), '/en/sp/ls2-apollo-man.html', '/', true, 0, NOW(), NOW(), 410),
    (gen_random_uuid(), '/sp/ls2-koku-kidney-belt.html', '/', true, 0, NOW(), NOW(), 410),
    (gen_random_uuid(), '/en/sp/ls2-koku-kidney-belt.html', '/', true, 0, NOW(), NOW(), 410)
ON CONFLICT (source_pattern) DO UPDATE
SET target_url = '/', enabled = true, status_code = 410, updated_at = NOW();

-- Việc 2: size archives become direct links to the real catalog filter.
INSERT INTO redirects (id, source_pattern, target_url, enabled, hit_count, created_at, updated_at, status_code)
VALUES
    (gen_random_uuid(), '/size/xxl/page/3', '/?kich-co=XXL&page=3', true, 0, NOW(), NOW(), 301),
    (gen_random_uuid(), '/size/3xl', '/?kich-co=3XL', true, 0, NOW(), NOW(), 301),
    (gen_random_uuid(), '/size/xxxl', '/?kich-co=3XL', true, 0, NOW(), NOW(), 301),
    (gen_random_uuid(), '/size/39', '/?kich-co=39', true, 0, NOW(), NOW(), 301),
    (gen_random_uuid(), '/size/46', '/?kich-co=46', true, 0, NOW(), NOW(), 301)
ON CONFLICT (source_pattern) DO UPDATE
SET target_url = EXCLUDED.target_url, enabled = true, status_code = 301, updated_at = NOW();

-- Việc G: brand aliases land on brand pages, including the owner-approved new brand.
INSERT INTO redirects (id, source_pattern, target_url, enabled, hit_count, created_at, updated_at, status_code)
VALUES
    (gen_random_uuid(), '/brand/alpinestar.html', '/brands/alpinestar/', true, 0, NOW(), NOW(), 301),
    (gen_random_uuid(), '/brand/taichi.html', '/brands/taichi/', true, 0, NOW(), NOW(), 301),
    (gen_random_uuid(), '/brand/scs.html', '/brands/scs/', true, 0, NOW(), NOW(), 301),
    (gen_random_uuid(), '/brand/rok-straps.html', '/brands/rok-straps/', true, 0, NOW(), NOW(), 301),
    (gen_random_uuid(), '/brand/smk.html', '/brands/smk/', true, 0, NOW(), NOW(), 301)
ON CONFLICT (source_pattern) DO UPDATE
SET target_url = EXCLUDED.target_url, enabled = true, status_code = 301, updated_at = NOW();

-- Owner decision 4: the matching published article is /tin-tuc/test/.
INSERT INTO redirects (id, source_pattern, target_url, enabled, hit_count, created_at, updated_at, status_code)
VALUES
    (gen_random_uuid(), '/tin-tuc/bmw-r-1200-gs-xdrive-hybrid-so-huu-nhung-cai-lan-dau-tien-cua-bmw.html', '/tin-tuc/test/', true, 0, NOW(), NOW(), 301),
    (gen_random_uuid(), '/en/tin-tuc/bmw-r-1200-gs-xdrive-hybrid-so-huu-nhung-cai-lan-dau-tien-cua-bmw.html', '/en/tin-tuc/test/', true, 0, NOW(), NOW(), 301)
ON CONFLICT (source_pattern) DO UPDATE
SET target_url = EXCLUDED.target_url, enabled = true, status_code = 301, updated_at = NOW();

-- Remove the stale redirect rows for the 24 legacy pages that remain useful as
-- published-history pages at their original /sp/*.html URL. The page registry is
-- intentionally kept in the web app so it can render even though the old product
-- rows are absent from the current catalog database.
DELETE FROM redirects
WHERE source_pattern IN (
    '/sp/balo-moto-phuot-kriega-r15.html',
    '/sp/balo-moto-phuot-kriega-r20.html',
    '/sp/balo-moto-phuot-kriega-r25.html',
    '/sp/balo-moto-phuot-kriega-r30.html',
    '/sp/balo-moto-phuot-kriega-trail-18-adventure.html',
    '/sp/balo-moto-phuot-kriega-trail-9-adventure.html',
    '/sp/tui-chong-nuoc-kriega-us-10-drypack.html',
    '/sp/tui-chong-nuoc-kriega-us-15-drypack.html',
    '/sp/tui-chong-nuoc-kriega-us-20-drypack.html',
    '/sp/tui-chong-nuoc-kriega-us-30-drypack.html',
    '/sp/mu-bao-hiem-3-4-smk-retro-jet-rebel.html',
    '/sp/mu-bao-hiem-fullface-smk-retro-ranko-ma626-ece-22-05-06-dot.html',
    '/sp/boi-tron-bao-duong-sen-chain-lube-special-will-f1.html',
    '/sp/chai-xit-sen-arrow-chain-lube.html',
    '/sp/duong-sen-cao-cap-liqui-moly.html',
    '/sp/giay-forma-adventure-low-dry.html',
    '/sp/giay-forma-adventure-dry.html',
    '/sp/giay-forma-elite-dry.html',
    '/sp/giay-bao-ho-moto-xe-may-phuot-forma-ground-dry-chong-tham-nuoc.html',
    '/sp/giay-da-moto-xe-may-phuot-urban-city-forma-ground-flow-chong-tham-nuoc.html',
    '/sp/phu-kien-kinh-thay-hang-ls2.html',
    '/sp/gang-tay-moto-phuot-alpinestars-smx1-air-v2.html',
    '/sp/ao-bao-ho-scoyco-jk152.html',
    '/sp/ao-furygan-leo.html'
);

-- Việc D: explicit terminal 410s, including the two wrong-brand product mappings.
INSERT INTO redirects (id, source_pattern, target_url, enabled, hit_count, created_at, updated_at, status_code)
VALUES
    (gen_random_uuid(), '/sp/giay-di-moto-phuot-nu-scoyco-mt068w.html', '/', true, 0, NOW(), NOW(), 410),
    (gen_random_uuid(), '/sp/tui-chong-nuoc-sw-motech-drybag-260-tail-bag.html', '/', true, 0, NOW(), NOW(), 410),
    (gen_random_uuid(), '/sp/bo-chuyen-doi-kreiga-thanh-tui-binh-xang-us-drypack.html', '/', true, 0, NOW(), NOW(), 410),
    (gen_random_uuid(), '/sp/tui-deo-hong-da-nang-kriega-r8-waist-pack.html', '/', true, 0, NOW(), NOW(), 410),
    (gen_random_uuid(), '/sp/tui-deo-kriega-trail-pockets.html', '/', true, 0, NOW(), NOW(), 410),
    (gen_random_uuid(), '/sp/tui-do-nghe-kriega-tool-roll.html', '/', true, 0, NOW(), NOW(), 410),
    (gen_random_uuid(), '/sp/tui-chong-nuoc-sw-motech-drybag-350-tail-bag.html', '/', true, 0, NOW(), NOW(), 410),
    (gen_random_uuid(), '/sp/mu-bao-hiem-smk-typhoon-solid-cua-an-do.html', '/', true, 0, NOW(), NOW(), 410),
    (gen_random_uuid(), '/sp/mu-bao-hiem-fullface-smk-retro-ranchero-gl287-ece-22-05-06-dot.html', '/', true, 0, NOW(), NOW(), 410),
    (gen_random_uuid(), '/sp/mu-bao-hiem-fullface-smk-retro-seven-gl720-ece-22-05-06-dot.html', '/', true, 0, NOW(), NOW(), 410),
    (gen_random_uuid(), '/sp/mu-bao-hiem-ls2-of606.html', '/danh-muc/mu-bao-hiem-3-4/', true, 0, NOW(), NOW(), 301)
ON CONFLICT (source_pattern) DO UPDATE
SET target_url = EXCLUDED.target_url, enabled = true, status_code = EXCLUDED.status_code, updated_at = NOW();

-- The four formerly absolute targets no longer contain a host. The first three
-- are served by the legacy page registry above; OF606 goes directly to its final
-- category path as requested by the brief.
DELETE FROM redirects WHERE source_pattern = '/sp/gang-tay-moto-phuot-alpinestars-smx1-air-v2.html';
DELETE FROM redirects WHERE source_pattern IN ('/sp/ao-bao-ho-scoyco-jk152.html', '/sp/ao-furygan-leo.html');
UPDATE redirects
SET target_url = '/danh-muc/mu-bao-hiem-3-4/', status_code = 301, enabled = true, updated_at = NOW()
WHERE source_pattern = '/sp/mu-bao-hiem-ls2-of606.html';

-- Repair the one known setting value that leaked a count into the /sp/ H1.
UPDATE site_settings
SET setting_value = 'Tất cả sản phẩm', updated_at = NOW()
WHERE setting_key = 'hero_products_title' AND setting_value = 'Tất cả sản phẩm1';
