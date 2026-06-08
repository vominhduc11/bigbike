-- Pass 4: strip remaining Vietnamese prefixes using ILIKE (case-insensitive, works with uppercase VI)
-- Uses SUBSTRING character indexing to skip known prefix lengths

-- Strip "DA BẢO HỘ " (10 chars) prefix from name_en
UPDATE products SET name_en = TRIM(SUBSTRING(name_en FROM 11))
WHERE name_en ILIKE 'DA BẢO HỘ %';

-- Strip "BẢO HỘ DA " (10 chars) prefix
UPDATE products SET name_en = TRIM(SUBSTRING(name_en FROM 11))
WHERE name_en ILIKE 'BẢO HỘ DA %';

-- Strip "BẢO HỘ ADV " (11 chars) prefix
UPDATE products SET name_en = TRIM(SUBSTRING(name_en FROM 12))
WHERE name_en ILIKE 'BẢO HỘ ADV %';

-- Strip "BẢO HỘ " (7 chars) prefix — remaining BẢO HỘ [brand]
UPDATE products SET name_en = TRIM(SUBSTRING(name_en FROM 8))
WHERE name_en ILIKE 'BẢO HỘ %';

-- Strip "THUN LẠNH MẶC TRONG GIÁP " (25 chars)
UPDATE products SET name_en = 'Base Layer Top'
WHERE name_en ILIKE 'THUN LẠNH MẶC TRONG GIÁP%';

-- Strip "MẶC TRONG GIÁP " (16 chars) prefix
UPDATE products SET name_en = TRIM(SUBSTRING(name_en FROM 17))
WHERE name_en ILIKE 'MẶC TRONG GIÁP %';

-- Strip "MANG GIÀY BẢO HỘ " (18 chars) prefix
UPDATE products SET name_en = TRIM(SUBSTRING(name_en FROM 19))
WHERE name_en ILIKE 'MANG GIÀY BẢO HỘ %';

-- Strip "PHƯỢT CHỐNG NƯỚC " (17 chars) prefix
UPDATE products SET name_en = TRIM(SUBSTRING(name_en FROM 18))
WHERE name_en ILIKE 'PHƯỢT CHỐNG NƯỚC %';

-- Strip "MOTO PHƯỢT " (11 chars) prefix
UPDATE products SET name_en = TRIM(SUBSTRING(name_en FROM 12))
WHERE name_en ILIKE 'MOTO PHƯỢT %';

-- Strip "XE MÁY " (7 chars) prefix
UPDATE products SET name_en = TRIM(SUBSTRING(name_en FROM 8))
WHERE name_en ILIKE 'XE MÁY %';

-- Strip "VẢI TÚI KHÍ " (13 chars) prefix — airbag jackets
UPDATE products SET name_en = TRIM(SUBSTRING(name_en FROM 14))
WHERE name_en ILIKE 'VẢI TÚI KHÍ %';

-- Strip "KAKI BẢO HỘ " (12 chars) prefix
UPDATE products SET name_en = TRIM(SUBSTRING(name_en FROM 13))
WHERE name_en ILIKE 'KAKI BẢO HỘ %';

-- Strip "KAKI " (5 chars) prefix
UPDATE products SET name_en = TRIM(SUBSTRING(name_en FROM 6))
WHERE name_en ILIKE 'KAKI %';

-- Strip "NAM/NỮ " (7 chars) prefix
UPDATE products SET name_en = TRIM(SUBSTRING(name_en FROM 8))
WHERE name_en ILIKE 'NAM/NỮ %';

-- Strip "DÀNH CHO MOTOR/XE MÁY " (22 chars)
UPDATE products SET name_en = TRIM(SUBSTRING(name_en FROM 23))
WHERE name_en ILIKE 'DÀNH CHO MOTOR/XE MÁY %';

-- Strip "CHO NÓN BẢO HIỂM " (18 chars) headset prefix
UPDATE products SET name_en = TRIM(SUBSTRING(name_en FROM 1)) || ' Bluetooth Headset'
WHERE name_en ILIKE 'CHO NÓN BẢO HIỂM%Headset';

UPDATE products SET name_en = 'Bluetooth Headset'
WHERE name_en ILIKE 'CHO NÓN BẢO HIỂM%';

-- Strip "THUN MOTO THỜI TRANG " (21 chars) prefix
UPDATE products SET name_en = TRIM(SUBSTRING(name_en FROM 22))
WHERE name_en ILIKE 'THUN MOTO THỜI TRANG %';

-- Strip " HÀNG MỸ" (8 chars) from end of name_en (e.g. "GRAMP BUSTER HÀNG MỸ Throttle Assist")
UPDATE products SET name_en = TRIM(REGEXP_REPLACE(name_en, '\\s+HÀNG MỸ\\s+', ' '))
WHERE name_en ILIKE '% HÀNG MỸ %';

