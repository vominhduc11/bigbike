-- V310: Gỡ 2 thiết lập STORE vô tác dụng.
-- store_currency + store_timezone được seed (V29) và khai báo trong SettingDefinitionRegistry,
-- NHƯNG không có code nào đọc lại 2 key này ở runtime (VND và giờ Việt Nam đã hardcode thẳng
-- ở nơi khác). Tab admin đã ẩn nhóm này từ trước (HIDDEN_KEYS) vì đổi giá trị gây rủi ro; nay
-- xoá hẳn cùng với phần khai báo trong registry và cấu hình tab admin, theo đúng mẫu đã làm ở
-- V273 (SECURITY) và V279 (low_stock_threshold). Idempotent.

delete from site_settings
where setting_key in ('store_currency', 'store_timezone');
