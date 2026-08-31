package com.bigbike.bigbike_backend.migration;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.Statement;
import java.sql.Timestamp;
import java.util.Objects;
import org.junit.jupiter.api.Test;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/** PostgreSQL coverage for the age markers, private settings and daily de-duplication ledger. */
@Testcontainers(disabledWithoutDocker = true)
class DailyOutOfStockDigestMigrationPostgresTest {

    @Container
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

    @Test
    void tracksAgeWithoutChangingTheExistingAvailabilityState() throws Exception {
        try (Connection connection = DriverManager.getConnection(
                postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword());
             Statement statement = connection.createStatement()) {
            createMinimalPreMigrationSchema(statement);
            seedExistingAvailability(statement);
            executeMigration(statement);

            assertThat(singleBoolean(statement,
                    "select out_of_stock_since_estimated from products where id = 'existing-out'"))
                    .isTrue();
            assertThat(singleTimestamp(statement,
                    "select out_of_stock_since from products where id = 'existing-out'"))
                    .isNotNull();
            assertThat(singleBoolean(statement,
                    "select out_of_stock_since_estimated from product_variants "
                            + "where id = 'existing-variant-out'"))
                    .isTrue();

            assertThat(singleString(statement,
                    "select setting_value from site_settings "
                            + "where setting_key = 'inventory_out_of_stock_digest_enabled'"))
                    .isEqualTo("true");
            assertThat(singleString(statement,
                    "select setting_value from site_settings "
                            + "where setting_key = 'inventory_out_of_stock_digest_time'"))
                    .isEqualTo("08:00");

            statement.executeUpdate(
                    "update products set stock_state = 'OUT_OF_STOCK' where id = 'future-product'");
            Timestamp productStart = singleTimestamp(statement,
                    "select out_of_stock_since from products where id = 'future-product'");
            assertThat(productStart).isNotNull();
            assertThat(singleBoolean(statement,
                    "select out_of_stock_since_estimated from products where id = 'future-product'"))
                    .isFalse();
            statement.executeUpdate(
                    "update products set stock_state = 'OUT_OF_STOCK' where id = 'future-product'");
            assertThat(singleTimestamp(statement,
                    "select out_of_stock_since from products where id = 'future-product'"))
                    .isEqualTo(productStart);
            statement.executeUpdate(
                    "update products set stock_state = 'IN_STOCK' where id = 'future-product'");
            assertThat(singleTimestamp(statement,
                    "select out_of_stock_since from products where id = 'future-product'"))
                    .isNull();

            statement.executeUpdate(
                    "update product_variants set is_available = false where id = 'future-variant'");
            Timestamp variantStart = singleTimestamp(statement,
                    "select out_of_stock_since from product_variants where id = 'future-variant'");
            assertThat(variantStart).isNotNull();
            assertThat(singleBoolean(statement,
                    "select out_of_stock_since_estimated from product_variants "
                            + "where id = 'future-variant'"))
                    .isFalse();
            statement.executeUpdate(
                    "update product_variants set is_available = false where id = 'future-variant'");
            assertThat(singleTimestamp(statement,
                    "select out_of_stock_since from product_variants where id = 'future-variant'"))
                    .isEqualTo(variantStart);
            statement.executeUpdate(
                    "update product_variants set is_available = true where id = 'future-variant'");
            assertThat(singleTimestamp(statement,
                    "select out_of_stock_since from product_variants where id = 'future-variant'"))
                    .isNull();

            assertThat(statement.executeUpdate("""
                    insert into inventory_out_of_stock_digest_runs
                        (digest_date, outcome, created_at)
                    values ('2026-08-31', 'EMPTY', now())
                    on conflict (digest_date) do nothing
                    """)).isEqualTo(1);
            assertThat(statement.executeUpdate("""
                    insert into inventory_out_of_stock_digest_runs
                        (digest_date, outcome, created_at)
                    values ('2026-08-31', 'NOTIFIED', now())
                    on conflict (digest_date) do nothing
                    """)).isZero();

            assertThat(singleString(statement,
                    "select stock_state from products where id = 'existing-out'"))
                    .isEqualTo("OUT_OF_STOCK");
            assertThat(singleBoolean(statement,
                    "select is_available from product_variants where id = 'existing-variant-out'"))
                    .isFalse();
        }
    }

    private static void createMinimalPreMigrationSchema(Statement statement) throws Exception {
        statement.execute("""
                create table products (
                    id varchar(255) primary key,
                    stock_state varchar(32) not null
                );
                create table product_variants (
                    id varchar(255) primary key,
                    product_id varchar(255) not null,
                    is_available boolean not null
                );
                create table admin_notifications (
                    id uuid primary key
                );
                create table site_settings (
                    id uuid primary key,
                    setting_key varchar(255) not null unique,
                    setting_value text,
                    setting_group varchar(255),
                    is_public boolean not null,
                    description text,
                    created_at timestamptz not null,
                    updated_at timestamptz not null
                )
                """);
    }

    private static void seedExistingAvailability(Statement statement) throws Exception {
        statement.execute("""
                insert into products (id, stock_state) values
                    ('existing-out', 'OUT_OF_STOCK'),
                    ('future-product', 'IN_STOCK');
                insert into product_variants (id, product_id, is_available) values
                    ('existing-variant-out', 'existing-out', false),
                    ('future-variant', 'future-product', true)
                """);
    }

    private void executeMigration(Statement statement) throws Exception {
        try (InputStream input = Objects.requireNonNull(getClass().getResourceAsStream(
                "/db/migration/V1072__daily_out_of_stock_digest.sql"))) {
            statement.execute(new String(input.readAllBytes(), StandardCharsets.UTF_8));
        }
    }

    private static String singleString(Statement statement, String sql) throws Exception {
        try (ResultSet result = statement.executeQuery(sql)) {
            assertThat(result.next()).isTrue();
            return result.getString(1);
        }
    }

    private static boolean singleBoolean(Statement statement, String sql) throws Exception {
        try (ResultSet result = statement.executeQuery(sql)) {
            assertThat(result.next()).isTrue();
            return result.getBoolean(1);
        }
    }

    private static Timestamp singleTimestamp(Statement statement, String sql) throws Exception {
        try (ResultSet result = statement.executeQuery(sql)) {
            assertThat(result.next()).isTrue();
            return result.getTimestamp(1);
        }
    }
}
