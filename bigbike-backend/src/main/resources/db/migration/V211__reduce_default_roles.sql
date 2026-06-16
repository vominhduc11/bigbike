-- Reduce the built-in role set from 7 to 4.
-- V49 originally seeded SUPER_ADMIN, ADMIN, SHOP_MANAGER, EDITOR, AUTHOR, CONTRIBUTOR, SEO_EDITOR.
-- AUTHOR / CONTRIBUTOR / SEO_EDITOR are WordPress-legacy content roles that don't map to how the
-- shop actually staffs. Remove them and fold SEO redirect capability into EDITOR so no SEO work is lost.
-- Kept built-in roles: SUPER_ADMIN, ADMIN, SHOP_MANAGER, EDITOR.

-- 1) Fold SEO redirect permissions into EDITOR (was only on the removed SEO_EDITOR role).
INSERT INTO role_permissions (role_id, permission) VALUES
    ('EDITOR', 'redirects.read'),
    ('EDITOR', 'redirects.write')
ON CONFLICT (role_id, permission) DO NOTHING;

-- 2) Safety for any environment where staff are still assigned a removed role:
--    reassign them to EDITOR (closest surviving content role) before the role is dropped.
UPDATE admin_users
   SET role = 'EDITOR', updated_at = NOW()
 WHERE role IN ('AUTHOR', 'CONTRIBUTOR', 'SEO_EDITOR');

-- 3) Drop the removed roles. role_permissions rows would cascade via FK, but delete explicitly for clarity.
DELETE FROM role_permissions WHERE role_id IN ('AUTHOR', 'CONTRIBUTOR', 'SEO_EDITOR');
DELETE FROM admin_roles      WHERE id      IN ('AUTHOR', 'CONTRIBUTOR', 'SEO_EDITOR');
