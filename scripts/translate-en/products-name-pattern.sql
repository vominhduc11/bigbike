-- ============================================================
-- PRODUCTS: Pattern-based name_en + seo_title_en + seo_description_en
-- Strategy: detect VI prefix → strip → rebuild with EN suffix
-- ============================================================

-- ----------------------------------------------------------------
-- STEP 1: Build name_en using pattern detection
-- ----------------------------------------------------------------
UPDATE products SET name_en = (
  -- Helper: clean the raw name by removing common Vietnamese filler words
  -- then reconstruct with English type label
  CASE
    -- =========== HELMETS ===========
    WHEN name ~* '(mũ|nón)\s+bảo\s+hiểm\s+fullface\s+lật\s+hàm'
      OR name ~* '(mũ|nón)\s+bảo\s+hiểm\s+lật\s+hàm' THEN
        TRIM(REGEXP_REPLACE(name,
          E'(?i)(mũ|nón)\\s+bảo\\s+hiểm\\s+(fullface\\s+)?lật\\s+hàm\\s*',
          '', 'gi')) || ' Flip-Up Full Face Helmet'

    WHEN name ~* '(mũ|nón)\s+fullface|nón\s+full.?face'
         OR name ~* '(mũ|nón)\s+bảo\s+hiểm\s+fullface'
         OR name ~* '(mũ|nón)\s+bảo\s+hiểm\s+full.?face' THEN
        TRIM(REGEXP_REPLACE(name,
          E'(?i)(mũ|nón)\\s+bảo\\s+hiểm\\s+fullface\\s*',
          '', 'gi')) ||
        TRIM(REGEXP_REPLACE(REGEXP_REPLACE(name,
          E'(?i)(mũ|nón)\\s+fullface\\s*', '', 'gi'),
          E'(?i)(mũ|nón)\\s+bảo\\s+hiểm\\s+full.?face\\s*', '', 'gi'))
        -- fallback concat approach below
        || ' Full Face Helmet'

    WHEN name ~* '(mũ|nón)\s+bảo\s+hiểm\s+3/4' THEN
        TRIM(REGEXP_REPLACE(name,
          E'(?i)(mũ|nón)\\s+bảo\\s+hiểm\\s+3/4\\s*',
          '', 'gi')) || ' 3/4 Face Helmet'

    WHEN name ~* '(mũ|nón)\s+bảo\s+hiểm\s+(cào\s+cào|dual.?sport|off.?road)' THEN
        TRIM(REGEXP_REPLACE(name,
          E'(?i)(mũ|nón)\\s+bảo\\s+hiểm\\s+(cào\\s+cào|dual.?sport|off.?road)\\s*',
          '', 'gi')) || ' Dual Sport Helmet'

    WHEN name ~* '(mũ|nón)\s+bảo\s+hiểm' THEN
        TRIM(REGEXP_REPLACE(name,
          E'(?i)(mũ|nón)\\s+bảo\\s+hiểm\\s*',
          '', 'gi')) || ' Motorcycle Helmet'

    -- =========== GLOVES ===========
    WHEN name ~* 'găng\s+tay\s+(moto\s+phượt|phượt\s+moto|moto|xe\s+máy|xe\s+may|da\s+moto|racing|race|summer)' THEN
        TRIM(REGEXP_REPLACE(name,
          E'(?i)găng\\s+tay\\s+(moto\\s+phượt|phượt\\s+moto|moto|xe\\s+máy|xe\\s+may|da\\s+moto|racing|race|summer)\\s*',
          '', 'gi')) || ' Motorcycle Riding Gloves'

    WHEN name ~* 'găng\s+tay\s+da\s+' THEN
        TRIM(REGEXP_REPLACE(name,
          E'(?i)găng\\s+tay\\s+da\\s*',
          '', 'gi')) || ' Leather Riding Gloves'

    WHEN name ~* 'găng\s+tay' THEN
        TRIM(REGEXP_REPLACE(name,
          E'(?i)găng\\s+tay\\s*',
          '', 'gi')) || ' Riding Gloves'

    -- =========== JACKETS ===========
    WHEN name ~* 'áo\s+túi\s+khí|áo\s+bảo\s+hộ\s+túi\s+khí' THEN
        TRIM(REGEXP_REPLACE(name,
          E'(?i)áo\\s+(bảo\\s+hộ\\s+)?túi\\s+khí\\s*',
          '', 'gi')) || ' Airbag Jacket'

    WHEN name ~* 'áo\s+(mưa|mua)' THEN
        TRIM(REGEXP_REPLACE(name,
          E'(?i)áo\\s+(mưa|mua)\\s+(bộ\\s+)?',
          '', 'gi')) || ' Rain Jacket'

    WHEN name ~* 'áo\s+(mưa|mua)\s+bộ|áo\s+quần\s+(mưa|mua)' THEN
        TRIM(REGEXP_REPLACE(name,
          E'(?i)áo\\s+(quần\\s+)?(mưa|mua)\\s+(bộ\\s+)?',
          '', 'gi')) || ' Rain Gear Set'

    WHEN name ~* 'áo\s+lót' THEN
        TRIM(REGEXP_REPLACE(name,
          E'(?i)áo\\s+lót\\s*',
          '', 'gi')) || ' Base Layer Top'

    WHEN name ~* 'áo\s+phản\s+quang' THEN
        TRIM(REGEXP_REPLACE(name,
          E'(?i)áo\\s+phản\\s+quang\\s*',
          '', 'gi')) || ' High-Visibility Reflective Vest'

    WHEN name ~* 'áo\s+da\s+(nữ|nu|lady|woman)' THEN
        TRIM(REGEXP_REPLACE(name,
          E'(?i)áo\\s+da\\s+(nữ|nu|lady|woman)\\s*',
          '', 'gi')) || ' Women''s Leather Riding Jacket'

    WHEN name ~* 'áo\s+da' THEN
        TRIM(REGEXP_REPLACE(name,
          E'(?i)áo\\s+da\\s*',
          '', 'gi')) || ' Leather Riding Jacket'

    WHEN name ~* 'áo\s+touring\s+(nữ|nu|lady|woman)' THEN
        TRIM(REGEXP_REPLACE(name,
          E'(?i)áo\\s+touring\\s+(nữ|nu|lady|woman)\\s*',
          '', 'gi')) || ' Women''s Touring Jacket'

    WHEN name ~* 'áo\s+touring' THEN
        TRIM(REGEXP_REPLACE(name,
          E'(?i)áo\\s+touring\\s*',
          '', 'gi')) || ' Touring Jacket'

    WHEN name ~* 'áo\s+(khoác\s+)?bảo\s+hộ\s+(nữ|nu|lady|woman)' THEN
        TRIM(REGEXP_REPLACE(name,
          E'(?i)áo\\s+(khoác\\s+)?bảo\\s+hộ\\s+(nữ|nu|lady|woman)\\s*',
          '', 'gi')) || ' Women''s Protective Riding Jacket'

    WHEN name ~* 'áo\s+(khoác\s+)?bảo\s+hộ' THEN
        TRIM(REGEXP_REPLACE(name,
          E'(?i)áo\\s+(khoác\\s+)?bảo\\s+hộ\\s*',
          '', 'gi')) || ' Protective Riding Jacket'

    WHEN name ~* 'áo\s+giáp\s+(nữ|nu|lady|woman)' THEN
        TRIM(REGEXP_REPLACE(name,
          E'(?i)áo\\s+giáp\\s+(nữ|nu|lady|woman)\\s*',
          '', 'gi')) || ' Women''s Protective Riding Jacket'

    WHEN name ~* 'áo\s+giáp' THEN
        TRIM(REGEXP_REPLACE(name,
          E'(?i)áo\\s+giáp\\s*',
          '', 'gi')) || ' Protective Riding Jacket'

    WHEN name ~* 'áo\s+quần\s+(nữ|nu|lady|woman)' THEN
        TRIM(REGEXP_REPLACE(name,
          E'(?i)áo\\s+quần\\s+(nữ|nu|lady|woman)\\s*',
          '', 'gi')) || ' Women''s Jacket & Pants Set'

    WHEN name ~* 'áo\s+quần' THEN
        TRIM(REGEXP_REPLACE(name,
          E'(?i)áo\\s+quần\\s*',
          '', 'gi')) || ' Jacket & Pants Set'

    WHEN name ~* '^áo\s+(nữ|nu)\s+' THEN
        TRIM(REGEXP_REPLACE(name,
          E'(?i)^áo\\s+(nữ|nu)\\s*',
          '', 'gi')) || ' Women''s Riding Jacket'

    WHEN name ~* '^áo\s+khoác\s+bảo\s+hộ' THEN
        TRIM(REGEXP_REPLACE(name,
          E'(?i)^áo\\s+khoác\\s+bảo\\s+hộ\\s*',
          '', 'gi')) || ' Protective Riding Jacket'

    WHEN name ~* '^áo\s+khoác' THEN
        TRIM(REGEXP_REPLACE(name,
          E'(?i)^áo\\s+khoác\\s*',
          '', 'gi')) || ' Riding Jacket'

    -- catch-all for single "áo" prefix (áo BRAND MODEL)
    WHEN name ~* '^áo\s+' THEN
        TRIM(REGEXP_REPLACE(name,
          E'(?i)^áo\\s*',
          '', 'gi')) || ' Riding Jacket'

    -- =========== PANTS ===========
    WHEN name ~* 'quần\s+(bảo\s+hộ|giáp|touring|moto)\s+(nữ|nu|lady|woman)' THEN
        TRIM(REGEXP_REPLACE(name,
          E'(?i)quần\\s+(bảo\\s+hộ|giáp|touring|moto)\\s+(nữ|nu|lady|woman)\\s*',
          '', 'gi')) || ' Women''s Armored Riding Pants'

    WHEN name ~* 'quần\s+touring' THEN
        TRIM(REGEXP_REPLACE(name,
          E'(?i)quần\\s+touring\\s*',
          '', 'gi')) || ' Touring Pants'

    WHEN name ~* 'quần\s+(bảo\s+hộ|giáp|moto)' THEN
        TRIM(REGEXP_REPLACE(name,
          E'(?i)quần\\s+(bảo\\s+hộ|giáp|moto)\\s*',
          '', 'gi')) || ' Armored Riding Pants'

    WHEN name ~* '^quần\s+' THEN
        TRIM(REGEXP_REPLACE(name,
          E'(?i)^quần\\s*',
          '', 'gi')) || ' Riding Pants'

    -- =========== BOOTS / SHOES ===========
    WHEN name ~* 'giày\s+(bảo\s+hộ|touring|đi\s+phượt|racing|adventure|adv|motor|moto)' THEN
        TRIM(REGEXP_REPLACE(name,
          E'(?i)giày\\s+(bảo\\s+hộ|touring|đi\\s+phượt|racing|adventure|adv|motor|moto)\\s*',
          '', 'gi')) || ' Motorcycle Boots'

    WHEN name ~* '^giày\s+' THEN
        TRIM(REGEXP_REPLACE(name,
          E'(?i)^giày\\s*',
          '', 'gi')) || ' Motorcycle Boots'

    -- =========== HEADSETS ===========
    WHEN name ~* 'tai\s+nghe\s+(bluetooth|điện\s+thoại|intercom)' THEN
        TRIM(REGEXP_REPLACE(name,
          E'(?i)tai\\s+nghe\\s+(bluetooth\\s+)?(intercom\\s+)?(điện\\s+thoại\\s+)?(cho\\s+mũ\\s+bảo\\s+hiểm\\s+)?(cho\\s+nón\\s+bảo\\s+hiểm\\s+)?',
          '', 'gi')) || ' Bluetooth Headset'

    WHEN name ~* '^tai\s+nghe\s+' THEN
        TRIM(REGEXP_REPLACE(name,
          E'(?i)^tai\\s+nghe\\s*',
          '', 'gi')) || ' Headset'

    -- =========== BACKPACKS ===========
    WHEN name ~* '(balo|ba\s+lô)\s+(chống\s+nước|du\s+lịch|phượt|đi\s+phượt)' THEN
        TRIM(REGEXP_REPLACE(name,
          E'(?i)(balo|ba\\s+lô)\\s+(chống\\s+nước|du\\s+lịch|phượt|đi\\s+phượt)\\s*',
          '', 'gi')) || ' Waterproof Touring Backpack'

    WHEN name ~* '^(balo|ba\s+lô)\s+' THEN
        TRIM(REGEXP_REPLACE(name,
          E'(?i)^(balo|ba\\s+lô)\\s*',
          '', 'gi')) || ' Backpack'

    -- =========== BAGS ===========
    WHEN name ~* 'túi\s+đeo\s+đùi' THEN
        TRIM(REGEXP_REPLACE(name,
          E'(?i)túi\\s+đeo\\s+đùi\\s*',
          '', 'gi')) || ' Thigh Bag'

    WHEN name ~* 'túi\s+(đeo\s+hông|bao\s+tử)' THEN
        TRIM(REGEXP_REPLACE(name,
          E'(?i)túi\\s+(đeo\\s+hông|bao\\s+tử)\\s*',
          '', 'gi')) || ' Hip Bag'

    WHEN name ~* 'túi\s+chống\s+nước' THEN
        TRIM(REGEXP_REPLACE(name,
          E'(?i)túi\\s+chống\\s+nước\\s*',
          '', 'gi')) || ' Waterproof Bag'

    WHEN name ~* 'túi\s+treo\s+xe' THEN
        TRIM(REGEXP_REPLACE(name,
          E'(?i)túi\\s+treo\\s+xe\\s*',
          '', 'gi')) || ' Bike-Mounted Bag'

    WHEN name ~* 'túi\s+(hành\s+lý|du\s+lịch)' THEN
        TRIM(REGEXP_REPLACE(name,
          E'(?i)túi\\s+(hành\\s+lý|du\\s+lịch)\\s*',
          '', 'gi')) || ' Travel Bag'

    WHEN name ~* 'túi\s+yên' THEN
        TRIM(REGEXP_REPLACE(name,
          E'(?i)túi\\s+yên\\s*',
          '', 'gi')) || ' Seat Bag'

    WHEN name ~* 'túi\s+xe\s+máy|túi\s+moto' THEN
        TRIM(REGEXP_REPLACE(name,
          E'(?i)túi\\s+(xe\\s+máy|moto)\\s*',
          '', 'gi')) || ' Motorcycle Bag'

    WHEN name ~* '^túi\s+' THEN
        TRIM(REGEXP_REPLACE(name,
          E'(?i)^túi\\s*',
          '', 'gi')) || ' Bag'

    -- =========== ARMOR / GUARDS ===========
    WHEN name ~* '(giáp|bảo\s+hộ)\s+(gối|chân)' THEN
        TRIM(REGEXP_REPLACE(name,
          E'(?i)(giáp|bảo\\s+hộ)\\s+(gối|chân)\\s*',
          '', 'gi')) || ' Knee & Leg Armor'

    WHEN name ~* '(giáp|bảo\s+hộ)\s+(tay|khuỷu)' THEN
        TRIM(REGEXP_REPLACE(name,
          E'(?i)(giáp|bảo\\s+hộ)\\s+(tay|khuỷu)\\s*',
          '', 'gi')) || ' Elbow & Arm Armor'

    WHEN name ~* 'giáp\s+bảo\s+hộ\s+tay\s+chân|bảo\s+hộ\s+tay\s+chân' THEN
        TRIM(REGEXP_REPLACE(name,
          E'(?i)(giáp\\s+)?bảo\\s+hộ\\s+tay\\s+chân\\s*',
          '', 'gi')) || ' Body Armor Set'

    WHEN name ~* 'giáp\s+bảo\s+hộ|bảo\s+hộ\s+giáp' THEN
        TRIM(REGEXP_REPLACE(name,
          E'(?i)(giáp\\s+bảo\\s+hộ|bảo\\s+hộ\\s+giáp)\\s*',
          '', 'gi')) || ' Body Armor'

    -- =========== OTHER SPECIFIC ITEMS ===========
    WHEN name ~* '^vớ\s+(đi|moto)' THEN
        TRIM(REGEXP_REPLACE(name, E'(?i)^vớ\\s+(đi|moto)\\s*', '', 'gi')) || ' Motorcycle Socks'

    WHEN name ~* '^vớ\s+' THEN
        TRIM(REGEXP_REPLACE(name, E'(?i)^vớ\\s*', '', 'gi')) || ' Socks'

    WHEN name ~* 'trùm\s+(đầu|mặt)' THEN
        TRIM(REGEXP_REPLACE(name, E'(?i)trùm\\s+(đầu|mặt)\\s*', '', 'gi')) || ' Balaclava'

    WHEN name ~* '^khăn\s+trùm' THEN
        TRIM(REGEXP_REPLACE(name, E'(?i)^khăn\\s+trùm\\s*', '', 'gi')) || ' Balaclava'

    WHEN name ~* 'quần\s+lót' THEN
        TRIM(REGEXP_REPLACE(name, E'(?i)quần\\s+lót\\s*', '', 'gi')) || ' Base Layer Underpants'

    WHEN name ~* 'áo\s+lót' THEN
        TRIM(REGEXP_REPLACE(name, E'(?i)áo\\s+lót\\s*', '', 'gi')) || ' Base Layer Top'

    WHEN name ~* 'ống\s+tay' THEN
        TRIM(REGEXP_REPLACE(name, E'(?i)ống\\s+tay\\s*', '', 'gi')) || ' Arm Sleeves'

    WHEN name ~* 'kính\s+(mũ|bảo\s+hiểm)' THEN
        TRIM(REGEXP_REPLACE(name, E'(?i)kính\\s+(mũ|bảo\\s+hiểm)\\s*', '', 'gi')) || ' Helmet Visor'

    WHEN name ~* 'pinlock|kính\s+chống\s+sương' THEN name || ' Anti-Fog Pinlock Insert'

    WHEN name ~* 'giá\s+đỡ\s+điện\s+thoại' THEN
        TRIM(REGEXP_REPLACE(name, E'(?i)giá\\s+đỡ\\s+điện\\s+thoại\\s*', '', 'gi')) || ' Motorcycle Phone Mount'

    WHEN name ~* 'trùm\s+xe' THEN
        TRIM(REGEXP_REPLACE(name, E'(?i)trùm\\s+xe\\s*', '', 'gi')) || ' Motorcycle Cover'

    WHEN name ~* 'dây\s+buộc|dây\s+cố\s+định' THEN
        TRIM(REGEXP_REPLACE(name, E'(?i)dây\\s+(buộc|cố\\s+định)\\s*', '', 'gi')) || ' Strapping System'

    WHEN name ~* 'miếng\s+chèn|foam|pad' THEN name || ' Padding/Insert'

    -- =========== FALLBACK: keep name as-is (likely already in English) ===========
    ELSE name
  END
)
WHERE name_en IS NULL;

