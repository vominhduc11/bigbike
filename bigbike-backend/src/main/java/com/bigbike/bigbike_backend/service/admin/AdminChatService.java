package com.bigbike.bigbike_backend.service.admin;

import com.bigbike.bigbike_backend.api.admin.dto.chat.AdminChatConversationDetailResponse;
import com.bigbike.bigbike_backend.api.admin.dto.chat.AdminChatConversationResponse;
import com.bigbike.bigbike_backend.api.admin.dto.chat.AdminChatLeadResponse;
import com.bigbike.bigbike_backend.api.admin.dto.chat.AdminChatMessageResponse;
import com.bigbike.bigbike_backend.api.admin.dto.chat.AdminChatStatsResponse;
import com.bigbike.bigbike_backend.api.admin.dto.chat.AdminChatOrderAttributionResponse;
import com.bigbike.bigbike_backend.api.error.NotFoundException;
import com.bigbike.bigbike_backend.mapper.ChatMapper;
import com.bigbike.bigbike_backend.persistence.entity.chat.ChatConversationEntity;
import com.bigbike.bigbike_backend.persistence.entity.chat.ChatLeadEntity;
import com.bigbike.bigbike_backend.persistence.repository.chat.ChatConversationJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.chat.ChatLeadJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.chat.ChatMessageJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.chat.ChatOrderAttributionJpaRepository;
import com.bigbike.bigbike_backend.persistence.entity.chat.ChatMessageEntity;
import com.bigbike.bigbike_backend.persistence.entity.chat.ChatOrderAttributionEntity;
import com.bigbike.bigbike_backend.service.chat.ChatAssistantSettings;
import com.bigbike.bigbike_backend.service.chat.ChatAiQuotaService;
import com.bigbike.bigbike_backend.service.common.PageResult;
import jakarta.persistence.criteria.Predicate;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.math.BigDecimal;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AdminChatService {

    private static final ZoneId VN_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");

    private final ChatConversationJpaRepository conversationRepo;
    private final ChatMessageJpaRepository messageRepo;
    private final ChatLeadJpaRepository leadRepo;
    private final ChatOrderAttributionJpaRepository attributionRepo;
    private final ChatAssistantSettings assistantSettings;
    private final ChatAiQuotaService chatAiQuotaService;
    private final ChatMapper chatMapper;

    public PageResult<AdminChatConversationResponse> list(
            int page,
            int size,
            LocalDate from,
            LocalDate to,
            Boolean hasLead
    ) {
        int safePage = Math.max(1, page);
        int safeSize = Math.max(1, Math.min(size, 100));
        Instant fromInstant = from == null ? null : from.atStartOfDay(VN_ZONE).toInstant();
        Instant toExclusive = to == null ? null : to.plusDays(1).atStartOfDay(VN_ZONE).toInstant();

        Specification<ChatConversationEntity> spec = (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (fromInstant != null) predicates.add(cb.greaterThanOrEqualTo(root.get("startedAt"), fromInstant));
            if (toExclusive != null) predicates.add(cb.lessThan(root.get("startedAt"), toExclusive));
            return cb.and(predicates.toArray(new Predicate[0]));
        };

        List<ChatConversationEntity> conversations = conversationRepo.findAll(
                spec, Sort.by(Sort.Direction.DESC, "lastMessageAt"));
        List<UUID> ids = conversations.stream().map(ChatConversationEntity::getId).toList();
        Set<UUID> leadIds = ids.isEmpty() ? Set.of() : new HashSet<>(leadRepo
                .findAllByConversationIdIn(ids).stream()
                .map(ChatLeadEntity::getConversationId)
                .toList());

        List<ChatConversationEntity> filtered = conversations.stream()
                .filter(item -> hasLead == null || hasLead == leadIds.contains(item.getId()))
                .toList();
        int fromIndex = Math.min((safePage - 1) * safeSize, filtered.size());
        int toIndex = Math.min(fromIndex + safeSize, filtered.size());
        List<AdminChatConversationResponse> items = filtered.subList(fromIndex, toIndex).stream()
                .map(entity -> toListItem(entity, leadIds.contains(entity.getId())))
                .toList();
        int totalPages = filtered.isEmpty() ? 0 : (int) Math.ceil((double) filtered.size() / safeSize);
        return new PageResult<>(items, safePage, safeSize, filtered.size(), totalPages);
    }

    public AdminChatConversationDetailResponse get(UUID id) {
        ChatConversationEntity conversation = conversationRepo.findById(id)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy hội thoại."));
        List<AdminChatMessageResponse> messages = messageRepo
                .findByConversationIdOrderByCreatedAtAsc(id).stream()
                .map(chatMapper::toMessage)
                .toList();
        AdminChatLeadResponse lead = leadRepo.findByConversationId(id)
                .map(chatMapper::toLead)
                .orElse(null);
        List<ChatOrderAttributionEntity> attributions = attributionRepo.findByConversationId(id);
        ConversationMetrics metrics = summarize(
                messageRepo.findByConversationIdOrderByCreatedAtAsc(id), attributions);
        List<AdminChatOrderAttributionResponse> attributionResponses = attributions.stream()
                .map(item -> new AdminChatOrderAttributionResponse(
                        item.getOrderId(), item.getOrderLineItemId(), item.getAttributedAmount(),
                        item.getCurrency(), item.getCreatedAt()))
                .toList();
        return new AdminChatConversationDetailResponse(
                conversation.getId(), conversation.getCustomerId(), conversation.getLocale(),
                conversation.getTurnCount(), conversation.getAiCallCount(),
                conversation.getLeadOfferStatus(), conversation.getEndedReason(),
                conversation.getStartedAt(), conversation.getLastMessageAt(),
                metrics.inputTokens(), metrics.outputTokens(), metrics.thinkingTokens(),
                metrics.providerRequests(), metrics.averageLatencyMs(), metrics.estimatedCostUsd(),
                metrics.contentRefusals(), metrics.assistedOrders(), metrics.assistedRevenue(),
                messages, attributionResponses, lead);
    }

    public AdminChatStatsResponse stats(LocalDate requestedDate) {
        LocalDate date = requestedDate == null ? LocalDate.now(VN_ZONE) : requestedDate;
        Instant from = date.atStartOfDay(VN_ZONE).toInstant();
        Instant to = date.plusDays(1).atStartOfDay(VN_ZONE).toInstant();
        long aiCalls = chatAiQuotaService.usedOn(date);
        long conversations = conversationRepo
                .countByStartedAtGreaterThanEqualAndStartedAtLessThan(from, to);
        long leads = leadRepo.countByCreatedAtGreaterThanEqualAndCreatedAtLessThan(from, to);
        long unanswered = messageRepo.countFallbackMessagesBetween(from, to);
        ChatMessageJpaRepository.TelemetrySummary telemetry = messageRepo.summarizeBetween(from, to);
        long assistedOrders = attributionRepo.countAssistedOrdersBetween(from, to);
        BigDecimal assistedRevenue = zero(attributionRepo.sumAssistedRevenueBetween(from, to));
        int limit = assistantSettings.load("vi").dailyLimit();
        return new AdminChatStatsResponse(
                date, aiCalls, conversations, leads, unanswered,
                value(telemetry.getContentRefusals()), limit, Math.max(0, limit - aiCalls),
                value(telemetry.getInputTokens()), value(telemetry.getOutputTokens()),
                value(telemetry.getThinkingTokens()), value(telemetry.getProviderRequests()),
                rounded(telemetry.getAverageLatencyMs()), zero(telemetry.getEstimatedCostUsd()),
                assistedOrders, assistedRevenue);
    }

    private AdminChatConversationResponse toListItem(
            ChatConversationEntity entity,
            boolean hasLead
    ) {
        ConversationMetrics metrics = summarize(
                messageRepo.findByConversationIdOrderByCreatedAtAsc(entity.getId()),
                attributionRepo.findByConversationId(entity.getId()));
        return new AdminChatConversationResponse(
                entity.getId(), entity.getLocale(), null, entity.getTurnCount(),
                entity.getAiCallCount(), hasLead,
                metrics.inputTokens(), metrics.outputTokens(), metrics.thinkingTokens(),
                metrics.providerRequests(), metrics.averageLatencyMs(), metrics.estimatedCostUsd(),
                metrics.contentRefusals(), metrics.assistedOrders(), metrics.assistedRevenue(),
                entity.getStartedAt(), entity.getLastMessageAt(), entity.getEndedReason());
    }

    private static ConversationMetrics summarize(
            List<ChatMessageEntity> messages,
            List<ChatOrderAttributionEntity> attributions
    ) {
        long input = messages.stream().map(ChatMessageEntity::getInputTokens)
                .filter(java.util.Objects::nonNull).mapToLong(Integer::longValue).sum();
        long output = messages.stream().map(ChatMessageEntity::getOutputTokens)
                .filter(java.util.Objects::nonNull).mapToLong(Integer::longValue).sum();
        long thinking = messages.stream().map(ChatMessageEntity::getThinkingTokens)
                .filter(java.util.Objects::nonNull).mapToLong(Integer::longValue).sum();
        long requests = messages.stream().map(ChatMessageEntity::getProviderRequestCount)
                .filter(java.util.Objects::nonNull).mapToLong(Integer::longValue).sum();
        Long averageLatency = rounded(messages.stream().map(ChatMessageEntity::getLatencyMs)
                .filter(java.util.Objects::nonNull).mapToInt(Integer::intValue)
                .average().stream().boxed().findFirst().orElse(null));
        BigDecimal cost = messages.stream().map(ChatMessageEntity::getEstimatedCostUsd)
                .filter(java.util.Objects::nonNull).reduce(BigDecimal.ZERO, BigDecimal::add);
        long refusals = messages.stream().filter(message ->
                "CONTENT_REFUSAL".equals(message.getSource())
                        || "ROLE_DEFENSE".equals(message.getSource())).count();
        long orders = attributions.stream().map(ChatOrderAttributionEntity::getOrderId)
                .distinct().count();
        BigDecimal revenue = attributions.stream().map(ChatOrderAttributionEntity::getAttributedAmount)
                .filter(java.util.Objects::nonNull).reduce(BigDecimal.ZERO, BigDecimal::add);
        return new ConversationMetrics(
                input, output, thinking, requests, averageLatency, cost, refusals, orders, revenue);
    }

    private static long value(Long value) {
        return value == null ? 0L : value;
    }

    private static Long rounded(Double value) {
        return value == null ? null : Math.round(value);
    }

    private static BigDecimal zero(BigDecimal value) {
        return value == null ? BigDecimal.ZERO : value;
    }

    private record ConversationMetrics(
            long inputTokens,
            long outputTokens,
            long thinkingTokens,
            long providerRequests,
            Long averageLatencyMs,
            BigDecimal estimatedCostUsd,
            long contentRefusals,
            long assistedOrders,
            BigDecimal assistedRevenue
    ) {}
}
