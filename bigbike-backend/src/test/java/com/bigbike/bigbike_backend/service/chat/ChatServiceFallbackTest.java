package com.bigbike.bigbike_backend.service.chat;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.bigbike.bigbike_backend.api.chat.dto.ChatActionResponse;
import com.bigbike.bigbike_backend.api.chat.dto.ChatContactResponse;
import com.bigbike.bigbike_backend.api.chat.dto.ChatMessageRequest;
import com.bigbike.bigbike_backend.persistence.entity.chat.ChatConversationEntity;
import com.bigbike.bigbike_backend.persistence.entity.chat.ChatMessageEntity;
import com.bigbike.bigbike_backend.persistence.repository.chat.ChatConversationJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.chat.ChatMessageJpaRepository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

class ChatServiceFallbackTest {

    @Test
    void unavailableFixedModelShowsApologyAndTalkToStaffWithoutSwitchingModels() {
        UUID conversationId = UUID.randomUUID();
        ChatConversationJpaRepository conversations = mock(ChatConversationJpaRepository.class);
        ChatMessageJpaRepository messages = mock(ChatMessageJpaRepository.class);
        ChatAssistantSettings settings = mock(ChatAssistantSettings.class);
        ChatToolService tools = mock(ChatToolService.class);
        AiChatClient client = mock(AiChatClient.class);
        ChatAiQuotaService quota = mock(ChatAiQuotaService.class);
        ChatPhase3Settings phase3 = mock(ChatPhase3Settings.class);
        ChatConversationEntity conversation = new ChatConversationEntity();
        conversation.setId(conversationId);
        conversation.setLocale("vi");

        when(conversations.findById(conversationId)).thenReturn(Optional.of(conversation));
        when(conversations.save(any(ChatConversationEntity.class))).thenAnswer(call -> call.getArgument(0));
        when(messages.findByConversationIdOrderByCreatedAtAsc(conversationId)).thenReturn(List.of());
        when(messages.nextSequence()).thenReturn(1L, 2L);
        when(messages.save(any(ChatMessageEntity.class))).thenAnswer(call -> call.getArgument(0));
        when(settings.load("vi")).thenReturn(new ChatAssistantSettings.Snapshot(
                true, 400, "Xin chào", List.of("Tìm mũ", "Chọn size", "Xem chính sách"),
                new ChatContactResponse("0900000000", "", "", "", ""), "", "", ""));
        when(phase3.conversationTurnLimit()).thenReturn(40);
        when(client.isConfigured()).thenReturn(true);
        when(quota.tryReserve(400)).thenReturn(true);
        when(tools.resolveFastPath(anyString(), anyString(), any(), any(), any()))
                .thenReturn(Optional.empty());
        when(tools.assistantCatalogVocabulary())
                .thenReturn(ChatToolService.AssistantCatalogVocabulary.empty());
        when(client.answer(anyString(), anyString(), any(), anyBoolean(), any(), any(), any(), any()))
                .thenReturn(Optional.empty());

        ChatService service = new ChatService(
                conversations, messages, settings, tools, new ChatToolRegistry(), client,
                new ChatResponseGuard(), quota, mock(ChatSalesAdvisorService.class), null,
                phase3, null, null);

        var response = service.send(ChatMessageRequest.builder()
                .conversationId(conversationId)
                .message("Mũ fullface nào phù hợp đi tour?")
                .lang("vi")
                .build(), null);

        assertThat(response.resultKind()).isEqualTo("CONTACT");
        assertThat(response.handoffRecommended()).isFalse();
        assertThat(response.answer()).contains("chưa hoàn tất được lần kiểm tra này");
        assertThat(response.actions()).extracting(ChatActionResponse::type)
                .containsExactly("CONTACT_STAFF");
        verify(quota).tryReserve(400);
        verify(client).answer(anyString(), anyString(), any(), anyBoolean(), any(), any(), any(), any());
        ArgumentCaptor<ChatMessageEntity> saved = ArgumentCaptor.forClass(ChatMessageEntity.class);
        verify(messages, org.mockito.Mockito.atLeast(2)).save(saved.capture());
        assertThat(saved.getAllValues()).anySatisfy(message -> {
            assertThat(message.getSource()).isEqualTo("PROVIDER_UNAVAILABLE");
            assertThat(message.getContent()).contains("Gặp nhân viên");
        });
    }
}
