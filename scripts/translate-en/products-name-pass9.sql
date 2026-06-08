-- Pass 9: targeted cleanup for remaining 69 products

-- === SPECIFIC FIXES FIRST (before generic prefix strips) ===

-- "đi Mô tô, xe máy, phượt - ICON Alliance GT Rubatone Full Face Helmet"
UPDATE products SET name_en = 'ICON Alliance GT Rubatone Full Face Helmet'
WHERE name_en ILIKE 'đi Mô tô%';

-- "ĐI XE MÁY MOTOR DÀNH | LS2 ZOOM LADY CHO MÙA LẠNH Women's Riding Jacket"
UPDATE products SET name_en = 'LS2 ZOOM LADY Women''s Riding Jacket'
WHERE name_en ILIKE '%LS2 ZOOM LADY CHO MÙA LẠNH%';

-- "MÙA HÈ LƯỚI TAICHI RSJ351 AIR Riding Jacket"
UPDATE products SET name_en = 'TAICHI RSJ351 AIR Mesh Riding Jacket'
WHERE name_en ILIKE 'MÙA HÈ LƯỚI%';

-- "LS2 AIRY LADY – ÁO MOTO NỮ NHẸ, THOÁNG MÁT Women's Riding Jacket"
UPDATE products SET name_en = 'LS2 AIRY LADY Women''s Riding Jacket'
WHERE name_en ILIKE 'LS2 AIRY LADY%ÁO MOTO%';

-- "Half-Face CHO NGƯỜI ĐI XE MÁY XPEED (HJC - CŨ) IS2V Motorcycle Helmet"
UPDATE products SET name_en = 'XPEED IS2V Half-Face Motorcycle Helmet'
WHERE name_en ILIKE 'Half-Face CHO NGƯỜI%';

-- "MANG BÊN TRONG MŨ BẢO HIỂM ..." inner helmet balaclava (handle each variant)
UPDATE products SET name_en = 'BIGBIKE Flip-Up Thermal Inner Balaclava'
WHERE name_en ILIKE 'MANG BÊN TRONG MŨ BẢO HIỂM BIGBIKE%';

UPDATE products SET name_en = 'EGO Thermal Inner Balaclava'
WHERE name_en ILIKE 'MANG BÊN TRONG MŨ BẢO HIỂM EGO%';

UPDATE products SET name_en = 'Inner Helmet Balaclava'
WHERE name_en ILIKE 'MANG BÊN TRONG MŨ BẢO HIỂM Balaclava';

-- "S2 THERMORAIN PHỦ NGOÀI GĂNG TAY Riding Gloves" → waterproof overgloves
UPDATE products SET name_en = 'S2 THERMORAIN Waterproof Overgloves'
WHERE name_en ILIKE 'S2 THERMORAIN PHỦ NGOÀI%';

-- "BỘ CHUYỂN ĐỔI KRIEGA TANKBAG - US DRYPACK CONVERTER"
UPDATE products SET name_en = 'KRIEGA US DRYPACK Tankbag Converter'
WHERE name_en ILIKE 'BỘ CHUYỂN ĐỔI KRIEGA%';

-- "BỘ QUẦN ÁO MƯA GIVI RRS06" → "GIVI RRS06 Rain Suit"
UPDATE products SET name_en = TRIM(REPLACE(name_en, 'BỘ QUẦN ÁO MƯA ', '')) || ' Rain Suit'
WHERE name_en ILIKE 'BỘ QUẦN ÁO MƯA %';

-- "CHÉO GIVI CITY BACKPACK CIT02 Bag"
UPDATE products SET name_en = 'GIVI CIT02 CITY Cross-Body Backpack'
WHERE name_en ILIKE 'CHÉO GIVI CITY%';

-- "PARKA LƯỚI NHẸ KOMINE JK-179 ENIGMA Riding Jacket"
UPDATE products SET name_en = 'KOMINE JK-179 ENIGMA Lightweight Mesh Riding Jacket'
WHERE name_en ILIKE 'PARKA LƯỚI NHẸ KOMINE%';

-- "GIÀY KHÁNG KHUẨN CỔ LỬNG SIXS SHORT LOGO Motorcycle Socks"
UPDATE products SET name_en = 'SIXS SHORT LOGO Antibacterial Motorcycle Socks'
WHERE name_en ILIKE 'GIÀY KHÁNG KHUẨN%';

