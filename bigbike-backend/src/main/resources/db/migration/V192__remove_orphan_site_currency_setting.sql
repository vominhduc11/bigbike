-- Gỡ bản ghi cấu hình rác `site.currency` (nhóm 'commerce') còn sót lại từ quá trình
-- import WordPress (woocommerce_currency). Giá trị luôn là "VND" và trùng chức năng với
-- `store_currency` (nhóm 'STORE') — vốn là khoá tiền tệ canonical và đã được ẩn khỏi UI vì
-- shop chỉ dùng VND. Bản ghi thừa này khiến màn Cài đặt sinh ra một tab lẻ tên tiếng Anh
-- "COMMERCE", phá quy ước admin khoá tiếng Việt. Không có service nào đọc key này ở runtime
-- (chỉ là field-mapping khi import), nên xoá an toàn.
DELETE FROM site_settings
WHERE setting_key = 'site.currency'
  AND lower(setting_group) = 'commerce';
