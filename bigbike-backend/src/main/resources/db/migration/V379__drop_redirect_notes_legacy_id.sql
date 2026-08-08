-- Owner decision 2026-08-08: notes/legacyId removed from the redirects admin screen and API.
-- Neither column was ever read by the live redirect-serving path (bigbike-web/proxy.ts,
-- InternalRedirectController) — only by the admin form/search. See BUSINESS_RULES.md
-- REDIRECT_RULE_010.
DROP INDEX IF EXISTS idx_redirects_legacy_id;
ALTER TABLE redirects DROP COLUMN IF EXISTS notes;
ALTER TABLE redirects DROP COLUMN IF EXISTS legacy_id;