-- ----------------------------------------------------------------
-- STEP 2: Clean up common Vietnamese filler words left in name_en
-- ----------------------------------------------------------------
UPDATE products SET name_en = TRIM(
  REGEXP_REPLACE(
    REGEXP_REPLACE(
      REGEXP_REPLACE(
        REGEXP_REPLACE(
          REGEXP_REPLACE(
            REGEXP_REPLACE(name_en,
              E'(?i)\\s+(chính\\s+hãng|chinh\\s+hang)',
              ' Genuine', 'gi'),
            E'(?i)\\s+(thanh\\s+lý|clearance)',
            ' (Clearance)', 'gi'),
          E'(?i)\\s+(giá\\s+rẻ|gia\\s+re)',
          '', 'gi'),
        E'(?i)\\s+(đi\\s+phượt|moto\\s+phượt|phượt)',
        '', 'gi'),
      E'(?i)\\s+(xe\\s+máy|mô\\s+tô|moto)',
      '', 'gi'),
    E'(?i)\\s+(cao\\s+cấp|bảo\\s+hộ)',
    '', 'gi')
)
WHERE name_en IS NOT NULL AND name_en != name;

-- ----------------------------------------------------------------
-- STEP 3: Populate seo_title_en and seo_description_en for products
-- where seo fields exist in Vietnamese
-- ----------------------------------------------------------------
-- Use name_en as seo_title_en baseline
UPDATE products SET seo_title_en = name_en
WHERE name_en IS NOT NULL AND seo_title_en IS NULL AND seo_title IS NOT NULL AND seo_title != '';

