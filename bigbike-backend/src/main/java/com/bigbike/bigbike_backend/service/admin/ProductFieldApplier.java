package com.bigbike.bigbike_backend.service.admin;

import com.bigbike.bigbike_backend.api.admin.dto.GalleryImageRequest;
import com.bigbike.bigbike_backend.api.admin.dto.ImageAssetRequest;
import com.bigbike.bigbike_backend.api.admin.dto.ProductTranslationRequest;
import com.bigbike.bigbike_backend.api.admin.dto.SeoMetaRequest;
import com.bigbike.bigbike_backend.api.admin.dto.ProductTabRequest;
import com.bigbike.bigbike_backend.api.admin.dto.SpecificationRequest;
import com.bigbike.bigbike_backend.api.admin.dto.SpecStatRequest;
import com.bigbike.bigbike_backend.domain.catalog.ProductTab;
import com.bigbike.bigbike_backend.api.admin.dto.CommitmentRequest;
import com.bigbike.bigbike_backend.api.admin.dto.PurchaseLineRequest;
import com.bigbike.bigbike_backend.api.admin.dto.TrustBadgeRequest;
import com.bigbike.bigbike_backend.api.admin.dto.FaqRequest;
import com.bigbike.bigbike_backend.api.admin.dto.HighlightRequest;
import com.bigbike.bigbike_backend.api.admin.dto.VariantOptionRequest;
import com.bigbike.bigbike_backend.api.admin.dto.VariantRequest;
import com.bigbike.bigbike_backend.api.admin.dto.VideoRequest;
import com.bigbike.bigbike_backend.persistence.entity.catalog.BrandEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.CategoryEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductGalleryImageEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductVariantGalleryImageEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductSpecificationEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductSpecStatEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductCommitmentEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductPurchaseLineEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductTrustBadgeEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductFaqEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductHighlightEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductVariantEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductVideoEntity;
import java.text.Normalizer;
import java.util.ArrayList;
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
        List<ProductGalleryImageEntity> existing = entity.getGallery();
        if (existing == null) {
            existing = new ArrayList<>();
            entity.setGallery(existing);
        }
        existing.clear();
        for (int i = 0; i < requests.size(); i++) {
            GalleryImageRequest req = requests.get(i);
            boolean isVideo = isVideoGalleryItem(req);
            String url = AdminMutationValidators.trimToNull(req.getUrl());
            String videoUrl = AdminMutationValidators.trimToNull(req.getVideoUrl());
            // Bỏ qua item rỗng: ảnh thiếu url, hoặc video thiếu videoUrl.
            if (isVideo ? videoUrl == null : url == null) continue;
            ProductGalleryImageEntity img = new ProductGalleryImageEntity();
            img.setProduct(entity);
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

    /** Một dòng gallery là VIDEO khi mediaType="video" hoặc có videoUrl. */
    public static boolean isVideoGalleryItem(GalleryImageRequest req) {
        if (req == null) return false;
        if ("video".equals(AdminMutationValidators.trimToNull(req.getMediaType()))) return true;
        return AdminMutationValidators.trimToNull(req.getVideoUrl()) != null;
    }

    public static void applyVideos(ProductEntity entity, List<VideoRequest> requests) {
        List<ProductVideoEntity> existing = entity.getVideos();
        if (existing == null) {
            existing = new ArrayList<>();
            entity.setVideos(existing);
        }
        existing.clear();
        for (int i = 0; i < requests.size(); i++) {
            VideoRequest req = requests.get(i);
            String url = AdminMutationValidators.trimToNull(req.getUrl());
            if (url == null) continue;
            ProductVideoEntity video = new ProductVideoEntity();
            video.setProduct(entity);
            video.setSortOrder(req.getSortOrder() != null ? req.getSortOrder() : i);
            video.setVideoUrl(url);
            video.setTitle(AdminMutationValidators.trimToNull(req.getTitle()));
            video.setProvider(AdminMutationValidators.trimToNull(req.getProvider()));
            video.setDescription(AdminMutationValidators.trimToNull(req.getDescription()));
            video.setThumbnailUrl(AdminMutationValidators.trimToNull(req.getThumbnailUrl()));
            existing.add(video);
        }
    }

    /**
     * Full-replace the eight optional English product-level columns (V136).
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
        entity.setPromotionContentEn(en == null ? null : AdminMutationValidators.trimToNull(en.getPromotionContent()));
        entity.setInstallationGuideEn(en == null ? null : AdminMutationValidators.trimToNull(en.getInstallationGuide()));
        entity.setSuitabilityAdvisoryEn(en == null ? null : AdminMutationValidators.trimToNull(en.getSuitabilityAdvisory()));
        entity.setSpecificationsHtmlEn(en == null ? null : AdminMutationValidators.trimToNull(en.getSpecificationsHtml()));
        entity.setSeoTitleEn(en == null ? null : AdminMutationValidators.trimToNull(en.getSeoTitle()));
        entity.setSeoDescriptionEn(en == null ? null : AdminMutationValidators.trimToNull(en.getSeoDescription()));
    }

    public static void applySpecifications(ProductEntity entity, List<SpecificationRequest> requests) {
        List<ProductSpecificationEntity> existing = entity.getSpecifications();
        if (existing == null) {
            existing = new ArrayList<>();
            entity.setSpecifications(existing);
        }
        existing.clear();
        for (int i = 0; i < requests.size(); i++) {
            SpecificationRequest req = requests.get(i);
            String name = AdminMutationValidators.trimToNull(req.getName());
            String value = AdminMutationValidators.trimToNull(req.getValue());
            if (name == null || value == null) continue;
            ProductSpecificationEntity spec = new ProductSpecificationEntity();
            spec.setProduct(entity);
            spec.setSortOrder(req.getSortOrder() != null ? req.getSortOrder() : i);
            spec.setName(name);
            spec.setValue(value);
            spec.setGroupName(AdminMutationValidators.trimToNull(req.getGroupName()));
            spec.setNameEn(AdminMutationValidators.trimToNull(req.getNameEn()));
            spec.setValueEn(AdminMutationValidators.trimToNull(req.getValueEn()));
            spec.setGroupNameEn(AdminMutationValidators.trimToNull(req.getGroupNameEn()));
            existing.add(spec);
        }
    }

    /**
     * "Specs Dashboard" stat boxes (V235) — full-replace like {@code specifications}.
     * Rows with a blank value or label are dropped; max 4 enforced at the DTO boundary.
     */
    public static void applySpecStats(ProductEntity entity, List<SpecStatRequest> requests) {
        List<ProductSpecStatEntity> existing = entity.getSpecStats();
        if (existing == null) {
            existing = new ArrayList<>();
            entity.setSpecStats(existing);
        }
        existing.clear();
        for (int i = 0; i < requests.size(); i++) {
            SpecStatRequest req = requests.get(i);
            String value = AdminMutationValidators.trimToNull(req.getValue());
            String label = AdminMutationValidators.trimToNull(req.getLabel());
            if (value == null || label == null) continue;
            ProductSpecStatEntity stat = new ProductSpecStatEntity();
            stat.setProduct(entity);
            stat.setSortOrder(req.getSortOrder() != null ? req.getSortOrder() : i);
            stat.setValue(value);
            stat.setLabel(label);
            stat.setValueEn(AdminMutationValidators.trimToNull(req.getValueEn()));
            stat.setLabelEn(AdminMutationValidators.trimToNull(req.getLabelEn()));
            existing.add(stat);
        }
    }

    /**
     * Chuyển danh sách tab từ request thành cấu hình lưu trữ (V231). Lưu canonical: label/blocks = vi,
     * labelEn/blocksEn = en. Tab thiếu type bị bỏ. Trả {@code null} khi rỗng (sản phẩm dùng tab mặc định).
     */
    public static List<ProductTab> mapTabs(List<ProductTabRequest> requests) {
        if (requests == null || requests.isEmpty()) return null;
        List<ProductTab> out = new ArrayList<>();
        for (int i = 0; i < requests.size(); i++) {
            ProductTabRequest r = requests.get(i);
            String type = AdminMutationValidators.trimToNull(r.getType());
            if (type == null) continue;
            String id = AdminMutationValidators.trimToNull(r.getId());
            boolean custom = "custom".equals(type);
            out.add(new ProductTab(
                    id != null ? id : type,
                    type,
                    r.isEnabled(),
                    r.getSortOrder() != null ? r.getSortOrder() : i,
                    AdminMutationValidators.trimToNull(r.getLabel()),
                    AdminMutationValidators.trimToNull(r.getLabelEn()),
                    custom ? emptyToNull(r.getBlocks()) : null,
                    custom ? emptyToNull(r.getBlocksEn()) : null
            ));
        }
        return out.isEmpty() ? null : out;
    }

    public static <T> List<T> emptyToNull(List<T> list) {
        return list == null || list.isEmpty() ? null : list;
    }

    public static void applyFaqs(ProductEntity entity, List<FaqRequest> requests) {
        List<ProductFaqEntity> existing = entity.getFaqs();
        if (existing == null) {
            existing = new ArrayList<>();
            entity.setFaqs(existing);
        }
        existing.clear();
        for (int i = 0; i < requests.size(); i++) {
            FaqRequest req = requests.get(i);
            String question = AdminMutationValidators.trimToNull(req.getQuestion());
            String answer = AdminMutationValidators.trimToNull(req.getAnswer());
            if (question == null || answer == null) continue;
            ProductFaqEntity faq = new ProductFaqEntity();
            faq.setProduct(entity);
            faq.setSortOrder(req.getSortOrder() != null ? req.getSortOrder() : i);
            faq.setQuestion(question);
            faq.setAnswer(answer);
            faq.setQuestionEn(AdminMutationValidators.trimToNull(req.getQuestionEn()));
            faq.setAnswerEn(AdminMutationValidators.trimToNull(req.getAnswerEn()));
            existing.add(faq);
        }
    }

    /** Fallback icon key when admin leaves it blank — matches the web default. */
    private static final String COMMITMENT_DEFAULT_ICON = "shield-check";

    /**
     * Per-product commitment rows (V232) — full-replace like {@code faqs}. Rows
     * with a blank title are dropped; a blank icon falls back to the web default.
     */
    public static void applyCommitments(ProductEntity entity, List<CommitmentRequest> requests) {
        List<ProductCommitmentEntity> existing = entity.getCommitments();
        if (existing == null) {
            existing = new ArrayList<>();
            entity.setCommitments(existing);
        }
        existing.clear();
        for (int i = 0; i < requests.size(); i++) {
            CommitmentRequest req = requests.get(i);
            String title = AdminMutationValidators.trimToNull(req.getTitle());
            if (title == null) continue;
            String icon = AdminMutationValidators.trimToNull(req.getIcon());
            ProductCommitmentEntity commitment = new ProductCommitmentEntity();
            commitment.setProduct(entity);
            commitment.setSortOrder(req.getSortOrder() != null ? req.getSortOrder() : i);
            commitment.setIcon(icon != null ? icon : COMMITMENT_DEFAULT_ICON);
            commitment.setTitle(title);
            commitment.setSubtitle(AdminMutationValidators.trimToNull(req.getSubtitle()));
            commitment.setTitleEn(AdminMutationValidators.trimToNull(req.getTitleEn()));
            commitment.setSubtitleEn(AdminMutationValidators.trimToNull(req.getSubtitleEn()));
            existing.add(commitment);
        }
    }

    private static final String PURCHASE_LINE_DEFAULT_ICON = "shield-check";

    /**
     * Per-product "Mua tại BigBike.vn" lines (V249) — full-replace like {@code commitments}.
     * Rows with a blank label are dropped; a blank icon falls back to the default.
     */
    public static void applyPurchaseLines(ProductEntity entity, List<PurchaseLineRequest> requests) {
        List<ProductPurchaseLineEntity> existing = entity.getPurchaseLines();
        if (existing == null) {
            existing = new ArrayList<>();
            entity.setPurchaseLines(existing);
        }
        existing.clear();
        for (int i = 0; i < requests.size(); i++) {
            PurchaseLineRequest req = requests.get(i);
            String label = AdminMutationValidators.trimToNull(req.getLabel());
            if (label == null) continue;
            String icon = AdminMutationValidators.trimToNull(req.getIcon());
            ProductPurchaseLineEntity line = new ProductPurchaseLineEntity();
            line.setProduct(entity);
            line.setSortOrder(req.getSortOrder() != null ? req.getSortOrder() : i);
            line.setIcon(icon != null ? icon : PURCHASE_LINE_DEFAULT_ICON);
            line.setLabel(label);
            line.setValue(AdminMutationValidators.trimToNull(req.getValue()));
            line.setLabelEn(AdminMutationValidators.trimToNull(req.getLabelEn()));
            line.setValueEn(AdminMutationValidators.trimToNull(req.getValueEn()));
            existing.add(line);
        }
    }

    /**
     * Per-product trust badges (V233) — full-replace like {@code commitments}.
     * Rows with a blank content are dropped.
     */
    public static void applyTrustBadges(ProductEntity entity, List<TrustBadgeRequest> requests) {
        List<ProductTrustBadgeEntity> existing = entity.getTrustBadges();
        if (existing == null) {
            existing = new ArrayList<>();
            entity.setTrustBadges(existing);
        }
        existing.clear();
        for (int i = 0; i < requests.size(); i++) {
            TrustBadgeRequest req = requests.get(i);
            String content = AdminMutationValidators.trimToNull(req.getContent());
            if (content == null) continue;
            ProductTrustBadgeEntity badge = new ProductTrustBadgeEntity();
            badge.setProduct(entity);
            badge.setSortOrder(req.getSortOrder() != null ? req.getSortOrder() : i);
            badge.setContent(content);
            badge.setContentEn(AdminMutationValidators.trimToNull(req.getContentEn()));
            existing.add(badge);
        }
    }

    /**
     * Ưu/Nhược điểm (V175) — cùng bảng con phân biệt bằng {@code kind}. Mỗi nhóm
     * full-replace ĐỘC LẬP: chỉ thay nhóm có mặt trong request, giữ nguyên nhóm
     * kia (null = không đụng). Mục {@code content} blank bị bỏ qua.
     */
    public static void applyHighlights(
            ProductEntity entity,
            List<HighlightRequest> positives,
            List<HighlightRequest> negatives
    ) {
        List<ProductHighlightEntity> existing = entity.getHighlights();
        if (existing == null) {
            existing = new ArrayList<>();
            entity.setHighlights(existing);
        }
        if (positives != null) {
            existing.removeIf(h -> ProductHighlightEntity.KIND_PRO.equals(h.getKind()));
            appendHighlights(entity, existing, positives, ProductHighlightEntity.KIND_PRO);
        }
        if (negatives != null) {
            existing.removeIf(h -> ProductHighlightEntity.KIND_CON.equals(h.getKind()));
            appendHighlights(entity, existing, negatives, ProductHighlightEntity.KIND_CON);
        }
    }

    public static void appendHighlights(
            ProductEntity entity,
            List<ProductHighlightEntity> target,
            List<HighlightRequest> requests,
            String kind
    ) {
        for (int i = 0; i < requests.size(); i++) {
            HighlightRequest req = requests.get(i);
            String content = AdminMutationValidators.trimToNull(req.getContent());
            if (content == null) continue;
            ProductHighlightEntity highlight = new ProductHighlightEntity();
            highlight.setProduct(entity);
            highlight.setKind(kind);
            highlight.setSortOrder(req.getSortOrder() != null ? req.getSortOrder() : i);
            highlight.setContent(content);
            highlight.setContentEn(AdminMutationValidators.trimToNull(req.getContentEn()));
            target.add(highlight);
        }
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

    /**
     * The variant cover image is no longer entered separately by admins — it is
     * always the FIRST image of the variant's color gallery. This derives, per
     * color, that leading gallery image (the cover) so every same-color variant
     * shares it. Returns the first gallery entry with a non-blank URL per color.
     */
    public static Map<String, GalleryImageRequest> colorCoverImages(
            Map<String, List<GalleryImageRequest>> galleryByColor) {
        Map<String, GalleryImageRequest> coverByColor = new HashMap<>();
        for (Map.Entry<String, List<GalleryImageRequest>> entry : galleryByColor.entrySet()) {
            for (GalleryImageRequest img : entry.getValue()) {
                // Ảnh bìa = ảnh ĐẦU TIÊN (bỏ qua item video) có url — V248.
                if (!isVideoGalleryItem(img) && AdminMutationValidators.trimToNull(img.getUrl()) != null) {
                    coverByColor.put(entry.getKey(), img);
                    break;
                }
            }
        }
        return coverByColor;
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
