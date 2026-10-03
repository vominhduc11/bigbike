package com.bigbike.bigbike_backend.migration;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.charset.StandardCharsets;
import java.sql.DriverManager;
import org.junit.jupiter.api.Test;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@Testcontainers(disabledWithoutDocker = true)
class RetireBigBikeAssistantMigrationPostgresTest {

    @Container
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

    @Test
    void retiresOnlyAssistantSettingsAndPermissionsWithoutDeletingHistory() throws Exception {
        try (var connection = DriverManager.getConnection(
                postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword());
                var sql = connection.createStatement()) {
            sql.execute("create table site_settings (setting_key text, setting_group text)");
            sql.execute("create table role_permissions (permission text)");
            sql.execute("create table chat_conversations (id integer)");
            sql.execute("insert into site_settings values ('ai_assistant_enabled','ai_assistant'), "
                    + "('ai_assistant_old_key','old_group'), ('hotline','contact'), "
                    + "('review_moderation_enabled','review_moderation')");
            sql.execute("insert into role_permissions values ('chat.read'), ('chat.reply'), "
                    + "('settings.write'), ('reviews.write'), ('*')");
            sql.execute("insert into chat_conversations values (1)");
            try (var input = getClass().getResourceAsStream(
                    "/db/migration/V1093__retire_bigbike_assistant.sql")) {
                sql.execute(new String(input.readAllBytes(), StandardCharsets.UTF_8));
            }
            try (var rows = sql.executeQuery("select count(*) from site_settings")) {
                rows.next(); assertThat(rows.getInt(1)).isEqualTo(2);
            }
            try (var rows = sql.executeQuery("select count(*) from role_permissions")) {
                rows.next(); assertThat(rows.getInt(1)).isEqualTo(3);
            }
            try (var rows = sql.executeQuery("select count(*) from chat_conversations")) {
                rows.next(); assertThat(rows.getInt(1)).isEqualTo(1);
            }
        }
    }
}
