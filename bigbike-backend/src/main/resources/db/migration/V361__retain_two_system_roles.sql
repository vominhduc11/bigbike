-- Only the system owner and administrator remain protected system roles.
-- Preserve every other role record, its permissions, and existing user assignments
-- by reclassifying it as a custom role instead of deleting or reassigning it.
UPDATE admin_roles
   SET is_system = FALSE,
       updated_at = NOW()
 WHERE is_system = TRUE
   AND id NOT IN ('SUPER_ADMIN', 'ADMIN');
