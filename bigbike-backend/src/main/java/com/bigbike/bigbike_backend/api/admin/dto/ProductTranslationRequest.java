package com.bigbike.bigbike_backend.api.admin.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Optional English content for a product upsert (V136).
 *
 * <p>English is optional per {@code BUSINESS_RULES.md PRODUCT_RULE_001}: every
 * field may be left blank and the product still saves. Only length is validated;
 * limits mirror the Vietnamese fields on {@link UpsertProductRequest}.
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

        @Size(max = 255, message = "English name is too long.")
        private String name;

        @Size(max = 2000, message = "English short description is too long.")
        private String shortDescription;

        @Size(max = 20000, message = "English description is too long.")
        private String description;

        @Size(max = 50000, message = "English content bottom is too long.")
        private String contentBottom;

        @Size(max = 50000, message = "English promotion content is too long.")
        private String promotionContent;

        @Size(max = 50000, message = "English installation guide is too long.")
        private String installationGuide;

        @Size(max = 255, message = "English SEO title is too long.")
        private String seoTitle;

        @Size(max = 5000, message = "English SEO description is too long.")
        private String seoDescription;
    }
}
