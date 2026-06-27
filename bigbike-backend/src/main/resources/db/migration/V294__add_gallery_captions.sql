ALTER TABLE product_gallery_images
    ADD COLUMN IF NOT EXISTS caption VARCHAR(500);

ALTER TABLE product_variant_gallery_images
    ADD COLUMN IF NOT EXISTS caption VARCHAR(500);
