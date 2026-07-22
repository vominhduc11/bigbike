package com.bigbike.bigbike_backend.migration;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/** Verifies the final PostgreSQL schema produced by V348 and all prior migrations. */
@SpringBootTest
@ActiveProfiles("tc")
@Testcontainers
class ProductCategoryMapMigrationTest {

    @Container
    @ServiceConnection
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

    @Autowired
    private JdbcTemplate jdbc;

    @Test
    void v348BackfillsExactlyOneMappingPerExistingProductAndDropsLegacyColumn() {
        Integer legacyColumnCount = jdbc.queryForObject("""
                SELECT count(*)
                FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name = 'products'
                  AND column_name = 'category_id'
                """, Integer.class);
        Integer productCount = jdbc.queryForObject("SELECT count(*) FROM products", Integer.class);
        Integer mappingCount = jdbc.queryForObject("SELECT count(*) FROM product_category_map", Integer.class);
        Integer duplicatePairs = jdbc.queryForObject("""
                SELECT count(*) FROM (
                    SELECT product_id, category_id
                    FROM product_category_map
                    GROUP BY product_id, category_id
                    HAVING count(*) > 1
                ) duplicates
                """, Integer.class);
        Integer categoryLookupIndexCount = jdbc.queryForObject("""
                SELECT count(*)
                FROM pg_indexes
                WHERE schemaname = 'public'
                  AND tablename = 'product_category_map'
                  AND indexname = 'idx_product_category_map_category_product'
                """, Integer.class);

        assertThat(legacyColumnCount).isZero();
        assertThat(mappingCount).isEqualTo(productCount);
        assertThat(duplicatePairs).isZero();
        assertThat(categoryLookupIndexCount).isEqualTo(1);
    }
}
