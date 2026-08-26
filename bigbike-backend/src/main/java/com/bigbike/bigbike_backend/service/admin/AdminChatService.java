package com.bigbike.bigbike_backend.service.admin;

import com.bigbike.bigbike_backend.api.admin.dto.chat.AdminChatConversationDetailResponse;
import com.bigbike.bigbike_backend.api.admin.dto.chat.AdminChatConversationResponse;
import com.bigbike.bigbike_backend.api.admin.dto.chat.AdminChatCostStatsResponse;
import com.bigbike.bigbike_backend.api.admin.dto.chat.AdminChatFallbackStatsResponse;
import com.bigbike.bigbike_backend.api.admin.dto.chat.AdminChatLeadResponse;
import com.bigbike.bigbike_backend.api.admin.dto.chat.AdminChatMessageResponse;
import com.bigbike.bigbike_backend.api.admin.dto.chat.AdminChatModelUsageResponse;
import com.bigbike.bigbike_backend.api.admin.dto.chat.AdminChatStatsResponse;
import com.bigbike.bigbike_backend.api.admin.dto.chat.AdminChatOrderAttributionResponse;
import com.bigbike.bigbike_backend.api.admin.dto.chat.AdminChatActionStatsResponse;
import com.bigbike.bigbike_backend.api.admin.dto.chat.AdminChatLeadFunnelResponse;
import com.bigbike.bigbike_backend.api.admin.dto.chat.AdminChatQualityStatsResponse;
import com.bigbike.bigbike_backend.api.error.NotFoundException;
import com.bigbike.bigbike_backend.mapper.ChatMapper;
import com.bigbike.bigbike_backend.persistence.entity.chat.ChatConversationEntity;
import com.bigbike.bigbike_backend.persistence.entity.chat.ChatLeadEntity;
import com.bigbike.bigbike_backend.persistence.repository.chat.ChatConversationJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.chat.ChatAiUsageEventJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.chat.ChatLeadJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.chat.ChatMessageJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.chat.ChatOrderAttributionJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.chat.ChatInteractionJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.cart.CartItemJpaRepository;
import com.bigbike.bigbike_backend.persistence.entity.chat.ChatMessageEntity;
import com.bigbike.bigbike_backend.persistence.entity.chat.ChatOrderAttributionEntity;
import com.bigbike.bigbike_backend.service.chat.ChatAssistantSettings;
import com.bigbike.bigbike_backend.service.chat.ChatAiQuotaService;
import com.bigbike.bigbike_backend.service.chat.ChatImageService;
import com.bigbike.bigbike_backend.service.common.PageResult;
import jakarta.persistence.criteria.Predicate;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.Map;
import java.util.LinkedHashMap;
import java.util.UUID;
import java.math.BigDecimal;
import java.math.RoundingMode;
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
    private final ChatAiUsageEventJpaRepository usageEventRepo;
    private final ChatMessageJpaRepository messageRepo;
    private final ChatLeadJpaRepository leadRepo;
    private final ChatOrderAttributionJpaRepository attributionRepo;
    private final ChatInteractionJpaRepository interactionRepo;
    private final CartItemJpaRepository cartItemRepo;
    private final ChatAssistantSettings assistantSettings;
    private final ChatAiQuotaService chatAiQuotaService;
    private final ChatImageService chatImageService;
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
        List<ChatMessageEntity> messageEntities = messageRepo
                .findByConversationIdOrderByCreatedAtAsc(id);
        Map<UUID, List<com.bigbike.bigbike_backend.api.chat.dto.ChatImageResponse>> imagesByMessage =
                chatImageService.referencesByMessageIds(
                        messageEntities.stream().map(ChatMessageEntity::getId).toList());
        List<AdminChatMessageResponse> messages = messageEntities.stream()
                .map(entity -> includeImages(
                        chatMapper.toMessage(entity),
                        imagesByMessage.getOrDefault(entity.getId(), List.of())))
                .toList();
        AdminChatLeadResponse lead = leadRepo.findByConversationId(id)
                .map(chatMapper::toLead)
                .orElse(null);
        List<ChatOrderAttributionEntity> attributions = attributionRepo.findByConversationId(id);
        ConversationMetrics metrics = summarize(
                messageRepo.findByConversationIdOrderByCreatedAtAsc(id), attributions);
        List<AdminChatOrderAttributionResponse> attributionResponses = attributions.stream()
                .map(item -> new AdminChatOrderAttributionResponse(
                        item.getOrderId(), item.getOrderLineItemId(),
                        item.getInteractionId(), item.getActionType(), item.getAttributedAmount(),
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
        ChatMessageJpaRepository.QualitySummary quality = messageRepo.summarizeQualityBetween(from, to);
        long assistedOrders = attributionRepo.countAssistedOrdersBetween(from, to);
        BigDecimal assistedRevenue = zero(attributionRepo.sumAssistedRevenueBetween(from, to));
        ChatAssistantSettings.Snapshot settings = assistantSettings.load("vi");
        int limit = settings.dailyLimit();
        Instant monthFrom = date.withDayOfMonth(1).atStartOfDay(VN_ZONE).toInstant();
        Instant monthTo = date.withDayOfMonth(1).plusMonths(1).atStartOfDay(VN_ZONE).toInstant();
        Map<String, CategoryCost> dayCosts = costMap(
                usageEventRepo.summarizeCategories(from, to));
        Map<String, CategoryCost> monthCosts = costMap(
                usageEventRepo.summarizeCategories(monthFrom, monthTo));
        BigDecimal legacyDayCost = zero(messageRepo.sumLegacyCostBetween(from, to));
        BigDecimal legacyMonthCost = zero(messageRepo.sumLegacyCostBetween(monthFrom, monthTo));
        BigDecimal textDayCost = categoryCost(dayCosts, "CUSTOMER_TEXT").add(legacyDayCost);
        BigDecimal textMonthCost = categoryCost(monthCosts, "CUSTOMER_TEXT").add(legacyMonthCost);
        BigDecimal imageDayCost = categoryCost(dayCosts, "CUSTOMER_IMAGE");
        BigDecimal imageMonthCost = categoryCost(monthCosts, "CUSTOMER_IMAGE");
        BigDecimal indexDayCost = categoryCost(dayCosts, "PRODUCT_IMAGE_INDEX");
        BigDecimal indexMonthCost = categoryCost(monthCosts, "PRODUCT_IMAGE_INDEX");
        BigDecimal evaluationDayCost = categoryCost(dayCosts, "EVALUATION");
        BigDecimal evaluationMonthCost = categoryCost(monthCosts, "EVALUATION");
        BigDecimal todayCost = textDayCost.add(imageDayCost).add(indexDayCost).add(evaluationDayCost);
        BigDecimal monthlyCost = textMonthCost.add(imageMonthCost)
                .add(indexMonthCost).add(evaluationMonthCost);
        long monthAiConversations = usageEventRepo
                .countCustomerAiConversationsBetween(monthFrom, monthTo);
        BigDecimal customerMonthCost = textMonthCost.add(imageMonthCost);
        BigDecimal averagePerConversation = monthAiConversations == 0
                ? BigDecimal.ZERO
                : customerMonthCost.divide(
                        BigDecimal.valueOf(monthAiConversations), 8, RoundingMode.HALF_UP);
        long fallbackToday = usageEventRepo.countFallbacksBetween(from, to);
        long fallbackMonth = usageEventRepo.countFallbacksBetween(monthFrom, monthTo);
        long monthTextMessages = usageEventRepo.countTextMessagesBetween(monthFrom, monthTo);
        BigDecimal fallbackRate = monthTextMessages == 0
                ? BigDecimal.ZERO
                : BigDecimal.valueOf(fallbackMonth)
                        .divide(BigDecimal.valueOf(monthTextMessages), 4, RoundingMode.HALF_UP);
        Instant monitorFrom = date.minusDays(13).atStartOfDay(VN_ZONE).toInstant();
        long giveUps14Days = messageRepo.countFallbackMessagesBetween(monitorFrom, to);
        long replies14Days = messageRepo.countAssistantRepliesBetween(monitorFrom, to);
        BigDecimal giveUpRate14Days = replies14Days == 0
                ? BigDecimal.ZERO
                : BigDecimal.valueOf(giveUps14Days)
                        .divide(BigDecimal.valueOf(replies14Days), 6, RoundingMode.HALF_UP);
        List<Integer> monitorLatencies = messageRepo.findAiReplyLatenciesBetween(monitorFrom, to);
        List<AdminChatModelUsageResponse> modelUsage = usageEventRepo
                .summarizeModels(monthFrom, monthTo).stream()
                .map(item -> new AdminChatModelUsageResponse(
                        item.getModelId(), value(item.getUses()), zero(item.getCostUsd())))
                .toList();
        BigDecimal warning = settings.monthlyCostWarningUsd();
        List<AdminChatActionStatsResponse> actionStats = actionStats(from, to);
        return new AdminChatStatsResponse(
                date, aiCalls, conversations, leads, unanswered,
                value(telemetry.getContentRefusals()), limit, Math.max(0, limit - aiCalls),
                value(telemetry.getInputTokens()), value(telemetry.getOutputTokens()),
                value(telemetry.getThinkingTokens()), value(telemetry.getProviderRequests()),
                rounded(telemetry.getAverageLatencyMs()), todayCost,
                assistedOrders, assistedRevenue,
                new AdminChatQualityStatsResponse(
                        value(quality.getAnswers()), value(quality.getProductResults()),
                        value(quality.getClarifications()), value(quality.getOutOfScope()),
                        value(telemetry.getContentRefusals())),
                new AdminChatLeadFunnelResponse(
                        conversationRepo.countByLeadOfferOpenedAtGreaterThanEqualAndLeadOfferOpenedAtLessThan(
                                from, to),
                        interactionRepo.countLeadPromptViewsBetween(1, from, to),
                        interactionRepo.countLeadPromptViewsBetween(2, from, to),
                        leads,
                        conversationRepo.countByLeadOfferStatusAndUpdatedAtGreaterThanEqualAndUpdatedAtLessThan(
                                "DECLINED", from, to)),
                actionStats,
                monthlyCost,
                warning,
                warning.signum() > 0 && monthlyCost.compareTo(warning) >= 0,
                new AdminChatCostStatsResponse(
                        todayCost, monthlyCost, averagePerConversation,
                        textDayCost, textMonthCost, imageDayCost, imageMonthCost,
                        indexDayCost, indexMonthCost, evaluationDayCost, evaluationMonthCost),
                new AdminChatFallbackStatsResponse(
                        fallbackToday, fallbackMonth, fallbackRate,
                        usageEventRepo.findLatestFallbackReason(monthFrom, monthTo),
                        giveUps14Days, replies14Days, giveUpRate14Days,
                        BigDecimal.valueOf(5).divide(BigDecimal.valueOf(58), 6, RoundingMode.HALF_UP),
                        percentile(monitorLatencies, 0.50),
                        percentile(monitorLatencies, 0.95)),
                modelUsage);
    }

    private static Map<String, CategoryCost> costMap(
            List<ChatAiUsageEventJpaRepository.CategoryCostSummary> summaries
    ) {
        Map<String, CategoryCost> values = new LinkedHashMap<>();
        summaries.forEach(item -> values.put(item.getCategory(), new CategoryCost(
                zero(item.getCostUsd()), value(item.getEventCount()))));
        return values;
    }

    private static AdminChatMessageResponse includeImages(
            AdminChatMessageResponse message,
            List<com.bigbike.bigbike_backend.api.chat.dto.ChatImageResponse> images
    ) {
        return new AdminChatMessageResponse(
                message.id(), message.sequenceNo(), message.role(), message.staffUserId(),
                message.staffDisplayName(), message.content(), message.source(), message.aiCalled(),
                message.answerFormat(), message.resultKind(), message.inputTokens(),
                message.outputTokens(), message.thinkingTokens(), message.providerRequestCount(),
                message.latencyMs(), message.estimatedCostUsd(), message.productsJson(),
                message.createdAt(), images);
    }

    private static BigDecimal categoryCost(Map<String, CategoryCost> costs, String category) {
        return costs.getOrDefault(category, CategoryCost.ZERO).costUsd();
    }

    private static Integer percentile(List<Integer> values, double fraction) {
        if (values == null || values.isEmpty()) return null;
        List<Integer> sorted = values.stream()
                .filter(value -> value != null && value >= 0)
                .sorted()
                .toList();
        if (sorted.isEmpty()) return null;
        int index = (int) Math.ceil(fraction * sorted.size()) - 1;
        return sorted.get(Math.max(0, Math.min(index, sorted.size() - 1)));
    }

    private List<AdminChatActionStatsResponse> actionStats(Instant from, Instant to) {
        Map<String, MutableActionStats> values = new LinkedHashMap<>();
        interactionRepo.summarizeActionClicksBetween(from, to).forEach(item ->
                values.computeIfAbsent(item.getActionType(), ignored -> new MutableActionStats())
                        .clicks = value(item.getClicks()));
        cartItemRepo.summarizeAssistantCartLinesBetween(from, to).forEach(item ->
                values.computeIfAbsent(item.getActionType(), ignored -> new MutableActionStats())
                        .cartLines = value(item.getCartLines()));
        attributionRepo.summarizeActionsBetween(from, to).forEach(item -> {
            MutableActionStats stats = values.computeIfAbsent(
                    item.getActionType(), ignored -> new MutableActionStats());
            stats.orders = value(item.getOrders());
            stats.revenue = zero(item.getRevenue());
        });
        return values.entrySet().stream().map(entry -> {
            MutableActionStats stats = entry.getValue();
            BigDecimal conversion = stats.clicks == 0 ? BigDecimal.ZERO
                    : BigDecimal.valueOf(stats.orders)
                            .divide(BigDecimal.valueOf(stats.clicks), 4, RoundingMode.HALF_UP);
            return new AdminChatActionStatsResponse(
                    entry.getKey(), stats.clicks, stats.cartLines, stats.orders,
                    stats.revenue, conversion);
        }).toList();
    }

    private static final class MutableActionStats {
        private long clicks;
        private long cartLines;
        private long orders;
        private BigDecimal revenue = BigDecimal.ZERO;
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

    private record CategoryCost(BigDecimal costUsd, long eventCount) {
        private static final CategoryCost ZERO = new CategoryCost(BigDecimal.ZERO, 0);
    }
}
