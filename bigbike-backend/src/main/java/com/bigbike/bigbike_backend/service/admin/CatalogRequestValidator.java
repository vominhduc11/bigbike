package com.bigbike.bigbike_backend.service.admin;

import com.bigbike.bigbike_backend.api.admin.dto.BrandTranslationRequest;
import com.bigbike.bigbike_backend.api.admin.dto.CategoryTranslationRequest;
import com.bigbike.bigbike_backend.api.admin.dto.ProductTranslationRequest;
import com.bigbike.bigbike_backend.api.admin.dto.UpsertBrandRequest;
import com.bigbike.bigbike_backend.api.admin.dto.UpsertCategoryRequest;
import com.bigbike.bigbike_backend.api.admin.dto.UpsertProductRequest;
import com.bigbike.bigbike_backend.api.admin.dto.VariantRequest;
import com.bigbike.bigbike_backend.api.admin.dto.GalleryImageRequest;
import com.bigbike.bigbike_backend.api.common.ApiErrorDetail;
import com.bigbike.bigbike_backend.config.MediaUrlProperties;
import com.bigbike.bigbike_backend.persistence.entity.catalog.BrandEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.CategoryEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductGalleryImageEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductVariantEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductVariantGalleryImageEntity;
import com.bigbike.bigbike_backend.persistence.repository.catalog.BrandJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.CategoryJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ProductJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ProductVariantJpaRepository;
import java.math.BigDecimal;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Component;

@Component
public class CatalogRequestValidator {

    private final ProductJpaRepository productJpaRepository;
    private final ProductVariantJpaRepository productVariantJpaRepository;
    private final CategoryJpaRepository categoryJpaRepository;
    private final BrandJpaRepository brandJpaRepository;
    private final MediaUrlProperties mediaUrlProperties;

    public CatalogRequestValidator(
            ObjectProvider<ProductJpaRepository> productJpaRepositoryProvider,
            ObjectProvider<ProductVariantJpaRepository> productVariantJpaRepositoryProvider,
            ObjectProvider<CategoryJpaRepository> categoryJpaRepositoryProvider,
            ObjectProvider<BrandJpaRepository> brandJpaRepositoryProvider,
            MediaUrlProperties mediaUrlProperties
    ) {
        this.productJpaRepository = productJpaRepositoryProvider.getIfAvailable();
        this.productVariantJpaRepository = productVariantJpaRepositoryProvider.getIfAvailable();
        this.categoryJpaRepository = categoryJpaRepositoryProvider.getIfAvailable();
        this.brandJpaRepository = brandJpaRepositoryProvider.getIfAvailable();
        this.mediaUrlProperties = mediaUrlProperties;
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
            if (request.getRetailPrice() == null) {
                errors.add(new ApiErrorDetail("retailPrice", "REQUIRED", "retailPrice is required."));
            }
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
                errors
        );

