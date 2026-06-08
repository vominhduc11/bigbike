-- Pass 5: final Vietnamese prefix/middle/suffix stripping pass

-- Strip "ĐI MOTO PHƯỢT " / "MÔ TÔ PHƯỢT " / "MOTO PHƯỢT " from start of name_en
UPDATE products SET name_en = TRIM(SUBSTRING(name_en FROM 16))
WHERE name_en ILIKE 'ĐI MOTO PHƯỢT %';

UPDATE products SET name_en = TRIM(SUBSTRING(name_en FROM 12))
WHERE name_en ILIKE 'MÔ TÔ PHƯỢT %';

-- Strip "CỤT NGÓN " (fingerless, 9 chars)
UPDATE products SET name_en = 'Fingerless ' || TRIM(SUBSTRING(name_en FROM 10))
WHERE name_en ILIKE 'CỤT NGÓN %';

UPDATE products SET name_en = 'Fingerless ' || TRIM(SUBSTRING(name_en FROM 11))
WHERE name_en ILIKE 'cụt ngón %';

-- Strip "THUN LÓT " (thermal/compression, 9 chars)
UPDATE products SET name_en = TRIM(SUBSTRING(name_en FROM 10))
WHERE name_en ILIKE 'THUN LÓT %';

UPDATE products SET name_en = TRIM(SUBSTRING(name_en FROM 11))
WHERE name_en ILIKE 'thun lạnh %';

-- Strip "ĐEO LƯNG" (shoulder/back) from backpack/bag prefix
UPDATE products SET name_en = TRIM(SUBSTRING(name_en FROM 10))
WHERE name_en ILIKE 'ĐEO LƯNG%' AND name_en ILIKE '%Backpack';

-- Strip "ĐEO LƯNG" prefix + model for bags
UPDATE products SET name_en = TRIM(SUBSTRING(name_en FROM 10))
WHERE name_en ILIKE 'ĐEO LƯNG%';

-- Strip "NGỰC RỜI " (removable chest plate, 9 chars) → chest protector
UPDATE products SET name_en = TRIM(SUBSTRING(name_en FROM 10)) || ' Chest Protector'
WHERE name_en ILIKE 'NGỰC RỜI %';

-- Strip "CHO NGƯỜI ĐI XE MÁY " prefix (for motorcyclists, 21 chars)
UPDATE products SET name_en = TRIM(SUBSTRING(name_en FROM 22))
WHERE name_en ILIKE 'CHO NGƯỜI ĐI XE MÁY %';

-- Strip "CỔ THẤP " (low-ankle, 8 chars) from boots
UPDATE products SET name_en = TRIM(SUBSTRING(name_en FROM 9))
WHERE name_en ILIKE 'CỔ THẤP %';

-- Fix "- VAI - LƯNG D30 Body Armor Set" → "D30 Shoulder & Back Armor"
UPDATE products SET name_en = TRIM(SUBSTRING(name_en FROM 17))
WHERE name_en ILIKE '- VAI - LƯNG %';

-- Strip "TREO HAI BÊN HÔNG XE " prefix (both sides of bike, 22 chars)
UPDATE products SET name_en = '2-Side ' || TRIM(SUBSTRING(name_en FROM 23))
WHERE name_en ILIKE 'TREO HAI BÊN HÔNG XE %';

-- Strip "XE CHỐNG NƯỚC " prefix (12 chars) for bags
UPDATE products SET name_en = TRIM(SUBSTRING(name_en FROM 13))
WHERE name_en ILIKE 'XE CHỐNG NƯỚC %';

-- Strip leading "HẸ " (mistaken prefix from "CHỐNG NHẸ" stripping)
UPDATE products SET name_en = TRIM(SUBSTRING(name_en FROM 4))
WHERE name_en ILIKE 'HẸ %';

-- Fix "GIVI - EA104C - 22 LÍT Backpack" → "GIVI EA104C 22L Backpack"
UPDATE products SET name_en = TRIM(REPLACE(REPLACE(name_en, ' LÍT ', 'L '), ' - ', ' '))
WHERE name_en ILIKE '%LÍT%';

-- Fix "FOGCITY CỦA Ý" → "FOGCITY Italy" (CỦA Ý = Italian)
UPDATE products SET name_en = TRIM(REPLACE(name_en, ' CỦA Ý', ' Italy'))
WHERE name_en ILIKE '%CỦA Ý%';

-- Fix " CHỐNG NƯỚC" in MIDDLE of backpack names (strip Vietnamese waterproof qualifier)
UPDATE products SET name_en = TRIM(REPLACE(name_en, ' CHỐNG NƯỚC', ''))
WHERE name_en ILIKE '% CHỐNG NƯỚC %' OR name_en ILIKE '% CHỐNG NƯỚC';

