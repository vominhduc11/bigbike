-- Third pass: strip remaining Vietnamese modifiers from name_en
-- Part A: strip leading/trailing VI phrases when English type suffix already exists

-- 1. Strip long Vietnamese description prefix ("đi mô tô, xe máy, phượt - Áo bảo hộ chính hãng")
UPDATE products SET name_en = TRIM(
  REGEXP_REPLACE(name_en,
    E'(?i)^(đi\\s+mô\\s+tô|mô\\s+tô)\\s*[,\\s]+(xe\\s+máy\\s*[,\\s]+)?(phượt\\s*[,-]?\\s*)?-?\\s*(Áo\\s+bảo\\s+hộ\\s+(chính\\s+hãng\\s+)?)?', ''))
WHERE name_en ~ '[àáảãạăắặẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđ]';

-- 2. Strip leading "BẢO HỘ " / "DA BẢO HỘ " / "BẢO HỘ DA " modifiers
UPDATE products SET name_en = TRIM(
  REGEXP_REPLACE(name_en,
    E'(?i)^(bảo\\s+hộ\\s+(da\\s+|adv\\s+|mô\\s+tô\\s+)?|da\\s+bảo\\s+hộ\\s+)', ''))
WHERE name_en ~ '[àáảãạăắặẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđ]';

-- 3. Strip leading "chính hãng " and trailing " chính hãng"
UPDATE products SET name_en = TRIM(
  REGEXP_REPLACE(
    REGEXP_REPLACE(name_en, E'(?i)^chính\\s+hãng\\s+', ''),
    E'(?i)\\s+chính\\s+hãng\\s*$', ''))
WHERE name_en ~ '[àáảãạăắặẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđ]';

-- 4. Strip leading "THUN MOTO THỜI TRANG " / "NAM/NỮ " / "NỮ "
UPDATE products SET name_en = TRIM(
  REGEXP_REPLACE(name_en,
    E'(?i)^(thun\\s+moto\\s+thời\\s+trang\\s+|nam/?nữ\\s+|nữ(?=\\s+[A-Z])|moto\\s+phượt\\s+|xe\\s+máy\\s+|phượt\\s+chống\\s+nước\\s+|mặc\\s+trong\\s+giáp\\s+|vải\\s+túi\\s+khí\\s+|da\\s+đi.{0,30}\\s+-\\s+áo\\s+bảo\\s+hộ\\s+da\\s+|, xe máy, phượt - áo bảo hộ chính hãng |, xe máy, phượt - áo bảo hộ )', ''))
WHERE name_en ~ '[àáảãạăắặẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđ]';

-- 5. Strip leading "LƯNG " (back) from body armor name_en (e.g. "LƯNG ALPINESTARS... Body Armor" → "Back Protector")
UPDATE products SET name_en = TRIM(REGEXP_REPLACE(name_en, E'(?i)^lưng\\s+', '')) || REPLACE(
  REGEXP_REPLACE(name_en, E'(?i)^lưng\\s+.+', ' Back Protector'), ' Back Protector', '')
WHERE name_en ILIKE 'LƯNG % Body Armor';

UPDATE products SET name_en = TRIM(REGEXP_REPLACE(name_en, E'(?i)^lưng\\s+', ''))
WHERE name_en ~ '^lưng\\s+' OR name_en ILIKE 'LƯNG %';

-- 6. Strip "DÀNH CHO MOTOR/XE MÁY " prefix from hook organizer
UPDATE products SET name_en = TRIM(REGEXP_REPLACE(name_en, E'(?i)^dành\\s+cho\\s+(motor|xe\\s+máy)\\s*/?\\s*(xe\\s+máy\\s+)?', ''))
WHERE name_en ~ '[àáảãạăắặẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđ]';

-- 7. Strip "/BẢO VỆ LƯNG " from lumbar belt (double-prefix issue from đai lưng/bảo vệ lưng)
UPDATE products SET name_en = TRIM(REGEXP_REPLACE(name_en, E'(?i)^/?bảo\\s+vệ\\s+lưng\\s+', ''))
WHERE name_en ~ '[àáảãạăắặẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđ]';

