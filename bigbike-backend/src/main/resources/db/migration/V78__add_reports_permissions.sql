-- P1: Dedicated report permissions replacing the shared orders.read/customers.read/products.read gate.
-- reports.read  — access analytics dashboard and all CSV export endpoints
-- reports.export — separate gate for CSV export (enables audit log and rate limiting per P1 spec)

INSERT INTO role_permissions (role_id, permission) VALUES
('ADMIN',        'reports.read'),
('ADMIN',        'reports.export'),
('SHOP_MANAGER', 'reports.read'),
('SHOP_MANAGER', 'reports.export')
ON CONFLICT (role_id, permission) DO NOTHING;
