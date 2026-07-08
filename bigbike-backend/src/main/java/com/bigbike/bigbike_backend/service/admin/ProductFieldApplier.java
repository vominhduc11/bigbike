package com.bigbike.bigbike_backend.service.admin;

import com.bigbike.bigbike_backend.api.admin.dto.GalleryImageRequest;
import com.bigbike.bigbike_backend.api.admin.dto.ImageAssetRequest;
import com.bigbike.bigbike_backend.api.admin.dto.ProductTranslationRequest;
import com.bigbike.bigbike_backend.api.admin.dto.SeoMetaRequest;
import com.bigbike.bigbike_backend.api.admin.dto.CommitmentRequest;
import com.bigbike.bigbike_backend.api.admin.dto.FaqRequest;
import com.bigbike.bigbike_backend.api.admin.dto.HighlightRequest;
import com.bigbike.bigbike_backend.api.admin.dto.VariantOptionRequest;
import com.bigbike.bigbike_backend.api.admin.dto.VariantRequest;
import com.bigbike.bigbike_backend.api.admin.dto.VideoRequest;
import com.bigbike.bigbike_backend.domain.catalog.GalleryMedia;
import com.bigbike.bigbike_backend.domain.catalog.ImageAsset;
import com.bigbike.bigbike_backend.domain.catalog.ProductCommitment;
import com.bigbike.bigbike_backend.domain.catalog.ProductFaq;
import com.bigbike.bigbike_backend.domain.catalog.ProductHighlight;
import com.bigbike.bigbike_backend.domain.catalog.ProductHighlights;
import com.bigbike.bigbike_backend.domain.catalog.VideoAsset;
import com.bigbike.bigbike_backend.persistence.entity.catalog.BrandEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.CategoryEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductVariantGalleryImageEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductVariantEntity;
import java.text.Normalizer;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

final class ProductFieldApplier {

    private ProductFieldApplier() {}

    private static final Set<String> COLOR_ATTRIBUTE_KEYS = Set.of(
            "color", "colour", "mau", "mau sac", "pa color", "pa mau", "pa mau sac"
    );

    public static void applyGallery(ProductEntity entity, List<GalleryImageRequest> requests) {
        List<Indexed<GalleryImageRequest>> ordered = ordered(requests, GalleryImageRequest::getSortOrder);
        List<GalleryMedia> gallery = new ArrayList<>();
        for (Indexed<GalleryImageRequest> item : ordered) {
            GalleryImageRequest req = item.value();
            boolean isVideo = isVideoGalleryItem(req);
            String url = AdminMutationValidators.trimToNull(req.getUrl());
            String videoUrl = AdminMutationValidators.trimToNull(req.getVideoUrl());
            // Bỏ qua item rỗng: ảnh thiếu url, hoặc video thiếu videoUrl.
            if (isVideo ? videoUrl == null : url == null) continue;
            if (isVideo) {
                gallery.add(GalleryMedia.ofVideo(
                        buildImageAsset(url, req.getAlt(), req.getWidth(), req.getHeight(), req.getMimeType()),
                        videoUrl,
                        AdminMutationValidators.trimToNull(req.getVideoProvider())));
            } else {
                gallery.add(GalleryMedia.ofImage(
                        buildImageAsset(url, req.getAlt(), req.getWidth(), req.getHeight(), req.getMimeType())));
            }
        }
        entity.setGallery(gallery);
    }

    /** Một dòng gallery là VIDEO khi mediaType="video" hoặc có videoUrl. */
    public static boolean isVideoGalleryItem(GalleryImageRequest req) {
        if (req == null) return false;
        if ("video".equals(AdminMutationValidators.trimToNull(req.getMediaType()))) return true;
        return AdminMutationValidators.trimToNull(req.getVideoUrl()) != null;
    }

    /** Dựng {@link ImageAsset} từ 1 gallery/video request. {@code id} luôn null (request không có field id trên wire). */
    private static ImageAsset buildImageAsset(String url, String alt, Integer width, Integer height, String mimeType) {
        if (url == null) return null;
        return new ImageAsset(null, url, AdminMutationValidators.trimToNull(alt), width, height,
                AdminMutationValidators.trimToNull(mimeType));
    }

