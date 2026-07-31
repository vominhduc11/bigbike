-- V366: Close permission dependencies for every existing non-wildcard role.
--
-- The dependency graph remains metadata; role_permissions keeps flat keys.
-- Only existing roles participate, existing grants are never removed, and
-- wildcard roles are already dependency-complete by definition.

WITH RECURSIVE
dependencies(permission, required_permission) AS (
    VALUES
        ('orders.write', 'orders.read'),
        ('customers.write', 'customers.read'),
        ('reviews.write', 'reviews.read'),
        ('products.update', 'products.read'),
        ('products.update', 'catalog.read'),
        ('catalog.update', 'catalog.read'),
        ('content.update', 'content.read'),
        ('media.write', 'media.read'),
        ('menus.write', 'menus.read'),
        ('sliders.write', 'sliders.read'),
        ('home_videos.write', 'home_videos.read'),
        ('home_highlights.write', 'home_highlights.read'),
        ('home_highlights.write', 'products.read'),
        ('redirects.write', 'redirects.read'),
        ('settings.write', 'settings.read'),
        ('admin-users.write', 'admin-users.read'),
        ('admin-users.write', 'roles.read'),
        ('roles.write', 'roles.read'),
        ('reports.export', 'reports.read')
),
eligible_roles AS (
    SELECT role.id
    FROM admin_roles role
    WHERE NOT EXISTS (
        SELECT 1
        FROM role_permissions wildcard
        WHERE wildcard.role_id = role.id
          AND wildcard.permission = '*'
    )
),
dependency_closure(role_id, selected_permission, required_permission) AS (
    SELECT eligible.id, granted.permission, dependency.required_permission
    FROM eligible_roles eligible
    JOIN role_permissions granted ON granted.role_id = eligible.id
    JOIN dependencies dependency ON dependency.permission = granted.permission

    UNION

    SELECT closure.role_id, closure.selected_permission, dependency.required_permission
    FROM dependency_closure closure
    JOIN dependencies dependency ON dependency.permission = closure.required_permission
)
INSERT INTO role_permissions (role_id, permission)
SELECT DISTINCT role_id, required_permission
FROM dependency_closure
ON CONFLICT (role_id, permission) DO NOTHING;
