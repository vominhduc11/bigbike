-- V354: Clean up three legacy WordPress product-import artifacts approved by the owner.
-- This migration is deliberately narrow and idempotent:
--   1) align no-variant products already marked OUT_OF_STOCK to available = false;
--   2) fill a missing variant cover from its first valid IMAGE gallery row;
--   3) remove only blank option associations, never a product variant.

UPDATE products p
   SET available = false
 WHERE p.available = true
   AND p.stock_state = 'OUT_OF_STOCK'
   AND NOT EXISTS (
           SELECT 1
             FROM product_variants v
            WHERE v.product_id = p.id
       );

UPDATE product_variants v
   SET (image_id, image_url, image_alt, image_width, image_height, image_mime_type) = (
           SELECT g.image_id,
                  g.image_url,
                  g.image_alt,
                  g.image_width,
                  g.image_height,
                  g.image_mime_type
             FROM product_variant_gallery_images g
            WHERE g.variant_id = v.id
              AND LOWER(TRIM(COALESCE(g.media_type, ''))) = 'image'
              AND NULLIF(TRIM(g.image_url), '') IS NOT NULL
            ORDER BY g.sort_order, g.id
            LIMIT 1
       )
 WHERE NULLIF(TRIM(v.image_url), '') IS NULL
   AND EXISTS (
           SELECT 1
             FROM product_variant_gallery_images g
            WHERE g.variant_id = v.id
              AND LOWER(TRIM(COALESCE(g.media_type, ''))) = 'image'
              AND NULLIF(TRIM(g.image_url), '') IS NOT NULL
       );

DELETE FROM product_variant_options
 WHERE option_name IS NULL
    OR TRIM(option_name) = ''
    OR option_value IS NULL
    OR TRIM(option_value) = '';
