package com.bigbike.bigbike_backend.api.admin.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * English content for a brand upsert (V137), entered manually by the admin (no auto-translation).
 *
 * <p>Per {@code BUSINESS_RULES.md BRAND_RULE_001/003}: brand {@code name} and {@code slug}
 * are shared across locales. {@code en.name}/{@code en.slug} are accepted only for old clients
 * and ignored by mutation/display logic. Every real translated field is optional and may be left
 * blank. Only length/format is validated.
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

        /** Legacy compatibility field. Brand URL always uses the top-level {@code slug}. */
        private String slug;

        /** Legacy compatibility field. Brand display name always uses the top-level {@code name}. */
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
