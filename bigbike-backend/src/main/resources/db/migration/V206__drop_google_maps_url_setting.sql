-- V206: Gỡ ô cấu hình `google_maps_url` (nhóm Liên hệ). Bản đồ trên trang Liên hệ được dựng trực
-- tiếp từ địa chỉ shop (`contact_address`) — admin sửa ô Địa chỉ là bản đồ đổi theo. Ô google_maps_url
-- chỉ là override tùy chọn, giá trị đang lưu lại trùng đúng bản đồ tự dựng nên KHÔNG tác động gì tới
-- web. Đã gỡ phần đọc nó ở trang Liên hệ (bigbike-web) và khỏi SettingDefinitionRegistry; xoá luôn
-- dòng dữ liệu để ô biến mất khỏi màn Cài đặt.

delete from site_settings where setting_key = 'google_maps_url';
