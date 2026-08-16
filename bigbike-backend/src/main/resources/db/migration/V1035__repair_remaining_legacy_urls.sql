-- Reviewed 2026-08-15 against the live catalog. Preserve existing redirect
-- identity/hit counts; only add or correct the 95 reported dead URLs.

-- 1. Exact current products (including the URL-encoded Vietnamese legacy path).
INSERT INTO redirects (id, source_pattern, target_url, enabled, hit_count, created_at, updated_at, status_code)
VALUES
    (gen_random_uuid(), '/sp/mu%CC%83-ba%CC%89o-hie%CC%89m-3-4-ls2-bob-of601.html', '/product/mu-bao-hiem-3-4-ls2-bob-of601/', true, 0, NOW(), NOW(), 301),
    (gen_random_uuid(), '/product/mu-bao-hiem-dual-sport-caberg-tanami-carbon-2in1', '/product/mu-bao-hiem-dual-sport-caberg-tanami-carbon/', true, 0, NOW(), NOW(), 301),
    (gen_random_uuid(), '/sp/mu-bao-hiem-dual-sport-ilm-ws-902.html', '/product/mu-bao-hiem-dual-sport-ilm-ws902/', true, 0, NOW(), NOW(), 301),
    (gen_random_uuid(), '/sp/non-bao-hiem-ilm-ws902.html', '/product/mu-bao-hiem-dual-sport-ilm-ws902/', true, 0, NOW(), NOW(), 301),
    (gen_random_uuid(), '/en/sp/dual-sport-ws-902-helmet-dual-visor-rally-off-road-specialist.html', '/en/product/mu-bao-hiem-dual-sport-ilm-ws902/', true, 0, NOW(), NOW(), 301),
    (gen_random_uuid(), '/product/mu-bao-hiem-nua-dau-cho-nguoi-di-xe-may-hjc-is2v', '/product/mu-bao-hiem-nua-dau-xpeed-is-2v/', true, 0, NOW(), NOW(), 301),
    (gen_random_uuid(), '/sp/ao-bao-ho-xe-may-motor-danh-cho-nu-ls2-zoom-lady.html', '/product/ao-bao-ho-moto-nu-ls2-zoom-lady/', true, 0, NOW(), NOW(), 301)
ON CONFLICT (source_pattern) DO UPDATE
SET target_url = EXCLUDED.target_url, enabled = true, status_code = 301, updated_at = NOW();

-- 2. Brand aliases; Kriega and Enduristan are owner-approved terminal removals.
INSERT INTO redirects (id, source_pattern, target_url, enabled, hit_count, created_at, updated_at, status_code)
VALUES
    (gen_random_uuid(), '/brands/alpinestars', '/brands/alpinestar/', true, 0, NOW(), NOW(), 301),
    (gen_random_uuid(), '/brand/quadlock.html', '/brands/quadlock/', true, 0, NOW(), NOW(), 301),
    (gen_random_uuid(), '/brand/kriega.html', '/', true, 0, NOW(), NOW(), 410),
    (gen_random_uuid(), '/brands/enduristan', '/', true, 0, NOW(), NOW(), 410),
    (gen_random_uuid(), '/brand/ls2.html/page/3', '/brands/ls2/', true, 0, NOW(), NOW(), 301)
ON CONFLICT (source_pattern) DO UPDATE
SET target_url = EXCLUDED.target_url, enabled = true, status_code = EXCLUDED.status_code, updated_at = NOW();

-- 3. Old category spelling is one hop to only the matching visible category.
INSERT INTO redirects (id, source_pattern, target_url, enabled, hit_count, created_at, updated_at, status_code)
VALUES
    (gen_random_uuid(), '/danh-muc-san-pham/mu-bao-hiem-lat-ham-thao-ham', '/danh-muc/mu-bao-hiem-lat-ham-thao-ham/', true, 0, NOW(), NOW(), 301),
    (gen_random_uuid(), '/danh-muc-san-pham/mu-bao-hiem-fullface', '/danh-muc/mu-bao-hiem-fullface/', true, 0, NOW(), NOW(), 301),
    (gen_random_uuid(), '/danh-muc-san-pham/chua-phan-loai', '/', true, 0, NOW(), NOW(), 410)
ON CONFLICT (source_pattern) DO UPDATE
SET target_url = EXCLUDED.target_url, enabled = true, status_code = EXCLUDED.status_code, updated_at = NOW();

