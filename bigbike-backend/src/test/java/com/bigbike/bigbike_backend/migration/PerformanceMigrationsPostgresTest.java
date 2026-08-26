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

/** Runs the performance and variant-repair migrations against minimal PostgreSQL schemas. */
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

    @Test
    void v1053RepairsOnlyMissingLinksPreservesLegacyTextAndIsIdempotent() throws Exception {
        try (Connection connection = connection(); Statement statement = connection.createStatement()) {
            createV1053VariantSchema(statement);
            statement.execute("insert into attributes (id, code, name, name_en, kind, is_variation) values "
                    + "('iphone', 'iphone', 'Iphone', null, 'select', true), "
                    + "('color', 'color', 'Color', 'Color', 'select', true)");
            statement.execute("insert into attribute_values (id, attribute_id, slug, label, label_en, sort_order) "
                    + "values ('red', 'color', 'red', 'Đỏ', 'Red', 0)");
            statement.execute("insert into product_variant_options "
                    + "(id, option_name, option_value, attribute_id, attribute_value_id) "
                    + "values (200, 'Color', 'Đỏ', 'color', 'red')");
            statement.execute("insert into product_variant_options (id, option_name, option_value) values "
                    + "(201, 'Đời máy', 'iPhone 15 Pro'), "
                    + "(202, 'Size', 'L'), "
                    + "(203, 'Màu', 'Đỏ'), "
                    + "(204, 'Chất liệu', 'Da')");

            executeMigration(statement, "V1053__repair_variant_attribute_links_and_preserve_display.sql");

            assertThat(longValue(statement, "select count(*) from product_variant_options where attribute_id is not null and attribute_value_id is not null"))
                    .isEqualTo(5);
            assertThat(value(statement, "select name from attributes where id = 'iphone'"))
                    .isEqualTo("Đời máy");
            assertThat(value(statement, "select name_en from attributes where id = 'iphone'"))
                    .isEqualTo("Model");
            assertThat(value(statement, "select legacy_display_name from product_variant_options where id = 201"))
                    .isEqualTo("Đời máy");
            assertThat(value(statement, "select legacy_display_value from product_variant_options where id = 201"))
                    .isEqualTo("iPhone 15 Pro");
            assertThat(value(statement, "select attribute_value_id from product_variant_options where id = 203"))
                    .isEqualTo("red");
            assertThat(value(statement, "select attribute_value_id from product_variant_options where id = 200"))
                    .isEqualTo("red");
            assertThat(value(statement, "select legacy_display_value from product_variant_options where id = 200"))
                    .isNull();

            long attributeCount = longValue(statement, "select count(*) from attributes");
            long valueCount = longValue(statement, "select count(*) from attribute_values");
            executeMigration(statement, "V1053__repair_variant_attribute_links_and_preserve_display.sql");
            assertThat(longValue(statement, "select count(*) from attributes")).isEqualTo(attributeCount);
            assertThat(longValue(statement, "select count(*) from attribute_values")).isEqualTo(valueCount);
            assertThat(longValue(statement, "select count(*) from product_variant_options where legacy_display_value is not null"))
                    .isEqualTo(4);
        }
    }

    @Test
    void v1053StopsSafelyWhenAFreeTextRowHasNoAttributeName() throws Exception {
        try (Connection connection = connection(); Statement statement = connection.createStatement()) {
            createV1053VariantSchema(statement);
            statement.execute("insert into product_variant_options (id, option_name, option_value) values (301, '', 'Không rõ')");
            connection.setAutoCommit(false);

            assertThatThrownBy(() -> executeMigration(statement, "V1053__repair_variant_attribute_links_and_preserve_display.sql"))
                    .isInstanceOf(SQLException.class)
                    .hasMessageContaining("V1053 đã dừng an toàn");
            connection.rollback();
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

    private void createV1053VariantSchema(Statement statement) throws SQLException {
        statement.execute("create extension if not exists unaccent");
        statement.execute("""
                create table attributes (
                    id varchar(64) primary key,
                    code varchar(160) not null unique,
                    name varchar(255) not null,
                    name_en varchar(255),
                    kind varchar(32) not null,
                    is_variation boolean not null
                );
                create table attribute_values (
                    id varchar(64) primary key,
                    attribute_id varchar(64) not null references attributes(id),
                    slug varchar(160) not null,
                    label varchar(255) not null,
                    label_en varchar(255),
                    sort_order integer not null,
                    unique (attribute_id, slug)
                );
                create table product_variant_options (
                    id bigint generated by default as identity primary key,
                    option_name varchar(255) not null,
                    option_value varchar(255) not null,
                    attribute_id varchar(64) references attributes(id),
                    attribute_value_id varchar(64) references attribute_values(id)
                );
                """);
    }

    private void executeMigration(Statement statement, String filename) throws SQLException, IOException {
        InputStream resource = getClass().getResourceAsStream("/db/migration/" + filename);
        if (resource == null) {
            resource = getClass().getResourceAsStream("/db/migration-postponed/" + filename);
        }
        try (InputStream input = Objects.requireNonNull(resource, filename)) {
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

    private long longValue(Statement statement, String sql) throws SQLException {
        try (ResultSet results = statement.executeQuery(sql)) {
            results.next();
            return results.getLong(1);
        }
    }
}
