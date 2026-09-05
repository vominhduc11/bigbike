package com.bigbike.bigbike_backend.service.chat;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.bigbike.bigbike_backend.api.chat.dto.ChatSessionRequest;
import com.bigbike.bigbike_backend.api.error.NotFoundException;
import com.bigbike.bigbike_backend.persistence.entity.chat.ChatConversationEntity;
import com.bigbike.bigbike_backend.persistence.entity.chat.ChatVisitorEntity;
import com.bigbike.bigbike_backend.persistence.repository.chat.ChatConversationJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.chat.ChatMessageJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.chat.ChatVisitorJpaRepository;
import com.bigbike.bigbike_backend.service.auth.JwtService;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class ChatVisitorServiceTest {

    private ChatVisitorJpaRepository visitors;
    private ChatConversationJpaRepository conversations;
    private JwtService jwt;
    private ChatVisitorService service;
    private UUID visitorId;
    private ChatVisitorEntity visitor;

    @BeforeEach
    void setUp() {
        visitors = mock(ChatVisitorJpaRepository.class);
        conversations = mock(ChatConversationJpaRepository.class);
        jwt = mock(JwtService.class);
        service = new ChatVisitorService(
                visitors,
                conversations,
                mock(ChatMessageJpaRepository.class),
                jwt);
        visitorId = UUID.randomUUID();
        visitor = new ChatVisitorEntity();
        visitor.setId(visitorId);
        visitor.setTokenHash("hash");
        visitor.setRememberedUntil(Instant.now().plusSeconds(3600));
        visitor.setLastSeenAt(Instant.now());
        when(visitors.findById(visitorId)).thenReturn(Optional.of(visitor));
        when(jwt.hashToken("visitor-token")).thenReturn("hash");
    }

    @Test
    @DisplayName("CHAT_RULE_049 VI/EN: the session resumes only an unowned guest conversation")
    void guestResumesOnlyGuestConversationInBothLanguages() {
        ChatConversationEntity latest = conversation(null);
        latest.setContextJson("{\"category\":\"helmet\"}");
        when(conversations.findFirstByVisitorIdAndCustomerIdIsNullOrderByLastMessageAtDesc(visitorId))
                .thenReturn(Optional.of(latest));

        var vi = service.open(new ChatSessionRequest(visitorId, "visitor-token", "vi"), null);
        var en = service.open(new ChatSessionRequest(visitorId, "visitor-token", "en"), null);

        assertThat(vi.activeConversationId()).isEqualTo(latest.getId());
        assertThat(en.activeConversationId()).isEqualTo(latest.getId());
        verify(conversations, never()).findFirstByVisitorIdOrderByLastMessageAtDesc(visitorId);
    }

    @Test
    @DisplayName("AC16: login merges only current-device unowned chats and cannot select another account")
    void loginScopesLatestConversationToCurrentAccount() {
        UUID customerId = UUID.randomUUID();
        ChatConversationEntity own = conversation(customerId);
        when(conversations.findFirstByVisitorIdAndCustomerIdOrderByLastMessageAtDesc(
                visitorId, customerId)).thenReturn(Optional.of(own));

        var response = service.open(
                new ChatSessionRequest(visitorId, "visitor-token", "vi"), customerId);

        verify(conversations).attachVisitorConversations(visitorId, customerId);
        assertThat(response.activeConversationId()).isEqualTo(own.getId());
        verify(conversations, never()).findFirstByVisitorIdOrderByLastMessageAtDesc(visitorId);
    }

    @Test
    @DisplayName("CHAT_RULE_049: opening a session keeps the identifier inside the current sitting")
    void openingASessionOnlyRemembersForTheCurrentSession() {
        service.open(new ChatSessionRequest(visitorId, "visitor-token", "vi"), null);

        // No 30-day window any more: the row must expire within the session horizon.
        assertThat(visitor.getRememberedUntil())
                .isBefore(Instant.now().plus(
                        ChatVisitorEntity.SESSION_HOURS + 1, java.time.temporal.ChronoUnit.HOURS));
        verify(conversations, never()).deleteByVisitorId(visitorId);
        verify(visitors, never()).deleteById(visitorId);
    }

    @Test
    @DisplayName("AC17: confirmed guest deletion removes only the signed visitor's history")
    void confirmedGuestDeletionUsesSignedVisitorScope() {
        when(visitors.findByTokenHash("hash")).thenReturn(Optional.of(visitor));

        assertThat(service.deleteHistory(null, "visitor-token").deleted()).isTrue();

        verify(conversations).deleteByVisitorId(visitorId);
        verify(visitors).deleteById(visitorId);
        verify(conversations, never()).deleteByCustomerId(org.mockito.ArgumentMatchers.any());
    }

    @Test
    @DisplayName("privacy: a visitor token cannot read a conversation owned by another account")
    void sharedDeviceTokenCannotCrossAccountBoundary() {
        UUID conversationId = UUID.randomUUID();
        ChatConversationEntity otherAccount = conversation(UUID.randomUUID());
        otherAccount.setId(conversationId);
        when(conversations.findById(conversationId)).thenReturn(Optional.of(otherAccount));

        assertThatThrownBy(() -> service.requireOwner(conversationId, null, visitorId))
                .isInstanceOf(NotFoundException.class);
    }

    private ChatConversationEntity conversation(UUID customerId) {
        ChatConversationEntity value = new ChatConversationEntity();
        value.setId(UUID.randomUUID());
        value.setVisitorId(visitorId);
        value.setCustomerId(customerId);
        value.setLocale("vi");
        return value;
    }
}