-- 4. Size archives retain their size and page context. The /size/xxl query
-- source is stored path-only; proxy.ts maps ?paged=2 to page=2.
INSERT INTO redirects (id, source_pattern, target_url, enabled, hit_count, created_at, updated_at, status_code)
VALUES
    (gen_random_uuid(), '/size/wm', '/sp/?kich-co=WM', true, 0, NOW(), NOW(), 301),
    (gen_random_uuid(), '/size/xxl/page/4', '/sp/?kich-co=XXL&page=4', true, 0, NOW(), NOW(), 301),
    (gen_random_uuid(), '/size/l/page/2', '/sp/?kich-co=L&page=2', true, 0, NOW(), NOW(), 301),
    (gen_random_uuid(), '/size/m/page/2', '/sp/?kich-co=M&page=2', true, 0, NOW(), NOW(), 301),
    (gen_random_uuid(), '/size/s/page/3', '/sp/?kich-co=S&page=3', true, 0, NOW(), NOW(), 301),
    (gen_random_uuid(), '/size/m', '/sp/?kich-co=M', true, 0, NOW(), NOW(), 301),
    (gen_random_uuid(), '/size/34', '/sp/?kich-co=34', true, 0, NOW(), NOW(), 301),
    (gen_random_uuid(), '/size/s', '/sp/?kich-co=S', true, 0, NOW(), NOW(), 301),
    (gen_random_uuid(), '/size/42', '/sp/?kich-co=42', true, 0, NOW(), NOW(), 301),
    (gen_random_uuid(), '/size/36', '/sp/?kich-co=36', true, 0, NOW(), NOW(), 301),
    (gen_random_uuid(), '/size/xxl/page/2', '/sp/?kich-co=XXL&page=2', true, 0, NOW(), NOW(), 301),
    (gen_random_uuid(), '/size/xxl', '/sp/?kich-co=XXL', true, 0, NOW(), NOW(), 301)
ON CONFLICT (source_pattern) DO UPDATE
SET target_url = EXCLUDED.target_url, enabled = true, status_code = 301, updated_at = NOW();

-- Owner decision: retired global color archives do not recreate color filters.
INSERT INTO redirects (id, source_pattern, target_url, enabled, hit_count, created_at, updated_at, status_code)
VALUES
    (gen_random_uuid(), '/color/nerve', '/sp/', true, 0, NOW(), NOW(), 301),
    (gen_random_uuid(), '/color/do', '/sp/', true, 0, NOW(), NOW(), 301),
    (gen_random_uuid(), '/color/trang', '/sp/', true, 0, NOW(), NOW(), 301),
    (gen_random_uuid(), '/color/den-camo', '/sp/', true, 0, NOW(), NOW(), 301),
    (gen_random_uuid(), '/color/den-do', '/sp/', true, 0, NOW(), NOW(), 301)
ON CONFLICT (source_pattern) DO UPDATE
SET target_url = EXCLUDED.target_url, enabled = true, status_code = 301, updated_at = NOW();

-- 5. Old utility/policy paths. A terminal 410 is crawlable and emits noindex.
INSERT INTO redirects (id, source_pattern, target_url, enabled, hit_count, created_at, updated_at, status_code)
VALUES
    (gen_random_uuid(), '/wp-admin/admin.php', '/', true, 0, NOW(), NOW(), 410),
    (gen_random_uuid(), '/home', '/', true, 0, NOW(), NOW(), 301),
    (gen_random_uuid(), '/chinh-sach-bao-ve-thong-tin-ca-nhan.html', '/chinh-sach/chinh-sach-bao-mat-thong-tin/', true, 0, NOW(), NOW(), 301),
    (gen_random_uuid(), '/cac-dieu-kien-va-dieu-khoan.html', '/chinh-sach/chinh-sach-bao-mat-thong-tin/', true, 0, NOW(), NOW(), 301),
    (gen_random_uuid(), '/en/en/clothing-motorcycle/leather-jackets-suit.html', '/en/categories/motorcycle-jackets-riding-pants/', true, 0, NOW(), NOW(), 301)
ON CONFLICT (source_pattern) DO UPDATE
SET target_url = EXCLUDED.target_url, enabled = true, status_code = EXCLUDED.status_code, updated_at = NOW();

