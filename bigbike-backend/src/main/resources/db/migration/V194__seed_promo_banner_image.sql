-- V193: Seed the homepage promotion banner image (promo_image_url).
--
-- The "Banner khuyến mãi" on the homepage (bigbike-web app/page.tsx, section
-- "Banner ads") reads promo_image_url and falls back to the bundled static
-- asset /wp-content/themes/bigbike/images/banner-ads.jpg when the setting is
-- blank. Because that fallback only lives in the web app's static folder, the
-- admin Settings screen (different origin; its nginx proxies only /media and
-- /media-proxy, not /wp-content) cannot preview it, so the field looked empty
-- even though the storefront showed an image.
--
-- This writes the same asset as an ABSOLUTE production URL so BOTH surfaces
-- resolve it: the storefront leaves bigbike.vn /wp-content/themes/... URLs
-- untouched (resolveMediaUrl only rewrites /wp-content/uploads/), and the admin
-- preview loads it directly. Verified 200 image/jpeg at this URL. Matches the
-- existing convention of absolute bigbike.vn URLs stored in `sliders`.
--
-- Guarded with "is null or blank" so an image already chosen through the admin
-- Settings screen is never overwritten by this migration.

update site_settings
set    setting_value = 'https://bigbike.vn/wp-content/themes/bigbike/images/banner-ads.jpg',
       updated_at = now()
where  setting_key = 'promo_image_url'
  and  (setting_value is null or btrim(setting_value) = '');
