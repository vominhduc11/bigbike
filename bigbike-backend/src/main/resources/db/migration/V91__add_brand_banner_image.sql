-- V91: Add banner_url / banner_alt columns to brands table.
-- WP Perfect WooCommerce Brands plugin stores a separate pwb_brand_banner image
-- (wide banner, e.g. 1920×500) distinct from pwb_brand_image (small square logo).
-- The brand detail page renders a 1200×400 hero area — bannerImage falls back to logo
-- when no dedicated banner is set.
-- Source: bigbike_vn__2026_04_17/sqldump.sql kd_termmeta rows for pwb_brand_banner.

alter table brands add column if not exists banner_url  text;
alter table brands add column if not exists banner_alt  varchar(255);

-- Seed WP banner data for the 2 brands that have pwb_brand_banner in WP:

-- SIXS (term_id=4428, wp-brand-4428): attach 28379
--   → 2022/09/copertina-Danilo-sixs-banner-underwear-motorcycle-01.jpg
update brands
set    banner_url = 'https://bigbike.vn/wp-content/uploads/2022/09/copertina-Danilo-sixs-banner-underwear-motorcycle-01.jpg',
       banner_alt = 'SIXS',
       updated_at = now()
where  id = 'wp-brand-4428'
  and  banner_url is distinct from 'https://bigbike.vn/wp-content/uploads/2022/09/copertina-Danilo-sixs-banner-underwear-motorcycle-01.jpg';

-- HEVIK (term_id=6661, wp-brand-6661): attach 41054 — same file as its logo (images.png).
-- Skipped: banner = logo is not useful; leave banner_url NULL so frontend falls back to logo.
