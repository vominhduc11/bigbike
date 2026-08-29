-- The live handoff identified wp-cat-287 ("Khuyến mãi hot") as the only
-- level-1 category with a menu icon but no category image. Copy the existing
-- URL into the shared image field, but keep menu_icon_url and its media file.
-- The guard makes this safe to run again and prevents changing any other row.
UPDATE categories
SET image_url = replace(btrim(menu_icon_url), '/wp/', '/media/uploads/wp-icons/'),
    image_width = 14,
    image_height = 16,
    image_mime_type = 'image/png',
    updated_at = now()
WHERE id = 'wp-cat-287'
  AND coalesce(btrim(image_url), '') = ''
  AND coalesce(btrim(menu_icon_url), '') <> '';
