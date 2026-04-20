package com.bigbike.bigbike_backend.service.admin;

import com.bigbike.bigbike_backend.api.admin.dto.ImageAssetRequest;
import com.bigbike.bigbike_backend.api.admin.dto.SeoMetaRequest;
import com.bigbike.bigbike_backend.api.admin.dto.UpsertBrandRequest;
import com.bigbike.bigbike_backend.api.admin.dto.UpsertCategoryRequest;
import com.bigbike.bigbike_backend.api.admin.dto.UpsertProductRequest;
import com.bigbike.bigbike_backend.api.common.ApiErrorDetail;
import com.bigbike.bigbike_backend.api.error.MutationNotImplementedException;
import com.bigbike.bigbike_backend.api.error.NotFoundException;
import com.bigbike.bigbike_backend.domain.catalog.Brand;
import com.bigbike.bigbike_backend.domain.catalog.Category;
import com.bigbike.bigbike_backend.domain.catalog.Product;
import com.bigbike.bigbike_backend.domain.catalog.ProductStockState;
import com.bigbike.bigbike_backend.domain.catalog.PublishStatus;
import com.bigbike.bigbike_backend.persistence.entity.catalog.BrandEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.CategoryEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductEntity;
import com.bigbike.bigbike_backend.persistence.repository.catalog.BrandJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.CategoryJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ProductJpaRepository;
import com.bigbike.bigbike_backend.repository.catalog.CatalogReadRepository;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Optional;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AdminCatalogMutationService {

    private final ProductJpaRepository productJpaRepository;
    private final CategoryJpaRepository categoryJpaRepository;
    private final BrandJpaRepository brandJpaRepository;
    private final CatalogReadRepository catalogReadRepository;

    public AdminCatalogMutationService(
            ObjectProvider<ProductJpaRepository> productJpaRepositoryProvider,
            ObjectProvider<CategoryJpaRepository> categoryJpaRepositoryProvider,
            ObjectProvider<BrandJpaRepository> brandJpaRepositoryProvider,
            CatalogReadRepository catalogReadRepository
    ) {
        this.productJpaRepository = productJpaRepositoryProvider.getIfAvailable();
        this.categoryJpaRepository = categoryJpaRepositoryProvider.getIfAvailable();
        this.brandJpaRepository = brandJpaRepositoryProvider.getIfAvailable();
        this.catalogReadRepository = catalogReadRepository;
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

        return catalogReadRepository.findProductById(entity.getId())
                .orElseThrow(() -> new NotFoundException("Product not found."));
    }

    @Transactional
    public Product updateProduct(String productId, UpsertProductRequest request) {
        requireJpaPersistenceEnabled();

        ProductEntity entity = productJpaRepository.findById(productId)
                .orElseThrow(() -> new NotFoundException("Product not found."));

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

        return catalogReadRepository.findProductById(entity.getId())
                .orElseThrow(() -> new NotFoundException("Product not found."));
    }

    @Transactional
    public Category createCategory(UpsertCategoryRequest request) {
        requireJpaPersistenceEnabled();

        List<ApiErrorDetail> errors = new ArrayList<>();
        String slug = validateCategoryRequest(request, null, true, errors);
        String parentId = validateAndResolveParentCategory(request.getParentId(), null, true, errors);
        AdminMutationValidators.throwIfErrors(errors);

        Instant now = Instant.now();
        CategoryEntity entity = new CategoryEntity();
        entity.setId(generateId("cat"));
        entity.setCreatedAt(now);
        entity.setUpdatedAt(now);
        applyCategoryPatch(entity, request, slug, parentId, true);
        categoryJpaRepository.save(entity);

        return catalogReadRepository.findCategoryById(entity.getId())
                .orElseThrow(() -> new NotFoundException("Category not found."));
    }

    @Transactional
    public Category updateCategory(String categoryId, UpsertCategoryRequest request) {
        requireJpaPersistenceEnabled();

        CategoryEntity entity = categoryJpaRepository.findById(categoryId)
                .orElseThrow(() -> new NotFoundException("Category not found."));

        List<ApiErrorDetail> errors = new ArrayList<>();
        String slug = validateCategoryRequest(request, entity, false, errors);
        String parentId = validateAndResolveParentCategory(request.getParentId(), categoryId, false, errors);
        AdminMutationValidators.throwIfErrors(errors);

        entity.setUpdatedAt(Instant.now());
        applyCategoryPatch(entity, request, slug, parentId, false);
        categoryJpaRepository.save(entity);

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

        return catalogReadRepository.findBrandById(entity.getId())
                .orElseThrow(() -> new NotFoundException("Brand not found."));
    }

    @Transactional
    public Brand updateBrand(String brandId, UpsertBrandRequest request) {
        requireJpaPersistenceEnabled();

        BrandEntity entity = brandJpaRepository.findById(brandId)
                .orElseThrow(() -> new NotFoundException("Brand not found."));

        List<ApiErrorDetail> errors = new ArrayList<>();
        String slug = validateBrandRequest(request, entity, false, errors);
        AdminMutationValidators.throwIfErrors(errors);

        entity.setUpdatedAt(Instant.now());
        applyBrandPatch(entity, request, slug, false);
        brandJpaRepository.save(entity);

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

        AdminMutationValidators.validateNonNegativeInteger(request.getRetailPrice(), "retailPrice", "retailPrice", errors);
        AdminMutationValidators.validateNonNegativeInteger(request.getCompareAtPrice(), "compareAtPrice", "compareAtPrice", errors);
        AdminMutationValidators.validateNonNegativeInteger(request.getSalePrice(), "salePrice", "salePrice", errors);
        AdminMutationValidators.validateCurrency(request.getCurrency(), "currency", errors);
        AdminMutationValidators.validateImageAsset(request.getImage(), "image", errors);
        AdminMutationValidators.validateSeoMeta(request.getSeo(), "seo", errors);

        Integer mergedRetail = request.getRetailPrice() != null ? request.getRetailPrice() : (current == null ? null : current.getRetailPrice());
        Integer mergedCompareAt = request.getCompareAtPrice() != null ? request.getCompareAtPrice() : (current == null ? null : current.getCompareAtPrice());
        Integer mergedSale = request.getSalePrice() != null ? request.getSalePrice() : (current == null ? null : current.getSalePrice());
        AdminMutationValidators.validateSalePriceRule(mergedRetail, mergedCompareAt, mergedSale, "salePrice", errors);

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

        AdminMutationValidators.validateImageAsset(request.getImage(), "image", errors);
        AdminMutationValidators.validateImageAsset(request.getIcon(), "icon", errors);
        AdminMutationValidators.validateSeoMeta(request.getSeo(), "seo", errors);

        if (slug != null) {
            Optional<CategoryEntity> existingBySlug = categoryJpaRepository.findBySlug(slug);
            if (existingBySlug.isPresent()
                    && (current == null || !existingBySlug.get().getId().equals(current.getId()))) {
                errors.add(new ApiErrorDetail("slug", "DUPLICATE", "Slug is already in use."));
            }
        }

        return slug;
    }

    private String validateAndResolveParentCategory(
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
        if (categoryJpaRepository.findById(parentId).isEmpty()) {
            errors.add(new ApiErrorDetail("parentId", "NOT_FOUND", "Parent category does not exist."));
            return null;
        }
        return parentId;
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

        AdminMutationValidators.validateImageAsset(request.getLogo(), "logo", errors);
        AdminMutationValidators.validateSeoMeta(request.getSeo(), "seo", errors);

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
        if (create || request.getSku() != null) {
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
        if (create || request.getRetailPrice() != null) {
            entity.setRetailPrice(request.getRetailPrice() == null ? 0 : request.getRetailPrice());
        }
        if (create || request.getCompareAtPrice() != null) {
            entity.setCompareAtPrice(request.getCompareAtPrice());
        }
        if (create || request.getSalePrice() != null) {
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
        if (create || request.getPublishStatus() != null) {
            entity.setPublishStatus(request.getPublishStatus() == null ? PublishStatus.DRAFT : request.getPublishStatus());
        }
        if (create || request.getFeatured() != null) {
            entity.setFeatured(Boolean.TRUE.equals(request.getFeatured()));
        }
        if (create || request.getShowOnHomepage() != null) {
            entity.setShowOnHomepage(Boolean.TRUE.equals(request.getShowOnHomepage()));
        }

        if (request.getImage() != null) {
            applyImage(entity, request.getImage());
        } else if (create) {
            clearImage(entity);
        }

        if (request.getSeo() != null) {
            applySeo(entity, request.getSeo());
        } else if (create) {
            clearSeo(entity);
        }
    }

    private void applyCategoryPatch(
            CategoryEntity entity,
            UpsertCategoryRequest request,
            String normalizedSlug,
            String normalizedParentId,
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
            entity.setParentId(normalizedParentId);
        }
        if (create || request.getVisible() != null) {
            entity.setVisible(request.getVisible() == null || request.getVisible());
        }
        if (create || request.getSortOrder() != null) {
            entity.setSortOrder(request.getSortOrder());
        }

        if (request.getImage() != null) {
            applyImage(entity, request.getImage());
        } else if (create) {
            clearImage(entity);
        }

        if (request.getIcon() != null) {
            applyIcon(entity, request.getIcon());
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
        entity.setLogoId(null);
        entity.setLogoUrl(AdminMutationValidators.trimToNull(request.getUrl()));
        entity.setLogoAlt(AdminMutationValidators.trimToNull(request.getAlt()));
        entity.setLogoWidth(request.getWidth());
        entity.setLogoHeight(request.getHeight());
        entity.setLogoMimeType(AdminMutationValidators.trimToNull(request.getMimeType()));
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

        entity.setSeoOgImageId(null);
        entity.setSeoOgImageUrl(AdminMutationValidators.trimToNull(request.getOgImage().getUrl()));
        entity.setSeoOgImageAlt(AdminMutationValidators.trimToNull(request.getOgImage().getAlt()));
        entity.setSeoOgImageWidth(request.getOgImage().getWidth());
        entity.setSeoOgImageHeight(request.getOgImage().getHeight());
        entity.setSeoOgImageMimeType(AdminMutationValidators.trimToNull(request.getOgImage().getMimeType()));
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

    private static String generateId(String prefix) {
        return prefix + "_" + Instant.now().toEpochMilli() + "_" + Math.abs((int) (Math.random() * 100000));
    }
}
