-- V273: Gỡ 2 thiết lập SECURITY vô tác dụng.
-- login_max_attempts + session_timeout_minutes được seed (V29) và khai báo trong
-- SettingDefinitionRegistry, NHƯNG không có mã đăng nhập/phiên nào áp dụng chúng
-- (không khoá tài khoản khi sai nhiều lần, không idle-timeout). Tab admin đã ẩn nhóm này;
-- 2 dòng dữ liệu không điều khiển gì. Xoá cùng với phần khai báo trong registry và tab ẩn.
-- Idempotent.

delete from site_settings
where setting_key in ('login_max_attempts', 'session_timeout_minutes');
