package com.bigbike.bigbike_backend.migration;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.temporal.ChronoUnit;
import java.util.UUID;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/** Verifies the notification cleanup migration independently of unrelated legacy data migrations. */
@Testcontainers(disabledWithoutDocker = true)
class AdminNotificationRetentionMigrationPostgresTest {

    @Container
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

    @Test
    void retiresSharedReadStateAndKeepsPerAdminReadTable() throws Exception {
        try (Connection connection = DriverManager.getConnection(
                postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword());
             Statement statement = connection.createStatement()) {
            statement.execute("create table admin_notifications ("
                    + "id uuid primary key, created_at timestamptz not null, "
                    + "is_read boolean not null default false)");
            statement.execute("create index idx_admin_notifications_unread "
                    + "on admin_notifications(is_read, created_at desc)");
            statement.execute("create table admin_notification_reads ("
                    + "admin_id uuid primary key, last_read_at timestamptz not null, "
                    + "updated_at timestamptz not null)");

            String migration = readMigration().lines()
                    .filter(line -> !line.trim().startsWith("--"))
                    .collect(Collectors.joining("\n"));
            for (String sql : migration.split(";")) {
                if (!sql.isBlank()) {
                    statement.execute(sql);
                }
            }

            assertThat(singleInt(statement,
                    "select count(*) from information_schema.columns "
                            + "where table_name = 'admin_notifications' and column_name = 'is_read'"))
                    .isZero();
            assertThat(singleInt(statement,
                    "select count(*) from pg_indexes where tablename = 'admin_notifications' "
                            + "and indexname = 'idx_admin_notifications_unread'"))
                    .isZero();
            assertThat(singleInt(statement,
                    "select count(*) from information_schema.tables "
                            + "where table_name = 'admin_notification_reads'"))
                    .isEqualTo(1);
            assertThat(singleInt(statement,
                    "select count(*) from pg_indexes where tablename = 'admin_notifications' "
                            + "and indexname = 'idx_admin_notifications_created_at_id'"))
                    .isEqualTo(1);

            UUID expiredId = UUID.randomUUID();
            UUID retainedId = UUID.randomUUID();
            UUID adminId = UUID.randomUUID();
            Instant cutoff = ZonedDateTime.now(ZoneId.of("Asia/Ho_Chi_Minh"))
                    .minusMonths(6)
                    .toInstant();
            Instant markerAt = cutoff.minusSeconds(60).truncatedTo(ChronoUnit.MICROS);
            try (PreparedStatement insertNotification = connection.prepareStatement(
                    "insert into admin_notifications(id, created_at) values (?, ?)")) {
                insertNotification.setObject(1, expiredId);
                insertNotification.setTimestamp(2, Timestamp.from(cutoff.minusSeconds(1)));
                insertNotification.executeUpdate();
                insertNotification.setObject(1, retainedId);
                insertNotification.setTimestamp(2, Timestamp.from(cutoff.plusSeconds(1)));
                insertNotification.executeUpdate();
            }
            try (PreparedStatement insertMarker = connection.prepareStatement(
                    "insert into admin_notification_reads(admin_id, last_read_at, updated_at) "
                            + "values (?, ?, ?)")) {
                insertMarker.setObject(1, adminId);
                insertMarker.setTimestamp(2, Timestamp.from(markerAt));
                insertMarker.setTimestamp(3, Timestamp.from(markerAt));
                insertMarker.executeUpdate();
            }

            int deleted;
            try (PreparedStatement deleteBatch = connection.prepareStatement("""
                    with candidates as (
                        select id
                        from admin_notifications
                        where created_at < ?
                        order by created_at, id
                        limit ?
                        for update skip locked
                    )
                    delete from admin_notifications notification
                    using candidates
                    where notification.id = candidates.id
                    """)) {
                deleteBatch.setTimestamp(1, Timestamp.from(cutoff));
                deleteBatch.setInt(2, 500);
                deleted = deleteBatch.executeUpdate();
            }

            assertThat(deleted).isEqualTo(1);
            assertThat(singleInt(statement,
                    "select count(*) from admin_notifications where id = '" + expiredId + "'"))
                    .isZero();
            assertThat(singleInt(statement,
                    "select count(*) from admin_notifications where id = '" + retainedId + "'"))
                    .isEqualTo(1);
            try (PreparedStatement readMarker = connection.prepareStatement(
                    "select last_read_at from admin_notification_reads where admin_id = ?")) {
                readMarker.setObject(1, adminId);
                try (ResultSet result = readMarker.executeQuery()) {
                    assertThat(result.next()).isTrue();
                    assertThat(result.getTimestamp(1).toInstant()).isEqualTo(markerAt);
                }
            }
        }
    }

    private String readMigration() throws IOException {
        try (InputStream stream = getClass().getResourceAsStream(
                "/db/migration/V1067__admin_notification_retention_and_remove_legacy_read_state.sql")) {
            assertThat(stream).as("V1067 migration resource").isNotNull();
            return new String(stream.readAllBytes(), StandardCharsets.UTF_8);
        }
    }

    private int singleInt(Statement statement, String sql) throws SQLException {
        try (ResultSet result = statement.executeQuery(sql)) {
            result.next();
            return result.getInt(1);
        }
    }
}
