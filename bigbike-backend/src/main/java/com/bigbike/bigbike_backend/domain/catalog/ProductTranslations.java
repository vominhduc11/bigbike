package com.bigbike.bigbike_backend.domain.catalog;

/**
 * Raw English content of a product, exposed only on admin product reads so the
 * editor can show both languages side by side. {@code null} on public reads.
 *
 * <p>Vietnamese content stays on the main {@link Product} fields (canonical).
 * English is optional per {@code BUSINESS_RULES.md PRODUCT_RULE_001}.
 */
public record ProductTranslations(ProductContent en) {

    /** English values of the eight translatable product-level text fields. */
    public record ProductContent(
            String name,
            String shortDescription,
            String description,
            String promotionContent,
            String installationGuide,
            String seoTitle,
            String seoDescription
    ) {
    }
}
