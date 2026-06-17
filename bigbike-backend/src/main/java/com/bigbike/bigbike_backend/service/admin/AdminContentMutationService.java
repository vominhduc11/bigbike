package com.bigbike.bigbike_backend.service.admin;

import com.bigbike.bigbike_backend.api.admin.dto.ArticleTranslationRequest;
import com.bigbike.bigbike_backend.api.admin.dto.ImageAssetRequest;
import com.bigbike.bigbike_backend.api.admin.dto.PageTranslationRequest;
import com.bigbike.bigbike_backend.api.admin.dto.SeoMetaRequest;
import com.bigbike.bigbike_backend.api.admin.dto.UpsertArticleRequest;
import com.bigbike.bigbike_backend.api.admin.dto.UpsertPageRequest;
import com.bigbike.bigbike_backend.api.common.ApiErrorDetail;
import com.bigbike.bigbike_backend.api.error.MutationNotImplementedException;
import com.bigbike.bigbike_backend.api.error.NotFoundException;
import com.bigbike.bigbike_backend.config.MediaUrlProperties;
import com.bigbike.bigbike_backend.service.catalog.DescriptionBlockRenderer;
import com.bigbike.bigbike_backend.service.web.WebRevalidationService;
import com.bigbike.bigbike_backend.domain.catalog.PublishStatus;
import com.bigbike.bigbike_backend.domain.content.AdminContentItem;
import com.bigbike.bigbike_backend.domain.content.Article;
import com.bigbike.bigbike_backend.domain.content.ContentTranslations;
import com.bigbike.bigbike_backend.domain.content.Page;
import com.bigbike.bigbike_backend.persistence.entity.content.ArticleEntity;
import com.bigbike.bigbike_backend.persistence.entity.content.ContentCategoryEntity;
import com.bigbike.bigbike_backend.persistence.entity.content.PageEntity;

import com.bigbike.bigbike_backend.persistence.repository.content.ArticleJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.content.ContentCategoryJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.content.PageJpaRepository;
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

@Service
public class AdminContentMutationService {

    private final ArticleJpaRepository articleJpaRepository;
    private final PageJpaRepository pageJpaRepository;
    private final ContentCategoryJpaRepository contentCategoryJpaRepository;
    private final ContentReadRepository contentReadRepository;
    private final JpaContentReadRepository jpaContentReadRepository;
    private final MediaUrlProperties mediaUrlProperties;
    private final WebRevalidationService webRevalidationService;
    private final AuditLogWriter auditLogWriter;
    private final DescriptionBlockRenderer descriptionBlockRenderer;

    public AdminContentMutationService(
            ObjectProvider<ArticleJpaRepository> articleJpaRepositoryProvider,
            ObjectProvider<PageJpaRepository> pageJpaRepositoryProvider,
            ObjectProvider<ContentCategoryJpaRepository> contentCategoryJpaRepositoryProvider,
            ContentReadRepository contentReadRepository,
            ObjectProvider<JpaContentReadRepository> jpaContentReadRepositoryProvider,
            MediaUrlProperties mediaUrlProperties,
            WebRevalidationService webRevalidationService,
            AuditLogWriter auditLogWriter,
            DescriptionBlockRenderer descriptionBlockRenderer
    ) {
        this.articleJpaRepository = articleJpaRepositoryProvider.getIfAvailable();
        this.pageJpaRepository = pageJpaRepositoryProvider.getIfAvailable();
        this.contentCategoryJpaRepository = contentCategoryJpaRepositoryProvider.getIfAvailable();
        this.contentReadRepository = contentReadRepository;
        this.jpaContentReadRepository = jpaContentReadRepositoryProvider.getIfAvailable();
        this.mediaUrlProperties = mediaUrlProperties;
        this.webRevalidationService = webRevalidationService;
        this.auditLogWriter = auditLogWriter;
        this.descriptionBlockRenderer = descriptionBlockRenderer;
    }

