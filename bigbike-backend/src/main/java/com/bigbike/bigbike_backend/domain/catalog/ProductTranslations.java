package com.bigbike.bigbike_backend.domain.catalog;

/**
 * Raw English content of a product, exposed only on admin product reads so the
 * editor can show both languages side by side. {@code null} on public reads.
 *
 * <p>Vietnamese content stays on the main {@link Product} fields (canonical).
 * English is optional per {@code BUSINESS_RULES.md PRODUCT_RULE_001}.
 */
public record ProductTranslations(ProductContent en) {

    /** English values of the translatable product-level fields. */
    public record ProductContent(
            String name,
            String shortDescription,
            String description,
            /** English "Phù hợp với ai" advisory HTML (V237). */
            String suitabilityAdvisory,
            /** English specs HTML override (V255); "html thắng" cho khối Thông số kỹ thuật. */
            String specifications,
            /** English "Ô số liệu nổi bật" HTML (V256); nguồn render khi non-blank. */
            String specStats,
            /** English "Dải tin cậy" HTML (V257); nguồn render khi non-blank. */
            String trustBadges,
            /** English "Quick Answer" summary (V300), max 600 ký tự. */
            String quickAnswerSummary,
            String seoTitle,
            String seoDescription,
            /** English "Thương hiệu [nước]" (V319). */
            String originBrandCountry
    ) {
    }
}
