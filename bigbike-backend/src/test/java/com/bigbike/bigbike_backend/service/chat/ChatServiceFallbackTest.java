package com.bigbike.bigbike_backend.service.chat;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.atLeast;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.bigbike.bigbike_backend.api.chat.dto.ChatContactResponse;
import com.bigbike.bigbike_backend.api.chat.dto.ChatMessageRequest;
import com.bigbike.bigbike_backend.api.chat.dto.ChatMessageResponse;
import com.bigbike.bigbike_backend.persistence.entity.chat.ChatConversationEntity;
import com.bigbike.bigbike_backend.persistence.entity.chat.ChatMessageEntity;
import com.bigbike.bigbike_backend.persistence.repository.chat.ChatConversationJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.chat.ChatLeadJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.chat.ChatMessageJpaRepository;
import com.bigbike.bigbike_backend.service.ws.AdminChatWsService;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

class ChatServiceFallbackTest {

    private static final UUID CONVERSATION_ID = UUID.fromString(
            "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");
    private static final ChatContactResponse CONTACTS = new ChatContactResponse(
            "0900000000", "https://zalo.me/shop", "https://m.me/shop", "Shop", "Shop");

    @Test
    @DisplayName("a fast-path guard rejection keeps the conversation open and refunds the turn")
    void fastPathGuardRejectionIsRecoverable() {
        Fixture fixture = fixture(true, 60, 0);
        when(fixture.toolService.resolveFastPath(anyString(), eq("vi"), isNull(), any(), any()))
                .thenReturn(Optional.of(ChatToolService.ToolOutcome.local(
                        "Dạ, em đã kiểm tra thông tin này.", "TEMPLATE", false, false, false)))
                .thenReturn(Optional.of(ChatToolService.ToolOutcome.local(
                        "Dạ, em có thể hỗ trợ tìm sản phẩm. Anh/chị cho em biết nhu cầu cần xem nhé?",
                        "TEMPLATE", false, false, false)));

        ChatMessageResponse fallback = fixture.service.send(request("Câu hỏi bị chặn"), null);

        assertRecoverable(fallback, fixture.conversation);
        ChatMessageResponse next = fixture.service.send(request("Câu hỏi tiếp theo"), null);
        assertThat(next.mode()).isEqualTo("AI");
        assertThat(next.turnCount()).isEqualTo(1);
        assertThat(next.answer()).contains("có thể hỗ trợ");
        assertThat(fixture.conversation.getEndedReason()).isNull();
    }

    @Test
    @DisplayName("a model tone rejection is retried once with corrected form of address")
    void modelToneRejectionRetriesOnceBeforeFallback() {
        Fixture fixture = fixture(true, 60, 0);
        when(fixture.toolService.resolveFastPath(anyString(), eq("vi"), isNull(), any(), any()))
                .thenReturn(Optional.empty());
        when(fixture.aiClient.answer(
                anyString(), eq("vi"), any(ChatToolRegistry.class), eq(true),
                any(AiChatClient.ToolExecutor.class)))
                .thenReturn(Optional.of(hybrid(
                        "Dạ, em đã kiểm tra câu hỏi này. Em có thể hỗ trợ thêm ngay.")));
        when(fixture.aiClient.answerWithToneCorrection(
                anyString(), eq("vi"), any(ChatToolRegistry.class), eq(true),
                any(AiChatClient.ToolExecutor.class)))
                .thenReturn(Optional.of(hybrid(
                        "Dạ, em có thể hỗ trợ tìm sản phẩm. Anh/chị cho em biết nhu cầu cần xem nhé?")));

        ChatMessageResponse response = fixture.service.send(request("Câu hỏi bị guard chặn"), null);

        assertThat(response.mode()).isEqualTo("AI");
        assertThat(response.turnCount()).isEqualTo(1);
        assertThat(response.answer()).contains("Anh/chị");
        assertThat(fixture.conversation.getEndedReason()).isNull();
        assertThat(fixture.conversation.getAiCallCount()).isEqualTo(2);
        ArgumentCaptor<ChatMessageEntity> savedMessages = ArgumentCaptor.forClass(ChatMessageEntity.class);
        verify(fixture.messageRepo, atLeast(2)).save(savedMessages.capture());
        assertThat(savedMessages.getAllValues()).filteredOn(message -> "ASSISTANT".equals(message.getRole()))
                .extracting(ChatMessageEntity::getAiRetryCount)
                .containsExactly(1);
        verify(fixture.aiClient).answerWithToneCorrection(
                anyString(), eq("vi"), any(ChatToolRegistry.class), eq(true),
                any(AiChatClient.ToolExecutor.class));
    }

