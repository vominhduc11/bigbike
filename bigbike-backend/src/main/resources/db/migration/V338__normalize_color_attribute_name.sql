-- V338: Chuẩn hóa trục thuộc tính màu về MỘT thuộc tính duy nhất "màu sắc" (wp-attr-6656).
--
-- Bối cảnh: thuộc tính màu chuẩn của hệ thống là wp-attr-6656 (name = 'màu sắc'). V277/V315 đã gộp
-- các thuộc tính màu trùng vào đây. Tuy nhiên dữ liệu biến thể vẫn còn 2 vấn đề khiến admin hiện
-- "Màu" thành một mục thuộc tính RIÊNG, tách khỏi "màu sắc":
--   1) 6 biến thể khai option_name = 'Màu'/'Màu sắc' nhưng attribute_id RỖNG → không nối vào
--      wp-attr-6656, nên dropdown coi "Màu" là một trục thuộc tính độc lập.
--   2) Tên hiển thị của trục màu còn lẫn lộn: 'Color'/'color' (di sản WP import) lẫn 'màu sắc'.
-- Migration gộp tất cả về tên 'màu sắc' và nối đúng attribute_id để chỉ còn MỘT thuộc tính màu.
-- Một chiều. An toàn với web: web khớp biến thể theo GIÁ TRỊ (option_value), không theo tên trục;
-- backend hiển thị nhãn màu theo FK attribute_value_id (rơi về option_value khi thiếu FK).

-- 1) Backfill FK giá trị màu cho các dòng mồ côi khi khớp nhãn (vd 'Đen', 'Xanh Dương'). Nhãn chưa
--    có trong attribute_values (vd 'Bạc', 'Đỏ') để trống — backend tự dùng option_value làm nhãn.
UPDATE product_variant_options pvo
   SET attribute_value_id = av.id
  FROM attribute_values av
 WHERE av.attribute_id = 'wp-attr-6656'
   AND av.label = pvo.option_value
   AND pvo.attribute_id IS NULL
   AND pvo.option_name IN ('Màu', 'Màu sắc');

-- 2) Nối các dòng màu mồ côi vào thuộc tính màu chuẩn wp-attr-6656.
UPDATE product_variant_options
   SET attribute_id = 'wp-attr-6656'
 WHERE attribute_id IS NULL
   AND option_name IN ('Màu', 'Màu sắc');

-- 3) Thống nhất tên trục màu về 'màu sắc' cho MỌI biến thể đang gắn thuộc tính này (gồm cả
--    'Color'/'color' tiếng Anh di sản). Đối chiếu đúng name của attributes(wp-attr-6656) = 'màu sắc'.
UPDATE product_variant_options
   SET option_name = 'màu sắc'
 WHERE attribute_id = 'wp-attr-6656'
   AND option_name <> 'màu sắc';
