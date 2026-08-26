package com.bigbike.bigbike_backend.service.chat;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.mockito.ArgumentMatchers.any;

import com.bigbike.bigbike_backend.api.chat.dto.ChatFeedbackRequest;
import com.bigbike.bigbike_backend.persistence.entity.chat.ChatMessageEntity;
import com.bigbike.bigbike_backend.persistence.entity.chat.ChatMessageFeedbackEntity;
import com.bigbike.bigbike_backend.persistence.repository.chat.ChatMessageFeedbackJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.chat.ChatMessageJpaRepository;
import java.util.Optional;
import java.util.List;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class ChatFeedbackServiceTest {

    private ChatMessageFeedbackJpaRepository feedbacks;
    private ChatMessageJpaRepository messages;
    private ChatVisitorService visitors;
    private ChatFeedbackService service;

    @BeforeEach
    void setUp() {
        feedbacks = mock(ChatMessageFeedbackJpaRepository.class);
        messages = mock(ChatMessageJpaRepository.class);
        visitors = mock(ChatVisitorService.class);
        service = new ChatFeedbackService(feedbacks, messages, visitors);
    }

    @Test
    @DisplayName("AC18: an unhelpful reason is stored against an owned assistant answer")
    void unhelpfulReasonIsRecorded() {
        UUID messageId = UUID.randomUUID();
        UUID conversationId = UUID.randomUUID();
        UUID visitorId = UUID.randomUUID();
        ChatMessageEntity answer = assistant(messageId, conversationId, 2L);
        answer.setResultKind("PRODUCT_RESULTS");
        when(messages.findById(messageId)).thenReturn(Optional.of(answer));
        when(visitors.resolveVisitorId("visitor-token")).thenReturn(visitorId);
        when(feedbacks.findByMessageId(messageId)).thenReturn(Optional.empty());
        when(feedbacks.save(org.mockito.ArgumentMatchers.any())).thenAnswer(invocation -> {
            ChatMessageFeedbackEntity saved = invocation.getArgument(0);
            saved.setId(UUID.randomUUID());
            return saved;
        });

        var response = service.record(
                messageId,
                new ChatFeedbackRequest("UNHELPFUL", "MISSING_INFORMATION"),
                null,
                "visitor-token");

        assertThat(response.recorded()).isTrue();
        assertThat(response.rating()).isEqualTo("UNHELPFUL");
        assertThat(response.reason()).isEqualTo("MISSING_INFORMATION");
        verify(visitors).requireOwner(conversationId, null, visitorId);
        verify(feedbacks).save(org.mockito.ArgumentMatchers.argThat(value ->
                "PRODUCT_RESULTS".equals(value.getTopicCode())
                        && "MISSING_INFORMATION".equals(value.getReason())));
    }

    @Test
    @DisplayName("AC19: a criticized question becomes a sanitized FAQ-template prefill")
    void criticizedQuestionPrefillsTemplateWithoutContactDetails() {
        UUID feedbackId = UUID.randomUUID();
        UUID messageId = UUID.randomUUID();
        UUID conversationId = UUID.randomUUID();
        ChatMessageFeedbackEntity feedback = new ChatMessageFeedbackEntity();
        feedback.setId(feedbackId);
        feedback.setMessageId(messageId);
        feedback.setConversationId(conversationId);
        feedback.setTopicCode("SIZE");
        ChatMessageEntity answer = assistant(messageId, conversationId, 2L);
        ChatMessageEntity question = new ChatMessageEntity();
        question.setRole("CUSTOMER");
        question.setContent("Size M còn không? Gọi tôi 0909 123 456");
        when(feedbacks.findById(feedbackId)).thenReturn(Optional.of(feedback));
        when(messages.findById(messageId)).thenReturn(Optional.of(answer));
        when(messages.findFirstByConversationIdAndRoleAndSequenceNoLessThanOrderBySequenceNoDesc(
                conversationId, "CUSTOMER", 2L)).thenReturn(Optional.of(question));

        var prefill = service.prefill(feedbackId);

        assertThat(prefill.topic()).isEqualTo("SIZE");
        assertThat(prefill.triggersVi()).singleElement()
                .asString().contains("Size M còn không?", "[đã ẩn]")
                .doesNotContain("0909 123 456");
        assertThat(prefill.triggersEn()).isEmpty();
    }

    @Test
    @DisplayName("AC18: report ranks repeated criticized questions and keeps a weekly trend")
    void reportRanksMostCriticizedQuestions() {
        UUID firstConversation = UUID.randomUUID();
        UUID secondConversation = UUID.randomUUID();
        ChatMessageEntity firstQuestion = customer(firstConversation, 1L, "Size M còn hàng không?");
        ChatMessageEntity firstAnswer = assistant(UUID.randomUUID(), firstConversation, 2L);
        ChatMessageEntity secondQuestion = customer(secondConversation, 1L, "Size M còn hàng không?");
        ChatMessageEntity secondAnswer = assistant(UUID.randomUUID(), secondConversation, 2L);
        ChatMessageFeedbackEntity newest = feedback(
                secondAnswer, Instant.parse("2026-08-25T03:00:00Z"));
        ChatMessageFeedbackEntity older = feedback(
                firstAnswer, Instant.parse("2026-08-24T03:00:00Z"));
        when(feedbacks
                .findTop5000ByRatingAndCreatedAtGreaterThanEqualAndCreatedAtLessThanOrderByCreatedAtDesc(
                        any(), any(), any())).thenReturn(List.of(newest, older));
        when(messages.findAllById(any())).thenReturn(List.of(firstAnswer, secondAnswer));
        when(messages.findByConversationIdInOrderByConversationIdAscSequenceNoAsc(any()))
                .thenReturn(List.of(firstQuestion, firstAnswer, secondQuestion, secondAnswer));

        var report = service.report(
                LocalDate.parse("2026-08-24"), LocalDate.parse("2026-08-25"));

        assertThat(report.samples()).singleElement().satisfies(sample -> {
            assertThat(sample.question()).isEqualTo("Size M còn hàng không?");
            assertThat(sample.total()).isEqualTo(2);
            assertThat(sample.feedbackId()).isEqualTo(newest.getId());
        });
        assertThat(report.weeklyTrend()).isNotEmpty();
    }

    private static ChatMessageEntity assistant(UUID id, UUID conversationId, long sequence) {
        ChatMessageEntity message = new ChatMessageEntity();
        message.setId(id);
        message.setConversationId(conversationId);
        message.setSequenceNo(sequence);
        message.setRole("ASSISTANT");
        message.setContent("Câu trả lời của trợ lý");
        return message;
    }

    private static ChatMessageEntity customer(UUID conversationId, long sequence, String content) {
        ChatMessageEntity message = new ChatMessageEntity();
        message.setId(UUID.randomUUID());
        message.setConversationId(conversationId);
        message.setSequenceNo(sequence);
        message.setRole("CUSTOMER");
        message.setContent(content);
        return message;
    }

    private static ChatMessageFeedbackEntity feedback(
            ChatMessageEntity answer, Instant createdAt) {
        ChatMessageFeedbackEntity feedback = new ChatMessageFeedbackEntity();
        feedback.setId(UUID.randomUUID());
        feedback.setMessageId(answer.getId());
        feedback.setConversationId(answer.getConversationId());
        feedback.setRating("UNHELPFUL");
        feedback.setReason("MISSING_INFORMATION");
        feedback.setTopicCode("STOCK");
        feedback.setCreatedAt(createdAt);
        return feedback;
    }
}
