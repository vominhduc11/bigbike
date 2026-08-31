package com.bigbike.bigbike_backend.migration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

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

/** PostgreSQL coverage for the fresh-cutoff, one-per-order and permanent opt-out schema. */
@Testcontainers(disabledWithoutDocker = true)
class ReviewInvitationMigrationPostgresTest {

    @Container
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

    @Test
    void migrationStartsDisabledAndNeverBackfillsExistingOrders() throws Exception {
        try (Connection connection = DriverManager.getConnection(
                postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword());
             Statement statement = connection.createStatement()) {
            createMinimalPreMigrationSchema(statement);
            seedExistingOrders(statement);
            executeMigration(statement);

            assertThat(singleLong(statement, "select count(*) from review_invitation_deliveries"))
                    .isZero();
            assertThat(singleString(statement, "select locale from orders where order_number = 'LEGACY-1'"))
                    .isEqualTo("vi");
            assertThat(singleString(statement, "select setting_value from site_settings "
                    + "where setting_key = 'review_invitation_enabled'"))
                    .isEqualTo("false");
            assertThat(singleString(statement, "select setting_value from site_settings "
                    + "where setting_key = 'review_invitation_delay_days'"))
                    .isEqualTo("7");
            assertThat(singleString(statement, "select setting_value from site_settings "
                    + "where setting_key = 'review_invitation_daily_limit'"))
                    .isEqualTo("20");

            statement.executeUpdate("update orders set locale = 'en' where order_number = 'NATIVE-1'");
            assertThatThrownBy(() -> statement.executeUpdate(
                    "update orders set locale = 'fr' where order_number = 'NATIVE-1'"))
                    .hasMessageContaining("ck_orders_locale");
        }
    }

    private static void createMinimalPreMigrationSchema(Statement statement) throws Exception {
        statement.execute("""
                create table orders (
                    id uuid primary key,
                    legacy_id bigint,
                    order_number varchar(100) not null,
                    status varchar(50) not null,
                    completed_at timestamptz
                );
                create table reviews (
                    id bigserial primary key
                );
                create table site_settings (
                    id uuid primary key,
                    setting_key varchar(255) not null unique,
                    setting_value text,
                    setting_value_en text,
                    setting_group varchar(255),
                    is_public boolean not null,
                    description text,
                    created_at timestamptz not null,
                    updated_at timestamptz not null
                )
                """);
    }

    private static void seedExistingOrders(Statement statement) throws Exception {
        statement.execute("""
                insert into orders (id, legacy_id, order_number, status, completed_at) values
                    ('10000000-0000-0000-0000-000000000001', 603, 'LEGACY-1', 'COMPLETED', null),
                    ('10000000-0000-0000-0000-000000000002', null, 'NATIVE-1', 'COMPLETED', '2026-08-30T02:00:00Z')
                """);
    }

    private void executeMigration(Statement statement) throws Exception {
        try (InputStream input = Objects.requireNonNull(getClass().getResourceAsStream(
                "/db/migration/V1074__add_review_invitation_workflow.sql"))) {
            statement.execute(new String(input.readAllBytes(), StandardCharsets.UTF_8));
        }
    }

    private static String singleString(Statement statement, String sql) throws Exception {
        try (ResultSet result = statement.executeQuery(sql)) {
            assertThat(result.next()).isTrue();
            return result.getString(1);
        }
    }

    private static long singleLong(Statement statement, String sql) throws Exception {
        try (ResultSet result = statement.executeQuery(sql)) {
            assertThat(result.next()).isTrue();
            return result.getLong(1);
        }
    }
}
