package com.bigbike.bigbike_backend.service.chat;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.bigbike.bigbike_backend.api.chat.dto.ChatLeadRequest;
import com.bigbike.bigbike_backend.persistence.entity.chat.ChatConversationEntity;
import com.bigbike.bigbike_backend.persistence.entity.chat.ChatLeadEntity;
import com.bigbike.bigbike_backend.persistence.repository.chat.ChatConversationJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.chat.ChatLeadJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.chat.ChatMessageJpaRepository;
import com.bigbike.bigbike_backend.service.ws.AdminChatWsService;
import jakarta.validation.Validation;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

class ChatLeadConsentTest {

    @Test
    void requestWithoutExplicitConsentIsRejectedBeforeAnyWrite() {
        ChatLeadRequest request = request(false);
        ChatLeadJpaRepository leads = mock(ChatLeadJpaRepository.class);

        assertThat(Validation.buildDefaultValidatorFactory().getValidator().validate(request))
                .anyMatch(violation -> "consent".equals(violation.getPropertyPath().toString()));
        verify(leads, never()).save(any(ChatLeadEntity.class));
    }

    @Test
    void offeredConversationWritesLeadOnlyAfterExplicitConsent() {
        UUID conversationId = TEST_CONVERSATION;
        ChatConversationEntity conversation = new ChatConversationEntity();
        conversation.setId(conversationId);
        conversation.setLocale("vi");
        conversation.setLeadOfferStatus("OFFERED");
        ChatConversationJpaRepository conversations = mock(ChatConversationJpaRepository.class);
        ChatLeadJpaRepository leads = mock(ChatLeadJpaRepository.class);
        when(conversations.findById(conversationId)).thenReturn(Optional.of(conversation));
        when(leads.existsByConversationId(conversationId)).thenReturn(false);
        ChatService service = new ChatService(
                conversations,
                mock(ChatMessageJpaRepository.class),
                leads,
                mock(ChatAssistantSettings.class),
                mock(ChatToolService.class),
                new ChatToolRegistry(),
                mock(AiChatClient.class),
                new ChatResponseGuard(),
                mock(AdminChatWsService.class));

        service.captureLead(request(true), null);

        ArgumentCaptor<ChatLeadEntity> saved = ArgumentCaptor.forClass(ChatLeadEntity.class);
        verify(leads).save(saved.capture());
        assertThat(saved.getValue().getConversationId()).isEqualTo(conversationId);
        assertThat(saved.getValue().getPhone()).isEqualTo("0900 123 456");
        assertThat(saved.getValue().getConsentedAt()).isNotNull();
        assertThat(conversation.getLeadOfferStatus()).isEqualTo("ACCEPTED");
    }

    private static ChatLeadRequest request(boolean consent) {
        return ChatLeadRequest.builder()
                .conversationId(TEST_CONVERSATION)
                .name("Khách thử nghiệm")
                .phone("0900 123 456")
                .note("Xin tư vấn")
                .consent(consent)
                .build();
    }

    private static final UUID TEST_CONVERSATION = UUID.fromString(
            "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
}