-- 8. Strip "HÍT BÌNH XĂNG " prefix from bag → reclassify as Tank Bag
UPDATE products SET name_en = TRIM(REGEXP_REPLACE(name_en, E'(?i)^hít\\s+bình\\s+xăng\\s+', '')) || ' Tank Bag'
WHERE name_en ILIKE 'HÍT BÌNH XĂNG % Bag';

-- Also "Balo hít bình xăng" → tank backpack
UPDATE products SET name_en = TRIM(REGEXP_REPLACE(name_en, E'(?i)^hít\\s+bình\\s+xăng\\s+', '')) || ' Tank Backpack'
WHERE name_en ILIKE 'hít bình xăng % Backpack';

-- 9. Fix balaclava "ĐẦU Balaclava" (KHĂN TRÙM ĐẦU product)
UPDATE products SET name_en = 'Balaclava Head Cover'
WHERE name_en = 'ĐẦU Balaclava' OR name_en ILIKE 'ĐẦU Balaclava';

-- 10. Strip "MANG GIÀY BẢO HỘ " from socks prefix
UPDATE products SET name_en = TRIM(REGEXP_REPLACE(name_en, E'(?i)^mang\\s+giày\\s+(bảo\\s+hộ\\s+)?', ''))
WHERE name_en ~ '[àáảãạăắặẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđ]';

-- 11. Strip trailing Vietnamese modifiers from arm sleeves
UPDATE products SET name_en = TRIM(REGEXP_REPLACE(name_en, E'(?i)^găng\\s+ống\\s+tay\\s+(chống\\s+nắng\\s+)?', '')) || ' UV Arm Sleeves'
WHERE name_en ILIKE 'GĂNG ỐNG TAY%';

-- 12. Strip "CHỐNG NẮNG " from ống tay arm sleeves
UPDATE products SET name_en = TRIM(REGEXP_REPLACE(name_en, E'(?i)^chống\\s+nắng\\s+', ''))
WHERE name_en ILIKE 'CHỐNG NẮNG %';

-- 13. Fix bag "treo 2 bên xe Tanked Racing đa năng Bag"
UPDATE products SET name_en = 'Tanked Racing Multi-Purpose Side Bags'
WHERE name ILIKE '%túi treo 2 bên xe Tanked Racing%';

-- 14. Strip "KAKI BẢO HỘ " from pants
UPDATE products SET name_en = TRIM(REGEXP_REPLACE(name_en, E'(?i)^kaki\\s+(bảo\\s+hộ\\s+)?', ''))
WHERE name_en ~ '[àáảãạăắặẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđ]' AND name_en ILIKE 'KAKI%';

-- 15. Fix "Duhan có giáp lưng Reflective Vest" → "Duhan Back Protector Reflective Vest"
UPDATE products SET name_en = TRIM(REGEXP_REPLACE(name_en, E'(?i)^(\\w+)\\s+có\\s+giáp\\s+lưng\\s+', '\\1 '))
WHERE name_en ~ 'có\\s+giáp\\s+lưng';

-- ============================================================
-- Part B: fully untranslated products — direct translation
-- ============================================================

-- SUIT DA (leather racing suit)
UPDATE products SET name_en = TRIM(REGEXP_REPLACE(normalize(name, NFC), E'(?i)^suit\\s+da\\s+(1\\s+mảnh|2\\s+mảnh|3\\s+mảnh)?\\s*', '')) ||
  CASE
    WHEN normalize(name, NFC) ILIKE '%2 mảnh%' OR normalize(name, NFC) ILIKE '%2-mảnh%' THEN ' Two-Piece Leather Racing Suit'
    ELSE ' One-Piece Leather Racing Suit'
  END
WHERE name_en ~ '[àáảãạăắặẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđÀÁẢÃẠĂẮẶẲẴẶÂẤẦẨẪẬÈÉẺẼẸÊẾỀỂỄỆÌÍỈĨỊÒÓỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÙÚỦŨỤƯỨỪỬỮỰỲÝỶỸỴĐ]'
AND normalize(name, NFC) ILIKE 'SUIT DA%';

