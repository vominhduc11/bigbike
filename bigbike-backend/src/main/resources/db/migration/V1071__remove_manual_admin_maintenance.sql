-- V1071 — remove the manual admin maintenance lock (owner decision 2026-08-30).
--
-- This is a new forward-only cleanup. V373, V374, V375 and V1054 have already
-- run on the real server and must remain unchanged.
--
-- Move the verified technical account before removing DEVELOPER. The second
-- update is defensive for any other stale direct assignment; it does not
-- change any customer, order, inventory or checkout data.
UPDATE admin_users
SET role = 'ADMIN',
    access_version = access_version + 1,
    updated_at = NOW()
WHERE LOWER(email) = LOWER('vominhduc760@gmail.com')
  AND role = 'DEVELOPER';

UPDATE admin_users
SET role = 'ADMIN',
    access_version = access_version + 1,
    updated_at = NOW()
WHERE role = 'DEVELOPER';

DO $$
BEGIN
    -- Fresh databases do not contain the production technical account. When
    -- the account does exist, keep the safety gate and require ADMIN.
    IF EXISTS (
        SELECT 1
        FROM admin_users
        WHERE LOWER(email) = LOWER('vominhduc760@gmail.com')
          AND role <> 'ADMIN'
    ) THEN
        RAISE EXCEPTION
            'V1071 stopped safely: the existing technical account was not moved to ADMIN';
    END IF;
END $$;

-- Keep the legacy multi-role join table free of the retired role. Avoid a
-- primary-key collision when a user already has the ADMIN row.
DELETE FROM admin_user_roles developer_role
WHERE developer_role.role = 'DEVELOPER'
  AND EXISTS (
      SELECT 1
      FROM admin_user_roles admin_role
      WHERE admin_role.admin_user_id = developer_role.admin_user_id
        AND admin_role.role = 'ADMIN'
  );

UPDATE admin_user_roles
SET role = 'ADMIN'
WHERE role = 'DEVELOPER';

DELETE FROM role_permissions
WHERE role_id = 'DEVELOPER';

DELETE FROM admin_roles
WHERE id = 'DEVELOPER';

DROP TABLE IF EXISTS maintenance_state;

DELETE FROM site_settings
WHERE setting_key IN (
    'maintenance_mode',
    'maintenance_notice_enabled',
    'maintenance_orders_paused',
    'maintenance_notice_content',
    'maintenance_expected_at'
);