-- 6. Low-impression legacy products have no verified replacement and no
-- backlink value. Do not point them at unrelated current stock.
INSERT INTO redirects (id, source_pattern, target_url, enabled, hit_count, created_at, updated_at, status_code)
VALUES
    (gen_random_uuid(), '/sp/phu-kien-day-rang-tui-kriega-us.html', '/', true, 0, NOW(), NOW(), 410),
    (gen_random_uuid(), '/sp/phu-kien-kinh-ram-vang-mt-snake-carbon.html', '/', true, 0, NOW(), NOW(), 410),
    (gen_random_uuid(), '/sp/tui-deo-dui-cucyma-c01.html', '/', true, 0, NOW(), NOW(), 410),
    (gen_random_uuid(), '/sp/tui-deo-dui-chong-nuoc-komine-sa-245.html', '/', true, 0, NOW(), NOW(), 410),
    (gen_random_uuid(), '/sp/quadlock-vibration-damperner-giam-rung-chong-hu-camera-dien-thoai.html', '/', true, 0, NOW(), NOW(), 410),
    (gen_random_uuid(), '/sp/gang-tay-bao-ho-komine-gk-257.html', '/', true, 0, NOW(), NOW(), 410),
    (gen_random_uuid(), '/sp/gang-tay-taichi-rst461-wrx-air.html', '/', true, 0, NOW(), NOW(), 410),
    (gen_random_uuid(), '/sp/kinh-thay-ls2-ff327-challenger-phu-kien-fullface.html', '/', true, 0, NOW(), NOW(), 410),
    (gen_random_uuid(), '/sp/bao-ve-goi-taichi-trv080.html', '/', true, 0, NOW(), NOW(), 410),
    (gen_random_uuid(), '/sp/tui-chong-nuoc-sw-motech-drybag-700-tail-bag.html', '/', true, 0, NOW(), NOW(), 410),
    (gen_random_uuid(), '/sp/ao-bao-ho-ls2-norway.html', '/', true, 0, NOW(), NOW(), 410),
    (gen_random_uuid(), '/sp/quan-mua-furygan-over-pant.html', '/', true, 0, NOW(), NOW(), 410),
    (gen_random_uuid(), '/sp/khan-trum-dau-ego-balaclava.html', '/', true, 0, NOW(), NOW(), 410),
    (gen_random_uuid(), '/sp/ao-da-tui-khi-helite-roadster.html', '/', true, 0, NOW(), NOW(), 410),
    (gen_random_uuid(), '/sp/giay-adv-touring-chong-nuoc-gaerne-g-stelvio-aquatech.html', '/', true, 0, NOW(), NOW(), 410),
    (gen_random_uuid(), '/sp/mu-bao-hiem-ls2-ff900-valiants-ii-codex-flip-up.html', '/', true, 0, NOW(), NOW(), 410),
    (gen_random_uuid(), '/sp/ao-bao-ho-ls2-cho-nu-bullet.html', '/', true, 0, NOW(), NOW(), 410),
    (gen_random_uuid(), '/sp/quan-bao-ho-ls2-apollo-man.html', '/', true, 0, NOW(), NOW(), 410),
    (gen_random_uuid(), '/sp/falcon-f24-non-nua-dau-carbon-co-dien.html', '/', true, 0, NOW(), NOW(), 410),
    (gen_random_uuid(), '/sp/gang-tay-chong-nang-komine-ak-313.html', '/', true, 0, NOW(), NOW(), 410),
    (gen_random_uuid(), '/sp/mu-bao-hiem-agv-streetmodular-dot-ece-22-06.html', '/', true, 0, NOW(), NOW(), 410),
    (gen_random_uuid(), '/sp/hang-oder-mu-bao-hiem-lat-ham-agv-streetmodular-dot-ece22-06.html', '/', true, 0, NOW(), NOW(), 410),
    (gen_random_uuid(), '/sp/giay-bao-ho-augi-ar2-racing-motorcycle-boots.html', '/', true, 0, NOW(), NOW(), 410),
    (gen_random_uuid(), '/sp/quan-bao-ho-jean-ls2-dakota-cho-nu.html', '/', true, 0, NOW(), NOW(), 410),
    (gen_random_uuid(), '/sp/ao-bao-ho-touring-seventy-degrees-sd-jt43-winter.html', '/', true, 0, NOW(), NOW(), 410),
    (gen_random_uuid(), '/sp/tui-deo-hong-givi-ea108b.html', '/', true, 0, NOW(), NOW(), 410),
    (gen_random_uuid(), '/sp/tui-treo-hong-xe-givi-ae101b.html', '/', true, 0, NOW(), NOW(), 410),
    (gen_random_uuid(), '/sp/mu-bao-hiem-ls2-mx471.html', '/', true, 0, NOW(), NOW(), 410),
    (gen_random_uuid(), '/sp/ao-bao-ho-rs-taichi-rsj347-overlap-mesh-parka.html', '/', true, 0, NOW(), NOW(), 410),
    (gen_random_uuid(), '/sp/tui-deo-dui-givi-ea109b.html', '/', true, 0, NOW(), NOW(), 410),
    (gen_random_uuid(), '/sp/giap-goi-komine-sk-825-ce-level-2.html', '/', true, 0, NOW(), NOW(), 410),
    (gen_random_uuid(), '/sp/tui-chong-nuoc-kriega-us-combo-40-drypack-nhap-anh.html', '/', true, 0, NOW(), NOW(), 410),
    (gen_random_uuid(), '/sp/giay-forma-touring-arbo-dry.html', '/', true, 0, NOW(), NOW(), 410),
    (gen_random_uuid(), '/sp/tui-deo-hong-sw-motech-20-mavi.html', '/', true, 0, NOW(), NOW(), 410),
    (gen_random_uuid(), '/sp/suit-da-1-manh-alpinestars-gp-force.html', '/', true, 0, NOW(), NOW(), 410)
ON CONFLICT (source_pattern) DO UPDATE
SET target_url = '/', enabled = true, status_code = 410, updated_at = NOW();