-- KÍNH THAY / PHỤ KIỆN KÍNH THAY (replacement visor)
UPDATE products SET name_en = TRIM(REGEXP_REPLACE(normalize(name, NFC), E'(?i)^(phụ\\s+kiện\\s+)?kính\\s+thay\\s+(cho\\s+nón\\s+)?', '')) || ' Replacement Visor'
WHERE name_en ~ '[àáảãạăắặẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđÀÁẢÃẠĂẮẶẲẴẶÂẤẦẨẪẬÈÉẺẼẸÊẾỀỂỄỆÌÍỈĨỊÒÓỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÙÚỦŨỤƯỨỪỬỮỰỲÝỶỸỴĐ]'
AND normalize(name, NFC) ILIKE '%KÍNH THAY%';

-- BẢO VỆ GỐI (knee guard)
UPDATE products SET name_en = TRIM(REGEXP_REPLACE(normalize(name, NFC), E'(?i)^bảo\\s+vệ\\s+gối\\s*', '')) || ' Knee Guard'
WHERE name_en ~ '[àáảãạăắặẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđÀÁẢÃẠĂẮẶẲẴẶÂẤẦẨẪẬÈÉẺẼẸÊẾỀỂỄỆÌÍỈĨỊÒÓỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÙÚỦŨỤƯỨỪỬỮỰỲÝỶỸỴĐ]'
AND normalize(name, NFC) ILIKE 'BẢO VỆ GỐI%';

-- ĐAI BẢO VỆ / ĐAI LƯNG (lumbar/kidney belt)
UPDATE products SET name_en = TRIM(REGEXP_REPLACE(normalize(name, NFC), E'(?i)^đai\\s+(bảo\\s+vệ|lưng)\\s*', '')) || ' Lumbar Support Belt'
WHERE name_en ~ '[àáảãạăắặẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđÀÁẢÃẠĂẮẶẲẴẶÂẤẦẨẪẬÈÉẺẼẸÊẾỀỂỄỆÌÍỈĨỊÒÓỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÙÚỦŨỤƯỨỪỬỮỰỲÝỶỸỴĐ]'
AND (normalize(name, NFC) ILIKE 'ĐAI BẢO VỆ%' OR normalize(name, NFC) ILIKE 'ĐAI LƯNG%');

-- PINLOCK (anti-fog insert)
UPDATE products SET name_en = TRIM(REGEXP_REPLACE(normalize(name, NFC), E'(?i)^pinlock\\s+(chống\\s+sương\\s+|\\d+\\s+)?', '')) || ' Pinlock Anti-Fog Insert'
WHERE name_en ~ '[àáảãạăắặẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđÀÁẢÃẠĂẮẶẲẴẶÂẤẦẨẪẬÈÉẺẼẸÊẾỀỂỄỆÌÍỈĨỊÒÓỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÙÚỦŨỤƯỨỪỬỮỰỲÝỶỸỴĐ]'
AND normalize(name, NFC) ILIKE 'PINLOCK%';

-- ỦNG BỌC GIÀY ĐI MƯA (rain boot covers)
UPDATE products SET name_en = TRIM(REGEXP_REPLACE(normalize(name, NFC), E'(?i)^ủng\\s+(bọc\\s+giày\\s+)?đi\\s+mưa\\s*', '')) || ' Rain Boot Cover'
WHERE name_en ~ '[àáảãạăắặẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđÀÁẢÃẠĂẮẶẲẴẶÂẤẦẨẪẬÈÉẺẼẸÊẾỀỂỄỆÌÍỈĨỊÒÓỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÙÚỦŨỤƯỨỪỬỮỰỲÝỶỸỴĐ]'
AND normalize(name, NFC) ILIKE 'ỦNG%';

