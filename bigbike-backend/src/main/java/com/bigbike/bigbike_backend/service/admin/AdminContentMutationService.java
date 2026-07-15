package com.bigbike.bigbike_backend.service.admin;

import com.bigbike.bigbike_backend.api.admin.dto.ArticleTranslationRequest;
import com.bigbike.bigbike_backend.api.admin.dto.UpsertArticleRequest;
import com.bigbike.bigbike_backend.api.common.ApiErrorDetail;
import com.bigbike.bigbike_backend.api.error.MutationNotImplementedException;
import com.bigbike.bigbike_backend.api.error.NotFoundException;
import com.bigbike.bigbike_backend.service.catalog.DescriptionBlockRenderer;
import com.bigbike.bigbike_backend.service.web.WebRevalidationService;
import com.bigbike.bigbike_backend.domain.catalog.PublishStatus;
import com.bigbike.bigbike_backend.domain.catalog.DescriptionBlock;
import com.bigbike.bigbike_backend.domain.content.AdminContentItem;
import com.bigbike.bigbike_backend.domain.content.Article;
import com.bigbike.bigbike_backend.persistence.entity.content.ArticleEntity;
import com.bigbike.bigbike_backend.persistence.entity.content.ContentCategoryEntity;
import com.bigbike.bigbike_backend.persistence.repository.content.ArticleJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.content.ContentCategoryJpaRepository;
import com.bigbike.bigbike_backend.repository.content.ContentReadRepository;
import com.bigbike.bigbike_backend.repository.content.JpaContentReadRepository;
import com.bigbike.bigbike_backend.mapper.ArticleMapper;
import com.bigbike.bigbike_backend.config.MinioProperties;
import com.bigbike.bigbike_backend.service.admin.ImageVariantService;
import io.minio.MinioClient;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import com.bigbike.bigbike_backend.service.admin.support.AuditLogFactory;
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

@Service
public class AdminContentMutationService {

    private final ArticleJpaRepository articleJpaRepository;
    private final ContentCategoryJpaRepository contentCategoryJpaRepository;
    private final ContentReadRepository contentReadRepository;
    private final JpaContentReadRepository jpaContentReadRepository;
    private final WebRevalidationService webRevalidationService;
    private final AuditLogWriter auditLogWriter;
    private final AuditLogFactory auditLogFactory;
    private final DescriptionBlockRenderer descriptionBlockRenderer;
    private final ContentRequestValidator contentRequestValidator;
    private final ArticleMapper articleMapper;
    private final MinioClient minioClient;
    private final MinioProperties minioProperties;
    private final ImageVariantService imageVariantService;
    private final MediaReferenceService mediaReferenceService;

    public AdminContentMutationService(
            ObjectProvider<ArticleJpaRepository> articleJpaRepositoryProvider,
            ObjectProvider<ContentCategoryJpaRepository> contentCategoryJpaRepositoryProvider,
            ContentReadRepository contentReadRepository,
            ObjectProvider<JpaContentReadRepository> jpaContentReadRepositoryProvider,
            WebRevalidationService webRevalidationService,
            AuditLogWriter auditLogWriter,
            AuditLogFactory auditLogFactory,
            DescriptionBlockRenderer descriptionBlockRenderer,
            ContentRequestValidator contentRequestValidator,
            ArticleMapper articleMapper,
            MinioClient minioClient,
            MinioProperties minioProperties,
            ImageVariantService imageVariantService,
            MediaReferenceService mediaReferenceService
    ) {
        this.articleJpaRepository = articleJpaRepositoryProvider.getIfAvailable();
        this.contentCategoryJpaRepository = contentCategoryJpaRepositoryProvider.getIfAvailable();
        this.contentReadRepository = contentReadRepository;
        this.jpaContentReadRepository = jpaContentReadRepositoryProvider.getIfAvailable();
        this.webRevalidationService = webRevalidationService;
        this.auditLogWriter = auditLogWriter;
        this.auditLogFactory = auditLogFactory;
        this.descriptionBlockRenderer = descriptionBlockRenderer;
        this.contentRequestValidator = contentRequestValidator;
        this.articleMapper = articleMapper;
        this.minioClient = minioClient;
        this.minioProperties = minioProperties;
        this.imageVariantService = imageVariantService;
        this.mediaReferenceService = mediaReferenceService;
    }