        if (!preview) {
            Set<String> existingGalleryUrls = new HashSet<>();
            if (current != null) {
                if (current.getGallery() != null) {
                    for (ProductGalleryImageEntity img : current.getGallery()) {
                        if (!"video".equalsIgnoreCase(img.getMediaType())) {
                            String u = AdminMutationValidators.trimToNull(img.getImageUrl());
                            if (u != null) {
                                existingGalleryUrls.add(u);
                            }
                        }
                    }
                }
                if (current.getVariants() != null) {
                    for (ProductVariantEntity variant : current.getVariants()) {
                        if (variant.getGallery() != null) {
                            for (ProductVariantGalleryImageEntity img : variant.getGallery()) {
                                if (!"video".equalsIgnoreCase(img.getMediaType())) {
                                    String u = AdminMutationValidators.trimToNull(img.getImageUrl());
                                    if (u != null) {
                                        existingGalleryUrls.add(u);
                                    }
                                }
                            }
                        }
                    }
                }
            }

            if (request.getGallery() != null) {
                for (int i = 0; i < request.getGallery().size(); i++) {
                    GalleryImageRequest imgReq = request.getGallery().get(i);
                    if (imgReq != null && !"video".equalsIgnoreCase(imgReq.getMediaType())) {
                        String url = AdminMutationValidators.trimToNull(imgReq.getUrl());
                        if (url != null && !existingGalleryUrls.contains(url)) {
                            AdminMutationValidators.validateWhitelistedMediaUrl(
                                    url,
                                    "gallery[" + i + "].url",
                                    mediaUrlProperties.getPublicBaseUrl(),
                                    errors
                            );
                        }
                    }
                }
            }
            if (request.getVariants() != null) {
                for (int i = 0; i < request.getVariants().size(); i++) {
                    VariantRequest v = request.getVariants().get(i);
                    if (v != null && v.getGallery() != null) {
                        for (int j = 0; j < v.getGallery().size(); j++) {
                            GalleryImageRequest imgReq = v.getGallery().get(j);
                            if (imgReq != null && !"video".equalsIgnoreCase(imgReq.getMediaType())) {
                                String url = AdminMutationValidators.trimToNull(imgReq.getUrl());
                                if (url != null && !existingGalleryUrls.contains(url)) {
                                    AdminMutationValidators.validateWhitelistedMediaUrl(
                                            url,
                                            "variants[" + i + "].gallery[" + j + "].url",
                                            mediaUrlProperties.getPublicBaseUrl(),
                                            errors
                                    );
                                }
                            }
                        }
                    }
                }
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

        if (create) {
            if (AdminMutationValidators.trimToNull(request.getCategoryId()) == null) {
                errors.add(new ApiErrorDetail("categoryId", "REQUIRED", "categoryId is required."));
            }
        }

        // Slug uniqueness is a persistence concern — skip it for the live-preview
        // dry-run. Otherwise previewing an EXISTING product (current is always null
        // here) would flag its own saved slug as a duplicate and always 400.
        if (!preview && slug != null) {
            Optional<ProductEntity> existingBySlug = productJpaRepository.findBySlug(slug);
            if (existingBySlug.isPresent()
                    && (current == null || !existingBySlug.get().getId().equals(current.getId()))) {
                errors.add(new ApiErrorDetail("slug", "DUPLICATE", "Slug is already in use."));
            }
            // A new vi slug must not collide with any product's English slug either.
            Optional<ProductEntity> existingBySlugEn = productJpaRepository.findBySlugEn(slug);
            if (existingBySlugEn.isPresent()
                    && (current == null || !existingBySlugEn.get().getId().equals(current.getId()))) {
                errors.add(new ApiErrorDetail("slug", "DUPLICATE", "Slug is already in use (English slug)."));
            }
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
            // `name` là field cốt lõi bắt buộc ở VI → `translations.en.name` cũng bắt buộc, áp
            // dụng cho cả tạo mới lẫn sửa bản ghi cũ (không chỉ khi request đổi tên).
            ProductTranslationRequest.ProductContentRequest en =
                    request.getTranslations() == null ? null : request.getTranslations().getEn();
            AdminMutationValidators.validateRequiredText(
                    en == null ? null : en.getName(), "translations.en.name", "English name", errors);
        }

        return slug;
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
                errors
        );

        if (slug != null) {
            Optional<CategoryEntity> existingBySlug = categoryJpaRepository.findBySlug(slug);
            if (existingBySlug.isPresent()
                    && (current == null || !existingBySlug.get().getId().equals(current.getId()))) {
                errors.add(new ApiErrorDetail("slug", "DUPLICATE", "Slug is already in use."));
            }
            // A new vi slug must not collide with any category's English slug either.
            Optional<CategoryEntity> existingBySlugEn = categoryJpaRepository.findBySlugEn(slug);
            if (existingBySlugEn.isPresent()
                    && (current == null || !existingBySlugEn.get().getId().equals(current.getId()))) {
                errors.add(new ApiErrorDetail("slug", "DUPLICATE", "Slug is already in use (English slug)."));
            }
        }

        validateEnglishSlug(
                extractEnSlug(request.getTranslations() == null ? null : request.getTranslations().getEn()),
                slug,
                current == null ? null : current.getId(),
                s -> categoryJpaRepository.findBySlug(s).map(CategoryEntity::getId),
                s -> categoryJpaRepository.findBySlugEn(s).map(CategoryEntity::getId),
                errors
        );

        // Tiếng Anh chỉ bắt buộc khi tiếng Việt tương ứng đang bắt buộc (TRANSLATION_RULE_002).
        // `name` là field cốt lõi bắt buộc ở VI → `translations.en.name` cũng bắt buộc, áp
        // dụng cho cả tạo mới lẫn sửa bản ghi cũ (không chỉ khi request đổi tên).
        CategoryTranslationRequest.CategoryContentRequest categoryEn =
                request.getTranslations() == null ? null : request.getTranslations().getEn();
        AdminMutationValidators.validateRequiredText(
                categoryEn == null ? null : categoryEn.getName(), "translations.en.name", "English name", errors);

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
                errors
        );

        if (slug != null) {
            Optional<BrandEntity> existingBySlug = brandJpaRepository.findBySlug(slug);
            if (existingBySlug.isPresent()
                    && (current == null || !existingBySlug.get().getId().equals(current.getId()))) {
                errors.add(new ApiErrorDetail("slug", "DUPLICATE", "Slug is already in use."));
            }
            // A new vi slug must not collide with any brand's English slug either.
            Optional<BrandEntity> existingBySlugEn = brandJpaRepository.findBySlugEn(slug);
            if (existingBySlugEn.isPresent()
                    && (current == null || !existingBySlugEn.get().getId().equals(current.getId()))) {
                errors.add(new ApiErrorDetail("slug", "DUPLICATE", "Slug is already in use (English slug)."));
            }
        }

        validateEnglishSlug(
                extractEnSlug(request.getTranslations() == null ? null : request.getTranslations().getEn()),
                slug,
                current == null ? null : current.getId(),
                s -> brandJpaRepository.findBySlug(s).map(BrandEntity::getId),
                s -> brandJpaRepository.findBySlugEn(s).map(BrandEntity::getId),
                errors
        );

        // Tiếng Anh chỉ bắt buộc khi tiếng Việt tương ứng đang bắt buộc (TRANSLATION_RULE_002).
        // `name` là field cốt lõi bắt buộc ở VI → `translations.en.name` cũng bắt buộc, áp
        // dụng cho cả tạo mới lẫn sửa bản ghi cũ (không chỉ khi request đổi tên).
        BrandTranslationRequest.BrandContentRequest brandEn =
                request.getTranslations() == null ? null : request.getTranslations().getEn();
        AdminMutationValidators.validateRequiredText(
                brandEn == null ? null : brandEn.getName(), "translations.en.name", "English name", errors);

        return slug;
    }
}
