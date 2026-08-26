package com.bigbike.bigbike_backend.service.chat;

import com.bigbike.bigbike_backend.api.admin.dto.chat.AdminChatFeedbackReportResponse;
import com.bigbike.bigbike_backend.api.admin.dto.chat.AdminChatTemplatePrefillResponse;
import com.bigbike.bigbike_backend.api.chat.dto.ChatFeedbackRequest;
import com.bigbike.bigbike_backend.api.chat.dto.ChatFeedbackResponse;
import com.bigbike.bigbike_backend.api.error.NotFoundException;
import com.bigbike.bigbike_backend.api.error.ValidationException;
import com.bigbike.bigbike_backend.persistence.entity.chat.ChatMessageEntity;
import com.bigbike.bigbike_backend.persistence.entity.chat.ChatMessageFeedbackEntity;
import com.bigbike.bigbike_backend.persistence.repository.chat.ChatMessageFeedbackJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.chat.ChatMessageJpaRepository;
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class ChatFeedbackService {
    private static final ZoneId VN = ZoneId.of("Asia/Ho_Chi_Minh");
    private final ChatMessageFeedbackJpaRepository feedbackRepo;
    private final ChatMessageJpaRepository messageRepo;
    private final ChatVisitorService visitorService;

    @Transactional
    public ChatFeedbackResponse record(
            UUID messageId, ChatFeedbackRequest request, UUID customerId, String visitorToken) {
        if ("UNHELPFUL".equals(request.rating()) && request.reason() == null) {
            throw ValidationException.fromField(
                    "reason", "REQUIRED", "Vui lòng chọn lý do câu trả lời chưa đúng ý.");
        }
        if ("HELPFUL".equals(request.rating()) && request.reason() != null) {
            throw ValidationException.fromField(
                    "reason", "MUST_BE_EMPTY", "Câu trả lời đúng ý không cần lý do chưa đúng.");
        }
        ChatMessageEntity message = messageRepo.findById(messageId)
                .filter(value -> "ASSISTANT".equals(value.getRole()))
                .orElseThrow(() -> new NotFoundException("Không tìm thấy câu trả lời của trợ lý."));
        UUID visitorId = visitorToken == null ? null : visitorService.resolveVisitorId(visitorToken);
        visitorService.requireOwner(message.getConversationId(), customerId, visitorId);
        ChatMessageFeedbackEntity feedback = feedbackRepo.findByMessageId(messageId)
                .orElseGet(ChatMessageFeedbackEntity::new);
        feedback.setMessageId(messageId);
        feedback.setConversationId(message.getConversationId());
        feedback.setRating(request.rating());
        feedback.setReason(request.reason());
        feedback.setTopicCode(topic(message));
        feedback = feedbackRepo.save(feedback);
        return new ChatFeedbackResponse(feedback.getId(), feedback.getRating(), feedback.getReason(), true);
    }

    @Transactional(readOnly = true)
    public AdminChatFeedbackReportResponse report(LocalDate fromDate, LocalDate toDate) {
        LocalDate to = toDate == null ? LocalDate.now(VN) : toDate;
        LocalDate from = fromDate == null ? to.minusWeeks(8).plusDays(1) : fromDate;
        Instant fromInstant = from.atStartOfDay(VN).toInstant();
        Instant toInstant = to.plusDays(1).atStartOfDay(VN).toInstant();
        long helpful = feedbackRepo.countByRatingAndCreatedAtGreaterThanEqualAndCreatedAtLessThan(
                "HELPFUL", fromInstant, toInstant);
        long unhelpful = feedbackRepo.countByRatingAndCreatedAtGreaterThanEqualAndCreatedAtLessThan(
                "UNHELPFUL", fromInstant, toInstant);
        List<AdminChatFeedbackReportResponse.Issue> issues = feedbackRepo
                .summarizeIssues(fromInstant, toInstant).stream().limit(20)
                .map(value -> new AdminChatFeedbackReportResponse.Issue(
                        value.getTopicCode(), value.getReason(), value.getTotal() == null ? 0 : value.getTotal()))
                .toList();
        List<AdminChatFeedbackReportResponse.Week> weeks = new ArrayList<>();
        LocalDate cursor = from.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        while (!cursor.isAfter(to)) {
            Instant weekStart = cursor.atStartOfDay(VN).toInstant();
            Instant weekEnd = cursor.plusWeeks(1).atStartOfDay(VN).toInstant();
            weeks.add(new AdminChatFeedbackReportResponse.Week(
                    cursor,
                    feedbackRepo.countByRatingAndCreatedAtGreaterThanEqualAndCreatedAtLessThan(
                            "HELPFUL", weekStart, weekEnd),
                    feedbackRepo.countByRatingAndCreatedAtGreaterThanEqualAndCreatedAtLessThan(
                            "UNHELPFUL", weekStart, weekEnd)));
            cursor = cursor.plusWeeks(1);
        }
        List<AdminChatFeedbackReportResponse.Sample> samples = topCriticizedQuestions(
                feedbackRepo
                        .findTop5000ByRatingAndCreatedAtGreaterThanEqualAndCreatedAtLessThanOrderByCreatedAtDesc(
                                "UNHELPFUL", fromInstant, toInstant));
        return new AdminChatFeedbackReportResponse(helpful, unhelpful, issues, weeks, samples);
    }

    @Transactional(readOnly = true)
    public AdminChatTemplatePrefillResponse prefill(UUID feedbackId) {
        ChatMessageFeedbackEntity feedback = feedbackRepo.findById(feedbackId)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy phản hồi."));
        ChatMessageEntity answer = messageRepo.findById(feedback.getMessageId())
                .orElseThrow(() -> new NotFoundException("Không tìm thấy câu trả lời."));
        String trigger = messageRepo
                .findFirstByConversationIdAndRoleAndSequenceNoLessThanOrderBySequenceNoDesc(
                        answer.getConversationId(), "CUSTOMER", answer.getSequenceNo())
                .map(ChatMessageEntity::getContent)
                .map(ChatFeedbackService::sanitizeTrigger)
                .orElse("");
        return new AdminChatTemplatePrefillResponse(
                feedback.getId(), feedback.getTopicCode(),
                trigger.isBlank() ? List.of() : List.of(trigger),
                List.of());
    }

    private static String topic(ChatMessageEntity message) {
        if (message.getOutcomeCode() != null && !message.getOutcomeCode().isBlank()) {
            return message.getOutcomeCode();
        }
        if (message.getResultKind() != null && !message.getResultKind().isBlank()) {
            return message.getResultKind();
        }
        return message.getSource() == null ? "OTHER" : message.getSource();
    }

    private List<AdminChatFeedbackReportResponse.Sample> topCriticizedQuestions(
            List<ChatMessageFeedbackEntity> feedbackItems) {
        if (feedbackItems == null || feedbackItems.isEmpty()) return List.of();
        Map<UUID, ChatMessageEntity> answers = new HashMap<>();
        messageRepo.findAllById(feedbackItems.stream()
                        .map(ChatMessageFeedbackEntity::getMessageId).collect(java.util.stream.Collectors.toSet()))
                .forEach(message -> answers.put(message.getId(), message));
        Set<UUID> conversationIds = answers.values().stream()
                .map(ChatMessageEntity::getConversationId).collect(java.util.stream.Collectors.toSet());
        Map<UUID, String> latestQuestionByConversation = new HashMap<>();
        Map<UUID, String> questionByAnswer = new HashMap<>();
        if (!conversationIds.isEmpty()) {
            for (ChatMessageEntity message : messageRepo
                    .findByConversationIdInOrderByConversationIdAscSequenceNoAsc(conversationIds)) {
                if ("CUSTOMER".equals(message.getRole())) {
                    latestQuestionByConversation.put(message.getConversationId(), message.getContent());
                } else if ("ASSISTANT".equals(message.getRole())) {
                    questionByAnswer.put(message.getId(),
                            latestQuestionByConversation.getOrDefault(message.getConversationId(), ""));
                }
            }
        }

        Map<String, List<FeedbackCandidate>> groups = new LinkedHashMap<>();
        for (ChatMessageFeedbackEntity feedback : feedbackItems) {
            ChatMessageEntity answer = answers.get(feedback.getMessageId());
            if (answer == null) continue;
            String question = sanitizeTrigger(questionByAnswer.getOrDefault(answer.getId(), ""));
            String signature = ChatTemplatePolicy.normalizeMatchText(question);
            if (signature.isBlank()) signature = "feedback:" + feedback.getId();
            groups.computeIfAbsent(signature, ignored -> new ArrayList<>())
                    .add(new FeedbackCandidate(feedback, answer, question));
        }
        return groups.values().stream()
                .map(items -> {
                    FeedbackCandidate latest = items.stream()
                            .max(Comparator.comparing(
                                    item -> item.feedback().getCreatedAt(),
                                    Comparator.nullsFirst(Comparator.naturalOrder())))
                            .orElseThrow();
                    ChatMessageFeedbackEntity feedback = latest.feedback();
                    return new AdminChatFeedbackReportResponse.Sample(
                            feedback.getId(), feedback.getConversationId(), feedback.getMessageId(),
                            latest.question(), latest.answer().getContent(), feedback.getTopicCode(),
                            feedback.getReason(), feedback.getCreatedAt(), items.size());
                })
                .sorted(Comparator
                        .comparingLong(AdminChatFeedbackReportResponse.Sample::total).reversed()
                        .thenComparing(AdminChatFeedbackReportResponse.Sample::createdAt,
                                Comparator.nullsLast(Comparator.reverseOrder())))
                .limit(20)
                .toList();
    }

    private record FeedbackCandidate(
            ChatMessageFeedbackEntity feedback,
            ChatMessageEntity answer,
            String question
    ) {}

    private static String sanitizeTrigger(String value) {
        if (value == null) return "";
        String clean = value
                .replaceAll("(?i)[\\p{L}\\p{N}._%+-]+@[\\p{L}\\p{N}.-]+\\.[a-z]{2,}", "[đã ẩn]")
                .replaceAll("(?<!\\d)(?:\\+?84|0)(?:[ .-]?\\d){8,10}(?!\\d)", "[đã ẩn]")
                .replaceAll("\\s+", " ").trim();
        return clean.length() <= 500 ? clean : clean.substring(0, 500);
    }
}
