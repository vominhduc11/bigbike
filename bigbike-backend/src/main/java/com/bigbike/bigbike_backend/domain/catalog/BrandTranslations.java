package com.bigbike.bigbike_backend.domain.catalog;

/**
 * Raw English content of a brand, exposed only on admin detail reads so the
 * editor can show both languages side by side. {@code null} on public reads.
 *
 * <p>Vietnamese content stays on the main {@link Brand} fields (canonical).
 * English is optional per {@code BUSINESS_RULES.md BRAND_RULE_001}.
 */
public record BrandTranslations(BrandContent en) {

    /** English values of the four translatable brand-level text fields. */
    public record BrandContent(
            String name,
            String description,
            String seoTitle,
            String seoDescription
    ) {
    }
}