-- "ĐI MƯA FURYGAN LYNX VẢI Armored Riding Pants"
UPDATE products SET name_en = 'FURYGAN LYNX Textile Armored Riding Pants'
WHERE name_en ILIKE 'ĐI MƯA FURYGAN%';

-- "VỆ SINH DƯỠNG ĐỒ DA LIQUI MOLY 300ML"
UPDATE products SET name_en = 'LIQUI MOLY Leather Care Conditioner 300ml'
WHERE name_en ILIKE 'VỆ SINH DƯỠNG ĐỒ DA%';

-- "ĐA NĂNG GIVI PCB01 40 LIT Bag"
UPDATE products SET name_en = 'GIVI PCB01 40L Bag'
WHERE name_en ILIKE 'ĐA NĂNG GIVI PCB01%';

-- "QUẦ BULLFIGHTER VULCAN DAME BUKSE ST"
UPDATE products SET name_en = 'BULLFIGHTER VULCAN Women''s Riding Pants'
WHERE name_en ILIKE 'QUẦ BULLFIGHTER%';

-- "CHO CẶP ĐÔI - SCS S10X Bluetooth Intercom Headset"
-- "CHO CẶP ĐÔI - " = 14 chars → FROM 15
UPDATE products SET name_en = TRIM(SUBSTRING(name_en FROM 15)) || ' (Couples Set)'
WHERE name_en ILIKE 'CHO CẶP ĐÔI - %';

-- "KOMINE JK-177 DÀNH Women's Riding Jacket"
UPDATE products SET name_en = 'KOMINE JK-177 Women''s Riding Jacket'
WHERE name_en ILIKE 'KOMINE JK-177 DÀNH%';

-- "Áo giáp, áo bảo hộ Touring RICHA CULUMUS Grey Riding Jacket"
UPDATE products SET name_en = TRIM(REPLACE(name_en, 'Áo giáp, áo bảo hộ Touring ', ''))
WHERE name_en ILIKE 'Áo giáp%';

-- "LS2 GẮN ÁO - LEVEL 2 Body Armor"
UPDATE products SET name_en = TRIM(REPLACE(name_en, 'GẮN ÁO - ', ''))
WHERE name_en ILIKE '%GẮN ÁO -%';

-- "GẮN ĐUÔI XE TAICHI RSB305 Backpack" → "TAICHI RSB305 Tail Backpack"
-- "GẮN ĐUÔI XE " = 12 chars → FROM 13
UPDATE products SET name_en = TRIM(REPLACE(TRIM(SUBSTRING(name_en FROM 13)), ' Backpack', '')) || ' Tail Backpack'
WHERE name_en ILIKE 'GẮN ĐUÔI XE %';

-- "TREO HÔNG XE MÁY ILM BS3 Bag" → "ILM BS3 Hip Bag"
-- "TREO HÔNG XE MÁY " = 17 chars → FROM 18
UPDATE products SET name_en = TRIM(REPLACE(TRIM(SUBSTRING(name_en FROM 18)), ' Bag', '')) || ' Hip Bag'
WHERE name_en ILIKE 'TREO HÔNG XE MÁY %';

-- === GENERIC PATTERNS ===

-- "- BAO TỬ " prefix (9 chars → FROM 10)
UPDATE products SET name_en = TRIM(SUBSTRING(name_en FROM 10))
WHERE name_en ILIKE '- BAO TỬ %';

-- "2 KÍNH " prefix → strip (7 chars → FROM 8)
UPDATE products SET name_en = TRIM(SUBSTRING(name_en FROM 8))
WHERE name_en ILIKE '2 KÍNH %';

-- "MỘT KÍNH " prefix (9 chars → FROM 10)
UPDATE products SET name_en = TRIM(SUBSTRING(name_en FROM 10))
WHERE name_en ILIKE 'MỘT KÍNH %';

-- Strip "DÀNH CHO BIKER " from anywhere
UPDATE products SET name_en = TRIM(REPLACE(REPLACE(name_en, 'DÀNH CHO BIKER ', ''), '  ', ' '))
WHERE name_en ILIKE '%DÀNH CHO BIKER%';

-- Strip " CHO MÙA HÈ LÝ TƯỞNG" from anywhere
UPDATE products SET name_en = TRIM(REPLACE(REPLACE(name_en, ' CHO MÙA HÈ LÝ TƯỞNG', ''), 'CHO MÙA HÈ LÝ TƯỞNG ', ''))
WHERE name_en ILIKE '%CHO MÙA HÈ LÝ TƯỞNG%';

