package com.bigbike.bigbike_backend.migration;

import com.bigbike.bigbike_backend.service.content.ArticleBodyBlockBackfill;
import java.lang.reflect.Proxy;
import java.nio.charset.StandardCharsets;
import java.sql.Connection;
import java.sql.DriverManager;
import java.util.Objects;
import java.util.concurrent.atomic.AtomicBoolean;
import org.junit.jupiter.api.Test;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import static org.assertj.core.api.Assertions.assertThat;

@Testcontainers(disabledWithoutDocker = true)
class ArticleBodyBlockBackfillPostgresTest {
    @Container
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

    @Test
    void fillsMissingBlocksWithoutChangingAnyOriginalFieldAndRepairsHtmlOnlyWrites() throws Exception {
        try (var connection = connect(); var sql = connection.createStatement()) {
            sql.execute("""
                    CREATE TABLE articles (id text PRIMARY KEY, body text, body_en text, body_blocks jsonb,
                      publish_status text, updated_at timestamp);
                    INSERT INTO articles VALUES
                      ('missing', '<p>Original</p><table><tr><th>Size</th><td colspan="2">M</td></tr></table>',
                       '<p>English remains</p>', NULL, 'PUBLISHED', '2026-09-18'),
                      ('existing', '<p>Original existing</p>', NULL, '[{"type":"paragraph","html":"Edited"}]', 'DRAFT', '2026-09-17'),
                      ('empty', '', NULL, '[]', 'DRAFT', '2026-09-16'),
                      ('missing-empty', NULL, NULL, NULL, 'DRAFT', '2026-09-16'),
                      ('json-null', '<p>JSON null import</p>', NULL, 'null', 'DRAFT', '2026-09-16');
                    """);
            String before = snapshot(connection);
            assertThat(ArticleBodyBlockBackfill.fillMissing(connection, 50)).isEqualTo(3);
            assertThat(value(connection, "SELECT body_blocks::text FROM articles WHERE id='missing-empty'"))
                    .isEqualTo("[]");
            assertThat(snapshot(connection)).isEqualTo(before);
            assertThat(value(connection, "SELECT body_blocks->1->>'type' FROM articles WHERE id='missing'"))
                    .isEqualTo("table");
            assertThat(value(connection, "SELECT body_blocks->1->>'html' FROM articles WHERE id='missing'"))
                    .contains("colspan=\"2\"");
            assertThat(value(connection, "SELECT body_blocks->0->>'html' FROM articles WHERE id='existing'"))
                    .isEqualTo("Edited");
            assertThat(ArticleBodyBlockBackfill.fillMissing(connection, 50)).isZero();

            try (var resource = Objects.requireNonNull(getClass().getResourceAsStream(
                    "/db/migration/V1087__invalidate_stale_article_body_blocks.sql"))) {
                sql.execute(new String(resource.readAllBytes(), StandardCharsets.UTF_8));
            }
            sql.execute("UPDATE articles SET body='<p>New import</p>' WHERE id='missing'");
            assertThat(value(connection, "SELECT body_blocks::text FROM articles WHERE id='missing'")).isNull();
            assertThat(ArticleBodyBlockBackfill.fillMissing(connection, 50)).isEqualTo(1);
            assertThat(value(connection, "SELECT body_blocks->0->>'html' FROM articles WHERE id='missing'"))
                    .contains("New import");

            sql.execute("UPDATE articles SET body='', body_blocks='[]' WHERE id='missing'");
            assertThat(ArticleBodyBlockBackfill.fillMissing(connection, 50)).isZero();
            sql.execute("UPDATE articles SET body='<p>Saved together</p>', body_blocks='[{\"type\":\"paragraph\",\"html\":\"Saved together\"}]' WHERE id='existing'");
            assertThat(value(connection, "SELECT body_blocks->0->>'html' FROM articles WHERE id='existing'"))
                    .isEqualTo("Saved together");

            sql.execute("INSERT INTO articles(id,body) VALUES('race','<p>Before concurrent edit</p>')");
            AtomicBoolean edited = new AtomicBoolean();
            Connection racing = (Connection) Proxy.newProxyInstance(Connection.class.getClassLoader(),
                    new Class<?>[]{Connection.class}, (proxy, method, args) -> {
                        if (method.getName().equals("prepareStatement") && args[0].toString().strip().startsWith("UPDATE")
                                && edited.compareAndSet(false, true)) {
                            try (var other = connect(); var write = other.createStatement()) {
                                write.execute("UPDATE articles SET body='<p>Concurrent edit</p>' WHERE id='race'");
                            }
                        }
                        return method.invoke(connection, args);
                    });
            assertThat(ArticleBodyBlockBackfill.fillMissing(racing, 50)).isZero();
            assertThat(value(connection, "SELECT body_blocks::text FROM articles WHERE id='race'")).isNull();
            assertThat(ArticleBodyBlockBackfill.fillMissing(connection, 50)).isEqualTo(1);
            assertThat(value(connection, "SELECT body_blocks->0->>'html' FROM articles WHERE id='race'"))
                    .contains("Concurrent edit");
        }
    }

    private static Connection connect() throws Exception {
        return DriverManager.getConnection(postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword());
    }

    private static String snapshot(Connection connection) throws Exception {
        return value(connection, "SELECT jsonb_agg(to_jsonb(a)-'body_blocks' ORDER BY id)::text FROM articles a");
    }

    private static String value(Connection connection, String query) throws Exception {
        try (var sql = connection.createStatement(); var rows = sql.executeQuery(query)) {
            rows.next(); return rows.getString(1);
        }
    }
}
