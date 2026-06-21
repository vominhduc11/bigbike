package com.bigbike.bigbike_backend.service.admin;

import com.bigbike.bigbike_backend.api.admin.dto.ImageAssetRequest;
import com.bigbike.bigbike_backend.api.admin.dto.SeoMetaRequest;
import com.bigbike.bigbike_backend.domain.content.AdminContentItem;
import com.bigbike.bigbike_backend.domain.content.Article;
import com.bigbike.bigbike_backend.domain.content.ContentTranslations;
import com.bigbike.bigbike_backend.domain.content.Page;
import com.bigbike.bigbike_backend.persistence.entity.content.ArticleEntity;
import com.bigbike.bigbike_backend.persistence.entity.content.PageEntity;
import java.util.LinkedHashSet;

final class ContentFieldApplier {

    private ContentFieldApplier() {}

    public static String articleJson(ArticleEntity e) {
        return "{\"id\":\"" + e.getId() + "\",\"title\":\"" + esc(e.getTitle()) +
               "\",\"slug\":\"" + e.getSlug() + "\",\"publishStatus\":\"" + e.getPublishStatus() + "\"}";
    }

    public static String pageJson(PageEntity e) {
        return "{\"id\":\"" + e.getId() + "\",\"title\":\"" + esc(e.getTitle()) +
               "\",\"slug\":\"" + e.getSlug() + "\",\"publishStatus\":\"" + e.getPublishStatus() + "\"}";
    }

    public static String esc(String s) {
        return s == null ? "" : s.replace("\\", "\\\\").replace("\"", "\\\"");
    }

    public static void applyCoverImage(ArticleEntity entity, ImageAssetRequest request) {
        entity.setCoverImageId(null);
        entity.setCoverImageUrl(AdminMutationValidators.trimToNull(request.getUrl()));
        entity.setCoverImageAlt(AdminMutationValidators.trimToNull(request.getAlt()));
        entity.setCoverImageWidth(request.getWidth());
        entity.setCoverImageHeight(request.getHeight());
        entity.setCoverImageMimeType(AdminMutationValidators.trimToNull(request.getMimeType()));
    }

    public static void clearCoverImage(ArticleEntity entity) {
        entity.setCoverImageId(null);
        entity.setCoverImageUrl(null);
        entity.setCoverImageAlt(null);
        entity.setCoverImageWidth(null);
        entity.setCoverImageHeight(null);
        entity.setCoverImageMimeType(null);
    }

    public static void applyProductImage(ArticleEntity entity, ImageAssetRequest request) {
        entity.setProductImageUrl(AdminMutationValidators.trimToNull(request.getUrl()));
        entity.setProductImageAlt(AdminMutationValidators.trimToNull(request.getAlt()));
    }

    public static void clearProductImage(ArticleEntity entity) {
        entity.setProductImageUrl(null);
        entity.setProductImageAlt(null);
    }

    public static void applySeo(ArticleEntity entity, SeoMetaRequest request) {
        entity.setSeoTitle(AdminMutationValidators.trimToNull(request.getTitle()));
        entity.setSeoDescription(AdminMutationValidators.trimToNull(request.getDescription()));
        entity.setSeoCanonicalUrl(AdminMutationValidators.trimToNull(request.getCanonicalUrl()));
        // Per-article SEO noindex (V222): null in the request leaves the stored flag untouched.
        if (request.getNoIndex() != null) {
            entity.setSeoNoIndex(request.getNoIndex());
        }

        if (request.getOgImage() == null) {
            entity.setSeoOgImageId(null);
            entity.setSeoOgImageUrl(null);
            entity.setSeoOgImageAlt(null);
            entity.setSeoOgImageWidth(null);
            entity.setSeoOgImageHeight(null);
            entity.setSeoOgImageMimeType(null);
            return;
        }

        entity.setSeoOgImageId(null);
        entity.setSeoOgImageUrl(AdminMutationValidators.trimToNull(request.getOgImage().getUrl()));
        entity.setSeoOgImageAlt(AdminMutationValidators.trimToNull(request.getOgImage().getAlt()));
        entity.setSeoOgImageWidth(request.getOgImage().getWidth());
        entity.setSeoOgImageHeight(request.getOgImage().getHeight());
        entity.setSeoOgImageMimeType(AdminMutationValidators.trimToNull(request.getOgImage().getMimeType()));
    }

    public static void clearSeo(ArticleEntity entity) {
        entity.setSeoTitle(null);
        entity.setSeoDescription(null);
        entity.setSeoCanonicalUrl(null);
        entity.setSeoOgImageId(null);
        entity.setSeoOgImageUrl(null);
        entity.setSeoOgImageAlt(null);
        entity.setSeoOgImageWidth(null);
        entity.setSeoOgImageHeight(null);
        entity.setSeoOgImageMimeType(null);
    }

