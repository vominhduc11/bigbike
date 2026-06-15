-- Gỡ ô cấu hình `seo_home_h1` (nhóm SEO): không nơi nào — cả web lẫn backend — đọc giá trị
-- này (H1 trang chủ không lấy từ đây). Đã xoá khỏi SettingDefinitionRegistry; xoá luôn dòng dữ liệu.

delete from site_settings where setting_key = 'seo_home_h1';
