-- V274: Gỡ HẲN nhóm settings public_about (trang Giới thiệu /gioi-thieu).
-- Trang Giới thiệu là TRANG TĨNH: chữ lấy từ i18n `About` trong web, ảnh 5 ô dịch vụ là
-- asset theme — web KHÔNG đọc các key về settings (AboutPageContent.tsx). 28 dòng public_about
-- (seed V223, seed lại V269) không điều khiển gì. Quyết định owner 2026-06-24: bỏ hẳn, giữ
-- trang tĩnh. Gỡ cùng: khai báo trong SettingDefinitionRegistry + AboutServiceMediaSeeder. Idempotent.

delete from site_settings where setting_group = 'public_about';