-- "MÙA HÈ " prefix (7 chars → FROM 8)
UPDATE products SET name_en = TRIM(SUBSTRING(name_en FROM 8))
WHERE name_en ILIKE 'MÙA HÈ %';

-- Strip " CHỐNG MƯA" from anywhere
UPDATE products SET name_en = TRIM(REPLACE(REPLACE(name_en, ' CHỐNG MƯA', ''), '  ', ' '))
WHERE name_en ILIKE '% CHỐNG MƯA%';

-- "BẢO VỆ KHUỶU TAY " prefix (17 chars → FROM 18)
UPDATE products SET name_en = TRIM(SUBSTRING(name_en FROM 18))
WHERE name_en ILIKE 'BẢO VỆ KHUỶU TAY %';

-- "BẢO VỆ TAY CHÂN " prefix (16 chars → FROM 17)
UPDATE products SET name_en = TRIM(SUBSTRING(name_en FROM 17))
WHERE name_en ILIKE 'BẢO VỆ TAY CHÂN %';

-- "CHÉO " prefix (5 chars → FROM 6)
UPDATE products SET name_en = TRIM(SUBSTRING(name_en FROM 6))
WHERE name_en ILIKE 'CHÉO %';

-- "chéo Givi cho Ipad Bag" → specific fix after generic CHÉO strip
UPDATE products SET name_en = 'Givi iPad Cross-Body Bag'
WHERE name_en ILIKE 'Givi cho Ipad%' OR name_en ILIKE 'chéo Givi%Ipad%';

-- "Dây phản quang " prefix (15 chars → FROM 16)
UPDATE products SET name_en = TRIM(SUBSTRING(name_en FROM 16))
WHERE name_en ILIKE 'Dây phản quang %';

-- Strip " CAO CẤP" (premium qualifier) from anywhere
UPDATE products SET name_en = TRIM(REPLACE(REPLACE(name_en, ' CAO CẤP', ''), '  ', ' '))
WHERE name_en ILIKE '% CAO CẤP%';

-- "GIÁP " prefix (5 chars → FROM 6)
UPDATE products SET name_en = TRIM(SUBSTRING(name_en FROM 6))
WHERE name_en ILIKE 'GIÁP %';

-- "GẮN VÀO ÁO " prefix (11 chars → FROM 12)
UPDATE products SET name_en = TRIM(SUBSTRING(name_en FROM 12))
WHERE name_en ILIKE 'GẮN VÀO ÁO %';

-- "TRƠN " → "Solid " (plain/solid color helmet)
UPDATE products SET name_en = TRIM(REPLACE(name_en, 'TRƠN ', 'Solid '))
WHERE name_en ILIKE '%TRƠN %';

-- Strip "NAM/NỮ " from anywhere
UPDATE products SET name_en = TRIM(REPLACE(REPLACE(name_en, 'NAM/NỮ ', ''), '  ', ' '))
WHERE name_en ILIKE '%NAM/NỮ %';

-- Strip "(NAM/NỮ)" parenthetical
UPDATE products SET name_en = TRIM(REPLACE(REPLACE(name_en, ' (NAM/NỮ)', ''), '(NAM/NỮ) ', ''))
WHERE name_en ILIKE '%(NAM/NỮ)%';

-- "SỢI THUỶ TINH" → "Fiberglass"
UPDATE products SET name_en = TRIM(REPLACE(name_en, 'SỢI THUỶ TINH ', 'Fiberglass '))
WHERE name_en ILIKE '%SỢI THUỶ TINH%';

-- "LÀM MÁT " prefix (8 chars → FROM 9)
UPDATE products SET name_en = TRIM(SUBSTRING(name_en FROM 9))
WHERE name_en ILIKE 'LÀM MÁT %';

-- " Đen " → " Black " (Title-case Đen in middle)
UPDATE products SET name_en = TRIM(REPLACE(REPLACE(name_en, ' Đen ', ' Black '), ' Đen', ' Black'))
WHERE name_en ILIKE '% Đen%';

-- "MẶC NGOÀI ĐỒ " prefix (13 chars → FROM 14)
UPDATE products SET name_en = TRIM(SUBSTRING(name_en FROM 14))
WHERE name_en ILIKE 'MẶC NGOÀI ĐỒ %';

