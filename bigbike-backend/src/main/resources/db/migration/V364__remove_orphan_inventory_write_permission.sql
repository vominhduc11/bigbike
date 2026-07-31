-- V364: Remove the obsolete standalone inventory mutation permission.
-- Availability is mutated only by product upsert (products.update) since the
-- standalone inventory PATCH endpoints were removed in AUD-056.
DELETE FROM role_permissions
 WHERE permission = 'inventory.write';
