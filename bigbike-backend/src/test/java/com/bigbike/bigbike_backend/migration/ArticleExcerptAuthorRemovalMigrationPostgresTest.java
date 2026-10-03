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

/** Verifies the forward-only article field removal and its audit snapshot cleanup. */
@Testcontainers(disabledWithoutDocker = true)
class ArticleExcerptAuthorRemovalMigrationPostgresTest {

    @Container
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

    @Test
    void removesArticleColumnsAndOnlyArticleAuditKeys() throws Exception {
        try (Connection connection = DriverManager.getConnection(
                postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword());
             Statement statement = connection.createStatement()) {
            createSchema(statement);
            statement.executeUpdate("""
                    INSERT INTO articles (id, excerpt, excerpt_en, author_name, author_name_en)
                    VALUES ('article-1', 'Tóm tắt cũ', 'Old excerpt', 'Tên cũ', 'Old author')
                    """);
            statement.executeUpdate("""
                    INSERT INTO audit_logs (id, resource_type, action, before_data, after_data)
                    VALUES
                      ('00000000-0000-0000-0000-000000000001', 'CONTENT', 'CONTENT_ARTICLE_UPDATED',
                       '{"excerpt":"Tóm tắt cũ","excerpt_en":"Old excerpt","authorName":"Tên cũ","authorNameEn":"Old author","title":"Giữ lại","translations":{"en":{"excerpt":"Old nested excerpt","authorName":"Old nested author","title":"Giữ lại"}},"items":[{"excerpt":"Old array excerpt","title":"Giữ lại"}]}',
                       '{"excerpt":"Tóm tắt mới","authorName":"Tên mới","title":"Giữ lại","translations":{"en":{"excerpt_en":"Old nested EN excerpt","authorNameEn":"Old nested EN author","title":"Giữ lại"}}}'),
                      ('00000000-0000-0000-0000-000000000002', 'REVIEW', 'REVIEW_UPDATED',
                       '{"excerpt":"Review excerpt","authorName":"Review author"}',
                       '{"excerpt":"Review excerpt","authorName":"Review author"}')
                    """);

            executeMigration(statement);

            assertThat(columnCount(statement, "articles", "excerpt")).isZero();
            assertThat(columnCount(statement, "articles", "excerpt_en")).isZero();
            assertThat(columnCount(statement, "articles", "author_name")).isZero();
            assertThat(columnCount(statement, "articles", "author_name_en")).isZero();

            String articleBefore = auditValue(statement, "00000000-0000-0000-0000-000000000001", "before_data");
            String articleAfter = auditValue(statement, "00000000-0000-0000-0000-000000000001", "after_data");
            assertThat(articleBefore).doesNotContain("excerpt", "authorName");
            assertThat(articleAfter).doesNotContain("excerpt", "authorName");
            assertThat(articleBefore).contains("Giữ lại");
            assertThat(articleAfter).contains("Giữ lại");

            String reviewBefore = auditValue(statement, "00000000-0000-0000-0000-000000000002", "before_data");
            assertThat(reviewBefore).contains("Review excerpt", "Review author");

            // Re-running the forward migration is safe for an empty/already-clean state.
            executeMigration(statement);
            assertThat(columnCount(statement, "articles", "excerpt")).isZero();
            assertThat(auditValue(statement, "00000000-0000-0000-0000-000000000001", "before_data"))
                    .doesNotContain("excerpt", "authorName");
        }
    }

    private static void createSchema(Statement statement) throws Exception {
        statement.execute("""
                CREATE TABLE articles (
                    id text PRIMARY KEY,
                    excerpt text,
                    excerpt_en text,
                    author_name varchar(255),
                    author_name_en varchar(255)
                )
                """);
        statement.execute("""
                CREATE TABLE audit_logs (
                    id uuid PRIMARY KEY,
                    resource_type varchar(50) NOT NULL,
                    action varchar(100) NOT NULL,
                    before_data text,
                    after_data text
                )
                """);
    }

    private void executeMigration(Statement statement) throws Exception {
        try (InputStream input = Objects.requireNonNull(getClass().getResourceAsStream(
                "/db/migration/V1091__remove_article_excerpt_and_author_fields.sql"))) {
            statement.execute(new String(input.readAllBytes(), StandardCharsets.UTF_8));
        }
    }

    private static long columnCount(Statement statement, String table, String column) throws Exception {
        try (ResultSet rows = statement.executeQuery("""
                SELECT COUNT(*)
                FROM information_schema.columns
                WHERE table_name = '%s' AND column_name = '%s'
                """.formatted(table, column))) {
            assertThat(rows.next()).isTrue();
            return rows.getLong(1);
        }
    }

    private static String auditValue(Statement statement, String id, String column) throws Exception {
        try (ResultSet rows = statement.executeQuery(
                "SELECT " + column + " FROM audit_logs WHERE id = '" + id + "'")) {
            assertThat(rows.next()).isTrue();
            return rows.getString(1);
        }
    }
}
