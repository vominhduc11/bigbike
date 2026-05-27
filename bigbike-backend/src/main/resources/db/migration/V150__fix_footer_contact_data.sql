-- V150: Fix footer contact data to match WP reference.
-- Updates phone numbers, email, footer description, and adds hotline_3.

-- Primary hotline: 028 6279 7251
UPDATE site_settings
SET    setting_value = '028 6279 7251',
       updated_at    = now()
WHERE  setting_key   = 'hotline';

-- Secondary hotline with Zalo label: 0764 640 679 - Mrs. Thư / Zalo
UPDATE site_settings
SET    setting_value = '0764 640 679 - Mrs. Thư / Zalo',
       updated_at    = now()
WHERE  setting_key   = 'hotline_2';

-- Third hotline: 0906 902 404 - Mr. Trí
INSERT INTO site_settings (id, setting_key, setting_value, setting_group, is_public, description, created_at, updated_at)
SELECT '00000000-0000-0000-0000-000000000539', 'hotline_3',
       '0906 902 404 - Mr. Trí', 'contact', true,
       'Third hotline number displayed in the footer.', now(), now()
WHERE NOT EXISTS (SELECT 1 FROM site_settings WHERE setting_key = 'hotline_3');

-- Contact email: bigbikevnshop@gmail.com
UPDATE site_settings
SET    setting_value = 'bigbikevnshop@gmail.com',
       updated_at    = now()
WHERE  setting_key   = 'contact_email';

-- Footer description: WP-accurate shop description
UPDATE site_settings
SET    setting_value = 'Shop Bigbike.vn chuyên cung cấp đồ bảo hộ moto, xe máy, phượt, mũ bảo hộ Full Face, Mũ lật cằm, mũ 3/4, mũ cào cào, áo giáp quần bảo hộ, găng tay, balo, túi đeo moto, xe máy và các phụ kiện thời trang....',
       updated_at    = now()
WHERE  setting_key   = 'footer_description';

-- BCT registration URL: exact online.gov.vn link
UPDATE site_settings
SET    setting_value = 'http://online.gov.vn/Home/WebDetails/27044',
       updated_at    = now()
WHERE  setting_key   = 'bct_url';
