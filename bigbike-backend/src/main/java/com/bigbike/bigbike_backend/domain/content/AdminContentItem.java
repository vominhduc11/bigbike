package com.bigbike.bigbike_backend.domain.content;

import com.bigbike.bigbike_backend.domain.catalog.DescriptionBlock;
import com.bigbike.bigbike_backend.domain.catalog.ImageAsset;
import com.bigbike.bigbike_backend.domain.catalog.PublishStatus;
import com.bigbike.bigbike_backend.domain.catalog.SeoMeta;
import java.time.Instant;
import java.util.List;

public record AdminContentItem(
        String id,
        String type,
        String slug,
        /** Optional English URL slug (V216). Articles only; null for pages. */
        String slugEn,
        String title,
        String excerpt,
        String body,
        ImageAsset coverImage,
        ImageAsset productImage,
        PublishStatus publishStatus,
        /** Featured article flag (V222). Articles only; false for pages. */
        boolean featured,
        /** Homepage Experience carousel pick flag (V272). Articles only; false for pages. */
        boolean homeExperience,
        SeoMeta seo,
        Instant publishedAt,
        Instant createdAt,
        Instant updatedAt,
        String parentId,
        ImageAsset heroImage,
        String heroTitle,
        String heroDescription,
        String heroKicker,
        /** Structured body blocks (V140). Non-null only on admin detail reads. */
        List<DescriptionBlock> bodyBlocks,
        /** English translations (V138). Non-null only on admin detail reads. Serializes as {@code {en: {...}}} per API_CONTRACT §"Article EN translations on admin read". */
        ArticleTranslations translations,
        /** Optional localized author name (ARTICLE_RULE_007). */
        String authorName
) {
}
