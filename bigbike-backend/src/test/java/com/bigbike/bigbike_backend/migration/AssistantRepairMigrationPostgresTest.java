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

/** Verifies V1051/V1052 against the smallest PostgreSQL schema required by the assistant work. */
@Testcontainers(disabledWithoutDocker = true)
class AssistantRepairMigrationPostgresTest {

    @Container
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

    @Test
    void v1051BackfillsAssistantHistoryAndSeedsSharedOwnerSettings() throws Exception {
        try (Connection connection = connection(); Statement statement = connection.createStatement()) {
            resetSchema(statement);
            createSchema(statement);
            seedHistoryAndSettings(statement);

            executeMigration(statement, "V1051__repair_assistant_and_share_store_policies.sql");

            assertThat(booleanValue(statement, """
                    select exists (
                        select 1 from information_schema.columns
                        where table_name = 'chat_conversations'
                          and column_name = 'lead_offer_request_id'
                    )
                    """)).isTrue();
            assertThat(booleanValue(statement, """
                    select exists (
                        select 1 from information_schema.columns
                        where table_name = 'chat_conversations'
                          and column_name = 'lead_offer_opened_at'
                    )
                    """)).isTrue();
            assertThat(booleanValue(statement, """
                    select lead_offer_opened_at is not null
                    from chat_conversations
                    where id = '00000000-0000-0000-0000-000000001051'
                    """)).isTrue();
            assertThat(value(statement, """
                    select result_kind from chat_messages
                    where id = '00000000-0000-0000-0000-000000001052'
                    """)).isEqualTo("PRODUCT_RESULTS");
            assertThat(integerValue(statement, """
                    select count(*) from site_settings
                    where setting_key in (
                        'policy_warranty_title',
                        'policy_warranty_body_html',
                        'policy_return_exchange_title',
                        'policy_return_exchange_body_html'
                    )
                    """)).isEqualTo(4);
            assertThat(value(statement, """
                    select setting_value from site_settings
                    where setting_key = 'ai_assistant_monthly_cost_warning_usd'
                    """)).isEqualTo("25");
        }
    }

    @Test
    void v1052CreatesSalesHandoffAndAttributionSchema() throws Exception {
        try (Connection connection = connection(); Statement statement = connection.createStatement()) {
            resetSchema(statement);
            createSchema(statement);

            executeMigration(statement, "V1052__professional_sales_assistant.sql");

            assertThat(booleanValue(statement, """
                    select exists (
                        select 1 from information_schema.columns
                        where table_name = 'chat_conversations'
                          and column_name = 'sales_stage'
                    )
                    """)).isTrue();
            assertThat(booleanValue(statement, """
                    select exists (
                        select 1 from information_schema.columns
                        where table_name = 'cart_items'
                          and column_name = 'assistant_attributed_at'
                    )
                    """)).isTrue();
            assertThat(booleanValue(statement, """
                    select exists (
                        select 1 from information_schema.tables
                        where table_name = 'chat_handoff_requests'
                    )
                    """)).isTrue();
            assertThat(integerValue(statement, """
                    select count(*) from site_settings
                    where setting_key in (
                        'ai_assistant_handoff_email_enabled',
                        'ai_assistant_handoff_email_recipient'
                    )
                    """)).isEqualTo(2);

            statement.execute("""
                    insert into chat_conversations (id)
                    values ('00000000-0000-0000-0000-000000001052');
                    insert into chat_interactions (
                        id, conversation_id, interaction_type, product_slug, created_at
                    ) values (
                        '00000000-0000-0000-0000-000000001055',
                        '00000000-0000-0000-0000-000000001052',
                        'PRODUCT_VIEWED', 'mu-a', now()
                    );
                    insert into chat_handoff_requests (
                        request_id, conversation_id, trigger_source, customer_kind
                    ) values (
                        '00000000-0000-0000-0000-000000001056',
                        '00000000-0000-0000-0000-000000001052',
                        'BUTTON', 'GUEST'
                    )
                    """);
            assertThat(integerValue(statement, """
                    select count(*) from chat_handoff_requests where status = 'WAITING'
                    """)).isEqualTo(1);
        }
    }

    private Connection connection() throws SQLException {
        return DriverManager.getConnection(postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword());
    }

    private void resetSchema(Statement statement) throws SQLException {
        statement.execute("drop schema if exists public cascade; create schema public");
    }

    private void createSchema(Statement statement) throws SQLException {
        statement.execute("create extension if not exists pgcrypto");
        statement.execute("""
                create table chat_conversations (
                    id uuid primary key,
                    lead_offer_status varchar(32) not null default 'NONE'
                );
                create table chat_interactions (
                    id uuid primary key,
                    conversation_id uuid not null references chat_conversations(id),
                    interaction_type varchar(64) not null,
                    lead_prompt_sequence integer,
                    action_type varchar(64),
                    created_at timestamptz not null
                );
                create table chat_leads (
                    id uuid primary key,
                    conversation_id uuid not null references chat_conversations(id),
                    created_at timestamptz not null
                );
                create table chat_messages (
                    id uuid primary key,
                    role varchar(32) not null,
                    products_json jsonb,
                    result_kind varchar(64) not null
                );
                create table admin_users (
                    id uuid primary key
                );
                create table cart_items (
                    id uuid primary key
                );
                create table chat_order_attributions (
                    id uuid primary key
                );
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
                )
                """);
    }

    private void seedHistoryAndSettings(Statement statement) throws SQLException {
        statement.execute("""
                insert into chat_conversations (id, lead_offer_status)
                values ('00000000-0000-0000-0000-000000001051', 'OPEN');
                insert into chat_interactions (id, conversation_id, interaction_type, created_at)
                values (
                    '00000000-0000-0000-0000-000000001053',
                    '00000000-0000-0000-0000-000000001051',
                    'LEAD_PROMPT_VIEWED',
                    '2026-08-23T01:00:00Z'
                );
                insert into chat_messages (id, role, products_json, result_kind)
                values (
                    '00000000-0000-0000-0000-000000001052',
                    'ASSISTANT',
                    '[{"slug":"ls2-ff800"}]'::jsonb,
                    'ANSWER'
                );
                insert into site_settings (
                    id, setting_key, setting_value, setting_group,
                    is_public, created_at, updated_at
                ) values (
                    '00000000-0000-0000-0000-000000001054',
                    'ai_assistant_monthly_cost_warning_usd',
                    '0',
                    'ai_assistant',
                    false,
                    now(),
                    now()
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

    private int integerValue(Statement statement, String sql) throws SQLException {
        try (ResultSet results = statement.executeQuery(sql)) {
            results.next();
            return results.getInt(1);
        }
    }

    private boolean booleanValue(Statement statement, String sql) throws SQLException {
        try (ResultSet results = statement.executeQuery(sql)) {
            results.next();
            return results.getBoolean(1);
        }
    }
}
