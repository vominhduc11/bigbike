package com.bigbike.bigbike_backend.migration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

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

/** PostgreSQL proof for the phase-4 cost, evaluation, private-image and fingerprint schema. */
@Testcontainers(disabledWithoutDocker = true)
class AssistantStage4MigrationPostgresTest {

    @Container
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

    @Test
    void v1061UsesTheCatalogStringKeyAndEnforcesPrivateImageLimits() throws Exception {
        try (Connection connection = DriverManager.getConnection(
                postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword());
             Statement statement = connection.createStatement()) {
            statement.execute("drop schema if exists public cascade; create schema public");
            statement.execute("create extension if not exists pgcrypto");
            statement.execute("""
                    create table admin_users (id uuid primary key);
                    create table chat_conversations (id uuid primary key);
                    create table chat_messages (
                        id uuid primary key,
                        conversation_id uuid references chat_conversations(id),
                        role varchar(32),
                        ai_called boolean not null default false,
                        created_at timestamptz not null default now()
                    );
                    create table products (id varchar(64) primary key);
                    create table media (id uuid primary key);
                    create table site_settings (
                        id uuid primary key,
                        setting_key varchar(160) not null unique,
                        setting_value text,
                        setting_value_en text,
                        setting_group varchar(80) not null,
                        is_public boolean not null,
                        description text,
                        created_at timestamptz not null,
                        updated_at timestamptz not null
                    );
                    """);

            try (InputStream input = Objects.requireNonNull(getClass().getResourceAsStream(
                    "/db/migration/V1061__assistant_model_quality_and_private_images.sql"))) {
                statement.execute(new String(input.readAllBytes(), StandardCharsets.UTF_8));
            }

            assertThat(columnType(statement, "chat_product_image_fingerprints", "product_id"))
                    .isEqualTo("character varying");
            assertThat(integerValue(statement, """
                    select count(*) from site_settings
                    where setting_key in (
                        'ai_assistant_model', 'ai_assistant_image_enabled',
                        'ai_assistant_image_daily_limit',
                        'ai_assistant_image_conversation_limit'
                    )
                    """)).isEqualTo(4);
            assertThat(value(statement, """
                    select setting_value from site_settings
                    where setting_key = 'ai_assistant_image_enabled'
                    """)).isEqualTo("false");

            statement.execute("""
                    insert into products(id) values ('product-1');
                    insert into chat_product_image_fingerprints(
                        product_id, image_ref, source_version_hash, fingerprint_version,
                        dhash_hex, color_histogram, aspect_ratio
                    ) values (
                        'product-1', 'products/one.jpg', repeat('a', 64), 'local-visual-v1',
                        '0123456789abcdef', '0.25,0.25,0.25,0.25', 1.25
                    );
                    """);
            assertThat(integerValue(statement,
                    "select count(*) from chat_product_image_fingerprints")).isEqualTo(1);

            assertThatThrownBy(() -> statement.execute("""
                    insert into chat_image_daily_usage(usage_date, used_count)
                    values (current_date, -1)
                    """)).isInstanceOf(SQLException.class);
            assertThatThrownBy(() -> statement.execute("""
                    insert into chat_ai_usage_events(
                        category, model_id, requested_model, price_effective_from
                    ) values ('MADE_UP', 'gemini-test', 'gemini-test', current_date)
                    """)).isInstanceOf(SQLException.class);
        }
    }

    private static String columnType(Statement statement, String table, String column)
            throws SQLException {
        return value(statement, "select data_type from information_schema.columns where table_name='"
                + table + "' and column_name='" + column + "'");
    }

    private static String value(Statement statement, String sql) throws SQLException {
        try (ResultSet result = statement.executeQuery(sql)) {
            result.next();
            return result.getString(1);
        }
    }

    private static int integerValue(Statement statement, String sql) throws SQLException {
        try (ResultSet result = statement.executeQuery(sql)) {
            result.next();
            return result.getInt(1);
        }
    }
}
