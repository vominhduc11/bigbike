-- V305: Sửa tên danh mục wp-cat-287 bị lỗi mã hoá từ lúc nhập dữ liệu WordPress cũ
-- (lưu literal "?" thay ký tự tiếng Việt: "KHUY?N M?I HOT"). Tên đúng được xác nhận qua
-- comment sẵn có trong V219__category_menu_icon_banner_data_driven.sql ("-- Khuyến mãi hot").
-- name_en/en_overrides của danh mục này đang rỗng — không có bản sao nào khác cần sửa theo.

update categories
set name = 'KHUYẾN MÃI HOT'
where id = 'wp-cat-287';
