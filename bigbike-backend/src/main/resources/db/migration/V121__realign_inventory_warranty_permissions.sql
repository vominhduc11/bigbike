-- V121: Realign inventory & warranty permission gating (audit AL-03) — non-breaking backfill.
--
-- Problem: the permission key `inventory.*` actually gates the Warranty module,
-- while the Inventory/Serial module is gated by `products.*`. Backend controllers
-- and the admin UI are re-gated in the same change set so that:
--   - Inventory/Serial endpoints move from products.* -> inventory.*
--   - Warranty endpoints   move from inventory.* -> warranty.*
--
-- This migration backfills role_permissions so NO existing role (built-in OR
-- custom) loses access after the controllers are re-gated.
--
-- Order matters: the warranty backfill runs BEFORE the inventory backfill, so a
-- role that only had products.read (e.g. EDITOR) gains inventory.* but NOT
-- warranty.* — it never had warranty access and must not gain it here.
--
-- All statements are idempotent (ON CONFLICT DO NOTHING). SUPER_ADMIN keeps the
-- wildcard `*` and is unaffected.

-- 1. warranty.* <- every role that currently holds inventory.* (= current warranty access).
INSERT INTO role_permissions (role_id, permission)
SELECT role_id, 'warranty.read' FROM role_permissions WHERE permission = 'inventory.read'
ON CONFLICT (role_id, permission) DO NOTHING;

INSERT INTO role_permissions (role_id, permission)
SELECT role_id, 'warranty.write' FROM role_permissions WHERE permission = 'inventory.write'
ON CONFLICT (role_id, permission) DO NOTHING;

-- 2. inventory.* <- every role that currently holds products.* (= current inventory/serial access).
INSERT INTO role_permissions (role_id, permission)
SELECT role_id, 'inventory.read' FROM role_permissions WHERE permission = 'products.read'
ON CONFLICT (role_id, permission) DO NOTHING;

INSERT INTO role_permissions (role_id, permission)
SELECT role_id, 'inventory.write' FROM role_permissions WHERE permission = 'products.update'
ON CONFLICT (role_id, permission) DO NOTHING;