    public static void applyVideos(ProductEntity entity, List<VideoRequest> requests) {
        List<Indexed<VideoRequest>> ordered = ordered(requests, VideoRequest::getSortOrder);
        List<VideoAsset> videos = new ArrayList<>();
        for (Indexed<VideoRequest> item : ordered) {
            VideoRequest req = item.value();
            String url = AdminMutationValidators.trimToNull(req.getUrl());
            if (url == null) continue;
            String thumbnailUrl = AdminMutationValidators.trimToNull(req.getThumbnailUrl());
            ImageAsset thumbnail = buildImageAsset(thumbnailUrl, null, null, null, null);
            videos.add(new VideoAsset(
                    null,
                    url,
                    AdminMutationValidators.trimToNull(req.getTitle()),
                    thumbnail,
                    AdminMutationValidators.trimToNull(req.getProvider()),
                    AdminMutationValidators.trimToNull(req.getDescription())));
        }
        entity.setVideos(videos);
    }

    /**
     * Full-replace the optional English product-level columns (V136).
     * A {@code null} translations object — or a missing {@code en} block —
     * clears every column; English is optional (PRODUCT_RULE_001).
     */
    public static void applyTranslations(ProductEntity entity, ProductTranslationRequest translations) {
        ProductTranslationRequest.ProductContentRequest en =
                translations == null ? null : translations.getEn();
        entity.setSlugEn(en == null ? null : AdminMutationValidators.trimToNull(en.getSlug()));
        entity.setNameEn(en == null ? null : AdminMutationValidators.trimToNull(en.getName()));
        entity.setShortDescriptionEn(en == null ? null : AdminMutationValidators.trimToNull(en.getShortDescription()));
        entity.setDescriptionEn(en == null ? null : AdminMutationValidators.trimToNull(en.getDescription()));
        entity.setSizeGuideEn(en == null ? null : AdminMutationValidators.trimToNull(en.getSizeGuide()));
        entity.setSuitabilityAdvisoryEn(en == null ? null : AdminMutationValidators.trimToNull(en.getSuitabilityAdvisory()));
        entity.setSpecificationsEn(en == null ? null : AdminMutationValidators.trimToNull(en.getSpecifications()));
        entity.setSpecStatsEn(en == null ? null : AdminMutationValidators.trimToNull(en.getSpecStats()));
        entity.setTrustBadgesEn(en == null ? null : AdminMutationValidators.trimToNull(en.getTrustBadges()));
        entity.setQuickAnswerSummaryEn(en == null ? null : AdminMutationValidators.trimToNull(en.getQuickAnswerSummary()));
        entity.setSeoTitleEn(en == null ? null : AdminMutationValidators.trimToNull(en.getSeoTitle()));
        entity.setSeoDescriptionEn(en == null ? null : AdminMutationValidators.trimToNull(en.getSeoDescription()));
        entity.setOriginBrandCountryEn(en == null ? null : AdminMutationValidators.trimToNull(en.getOriginBrandCountry()));
    }

    public static void applyFaqs(ProductEntity entity, List<FaqRequest> requests) {
        List<Indexed<FaqRequest>> ordered = ordered(requests, FaqRequest::getSortOrder);
        List<ProductFaq> faqs = new ArrayList<>();
        for (Indexed<FaqRequest> item : ordered) {
            FaqRequest req = item.value();
            String question = AdminMutationValidators.trimToNull(req.getQuestion());
            String answer = AdminMutationValidators.trimToNull(req.getAnswer());
            if (question == null || answer == null) continue;
            faqs.add(new ProductFaq(
                    question,
                    answer,
                    AdminMutationValidators.trimToNull(req.getQuestionEn()),
                    AdminMutationValidators.trimToNull(req.getAnswerEn())
            ));
        }
        entity.setFaqs(faqs);
    }

    /** Fallback icon key when admin leaves it blank — matches the web default. */
    private static final String COMMITMENT_DEFAULT_ICON = "shield-check";

