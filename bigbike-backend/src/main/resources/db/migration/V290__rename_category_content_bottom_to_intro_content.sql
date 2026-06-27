-- V290: Đổi tên cột content_bottom (+ content_bottom_en) của categories thành intro_content.
-- Lý do: nội dung này nay hiển thị ở ĐẦU trang danh mục (trên lưới sản phẩm), không còn ở cuối.
-- Tên cũ "content_bottom" là di sản WP ACF (khi nội dung nằm dưới lưới) gây hiểu nhầm.
-- Chạy SAU V289 (V289 tạo + đổ dữ liệu content_bottom_en), nên cả hai cột đều đã tồn tại.
-- KHÔNG đụng products.* (product content_bottom đã drop ở V151) hay home_content_bottom_html (settings).

ALTER TABLE categories RENAME COLUMN content_bottom TO intro_content;
ALTER TABLE categories RENAME COLUMN content_bottom_en TO intro_content_en;
