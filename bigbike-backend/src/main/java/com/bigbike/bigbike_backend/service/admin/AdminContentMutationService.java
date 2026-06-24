package com.bigbike.bigbike_backend.service.admin;

import com.bigbike.bigbike_backend.api.admin.dto.ArticleTranslationRequest;
import com.bigbike.bigbike_backend.api.admin.dto.UpsertArticleRequest;
import com.bigbike.bigbike_backend.api.common.ApiErrorDetail;
import com.bigbike.bigbike_backend.api.error.MutationNotImplementedException;
import com.bigbike.bigbike_backend.api.error.NotFoundException;
import com.bigbike.bigbike_backend.service.catalog.DescriptionBlockRenderer;
import com.bigbike.bigbike_backend.service.web.WebRevalidationService;
import com.bigbike.bigbike_backend.domain.catalog.PublishStatus;
import com.bigbike.bigbike_backend.domain.content.AdminContentItem;
import com.bigbike.bigbike_backend.domain.content.Article;
import com.bigbike.bigbike_backend.persistence.entity.content.ArticleEntity;
import com.bigbike.bigbike_backend.persistence.entity.content.ContentCategoryEntity;

import com.bigbike.bigbike_backend.persistence.repository.content.ArticleJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.content.ContentCategoryJpaRepository;
import com.bigbike.bigbike_backend.repository.content.ContentReadRepository;
import com.bigbike.bigbike_backend.repository.content.JpaContentReadRepository;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import com.bigbike.bigbike_backend.persistence.entity.audit.AuditLogEntity;
import com.bigbike.bigbike_backend.service.audit.AuditLogWriter;
import java.util.UUID;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import static com.bigbike.bigbike_backend.service.admin.ContentFieldApplier.addSlugTag;
import static com.bigbike.bigbike_backend.service.admin.ContentFieldApplier.addTag;
import static com.bigbike.bigbike_backend.service.admin.ContentFieldApplier.applyCoverImage;
import static com.bigbike.bigbike_backend.service.admin.ContentFieldApplier.applyProductImage;
import static com.bigbike.bigbike_backend.service.admin.ContentFieldApplier.applySeo;
import static com.bigbike.bigbike_backend.service.admin.ContentFieldApplier.articleJson;
import static com.bigbike.bigbike_backend.service.admin.ContentFieldApplier.clearCoverImage;
import static com.bigbike.bigbike_backend.service.admin.ContentFieldApplier.clearProductImage;
import static com.bigbike.bigbike_backend.service.admin.ContentFieldApplier.clearSeo;
import static com.bigbike.bigbike_backend.service.admin.ContentFieldApplier.generateId;
import static com.bigbike.bigbike_backend.service.admin.ContentFieldApplier.toAdminContentItem;

@Service
public class AdminContentMutationService {

    private final ArticleJpaRepository articleJpaRepository;
    private final ContentCategoryJpaRepository contentCategoryJpaRepository;
    private final ContentReadRepository contentReadRepository;
    private final JpaContentReadRepository jpaContentReadRepository;
    private final WebRevalidationService webRevalidationService;
    private final AuditLogWriter auditLogWriter;
    private final DescriptionBlockRenderer descriptionBlockRenderer;
    private final ContentRequestValidator contentRequestValidator;

    public AdminContentMutationService(
            ObjectProvider<ArticleJpaRepository> articleJpaRepositoryProvider,
            ObjectProvider<ContentCategoryJpaRepository> contentCategoryJpaRepositoryProvider,
            ContentReadRepository contentReadRepository,
            ObjectProvider<JpaContentReadRepository> jpaContentReadRepositoryProvider,
            WebRevalidationService webRevalidationService,
            AuditLogWriter auditLogWriter,
            DescriptionBlockRenderer descriptionBlockRenderer,
            ContentRequestValidator contentRequestValidator
    ) {
        this.articleJpaRepository = articleJpaRepositoryProvider.getIfAvailable();
        this.contentCategoryJpaRepository = contentCategoryJpaRepositoryProvider.getIfAvailable();
        this.contentReadRepository = contentReadRepository;
        this.jpaContentReadRepository = jpaContentReadRepositoryProvider.getIfAvailable();
        this.webRevalidationService = webRevalidationService;
        this.auditLogWriter = auditLogWriter;
        this.descriptionBlockRenderer = descriptionBlockRenderer;
        this.contentRequestValidator = contentRequestValidator;
    }

