package com.bigbike.bigbike_backend.service.chat;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.LinkedHashSet;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/**
 * Guards the failure that cost customers whole answers: the assistant composed a reply, the
 * database refused the insert because {@code ck_chat_message_source} did not list the value, and
 * the customer got an error screen instead. Nothing caught it, because the default suite runs on
 * H2 with {@code spring.flyway.enabled=false}, so no Flyway CHECK constraint exists there at all.
 *
 * <p>This test therefore runs the real migrations on real PostgreSQL and inserts one row per value
 * {@link ChatMessageSource} declares. If somebody adds a source in Java and forgets the migration
 * — or edits the migration and forgets Java — this fails here instead of in front of a customer.
 * See docs/engineering/DATA_CONTRACT.md ({@code chat_messages}) and BUSINESS_RULES CHAT_RULE_001.
 */
@Testcontainers(disabledWithoutDocker = true)
class ChatMessageSourcePostgresTest {

    private static final String SOURCE_CONSTRAINT_MIGRATION =
            "V1080__chat_message_source_and_session_memory.sql";
    private static final Pattern ALLOWED_IN_MIGRATION = Pattern.compile("'([A-Z_]+)'");

    @Container
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

    @Test
    @DisplayName("every source the assistant can write is accepted by the real chat_messages table")
    void everyDeclaredSourceCanActuallyBeSaved() throws Exception {
        try (Connection connection = connection(); Statement statement = connection.createStatement()) {
            createChatSchema(statement);
            executeMigration(statement, SOURCE_CONSTRAINT_MIGRATION);

            UUID conversationId = UUID.randomUUID();
            statement.execute("insert into chat_conversations (id, visitor_id) values ('"
                    + conversationId + "', null)");

            long sequence = 0;
            for (String source : ChatMessageSource.ALLOWED) {
                long next = ++sequence;
                assertThatCode(() -> statement.execute(
                        "insert into chat_messages"
                                + " (id, conversation_id, role, content, source, sequence_no)"
                                + " values ('" + UUID.randomUUID() + "', '" + conversationId
                                + "', 'ASSISTANT', 'Câu trả lời đã soạn xong.', '" + source
                                + "', " + next + ")"))
                        .as("source %s must be storable; otherwise the customer loses this answer",
                                source)
                        .doesNotThrowAnyException();
            }

            assertThat(integerValue(statement, "select count(*) from chat_messages"))
                    .isEqualTo(ChatMessageSource.ALLOWED.size());
        }
    }

    @Test
    @DisplayName("the Java constants and the database constraint list exactly the same sources")
    void javaConstantsMatchTheMigrationConstraint() throws Exception {
        Set<String> inMigration = new LinkedHashSet<>();
        Matcher matcher = ALLOWED_IN_MIGRATION.matcher(readMigration(SOURCE_CONSTRAINT_MIGRATION));
        while (matcher.find()) inMigration.add(matcher.group(1));

        assertThat(inMigration)
                .as("add a new source to both ChatMessageSource and a new Flyway migration")
                .containsExactlyInAnyOrderElementsOf(ChatMessageSource.ALLOWED);
    }

    @Test
    @DisplayName("a source the constraint does not know is refused at the boundary, not by the database")
    void unknownSourceFailsFastWithAReadableMessage() {
        assertThatCode(() -> ChatMessageSource.require("SOMETHING_NEW"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("SOMETHING_NEW");
    }

    private Connection connection() throws SQLException {
        return DriverManager.getConnection(
                postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword());
    }

    /** The shape V1039 leaves behind, which is what production actually had. */
    private void createChatSchema(Statement statement) throws SQLException {
        statement.execute("""
                create table chat_conversations (
                    id uuid primary key,
                    visitor_id uuid
                );
                create table chat_visitors (
                    id uuid primary key,
                    token_hash varchar(64) not null unique,
                    memory_enabled boolean not null default true,
                    last_seen_at timestamptz not null default now(),
                    remembered_until timestamptz not null default now() + interval '30 days',
                    created_at timestamptz not null default now()
                );
                create table chat_messages (
                    id uuid primary key,
                    conversation_id uuid not null references chat_conversations(id) on delete cascade,
                    role varchar(16) not null,
                    content text not null,
                    source varchar(24) not null,
                    sequence_no bigint not null,
                    created_at timestamptz not null default now(),
                    constraint ck_chat_message_source check (source in (
                        'AI', 'TEMPLATE', 'TOOL', 'CONTACT_FALLBACK',
                        'OUT_OF_SCOPE', 'CONTENT_REFUSAL', 'ROLE_DEFENSE'
                    ))
                );
                """);
    }

    private void executeMigration(Statement statement, String filename) throws SQLException, IOException {
        statement.execute(readMigration(filename));
    }

    private String readMigration(String filename) throws IOException {
        try (InputStream input = Objects.requireNonNull(
                getClass().getResourceAsStream("/db/migration/" + filename),
                "missing migration " + filename)) {
            return new String(input.readAllBytes(), StandardCharsets.UTF_8);
        }
    }

    private int integerValue(Statement statement, String sql) throws SQLException {
        try (ResultSet results = statement.executeQuery(sql)) {
            results.next();
            return results.getInt(1);
        }
    }
}
