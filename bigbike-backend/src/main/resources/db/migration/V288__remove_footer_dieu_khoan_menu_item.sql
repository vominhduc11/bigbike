-- V288: Xóa mục "Các Điều Kiện và Điều khoản" khỏi menu footer.
-- Trang /chinh-sach/dieu-khoan bị loại bỏ (owner chốt 2026-06-27).

DELETE FROM menu_items
WHERE url IN ('/chinh-sach/dieu-khoan', '/chinh-sach/dieu-khoan/');
