-- V286: Xóa mục "Điều khoản sử dụng" khỏi menu policy.
-- Trang /chinh-sach/cac-dieu-kien-va-dieu-khoan bị loại bỏ (owner chốt 2026-06-27).
-- Mục này đã bị filter ẩn trong code frontend từ trước; nay xóa hẳn khỏi DB.

delete from menu_items
where url = '/chinh-sach/cac-dieu-kien-va-dieu-khoan';
