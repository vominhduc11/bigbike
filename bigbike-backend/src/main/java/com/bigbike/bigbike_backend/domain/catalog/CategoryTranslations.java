package com.bigbike.bigbike_backend.domain.catalog;

/**
 * Raw English content of a category, exposed only on admin detail reads so the
 * editor can show both languages side by side. {@code null} on public reads.
 *
 * <p>Vietnamese content stays on the main {@link Category} fields (canonical).
 * English is optional per {@code BUSINESS_RULES.md CATEGORY_RULE_001}.
 */
public record CategoryTranslations(CategoryContent en) {

    /** English values of the four translatable category-level text fields. */
    public record CategoryContent(
            String name,
            String description,
            String seoTitle,
            String seoDescription
    ) {
    }
}
