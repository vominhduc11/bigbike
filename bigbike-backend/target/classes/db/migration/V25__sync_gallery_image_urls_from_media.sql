-- V25: Sync product_gallery_images.image_url from media.public_url.
--
-- V16 performed the same sync but ran when product_gallery_images was empty
-- (ProductImporter was not yet saving gallery rows from WP _product_image_gallery).
-- After the Phase 2E gallery backfill populates the table, this migration
-- corrects any URL drift between buildMediaUrl() and the actual MinIO public URL.
--
-- Safe to re-run: only updates rows where URL differs from media.public_url.

UPDATE product_gallery_images g
SET    image_url = m.public_url
FROM   media m
WHERE  g.image_id IS NOT NULL
  AND  g.image_id <> ''
  AND  g.image_id ~ '^[0-9]+$'
  AND  g.image_id::bigint = m.legacy_id
  AND  m.public_url IS NOT NULL
  AND  g.image_url IS DISTINCT FROM m.public_url;
