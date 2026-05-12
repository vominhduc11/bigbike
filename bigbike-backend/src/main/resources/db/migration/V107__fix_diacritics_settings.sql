-- V107 — Fix missing Vietnamese diacritics in site_settings
-- Discovered via curl http://localhost:3000/ — 4 setting rows had ASCII-only text.
-- Restoring proper Vietnamese characters.

BEGIN;

UPDATE site_settings
SET setting_value = 'BIGBIKE MONG ĐƯỢC LẮNG NGHE VÀ THẤU HIỂU BẠN HƠN',
    updated_at = NOW()
WHERE setting_key = 'footer_tagline'
  AND setting_value = 'BIGBIKE MONG DUOC LANG NGHE VA THAU HIEU BAN HON';

UPDATE site_settings
SET setting_value = 'BigBike chuyên cung cấp gear moto chính hãng.',
    updated_at = NOW()
WHERE setting_key = 'footer_description'
  AND setting_value = 'BigBike chuyen cung cap gear moto chinh hang.';

UPDATE site_settings
SET setting_value = 'GÓC TRẢI NGHIỆM CÙNG BIGBIKE',
    updated_at = NOW()
WHERE setting_key = 'home_exp_subtitle'
  AND setting_value = 'GOC TRAI NGHIEM CUNG BIGBIKE';

UPDATE site_settings
SET setting_value = 'PHỤ KIỆN ĐI PHƯỢT MOTO CAO CẤP',
    updated_at = NOW()
WHERE setting_key = 'home_exp_title'
  AND setting_value = 'PHU KIEN DI PHUOT MOTO CAO CAP';

UPDATE site_settings
SET setting_value = 'Tại shop bán đồ phượt moto Bigbike, các sản phẩm đồ bảo hộ moto và phụ kiện phượt rất đa dạng về mẫu mã và kiểu dáng với giá cả vô cùng phải chăng. Ngoài ra, đội ngũ nhân viên của cửa hàng rất am hiểu sản phẩm, sẵn sàng tư vấn và chăm sóc khách hàng khi cần thiết.',
    updated_at = NOW()
WHERE setting_key = 'home_exp_desc'
  AND setting_value LIKE 'Tai shop ban do phuot moto Bigbike%';

COMMIT;
