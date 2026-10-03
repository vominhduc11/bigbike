package com.bigbike.bigbike_backend.migration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/** Verifies the guarded English seed for Bo and display-only color terms. */
@Testcontainers(disabledWithoutDocker = true)
class BoAttributeEnglishAndColorTermsMigrationPostgresTest {

    @Container
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

    @Test
    void fillsOnlyTheApprovedBoEnglishLabelsAndAddsDisplayTerms() throws Exception {
        try (Connection connection = connection()) {
            useFreshSchema(connection);
            createSchema(connection);
            seedBo(connection, APPROVED_VALUES);
            seedColorReference(connection);

            executeMigration(connection);

            assertThat(singleValue(connection, "select name_en from attributes where code = 'bo'"))
                    .isEqualTo("Part");
            for (ApprovedValue expected : APPROVED_VALUES) {
                assertThat(singleValue(connection, "select label_en from attribute_values where slug = '"
                        + expected.slug() + "'"))
                        .isEqualTo(expected.labelEn());
                assertThat(singleValue(connection, "select label from attribute_values where slug = '"
                        + expected.slug() + "'"))
                        .isEqualTo(expected.labelVi());
            }
            assertThat(singleValue(connection, "select label_en from attribute_values where id = 'color-red'"))
                    .isNull();
            assertThat(count(connection, "product_variant_options")).isEqualTo(1);
            assertThat(count(connection, "catalog_visual_display_terms")).isEqualTo(7);
            assertThat(singleValue(connection,
                    "select label_en from catalog_visual_display_terms where source_label = 'tem-do'"))
                    .isEqualTo("Red decal");

            // Re-running remains idempotent and preserves the same dictionary rows.
            executeMigration(connection);
            assertThat(count(connection, "attribute_values")).isEqualTo(APPROVED_VALUES.size() + 1L);
        }
    }

    @Test
    void installsDisplayTermsWithoutFailingWhenBoIsAbsent() throws Exception {
        try (Connection connection = connection()) {
            useFreshSchema(connection);
            createSchema(connection);
            seedColorReference(connection);

            executeMigration(connection);

            assertThat(count(connection, "attributes")).isEqualTo(1);
            assertThat(count(connection, "catalog_visual_display_terms")).isEqualTo(7);
        }
    }

    @Test
    void stopsBeforeUpdatingWhenBoDoesNotHaveTheApprovedSlugSet() throws Exception {
        try (Connection connection = connection()) {
            useFreshSchema(connection);
            createSchema(connection);
            seedBo(connection, APPROVED_VALUES.subList(0, APPROVED_VALUES.size() - 1));

            assertThatThrownBy(() -> executeMigration(connection))
                    .isInstanceOf(SQLException.class)
                    .hasMessageContaining("Bo values do not match the approved immutable slug set");

            assertThat(singleValue(connection, "select name_en from attributes where code = 'bo'"))
                    .isNull();
            assertThat(countWhere(connection, "attribute_values", "label_en is not null")).isZero();
        }
    }

    private Connection connection() throws SQLException {
        return DriverManager.getConnection(postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword());
    }

    private void useFreshSchema(Connection connection) throws SQLException {
        String schema = "v1090_" + UUID.randomUUID().toString().replace('-', '_');
        try (Statement statement = connection.createStatement()) {
            statement.execute("create schema " + schema);
            statement.execute("set search_path to " + schema);
        }
    }

    private void createSchema(Connection connection) throws SQLException {
        try (Statement statement = connection.createStatement()) {
            statement.execute("""
                    create table attributes (
                        id varchar(64) primary key,
                        code varchar(160) not null unique,
                        name varchar(255) not null,
                        name_en varchar(255)
                    );
                    create table attribute_values (
                        id varchar(64) primary key,
                        attribute_id varchar(64) not null references attributes(id),
                        slug varchar(160) not null,
                        label varchar(255) not null,
                        label_en varchar(255)
                    );
                    create table product_variant_options (
                        id bigint primary key,
                        attribute_id varchar(64) references attributes(id),
                        attribute_value_id varchar(64) references attribute_values(id)
                    );
                    """);
        }
    }

    private void seedBo(Connection connection, List<ApprovedValue> values) throws SQLException {
        try (Statement statement = connection.createStatement()) {
            statement.execute("insert into attributes (id, code, name) values ('attr-bo', 'bo', 'Bo')");
        }
        try (PreparedStatement statement = connection.prepareStatement("""
                insert into attribute_values (id, attribute_id, slug, label)
                values (?, 'attr-bo', ?, ?)
                """)) {
            for (ApprovedValue value : values) {
                statement.setString(1, "bo-" + value.slug());
                statement.setString(2, value.slug());
                statement.setString(3, value.labelVi());
                statement.addBatch();
            }
            statement.executeBatch();
        }
    }

    private void seedColorReference(Connection connection) throws SQLException {
        try (Statement statement = connection.createStatement()) {
            statement.execute("""
                    insert into attributes (id, code, name) values ('attr-color', 'color', 'Màu sắc');
                    insert into attribute_values (id, attribute_id, slug, label)
                    values ('color-red', 'attr-color', 'do', 'Đỏ');
                    insert into product_variant_options (id, attribute_id, attribute_value_id)
                    values (1, 'attr-color', 'color-red');
                    """);
        }
    }

    private void executeMigration(Connection connection) throws SQLException, IOException {
        try (InputStream input = Objects.requireNonNull(getClass().getResourceAsStream(
                "/db/migration/V1090__localize_bo_attribute_and_color_accessibility_terms.sql"))) {
            try (Statement statement = connection.createStatement()) {
                statement.execute(new String(input.readAllBytes(), StandardCharsets.UTF_8));
            }
        }
    }

    private long count(Connection connection, String table) throws SQLException {
        return countWhere(connection, table, "true");
    }

    private long countWhere(Connection connection, String table, String condition) throws SQLException {
        try (Statement statement = connection.createStatement();
                var rows = statement.executeQuery("select count(*) from " + table + " where " + condition)) {
            rows.next();
            return rows.getLong(1);
        }
    }

    private String singleValue(Connection connection, String sql) throws SQLException {
        try (Statement statement = connection.createStatement(); var rows = statement.executeQuery(sql)) {
            rows.next();
            return rows.getString(1);
        }
    }

    private record ApprovedValue(String slug, String labelVi, String labelEn) {
    }

    private static final List<ApprovedValue> APPROVED_VALUES = List.of(
            new ApprovedValue("tay", "Tay", "Arms"),
            new ApprovedValue("vai", "Vai", "Shoulders"),
            new ApprovedValue("lung", "Lưng", "Back"),
            new ApprovedValue("combo-3", "Combo 3", "Set of 3"),
            new ApprovedValue("ao", "Áo", "Top"),
            new ApprovedValue("quan", "Quần", "Pants"),
            new ApprovedValue("5f-dual", "Dual", "Set of 2"),
            new ApprovedValue("chan-ghi-dong", "Chân ghi đông", "Handlebar end"),
            new ApprovedValue("mai-che", "Mái che", "Canopy"),
            new ApprovedValue("non-che", "Nón che", "Cover cap"),
            new ApprovedValue("num-khoa-chong-trom", "núm khóa chống trộm", "Anti-theft lock knob"),
            new ApprovedValue("cai", "CÁI", "Piece"),
            new ApprovedValue("cap", "CẶP", "Pair"),
            new ApprovedValue("cd-single", "Single", "Single"));
}
