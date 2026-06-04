-- Gỡ tính năng swatch màu (mã hex + ảnh swatch riêng).
-- Biến thể màu nay hiển thị trên storefront bằng chính ảnh của biến thể
-- (VariantSelector.tsx dùng variant.gallery[0]), không còn swatch theo term.
-- Xem docs/engineering/API_CONTRACT.md mục "Variant option".

ALTER TABLE attribute_values
  DROP COLUMN IF EXISTS color_hex,
  DROP COLUMN IF EXISTS swatch_image_id;

ALTER TABLE product_variant_options
  DROP COLUMN IF EXISTS swatch_image_id;