    @Test
    @DisplayName("a model that calls the customer em is rejected and corrected once")
    void customerAddressedAsEmAlsoUsesTheBoundedToneRetry() {
        Fixture fixture = fixture(true, 60, 0);
        when(fixture.toolService.resolveFastPath(anyString(), eq("vi"), isNull(), any(), any()))
                .thenReturn(Optional.empty());
        when(fixture.aiClient.answer(
                anyString(), eq("vi"), any(ChatToolRegistry.class), eq(true),
                any(AiChatClient.ToolExecutor.class)))
                .thenReturn(Optional.of(hybrid(
                        "Chào em, em đang tìm sản phẩm nào? Anh/chị nói rõ để Bi hỗ trợ.")));
        when(fixture.aiClient.answerWithToneCorrection(
                anyString(), eq("vi"), any(ChatToolRegistry.class), eq(true),
                any(AiChatClient.ToolExecutor.class)))
                .thenReturn(Optional.of(hybrid(
                        "Dạ, em đã kiểm tra yêu cầu của anh/chị. Anh/chị cho em biết thêm loại hàng cần xem nhé?")));

        ChatMessageResponse response = fixture.service.send(request("Câu hỏi gọi khách sai"), null);

        assertThat(response.mode()).isEqualTo("AI");
        assertThat(response.answer()).contains("anh/chị").doesNotContain("Chào em");
        verify(fixture.aiClient).answerWithToneCorrection(
                anyString(), eq("vi"), any(ChatToolRegistry.class), eq(true),
                any(AiChatClient.ToolExecutor.class));
    }

    @Test
    @DisplayName("a tone retry is skipped at the daily reserve and remains a recoverable fallback")
    void modelToneRejectionSkipsRetryAtDailyReserve() {
        Fixture fixture = fixture(true, 60, 59);
        when(fixture.toolService.resolveFastPath(anyString(), eq("vi"), isNull(), any(), any()))
                .thenReturn(Optional.empty());
        when(fixture.aiClient.answer(
                anyString(), eq("vi"), any(ChatToolRegistry.class), eq(true),
                any(AiChatClient.ToolExecutor.class)))
                .thenReturn(Optional.of(hybrid(
                        "Dạ, em đã kiểm tra câu hỏi này. Em có thể hỗ trợ thêm ngay.")));

        ChatMessageResponse response = fixture.service.send(request("Câu hỏi sát trần ngày"), null);

        assertRecoverable(response, fixture.conversation);
        verify(fixture.aiClient, never()).answerWithToneCorrection(
                anyString(), anyString(), any(ChatToolRegistry.class), eq(true), any(AiChatClient.ToolExecutor.class));
    }

    @Test
    @DisplayName("an AI exception keeps the conversation open and allows the next question")
    void providerFailureIsRecoverable() {
        Fixture fixture = fixture(true, 60, 0);
        when(fixture.toolService.resolveFastPath(anyString(), eq("vi"), isNull(), any(), any()))
                .thenReturn(Optional.empty());
        when(fixture.aiClient.answer(
                anyString(), eq("vi"), any(ChatToolRegistry.class), eq(true),
                any(AiChatClient.ToolExecutor.class)))
                .thenThrow(new RuntimeException("provider unavailable"))
                .thenReturn(Optional.of(hybrid(
                        "Dạ, em đã kiểm tra được thông tin này. Anh/chị có thể xem tiếp nhé?")));

        ChatMessageResponse fallback = fixture.service.send(request("Câu hỏi lúc AI lỗi"), null);

        assertRecoverable(fallback, fixture.conversation);
        ChatMessageResponse next = fixture.service.send(request("Câu hỏi tiếp theo"), null);
        assertThat(next.mode()).isEqualTo("AI");
        assertThat(next.turnCount()).isEqualTo(1);
        assertThat(fixture.conversation.getEndedReason()).isNull();
    }

    @Test
    @DisplayName("a fast-path exception is a recoverable staff-review fallback")
    void staffReviewFailureIsRecoverable() {
        Fixture fixture = fixture(true, 60, 0);
        when(fixture.toolService.resolveFastPath(anyString(), eq("vi"), isNull(), any(), any()))
                .thenThrow(new RuntimeException("lookup failed"));

        ChatMessageResponse response = fixture.service.send(request("Câu hỏi cần kiểm tra"), null);

        assertRecoverable(response, fixture.conversation);
        assertThat(response.answer()).contains("nhân viên BigBike");
    }

