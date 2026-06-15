-- V196: Add pos.sell_below_cost permission.
-- A POS price override below the product/variant cost is blocked by default; this permission
-- lets a higher-level admin bypass the block (e.g. clearance). ADMIN gets it by default;
-- SHOP_MANAGER does not. SUPER_ADMIN holds the '*' wildcard so needs no explicit grant.
INSERT INTO role_permissions (role_id, permission) VALUES
('ADMIN', 'pos.sell_below_cost')
ON CONFLICT (role_id, permission) DO NOTHING;
