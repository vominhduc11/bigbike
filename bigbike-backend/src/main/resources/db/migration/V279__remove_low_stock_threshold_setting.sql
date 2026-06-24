-- V279: Gỡ thiết lập low_stock_threshold đã chết.
-- Tồn kho chuyển sang mô hình boolean "Còn/Hết" (V262) — không còn tầng "Còn ít hàng"
-- (LOW_STOCK). Ngưỡng cảnh báo sắp hết hàng không còn điều khiển gì; đã gỡ khỏi
-- SettingDefinitionRegistry và màn Cài đặt admin. Xoá dòng dữ liệu mồ côi.
-- Idempotent.

delete from site_settings
where setting_key = 'low_stock_threshold';
