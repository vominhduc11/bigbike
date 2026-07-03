-- V309: Per-row "English manual override" lock for Settings VI→EN auto-translate on save,
-- mirroring the products/categories/brands/articles en_overrides lock (V296). Unlike those
-- entities, every site_settings row is already its own flat key/value pair — no nested
-- fields/sections to enumerate — so a single boolean per row is enough, no JSON array needed.
--
-- When true, auto-translate on save skips this row's setting_value_en and keeps the admin's
-- manually-edited English. See BUSINESS_RULES.md SETTINGS_RULE_001 / TRANSLATION_RULE_002.

ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS en_locked boolean NOT NULL DEFAULT false;
