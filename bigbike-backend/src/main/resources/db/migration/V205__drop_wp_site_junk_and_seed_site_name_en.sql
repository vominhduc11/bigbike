-- V205: Dọn 3 key rác còn sót từ lần import WordPress trong nhóm "Thông tin shop" (general), và
-- điền tiếng Anh cho tên shop.
--
-- 3 key rác (site.name / site.url / site.contact_email) là bản TRÙNG của setting chuẩn
-- (site_name, contact_email) — không nơi nào (web lẫn backend) đọc tới. Đặc biệt site.url đang chứa
-- giá trị dev "http://localhost:3000" lọt lên tab quản trị. Màn Cài đặt liệt kê mọi dòng DB trong
-- nhóm nên các key này hiển thị thừa (và site.name tạo ô tiếng Anh trống thứ 2). Xoá cho sạch —
-- cùng hướng đã dọn rác COMMERCE site.currency ở V192.
--
-- site_name = "BigBike": tên thương hiệu, tiếng Anh giữ nguyên "BigBike". Điền tường minh để ô tiếng
-- Anh không còn trống. Guard "trống" để không đè nếu admin đã tự nhập.

delete from site_settings where setting_key in ('site.name', 'site.url', 'site.contact_email');

update site_settings set setting_value_en = 'BigBike', updated_at = now()
where setting_key = 'site_name' and coalesce(setting_value_en, '') = '';