    @Transactional
    public AdminContentItem createArticle(UpsertArticleRequest request, UUID adminId) {
        requireJpaPersistenceEnabled();

        List<ApiErrorDetail> errors = new ArrayList<>();
        String slug = contentRequestValidator.validateArticleRequest(request, null, true, false, errors);
        ContentCategoryEntity category = contentRequestValidator.resolveCategory(request.getCategoryId(), errors);
        AdminMutationValidators.throwIfErrors(errors);

        Instant now = Instant.now();
        ArticleEntity entity = new ArticleEntity();
        entity.setId(generateId("article"));
        entity.setCreatedAt(now);
        entity.setUpdatedAt(now);

        applyArticlePatch(entity, request, slug, category, true);
        articleJpaRepository.save(entity);
        auditLog("CONTENT_ARTICLE_CREATED", "CONTENT", adminId, null, articleJson(entity));
        revalidateArticle(entity, null);

        Article article = contentReadRepository.findArticleById(entity.getId())
                .orElseThrow(() -> new NotFoundException("Content not found."));
        return toAdminContentItem(article);
    }

    /**
     * Dry-run render for the admin article live preview. Validates the upsert payload and
     * builds a transient {@link ArticleEntity} exactly as {@link #createArticle} does, then
     * maps it straight to the public {@link Article} shape WITHOUT persisting. No row is
     * created: {@code applyArticlePatch} only mutates the in-memory entity graph and its
     * sole repository touch (category resolve) is read-only. Read-only transaction guards
     * against an accidental dirty flush.
     */
    @Transactional(readOnly = true)
    public Article previewArticle(UpsertArticleRequest request, String lang) {
        requireJpaPersistenceEnabled();

        List<ApiErrorDetail> errors = new ArrayList<>();
        String slug = contentRequestValidator.validateArticleRequest(request, null, true, true, errors);
        ContentCategoryEntity category = contentRequestValidator.resolveCategory(request.getCategoryId(), errors);
        AdminMutationValidators.throwIfErrors(errors);

        Instant now = Instant.now();
        ArticleEntity entity = new ArticleEntity();
        entity.setId("article_preview");
        entity.setCreatedAt(now);
        entity.setUpdatedAt(now);
        applyArticlePatch(entity, request, slug, category, true);

        // No save: pure in-memory build, mapped to the same public Article shape the
        // storefront blog detail renders.
        String locale = "en".equalsIgnoreCase(lang) ? "en" : "vi";
        return jpaContentReadRepository.mapPreviewArticle(entity, locale);
    }

    @Transactional
    public AdminContentItem updateArticle(String articleId, UpsertArticleRequest request, UUID adminId) {
        requireJpaPersistenceEnabled();

        ArticleEntity entity = articleJpaRepository.findById(articleId)
                .orElseThrow(() -> new NotFoundException("Content not found."));
        String previousSlug = entity.getSlug();

        List<ApiErrorDetail> errors = new ArrayList<>();
        String slug = contentRequestValidator.validateArticleRequest(request, entity, false, false, errors);
        ContentCategoryEntity category = contentRequestValidator.resolveCategory(request.getCategoryId(), errors);
        PublishStatus nextStatus = request.getPublishStatus() == null ? entity.getPublishStatus() : request.getPublishStatus();
        AdminMutationValidators.validatePublishTransition(entity.getPublishStatus(), nextStatus, "publishStatus", errors);
        AdminMutationValidators.throwIfErrors(errors);

        entity.setUpdatedAt(Instant.now());
        applyArticlePatch(entity, request, slug, category, false);
        articleJpaRepository.save(entity);
        auditLog("CONTENT_ARTICLE_UPDATED", "CONTENT", adminId, null, articleJson(entity));
        revalidateArticle(entity, previousSlug);

        Article article = contentReadRepository.findArticleById(entity.getId())
                .orElseThrow(() -> new NotFoundException("Content not found."));
        return toAdminContentItem(article);
    }

    @Transactional
    public AdminContentItem deleteArticle(String articleId, UUID adminId) {
        requireJpaPersistenceEnabled();
        ArticleEntity entity = articleJpaRepository.findById(articleId)
                .orElseThrow(() -> new NotFoundException("Content not found."));
        entity.setPublishStatus(PublishStatus.TRASH);
        entity.setUpdatedAt(Instant.now());
        articleJpaRepository.save(entity);
        auditLog("CONTENT_ARTICLE_DELETED", "CONTENT", adminId, null, articleJson(entity));
        revalidateArticle(entity, null);
        Article article = contentReadRepository.findArticleById(entity.getId())
                .orElseThrow(() -> new NotFoundException("Content not found."));
        return toAdminContentItem(article);
    }

