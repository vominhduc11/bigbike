package com.bigbike.bigbike_backend.service.chat;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.bigbike.bigbike_backend.api.chat.dto.ChatLeadRequest;
import com.bigbike.bigbike_backend.persistence.entity.chat.ChatConversationEntity;
import com.bigbike.bigbike_backend.persistence.entity.chat.ChatLeadEntity;
import com.bigbike.bigbike_backend.persistence.entity.customer.CustomerEntity;
import com.bigbike.bigbike_backend.persistence.repository.chat.ChatConversationJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.chat.ChatLeadJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.chat.ChatMessageJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.customer.CustomerJpaRepository;
import com.bigbike.bigbike_backend.api.error.ForbiddenException;
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
        CustomerJpaRepository customers = mock(CustomerJpaRepository.class);
        when(conversations.findByIdForUpdate(conversationId)).thenReturn(Optional.of(conversation));
        when(leads.existsByConversationId(conversationId)).thenReturn(false);
        ChatService service = service(conversations, leads, customers);

        service.captureLead(request(true), null);

        ArgumentCaptor<ChatLeadEntity> saved = ArgumentCaptor.forClass(ChatLeadEntity.class);
        verify(leads).save(saved.capture());
        assertThat(saved.getValue().getConversationId()).isEqualTo(conversationId);
        assertThat(saved.getValue().getPhone()).isEqualTo("0900 123 456");
        assertThat(saved.getValue().getConsentedAt()).isNotNull();
        assertThat(conversation.getLeadOfferStatus()).isEqualTo("ACCEPTED");
        assertThat(saved.getValue().getSource()).isEqualTo("FORM");
    }

    @Test
    void accountCaptureUsesAuthoritativeCustomerContactAndIgnoresSpoofedFields() {
        UUID conversationId = TEST_CONVERSATION;
        UUID customerId = UUID.fromString("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");
        ChatConversationEntity conversation = offeredConversation(conversationId);
        ChatConversationJpaRepository conversations = mock(ChatConversationJpaRepository.class);
        ChatLeadJpaRepository leads = mock(ChatLeadJpaRepository.class);
        CustomerJpaRepository customers = mock(CustomerJpaRepository.class);
        CustomerEntity customer = new CustomerEntity();
        customer.setDisplayName("Nguyễn Minh");
        customer.setPhone("+84 909 123 456");
        when(conversations.findByIdForUpdate(conversationId)).thenReturn(Optional.of(conversation));
        when(leads.existsByConversationId(conversationId)).thenReturn(false);
        when(customers.findById(customerId)).thenReturn(Optional.of(customer));

        ChatService service = service(conversations, leads, customers);
        ChatLeadRequest request = ChatLeadRequest.builder()
                .conversationId(conversationId)
                .contactSource("ACCOUNT")
                .name("Người lạ")
                .phone("0988 999 999")
                .note("Số giả từ trình duyệt")
                .consent(true)
                .build();

        service.captureLead(request, customerId);

        ArgumentCaptor<ChatLeadEntity> saved = ArgumentCaptor.forClass(ChatLeadEntity.class);
        verify(leads).save(saved.capture());
        assertThat(saved.getValue().getName()).isEqualTo("Nguyễn Minh");
        assertThat(saved.getValue().getPhone()).isEqualTo("0909123456");
        assertThat(saved.getValue().getNote()).isNull();
        assertThat(saved.getValue().getSource()).isEqualTo("ACCOUNT");
    }

    @Test
    void accountCaptureCannotBeUsedByGuestEvenWithSubmittedContactFields() {
        ChatConversationEntity conversation = offeredConversation(TEST_CONVERSATION);
        ChatConversationJpaRepository conversations = mock(ChatConversationJpaRepository.class);
        ChatLeadJpaRepository leads = mock(ChatLeadJpaRepository.class);
        when(conversations.findByIdForUpdate(TEST_CONVERSATION)).thenReturn(Optional.of(conversation));
        when(leads.existsByConversationId(TEST_CONVERSATION)).thenReturn(false);

        ChatService service = service(conversations, leads, mock(CustomerJpaRepository.class));
        ChatLeadRequest request = ChatLeadRequest.builder()
                .conversationId(TEST_CONVERSATION)
                .contactSource("ACCOUNT")
                .name("Người lạ")
                .phone("0900 123 456")
                .consent(true)
                .build();

        assertThatThrownBy(() -> service.captureLead(request, null))
                .isInstanceOf(ForbiddenException.class);
        verify(leads, never()).save(any(ChatLeadEntity.class));
    }

    private static ChatService service(
            ChatConversationJpaRepository conversations,
            ChatLeadJpaRepository leads,
            CustomerJpaRepository customers
    ) {
        return new ChatService(
                conversations,
                mock(ChatMessageJpaRepository.class),
                leads,
                customers,
                mock(ChatAssistantSettings.class),
                mock(ChatToolService.class),
                new ChatToolRegistry(),
                mock(AiChatClient.class),
                new ChatResponseGuard(),
                mock(ChatAiQuotaService.class),
                mock(AdminChatWsService.class));
    }

    private static ChatConversationEntity offeredConversation(UUID conversationId) {
        ChatConversationEntity conversation = new ChatConversationEntity();
        conversation.setId(conversationId);
        conversation.setLocale("vi");
        conversation.setLeadOfferStatus("OFFERED");
        return conversation;
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
