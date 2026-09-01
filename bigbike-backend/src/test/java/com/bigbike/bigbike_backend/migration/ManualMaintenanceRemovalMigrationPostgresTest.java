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

/** Verifies the forward-only removal of the manual admin maintenance lock. */
@Testcontainers(disabledWithoutDocker = true)
class ManualMaintenanceRemovalMigrationPostgresTest {

    private static final String TECHNICAL_ACCOUNT = "vominhduc760@gmail.com";

    @Container
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

    @Test
    void movesTechnicalAccountBeforeRemovingDeveloperDataAndKeepsUnrelatedData() throws Exception {
        try (Connection connection = connection(); Statement statement = connection.createStatement()) {
            createSchema(statement);
            seedData(statement);

            executeMigration(statement);

            assertThat(value(statement,
                    "select role from admin_users where email = '" + TECHNICAL_ACCOUNT + "'"))
                    .isEqualTo("ADMIN");
            assertThat(longValue(statement,
                    "select access_version from admin_users where email = '" + TECHNICAL_ACCOUNT + "'"))
                    .isEqualTo(1L);
            assertThat(longValue(statement,
                    "select count(*) from admin_users where role = 'DEVELOPER'"))
                    .isZero();
            assertThat(longValue(statement,
                    "select count(*) from admin_user_roles where role = 'DEVELOPER'"))
                    .isZero();
            assertThat(longValue(statement,
                    "select count(*) from admin_user_roles "
                            + "where admin_user_id = '00000000-0000-0000-0000-000000000001' "
                            + "and role = 'ADMIN'"))
                    .isEqualTo(1L);
            assertThat(longValue(statement,
                    "select count(*) from admin_roles where id = 'DEVELOPER'"))
                    .isZero();
            assertThat(longValue(statement,
                    "select count(*) from role_permissions where role_id = 'DEVELOPER'"))
                    .isZero();
            assertThat(longValue(statement,
                    "select count(*) from information_schema.tables "
                            + "where table_schema = 'public' and table_name = 'maintenance_state'"))
                    .isZero();
            assertThat(longValue(statement,
                    "select count(*) from site_settings where setting_key in "
                            + "('maintenance_mode', 'maintenance_notice_enabled', "
                            + "'maintenance_orders_paused', 'maintenance_notice_content', "
                            + "'maintenance_expected_at')"))
                    .isZero();

            assertThat(longValue(statement,
                    "select count(*) from admin_roles where id = 'ADMIN'"))
                    .isEqualTo(1L);
            assertThat(longValue(statement,
                    "select count(*) from role_permissions "
                            + "where role_id = 'ADMIN' and permission = 'orders.write'"))
                    .isEqualTo(1L);
            assertThat(longValue(statement,
                    "select count(*) from site_settings where setting_key = 'unrelated_setting'"))
                    .isEqualTo(1L);
            assertThat(longValue(statement, "select count(*) from orders"))
                    .isEqualTo(1L);
        }
    }

    @Test
    void allowsFreshDatabaseWithoutProductionTechnicalAccount() throws Exception {
        try (Connection connection = connection(); Statement statement = connection.createStatement()) {
            createSchema(statement);
            statement.execute("""
                    insert into admin_roles (id, name, is_system)
                    values
                        ('ADMIN', 'Admin', true),
                        ('DEVELOPER', 'Developer', true);
                    insert into role_permissions (role_id, permission)
                    values ('DEVELOPER', 'maintenance.manage');
                    insert into maintenance_state (id, state) values (1, 'NORMAL');
                    """);

            executeMigration(statement);

            assertThat(longValue(statement,
                    "select count(*) from admin_users where email = '" + TECHNICAL_ACCOUNT + "'"))
                    .isZero();
            assertThat(longValue(statement,
                    "select count(*) from admin_roles where id = 'DEVELOPER'"))
                    .isZero();
            assertThat(longValue(statement,
                    "select count(*) from information_schema.tables "
                            + "where table_schema = 'public' and table_name = 'maintenance_state'"))
                    .isZero();
        }
    }

