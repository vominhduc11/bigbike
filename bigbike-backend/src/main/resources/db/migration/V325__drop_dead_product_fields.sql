-- Drops 4 product fields confirmed fully dead end-to-end (no admin input UI, no web
-- rendering — see BUSINESS_RULES.md PRODUCT_RULE_006): promotionContent, installationGuide,
-- sectionVisibility, tabs (product_tabs). Their historical add migrations (V124, V133, V136,
-- V231, V245) and the data-shape migration V242 are left untouched (Flyway checksum-locks
-- already-applied migrations); V238__ConsolidateProductDescriptionBlocks.java also touches
-- product_tabs as a historical, already-applied migration and is likewise left untouched.
--
-- Do NOT touch product_faqs (added alongside installation_guide by V133 — unrelated FAQ
-- feature) or the other *_en columns added by V136 (name_en, short_description_en,
-- description_en, content_bottom_en, seo_title_en, seo_description_en,
-- product_specifications.*_en, product_faqs.*_en) — all still live.

ALTER TABLE products DROP COLUMN IF EXISTS promotion_content;
ALTER TABLE products DROP COLUMN IF EXISTS promotion_content_en;
ALTER TABLE products DROP COLUMN IF EXISTS installation_guide;
ALTER TABLE products DROP COLUMN IF EXISTS installation_guide_en;
ALTER TABLE products DROP COLUMN IF EXISTS section_visibility;
ALTER TABLE products DROP COLUMN IF EXISTS product_tabs;
