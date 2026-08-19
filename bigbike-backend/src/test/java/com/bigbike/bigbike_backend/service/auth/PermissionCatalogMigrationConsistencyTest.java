package com.bigbike.bigbike_backend.service.auth;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;

/**
 * Every permission a migration grants must exist in {@link PermissionCatalog}.
 *
 * <p>This is not a style rule. {@code AdminRoleService.validatePermissionKeys} rejects the entire
 * submitted set when it contains a key the catalog does not know, and the Roles screen always
 * submits the role's current permissions — so a single unregistered key in {@code role_permissions}
 * makes that role permanently unsavable with {@code 400 UNKNOWN_PERMISSION}, and nothing in the UI
 * hints at the cause.
 *
 * <p>That is exactly what V372 did: it granted {@code seo.index} to ADMIN and EDITOR without adding
 * the key to the catalog, quietly bricking role editing for both. This test exists so the next
 * migration cannot repeat it.
 */
class PermissionCatalogMigrationConsistencyTest {

    private static final Path MIGRATION_DIR = Paths.get("src/main/resources/db/migration");

    /** Matches the {@code ('ROLE_ID', 'permission.key')} tuples used by every seeding migration. */
    private static final Pattern GRANT_TUPLE = Pattern.compile(
            "\\(\\s*'([A-Z][A-Z0-9_]*)'\\s*,\\s*'([^']+)'\\s*\\)");

    /** The wildcard is a real row for SUPER_ADMIN and is deliberately absent from the catalog. */
    private static final String WILDCARD = "*";

    /**
     * Keys granted by historical migrations for modules that have since been removed wholesale
     * (POS, receivables, coupons, shipping management, newsletter, contact messages, serial-level
     * inventory). Later migrations dropped these rows along with the features, so no live role
     * holds them and none can brick a role save.
     *
     * <p>Verified against the production database on 2026-08-06: {@code SELECT DISTINCT permission
     * FROM role_permissions} returns 35 keys plus {@code *}, and none of the entries below appear.
     *
     * <p><b>This list must never grow.</b> A new entry means a migration granted a permission the
     * application does not recognise — register the key instead.
     */
    private static final Set<String> PERMISSIONS_FROM_REMOVED_FEATURES = Set.of(
            "contact.read", "contact.write",
            "coupons.read", "coupons.write",
            "inventory.write",
            "newsletter.read",
            "pos.read", "pos.write", "pos.refund", "pos.price_override", "pos.sell_below_cost",
            "receivables.read", "receivables.create", "receivables.export",
            "receivables.override_limit", "receivables.record_payment", "receivables.write_off",
            "shipping.read", "shipping.write");

    @Test
    void everyPermissionGrantedByAMigrationExistsInTheCatalog() throws IOException {
        Map<String, String> offenders = new LinkedHashMap<>();

        for (Path file : migrationFiles()) {
            String sql = Files.readString(file, StandardCharsets.UTF_8);
            for (String statement : insertsIntoRolePermissions(sql)) {
                Matcher matcher = GRANT_TUPLE.matcher(statement);
                while (matcher.find()) {
                    String permission = matcher.group(2);
                    // V372 uses INSERT ... SELECT ... WHERE id IN ('ADMIN', 'EDITOR').
                    // The tuple scanner must not mistake that role-id list for a permission grant.
                    if (!permission.contains(".") && !WILDCARD.equals(permission)) {
                        continue;
                    }
                    if (WILDCARD.equals(permission)
                            || PermissionCatalog.ALL_KEYS.contains(permission)
                            || PERMISSIONS_FROM_REMOVED_FEATURES.contains(permission)) {
                        continue;
                    }
                    offenders.putIfAbsent(permission, file.getFileName().toString());
                }
            }
        }

        assertThat(offenders)
                .as("permissions granted by a migration but missing from PermissionCatalog "
                        + "(each one makes every role holding it unsavable — add the key to "
                        + "PermissionCatalog.GROUPS and to bigbike-admin/src/screens/roles/constants.js)")
                .isEmpty();
    }

    /** Keeps the exemption list honest: a key must not be both exempt and registered. */
    @Test
    void theRemovedFeatureExemptionsDoNotOverlapTheLiveCatalog() {
        assertThat(PERMISSIONS_FROM_REMOVED_FEATURES)
                .as("a registered permission must not also be listed as a removed-feature leftover")
                .doesNotContainAnyElementsOf(PermissionCatalog.ALL_KEYS);
    }

    @Test
    void theSeoIndexPermissionFromV372IsRegistered() {
        // Pinned separately so the regression that motivated this test cannot come back silently
        // if the scanner above is ever weakened.
        assertThat(PermissionCatalog.ALL_KEYS).contains("seo.index");
        assertThat(PermissionCatalog.ENTRIES_BY_KEY.get("seo.index").sensitive())
                .as("turning a page out of the search index costs traffic with no visible sign")
                .isTrue();
    }

    private static List<Path> migrationFiles() throws IOException {
        assertThat(MIGRATION_DIR).as("migration directory (tests run from the module root)").exists();
        try (Stream<Path> files = Files.list(MIGRATION_DIR)) {
            return files.filter(p -> p.getFileName().toString().endsWith(".sql")).sorted().toList();
        }
    }

    /** Slices out each {@code INSERT INTO role_permissions ...;} so DELETE/UPDATE text is ignored. */
    private static List<String> insertsIntoRolePermissions(String sql) {
        Pattern insert = Pattern.compile(
                "insert\\s+into\\s+role_permissions\\b(.*?);",
                Pattern.CASE_INSENSITIVE | Pattern.DOTALL);
        return insert.matcher(sql).results().map(result -> result.group(1)).toList();
    }
}
