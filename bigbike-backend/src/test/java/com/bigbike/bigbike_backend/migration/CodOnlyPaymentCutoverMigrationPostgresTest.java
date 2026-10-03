package com.bigbike.bigbike_backend.migration;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.Objects;
import org.junit.jupiter.api.Test;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/** PostgreSQL coverage for the guarded COD-only live data cutover. */
@Testcontainers(disabledWithoutDocker = true)
class CodOnlyPaymentCutoverMigrationPostgresTest {

    @Container
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

    @Test
    void changesOnlyTheTwoNamedOrdersAndRemovesPaymentOnlySettingsAndNotifications() throws Exception {
        try (Connection connection = DriverManager.getConnection(
                postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword());
             Statement statement = connection.createStatement()) {
            createSchema(statement);
            seed(statement);

            executeMigration(statement);

            assertThat(singleString(statement, "select payment_method from orders where order_number = 'BB-20260907-8D3C36'"))
                    .isEqualTo("COD");
            assertThat(singleString(statement, "select payment_method from orders where order_number = 'BB-20260909-471115'"))
                    .isEqualTo("COD");
            assertThat(singleString(statement, "select status from orders where order_number = 'BB-20260907-8D3C36'"))
                    .isEqualTo("PROCESSING");
            assertThat(singleString(statement, "select status from payments where order_id = '10000000-0000-0000-0000-000000000001'"))
                    .isEqualTo("PENDING");
            assertThat(singleString(statement, "select payment_method from payments where order_id = '10000000-0000-0000-0000-000000000001'"))
                    .isEqualTo("COD");
            assertThat(singleLong(statement, "select paid_amount from orders where order_number = 'BB-20260907-8D3C36'"))
                    .isZero();
            assertThat(singleLong(statement, "select count(*) from orders where order_number = 'BB-legacy-bank' and payment_method = 'BANK_TRANSFER'"))
                    .isEqualTo(1);
            assertThat(singleLong(statement, "select count(*) from site_settings where setting_group = 'payment'"))
                    .isZero();
            assertThat(singleLong(statement, "select count(*) from site_settings where setting_key = 'contact_phone'"))
                    .isEqualTo(1);
            assertThat(singleLong(statement, "select count(*) from admin_notifications where type = 'CHAT_BANK_TRANSFER_RECEIPT'"))
                    .isZero();
            assertThat(singleLong(statement, "select count(*) from admin_notifications where type = 'NEW_ORDER'"))
                    .isEqualTo(1);
            assertThat(singleLong(statement, "select count(*) from information_schema.columns where table_name = 'admin_notifications' and column_name = 'chat_message_id'"))
                    .isZero();
        }
    }

    private static void createSchema(Statement statement) throws Exception {
        statement.execute("""
                create table orders (
                    id uuid primary key,
                    order_number varchar(100) unique not null,
                    status varchar(50) not null,
                    payment_method varchar(100),
                    total_amount numeric(19,2) not null,
                    paid_amount numeric(19,2) not null,
                    paid_at timestamptz
                );
                create table payments (
                    id uuid primary key,
                    order_id uuid not null,
                    payment_method varchar(100),
                    status varchar(50) not null,
                    amount numeric(19,2) not null,
                    currency varchar(10) not null,
                    paid_at timestamptz
                );
                create table site_settings (
                    id uuid primary key,
                    setting_key varchar(255) unique not null,
                    setting_group varchar(255),
                    setting_value text
                );
                create table admin_notifications (
                    id uuid primary key,
                    type varchar(100) not null,
                    payload text,
                    chat_message_id uuid
                );
                """);
    }

    private static void seed(Statement statement) throws Exception {
        statement.execute("""
                insert into orders (id, order_number, status, payment_method, total_amount, paid_amount, paid_at) values
                    ('10000000-0000-0000-0000-000000000001', 'BB-20260907-8D3C36', 'PROCESSING', 'BANK_TRANSFER', 5450000, 0, null),
                    ('10000000-0000-0000-0000-000000000002', 'BB-20260909-471115', 'PROCESSING', 'BANK_TRANSFER', 1550000, 0, null),
                    ('10000000-0000-0000-0000-000000000003', 'BB-legacy-bank', 'COMPLETED', 'BANK_TRANSFER', 100000, 100000, now());
                insert into payments (id, order_id, payment_method, status, amount, currency, paid_at) values
                    ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'BANK_TRANSFER', 'PENDING', 5450000, 'VND', null),
                    ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 'BANK_TRANSFER', 'PENDING', 1550000, 'VND', null),
                    ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000003', 'BANK_TRANSFER', 'SUCCEEDED', 100000, 'VND', now());
                insert into site_settings (id, setting_key, setting_group, setting_value) values
                    ('30000000-0000-0000-0000-000000000001', 'bank_account_holder', 'payment', 'BigBike'),
                    ('30000000-0000-0000-0000-000000000002', 'bank_account_number', 'payment', '123'),
                    ('30000000-0000-0000-0000-000000000003', 'bank_name', 'payment', 'Bank'),
                    ('30000000-0000-0000-0000-000000000004', 'bank_branch', 'payment', 'Branch'),
                    ('30000000-0000-0000-0000-000000000005', 'contact_phone', 'contact', '0900000000');
                insert into admin_notifications (id, type, payload, chat_message_id) values
                    ('40000000-0000-0000-0000-000000000001', 'CHAT_BANK_TRANSFER_RECEIPT', '{}', '50000000-0000-0000-0000-000000000001'),
                    ('40000000-0000-0000-0000-000000000002', 'NEW_ORDER', '{}', null);
                """);
    }

    private void executeMigration(Statement statement) throws Exception {
        try (InputStream input = Objects.requireNonNull(getClass().getResourceAsStream(
                "/db/migration/V1083__cod_only_payment_cutover.sql"))) {
            statement.execute(new String(input.readAllBytes(), StandardCharsets.UTF_8));
        }
    }

    private static String singleString(Statement statement, String sql) throws Exception {
        try (ResultSet result = statement.executeQuery(sql)) {
            assertThat(result.next()).isTrue();
            return result.getString(1);
        }
    }

    private static long singleLong(Statement statement, String sql) throws Exception {
        try (ResultSet result = statement.executeQuery(sql)) {
            assertThat(result.next()).isTrue();
            return result.getLong(1);
        }
    }
}
