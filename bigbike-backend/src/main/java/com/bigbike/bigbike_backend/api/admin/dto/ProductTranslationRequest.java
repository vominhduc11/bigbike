package com.bigbike.bigbike_backend.api.admin.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * English content for a product upsert (V136), entered manually by the admin (no auto-translation).
 *
 * <p>Per {@code BUSINESS_RULES.md PRODUCT_RULE_001/TRANSLATION_RULE_002}: {@code name} is required
 * (validated in {@code CatalogRequestValidator}, mirroring the Vietnamese {@code name} field being
 * required) — every other field is optional and may be left blank. Length limits mirror the
 * Vietnamese fields on {@link UpsertProductRequest}.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class ProductTranslationRequest {

    @Valid
    private ProductContentRequest en;

    /** English values of the eight translatable product-level text fields. */
    @Getter
    @Setter
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ProductContentRequest {

        /** Optional English URL slug (V214). Empty/blank → fall back to the vi slug. */
        @Pattern(regexp = "^[a-z0-9]+(?:-[a-z0-9]+)*$", message = "English slug must be lowercase alphanumeric with hyphens.")
        @Size(max = 100, message = "English slug must be at most 100 characters.")
        private String slug;

        @Size(max = 255, message = "English name is too long.")
        private String name;

        @Size(max = 2000, message = "English short description is too long.")
        private String shortDescription;

        @Size(max = 20000, message = "English description is too long.")
        private String description;

        @Size(max = 20000, message = "English size guide is too long.")
        private String sizeGuide;

        @Size(max = 20000, message = "English suitability advisory is too long.")
        private String suitabilityAdvisory;

        @Size(max = 50000, message = "English specifications HTML is too long.")
        private String specifications;

        @Size(max = 50000, message = "English spec stats HTML is too long.")
        private String specStats;

        @Size(max = 50000, message = "English trust badges HTML is too long.")
        private String trustBadges;

        @Size(max = 600, message = "English quick answer is too long.")
        private String quickAnswerSummary;

        @Size(max = 255, message = "English SEO title is too long.")
        private String seoTitle;

        @Size(max = 5000, message = "English SEO description is too long.")
        private String seoDescription;

        @Size(max = 120, message = "English origin brand country is too long.")
        private String originBrandCountry;
    }
}