-- DÂY PHẢN QUANG (reflective band)
UPDATE products SET name_en = TRIM(REGEXP_REPLACE(normalize(name, NFC), E'(?i)^dây\\s+phản\\s+quang\\s+(thun\\s+)?', '')) || ' Reflective Band'
WHERE name_en ~ '[àáảãạăắặẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđÀÁẢÃẠĂẮẶẲẴẶÂẤẦẨẪẬÈÉẺẼẸÊẾỀỂỄỆÌÍỈĨỊÒÓỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÙÚỦŨỤƯỨỪỬỮỰỲÝỶỸỴĐ]'
AND normalize(name, NFC) ILIKE 'DÂY PHẢN QUANG%';

-- BỌC CẦN SỐ (shift shoe cover)
UPDATE products SET name_en = TRIM(REGEXP_REPLACE(normalize(name, NFC), E'(?i)^bọc\\s+cần\\s+số\\s+(cao\\s+su\\s+)?', '')) || ' Shift Shoe Cover'
WHERE name_en ~ '[àáảãạăắặẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđÀÁẢÃẠĂẮẶẲẴẶÂẤẦẨẪẬÈÉẺẼẸÊẾỀỂỄỆÌÍỈĨỊÒÓỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÙÚỦŨỤƯỨỪỬỮỰỲÝỶỸỴĐ]'
AND normalize(name, NFC) ILIKE 'BỌC CẦN SỐ%';

-- HỖ TRỢ TAY GA (throttle assist)
UPDATE products SET name_en = TRIM(REGEXP_REPLACE(normalize(name, NFC), E'(?i)^hỗ\\s+trợ\\s+tay\\s+ga\\s*-?\\s*(chống\\s+mỏi\\s+)?', '')) || ' Throttle Assist'
WHERE name_en ~ '[àáảãạăắặẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđÀÁẢÃẠĂẮẶẲẴẶÂẤẦẨẪẬÈÉẺẼẸÊẾỀỂỄỆÌÍỈĨỊÒÓỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÙÚỦŨỤƯỨỪỬỮỰỲÝỶỸỴĐ]'
AND normalize(name, NFC) ILIKE 'HỖ TRỢ TAY GA%';

-- LƯỚI RÀNG ĐỒ (cargo net)
UPDATE products SET name_en = TRIM(REGEXP_REPLACE(normalize(name, NFC), E'(?i)^lưới\\s+ràng\\s+đồ\\s*,?\\s*(ràng\\s+bình\\s+xăng\\s+)?', '')) || ' Cargo Net'
WHERE name_en ~ '[àáảãạăắặẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđÀÁẢÃẠĂẮẶẲẴẶÂẤẦẨẪẬÈÉẺẼẸÊẾỀỂỄỆÌÍỈĨỊÒÓỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÙÚỦŨỤƯỨỪỬỮỰỲÝỶỸỴĐ]'
AND normalize(name, NFC) ILIKE 'LƯỚI RÀNG%';

-- Xương cá carbon / Xương cá (spine protector)
UPDATE products SET name_en = TRIM(REGEXP_REPLACE(normalize(name, NFC), E'(?i)^(xương\\s+cá\\s+(carbon\\s+)?(dạ\\s+quang\\s+)?)', '')) || ' Spine Protector'
WHERE name_en ~ '[àáảãạăắặẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđÀÁẢÃẠĂẮẶẲẴẶÂẤẦẨẪẬÈÉẺẼẸÊẾỀỂỄỆÌÍỈĨỊÒÓỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÙÚỦŨỤƯỨỪỬỮỰỲÝỶỸỴĐ]'
AND normalize(name, NFC) ILIKE 'Xương cá%';

-- DUNG DỊCH / CHAI XỊT cleaning products
UPDATE products SET name_en = TRIM(REGEXP_REPLACE(normalize(name, NFC), E'(?i)^dung\\s+dịch\\s+', '')) || ' Cleaning Solution'
WHERE name_en ~ '[àáảãạăắặẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđÀÁẢÃẠĂẮẶẲẴẶÂẤẦẨẪẬÈÉẺẼẸÊẾỀỂỄỆÌÍỈĨỊÒÓỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÙÚỦŨỤƯỨỪỬỮỰỲÝỶỸỴĐ]'
AND normalize(name, NFC) ILIKE 'DUNG DỊCH%';

