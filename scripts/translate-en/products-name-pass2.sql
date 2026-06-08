-- Second pass: fix products where name_en still contains Vietnamese
-- Uses normalize(name, NFC) ILIKE to handle NFD-encoded names
-- More comprehensive REGEXP_REPLACE stripping Vietnamese qualifiers/modifiers

UPDATE products SET name_en = (
  CASE
    -- Helper: strip parenthetical (HÀNG OD)/(HÀNG ODER)/(NEW XXXX) prefix first via inline normalize

    -- ====== HELMETS (using normalize for NFD names) ======
    WHEN normalize(name, NFC) ILIKE '%mũ bảo hiểm%lật hàm%'
      OR normalize(name, NFC) ILIKE '%nón bảo hiểm%lật hàm%'
      OR normalize(name, NFC) ILIKE '%mũ fullface lật hàm%'
      THEN TRIM(REGEXP_REPLACE(normalize(name, NFC),
        E'(?i)(nón\\s+fullface\\s+lật\\s+hàm|(mũ|nón)\\s+bảo\\s+hiểm\\s*(fullface\\s+)?lật\\s+hàm)\\s*', '', '')) || ' Flip-Up Helmet'

    WHEN normalize(name, NFC) ILIKE '%mũ bảo hiểm%fullface%'
      OR normalize(name, NFC) ILIKE '%nón bảo hiểm%fullface%'
      OR normalize(name, NFC) ILIKE 'mũ fullface%'
      OR normalize(name, NFC) ILIKE 'nón fullface%'
      OR normalize(name, NFC) ILIKE 'mũ bảo hiểm%full face%'
      THEN TRIM(REGEXP_REPLACE(normalize(name, NFC),
        E'(?i)(nón\\s+fullface|mũ\\s+fullface|(mũ|nón)\\s+bảo\\s+hiểm\\s+full.?face)\\s*', '', '')) || ' Full Face Helmet'

    WHEN normalize(name, NFC) ILIKE 'mũ 3/4%' OR normalize(name, NFC) ILIKE 'nón 3/4%'
      OR normalize(name, NFC) ILIKE '%bảo hiểm%3/4%'
      THEN TRIM(REGEXP_REPLACE(normalize(name, NFC),
        E'(?i)(mũ\\s+3/4|(mũ|nón)\\s+bảo\\s+hiểm\\s+3/4)\\s*', '', '')) || ' 3/4 Face Helmet'

    WHEN normalize(name, NFC) ILIKE '%mũ bảo hiểm%cào cào%'
      OR normalize(name, NFC) ILIKE 'mũ cào cào%'
      OR normalize(name, NFC) ILIKE '%bảo hiểm%dual sport%'
      OR normalize(name, NFC) ILIKE '%bảo hiểm%off-road%'
      THEN TRIM(REGEXP_REPLACE(normalize(name, NFC),
        E'(?i)(mũ\\s+cào\\s+cào|(mũ|nón)\\s+bảo\\s+hiểm\\s*(cào\\s+cào|dual.?sport|off.?road)?)\\s*', '', '')) || ' Dual Sport Helmet'

    WHEN normalize(name, NFC) ILIKE 'mũ bảo hiểm%' OR normalize(name, NFC) ILIKE 'nón bảo hiểm%'
      OR normalize(name, NFC) ILIKE 'nón nexx%' OR normalize(name, NFC) ILIKE 'nón %'
      THEN TRIM(REGEXP_REPLACE(normalize(name, NFC),
        E'(?i)(nón\\s+|mũ\\s+bảo\\s+hiểm\\s*|nón\\s+bảo\\s+hiểm\\s*)', '', '')) || ' Motorcycle Helmet'

    -- ====== HELMETS with parenthetical prefix ======
    WHEN normalize(name, NFC) ILIKE '(hàng%mũ%' OR normalize(name, NFC) ILIKE '(oder%mũ%'
      OR normalize(name, NFC) ILIKE '(new%mũ%'
      THEN TRIM(REGEXP_REPLACE(
        REGEXP_REPLACE(normalize(name, NFC), E'^\\([^)]+\\)\\s*', ''),
        E'(?i)(nón\\s+|mũ\\s+bảo\\s+hiểm\\s*|mũ\\s+fullface\\s*|mũ\\s+3/4\\s*)', '')) || ' Motorcycle Helmet'

    -- ====== GLOVES (normalize) ======
    WHEN normalize(name, NFC) ILIKE 'găng tay%'
      THEN TRIM(REGEXP_REPLACE(normalize(name, NFC),
        E'(?i)^găng\\s+tay\\s+(moto\\s+phượt\\s+(nữ\\s+)?|phượt\\s+moto\\s+(nữ\\s+)?|xe\\s+máy\\s+(nữ\\s+)?|moto\\s+(nữ\\s+)?|bảo\\s+hộ\\s+(xe\\s+máy\\s+)?(nữ\\s+)?|da\\s+(nữ\\s+)?|racing\\s+(nữ\\s+)?|touring\\s+(nữ\\s+)?|nữ\\s+|sport\\s+)?', ''))
        || CASE WHEN normalize(name, NFC) ILIKE '%nữ%' OR normalize(name, NFC) ILIKE '%lady%' OR normalize(name, NFC) ILIKE '%stella%'
             THEN ' Women''s Riding Gloves' ELSE ' Riding Gloves' END

    WHEN normalize(name, NFC) ILIKE '(hàng%găng tay%' OR normalize(name, NFC) ILIKE '(oder%găng tay%'
      OR normalize(name, NFC) ILIKE '(new%găng tay%'
      THEN TRIM(REGEXP_REPLACE(
        REGEXP_REPLACE(normalize(name, NFC), E'^\\([^)]+\\)\\s*', ''),
        E'(?i)^găng\\s+tay\\s+(moto\\s+phượt\\s+|phượt\\s+moto\\s+|xe\\s+máy\\s+|moto\\s+|bảo\\s+hộ\\s+(xe\\s+máy\\s+)?|da\\s+|racing\\s+|touring\\s+|nữ\\s+)?', '')) || ' Riding Gloves'

    -- ====== JACKETS — with and without parenthetical prefix ======
    WHEN normalize(name, NFC) ILIKE '(hàng%áo%' OR normalize(name, NFC) ILIKE '(oder%áo%'
      OR normalize(name, NFC) ILIKE '(new%áo%' OR normalize(name, NFC) ILIKE '(new %áo%'
      THEN TRIM(REGEXP_REPLACE(
        REGEXP_REPLACE(normalize(name, NFC), E'^\\([^)]+\\)\\s*', ''),
        E'(?i)^áo\\s+(da\\s+(nữ\\s+)?|touring\\s+(nữ\\s+)?|bảo\\s+hộ\\s+(mô\\s+tô\\s+|xe\\s+máy\\s+)?(nữ\\s+)?|giáp\\s+(nữ\\s+)?|khoác\\s+(bảo\\s+hộ\\s+)?(nữ\\s+)?|túi\\s+khí\\s+|lót\\s+|mưa\\s+(bộ\\s+)?|nữ\\s+|quần\\s+(nữ\\s+)?|phản\\s+quang\\s+)?', ''))
        || CASE
             WHEN normalize(name, NFC) ILIKE '%túi khí%' THEN ' Airbag Jacket'
             WHEN normalize(name, NFC) ILIKE '%mưa%' THEN ' Rain Jacket'
             WHEN normalize(name, NFC) ILIKE '%lót%' THEN ' Base Layer Top'
             WHEN normalize(name, NFC) ILIKE '%nữ%' OR normalize(name, NFC) ILIKE '%lady%' THEN ' Women''s Riding Jacket'
             ELSE ' Riding Jacket'
           END

    WHEN normalize(name, NFC) ILIKE 'áo%'
      THEN TRIM(REGEXP_REPLACE(normalize(name, NFC),
        E'(?i)^áo\\s+(túi\\s+khí\\s+|mưa\\s+(bộ\\s+)?|lót\\s+|phản\\s+quang\\s+|da\\s+(nữ\\s+)?|touring\\s+(nữ\\s+|lady\\s+)?|khoác\\s+(bảo\\s+hộ\\s+)?(nữ\\s+)?|bảo\\s+hộ\\s+(giáp\\s+|mô\\s+tô\\s+|xe\\s+máy\\s+)?(nữ\\s+)?|giáp\\s+(nữ\\s+)?|quần\\s+(nữ\\s+)?|nữ\\s+)?', ''))
        || CASE
             WHEN normalize(name, NFC) ILIKE 'áo%túi khí%' THEN ' Airbag Jacket'
             WHEN normalize(name, NFC) ILIKE 'áo mưa%' OR normalize(name, NFC) ILIKE 'áo%mưa%' THEN ' Rain Jacket'
             WHEN normalize(name, NFC) ILIKE 'áo lót%' THEN ' Base Layer Top'
             WHEN normalize(name, NFC) ILIKE 'áo phản quang%' THEN ' Reflective Vest'
             WHEN normalize(name, NFC) ILIKE 'áo da nữ%' OR normalize(name, NFC) ILIKE 'áo da lady%' THEN ' Women''s Leather Riding Jacket'
             WHEN normalize(name, NFC) ILIKE 'áo da%' THEN ' Leather Riding Jacket'
             WHEN normalize(name, NFC) ILIKE 'áo touring nữ%' OR normalize(name, NFC) ILIKE 'áo touring lady%' THEN ' Women''s Touring Jacket'
             WHEN normalize(name, NFC) ILIKE 'áo touring%' THEN ' Touring Jacket'
             WHEN normalize(name, NFC) ILIKE 'áo%nữ%' OR normalize(name, NFC) ILIKE 'áo nữ%' THEN ' Women''s Riding Jacket'
             ELSE ' Riding Jacket'
           END

    -- ====== PANTS (normalize) ======
    WHEN normalize(name, NFC) ILIKE 'quần%'
      THEN TRIM(REGEXP_REPLACE(normalize(name, NFC),
        E'(?i)^quần\\s+(touring\\s+(nữ\\s+|lady\\s+)?|bảo\\s+hộ\\s+(nữ\\s+)?|giáp\\s+(bảo\\s+hộ\\s+)?(nữ\\s+)?|lót\\s+|nữ\\s+)?', ''))
        || CASE
             WHEN normalize(name, NFC) ILIKE 'quần%lót%' THEN ' Base Layer Underpants'
             WHEN normalize(name, NFC) ILIKE 'quần%touring%nữ%' OR normalize(name, NFC) ILIKE 'quần%touring%lady%' THEN ' Women''s Touring Pants'
             WHEN normalize(name, NFC) ILIKE 'quần%touring%' THEN ' Touring Pants'
             WHEN normalize(name, NFC) ILIKE 'quần%nữ%' OR normalize(name, NFC) ILIKE 'quần%lady%' THEN ' Women''s Armored Riding Pants'
             WHEN normalize(name, NFC) ILIKE 'quần%bảo hộ%' OR normalize(name, NFC) ILIKE 'quần%giáp%' THEN ' Armored Riding Pants'
             ELSE ' Riding Pants'
           END

    -- ====== BOOTS (normalize) ======
    WHEN normalize(name, NFC) ILIKE '(hàng%giày%' OR normalize(name, NFC) ILIKE '(oder%giày%'
      OR normalize(name, NFC) ILIKE '(new%giày%'
      THEN TRIM(REGEXP_REPLACE(
        REGEXP_REPLACE(normalize(name, NFC), E'^\\([^)]+\\)\\s*', ''),
        E'(?i)^giày\\s+(bảo\\s+hộ\\s+(chống\\s+nước\\s+)?(cho\\s+nữ\\s+|nữ\\s+)?|touring\\s+(nữ\\s+)?|motor\\s+|moto\\s+|đi\\s+phượt\\s+|racing\\s+|adv\\s+|chống\\s+nước\\s+|nữ\\s+)?', ''))
        || ' Motorcycle Boots'

    WHEN normalize(name, NFC) ILIKE 'giày%'
      THEN TRIM(REGEXP_REPLACE(normalize(name, NFC),
        E'(?i)^giày\\s+(bảo\\s+hộ\\s+(chống\\s+nước\\s+)?(cho\\s+nữ\\s+|nữ\\s+)?|touring\\s+(nữ\\s+)?|motor\\s+|moto\\s+|đi\\s+phượt\\s+|racing\\s+|adv\\s+|chống\\s+nước\\s+|nữ\\s+)?', ''))
        || CASE
             WHEN normalize(name, NFC) ILIKE '%nữ%' OR normalize(name, NFC) ILIKE '%lady%' OR normalize(name, NFC) ILIKE '%women%' THEN ' Women''s Motorcycle Boots'
             ELSE ' Motorcycle Boots'
           END

    -- ====== BAGS (normalize) ======
    WHEN normalize(name, NFC) ILIKE '(hàng%túi%' OR normalize(name, NFC) ILIKE '(oder%túi%'
      OR normalize(name, NFC) ILIKE '( hàng%túi%'
      THEN TRIM(REGEXP_REPLACE(
        REGEXP_REPLACE(normalize(name, NFC), E'^\\([^)]+\\)\\s*', ''),
        E'(?i)^túi\\s+(đeo\\s+hông\\s+(đa\\s+năng\\s+)?|đeo\\s+đùi\\s+|chống\\s+nước\\s+|treo\\s+xe\\s+|yên\\s+|hành\\s+lý\\s+|đi\\s+phượt\\s+|xe\\s+máy\\s+|đựng\\s+đồ\\s+nghề\\s+)?', ''))
        || CASE
             WHEN normalize(name, NFC) ILIKE '%đeo hông%' OR normalize(name, NFC) ILIKE '%bao tử%' THEN ' Hip Bag'
             WHEN normalize(name, NFC) ILIKE '%đeo đùi%' THEN ' Thigh Bag'
             WHEN normalize(name, NFC) ILIKE '%treo xe%' THEN ' Bike-Mounted Bag'
             WHEN normalize(name, NFC) ILIKE '%yên%' THEN ' Seat Bag'
             ELSE ' Bag'
           END

    WHEN normalize(name, NFC) ILIKE 'túi%'
      THEN TRIM(REGEXP_REPLACE(normalize(name, NFC),
        E'(?i)^túi\\s+(đeo\\s+hông\\s+(đa\\s+năng\\s+)?|đeo\\s+đùi\\s+|chống\\s+nước\\s+|treo\\s+xe\\s+|yên\\s+|hành\\s+lý\\s+|đi\\s+phượt\\s+|xe\\s+máy\\s+|đựng\\s+đồ\\s+nghề\\s+)?', ''))
        || CASE
             WHEN normalize(name, NFC) ILIKE 'túi đeo hông%' OR normalize(name, NFC) ILIKE 'túi bao tử%' THEN ' Hip Bag'
             WHEN normalize(name, NFC) ILIKE 'túi đeo đùi%' THEN ' Thigh Bag'
             WHEN normalize(name, NFC) ILIKE 'túi chống nước%' THEN ' Waterproof Bag'
             WHEN normalize(name, NFC) ILIKE 'túi treo xe%' THEN ' Bike-Mounted Bag'
             WHEN normalize(name, NFC) ILIKE 'túi yên%' THEN ' Seat Bag'
             WHEN normalize(name, NFC) ILIKE 'túi hành lý%' THEN ' Luggage Bag'
             WHEN normalize(name, NFC) ILIKE 'túi%đựng đồ nghề%' THEN ' Tool Bag'
             ELSE ' Bag'
           END

    -- ====== BACKPACKS (normalize) ======
    WHEN normalize(name, NFC) ILIKE 'balo%' OR normalize(name, NFC) ILIKE 'ba lô%'
      THEN TRIM(REGEXP_REPLACE(normalize(name, NFC),
        E'(?i)^(balo|ba\\s+lô)\\s+(chống\\s+nước\\s+|du\\s+lịch\\s+|phượt\\s+)?', ''))
        || CASE
             WHEN normalize(name, NFC) ILIKE '%chống nước%' THEN ' Waterproof Backpack'
             WHEN normalize(name, NFC) ILIKE '%du lịch%' THEN ' Travel Backpack'
             ELSE ' Backpack'
           END

    WHEN normalize(name, NFC) ILIKE '(hàng%balo%' OR normalize(name, NFC) ILIKE '(oder%balo%'
      OR normalize(name, NFC) ILIKE '(new%balo%'
      THEN TRIM(REGEXP_REPLACE(
        REGEXP_REPLACE(normalize(name, NFC), E'^\\([^)]+\\)\\s*', ''),
        E'(?i)^(balo|ba\\s+lô)\\s+(chống\\s+nước\\s+|du\\s+lịch\\s+|phượt\\s+)?', '')) || ' Backpack'

    -- ====== ARMOR / GIÁP (normalize) ======
    WHEN normalize(name, NFC) ILIKE 'giáp bảo hộ tay%' OR normalize(name, NFC) ILIKE 'giáp bảo hộ chân%'
      OR normalize(name, NFC) ILIKE 'giáp bảo hộ%'
      OR normalize(name, NFC) ILIKE 'bộ phụ kiện giáp%'
      OR normalize(name, NFC) ILIKE 'bảo hộ tay%' OR normalize(name, NFC) ILIKE 'bảo hộ chân%'
      THEN TRIM(REGEXP_REPLACE(normalize(name, NFC),
        E'(?i)^(bộ\\s+phụ\\s+kiện\\s+)?giáp\\s+(bảo\\s+hộ\\s+)?(tay\\s+và\\s+chân\\s+|tay\\s+chân\\s+|chân\\s+|tay\\s+)?|bảo\\s+hộ\\s+(tay\\s+(và\\s+)?chân\\s+|chân\\s+)', '')) || ' Body Armor Set'

    WHEN normalize(name, NFC) ILIKE 'giáp gối%' OR normalize(name, NFC) ILIKE 'miếng giáp%gối%'
      OR normalize(name, NFC) ILIKE 'phụ kiện chà gối%'
      THEN TRIM(REGEXP_REPLACE(normalize(name, NFC),
        E'(?i)^(miếng\\s+giáp\\s+|phụ\\s+kiện\\s+chà\\s+gối\\s+|giáp\\s+gối.?khuỷu\\s+tay\\s+ce\\s+level\\s+\\S+\\s+)?', '')) || ' Knee/Elbow Armor'

    WHEN normalize(name, NFC) ILIKE 'giáp%'
      OR normalize(name, NFC) ILIKE 'miếng giáp bảo vệ%'
      THEN TRIM(REGEXP_REPLACE(normalize(name, NFC),
        E'(?i)^(miếng\\s+giáp\\s+bảo\\s+vệ\\s+\\S+\\s+|giáp\\s+(gối.?khuỷu\\s+tay\\s+ce\\s+level\\s+\\S+\\s+)?)?', '')) || ' Body Armor'

    -- ====== HEADSETS (normalize) ======
    WHEN normalize(name, NFC) ILIKE 'tai nghe bluetooth%'
      THEN TRIM(REGEXP_REPLACE(normalize(name, NFC),
        E'(?i)^tai\\s+nghe\\s+bluetooth\\s+(intercom\\s+)?(camera\\s+\\S+\\s+)?(intercom\\s+)?', ''))
        || CASE
             WHEN normalize(name, NFC) ILIKE '%intercom%' THEN ' Bluetooth Intercom Headset'
             ELSE ' Bluetooth Headset'
           END

    WHEN normalize(name, NFC) ILIKE 'tai nghe%'
      THEN TRIM(REGEXP_REPLACE(normalize(name, NFC),
        E'(?i)^tai\\s+nghe\\s+(điện\\s+thoại\\s+(cho\\s+nón\\s+bảo\\s+hiểm\\s+)?|bluetooth\\s+)?', '')) || ' Headset'

    -- ====== BALACLAVA / HEAD COVER (normalize) ======
    WHEN normalize(name, NFC) ILIKE 'khăn trùm%' OR normalize(name, NFC) ILIKE 'trùm đầu%'
      OR normalize(name, NFC) ILIKE 'trùm nửa đầu%' OR normalize(name, NFC) ILIKE 'mũ trùm đầu%'
      THEN TRIM(REGEXP_REPLACE(normalize(name, NFC),
        E'(?i)(khăn\\s+trùm|trùm\\s+đầu|trùm\\s+nửa\\s+đầu\\s+(mang\\s+bên\\s+trong\\s+(mũ\\s+bảo\\s+hiểm)?\\s+|taichi\\s+)?|mũ\\s+trùm\\s+đầu\\s+(kĩ\\s+thuật\\s+)?)', '')) || ' Balaclava'

    -- ====== SOCKS / SLEEVES (normalize) ======
    WHEN normalize(name, NFC) ILIKE 'vớ%' OR normalize(name, NFC) ILIKE 'tất%'
      THEN TRIM(REGEXP_REPLACE(normalize(name, NFC), E'(?i)^(vớ|tất)\\s*', '')) || ' Motorcycle Socks'

    WHEN normalize(name, NFC) ILIKE 'ống tay%'
      THEN TRIM(REGEXP_REPLACE(normalize(name, NFC), E'(?i)^ống\\s+tay\\s+(chống\\s+nắng\\s+)?', '')) || ' Arm Sleeves'

    -- ====== MISC NEW CATEGORIES ======
    WHEN normalize(name, NFC) ILIKE 'giá đỡ điện thoại%' OR normalize(name, NFC) ILIKE 'giá đỡ tay lái%'
      THEN TRIM(REGEXP_REPLACE(normalize(name, NFC),
        E'(?i)^(giá\\s+đỡ\\s+(điện\\s+thoại|tay\\s+lái)\\s+(gắn\\s+chân\\s+gương\\s+|gắn\\s+ghi\\s+đông\\s+|osopro\\s+chống\\s+rung\\s+-\\s+chân\\s+ghi\\s+đông\\s+)?)', '')) || ' Motorcycle Phone Mount'

    WHEN normalize(name, NFC) ILIKE 'đai lưng%'
      THEN TRIM(REGEXP_REPLACE(normalize(name, NFC), E'(?i)^đai\\s+lưng\\s*', '')) || ' Lumbar Support Belt'

    WHEN normalize(name, NFC) ILIKE 'đồ bảo vệ cổ%'
      THEN TRIM(REGEXP_REPLACE(normalize(name, NFC), E'(?i)^đồ\\s+bảo\\s+vệ\\s+cổ\\s*', '')) || ' Neck Brace'

    WHEN normalize(name, NFC) ILIKE 'camera hành trình%'
      THEN TRIM(REGEXP_REPLACE(normalize(name, NFC), E'(?i)^camera\\s+hành\\s+trình\\s+(gắn\\s+mũ\\s+bảo\\s+hiểm\\s+)?', '')) || ' Action Dash Camera'

    WHEN normalize(name, NFC) ILIKE 'dây ràng%'
      THEN TRIM(REGEXP_REPLACE(normalize(name, NFC), E'(?i)^dây\\s+ràng\\s*', '')) || ' Strapping System'

    WHEN normalize(name, NFC) ILIKE 'dưỡng sên%'
      THEN TRIM(REGEXP_REPLACE(normalize(name, NFC), E'(?i)^dưỡng\\s+sên\\s*', '')) || ' Chain Lubricant'

    WHEN normalize(name, NFC) ILIKE 'ủng đi mưa%'
      THEN TRIM(REGEXP_REPLACE(normalize(name, NFC), E'(?i)^ủng\\s+đi\\s+mưa\\s*', '')) || ' Rain Boot Cover'

    WHEN normalize(name, NFC) ILIKE 'khẩu trang%'
      THEN TRIM(REGEXP_REPLACE(normalize(name, NFC), E'(?i)^khẩu\\s+trang\\s*(ninja\\s+thái\\s+lan\\s+)?', '')) || ' Balaclava Face Mask'

    WHEN normalize(name, NFC) ILIKE 'móc treo đồ%'
      THEN TRIM(REGEXP_REPLACE(normalize(name, NFC), E'(?i)^móc\\s+treo\\s+đồ\\s+(dành\\s+cho\\s+(motor|xe\\s+máy)\\s+)?', '')) || ' Motorcycle Hook Organizer'

    WHEN normalize(name, NFC) ILIKE 'phụ kiện dây ràng%'
      THEN TRIM(REGEXP_REPLACE(normalize(name, NFC), E'(?i)^phụ\\s+kiện\\s+dây\\s+ràng\\s*', '')) || ' Luggage Strap Accessory'

    WHEN normalize(name, NFC) ILIKE 'quadlock%' OR normalize(name, NFC) ILIKE 'đầu sạc không dây%'
      THEN normalize(name, NFC)  -- already mostly English or brand name

    WHEN normalize(name, NFC) ILIKE 'phủ nano%'
      THEN TRIM(REGEXP_REPLACE(normalize(name, NFC), E'(?i)^phủ\\s+nano\\s+(cho\\s+kính\\s+nón\\s+)?', '')) || ' Visor Nano Coating'

    -- ====== FALLBACK: Return normalized name (better than raw NFD name) ======
    ELSE normalize(name, NFC)
  END
)
WHERE name_en ~ '[àáảãạăắặẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđÀÁẢÃẠĂẮẶẲẴẶÂẤẦẨẪẬÈÉẺẼẸÊẾỀỂỄỆÌÍỈĨỊÒÓỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÙÚỦŨỤƯỨỪỬỮỰỲÝỶỸỴĐ]';

-- Update seo_title_en for any that still need it after the second pass
UPDATE products SET seo_title_en = name_en
WHERE name_en IS NOT NULL AND seo_title_en IS NULL;