-- Generate basic seo_description_en from product type in name
UPDATE products SET seo_description_en =
  CASE
    WHEN name_en ~* 'helmet' THEN 'Genuine motorcycle helmet at BigBike. Full protection, certified safety standards. Ships nationwide.'
    WHEN name_en ~* 'gloves|glove' THEN 'Genuine motorcycle riding gloves at BigBike. CE-certified protection, ships nationwide.'
    WHEN name_en ~* 'jacket|touring jacket|riding jacket' THEN 'Genuine motorcycle protective riding jacket at BigBike. Certified armor, ships nationwide.'
    WHEN name_en ~* 'pants|riding pants' THEN 'Genuine motorcycle armored riding pants at BigBike. Certified protection, ships nationwide.'
    WHEN name_en ~* 'boots|motorcycle boots' THEN 'Genuine motorcycle protective boots at BigBike. Ships nationwide.'
    WHEN name_en ~* 'headset|bluetooth' THEN 'Genuine Bluetooth motorcycle headset at BigBike. Ships nationwide.'
    WHEN name_en ~* 'backpack' THEN 'Genuine waterproof motorcycle touring backpack at BigBike. Ships nationwide.'
    WHEN name_en ~* 'bag' THEN 'Genuine motorcycle bag at BigBike. Ships nationwide.'
    WHEN name_en ~* 'armor|guard' THEN 'Genuine motorcycle body armor at BigBike. CE-certified protection, ships nationwide.'
    ELSE 'Genuine motorcycle gear and accessories at BigBike. Ships nationwide.'
  END
WHERE name_en IS NOT NULL AND seo_description_en IS NULL
  AND seo_description IS NOT NULL AND seo_description != '';
