-- V335 migrated all product_gallery_images/product_videos rows into the new
-- products.gallery/videos JSONB columns (added at V334) — safe to drop now.
DROP TABLE IF EXISTS product_gallery_images;
DROP TABLE IF EXISTS product_videos;
