package com.bigbike.bigbike_backend.service.chat;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.nullable;
import static org.mockito.Mockito.reset;
import static org.mockito.Mockito.when;

import com.bigbike.bigbike_backend.api.chat.dto.ChatContactResponse;
import com.bigbike.bigbike_backend.api.chat.dto.ChatMessageRequest;
import com.bigbike.bigbike_backend.api.chat.dto.ChatMessageResponse;
import com.bigbike.bigbike_backend.persistence.entity.chat.ChatConversationEntity;
import com.bigbike.bigbike_backend.persistence.entity.chat.ChatMessageEntity;
import com.bigbike.bigbike_backend.persistence.repository.chat.ChatConversationJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.chat.ChatMessageJpaRepository;
import java.sql.Date;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

@SpringBootTest
class ChatConcurrencyTest {

    private static final ZoneId VN_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
    private static final UUID FIRST_ID = UUID.fromString("61111111-1111-4111-8111-111111111111");
    private static final UUID SECOND_ID = UUID.fromString("62222222-2222-4222-8222-222222222222");

    @Autowired private ChatService chatService;
    @Autowired private ChatAiQuotaService quotaService;
    @Autowired private ChatConversationJpaRepository conversationRepo;
    @Autowired private ChatMessageJpaRepository messageRepo;
    @Autowired private JdbcTemplate jdbcTemplate;

    @MockitoBean private ChatAssistantSettings assistantSettings;
    @MockitoBean private ChatToolService toolService;
    @MockitoBean private AiChatClient aiChatClient;

    @BeforeEach
    void setUp() {
        reset(assistantSettings, toolService, aiChatClient);
        deleteFixtureData();
        when(assistantSettings.load(anyString())).thenAnswer(invocation -> settings(invocation.getArgument(0)));
        when(aiChatClient.isConfigured()).thenReturn(true);
        when(toolService.resolveFastPath(
                anyString(), anyString(), nullable(UUID.class), any(), any()))
                .thenReturn(Optional.empty());
        when(toolService.assistantCatalogVocabulary())
                .thenReturn(ChatToolService.AssistantCatalogVocabulary.empty());
        when(toolService.recordConversationContext(
                any(), anyString(), anyString(), any(), any(), any()))
                .thenReturn(ChatToolService.ConversationContext.empty());
    }

    @AfterEach
    void cleanUp() {
        deleteFixtureData();
    }

    @Test
    @DisplayName("two customer conversations reach the provider together without sharing turns")
    void differentConversationsRunConcurrentlyWithoutCrossTalk() throws Exception {
        saveConversation(FIRST_ID);
        saveConversation(SECOND_ID);
        CountDownLatch bothEnteredProvider = new CountDownLatch(2);
        CountDownLatch releaseProvider = new CountDownLatch(1);
        when(aiChatClient.answer(
                anyString(), anyString(), any(ChatToolRegistry.class), anyBoolean(),
                any(AiChatClient.ToolExecutor.class),
                any(ChatToolService.AssistantCatalogVocabulary.class), any(), any()))
                .thenAnswer(invocation -> {
                    String question = invocation.getArgument(0);
                    bothEnteredProvider.countDown();
                    if (!releaseProvider.await(5, TimeUnit.SECONDS)) {
                        throw new IllegalStateException("Concurrent provider barrier timed out");
                    }
                    return Optional.of(answerFor(question));
                });

        ExecutorService executor = Executors.newFixedThreadPool(2);
        try {
            CompletableFuture<ChatMessageResponse> first = CompletableFuture.supplyAsync(
                    () -> chatService.send(request(FIRST_ID, "alpha request"), null), executor);
            CompletableFuture<ChatMessageResponse> second = CompletableFuture.supplyAsync(
                    () -> chatService.send(request(SECOND_ID, "beta request"), null), executor);

            assertThat(bothEnteredProvider.await(5, TimeUnit.SECONDS))
                    .as("both conversations should reach the provider before either is released")
                    .isTrue();
            releaseProvider.countDown();

            assertThat(first.get(5, TimeUnit.SECONDS).answer()).contains("alpha request");
            assertThat(second.get(5, TimeUnit.SECONDS).answer()).contains("beta request");
        } finally {
            releaseProvider.countDown();
            executor.shutdownNow();
        }

        assertConversationIsolated(FIRST_ID, "alpha request", "beta request");
        assertConversationIsolated(SECOND_ID, "beta request", "alpha request");
        assertThat(quotaService.usedToday()).isEqualTo(2L);
    }