-- "NÓN " prefix for visor products (4 chars → FROM 5)
UPDATE products SET name_en = TRIM(SUBSTRING(name_en FROM 5))
WHERE name_en ILIKE 'NÓN %' AND name_en ILIKE '%Visor';

-- "gù carbon" → "Carbon Knuckle"
UPDATE products SET name_en = TRIM(REPLACE(name_en, 'gù carbon ', 'Carbon Knuckle '))
WHERE name_en ILIKE '%gù carbon%';

-- " - CHÂN GƯƠNG" / "CHÂN GƯƠNG " → strip mirror mount description
UPDATE products SET name_en = TRIM(REPLACE(REPLACE(name_en, ' - CHÂN GƯƠNG', ''), '  ', ' '))
WHERE name_en ILIKE '% CHÂN GƯƠNG%';

-- " CHO NGƯỜI ĐI XE MÁY" → strip
UPDATE products SET name_en = TRIM(REPLACE(REPLACE(name_en, ' CHO NGƯỜI ĐI XE MÁY', ''), '  ', ' '))
WHERE name_en ILIKE '% CHO NGƯỜI ĐI XE MÁY%';

-- " MẶC TRONG QUẦN" suffix → strip
UPDATE products SET name_en = TRIM(REPLACE(name_en, ' MẶC TRONG QUẦN', ''))
WHERE name_en ILIKE '% MẶC TRONG QUẦN%';

-- " CHO MŨ BẢO HIỂM" → strip
UPDATE products SET name_en = TRIM(REPLACE(REPLACE(name_en, ' CHO MŨ BẢO HIỂM', ''), '  ', ' '))
WHERE name_en ILIKE '% CHO MŨ BẢO HIỂM%';

-- "giáp nữ " prefix (8 chars → FROM 9)
UPDATE products SET name_en = TRIM(SUBSTRING(name_en FROM 9))
WHERE name_en ILIKE 'giáp nữ %';

-- "hông, túi bao tử " prefix (17 chars → FROM 18)
UPDATE products SET name_en = TRIM(SUBSTRING(name_en FROM 18))
WHERE name_en ILIKE 'hông, túi bao tử %';

-- "ĐI TOURING " prefix (11 chars → FROM 12)
UPDATE products SET name_en = TRIM(SUBSTRING(name_en FROM 12))
WHERE name_en ILIKE 'ĐI TOURING %';

-- "ĐI XE MÁY " prefix (10 chars → FROM 11)
UPDATE products SET name_en = TRIM(SUBSTRING(name_en FROM 11))
WHERE name_en ILIKE 'ĐI XE MÁY %';

-- "PHƯỢT " prefix (6 chars → FROM 7)
UPDATE products SET name_en = TRIM(SUBSTRING(name_en FROM 7))
WHERE name_en ILIKE 'PHƯỢT %';

-- "ĐUA " prefix (4 chars → FROM 5)
UPDATE products SET name_en = TRIM(SUBSTRING(name_en FROM 5))
WHERE name_en ILIKE 'ĐUA %';

-- "ĐẦU " prefix (4 chars → FROM 5)
UPDATE products SET name_en = TRIM(SUBSTRING(name_en FROM 5))
WHERE name_en ILIKE 'ĐẦU %';

-- Deduplicate "BALACLAVA Balaclava"
UPDATE products SET name_en = TRIM(REPLACE(name_en, 'BALACLAVA Balaclava', 'Balaclava'))
WHERE name_en ILIKE '%BALACLAVA Balaclava%';

-- "Trắng " → "White " (Title-case)
UPDATE products SET name_en = TRIM(REPLACE(name_en, 'Trắng ', 'White '))
WHERE name_en ILIKE 'Trắng %' OR name_en ILIKE '% Trắng %';

-- Final cleanup: double spaces
UPDATE products SET name_en = TRIM(REPLACE(name_en, '  ', ' '))
WHERE name_en ILIKE '%  %';

-- Final sync seo_title_en
UPDATE products SET seo_title_en = name_en
WHERE seo_title_en IS NOT NULL
  AND seo_title_en ~ '[àáảãạăắặẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđÀÁẢÃẠĂẮẶẲẴẶÂẤẦẨẪẬÈÉẺẼẸÊẾỀỂỄỆÌÍỈĨỊÒÓỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÙÚỦŨỤƯỨỪỬỮỰỲÝỶỸỴĐ]';
