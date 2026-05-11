package com.bigbike.bigbike_backend.service.auth;

import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Canonical permission catalog for the admin RBAC system.
 *
 * Single source of truth for:
 *   - Valid permission key strings (used for validation in AdminRoleService)
 *   - Groupings and sensitive flags (served by GET /api/v1/admin/permissions)
 *
 * Add new permissions here first, then add the Flyway migration that seeds them
 * into role_permissions for the appropriate built-in roles.
 */
public final class PermissionCatalog {

    private PermissionCatalog() {}

    public record Entry(String key, boolean sensitive) {}
    public record Group(String groupKey, List<Entry> permissions) {}

    public static final List<Group> GROUPS = List.of(

        new Group("roles.groupSales", List.of(
            new Entry("orders.read",                  false),
            new Entry("orders.write",                 false),
            new Entry("customers.read",               false),
            new Entry("customers.write",              false),
            new Entry("coupons.read",                 false),
            new Entry("coupons.write",                false),
            new Entry("shipping.read",                false),
            new Entry("shipping.write",               false),
            new Entry("reviews.read",                 false),
            new Entry("reviews.write",                false),
            new Entry("contact.read",                 false),
            new Entry("contact.write",                false),
            new Entry("pos.read",                     false),
            new Entry("pos.write",                    false),
            new Entry("pos.price_override",           true),
            new Entry("receivables.read",             false),
            new Entry("receivables.create",           false),
            new Entry("receivables.record_payment",   false),
            new Entry("receivables.write_off",        true),
            new Entry("receivables.override_limit",   true),
            new Entry("receivables.export",           false),
            new Entry("reports.read",                 false),
            new Entry("reports.export",               false)
        )),

        new Group("roles.groupProducts", List.of(
            new Entry("products.read",    false),
            new Entry("products.update",  false),
            new Entry("catalog.read",     false),
            new Entry("catalog.update",   false)
        )),

        new Group("roles.groupContent", List.of(
            new Entry("content.read",       false),
            new Entry("content.update",     false),
            new Entry("media.read",         false),
            new Entry("media.write",        false),
            new Entry("menus.read",         false),
            new Entry("menus.write",        false),
            new Entry("sliders.read",       false),
            new Entry("sliders.write",      false),
            new Entry("home_videos.read",   false),
            new Entry("home_videos.write",  false),
            new Entry("redirects.read",     false),
            new Entry("redirects.write",    false)
        )),

        new Group("roles.groupSystem", List.of(
            new Entry("settings.read",      false),
            new Entry("settings.write",     true),
            new Entry("admin-users.read",   false),
            new Entry("admin-users.write",  true),
            new Entry("roles.read",         false),
            new Entry("roles.write",        true),
            new Entry("audit-logs.read",    true)
        ))
    );

    /** Flat set of all valid permission keys. Used for validation. */
    public static final Set<String> ALL_KEYS = GROUPS.stream()
            .flatMap(g -> g.permissions().stream())
            .map(Entry::key)
            .collect(Collectors.toUnmodifiableSet());
}
