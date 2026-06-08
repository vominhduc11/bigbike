-- Pass 6: strip/replace remaining Vietnamese in name_en

-- Strip "CHÍNH HÃNG" from ANYWHERE in name_en (case-insensitive using REPLACE)
UPDATE products SET name_en = TRIM(REPLACE(REPLACE(REPLACE(name_en, ' CHÍNH HÃNG', ''), ' chính hãng', ''), '  ', ' '))
WHERE name_en ILIKE '%chính hãng%' OR name_en ILIKE '%CHÍNH HÃNG%';

-- Strip "đa năng" / "ĐA NĂNG" from anywhere
UPDATE products SET name_en = TRIM(REPLACE(REPLACE(name_en, ' đa năng', ''), ' ĐA NĂNG', ''))
WHERE name_en ILIKE '%đa năng%' OR name_en ILIKE '%ĐA NĂNG%';

-- Strip "chống nước" / "CHỐNG NƯỚC" from anywhere in the model part
UPDATE products SET name_en = TRIM(REPLACE(REPLACE(name_en, ' chống nước', ''), '  ', ' '))
WHERE name_en ILIKE '%chống nước%';

-- Strip "MODEL MỚI" and "MỚI" from name_en
UPDATE products SET name_en = TRIM(REPLACE(REPLACE(REPLACE(name_en, ' MODEL MỚI', ''), ' MỚI', ''), '  ', ' '))
WHERE name_en ILIKE '%MỚI%';

-- Strip "ĐÈN LED" → "LED" in name_en
UPDATE products SET name_en = TRIM(REPLACE(name_en, ' ĐÈN LED', ' LED'))
WHERE name_en ILIKE '% ĐÈN LED%';

-- Translate Vietnamese colors in name_en
UPDATE products SET name_en = TRIM(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
  name_en,
  ' XANH LÁ', ' Green'),
  ' XANH', ' Blue'),
  ' ĐỎ', ' Red'),
  ' TRẮNG', ' White'),
  ' VÀNG', ' Yellow'),
  ' ĐEN', ' Black'),
  ' NÂU', ' Brown'),
  ' XÁM', ' Gray'),
  ' TÍM', ' Purple'),
  ' CAM', ' Orange'),
  '  ', ' '))
WHERE name_en ~ '[àáảãạăắặẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđÀÁẢÃẠĂẮẶẲẴẶÂẤẦẨẪẬÈÉẺẼẸÊẾỀỂỄỆÌÍỈĨỊÒÓỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÙÚỦŨỤƯỨỪỬỮỰỲÝỶỸỴĐ]';

-- Strip "GIỮ ẤM" (warm-keeping) from gloves
UPDATE products SET name_en = TRIM(REPLACE(REPLACE(name_en, ', GIỮ ẤM', ''), ' GIỮ ẤM', ''))
WHERE name_en ILIKE '%GIỮ ẤM%';

-- Strip "MẶC TRONG GIÁP" from base layer
UPDATE products SET name_en = TRIM(REPLACE(name_en, ' MẶC TRONG GIÁP', ''))
WHERE name_en ILIKE '%MẶC TRONG GIÁP%';

-- Translate "CẮT NGÓN" / "CỤT NGÓN" (fingerless)
UPDATE products SET name_en = TRIM(REPLACE(REPLACE(name_en, 'CẮT NGÓN ', 'Fingerless '), 'CỤT NGÓN ', 'Fingerless '))
WHERE name_en ILIKE '%CẮT NGÓN%' OR name_en ILIKE '%CỤT NGÓN%';

-- Strip "BÓ GỐI" (knee) from body armor names
UPDATE products SET name_en = TRIM(REPLACE(name_en, 'BÓ GỐI ', ''))
WHERE name_en ILIKE 'BÓ GỐI%';

-- Strip "ĐI MOTO PHƯỢT" from middle of name_en
UPDATE products SET name_en = TRIM(REPLACE(REPLACE(name_en, ' ĐI MOTO PHƯỢT', ''), '  ', ' '))
WHERE name_en ILIKE '%ĐI MOTO PHƯỢT%';

-- Strip "ĐI MOTO" from anywhere
UPDATE products SET name_en = TRIM(REPLACE(REPLACE(name_en, ' ĐI MOTO', ''), '  ', ' '))
WHERE name_en ILIKE '% ĐI MOTO%';

