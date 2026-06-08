-- Menu item bilingual label (V160). Vietnamese `label` stays canonical; the
-- optional English label is stored in a nullable `label_en` column on the same
-- row. Public reads resolve via COALESCE(label_en, label) — falls back to
-- Vietnamese when blank. Mirrors the product/category/brand bilingual pattern
-- (V136/V137). No translation table: only two fixed locales.
alter table menu_items
    add column label_en varchar(255);