    @Transactional
    public AdminContentItem createArticle(UpsertArticleRequest request, UUID adminId) {
        requireJpaPersistenceEnabled();

        List<ApiErrorDetail> errors = new ArrayList<>();
        String slug = contentRequestValidator.validateArticleRequest(request, null, true, false, errors);
        ContentCategoryEntity category = contentRequestValidator.resolveCategory(request.getCategoryId(), errors);
        PublishStatus nextStatus = request.getPublishStatus() == null ? PublishStatus.DRAFT : request.getPublishStatus();
        AdminMutationValidators.validatePublishTransition(PublishStatus.DRAFT, nextStatus, "publishStatus", errors);
        AdminMutationValidators.throwIfErrors(errors);

        Instant now = Instant.now();
        ArticleEntity entity = new ArticleEntity();
        entity.setId(generateId("article"));
        entity.setCreatedAt(now);
        entity.setUpdatedAt(now);

        applyArticlePatch(entity, request, slug, category, true);
        articleJpaRepository.save(entity);
        auditLogWriter.save(auditLogFactory.build(
                "ADMIN", adminId, "CONTENT_ARTICLE_CREATED", "CONTENT", null, null, articleJson(entity)));
        revalidateArticle(entity, null);

        Article article = contentReadRepository.findArticleById(entity.getId())
                .orElseThrow(() -> new NotFoundException("Content not found."));
        return articleMapper.toAdminContentItem(article);
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
        PublishStatus nextStatus = request.getPublishStatus() == null ? PublishStatus.DRAFT : request.getPublishStatus();
        AdminMutationValidators.validatePublishTransition(PublishStatus.DRAFT, nextStatus, "publishStatus", errors);
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
        String before = articleJson(entity);

        List<ApiErrorDetail> errors = new ArrayList<>();
        String slug = contentRequestValidator.validateArticleRequest(request, entity, false, false, errors);
        ContentCategoryEntity category = contentRequestValidator.resolveCategory(request.getCategoryId(), errors);
        PublishStatus nextStatus = request.getPublishStatus() == null ? entity.getPublishStatus() : request.getPublishStatus();
        AdminMutationValidators.validatePublishTransition(entity.getPublishStatus(), nextStatus, "publishStatus", errors);
        AdminMutationValidators.throwIfErrors(errors);

        entity.setUpdatedAt(Instant.now());
        applyArticlePatch(entity, request, slug, category, false);
        articleJpaRepository.save(entity);
        auditLogWriter.save(auditLogFactory.build(
                "ADMIN", adminId, "CONTENT_ARTICLE_UPDATED", "CONTENT", null, before, articleJson(entity)));
        revalidateArticle(entity, previousSlug);

        Article article = contentReadRepository.findArticleById(entity.getId())
                .orElseThrow(() -> new NotFoundException("Content not found."));
        return articleMapper.toAdminContentItem(article);
    }

