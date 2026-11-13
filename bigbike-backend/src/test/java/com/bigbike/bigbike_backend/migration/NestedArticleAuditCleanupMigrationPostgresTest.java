package com.bigbike.bigbike_backend.migration;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.charset.StandardCharsets;
import java.sql.Connection;
import java.sql.DriverManager;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;
import org.junit.jupiter.api.Test;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/** Exercises V1095 independently on snapshots from an already-migrated database. */
@Testcontainers(disabledWithoutDocker = true)
class NestedArticleAuditCleanupMigrationPostgresTest {

    private static final ObjectMapper JSON = new ObjectMapper();

    @Container
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

    @Test
    void cleansNestedObjectsAndArraysWhilePreservingUnrelatedAndMalformedSnapshots() throws Exception {
        try (Connection connection = openFixture()) {
            String nested = """
                    {"title":"Giữ lại","excerpt":"retired","authorNameEn":"retired",
                     "translations":{"en":{"excerpt_en":"retired","authorName":"retired","title":"English"}},
                     "items":[{"excerpt":"retired","title":"Một"},2,null,[],{},
                              {"deep":[{"authorNameEn":"retired","keep":true}]}],
                     "literal":"The words excerpt and authorName stay as text"}
                    """;
            String expected = """
                    {"title":"Giữ lại","translations":{"en":{"title":"English"}},
                     "items":[{"title":"Một"},2,null,[],{},{"deep":[{"keep":true}]}],
                     "literal":"The words excerpt and authorName stay as text"}
                    """;
            insert(connection, "nested", "CONTENT", "CONTENT_ARTICLE_UPDATED", nested, nested);
            insert(connection, "array", "CONTENT", "CONTENT_ARTICLE_DELETED",
                    "[{\"excerpt\":\"old\"},[null,{\"authorName\":\"old\",\"id\":2}]]", null);

            Map<String, String> untouched = new LinkedHashMap<>();
            untouched.put("review", "{\"excerpt\":\"review excerpt\",\"authorName\":\"review author\"}");
            untouched.put("other-content", "{\"excerpt\":\"different content\"}");
            untouched.put("lookalike-action", "{\"excerpt\":\"not an article action\"}");
            untouched.put("clean", " { \"title\" : \"Keep exact formatting\" } ");
            untouched.put("malformed", "{\"excerpt\":\"malformed legacy snapshot\",");
            untouched.put("unrepresentable-unicode", "{\"value\":\"\\u0000\"}");
            untouched.put("unrepresentable-number", "{\"value\":1e1000000000}");
            untouched.put("scalar", "\"excerpt authorName\"");
            untouched.put("json-null", "null");
            untouched.put("sql-null", null);
            for (var entry : untouched.entrySet()) {
                String type = entry.getKey().equals("review") ? "REVIEW" : "CONTENT";
                String action = switch (entry.getKey()) {
                    case "other-content" -> "CONTENT_PAGE_UPDATED";
                    case "lookalike-action" -> "CONTENTXARTICLE_UPDATED";
                    default -> "CONTENT_ARTICLE_UPDATED";
                };
                insert(connection, entry.getKey(), type, action, entry.getValue(), entry.getValue());
            }
            Map<String, String> originalVersions = rowVersions(connection);

            executeRepair(connection);

            assertThat(JSON.readTree(value(connection, "nested", "before_data")))
                    .isEqualTo(JSON.readTree(expected));
            assertThat(JSON.readTree(value(connection, "nested", "after_data")))
                    .isEqualTo(JSON.readTree(expected));
            assertThat(JSON.readTree(value(connection, "array", "before_data")))
                    .isEqualTo(JSON.readTree("[{},[null,{\"id\":2}]]"));
            assertThat(value(connection, "array", "after_data")).isNull();
            for (var entry : untouched.entrySet()) {
                assertThat(value(connection, entry.getKey(), "before_data")).isEqualTo(entry.getValue());
                assertThat(value(connection, entry.getKey(), "after_data")).isEqualTo(entry.getValue());
                assertThat(rowVersions(connection).get(entry.getKey())).isEqualTo(originalVersions.get(entry.getKey()));
            }

            Map<String, String> repairedVersions = rowVersions(connection);
            executeRepair(connection);
            assertThat(rowVersions(connection)).isEqualTo(repairedVersions);
        }
    }

    @Test
    void databaseTransactionRollbackRestoresTheOriginalSnapshot() throws Exception {
        try (Connection connection = openFixture()) {
            String original = "{\"translations\":{\"en\":{\"excerpt\":\"Retired\",\"title\":\"Keep\"}}}";
            insert(connection, "rollback", "CONTENT", "CONTENT_ARTICLE_UPDATED", original, null);
            connection.setAutoCommit(false);

            executeRepair(connection);
            assertThat(value(connection, "rollback", "before_data")).doesNotContain("excerpt");
            connection.rollback();

            assertThat(value(connection, "rollback", "before_data")).isEqualTo(original);
            connection.setAutoCommit(true);
        }
    }

    private static Connection openFixture() throws Exception {
        Connection connection = DriverManager.getConnection(
                postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword());
        try (var statement = connection.createStatement()) {
            statement.execute("""
                    CREATE TEMPORARY TABLE audit_logs (
                        id text PRIMARY KEY,
                        resource_type text NOT NULL,
                        action text NOT NULL,
                        before_data text,
                        after_data text
                    )
                    """);
        }
        return connection;
    }

    private static void insert(Connection connection, String id, String type, String action,
                               String before, String after) throws Exception {
        try (var statement = connection.prepareStatement("INSERT INTO audit_logs VALUES (?, ?, ?, ?, ?)")) {
            statement.setString(1, id);
            statement.setString(2, type);
            statement.setString(3, action);
            statement.setString(4, before);
            statement.setString(5, after);
            statement.executeUpdate();
        }
    }

    private static String value(Connection connection, String id, String column) throws Exception {
        assertThat(column).isIn("before_data", "after_data");
        try (var statement = connection.prepareStatement("SELECT " + column + " FROM audit_logs WHERE id = ?")) {
            statement.setString(1, id);
            try (var rows = statement.executeQuery()) {
                assertThat(rows.next()).isTrue();
                return rows.getString(1);
            }
        }
    }

    private static Map<String, String> rowVersions(Connection connection) throws Exception {
        Map<String, String> versions = new LinkedHashMap<>();
        try (var statement = connection.createStatement();
             var rows = statement.executeQuery("SELECT id, xmin::text FROM audit_logs ORDER BY id")) {
            while (rows.next()) versions.put(rows.getString(1), rows.getString(2));
        }
        return versions;
    }

    private static void executeRepair(Connection connection) throws Exception {
        try (var input = Objects.requireNonNull(NestedArticleAuditCleanupMigrationPostgresTest.class
                .getResourceAsStream("/db/migration/V1095__clean_nested_retired_article_audit_fields.sql"));
             var statement = connection.createStatement()) {
            statement.execute(new String(input.readAllBytes(), StandardCharsets.UTF_8));
        }
    }
}
