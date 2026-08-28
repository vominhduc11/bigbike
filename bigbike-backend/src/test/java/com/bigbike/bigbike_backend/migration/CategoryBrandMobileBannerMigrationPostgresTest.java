package com.bigbike.bigbike_backend.migration;

import static org.assertj.core.api.Assertions.assertThat;

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

/** Verifies the forward-only removal of retired Category and Brand mobile-banner storage. */
@Testcontainers(disabledWithoutDocker = true)
class CategoryBrandMobileBannerMigrationPostgresTest {

    @Container
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

    @Test
    void v1066DropsOnlyMobileBannerColumns() throws Exception {
        try (Connection connection = connection(); Statement statement = connection.createStatement()) {
            createSchema(statement);

            executeMigration(statement, "V1066__drop_category_brand_mobile_banner_columns.sql");

            assertThat(columnCount(statement, "categories", "mobile_banner_url")).isZero();
            assertThat(columnCount(statement, "categories", "mobile_banner_alt")).isZero();
            assertThat(columnCount(statement, "brands", "mobile_banner_url")).isZero();
            assertThat(columnCount(statement, "brands", "mobile_banner_alt")).isZero();

            assertThat(columnCount(statement, "categories", "banner_url")).isEqualTo(1);
            assertThat(columnCount(statement, "categories", "banner_alt")).isEqualTo(1);
            assertThat(columnCount(statement, "brands", "banner_url")).isEqualTo(1);
            assertThat(columnCount(statement, "brands", "banner_alt")).isEqualTo(1);
        }
    }

    private Connection connection() throws SQLException {
        return DriverManager.getConnection(postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword());
    }

    private void createSchema(Statement statement) throws SQLException {
        statement.execute("""
                create table categories (
                    id varchar(64) primary key,
                    banner_url text,
                    banner_alt varchar(255),
                    mobile_banner_url text,
                    mobile_banner_alt varchar(255)
                );
                create table brands (
                    id varchar(64) primary key,
                    banner_url text,
                    banner_alt varchar(255),
                    mobile_banner_url text,
                    mobile_banner_alt varchar(255)
                )
                """);
    }

    private void executeMigration(Statement statement, String filename) throws SQLException, IOException {
        try (InputStream input = Objects.requireNonNull(
                getClass().getResourceAsStream("/db/migration/" + filename))) {
            statement.execute(new String(input.readAllBytes(), StandardCharsets.UTF_8));
        }
    }

    private int columnCount(Statement statement, String table, String column) throws SQLException {
        try (ResultSet results = statement.executeQuery("""
                select count(*)
                from information_schema.columns
                where table_schema = current_schema()
                  and table_name = '%s'
                  and column_name = '%s'
                """.formatted(table, column))) {
            results.next();
            return results.getInt(1);
        }
    }
}
