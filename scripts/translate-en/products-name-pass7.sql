-- Pass 7: strip remaining Vietnamese qualifiers and fix specific product types

-- Strip "CHỐNG THẤM NƯỚC" / "THẤM NƯỚC" from anywhere
UPDATE products SET name_en = TRIM(REPLACE(REPLACE(name_en, ' CHỐNG THẤM NƯỚC', ''), ' chống thấm nước', ''))
WHERE name_en ILIKE '%THẤM NƯỚC%';

-- Strip "CHO NAM VÀ NỮ" / "CHO NAM/NỮ" / "CHO NAM" (for men and women)
UPDATE products SET name_en = TRIM(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(name_en,
  ' CHO NAM VÀ NỮ', ''), ' CHO NAM/NỮ', ''), ' DÀNH CHO NAM/NỮ', ''), ' CHO NAM', ''), '  ', ' '))
WHERE name_en ILIKE '%CHO NAM%' OR name_en ILIKE '%DÀNH CHO NAM%';

-- Translate "KÍNH" → "Lens" in helmet name_en (context: "2 KÍNH" = double lens)
UPDATE products SET name_en = TRIM(REPLACE(REPLACE(name_en, ' 2 KÍNH', ' Double Lens'), ' 1 KÍNH', ' Single Lens'))
WHERE name_en ILIKE '%KÍNH%' AND (name_en ILIKE '%Helmet%' OR name_en ILIKE '%Face%');

-- Fix "LẬT CẰM" remaining in helmet names → convert to "Flip-Up" type
UPDATE products SET name_en = TRIM(REPLACE(name_en, 'LẬT CẰM ', '')) || ' Flip-Up Helmet'
WHERE name_en ILIKE 'LẬT CẰM %' AND name_en ILIKE '%Helmet%';

-- Strip "CHUẨN ECE%"/"CHUẨN DOT%" from helmet names
UPDATE products SET name_en = TRIM(REGEXP_REPLACE(name_en, '\\s+CHUẨN\\s+(ECE|DOT)[^\\s]*\\s*', ' '))
WHERE name_en ILIKE '%CHUẨN %';

-- Strip "THOÁNG KHÍ" (breathable/ventilated) from gloves/jackets
UPDATE products SET name_en = TRIM(REPLACE(REPLACE(name_en, ' THOÁNG KHÍ', ''), '  ', ' '))
WHERE name_en ILIKE '% THOÁNG KHÍ%';

-- Translate "LƯỚI" → "Mesh" in pants
UPDATE products SET name_en = TRIM(REPLACE(name_en, 'LƯỚI ', 'Mesh '))
WHERE name_en ILIKE 'LƯỚI %';

-- Fix "JEAN BẢO HỘ" → "Denim" riding pants
UPDATE products SET name_en = TRIM(REPLACE(name_en, 'JEAN BẢO HỘ ', 'Denim '))
WHERE name_en ILIKE 'JEAN BẢO HỘ %';

UPDATE products SET name_en = TRIM(REPLACE(name_en, 'JEAN ', 'Denim '))
WHERE name_en ILIKE 'JEAN %';

-- Fix "CHÂN SCOYCO" → "SCOYCO" (fix double strip artifact)
UPDATE products SET name_en = TRIM(SUBSTRING(name_en FROM 6))
WHERE name_en ILIKE 'CHÂN %';

-- Fix "HÔNG TAICHI" prefix (hip armor)
UPDATE products SET name_en = TRIM(SUBSTRING(name_en FROM 6)) || ' Hip Armor'
WHERE name_en ILIKE 'HÔNG %' AND name_en ILIKE '%Body Armor%';

-- Fix "KNEE SLIDER SK-625 CHO QUẦN KOMINE Knee/Elbow Armor" → clean up
UPDATE products SET name_en = TRIM(REPLACE(REPLACE(name_en, ' CHO QUẦN', ''), '  ', ' '))
WHERE name_en ILIKE '%CHO QUẦN%';

-- Fix "ngực & lưng Scoyco" (chest & back) prefix → "Scoyco Chest & Back Armor"
UPDATE products SET name_en = TRIM(REPLACE(REPLACE(REPLACE(name_en, 'ngực & lưng ', ''), 'Đen', 'Black'), '  ', ' '))
WHERE name_en ILIKE 'ngực%';

-- Fix "RỜI " prefix (removable/separate) → strip
UPDATE products SET name_en = TRIM(SUBSTRING(name_en FROM 5))
WHERE name_en ILIKE 'RỜI %';

-- Fix "PHƯỢT NỮ " prefix remaining boots
UPDATE products SET name_en = TRIM(SUBSTRING(name_en FROM 10))
WHERE name_en ILIKE 'PHƯỢT NỮ %';

-- Fix "da thật 100% (thanh lý)" → "Genuine Leather (Clearance)"
UPDATE products SET name_en = TRIM(REPLACE(REPLACE(name_en, 'da thật 100% (thanh lý)', 'Genuine Leather (Clearance)'), '  ', ' '))
WHERE name_en ILIKE '%da thật%';

-- Fix "& cảm ứng" → "Touchscreen" in gloves
UPDATE products SET name_en = TRIM(REPLACE(REPLACE(name_en, '& cảm ứng', 'Touchscreen'), 'cảm ứng', 'Touchscreen'))
WHERE name_en ILIKE '%cảm ứng%';

-- Fix "chống thấm nước - chống lạnh" prefix
UPDATE products SET name_en = TRIM(REPLACE(name_en, 'chống thấm nước - chống lạnh ', ''))
WHERE name_en ILIKE 'chống thấm nước%';

