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

/** Verifies the two-level media-folder tree and removal of obsolete one-time audit tables. */
@Testcontainers(disabledWithoutDocker = true)
class MediaFolderTreeMigrationPostgresTest {

    @Container
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

    @Test
    void seedsFolderTreeAddsIllustrationsAndRemovesObsoleteAuditTables() throws Exception {
        try (Connection connection = connection(); Statement statement = connection.createStatement()) {
            createLegacySchema(statement);
            seedLegacyFolders(statement);

            executeMigration(statement, "V1075__media_folder_tree_and_organization.sql");
            executeMigration(statement, "V1076__add_media_illustrations_folder.sql");
            executeMigration(statement, "V1077__remove_media_organization_tool.sql");

            assertThat(integerValue(statement, "select count(*) from media_folders")).isEqualTo(34);
            assertThat(integerValue(statement,
                    "select count(*) from media_folders where system_key like 'products:%'"))
                    .isEqualTo(20);
            assertThat(integerValue(statement,
                    "select count(*) from media_folders where system_key like 'articles:%'"))
                    .isEqualTo(7);
            assertThat(value(statement,
                    "select name from media_folders where id = '00000000-0000-0000-0000-000000000001'"))
                    .isEqualTo("KEWIG");
            assertThat(value(statement,
                    "select system_key from media_folders where id = '00000000-0000-0000-0000-000000000001'"))
                    .isEqualTo("products:kewig");
            assertThat(value(statement,
                    "select name from media_folders where system_key = 'root:illustrations'"))
                    .isEqualTo("Ảnh minh hoạ");
            assertThat(value(statement, "select to_regclass('public.media_organization_runs')")).isNull();
            assertThat(value(statement, "select to_regclass('public.media_organization_items')")).isNull();
            assertThat(integerValue(statement, "select count(*) from media where folder_id is null")).isEqualTo(1);
        }
    }

    private Connection connection() throws SQLException {
        return DriverManager.getConnection(postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword());
    }

    private void createLegacySchema(Statement statement) throws SQLException {
        statement.execute("""
                create table media_folders (
                    id uuid primary key default gen_random_uuid(),
                    name varchar(120) not null,
                    slug varchar(160) not null unique,
                    description text,
                    created_at timestamptz not null default now(),
                    updated_at timestamptz not null default now()
                );
                create table media (
                    id uuid primary key,
                    folder_id uuid
                );
                """);
    }

    private void seedLegacyFolders(Statement statement) throws SQLException {
        statement.execute("""
                insert into media_folders (id, name, slug)
                values
                    ('00000000-0000-0000-0000-000000000001', 'Giá đỡ điện thoại', 'm36-c1s'),
                    ('00000000-0000-0000-0000-000000000002', 'SCS', 's10x');
                insert into media (id, folder_id)
                values ('00000000-0000-0000-0000-000000000010', null);
                """);
    }

    private void executeMigration(Statement statement, String filename) throws SQLException, IOException {
        try (InputStream input = Objects.requireNonNull(
                getClass().getResourceAsStream("/db/migration/" + filename))) {
            statement.execute(new String(input.readAllBytes(), StandardCharsets.UTF_8));
        }
    }

    private String value(Statement statement, String sql) throws SQLException {
        try (ResultSet results = statement.executeQuery(sql)) {
            results.next();
            return results.getString(1);
        }
    }

    private int integerValue(Statement statement, String sql) throws SQLException {
        try (ResultSet results = statement.executeQuery(sql)) {
            results.next();
            return results.getInt(1);
        }
    }
}