    @Transactional
    public AdminContentItem deleteArticle(String articleId, UUID adminId) {
        requireJpaPersistenceEnabled();
        ArticleEntity entity = articleJpaRepository.findById(articleId)
                .orElseThrow(() -> new NotFoundException("Content not found."));

        if (entity.getPublishStatus() == PublishStatus.TRASH) {
            Article article = contentReadRepository.findArticleById(entity.getId())
                    .orElseThrow(() -> new NotFoundException("Content not found."));
            return articleMapper.toAdminContentItem(article);
        }

        String before = articleJson(entity);

        // Same PUBLISHED -> DRAFT -> TRASH sequencing as AdminCatalogMutationService.softDeleteProduct
        // (owner decision 2026-07-07) — invisible to the admin, single request/transaction.
        if (entity.getPublishStatus() == PublishStatus.PUBLISHED) {
            List<ApiErrorDetail> draftErrors = new ArrayList<>();
            AdminMutationValidators.validatePublishTransition(
                    entity.getPublishStatus(), PublishStatus.DRAFT, "publishStatus", draftErrors);
            AdminMutationValidators.throwIfErrors(draftErrors);
            entity.setPublishStatus(PublishStatus.DRAFT);
        }

        List<ApiErrorDetail> errors = new ArrayList<>();
        AdminMutationValidators.validatePublishTransition(
                entity.getPublishStatus(), PublishStatus.TRASH, "publishStatus", errors);
        AdminMutationValidators.throwIfErrors(errors);
        entity.setPublishStatus(PublishStatus.TRASH);

        // A6: Rename slug when soft-deleted to free up the original slug
        String prevSlug = entity.getSlug();
        entity.setSlug(entity.getSlug() + "-deleted-" + entity.getId());
        if (entity.getSlugEn() != null) {
            entity.setSlugEn(entity.getSlugEn() + "-deleted-" + entity.getId());
        }

        entity.setUpdatedAt(Instant.now());
        articleJpaRepository.save(entity);
        auditLogWriter.save(auditLogFactory.build(
                "ADMIN", adminId, "CONTENT_ARTICLE_DELETED", "CONTENT", null, before, articleJson(entity)));
        revalidateArticle(entity, prevSlug);
        Article article = contentReadRepository.findArticleById(entity.getId())
                .orElseThrow(() -> new NotFoundException("Content not found."));
        return articleMapper.toAdminContentItem(article);
    }

    @Transactional
    public AdminContentItem restoreArticle(String articleId, UUID adminId) {
        requireJpaPersistenceEnabled();
        ArticleEntity entity = articleJpaRepository.findById(articleId)
                .orElseThrow(() -> new NotFoundException("Content not found."));
        if (entity.getPublishStatus() != PublishStatus.TRASH) {
            Article article = contentReadRepository.findArticleById(entity.getId())
                    .orElseThrow(() -> new NotFoundException("Content not found."));
            return articleMapper.toAdminContentItem(article);
        }
        
        // Khôi phục slug gốc và validate trùng
        String originalSlug = entity.getSlug().replace("-deleted-" + entity.getId(), "");
        String originalSlugEn = entity.getSlugEn() != null 
                ? entity.getSlugEn().replace("-deleted-" + entity.getId(), "") 
                : null;
        
        List<ApiErrorDetail> errors = new ArrayList<>();
        ArticleEntity existingBySlug = articleJpaRepository.findBySlug(originalSlug).orElse(null);
        if (existingBySlug != null && !existingBySlug.getId().equals(entity.getId()) 
                && existingBySlug.getPublishStatus() != PublishStatus.TRASH) {
            errors.add(new ApiErrorDetail("slug", "DUPLICATE", "Cannot restore: slug '" + originalSlug + "' is already in use."));
        }
        if (originalSlugEn != null) {
            ArticleEntity existingBySlugEn = articleJpaRepository.findBySlugEn(originalSlugEn).orElse(null);
            if (existingBySlugEn != null && !existingBySlugEn.getId().equals(entity.getId()) 
                    && existingBySlugEn.getPublishStatus() != PublishStatus.TRASH) {
                errors.add(new ApiErrorDetail("translations.en.slug", "DUPLICATE", "Cannot restore: English slug is already in use."));
            }
        }
        AdminMutationValidators.throwIfErrors(errors);

        String before = articleJson(entity);
        entity.setSlug(originalSlug);
        entity.setSlugEn(originalSlugEn);
        entity.setPublishStatus(PublishStatus.DRAFT);
        entity.setUpdatedAt(Instant.now());
        articleJpaRepository.save(entity);
        auditLogWriter.save(auditLogFactory.build(
                "ADMIN", adminId, "CONTENT_ARTICLE_RESTORED", "CONTENT", null, before, articleJson(entity)));
        revalidateArticle(entity, null);
        Article article = contentReadRepository.findArticleById(entity.getId())
                .orElseThrow(() -> new NotFoundException("Content not found."));
        return articleMapper.toAdminContentItem(article);
    }

