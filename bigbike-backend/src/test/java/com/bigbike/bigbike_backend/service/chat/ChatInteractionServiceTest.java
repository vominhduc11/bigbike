package com.bigbike.bigbike_backend.service.chat;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.bigbike.bigbike_backend.api.chat.dto.ChatInteractionRequest;
import com.bigbike.bigbike_backend.api.error.ConflictException;
import com.bigbike.bigbike_backend.persistence.entity.chat.ChatConversationEntity;
import com.bigbike.bigbike_backend.persistence.entity.chat.ChatInteractionEntity;
import com.bigbike.bigbike_backend.persistence.entity.chat.ChatMessageEntity;
import com.bigbike.bigbike_backend.persistence.repository.chat.ChatConversationJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.chat.ChatInteractionJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.chat.ChatMessageJpaRepository;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class ChatInteractionServiceTest {

    private final ChatConversationJpaRepository conversations = mock(ChatConversationJpaRepository.class);
    private final ChatMessageJpaRepository messages = mock(ChatMessageJpaRepository.class);
    private final ChatInteractionJpaRepository interactions = mock(ChatInteractionJpaRepository.class);
    private final ChatInteractionService service = new ChatInteractionService(
            conversations, messages, interactions);

    @Test
    void recordsOnlyAnActionActuallyIssuedByTheAssistantAndReplaysByClientEventId() {
        UUID conversationId = UUID.randomUUID();
        UUID messageId = UUID.randomUUID();
        UUID eventId = UUID.randomUUID();
        UUID storedId = UUID.randomUUID();
        ChatConversationEntity conversation = conversation(conversationId);
        ChatMessageEntity message = assistantMessage(
                conversationId, messageId,
                "{\"actions\":[{\"type\":\"CHECK_SIZE\"}],\"leadPromptSequence\":0}");
        when(conversations.findByIdForUpdate(conversationId)).thenReturn(Optional.of(conversation));
        when(messages.findByIdAndConversationIdAndRole(messageId, conversationId, "ASSISTANT"))
                .thenReturn(Optional.of(message));
        when(interactions.findByClientEventId(eventId)).thenReturn(Optional.empty());
        when(interactions.saveAndFlush(any())).thenAnswer(invocation -> {
            ChatInteractionEntity saved = invocation.getArgument(0);
            saved.setId(storedId);
            return saved;
        });

        ChatInteractionRequest request = new ChatInteractionRequest(
                eventId, conversationId, messageId, "ACTION_CLICKED", null, "CHECK_SIZE");
        assertThat(service.record(request, null).interactionId()).isEqualTo(storedId);

        ChatInteractionEntity replay = new ChatInteractionEntity();
        replay.setId(storedId);
        replay.setClientEventId(eventId);
        replay.setConversationId(conversationId);
        replay.setAssistantMessageId(messageId);
        replay.setInteractionType("ACTION_CLICKED");
        replay.setActionType("CHECK_SIZE");
        when(interactions.findByClientEventId(eventId)).thenReturn(Optional.of(replay));
        assertThat(service.record(request, null).recorded()).isTrue();
    }

    @Test
    void rejectsForgedActionAndDoesNotPersistIt() {
        UUID conversationId = UUID.randomUUID();
        UUID messageId = UUID.randomUUID();
        ChatConversationEntity conversation = conversation(conversationId);
        ChatMessageEntity message = assistantMessage(
                conversationId, messageId,
                "{\"actions\":[{\"type\":\"CHECK_SIZE\"}],\"leadPromptSequence\":0}");
        when(conversations.findByIdForUpdate(conversationId)).thenReturn(Optional.of(conversation));
        when(messages.findByIdAndConversationIdAndRole(messageId, conversationId, "ASSISTANT"))
                .thenReturn(Optional.of(message));
        when(interactions.findByClientEventId(any())).thenReturn(Optional.empty());

        ChatInteractionRequest request = new ChatInteractionRequest(
                UUID.randomUUID(), conversationId, messageId,
                "ACTION_CLICKED", null, "VIEW_POLICY");
        assertThatThrownBy(() -> service.record(request, null))
                .isInstanceOf(ConflictException.class);
        verify(interactions, never()).saveAndFlush(any());
    }

    @Test
    void automaticSecondLeadOfferIsDisabledEvenForLegacyViewedPrompts() {
        UUID conversationId = UUID.randomUUID();
        ChatConversationEntity conversation = conversation(conversationId);
        conversation.setLeadOfferStatus("OFFERED");
        conversation.setLeadOfferCount(1);
        when(conversations.findByIdForUpdate(conversationId)).thenReturn(Optional.of(conversation));
        when(interactions.existsByConversationIdAndInteractionTypeAndLeadPromptSequence(
                conversationId, "LEAD_PROMPT_VIEWED", 1)).thenReturn(false, true);

        assertThat(service.offerSecondLeadAfterVerifiedCart(conversationId, null)).isZero();
        assertThat(service.offerSecondLeadAfterVerifiedCart(conversationId, null)).isZero();
        assertThat(conversation.getLeadOfferCount()).isEqualTo(1);
        verify(conversations, never()).save(any());
    }

    private static ChatConversationEntity conversation(UUID id) {
        ChatConversationEntity value = new ChatConversationEntity();
        value.setId(id);
        value.setLocale("vi");
        return value;
    }

    private static ChatMessageEntity assistantMessage(
            UUID conversationId, UUID messageId, String metadata) {
        ChatMessageEntity value = new ChatMessageEntity();
        value.setId(messageId);
        value.setConversationId(conversationId);
        value.setRole("ASSISTANT");
        value.setActionMetadata(metadata);
        return value;
    }
}
