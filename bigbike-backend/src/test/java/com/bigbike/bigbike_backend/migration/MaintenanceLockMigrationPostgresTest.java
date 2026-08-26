package com.bigbike.bigbike_backend.migration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.io.IOException;
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

/** Verifies the forward-only cleanup of the removed maintenance state and expected time. */
@Testcontainers(disabledWithoutDocker = true)
class MaintenanceLockMigrationPostgresTest {

    @Container
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

    @Test
    void v1054NormalizesLegacyUpcomingAndDropsExpectedTime() throws Exception {
        try (Connection connection = connection(); Statement statement = connection.createStatement()) {
            createSchema(statement);
            seedLegacyState(statement);

            executeMigration(statement, "V1054__simplify_admin_maintenance_lock.sql");

            assertThat(value(statement, "select state from maintenance_state where id = 1"))
                    .isEqualTo("NORMAL");
            assertThat(value(statement, "select staff_note from maintenance_state where id = 1"))
                    .isEqualTo("Ghi chú cho nhân viên");
            assertThat(integerValue(statement, """
                    select count(*) from information_schema.columns
                    where table_name = 'maintenance_state' and column_name = 'expected_at'
                    """)).isZero();
            assertThat(integerValue(statement, """
                    select count(*) from site_settings
                    where setting_key = 'maintenance_expected_at'
                    """)).isZero();

            assertThatThrownBy(() -> statement.execute("""
                    update maintenance_state set state = 'UPCOMING' where id = 1
                    """)).isInstanceOf(SQLException.class);

            statement.execute("update maintenance_state set state = 'ACTIVE' where id = 1");
            assertThat(value(statement, "select state from maintenance_state where id = 1"))
                    .isEqualTo("ACTIVE");
        }
    }

    private Connection connection() throws SQLException {
        return DriverManager.getConnection(postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword());
    }

    private void createSchema(Statement statement) throws SQLException {
        statement.execute("""
                create table site_settings (
                    id uuid primary key,
                    setting_key varchar(160) not null unique
                );
                create table maintenance_state (
                    id smallint primary key default 1 check (id = 1),
                    state varchar(16) not null default 'NORMAL'
                        check (state in ('NORMAL', 'UPCOMING', 'ACTIVE')),
                    staff_note text,
                    expected_at timestamptz,
                    updated_by uuid,
                    updated_at timestamptz not null default now()
                )
                """);
    }

    private void seedLegacyState(Statement statement) throws SQLException {
        statement.execute("""
                insert into maintenance_state (id, state, staff_note, expected_at)
                values (1, 'UPCOMING', 'Ghi chú cho nhân viên', '2026-08-07T10:00:00Z');
                insert into site_settings (id, setting_key)
                values ('00000000-0000-0000-0000-000000001054', 'maintenance_expected_at')
                """);
    }

    private void executeMigration(Statement statement, String filename) throws SQLException, IOException {
        try (InputStream input = Objects.requireNonNull(
                getClass().getResourceAsStream("/db/migration/" + filename))) {
            statement.execute(new String(input.readAllBytes(), StandardCharsets.UTF_8));
        }
    }

    private String value(Statement statement, String sql) throws SQLException {
        try (ResultSet results = statement.executeQuery(sql)) {
            results.next();
            return results.getString(1);
        }
    }

    private int integerValue(Statement statement, String sql) throws SQLException {
        try (ResultSet results = statement.executeQuery(sql)) {
            results.next();
            return results.getInt(1);
        }
    }
}
