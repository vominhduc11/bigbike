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
public class PageTranslationRequest {

    @Valid
    private PageContentRequest en;

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    public static class PageContentRequest {

        @Size(max = 255, message = "EN title is too long.")
        private String title;

        private String body;

        @Size(max = 256, message = "EN hero title is too long.")
        private String heroTitle;

        @Size(max = 1024, message = "EN hero description is too long.")
        private String heroDescription;

        @Size(max = 128, message = "EN hero kicker is too long.")
        private String heroKicker;

        @Size(max = 255, message = "EN SEO title is too long.")
        private String seoTitle;

        private String seoDescription;
    }
}