-- Fix "DÀNH CHO SUIT DA 1 - 2 MẢNH " prefix (for leather suit)
UPDATE products SET name_en = TRIM(SUBSTRING(name_en FROM 26)) || ' for Leather Suit'
WHERE name_en ILIKE 'DÀNH CHO SUIT DA%';

-- Fix "HÀNG USA" from balaclava name
UPDATE products SET name_en = TRIM(REPLACE(REPLACE(name_en, ' hàng USA', ''), ' HÀNG USA', ''))
WHERE name_en ILIKE '%hàng USA%' OR name_en ILIKE '%HÀNG USA%';

-- Fix "BÌNH CO2 DÙNG CHO ÁO KHOÁC HELITE AIRBAG VEST 60cc" → "HELITE CO2 Cartridge 60cc for Airbag Vest"
UPDATE products SET name_en = 'HELITE CO2 Cartridge 60cc for Airbag Vest'
WHERE name_en ILIKE 'BÌNH CO2%HELITE%';

-- Fix "PHƯỢT MÔ TÔ" / "ĐI PHƯỢT MÔ TÔ" from anywhere in name_en
UPDATE products SET name_en = TRIM(REPLACE(REPLACE(REPLACE(name_en, ' ĐI PHƯỢT MÔ TÔ', ''), ' PHƯỢT MÔ TÔ', ''), '  ', ' '))
WHERE name_en ILIKE '%PHƯỢT MÔ TÔ%';

-- Fix "MÔ TÔ XE MÁY PHƯỢT " prefix remaining boots
UPDATE products SET name_en = TRIM(SUBSTRING(name_en FROM 21))
WHERE name_en ILIKE 'MOTO XE MÁY PHƯỢT %';

-- Fix "ĐI MOTO XE MÁY PHƯỢT NỮ " prefix
UPDATE products SET name_en = TRIM(SUBSTRING(name_en FROM 25))
WHERE name_en ILIKE 'ĐI MOTO XE MÁY PHƯỢT NỮ %';

-- Fix "CÓ MŨ " prefix (with hood)
UPDATE products SET name_en = TRIM(SUBSTRING(name_en FROM 7))
WHERE name_en ILIKE 'CÓ MŨ %';

-- Fix "Mũ bảo hiểm fulface LS2 FF325G Motorcycle Helmet" → clean up VI prefix
UPDATE products SET name_en = TRIM(REGEXP_REPLACE(name_en, E'(?i)^mũ\\s+bảo\\s+hiểm\\s+(fulface|fullface)?\\s*', ''))
WHERE name_en ILIKE 'Mũ bảo hiểm%';

-- Fix "ninja " prefix from balaclava
UPDATE products SET name_en = TRIM(SUBSTRING(name_en FROM 7))
WHERE name_en ILIKE 'ninja %';

-- Fix "túi nước" → "Hydration" prefix
UPDATE products SET name_en = 'Hydration ' || TRIM(SUBSTRING(name_en FROM 10))
WHERE name_en ILIKE 'túi nước %';

-- Fix "TÚI KRIEGA US Luggage Strap Accessory" → "KRIEGA US Luggage Strap Accessory"
UPDATE products SET name_en = 'KRIEGA US Luggage Strap Accessory'
WHERE name_en ILIKE 'TÚI KRIEGA US%';

-- Fix "ĐUÔI XE MOTO PHƯỢT GSADV Bag" → "GSADV Tail Bag"
UPDATE products SET name_en = TRIM(REPLACE(REPLACE(name_en, 'ĐUÔI XE MOTO PHƯỢT ', ''), '  ', ' '))
WHERE name_en ILIKE 'ĐUÔI XE%';

-- Fix "CAO CỔ BẢO HỘ ĐUA ILM BRC1 Motorcycle Boots" → "ILM BRC1 Racing High-Top Boots"
UPDATE products SET name_en = TRIM(REPLACE(REPLACE(name_en, 'CAO CỔ BẢO HỘ ĐUA ', ''), '  ', ' '))
WHERE name_en ILIKE 'CAO CỔ%';

-- Fix "Mũ bảo hiểm lật cằm Thái Lan Rider % " → strip remaining prefix
UPDATE products SET name_en = TRIM(SUBSTRING(name_en FROM 12))
WHERE name_en ILIKE 'Thái Lan %';

-- Fix "MŨ FULLFACE LS2 FF807 DRAGON CARBON 6K - 2 KÍNH Full Face Helmet" — double suffix
UPDATE products SET name_en = TRIM(REPLACE(name_en, ' Full Face Helmet Full Face Helmet', ' Full Face Helmet'))
WHERE name_en ILIKE '%Full Face Helmet Full Face Helmet';

-- Strip trailing orphaned "Face Helmet" if already has correct type
UPDATE products SET name_en = TRIM(REPLACE(name_en, ' Full Face Helmet Flip-Up Helmet', ' Flip-Up Helmet'))
WHERE name_en ILIKE '%Face Helmet Flip-Up Helmet';

-- Final sync seo_title_en
UPDATE products SET seo_title_en = name_en
WHERE seo_title_en IS NOT NULL
  AND seo_title_en ~ '[àáảãạăắặẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđÀÁẢÃẠĂẮẶẲẴẶÂẤẦẨẪẬÈÉẺẼẸÊẾỀỂỄỆÌÍỈĨỊÒÓỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÙÚỦŨỤƯỨỪỬỮỰỲÝỶỸỴĐ]';
