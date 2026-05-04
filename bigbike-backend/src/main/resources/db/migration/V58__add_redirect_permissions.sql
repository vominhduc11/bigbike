-- Add redirects permissions after the roles/permissions schema migration.
-- This keeps existing databases compatible while enabling SEO migration tooling.

INSERT INTO role_permissions (role_id, permission) VALUES
('ADMIN', 'redirects.read'),
('ADMIN', 'redirects.write'),
('SEO_EDITOR', 'redirects.read'),
('SEO_EDITOR', 'redirects.write')
ON CONFLICT (role_id, permission) DO NOTHING;