    private Connection connection() throws SQLException {
        return DriverManager.getConnection(
                postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword());
    }

    private void createSchema(Statement statement) throws SQLException {
        statement.execute("drop schema public cascade; create schema public");
        statement.execute("""
                create table admin_users (
                    id uuid primary key,
                    email varchar(255) not null,
                    role varchar(50) not null,
                    access_version bigint not null default 0,
                    updated_at timestamptz not null default now()
                );
                create table admin_user_roles (
                    admin_user_id uuid not null references admin_users(id) on delete cascade,
                    role varchar(50) not null,
                    primary key (admin_user_id, role)
                );
                create table admin_roles (
                    id varchar(50) primary key,
                    name varchar(100) not null,
                    description text,
                    is_system boolean not null default false,
                    created_at timestamptz not null default now(),
                    updated_at timestamptz not null default now()
                );
                create table role_permissions (
                    role_id varchar(50) not null references admin_roles(id) on delete cascade,
                    permission varchar(100) not null,
                    primary key (role_id, permission)
                );
                create table site_settings (
                    id uuid primary key,
                    setting_key varchar(160) not null unique
                );
                create table maintenance_state (
                    id smallint primary key default 1 check (id = 1),
                    state varchar(16) not null default 'NORMAL',
                    staff_note text,
                    updated_at timestamptz not null default now()
                );
                create table orders (id bigint primary key);
                """);
    }

    private void seedData(Statement statement) throws SQLException {
        statement.execute("""
                insert into admin_users (id, email, role)
                values
                    ('00000000-0000-0000-0000-000000000001', 'vominhduc760@gmail.com', 'DEVELOPER'),
                    ('00000000-0000-0000-0000-000000000002', 'stale-developer@bigbike.test', 'DEVELOPER');
                insert into admin_user_roles (admin_user_id, role)
                values
                    ('00000000-0000-0000-0000-000000000001', 'DEVELOPER'),
                    ('00000000-0000-0000-0000-000000000001', 'ADMIN'),
                    ('00000000-0000-0000-0000-000000000002', 'DEVELOPER');
                insert into admin_roles (id, name, is_system)
                values
                    ('ADMIN', 'Admin', true),
                    ('DEVELOPER', 'Developer', true),
                    ('CUSTOM_ROLE', 'Custom role', false);
                insert into role_permissions (role_id, permission)
                values
                    ('ADMIN', 'orders.write'),
                    ('DEVELOPER', 'maintenance.manage'),
                    ('CUSTOM_ROLE', 'products.read');
                insert into site_settings (id, setting_key)
                values
                    ('00000000-0000-0000-0000-000000001071', 'maintenance_mode'),
                    ('00000000-0000-0000-0000-000000001072', 'maintenance_notice_enabled'),
                    ('00000000-0000-0000-0000-000000001073', 'maintenance_orders_paused'),
                    ('00000000-0000-0000-0000-000000001074', 'maintenance_notice_content'),
                    ('00000000-0000-0000-0000-000000001075', 'maintenance_expected_at'),
                    ('00000000-0000-0000-0000-000000001076', 'unrelated_setting');
                insert into maintenance_state (id, state) values (1, 'NORMAL');
                insert into orders (id) values (1);
                """);
    }

    private void executeMigration(Statement statement) throws SQLException, IOException {
        try (InputStream input = Objects.requireNonNull(
                getClass().getResourceAsStream(
                        "/db/migration/V1071__remove_manual_admin_maintenance.sql"))) {
            statement.execute(new String(input.readAllBytes(), StandardCharsets.UTF_8));
        }
    }

    private String value(Statement statement, String sql) throws SQLException {
        try (ResultSet results = statement.executeQuery(sql)) {
            results.next();
            return results.getString(1);
        }
    }

    private long longValue(Statement statement, String sql) throws SQLException {
        try (ResultSet results = statement.executeQuery(sql)) {
            results.next();
            return results.getLong(1);
        }
    }
}