UPDATE products SET name_en = TRIM(REGEXP_REPLACE(name_en, '\\s+HÀNG MỸ$', ''))
WHERE name_en ILIKE '% HÀNG MỸ';

-- Strip "CHỐNG NƯỚC " prefix (remaining gloves/boots)
UPDATE products SET name_en = TRIM(SUBSTRING(name_en FROM 13))
WHERE name_en ILIKE 'CHỐNG NƯỚC %' AND (name_en ILIKE '%Riding Gloves' OR name_en ILIKE '%Motorcycle Boots' OR name_en ILIKE '%Bag');

-- Strip "CHỐNG NƯỚC NHẸ " prefix
UPDATE products SET name_en = TRIM(SUBSTRING(name_en FROM 16))
WHERE name_en ILIKE 'CHỐNG NƯỚC NHẸ %';

-- Strip "CHỐNG NƯỚC " from backpack prefix
UPDATE products SET name_en = TRIM(SUBSTRING(name_en FROM 13))
WHERE name_en ILIKE 'CHỐNG NƯỚC %';

-- Strip "MOTO PHƯỢT " (case-insensitive) various remaining
UPDATE products SET name_en = TRIM(SUBSTRING(name_en FROM 12))
WHERE name_en ILIKE 'Moto phượt %';

-- Fix "GÀI NẮP BÌNH XĂNG " products (fuel cap accessories)
UPDATE products SET name_en = TRIM(SUBSTRING(name_en FROM 1))
WHERE name_en ILIKE 'GÀI NẮP BÌNH XĂNG%Backpack';

UPDATE products SET name_en = TRIM(REGEXP_REPLACE(normalize(name, NFC), E'(?i)^gài\\s+nắp\\s+bình\\s+xăng\\s*', '')) || ' Fuel Cap Accessory'
WHERE name ILIKE 'GÀI NẮP BÌNH XĂNG%';

-- Fix remaining "FULLFACE KÉO CẰM Balaclava" — this is a flip-up helmet, not balaclava
UPDATE products SET name_en = 'Flip-Up Full Face Helmet'
WHERE name_en ILIKE 'FULLFACE KÉO CẰM%';

-- Fix "cào cào Beon Red Dual Sport Helmet" → just "Beon Red Dual Sport Helmet"
UPDATE products SET name_en = TRIM(SUBSTRING(name_en FROM 10))
WHERE name_en ILIKE 'cào cào %';

-- Fix "BẢO VỆ GỐI % Body Armor" → "% Knee Guard"
UPDATE products SET name_en = TRIM(REGEXP_REPLACE(name_en, E'(?i)^bảo\\s+vệ\\s+gối\\s*', '')) || ' Knee Guard'
WHERE name_en ILIKE 'BẢO VỆ GỐI %';

UPDATE products SET name_en = TRIM(SUBSTRING(name_en FROM 13)) || ' Knee Guard'
WHERE name_en ILIKE 'BẢO VỆ GỐI %';

-- Fix "CHÂN SCOYCO K12 YELLOW Body Armor" (CHÂN = leg)
UPDATE products SET name_en = TRIM(SUBSTRING(name_en FROM 6))
WHERE name_en ILIKE 'CHÂN %' AND name_en ILIKE '% Body Armor';

-- Fix "LƯNG ALPINESTARS" etc remaining
UPDATE products SET name_en = TRIM(SUBSTRING(name_en FROM 6))
WHERE name_en ILIKE 'LƯNG %';

-- Fix "KOMINE CHÍNH HÃNG " prefix → strip to "KOMINE"
UPDATE products SET name_en = 'KOMINE ' || TRIM(SUBSTRING(name_en FROM 17))
WHERE name_en ILIKE 'KOMINE CHÍNH HÃNG %';

-- Fix trailing " chính hãng" (lowercase)
UPDATE products SET name_en = TRIM(SUBSTRING(name_en FROM 1 FOR LENGTH(name_en) - 12))
WHERE name_en ILIKE '% chính hãng' AND LENGTH(name_en) > 12;

-- Fix "Madbike Gù Inox 2015 Đỏ Riding Gloves" → "Madbike Gù Inox 2015 Riding Gloves" (Đỏ=Red)
UPDATE products SET name_en = TRIM(REPLACE(name_en, ' Đỏ ', ' Red '))
WHERE name_en ILIKE '%Đỏ%';

-- Fix "ĐÁNH BÓNG NHANH BẢO VỆ DÀN ÁO XE Cleaning Solution" → just keep the brand
UPDATE products SET name_en = 'LIQUI MOLY 250ml Quick Polish & Paint Protector'
WHERE name_en ILIKE '%ĐÁNH BÓNG NHANH%';

