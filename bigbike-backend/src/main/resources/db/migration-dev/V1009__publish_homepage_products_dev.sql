-- V1009 (dev-only seed): publish homepage products so the homepage reaches
-- visual parity with the design. Phase DATA fix for the P1 issues in
-- docs/audits/HOMEPAGE_DESIGN_PARITY_AUDIT.md / HOMEPAGE_P1_FIX_PLAN.md.
--
-- Context: the WordPress import staged 1228/1231 products as DRAFT. The home
-- sliders, the FEATURED_GRID block and the RECOMMENDED_CAROUSEL block all point
-- to real products, but the public API only returns PUBLISHED products, so the
-- homepage shows flat banners, an empty featured row and a near-empty carousel.
--
-- This migration only runs under the `dev` Flyway profile
-- (spring.flyway.locations includes classpath:db/migration-dev). It is fully
-- idempotent: every statement is a guarded UPDATE, so re-running changes
-- nothing. No INSERT, no DELETE, no schema change, no FK touched.

-- 1) HERO: publish the 7 products that home sliders link to.
--    Sliders already carry valid product_id values; the products exist with
--    valid images but sit in DRAFT, so getProductBySlug() returns 404 and the
--    hero overlay (category + name + "MUA NGAY" CTA + watermark) never renders.
update products
set publish_status = 'PUBLISHED', updated_at = now()
where id in (
    'wp-prod-38469',  -- slider_home_0  SCS S9XM Bluetooth Intercom
    'wp-prod-37433',  -- slider_home_1  ILM Racing Helmet MF509
    'wp-prod-39156',  -- slider_home_2  ILM JC08 Gloves
    'wp-prod-38995',  -- slider_home_3  LS2 Garda Air
    'wp-prod-36772',  -- slider_home_4  SCS S9X Bluetooth
    'wp-prod-35026',  -- slider_home_5  SCS S7X Bluetooth
    'wp-prod-33022'   -- slider_home_6  ADV Spyke Sahara Vented
)
and publish_status <> 'PUBLISHED';

-- 2) FEATURED GRID under hero: publish the 5 products already pinned to the
--    FEATURED_GRID block. They were assigned the block but left in DRAFT, so
--    listProducts(homepageBlock=FEATURED_GRID) returned 0 and the row vanished.
update products
set publish_status = 'PUBLISHED', updated_at = now()
where homepage_block = 'FEATURED_GRID'
and publish_status <> 'PUBLISHED';

-- 3) RECOMMENDED CAROUSEL ("Item dac sac"): only 2 published products existed.
--    Pin the 3 intercom products (already published in step 1, same category
--    "Tai nghe Bluetooth") into the carousel so the block has 5 products and
--    its main tab shows a real multi-card carousel.
update products
set homepage_block = 'RECOMMENDED_CAROUSEL', updated_at = now()
where id in (
    'wp-prod-38469',  -- SCS S9XM Bluetooth Intercom
    'wp-prod-36772',  -- SCS S9X Bluetooth
    'wp-prod-35026'   -- SCS S7X Bluetooth
)
and homepage_block <> 'RECOMMENDED_CAROUSEL';

-- 4) "Chua phan loai" tab: the product LS2 KOKU KIDNEY BELT is assigned to the
--    real (hidden) category wp-cat-359 "Chua phan loai", which then surfaces as
--    a tab in the homepage carousel. Reassign it to wp-cat-293
--    "GIAP BAO HO TAY CHAN - DAI LUNG - PHU KIEN GIAP" (a kidney belt is a
--    dai lung protector). After this no published product references
--    wp-cat-359, so the "Chua phan loai" tab disappears.
update products
set category_id = 'wp-cat-293', updated_at = now()
where id = 'wp-prod-36698'
and category_id = 'wp-cat-359';
