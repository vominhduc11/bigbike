package com.bigbike.bigbike_backend.migration;

import static org.assertj.core.api.Assertions.assertThat;

import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.Statement;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.datasource.init.ScriptUtils;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@Testcontainers(disabledWithoutDocker = true)
class RbacPermissionDependencyMigrationTest {

    @Container
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

    @BeforeEach
    void createMinimalRoleSchema() throws Exception {
        try (Connection connection = postgres.createConnection("");
             Statement statement = connection.createStatement()) {
            statement.execute("""
                    DROP SCHEMA public CASCADE;
                    CREATE SCHEMA public;
                    CREATE TABLE admin_roles (
                        id varchar(50) PRIMARY KEY
                    );
                    CREATE TABLE role_permissions (
                        role_id varchar(50) NOT NULL REFERENCES admin_roles(id),
                        permission varchar(120) NOT NULL,
                        PRIMARY KEY (role_id, permission)
                    );
                    """);
        }
    }

    @Test
    void migrationsRunWithOnlyAdminAndSuperAdmin() throws Exception {
        try (Connection connection = postgres.createConnection("")) {
            execute(connection, """
                    INSERT INTO admin_roles (id) VALUES ('ADMIN'), ('SUPER_ADMIN');
                    INSERT INTO role_permissions (role_id, permission) VALUES
                      ('ADMIN', 'products.read'),
                      ('ADMIN', 'settings.write'),
                      ('SUPER_ADMIN', '*');
                    """);

            migrate365And366(connection);

            assertThat(hasGrant(connection, "ADMIN", "inventory.read")).isTrue();
            assertThat(hasGrant(connection, "ADMIN", "settings.read")).isTrue();
            assertThat(grantCount(connection, "SUPER_ADMIN")).isEqualTo(1);
            assertThat(dependencyViolationCount(connection)).isZero();
        }
    }

    @Test
    void migrationsRunWhenHistoricalRolesExist() throws Exception {
        try (Connection connection = postgres.createConnection("")) {
            execute(connection, """
                    INSERT INTO admin_roles (id)
                    VALUES ('ADMIN'), ('SUPER_ADMIN'), ('SHOP_MANAGER'), ('EDITOR');
                    INSERT INTO role_permissions (role_id, permission)
                    VALUES ('SUPER_ADMIN', '*');
                    """);

            migrate365And366(connection);

            for (String role : new String[] {"ADMIN", "SHOP_MANAGER", "EDITOR"}) {
                assertThat(hasGrant(connection, role, "products.read")).isTrue();
                assertThat(hasGrant(connection, role, "inventory.read")).isTrue();
            }
            assertThat(dependencyViolationCount(connection)).isZero();
        }
    }

    @Test
    void v366ClosesCustomRoleDependenciesWithoutCreatingNamedRoles() throws Exception {
        try (Connection connection = postgres.createConnection("")) {
            execute(connection, """
                    INSERT INTO admin_roles (id) VALUES ('ADMIN'), ('SUPER_ADMIN'), ('CUSTOM_EDITOR');
                    INSERT INTO role_permissions (role_id, permission) VALUES
                      ('SUPER_ADMIN', '*'),
                      ('CUSTOM_EDITOR', 'products.update'),
                      ('CUSTOM_EDITOR', 'home_highlights.write'),
                      ('CUSTOM_EDITOR', 'admin-users.write'),
                      ('CUSTOM_EDITOR', 'reports.export');
                    """);

            migrate365And366(connection);

            assertThat(roleExists(connection, "SHOP_MANAGER")).isFalse();
            assertThat(roleExists(connection, "EDITOR")).isFalse();
            assertThat(grants(connection, "CUSTOM_EDITOR"))
                    .contains(
                            "products.read",
                            "catalog.read",
                            "home_highlights.read",
                            "admin-users.read",
                            "roles.read",
                            "reports.read");
            assertThat(dependencyViolationCount(connection)).isZero();
        }
    }

