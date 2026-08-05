package com.bigbike.bigbike_backend.migration;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/** Verifies the final PostgreSQL migration schema used by the live content migration. */
@SpringBootTest
@ActiveProfiles("tc")
@Testcontainers
class ContentCategoryRemovalMigrationTest {

    @Container
    @ServiceConnection
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

    @Autowired
    private JdbcTemplate jdbc;

    @Test
    void v368ToV370PrepareOnlyTheGuardedLiveMigrationSchema() {
        List<String> tables = jdbc.queryForList("""
                SELECT table_name
                FROM information_schema.tables
                WHERE table_schema = 'public'
                  AND table_name IN ('content_categories', 'article_category_map')
                """, String.class);
        Integer categoryColumnCount = jdbc.queryForObject("""
                SELECT count(*)
                FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name = 'articles'
                  AND column_name = 'category_id'
                """, Integer.class);
        Integer articleTagsCount = jdbc.queryForObject("""
                SELECT count(*)
                FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name = 'article_tags'
                """, Integer.class);
        Integer productCategoriesCount = jdbc.queryForObject("""
                SELECT count(*)
                FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name = 'categories'
                """, Integer.class);
        Integer mediaShaColumnCount = jdbc.queryForObject("""
                SELECT count(*)
                FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name = 'media'
                  AND column_name = 'content_sha256'
                """, Integer.class);
        Integer mediaShaIndexCount = jdbc.queryForObject("""
                SELECT count(*)
                FROM pg_indexes
                WHERE schemaname = 'public'
                  AND tablename = 'media'
                  AND indexname = 'ux_media_content_sha256'
                """, Integer.class);
        List<String> liveMigrationTables = jdbc.queryForList("""
                SELECT table_name
                FROM information_schema.tables
                WHERE table_schema = 'public'
                  AND table_name IN ('live_migration_runs', 'live_migration_checkpoints')
                ORDER BY table_name
                """, String.class);

        assertThat(tables).isEmpty();
        assertThat(categoryColumnCount).isZero();
        assertThat(articleTagsCount).isEqualTo(1);
        assertThat(productCategoriesCount).isEqualTo(1);
        assertThat(mediaShaColumnCount).isEqualTo(1);
        assertThat(mediaShaIndexCount).isEqualTo(1);
        assertThat(liveMigrationTables)
                .containsExactly("live_migration_checkpoints", "live_migration_runs");
    }
}
