-- V278: Chuẩn hóa bộ thuộc tính biến thể — Nhóm A (trục thuộc tính thừa, di sản WP import).
--
-- Web bắt khách chọn đủ MỌI thuộc tính của sản phẩm (hợp của các biến thể). Biến thể
-- thiếu/để-trống một thuộc tính sẽ không bán được. Nhóm A là các trục thực chất thừa:
-- xóa đi để mọi biến thể cùng bộ thuộc tính. Một chiều.

-- 1) ỦNG ĐI MƯA GIVI SHOE COVER SHORT 02: cả 4 biến thể đều TRỐNG màu, chỉ khác Size
--    (M/L/XL/XXL) — thực chất 1 màu. Xóa các dòng option "color" rỗng → còn trục Size.
DELETE FROM product_variant_options
 WHERE option_name = 'color'
   AND COALESCE(TRIM(option_value), '') = ''
   AND variant_id IN ('wp-var-4078', 'wp-var-4081', 'wp-var-4084');

-- 2) GĂNG TAY KOMINE GK260: 2 màu thật (đen, đỏ) + 1 biến thể rác GK260-V0 trống cả
--    màu lẫn size. Xóa biến thể rác (không tồn kho/ảnh/giỏ/đơn) → còn trục Màu.
--    product_variant_options theo variant_id có ON DELETE CASCADE nên dòng option tự xóa.
DELETE FROM product_variants
 WHERE id = 'wp-var-35649';
