package com.bigbike.bigbike_backend.service.chat;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.bigbike.bigbike_backend.api.chat.dto.ChatHandoffRequest;
import com.bigbike.bigbike_backend.persistence.entity.chat.ChatConversationEntity;
import com.bigbike.bigbike_backend.persistence.entity.chat.ChatHandoffEntity;
import com.bigbike.bigbike_backend.persistence.entity.chat.ChatMessageEntity;
import com.bigbike.bigbike_backend.persistence.repository.chat.ChatConversationJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.chat.ChatHandoffJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.chat.ChatLeadJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.chat.ChatMessageJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.auth.AdminUserJpaRepository;
import com.bigbike.bigbike_backend.service.ws.AdminChatWsService;
import com.bigbike.bigbike_backend.service.ws.CustomerChatWsService;
import com.bigbike.bigbike_backend.service.ws.ChatHandoffWsEvent;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

class ChatHandoffServiceTest {

    private ChatHandoffJpaRepository handoffs;
    private ChatConversationJpaRepository conversations;
    private ChatMessageJpaRepository messages;
    private ChatLeadJpaRepository leads;
    private AdminChatWsService adminChat;
    private CustomerChatWsService customerChat;
    private ChatHandoffEmailService email;
    private ChatPhase3Settings phase3Settings;
    private ChatHandoffService service;

    @BeforeEach
    void setUp() {
        handoffs = mock(ChatHandoffJpaRepository.class);
        conversations = mock(ChatConversationJpaRepository.class);
        messages = mock(ChatMessageJpaRepository.class);
        leads = mock(ChatLeadJpaRepository.class);
        adminChat = mock(AdminChatWsService.class);
        customerChat = mock(CustomerChatWsService.class);
        email = mock(ChatHandoffEmailService.class);
        phase3Settings = mock(ChatPhase3Settings.class);
        when(phase3Settings.businessHours(any(Instant.class), anyString())).thenReturn(
                new ChatPhase3Settings.BusinessHoursStatus(
                        true, null, "T2–T6 09:00–21:00 · T7–CN 09:00–18:00"));
        service = new ChatHandoffService(
                handoffs, conversations, messages, leads, mock(AdminUserJpaRepository.class),
                adminChat, customerChat, email, phase3Settings);
    }

    @Test
    @DisplayName("AC17/18: staff request alerts externally with useful context and keeps chat open")
    void requestAlertsStaffWithoutClosingConversationOrDisclosingAccountPhone() {
        UUID customerId = UUID.randomUUID();
        UUID conversationId = UUID.randomUUID();
        UUID handoffId = UUID.randomUUID();
        UUID requestId = UUID.randomUUID();
        ChatConversationEntity conversation = new ChatConversationEntity();
        conversation.setId(conversationId);
        conversation.setCustomerId(customerId);
        conversation.setLocale("vi");

        ChatMessageEntity question = new ChatMessageEntity();
        question.setConversationId(conversationId);
        question.setRole("CUSTOMER");
        question.setContent("Size M của Mũ A còn không? Gọi 0912 345 678 hoặc an@example.com");
        ChatMessageEntity answer = new ChatMessageEntity();
        answer.setConversationId(conversationId);
        answer.setRole("ASSISTANT");
        answer.setProductsJson("[{\"slug\":\"mu-a\",\"name\":\"Mũ A\","
                + "\"retailPrice\":1500000,\"currency\":\"VND\","
                + "\"stockState\":\"IN_STOCK\"}]");

        when(handoffs.findByRequestId(requestId)).thenReturn(Optional.empty());
        when(handoffs.findFirstByConversationIdAndStatus(conversationId, "WAITING"))
                .thenReturn(Optional.empty());
        when(conversations.findByIdForUpdate(conversationId)).thenReturn(Optional.of(conversation));
        when(messages.findFirstByConversationIdAndRoleOrderByCreatedAtDesc(conversationId, "CUSTOMER"))
                .thenReturn(Optional.of(question));
        when(messages.findByConversationIdOrderByCreatedAtAsc(conversationId))
                .thenReturn(java.util.List.of(question, answer));
        when(leads.existsByConversationId(conversationId)).thenReturn(false);
        when(handoffs.countByStatus("WAITING")).thenReturn(1L);
        when(handoffs.saveAndFlush(any())).thenAnswer(invocation -> {
            ChatHandoffEntity saved = invocation.getArgument(0);
            saved.setId(handoffId);
            return saved;
        });

        var response = service.request(
                new ChatHandoffRequest(requestId, conversationId, "vi", "BUTTON"), customerId);

        assertThat(response.handoffId()).isEqualTo(handoffId);
        assertThat(response.status()).isEqualTo("WAITING");
        assertThat(conversation.getEndedReason()).isNull();
        ArgumentCaptor<ChatHandoffWsEvent> event = ArgumentCaptor.forClass(ChatHandoffWsEvent.class);
        verify(adminChat).pushHandoff(event.capture());
        assertThat(event.getValue().questionSummary())
                .contains("Size M của Mũ A còn không?", "[đã ẩn liên hệ]")
                .doesNotContain("0912 345 678", "an@example.com");
        assertThat(event.getValue().products()).extracting(ChatHandoffWsEvent.ProductReference::slug)
                .containsExactly("mu-a");
        assertThat(event.getValue().customerKind()).isEqualTo("SIGNED_IN");
        assertThat(event.getValue().contactPresent()).isFalse();
        verify(email).send(handoffId);
    }

