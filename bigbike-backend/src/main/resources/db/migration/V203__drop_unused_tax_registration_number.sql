-- V203: Gỡ ô cấu hình `tax_registration_number` (nhóm Thuế & Phí). Rà soát toàn dự án cho thấy
-- KHÔNG nơi nào — cả web lẫn backend — đọc/hiển thị giá trị này (nhãn cũ ghi "in trên hoá đơn"
-- nhưng thực tế hoá đơn/đơn hàng không lấy MST từ đây). Là ô thừa, luôn trống.
--
-- Đã xoá khỏi SettingDefinitionRegistry và nhãn trong màn Cài đặt admin; xoá luôn dòng dữ liệu cho sạch.
-- (Cùng cách đã làm ở V199/V200 khi gỡ các ô hero/SEO không dùng.)

delete from site_settings where setting_key = 'tax_registration_number';
