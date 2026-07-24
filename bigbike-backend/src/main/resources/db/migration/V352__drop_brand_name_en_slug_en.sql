-- V352: Drop the legacy brand name_en / slug_en columns.
-- Brand name and slug have always been shared across VI/EN (BRAND_RULE_001/003); these
-- columns were already ignored by every read/write path (V137/V215 legacy compatibility
-- only) and hold no distinct data (name_en duplicates name; slug_en was never populated
-- by any live brand). See DATA_CONTRACT.md "Brand bilingual content" / "English URL slug".

drop index if exists ux_brands_slug_en;

alter table brands
    drop column if exists name_en,
    drop column if exists slug_en;
