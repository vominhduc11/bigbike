package com.bigbike.bigbike_backend.migration;

import static org.assertj.core.api.Assertions.assertThat;

import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.Statement;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.datasource.init.ScriptUtils;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@Testcontainers(disabledWithoutDocker = true)
class RedirectSourceRepairMigrationTest {

    @Container
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

    @BeforeEach
    void createRedirectSchema() throws Exception {
        try (Connection connection = postgres.createConnection("");
             Statement statement = connection.createStatement()) {
            statement.execute("""
                    DROP SCHEMA public CASCADE;
                    CREATE SCHEMA public;
                    CREATE TABLE redirects (
                        id uuid PRIMARY KEY,
                        source_pattern varchar(2048) NOT NULL,
                        target_url varchar(2048) NOT NULL,
                        enabled boolean NOT NULL DEFAULT true,
                        hit_count bigint NOT NULL DEFAULT 0,
                        last_hit_at timestamptz,
                        notes text,
                        legacy_id bigint,
                        created_at timestamptz NOT NULL,
                        updated_at timestamptz NOT NULL,
                        CONSTRAINT uk_redirects_source_pattern UNIQUE (source_pattern)
                    );
                    """);
        }
    }

    @Test
    void expandsEveryExactPatternKeepsExistingCanonicalRowAndRemovesSerializedJunk() throws Exception {
        try (Connection connection = postgres.createConnection("");
             Statement statement = connection.createStatement()) {
            statement.execute("""
                    INSERT INTO redirects (
                        id, source_pattern, target_url, enabled, hit_count, notes, legacy_id, created_at, updated_at
                    ) VALUES
                      ('00000000-0000-0000-0000-000000000001', '/vi/old-one.html', '/existing-target', true, 3,
                       'existing canonical row', 11, now() - interval '2 days', now() - interval '2 days'),
                      ('00000000-0000-0000-0000-000000000002',
                       'a:2:{i:0;a:2:{s:7:"pattern";s:15:"vi/old-one.html";s:10:"comparison";s:5:"exact";}i:1;a:2:{s:7:"pattern";s:19:"sp/missing-two.html";s:10:"comparison";s:5:"exact";}}',
                       '/new-target', false, 7, 'repaired from WordPress', 22, now() - interval '1 day', now() - interval '1 day');
                    """);

            ScriptUtils.executeSqlScript(
                    connection,
                    new ClassPathResource("db/migration/V377__repair_serialized_redirect_sources.sql"));

            assertThat(stringValue(statement, "SELECT target_url FROM redirects WHERE source_pattern = '/vi/old-one.html'"))
                    .isEqualTo("/existing-target");
            assertThat(stringValue(statement, "SELECT target_url FROM redirects WHERE source_pattern = '/sp/missing-two.html'"))
                    .isEqualTo("/new-target");
            assertThat(longValue(statement, "SELECT hit_count FROM redirects WHERE source_pattern = '/sp/missing-two.html'"))
                    .isEqualTo(7L);
            assertThat(longValue(statement, "SELECT count(*) FROM redirects WHERE source_pattern LIKE 'a:%'"))
                    .isZero();
            assertThat(longValue(statement, "SELECT count(*) FROM redirects"))
                    .isEqualTo(2L);
        }
    }

    private static String stringValue(Statement statement, String sql) throws Exception {
        try (ResultSet resultSet = statement.executeQuery(sql)) {
            resultSet.next();
            return resultSet.getString(1);
        }
    }

    private static long longValue(Statement statement, String sql) throws Exception {
        try (ResultSet resultSet = statement.executeQuery(sql)) {
            resultSet.next();
            return resultSet.getLong(1);
        }
    }
}
