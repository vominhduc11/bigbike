-- V223: Fix admin-save HTTP 400 for home sliders + category menu icons caused by WP-import
-- legacy image URLs that the backend media-URL whitelist rejects.
--
-- Root cause (data):
--  • sliders.desktop_image/mobile_image held absolute https://bigbike.vn/wp-content/uploads/…
--    URLs (seeded by V33/V92). SafeMediaAssetUrlPolicy.isAllowedImageUrl only accepts that
--    wp-content/uploads origin when it equals BIGBIKE_SITE_BASE_URL. On any environment whose
--    site origin is NOT https://bigbike.vn (e.g. the VPS on an IP/domain) → slider save → 400.
--  • categories.menu_icon_url held /wp/icon-N.svg (static theme assets in bigbike-web/public/wp/,
--    seeded by V217–V219). A relative /wp/ path is rejected by
--    AdminMutationValidators.validateWhitelistedMediaUrl on EVERY environment (not /media*,
--    /media-proxy*, nor the configured MinIO base) → category save → 400. Making the category
--    menu-icon admin-editable requires the icon to live behind the media whitelist.
--
-- Fix — rewrite to env-independent relative /media/ paths served from MinIO via the Next.js
-- /media/* rewrite (next.config.ts). /media/ is used (not /media-proxy/) because the slider and
-- menu-icon components render the stored URL directly without resolveMediaUrl; /media-proxy/ is
-- admin-preview only and 404s on the public storefront.
--  1) sliders:    https://bigbike.vn/wp-content/uploads/  ->  /media/wp-uploads/
--     The image files already exist in MinIO bucket bigbike-media under wp-uploads/ (WP import).
--  2) menu icons: /wp/<file>                              ->  /media/uploads/wp-icons/<file>
--
-- PREREQUISITE for step 2 (NOT done by Flyway — provision once per environment):
--   Upload the 11 icon files from bigbike-web/public/wp/ (icon-1.png, icon-2..10.svg,
--   abdominals.png) to MinIO bucket `bigbike-media` under `uploads/wp-icons/` with correct
--   Content-Type. Example:
--     mc cp --attr "Content-Type=image/svg+xml" bigbike-web/public/wp/icon-{2,3,4,5,6,7,8,9,10}.svg <alias>/bigbike-media/uploads/wp-icons/
--     mc cp --attr "Content-Type=image/png"     bigbike-web/public/wp/icon-1.png bigbike-web/public/wp/abdominals.png <alias>/bigbike-media/uploads/wp-icons/
--   The bucket already grants anonymous s3:GetObject on bigbike-media/*, so the storefront
--   /media/* rewrite serves them. (Provisioned on the VPS 2026-06-17.)
--
-- Idempotent + guarded: only the legacy values are touched; re-running is a no-op.

update sliders
set    desktop_image = replace(desktop_image::text, 'https://bigbike.vn/wp-content/uploads/', '/media/wp-uploads/')::json,
       updated_at = now()
where  desktop_image::text like '%https://bigbike.vn/wp-content/uploads/%';

update sliders
set    mobile_image = replace(mobile_image::text, 'https://bigbike.vn/wp-content/uploads/', '/media/wp-uploads/')::json,
       updated_at = now()
where  mobile_image::text like '%https://bigbike.vn/wp-content/uploads/%';

update categories
set    menu_icon_url = replace(menu_icon_url, '/wp/', '/media/uploads/wp-icons/'),
       updated_at = now()
where  menu_icon_url like '/wp/%';