-- Strip "CHỐNG RUNG - CHÂN GHI ĐÔNG" from phone mounts (it's a description, not model)
UPDATE products SET name_en = TRIM(REPLACE(name_en, 'CHỐNG RUNG - CHÂN GHI ĐÔNG ', ''))
WHERE name_en ILIKE '%CHỐNG RUNG%';

-- Fix "cho nữ" / "CHO NỮ" from anywhere in name_en
UPDATE products SET name_en = TRIM(REPLACE(REPLACE(name_en, ' cho nữ', ''), '  ', ' '))
WHERE name_en ILIKE '% cho nữ%';

-- Fix "&" prefixed remaining armor ("& CHÂN SCOYCO K18H18 Body Armor Set")
UPDATE products SET name_en = TRIM(SUBSTRING(name_en FROM 3))
WHERE name_en LIKE '& %';

-- Fix "HÀNG MỸ" remaining (US-made product note)
UPDATE products SET name_en = TRIM(REPLACE(REPLACE(name_en, ' HÀNG MỸ', ''), '  ', ' '))
WHERE name_en ILIKE '%HÀNG MỸ%';

-- Fix "phượt " lowercase prefix in balaclava
UPDATE products SET name_en = TRIM(REPLACE(name_en, 'phượt ', ''))
WHERE name_en ILIKE 'phượt %';

-- Fix "tay và chân inox " lowercase remaining in armor
UPDATE products SET name_en = TRIM(REPLACE(REPLACE(name_en, 'tay và chân inox ', ''), 'tay và chân ', ''))
WHERE name_en ILIKE '%tay và chân%';

-- Fix "Giáp gối và tay" / "Giáp tay" lowercase remaining
UPDATE products SET name_en = TRIM(REPLACE(REPLACE(REPLACE(name_en, 'Giáp gối và tay ', ''), 'Giáp tay ', ''), '  ', ' '))
WHERE name_en ILIKE 'Giáp%';

-- Fix "Mũ bảo hộ  3/4 Index Monza" → "Index Monza 3/4 Face Helmet"
UPDATE products SET name_en = TRIM(REPLACE(REPLACE(name_en, 'Mũ bảo hộ  3/4 ', ''), 'Mũ bảo hộ 3/4 ', '')) || ' 3/4 Face Helmet'
WHERE name_en ILIKE 'Mũ bảo hộ%3/4%';

-- Fix product prefixes: "MIẾNG LÓT MÓC SỐ BẢO VỆ GIÀY" → shoe/boot protector
UPDATE products SET name_en = TRIM(REGEXP_REPLACE(normalize(name, NFC),
  E'(?i)^miếng\\s+lót\\s+móc\\s+số\\s+bảo\\s+vệ\\s+giày\\s*', '')) || ' Shoe Gear Shift Pad'
WHERE name_en ILIKE 'MIẾNG LÓT MÓC SỐ BẢO VỆ GIÀY%';

-- Fix "BỘ PHỤ KIỆN TAI NGHE" → accessory kit
UPDATE products SET name_en = TRIM(REGEXP_REPLACE(normalize(name, NFC),
  E'(?i)^bộ\\s+phụ\\s+kiện\\s+tai\\s+nghe\\s*', '')) || ' Headset Accessory Kit'
WHERE name_en ILIKE 'BỘ PHỤ KIỆN TAI NGHE%';

-- Fix "GIÁP BẢO VỆ GỐI % Body Armor" → "% Knee Guard"
UPDATE products SET name_en = TRIM(SUBSTRING(name_en FROM 18)) || ' Knee Guard'
WHERE name_en ILIKE 'GIÁP BẢO VỆ GỐI %';

-- Fix "(Sao chép)" remaining
UPDATE products SET name_en = TRIM(REPLACE(name_en, '(Sao chép)', ''))
WHERE name_en ILIKE '%(Sao chép)%';

-- Fix partial "Ữ " prefix (character from NỮ partially stripped)
UPDATE products SET name_en = TRIM(SUBSTRING(name_en FROM 3))
WHERE name_en LIKE 'Ữ %';

-- Fix "SCOYCO  CHỐNG NƯỚC, GIỮ ẤM MC15B-2 Riding Gloves" — double space
UPDATE products SET name_en = TRIM(REPLACE(name_en, '  ', ' '))
WHERE name_en ILIKE '%  %';

-- Final sync seo_title_en
UPDATE products SET seo_title_en = name_en
WHERE seo_title_en IS NOT NULL
  AND seo_title_en ~ '[àáảãạăắặẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđÀÁẢÃẠĂẮẶẲẴẶÂẤẦẨẪẬÈÉẺẼẸÊẾỀỂỄỆÌÍỈĨỊÒÓỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÙÚỦŨỤƯỨỪỬỮỰỲÝỶỸỴĐ]';
