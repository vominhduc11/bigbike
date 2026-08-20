package com.bigbike.bigbike_backend.migration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.time.Instant;
import java.util.Objects;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/** Runs V1045–V1048 against a minimal PostgreSQL schema without relying on legacy data migrations. */
@Testcontainers(disabledWithoutDocker = true)
class PerformanceMigrationsPostgresTest {

    @Container
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine")
            .withCommand("postgres", "-c", "shared_preload_libraries=pg_stat_statements");

    @BeforeEach
    void resetTables() throws SQLException {
        try (Connection connection = connection(); Statement statement = connection.createStatement()) {
            statement.execute("drop table if exists maintenance_cart_purge_backup_items cascade");
            statement.execute("drop table if exists maintenance_cart_purge_backup_carts cascade");
            statement.execute("drop table if exists maintenance_cart_purge_runs cascade");
            statement.execute("drop table if exists product_variant_options cascade");
            statement.execute("drop table if exists attribute_values cascade");
            statement.execute("drop table if exists attributes cascade");
            statement.execute("drop table if exists cart_items cascade");
            statement.execute("drop table if exists carts cascade");
            statement.execute("drop table if exists audit_logs cascade");
        }
    }

    @Test
    void v1046BackfillsOnlyRetentionCartsAndCreatesTheRollbackLedger() throws Exception {
        try (Connection connection = connection(); Statement statement = connection.createStatement()) {
            createCartSchema(statement);
            Instant old = Instant.parse("2026-06-01T00:00:00Z");
            statement.execute("""
                    insert into carts (id, status, currency, created_at, updated_at) values
                    ('00000000-0000-0000-0000-000000000101', 'ACTIVE', 'VND', '%s', '%s'),
                    ('00000000-0000-0000-0000-000000000102', 'MERGED', 'VND', '%s', '%s'),
                    ('00000000-0000-0000-0000-000000000103', 'CONVERTED', 'VND', '%s', '%s')
                    """.formatted(old, old, old, old, old, old));

            executeMigration(statement, "V1046__add_cart_purge_backup_and_retention_indexes.sql");

            assertThat(booleanValue(statement, "select expires_at is not null from carts where id = '00000000-0000-0000-0000-000000000101'"))
                    .isTrue();
            assertThat(booleanValue(statement, "select expires_at is not null from carts where id = '00000000-0000-0000-0000-000000000102'"))
                    .isTrue();
            assertThat(booleanValue(statement, "select expires_at is null from carts where id = '00000000-0000-0000-0000-000000000103'"))
                    .isTrue();
            assertThat(booleanValue(statement, "select to_regclass('maintenance_cart_purge_runs') is not null"))
                    .isTrue();
            assertThat(booleanValue(statement, "select to_regclass('maintenance_cart_purge_backup_carts') is not null"))
                    .isTrue();
            assertThat(booleanValue(statement, "select to_regclass('maintenance_cart_purge_backup_items') is not null"))
                    .isTrue();
        }
    }

    @Test
    void v1047LinksOnlyAnUnambiguousOptionAndThenRequiresBothForeignKeys() throws Exception {
        try (Connection connection = connection(); Statement statement = connection.createStatement()) {
            createVariantSchema(statement);
            statement.execute("insert into attributes (id, code, name) values ('color', 'color', 'Màu sắc')");
            statement.execute("insert into attribute_values (id, attribute_id, slug, label) values ('red', 'color', 'red', 'Đỏ')");
            statement.execute("""
                    insert into product_variant_options (id, option_name, option_value)
                    values ('00000000-0000-0000-0000-000000000201', 'Color', 'Red')
                    """);

            executeMigration(statement, "V1047__require_complete_variant_attribute_links.sql");

            assertThat(value(statement, "select attribute_id from product_variant_options where id = '00000000-0000-0000-0000-000000000201'"))
                    .isEqualTo("color");
            assertThat(value(statement, "select attribute_value_id from product_variant_options where id = '00000000-0000-0000-0000-000000000201'"))
                    .isEqualTo("red");
            assertThat(value(statement, """
                    select is_nullable from information_schema.columns
                    where table_name = 'product_variant_options' and column_name = 'attribute_id'
                    """.strip())).isEqualTo("NO");
            assertThat(value(statement, """
                    select is_nullable from information_schema.columns
                    where table_name = 'product_variant_options' and column_name = 'attribute_value_id'
                    """.strip())).isEqualTo("NO");
        }
    }

