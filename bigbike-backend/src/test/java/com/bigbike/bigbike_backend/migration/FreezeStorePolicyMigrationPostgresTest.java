package com.bigbike.bigbike_backend.migration;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.Objects;
import org.junit.jupiter.api.Test;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/** Verifies that the new policy freeze migration is safe on both populated and empty databases. */
@Testcontainers(disabledWithoutDocker = true)
class FreezeStorePolicyMigrationPostgresTest {

    @Container
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

    @Test
    void removesOnlyLegacyPolicyRowsAndCanRunAgainWhenTheyAreAbsent() throws Exception {
        try (Connection connection = DriverManager.getConnection(
                postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword());
             Statement statement = connection.createStatement()) {
            createSchema(statement);
            statement.executeUpdate("insert into site_settings "
                    + "(id, setting_key, setting_value, setting_group) values "
                    + "('10000000-0000-0000-0000-000000000001', 'policy_warranty_title', 'old', 'store_policy'), "
                    + "('10000000-0000-0000-0000-000000000002', 'policy_warranty_body_html', 'old', 'store_policy'), "
                    + "('10000000-0000-0000-0000-000000000003', 'policy_return_exchange_title', 'old', 'store_policy'), "
                    + "('10000000-0000-0000-0000-000000000004', 'policy_return_exchange_body_html', 'old', 'store_policy'), "
                    + "('10000000-0000-0000-0000-000000000005', 'hotline', 'keep-me', 'contact')");

            executeMigration(statement);
            assertThat(countPolicyRows(statement)).isZero();
            assertThat(singleLong(statement, "select count(*) from site_settings "
                    + "where setting_key = 'hotline'")).isEqualTo(1);

            // The second execution represents a local/empty database and must remain a no-op.
            executeMigration(statement);
            assertThat(countPolicyRows(statement)).isZero();
            assertThat(singleLong(statement, "select count(*) from site_settings "
                    + "where setting_key = 'hotline'")).isEqualTo(1);
        }
    }

    private static void createSchema(Statement statement) throws Exception {
        statement.execute("""
                create table site_settings (
                    id uuid primary key,
                    setting_key varchar(255) not null unique,
                    setting_value text,
                    setting_group varchar(255)
                )
                """);
    }

    private void executeMigration(Statement statement) throws Exception {
        try (InputStream input = Objects.requireNonNull(getClass().getResourceAsStream(
                "/db/migration/V1075__freeze_store_policy_content.sql"))) {
            statement.execute(new String(input.readAllBytes(), StandardCharsets.UTF_8));
        }
    }

    private static long countPolicyRows(Statement statement) throws Exception {
        return singleLong(statement, "select count(*) from site_settings where setting_key in ("
                + "'policy_warranty_title', 'policy_warranty_body_html', "
                + "'policy_return_exchange_title', 'policy_return_exchange_body_html')");
    }

    private static long singleLong(Statement statement, String sql) throws Exception {
        try (ResultSet result = statement.executeQuery(sql)) {
            assertThat(result.next()).isTrue();
            return result.getLong(1);
        }
    }
}
