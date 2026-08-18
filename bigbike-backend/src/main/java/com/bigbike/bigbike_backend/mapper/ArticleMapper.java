package com.bigbike.bigbike_backend.mapper;

import com.bigbike.bigbike_backend.domain.catalog.DescriptionBlock;
import com.bigbike.bigbike_backend.domain.catalog.ImageAsset;
import com.bigbike.bigbike_backend.domain.catalog.PublishStatus;
import com.bigbike.bigbike_backend.domain.catalog.SeoIndexPolicy;
import com.bigbike.bigbike_backend.domain.catalog.SeoMeta;
import com.bigbike.bigbike_backend.domain.content.AdminContentItem;
import com.bigbike.bigbike_backend.domain.content.Article;
import com.bigbike.bigbike_backend.domain.content.ArticleTranslations;
import com.bigbike.bigbike_backend.persistence.entity.content.ArticleEntity;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.ReportingPolicy;
import java.util.List;

@Mapper(componentModel = "spring", unmappedTargetPolicy = ReportingPolicy.ERROR)
public interface ArticleMapper {

    @Mapping(target = "type", constant = "ARTICLE")
    @Mapping(target = "parentId", ignore = true)
    @Mapping(target = "heroImage", ignore = true)
    @Mapping(target = "heroTitle", ignore = true)
    @Mapping(target = "heroDescription", ignore = true)
    @Mapping(target = "heroKicker", ignore = true)
    AdminContentItem toAdminContentItem(Article article);

    default Article toDomain(ArticleEntity entity, String locale, boolean includeTranslations) {
        if (entity == null) {
            return null;
        }
        return new Article(
                entity.getId(),
                entity.getSlug(),
                entity.getSlugEn(),
                pick(entity.getTitle(), entity.getTitleEn(), locale),
                pick(entity.getExcerpt(), entity.getExcerptEn(), locale),
                pick(entity.getBody(), entity.getBodyEn(), locale),
                toImageAsset(
                        entity.getCoverImageId(),
                        entity.getCoverImageUrl(),
                        entity.getCoverImageAlt(),
                        entity.getCoverImageWidth(),
                        entity.getCoverImageHeight(),
                        entity.getCoverImageMimeType()
                ),
                toImageAsset(null, entity.getProductImageUrl(), entity.getProductImageAlt(), null, null, null),
                entity.getPublishStatus(),
                entity.isFeatured(),
                entity.isHomeExperience(),
                toSeoMeta(
                        pick(entity.getSeoTitle(), entity.getSeoTitleEn(), locale),
                        pick(entity.getSeoDescription(), entity.getSeoDescriptionEn(), locale),
                        entity.getSeoCanonicalUrl(),
                        entity.getSeoOgImageId(),
                        entity.getSeoOgImageUrl(),
                        entity.getSeoOgImageAlt(),
                        entity.getSeoOgImageWidth(),
                        entity.getSeoOgImageHeight(),
                        entity.getSeoOgImageMimeType(),
                        // V371: cờ tách theo ngôn ngữ + ngưỡng đủ nội dung EN (SEO_RULE_001/002).
                        SeoIndexPolicy.resolveNoIndex(
                                locale,
                                entity.isSeoNoIndex(),
                                entity.isSeoNoIndexEn(),
                                SeoIndexPolicy.articleEnglishReady(entity.getTitleEn(), entity.getBodyEn())
                        )
                ),
                includeTranslations ? toArticleTranslations(entity) : null,
                entity.getPublishedAt(),
                entity.getCreatedAt(),
                entity.getUpdatedAt(),
                includeTranslations ? entity.getBodyBlocks() : null,
                pick(entity.getAuthorName(), entity.getAuthorNameEn(), locale)
        );
    }

    private String pick(String base, String en, String locale) {
        return "en".equals(locale) && en != null && !en.isBlank() ? en : base;
    }

    private ImageAsset toImageAsset(
            String id, String url, String alt, Integer width, Integer height, String mimeType) {
        if (url == null || url.isBlank()) {
            return null;
        }
        return new ImageAsset(id, url, alt, width, height, mimeType);
    }

    private SeoMeta toSeoMeta(
            String title, String description, String canonicalUrl,
            String ogImageId, String ogImageUrl, String ogImageAlt,
            Integer ogImageWidth, Integer ogImageHeight, String ogImageMimeType,
            boolean noIndex) {
        if (!noIndex
                && (title == null || title.isBlank())
                && (description == null || description.isBlank())
                && (canonicalUrl == null || canonicalUrl.isBlank())
                && (ogImageUrl == null || ogImageUrl.isBlank())) {
            return null;
        }
        return new SeoMeta(
                title, description, canonicalUrl,
                toImageAsset(ogImageId, ogImageUrl, ogImageAlt, ogImageWidth, ogImageHeight, ogImageMimeType),
                noIndex);
    }

    private ArticleTranslations toArticleTranslations(ArticleEntity entity) {
        return new ArticleTranslations(
                new ArticleTranslations.ArticleContent(
                        entity.getTitleEn(),
                        entity.getExcerptEn(),
                        entity.getBodyEn(),
                        entity.getAuthorNameEn(),
                        entity.getSeoTitleEn(),
                        entity.getSeoDescriptionEn()
                )
        );
    }
}
