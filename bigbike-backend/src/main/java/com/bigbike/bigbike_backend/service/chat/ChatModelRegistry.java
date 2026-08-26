package com.bigbike.bigbike_backend.service.chat;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import org.springframework.stereotype.Component;

/**
 * Effective-dated standard Gemini pricing verified against Google's official pricing page.
 * Account availability is deliberately resolved elsewhere through models.list.
 */
@Component
public class ChatModelRegistry {

    public static final String PRICING_SOURCE = "https://ai.google.dev/gemini-api/docs/pricing";

    private static final List<ModelPrice> PRICES = List.of(
            price("gemini-2.5-flash-lite", "Gemini 2.5 Flash-Lite", "FASTEST", "CHEAPEST",
                    "Nhanh nhất, phù hợp khi ưu tiên phản hồi tức thì.",
                    "Fastest; best when instant replies matter most.",
                    "Rẻ nhất trong nhóm đang hỗ trợ.", "Lowest cost among supported choices.",
                    "0.10", "0.40", LocalDate.of(2026, 8, 26), null),
            price("gemini-3.1-flash-lite", "Gemini 3.1 Flash-Lite", "VERY_FAST", "LOW",
                    "Rất nhanh, hiểu câu phức tạp tốt hơn nhóm cơ bản.",
                    "Very fast, with stronger understanding than the basic tier.",
                    "Chi phí thấp.", "Low cost.",
                    "0.25", "1.50", LocalDate.of(2026, 8, 26), null),
            price("gemini-3.5-flash-lite", "Gemini 3.5 Flash-Lite", "VERY_FAST", "MEDIUM",
                    "Rất nhanh, tối ưu cho lượng hỏi lớn.",
                    "Very fast and optimized for high-volume requests.",
                    "Chi phí vừa phải.", "Moderate cost.",
                    "0.30", "2.50", LocalDate.of(2026, 8, 26), null),
            price("gemini-2.5-flash", "Gemini 2.5 Flash", "FAST", "MEDIUM",
                    "Nhanh và cân bằng; đây là mốc đang dùng để so sánh.",
                    "Fast and balanced; this is the current comparison baseline.",
                    "Chi phí vừa phải.", "Moderate cost.",
                    "0.30", "2.50", LocalDate.of(2026, 8, 26), null),
            price("gemini-3.7-flash", "Gemini 3.7 Flash", "BALANCED", "HIGH",
                    "Mạnh hơn cho câu nhiều bước, thường chậm hơn bản Lite.",
                    "Stronger for multi-step questions and usually slower than Lite.",
                    "Chi phí cao hơn bản Flash 2.5.", "Higher cost than Flash 2.5.",
                    "0.75", "3.75", LocalDate.of(2026, 8, 26), LocalDate.of(2027, 1, 1)),
            price("gemini-3.7-flash", "Gemini 3.7 Flash", "BALANCED", "HIGH",
                    "Mạnh hơn cho câu nhiều bước, thường chậm hơn bản Lite.",
                    "Stronger for multi-step questions and usually slower than Lite.",
                    "Chi phí cao hơn bản Flash 2.5.", "Higher cost than Flash 2.5.",
                    "1.50", "7.50", LocalDate.of(2027, 1, 1), null),
            price("gemini-3.6-flash", "Gemini 3.6 Flash", "BALANCED", "HIGH",
                    "Mạnh cho câu nhiều bước, thường chậm hơn bản Lite.",
                    "Strong for multi-step questions and usually slower than Lite.",
                    "Chi phí cao hơn bản Flash 2.5.", "Higher cost than Flash 2.5.",
                    "0.75", "3.75", LocalDate.of(2026, 8, 26), LocalDate.of(2027, 1, 1)),
            price("gemini-3.6-flash", "Gemini 3.6 Flash", "BALANCED", "HIGH",
                    "Mạnh cho câu nhiều bước, thường chậm hơn bản Lite.",
                    "Strong for multi-step questions and usually slower than Lite.",
                    "Chi phí cao hơn bản Flash 2.5.", "Higher cost than Flash 2.5.",
                    "1.50", "7.50", LocalDate.of(2027, 1, 1), null),
            price("gemini-3.5-flash", "Gemini 3.5 Flash", "BALANCED", "EXPENSIVE",
                    "Mạnh nhưng thường chậm hơn và cần theo dõi timeout.",
                    "Strong, but usually slower and needs timeout monitoring.",
                    "Đắt hơn rõ rệt.", "Significantly more expensive.",
                    "1.50", "9.00", LocalDate.of(2026, 8, 26), null),
            price("gemini-2.5-pro", "Gemini 2.5 Pro", "SLOWER", "EXPENSIVE",
                    "Suy luận kỹ hơn nhưng thường chậm nhất trong danh sách.",
                    "Deeper reasoning, but usually the slowest listed choice.",
                    "Đắt nhất trong nhóm so sánh thông thường.",
                    "Most expensive in the normal comparison set.",
                    "1.25", "10.00", LocalDate.of(2026, 8, 26), null)
    );

    public Optional<ModelPrice> price(String modelId, LocalDate onDate) {
        if (modelId == null || onDate == null) return Optional.empty();
        return PRICES.stream()
                .filter(item -> item.modelId().equals(modelId))
                .filter(item -> !onDate.isBefore(item.effectiveFrom()))
                .filter(item -> item.effectiveTo() == null || onDate.isBefore(item.effectiveTo()))
                .max(Comparator.comparing(ModelPrice::effectiveFrom));
    }

    public List<ModelPrice> active(LocalDate onDate) {
        return PRICES.stream()
                .map(ModelPrice::modelId)
                .distinct()
                .map(id -> price(id, onDate).orElse(null))
                .filter(java.util.Objects::nonNull)
                .toList();
    }

    private static ModelPrice price(
            String id,
            String name,
            String speedTier,
            String costTier,
            String speedVi,
            String speedEn,
            String costVi,
            String costEn,
            String input,
            String output,
            LocalDate from,
            LocalDate to
    ) {
        return new ModelPrice(id, name, speedTier, costTier, speedVi, speedEn, costVi, costEn,
                new BigDecimal(input), new BigDecimal(output), true, from, to, PRICING_SOURCE);
    }

    public record ModelPrice(
            String modelId,
            String displayName,
            String speedTier,
            String costTier,
            String speedDescriptionVi,
            String speedDescriptionEn,
            String costDescriptionVi,
            String costDescriptionEn,
            BigDecimal inputUsdPerMillion,
            BigDecimal outputUsdPerMillion,
            boolean supportsImages,
            LocalDate effectiveFrom,
            LocalDate effectiveTo,
            String pricingSource
    ) {}
}
