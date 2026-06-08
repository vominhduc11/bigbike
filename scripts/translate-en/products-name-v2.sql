-- Products name_en v2 — uses UPPER(name) LIKE for reliable Vietnamese uppercase matching
-- No STEP 2 cleanup (avoids corrupting English suffixes)

UPDATE products SET name_en = (
  CASE
    -- ====== REMOVE COMMON LEADING FILLER PREFIXES ======
    -- (HÀNG ODER) / (ODER) / (NEW XXXX) prefix strip handled via TRIM after REGEXP

    -- ====== HELMETS — detect first (most specific) ======
    WHEN UPPER(name) LIKE '%MŨ BẢO HIỂM%FULLFACE%LẬT HÀM%'
      OR UPPER(name) LIKE '%NÓN BẢO HIỂM%FULLFACE%LẬT HÀM%'
      OR UPPER(name) LIKE '%MŨ BẢO HIỂM%LẬT HÀM%'
      OR UPPER(name) LIKE '%NÓN BẢO HIỂM%LẬT HÀM%'
      THEN TRIM(REGEXP_REPLACE(name, E'(?i)(mũ|nón)\\s+bảo\\s+hiểm\\s*(fullface\\s+)?lật\\s+hàm\\s*', '', '')) || ' Flip-Up Helmet'

    WHEN UPPER(name) LIKE '%MŨ BẢO HIỂM%FULLFACE%'
      OR UPPER(name) LIKE '%NÓN BẢO HIỂM%FULLFACE%'
      OR UPPER(name) LIKE '%NÓN FULLFACE%'
      OR UPPER(name) LIKE '%MŨ FULLFACE%'
      OR UPPER(name) LIKE '%MŨ BẢO HIỂM%FULL FACE%'
      THEN TRIM(REGEXP_REPLACE(name, E'(?i)(nón\\s+fullface|mũ\\s+fullface|(mũ|nón)\\s+bảo\\s+hiểm\\s+full.?face)\\s*', '', '')) || ' Full Face Helmet'

    WHEN UPPER(name) LIKE '%MŨ BẢO HIỂM%3/4%'
      OR UPPER(name) LIKE '%NÓN BẢO HIỂM%3/4%'
      THEN TRIM(REGEXP_REPLACE(name, E'(?i)(mũ|nón)\\s+bảo\\s+hiểm\\s+3/4\\s*', '', '')) || ' 3/4 Face Helmet'

    WHEN UPPER(name) LIKE '%MŨ BẢO HIỂM%CÀO CÀO%'
      OR UPPER(name) LIKE '%MŨ CÀO CÀO%'
      OR UPPER(name) LIKE '%NÓN BẢO HIỂM%DUAL SPORT%'
      OR UPPER(name) LIKE '%MŨ BẢO HIỂM%OFF-ROAD%'
      OR UPPER(name) LIKE '%MŨ BẢO HIỂM%DUAL SPORT%'
      THEN TRIM(REGEXP_REPLACE(name, E'(?i)(mũ|nón)\\s+bảo\\s+hiểm\\s*(cào\\s+cào|dual.?sport|off.?road)?\\s*', '', '')) || ' Dual Sport Helmet'

    WHEN UPPER(name) LIKE '%MŨ BẢO HIỂM%'
      OR UPPER(name) LIKE '%NÓN BẢO HIỂM%'
      THEN TRIM(REGEXP_REPLACE(name, E'(?i)(mũ|nón)\\s+bảo\\s+hiểm\\s*', '', '')) || ' Motorcycle Helmet'

    -- ====== GLOVES ======
    WHEN UPPER(name) LIKE 'GĂNG TAY MOTO PHƯỢT %'
      OR UPPER(name) LIKE 'GĂNG TAY PHƯỢT MOTO %'
      THEN TRIM(SUBSTRING(name FROM 20)) || ' Moto Riding Gloves'

    WHEN UPPER(name) LIKE 'GĂNG TAY MOTO %'
      THEN TRIM(SUBSTRING(name FROM 15)) || ' Motorcycle Riding Gloves'

    WHEN UPPER(name) LIKE 'GĂNG TAY XE MÁY %'
      OR UPPER(name) LIKE 'GĂNG TAY XE MAY %'
      THEN TRIM(SUBSTRING(name FROM 18)) || ' Motorcycle Riding Gloves'

    WHEN UPPER(name) LIKE 'GĂNG TAY DA %'
      THEN TRIM(SUBSTRING(name FROM 13)) || ' Leather Riding Gloves'

    WHEN UPPER(name) LIKE 'GĂNG TAY %'
      THEN TRIM(SUBSTRING(name FROM 10)) || ' Riding Gloves'

    WHEN name ILIKE '- Găng tay %'
      THEN TRIM(SUBSTRING(name FROM 13)) || ' Riding Gloves'

    -- ====== JACKETS ======
    WHEN UPPER(name) LIKE '%ÁO%TÚI KHÍ%' OR UPPER(name) LIKE '%ÁO BẢO HỘ%TÚI KHÍ%'
      THEN TRIM(REGEXP_REPLACE(name, E'(?i)(áo\\s+(bảo\\s+hộ\\s+)?túi\\s+khí)\\s*', '', '')) || ' Airbag Jacket'

    WHEN UPPER(name) LIKE 'ÁO MƯA BỘ %' OR UPPER(name) LIKE 'ÁO QUẦN MƯA %'
      THEN TRIM(REGEXP_REPLACE(name, E'(?i)áo\\s+(quần\\s+)?mưa\\s+(bộ\\s+)?', '', '')) || ' Rain Gear Set'

    WHEN UPPER(name) LIKE 'ÁO MƯA %'
      THEN TRIM(REGEXP_REPLACE(name, E'(?i)áo\\s+mưa\\s*', '', '')) || ' Rain Jacket'

    WHEN UPPER(name) LIKE 'ÁO LÓT %'
      THEN TRIM(REGEXP_REPLACE(name, E'(?i)áo\\s+lót\\s*', '', '')) || ' Base Layer Top'

    WHEN UPPER(name) LIKE 'ÁO PHẢN QUANG %'
      THEN TRIM(REGEXP_REPLACE(name, E'(?i)áo\\s+phản\\s+quang\\s*', '', '')) || ' Reflective Vest'

    WHEN UPPER(name) LIKE 'ÁO DA NỮ %' OR UPPER(name) LIKE 'ÁO DA LADY %'
      THEN TRIM(REGEXP_REPLACE(name, E'(?i)áo\\s+da\\s+(nữ|nu|lady)\\s*', '', '')) || ' Women''s Leather Riding Jacket'

    WHEN UPPER(name) LIKE 'ÁO DA %'
      THEN TRIM(REGEXP_REPLACE(name, E'(?i)áo\\s+da\\s*', '', '')) || ' Leather Riding Jacket'

    WHEN UPPER(name) LIKE 'ÁO TOURING NỮ %' OR UPPER(name) LIKE 'ÁO TOURING LADY %'
      THEN TRIM(REGEXP_REPLACE(name, E'(?i)áo\\s+touring\\s+(nữ|nu|lady)\\s*', '', '')) || ' Women''s Touring Jacket'

    WHEN UPPER(name) LIKE 'ÁO TOURING %'
      THEN TRIM(REGEXP_REPLACE(name, E'(?i)áo\\s+touring\\s*', '', '')) || ' Touring Jacket'

    WHEN UPPER(name) LIKE 'ÁO KHOÁC BẢO HỘ %'
      THEN TRIM(REGEXP_REPLACE(name, E'(?i)áo\\s+khoác\\s+bảo\\s+hộ\\s*', '', '')) || ' Protective Riding Jacket'

    WHEN UPPER(name) LIKE 'ÁO KHOÁC %'
      THEN TRIM(REGEXP_REPLACE(name, E'(?i)áo\\s+khoác\\s*', '', '')) || ' Riding Jacket'

    WHEN UPPER(name) LIKE 'ÁO BẢO HỘ GIÁP %'
      THEN TRIM(REGEXP_REPLACE(name, E'(?i)áo\\s+bảo\\s+hộ\\s+giáp\\s*', '', '')) || ' Protective Riding Jacket'

    WHEN UPPER(name) LIKE 'ÁO BẢO HỘ NỮ %' OR UPPER(name) LIKE 'ÁO BẢO HỘ XE MÁY NỮ %'
      THEN TRIM(REGEXP_REPLACE(name, E'(?i)áo\\s+bảo\\s+hộ\\s+(xe\\s+máy\\s+)?(nữ|nu)\\s*', '', '')) || ' Women''s Protective Riding Jacket'

    WHEN UPPER(name) LIKE 'ÁO BẢO HỘ XE MÁY %' OR UPPER(name) LIKE 'ÁO BẢO HỘ MÔ TÔ %'
      THEN TRIM(REGEXP_REPLACE(name, E'(?i)áo\\s+bảo\\s+hộ\\s+(xe\\s+máy|mô\\s+tô)\\s*', '', '')) || ' Motorcycle Riding Jacket'

    WHEN UPPER(name) LIKE 'ÁO BẢO HỘ %'
      THEN TRIM(REGEXP_REPLACE(name, E'(?i)áo\\s+bảo\\s+hộ\\s*', '', '')) || ' Protective Riding Jacket'

    WHEN UPPER(name) LIKE 'ÁO GIÁP NỮ %'
      THEN TRIM(REGEXP_REPLACE(name, E'(?i)áo\\s+giáp\\s+(nữ|nu)\\s*', '', '')) || ' Women''s Protective Riding Jacket'

    WHEN UPPER(name) LIKE 'ÁO GIÁP %'
      THEN TRIM(REGEXP_REPLACE(name, E'(?i)áo\\s+giáp\\s*', '', '')) || ' Protective Riding Jacket'

    WHEN UPPER(name) LIKE 'ÁO QUẦN NỮ %'
      THEN TRIM(REGEXP_REPLACE(name, E'(?i)áo\\s+quần\\s+(nữ|nu)\\s*', '', '')) || ' Women''s Jacket & Pants Set'

    WHEN UPPER(name) LIKE 'ÁO QUẦN %'
      THEN TRIM(REGEXP_REPLACE(name, E'(?i)áo\\s+quần\\s*', '', '')) || ' Jacket & Pants Set'

    WHEN UPPER(name) LIKE 'ÁO NỮ %'
      THEN TRIM(REGEXP_REPLACE(name, E'(?i)áo\\s+(nữ|nu)\\s*', '', '')) || ' Women''s Riding Jacket'

    -- generic "ÁO [BRAND MODEL]" — no qualifier prefix
    WHEN UPPER(name) LIKE 'ÁO %'
      THEN TRIM(REGEXP_REPLACE(name, E'(?i)^áo\\s+', '')) || ' Riding Jacket'

    -- Products starting with brand names or codes — some already essentially in English
    -- Detect by checking for parenthetical prefixes
    WHEN name ~ E'^\\(.*\\)\\s+ÁO' OR name ILIKE '(HÀNG%ÁO%' OR name ILIKE '(ODER)%ÁO%'
      THEN TRIM(REGEXP_REPLACE(REGEXP_REPLACE(name, E'^\\([^)]+\\)\\s*', ''), E'(?i)^áo\\s+', '')) || ' Riding Jacket'

    WHEN name ILIKE '(HÀNG%GĂNG TAY%' OR name ILIKE '(ODER)%GĂNG TAY%'
      THEN TRIM(REGEXP_REPLACE(REGEXP_REPLACE(name, E'^\\([^)]+\\)\\s*', ''), E'(?i)găng\\s+tay\\s+', '')) || ' Riding Gloves'

    WHEN name ILIKE '(HÀNG%GIÀY%' OR name ILIKE '(ODER)%GIÀY%'
      THEN TRIM(REGEXP_REPLACE(REGEXP_REPLACE(name, E'^\\([^)]+\\)\\s*', ''), E'(?i)giày\\s+', '')) || ' Motorcycle Boots'

    WHEN name ILIKE '(HÀNG%QUẦN%' OR name ILIKE '(ODER)%QUẦN%'
      THEN TRIM(REGEXP_REPLACE(REGEXP_REPLACE(name, E'^\\([^)]+\\)\\s*', ''), E'(?i)quần\\s+(bảo\\s+hộ|giáp|touring)?\\s*', '')) || ' Riding Pants'

    WHEN name ILIKE '(HÀNG%TÚI%' OR name ILIKE '(ODER)%TÚI%'
      THEN TRIM(REGEXP_REPLACE(REGEXP_REPLACE(name, E'^\\([^)]+\\)\\s*', ''), E'(?i)^túi\\s+(đeo\\s+hông|đeo\\s+đùi|chống\\s+nước|treo\\s+xe|yên)?\\s*', '')) || ' Bag'

    WHEN name ILIKE '(NEW%TAI NGHE%'
      THEN TRIM(REGEXP_REPLACE(REGEXP_REPLACE(name, E'^\\([^)]+\\)\\s*', ''), E'(?i)tai\\s+nghe\\s+(bluetooth\\s+)?', '')) || ' Bluetooth Headset'

    -- ====== PANTS ======
    WHEN UPPER(name) LIKE 'QUẦN TOURING NỮ %' OR UPPER(name) LIKE 'QUẦN TOURING LADY %'
      THEN TRIM(REGEXP_REPLACE(name, E'(?i)quần\\s+touring\\s+(nữ|nu|lady)\\s*', '', '')) || ' Women''s Touring Pants'

    WHEN UPPER(name) LIKE 'QUẦN TOURING %'
      THEN TRIM(REGEXP_REPLACE(name, E'(?i)quần\\s+touring\\s*', '', '')) || ' Touring Pants'

    WHEN UPPER(name) LIKE 'QUẦN BẢO HỘ NỮ %' OR UPPER(name) LIKE 'QUẦN GIÁP NỮ %'
      THEN TRIM(REGEXP_REPLACE(name, E'(?i)quần\\s+(bảo\\s+hộ|giáp)\\s+(nữ|nu)\\s*', '', '')) || ' Women''s Armored Riding Pants'

    WHEN UPPER(name) LIKE 'QUẦN BẢO HỘ %' OR UPPER(name) LIKE 'QUẦN GIÁP %'
      THEN TRIM(REGEXP_REPLACE(name, E'(?i)quần\\s+(bảo\\s+hộ|giáp)\\s*', '', '')) || ' Armored Riding Pants'

    WHEN UPPER(name) LIKE 'QUẦN LÓT %'
      THEN TRIM(REGEXP_REPLACE(name, E'(?i)quần\\s+lót\\s*', '', '')) || ' Base Layer Underpants'

    WHEN UPPER(name) LIKE 'QUẦN %'
      THEN TRIM(REGEXP_REPLACE(name, E'(?i)^quần\\s*', '', '')) || ' Riding Pants'

    -- ====== BOOTS ======
    WHEN UPPER(name) LIKE 'GIÀY BẢO HỘ NỮ %' OR UPPER(name) LIKE 'GIÀY TOURING NỮ %'
      THEN TRIM(REGEXP_REPLACE(name, E'(?i)giày\\s+(bảo\\s+hộ|touring)\\s+(nữ|nu)\\s*', '', '')) || ' Women''s Motorcycle Boots'

    WHEN UPPER(name) LIKE 'GIÀY BẢO HỘ %'
      OR UPPER(name) LIKE 'GIÀY TOURING %'
      OR UPPER(name) LIKE 'GIÀY MOTOR %'
      OR UPPER(name) LIKE 'GIÀY MOTO %'
      OR UPPER(name) LIKE 'GIÀY ĐI PHƯỢT %'
      OR UPPER(name) LIKE 'GIÀY RACING %'
      OR UPPER(name) LIKE 'GIÀY ADV %'
      THEN TRIM(REGEXP_REPLACE(name, E'(?i)giày\\s+(bảo\\s+hộ|touring|motor|moto|đi\\s+phượt|racing|adv)\\s*', '', '')) || ' Motorcycle Boots'

    WHEN UPPER(name) LIKE 'GIÀY %'
      THEN TRIM(REGEXP_REPLACE(name, E'(?i)^giày\\s*', '', '')) || ' Motorcycle Boots'

    -- ====== BLUETOOTH HEADSETS ======
    WHEN UPPER(name) LIKE 'TAI NGHE BLUETOOTH INTERCOM %'
      THEN TRIM(REGEXP_REPLACE(name, E'(?i)tai\\s+nghe\\s+bluetooth\\s+intercom\\s*', '', '')) || ' Bluetooth Intercom Headset'

    WHEN UPPER(name) LIKE 'TAI NGHE BLUETOOTH %'
      THEN TRIM(REGEXP_REPLACE(name, E'(?i)tai\\s+nghe\\s+bluetooth\\s*', '', '')) || ' Bluetooth Headset'

    WHEN UPPER(name) LIKE 'TAI NGHE ĐIỆN THOẠI %'
      THEN TRIM(REGEXP_REPLACE(name, E'(?i)tai\\s+nghe\\s+điện\\s+thoại\\s*', '', '')) || ' Phone Headset'

    WHEN UPPER(name) LIKE 'TAI NGHE %'
      THEN TRIM(REGEXP_REPLACE(name, E'(?i)tai\\s+nghe\\s*', '', '')) || ' Headset'

    -- ====== BACKPACKS ======
    WHEN UPPER(name) LIKE 'BALO CHỐNG NƯỚC %' OR UPPER(name) LIKE 'BA LÔ CHỐNG NƯỚC %'
      THEN TRIM(REGEXP_REPLACE(name, E'(?i)(balo|ba\\s+lô)\\s+chống\\s+nước\\s*', '', '')) || ' Waterproof Backpack'

    WHEN UPPER(name) LIKE 'BALO DU LỊCH %' OR UPPER(name) LIKE 'BA LÔ DU LỊCH %'
      THEN TRIM(REGEXP_REPLACE(name, E'(?i)(balo|ba\\s+lô)\\s+du\\s+lịch\\s*', '', '')) || ' Travel Backpack'

    WHEN UPPER(name) LIKE 'BALO %' OR UPPER(name) LIKE 'BA LÔ %'
      THEN TRIM(REGEXP_REPLACE(name, E'(?i)^(balo|ba\\s+lô)\\s*', '', '')) || ' Backpack'

    -- ====== BAGS ======
    WHEN UPPER(name) LIKE 'TÚI ĐEO ĐÙI %'
      THEN TRIM(REGEXP_REPLACE(name, E'(?i)túi\\s+đeo\\s+đùi\\s*', '', '')) || ' Thigh Bag'

    WHEN UPPER(name) LIKE 'TÚI ĐEO HÔNG %' OR UPPER(name) LIKE 'TÚI BAO TỬ %'
      THEN TRIM(REGEXP_REPLACE(name, E'(?i)túi\\s+(đeo\\s+hông|bao\\s+tử)\\s*', '', '')) || ' Hip Bag'

    WHEN UPPER(name) LIKE 'TÚI CHỐNG NƯỚC %'
      THEN TRIM(REGEXP_REPLACE(name, E'(?i)túi\\s+chống\\s+nước\\s*', '', '')) || ' Waterproof Bag'

    WHEN UPPER(name) LIKE 'TÚI TREO XE %'
      THEN TRIM(REGEXP_REPLACE(name, E'(?i)túi\\s+treo\\s+xe\\s*', '', '')) || ' Bike-Mounted Bag'

    WHEN UPPER(name) LIKE 'TÚI YÊN %'
      THEN TRIM(REGEXP_REPLACE(name, E'(?i)túi\\s+yên\\s*', '', '')) || ' Seat Bag'

    WHEN UPPER(name) LIKE 'TÚI HÀNH LÝ %'
      THEN TRIM(REGEXP_REPLACE(name, E'(?i)túi\\s+hành\\s+lý\\s*', '', '')) || ' Luggage Bag'

    WHEN UPPER(name) LIKE 'TÚI ĐI PHƯỢT %' OR UPPER(name) LIKE 'TÚI XE MÁY %'
      THEN TRIM(REGEXP_REPLACE(name, E'(?i)túi\\s+(đi\\s+phượt|xe\\s+máy)\\s*', '', '')) || ' Motorcycle Bag'

    WHEN UPPER(name) LIKE 'TÚI %'
      THEN TRIM(REGEXP_REPLACE(name, E'(?i)^túi\\s*', '', '')) || ' Bag'

    -- ====== ARMOR / GUARDS ======
    WHEN UPPER(name) LIKE '%BẢO HỘ TAY CHÂN%' OR UPPER(name) LIKE '%GIÁP TAY CHÂN%'
      THEN TRIM(REGEXP_REPLACE(name, E'(?i)(bảo\\s+hộ|giáp)\\s+tay\\s+chân\\s*', '', '')) || ' Body Armor Set'

    WHEN UPPER(name) LIKE '%GIÁP GỐI%' OR UPPER(name) LIKE '%BẢO HỘ GỐI%'
      THEN TRIM(REGEXP_REPLACE(name, E'(?i)(giáp|bảo\\s+hộ)\\s+gối\\s*', '', '')) || ' Knee Armor'

    WHEN UPPER(name) LIKE '%GIÁP BẢO HỘ%'
      THEN TRIM(REGEXP_REPLACE(name, E'(?i)giáp\\s+bảo\\s+hộ\\s*', '', '')) || ' Body Armor'

    -- ====== BASE LAYER / ACCESSORIES ======
    WHEN UPPER(name) LIKE 'ÁO LÓT %'
      THEN TRIM(REGEXP_REPLACE(name, E'(?i)áo\\s+lót\\s*', '', '')) || ' Base Layer Top'

    WHEN UPPER(name) LIKE 'QUẦN LÓT %'
      THEN TRIM(REGEXP_REPLACE(name, E'(?i)quần\\s+lót\\s*', '', '')) || ' Base Layer Underpants'

    WHEN UPPER(name) LIKE 'KHĂN TRÙM %' OR UPPER(name) LIKE 'TRÙM ĐẦU %'
      THEN TRIM(REGEXP_REPLACE(name, E'(?i)(khăn\\s+trùm|trùm\\s+đầu)\\s*', '', '')) || ' Balaclava'

    WHEN UPPER(name) LIKE 'VỚ %' OR UPPER(name) LIKE 'TẤT %'
      THEN TRIM(REGEXP_REPLACE(name, E'(?i)^(vớ|tất)\\s*', '', '')) || ' Motorcycle Socks'

    WHEN UPPER(name) LIKE 'ỐNG TAY %'
      THEN TRIM(REGEXP_REPLACE(name, E'(?i)^ống\\s+tay\\s*', '', '')) || ' Arm Sleeves'

    WHEN UPPER(name) LIKE 'KÍNH MŨ %' OR UPPER(name) LIKE 'KÍNH BẢO HIỂM %' OR UPPER(name) LIKE 'KÍNH CHẮN GIÓ %'
      THEN TRIM(REGEXP_REPLACE(name, E'(?i)kính\\s+(mũ|bảo\\s+hiểm|chắn\\s+gió)\\s*', '', '')) || ' Helmet Visor'

    WHEN UPPER(name) LIKE 'TRÙM XE %'
      THEN TRIM(REGEXP_REPLACE(name, E'(?i)trùm\\s+xe\\s*', '', '')) || ' Motorcycle Cover'

    WHEN UPPER(name) LIKE 'DÂY BUỘC %' OR UPPER(name) LIKE 'DÂY CỐ ĐỊNH %'
      THEN TRIM(REGEXP_REPLACE(name, E'(?i)dây\\s+(buộc|cố\\s+định)\\s*', '', '')) || ' Strapping System'

    WHEN UPPER(name) LIKE 'GIÁ ĐỠ ĐIỆN THOẠI %'
      THEN TRIM(REGEXP_REPLACE(name, E'(?i)giá\\s+đỡ\\s+điện\\s+thoại\\s*', '', '')) || ' Motorcycle Phone Mount'

    -- ====== FALLBACK: name is likely already in English or mixed ======
    ELSE name
  END
)
WHERE name_en IS NULL;

