package com.bigbike.bigbike_backend.service.admin;

import com.bigbike.bigbike_backend.api.admin.dto.ImageAssetRequest;
import com.bigbike.bigbike_backend.api.admin.dto.SeoMetaRequest;
import com.bigbike.bigbike_backend.api.admin.dto.UpsertArticleRequest;
import com.bigbike.bigbike_backend.api.admin.dto.UpsertPageRequest;
import com.bigbike.bigbike_backend.api.common.ApiErrorDetail;
import com.bigbike.bigbike_backend.api.error.MutationNotImplementedException;
import com.bigbike.bigbike_backend.api.error.NotFoundException;
import com.bigbike.bigbike_backend.config.MediaUrlProperties;
import com.bigbike.bigbike_backend.service.web.WebRevalidationService;
import com.bigbike.bigbike_backend.domain.catalog.PublishStatus;
import com.bigbike.bigbike_backend.domain.content.AdminContentItem;
import com.bigbike.bigbike_backend.domain.content.Article;
import com.bigbike.bigbike_backend.domain.content.Page;
import com.bigbike.bigbike_backend.persistence.entity.content.ArticleEntity;
import com.bigbike.bigbike_backend.persistence.entity.content.BlogTagEntity;
import com.bigbike.bigbike_backend.persistence.entity.content.ContentAuthorEntity;
import com.bigbike.bigbike_backend.persistence.entity.content.ContentCategoryEntity;
import com.bigbike.bigbike_backend.persistence.entity.content.PageEntity;
import com.bigbike.bigbike_backend.persistence.repository.content.ArticleJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.content.BlogTagJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.content.ContentAuthorJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.content.ContentCategoryJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.content.PageJpaRepository;
import com.bigbike.bigbike_backend.repository.content.ContentReadRepository;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Optional;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AdminContentMutationService {

    private final ArticleJpaRepository articleJpaRepository;
    private final PageJpaRepository pageJpaRepository;
    private final ContentAuthorJpaRepository contentAuthorJpaRepository;
    private final ContentCategoryJpaRepository contentCategoryJpaRepository;
    private final BlogTagJpaRepository blogTagJpaRepository;
    private final ContentReadRepository contentReadRepository;
    private final MediaUrlProperties mediaUrlProperties;
    private final WebRevalidationService webRevalidationService;

    public AdminContentMutationService(
            ObjectProvider<ArticleJpaRepository> articleJpaRepositoryProvider,
            ObjectProvider<PageJpaRepository> pageJpaRepositoryProvider,
            ObjectProvider<ContentAuthorJpaRepository> contentAuthorJpaRepositoryProvider,
            ObjectProvider<ContentCategoryJpaRepository> contentCategoryJpaRepositoryProvider,
            ObjectProvider<BlogTagJpaRepository> blogTagJpaRepositoryProvider,
            ContentReadRepository contentReadRepository,
            MediaUrlProperties mediaUrlProperties,
            WebRevalidationService webRevalidationService
    ) {
        this.articleJpaRepository = articleJpaRepositoryProvider.getIfAvailable();
        this.pageJpaRepository = pageJpaRepositoryProvider.getIfAvailable();
        this.contentAuthorJpaRepository = contentAuthorJpaRepositoryProvider.getIfAvailable();
        this.contentCategoryJpaRepository = contentCategoryJpaRepositoryProvider.getIfAvailable();
        this.blogTagJpaRepository = blogTagJpaRepositoryProvider.getIfAvailable();
        this.contentReadRepository = contentReadRepository;
        this.mediaUrlProperties = mediaUrlProperties;
        this.webRevalidationService = webRevalidationService;
    }

    @Transactional
    public AdminContentItem createArticle(UpsertArticleRequest request) {
        requireJpaPersistenceEnabled();

        List<ApiErrorDetail> errors = new ArrayList<>();
        String slug = validateArticleRequest(request, null, true, errors);
        ContentAuthorEntity author = resolveAuthor(request.getAuthorId(), errors);
        ContentCategoryEntity category = resolveCategory(request.getCategoryId(), errors);
        AdminMutationValidators.throwIfErrors(errors);

        Instant now = Instant.now();
        ArticleEntity entity = new ArticleEntity();
        entity.setId(generateId("article"));
        entity.setCreatedAt(now);
        entity.setUpdatedAt(now);

        applyArticlePatch(entity, request, slug, author, category, true);
        articleJpaRepository.save(entity);
        revalidateArticle(entity, null);

        Article article = contentReadRepository.findArticleById(entity.getId())
                .orElseThrow(() -> new NotFoundException("Content not found."));
        return toAdminContentItem(article);
    }

    @Transactional
    public AdminContentItem updateArticle(String articleId, UpsertArticleRequest request) {
        requireJpaPersistenceEnabled();

        ArticleEntity entity = articleJpaRepository.findById(articleId)
                .orElseThrow(() -> new NotFoundException("Content not found."));
        String previousSlug = entity.getSlug();

        List<ApiErrorDetail> errors = new ArrayList<>();
        String slug = validateArticleRequest(request, entity, false, errors);
        ContentAuthorEntity author = resolveAuthor(request.getAuthorId(), errors);
        ContentCategoryEntity category = resolveCategory(request.getCategoryId(), errors);
        PublishStatus nextStatus = request.getPublishStatus() == null ? entity.getPublishStatus() : request.getPublishStatus();
        AdminMutationValidators.validatePublishTransition(entity.getPublishStatus(), nextStatus, "publishStatus", errors);
        AdminMutationValidators.throwIfErrors(errors);

        entity.setUpdatedAt(Instant.now());
        applyArticlePatch(entity, request, slug, author, category, false);
        articleJpaRepository.save(entity);
        revalidateArticle(entity, previousSlug);

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

        PageEntity parent = resolveParentPage(request.getParentId(), null, errors);
        AdminMutationValidators.throwIfErrors(errors);
        applyPagePatch(entity, request, slug, parent, true);
        pageJpaRepository.save(entity);
        revalidatePage(entity, null);

        Page page = contentReadRepository.findPageById(entity.getId())
                .orElseThrow(() -> new NotFoundException("Content not found."));
        return toAdminContentItem(page);
    }

    @Transactional
    public AdminContentItem updatePage(String pageId, UpsertPageRequest request) {
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
        revalidatePage(entity, previousSlug);

        Page page = contentReadRepository.findPageById(entity.getId())
                .orElseThrow(() -> new NotFoundException("Content not found."));
        return toAdminContentItem(page);
    }

    @Transactional
    public AdminContentItem deleteArticle(String articleId) {
        requireJpaPersistenceEnabled();
        ArticleEntity entity = articleJpaRepository.findById(articleId)
                .orElseThrow(() -> new NotFoundException("Content not found."));
        entity.setPublishStatus(PublishStatus.ARCHIVED);
        entity.setUpdatedAt(Instant.now());
        articleJpaRepository.save(entity);
        revalidateArticle(entity, null);
        Article article = contentReadRepository.findArticleById(entity.getId())
                .orElseThrow(() -> new NotFoundException("Content not found."));
        return toAdminContentItem(article);
    }

    @Transactional
    public AdminContentItem deletePage(String pageId) {
        requireJpaPersistenceEnabled();
        PageEntity entity = pageJpaRepository.findById(pageId)
                .orElseThrow(() -> new NotFoundException("Content not found."));
        entity.setPublishStatus(PublishStatus.ARCHIVED);
        entity.setUpdatedAt(Instant.now());
        pageJpaRepository.save(entity);
        revalidatePage(entity, null);
        Page page = contentReadRepository.findPageById(entity.getId())
                .orElseThrow(() -> new NotFoundException("Content not found."));
        return toAdminContentItem(page);
    }

    private void requireJpaPersistenceEnabled() {
        if (articleJpaRepository == null
                || pageJpaRepository == null
                || contentAuthorJpaRepository == null
                || contentCategoryJpaRepository == null
                || blogTagJpaRepository == null) {
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

        AdminMutationValidators.validateImageAsset(
                request.getCoverImage(),
                "coverImage",
                mediaUrlProperties.getPublicBaseUrl(),
                errors
        );
        AdminMutationValidators.validateImageAsset(
                request.getProductImage(),
                "productImage",
                mediaUrlProperties.getPublicBaseUrl(),
                errors
        );
        AdminMutationValidators.validateSeoMeta(
                request.getSeo(),
                "seo",
                mediaUrlProperties.getPublicBaseUrl(),
                errors
        );

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

        AdminMutationValidators.validateSeoMeta(
                request.getSeo(),
                "seo",
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
            ContentAuthorEntity author,
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

        if (request.getProductImage() != null) {
            applyProductImage(entity, request.getProductImage());
        } else if (create) {
            clearProductImage(entity);
        }

        if (create || request.getAuthorId() != null) {
            entity.setAuthor(author);
        }
        if (create || request.getCategoryId() != null) {
            entity.setCategory(category);
            if (create) {
                List<ContentCategoryEntity> categories = new ArrayList<>();
                if (category != null) {
                    categories.add(category);
                }
                entity.setCategories(categories);
            }
        }
        if (create || request.getTags() != null) {
            entity.setTags(resolveTags(request.getTags()));
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
            PageEntity parent,
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
    }

    private ContentAuthorEntity resolveAuthor(String authorIdRaw, List<ApiErrorDetail> errors) {
        String authorId = AdminMutationValidators.trimToNull(authorIdRaw);
        if (authorId == null) {
            return null;
        }
        ContentAuthorEntity author = contentAuthorJpaRepository.findById(authorId).orElse(null);
        if (author == null) {
            errors.add(new ApiErrorDetail("authorId", "NOT_FOUND", "Author does not exist."));
        }
        return author;
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

    private List<BlogTagEntity> resolveTags(List<String> tags) {
        if (tags == null) {
            return new ArrayList<>();
        }
        List<BlogTagEntity> resolved = new ArrayList<>();
        LinkedHashSet<String> seenSlugs = new LinkedHashSet<>();
        for (String raw : tags) {
            String tagValue = AdminMutationValidators.trimToNull(raw);
            if (tagValue == null) {
                continue;
            }
            String slug = toSlug(tagValue);
            if (slug == null || !seenSlugs.add(slug)) {
                continue;
            }
            BlogTagEntity tag = resolveTag(tagValue, slug);
            if (tag != null) {
                resolved.add(tag);
            }
        }
        return resolved;
    }

    private BlogTagEntity resolveTag(String tagValue, String slug) {
        BlogTagEntity tag = blogTagJpaRepository.findBySlug(slug).orElse(null);
        if (tag != null) {
            return tag;
        }
        BlogTagEntity created = new BlogTagEntity();
        created.setId(generateId("blog-tag"));
        created.setSlug(slug);
        created.setName(tagValue);
        return blogTagJpaRepository.save(created);
    }

    private String toSlug(String value) {
        String normalized = AdminMutationValidators.trimToNull(value);
        if (normalized == null) {
            return null;
        }
        return normalized.toLowerCase().replaceAll("[^a-z0-9]+", "-").replaceAll("(^-|-$)", "");
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
                article.productImage(),
                article.publishStatus(),
                article.seo(),
                article.publishedAt(),
                article.createdAt(),
                article.updatedAt(),
                article.tags(),
                article.author(),
                article.author() != null ? article.author().id() : null,
                article.category(),
                article.category() != null ? article.category().id() : null,
                article.categories(),
                null,
                null
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
                null,
                page.publishStatus(),
                page.seo(),
                page.publishedAt(),
                page.createdAt(),
                page.updatedAt(),
                null,
                null,
                null,
                null,
                null,
                null,
                page.type(),
                page.parentId()
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
