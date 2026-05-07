-- Fix rows where resource_type was incorrectly set to 'ADMIN_ROLE:<roleId>'
-- Root cause: AdminRoleService.buildAudit() was embedding roleId into resource_type column.
-- The roleId is now preserved inside beforeData/afterData JSON under the "roleId" key.
UPDATE audit_logs
SET resource_type = 'ADMIN_ROLE'
WHERE resource_type LIKE 'ADMIN_ROLE:%';