-- Fix "/BẢO VỆ LƯNG " prefix (remaining lumbar belts)
UPDATE products SET name_en = TRIM(SUBSTRING(name_en FROM 15))
WHERE name_en ILIKE '/BẢO VỆ LƯNG %';

-- Fix "cho áo Body Armor Set" → "For Jacket Body Armor"
UPDATE products SET name_en = 'For Jacket Body Armor'
WHERE name_en ILIKE 'cho áo%';

-- Fix "CHỐNG MỎI " in lumbar belt names
UPDATE products SET name_en = TRIM(REPLACE(name_en, ' CHỐNG MỎI', ''))
WHERE name_en ILIKE '%CHỐNG MỎI%';

-- Fix "APRO CHO NỮ Women's Riding Jacket" → "APRO Women's Riding Jacket"
UPDATE products SET name_en = TRIM(REPLACE(name_en, ' CHO NỮ ', ' '))
WHERE name_en ILIKE '%CHO NỮ%';

-- Fix "ĐAI LƯNG " prefix remaining → "Lumbar Belt" type
UPDATE products SET name_en = TRIM(SUBSTRING(name_en FROM 9)) || ' Lumbar Support Belt'
WHERE name_en ILIKE 'ĐAI LƯNG %' AND name_en NOT ILIKE '% Support Belt%';

-- Fix "TAICHI CHỐNG NƯỚC RSB288" → strip
UPDATE products SET name_en = TRIM(REPLACE(name_en, 'CHỐNG NƯỚC ', ''))
WHERE name_en ILIKE '%CHỐNG NƯỚC%';

-- Strip remaining "THÁI LAN " (Thailand origin, 9 chars) from beginning
UPDATE products SET name_en = TRIM(SUBSTRING(name_en FROM 10))
WHERE name_en ILIKE 'Thái Lan %' OR name_en ILIKE 'THÁI LAN %';

-- Strip "Mũ bảo hiểm đi Mo to, xe máy, phượt - " prefix from complex helmet names
UPDATE products SET name_en = TRIM(SUBSTRING(name_en FROM 42))
WHERE name_en ILIKE 'Mũ bảo hiểm đi Mo to, xe máy, phượt - %';

-- Strip "lật cằm" (flip-up jaw) from remaining balaclava/helmet names
UPDATE products SET name_en = TRIM(REPLACE(TRIM(REPLACE(name_en, 'lật cằm ', '')), '  ', ' '))
WHERE name_en ILIKE '%lật cằm%';

-- Strip "GÙ INOX " type qualifier from gloves (GÙ = knuckle, INOX = stainless steel)
UPDATE products SET name_en = TRIM(REPLACE(name_en, ' Gù Inox ', ' Knuckle Armor '))
WHERE name_en ILIKE '%Gù Inox%';

-- Fix "MOTO GIVI TANKBAG CRM103 - 8 LÍT Bag Tank Bag" → "GIVI CRM103 8L Tank Bag"
UPDATE products SET name_en = TRIM(REPLACE(REPLACE(REPLACE(name_en, 'MOTO GIVI TANKBAG ', 'GIVI Tankbag '), ' Bag Tank Bag', ' Tank Bag'), ' LÍT', 'L'))
WHERE name_en ILIKE 'MOTO GIVI TANKBAG%';

-- Strip remaining "MÔ TÔ " prefix
UPDATE products SET name_en = TRIM(SUBSTRING(name_en FROM 7))
WHERE name_en ILIKE 'MÔ TÔ %';

-- Final: Strip any remaining leading Vietnamese words from name_en for product types that have English suffix
-- For items with " Riding Jacket" suffix — strip up to first ASCII-starting word
UPDATE products SET name_en = normalize(name, NFC)
WHERE name_en ~ '[àáảãạăắặẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđÀÁẢÃẠĂẮẶẲẴẶÂẤẦẨẪẬÈÉẺẼẸÊẾỀỂỄỆÌÍỈĨỊÒÓỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÙÚỦŨỤƯỨỪỬỮỰỲÝỶỸỴĐ]'
AND name_en = name AND name_en IS NOT NULL;

-- Final seo_title_en sync
UPDATE products SET seo_title_en = name_en
WHERE seo_title_en IS NOT NULL
  AND seo_title_en ~ '[àáảãạăắặẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđÀÁẢÃẠĂẮẶẲẴẶÂẤẦẨẪẬÈÉẺẼẸÊẾỀỂỄỆÌÍỈĨỊÒÓỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÙÚỦŨỤƯỨỪỬỮỰỲÝỶỸỴĐ]';