    /**
     * Per-product commitment rows (V232) — full-replace like {@code faqs}. Rows
     * with a blank title are dropped; a blank icon falls back to the web default.
     */
    public static void applyCommitments(ProductEntity entity, List<CommitmentRequest> requests) {
        List<Indexed<CommitmentRequest>> ordered = ordered(requests, CommitmentRequest::getSortOrder);
        List<ProductCommitment> commitments = new ArrayList<>();
        for (Indexed<CommitmentRequest> item : ordered) {
            CommitmentRequest req = item.value();
            String title = AdminMutationValidators.trimToNull(req.getTitle());
            if (title == null) continue;
            String icon = AdminMutationValidators.trimToNull(req.getIcon());
            commitments.add(new ProductCommitment(
                    icon != null ? icon : COMMITMENT_DEFAULT_ICON,
                    title,
                    AdminMutationValidators.trimToNull(req.getSubtitle()),
                    AdminMutationValidators.trimToNull(req.getTitleEn()),
                    AdminMutationValidators.trimToNull(req.getSubtitleEn())
            ));
        }
        entity.setCommitments(commitments);
    }

    /**
     * Ưu/Nhược điểm (V175) — lưu JSONB trên products.highlights. Mỗi nhóm full-replace
     * ĐỘC LẬP: chỉ thay nhóm có mặt trong request, giữ nguyên nhóm kia (null = không đụng).
     */
    public static void applyHighlights(
            ProductEntity entity,
            List<HighlightRequest> positives,
            List<HighlightRequest> negatives
    ) {
        ProductHighlights current = entity.getHighlights();
        List<ProductHighlight> currentPositive = current == null || current.positiveNotes() == null
                ? List.of()
                : current.positiveNotes();
        List<ProductHighlight> currentNegative = current == null || current.negativeNotes() == null
                ? List.of()
                : current.negativeNotes();
        entity.setHighlights(new ProductHighlights(
                positives == null ? currentPositive : toHighlights(positives),
                negatives == null ? currentNegative : toHighlights(negatives)
        ));
    }

    private static List<ProductHighlight> toHighlights(List<HighlightRequest> requests) {
        List<Indexed<HighlightRequest>> ordered = ordered(requests, HighlightRequest::getSortOrder);
        List<ProductHighlight> highlights = new ArrayList<>();
        for (Indexed<HighlightRequest> item : ordered) {
            HighlightRequest req = item.value();
            String content = AdminMutationValidators.trimToNull(req.getContent());
            if (content == null) continue;
            highlights.add(new ProductHighlight(content, AdminMutationValidators.trimToNull(req.getContentEn())));
        }
        return highlights;
    }

    private record Indexed<T>(T value, int index, Integer sortOrder) {
    }

    private interface SortOrderReader<T> {
        Integer sortOrder(T value);
    }

    private static <T> List<Indexed<T>> ordered(List<T> requests, SortOrderReader<T> sortOrderReader) {
        if (requests == null || requests.isEmpty()) {
            return List.of();
        }
        List<Indexed<T>> indexed = new ArrayList<>();
        for (int i = 0; i < requests.size(); i++) {
            T request = requests.get(i);
            indexed.add(new Indexed<>(request, i, sortOrderReader.sortOrder(request)));
        }
        indexed.sort(Comparator
                .comparing((Indexed<T> item) -> item.sortOrder() == null ? item.index() : item.sortOrder())
                .thenComparingInt(Indexed::index));
        return indexed;
    }

    public static boolean hasGalleryRequests(List<GalleryImageRequest> requests) {
        if (requests == null) return false;
        // Item "có mặt" khi có url ảnh HOẶC videoUrl (V248: gallery chứa cả ảnh lẫn video).
        return requests.stream().anyMatch(req -> req != null
                && (AdminMutationValidators.trimToNull(req.getUrl()) != null
                    || AdminMutationValidators.trimToNull(req.getVideoUrl()) != null));
    }

    public static String variantColorKey(VariantRequest variant) {
        if (variant == null || variant.getOptions() == null) return null;
        for (VariantOptionRequest option : variant.getOptions()) {
            if (option == null) continue;
            if (isColorAttributeName(option.getOptionName())) {
                String value = normalizeVariantToken(option.getOptionValue());
                return value.isEmpty() ? null : value;
            }
        }
        return null;
    }

    public static boolean isColorAttributeName(String name) {
        return COLOR_ATTRIBUTE_KEYS.contains(normalizeVariantToken(name));
    }

