package com.bigbike.bigbike_backend.service.auth;

import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Single source of truth for role → permission mapping.
 * Permission strings must match exactly what controllers pass to requirePermission().
 */
public final class AdminRolePermissions {

    private AdminRolePermissions() {}

    public static final Map<String, List<String>> MAP = Map.of(
            "SUPER_ADMIN", List.of("*"),
            "ADMIN", List.of(
                    "products.read", "products.update",
                    "catalog.read", "catalog.update",
                    "content.read", "content.update",
                    "orders.read", "orders.write",
                    "customers.read", "customers.write",
                    "media.read", "media.write",
                    "settings.read", "settings.write",
                    "menus.read", "menus.write",
                    "sliders.read", "sliders.write",
                    "coupons.read", "coupons.write",
                    "shipping.read", "shipping.write",
                    "reviews.read", "reviews.write",
                    "admin-users.read", "admin-users.write",
                    "audit-logs.read",
                    "home_videos.read", "home_videos.write",
                    "redirects.read", "redirects.write"
            ),
            "SHOP_MANAGER", List.of(
                    "products.read", "products.update",
                    "catalog.read",
                    "orders.read", "orders.write",
                    "customers.read", "customers.write",
                    "coupons.read", "coupons.write",
                    "shipping.read",
                    "reviews.read", "reviews.write"
            ),
            "EDITOR", List.of(
                    "products.read", "catalog.read",
                    "content.read", "content.update",
                    "media.read", "media.write",
                    "menus.read", "menus.write",
                    "sliders.read", "sliders.write"
            ),
            "AUTHOR", List.of(
                    "content.read", "content.update",
                    "media.read", "media.write"
            ),
            "CONTRIBUTOR", List.of(
                    "content.read", "media.read"
            ),
            "SEO_EDITOR", List.of(
                    "content.read", "content.update",
                    "redirects.read", "redirects.write"
            )
    );

    public static List<String> forRole(String role) {
        if (role == null) return List.of();
        return MAP.getOrDefault(role.toUpperCase(Locale.ROOT), List.of());
    }
}
