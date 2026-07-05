package com.bigbike.bigbike_backend.service.admin;

import com.bigbike.bigbike_backend.api.admin.dto.ArticleTranslationRequest;
import com.bigbike.bigbike_backend.api.admin.dto.UpsertArticleRequest;
import com.bigbike.bigbike_backend.api.common.ApiErrorDetail;
import com.bigbike.bigbike_backend.config.MediaUrlProperties;
import com.bigbike.bigbike_backend.persistence.entity.content.ArticleEntity;
import com.bigbike.bigbike_backend.persistence.entity.content.ContentCategoryEntity;
import com.bigbike.bigbike_backend.persistence.repository.content.ArticleJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.content.ContentCategoryJpaRepository;
import java.util.List;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Component;

@Component
public class ContentRequestValidator {

    private final ArticleJpaRepository articleJpaRepository;
    private final ContentCategoryJpaRepository contentCategoryJpaRepository;
    private final MediaUrlProperties mediaUrlProperties;

    public ContentRequestValidator(
            ObjectProvider<ArticleJpaRepository> articleJpaRepositoryProvider,
            ObjectProvider<ContentCategoryJpaRepository> contentCategoryJpaRepositoryProvider,
            MediaUrlProperties mediaUrlProperties
    ) {
        this.articleJpaRepository = articleJpaRepositoryProvider.getIfAvailable();
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

        if (request.isBodyBlocksPresent() && request.getBodyBlocks() != null) {
            int index = 0;
            for (com.bigbike.bigbike_backend.domain.catalog.DescriptionBlock block : request.getBodyBlocks()) {
                if (block instanceof com.bigbike.bigbike_backend.domain.catalog.DescriptionBlock.ImageBlock imageBlock) {
                    AdminMutationValidators.validateWhitelistedMediaUrl(
                            imageBlock.getUrl(),
                            "bodyBlocks[" + index + "].url",
                            mediaUrlProperties.getPublicBaseUrl(),
                            errors
                    );
                } else if (block instanceof com.bigbike.bigbike_backend.domain.catalog.DescriptionBlock.FeatureBlock featureBlock) {
                    AdminMutationValidators.validateWhitelistedMediaUrl(
                            featureBlock.getUrl(),
                            "bodyBlocks[" + index + "].url",
                            mediaUrlProperties.getPublicBaseUrl(),
                            errors
                    );
                }
                index++;
            }
        }

        // Slug uniqueness is a persistence concern — skip it for the live-preview
        // dry-run, else previewing an EXISTING article (current is always null here)
        // would flag its own saved slug as a duplicate and always 400.
        if (!preview && slug != null) {
            ArticleEntity existingBySlug = articleJpaRepository.findBySlug(slug).orElse(null);
            if (existingBySlug != null && existingBySlug.getPublishStatus() != com.bigbike.bigbike_backend.domain.catalog.PublishStatus.TRASH
                    && (current == null || !existingBySlug.getId().equals(current.getId()))) {
                errors.add(new ApiErrorDetail("slug", "DUPLICATE", "Slug is already in use."));
            }
            // A new vi slug must not collide with any article's English slug either.
            ArticleEntity existingBySlugEn = articleJpaRepository.findBySlugEn(slug).orElse(null);
            if (existingBySlugEn != null && existingBySlugEn.getPublishStatus() != com.bigbike.bigbike_backend.domain.catalog.PublishStatus.TRASH
                    && (current == null || !existingBySlugEn.getId().equals(current.getId()))) {
                errors.add(new ApiErrorDetail("slug", "DUPLICATE", "Slug is already in use (English slug)."));
            }
        }

        if (!preview) {
            validateArticleEnglishSlug(request, slug, current, errors);
            // Tiếng Anh chỉ bắt buộc khi tiếng Việt tương ứng đang bắt buộc (TRANSLATION_RULE_002).
            // `title` là field cốt lõi bắt buộc ở VI → bản ghi phải luôn có `translations.en.title`.
            // Request không gửi field này (vd bulk publish/hide chỉ gửi {publishStatus}) thì fallback
            // về giá trị đã lưu (`current`) thay vì bắt mọi request gửi lại toàn bộ bản dịch.
            ArticleTranslationRequest.ArticleContentRequest en =
                    request.getTranslations() == null ? null : request.getTranslations().getEn();
            String enTitle = en == null ? null : en.getTitle();
            if (enTitle == null && current != null) {
                enTitle = current.getTitleEn();
            }
            AdminMutationValidators.validateRequiredText(
                    enTitle, "translations.en.title", "English title", errors);
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
        ArticleEntity byViSlug = articleJpaRepository.findBySlug(slugEn).orElse(null);
        if (byViSlug != null && byViSlug.getPublishStatus() != com.bigbike.bigbike_backend.domain.catalog.PublishStatus.TRASH
                && (currentId == null || !byViSlug.getId().equals(currentId))) {
            errors.add(new ApiErrorDetail("translations.en.slug", "DUPLICATE", "English slug is already in use."));
            return;
        }
        ArticleEntity byEnSlug = articleJpaRepository.findBySlugEn(slugEn).orElse(null);
        if (byEnSlug != null && byEnSlug.getPublishStatus() != com.bigbike.bigbike_backend.domain.catalog.PublishStatus.TRASH
                && (currentId == null || !byEnSlug.getId().equals(currentId))) {
            errors.add(new ApiErrorDetail("translations.en.slug", "DUPLICATE", "English slug is already in use."));
        }
    }

    /** Slug nhóm bài viết mặc định. Sau V275 chỉ còn 1 nhóm "Tin tức"; form admin đã bỏ ô danh mục. */
    private static final String DEFAULT_CATEGORY_SLUG = "tin-tuc";

    public ContentCategoryEntity resolveCategory(String categoryIdRaw, List<ApiErrorDetail> errors) {
        String categoryId = AdminMutationValidators.trimToNull(categoryIdRaw);
        if (categoryId == null) {
            // Không gửi categoryId (form bỏ ô danh mục) → tự gán nhóm "Tin tức" để bài không bị mất nhóm.
            ContentCategoryEntity defaultCategory = contentCategoryJpaRepository == null
                    ? null
                    : contentCategoryJpaRepository.findBySlug(DEFAULT_CATEGORY_SLUG).orElse(null);
            if (defaultCategory == null) {
                errors.add(new ApiErrorDetail("categoryId", "NOT_FOUND", "Default category 'tin-tuc' not found."));
            }
            return defaultCategory;
        }
        ContentCategoryEntity category = contentCategoryJpaRepository.findById(categoryId).orElse(null);
        if (category == null) {
            errors.add(new ApiErrorDetail("categoryId", "NOT_FOUND", "Category does not exist."));
        }
        return category;
    }
}