    @Transactional
    public AdminContentItem createArticle(UpsertArticleRequest request, UUID adminId) {
        requireJpaPersistenceEnabled();

        List<ApiErrorDetail> errors = new ArrayList<>();
        String slug = validateArticleRequest(request, null, true, false, errors);
        ContentCategoryEntity category = resolveCategory(request.getCategoryId(), errors);
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
        String slug = validateArticleRequest(request, null, true, true, errors);
        ContentCategoryEntity category = resolveCategory(request.getCategoryId(), errors);
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
        String slug = validateArticleRequest(request, entity, false, false, errors);
        ContentCategoryEntity category = resolveCategory(request.getCategoryId(), errors);
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
    public AdminContentItem createPage(UpsertPageRequest request, UUID adminId) {
        requireJpaPersistenceEnabled();

        List<ApiErrorDetail> errors = new ArrayList<>();
        String slug = validatePageRequest(request, null, true, errors);
        AdminMutationValidators.throwIfErrors(errors);

        Instant now = Instant.now();
        PageEntity entity = new PageEntity();
        entity.setId(generateId("page"));
        entity.setCreatedAt(now);
        entity.setUpdatedAt(now);

        PageEntity parent = resolveParentPage(request.getParentId(), null, errors);
        AdminMutationValidators.throwIfErrors(errors);
        applyPagePatch(entity, request, slug, parent, true);
        pageJpaRepository.save(entity);
        auditLog("CONTENT_PAGE_CREATED", "CONTENT", adminId, null, pageJson(entity));
        revalidatePage(entity, null);

        Page page = contentReadRepository.findPageById(entity.getId())
                .orElseThrow(() -> new NotFoundException("Content not found."));
        return toAdminContentItem(page);
    }

    @Transactional
    public AdminContentItem updatePage(String pageId, UpsertPageRequest request, UUID adminId) {
        requireJpaPersistenceEnabled();

        PageEntity entity = pageJpaRepository.findById(pageId)
                .orElseThrow(() -> new NotFoundException("Content not found."));
        String previousSlug = entity.getSlug();

        List<ApiErrorDetail> errors = new ArrayList<>();
        String slug = validatePageRequest(request, entity, false, errors);
        PageEntity parent = resolveParentPage(request.getParentId(), entity.getId(), errors);
        PublishStatus nextStatus = request.getPublishStatus() == null ? entity.getPublishStatus() : request.getPublishStatus();
        AdminMutationValidators.validatePublishTransition(entity.getPublishStatus(), nextStatus, "publishStatus", errors);
        AdminMutationValidators.throwIfErrors(errors);

        entity.setUpdatedAt(Instant.now());
        applyPagePatch(entity, request, slug, parent, false);
        pageJpaRepository.save(entity);
        auditLog("CONTENT_PAGE_UPDATED", "CONTENT", adminId, null, pageJson(entity));
        revalidatePage(entity, previousSlug);

        Page page = contentReadRepository.findPageById(entity.getId())
                .orElseThrow(() -> new NotFoundException("Content not found."));
        return toAdminContentItem(page);
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

    @Transactional
    public AdminContentItem deletePage(String pageId, UUID adminId) {
        requireJpaPersistenceEnabled();
        PageEntity entity = pageJpaRepository.findById(pageId)
                .orElseThrow(() -> new NotFoundException("Content not found."));
        entity.setPublishStatus(PublishStatus.TRASH);
        entity.setUpdatedAt(Instant.now());
        pageJpaRepository.save(entity);
        auditLog("CONTENT_PAGE_DELETED", "CONTENT", adminId, null, pageJson(entity));
        revalidatePage(entity, null);
        Page page = contentReadRepository.findPageById(entity.getId())
                .orElseThrow(() -> new NotFoundException("Content not found."));
        return toAdminContentItem(page);
    }

    private void requireJpaPersistenceEnabled() {
        if (articleJpaRepository == null
                || pageJpaRepository == null
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

    private static String articleJson(ArticleEntity e) {
        return "{\"id\":\"" + e.getId() + "\",\"title\":\"" + esc(e.getTitle()) +
               "\",\"slug\":\"" + e.getSlug() + "\",\"publishStatus\":\"" + e.getPublishStatus() + "\"}";
    }

    private static String pageJson(PageEntity e) {
        return "{\"id\":\"" + e.getId() + "\",\"title\":\"" + esc(e.getTitle()) +
               "\",\"slug\":\"" + e.getSlug() + "\",\"publishStatus\":\"" + e.getPublishStatus() + "\"}";
    }

    private static String esc(String s) {
        return s == null ? "" : s.replace("\\", "\\\\").replace("\"", "\\\"");
    }

    /** True when the request carries a non-empty {@code bodyBlocks} array (server will render it into {@code body}). */
    private static boolean hasBodyBlocks(boolean present, List<?> blocks) {
        return present && blocks != null && !blocks.isEmpty();
    }

    private String validateArticleRequest(
            UpsertArticleRequest request,
            ArticleEntity current,
            boolean create,
            boolean preview,
            List<ApiErrorDetail> errors
    ) {
        String slug = AdminMutationValidators.trimToNull(request.getSlug());
        if (create) {
            AdminMutationValidators.validateRequiredSlug(slug, "slug", errors);
            AdminMutationValidators.validateRequiredText(request.getTitle(), "title", "Title", errors);
            // Content can be supplied either as legacy `body` HTML or as `bodyBlocks` (V140);
            // the server renders blocks → body, so require body only when no blocks are sent.
            if (!hasBodyBlocks(request.isBodyBlocksPresent(), request.getBodyBlocks())) {
                AdminMutationValidators.validateRequiredText(request.getBody(), "body", "Body", errors);
            }
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

        AdminMutationValidators.validateImageAsset(
                request.getCoverImage(),
                "coverImage",
                mediaUrlProperties.getPublicBaseUrl(),
                errors
        );
        AdminMutationValidators.validateSeoMeta(
                request.getSeo(),
                "seo",
                mediaUrlProperties.getPublicBaseUrl(),
                errors
        );

        // Slug uniqueness is a persistence concern — skip it for the live-preview
        // dry-run, else previewing an EXISTING article (current is always null here)
        // would flag its own saved slug as a duplicate and always 400.
        if (!preview && slug != null) {
            ArticleEntity existingBySlug = articleJpaRepository.findBySlug(slug).orElse(null);
            if (existingBySlug != null && (current == null || !existingBySlug.getId().equals(current.getId()))) {
                errors.add(new ApiErrorDetail("slug", "DUPLICATE", "Slug is already in use."));
            }
            // A new vi slug must not collide with any article's English slug either.
            ArticleEntity existingBySlugEn = articleJpaRepository.findBySlugEn(slug).orElse(null);
            if (existingBySlugEn != null && (current == null || !existingBySlugEn.getId().equals(current.getId()))) {
                errors.add(new ApiErrorDetail("slug", "DUPLICATE", "Slug is already in use (English slug)."));
            }
        }

        if (!preview) {
            validateArticleEnglishSlug(request, slug, current, errors);
        }

        return slug;
    }

    /**
     * Cross-column uniqueness for the optional English slug (ARTICLE_RULE_003): the en slug
     * must differ from this article's own vi slug, and must not collide with any other
     * article's vi slug or en slug. Errors target {@code translations.en.slug}.
     */
    private void validateArticleEnglishSlug(
            UpsertArticleRequest request, String viSlug, ArticleEntity current, List<ApiErrorDetail> errors) {
        ArticleTranslationRequest translations = request.getTranslations();
        ArticleTranslationRequest.ArticleContentRequest en =
                translations != null ? translations.getEn() : null;
        String slugEn = en == null ? null : AdminMutationValidators.trimToNull(en.getSlug());
        if (slugEn == null) {
            return;
        }
        String currentId = current == null ? null : current.getId();
        if (slugEn.equals(viSlug)) {
            errors.add(new ApiErrorDetail("translations.en.slug", "INVALID_VALUE",
                    "English slug must differ from the Vietnamese slug."));
            return;
        }
        ArticleEntity byViSlug = articleJpaRepository.findBySlug(slugEn).orElse(null);
        if (byViSlug != null && (currentId == null || !byViSlug.getId().equals(currentId))) {
            errors.add(new ApiErrorDetail("translations.en.slug", "DUPLICATE", "English slug is already in use."));
            return;
        }
        ArticleEntity byEnSlug = articleJpaRepository.findBySlugEn(slugEn).orElse(null);
        if (byEnSlug != null && (currentId == null || !byEnSlug.getId().equals(currentId))) {
            errors.add(new ApiErrorDetail("translations.en.slug", "DUPLICATE", "English slug is already in use."));
        }
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
            // Content can be supplied either as legacy `body` HTML or as `bodyBlocks` (V140);
            // the server renders blocks → body, so require body only when no blocks are sent.
            if (!hasBodyBlocks(request.isBodyBlocksPresent(), request.getBodyBlocks())) {
                AdminMutationValidators.validateRequiredText(request.getBody(), "body", "Body", errors);
            }
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

        AdminMutationValidators.validateSeoMeta(
                request.getSeo(),
                "seo",
                mediaUrlProperties.getPublicBaseUrl(),
                errors
        );
        AdminMutationValidators.validateImageAsset(
                request.getHeroImage(),
                "heroImage",
                mediaUrlProperties.getPublicBaseUrl(),
                errors
        );
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

    private void applyPagePatch(
            PageEntity entity,
            UpsertPageRequest request,
            String normalizedSlug,
            PageEntity parent,
            boolean create
    ) {
        if (create || normalizedSlug != null) {
            entity.setSlug(normalizedSlug);
        }
        if (create || request.getTitle() != null) {
            entity.setTitle(AdminMutationValidators.trimToNull(request.getTitle()));
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
        if (create || request.getParentId() != null) {
            entity.setParent(parent);
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

        // Hero fields are independently patchable so admin can edit text without re-uploading image.
        if (request.getHeroImage() != null) {
            applyHeroImage(entity, request.getHeroImage());
        } else if (create) {
            clearHeroImage(entity);
        }
        if (create || request.getHeroTitle() != null) {
            entity.setHeroTitle(AdminMutationValidators.trimToNull(request.getHeroTitle()));
        }
        if (create || request.getHeroDescription() != null) {
            entity.setHeroDescription(AdminMutationValidators.trimToNull(request.getHeroDescription()));
        }
        if (create || request.getHeroKicker() != null) {
            entity.setHeroKicker(AdminMutationValidators.trimToNull(request.getHeroKicker()));
        }

        PageTranslationRequest translations = request.getTranslations();
        PageTranslationRequest.PageContentRequest en =
                translations != null ? translations.getEn() : null;
        if (en != null) {
            entity.setTitleEn(AdminMutationValidators.trimToNull(en.getTitle()));
            entity.setBodyEn(AdminMutationValidators.trimToNull(en.getBody()));
            entity.setHeroTitleEn(AdminMutationValidators.trimToNull(en.getHeroTitle()));
            entity.setHeroDescriptionEn(AdminMutationValidators.trimToNull(en.getHeroDescription()));
            entity.setHeroKickerEn(AdminMutationValidators.trimToNull(en.getHeroKicker()));
            entity.setSeoTitleEn(AdminMutationValidators.trimToNull(en.getSeoTitle()));
            entity.setSeoDescriptionEn(AdminMutationValidators.trimToNull(en.getSeoDescription()));
        } else if (create) {
            entity.setTitleEn(null);
            entity.setBodyEn(null);
            entity.setHeroTitleEn(null);
            entity.setHeroDescriptionEn(null);
            entity.setHeroKickerEn(null);
            entity.setSeoTitleEn(null);
            entity.setSeoDescriptionEn(null);
        }
    }

    private ContentCategoryEntity resolveCategory(String categoryIdRaw, List<ApiErrorDetail> errors) {
        String categoryId = AdminMutationValidators.trimToNull(categoryIdRaw);
        if (categoryId == null) {
            return null;
        }
        ContentCategoryEntity category = contentCategoryJpaRepository.findById(categoryId).orElse(null);
        if (category == null) {
            errors.add(new ApiErrorDetail("categoryId", "NOT_FOUND", "Category does not exist."));
        }
        return category;
    }

    private PageEntity resolveParentPage(String parentIdRaw, String currentPageId, List<ApiErrorDetail> errors) {
        String parentId = AdminMutationValidators.trimToNull(parentIdRaw);
        if (parentId == null) {
            return null;
        }
        if (currentPageId != null && currentPageId.equals(parentId)) {
            errors.add(new ApiErrorDetail("parentId", "INVALID_VALUE", "Page cannot be its own parent."));
            return null;
        }
        PageEntity parent = pageJpaRepository.findById(parentId).orElse(null);
        if (parent == null) {
            errors.add(new ApiErrorDetail("parentId", "NOT_FOUND", "Parent page does not exist."));
        }
        return parent;
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

    private static void applyProductImage(ArticleEntity entity, ImageAssetRequest request) {
        entity.setProductImageUrl(AdminMutationValidators.trimToNull(request.getUrl()));
        entity.setProductImageAlt(AdminMutationValidators.trimToNull(request.getAlt()));
    }

    private static void clearProductImage(ArticleEntity entity) {
        entity.setProductImageUrl(null);
        entity.setProductImageAlt(null);
    }

    private static void applySeo(ArticleEntity entity, SeoMetaRequest request) {
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
    }

    private static void applySeo(PageEntity entity, SeoMetaRequest request) {
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

    private static void applyHeroImage(PageEntity entity, ImageAssetRequest request) {
        entity.setHeroImageUrl(AdminMutationValidators.trimToNull(request.getUrl()));
        entity.setHeroImageAlt(AdminMutationValidators.trimToNull(request.getAlt()));
    }

    private static void clearHeroImage(PageEntity entity) {
        entity.setHeroImageUrl(null);
        entity.setHeroImageAlt(null);
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
    }

    private static AdminContentItem toAdminContentItem(Article article) {
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

    private static AdminContentItem toAdminContentItem(Page page) {
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

    private void revalidateArticle(ArticleEntity entity, String previousSlug) {
        revalidateEntityTags("articles", "article:", previousSlug, entity.getSlug());
    }

    private void revalidatePage(PageEntity entity, String previousSlug) {
        revalidateEntityTags("pages", "page:", previousSlug, entity.getSlug());
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

    private static void addSlugTag(LinkedHashSet<String> tags, String prefix, String slug) {
        String normalized = AdminMutationValidators.trimToNull(slug);
        if (normalized != null) {
            tags.add(prefix + normalized);
        }
    }

    private static void addTag(LinkedHashSet<String> tags, String tag) {
        String normalized = AdminMutationValidators.trimToNull(tag);
        if (normalized != null) {
            tags.add(normalized);
        }
    }

    private static String generateId(String prefix) {
        return prefix + "_" + java.util.UUID.randomUUID().toString().replace("-", "");
    }
}