    public static String normalizeVariantToken(String raw) {
        String trimmed = AdminMutationValidators.trimToNull(raw);
        if (trimmed == null) return "";
        String normalized = Normalizer.normalize(trimmed, Normalizer.Form.NFD)
                .replaceAll("\\p{M}+", "")
                .replace('Đ', 'D')
                .replace('đ', 'd')
                .toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9]+", " ")
                .trim();
        return normalized;
    }

    public static Map<String, List<GalleryImageRequest>> colorGalleryRequests(List<VariantRequest> requests) {
        Map<String, List<GalleryImageRequest>> galleryByColor = new HashMap<>();
        for (VariantRequest request : requests) {
            String colorKey = variantColorKey(request);
            if (colorKey != null && hasGalleryRequests(request.getGallery())) {
                galleryByColor.putIfAbsent(colorKey, request.getGallery());
            }
        }
        return galleryByColor;
    }


    public static void applyVariantGallery(ProductVariantEntity variant, List<GalleryImageRequest> requests) {
        List<ProductVariantGalleryImageEntity> existing = variant.getGallery();
        if (existing == null) {
            existing = new ArrayList<>();
            variant.setGallery(existing);
        }
        existing.clear();
        if (requests == null) return;
        for (int i = 0; i < requests.size(); i++) {
            GalleryImageRequest req = requests.get(i);
            boolean isVideo = isVideoGalleryItem(req);
            String url = AdminMutationValidators.trimToNull(req.getUrl());
            String videoUrl = AdminMutationValidators.trimToNull(req.getVideoUrl());
            if (isVideo ? videoUrl == null : url == null) continue;
            ProductVariantGalleryImageEntity img = new ProductVariantGalleryImageEntity();
            img.setVariant(variant);
            img.setSortOrder(req.getSortOrder() != null ? req.getSortOrder() : i);
            img.setMediaType(isVideo ? "video" : "image");
            img.setVideoUrl(isVideo ? videoUrl : null);
            img.setVideoProvider(isVideo ? AdminMutationValidators.trimToNull(req.getVideoProvider()) : null);
            img.setImageUrl(url);
            img.setImageAlt(AdminMutationValidators.trimToNull(req.getAlt()));
            img.setImageWidth(req.getWidth());
            img.setImageHeight(req.getHeight());
            img.setImageMimeType(AdminMutationValidators.trimToNull(req.getMimeType()));
            existing.add(img);
        }
    }

    public static void applyImage(ProductEntity entity, ImageAssetRequest request) {
        entity.setImageId(null);
        entity.setImageUrl(AdminMutationValidators.trimToNull(request.getUrl()));
        entity.setImageAlt(AdminMutationValidators.trimToNull(request.getAlt()));
        entity.setImageWidth(request.getWidth());
        entity.setImageHeight(request.getHeight());
        entity.setImageMimeType(AdminMutationValidators.trimToNull(request.getMimeType()));
    }

    public static void clearImage(ProductEntity entity) {
        entity.setImageId(null);
        entity.setImageUrl(null);
        entity.setImageAlt(null);
        entity.setImageWidth(null);
        entity.setImageHeight(null);
        entity.setImageMimeType(null);
    }

    public static void applyImage(CategoryEntity entity, ImageAssetRequest request) {
        entity.setImageId(null);
        entity.setImageUrl(AdminMutationValidators.trimToNull(request.getUrl()));
        entity.setImageAlt(AdminMutationValidators.trimToNull(request.getAlt()));
        entity.setImageWidth(request.getWidth());
        entity.setImageHeight(request.getHeight());
        entity.setImageMimeType(AdminMutationValidators.trimToNull(request.getMimeType()));
    }

    public static void clearImage(CategoryEntity entity) {
        entity.setImageId(null);
        entity.setImageUrl(null);
        entity.setImageAlt(null);
        entity.setImageWidth(null);
        entity.setImageHeight(null);
        entity.setImageMimeType(null);
    }

    public static void applyBanner(CategoryEntity entity, ImageAssetRequest request) {
        entity.setBannerUrl(AdminMutationValidators.trimToNull(request.getUrl()));
        entity.setBannerAlt(AdminMutationValidators.trimToNull(request.getAlt()));
    }

    public static void clearBanner(CategoryEntity entity) {
        entity.setBannerUrl(null);
        entity.setBannerAlt(null);
    }

    public static void applyMobileBanner(CategoryEntity entity, ImageAssetRequest request) {
        entity.setMobileBannerUrl(AdminMutationValidators.trimToNull(request.getUrl()));
        entity.setMobileBannerAlt(AdminMutationValidators.trimToNull(request.getAlt()));
    }

    public static void clearMobileBanner(CategoryEntity entity) {
        entity.setMobileBannerUrl(null);
        entity.setMobileBannerAlt(null);
    }

    public static void applyIcon(CategoryEntity entity, ImageAssetRequest request) {
        entity.setIconId(null);
        entity.setIconUrl(AdminMutationValidators.trimToNull(request.getUrl()));
        entity.setIconAlt(AdminMutationValidators.trimToNull(request.getAlt()));
        entity.setIconWidth(request.getWidth());
        entity.setIconHeight(request.getHeight());
        entity.setIconMimeType(AdminMutationValidators.trimToNull(request.getMimeType()));
    }

    public static void clearIcon(CategoryEntity entity) {
        entity.setIconId(null);
        entity.setIconUrl(null);
        entity.setIconAlt(null);
        entity.setIconWidth(null);
        entity.setIconHeight(null);
        entity.setIconMimeType(null);
    }

    public static void applyLogo(BrandEntity entity, ImageAssetRequest request) {
        String url = AdminMutationValidators.trimToNull(request.getUrl());
        entity.setLogoId(null);
        entity.setLogoUrl(url);
        entity.setLogoAlt(AdminMutationValidators.trimToNull(request.getAlt()));
        if (url == null) {
            entity.setLogoWidth(null);
            entity.setLogoHeight(null);
            entity.setLogoMimeType(null);
        } else {
            if (request.getWidth() != null) entity.setLogoWidth(request.getWidth());
            if (request.getHeight() != null) entity.setLogoHeight(request.getHeight());
            if (request.getMimeType() != null) entity.setLogoMimeType(AdminMutationValidators.trimToNull(request.getMimeType()));
        }
    }

    public static void clearLogo(BrandEntity entity) {
        entity.setLogoId(null);
        entity.setLogoUrl(null);
        entity.setLogoAlt(null);
        entity.setLogoWidth(null);
        entity.setLogoHeight(null);
        entity.setLogoMimeType(null);
    }

    public static void applyBanner(BrandEntity entity, ImageAssetRequest request) {
        entity.setBannerUrl(AdminMutationValidators.trimToNull(request.getUrl()));
        entity.setBannerAlt(AdminMutationValidators.trimToNull(request.getAlt()));
    }

    public static void clearBanner(BrandEntity entity) {
        entity.setBannerUrl(null);
        entity.setBannerAlt(null);
    }

    public static void applyMobileBanner(BrandEntity entity, ImageAssetRequest request) {
        entity.setMobileBannerUrl(AdminMutationValidators.trimToNull(request.getUrl()));
        entity.setMobileBannerAlt(AdminMutationValidators.trimToNull(request.getAlt()));
    }

    public static void clearMobileBanner(BrandEntity entity) {
        entity.setMobileBannerUrl(null);
        entity.setMobileBannerAlt(null);
    }

    public static void applySeo(ProductEntity entity, SeoMetaRequest request) {
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

    public static void clearSeo(ProductEntity entity) {
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

    public static void applySeo(CategoryEntity entity, SeoMetaRequest request) {
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

    public static void clearSeo(CategoryEntity entity) {
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

    public static void applySeo(BrandEntity entity, SeoMetaRequest request) {
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

        String ogUrl = AdminMutationValidators.trimToNull(request.getOgImage().getUrl());
        entity.setSeoOgImageId(null);
        entity.setSeoOgImageUrl(ogUrl);
        entity.setSeoOgImageAlt(AdminMutationValidators.trimToNull(request.getOgImage().getAlt()));
        if (ogUrl == null) {
            entity.setSeoOgImageWidth(null);
            entity.setSeoOgImageHeight(null);
            entity.setSeoOgImageMimeType(null);
        } else {
            if (request.getOgImage().getWidth() != null) entity.setSeoOgImageWidth(request.getOgImage().getWidth());
            if (request.getOgImage().getHeight() != null) entity.setSeoOgImageHeight(request.getOgImage().getHeight());
            if (request.getOgImage().getMimeType() != null) entity.setSeoOgImageMimeType(AdminMutationValidators.trimToNull(request.getOgImage().getMimeType()));
        }
    }

    public static void clearSeo(BrandEntity entity) {
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
}
