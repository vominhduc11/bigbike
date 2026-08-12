package com.bigbike.bigbike_backend.service.chat;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.bigbike.bigbike_backend.api.chat.dto.ChatContactResponse;
import com.bigbike.bigbike_backend.persistence.repository.chat.ChatConversationJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.chat.ChatLeadJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.chat.ChatMessageJpaRepository;
import com.bigbike.bigbike_backend.service.review.AiReviewModerationClient;
import com.bigbike.bigbike_backend.service.ws.AdminChatWsService;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class ChatAvailabilityTest {

    private static final ChatContactResponse CONTACTS =
            new ChatContactResponse("0900000000", "https://zalo.me/shop", "https://m.me/shop", "Shop", "Shop");

    @Test
    @DisplayName("empty shared key puts Bi in contact mode and review moderation still fails safely")
    void emptyKeyUsesContactModeWithoutBreakingReviewModerator() {
        AiChatClient chatClient = new AiChatClient("", "gemini-2.5-flash", 20L);
        ChatService service = service(chatClient, 60, 0);

        assertThat(service.availability("vi").mode()).isEqualTo("CONTACT");
        assertThat(service.availability("vi").reason()).isEqualTo("CONTACT");

        AiReviewModerationClient reviewClient =
                new AiReviewModerationClient("", "gemini-2.5-flash", 20L);
        assertThat(reviewClient.isConfigured()).isFalse();
        assertThat(reviewClient.classify("Đánh giá bình thường", BigDecimal.valueOf(5))).isEmpty();
    }

    @Test
    @DisplayName("the persisted Vietnamese-day count closes Bi at the daily ceiling")
    void dailyLimitUsesContactMode() {
        AiChatClient chatClient = mock(AiChatClient.class);
        when(chatClient.isConfigured()).thenReturn(true);
        ChatService service = service(chatClient, 60, 60);

        assertThat(service.availability("vi").mode()).isEqualTo("CONTACT");
        assertThat(service.availability("vi").reason()).isEqualTo("CONTACT");
    }

    @Test
    @DisplayName("a polite Vietnamese configured greeting is valid without mandatory pronoun keywords")
    void politeGreetingDoesNotNeedBothPronouns() {
        AiChatClient chatClient = mock(AiChatClient.class);
        when(chatClient.isConfigured()).thenReturn(true);
        ChatService service = service(chatClient, 60, 0);

        assertThat(service.availability("vi").greeting())
                .isEqualTo("Xin chào");
    }

    private static ChatService service(AiChatClient client, int limit, long spent) {
        ChatConversationJpaRepository conversations = mock(ChatConversationJpaRepository.class);
        ChatMessageJpaRepository messages = mock(ChatMessageJpaRepository.class);
        ChatLeadJpaRepository leads = mock(ChatLeadJpaRepository.class);
        ChatAssistantSettings settings = mock(ChatAssistantSettings.class);
        when(settings.load("vi")).thenReturn(new ChatAssistantSettings.Snapshot(
                true, limit, "Xin chào", List.of("A", "B", "C"), CONTACTS,
                "", "", ""));
        when(messages.countAiUsesBetween(
                org.mockito.ArgumentMatchers.any(Instant.class),
                org.mockito.ArgumentMatchers.any(Instant.class))).thenReturn(spent);
        return new ChatService(
                conversations,
                messages,
                leads,
                settings,
                mock(ChatToolService.class),
                new ChatToolRegistry(),
                client,
                new ChatResponseGuard(),
                mock(AdminChatWsService.class));
    }
}
