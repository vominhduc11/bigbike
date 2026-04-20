package com.bigbike.bigbike_backend.service.admin;

import com.bigbike.bigbike_backend.api.admin.dto.ImageAssetRequest;
import com.bigbike.bigbike_backend.api.admin.dto.SeoMetaRequest;
import com.bigbike.bigbike_backend.api.admin.dto.UpsertArticleRequest;
import com.bigbike.bigbike_backend.api.admin.dto.UpsertPageRequest;
import com.bigbike.bigbike_backend.api.common.ApiErrorDetail;
import com.bigbike.bigbike_backend.api.error.MutationNotImplementedException;
import com.bigbike.bigbike_backend.api.error.NotFoundException;
import com.bigbike.bigbike_backend.domain.catalog.PublishStatus;
import com.bigbike.bigbike_backend.domain.content.AdminContentItem;
import com.bigbike.bigbike_backend.domain.content.Article;
import com.bigbike.bigbike_backend.domain.content.Page;
import com.bigbike.bigbike_backend.persistence.entity.content.ArticleEntity;
import com.bigbike.bigbike_backend.persistence.entity.content.PageEntity;
import com.bigbike.bigbike_backend.persistence.repository.content.ArticleJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.content.PageJpaRepository;
import com.bigbike.bigbike_backend.repository.content.ContentReadRepository;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AdminContentMutationService {

    private final ArticleJpaRepository articleJpaRepository;
    private final PageJpaRepository pageJpaRepository;
    private final ContentReadRepository contentReadRepository;

    public AdminContentMutationService(
            ObjectProvider<ArticleJpaRepository> articleJpaRepositoryProvider,
            ObjectProvider<PageJpaRepository> pageJpaRepositoryProvider,
            ContentReadRepository contentReadRepository
    ) {
        this.articleJpaRepository = articleJpaRepositoryProvider.getIfAvailable();
        this.pageJpaRepository = pageJpaRepositoryProvider.getIfAvailable();
        this.contentReadRepository = contentReadRepository;
    }

    @Transactional
    public AdminContentItem createArticle(UpsertArticleRequest request) {
        requireJpaPersistenceEnabled();

        List<ApiErrorDetail> errors = new ArrayList<>();
        String slug = validateArticleRequest(request, null, true, errors);
        AdminMutationValidators.throwIfErrors(errors);

        Instant now = Instant.now();
        ArticleEntity entity = new ArticleEntity();
        entity.setId(generateId("article"));
        entity.setCreatedAt(now);
        entity.setUpdatedAt(now);

        applyArticlePatch(entity, request, slug, true);
        articleJpaRepository.save(entity);

        Article article = contentReadRepository.findArticleById(entity.getId())
                .orElseThrow(() -> new NotFoundException("Content not found."));
        return toAdminContentItem(article);
    }

    @Transactional
    public AdminContentItem updateArticle(String articleId, UpsertArticleRequest request) {
        requireJpaPersistenceEnabled();

        ArticleEntity entity = articleJpaRepository.findById(articleId)
                .orElseThrow(() -> new NotFoundException("Content not found."));

        List<ApiErrorDetail> errors = new ArrayList<>();
        String slug = validateArticleRequest(request, entity, false, errors);
        PublishStatus nextStatus = request.getPublishStatus() == null ? entity.getPublishStatus() : request.getPublishStatus();
        AdminMutationValidators.validatePublishTransition(entity.getPublishStatus(), nextStatus, "publishStatus", errors);
        AdminMutationValidators.throwIfErrors(errors);

        entity.setUpdatedAt(Instant.now());
        applyArticlePatch(entity, request, slug, false);
        articleJpaRepository.save(entity);

        Article article = contentReadRepository.findArticleById(entity.getId())
                .orElseThrow(() -> new NotFoundException("Content not found."));
        return toAdminContentItem(article);
    }

    @Transactional
    public AdminContentItem createPage(UpsertPageRequest request) {
        requireJpaPersistenceEnabled();

        List<ApiErrorDetail> errors = new ArrayList<>();
        String slug = validatePageRequest(request, null, true, errors);
        AdminMutationValidators.throwIfErrors(errors);

        Instant now = Instant.now();
        PageEntity entity = new PageEntity();
        entity.setId(generateId("page"));
        entity.setCreatedAt(now);
        entity.setUpdatedAt(now);

        applyPagePatch(entity, request, slug, true);
        pageJpaRepository.save(entity);

        Page page = contentReadRepository.findPageById(entity.getId())
                .orElseThrow(() -> new NotFoundException("Content not found."));
        return toAdminContentItem(page);
    }

    @Transactional
    public AdminContentItem updatePage(String pageId, UpsertPageRequest request) {
        requireJpaPersistenceEnabled();

        PageEntity entity = pageJpaRepository.findById(pageId)
                .orElseThrow(() -> new NotFoundException("Content not found."));

        List<ApiErrorDetail> errors = new ArrayList<>();
        String slug = validatePageRequest(request, entity, false, errors);
        PublishStatus nextStatus = request.getPublishStatus() == null ? entity.getPublishStatus() : request.getPublishStatus();
        AdminMutationValidators.validatePublishTransition(entity.getPublishStatus(), nextStatus, "publishStatus", errors);
        AdminMutationValidators.throwIfErrors(errors);

        entity.setUpdatedAt(Instant.now());
        applyPagePatch(entity, request, slug, false);
        pageJpaRepository.save(entity);

        Page page = contentReadRepository.findPageById(entity.getId())
                .orElseThrow(() -> new NotFoundException("Content not found."));
        return toAdminContentItem(page);
    }

    private void requireJpaPersistenceEnabled() {
        if (articleJpaRepository == null || pageJpaRepository == null) {
            throw new MutationNotImplementedException(
                    "Content mutation APIs require JPA persistence profile. Mock profile is read-only."
            );
        }
    }

    private String validateArticleRequest(
            UpsertArticleRequest request,
            ArticleEntity current,
            boolean create,
            List<ApiErrorDetail> errors
    ) {
        String slug = AdminMutationValidators.trimToNull(request.getSlug());
        if (create) {
            AdminMutationValidators.validateRequiredSlug(slug, "slug", errors);
            AdminMutationValidators.validateRequiredText(request.getTitle(), "title", "Title", errors);
            AdminMutationValidators.validateRequiredText(request.getBody(), "body", "Body", errors);
            if (request.getPublishStatus() == null) {
                errors.add(new ApiErrorDetail("publishStatus", "REQUIRED", "publishStatus is required."));
            }
        } else {
            AdminMutationValidators.validateOptionalSlug(slug, "slug", errors);
            if (request.getTitle() != null) {
                AdminMutationValidators.validateRequiredText(request.getTitle(), "title", "Title", errors);
            }
            if (request.getBody() != null) {
                AdminMutationValidators.validateRequiredText(request.getBody(), "body", "Body", errors);
            }
        }

        AdminMutationValidators.validateImageAsset(request.getCoverImage(), "coverImage", errors);
        AdminMutationValidators.validateSeoMeta(request.getSeo(), "seo", errors);

        if (slug != null) {
            ArticleEntity existingBySlug = articleJpaRepository.findBySlug(slug).orElse(null);
            if (existingBySlug != null && (current == null || !existingBySlug.getId().equals(current.getId()))) {
                errors.add(new ApiErrorDetail("slug", "DUPLICATE", "Slug is already in use."));
            }
        }

        return slug;
    }

    private String validatePageRequest(
            UpsertPageRequest request,
            PageEntity current,
            boolean create,
            List<ApiErrorDetail> errors
    ) {
        String slug = AdminMutationValidators.trimToNull(request.getSlug());
        if (create) {
            AdminMutationValidators.validateRequiredSlug(slug, "slug", errors);
            AdminMutationValidators.validateRequiredText(request.getTitle(), "title", "Title", errors);
            AdminMutationValidators.validateRequiredText(request.getBody(), "body", "Body", errors);
            if (request.getPublishStatus() == null) {
                errors.add(new ApiErrorDetail("publishStatus", "REQUIRED", "publishStatus is required."));
            }
            if (request.getPageType() == null) {
                errors.add(new ApiErrorDetail("pageType", "REQUIRED", "pageType is required."));
            }
        } else {
            AdminMutationValidators.validateOptionalSlug(slug, "slug", errors);
            if (request.getTitle() != null) {
                AdminMutationValidators.validateRequiredText(request.getTitle(), "title", "Title", errors);
            }
            if (request.getBody() != null) {
                AdminMutationValidators.validateRequiredText(request.getBody(), "body", "Body", errors);
            }
        }

        AdminMutationValidators.validateSeoMeta(request.getSeo(), "seo", errors);

        if (slug != null) {
            PageEntity existingBySlug = pageJpaRepository.findBySlug(slug).orElse(null);
            if (existingBySlug != null && (current == null || !existingBySlug.getId().equals(current.getId()))) {
                errors.add(new ApiErrorDetail("slug", "DUPLICATE", "Slug is already in use."));
            }
        }

        return slug;
    }

    private void applyArticlePatch(
            ArticleEntity entity,
            UpsertArticleRequest request,
            String normalizedSlug,
            boolean create
    ) {
        if (create || normalizedSlug != null) {
            entity.setSlug(normalizedSlug);
        }
        if (create || request.getTitle() != null) {
            entity.setTitle(AdminMutationValidators.trimToNull(request.getTitle()));
        }
        if (create || request.getExcerpt() != null) {
            entity.setExcerpt(AdminMutationValidators.trimToNull(request.getExcerpt()));
        }
        if (create || request.getBody() != null) {
            entity.setBody(AdminMutationValidators.trimToNull(request.getBody()));
        }
        if (create || request.getPublishStatus() != null) {
            PublishStatus nextStatus = request.getPublishStatus() == null ? PublishStatus.DRAFT : request.getPublishStatus();
            if (nextStatus == PublishStatus.PUBLISHED && entity.getPublishStatus() != PublishStatus.PUBLISHED) {
                entity.setPublishedAt(Instant.now());
            }
            if (nextStatus != PublishStatus.PUBLISHED) {
                entity.setPublishedAt(null);
            }
            entity.setPublishStatus(nextStatus);
        }

        if (request.getCoverImage() != null) {
            applyCoverImage(entity, request.getCoverImage());
        } else if (create) {
            clearCoverImage(entity);
        }

        if (create || request.getAuthorId() != null) {
            entity.setAuthor(null);
        }
        if (create || request.getCategoryId() != null) {
            entity.setCategory(null);
        }
        if (create || request.getTags() != null) {
            entity.setTags(normalizeTags(request.getTags()));
        }

        if (request.getSeo() != null) {
            applySeo(entity, request.getSeo());
        } else if (create) {
            clearSeo(entity);
        }
    }

    private void applyPagePatch(
            PageEntity entity,
            UpsertPageRequest request,
            String normalizedSlug,
            boolean create
    ) {
        if (create || normalizedSlug != null) {
            entity.setSlug(normalizedSlug);
        }
        if (create || request.getTitle() != null) {
            entity.setTitle(AdminMutationValidators.trimToNull(request.getTitle()));
        }
        if (create || request.getBody() != null) {
            entity.setBody(AdminMutationValidators.trimToNull(request.getBody()));
        }
        if (create || request.getPageType() != null) {
            entity.setPageType(request.getPageType());
        }
        if (create || request.getPublishStatus() != null) {
            PublishStatus nextStatus = request.getPublishStatus() == null ? PublishStatus.DRAFT : request.getPublishStatus();
            if (nextStatus == PublishStatus.PUBLISHED && entity.getPublishStatus() != PublishStatus.PUBLISHED) {
                entity.setPublishedAt(Instant.now());
            }
            if (nextStatus != PublishStatus.PUBLISHED) {
                entity.setPublishedAt(null);
            }
            entity.setPublishStatus(nextStatus);
        }

        if (request.getSeo() != null) {
            applySeo(entity, request.getSeo());
        } else if (create) {
            clearSeo(entity);
        }
    }

    private static List<String> normalizeTags(List<String> tags) {
        if (tags == null) {
            return List.of();
        }
        return tags.stream()
                .map(AdminMutationValidators::trimToNull)
                .filter(tag -> tag != null)
                .distinct()
                .toList();
    }

    private static void applyCoverImage(ArticleEntity entity, ImageAssetRequest request) {
        entity.setCoverImageId(null);
        entity.setCoverImageUrl(AdminMutationValidators.trimToNull(request.getUrl()));
        entity.setCoverImageAlt(AdminMutationValidators.trimToNull(request.getAlt()));
        entity.setCoverImageWidth(request.getWidth());
        entity.setCoverImageHeight(request.getHeight());
        entity.setCoverImageMimeType(AdminMutationValidators.trimToNull(request.getMimeType()));
    }

    private static void clearCoverImage(ArticleEntity entity) {
        entity.setCoverImageId(null);
        entity.setCoverImageUrl(null);
        entity.setCoverImageAlt(null);
        entity.setCoverImageWidth(null);
        entity.setCoverImageHeight(null);
        entity.setCoverImageMimeType(null);
    }

    private static void applySeo(ArticleEntity entity, SeoMetaRequest request) {
        entity.setSeoTitle(AdminMutationValidators.trimToNull(request.getTitle()));
        entity.setSeoDescription(AdminMutationValidators.trimToNull(request.getDescription()));
        entity.setSeoCanonicalUrl(AdminMutationValidators.trimToNull(request.getCanonicalUrl()));
        entity.setSeoNoIndex(request.getNoIndex());

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

    private static void clearSeo(ArticleEntity entity) {
        entity.setSeoTitle(null);
        entity.setSeoDescription(null);
        entity.setSeoCanonicalUrl(null);
        entity.setSeoOgImageId(null);
        entity.setSeoOgImageUrl(null);
        entity.setSeoOgImageAlt(null);
        entity.setSeoOgImageWidth(null);
        entity.setSeoOgImageHeight(null);
        entity.setSeoOgImageMimeType(null);
        entity.setSeoNoIndex(null);
    }

    private static void applySeo(PageEntity entity, SeoMetaRequest request) {
        entity.setSeoTitle(AdminMutationValidators.trimToNull(request.getTitle()));
        entity.setSeoDescription(AdminMutationValidators.trimToNull(request.getDescription()));
        entity.setSeoCanonicalUrl(AdminMutationValidators.trimToNull(request.getCanonicalUrl()));
        entity.setSeoNoIndex(request.getNoIndex());

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

    private static void clearSeo(PageEntity entity) {
        entity.setSeoTitle(null);
        entity.setSeoDescription(null);
        entity.setSeoCanonicalUrl(null);
        entity.setSeoOgImageId(null);
        entity.setSeoOgImageUrl(null);
        entity.setSeoOgImageAlt(null);
        entity.setSeoOgImageWidth(null);
        entity.setSeoOgImageHeight(null);
        entity.setSeoOgImageMimeType(null);
        entity.setSeoNoIndex(null);
    }

    private static AdminContentItem toAdminContentItem(Article article) {
        return new AdminContentItem(
                article.id(),
                "ARTICLE",
                article.slug(),
                article.title(),
                article.excerpt(),
                article.body(),
                article.coverImage(),
                article.publishStatus(),
                article.seo(),
                article.publishedAt(),
                article.createdAt(),
                article.updatedAt()
        );
    }

    private static AdminContentItem toAdminContentItem(Page page) {
        return new AdminContentItem(
                page.id(),
                "PAGE",
                page.slug(),
                page.title(),
                null,
                page.body(),
                null,
                page.publishStatus(),
                page.seo(),
                page.publishedAt(),
                page.createdAt(),
                page.updatedAt()
        );
    }

    private static String generateId(String prefix) {
        return prefix + "_" + Instant.now().toEpochMilli() + "_" + Math.abs((int) (Math.random() * 100000));
    }
}

