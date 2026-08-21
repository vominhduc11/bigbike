-- Product video metadata for product-videos JSONB and gallery-video items (MEDIA_RULE_009).
-- Existing video IDs are deterministic so rerunning this migration shape cannot change identity.

ALTER TABLE product_variant_gallery_images
    ADD COLUMN IF NOT EXISTS video_id VARCHAR(36),
    ADD COLUMN IF NOT EXISTS title VARCHAR(255),
    ADD COLUMN IF NOT EXISTS title_en VARCHAR(255),
    ADD COLUMN IF NOT EXISTS description TEXT,
    ADD COLUMN IF NOT EXISTS description_en TEXT,
    ADD COLUMN IF NOT EXISTS duration_seconds INTEGER,
    ADD COLUMN IF NOT EXISTS uploaded_on DATE;

UPDATE product_variant_gallery_images
SET video_id = lower(
        substr(md5('variant-gallery:' || id::text), 1, 8) || '-' ||
        substr(md5('variant-gallery:' || id::text), 9, 4) || '-' ||
        substr(md5('variant-gallery:' || id::text), 13, 4) || '-' ||
        substr(md5('variant-gallery:' || id::text), 17, 4) || '-' ||
        substr(md5('variant-gallery:' || id::text), 21, 12)
    )
WHERE media_type = 'video'
  AND NULLIF(video_id, '') IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_product_variant_gallery_video_id
    ON product_variant_gallery_images (video_id)
    WHERE video_id IS NOT NULL;

WITH rebuilt_gallery AS (
    SELECT p.id,
           jsonb_agg(
               CASE
                   WHEN (item.value ->> 'mediaType' = 'video'
                         OR NULLIF(item.value ->> 'videoUrl', '') IS NOT NULL)
                        AND NULLIF(item.value ->> 'id', '') IS NULL
                   THEN jsonb_set(
                       item.value,
                       '{id}',
                       to_jsonb(lower(
                           substr(md5(p.id::text || ':gallery-video:' || item.ordinality::text), 1, 8) || '-' ||
                           substr(md5(p.id::text || ':gallery-video:' || item.ordinality::text), 9, 4) || '-' ||
                           substr(md5(p.id::text || ':gallery-video:' || item.ordinality::text), 13, 4) || '-' ||
                           substr(md5(p.id::text || ':gallery-video:' || item.ordinality::text), 17, 4) || '-' ||
                           substr(md5(p.id::text || ':gallery-video:' || item.ordinality::text), 21, 12)
                       )),
                       true
                   )
                   ELSE item.value
               END
               ORDER BY item.ordinality
           ) AS value
    FROM products p
    CROSS JOIN LATERAL jsonb_array_elements(COALESCE(p.gallery, '[]'::jsonb)) WITH ORDINALITY AS item(value, ordinality)
    GROUP BY p.id
)
UPDATE products p
SET gallery = rebuilt_gallery.value
FROM rebuilt_gallery
WHERE p.id = rebuilt_gallery.id
  AND EXISTS (
      SELECT 1
      FROM jsonb_array_elements(p.gallery) AS item(value)
      WHERE (item.value ->> 'mediaType' = 'video' OR NULLIF(item.value ->> 'videoUrl', '') IS NOT NULL)
        AND NULLIF(item.value ->> 'id', '') IS NULL
  );

WITH rebuilt_videos AS (
    SELECT p.id,
           jsonb_agg(
               CASE
                   WHEN NULLIF(item.value ->> 'id', '') IS NULL
                   THEN jsonb_set(
                       item.value,
                       '{id}',
                       to_jsonb(lower(
                           substr(md5(p.id::text || ':product-video:' || item.ordinality::text), 1, 8) || '-' ||
                           substr(md5(p.id::text || ':product-video:' || item.ordinality::text), 9, 4) || '-' ||
                           substr(md5(p.id::text || ':product-video:' || item.ordinality::text), 13, 4) || '-' ||
                           substr(md5(p.id::text || ':product-video:' || item.ordinality::text), 17, 4) || '-' ||
                           substr(md5(p.id::text || ':product-video:' || item.ordinality::text), 21, 12)
                       )),
                       true
                   )
                   ELSE item.value
               END
               ORDER BY item.ordinality
           ) AS value
    FROM products p
    CROSS JOIN LATERAL jsonb_array_elements(COALESCE(p.videos, '[]'::jsonb)) WITH ORDINALITY AS item(value, ordinality)
    GROUP BY p.id
)
UPDATE products p
SET videos = rebuilt_videos.value
FROM rebuilt_videos
WHERE p.id = rebuilt_videos.id
  AND EXISTS (
      SELECT 1
      FROM jsonb_array_elements(p.videos) AS item(value)
      WHERE NULLIF(item.value ->> 'id', '') IS NULL
  );
