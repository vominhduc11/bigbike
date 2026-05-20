package com.bigbike.bigbike_backend.api.admin.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Optional English content for a category upsert (V137).
 *
 * <p>English is optional per {@code BUSINESS_RULES.md CATEGORY_RULE_001}: every
 * field may be left blank and the category still saves. Only length is validated.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class CategoryTranslationRequest {

    @Valid
    private CategoryContentRequest en;

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CategoryContentRequest {

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