    @Test
    @DisplayName("the daily AI ceiling remains exact under concurrent reservations")
    void concurrentReservationsNeverExceedTheDailyLimit() throws Exception {
        int dailyLimit = 7;
        AtomicInteger accepted = new AtomicInteger();
        CountDownLatch start = new CountDownLatch(1);

        ExecutorService executor = Executors.newFixedThreadPool(16);
        try {
            List<CompletableFuture<Void>> attempts = java.util.stream.IntStream.range(0, 40)
                    .mapToObj(index -> CompletableFuture.runAsync(() -> {
                        try {
                            start.await(5, TimeUnit.SECONDS);
                            if (quotaService.tryReserve(dailyLimit)) accepted.incrementAndGet();
                        } catch (InterruptedException exception) {
                            Thread.currentThread().interrupt();
                            throw new IllegalStateException(exception);
                        }
                    }, executor))
                    .toList();
            start.countDown();
            CompletableFuture.allOf(attempts.toArray(CompletableFuture[]::new))
                    .get(20, TimeUnit.SECONDS);
        } finally {
            start.countDown();
            executor.shutdownNow();
        }

        assertThat(accepted).hasValue(dailyLimit);
        assertThat(quotaService.usedToday()).isEqualTo(dailyLimit);
    }

    private void assertConversationIsolated(UUID id, String expected, String excluded) {
        ChatConversationEntity conversation = conversationRepo.findById(id).orElseThrow();
        List<ChatMessageEntity> messages = messageRepo.findByConversationIdOrderByCreatedAtAsc(id);
        assertThat(conversation.getTurnCount()).isEqualTo(1);
        assertThat(conversation.getAiCallCount()).isEqualTo(1);
        assertThat(messages).hasSize(2);
        assertThat(messages).extracting(ChatMessageEntity::getContent)
                .allSatisfy(content -> assertThat(content).doesNotContain(excluded));
        assertThat(messages).extracting(ChatMessageEntity::getContent)
                .anySatisfy(content -> assertThat(content).contains(expected));
    }

    private void saveConversation(UUID id) {
        jdbcTemplate.update(
                """
                insert into chat_conversations (
                    id, locale, turn_count, ai_call_count, consecutive_off_topic,
                    lead_offer_status, lead_offer_count, started_at, last_message_at, expires_at,
                    created_at, updated_at)
                values (?, 'en', 0, 0, 0, 'NONE', 0, current_timestamp, current_timestamp,
                        dateadd('DAY', 90, current_timestamp), current_timestamp, current_timestamp)
                """,
                id);
    }

    private static ChatMessageRequest request(UUID id, String message) {
        return ChatMessageRequest.builder()
                .conversationId(id)
                .message(message)
                .lang("en")
                .build();
    }

    private static AiChatClient.HybridAnswer answerFor(String question) {
        return new AiChatClient.HybridAnswer(
                new AiChatClient.Answer(
                        "I can continue with " + question + ". "
                                + "Please tell me the product type or exact detail you want help with.",
                        false, false, false),
                List.of(), List.of(), List.of(), java.util.Set.of(), 1,
                "TOOL", null, null);
    }

    private static ChatAssistantSettings.Snapshot settings(String lang) {
        return new ChatAssistantSettings.Snapshot(
                true,
                50,
                true,
                ChatAssistantSettings.defaultGreeting(lang),
                ChatAssistantSettings.defaultQuickPrompts(lang),
                new ChatContactResponse(null, null, null, null, null),
                "",
                "",
                "",
                0);
    }

    private void deleteFixtureData() {
        jdbcTemplate.update(
                "delete from chat_messages where conversation_id in (?, ?)",
                FIRST_ID, SECOND_ID);
        jdbcTemplate.update(
                "delete from chat_conversations where id in (?, ?)",
                FIRST_ID, SECOND_ID);
        jdbcTemplate.update(
                "delete from chat_ai_daily_usage where usage_date = ?",
                Date.valueOf(LocalDate.now(VN_ZONE)));
    }
}