    @Transactional
    public void hardDeleteArticle(String articleId, UUID adminId) {
        requireJpaPersistenceEnabled();
        ArticleEntity entity = articleJpaRepository.findById(articleId)
                .orElseThrow(() -> new NotFoundException("Content not found."));
        if (entity.getPublishStatus() != PublishStatus.TRASH) {
            throw new com.bigbike.bigbike_backend.api.error.ConflictException("Only trashed content can be permanently deleted.");
        }
        
        // A9: Dọn dẹp object MinIO liên quan — gom URL duy nhất rồi chỉ xóa object
        // KHÔNG còn nơi nào khác tham chiếu (bài viết khác, sản phẩm, review, settings…):
        // object dùng chung phải sống tiếp sau khi bài này bị xóa vĩnh viễn (AUD-004).
        LinkedHashSet<String> candidateUrls = new LinkedHashSet<>();
        if (entity.getCoverImageUrl() != null) candidateUrls.add(entity.getCoverImageUrl());
        if (entity.getSeoOgImageUrl() != null) candidateUrls.add(entity.getSeoOgImageUrl());
        if (entity.getBodyBlocks() != null) {
            for (DescriptionBlock block : entity.getBodyBlocks()) {
                if (block instanceof DescriptionBlock.ImageBlock img && img.getUrl() != null) {
                    candidateUrls.add(img.getUrl());
                } else if (block instanceof DescriptionBlock.FeatureBlock feat && feat.getUrl() != null) {
                    candidateUrls.add(feat.getUrl());
                }
            }
        }
        for (String url : candidateUrls) {
            deleteMinioObjectIfUnreferenced(url, entity.getId());
        }

        auditLogWriter.save(auditLogFactory.build(
                "ADMIN", adminId, "CONTENT_ARTICLE_HARD_DELETED", "CONTENT", null, articleJson(entity), null));
        articleJpaRepository.delete(entity);
        revalidateArticle(entity, null);
    }

    private void deleteMinioObjectIfUnreferenced(String url, String articleId) {
        if (url == null) return;
        String objectKey = extractObjectKey(url);
        if (objectKey == null) return;
        if (mediaReferenceService.isObjectKeyReferencedOutsideArticle(objectKey, articleId)) {
            return;
        }
        try {
            minioClient.removeObject(
                    io.minio.RemoveObjectArgs.builder()
                            .bucket(minioProperties.getBucket())
                            .object(objectKey)
                            .build()
            );
            imageVariantService.deleteVariants(objectKey);
        } catch (Exception e) {
            // best-effort
        }
    }

    private String extractObjectKey(String url) {
        if (url == null) return null;
        String prefix = "/media/";
        if (url.startsWith(prefix)) {
            return url.substring(prefix.length());
        }
        prefix = "/media-proxy/";
        if (url.startsWith(prefix)) {
            return url.substring(prefix.length());
        }
        int idx = url.indexOf("/media/");
        if (idx != -1) {
            return url.substring(idx + "/media/".length());
        }
        return null;
    }

    private void requireJpaPersistenceEnabled() {
        if (articleJpaRepository == null
                || contentCategoryJpaRepository == null) {
            throw new MutationNotImplementedException(
                    "Content mutation APIs require JPA persistence profile. Mock profile is read-only."
            );
        }
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
            // A2: Sanitize body
            String sanitizedBody = descriptionBlockRenderer.sanitizeHtml(AdminMutationValidators.trimToNull(request.getBody()));
            entity.setBody(sanitizedBody);
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
            
            // A3: Sanitize en.body
            String sanitizedBodyEn = descriptionBlockRenderer.sanitizeHtml(AdminMutationValidators.trimToNull(en.getBody()));
            entity.setBodyEn(sanitizedBodyEn);
            
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
