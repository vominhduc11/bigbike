-- Fix 13 headset products that were mis-classified as helmets
-- Pattern: "TAI NGHE BLUETOOTH [INTERCOM] [CAMERA xK] {MODEL} CHO MŨ BẢO HIỂM"
-- -> extract {MODEL}, add "Bluetooth Intercom Headset"

UPDATE products SET name_en =
  TRIM(
    REGEXP_REPLACE(
      REGEXP_REPLACE(
        REGEXP_REPLACE(
          REGEXP_REPLACE(name,
            E'(?i)^\\(NEW\\)\\s*', ''),       -- strip (NEW) prefix
          E'(?i)^tai\\s+nghe\\s+bluetooth\\s+(intercom\\s+)?(camera\\s+\\S+\\s+)?(intercom\\s+)?', ''),  -- strip prefix
        E'(?i)\\s+cho\\s+mũ\\s+bảo\\s+hiểm.*$', ''),  -- strip "CHO MŨ BẢO HIỂM..." suffix
      E'(?i)\\s+bluetooth\\s+intercom\\s*$', '')         -- strip trailing " bluetooth intercom"
  ) || ' Bluetooth Intercom Headset'
WHERE name ILIKE '%tai nghe%' AND name ILIKE '%mũ bảo hiểm%';