    @Test
    @DisplayName("AC4/5: waiting duration remains visible until an atomic staff claim")
    void queueClearsOnlyAfterExplicitAcknowledgement() {
        UUID handoffId = UUID.randomUUID();
        UUID conversationId = UUID.randomUUID();
        UUID adminId = UUID.randomUUID();
        ChatHandoffEntity handoff = new ChatHandoffEntity();
        handoff.setId(handoffId);
        handoff.setRequestId(UUID.randomUUID());
        handoff.setConversationId(conversationId);
        handoff.setStatus("WAITING");
        handoff.setTriggerSource("BUTTON");
        handoff.setCustomerKind("GUEST");
        handoff.setProductsJson("[]");
        handoff.setRequestedAt(Instant.now().minusSeconds(125));

        when(handoffs.findByStatusOrderByRequestedAtAsc("WAITING"))
                .thenReturn(java.util.List.of(handoff));
        when(handoffs.countByStatus("WAITING")).thenReturn(1L, 0L);
        var waiting = service.listWaiting();
        assertThat(waiting.waitingCount()).isEqualTo(1);
        assertThat(waiting.items().get(0).waitingSeconds()).isGreaterThanOrEqualTo(125);

        when(handoffs.findByIdForUpdate(handoffId)).thenReturn(Optional.of(handoff));
        when(messages.nextSequence()).thenReturn(11L);
        var acknowledged = service.claim(handoffId, adminId);

        assertThat(acknowledged.status()).isEqualTo("ACTIVE");
        assertThat(acknowledged.assignedAdminId()).isEqualTo(adminId);
        assertThat(acknowledged.acknowledgedBy()).isEqualTo(adminId);
        verify(handoffs).saveAndFlush(handoff);
        verify(adminChat).pushHandoffUpdate(any(ChatHandoffWsEvent.class));
        verify(customerChat).push(conversationId, "HANDOFF_ACTIVE", 11L, "STAFF_ACTIVE");
    }

    @Test
    @DisplayName("AC8: a second employee is told who already owns the conversation")
    void secondEmployeeCannotClaimAnActiveConversation() {
        UUID firstAdmin = UUID.randomUUID();
        UUID secondAdmin = UUID.randomUUID();
        ChatHandoffEntity handoff = activeHandoff(firstAdmin);
        handoff.setAssignedDisplayName("Minh");
        when(handoffs.findByIdForUpdate(handoff.getId())).thenReturn(Optional.of(handoff));

        assertThatThrownBy(() -> service.claim(handoff.getId(), secondAdmin))
                .hasMessageContaining("Minh")
                .hasMessageContaining("đã được");
    }

