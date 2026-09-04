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

/** PostgreSQL coverage for removing retired review-invitation settings only. */
@Testcontainers(disabledWithoutDocker = true)
class ReviewInvitationSettingsRemovalMigrationPostgresTest {

    @Container
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

    @Test
    void removesOnlyTheThreeRetiredSettings() throws Exception {
        try (Connection connection = DriverManager.getConnection(
                postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword());
             Statement statement = connection.createStatement()) {
            statement.execute("""
                    create table site_settings (
                        id uuid primary key,
                        setting_key varchar(255) not null unique,
                        setting_value text
                    );
                    insert into site_settings (id, setting_key, setting_value) values
                        ('20000000-0000-0000-0000-000000000001', 'review_invitation_enabled', 'false'),
                        ('20000000-0000-0000-0000-000000000002', 'review_invitation_delay_days', '7'),
                        ('20000000-0000-0000-0000-000000000003', 'review_invitation_daily_limit', '20'),
                        ('20000000-0000-0000-0000-000000000004', 'site.name', 'BigBike')
                    """);

            executeMigration(statement);

            assertThat(count(statement, "review_invitation_enabled")).isZero();
            assertThat(count(statement, "review_invitation_delay_days")).isZero();
            assertThat(count(statement, "review_invitation_daily_limit")).isZero();
            assertThat(count(statement, "site.name")).isEqualTo(1);
        }
    }

    private void executeMigration(Statement statement) throws Exception {
        try (InputStream input = Objects.requireNonNull(getClass().getResourceAsStream(
                "/db/migration/V1079__remove_review_invitation_settings.sql"))) {
            statement.execute(new String(input.readAllBytes(), StandardCharsets.UTF_8));
        }
    }

    private static long count(Statement statement, String key) throws Exception {
        try (ResultSet result = statement.executeQuery(
                "select count(*) from site_settings where setting_key = '" + key + "'")) {
            assertThat(result.next()).isTrue();
            return result.getLong(1);
        }
    }
}
