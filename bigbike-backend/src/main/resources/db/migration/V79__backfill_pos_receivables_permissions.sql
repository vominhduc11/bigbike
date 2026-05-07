-- V79: Backfill permissions that exist in AdminRolePermissions.MAP but were never inserted into
-- role_permissions by earlier migrations (V49/V58/V78).
-- Required before switching runtime auth to read from DB instead of the static map.

-- ADMIN: POS permissions (added when POS module was built, only in static map)
INSERT INTO role_permissions (role_id, permission) VALUES
('ADMIN', 'pos.read'),
('ADMIN', 'pos.write'),
('ADMIN', 'pos.price_override')
ON CONFLICT (role_id, permission) DO NOTHING;

-- ADMIN: Accounts Receivable permissions (added when AR module was built, only in static map)
INSERT INTO role_permissions (role_id, permission) VALUES
('ADMIN', 'receivables.read'),
('ADMIN', 'receivables.create'),
('ADMIN', 'receivables.record_payment'),
('ADMIN', 'receivables.write_off'),
('ADMIN', 'receivables.override_limit'),
('ADMIN', 'receivables.export')
ON CONFLICT (role_id, permission) DO NOTHING;

-- SHOP_MANAGER: POS permissions
INSERT INTO role_permissions (role_id, permission) VALUES
('SHOP_MANAGER', 'pos.read'),
('SHOP_MANAGER', 'pos.write')
ON CONFLICT (role_id, permission) DO NOTHING;

-- SHOP_MANAGER: Accounts Receivable permissions
INSERT INTO role_permissions (role_id, permission) VALUES
('SHOP_MANAGER', 'receivables.read'),
('SHOP_MANAGER', 'receivables.record_payment')
ON CONFLICT (role_id, permission) DO NOTHING;