UPDATE products SET name_en = TRIM(REGEXP_REPLACE(normalize(name, NFC), E'(?i)^chai\\s+xịt\\s+(sên\\s+|bôi\\s+trơn\\s+bảo\\s+dưỡng\\s+sên\\s+)?', '')) || ' Spray Lubricant'
WHERE name_en ~ '[àáảãạăắặẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđÀÁẢÃẠĂẮẶẲẴẶÂẤẦẨẪẬÈÉẺẼẸÊẾỀỂỄỆÌÍỈĨỊÒÓỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÙÚỦŨỤƯỨỪỬỮỰỲÝỶỸỴĐ]'
AND normalize(name, NFC) ILIKE 'CHAI XỊT%';

-- BỘ KIT cleaning kit
UPDATE products SET name_en = TRIM(REGEXP_REPLACE(normalize(name, NFC), E'(?i)^bộ\\s+kit\\s*', '')) || ' Cleaning Kit'
WHERE name_en ~ '[àáảãạăắặẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđÀÁẢÃẠĂẮẶẲẴẶÂẤẦẨẪẬÈÉẺẼẸÊẾỀỂỄỆÌÍỈĨỊÒÓỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÙÚỦŨỤƯỨỪỬỮỰỲÝỶỸỴĐ]'
AND normalize(name, NFC) ILIKE 'BỘ KIT%';

-- MIẾNG DÁN / PAT (mount accessories)
UPDATE products SET name_en = TRIM(REGEXP_REPLACE(normalize(name, NFC), E'(?i)^miếng\\s+dán\\s+(khoá\\s+kép\\s+)?', '')) || ' Velcro Adhesive'
WHERE name_en ~ '[àáảãạăắặẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđÀÁẢÃẠĂẮẶẲẴẶÂẤẦẨẪẬÈÉẺẼẸÊẾỀỂỄỆÌÍỈĨỊÒÓỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÙÚỦŨỤƯỨỪỬỮỰỲÝỶỸỴĐ]'
AND normalize(name, NFC) ILIKE 'MIẾNG DÁN%';

UPDATE products SET name_en = TRIM(REGEXP_REPLACE(normalize(name, NFC), E'(?i)^pat\\s+(chân\\s+gương\\s+)?', '')) || ' Mirror Bracket'
WHERE name_en ~ '[àáảãạăắặẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđÀÁẢÃẠĂẮẶẲẴẶÂẤẦẨẪẬÈÉẺẼẸÊẾỀỂỄỆÌÍỈĨỊÒÓỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÙÚỦŨỤƯỨỪỬỮỰỲÝỶỸỴĐ]'
AND normalize(name, NFC) ILIKE 'PAT CHÂN GƯƠNG%';

-- SET ÁO QUẦN BẢO HỘ (jacket+pants set)
UPDATE products SET name_en = TRIM(REGEXP_REPLACE(normalize(name, NFC), E'(?i)^set\\s+áo\\s+quần\\s+(bảo\\s+hộ\\s+)?(adv\\s+)?', '')) || ' ADV Riding Set'
WHERE name_en ~ '[àáảãạăắặẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđÀÁẢÃẠĂẮẶẲẴẶÂẤẦẨẪẬÈÉẺẼẸÊẾỀỂỄỆÌÍỈĨỊÒÓỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÙÚỦŨỤƯỨỪỬỮỰỲÝỶỸỴĐ]'
AND normalize(name, NFC) ILIKE 'SET ÁO QUẦN%';

-- MŨ ADVENTURE (adventure helmet)
UPDATE products SET name_en = TRIM(REGEXP_REPLACE(normalize(name, NFC), E'(?i)^mũ\\s+adventure\\s*', '')) || ' Adventure Helmet'
WHERE name_en ~ '[àáảãạăắặẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđÀÁẢÃẠĂẮẶẲẴẶÂẤẦẨẪẬÈÉẺẼẸÊẾỀỂỄỆÌÍỈĨỊÒÓỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÙÚỦŨỤƯỨỪỬỮỰỲÝỶỸỴĐ]'
AND normalize(name, NFC) ILIKE 'MŨ ADVENTURE%';

