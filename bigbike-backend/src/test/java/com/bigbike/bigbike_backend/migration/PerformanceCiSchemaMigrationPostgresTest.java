package com.bigbike.bigbike_backend.migration;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.DriverManager;
import java.util.Objects;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/** Proves an empty isolated CI database can reach the current canonical schema. */
@Testcontainers(disabledWithoutDocker = true)
class PerformanceCiSchemaMigrationPostgresTest {

    @Container
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

    @TempDir
    Path fixtureDirectory;

    @Test
    void migratesAnEmptyDatabaseWithOnlySyntheticCatalogCompatibilityFixtures() throws Exception {
        // Deliberately exclude the old V1070_5 admin fixture, which contains a real address.
        for (String fixture : new String[] {
                "V26_5__seed_products_for_v27.sql",
                "V1028_5__seed_size_products_for_v1029.sql"
        }) {
            try (var input = Objects.requireNonNull(getClass().getResourceAsStream("/db/testmigration/" + fixture))) {
                Files.copy(input, fixtureDirectory.resolve(fixture));
            }
        }

        Flyway flyway = Flyway.configure()
                .dataSource(postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword())
                .locations("classpath:db/migration", "filesystem:" + fixtureDirectory.toAbsolutePath())
                .load();
        var result = flyway.migrate();
        assertThat(result.success).isTrue();
        assertThat(flyway.info().current().getVersion().getVersion()).isEqualTo("1095");
        flyway.validate();

        try (var connection = DriverManager.getConnection(
                postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword());
             var statement = connection.createStatement()) {
            for (String table : new String[] {"orders", "customers", "admin_users"}) {
                try (var rows = statement.executeQuery("SELECT count(*) FROM " + table)) {
                    assertThat(rows.next()).isTrue();
                    assertThat(rows.getLong(1)).as("No copied business accounts/orders in %s", table).isZero();
                }
            }
            try (var rows = statement.executeQuery("SELECT count(*) FROM products WHERE id LIKE 'tc-size-product-%'")) {
                assertThat(rows.next()).isTrue();
                assertThat(rows.getLong(1)).isEqualTo(109);
            }
        }
    }
}
