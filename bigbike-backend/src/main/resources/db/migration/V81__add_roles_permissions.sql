-- P1: Separate roles.read / roles.write from admin-users.* so that the Roles
-- UI can be gated independently from Admin Users management.
-- ADMIN gets both. SUPER_ADMIN already has wildcard (*) and needs no change.

INSERT INTO role_permissions (role_id, permission) VALUES
    ('ADMIN', 'roles.read'),
    ('ADMIN', 'roles.write')
ON CONFLICT (role_id, permission) DO NOTHING;
