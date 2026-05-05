package com.bigbike.bigbike_backend.service.admin;

import com.bigbike.bigbike_backend.api.admin.dto.GalleryImageRequest;
import com.bigbike.bigbike_backend.api.admin.dto.ImageAssetRequest;
import com.bigbike.bigbike_backend.api.admin.dto.SeoMetaRequest;
import com.bigbike.bigbike_backend.api.admin.dto.SpecificationRequest;
import com.bigbike.bigbike_backend.api.admin.dto.UpsertBrandRequest;
import com.bigbike.bigbike_backend.api.admin.dto.UpsertCategoryRequest;
import com.bigbike.bigbike_backend.api.admin.dto.UpsertProductRequest;
import com.bigbike.bigbike_backend.api.admin.dto.VariantOptionRequest;
import com.bigbike.bigbike_backend.api.admin.dto.VariantRequest;
import com.bigbike.bigbike_backend.api.admin.dto.VideoRequest;
import com.bigbike.bigbike_backend.api.common.ApiErrorDetail;
import com.bigbike.bigbike_backend.api.error.ConflictException;
import com.bigbike.bigbike_backend.api.error.MutationNotImplementedException;
import com.bigbike.bigbike_backend.api.error.NotFoundException;
import com.bigbike.bigbike_backend.config.MediaUrlProperties;
import com.bigbike.bigbike_backend.service.web.WebRevalidationService;
import com.bigbike.bigbike_backend.domain.catalog.Brand;
import com.bigbike.bigbike_backend.domain.catalog.Category;
import com.bigbike.bigbike_backend.domain.catalog.Product;
import com.bigbike.bigbike_backend.domain.catalog.ProductStockState;
import com.bigbike.bigbike_backend.domain.catalog.PublishStatus;
import com.bigbike.bigbike_backend.persistence.entity.catalog.AttributeEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.BrandEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.CategoryEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductGalleryImageEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductVariantGalleryImageEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductSpecificationEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductVariantEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductVariantOptionEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductVideoEntity;
import com.bigbike.bigbike_backend.persistence.repository.catalog.AttributeJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.AttributeValueJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.BrandJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.CategoryJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ProductJpaRepository;
import com.bigbike.bigbike_backend.repository.catalog.CatalogReadRepository;
import java.math.BigDecimal;
import java.text.Normalizer;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AdminCatalogMutationService {

    private static final Set<String> COLOR_ATTRIBUTE_KEYS = Set.of(
            "color", "colour", "mau", "mau sac", "pa color", "pa mau", "pa mau sac"
    );

    private final ProductJpaRepository productJpaRepository;
    private final CategoryJpaRepository categoryJpaRepository;
    private final BrandJpaRepository brandJpaRepository;
    private final AttributeJpaRepository attributeJpaRepository;
    private final AttributeValueJpaRepository attributeValueJpaRepository;
    private final CatalogReadRepository catalogReadRepository;
    private final MediaUrlProperties mediaUrlProperties;
    private final WebRevalidationService webRevalidationService;

    public AdminCatalogMutationService(
            ObjectProvider<ProductJpaRepository> productJpaRepositoryProvider,
            ObjectProvider<CategoryJpaRepository> categoryJpaRepositoryProvider,
            ObjectProvider<BrandJpaRepository> brandJpaRepositoryProvider,
            ObjectProvider<AttributeJpaRepository> attributeJpaRepositoryProvider,
            ObjectProvider<AttributeValueJpaRepository> attributeValueJpaRepositoryProvider,
            CatalogReadRepository catalogReadRepository,
            MediaUrlProperties mediaUrlProperties,
            WebRevalidationService webRevalidationService
    ) {
        this.productJpaRepository = productJpaRepositoryProvider.getIfAvailable();
        this.categoryJpaRepository = categoryJpaRepositoryProvider.getIfAvailable();
        this.brandJpaRepository = brandJpaRepositoryProvider.getIfAvailable();
        this.attributeJpaRepository = attributeJpaRepositoryProvider.getIfAvailable();
        this.attributeValueJpaRepository = attributeValueJpaRepositoryProvider.getIfAvailable();
        this.catalogReadRepository = catalogReadRepository;
        this.mediaUrlProperties = mediaUrlProperties;
        this.webRevalidationService = webRevalidationService;
    }

    @Transactional
    public Product createProduct(UpsertProductRequest request) {
        requireJpaPersistenceEnabled();

        List<ApiErrorDetail> errors = new ArrayList<>();
        CategoryEntity category = validateAndResolveCategory(request.getCategoryId(), true, errors);
        BrandEntity brand = validateAndResolveBrand(request.getBrandId(), errors);
        String slug = validateProductRequest(request, null, true, errors);
        AdminMutationValidators.throwIfErrors(errors);

        Instant now = Instant.now();
        ProductEntity entity = new ProductEntity();
        entity.setId(generateId("prod"));
        entity.setCreatedAt(now);
        entity.setUpdatedAt(now);

        applyProductPatch(entity, request, slug, category, brand, true);
        productJpaRepository.save(entity);
        revalidateProduct(entity, null);

        return catalogReadRepository.findProductById(entity.getId())
                .orElseThrow(() -> new NotFoundException("Product not found."));
    }

    @Transactional
    public Product updateProduct(String productId, UpsertProductRequest request) {
        requireJpaPersistenceEnabled();

        ProductEntity entity = productJpaRepository.findById(productId)
                .orElseThrow(() -> new NotFoundException("Product not found."));
        String previousSlug = entity.getSlug();

        List<ApiErrorDetail> errors = new ArrayList<>();
        CategoryEntity category = validateAndResolveCategory(request.getCategoryId(), false, errors);
        BrandEntity brand = validateAndResolveBrand(request.getBrandId(), errors);
        String slug = validateProductRequest(request, entity, false, errors);
        PublishStatus nextPublishStatus = request.getPublishStatus() == null ? entity.getPublishStatus() : request.getPublishStatus();
        AdminMutationValidators.validatePublishTransition(entity.getPublishStatus(), nextPublishStatus, "publishStatus", errors);
        AdminMutationValidators.throwIfErrors(errors);

        entity.setUpdatedAt(Instant.now());
        applyProductPatch(entity, request, slug, category, brand, false);
        productJpaRepository.save(entity);
        revalidateProduct(entity, previousSlug);

        return catalogReadRepository.findProductById(entity.getId())
                .orElseThrow(() -> new NotFoundException("Product not found."));
    }

    @Transactional
    public Product updateProductPublishStatus(String productId, PublishStatus publishStatus) {
        requireJpaPersistenceEnabled();

        ProductEntity entity = productJpaRepository.findById(productId)
                .orElseThrow(() -> new NotFoundException("Product not found."));

        List<ApiErrorDetail> errors = new ArrayList<>();
        if (publishStatus == null) {
            errors.add(new ApiErrorDetail("publishStatus", "REQUIRED", "publishStatus is required."));
        } else {
            AdminMutationValidators.validatePublishTransition(
                    entity.getPublishStatus(),
                    publishStatus,
                    "publishStatus",
                    errors
            );
        }
        AdminMutationValidators.throwIfErrors(errors);

        entity.setPublishStatus(publishStatus);
        entity.setUpdatedAt(Instant.now());
        productJpaRepository.save(entity);
        revalidateProduct(entity, null);

        return catalogReadRepository.findProductById(entity.getId())
                .orElseThrow(() -> new NotFoundException("Product not found."));
    }

    /**
     * Soft-delete a product by transitioning publishStatus → TRASH.
     * Goes through the validator so we don't bypass invariants (PUBLISHED→TRASH,
     * DRAFT→TRASH etc. are explicitly allowed in validatePublishTransition).
     * Idempotent: re-deleting a TRASH product is a no-op.
     */
    @Transactional
    public Product softDeleteProduct(String productId) {
        requireJpaPersistenceEnabled();

        ProductEntity entity = productJpaRepository.findById(productId)
                .orElseThrow(() -> new NotFoundException("Product not found."));

        if (entity.getPublishStatus() == PublishStatus.TRASH) {
            return catalogReadRepository.findProductById(entity.getId())
                    .orElseThrow(() -> new NotFoundException("Product not found."));
        }

        List<ApiErrorDetail> errors = new ArrayList<>();
        AdminMutationValidators.validatePublishTransition(
                entity.getPublishStatus(), PublishStatus.TRASH, "publishStatus", errors);
        AdminMutationValidators.throwIfErrors(errors);

        entity.setPublishStatus(PublishStatus.TRASH);
        entity.setUpdatedAt(Instant.now());
        productJpaRepository.save(entity);
        revalidateProduct(entity, null);

        return catalogReadRepository.findProductById(entity.getId())
                .orElseThrow(() -> new NotFoundException("Product not found."));
    }

    /**
     * Restore a product from TRASH back to DRAFT.
     * Restore is intentionally separate from publish mutation so trash cannot
     * jump back to PUBLISHED without an explicit publish action.
     */
    @Transactional
    public Product restoreProduct(String productId) {
        requireJpaPersistenceEnabled();

        ProductEntity entity = productJpaRepository.findById(productId)
                .orElseThrow(() -> new NotFoundException("Product not found."));

        List<ApiErrorDetail> errors = new ArrayList<>();
        if (entity.getPublishStatus() != PublishStatus.TRASH) {
            errors.add(new ApiErrorDetail(
                    "publishStatus",
                    "INVALID_STATE_TRANSITION",
                    "Only trashed products can be restored."
            ));
        }
        AdminMutationValidators.throwIfErrors(errors);

        entity.setPublishStatus(PublishStatus.DRAFT);
        entity.setUpdatedAt(Instant.now());
        productJpaRepository.save(entity);
        revalidateProduct(entity, null);

        return catalogReadRepository.findProductById(entity.getId())
                .orElseThrow(() -> new NotFoundException("Product not found."));
    }

    /**
     * Soft-delete a category. Categories have no publishStatus column; the
     * closest equivalent to TRASH is is_visible=false. Restoration is just a
     * normal PATCH that flips visible back to true.
     *
     * Rejects if the category has visible children — hiding a parent while
     * children remain visible creates orphaned categories on the storefront.
     * The caller must hide or re-parent children first.
     */
    @Transactional
    public Category softDeleteCategory(String categoryId) {
        requireJpaPersistenceEnabled();

        CategoryEntity entity = categoryJpaRepository.findById(categoryId)
                .orElseThrow(() -> new NotFoundException("Category not found."));

        long visibleChildCount = categoryJpaRepository.findAll().stream()
                .filter(c -> categoryId.equals(c.getParentId()) && c.isVisible())
                .count();
        if (visibleChildCount > 0) {
            throw new ConflictException(
                    "Cannot hide category: it has " + visibleChildCount +
                    " visible child categor" + (visibleChildCount == 1 ? "y" : "ies") +
                    ". Hide or re-parent them first."
            );
        }

        entity.setVisible(false);
        entity.setUpdatedAt(Instant.now());
        categoryJpaRepository.save(entity);
        revalidateCategory(entity, null);

        return catalogReadRepository.findCategoryById(entity.getId())
                .orElseThrow(() -> new NotFoundException("Category not found."));
    }

    @Transactional
    public Category createCategory(UpsertCategoryRequest request) {
        requireJpaPersistenceEnabled();

        List<ApiErrorDetail> errors = new ArrayList<>();
        String slug = validateCategoryRequest(request, null, true, errors);
        CategoryEntity parent = validateAndResolveParentCategory(request.getParentId(), null, true, errors);
        AdminMutationValidators.throwIfErrors(errors);

        Instant now = Instant.now();
        CategoryEntity entity = new CategoryEntity();
        entity.setId(generateId("cat"));
        entity.setCreatedAt(now);
        entity.setUpdatedAt(now);
        applyCategoryPatch(entity, request, slug, parent, true);
        categoryJpaRepository.save(entity);
        revalidateCategory(entity, null);

        return catalogReadRepository.findCategoryById(entity.getId())
                .orElseThrow(() -> new NotFoundException("Category not found."));
    }

    @Transactional
    public Category updateCategory(String categoryId, UpsertCategoryRequest request) {
        requireJpaPersistenceEnabled();

        CategoryEntity entity = categoryJpaRepository.findById(categoryId)
                .orElseThrow(() -> new NotFoundException("Category not found."));
        String previousSlug = entity.getSlug();

        List<ApiErrorDetail> errors = new ArrayList<>();
        String slug = validateCategoryRequest(request, entity, false, errors);
        CategoryEntity parent = validateAndResolveParentCategory(request.getParentId(), categoryId, false, errors);
        AdminMutationValidators.throwIfErrors(errors);

        entity.setUpdatedAt(Instant.now());
        applyCategoryPatch(entity, request, slug, parent, false);
        categoryJpaRepository.save(entity);
        revalidateCategory(entity, previousSlug);

        return catalogReadRepository.findCategoryById(entity.getId())
                .orElseThrow(() -> new NotFoundException("Category not found."));
    }

    @Transactional
    public Brand createBrand(UpsertBrandRequest request) {
        requireJpaPersistenceEnabled();

        List<ApiErrorDetail> errors = new ArrayList<>();
        String slug = validateBrandRequest(request, null, true, errors);
        AdminMutationValidators.throwIfErrors(errors);

        Instant now = Instant.now();
        BrandEntity entity = new BrandEntity();
        entity.setId(generateId("brand"));
        entity.setCreatedAt(now);
        entity.setUpdatedAt(now);
        applyBrandPatch(entity, request, slug, true);
        brandJpaRepository.save(entity);
        revalidateBrand(entity, null);

        return catalogReadRepository.findBrandById(entity.getId())
                .orElseThrow(() -> new NotFoundException("Brand not found."));
    }

    @Transactional
    public Brand updateBrand(String brandId, UpsertBrandRequest request) {
        requireJpaPersistenceEnabled();

        BrandEntity entity = brandJpaRepository.findById(brandId)
                .orElseThrow(() -> new NotFoundException("Brand not found."));
        String previousSlug = entity.getSlug();

        List<ApiErrorDetail> errors = new ArrayList<>();
        String slug = validateBrandRequest(request, entity, false, errors);
        AdminMutationValidators.throwIfErrors(errors);

        entity.setUpdatedAt(Instant.now());
        applyBrandPatch(entity, request, slug, false);
        brandJpaRepository.save(entity);
        revalidateBrand(entity, previousSlug);

        return catalogReadRepository.findBrandById(entity.getId())
                .orElseThrow(() -> new NotFoundException("Brand not found."));
    }

    @Transactional
    public Brand deleteBrand(String brandId) {
        requireJpaPersistenceEnabled();
        BrandEntity entity = brandJpaRepository.findById(brandId)
                .orElseThrow(() -> new NotFoundException("Brand not found."));
        entity.setVisible(false);
        entity.setUpdatedAt(Instant.now());
        brandJpaRepository.save(entity);
        revalidateBrand(entity, null);
        return catalogReadRepository.findBrandById(entity.getId())
                .orElseThrow(() -> new NotFoundException("Brand not found."));
    }

    private void requireJpaPersistenceEnabled() {
        if (productJpaRepository == null || categoryJpaRepository == null || brandJpaRepository == null) {
            throw new MutationNotImplementedException(
                    "Catalog mutation APIs require JPA persistence profile. Mock profile is read-only."
            );
        }
    }

    private String validateProductRequest(
            UpsertProductRequest request,
            ProductEntity current,
            boolean create,
            List<ApiErrorDetail> errors
    ) {
        String slug = AdminMutationValidators.trimToNull(request.getSlug());
        if (create) {
            AdminMutationValidators.validateRequiredSlug(slug, "slug", errors);
            AdminMutationValidators.validateRequiredText(request.getName(), "name", "Name", errors);
            if (request.getRetailPrice() == null) {
                errors.add(new ApiErrorDetail("retailPrice", "REQUIRED", "retailPrice is required."));
            }
            if (request.getStockState() == null) {
                errors.add(new ApiErrorDetail("stockState", "REQUIRED", "stockState is required."));
            }
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
        AdminMutationValidators.validateNonNegativeDecimal(request.getCompareAtPrice(), "compareAtPrice", "compareAtPrice", errors);
        AdminMutationValidators.validateNonNegativeDecimal(request.getSalePrice(), "salePrice", "salePrice", errors);
        AdminMutationValidators.validateRating(request.getRating(), "rating", errors);
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

        BigDecimal mergedRetail = request.isRetailPricePresent()
                ? request.getRetailPrice()
                : (current == null ? null : current.getRetailPrice());
        BigDecimal mergedCompareAt = request.isCompareAtPricePresent()
                ? request.getCompareAtPrice()
                : (current == null ? null : current.getCompareAtPrice());
        BigDecimal mergedSale = request.isSalePricePresent()
                ? request.getSalePrice()
                : (current == null ? null : current.getSalePrice());
        AdminMutationValidators.validateSalePriceRule(mergedRetail, mergedCompareAt, mergedSale, "salePrice", errors);

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
                AdminMutationValidators.validateNonNegativeDecimal(v.getCompareAtPrice(), "variants[" + i + "].compareAtPrice", "compareAtPrice", errors);
                AdminMutationValidators.validateNonNegativeDecimal(v.getSalePrice(), "variants[" + i + "].salePrice", "salePrice", errors);
                ProductVariantEntity currentVariant = currentVariantsById.get(AdminMutationValidators.trimToNull(v.getId()));
                BigDecimal mergedVariantRetail = v.isRetailPricePresent()
                        ? v.getRetailPrice()
                        : (currentVariant == null ? null : currentVariant.getRetailPrice());
                BigDecimal mergedVariantCompareAt = v.isCompareAtPricePresent()
                        ? v.getCompareAtPrice()
                        : (currentVariant == null ? null : currentVariant.getCompareAtPrice());
                BigDecimal mergedVariantSale = v.isSalePricePresent()
                        ? v.getSalePrice()
                        : (currentVariant == null ? null : currentVariant.getSalePrice());
                validateVariantSalePriceRule(
                        mergedVariantRetail,
                        mergedVariantCompareAt,
                        mergedVariantSale,
                        "variants[" + i + "].salePrice",
                        errors
                );
                if (hasGalleryRequests(v.getGallery()) && variantColorKey(v) == null) {
                    errors.add(new ApiErrorDetail(
                            "variants[" + i + "].gallery",
                            "COLOR_REQUIRED",
                            "Variant gallery is controlled by Color. Add a Color/Mau option or use product gallery."
                    ));
                }
            }
        }

        if (create) {
            if (AdminMutationValidators.trimToNull(request.getCategoryId()) == null) {
                errors.add(new ApiErrorDetail("categoryId", "REQUIRED", "categoryId is required."));
            }
        }

        if (slug != null) {
            Optional<ProductEntity> existingBySlug = productJpaRepository.findBySlug(slug);
            if (existingBySlug.isPresent()
                    && (current == null || !existingBySlug.get().getId().equals(current.getId()))) {
                errors.add(new ApiErrorDetail("slug", "DUPLICATE", "Slug is already in use."));
            }
        }

        return slug;
    }

    private static void validateVariantSalePriceRule(
            BigDecimal retailPrice,
            BigDecimal compareAtPrice,
            BigDecimal salePrice,
            String field,
            List<ApiErrorDetail> errors
    ) {
        if (salePrice == null || retailPrice == null) {
            return;
        }

        BigDecimal reference = compareAtPrice != null ? compareAtPrice : retailPrice;
        if (salePrice.compareTo(reference) >= 0) {
            errors.add(new ApiErrorDetail(field, "INVALID_VALUE", "salePrice must be lower than compareAtPrice or retailPrice."));
        }
    }

    private CategoryEntity validateAndResolveCategory(String categoryIdRaw, boolean create, List<ApiErrorDetail> errors) {
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

    private BrandEntity validateAndResolveBrand(String brandIdRaw, List<ApiErrorDetail> errors) {
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

    private String validateCategoryRequest(
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
        }

        return slug;
    }

    private CategoryEntity validateAndResolveParentCategory(
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
            List<CategoryEntity> allCategories = categoryJpaRepository.findAll();
            Map<String, String> parentIdMap = new HashMap<>();
            for (CategoryEntity c : allCategories) {
                if (c.getParentId() != null) {
                    parentIdMap.put(c.getId(), c.getParentId());
                }
            }
            String cursor = parentId;
            int safety = allCategories.size() + 1;
            while (cursor != null && safety-- > 0) {
                cursor = parentIdMap.get(cursor);
                if (currentCategoryId.equals(cursor)) {
                    errors.add(new ApiErrorDetail("parentId", "INVALID_VALUE", "Setting this parent would create a circular reference."));
                    return null;
                }
            }
        }
        return category;
    }

    private String validateBrandRequest(
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
        }

        return slug;
    }

    private void applyProductPatch(
            ProductEntity entity,
            UpsertProductRequest request,
            String normalizedSlug,
            CategoryEntity category,
            BrandEntity brand,
            boolean create
    ) {
        if (create || normalizedSlug != null) {
            entity.setSlug(normalizedSlug);
        }
        if (create || request.isSkuPresent()) {
            entity.setSku(AdminMutationValidators.trimToNull(request.getSku()));
        }
        if (create || request.getName() != null) {
            entity.setName(AdminMutationValidators.trimToNull(request.getName()));
        }
        if (create || request.getShortDescription() != null) {
            entity.setShortDescription(AdminMutationValidators.trimToNull(request.getShortDescription()));
        }
        if (create || request.getDescription() != null) {
            entity.setDescription(AdminMutationValidators.trimToNull(request.getDescription()));
        }
        if (create || request.getBrandId() != null) {
            entity.setBrand(brand);
        }
        if (create || request.getCategoryId() != null) {
            entity.setCategory(category);
            if (category != null) {
                entity.setCategories(new LinkedHashSet<>(List.of(category)));
            }
        }
        if (create || request.isRetailPricePresent()) {
            entity.setRetailPrice(request.getRetailPrice() == null ? BigDecimal.ZERO : request.getRetailPrice());
        }
        if (create || request.isCompareAtPricePresent()) {
            entity.setCompareAtPrice(request.getCompareAtPrice());
        }
        if (create || request.isSalePricePresent()) {
            entity.setSalePrice(request.getSalePrice());
        }
        if (create || request.getCurrency() != null) {
            entity.setCurrency(AdminMutationValidators.trimToNull(request.getCurrency()) == null ? "VND" : "VND");
        } else if (entity.getCurrency() == null) {
            entity.setCurrency("VND");
        }
        if (create || request.getStockState() != null) {
            entity.setStockState(request.getStockState() == null ? ProductStockState.IN_STOCK : request.getStockState());
        }
        if (create || request.getForceOutOfStock() != null) {
            entity.setForceOutOfStock(Boolean.TRUE.equals(request.getForceOutOfStock()));
        }
        if (create || request.getPublishStatus() != null) {
            entity.setPublishStatus(request.getPublishStatus() == null ? PublishStatus.DRAFT : request.getPublishStatus());
        }
        if (create || request.getFeatured() != null) {
            entity.setFeatured(Boolean.TRUE.equals(request.getFeatured()));
        }
        if (create || request.getShowOnHomepage() != null) {
            entity.setShowOnHomepage(Boolean.TRUE.equals(request.getShowOnHomepage()));
        }
        if (create || request.getRating() != null) {
            entity.setRating(request.getRating());
        }
        if (create || request.getRatingCount() != null) {
            entity.setRatingCount(request.getRatingCount());
        }
        if (create || request.getContentBottom() != null) {
            entity.setContentBottom(AdminMutationValidators.trimToNull(request.getContentBottom()));
        }

        if (create || request.isImagePresent()) {
            if (request.getImage() != null) {
                applyImage(entity, request.getImage());
            } else {
                clearImage(entity);
            }
        }

        if (create || request.isSeoPresent()) {
            if (request.getSeo() != null) {
                applySeo(entity, request.getSeo());
            } else {
                clearSeo(entity);
            }
        }

        if (request.getGallery() != null) {
            applyGallery(entity, request.getGallery());
        } else if (create) {
            entity.setGallery(new ArrayList<>());
        }

        if (request.getVideos() != null) {
            applyVideos(entity, request.getVideos());
        } else if (create) {
            entity.setVideos(new ArrayList<>());
        }

        if (request.getSpecifications() != null) {
            applySpecifications(entity, request.getSpecifications());
        } else if (create) {
            entity.setSpecifications(new ArrayList<>());
        }

        if (request.getVariants() != null) {
            applyVariants(entity, request.getVariants());
        } else if (create) {
            entity.setVariants(new ArrayList<>());
        }
    }

    private static void applyGallery(ProductEntity entity, List<GalleryImageRequest> requests) {
        List<ProductGalleryImageEntity> existing = entity.getGallery();
        if (existing == null) {
            existing = new ArrayList<>();
            entity.setGallery(existing);
        }
        existing.clear();
        for (int i = 0; i < requests.size(); i++) {
            GalleryImageRequest req = requests.get(i);
            String url = AdminMutationValidators.trimToNull(req.getUrl());
            if (url == null) continue;
            ProductGalleryImageEntity img = new ProductGalleryImageEntity();
            img.setProduct(entity);
            img.setSortOrder(req.getSortOrder() != null ? req.getSortOrder() : i);
            img.setImageUrl(url);
            img.setImageAlt(AdminMutationValidators.trimToNull(req.getAlt()));
            img.setImageWidth(req.getWidth());
            img.setImageHeight(req.getHeight());
            img.setImageMimeType(AdminMutationValidators.trimToNull(req.getMimeType()));
            existing.add(img);
        }
    }

    private static void applyVideos(ProductEntity entity, List<VideoRequest> requests) {
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
            video.setThumbnailUrl(AdminMutationValidators.trimToNull(req.getThumbnailUrl()));
            existing.add(video);
        }
    }

    private static void applySpecifications(ProductEntity entity, List<SpecificationRequest> requests) {
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
            existing.add(spec);
        }
    }

    private static boolean hasGalleryRequests(List<GalleryImageRequest> requests) {
        if (requests == null) return false;
        return requests.stream().anyMatch(req -> req != null && AdminMutationValidators.trimToNull(req.getUrl()) != null);
    }

    private static String variantColorKey(VariantRequest variant) {
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

    private static boolean isColorAttributeName(String name) {
        return COLOR_ATTRIBUTE_KEYS.contains(normalizeVariantToken(name));
    }

    private static String normalizeVariantToken(String raw) {
        String trimmed = AdminMutationValidators.trimToNull(raw);
        if (trimmed == null) return "";
        String normalized = Normalizer.normalize(trimmed, Normalizer.Form.NFD)
                .replaceAll("\\p{M}+", "")
                .replace('\u0110', 'D')
                .replace('\u0111', 'd')
                .toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9]+", " ")
                .trim();
        return normalized;
    }

    private static Map<String, List<GalleryImageRequest>> colorGalleryRequests(List<VariantRequest> requests) {
        Map<String, List<GalleryImageRequest>> galleryByColor = new HashMap<>();
        for (VariantRequest request : requests) {
            String colorKey = variantColorKey(request);
            if (colorKey != null && hasGalleryRequests(request.getGallery())) {
                galleryByColor.putIfAbsent(colorKey, request.getGallery());
            }
        }
        return galleryByColor;
    }

    private static Map<String, String> colorImageRequests(List<VariantRequest> requests) {
        Map<String, String> imageByColor = new HashMap<>();
        for (VariantRequest request : requests) {
            String colorKey = variantColorKey(request);
            String imageUrl = AdminMutationValidators.trimToNull(request.getImageUrl());
            if (colorKey != null && imageUrl != null) {
                imageByColor.putIfAbsent(colorKey, imageUrl);
            }
        }
        return imageByColor;
    }

    private void applyVariants(ProductEntity entity, List<VariantRequest> requests) {
        List<ProductVariantEntity> existing = entity.getVariants();
        if (existing == null) {
            existing = new ArrayList<>();
            entity.setVariants(existing);
        }

        // Build lookup map so existing variants can be updated in-place by ID,
        // preserving FK stability for any orders/carts referencing variant IDs.
        Map<String, ProductVariantEntity> existingById = new HashMap<>();
        for (ProductVariantEntity v : existing) {
            if (v.getId() != null) existingById.put(v.getId(), v);
        }

        Map<String, List<GalleryImageRequest>> galleryByColor = colorGalleryRequests(requests);
        Map<String, String> imageByColor = colorImageRequests(requests);
        List<ProductVariantEntity> nextVariants = new ArrayList<>();
        for (int i = 0; i < requests.size(); i++) {
            VariantRequest req = requests.get(i);
            String colorKey = variantColorKey(req);
            String name = AdminMutationValidators.trimToNull(req.getName());
            if (name == null) name = "Biến thể " + (i + 1);

            String reqId = AdminMutationValidators.trimToNull(req.getId());
            ProductVariantEntity variant = (reqId != null) ? existingById.get(reqId) : null;
            boolean createVariant = variant == null;
            if (createVariant) {
                variant = new ProductVariantEntity();
                variant.setId(generateId("var"));
            }

            variant.setProduct(entity);
            variant.setSortOrder(req.getSortOrder() != null ? req.getSortOrder() : i);
            variant.setSku(AdminMutationValidators.trimToNull(req.getSku()));
            variant.setName(name);
            if (createVariant || req.isRetailPricePresent()) {
                variant.setRetailPrice(req.getRetailPrice());
            }
            if (createVariant || req.isCompareAtPricePresent()) {
                variant.setCompareAtPrice(req.getCompareAtPrice());
            }
            if (createVariant || req.isSalePricePresent()) {
                variant.setSalePrice(req.getSalePrice());
            }
            variant.setCurrency("VND");
            variant.setStockState(req.getStockState() != null ? req.getStockState() : com.bigbike.bigbike_backend.domain.catalog.ProductStockState.IN_STOCK);
            variant.setImageUrl(colorKey != null ? imageByColor.getOrDefault(colorKey, null) : null);
            variant.setImageAlt(AdminMutationValidators.trimToNull(req.getImageAlt()));
            variant.setAvailable(req.getIsAvailable() == null || req.getIsAvailable());

            List<ProductVariantOptionEntity> options = new ArrayList<>();
            if (req.getOptions() != null) {
                for (int j = 0; j < req.getOptions().size(); j++) {
                    VariantOptionRequest optReq = req.getOptions().get(j);
                    String oName = AdminMutationValidators.trimToNull(optReq.getOptionName());
                    String oValue = AdminMutationValidators.trimToNull(optReq.getOptionValue());
                    if (oName == null || oValue == null) continue;
                    ProductVariantOptionEntity opt = new ProductVariantOptionEntity();
                    opt.setVariant(variant);
                    opt.setSortOrder(j);
                    opt.setOptionName(oName);
                    opt.setOptionValue(oValue);
                    // Link to the AttributeEntity / AttributeValueEntity rows
                    // when a matching taxonomy exists. Without these FKs the
                    // storefront cannot resolve per-term swatch metadata
                    // (color_hex / swatch_image_id) and falls back to the
                    // raw slug — which is why colour chips render as text
                    // even when the dictionary has hex values populated.
                    linkAttributeReferences(opt, oName, oValue);
                    options.add(opt);
                }
            }
            List<ProductVariantOptionEntity> existingOptions = variant.getOptions();
            if (existingOptions == null) {
                existingOptions = new ArrayList<>();
                variant.setOptions(existingOptions);
            } else {
                existingOptions.clear();
            }
            existingOptions.addAll(options);
            applyVariantGallery(
                    variant,
                    colorKey == null ? List.of() : galleryByColor.getOrDefault(colorKey, List.of())
            );
            nextVariants.add(variant);
        }

        existing.clear();
        existing.addAll(nextVariants);
    }

    /**
     * Resolve and attach the {@link AttributeEntity} / {@link AttributeValueEntity}
     * references for a freshly-built variant option, keyed off
     * (option_name, option_value). Both lookups are best-effort: if no
     * matching taxonomy or value exists, the FK stays null and the storefront
     * falls back to the raw slug for that chip. Repositories are nullable
     * during tests that don't load the JPA stack — guard accordingly.
     */
    private void linkAttributeReferences(ProductVariantOptionEntity opt, String optionName, String optionValue) {
        if (attributeJpaRepository == null) return;
        AttributeEntity attribute = attributeJpaRepository.findByCode(optionName).orElse(null);
        if (attribute == null) return;
        opt.setAttribute(attribute);
        if (attributeValueJpaRepository == null) return;
        attributeValueJpaRepository
                .findByAttributeIdAndSlug(attribute.getId(), optionValue)
                .ifPresent(opt::setAttributeValue);
    }

    private static void applyVariantGallery(ProductVariantEntity variant, List<GalleryImageRequest> requests) {
        List<ProductVariantGalleryImageEntity> existing = variant.getGallery();
        if (existing == null) {
            existing = new ArrayList<>();
            variant.setGallery(existing);
        }
        existing.clear();
        if (requests == null) return;
        for (int i = 0; i < requests.size(); i++) {
            GalleryImageRequest req = requests.get(i);
            String url = AdminMutationValidators.trimToNull(req.getUrl());
            if (url == null) continue;
            ProductVariantGalleryImageEntity img = new ProductVariantGalleryImageEntity();
            img.setVariant(variant);
            img.setSortOrder(req.getSortOrder() != null ? req.getSortOrder() : i);
            img.setImageUrl(url);
            img.setImageAlt(AdminMutationValidators.trimToNull(req.getAlt()));
            img.setImageWidth(req.getWidth());
            img.setImageHeight(req.getHeight());
            img.setImageMimeType(AdminMutationValidators.trimToNull(req.getMimeType()));
            existing.add(img);
        }
    }

    private void applyCategoryPatch(
            CategoryEntity entity,
            UpsertCategoryRequest request,
            String normalizedSlug,
            CategoryEntity normalizedParent,
            boolean create
    ) {
        if (create || normalizedSlug != null) {
            entity.setSlug(normalizedSlug);
        }
        if (create || request.getName() != null) {
            entity.setName(AdminMutationValidators.trimToNull(request.getName()));
        }
        if (create || request.getDescription() != null) {
            entity.setDescription(AdminMutationValidators.trimToNull(request.getDescription()));
        }
        if (create || request.getParentId() != null) {
            entity.setParent(normalizedParent);
        }
        if (create || request.getVisible() != null) {
            entity.setVisible(request.getVisible() == null || request.getVisible());
        }
        if (create || request.getShowOnHomepage() != null) {
            entity.setShowOnHomepage(Boolean.TRUE.equals(request.getShowOnHomepage()));
        }
        if (create || request.getSortOrder() != null) {
            entity.setSortOrder(request.getSortOrder());
        }

        if (request.getImage() != null) {
            if (AdminMutationValidators.trimToNull(request.getImage().getUrl()) != null) {
                applyImage(entity, request.getImage());
            } else {
                clearImage(entity);
            }
        } else if (create) {
            clearImage(entity);
        }

        if (request.getIcon() != null) {
            if (AdminMutationValidators.trimToNull(request.getIcon().getUrl()) != null) {
                applyIcon(entity, request.getIcon());
            } else {
                clearIcon(entity);
            }
        } else if (create) {
            clearIcon(entity);
        }

        if (request.getSeo() != null) {
            applySeo(entity, request.getSeo());
        } else if (create) {
            clearSeo(entity);
        }
    }

    private void applyBrandPatch(
            BrandEntity entity,
            UpsertBrandRequest request,
            String normalizedSlug,
            boolean create
    ) {
        if (create || normalizedSlug != null) {
            entity.setSlug(normalizedSlug);
        }
        if (create || request.getName() != null) {
            entity.setName(AdminMutationValidators.trimToNull(request.getName()));
        }
        if (create || request.getDescription() != null) {
            entity.setDescription(AdminMutationValidators.trimToNull(request.getDescription()));
        }
        if (create || request.getVisible() != null) {
            entity.setVisible(request.getVisible() == null || request.getVisible());
        }

        if (request.getLogo() != null) {
            applyLogo(entity, request.getLogo());
        } else if (create) {
            clearLogo(entity);
        }

        if (request.getSeo() != null) {
            applySeo(entity, request.getSeo());
        } else if (create) {
            clearSeo(entity);
        }
    }

    private static void applyImage(ProductEntity entity, ImageAssetRequest request) {
        entity.setImageId(null);
        entity.setImageUrl(AdminMutationValidators.trimToNull(request.getUrl()));
        entity.setImageAlt(AdminMutationValidators.trimToNull(request.getAlt()));
        entity.setImageWidth(request.getWidth());
        entity.setImageHeight(request.getHeight());
        entity.setImageMimeType(AdminMutationValidators.trimToNull(request.getMimeType()));
    }

    private static void clearImage(ProductEntity entity) {
        entity.setImageId(null);
        entity.setImageUrl(null);
        entity.setImageAlt(null);
        entity.setImageWidth(null);
        entity.setImageHeight(null);
        entity.setImageMimeType(null);
    }

    private static void applyImage(CategoryEntity entity, ImageAssetRequest request) {
        entity.setImageId(null);
        entity.setImageUrl(AdminMutationValidators.trimToNull(request.getUrl()));
        entity.setImageAlt(AdminMutationValidators.trimToNull(request.getAlt()));
        entity.setImageWidth(request.getWidth());
        entity.setImageHeight(request.getHeight());
        entity.setImageMimeType(AdminMutationValidators.trimToNull(request.getMimeType()));
    }

    private static void clearImage(CategoryEntity entity) {
        entity.setImageId(null);
        entity.setImageUrl(null);
        entity.setImageAlt(null);
        entity.setImageWidth(null);
        entity.setImageHeight(null);
        entity.setImageMimeType(null);
    }

    private static void applyIcon(CategoryEntity entity, ImageAssetRequest request) {
        entity.setIconId(null);
        entity.setIconUrl(AdminMutationValidators.trimToNull(request.getUrl()));
        entity.setIconAlt(AdminMutationValidators.trimToNull(request.getAlt()));
        entity.setIconWidth(request.getWidth());
        entity.setIconHeight(request.getHeight());
        entity.setIconMimeType(AdminMutationValidators.trimToNull(request.getMimeType()));
    }

    private static void clearIcon(CategoryEntity entity) {
        entity.setIconId(null);
        entity.setIconUrl(null);
        entity.setIconAlt(null);
        entity.setIconWidth(null);
        entity.setIconHeight(null);
        entity.setIconMimeType(null);
    }

    private static void applyLogo(BrandEntity entity, ImageAssetRequest request) {
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

    private static void clearLogo(BrandEntity entity) {
        entity.setLogoId(null);
        entity.setLogoUrl(null);
        entity.setLogoAlt(null);
        entity.setLogoWidth(null);
        entity.setLogoHeight(null);
        entity.setLogoMimeType(null);
    }

    private static void applySeo(ProductEntity entity, SeoMetaRequest request) {
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

    private static void clearSeo(ProductEntity entity) {
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

    private static void applySeo(CategoryEntity entity, SeoMetaRequest request) {
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

    private static void clearSeo(CategoryEntity entity) {
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

    private static void applySeo(BrandEntity entity, SeoMetaRequest request) {
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

    private static void clearSeo(BrandEntity entity) {
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

    private void revalidateProduct(ProductEntity entity, String previousSlug) {
        revalidateEntityTags("products", "product:", previousSlug, entity.getSlug());
    }

    private void revalidateCategory(CategoryEntity entity, String previousSlug) {
        revalidateEntityTags("categories", "category:", previousSlug, entity.getSlug(), "products", "menu:primary");
    }

    private void revalidateBrand(BrandEntity entity, String previousSlug) {
        revalidateEntityTags("brands", "brand:", previousSlug, entity.getSlug(), "products");
    }

    private void revalidateEntityTags(
            String listTag,
            String itemTagPrefix,
            String previousSlug,
            String currentSlug,
            String... relatedTags
    ) {
        LinkedHashSet<String> tags = new LinkedHashSet<>();
        addTag(tags, listTag);
        addSlugTag(tags, itemTagPrefix, previousSlug);
        addSlugTag(tags, itemTagPrefix, currentSlug);
        for (String relatedTag : relatedTags) {
            addTag(tags, relatedTag);
        }
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
        return prefix + "_" + UUID.randomUUID().toString().replace("-", "");
    }
}
