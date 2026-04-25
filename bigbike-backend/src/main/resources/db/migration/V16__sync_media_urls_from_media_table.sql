-- V16: Sync image URLs in products/galleries from the media table.
--
-- Phase 2E (MediaCopyService) copied all LEGACY_WP files to MinIO and stored the
-- resulting public URL in media.public_url, but did NOT back-propagate those URLs
-- to products.image_url (or gallery/variant tables). This migration does that
-- back-propagation so API responses return MinIO URLs that the browser can load.
--
-- Safe to re-run: only touches rows where the current image_url differs from
-- the resolved media.public_url.

-- 1. products.image_url → resolved via products.image_id = media.legacy_id
UPDATE products p
SET    image_url  = m.public_url,
       updated_at = NOW()
FROM   media m
WHERE  p.image_id IS NOT NULL
  AND  p.image_id <> ''
  AND  p.image_id ~ '^[0-9]+$'
  AND  p.image_id::bigint = m.legacy_id
  AND  m.public_url IS NOT NULL
  AND  p.image_url  IS DISTINCT FROM m.public_url;

-- 2. product_gallery_images.image_url → resolved via image_id = media.legacy_id
--    (table currently empty; included so future imports are covered automatically)
UPDATE product_gallery_images g
SET    image_url = m.public_url
FROM   media m
WHERE  g.image_id IS NOT NULL
  AND  g.image_id <> ''
  AND  g.image_id ~ '^[0-9]+$'
  AND  g.image_id::bigint = m.legacy_id
  AND  m.public_url IS NOT NULL
  AND  g.image_url  IS DISTINCT FROM m.public_url;

-- 3. product_variants.image_url → resolved via image_id = media.legacy_id
UPDATE product_variants v
SET    image_url = m.public_url
FROM   media m
WHERE  v.image_id IS NOT NULL
  AND  v.image_id <> ''
  AND  v.image_id ~ '^[0-9]+$'
  AND  v.image_id::bigint = m.legacy_id
  AND  m.public_url IS NOT NULL
  AND  v.image_url  IS DISTINCT FROM m.public_url;
