package com.bigbike.bigbike_backend.service.admin;

import com.bigbike.bigbike_backend.api.admin.dto.ArticleTranslationRequest;
import com.bigbike.bigbike_backend.api.admin.dto.UpsertArticleRequest;
import com.bigbike.bigbike_backend.api.admin.dto.UpsertPageRequest;
import com.bigbike.bigbike_backend.api.common.ApiErrorDetail;
import com.bigbike.bigbike_backend.config.MediaUrlProperties;
import com.bigbike.bigbike_backend.persistence.entity.content.ArticleEntity;
import com.bigbike.bigbike_backend.persistence.entity.content.ContentCategoryEntity;
import com.bigbike.bigbike_backend.persistence.entity.content.PageEntity;
import com.bigbike.bigbike_backend.persistence.repository.content.ArticleJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.content.ContentCategoryJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.content.PageJpaRepository;
import java.util.List;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Component;

@Component
public class ContentRequestValidator {

    private final ArticleJpaRepository articleJpaRepository;
    private final PageJpaRepository pageJpaRepository;
    private final ContentCategoryJpaRepository contentCategoryJpaRepository;
    private final MediaUrlProperties mediaUrlProperties;

    public ContentRequestValidator(
            ObjectProvider<ArticleJpaRepository> articleJpaRepositoryProvider,
            ObjectProvider<PageJpaRepository> pageJpaRepositoryProvider,
            ObjectProvider<ContentCategoryJpaRepository> contentCategoryJpaRepositoryProvider,
            MediaUrlProperties mediaUrlProperties
    ) {
        this.articleJpaRepository = articleJpaRepositoryProvider.getIfAvailable();
        this.pageJpaRepository = pageJpaRepositoryProvider.getIfAvailable();
        this.contentCategoryJpaRepository = contentCategoryJpaRepositoryProvider.getIfAvailable();
        this.mediaUrlProperties = mediaUrlProperties;
    }

    /** True when the request carries a non-empty {@code bodyBlocks} array (server will render it into {@code body}). */
    private static boolean hasBodyBlocks(boolean present, List<?> blocks) {
        return present && blocks != null && !blocks.isEmpty();
    }

    public String validateArticleRequest(
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

    public String validatePageRequest(
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

    public ContentCategoryEntity resolveCategory(String categoryIdRaw, List<ApiErrorDetail> errors) {
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

    public PageEntity resolveParentPage(String parentIdRaw, String currentPageId, List<ApiErrorDetail> errors) {
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
}
