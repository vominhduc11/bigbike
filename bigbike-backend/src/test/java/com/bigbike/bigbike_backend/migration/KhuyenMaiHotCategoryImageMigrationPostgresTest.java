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

/** Verifies the guarded copy of the legacy Khuyến mãi hot icon into category image storage. */
@Testcontainers(disabledWithoutDocker = true)
class KhuyenMaiHotCategoryImageMigrationPostgresTest {

    @Container
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

    @Test
    void v1069CopiesOnlyTheTargetCategoryAndKeepsLegacyIcon() throws Exception {
        try (Connection connection = connection(); Statement statement = connection.createStatement()) {
            createSchema(statement);
            seed(statement);

            executeMigration(statement, "V1069__move_khuyen_mai_hot_menu_icon_to_category_image.sql");

            assertThat(value(statement, "image_url", "wp-cat-287"))
                    .isEqualTo("/media/uploads/wp-icons/icon-1.png");
            assertThat(value(statement, "image_width", "wp-cat-287")).isEqualTo("14");
            assertThat(value(statement, "image_height", "wp-cat-287")).isEqualTo("16");
            assertThat(value(statement, "image_mime_type", "wp-cat-287")).isEqualTo("image/png");
            assertThat(value(statement, "menu_icon_url", "wp-cat-287")).isEqualTo("/wp/icon-1.png");

            assertThat(value(statement, "image_url", "already-has-image")).isEqualTo("/media/existing.png");
            assertThat(value(statement, "image_width", "already-has-image")).isEqualTo("200");
            assertThat(value(statement, "menu_icon_url", "other-category"))
                    .isEqualTo("/media/uploads/wp-icons/other.png");

            // The blank-image guard makes the migration idempotent.
            executeMigration(statement, "V1069__move_khuyen_mai_hot_menu_icon_to_category_image.sql");
            assertThat(value(statement, "image_url", "wp-cat-287"))
                    .isEqualTo("/media/uploads/wp-icons/icon-1.png");
            assertThat(value(statement, "menu_icon_url", "wp-cat-287")).isEqualTo("/wp/icon-1.png");
        }
    }

    private Connection connection() throws SQLException {
        return DriverManager.getConnection(postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword());
    }

    private void createSchema(Statement statement) throws SQLException {
        statement.execute("""
                create table categories (
                    id varchar(64) primary key,
                    image_url text,
                    image_width integer,
                    image_height integer,
                    image_mime_type varchar(100),
                    menu_icon_url text,
                    updated_at timestamptz
                )
                """);
    }

    private void seed(Statement statement) throws SQLException {
        statement.execute("""
                insert into categories (id, image_url, image_width, image_height, image_mime_type, menu_icon_url, updated_at)
                values
                    ('wp-cat-287', null, null, null, null, '/wp/icon-1.png', now()),
                    ('already-has-image', '/media/existing.png', 200, 200, 'image/png', '/media/uploads/wp-icons/old.png', now()),
                    ('other-category', null, null, null, null, '/media/uploads/wp-icons/other.png', now())
                """);
    }

    private void executeMigration(Statement statement, String filename) throws SQLException, IOException {
        try (InputStream input = Objects.requireNonNull(
                getClass().getResourceAsStream("/db/migration/" + filename))) {
            statement.execute(new String(input.readAllBytes(), StandardCharsets.UTF_8));
        }
    }

    private String value(Statement statement, String column, String id) throws SQLException {
        try (ResultSet results = statement.executeQuery(
                "select %s from categories where id = '%s'".formatted(column, id))) {
            results.next();
            Object value = results.getObject(1);
            return value == null ? null : value.toString();
        }
    }
}