    public static void applySeo(PageEntity entity, SeoMetaRequest request) {
        entity.setSeoTitle(AdminMutationValidators.trimToNull(request.getTitle()));
        entity.setSeoDescription(AdminMutationValidators.trimToNull(request.getDescription()));
        entity.setSeoCanonicalUrl(AdminMutationValidators.trimToNull(request.getCanonicalUrl()));

        if (request.getOgImage() == null) {
            entity.setSeoOgImageId(null);
            entity.setSeoOgImageUrl(null);
            entity.setSeoOgImageAlt(null);
            entity.setSeoOgImageWidth(null);
            entity.setSeoOgImageHeight(null);
            entity.setSeoOgImageMimeType(null);
            return;
        }

        entity.setSeoOgImageId(null);
        entity.setSeoOgImageUrl(AdminMutationValidators.trimToNull(request.getOgImage().getUrl()));
        entity.setSeoOgImageAlt(AdminMutationValidators.trimToNull(request.getOgImage().getAlt()));
        entity.setSeoOgImageWidth(request.getOgImage().getWidth());
        entity.setSeoOgImageHeight(request.getOgImage().getHeight());
        entity.setSeoOgImageMimeType(AdminMutationValidators.trimToNull(request.getOgImage().getMimeType()));
    }

    public static void applyHeroImage(PageEntity entity, ImageAssetRequest request) {
        entity.setHeroImageUrl(AdminMutationValidators.trimToNull(request.getUrl()));
        entity.setHeroImageAlt(AdminMutationValidators.trimToNull(request.getAlt()));
    }

    public static void clearHeroImage(PageEntity entity) {
        entity.setHeroImageUrl(null);
        entity.setHeroImageAlt(null);
    }

    public static void clearSeo(PageEntity entity) {
        entity.setSeoTitle(null);
        entity.setSeoDescription(null);
        entity.setSeoCanonicalUrl(null);
        entity.setSeoOgImageId(null);
        entity.setSeoOgImageUrl(null);
        entity.setSeoOgImageAlt(null);
        entity.setSeoOgImageWidth(null);
        entity.setSeoOgImageHeight(null);
        entity.setSeoOgImageMimeType(null);
    }

    public static AdminContentItem toAdminContentItem(Article article) {
        return new AdminContentItem(
                article.id(),
                "ARTICLE",
                article.slug(),
                article.slugEn(),
                article.title(),
                article.excerpt(),
                article.body(),
                article.coverImage(),
                article.productImage(),
                article.publishStatus(),
                article.featured(),
                article.seo(),
                article.publishedAt(),
                article.createdAt(),
                article.updatedAt(),
                article.category(),
                article.category() != null ? article.category().id() : null,
                article.categories(),
                null,
                null,
                null,
                null,
                null,
                null,
                article.bodyBlocks(),
                ContentTranslations.fromArticle(article.translations())
        );
    }

    public static AdminContentItem toAdminContentItem(Page page) {
        com.bigbike.bigbike_backend.domain.catalog.ImageAsset heroImage =
                (page.heroImageUrl() == null && page.heroImageAlt() == null)
                        ? null
                        : new com.bigbike.bigbike_backend.domain.catalog.ImageAsset(
                                null,
                                page.heroImageUrl(),
                                page.heroImageAlt(),
                                null,
                                null,
                                null
                        );
        return new AdminContentItem(
                page.id(),
                "PAGE",
                page.slug(),
                null,                       // slugEn — pages keep PAGE_RULE_003 (no English slug)
                page.title(),
                null,
                page.body(),
                null,
                null,
                page.publishStatus(),
                false,                      // featured — pages are never featured
                page.seo(),
                page.publishedAt(),
                page.createdAt(),
                page.updatedAt(),
                null,
                null,
                null,
                page.type(),
                page.parentId(),
                heroImage,
                page.heroTitle(),
                page.heroDescription(),
                page.heroKicker(),
                page.bodyBlocks(),
                ContentTranslations.fromPage(page.translations())
        );
    }

    public static void addSlugTag(LinkedHashSet<String> tags, String prefix, String slug) {
        String normalized = AdminMutationValidators.trimToNull(slug);
        if (normalized != null) {
            tags.add(prefix + normalized);
        }
    }

    public static void addTag(LinkedHashSet<String> tags, String tag) {
        String normalized = AdminMutationValidators.trimToNull(tag);
        if (normalized != null) {
            tags.add(normalized);
        }
    }

    public static String generateId(String prefix) {
        return prefix + "_" + java.util.UUID.randomUUID().toString().replace("-", "");
    }
}
