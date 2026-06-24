-- V277: Gộp 3 thuộc tính "Màu sắc" trùng tên (di sản import WordPress) vào mục chính.
--
-- Kho thuộc tính tồn tại 4 mục cùng tên "Màu sắc": mục chính `color` (wp-attr-6656,
-- 133 màu, 2672 biến thể) và 3 mục thừa `mau` / `maucolor` / `mausac` (tổng 15 màu,
-- 40 biến thể). Vì trùng tên, ô chọn thuộc tính ở admin in tên "Màu sắc" lặp 4 lần
-- ("Màu sắcMàu sắcMàu sắcMàu sắc"). Gộp về 1 mục để hết lặp; biến thể giữ nguyên màu.
-- Một chiều, không khôi phục.

-- 1) Màu trùng slug '48-black' đã có sẵn trong mục chính: trỏ các biến thể của mục
--    `mausac` về màu 48-black của mục chính (tránh vi phạm unique (attribute_id, slug)).
UPDATE product_variant_options
   SET attribute_id = 'wp-attr-6656',
       attribute_value_id = 'wp-attr-value-color-48-black'
 WHERE attribute_value_id = 'wp-attr-value-mausac-48-black';

DELETE FROM attribute_values
 WHERE id = 'wp-attr-value-mausac-48-black';

-- 2) Dời các màu còn lại của 3 mục thừa sang mục chính (slug không trùng nên an toàn).
UPDATE attribute_values
   SET attribute_id = 'wp-attr-6656'
 WHERE attribute_id IN ('wp-attr-auto-mau', 'wp-attr-auto-maucolor', 'wp-attr-auto-mausac');

-- 3) Trỏ các biến thể còn lại của 3 mục thừa sang mục chính (attribute_value_id đã
--    theo màu vừa dời ở bước 2 nên vẫn hợp lệ).
UPDATE product_variant_options
   SET attribute_id = 'wp-attr-6656'
 WHERE attribute_id IN ('wp-attr-auto-mau', 'wp-attr-auto-maucolor', 'wp-attr-auto-mausac');

-- 4) Xóa 3 mục "Màu sắc" thừa (đã rỗng màu, rỗng biến thể tham chiếu).
DELETE FROM attributes
 WHERE id IN ('wp-attr-auto-mau', 'wp-attr-auto-maucolor', 'wp-attr-auto-mausac');
