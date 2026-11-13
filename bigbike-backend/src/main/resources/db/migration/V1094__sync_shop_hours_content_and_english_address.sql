-- Owner 07/11/2026, STORE_HOURS_RULE_001.
-- Replace only the verified shop-hours clauses in the editable introduction.
-- A placeholder keeps future display synchronized with the web's shared schedule.
-- Other prose, custom schedules, VI address and other settings remain intact.
UPDATE site_settings
SET setting_value = replace(replace(setting_value,
        'T2–T7: 9:00–21:00 | CN: 9:00–18:00', '{{store_hours}}'),
        'T2–T7: 9:00–21:00 | CN: 9:00–17:00', '{{store_hours}}'),
    updated_at = now()
WHERE setting_key = 'home_content_bottom_html'
  AND (strpos(setting_value, 'T2–T7: 9:00–21:00 | CN: 9:00–18:00') > 0
    OR strpos(setting_value, 'T2–T7: 9:00–21:00 | CN: 9:00–17:00') > 0);

UPDATE site_settings
SET setting_value_en = replace(replace(setting_value_en,
        'Mon–Sat: 9:00 AM–9:00 PM | Sun: 9:00 AM–6:00 PM', '{{store_hours}}'),
        'Mon–Sat: 9:00 AM–9:00 PM | Sun: 9:00 AM–5:00 PM', '{{store_hours}}'),
    updated_at = now()
WHERE setting_key = 'home_content_bottom_html'
  AND (strpos(setting_value_en, 'Mon–Sat: 9:00 AM–9:00 PM | Sun: 9:00 AM–6:00 PM') > 0
    OR strpos(setting_value_en, 'Mon–Sat: 9:00 AM–9:00 PM | Sun: 9:00 AM–5:00 PM') > 0);

UPDATE site_settings
SET setting_value_en = '79/30/52 Au Co, Hoa Binh Ward, Ho Chi Minh City',
    updated_at = now()
WHERE setting_key = 'contact_address'
  AND setting_value_en = '79/30/52 Au Co, Ward 14, District 11, Ho Chi Minh City';
