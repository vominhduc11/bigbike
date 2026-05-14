-- V112: Add pos.refund permission separate from pos.write.
-- Refunds require explicit authorization beyond the ability to create sales.
-- ADMIN receives it by default; SHOP_MANAGER does not.
INSERT INTO role_permissions (role_id, permission) VALUES
('ADMIN', 'pos.refund')
ON CONFLICT (role_id, permission) DO NOTHING;
