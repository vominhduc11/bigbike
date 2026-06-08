-- V169: Remove article product overlay image (never rendered separately on web)
ALTER TABLE articles DROP COLUMN IF EXISTS product_image_url;
ALTER TABLE articles DROP COLUMN IF EXISTS product_image_alt;