-- QUADLOCK accessories (already mostly English)
UPDATE products SET name_en = TRIM(REGEXP_REPLACE(normalize(name, NFC), E'(?i)^quadlock\\s+(phụ\\s+kiện\\s+đa\\s+năng\\s+-\\s+miếng\\s+dán\\s+đa\\s+năng\\s+)?', ''))
WHERE name_en ~ '[àáảãạăắặẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđÀÁẢÃẠĂẮẶẲẴẶÂẤẦẨẪẬÈÉẺẼẸÊẾỀỂỄỆÌÍỈĨỊÒÓỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÙÚỦŨỤƯỨỪỬỮỰỲÝỶỸỴĐ]'
AND normalize(name, NFC) ILIKE 'QUADLOCK PHỤ KIỆN%';

-- Wireless charger for bike
UPDATE products SET name_en = 'QUADLOCK Motorcycle Wireless Charging Head'
WHERE name_en ~ '[àáảãạăắặẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđÀÁẢÃẠĂẮẶẲẴẶÂẤẦẨẪẬÈÉẺẼẸÊẾỀỂỄỆÌÍỈĨỊÒÓỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÙÚỦŨỤƯỨỪỬỮỰỲÝỶỸỴĐ]'
AND normalize(name, NFC) ILIKE 'ĐẦU SẠC KHÔNG DÂY%';

-- QUADLOCK VIBRATION DAMPENER
UPDATE products SET name_en = TRIM(REGEXP_REPLACE(normalize(name, NFC), E'(?i)\\s*\\(.*\\)\\s*$', ''))
WHERE name_en ~ '[àáảãạăắặẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđÀÁẢÃẠĂẮẶẲẴẶÂẤẦẨẪẬÈÉẺẼẸÊẾỀỂỄỆÌÍỈĨỊÒÓỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÙÚỦŨỤƯỨỪỬỮỰỲÝỶỸỴĐ]'
AND name_en ILIKE 'QUADLOCK VIBRATION%';

-- PHỦ NANO
UPDATE products SET name_en = TRIM(REGEXP_REPLACE(normalize(name, NFC), E'(?i)^phủ\\s+nano\\s+(cho\\s+kính\\s+nón\\s+)?', '')) || ' Nano Visor Coating'
WHERE name_en ~ '[àáảãạăắặẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđÀÁẢÃẠĂẮẶẲẴẶÂẤẦẨẪẬÈÉẺẼẸÊẾỀỂỄỆÌÍỈĨỊÒÓỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÙÚỦŨỤƯỨỪỬỮỰỲÝỶỸỴĐ]'
AND normalize(name, NFC) ILIKE 'PHỦ NANO%';

-- Camera hành trình remaining (already has "Action Dash Camera" but with VI description)
UPDATE products SET name_en = TRIM(REGEXP_REPLACE(name_en,
  E'(?i)^(SCS\\s+CAM-S\\s+-\\s+)?ghi\\s+hình.+$', '')) || 'Action Dash Camera'
WHERE name_en ~ '[àáảãạăắặẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđÀÁẢÃẠĂẮẶẲẴẶÂẤẦẨẪẬÈÉẺẼẸÊẾỀỂỄỆÌÍỈĨỊÒÓỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÙÚỦŨỤƯỨỪỬỮỰỲÝỶỸỴĐ]'
AND name_en ILIKE '%Action Dash Camera';

-- VÍ (wallet)
UPDATE products SET name_en = TRIM(REGEXP_REPLACE(normalize(name, NFC), E'(?i)^ví\\s*', ''))
WHERE name_en ~ '[àáảãạăắặẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđÀÁẢÃẠĂẮẶẲẴẶÂẤẦẨẪẬÈÉẺẼẸÊẾỀỂỄỆÌÍỈĨỊÒÓỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÙÚỦŨỤƯỨỪỬỮỰỲÝỶỸỴĐ]'
AND normalize(name, NFC) ILIKE 'VÍ %';

