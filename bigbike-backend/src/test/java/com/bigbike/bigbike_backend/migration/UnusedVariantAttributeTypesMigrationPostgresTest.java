package com.bigbike.bigbike_backend.migration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.Objects;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/** Verifies the guarded cleanup of the four unused variant attribute types. */
@Testcontainers(disabledWithoutDocker = true)
class UnusedVariantAttributeTypesMigrationPostgresTest {

    @Container
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

    @Test
    void removesOnlyTheFourUnusedTypesAndTheirValues() throws Exception {
        try (Connection connection = connection()) {
            useFreshSchema(connection);
            createSchema(connection);
            seedAttributes(connection, false);

            executeMigration(connection);

            assertThat(count(connection, "attributes")).isEqualTo(2);
            assertThat(count(connection, "attribute_values")).isEqualTo(1);
            assertThat(countWhere(connection, "attributes", "code in ('color', 'size')")).isEqualTo(2);
            assertThat(countWhere(connection, "attribute_values", "id = 'keep-value'")).isEqualTo(1);

            // A second invocation is a no-op after the one-time cleanup.
            executeMigration(connection);
            assertThat(count(connection, "attributes")).isEqualTo(2);
            assertThat(count(connection, "attribute_values")).isEqualTo(1);
        }
    }

    @Test
    void abortsBeforeDeletingWhenAnyTargetTypeIsUsed() throws Exception {
        try (Connection connection = connection()) {
            useFreshSchema(connection);
            createSchema(connection);
            seedAttributes(connection, true);

            assertThatThrownBy(() -> executeMigration(connection))
                    .isInstanceOf(SQLException.class)
                    .hasMessageContaining("target attribute types are used");

            assertThat(count(connection, "attributes")).isEqualTo(6);
            assertThat(count(connection, "attribute_values")).isEqualTo(6);
        }
    }

    @Test
    void abortsWhenOnlyPartOfTheTargetSetExists() throws Exception {
        try (Connection connection = connection()) {
            useFreshSchema(connection);
            createSchema(connection);
            seedAttributes(connection, false);
            try (Statement statement = connection.createStatement()) {
                statement.execute("delete from attributes where code = 'solo'");
            }

            assertThatThrownBy(() -> executeMigration(connection))
                    .isInstanceOf(SQLException.class)
                    .hasMessageContaining("expected all four target attribute types");

            assertThat(count(connection, "attributes")).isEqualTo(5);
            assertThat(count(connection, "attribute_values")).isEqualTo(6);
        }
    }

    private Connection connection() throws SQLException {
        return DriverManager.getConnection(postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword());
    }

    private void useFreshSchema(Connection connection) throws SQLException {
        String schema = "v1089_" + UUID.randomUUID().toString().replace('-', '_');
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
                        code varchar(160) not null unique
                    );
                    create table attribute_values (
                        id varchar(64) primary key,
                        attribute_id varchar(64) not null references attributes(id) on delete cascade
                    );
                    create table product_variant_options (
                        id bigint primary key,
                        attribute_id varchar(64) references attributes(id),
                        attribute_value_id varchar(64) references attribute_values(id)
                    );
                    """);
        }
    }

    private void seedAttributes(Connection connection, boolean withUsage) throws SQLException {
        try (Statement statement = connection.createStatement()) {
            statement.execute("""
                    insert into attributes (id, code) values
                      ('attr-dungtich', 'dungtich'),
                      ('attr-bolt', 'kich-thuoc-oc'),
                      ('attr-cap', 'cap'),
                      ('attr-solo', 'solo'),
                      ('attr-color', 'color'),
                      ('attr-size', 'size');
                    insert into attribute_values (id, attribute_id) values
                      ('value-250ml', 'attr-dungtich'),
                      ('value-400ml', 'attr-dungtich'),
                      ('value-60cc', 'attr-dungtich'),
                      ('value-100cc', 'attr-dungtich'),
                      ('value-bolt', 'attr-bolt'),
                      ('keep-value', 'attr-color');
                    """);
            if (withUsage) {
                statement.execute(
                        "insert into product_variant_options (id, attribute_id, attribute_value_id) "
                                + "values (1, 'attr-dungtich', 'value-250ml')");
            }
        }
    }

    private void executeMigration(Connection connection) throws SQLException, IOException {
        try (InputStream input = Objects.requireNonNull(getClass().getResourceAsStream(
                "/db/migration/V1089__remove_unused_variant_attribute_types.sql"))) {
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
}
