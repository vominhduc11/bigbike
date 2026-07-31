-- V363: Restore the catalog read permission required by product pickers.
-- The ADMIN system role is expected to retain products.read (V49 and the
-- canonical permission matrix). Keep this idempotent so existing deployments
-- are repaired without changing any other role permissions.
INSERT INTO role_permissions (role_id, permission)
VALUES ('ADMIN', 'products.read')
ON CONFLICT (role_id, permission) DO NOTHING;
