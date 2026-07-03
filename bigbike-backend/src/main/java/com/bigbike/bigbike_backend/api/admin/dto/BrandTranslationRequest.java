package com.bigbike.bigbike_backend.api.admin.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * English content for a brand upsert (V137), entered manually by the admin (no auto-translation).
 *
 * <p>Per {@code BUSINESS_RULES.md BRAND_RULE_001/TRANSLATION_RULE_002}: {@code name} is required
 * (validated in {@code CatalogRequestValidator}, mirroring the Vietnamese {@code name} field being
 * required) — every other field is optional and may be left blank. Only length is validated.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class BrandTranslationRequest {

    @Valid
    private BrandContentRequest en;

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    public static class BrandContentRequest {

        /** Optional English URL slug (V215). Empty/blank → fall back to the vi slug. */
        @Pattern(regexp = "^[a-z0-9]+(?:-[a-z0-9]+)*$", message = "English slug must be lowercase alphanumeric with hyphens.")
        @Size(max = 100, message = "English slug must be at most 100 characters.")
        private String slug;

        @Size(max = 255, message = "English name is too long.")
        private String name;

        @Size(max = 5000, message = "English description is too long.")
        private String description;

        @Size(max = 255, message = "English SEO title is too long.")
        private String seoTitle;

        @Size(max = 5000, message = "English SEO description is too long.")
        private String seoDescription;
    }
}
