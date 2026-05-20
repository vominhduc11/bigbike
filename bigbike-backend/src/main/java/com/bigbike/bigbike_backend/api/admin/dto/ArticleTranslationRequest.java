package com.bigbike.bigbike_backend.api.admin.dto;

import jakarta.validation.Valid;
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

        @Size(max = 255, message = "EN title is too long.")
        private String title;

        @Size(max = 5000, message = "EN excerpt is too long.")
        private String excerpt;

        private String body;

        @Size(max = 255, message = "EN SEO title is too long.")
        private String seoTitle;

        private String seoDescription;
    }
}