    @Test
    @DisplayName("AC6/7 VI/EN: assigned staff sends an ordered message and hands chat back to AI")
    void staffMessageAndReturnArePushedToTheOpenCustomerChat() {
        UUID adminId = UUID.randomUUID();
        ChatHandoffEntity handoff = activeHandoff(adminId);
        when(handoffs.findLiveForConversation(handoff.getConversationId()))
                .thenReturn(java.util.List.of(handoff));
        when(handoffs.findByIdForUpdate(handoff.getId())).thenReturn(Optional.of(handoff));
        when(messages.nextSequence()).thenReturn(21L, 22L);
        when(messages.saveAndFlush(any(ChatMessageEntity.class))).thenAnswer(invocation -> invocation.getArgument(0));

        ChatMessageEntity staff = service.sendStaffMessage(
                handoff.getConversationId(), adminId, UUID.randomUUID(), "Size M vẫn còn hàng ạ.");
        var returned = service.returnToAi(handoff.getId(), adminId, "en");
        ChatConversationEntity conversation = new ChatConversationEntity();
        conversation.setId(handoff.getConversationId());
        conversation.setLocale("en");
        when(handoffs.findFirstByConversationIdOrderByRequestedAtDesc(handoff.getConversationId()))
                .thenReturn(Optional.of(handoff));
        when(conversations.findById(handoff.getConversationId())).thenReturn(Optional.of(conversation));
        var restoredStatus = service.latestStatusForConversation(handoff.getConversationId());

        assertThat(staff.getRole()).isEqualTo("STAFF");
        assertThat(staff.getStaffDisplayName()).isEqualTo("Nhân viên BigBike");
        assertThat(staff.getSequenceNo()).isEqualTo(21L);
        assertThat(returned.status()).isEqualTo("RETURNED_TO_AI");
        assertThat(restoredStatus.channelState()).isEqualTo("AI_RESUMED");
        verify(customerChat).push(
                handoff.getConversationId(), "STAFF_MESSAGE", 21L, "STAFF_ACTIVE");
        verify(customerChat).push(
                handoff.getConversationId(), "RETURNED_TO_AI", 22L, "AI_RESUMED");
    }

    @Test
    @DisplayName("AC9 VI/EN: after-hours handoff gives real hours and does not claim staff is online")
    void afterHoursResponseIncludesConfiguredSchedule() {
        UUID conversationId = UUID.randomUUID();
        UUID requestId = UUID.randomUUID();
        UUID visitorId = UUID.randomUUID();
        ChatConversationEntity conversation = new ChatConversationEntity();
        conversation.setId(conversationId);
        conversation.setVisitorId(visitorId);
        conversation.setLocale("en");
        Instant nextOpen = Instant.parse("2026-08-26T02:00:00Z");
        when(phase3Settings.businessHours(any(Instant.class), anyString())).thenReturn(
                new ChatPhase3Settings.BusinessHoursStatus(
                        false, nextOpen, "Mon–Fri 09:00–17:00 (Vietnam time)"));
        when(handoffs.findByRequestId(requestId)).thenReturn(Optional.empty());
        when(handoffs.findLiveForConversation(conversationId)).thenReturn(java.util.List.of());
        when(conversations.findByIdForUpdate(conversationId)).thenReturn(Optional.of(conversation));
        when(handoffs.saveAndFlush(any(ChatHandoffEntity.class))).thenAnswer(invocation -> {
            ChatHandoffEntity value = invocation.getArgument(0);
            value.setId(UUID.randomUUID());
            return value;
        });

        var response = service.request(
                new ChatHandoffRequest(requestId, conversationId, "en", "BUTTON"), null, visitorId);

        assertThat(response.withinBusinessHours()).isFalse();
        assertThat(response.nextOpenAt()).isEqualTo(nextOpen);
        assertThat(response.businessHoursText()).contains("Mon–Fri", "Vietnam time");
        assertThat(response.channelState()).isEqualTo("WAITING_FOR_STAFF");
    }

    private static ChatHandoffEntity activeHandoff(UUID adminId) {
        ChatHandoffEntity handoff = new ChatHandoffEntity();
        handoff.setId(UUID.randomUUID());
        handoff.setRequestId(UUID.randomUUID());
        handoff.setConversationId(UUID.randomUUID());
        handoff.setStatus("ACTIVE");
        handoff.setTriggerSource("BUTTON");
        handoff.setCustomerKind("GUEST");
        handoff.setProductsJson("[]");
        handoff.setRequestedAt(Instant.now().minusSeconds(60));
        handoff.setAssignedAt(Instant.now());
        handoff.setAssignedAdminId(adminId);
        handoff.setAssignedDisplayName("Nhân viên BigBike");
        return handoff;
    }
}