-- ----------------------------------------------------------------
-- STEP 2: Set seo_title_en = name_en for all products
-- ----------------------------------------------------------------
UPDATE products
SET seo_title_en = name_en
WHERE name_en IS NOT NULL AND seo_title_en IS NULL;

-- ----------------------------------------------------------------
-- STEP 3: Generate seo_description_en based on detected product type
-- ----------------------------------------------------------------
UPDATE products SET seo_description_en =
  CASE
    WHEN name_en ~* '\y(helmet|visor)\y' THEN
      'Genuine motorcycle helmet at BigBike — certified safety standards, nationwide shipping.'
    WHEN name_en ~* '\y(gloves|glove)\y' THEN
      'Genuine motorcycle riding gloves at BigBike — CE-certified protection, nationwide shipping.'
    WHEN name_en ~* '\y(touring jacket|riding jacket|protective jacket|leather jacket|airbag jacket|rain jacket|women''s.*jacket)\y' THEN
      'Genuine motorcycle protective riding jacket at BigBike — certified armor, nationwide shipping.'
    WHEN name_en ~* '\y(touring pants|riding pants|armored.*pants|women''s.*pants)\y' THEN
      'Genuine motorcycle armored riding pants at BigBike — certified protection, nationwide shipping.'
    WHEN name_en ~* '\y(boots|motorcycle boots|touring boots)\y' THEN
      'Genuine motorcycle protective boots at BigBike — nationwide shipping.'
    WHEN name_en ~* '\y(bluetooth headset|intercom headset|headset)\y' THEN
      'Genuine Bluetooth motorcycle headset at BigBike — nationwide shipping.'
    WHEN name_en ~* '\y(backpack|waterproof backpack)\y' THEN
      'Genuine waterproof motorcycle touring backpack at BigBike — nationwide shipping.'
    WHEN name_en ~* '\y(bag|thigh bag|hip bag|seat bag|luggage)\y' THEN
      'Genuine motorcycle bag at BigBike — nationwide shipping.'
    WHEN name_en ~* '\y(armor|body armor|knee armor)\y' THEN
      'Genuine motorcycle body armor at BigBike — CE-certified protection, nationwide shipping.'
    ELSE
      'Genuine motorcycle gear and accessories at BigBike — nationwide shipping.'
  END
WHERE name_en IS NOT NULL AND seo_description_en IS NULL
  AND seo_description IS NOT NULL AND seo_description != '';
