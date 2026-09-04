-- MEDIA_RULE_015: one additional system root for visually classified illustration media.
-- This migration does not update any media row or storage object.

INSERT INTO media_folders (name, slug, system_key, sort_order)
VALUES ('Ảnh minh hoạ', 'anh-minh-hoa', 'root:illustrations', 55)
ON CONFLICT (system_key) DO UPDATE
SET name = EXCLUDED.name,
    slug = EXCLUDED.slug,
    sort_order = EXCLUDED.sort_order,
    updated_at = now();
