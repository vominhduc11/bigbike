-- Site setting bilingual value (V162). Vietnamese `setting_value` stays canonical;
-- the optional English value is stored in nullable `setting_value_en`. Public reads
-- resolve via COALESCE(setting_value_en, setting_value) for the storefront language.
-- Only display-text keys (home/hero/footer/SEO groups) are translated in the admin
-- editor; config/URL/number keys leave this NULL and always fall back to Vietnamese.
alter table site_settings
    add column setting_value_en text;