    @Test
    void v366IsIdempotentAndDoesNotExpandWildcard() throws Exception {
        try (Connection connection = postgres.createConnection("")) {
            execute(connection, """
                    INSERT INTO admin_roles (id) VALUES ('ADMIN'), ('SUPER_ADMIN'), ('CUSTOM');
                    INSERT INTO role_permissions (role_id, permission) VALUES
                      ('SUPER_ADMIN', '*'),
                      ('CUSTOM', 'orders.write');
                    """);

            migrate365And366(connection);
            int grantsAfterFirstRun = totalGrantCount(connection);
            migrate366(connection);

            assertThat(totalGrantCount(connection)).isEqualTo(grantsAfterFirstRun);
            assertThat(grants(connection, "CUSTOM")).containsExactlyInAnyOrder(
                    "orders.write", "orders.read");
            assertThat(grants(connection, "SUPER_ADMIN")).containsExactly("*");
            assertThat(dependencyViolationCount(connection)).isZero();
        }
    }

    private void migrate365And366(Connection connection) {
        ScriptUtils.executeSqlScript(
                connection,
                new ClassPathResource("db/migration/V365__restore_inventory_read_permissions.sql"));
        migrate366(connection);
    }

    private void migrate366(Connection connection) {
        ScriptUtils.executeSqlScript(
                connection,
                new ClassPathResource("db/migration/V366__backfill_permission_dependencies.sql"));
    }

    private int dependencyViolationCount(Connection connection) throws Exception {
        return intValue(connection, """
                WITH dependencies(permission, required_permission) AS (
                    VALUES
                      ('orders.write', 'orders.read'),
                      ('customers.write', 'customers.read'),
                      ('reviews.write', 'reviews.read'),
                      ('products.update', 'products.read'),
                      ('products.update', 'catalog.read'),
                      ('catalog.update', 'catalog.read'),
                      ('content.update', 'content.read'),
                      ('media.write', 'media.read'),
                      ('menus.write', 'menus.read'),
                      ('sliders.write', 'sliders.read'),
                      ('home_videos.write', 'home_videos.read'),
                      ('home_highlights.write', 'home_highlights.read'),
                      ('home_highlights.write', 'products.read'),
                      ('redirects.write', 'redirects.read'),
                      ('settings.write', 'settings.read'),
                      ('admin-users.write', 'admin-users.read'),
                      ('admin-users.write', 'roles.read'),
                      ('roles.write', 'roles.read'),
                      ('reports.export', 'reports.read')
                )
                SELECT count(*)
                FROM admin_roles role
                JOIN role_permissions selected ON selected.role_id = role.id
                JOIN dependencies dependency ON dependency.permission = selected.permission
                WHERE NOT EXISTS (
                    SELECT 1 FROM role_permissions wildcard
                    WHERE wildcard.role_id = role.id AND wildcard.permission = '*'
                )
                AND NOT EXISTS (
                    SELECT 1 FROM role_permissions required
                    WHERE required.role_id = role.id
                      AND required.permission = dependency.required_permission
                )
                """);
    }

    private boolean hasGrant(Connection connection, String role, String permission) throws Exception {
        return intValue(connection, """
                SELECT count(*) FROM role_permissions
                WHERE role_id = '%s' AND permission = '%s'
                """.formatted(role, permission)) == 1;
    }

    private boolean roleExists(Connection connection, String role) throws Exception {
        return intValue(connection,
                "SELECT count(*) FROM admin_roles WHERE id = '" + role + "'") == 1;
    }

    private int grantCount(Connection connection, String role) throws Exception {
        return intValue(connection,
                "SELECT count(*) FROM role_permissions WHERE role_id = '" + role + "'");
    }

    private int totalGrantCount(Connection connection) throws Exception {
        return intValue(connection, "SELECT count(*) FROM role_permissions");
    }

    private java.util.List<String> grants(Connection connection, String role)
            throws Exception {
        java.util.List<String> values = new java.util.ArrayList<>();
        try (Statement statement = connection.createStatement();
             ResultSet result = statement.executeQuery("""
                     SELECT permission FROM role_permissions
                     WHERE role_id = '%s'
                     ORDER BY permission
                     """.formatted(role))) {
            while (result.next()) {
                values.add(result.getString(1));
            }
        }
        return values;
    }

    private int intValue(Connection connection, String sql) throws Exception {
        try (Statement statement = connection.createStatement();
             ResultSet result = statement.executeQuery(sql)) {
            assertThat(result.next()).isTrue();
            return result.getInt(1);
        }
    }

    private void execute(Connection connection, String sql) throws Exception {
        try (Statement statement = connection.createStatement()) {
            statement.execute(sql);
        }
    }
}
