package com.bigbike.bigbike_backend.domain.content;

/**
 * Unified translation container returned on admin detail reads (V138).
 * Only Article translations remain — the static Pages module was removed (V271).
 */
public record ContentTranslations(
        ArticleTranslations article
) {

    public static ContentTranslations fromArticle(ArticleTranslations translations) {
        return new ContentTranslations(translations);
    }
}
