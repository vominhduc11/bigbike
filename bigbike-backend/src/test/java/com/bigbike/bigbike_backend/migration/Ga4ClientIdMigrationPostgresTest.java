package com.bigbike.bigbike_backend.migration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.Objects;
import org.junit.jupiter.api.Test;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/** PostgreSQL coverage for the private GA4 browser-id snapshot used by cancellation reporting. */
@Testcontainers(disabledWithoutDocker = true)
class Ga4ClientIdMigrationPostgresTest {

    @Container
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

    @Test
    void createsAtMostOnceRefundLedgerAndPreservesDocumentedClientIdShape() throws Exception {
        try (Connection connection = DriverManager.getConnection(
                postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword());
             Statement statement = connection.createStatement()) {
            statement.execute("""
                    create table orders (id uuid primary key);
                    insert into orders (id) values ('10000000-0000-0000-0000-000000000001');
                    """);

            executeMigration(statement, "/db/migration/V1084__ga4_refund_event_outbox.sql");
            executeMigration(statement, "/db/migration/V1085__capture_ga4_client_id_for_refunds.sql");

            assertThat(singleString(statement, """
                    select pg_get_constraintdef(oid)
                    from pg_constraint
                    where conname = 'ck_ga4_event_outbox_status'
                    """))
                    .contains("PENDING", "SENDING", "SENT", "FAILED")
                    .doesNotContain("RETRY");
            assertThat(singleString(statement, """
                    select pg_get_constraintdef(oid)
                    from pg_constraint
                    where conname = 'ux_ga4_event_outbox_order_event'
                    """))
                    .contains("UNIQUE", "order_id", "event_name");
            assertThat(singleString(statement, """
                    select indexdef
                    from pg_indexes
                    where indexname = 'ix_ga4_event_outbox_dispatch'
                    """))
                    .contains("PENDING")
                    .doesNotContain("RETRY");

            assertThat(singleString(statement, """
                    select ga4_client_id from orders
                    where id = '10000000-0000-0000-0000-000000000001'
                    """)).isNull();
            statement.execute("""
                    update orders set ga4_client_id = '123456789.987654321'
                    where id = '10000000-0000-0000-0000-000000000001'
                    """);
            assertThat(singleString(statement, """
                    select ga4_client_id from orders
                    where id = '10000000-0000-0000-0000-000000000001'
                    """)).isEqualTo("123456789.987654321");
            assertThatThrownBy(() -> statement.execute("""
                    update orders set ga4_client_id = 'private@example.com'
                    where id = '10000000-0000-0000-0000-000000000001'
                    """))
                    .isInstanceOf(SQLException.class);
        }
    }

    private void executeMigration(Statement statement, String resourcePath) throws Exception {
        try (InputStream input = Objects.requireNonNull(getClass().getResourceAsStream(
                resourcePath))) {
            statement.execute(new String(input.readAllBytes(), StandardCharsets.UTF_8));
        }
    }

    private static String singleString(Statement statement, String sql) throws Exception {
        try (ResultSet result = statement.executeQuery(sql)) {
            assertThat(result.next()).isTrue();
            return result.getString(1);
        }
    }
}
