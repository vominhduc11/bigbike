-- V266: Remove the warranty feature entirely (owner decision 2026-06-23).
--
-- Retires the whole warranty module: the warranty_records ledger (V90), the public
-- /bao-hanh lookup tool, the admin warranty screen, the auto-create on order completion
-- (web + POS), the warranty.* permissions, the public_warranty page-copy settings (V225)
-- and the default_warranty_months operational setting, plus the dormant per-product
-- warranty columns (V175). After serial (V259), return/refund (V261) and receivables
-- (V263), warranty was the last record-keeping side-effect of order completion.
--
-- Idempotent: every statement guards with IF EXISTS / WHERE so a re-run is a no-op.

-- ── (1) Drop the warranty ledger table (indexes/constraints go with it) ─────────────
DROP TABLE IF EXISTS warranty_records CASCADE;

-- ── (2) Drop the dormant per-product warranty fields (V175) ─────────────────────────
ALTER TABLE products
    DROP COLUMN IF EXISTS warranty_months,
    DROP COLUMN IF EXISTS warranty_scope;

-- ── (3) Remove warranty.* permissions from every role ───────────────────────────────
-- role_permissions is the only permission-catalog table in this schema, so deleting the
-- role grants fully retires the keys.
DELETE FROM role_permissions WHERE permission LIKE 'warranty.%';

-- ── (4) Remove warranty settings: page copy (V225) + default term (inventory group) ──
DELETE FROM site_settings WHERE setting_group = 'public_warranty';
DELETE FROM site_settings WHERE setting_key = 'default_warranty_months';
