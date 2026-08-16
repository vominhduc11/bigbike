-- Redirect audit repairs approved 2026-08-14.
-- Preserve every row and its hit history: this migration only disables unsafe
-- historical mappings or updates their destination in place.

-- A published Caberg row is shadowed by an old redirect to the trashed duplicate.
UPDATE redirects
SET enabled = false, updated_at = NOW()
WHERE source_pattern = '/product/caberg-drift-evo-ii-carbon';

-- These two legacy helmet mappings previously landed on the Caberg duplicate.
UPDATE redirects
SET enabled = false, updated_at = NOW()
WHERE source_pattern = '/sp/mu-bao-hiem-ls2-ff327-challenger-carbon-fold';

UPDATE redirects
SET target_url = '/sp/mu-fullface-ls2-ff807-dragon-carbon-6k-2-kinh.html',
    enabled = true,
    status_code = 301,
    updated_at = NOW()
WHERE source_pattern = '/sp/mu-fullface-ls2-ff807-dragon-carbollface/n-6k-2-kinh.html';

-- Retarget old category aliases to current visible, non-deleted categories.
UPDATE redirects
SET target_url = CASE source_pattern
        WHEN '/sp/ao-lot-mac-trong-giap-sixs-ts2-italy.html'
            THEN '/danh-muc/phu-kien-do-lot-do-mua-moto/'
        WHEN '/sp/ong-tay-chong-nang-givi-bs01dg.html'
            THEN '/danh-muc/phu-kien-do-lot-do-mua-moto/'
        WHEN '/sp/pinlock-chong-suong-fogcity-cua-y.html'
            THEN '/danh-muc/phu-kien-moto-khac/'
        WHEN '/danh-muc-san-pham/pinlock-kinh-chong-suong-mu/pinlock-70-agv-dks118-clear.html'
            THEN '/danh-muc/phu-kien-moto-khac/'
        WHEN '/sp/trum-dau-mang-ben-trong-mu-bao-hiem-bigbike-keo-cam-thun-lanh.html'
            THEN '/danh-muc/do-lot-the-thao-trum-dau-moto/'
        WHEN '/tui-deo-dui-cucyma-c01.html'
            THEN '/danh-muc/tui-deo-hong-tui-deo-dui/'
        WHEN '/danh-muc/tui-deo-dui'
            THEN '/danh-muc/tui-deo-hong-tui-deo-dui/'
        ELSE target_url
    END,
    enabled = true,
    status_code = 301,
    updated_at = NOW()
WHERE source_pattern IN (
    '/sp/ao-lot-mac-trong-giap-sixs-ts2-italy.html',
    '/sp/ong-tay-chong-nang-givi-bs01dg.html',
    '/sp/pinlock-chong-suong-fogcity-cua-y.html',
    '/danh-muc-san-pham/pinlock-kinh-chong-suong-mu/pinlock-70-agv-dks118-clear.html',
    '/sp/trum-dau-mang-ben-trong-mu-bao-hiem-bigbike-keo-cam-thun-lanh.html',
    '/tui-deo-dui-cucyma-c01.html',
    '/danh-muc/tui-deo-dui'
);

-- Five V5 products have no current sellable destination. Their reviewed
-- /sp/ history pages are served by the web registry instead.
UPDATE redirects
SET enabled = false, updated_at = NOW()
WHERE source_pattern IN (
    '/sp/giap-nguc-roi-rs-taichi-trv079.html',
    '/sp/tui-duoi-xe-chong-nuoc-tornado-2-pack-sack.html',
    '/sp/ao-giap-scoyco-jk53-jean.html',
    '/sp/ao-thun-moto-thoi-trang.html',
    '/sp/pat-chan-guong-osopro.html'
);

-- The TSLA product is still PUBLISHED in the current catalog, so it goes to
-- its canonical PDP rather than a generic category.
UPDATE redirects
SET target_url = '/product/trum-dau-fullface-keo-cam-tsla/',
    enabled = true,
    status_code = 301,
    updated_at = NOW()
WHERE source_pattern = '/sp/trum-dau-fullface-keo-cam-tsla.html';
