-- Pass 8: final cleanup batch

-- Fix "DÀNH MÀU" / "DÀNH " orphan prefix (leftover from CHO NAM stripping)
UPDATE products SET name_en = TRIM(REPLACE(REPLACE(name_en, 'DÀNH MÀU ', ''), 'DÀNH ', ''))
WHERE name_en ILIKE 'DÀNH%';

-- Fix remaining CHUẨN ECE/DOT — force strip
UPDATE products SET name_en = TRIM(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
  name_en,
  ' CHUẨN ECE 22.06', ''), ' CHUẨN ECE.06', ''), ' CHUẨN ECE 06', ''), ' CHUẨN DOT', ''), ' CHUẨN ECE', ''))
WHERE name_en ILIKE '%CHUẨN ECE%' OR name_en ILIKE '%CHUẨN DOT%';

-- Fix "MAU KHÔ" (quick-dry) from pants
UPDATE products SET name_en = TRIM(REPLACE(REPLACE(name_en, ' MAU KHÔ', ''), '  ', ' '))
WHERE name_en ILIKE '%MAU KHÔ%';

-- Fix "CHO NỮ " prefix (remaining)
UPDATE products SET name_en = TRIM(SUBSTRING(name_en FROM 8))
WHERE name_en ILIKE 'CHO NỮ %';

-- Fix lowercase "chân, giáp chân " prefix from armor
UPDATE products SET name_en = TRIM(REPLACE(REPLACE(name_en, 'chân, giáp chân ', ''), 'giáp chân ', ''))
WHERE name_en ILIKE 'chân%';

-- Fix "MẶC TRONG ÁO BẢO HỘ" suffix from base layer
UPDATE products SET name_en = TRIM(REPLACE(name_en, ' MẶC TRONG ÁO BẢO HỘ', ''))
WHERE name_en ILIKE '% MẶC TRONG ÁO BẢO HỘ%';

-- Translate lowercase color "đen" → "Black", "đỏ" → "Red", "trắng" → "White", "xám" → "Gray"
UPDATE products SET name_en = TRIM(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
  name_en,
  ' đen nhám', ' Matte Black'),
  ' đen', ' Black'),
  ' đỏ', ' Red'),
  ' trắng', ' White'),
  ' xanh', ' Blue'),
  ' vàng', ' Yellow'),
  ' xám', ' Gray'),
  ' nâu', ' Brown'),
  ' tím', ' Purple'),
  ' cam', ' Orange'))
WHERE name_en ~ '[àáảãạăắặẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđ]';

-- Fix "CHỐNG NƯỚC " prefix (remaining from gloves)
UPDATE products SET name_en = TRIM(SUBSTRING(name_en FROM 13))
WHERE name_en ILIKE 'CHỐNG NƯỚC %';

-- Fix "MƯA CÓ GIÁP BẢO HỘ " prefix (rain jacket with armor)
UPDATE products SET name_en = TRIM(SUBSTRING(name_en FROM 20)) || ' Rain & Armor'
WHERE name_en ILIKE 'MƯA CÓ GIÁP BẢO HỘ %';

-- Fix "ĐEO " prefix from bags
UPDATE products SET name_en = TRIM(SUBSTRING(name_en FROM 5))
WHERE name_en ILIKE 'ĐEO %' AND name_en ILIKE '%Bag';

-- Fix "KÉO CẰM " prefix (chin-pull balaclava)
UPDATE products SET name_en = TRIM(SUBSTRING(name_en FROM 9))
WHERE name_en ILIKE 'KÉO CẰM %';

-- Fix "NỬA ĐẦU" in helmet name_en → "Half-Face"
UPDATE products SET name_en = TRIM(REPLACE(name_en, 'NỬA ĐẦU ', 'Half-Face '))
WHERE name_en ILIKE 'NỬA ĐẦU%';

-- Fix "CỔ ĐIỂN" → "Classic" in helmet names
UPDATE products SET name_en = TRIM(REPLACE(REPLACE(name_en, ' CỔ ĐIỂN', ' Classic'), '  ', ' '))
WHERE name_en ILIKE '% CỔ ĐIỂN%';

-- Fix "TÚI KHÍ " prefix from airbag jacket
UPDATE products SET name_en = TRIM(SUBSTRING(name_en FROM 9))
WHERE name_en ILIKE 'TÚI KHÍ %';

-- Fix "BẢO HỘ " remaining prefix after Mesh
UPDATE products SET name_en = TRIM(REPLACE(name_en, 'Mesh BẢO HỘ ', 'Mesh '))
WHERE name_en ILIKE 'Mesh BẢO HỘ %';

-- Fix "MƯA " prefix remaining
UPDATE products SET name_en = TRIM(SUBSTRING(name_en FROM 5))
WHERE name_en ILIKE 'MƯA %';

-- Fix "đen nhám" → "Matte Black" (lowercase, in middle)
UPDATE products SET name_en = TRIM(REPLACE(REPLACE(name_en, ' đen nhám', ' Matte Black'), '  ', ' '))
WHERE name_en ILIKE '%đen nhám%';

-- Fix "- 2 CÁI" → "(Set of 2)" in balaclava
UPDATE products SET name_en = TRIM(REPLACE(name_en, '- 2 CÁI', '(Set of 2)'))
WHERE name_en ILIKE '%2 CÁI%';

