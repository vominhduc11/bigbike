package com.bigbike.bigbike_backend.domain.catalog;

import java.util.List;

/**
 * Raw English content of a product, exposed only on admin product reads so the
 * editor can show both languages side by side. {@code null} on public reads.
 *
 * <p>Vietnamese content stays on the main {@link Product} fields (canonical).
 * English is optional per {@code BUSINESS_RULES.md PRODUCT_RULE_001}.
 */
public record ProductTranslations(ProductContent en, java.util.List<String> overrides) {

    /** English values of the translatable product-level fields. */
    public record ProductContent(
            String name,
            String shortDescription,
            String description,
            String promotionContent,
            String installationGuide,
            /** English "Phù hợp với ai" advisory HTML (V237). */
            String suitabilityAdvisory,
            /** English specs HTML override (V255); "html thắng" cho khối Thông số kỹ thuật. */
            String specificationsHtml,
            /** English "Ô số liệu nổi bật" HTML (V256); nguồn render khi non-blank. */
            String specStatsHtml,
            /** English "Dải tin cậy" HTML (V257); nguồn render khi non-blank. */
            String trustBadgesHtml,
            /** English "Quick Answer" summary (V300), max 600 ký tự. */
            String quickAnswerSummary,
            String seoTitle,
            String seoDescription,
            /** English structured description blocks (V229); null when authored as legacy HTML. */
            List<DescriptionBlock> descriptionBlocks
    ) {
    }
}
