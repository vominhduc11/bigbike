package com.bigbike.bigbike_backend.domain.content;

/**
 * Unified translation container returned on admin detail reads (V138).
 * Wraps either ArticleTranslations or PageTranslations — exactly one will be non-null.
 */
public record ContentTranslations(
        ArticleTranslations article,
        PageTranslations page
) {

    public static ContentTranslations fromArticle(ArticleTranslations translations) {
        return new ContentTranslations(translations, null);
    }

    public static ContentTranslations fromPage(PageTranslations translations) {
        return new ContentTranslations(null, translations);
    }
}
