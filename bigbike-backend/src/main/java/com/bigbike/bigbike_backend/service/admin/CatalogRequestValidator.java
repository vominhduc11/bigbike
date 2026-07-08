package com.bigbike.bigbike_backend.service.admin;

import com.bigbike.bigbike_backend.api.admin.dto.BrandTranslationRequest;
import com.bigbike.bigbike_backend.api.admin.dto.CategoryTranslationRequest;
import com.bigbike.bigbike_backend.api.admin.dto.ProductTranslationRequest;
import com.bigbike.bigbike_backend.api.admin.dto.UpsertBrandRequest;
import com.bigbike.bigbike_backend.api.admin.dto.UpsertCategoryRequest;
import com.bigbike.bigbike_backend.api.admin.dto.UpsertProductRequest;
import com.bigbike.bigbike_backend.api.admin.dto.VariantRequest;
import com.bigbike.bigbike_backend.api.admin.dto.VideoRequest;
import com.bigbike.bigbike_backend.api.admin.dto.GalleryImageRequest;
import com.bigbike.bigbike_backend.api.common.ApiErrorDetail;
import com.bigbike.bigbike_backend.config.MediaUrlProperties;
import com.bigbike.bigbike_backend.domain.catalog.DescriptionBlock;
import com.bigbike.bigbike_backend.domain.catalog.GalleryMedia;
import com.bigbike.bigbike_backend.domain.catalog.VideoAsset;
import com.bigbike.bigbike_backend.persistence.entity.catalog.BrandEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.CategoryEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductVariantEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductVariantGalleryImageEntity;
import com.bigbike.bigbike_backend.persistence.repository.catalog.BrandJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.CategoryJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ProductJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ProductVariantJpaRepository;
import com.bigbike.bigbike_backend.service.security.HomeVideoUrlPolicy;
import java.math.BigDecimal;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

@Component
public class CatalogRequestValidator {

    private final ProductJpaRepository productJpaRepository;
    private final ProductVariantJpaRepository productVariantJpaRepository;
    private final CategoryJpaRepository categoryJpaRepository;
    private final BrandJpaRepository brandJpaRepository;
    private final MediaUrlProperties mediaUrlProperties;
    private final HomeVideoUrlPolicy homeVideoUrlPolicy;
    private final boolean isDev;

    public CatalogRequestValidator(
            ObjectProvider<ProductJpaRepository> productJpaRepositoryProvider,
            ObjectProvider<ProductVariantJpaRepository> productVariantJpaRepositoryProvider,
            ObjectProvider<CategoryJpaRepository> categoryJpaRepositoryProvider,
            ObjectProvider<BrandJpaRepository> brandJpaRepositoryProvider,
            MediaUrlProperties mediaUrlProperties,
            HomeVideoUrlPolicy homeVideoUrlPolicy,
            Environment environment
    ) {
        this.productJpaRepository = productJpaRepositoryProvider.getIfAvailable();
        this.productVariantJpaRepository = productVariantJpaRepositoryProvider.getIfAvailable();
        this.categoryJpaRepository = categoryJpaRepositoryProvider.getIfAvailable();
        this.brandJpaRepository = brandJpaRepositoryProvider.getIfAvailable();
        this.mediaUrlProperties = mediaUrlProperties;
        this.homeVideoUrlPolicy = homeVideoUrlPolicy;
        this.isDev = environment != null && java.util.Arrays.stream(environment.getActiveProfiles())
                .anyMatch(p -> java.util.Set.of("dev", "mock", "test", "local").contains(p.toLowerCase()));
    }

