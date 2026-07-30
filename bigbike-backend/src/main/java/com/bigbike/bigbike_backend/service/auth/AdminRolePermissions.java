package com.bigbike.bigbike_backend.service.auth;

import java.util.List;
import java.util.Map;

/**
 * Bootstrap reference for the built-in role → permission mapping.
 *
 * <p><strong>This class is NOT the runtime source of truth.</strong>
 * Runtime permission resolution is performed by {@link AdminPermissionService},
 * which reads from the {@code role_permissions} DB table (seeded and mutated via Flyway
 * migrations and the Admin Roles API).
 *
 * <p>This class is retained as a human-readable reference. Do not call it from
 * any auth or authorization code path.
 */
public final class AdminRolePermissions {

    private AdminRolePermissions() {}

    /** Reference-only snapshot of built-in role permissions. Not used at runtime. */
    public static final Map<String, List<String>> MAP = Map.of(
            "SUPER_ADMIN", List.of("*"),
            "ADMIN", List.of(
                    "products.read", "products.update",
                    "inventory.read", "inventory.write",
                    "catalog.read", "catalog.update",
                    "content.read", "content.update",
                    "orders.read", "orders.write",
                    "customers.read", "customers.write",
                    "media.read", "media.write",
                    "settings.read", "settings.write",
                    "menus.read", "menus.write",
                    "sliders.read", "sliders.write",
                    "reviews.read", "reviews.write",
                    "admin-users.read", "admin-users.write",
                    "roles.read", "roles.write",
                    "audit-logs.read",
                    "home_videos.read", "home_videos.write",
                    "home_highlights.read", "home_highlights.write",
                    "redirects.read", "redirects.write",
                    "reports.read", "reports.export"
            )
    );
}
