package com.bigbike.bigbike_backend.service.admin;

import com.bigbike.bigbike_backend.api.admin.dto.ArticleTranslationRequest;
import com.bigbike.bigbike_backend.api.admin.dto.UpsertArticleRequest;
import com.bigbike.bigbike_backend.api.common.ApiErrorDetail;
import com.bigbike.bigbike_backend.config.MediaUrlProperties;
import com.bigbike.bigbike_backend.persistence.entity.content.ArticleEntity;
import com.bigbike.bigbike_backend.persistence.entity.content.ContentCategoryEntity;
import com.bigbike.bigbike_backend.persistence.repository.content.ArticleJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.content.ContentCategoryJpaRepository;
import com.bigbike.bigbike_backend.service.security.HomeVideoUrlPolicy;
import java.util.List;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

@Component
public class ContentRequestValidator {

    private final ArticleJpaRepository articleJpaRepository;
    private final ContentCategoryJpaRepository contentCategoryJpaRepository;
    private final MediaUrlProperties mediaUrlProperties;
    private final HomeVideoUrlPolicy homeVideoUrlPolicy;
    private final boolean isDev;

    public ContentRequestValidator(
            ObjectProvider<ArticleJpaRepository> articleJpaRepositoryProvider,
            ObjectProvider<ContentCategoryJpaRepository> contentCategoryJpaRepositoryProvider,
            MediaUrlProperties mediaUrlProperties,
            HomeVideoUrlPolicy homeVideoUrlPolicy,
            Environment environment
    ) {
        this.articleJpaRepository = articleJpaRepositoryProvider.getIfAvailable();
        this.contentCategoryJpaRepository = contentCategoryJpaRepositoryProvider.getIfAvailable();
        this.mediaUrlProperties = mediaUrlProperties;
        this.homeVideoUrlPolicy = homeVideoUrlPolicy;
        this.isDev = environment != null && java.util.Arrays.stream(environment.getActiveProfiles())
                .anyMatch(p -> java.util.Set.of("dev", "mock", "test", "local").contains(p.toLowerCase()));
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
                isDev,
                errors
        );

        if (request.isBodyBlocksPresent() && request.getBodyBlocks() != null) {
            // Grandfather media URLs already stored on the article (MEDIA_RULE_003) so editing legacy
            // content that hotlinks old images is not blocked; only NEW external urls are rejected.
            java.util.Set<String> existingBlockMediaUrls = current == null
                    ? new java.util.HashSet<>()
                    : AdminMutationValidators.collectBlockMediaUrls(current.getBodyBlocks());
            String base = mediaUrlProperties.getPublicBaseUrl();
            int index = 0;
            for (com.bigbike.bigbike_backend.domain.catalog.DescriptionBlock block : request.getBodyBlocks()) {
                if (block instanceof com.bigbike.bigbike_backend.domain.catalog.DescriptionBlock.ImageBlock imageBlock) {
                    String u = AdminMutationValidators.trimToNull(imageBlock.getUrl());
                    if (u != null && !existingBlockMediaUrls.contains(u)) {
                        AdminMutationValidators.validateWhitelistedMediaUrl(u, "bodyBlocks[" + index + "].url", base, errors);
                    }
                } else if (block instanceof com.bigbike.bigbike_backend.domain.catalog.DescriptionBlock.FeatureBlock featureBlock) {
                    String u = AdminMutationValidators.trimToNull(featureBlock.getUrl());
                    if (u != null && !existingBlockMediaUrls.contains(u)) {
                        AdminMutationValidators.validateWhitelistedMediaUrl(u, "bodyBlocks[" + index + "].url", base, errors);
                    }
                } else if (block instanceof com.bigbike.bigbike_backend.domain.catalog.DescriptionBlock.VideoBlock videoBlock) {
                    AdminMutationValidators.validateVideoBlockUrl(
                            videoBlock,
                            "bodyBlocks[" + index + "].url",
                            existingBlockMediaUrls,
                            homeVideoUrlPolicy,
                            errors
                    );
                }
                AdminMutationValidators.validateHtmlInlineImages(
                        AdminMutationValidators.blockRawHtml(block),
                        "bodyBlocks[" + index + "]", existingBlockMediaUrls, base, errors);
                index++;
            }
        }

        // Slug uniqueness is a persistence concern — skip it for the live-preview
        // dry-run, else previewing an EXISTING article (current is always null here)
        // would flag its own saved slug as a duplicate and always 400.
        if (!preview) {
            CatalogRequestValidator.validateVietnameseSlugAgainstEnglish(
                    slug,
                    current == null ? null : current.getId(),
                    s -> articleJpaRepository.findBySlug(s)
                            .filter(a -> a.getPublishStatus() != com.bigbike.bigbike_backend.domain.catalog.PublishStatus.TRASH)
                            .map(ArticleEntity::getId),
                    s -> articleJpaRepository.findBySlugEn(s)
                            .filter(a -> a.getPublishStatus() != com.bigbike.bigbike_backend.domain.catalog.PublishStatus.TRASH)
                            .map(ArticleEntity::getId),
                    errors
            );
        }

        if (!preview) {
            validateArticleEnglishSlug(request, slug, current, errors);
            // Tiếng Anh bắt buộc khi — và chỉ khi — tiếng Việt tương ứng đang được ĐẶT trong
            // request này (TRANSLATION_RULE_002, presence-flag): mirror đúng nhánh VI title ở
            // dòng 58 và EN-name danh mục/thương hiệu (`create || request.getName() != null`).
            // Cập nhật một phần KHÔNG chạm tiêu đề (vd bulk publish/hide chỉ gửi {publishStatus},
            // title == null) không phải là "sửa nội dung" → KHÔNG bắt buộc EN title, cho qua kể cả
            // bản ghi cũ chưa từng có EN. Khi thực sự sửa tiêu đề mà request bỏ qua bản dịch thì
            // fallback về giá trị đã lưu (`current`) thay vì bắt gửi lại toàn bộ bản dịch.
            if (create || request.getTitle() != null) {
                ArticleTranslationRequest.ArticleContentRequest en =
                        request.getTranslations() == null ? null : request.getTranslations().getEn();
                String enTitle = en == null ? null : en.getTitle();
                if (enTitle == null && current != null) {
                    enTitle = current.getTitleEn();
                }
                AdminMutationValidators.validateRequiredText(
                        enTitle, "translations.en.title", "English title", errors);
            }
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