-- Fix remaining "DƯỠNG SÊN LIQUI MOLY" → "LIQUI MOLY Chain Lubricant"
UPDATE products SET name_en = 'LIQUI MOLY Chain Lubricant'
WHERE name_en ILIKE '%DƯỠNG SÊN%' OR name_en ILIKE 'LIQUI MOLY%Chain Lubricant%';

-- Fix "MENAT MB018 ĐA NĂNG CHỐNG NƯỚC Waterproof Backpack Tank Backpack" — double suffix
UPDATE products SET name_en = TRIM(REPLACE(name_en, 'Waterproof Backpack Tank Backpack', 'Tank Backpack'))
WHERE name_en ILIKE '% Waterproof Backpack Tank Backpack';

-- Strip "ĐA NĂNG CHỐNG NƯỚC " from backpack
UPDATE products SET name_en = TRIM(REPLACE(name_en, ' ĐA NĂNG CHỐNG NƯỚC', ''))
WHERE name_en ILIKE '%ĐA NĂNG CHỐNG NƯỚC%';

-- Fix "GÀI NẮP BÌNH XĂNG " tank cap accessories
UPDATE products SET name_en = TRIM(SUBSTRING(name_en FROM 20)) || ' Tank Cap Accessory'
WHERE name_en ILIKE 'GÀI NẮP BÌNH XĂNG %';

-- Strip trailing Vietnamese certification notes: "CHUẨN ECE 06" / "CHUẨN DOT"
UPDATE products SET name_en = TRIM(REGEXP_REPLACE(name_en, '\\s+CHUẨN\\s+(ECE|DOT)[^\\s]*\\s*', ' '))
WHERE name_en ILIKE '% CHUẨN %';

-- Strip "ID Venom THÁI LAN " prefix (THÁI LAN = Thailand)
UPDATE products SET name_en = TRIM(REPLACE(name_en, ' THÁI LAN ', ' '))
WHERE name_en ILIKE '%THÁI LAN%';

-- Strip "THÁI LAN " prefix from socks
UPDATE products SET name_en = TRIM(SUBSTRING(name_en FROM 10))
WHERE name_en ILIKE 'THÁI LAN %';

-- Fix "CACBON " → "CARBON " (typo in original)
UPDATE products SET name_en = TRIM(REPLACE(name_en, 'CACBON ', 'CARBON '))
WHERE name_en ILIKE 'CACBON%';

-- Fix "TREO 2 BÊN HÔNG XE " prefix (side-mounted bags) → "Side"
UPDATE products SET name_en = '2-Side ' || TRIM(SUBSTRING(name_en FROM 20))
WHERE name_en ILIKE 'TREO 2 BÊN HÔNG XE %';

-- Fix "CHỐNG NƯỚC, GIỮ ẤM " prefix from gloves
UPDATE products SET name_en = TRIM(SUBSTRING(name_en FROM 1))
WHERE name_en ILIKE 'SCOYCO%CHỐNG NƯỚC%Riding Gloves';

UPDATE products SET name_en = TRIM(REGEXP_REPLACE(name_en, '\\s+CHỐNG NƯỚC,\\s+GIỮ ẤM\\s+', ' '))
WHERE name_en ILIKE '%CHỐNG NƯỚC, GIỮ ẤM%';

-- Fix "FULLFACE KÉO CẰM" -- flip-up balaclava (actually helmet balaclava inner liner)
UPDATE products SET name_en = 'Full Face Flip-Up Balaclava'
WHERE name_en ILIKE '%FULLFACE KÉO CẰM%';

-- Fix remaining name_en that are FULLY uppercase Vietnamese (no English suffix yet)
-- These are the misc "OTHER" items that weren't covered
UPDATE products SET name_en = normalize(name, NFC)
WHERE name_en ~ '[àáảãạăắặẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđÀÁẢÃẠĂẮẶẲẴẶÂẤẦẨẪẬÈÉẺẼẸÊẾỀỂỄỆÌÍỈĨỊÒÓỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÙÚỦŨỤƯỨỪỬỮỰỲÝỶỸỴĐ]'
AND name_en = name;  -- name_en is still exactly the original name

-- Final seo_title_en sync
UPDATE products SET seo_title_en = name_en
WHERE seo_title_en IS NOT NULL
  AND seo_title_en ~ '[àáảãạăắặẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđÀÁẢÃẠĂẮẶẲẴẶÂẤẦẨẪẬÈÉẺẼẸÊẾỀỂỄỆÌÍỈĨỊÒÓỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÙÚỦŨỤƯỨỪỬỮỰỲÝỶỸỴĐ]';