-- Fix "THUN CÀO CÀO FOX" → "FOX Dual Sport Riding Jersey"
UPDATE products SET name_en = TRIM(REPLACE(name_en, 'THUN CÀO CÀO ', '')) || ' Dual Sport Jersey'
WHERE name_en ILIKE 'THUN CÀO CÀO %' AND name_en ILIKE '%Riding Jacket';

UPDATE products SET name_en = TRIM(REPLACE(REPLACE(name_en, ' MÀU', ''), '  ', ' '))
WHERE name_en ILIKE '% MÀU %';

-- Fix "vest phản quang" prefix → "Reflective Vest" type
UPDATE products SET name_en = TRIM(SUBSTRING(name_en FROM 15))
WHERE name_en ILIKE 'vest phản quang %';

-- Fix "DA MOTO XE MÁY PHƯỢT URBAN CITY " prefix from boots
UPDATE products SET name_en = TRIM(SUBSTRING(name_en FROM 26))
WHERE name_en ILIKE 'DA MOTO XE MÁY PHƯỢT URBAN CITY %';

-- Fix "DÀNH CHO CẶP ĐÔI - " prefix from headset
UPDATE products SET name_en = TRIM(REPLACE(REPLACE(name_en, 'DÀNH CHO CẶP ĐÔI - ', ''), '  ', ' '))
WHERE name_en ILIKE 'DÀNH CHO CẶP ĐÔI%';

-- Fix "treo 2 bên xe " lowercase bag prefix
UPDATE products SET name_en = 'Tanked Racing 2-Side Bag'
WHERE name_en ILIKE 'treo 2 bên xe Tanked Racing%';

-- Fix "ĐẦU FULLFACE BALACLAVA" prefix
UPDATE products SET name_en = TRIM(SUBSTRING(name_en FROM 17))
WHERE name_en ILIKE 'ĐẦU FULLFACE BALACLAVA %';

-- Fix "RÀNG YÊN XE " → seat bag
UPDATE products SET name_en = TRIM(REPLACE(name_en, 'RÀNG YÊN XE ', '')) || ' Seat Bag'
WHERE name_en ILIKE 'RÀNG YÊN XE %';

-- Fix "full ngón" → "Full-Finger"
UPDATE products SET name_en = TRIM(REPLACE(REPLACE(name_en, 'full ngón ', 'Full-Finger '), 'cụt ngón ', 'Fingerless '))
WHERE name_en ILIKE '%ngón%';

-- Fix "Duhan có giáp lưng" → "Duhan" (back protector is a feature)
UPDATE products SET name_en = TRIM(REPLACE(name_en, ' có giáp lưng', ''))
WHERE name_en ILIKE '% có giáp lưng%';

-- Fix "LÓT " prefix from gloves (liner gloves)
UPDATE products SET name_en = 'Liner ' || TRIM(SUBSTRING(name_en FROM 5))
WHERE name_en ILIKE 'LÓT %';

-- Fix "đeo chéo Givi cho Ipad" → "Givi iPad Cross-Body Bag"
UPDATE products SET name_en = 'Givi iPad Cross-Body Bag'
WHERE name_en ILIKE 'đeo chéo Givi cho Ipad%';

-- Fix "CẶP CHÀ GỐI ALPINESTARS" → "ALPINESTARS Knee Slider Set"
UPDATE products SET name_en = 'ALPINESTARS SPORT KNEE SLIDERS Set'
WHERE name_en ILIKE 'CẶP CHÀ GỐI ALPINESTARS%';

-- Fix remaining BALACLAVA: "RSC120 - 2 CÁI Balaclava" → OK after above, no change needed

-- Fix "BẢO HỘ Body Armor Hip Armor" double suffix from HÔNG strip
UPDATE products SET name_en = TRIM(REPLACE(name_en, ' BẢO HỘ Body Armor Hip Armor', ' Hip Armor'))
WHERE name_en ILIKE '%BẢO HỘ Body Armor Hip Armor%';

-- Fix remaining prefix "CHÂN " if remaining
UPDATE products SET name_en = TRIM(SUBSTRING(name_en FROM 6))
WHERE name_en ILIKE 'CHÂN %' AND (name_en ILIKE '%Armor%' OR name_en ILIKE '%Body%');

-- Fix "Madbike Knuckle Armor 2015" → gloves shouldn't have "Knuckle Armor" label
-- Actually that's fine, keep it

-- Strip uppercase "CHỐNG NƯỚC" if still in middle of name_en
UPDATE products SET name_en = TRIM(REPLACE(REPLACE(name_en, 'CHỐNG NƯỚC', ''), '  ', ' '))
WHERE name_en ILIKE '%CHỐNG NƯỚC%';

-- Strip "BẢO HỘ" if isolated in name_en
UPDATE products SET name_en = TRIM(REPLACE(REPLACE(name_en, 'BẢO HỘ ', ''), '  ', ' '))
WHERE name_en ILIKE '%BẢO HỘ %';

-- Clean up "Duhan" jacket
UPDATE products SET name_en = TRIM(REPLACE(name_en, 'Duhan', 'Duhan'))
WHERE name_en ILIKE 'Duhan%';

-- Final sync seo_title_en
UPDATE products SET seo_title_en = name_en
WHERE seo_title_en IS NOT NULL
  AND seo_title_en ~ '[àáảãạăắặẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđÀÁẢÃẠĂẮẶẲẴẶÂẤẦẨẪẬÈÉẺẼẸÊẾỀỂỄỆÌÍỈĨỊÒÓỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÙÚỦŨỤƯỨỪỬỮỰỲÝỶỸỴĐ]';
