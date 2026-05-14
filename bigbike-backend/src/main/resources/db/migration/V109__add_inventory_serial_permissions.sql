-- Grant inventory.read / inventory.write to roles that manage stock and warranties.
-- SUPER_ADMIN already has wildcard (*) and needs no change.

INSERT INTO role_permissions (role_id, permission) VALUES
    ('ADMIN',        'inventory.read'),
    ('ADMIN',        'inventory.write'),
    ('SHOP_MANAGER', 'inventory.read'),
    ('SHOP_MANAGER', 'inventory.write')
ON CONFLICT (role_id, permission) DO NOTHING;

-- Seed the reservation TTL used by SerialReservationCleanupJob.
-- 15 minutes matches standard checkout session length.
INSERT INTO site_settings (id, setting_key, setting_value, setting_group, is_public, description, created_at, updated_at)
SELECT '00000000-0000-0000-0000-000000000901', 'reservation_ttl_minutes',
       '15', 'INVENTORY', false,
       'Serial reservation TTL in minutes. Reservations older than this are released by the cleanup job.',
       now(), now()
WHERE NOT EXISTS (SELECT 1 FROM site_settings WHERE setting_key = 'reservation_ttl_minutes');
