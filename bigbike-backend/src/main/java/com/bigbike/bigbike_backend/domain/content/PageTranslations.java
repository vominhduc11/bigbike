package com.bigbike.bigbike_backend.domain.content;

/** English translations for a static page. Non-null only on admin detail reads (V138). */
public record PageTranslations(PageContent en) {

    public record PageContent(
            String title,
            String body,
            String heroTitle,
            String heroDescription,
            String heroKicker,
            String seoTitle,
            String seoDescription
    ) {}
}
