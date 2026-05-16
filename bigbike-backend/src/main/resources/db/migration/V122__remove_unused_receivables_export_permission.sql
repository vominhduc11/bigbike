-- V122: Remove the unused `receivables.export` permission (audit AL-05).
--
-- `receivables.export` was declared in PermissionCatalog and seeded to ADMIN
-- (V79) but no endpoint ever consumed it — there is no receivables export
-- feature in the codebase. Removing it keeps the permission catalog 1:1 with
-- real endpoints. No functional access changes: the key gated nothing.

DELETE FROM role_permissions WHERE permission = 'receivables.export';
