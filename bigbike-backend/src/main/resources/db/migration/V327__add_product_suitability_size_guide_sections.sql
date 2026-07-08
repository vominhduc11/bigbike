-- "Phù hợp với ai" (suitability) và "Bảng size" (sizeGuide) tách khỏi description_blocks thành 2
-- field JSONB riêng — xem V328 (di chuyển dữ liệu) và DescriptionBlock.java (bỏ 2 subtype này khỏi
-- sealed interface, thay bằng SuitabilitySection/SizeGuideSection độc lập).
ALTER TABLE products ADD COLUMN suitability_section jsonb;
ALTER TABLE products ADD COLUMN size_guide_section jsonb;
