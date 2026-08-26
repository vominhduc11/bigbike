package com.bigbike.bigbike_backend.service.admin;

import com.bigbike.bigbike_backend.api.admin.dto.chat.AdminChatDataGapResponse;
import com.bigbike.bigbike_backend.api.admin.dto.chat.AdminChatFunnelResponse;
import com.bigbike.bigbike_backend.api.admin.dto.chat.AdminChatUnansweredResponse;
import com.bigbike.bigbike_backend.domain.catalog.PublishStatus;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductVariantOptionEntity;
import com.bigbike.bigbike_backend.persistence.entity.chat.ChatMessageEntity;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ProductJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.chat.ChatConversationJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.chat.ChatInteractionJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.chat.ChatMessageJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.chat.ChatOrderAttributionJpaRepository;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.regex.Pattern;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AdminChatInsightsService {

    private static final ZoneId VN_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
    private static final Pattern RAW_OPTION = Pattern.compile(
            "^[a-z0-9]+(?:[-_][a-z0-9]+)+$", Pattern.CASE_INSENSITIVE);

    private final ChatConversationJpaRepository conversationRepo;
    private final ChatInteractionJpaRepository interactionRepo;
    private final ChatOrderAttributionJpaRepository attributionRepo;
    private final ChatMessageJpaRepository messageRepo;
    private final ProductJpaRepository productRepo;

    public AdminChatFunnelResponse funnel(LocalDate requestedFrom, LocalDate requestedTo) {
        LocalDate toDate = requestedTo == null ? LocalDate.now(VN_ZONE) : requestedTo;
        LocalDate fromDate = requestedFrom == null ? toDate.minusDays(6) : requestedFrom;
        if (fromDate.isAfter(toDate)) {
            LocalDate swap = fromDate;
            fromDate = toDate;
            toDate = swap;
        }
        Instant from = fromDate.atStartOfDay(VN_ZONE).toInstant();
        Instant to = toDate.plusDays(1).atStartOfDay(VN_ZONE).toInstant();
        long conversations = conversationRepo.countByStartedAtGreaterThanEqualAndStartedAtLessThan(from, to);
        long views = interactionRepo.countFunnelEventsForConversationCohort("PRODUCT_VIEWED", from, to);
        long carts = interactionRepo.countFunnelEventsForConversationCohort("CART_ADDED", from, to);
        long orders = attributionRepo.countOrdersForConversationCohort(from, to);
        BigDecimal revenue = zero(attributionRepo.sumRevenueForConversationCohort(from, to));
        Instant matureThrough = Instant.now().minus(168, java.time.temporal.ChronoUnit.HOURS);
        boolean complete = !to.isAfter(matureThrough);
        return new AdminChatFunnelResponse(
                fromDate, toDate, conversations, views, carts, orders, revenue,
                rate(views, conversations), rate(carts, views), rate(orders, carts),
                matureThrough, complete);
    }

    public List<AdminChatUnansweredResponse> unanswered(LocalDate requestedFrom, LocalDate requestedTo) {
        LocalDate toDate = requestedTo == null ? LocalDate.now(VN_ZONE) : requestedTo;
        LocalDate fromDate = requestedFrom == null ? toDate.minusDays(6) : requestedFrom;
        if (fromDate.isAfter(toDate)) {
            LocalDate swap = fromDate;
            fromDate = toDate;
            toDate = swap;
        }
        Instant from = fromDate.atStartOfDay(VN_ZONE).toInstant();
        Instant to = toDate.plusDays(1).atStartOfDay(VN_ZONE).toInstant();
        return messageRepo
                .findByRoleAndCreatedAtGreaterThanEqualAndCreatedAtLessThanOrderByCreatedAtDesc(
                        "ASSISTANT", from, to).stream()
                .filter(AdminChatInsightsService::isUnanswered)
                .map(message -> new AdminChatUnansweredResponse(
                        message.getConversationId(), message.getId(),
                        precedingQuestion(message), unansweredReason(message), message.getCreatedAt()))
                .toList();
    }

    public AdminChatDataGapResponse dataGaps() {
        List<AdminChatDataGapResponse.ProductGap> items = productRepo.findAll().stream()
                .filter(product -> product.getPublishStatus() == PublishStatus.PUBLISHED)
                .filter(product -> !product.isDiscontinued())
                .map(this::productGap)
                .filter(gap -> !gap.gaps().isEmpty())
                .sorted(Comparator
                        .comparingInt((AdminChatDataGapResponse.ProductGap gap) -> impactScore(gap.gaps()))
                        .reversed()
                        .thenComparing(AdminChatDataGapResponse.ProductGap::name,
                                Comparator.nullsLast(String.CASE_INSENSITIVE_ORDER)))
                .toList();
        return new AdminChatDataGapResponse(
                items.size(),
                countGap(items, "MISSING_SIZE_GUIDE"),
                countGap(items, "MISSING_SPECIFICATIONS"),
                countGap(items, "RAW_OPTION"),
                countGap(items, "NO_ACCESSORIES"),
                items);
    }

    private AdminChatDataGapResponse.ProductGap productGap(ProductEntity product) {
        List<String> gaps = new ArrayList<>();
        if (!hasSizeGuide(product)) gaps.add("MISSING_SIZE_GUIDE");
        if (!hasText(product.getSpecifications())) gaps.add("MISSING_SPECIFICATIONS");
        List<String> rawOptions = rawOptions(product);
        if (!rawOptions.isEmpty()) gaps.add("RAW_OPTION");
        if (product.getAccessoryProducts() == null || product.getAccessoryProducts().isEmpty()) {
            gaps.add("NO_ACCESSORIES");
        }
        return new AdminChatDataGapResponse.ProductGap(
                product.getId(), product.getSlug(), product.getName(),
                List.copyOf(gaps), rawOptions);
    }

    private static boolean hasSizeGuide(ProductEntity product) {
        if (hasText(product.getSizeGuide())) return true;
        var section = product.getSizeGuideSection();
        return section != null && (hasText(section.getHtml()) || hasText(section.getHtmlEn()));
    }

    private static List<String> rawOptions(ProductEntity product) {
        if (product.getVariants() == null) return List.of();
        Set<String> values = new LinkedHashSet<>();
        product.getVariants().stream()
                .filter(variant -> variant != null && variant.getOptions() != null)
                .flatMap(variant -> variant.getOptions().stream())
                .map(ProductVariantOptionEntity::getOptionValue)
                .filter(AdminChatInsightsService::hasText)
                .map(String::trim)
                .filter(value -> RAW_OPTION.matcher(value).matches())
                .limit(50)
                .forEach(values::add);
        return List.copyOf(values);
    }

    private String precedingQuestion(ChatMessageEntity assistant) {
        return messageRepo.findByConversationIdOrderByCreatedAtAsc(assistant.getConversationId()).stream()
                .filter(message -> "CUSTOMER".equals(message.getRole()))
                .filter(message -> message.getCreatedAt() == null || assistant.getCreatedAt() == null
                        || !message.getCreatedAt().isAfter(assistant.getCreatedAt()))
                .reduce((left, right) -> right)
                .map(ChatMessageEntity::getContent)
                .map(AdminChatInsightsService::shortText)
                .orElse("");
    }

    private static boolean isUnanswered(ChatMessageEntity message) {
        return "UNANSWERED".equals(message.getOutcomeCode())
                || "MISSING_SIZE_GUIDE".equals(message.getOutcomeCode())
                || "CONTACT_FALLBACK".equals(message.getSource())
                || "CLARIFICATION".equals(message.getResultKind())
                        && (message.getProductsJson() == null || message.getProductsJson().isBlank());
    }

    private static String unansweredReason(ChatMessageEntity message) {
        return hasText(message.getOutcomeCode()) ? message.getOutcomeCode() : message.getSource();
    }

    private static String shortText(String value) {
        if (value == null) return "";
        String clean = value.replaceAll("\\s+", " ").trim();
        return clean.length() <= 300 ? clean : clean.substring(0, 297) + "…";
    }

    private static long countGap(List<AdminChatDataGapResponse.ProductGap> items, String gap) {
        return items.stream().filter(item -> item.gaps().contains(gap)).count();
    }

    private static int impactScore(List<String> gaps) {
        int score = 0;
        if (gaps.contains("MISSING_SIZE_GUIDE")) score += 8;
        if (gaps.contains("MISSING_SPECIFICATIONS")) score += 5;
        if (gaps.contains("RAW_OPTION")) score += 4;
        if (gaps.contains("NO_ACCESSORIES")) score += 2;
        return score;
    }

    private static BigDecimal rate(long numerator, long denominator) {
        return denominator <= 0 ? BigDecimal.ZERO
                : BigDecimal.valueOf(numerator)
                        .divide(BigDecimal.valueOf(denominator), 4, RoundingMode.HALF_UP);
    }

    private static BigDecimal zero(BigDecimal value) {
        return value == null ? BigDecimal.ZERO : value;
    }

    private static boolean hasText(String value) {
        return value != null && !value.isBlank();
    }
}