    @Test
    @DisplayName("a disabled assistant closes the conversation with its internal end reason")
    void disabledAssistantClosesConversation() {
        Fixture fixture = fixture(false, 60, 0);

        ChatMessageResponse response = fixture.service.send(request("Câu hỏi"), null);

        assertClosed(response, fixture.conversation, "DISABLED", 1);
    }

    @Test
    @DisplayName("the daily ceiling closes the conversation with its internal end reason")
    void dailyLimitClosesConversation() {
        Fixture fixture = fixture(true, 60, 60);

        ChatMessageResponse response = fixture.service.send(request("Câu hỏi"), null);

        assertClosed(response, fixture.conversation, "DAILY_LIMIT_REACHED", 1);
    }

    @Test
    @DisplayName("the twelfth turn closes the conversation without saving a thirteenth customer message")
    void turnLimitClosesConversation() {
        Fixture fixture = fixture(true, 60, 0);
        fixture.conversation.setTurnCount(ChatService.MAX_TURNS);

        ChatMessageResponse response = fixture.service.send(request("Câu hỏi thứ mười ba"), null);

        assertClosed(response, fixture.conversation, "TURN_LIMIT", ChatService.MAX_TURNS);
        verify(fixture.messageRepo, never()).save(any(ChatMessageEntity.class));
    }

    private static void assertRecoverable(
            ChatMessageResponse response, ChatConversationEntity conversation) {
        assertThat(response.mode()).isEqualTo("AI");
        assertThat(response.reason()).isEqualTo("AI");
        assertThat(response.handoffRecommended()).isFalse();
        assertThat(response.products()).isEmpty();
        assertThat(response.turnCount()).isZero();
        assertThat(conversation.getEndedReason()).isNull();
    }

    private static void assertClosed(
            ChatMessageResponse response,
            ChatConversationEntity conversation,
            String endedReason,
            int turnCount
    ) {
        assertThat(response.mode()).isEqualTo("CONTACT");
        assertThat(response.reason()).isEqualTo("CONTACT");
        assertThat(conversation.getEndedReason()).isEqualTo(endedReason);
        assertThat(response.turnCount()).isEqualTo(turnCount);
    }

    private static AiChatClient.HybridAnswer hybrid(String answer) {
        return new AiChatClient.HybridAnswer(
                new AiChatClient.Answer(answer, false, false, false),
                List.of(), List.of(), List.of(), 1);
    }

    private static ChatMessageRequest request(String message) {
        return ChatMessageRequest.builder()
                .conversationId(CONVERSATION_ID)
                .message(message)
                .lang("vi")
                .build();
    }

    private static Fixture fixture(boolean enabled, int dailyLimit, long spent) {
        ChatConversationJpaRepository conversations = mock(ChatConversationJpaRepository.class);
        ChatMessageJpaRepository messages = mock(ChatMessageJpaRepository.class);
        ChatLeadJpaRepository leads = mock(ChatLeadJpaRepository.class);
        ChatAssistantSettings settings = mock(ChatAssistantSettings.class);
        ChatToolService toolService = mock(ChatToolService.class);
        AiChatClient aiClient = mock(AiChatClient.class);
        ChatConversationEntity conversation = new ChatConversationEntity();
        conversation.setId(CONVERSATION_ID);
        conversation.setLocale("vi");

        when(conversations.findById(CONVERSATION_ID)).thenReturn(Optional.of(conversation));
        when(settings.load("vi")).thenReturn(new ChatAssistantSettings.Snapshot(
                enabled,
                dailyLimit,
                ChatAssistantSettings.defaultGreeting("vi"),
                List.of("Tìm sản phẩm", "Lọc theo ngân sách", "So sánh"),
                CONTACTS,
                "",
                "",
                ""));
        when(messages.countAiUsesBetween(
                any(Instant.class), any(Instant.class))).thenReturn(spent);
        when(aiClient.isConfigured()).thenReturn(true);

        ChatService service = new ChatService(
                conversations,
                messages,
                leads,
                settings,
                toolService,
                new ChatToolRegistry(),
                aiClient,
                new ChatResponseGuard(),
                mock(AdminChatWsService.class));
        return new Fixture(service, conversation, toolService, aiClient, messages);
    }

    private record Fixture(
            ChatService service,
            ChatConversationEntity conversation,
            ChatToolService toolService,
            AiChatClient aiClient,
            ChatMessageJpaRepository messageRepo
    ) {}
}
