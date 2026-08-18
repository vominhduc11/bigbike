package com.bigbike.bigbike_backend.api.admin.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class ArticleTranslationRequest {

    @Valid
    private ArticleContentRequest en;

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ArticleContentRequest {

        /** Optional English URL slug (V216). Empty/blank → fall back to the vi slug. */
        @Pattern(regexp = "^[a-z0-9]+(?:-[a-z0-9]+)*$", message = "English slug must be lowercase alphanumeric with hyphens.")
        @Size(max = 100, message = "English slug must be at most 100 characters.")
        private String slug;

        @Size(max = 255, message = "EN title is too long.")
        private String title;

        @Size(max = 5000, message = "EN excerpt is too long.")
        private String excerpt;

        @Size(max = 65535, message = "EN body is too long.")
        private String body;

        @Size(max = 255, message = "EN author name is too long.")
        private String authorName;

        @Size(max = 255, message = "EN SEO title is too long.")
        private String seoTitle;

        private String seoDescription;
    }
}