    private void requireJpaPersistenceEnabled() {
        if (articleJpaRepository == null
                || contentCategoryJpaRepository == null) {
            throw new MutationNotImplementedException(
                    "Content mutation APIs require JPA persistence profile. Mock profile is read-only."
            );
        }
    }

    private void auditLog(String action, String resourceType, UUID adminId, String before, String after) {
        AuditLogEntity log = new AuditLogEntity();
        log.setActorType("ADMIN");
        log.setActorId(adminId);
        log.setAction(action);
        log.setResourceType(resourceType);
        log.setBeforeData(before);
        log.setAfterData(after);
        log.setCreatedAt(Instant.now());
        auditLogWriter.save(log);
    }

    private void applyArticlePatch(
            ArticleEntity entity,
            UpsertArticleRequest request,
            String normalizedSlug,
            ContentCategoryEntity category,
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
        if (request.isBodyBlocksPresent()) {
            entity.setBodyBlocks(request.getBodyBlocks());
            String rendered = request.getBodyBlocks() != null && !request.getBodyBlocks().isEmpty()
                    ? descriptionBlockRenderer.renderBlocksToHtml(request.getBodyBlocks())
                    : "";
            entity.setBody(rendered);
        } else if (create || request.getBody() != null) {
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

        // Featured flag (V222): optional on update — null leaves the current value untouched;
        // on create a missing flag defaults to false.
        if (create) {
            entity.setFeatured(Boolean.TRUE.equals(request.getFeatured()));
        } else if (request.getFeatured() != null) {
            entity.setFeatured(request.getFeatured());
        }

        // Homepage Experience pick flag (V272): same optional-on-update semantics as featured.
        if (create) {
            entity.setHomeExperience(Boolean.TRUE.equals(request.getHomeExperience()));
        } else if (request.getHomeExperience() != null) {
            entity.setHomeExperience(request.getHomeExperience());
        }

        if (request.getCoverImage() != null) {
            applyCoverImage(entity, request.getCoverImage());
        } else if (create) {
            clearCoverImage(entity);
        }

        if (request.getProductImage() != null) {
            applyProductImage(entity, request.getProductImage());
        } else if (create) {
            clearProductImage(entity);
        }

        if (create || request.getCategoryId() != null) {
            entity.setCategory(category);
            // Sync the many-to-many categories list with the primary category on both create and update.
            // This ensures the public category filter (which checks both fields) stays consistent.
            List<ContentCategoryEntity> syncedCategories = new ArrayList<>();
            if (category != null) {
                syncedCategories.add(category);
            }
            entity.setCategories(syncedCategories);
        }
        if (request.getSeo() != null) {
            applySeo(entity, request.getSeo());
        } else if (create) {
            clearSeo(entity);
        }

        ArticleTranslationRequest translations = request.getTranslations();
        ArticleTranslationRequest.ArticleContentRequest en =
                translations != null ? translations.getEn() : null;
        if (en != null) {
            entity.setSlugEn(AdminMutationValidators.trimToNull(en.getSlug()));
            entity.setTitleEn(AdminMutationValidators.trimToNull(en.getTitle()));
            entity.setExcerptEn(AdminMutationValidators.trimToNull(en.getExcerpt()));
            entity.setBodyEn(AdminMutationValidators.trimToNull(en.getBody()));
            entity.setSeoTitleEn(AdminMutationValidators.trimToNull(en.getSeoTitle()));
            entity.setSeoDescriptionEn(AdminMutationValidators.trimToNull(en.getSeoDescription()));
        } else if (create) {
            entity.setSlugEn(null);
            entity.setTitleEn(null);
            entity.setExcerptEn(null);
            entity.setBodyEn(null);
            entity.setSeoTitleEn(null);
            entity.setSeoDescriptionEn(null);
        }
    }

    private void revalidateArticle(ArticleEntity entity, String previousSlug) {
        revalidateEntityTags("articles", "article:", previousSlug, entity.getSlug());
    }

    private void revalidateEntityTags(
            String listTag,
            String itemTagPrefix,
            String previousSlug,
            String currentSlug
    ) {
        LinkedHashSet<String> tags = new LinkedHashSet<>();
        addTag(tags, listTag);
        addSlugTag(tags, itemTagPrefix, previousSlug);
        addSlugTag(tags, itemTagPrefix, currentSlug);
        webRevalidationService.revalidate(tags.toArray(String[]::new));
    }
}
