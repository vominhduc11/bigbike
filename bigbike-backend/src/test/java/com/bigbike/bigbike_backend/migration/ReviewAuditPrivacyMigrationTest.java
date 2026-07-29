package com.bigbike.bigbike_backend.migration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import db.migration.V358__BackfillReviewApprovalAndRedactAudit;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.Statement;
import java.time.Instant;
import java.util.UUID;
import org.flywaydb.core.api.migration.Context;
import org.junit.jupiter.api.Test;

class ReviewAuditPrivacyMigrationTest {

    private static final Instant FIRST_APPROVAL = Instant.parse("2025-01-01T01:00:00Z");
    private static final Instant CURRENT_APPROVED_UPDATED = Instant.parse("2025-02-01T02:00:00Z");
    private static final Instant HISTORICAL_APPROVAL_BEFORE_V356 =
            Instant.parse("2025-01-15T01:00:00Z");
    private static final Instant EXISTING_MARKER = Instant.parse("2024-12-01T00:00:00Z");

    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    void v358BackfillsLifetimeApprovalAndRedactsOnlyReviewAuditsIdempotently()
            throws Exception {
        String database = "v358_" + UUID.randomUUID().toString().replace("-", "");
        try (Connection connection = DriverManager.getConnection(
                "jdbc:h2:mem:" + database
                        + ";MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE")) {
            createSchema(connection);
            seed(connection);

            migrate(connection);
            assertMigrated(connection);
            String afterFirstRun = auditSnapshot(connection);

            migrate(connection);
            assertMigrated(connection);
            assertThat(auditSnapshot(connection)).isEqualTo(afterFirstRun);
        }
    }

    private void createSchema(Connection connection) throws Exception {
        execute(connection, """
                CREATE TABLE reviews (
                    id BIGINT PRIMARY KEY,
                    status VARCHAR(32) NOT NULL,
                    created_at TIMESTAMP WITH TIME ZONE,
                    updated_at TIMESTAMP WITH TIME ZONE,
                    first_approved_at TIMESTAMP WITH TIME ZONE
                )
                """);
        execute(connection, """
                CREATE TABLE audit_logs (
                    id UUID PRIMARY KEY,
                    action VARCHAR(100) NOT NULL,
                    resource_type VARCHAR(100),
                    before_data TEXT,
                    after_data TEXT,
                    created_at TIMESTAMP WITH TIME ZONE NOT NULL
                )
                """);
    }

    private void seed(Connection connection) throws Exception {
        execute(connection, """
                INSERT INTO reviews (id, status, created_at, updated_at, first_approved_at) VALUES
                  (1, 'PENDING', TIMESTAMP WITH TIME ZONE '2024-01-01 00:00:00+00',
                      TIMESTAMP WITH TIME ZONE '2025-01-02 00:00:00+00', NULL),
                  (2, 'APPROVED', TIMESTAMP WITH TIME ZONE '2024-02-01 00:00:00+00',
                      TIMESTAMP WITH TIME ZONE '2025-02-01 02:00:00+00', NULL),
                  (3, 'SPAM', TIMESTAMP WITH TIME ZONE '2024-03-01 00:00:00+00',
                      TIMESTAMP WITH TIME ZONE '2025-03-01 00:00:00+00',
                      TIMESTAMP WITH TIME ZONE '2024-12-01 00:00:00+00'),
                  (4, 'APPROVED', TIMESTAMP WITH TIME ZONE '2024-04-01 00:00:00+00',
                      TIMESTAMP WITH TIME ZONE '2025-02-02 02:00:00+00',
                      TIMESTAMP WITH TIME ZONE '2025-02-02 02:00:00+00')
                """);
        execute(connection, """
                INSERT INTO audit_logs (
                    id, action, resource_type, before_data, after_data, created_at
                ) VALUES
                  ('00000000-0000-0000-0000-000000000001',
                   'REVIEW_STATUS_CHANGED', 'REVIEW',
                   '{"id":1,"status":"PENDING","authorName":"Private Name","authorEmail":"private@example.test","body":"Private body","photos":["/media/reviews/a.jpg"]}',
                   '{"id":1,"productName":"Helmet","status":"APPROVED","authorName":"Private Name","authorEmail":"private@example.test","body":"Private body","photos":["/media/reviews/a.jpg"]}',
                   TIMESTAMP WITH TIME ZONE '2025-01-01 01:00:00+00'),
                  ('00000000-0000-0000-0000-000000000002',
                   'REVIEW_STATUS_CHANGED', 'REVIEW',
                   '{"id":1,"status":"APPROVED"}',
                   '{"id":1,"status":"PENDING","comment":"Private again"}',
                   TIMESTAMP WITH TIME ZONE '2025-01-02 01:00:00+00'),
                  ('00000000-0000-0000-0000-000000000003',
                   'REVIEW_STATUS_CHANGED', 'REVIEW',
                   NULL, '{malformed private@example.test', CURRENT_TIMESTAMP),
                  ('00000000-0000-0000-0000-000000000004',
                   'ORDER_UPDATED', 'ORDER',
                   '{"authorEmail":"must-stay@example.test"}',
                   '{"body":"must stay"}', CURRENT_TIMESTAMP),
                  ('00000000-0000-0000-0000-000000000005',
                   'REVIEW_STATUS_CHANGED', 'REVIEW',
                   '{"id":4,"status":"PENDING"}',
                   '{"id":4,"status":"APPROVED"}',
                   TIMESTAMP WITH TIME ZONE '2025-01-15 01:00:00+00')
                """);
    }

