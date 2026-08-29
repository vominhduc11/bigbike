package com.bigbike.bigbike_backend.service.admin;

import com.bigbike.bigbike_backend.api.admin.dto.chat.AdminChatConversationDetailResponse;
import com.bigbike.bigbike_backend.api.admin.dto.chat.AdminChatConversationResponse;
import com.bigbike.bigbike_backend.api.admin.dto.chat.AdminChatHandoffResponse;
import com.bigbike.bigbike_backend.api.admin.dto.chat.AdminChatMessageResponse;
import com.bigbike.bigbike_backend.api.admin.dto.chat.AdminChatQualityStatsResponse;
import com.bigbike.bigbike_backend.api.admin.dto.chat.AdminChatStatsResponse;
import com.bigbike.bigbike_backend.api.error.NotFoundException;
import com.bigbike.bigbike_backend.mapper.ChatMapper;
import com.bigbike.bigbike_backend.persistence.entity.chat.ChatConversationEntity;
import com.bigbike.bigbike_backend.persistence.entity.chat.ChatHandoffEntity;
import com.bigbike.bigbike_backend.persistence.entity.chat.ChatMessageEntity;
import com.bigbike.bigbike_backend.persistence.repository.chat.ChatConversationJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.chat.ChatHandoffJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.chat.ChatMessageJpaRepository;
import com.bigbike.bigbike_backend.service.chat.ChatAiQuotaService;
import com.bigbike.bigbike_backend.service.chat.ChatAssistantSettings;
import com.bigbike.bigbike_backend.service.chat.ChatHandoffProductJson;
import com.bigbike.bigbike_backend.service.chat.ChatImageService;
import com.bigbike.bigbike_backend.service.common.PageResult;
import jakarta.persistence.criteria.Predicate;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Operational transcript and quota view for staff. All model comparison, pricing, lead,
 * feedback and conversion analytics were intentionally removed with V1068.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AdminChatService {

    private static final ZoneId VN_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");

    private final ChatConversationJpaRepository conversationRepo;
    private final ChatHandoffJpaRepository handoffRepo;
    private final ChatMessageJpaRepository messageRepo;
    private final ChatAssistantSettings assistantSettings;
    private final ChatAiQuotaService chatAiQuotaService;
    private final ChatImageService chatImageService;
    private final ChatMapper chatMapper;

    public PageResult<AdminChatConversationResponse> list(
            int page,
            int size,
            LocalDate requestedFrom,
            LocalDate requestedTo
    ) {
        int safePage = Math.max(1, page);
        int safeSize = Math.max(1, Math.min(size, 100));
        DateRange range = normalizedRange(requestedFrom, requestedTo);
        Specification<ChatConversationEntity> spec = (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (range.from() != null) {
                predicates.add(cb.greaterThanOrEqualTo(root.get("startedAt"), range.from()));
            }
            if (range.toExclusive() != null) {
                predicates.add(cb.lessThan(root.get("startedAt"), range.toExclusive()));
            }
            return cb.and(predicates.toArray(new Predicate[0]));
        };
        List<ChatConversationEntity> conversations = conversationRepo.findAll(
                spec, Sort.by(Sort.Direction.DESC, "lastMessageAt"));
        int total = conversations.size();
        int fromIndex = Math.min((safePage - 1) * safeSize, total);
        int toIndex = Math.min(fromIndex + safeSize, total);
        List<AdminChatConversationResponse> items = conversations.subList(fromIndex, toIndex).stream()
                .map(this::toListItem)
                .toList();
        int totalPages = total == 0 ? 0 : (int) Math.ceil((double) total / safeSize);
        return new PageResult<>(items, safePage, safeSize, total, totalPages);
    }

    public AdminChatConversationDetailResponse get(UUID id) {
        ChatConversationEntity conversation = conversationRepo.findById(id)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy hội thoại."));
        List<ChatMessageEntity> entities = messageRepo.findByConversationIdOrderByCreatedAtAsc(id);
        Map<UUID, List<com.bigbike.bigbike_backend.api.chat.dto.ChatImageResponse>> imagesByMessage =
                chatImageService.referencesByMessageIds(entities.stream().map(ChatMessageEntity::getId).toList());
        List<AdminChatMessageResponse> messages = entities.stream()
                .map(entity -> withImages(
                        chatMapper.toMessage(entity), imagesByMessage.getOrDefault(entity.getId(), List.of())))
                .toList();
        AdminChatHandoffResponse handoff = handoffRepo.findFirstByConversationIdOrderByRequestedAtDesc(id)
                .map(item -> toHandoff(item, Instant.now()))
                .orElse(null);
        return new AdminChatConversationDetailResponse(
                conversation.getId(), conversation.getCustomerId(), conversation.getLocale(),
                conversation.getTurnCount(), conversation.getAiCallCount(), conversation.getEndedReason(),
                conversation.getStartedAt(), conversation.getLastMessageAt(), messages, handoff);
    }

    public AdminChatStatsResponse stats(
            LocalDate requestedDate,
            LocalDate requestedFrom,
            LocalDate requestedTo
    ) {
        LocalDate date = requestedDate == null ? LocalDate.now(VN_ZONE) : requestedDate;
        LocalDate fromDate = requestedFrom == null ? date : requestedFrom;
        LocalDate toDate = requestedTo == null ? fromDate : requestedTo;
        if (fromDate.isAfter(toDate)) {
            LocalDate swap = fromDate;
            fromDate = toDate;
            toDate = swap;
        }
        Instant from = fromDate.atStartOfDay(VN_ZONE).toInstant();
        Instant toExclusive = toDate.plusDays(1).atStartOfDay(VN_ZONE).toInstant();
        int limit = assistantSettings.load("vi").dailyLimit();
        long used = chatAiQuotaService.usedOn(date);
        ChatMessageJpaRepository.QualitySummary quality = messageRepo.summarizeQualityBetween(from, toExclusive);
        return new AdminChatStatsResponse(
                date, fromDate, toDate, used, limit, Math.max(0, limit - used),
                conversationRepo.countByStartedAtGreaterThanEqualAndStartedAtLessThan(from, toExclusive),
                new AdminChatQualityStatsResponse(
                        value(quality.getAnswers()), value(quality.getProductResults()),
                        value(quality.getClarifications()), value(quality.getOutOfScope()),
                        value(quality.getRefusals())));
    }

    private AdminChatConversationResponse toListItem(ChatConversationEntity conversation) {
        List<ChatMessageEntity> messages = messageRepo.findByConversationIdOrderByCreatedAtAsc(conversation.getId());
        String resultKind = messages.isEmpty() ? null : messages.get(messages.size() - 1).getResultKind();
        String handoffStatus = handoffRepo.findFirstByConversationIdOrderByRequestedAtDesc(conversation.getId())
                .map(ChatHandoffEntity::getStatus)
                .orElse("AI_ACTIVE");
        return new AdminChatConversationResponse(
                conversation.getId(), conversation.getLocale(), null, conversation.getTurnCount(),
                conversation.getAiCallCount(), handoffStatus, resultKind, conversation.getStartedAt(),
                conversation.getLastMessageAt(), conversation.getEndedReason());
    }

    private static AdminChatMessageResponse withImages(
            AdminChatMessageResponse message,
            List<com.bigbike.bigbike_backend.api.chat.dto.ChatImageResponse> images
    ) {
        return new AdminChatMessageResponse(
                message.id(), message.sequenceNo(), message.role(), message.staffUserId(),
                message.staffDisplayName(), message.content(), message.source(), message.aiCalled(),
                message.answerFormat(), message.resultKind(), message.productsJson(), message.createdAt(), images);
    }

    private static AdminChatHandoffResponse toHandoff(ChatHandoffEntity entity, Instant now) {
        List<AdminChatHandoffResponse.ProductReference> products = ChatHandoffProductJson.read(entity.getProductsJson())
                .stream().map(item -> new AdminChatHandoffResponse.ProductReference(item.slug(), item.name())).toList();
        long waitingSeconds = "WAITING".equals(entity.getStatus())
                ? Math.max(0, Duration.between(entity.getRequestedAt(), now).getSeconds()) : 0;
        return new AdminChatHandoffResponse(
                entity.getId(), entity.getConversationId(), entity.getStatus(), entity.getTriggerSource(),
                entity.getCustomerKind(), entity.getQuestionSummary(), products, entity.getRequestedAt(),
                waitingSeconds, entity.getAcknowledgedAt(), entity.getAcknowledgedBy(), entity.getAssignedAt(),
                entity.getAssignedAdminId(), entity.getAssignedDisplayName(), entity.getResolvedAt(),
                entity.getResolution(), entity.isWithinBusinessHours(), entity.getNextOpenAt());
    }

    private static DateRange normalizedRange(LocalDate from, LocalDate to) {
        if (from == null && to == null) return new DateRange(null, null);
        LocalDate safeFrom = from == null ? to : from;
        LocalDate safeTo = to == null ? from : to;
        if (safeFrom.isAfter(safeTo)) {
            LocalDate swap = safeFrom;
            safeFrom = safeTo;
            safeTo = swap;
        }
        return new DateRange(
                safeFrom.atStartOfDay(VN_ZONE).toInstant(),
                safeTo.plusDays(1).atStartOfDay(VN_ZONE).toInstant());
    }

    private static long value(Long value) {
        return value == null ? 0L : value;
    }

    private record DateRange(Instant from, Instant toExclusive) {}
}
