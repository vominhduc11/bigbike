-- V315: Gộp thuộc tính màu sắc trùng lặp (giữ bản color, gộp mau-sac vào color).
--

-- 1) Trỏ các biến thể dùng màu 'đen' của thuộc tính 'mau-sac' (nếu có) sang màu 'Đen' của thuộc tính chính 'color'.
UPDATE product_variant_options
   SET attribute_id = 'wp-attr-6656',
       attribute_value_id = 'wp-attr-value-1767'
 WHERE attribute_value_id = 'attr-value-203b615c-0d14-4a24-9f11-23e6db94931a';

-- 2) Xoá giá trị màu 'đen' dư thừa của thuộc tính trùng.
DELETE FROM attribute_values
 WHERE id = 'attr-value-203b615c-0d14-4a24-9f11-23e6db94931a';

-- 3) Chuyển các giá trị màu khác của thuộc tính trùng (như 'đỏ đô') sang thuộc tính chính 'color'.
UPDATE attribute_values
   SET attribute_id = 'wp-attr-6656'
 WHERE attribute_id = 'attr-1060963f-99d8-4fc3-bdb1-3a44640cc1b6';

-- 4) Cập nhật lại các biến thể đang tham chiếu thuộc tính trùng sang thuộc tính chính 'color'.
UPDATE product_variant_options
   SET attribute_id = 'wp-attr-6656'
 WHERE attribute_id = 'attr-1060963f-99d8-4fc3-bdb1-3a44640cc1b6';

-- 5) Xoá thuộc tính trùng 'mau-sac'.
DELETE FROM attributes
 WHERE id = 'attr-1060963f-99d8-4fc3-bdb1-3a44640cc1b6';