    private void migrate(Connection connection) throws Exception {
        Context context = mock(Context.class);
        when(context.getConnection()).thenReturn(connection);
        new V358__BackfillReviewApprovalAndRedactAudit().migrate(context);
    }

    private void assertMigrated(Connection connection) throws Exception {
        assertThat(instantValue(connection,
                "SELECT first_approved_at FROM reviews WHERE id = 1"))
                .isEqualTo(FIRST_APPROVAL);
        assertThat(instantValue(connection,
                "SELECT first_approved_at FROM reviews WHERE id = 2"))
                .isEqualTo(CURRENT_APPROVED_UPDATED);
        assertThat(instantValue(connection,
                "SELECT first_approved_at FROM reviews WHERE id = 3"))
                .isEqualTo(EXISTING_MARKER);
        assertThat(instantValue(connection,
                "SELECT first_approved_at FROM reviews WHERE id = 4"))
                .isEqualTo(HISTORICAL_APPROVAL_BEFORE_V356);

        JsonNode before = mapper.readTree(stringValue(connection, """
                SELECT before_data FROM audit_logs
                WHERE id = '00000000-0000-0000-0000-000000000001'
                """));
        JsonNode after = mapper.readTree(stringValue(connection, """
                SELECT after_data FROM audit_logs
                WHERE id = '00000000-0000-0000-0000-000000000001'
                """));
        assertThat(before.path("photoCount").asInt()).isEqualTo(1);
        assertThat(after.path("photoCount").asInt()).isEqualTo(1);
        assertThat(after.path("productName").asText()).isEqualTo("Helmet");
        assertThat(before.fieldNames()).toIterable()
                .doesNotContain("authorName", "authorEmail", "body", "photos");
        assertThat(after.fieldNames()).toIterable()
                .doesNotContain("authorName", "authorEmail", "body", "photos");

        assertThat(stringValue(connection, """
                SELECT after_data FROM audit_logs
                WHERE id = '00000000-0000-0000-0000-000000000003'
                """)).isEqualTo("{\"redacted\":true}");
        assertThat(stringValue(connection, """
                SELECT before_data FROM audit_logs
                WHERE id = '00000000-0000-0000-0000-000000000004'
                """)).isEqualTo("{\"authorEmail\":\"must-stay@example.test\"}");
        assertThat(stringValue(connection, """
                SELECT after_data FROM audit_logs
                WHERE id = '00000000-0000-0000-0000-000000000004'
                """)).isEqualTo("{\"body\":\"must stay\"}");
    }

    private String auditSnapshot(Connection connection) throws Exception {
        StringBuilder snapshot = new StringBuilder();
        try (Statement statement = connection.createStatement();
                ResultSet result = statement.executeQuery("""
                        SELECT id, before_data, after_data
                        FROM audit_logs
                        ORDER BY id
                        """)) {
            while (result.next()) {
                snapshot.append(result.getObject(1))
                        .append('|')
                        .append(result.getString(2))
                        .append('|')
                        .append(result.getString(3))
                        .append('\n');
            }
        }
        return snapshot.toString();
    }

    private void execute(Connection connection, String sql) throws Exception {
        try (Statement statement = connection.createStatement()) {
            statement.execute(sql);
        }
    }

    private Instant instantValue(Connection connection, String sql) throws Exception {
        Object value = scalar(connection, sql);
        if (value instanceof java.time.OffsetDateTime offsetDateTime) {
            return offsetDateTime.toInstant();
        }
        if (value instanceof java.sql.Timestamp timestamp) {
            return timestamp.toInstant();
        }
        throw new AssertionError("Unexpected timestamp value: " + value);
    }

    private String stringValue(Connection connection, String sql) throws Exception {
        Object value = scalar(connection, sql);
        return value != null ? value.toString() : null;
    }

    private Object scalar(Connection connection, String sql) throws Exception {
        try (Statement statement = connection.createStatement();
                ResultSet result = statement.executeQuery(sql)) {
            assertThat(result.next()).isTrue();
            return result.getObject(1);
        }
    }
}
