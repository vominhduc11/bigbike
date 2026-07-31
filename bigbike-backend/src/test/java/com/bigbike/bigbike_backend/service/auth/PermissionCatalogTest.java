package com.bigbike.bigbike_backend.service.auth;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Set;
import org.junit.jupiter.api.Test;

class PermissionCatalogTest {

    @Test
    void catalogExposesKindsSensitivityAndDependencies() {
        PermissionCatalog.Entry productsUpdate =
                PermissionCatalog.ENTRIES_BY_KEY.get("products.update");
        PermissionCatalog.Entry inventoryRead =
                PermissionCatalog.ENTRIES_BY_KEY.get("inventory.read");
        PermissionCatalog.Entry reportsExport =
                PermissionCatalog.ENTRIES_BY_KEY.get("reports.export");

        assertThat(productsUpdate.moduleKey()).isEqualTo("products");
        assertThat(productsUpdate.kind()).isEqualTo(PermissionCatalog.Kind.WRITE);
        assertThat(productsUpdate.requires())
                .containsExactly("products.read", "catalog.read");

        assertThat(inventoryRead.kind()).isEqualTo(PermissionCatalog.Kind.SUPPORTING);
        assertThat(inventoryRead.requires()).isEmpty();

        assertThat(reportsExport.kind()).isEqualTo(PermissionCatalog.Kind.EXPORT);
        assertThat(reportsExport.sensitive()).isTrue();
        assertThat(reportsExport.requires()).containsExactly("reports.read");
    }

    @Test
    void missingDependenciesReportsEveryMissingRequirement() {
        assertThat(PermissionCatalog.missingDependencies(Set.of("products.update")))
                .extracting(
                        PermissionCatalog.DependencyViolation::permission,
                        PermissionCatalog.DependencyViolation::requiredPermission)
                .containsExactlyInAnyOrder(
                        org.assertj.core.groups.Tuple.tuple("products.update", "products.read"),
                        org.assertj.core.groups.Tuple.tuple("products.update", "catalog.read"));
    }

    @Test
    void wildcardSatisfiesAllDependenciesButIsNotGrantableCatalogKey() {
        assertThat(PermissionCatalog.missingDependencies(Set.of("*", "products.update"))).isEmpty();
        assertThat(PermissionCatalog.ALL_KEYS).doesNotContain("*");
    }
}