-- Strip "CHỐNG MỎI " from lumbar belt (residual from SCOYCO U11 BLUE CHỐNG MỎI)
UPDATE products SET name_en = TRIM(REGEXP_REPLACE(name_en, E'(?i)\\s+chống\\s+mỏi$', ''))
WHERE name_en ~ 'chống\\s+mỏi' AND name_en ILIKE '%Lumbar%';

-- MŨ 1/2 (half-face helmet)
UPDATE products SET name_en = TRIM(REGEXP_REPLACE(normalize(name, NFC), E'(?i)^(mũ|nón)\\s+(bảo\\s+hiểm\\s+)?1/2\\s+', '')) || ' Half Face Helmet'
WHERE name_en ~ '[àáảãạăắặẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđÀÁẢÃẠĂẮẶẲẴẶÂẤẦẨẪẬÈÉẺẼẸÊẾỀỂỄỆÌÍỈĨỊÒÓỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÙÚỦŨỤƯỨỪỬỮỰỲÝỶỸỴĐ]'
AND (normalize(name, NFC) ILIKE 'MŨ 1/2%' OR normalize(name, NFC) ILIKE 'NÓN 1/2%' OR normalize(name, NFC) ILIKE 'MŨ BẢO HIỂM 1/2%');

-- CHUẨN ECE strip from helmet name_en (it's a standard note, keep model only)
UPDATE products SET name_en = TRIM(REGEXP_REPLACE(name_en, E'(?i)\\s+chuẩn\\s+ece[^\\s]*\\s*', ' '))
WHERE name_en ~ 'chuẩn' AND (name_en ILIKE '%Helmet%' OR name_en ILIKE '%Face Helmet%');

-- THÁI LAN (Thailand) strip from name_en
UPDATE products SET name_en = TRIM(REGEXP_REPLACE(name_en, E'(?i)\\s+thái\\s+lan\\s+', ' '))
WHERE name_en ~ 'thái\\s+lan';

-- (Sao chép) / (thanh lý) strip from name_en
UPDATE products SET name_en = TRIM(REGEXP_REPLACE(name_en, E'(?i)\\s*\\(sao\\s+chép\\)\\s*', ''))
WHERE name_en ~ 'sao\\s+chép';

UPDATE products SET name_en = TRIM(REGEXP_REPLACE(name_en, E'(?i)\\s*\\(thanh\\s+lý\\)\\s*', ''))
WHERE name_en ~ 'thanh\\s+lý';

-- CAO CẤP (premium) strip from end of name_en
UPDATE products SET name_en = TRIM(REGEXP_REPLACE(name_en, E'(?i)\\s+cao\\s+cấp\\s*$', ''))
WHERE name_en ~ 'cao\\s+cấp';

-- GHI HÌNH FULL HD remaining (from camera products)
UPDATE products SET name_en = TRIM(REGEXP_REPLACE(name_en, E'(?i)\\s+-\\s+ghi\\s+hình.+$', ''))
WHERE name_en ~ 'ghi\\s+hình' AND name_en ILIKE '%Action%';

-- Update seo_title_en and seo_description_en for fixed products
UPDATE products SET seo_title_en = name_en
WHERE seo_title_en != name_en AND seo_title_en IS NOT NULL
  AND name_en !~ '[àáảãạăắặẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđÀÁẢÃẠĂẮẶẲẴẶÂẤẦẨẪẬÈÉẺẼẸÊẾỀỂỄỆÌÍỈĨỊÒÓỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÙÚỦŨỤƯỨỪỬỮỰỲÝỶỸỴĐ]'
  AND seo_title_en ~ '[àáảãạăắặẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđÀÁẢÃẠĂẮẶẲẴẶÂẤẦẨẪẬÈÉẺẼẸÊẾỀỂỄỆÌÍỈĨỊÒÓỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÙÚỦŨỤƯỨỪỬỮỰỲÝỶỸỴĐ]';
