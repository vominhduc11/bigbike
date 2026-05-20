package com.bigbike.bigbike_backend.domain.content;

/** English translations for an article. Non-null only on admin detail reads (V138). */
public record ArticleTranslations(ArticleContent en) {

    public record ArticleContent(
            String title,
            String excerpt,
            String body,
            String seoTitle,
            String seoDescription
    ) {}
}
