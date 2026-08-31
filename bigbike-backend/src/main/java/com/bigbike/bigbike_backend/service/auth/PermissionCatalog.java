package com.bigbike.bigbike_backend.service.auth;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Canonical permission catalog for the admin RBAC system.
 *
 * Single source of truth for:
 *   - Valid permission key strings (used for validation in AdminRoleService)
 *   - Module, kind, sensitive and dependency metadata
 *     (served by GET /api/v1/admin/permissions)
 *
 * Add new permissions here first, then add the Flyway migration that seeds them
 * into role_permissions for the appropriate built-in roles.
 */
public final class PermissionCatalog {

    private PermissionCatalog() {}

    public enum Kind {
        READ,
        WRITE,
        EXPORT,
        DANGEROUS,
        SUPPORTING
    }

    public record Entry(
            String key,
            String moduleKey,
            Kind kind,
            boolean sensitive,
            List<String> requires
    ) {
        public Entry {
            requires = List.copyOf(requires);
        }
    }

    public record Group(String groupKey, List<Entry> permissions) {}
    public record DependencyViolation(String permission, String requiredPermission) {}

    public static final List<Group> GROUPS = List.of(

        new Group("roles.groupSales", List.of(
            read("orders.read"),
            write("orders.write", false, "orders.read"),
            read("customers.read"),
            write("customers.write", false, "customers.read"),
            read("reviews.read"),
            write("reviews.write", false, "reviews.read"),
            read("reports.read"),
            entry("reports.export", "reports", Kind.EXPORT, true, "reports.read")
        )),

        new Group("roles.groupProducts", List.of(
            read("products.read"),
            write("products.update", false, "products.read", "catalog.read"),
            read("catalog.read"),
            write("catalog.update", false, "catalog.read"),
            entry("inventory.read", "inventory", Kind.SUPPORTING, false)
        )),

        new Group("roles.groupContent", List.of(
            read("content.read"),
            write("content.update", false, "content.read"),
            read("media.read"),
            write("media.write", false, "media.read"),
            read("menus.read"),
            write("menus.write", false, "menus.read"),
            read("sliders.read"),
            write("sliders.write", false, "sliders.read"),
            read("home_videos.read"),
            write("home_videos.write", false, "home_videos.read"),
            read("home_highlights.read"),
            write("home_highlights.write", false, "home_highlights.read", "products.read"),
            read("redirects.read"),
            write("redirects.write", false, "redirects.read"),
            // Granted to ADMIN/EDITOR by V372. Registering it here is not optional: any key
            // present in role_permissions but missing from this catalog makes
            // AdminRoleService.validatePermissionKeys reject the whole role on save, so the
            // Roles screen 400s on ADMIN and EDITOR. Sensitive because switching a category or
            // article out of the search index silently costs traffic with no customer-visible
            // sign. No `requires`: the flag lives on both products and articles, so depending on
            // either module's read permission would be wrong.
            entry("seo.index", "seo", Kind.WRITE, true)
        )),

        new Group("roles.groupSystem", List.of(
            read("settings.read"),
            write("settings.write", true, "settings.read"),
            read("admin-users.read"),
            write("admin-users.write", true, "admin-users.read", "roles.read"),
            read("roles.read"),
            write("roles.write", true, "roles.read"),
            entry("audit-logs.read", "audit-logs", Kind.READ, true),
            entry("chat.read", "chat", Kind.READ, true)
        ))
    );

    public static final Map<String, Entry> ENTRIES_BY_KEY = GROUPS.stream()
            .flatMap(group -> group.permissions().stream())
            .collect(Collectors.toUnmodifiableMap(Entry::key, Function.identity()));

    /** Flat set of all valid permission keys. Used for validation. */
    public static final Set<String> ALL_KEYS = ENTRIES_BY_KEY.keySet();

    /**
     * Returns every missing direct or transitive dependency, attributed to the
     * selected permission that introduced it. Wildcard satisfies the graph.
     */
    public static List<DependencyViolation> missingDependencies(Set<String> permissions) {
        if (permissions.contains("*")) {
            return List.of();
        }

        List<DependencyViolation> violations = new ArrayList<>();
        for (String selected : permissions) {
            for (String required : requiredClosure(selected)) {
                if (!permissions.contains(required)) {
                    violations.add(new DependencyViolation(selected, required));
                }
            }
        }
        return List.copyOf(violations);
    }

    public static Set<String> requiredClosure(String permission) {
        LinkedHashSet<String> closure = new LinkedHashSet<>();
        ArrayDeque<String> pending = new ArrayDeque<>();
        Entry root = ENTRIES_BY_KEY.get(permission);
        if (root != null) {
            pending.addAll(root.requires());
        }

        while (!pending.isEmpty()) {
            String required = pending.removeFirst();
            if (!closure.add(required)) {
                continue;
            }
            Entry dependency = ENTRIES_BY_KEY.get(required);
            if (dependency != null) {
                pending.addAll(dependency.requires());
            }
        }
        return Set.copyOf(closure);
    }

    private static Entry read(String key) {
        return entry(key, moduleKey(key), Kind.READ, false);
    }

    private static Entry write(String key, boolean sensitive, String... requires) {
        return entry(key, moduleKey(key), Kind.WRITE, sensitive, requires);
    }

    private static Entry entry(
            String key,
            String moduleKey,
            Kind kind,
            boolean sensitive,
            String... requires
    ) {
        return new Entry(key, moduleKey, kind, sensitive, List.of(requires));
    }

    private static String moduleKey(String permission) {
        int separator = permission.indexOf('.');
        return separator > 0 ? permission.substring(0, separator) : permission;
    }
}