    public String validateProductRequest(
            UpsertProductRequest request,
            ProductEntity current,
            boolean create,
            boolean preview,
            List<ApiErrorDetail> errors
    ) {
        String slug = AdminMutationValidators.trimToNull(request.getSlug());
        if (create) {
            AdminMutationValidators.validateRequiredSlug(slug, "slug", errors);
            AdminMutationValidators.validateRequiredText(request.getName(), "name", "Name", errors);
            // retailPrice/sku/categoryId/brandId/gender requiredness (conditional on
            // hasVariants and draft-vs-publish, PRODUCT_RULE_005) is enforced post-merge by
            // AdminMutationValidators.validateProductFieldsRequired, not here — this request-level
            // check only runs on create/update wholesale and can't see the merged entity/variants.
            // stockState is a derived field — not required from client. Always computed from quantityOnHand.
            if (request.getPublishStatus() == null) {
                errors.add(new ApiErrorDetail("publishStatus", "REQUIRED", "publishStatus is required."));
            }
        } else {
            AdminMutationValidators.validateOptionalSlug(slug, "slug", errors);
            if (request.getName() != null) {
                AdminMutationValidators.validateRequiredText(request.getName(), "name", "Name", errors);
            }
        }

        AdminMutationValidators.validateNonNegativeDecimal(request.getRetailPrice(), "retailPrice", "retailPrice", errors);
        AdminMutationValidators.validateNonNegativeDecimal(request.getSalePrice(), "salePrice", "salePrice", errors);
        AdminMutationValidators.validateCurrency(request.getCurrency(), "currency", errors);
        AdminMutationValidators.validateImageAsset(
                request.getImage(),
                "image",
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

        if (!preview) {
            // Grandfather set: image-shaped URLs (plain gallery images AND video-item thumbnails
            // share the same imageUrl column) already saved on the entity are not re-validated on
            // unrelated edits — only newly-submitted URLs must pass the MinIO whitelist.
            Set<String> existingGalleryUrls = new HashSet<>();
            // Same idea for video source URLs (product-level videos[] + video gallery items) —
            // only NEW video URLs go through the YouTube/TikTok/Facebook/MinIO whitelist.
            Set<String> existingVideoUrls = new HashSet<>();
            if (current != null) {
                if (current.getGallery() != null) {
                    for (GalleryMedia item : current.getGallery()) {
                        String u = item.image() != null ? AdminMutationValidators.trimToNull(item.image().url()) : null;
                        if (u != null) {
                            existingGalleryUrls.add(u);
                        }
                        String vu = AdminMutationValidators.trimToNull(item.videoUrl());
                        if (vu != null) {
                            existingVideoUrls.add(vu);
                        }
                    }
                }
                if (current.getVariants() != null) {
                    for (ProductVariantEntity variant : current.getVariants()) {
                        if (variant.getGallery() != null) {
                            for (ProductVariantGalleryImageEntity img : variant.getGallery()) {
                                String u = AdminMutationValidators.trimToNull(img.getImageUrl());
                                if (u != null) {
                                    existingGalleryUrls.add(u);
                                }
                                String vu = AdminMutationValidators.trimToNull(img.getVideoUrl());
                                if (vu != null) {
                                    existingVideoUrls.add(vu);
                                }
                            }
                        }
                    }
                }
                if (current.getVideos() != null) {
                    for (VideoAsset video : current.getVideos()) {
                        String vu = AdminMutationValidators.trimToNull(video.url());
                        if (vu != null) {
                            existingVideoUrls.add(vu);
                        }
                        String tu = video.thumbnail() != null ? AdminMutationValidators.trimToNull(video.thumbnail().url()) : null;
                        if (tu != null) {
                            existingGalleryUrls.add(tu);
                        }
                    }
                }
            }

            if (request.getGallery() != null) {
                for (int i = 0; i < request.getGallery().size(); i++) {
                    GalleryImageRequest imgReq = request.getGallery().get(i);
                    validateGalleryMediaUrls(imgReq, "gallery[" + i + "]", existingGalleryUrls, existingVideoUrls, errors);
                }
            }
            if (request.getVariants() != null) {
                for (int i = 0; i < request.getVariants().size(); i++) {
                    VariantRequest v = request.getVariants().get(i);
                    if (v != null && v.getGallery() != null) {
                        for (int j = 0; j < v.getGallery().size(); j++) {
                            GalleryImageRequest imgReq = v.getGallery().get(j);
                            validateGalleryMediaUrls(
                                    imgReq, "variants[" + i + "].gallery[" + j + "]", existingGalleryUrls, existingVideoUrls, errors);
                        }
                    }
                }
            }
            if (request.getVideos() != null) {
                for (int i = 0; i < request.getVideos().size(); i++) {
                    VideoRequest videoReq = request.getVideos().get(i);
                    if (videoReq == null) {
                        continue;
                    }
                    String videoUrl = AdminMutationValidators.trimToNull(videoReq.getUrl());
                    if (videoUrl != null && !existingVideoUrls.contains(videoUrl) && !homeVideoUrlPolicy.isAllowed(videoUrl)) {
                        errors.add(new ApiErrorDetail(
                                "videos[" + i + "].url",
                                "INVALID_VALUE",
                                "Video URL must be a supported YouTube/TikTok/Facebook URL or an approved internal media URL."
                        ));
                    }
                    String thumbnailUrl = AdminMutationValidators.trimToNull(videoReq.getThumbnailUrl());
                    if (thumbnailUrl != null && !existingGalleryUrls.contains(thumbnailUrl)) {
                        AdminMutationValidators.validateWhitelistedMediaUrl(
                                thumbnailUrl,
                                "videos[" + i + "].thumbnailUrl",
                                mediaUrlProperties.getPublicBaseUrl(),
                                errors
                        );
                    }
                }
            }

            // Media URLs already stored on the product (body blocks) are grandfathered so
            // editing legacy content that hotlinks old images is never blocked (MEDIA_RULE_003,
            // mirrors the gallery/video legacy tolerance above). Only NEW external urls are rejected.
            Set<String> existingBlockMediaUrls = new HashSet<>();
            if (current != null) {
                existingBlockMediaUrls.addAll(AdminMutationValidators.collectBlockMediaUrls(current.getDescriptionBlocks()));
                existingBlockMediaUrls.addAll(AdminMutationValidators.suitabilitySectionMediaUrls(current.getSuitabilitySection()));
                existingBlockMediaUrls.addAll(AdminMutationValidators.sizeGuideSectionMediaUrls(current.getSizeGuideSection()));
            }
            validateDescriptionBlockMediaUrls(request.getDescriptionBlocks(), "descriptionBlocks", existingBlockMediaUrls, errors);

            // suitabilitySection/sizeGuideSection (V327/V328, tách khỏi descriptionBlocks) — cùng cơ
            // chế MEDIA_RULE_003: chỉ ảnh MỚI trỏ host ngoài mới bị chặn.
            String mediaBase = mediaUrlProperties.getPublicBaseUrl();
            if (request.getSuitabilitySection() != null) {
                AdminMutationValidators.validateHtmlInlineImages(
                        request.getSuitabilitySection().getHtml(), "suitabilitySection.html",
                        existingBlockMediaUrls, mediaBase, errors);
                AdminMutationValidators.validateHtmlInlineImages(
                        request.getSuitabilitySection().getHtmlEn(), "suitabilitySection.htmlEn",
                        existingBlockMediaUrls, mediaBase, errors);
            }
            if (request.getSizeGuideSection() != null) {
                AdminMutationValidators.validateHtmlInlineImages(
                        request.getSizeGuideSection().getHtml(), "sizeGuideSection.html",
                        existingBlockMediaUrls, mediaBase, errors);
                AdminMutationValidators.validateHtmlInlineImages(
                        request.getSizeGuideSection().getHtmlEn(), "sizeGuideSection.htmlEn",
                        existingBlockMediaUrls, mediaBase, errors);
            }
        }

        BigDecimal mergedRetail = request.isRetailPricePresent()
                ? request.getRetailPrice()
                : (current == null ? null : current.getRetailPrice());
        BigDecimal mergedSale = request.isSalePricePresent()
                ? request.getSalePrice()
                : (current == null ? null : current.getSalePrice());
        AdminMutationValidators.validateSalePriceRule(mergedRetail, mergedSale, "salePrice", errors);

        Map<String, ProductVariantEntity> currentVariantsById = new HashMap<>();
        if (current != null && current.getVariants() != null) {
            for (ProductVariantEntity existingVariant : current.getVariants()) {
                if (existingVariant.getId() != null) {
                    currentVariantsById.put(existingVariant.getId(), existingVariant);
                }
            }
        }

        if (request.getVariants() != null) {
            for (int i = 0; i < request.getVariants().size(); i++) {
                VariantRequest v = request.getVariants().get(i);
                AdminMutationValidators.validateNonNegativeDecimal(v.getRetailPrice(), "variants[" + i + "].retailPrice", "retailPrice", errors);
                AdminMutationValidators.validateNonNegativeDecimal(v.getSalePrice(), "variants[" + i + "].salePrice", "salePrice", errors);
                ProductVariantEntity currentVariant = currentVariantsById.get(AdminMutationValidators.trimToNull(v.getId()));
                BigDecimal mergedVariantRetail = v.isRetailPricePresent()
                        ? v.getRetailPrice()
                        : (currentVariant == null ? null : currentVariant.getRetailPrice());
                BigDecimal mergedVariantSale = v.isSalePricePresent()
                        ? v.getSalePrice()
                        : (currentVariant == null ? null : currentVariant.getSalePrice());
                // Owner decision 2026-07-07 (PRODUCT_RULE_013): a variant without its own retailPrice
                // falls back to the product's shared retailPrice/salePrice (VariantPricing) — only an
                // error when the product ALSO has no valid shared retailPrice to fall back to.
                boolean hasSharedRetail = mergedRetail != null && mergedRetail.compareTo(BigDecimal.ZERO) > 0;
                if (mergedVariantRetail == null && !hasSharedRetail) {
                    errors.add(new ApiErrorDetail(
                            "variants[" + i + "].retailPrice", "REQUIRED", "retailPrice is required for a variant."));
                }
                // A variant with no retailPrice of its own is not "self-priced" (VariantPricing.
                // hasOwnPrice), so a salePrice submitted alone would be silently ignored — reject
                // instead of accepting data that never takes effect.
                if (mergedVariantRetail == null && mergedVariantSale != null) {
                    errors.add(new ApiErrorDetail(
                            "variants[" + i + "].salePrice", "INVALID_VALUE",
                            "salePrice cannot be set on a variant that has no retailPrice of its own."));
                }
                AdminMutationValidators.validateSalePriceRule(
                        mergedVariantRetail,
                        mergedVariantSale,
                        "variants[" + i + "].salePrice",
                        errors
                );
                if (ProductFieldApplier.hasGalleryRequests(v.getGallery()) && ProductFieldApplier.variantColorKey(v) == null) {
                    errors.add(new ApiErrorDetail(
                            "variants[" + i + "].gallery",
                            "COLOR_REQUIRED",
                            "Variant gallery is controlled by Color. Add a Color/Mau option or use product gallery."
                    ));
                }
            }
            // PRODUCT_RULE_SKU_001 — variant SKUs must be unique (within the request
            // and across all other products). The DB unique index is the hard guarantee;
            // this pre-check returns a friendly per-row error first.
            validateVariantSkuUniqueness(request, current, preview, errors);
        }

        // categoryId requiredness is enforced post-merge by
        // AdminMutationValidators.validateProductFieldsRequired (PRODUCT_RULE_005), not here.

        // Slug uniqueness is a persistence concern — skip it for the live-preview
        // dry-run. Otherwise previewing an EXISTING product (current is always null
        // here) would flag its own saved slug as a duplicate and always 400.
        if (!preview) {
            validateVietnameseSlugAgainstEnglish(
                    slug,
                    current == null ? null : current.getId(),
                    s -> productJpaRepository.findBySlug(s).map(ProductEntity::getId),
                    s -> productJpaRepository.findBySlugEn(s).map(ProductEntity::getId),
                    errors
            );
        }

        if (!preview) {
            validateEnglishSlug(
                    extractEnSlug(request.getTranslations() == null ? null : request.getTranslations().getEn()),
                    slug,
                    current == null ? null : current.getId(),
                    s -> productJpaRepository.findBySlug(s).map(ProductEntity::getId),
                    s -> productJpaRepository.findBySlugEn(s).map(ProductEntity::getId),
                    errors
            );
            // Tiếng Anh chỉ bắt buộc khi tiếng Việt tương ứng đang bắt buộc (TRANSLATION_RULE_002).
            // `name` là field cốt lõi bắt buộc ở VI → `translations.en.name` cũng bắt buộc, nhưng chỉ khi
            // request thực sự đặt tên (tạo mới, hoặc sửa có gửi `name`) — khớp Category/Brand ở dưới, để
            // file nhập/PATCH tối giản (vd chỉ sửa giá/FAQ, không đổi name) không bị chặn.
            if (create || request.getName() != null) {
                ProductTranslationRequest.ProductContentRequest en =
                        request.getTranslations() == null ? null : request.getTranslations().getEn();
                AdminMutationValidators.validateRequiredText(
                        en == null ? null : en.getName(), "translations.en.name", "English name", errors);
            }
        }

        return slug;
    }

    /** Validates a single gallery item's URL(s) against the media whitelist (M6/M7 — video items were
     * previously skipped entirely). {@code fieldPrefix} is the JSON path up to (not including) `.url`. */
    private void validateGalleryMediaUrls(
            GalleryImageRequest imgReq,
            String fieldPrefix,
            Set<String> existingGalleryUrls,
            Set<String> existingVideoUrls,
            List<ApiErrorDetail> errors
    ) {
        if (imgReq == null) {
            return;
        }
        if (ProductFieldApplier.isVideoGalleryItem(imgReq)) {
            String videoUrl = AdminMutationValidators.trimToNull(imgReq.getVideoUrl());
            if (videoUrl != null && !existingVideoUrls.contains(videoUrl) && !homeVideoUrlPolicy.isAllowed(videoUrl)) {
                errors.add(new ApiErrorDetail(
                        fieldPrefix + ".videoUrl",
                        "INVALID_VALUE",
                        "Video URL must be a supported YouTube/TikTok/Facebook URL or an approved internal media URL."
                ));
            }
            String thumbnailUrl = AdminMutationValidators.trimToNull(imgReq.getUrl());
            if (thumbnailUrl != null && !existingGalleryUrls.contains(thumbnailUrl)) {
                AdminMutationValidators.validateWhitelistedMediaUrl(
                        thumbnailUrl, fieldPrefix + ".url", mediaUrlProperties.getPublicBaseUrl(), errors);
            }
        } else {
            String url = AdminMutationValidators.trimToNull(imgReq.getUrl());
            if (url != null && !existingGalleryUrls.contains(url)) {
                AdminMutationValidators.validateWhitelistedMediaUrl(
                        url, fieldPrefix + ".url", mediaUrlProperties.getPublicBaseUrl(), errors);
            }
        }
    }

    /** Mirrors ContentRequestValidator's ImageBlock/FeatureBlock whitelist loop for product
     * description blocks (M8 — previously unvalidated for products, unlike articles). */
    private void validateDescriptionBlockMediaUrls(
            List<DescriptionBlock> blocks, String fieldPrefix, Set<String> existing, List<ApiErrorDetail> errors
    ) {
        if (blocks == null) {
            return;
        }
        String base = mediaUrlProperties.getPublicBaseUrl();
        for (int i = 0; i < blocks.size(); i++) {
            DescriptionBlock block = blocks.get(i);
            if (block instanceof DescriptionBlock.ImageBlock imageBlock) {
                String u = AdminMutationValidators.trimToNull(imageBlock.getUrl());
                if (u != null && (existing == null || !existing.contains(u))) {
                    AdminMutationValidators.validateWhitelistedMediaUrl(u, fieldPrefix + "[" + i + "].url", base, errors);
                }
            } else if (block instanceof DescriptionBlock.FeatureBlock featureBlock) {
                String u = AdminMutationValidators.trimToNull(featureBlock.getUrl());
                if (u != null && (existing == null || !existing.contains(u))) {
                    AdminMutationValidators.validateWhitelistedMediaUrl(u, fieldPrefix + "[" + i + "].url", base, errors);
                }
            }
            AdminMutationValidators.validateHtmlInlineImages(
                    AdminMutationValidators.blockRawHtml(block), fieldPrefix + "[" + i + "].html",
                    existing, base, errors);
            AdminMutationValidators.validateHtmlInlineImages(
                    AdminMutationValidators.blockRawHtmlEn(block), fieldPrefix + "[" + i + "].htmlEn",
                    existing, base, errors);
        }
    }

    private static String extractEnSlug(Object enContent) {
        if (enContent instanceof ProductTranslationRequest.ProductContentRequest p) {
            return AdminMutationValidators.trimToNull(p.getSlug());
        }
        if (enContent instanceof CategoryTranslationRequest.CategoryContentRequest c) {
            return AdminMutationValidators.trimToNull(c.getSlug());
        }
        if (enContent instanceof BrandTranslationRequest.BrandContentRequest b) {
            return AdminMutationValidators.trimToNull(b.getSlug());
        }
        return null;
    }

    /**
     * Cross-column uniqueness for the optional English slug (PRODUCT/CATEGORY/BRAND_RULE_003):
     * the en slug must differ from this entity's own vi slug, and must not collide with any
     * other entity's vi slug or en slug of the same kind. Errors target {@code translations.en.slug}.
     */
    private static void validateEnglishSlug(
            String slugEn,
            String viSlug,
            String currentId,
            java.util.function.Function<String, Optional<String>> findIdByViSlug,
            java.util.function.Function<String, Optional<String>> findIdByEnSlug,
            List<ApiErrorDetail> errors
    ) {
        if (slugEn == null) {
            return;
        }
        Optional<String> byViSlug = findIdByViSlug.apply(slugEn);
        if (byViSlug.isPresent() && (currentId == null || !byViSlug.get().equals(currentId))) {
            errors.add(new ApiErrorDetail("translations.en.slug", "DUPLICATE",
                    "English slug is already in use."));
            return;
        }
        Optional<String> byEnSlug = findIdByEnSlug.apply(slugEn);
        if (byEnSlug.isPresent() && (currentId == null || !byEnSlug.get().equals(currentId))) {
            errors.add(new ApiErrorDetail("translations.en.slug", "DUPLICATE",
                    "English slug is already in use."));
        }
    }

    public static void validateVietnameseSlugAgainstEnglish(
            String slug,
            String currentId,
            java.util.function.Function<String, Optional<String>> findIdByViSlug,
            java.util.function.Function<String, Optional<String>> findIdByEnSlug,
            List<ApiErrorDetail> errors
    ) {
        if (slug == null) {
            return;
        }
        Optional<String> existingBySlug = findIdByViSlug.apply(slug);
        if (existingBySlug.isPresent()
                && (currentId == null || !existingBySlug.get().equals(currentId))) {
            errors.add(new ApiErrorDetail("slug", "DUPLICATE", "Slug is already in use."));
        }
        Optional<String> existingBySlugEn = findIdByEnSlug.apply(slug);
        if (existingBySlugEn.isPresent()
                && (currentId == null || !existingBySlugEn.get().equals(currentId))) {
            errors.add(new ApiErrorDetail("slug", "DUPLICATE", "Slug is already in use (English slug)."));
        }
    }

    /**
     * PRODUCT_RULE_SKU_001 — variant SKUs must be globally unique (case-insensitive).
     * Flags duplicates within the request and against other products. Cross-product
     * lookups are a persistence concern, so they are skipped during live preview.
     */
    private void validateVariantSkuUniqueness(
            UpsertProductRequest request,
            ProductEntity current,
            boolean preview,
            List<ApiErrorDetail> errors
    ) {
        List<VariantRequest> variants = request.getVariants();
        if (variants == null || variants.isEmpty()) {
            return;
        }
        // First occurrence of each SKU wins; later ones are in-request duplicates.
        Map<String, Integer> firstIndexBySku = new HashMap<>();
        for (int i = 0; i < variants.size(); i++) {
            String sku = AdminMutationValidators.trimToNull(variants.get(i).getSku());
            if (sku == null) {
                continue; // missing SKU is handled by @NotBlank on the request DTO
            }
            String key = sku.toLowerCase(Locale.ROOT);
            if (firstIndexBySku.putIfAbsent(key, i) != null) {
                errors.add(new ApiErrorDetail(
                        "variants[" + i + "].sku", "DUPLICATE",
                        "Variant SKU is duplicated within this product."));
            }
        }
        if (preview || firstIndexBySku.isEmpty() || productVariantJpaRepository == null) {
            return;
        }
        Set<String> taken = new HashSet<>(productVariantJpaRepository.findTakenSkusLower(
                firstIndexBySku.keySet(),
                current == null ? null : current.getId()));
        for (Map.Entry<String, Integer> e : firstIndexBySku.entrySet()) {
            if (taken.contains(e.getKey())) {
                errors.add(new ApiErrorDetail(
                        "variants[" + e.getValue() + "].sku", "DUPLICATE",
                        "Variant SKU is already used by another product."));
            }
        }
    }

    public CategoryEntity validateAndResolveCategory(String categoryIdRaw, boolean create, List<ApiErrorDetail> errors) {
        String categoryId = AdminMutationValidators.trimToNull(categoryIdRaw);
        if (!create && categoryId == null) {
            return null;
        }
        if (create && categoryId == null) {
            return null;
        }
        CategoryEntity category = categoryJpaRepository.findById(categoryId).orElse(null);
        if (category == null) {
            errors.add(new ApiErrorDetail("categoryId", "NOT_FOUND", "Category does not exist."));
            return null;
        }
        return category;
    }

    public BrandEntity validateAndResolveBrand(String brandIdRaw, List<ApiErrorDetail> errors) {
        String brandId = AdminMutationValidators.trimToNull(brandIdRaw);
        if (brandId == null) {
            return null;
        }
        BrandEntity brand = brandJpaRepository.findById(brandId).orElse(null);
        if (brand == null) {
            errors.add(new ApiErrorDetail("brandId", "NOT_FOUND", "Brand does not exist."));
            return null;
        }
        return brand;
    }

    public String validateCategoryRequest(
            UpsertCategoryRequest request,
            CategoryEntity current,
            boolean create,
            List<ApiErrorDetail> errors
    ) {
        String slug = AdminMutationValidators.trimToNull(request.getSlug());
        if (create) {
            AdminMutationValidators.validateRequiredSlug(slug, "slug", errors);
            AdminMutationValidators.validateRequiredText(request.getName(), "name", "Name", errors);
        } else {
            AdminMutationValidators.validateOptionalSlug(slug, "slug", errors);
            if (request.getName() != null) {
                AdminMutationValidators.validateRequiredText(request.getName(), "name", "Name", errors);
            }
        }

        AdminMutationValidators.validateImageAsset(
                request.getImage(),
                "image",
                mediaUrlProperties.getPublicBaseUrl(),
                errors
        );
        AdminMutationValidators.validateImageAsset(
                request.getIcon(),
                "icon",
                mediaUrlProperties.getPublicBaseUrl(),
                errors
        );
        AdminMutationValidators.validateImageAsset(
                request.getMenuIcon(),
                "menuIcon",
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

        validateVietnameseSlugAgainstEnglish(
                slug,
                current == null ? null : current.getId(),
                s -> categoryJpaRepository.findBySlug(s).map(CategoryEntity::getId),
                s -> categoryJpaRepository.findBySlugEn(s).map(CategoryEntity::getId),
                errors
        );

        validateEnglishSlug(
                extractEnSlug(request.getTranslations() == null ? null : request.getTranslations().getEn()),
                slug,
                current == null ? null : current.getId(),
                s -> categoryJpaRepository.findBySlug(s).map(CategoryEntity::getId),
                s -> categoryJpaRepository.findBySlugEn(s).map(CategoryEntity::getId),
                errors
        );

        // Tiếng Anh chỉ bắt buộc khi tiếng Việt tương ứng đang bắt buộc (TRANSLATION_RULE_002).
        // `name` là field cốt lõi bắt buộc ở VI → `translations.en.name` cũng bắt buộc, nhưng chỉ khi
        // request thực sự đặt tên (tạo mới, hoặc sửa có gửi `name`) — khớp điều kiện validate tên VI
        // ở trên, để PATCH tối giản (vd chỉ {visible}/{sortOrder}) không bị chặn.
        if (create || request.getName() != null) {
            CategoryTranslationRequest.CategoryContentRequest categoryEn =
                    request.getTranslations() == null ? null : request.getTranslations().getEn();
            AdminMutationValidators.validateRequiredText(
                    categoryEn == null ? null : categoryEn.getName(), "translations.en.name", "English name", errors);
        }

        return slug;
    }

    public CategoryEntity validateAndResolveParentCategory(
            String parentIdRaw,
            String currentCategoryId,
            boolean create,
            List<ApiErrorDetail> errors
    ) {
        String parentId = AdminMutationValidators.trimToNull(parentIdRaw);
        if (!create && parentId == null) {
            return null;
        }
        if (parentId == null) {
            return null;
        }
        if (currentCategoryId != null && currentCategoryId.equals(parentId)) {
            errors.add(new ApiErrorDetail("parentId", "INVALID_VALUE", "Category cannot be its own parent."));
            return null;
        }
        CategoryEntity category = categoryJpaRepository.findById(parentId).orElse(null);
        if (category == null) {
            errors.add(new ApiErrorDetail("parentId", "NOT_FOUND", "Parent category does not exist."));
            return null;
        }
        if (currentCategoryId != null) {
            // Walk the proposed parent's ancestors via PK lookups instead of
            // loading the full table. Each hop is an O(1) indexed read; a
            // realistic catalog tree only goes a handful of levels deep.
            CategoryEntity cursor = category;
            int safety = 32;
            while (cursor != null && safety-- > 0) {
                if (currentCategoryId.equals(cursor.getId())) {
                    errors.add(new ApiErrorDetail("parentId", "INVALID_VALUE", "Setting this parent would create a circular reference."));
                    return null;
                }
                String nextId = cursor.getParentId();
                if (nextId == null) break;
                cursor = categoryJpaRepository.findById(nextId).orElse(null);
            }
        }
        return category;
    }

    public String validateBrandRequest(
            UpsertBrandRequest request,
            BrandEntity current,
            boolean create,
            List<ApiErrorDetail> errors
    ) {
        String slug = AdminMutationValidators.trimToNull(request.getSlug());
        if (create) {
            AdminMutationValidators.validateRequiredSlug(slug, "slug", errors);
            AdminMutationValidators.validateRequiredText(request.getName(), "name", "Name", errors);
        } else {
            AdminMutationValidators.validateOptionalSlug(slug, "slug", errors);
            if (request.getName() != null) {
                AdminMutationValidators.validateRequiredText(request.getName(), "name", "Name", errors);
            }
        }

        AdminMutationValidators.validateImageAsset(
                request.getLogo(),
                "logo",
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

        validateVietnameseSlugAgainstEnglish(
                slug,
                current == null ? null : current.getId(),
                s -> brandJpaRepository.findBySlug(s).map(BrandEntity::getId),
                s -> brandJpaRepository.findBySlugEn(s).map(BrandEntity::getId),
                errors
        );

        validateEnglishSlug(
                extractEnSlug(request.getTranslations() == null ? null : request.getTranslations().getEn()),
                slug,
                current == null ? null : current.getId(),
                s -> brandJpaRepository.findBySlug(s).map(BrandEntity::getId),
                s -> brandJpaRepository.findBySlugEn(s).map(BrandEntity::getId),
                errors
        );

        // Tiếng Anh chỉ bắt buộc khi tiếng Việt tương ứng đang bắt buộc (TRANSLATION_RULE_002).
        // `name` là field cốt lõi bắt buộc ở VI → `translations.en.name` cũng bắt buộc, nhưng chỉ khi
        // request thực sự đặt tên (tạo mới, hoặc sửa có gửi `name`) — khớp điều kiện validate tên VI
        // ở trên, để PATCH tối giản (vd chỉ {visible}/{sortOrder}) không bị chặn.
        if (create || request.getName() != null) {
            BrandTranslationRequest.BrandContentRequest brandEn =
                    request.getTranslations() == null ? null : request.getTranslations().getEn();
            AdminMutationValidators.validateRequiredText(
                    brandEn == null ? null : brandEn.getName(), "translations.en.name", "English name", errors);
        }

        return slug;
    }
}
