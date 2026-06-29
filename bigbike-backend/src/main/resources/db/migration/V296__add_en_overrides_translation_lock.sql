-- V296: Per-record "English manual override" lock for server-side auto-translation.
--
-- Stores the set of English fields/sections an admin edited BY HAND. On save the
-- backend re-translates every translatable field NOT in this set from Vietnamese
-- (Gemini), and KEEPS the admin's English for fields that ARE in the set.
-- See BUSINESS_RULES.md PRODUCT_RULE_001 / CATEGORY/BRAND/ARTICLE_RULE_001.
--
-- Format: JSON array of override keys, e.g. ["name","description","section:specifications"].
-- NULL / absent = nothing locked yet (every English field tracks Vietnamese).

ALTER TABLE products   ADD COLUMN IF NOT EXISTS en_overrides text;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS en_overrides text;
ALTER TABLE brands     ADD COLUMN IF NOT EXISTS en_overrides text;
ALTER TABLE articles   ADD COLUMN IF NOT EXISTS en_overrides text;
