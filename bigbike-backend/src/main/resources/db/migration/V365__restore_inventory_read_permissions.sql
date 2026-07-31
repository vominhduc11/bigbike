-- V365: Restore the inventory read grant required by the Dashboard summary.
-- V121 backfilled this permission from products.read, but later permission
-- repairs can add products.read after V121 has already run. Keep the current
-- documented grants and the V121 compatibility rule aligned.
--
-- SHOP_MANAGER and EDITOR are historical custom roles, not guaranteed rows.
-- Seed only the roles that still exist in admin_roles so a legitimate role
-- deletion does not break migration replay.

INSERT INTO role_permissions (role_id, permission)
SELECT r.id, 'products.read'
FROM admin_roles r
WHERE r.id IN ('ADMIN', 'SHOP_MANAGER', 'EDITOR')
ON CONFLICT (role_id, permission) DO NOTHING;

INSERT INTO role_permissions (role_id, permission)
SELECT role_id, 'inventory.read'
FROM role_permissions
WHERE permission = 'products.read'
ON CONFLICT (role_id, permission) DO NOTHING;