    @Test
    void v1047StopsSafelyWhenAnOptionCannotBeMatchedUniquely() throws Exception {
        try (Connection connection = connection(); Statement statement = connection.createStatement()) {
            createVariantSchema(statement);
            statement.execute("""
                    insert into product_variant_options (id, option_name, option_value)
                    values ('00000000-0000-0000-0000-000000000202', 'Không có', 'Giá trị không có')
                    """);
            connection.setAutoCommit(false);

            assertThatThrownBy(() -> executeMigration(statement, "V1047__require_complete_variant_attribute_links.sql"))
                    .isInstanceOf(SQLException.class)
                    .hasMessageContaining("V1047 đã dừng an toàn");
            connection.rollback();
        }
    }

    @Test
    void v1048InstallsTheSlowStatementExtensionWhenPostgresWasPreloaded() throws Exception {
        try (Connection connection = connection(); Statement statement = connection.createStatement()) {
            executeMigration(statement, "V1048__enable_pg_stat_statements.sql");
            assertThat(booleanValue(statement, "select exists (select 1 from pg_extension where extname = 'pg_stat_statements')"))
                    .isTrue();
        }
    }

    private Connection connection() throws SQLException {
        return DriverManager.getConnection(postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword());
    }

    private void createCartSchema(Statement statement) throws SQLException {
        statement.execute("create extension if not exists pgcrypto");
        statement.execute("""
                create table carts (
                    id uuid primary key,
                    customer_id uuid,
                    session_id text,
                    status varchar(32) not null,
                    currency varchar(8) not null,
                    subtotal_amount numeric,
                    discount_amount numeric,
                    shipping_amount numeric,
                    fee_amount numeric,
                    total_amount numeric,
                    expires_at timestamptz,
                    created_at timestamptz not null,
                    updated_at timestamptz,
                    version bigint not null default 0
                )
                """);
        statement.execute("""
                create table cart_items (
                    id uuid primary key,
                    cart_id uuid not null references carts(id) on delete cascade,
                    product_id uuid,
                    product_pk text,
                    product_variant_id uuid,
                    product_variant_pk text,
                    assistant_conversation_id uuid,
                    assistant_interaction_id uuid,
                    sku text,
                    product_name text,
                    variant_name text,
                    product_image_id text,
                    product_image_url text,
                    product_image_alt text,
                    product_image_width integer,
                    product_image_height integer,
                    product_image_mime_type text,
                    quantity integer,
                    unit_price numeric,
                    regular_price numeric,
                    sale_price numeric,
                    line_subtotal numeric,
                    line_discount numeric,
                    line_total numeric,
                    metadata jsonb,
                    created_at timestamptz,
                    updated_at timestamptz
                )
                """);
        statement.execute("create table audit_logs (id uuid primary key, created_at timestamptz not null)");
    }

    private void createVariantSchema(Statement statement) throws SQLException {
        statement.execute("create extension if not exists unaccent");
        statement.execute("""
                create table attributes (
                    id text primary key,
                    code text not null,
                    name text not null
                );
                create table attribute_values (
                    id text primary key,
                    attribute_id text not null references attributes(id),
                    slug text not null,
                    label text not null
                );
                create table product_variant_options (
                    id uuid primary key,
                    option_name text not null,
                    option_value text not null,
                    attribute_id text references attributes(id),
                    attribute_value_id text references attribute_values(id)
                )
                """);
    }

    private void executeMigration(Statement statement, String filename) throws SQLException, IOException {
        try (InputStream input = Objects.requireNonNull(getClass().getResourceAsStream("/db/migration/" + filename))) {
            statement.execute(new String(input.readAllBytes(), StandardCharsets.UTF_8));
        }
    }

    private String value(Statement statement, String sql) throws SQLException {
        try (ResultSet results = statement.executeQuery(sql)) {
            results.next();
            return results.getString(1);
        }
    }

    private boolean booleanValue(Statement statement, String sql) throws SQLException {
        try (ResultSet results = statement.executeQuery(sql)) {
            results.next();
            return results.getBoolean(1);
        }
    }
}
