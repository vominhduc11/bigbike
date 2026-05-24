-- Chuyển swatch_image_id từ WP legacy numeric attachment ID sang media.id (UUID text).
-- Sau khi backfill, resolveSwatchUrl() dùng UUID lookup nhanh hơn là legacy_id scan.
-- Không bắt buộc: resolveSwatchUrl() vẫn fallback sang legacy numeric nếu row chưa được migrate.
-- Idempotent: chỉ xử lý row mà swatch_image_id là chuỗi toàn chữ số (định dạng legacy WP).

UPDATE attribute_values av
SET swatch_image_id = m.id::text
FROM media m
WHERE av.swatch_image_id ~ '^[0-9]+$'
  AND m.legacy_id = av.swatch_image_id::bigint;
