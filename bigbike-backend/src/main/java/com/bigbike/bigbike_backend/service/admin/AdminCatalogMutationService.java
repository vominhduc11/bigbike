package com.bigbike.bigbike_backend.service.admin;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.bigbike.bigbike_backend.api.admin.dto.GalleryImageRequest;
import com.bigbike.bigbike_backend.api.admin.dto.ImageAssetRequest;
import com.bigbike.bigbike_backend.api.admin.dto.CategoryTranslationRequest;
import com.bigbike.bigbike_backend.api.admin.dto.BrandTranslationRequest;
import com.bigbike.bigbike_backend.api.admin.dto.ProductTranslationRequest;
import com.bigbike.bigbike_backend.api.admin.dto.SeoMetaRequest;
import com.bigbike.bigbike_backend.api.admin.dto.ProductTabRequest;
import com.bigbike.bigbike_backend.api.admin.dto.SpecificationRequest;
import com.bigbike.bigbike_backend.api.admin.dto.SpecStatRequest;
import com.bigbike.bigbike_backend.domain.catalog.ProductTab;
import com.bigbike.bigbike_backend.api.admin.dto.CommitmentRequest;
import com.bigbike.bigbike_backend.api.admin.dto.TrustBadgeRequest;
import com.bigbike.bigbike_backend.api.admin.dto.FaqRequest;
import com.bigbike.bigbike_backend.api.admin.dto.HighlightRequest;
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
import com.bigbike.bigbike_backend.persistence.entity.catalog.AttributeValueEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.BrandEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.CategoryEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductGalleryImageEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductVariantGalleryImageEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductSpecificationEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductSpecStatEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductCommitmentEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductTrustBadgeEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductFaqEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductHighlightEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductVariantEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductVariantOptionEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductVideoEntity;
import com.bigbike.bigbike_backend.persistence.entity.redirect.RedirectEntity;
import com.bigbike.bigbike_backend.persistence.repository.catalog.AttributeJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.AttributeValueJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.BrandJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.CategoryJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ProductJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ProductVariantJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.redirect.RedirectJpaRepository;
import com.bigbike.bigbike_backend.repository.catalog.CatalogReadRepository;
import com.bigbike.bigbike_backend.repository.catalog.JpaCatalogReadRepository;
import com.bigbike.bigbike_backend.api.admin.dto.SetHomepageBlocksRequest;
import com.bigbike.bigbike_backend.domain.catalog.HomepageBlock;
import java.math.BigDecimal;
import java.text.Normalizer;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Deque;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import com.bigbike.bigbike_backend.persistence.entity.audit.AuditLogEntity;
import com.bigbike.bigbike_backend.service.audit.AuditLogWriter;
import com.bigbike.bigbike_backend.service.catalog.DescriptionBlockRenderer;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AdminCatalogMutationService {

    private static final Set<String> COLOR_ATTRIBUTE_KEYS = Set.of(
            "color", "colour", "mau", "mau sac", "pa color", "pa mau", "pa mau sac"
    );

    private static final ObjectMapper AUDIT_MAPPER = new ObjectMapper();

    private final ProductJpaRepository productJpaRepository;
    private final ProductVariantJpaRepository productVariantJpaRepository;
    private final CategoryJpaRepository categoryJpaRepository;
    private final BrandJpaRepository brandJpaRepository;
    private final AttributeJpaRepository attributeJpaRepository;
    private final AttributeValueJpaRepository attributeValueJpaRepository;
    private final CatalogReadRepository catalogReadRepository;
    private final JpaCatalogReadRepository jpaCatalogReadRepository;
    private final MediaUrlProperties mediaUrlProperties;
    private final WebRevalidationService webRevalidationService;
    private final AuditLogWriter auditLogWriter;
    private final DescriptionBlockRenderer descriptionBlockRenderer;
    private final RedirectJpaRepository redirectRepo;

    public AdminCatalogMutationService(
            ObjectProvider<ProductJpaRepository> productJpaRepositoryProvider,
            ObjectProvider<ProductVariantJpaRepository> productVariantJpaRepositoryProvider,
            ObjectProvider<CategoryJpaRepository> categoryJpaRepositoryProvider,
            ObjectProvider<BrandJpaRepository> brandJpaRepositoryProvider,
            ObjectProvider<AttributeJpaRepository> attributeJpaRepositoryProvider,
            ObjectProvider<AttributeValueJpaRepository> attributeValueJpaRepositoryProvider,
            CatalogReadRepository catalogReadRepository,
            ObjectProvider<JpaCatalogReadRepository> jpaCatalogReadRepositoryProvider,
            MediaUrlProperties mediaUrlProperties,
            WebRevalidationService webRevalidationService,
            AuditLogWriter auditLogWriter,
            DescriptionBlockRenderer descriptionBlockRenderer,
            ObjectProvider<RedirectJpaRepository> redirectRepoProvider
    ) {
        this.productJpaRepository = productJpaRepositoryProvider.getIfAvailable();
        this.productVariantJpaRepository = productVariantJpaRepositoryProvider.getIfAvailable();
        this.categoryJpaRepository = categoryJpaRepositoryProvider.getIfAvailable();
        this.brandJpaRepository = brandJpaRepositoryProvider.getIfAvailable();
        this.attributeJpaRepository = attributeJpaRepositoryProvider.getIfAvailable();
        this.attributeValueJpaRepository = attributeValueJpaRepositoryProvider.getIfAvailable();
        this.catalogReadRepository = catalogReadRepository;
        this.jpaCatalogReadRepository = jpaCatalogReadRepositoryProvider.getIfAvailable();
        this.mediaUrlProperties = mediaUrlProperties;
        this.webRevalidationService = webRevalidationService;
        this.auditLogWriter = auditLogWriter;
        this.descriptionBlockRenderer = descriptionBlockRenderer;
        this.redirectRepo = redirectRepoProvider.getIfAvailable();
    }

    @Transactional
    public Product createProduct(UpsertProductRequest request, UUID adminId) {
        requireJpaPersistenceEnabled();

        List<ApiErrorDetail> errors = new ArrayList<>();
        CategoryEntity category = validateAndResolveCategory(request.getCategoryId(), true, errors);
        BrandEntity brand = validateAndResolveBrand(request.getBrandId(), errors);
        String slug = validateProductRequest(request, null, true, false, errors);
        AdminMutationValidators.throwIfErrors(errors);

        Instant now = Instant.now();
        ProductEntity entity = new ProductEntity();
        entity.setId(generateId("prod"));
        entity.setCreatedAt(now);
        entity.setUpdatedAt(now);

        applyProductPatch(entity, request, slug, category, brand, true);
        productJpaRepository.save(entity);
        auditLog("PRODUCT_CREATED", "PRODUCT", adminId, null, productJson(entity));
        revalidateProduct(entity, null);

        return catalogReadRepository.findProductById(entity.getId())
                .orElseThrow(() -> new NotFoundException("Product not found."));
    }

    /**
     * Dry-run render for the admin live preview. Validates the upsert payload and
     * builds a transient {@link ProductEntity} exactly as {@link #createProduct}
     * does, then maps it straight to the public {@link Product} shape WITHOUT
     * persisting. No row is created or updated: {@code applyProductPatch} only
     * mutates the in-memory entity graph and its sole repository touches
     * ({@code resolveProductRefs} + attribute lookups) are read-only. The
     * read-only transaction guards against an accidental dirty flush.
     */
    @Transactional(readOnly = true)
    public Product previewProduct(UpsertProductRequest request, String lang) {
        requireJpaPersistenceEnabled();

        List<ApiErrorDetail> errors = new ArrayList<>();
        CategoryEntity category = validateAndResolveCategory(request.getCategoryId(), true, errors);
        BrandEntity brand = validateAndResolveBrand(request.getBrandId(), errors);
        String slug = validateProductRequest(request, null, true, true, errors);
        AdminMutationValidators.throwIfErrors(errors);

        Instant now = Instant.now();
        ProductEntity entity = new ProductEntity();
        entity.setId("prod_preview");
        entity.setCreatedAt(now);
        entity.setUpdatedAt(now);
        applyProductPatch(entity, request, slug, category, brand, true);

        // No save: pure in-memory build, mapped to the same public Product shape the
        // storefront PDP renders (publicView=true → cost price hidden, stock masked).
        String locale = "en".equalsIgnoreCase(lang) ? "en" : "vi";
        return jpaCatalogReadRepository.mapPreviewProduct(entity, locale);
    }

    @Transactional
    public Product updateProduct(String productId, UpsertProductRequest request, UUID adminId) {
        requireJpaPersistenceEnabled();

        ProductEntity entity = productJpaRepository.findById(productId)
                .orElseThrow(() -> new NotFoundException("Product not found."));
        String previousSlug = entity.getSlug();
        String previousSlugEn = entity.getSlugEn();

        List<ApiErrorDetail> errors = new ArrayList<>();
        CategoryEntity category = validateAndResolveCategory(request.getCategoryId(), false, errors);
        BrandEntity brand = validateAndResolveBrand(request.getBrandId(), errors);
        String slug = validateProductRequest(request, entity, false, false, errors);
        PublishStatus nextPublishStatus = request.getPublishStatus() == null ? entity.getPublishStatus() : request.getPublishStatus();
        AdminMutationValidators.validatePublishTransition(entity.getPublishStatus(), nextPublishStatus, "publishStatus", errors);
        AdminMutationValidators.throwIfErrors(errors);

        entity.setUpdatedAt(Instant.now());
        applyProductPatch(entity, request, slug, category, brand, false);
        productJpaRepository.save(entity);
        auditLog("PRODUCT_UPDATED", "PRODUCT", adminId, null, productJson(entity));
        if (!previousSlug.equals(entity.getSlug())) {
            autoCreateSlugRedirect("/product/" + previousSlug, "/product/" + entity.getSlug());
        }
        autoCreateSlugEnRedirect("/product/", previousSlugEn, entity.getSlugEn(), entity.getSlug());
        revalidateProduct(entity, previousSlug);

        return catalogReadRepository.findProductById(entity.getId())
                .orElseThrow(() -> new NotFoundException("Product not found."));
    }

    @Transactional
    public Product updateProductPublishStatus(String productId, PublishStatus publishStatus, UUID adminId) {
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

        if (publishStatus == PublishStatus.PUBLISHED) {
            List<ApiErrorDetail> readinessErrors = new ArrayList<>();
            AdminMutationValidators.validatePublishReadiness(entity, readinessErrors);
            AdminMutationValidators.throwIfPublishErrors(readinessErrors);
        }

        entity.setPublishStatus(publishStatus);
        entity.setUpdatedAt(Instant.now());
        productJpaRepository.save(entity);
        auditLog("PRODUCT_PUBLISH_STATUS_UPDATED", "PRODUCT", adminId, null, productJson(entity));
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
    public Product softDeleteProduct(String productId, UUID adminId) {
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
        auditLog("PRODUCT_SOFT_DELETED", "PRODUCT", adminId, null, productJson(entity));
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
    public Product restoreProduct(String productId, UUID adminId) {
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
        auditLog("PRODUCT_RESTORED", "PRODUCT", adminId, null, productJson(entity));
        revalidateProduct(entity, null);

        return catalogReadRepository.findProductById(entity.getId())
                .orElseThrow(() -> new NotFoundException("Product not found."));
    }

    @Transactional
    public Category createCategory(UpsertCategoryRequest request, UUID adminId) {
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
        auditLog("CATEGORY_CREATED", "CATEGORY", adminId, null, categoryJson(entity));
        revalidateCategory(entity, null);

        return catalogReadRepository.findCategoryById(entity.getId())
                .orElseThrow(() -> new NotFoundException("Category not found."));
    }

    @Transactional
    public Category updateCategory(String categoryId, UpsertCategoryRequest request, UUID adminId) {
        requireJpaPersistenceEnabled();

        CategoryEntity entity = categoryJpaRepository.findById(categoryId)
                .orElseThrow(() -> new NotFoundException("Category not found."));
        String previousSlug = entity.getSlug();
        String previousSlugEn = entity.getSlugEn();

        List<ApiErrorDetail> errors = new ArrayList<>();
        String slug = validateCategoryRequest(request, entity, false, errors);
        CategoryEntity parent = validateAndResolveParentCategory(request.getParentId(), categoryId, false, errors);
        AdminMutationValidators.throwIfErrors(errors);

        if (Boolean.FALSE.equals(request.getVisible()) && entity.isVisible()) {
            assertNoVisibleChildren(categoryId);
        }

        entity.setUpdatedAt(Instant.now());
        applyCategoryPatch(entity, request, slug, parent, false);
        categoryJpaRepository.save(entity);
        auditLog("CATEGORY_UPDATED", "CATEGORY", adminId, null, categoryJson(entity));
        if (!previousSlug.equals(entity.getSlug())) {
            autoCreateSlugRedirect("/danh-muc-san-pham/" + previousSlug, "/danh-muc-san-pham/" + entity.getSlug());
        }
        autoCreateSlugEnRedirect("/danh-muc-san-pham/", previousSlugEn, entity.getSlugEn(), entity.getSlug());
        revalidateCategory(entity, previousSlug);

        return catalogReadRepository.findCategoryById(entity.getId())
                .orElseThrow(() -> new NotFoundException("Category not found."));
    }

    @Transactional
    public Brand createBrand(UpsertBrandRequest request, UUID adminId) {
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
        auditLog("BRAND_CREATED", "BRAND", adminId, null, brandJson(entity));
        revalidateBrand(entity, null);

        return catalogReadRepository.findBrandById(entity.getId())
                .orElseThrow(() -> new NotFoundException("Brand not found."));
    }

    @Transactional
    public Brand updateBrand(String brandId, UpsertBrandRequest request, UUID adminId) {
        requireJpaPersistenceEnabled();

        BrandEntity entity = brandJpaRepository.findById(brandId)
                .orElseThrow(() -> new NotFoundException("Brand not found."));
        String previousSlug = entity.getSlug();
        String previousSlugEn = entity.getSlugEn();

        List<ApiErrorDetail> errors = new ArrayList<>();
        String slug = validateBrandRequest(request, entity, false, errors);
        AdminMutationValidators.throwIfErrors(errors);

        entity.setUpdatedAt(Instant.now());
        applyBrandPatch(entity, request, slug, false);
        brandJpaRepository.save(entity);
        auditLog("BRAND_UPDATED", "BRAND", adminId, null, brandJson(entity));
        if (!previousSlug.equals(entity.getSlug())) {
            autoCreateSlugRedirect("/brands/" + previousSlug, "/brands/" + entity.getSlug());
        }
        autoCreateSlugEnRedirect("/brands/", previousSlugEn, entity.getSlugEn(), entity.getSlug());
        revalidateBrand(entity, previousSlug);

        return catalogReadRepository.findBrandById(entity.getId())
                .orElseThrow(() -> new NotFoundException("Brand not found."));
    }

    @Transactional
    public Brand deleteBrand(String brandId, UUID adminId) {
        requireJpaPersistenceEnabled();
        BrandEntity entity = brandJpaRepository.findById(brandId)
                .orElseThrow(() -> new NotFoundException("Brand not found."));
        if (!entity.isVisible()) {
            return catalogReadRepository.findBrandById(entity.getId())
                    .orElseThrow(() -> new NotFoundException("Brand not found."));
        }
        entity.setVisible(false);
        entity.setUpdatedAt(Instant.now());
        brandJpaRepository.save(entity);
        auditLog("BRAND_SOFT_DELETED", "BRAND", adminId, null, brandJson(entity));
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

    private void auditLog(String action, String resourceType, UUID adminId, String before, String after) {
        AuditLogEntity log = new AuditLogEntity();
        log.setActorType("ADMIN");
        log.setActorId(adminId);
        log.setAction(action);
        log.setResourceType(resourceType);
        log.setBeforeData(before);
        log.setAfterData(after);
        log.setCreatedAt(Instant.now());
        auditLogWriter.save(log);
    }

    /**
     * 301-redirect bookkeeping when the optional English slug changes
     * (PRODUCT/CATEGORY/BRAND_RULE_003). {@code pathPrefix} is e.g. {@code "/product/"}.
     * Changed → old-EN → new-EN; cleared → old-EN → vi URL. No-op when there was no
     * previous English slug or it is unchanged.
     */
    private void autoCreateSlugEnRedirect(String pathPrefix, String previousSlugEn, String newSlugEn, String viSlug) {
        if (previousSlugEn == null || previousSlugEn.equals(newSlugEn)) {
            return;
        }
        String target = newSlugEn != null ? pathPrefix + newSlugEn : pathPrefix + viSlug;
        autoCreateSlugRedirect(pathPrefix + previousSlugEn, target);
    }

    private void autoCreateSlugRedirect(String source, String target) {
        if (redirectRepo == null) return;
        RedirectEntity redirect = redirectRepo.findBySourcePattern(source)
                .orElseGet(RedirectEntity::new);
        redirect.setSourcePattern(source);
        redirect.setTargetUrl(target);
        redirect.setRedirectType("PERMANENT");
        redirect.setStatusCode(301);
        redirect.setEnabled(true);
        redirect.setUpdatedAt(Instant.now());
        if (redirect.getId() == null) {
            redirect.setCreatedAt(Instant.now());
        }
        redirectRepo.save(redirect);
    }

    private static String productJson(ProductEntity e) {
        return writeAuditJson(Map.of(
                "id", nullSafe(e.getId()),
                "name", nullSafe(e.getName()),
                "slug", nullSafe(e.getSlug()),
                "publishStatus", e.getPublishStatus() == null ? "" : e.getPublishStatus().toString()
        ));
    }

    private static String categoryJson(CategoryEntity e) {
        return writeAuditJson(Map.of(
                "id", nullSafe(e.getId()),
                "name", nullSafe(e.getName()),
                "slug", nullSafe(e.getSlug()),
                "visible", e.isVisible()
        ));
    }

    private static String brandJson(BrandEntity e) {
        return writeAuditJson(Map.of(
                "id", nullSafe(e.getId()),
                "name", nullSafe(e.getName()),
                "slug", nullSafe(e.getSlug()),
                "visible", e.isVisible()
        ));
    }

    private static String writeAuditJson(Map<String, Object> fields) {
        try {
            return AUDIT_MAPPER.writeValueAsString(fields);
        } catch (JsonProcessingException ex) {
            // Audit logging is best-effort; if serialization fails we still want
            // the mutation to succeed. Fall back to a minimal marker.
            return "{\"_serialization_error\":true}";
        }
    }

    private static String nullSafe(String s) {
        return s == null ? "" : s;
    }

    private String validateProductRequest(
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
        AdminMutationValidators.validateNonNegativeDecimal(request.getCompareAtPrice(), "compareAtPrice", "compareAtPrice", errors);
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
        if (slugEn.equals(viSlug)) {
            errors.add(new ApiErrorDetail("translations.en.slug", "INVALID_VALUE",
                    "English slug must differ from the Vietnamese slug."));
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
        // When descriptionBlocks are submitted, the renderer owns the description column.
        if (!request.isDescriptionBlocksPresent() && (create || request.getDescription() != null)) {
            entity.setDescription(AdminMutationValidators.trimToNull(request.getDescription()));
        }
        if (create || request.getBrandId() != null) {
            entity.setBrand(brand);
        }
        if (create || request.getCategoryId() != null) {
            entity.setCategory(category);
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
        if (create || request.isCostPricePresent()) {
            entity.setCostPrice(request.getCostPrice());
        }
        // BigBike is VND-only. DTO validator rejects anything else; persistence is hardcoded.
        entity.setCurrency("VND");
        if (create) {
            entity.setStockState(ProductStockState.OUT_OF_STOCK);
        }
        if (create || request.getForceOutOfStock() != null) {
            entity.setForceOutOfStock(Boolean.TRUE.equals(request.getForceOutOfStock()));
        }
        if (create || request.getPublishStatus() != null) {
            entity.setPublishStatus(request.getPublishStatus() == null ? PublishStatus.DRAFT : request.getPublishStatus());
        }
        if (create || request.getHomepageBlock() != null) {
            entity.setHomepageBlock(request.getHomepageBlock() == null
                    ? com.bigbike.bigbike_backend.domain.catalog.HomepageBlock.NONE
                    : request.getHomepageBlock());
        }
        if (create || request.isHomepageOrderPresent()) {
            entity.setHomepageOrder(request.getHomepageOrder());
        }
        // Phase 2D: review moderation owns rating cache recomputation, so
        // product mutations must not write rating/ratingCount directly.
        if (create || request.isPromotionContentPresent()) {
            entity.setPromotionContent(AdminMutationValidators.trimToNull(request.getPromotionContent()));
        }
        if (create || request.isInstallationGuidePresent()) {
            entity.setInstallationGuide(AdminMutationValidators.trimToNull(request.getInstallationGuide()));
        }

        // Template SEO fields (V175). Presence-flag scalars (1 ngôn ngữ).
        if (create || request.isWarrantyMonthsPresent()) {
            entity.setWarrantyMonths(request.getWarrantyMonths());
        }
        if (create || request.isWarrantyScopePresent()) {
            entity.setWarrantyScope(AdminMutationValidators.trimToNull(request.getWarrantyScope()));
        }
        if (create || request.isOriginBrandCountryPresent()) {
            entity.setOriginBrandCountry(AdminMutationValidators.trimToNull(request.getOriginBrandCountry()));
        }
        // Trọng lượng nhập bằng gram, lưu vào cột weight_kg (= grams / 1000).
        if (create || request.isWeightGramsPresent()) {
            Integer grams = request.getWeightGrams();
            entity.setWeightKg(grams == null
                    ? null
                    : BigDecimal.valueOf(grams).divide(BigDecimal.valueOf(1000)));
        }
        if (create || request.isSizeGuidePresent()) {
            entity.setSizeGuide(AdminMutationValidators.trimToNull(request.getSizeGuide()));
        }
        if (create || request.isSectionVisibilityPresent()) {
            entity.setSectionVisibility(AdminMutationValidators.trimToNull(request.getSectionVisibility()));
        }
        if (create || request.isQuickAnswerSummaryPresent()) {
            entity.setQuickAnswerSummary(AdminMutationValidators.trimToNull(request.getQuickAnswerSummary()));
        }
        if (create || request.isSuitabilityAdvisoryPresent()) {
            entity.setSuitabilityAdvisory(AdminMutationValidators.trimToNull(request.getSuitabilityAdvisory()));
        }
        if (create || request.isGenderPresent()) {
            entity.setGender(AdminMutationValidators.trimToNull(request.getGender()));
        }

        // descriptionBlocks presence flag: sending the key (even []) renders + overwrites both columns.
        // Omitting the key leaves description_blocks and description untouched.
        if (request.isDescriptionBlocksPresent()) {
            List<com.bigbike.bigbike_backend.domain.catalog.DescriptionBlock> blocks = request.getDescriptionBlocks();
            entity.setDescriptionBlocks(blocks == null || blocks.isEmpty() ? null : blocks);
            String renderedHtml = descriptionBlockRenderer.renderBlocksToHtml(blocks);
            entity.setDescription(renderedHtml.isBlank() ? null : renderedHtml);
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

        if (create || request.isTranslationsPresent()) {
            applyTranslations(entity, request.getTranslations());
        }

        // descriptionBlocksEn presence flag (V229): mirror the Vietnamese pipeline. Runs AFTER
        // applyTranslations so the rendered English HTML overrides description_en (which
        // applyTranslations set from translations.en.description). Omitting the key leaves the
        // English columns untouched (legacy HTML-authored English keeps working).
        if (request.isDescriptionBlocksEnPresent()) {
            List<com.bigbike.bigbike_backend.domain.catalog.DescriptionBlock> blocksEn = request.getDescriptionBlocksEn();
            entity.setDescriptionBlocksEn(blocksEn == null || blocksEn.isEmpty() ? null : blocksEn);
            String renderedEn = descriptionBlockRenderer.renderBlocksToHtml(blocksEn);
            entity.setDescriptionEn(renderedEn.isBlank() ? null : renderedEn);
        }

        // Cấu hình tab PDP theo sản phẩm (V231) — presence flag: gửi key (kể cả []/null) thì thay/clear;
        // bỏ key thì giữ nguyên. Lưu canonical: label/blocks = vi, labelEn/blocksEn = en.
        if (request.isTabsPresent()) {
            entity.setProductTabs(mapTabs(request.getTabs()));
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

        if (request.getFaqs() != null) {
            applyFaqs(entity, request.getFaqs());
        } else if (create) {
            entity.setFaqs(new ArrayList<>());
        }

        if (request.getSpecStats() != null) {
            applySpecStats(entity, request.getSpecStats());
        } else if (create) {
            entity.setSpecStats(new ArrayList<>());
        }

        if (request.getCommitments() != null) {
            applyCommitments(entity, request.getCommitments());
        } else if (create) {
            entity.setCommitments(new ArrayList<>());
        }

        if (request.getTrustBadges() != null) {
            applyTrustBadges(entity, request.getTrustBadges());
        } else if (create) {
            entity.setTrustBadges(new ArrayList<>());
        }

        // Ưu/Nhược điểm (V175): full-replace như faqs. Hai mảng gộp vào 1 bảng con
        // (kind PRO/CON). Sửa khi BẤT KỲ mảng nào có mặt trong request.
        if (request.getPositiveNotes() != null || request.getNegativeNotes() != null || create) {
            applyHighlights(entity, request.getPositiveNotes(), request.getNegativeNotes());
        }

        if (request.getVariants() != null) {
            applyVariants(entity, request.getVariants());
        } else if (create) {
            entity.setVariants(new ArrayList<>());
        }

        if (request.getRelatedProductIds() != null) {
            entity.setRelatedProducts(resolveProductRefs(request.getRelatedProductIds(), entity.getId()));
        } else if (create) {
            entity.setRelatedProducts(new ArrayList<>());
        }

        if (request.getAccessoryProductIds() != null) {
            entity.setAccessoryProducts(resolveProductRefs(request.getAccessoryProductIds(), entity.getId()));
        } else if (create) {
            entity.setAccessoryProducts(new ArrayList<>());
        }
    }

    /**
     * Resolves curated product-reference IDs (related products, accessories) to entities —
     * de-duplicated, order-preserving, self-reference dropped, unknown IDs skipped silently
     * (tolerant, like article products).
     */
    private List<ProductEntity> resolveProductRefs(List<String> ids, String selfId) {
        List<ProductEntity> resolved = new ArrayList<>();
        LinkedHashSet<String> seen = new LinkedHashSet<>();
        for (String raw : ids) {
            String id = AdminMutationValidators.trimToNull(raw);
            if (id == null || id.equals(selfId) || !seen.add(id)) {
                continue;
            }
            productJpaRepository.findById(id).ifPresent(resolved::add);
        }
        return resolved;
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
    private static void applyTranslations(ProductEntity entity, ProductTranslationRequest translations) {
        ProductTranslationRequest.ProductContentRequest en =
                translations == null ? null : translations.getEn();
        entity.setSlugEn(en == null ? null : AdminMutationValidators.trimToNull(en.getSlug()));
        entity.setNameEn(en == null ? null : AdminMutationValidators.trimToNull(en.getName()));
        entity.setShortDescriptionEn(en == null ? null : AdminMutationValidators.trimToNull(en.getShortDescription()));
        entity.setDescriptionEn(en == null ? null : AdminMutationValidators.trimToNull(en.getDescription()));
        entity.setPromotionContentEn(en == null ? null : AdminMutationValidators.trimToNull(en.getPromotionContent()));
        entity.setInstallationGuideEn(en == null ? null : AdminMutationValidators.trimToNull(en.getInstallationGuide()));
        entity.setQuickAnswerSummaryEn(en == null ? null : AdminMutationValidators.trimToNull(en.getQuickAnswerSummary()));
        entity.setSuitabilityAdvisoryEn(en == null ? null : AdminMutationValidators.trimToNull(en.getSuitabilityAdvisory()));
        entity.setSeoTitleEn(en == null ? null : AdminMutationValidators.trimToNull(en.getSeoTitle()));
        entity.setSeoDescriptionEn(en == null ? null : AdminMutationValidators.trimToNull(en.getSeoDescription()));
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
    private static void applySpecStats(ProductEntity entity, List<SpecStatRequest> requests) {
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
    private static List<ProductTab> mapTabs(List<ProductTabRequest> requests) {
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

    private static <T> List<T> emptyToNull(List<T> list) {
        return list == null || list.isEmpty() ? null : list;
    }

    private static void applyFaqs(ProductEntity entity, List<FaqRequest> requests) {
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
    private static void applyCommitments(ProductEntity entity, List<CommitmentRequest> requests) {
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

    /**
     * Per-product trust badges (V233) — full-replace like {@code commitments}.
     * Rows with a blank content are dropped.
     */
    private static void applyTrustBadges(ProductEntity entity, List<TrustBadgeRequest> requests) {
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
    private static void applyHighlights(
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

    private static void appendHighlights(
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

    /**
     * The variant cover image is no longer entered separately by admins — it is
     * always the FIRST image of the variant's color gallery. This derives, per
     * color, that leading gallery image (the cover) so every same-color variant
     * shares it. Returns the first gallery entry with a non-blank URL per color.
     */
    private static Map<String, GalleryImageRequest> colorCoverImages(
            Map<String, List<GalleryImageRequest>> galleryByColor) {
        Map<String, GalleryImageRequest> coverByColor = new HashMap<>();
        for (Map.Entry<String, List<GalleryImageRequest>> entry : galleryByColor.entrySet()) {
            for (GalleryImageRequest img : entry.getValue()) {
                if (AdminMutationValidators.trimToNull(img.getUrl()) != null) {
                    coverByColor.put(entry.getKey(), img);
                    break;
                }
            }
        }
        return coverByColor;
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
        Map<String, GalleryImageRequest> coverByColor = colorCoverImages(galleryByColor);
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
            if (createVariant || req.isCostPricePresent()) {
                variant.setCostPrice(req.getCostPrice());
            }
            variant.setCurrency("VND");
            if (createVariant) {
                variant.setStockState(ProductStockState.OUT_OF_STOCK);
            }
            // Cover image = first image of the color gallery (admins no longer
            // enter it separately). Mirror every media field so the read path and
            // cart snapshot get a complete ImageAsset; clear them when the color
            // has no gallery, or the variant has no color.
            GalleryImageRequest cover = colorKey != null ? coverByColor.get(colorKey) : null;
            if (cover != null) {
                variant.setImageUrl(AdminMutationValidators.trimToNull(cover.getUrl()));
                variant.setImageAlt(AdminMutationValidators.trimToNull(cover.getAlt()));
                variant.setImageWidth(cover.getWidth());
                variant.setImageHeight(cover.getHeight());
                variant.setImageMimeType(AdminMutationValidators.trimToNull(cover.getMimeType()));
            } else {
                variant.setImageUrl(null);
                variant.setImageAlt(null);
                variant.setImageWidth(null);
                variant.setImageHeight(null);
                variant.setImageMimeType(null);
            }
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
                    // Link to the AttributeEntity / AttributeValueEntity rows when a
                    // matching taxonomy exists, so the read path can return the human
                    // label ("Đen bóng") instead of the raw slug. Best-effort: when no
                    // match is found the FK stays null and the storefront falls back to
                    // the raw text value.
                    linkAttributeReferences(opt, oName, oValue, AdminMutationValidators.trimToNull(optReq.getAttributeValueId()));
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
     * references for a freshly-built variant option. Three resolution paths, in order:
     *
     * <ol>
     *   <li>Direct ID: when {@code attributeValueId} is supplied the FK is set without
     *       any text matching — the admin selected the value from the dictionary UI.</li>
     *   <li>Code lookup: {@code findByCode(optionName)} covers WP-imported attributes
     *       whose code is a WP taxonomy slug (e.g. {@code "pa_color"}).</li>
     *   <li>Name fallback: {@code findByNameIgnoreCase(optionName)} covers human-typed
     *       values such as {@code "Màu sắc"} that don't match a WP code.</li>
     * </ol>
     *
     * Slug matching tries the raw {@code optionValue} first, then a normalised form
     * (diacritics stripped, lower-cased) to tolerate {@code "Đen"} vs {@code "den"}.
     *
     * All lookups are best-effort: when no match is found the FK stays null and
     * the storefront falls back to the raw text chip. Repositories are nullable
     * in tests that skip the JPA stack.
     */
    private void linkAttributeReferences(ProductVariantOptionEntity opt,
                                          String optionName, String optionValue,
                                          String attributeValueId) {
        // Path 1: admin supplied an explicit attribute-value ID from the dictionary
        if (attributeValueId != null && attributeValueJpaRepository != null) {
            attributeValueJpaRepository.findById(attributeValueId).ifPresent(v -> {
                opt.setAttribute(v.getAttribute());
                opt.setAttributeValue(v);
            });
            return;
        }

        if (attributeJpaRepository == null) return;

        // Path 2: exact code match (WP taxonomy slugs like "pa_color")
        AttributeEntity attribute = attributeJpaRepository.findByCode(optionName).orElse(null);
        // Path 3: name fallback for human-typed labels like "Màu sắc"
        if (attribute == null) {
            attribute = attributeJpaRepository.findByNameIgnoreCase(optionName).orElse(null);
        }
        if (attribute == null) return;
        opt.setAttribute(attribute);

        if (attributeValueJpaRepository == null) return;
        // Exact slug match first, then normalised-slug fallback ("Đen" → "den")
        Optional<AttributeValueEntity> valueOpt =
                attributeValueJpaRepository.findByAttributeIdAndSlug(attribute.getId(), optionValue);
        if (valueOpt.isEmpty()) {
            String normalizedSlug = normalizeVariantToken(optionValue);
            if (!normalizedSlug.isEmpty()) {
                valueOpt = attributeValueJpaRepository
                        .findByAttributeIdAndSlug(attribute.getId(), normalizedSlug);
                if (valueOpt.isEmpty()) {
                    // Slugs are hyphenated ("den-bong"); the normalised token is
                    // space-separated ("den bong"). Try the hyphenated shape so a
                    // multi-word label ("Đen bóng") re-links on save round-trip —
                    // the read path returns the label, so re-saving sends the label
                    // back without an explicit attributeValueId.
                    valueOpt = attributeValueJpaRepository
                            .findByAttributeIdAndSlug(attribute.getId(), normalizedSlug.replace(' ', '-'));
                }
            }
        }
        valueOpt.ifPresent(opt::setAttributeValue);
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

        if (request.getMenuIcon() != null) {
            entity.setMenuIconUrl(AdminMutationValidators.trimToNull(request.getMenuIcon().getUrl()));
        } else if (create) {
            entity.setMenuIconUrl(null);
        }

        if (request.getBanner() != null) {
            if (AdminMutationValidators.trimToNull(request.getBanner().getUrl()) != null) {
                applyBanner(entity, request.getBanner());
            } else {
                clearBanner(entity);
            }
        } else if (create) {
            clearBanner(entity);
        }

        if (request.getMobileBanner() != null) {
            if (AdminMutationValidators.trimToNull(request.getMobileBanner().getUrl()) != null) {
                applyMobileBanner(entity, request.getMobileBanner());
            } else {
                clearMobileBanner(entity);
            }
        } else if (create) {
            clearMobileBanner(entity);
        }

        if (request.getSeo() != null) {
            applySeo(entity, request.getSeo());
        } else if (create) {
            clearSeo(entity);
        }

        CategoryTranslationRequest translations = request.getTranslations();
        CategoryTranslationRequest.CategoryContentRequest en =
                translations != null ? translations.getEn() : null;
        if (en != null) {
            entity.setSlugEn(AdminMutationValidators.trimToNull(en.getSlug()));
            entity.setNameEn(AdminMutationValidators.trimToNull(en.getName()));
            entity.setDescriptionEn(AdminMutationValidators.trimToNull(en.getDescription()));
            entity.setSeoTitleEn(AdminMutationValidators.trimToNull(en.getSeoTitle()));
            entity.setSeoDescriptionEn(AdminMutationValidators.trimToNull(en.getSeoDescription()));
        } else if (create) {
            entity.setSlugEn(null);
            entity.setNameEn(null);
            entity.setDescriptionEn(null);
            entity.setSeoTitleEn(null);
            entity.setSeoDescriptionEn(null);
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

        if (request.getBanner() != null) {
            applyBanner(entity, request.getBanner());
        } else if (create) {
            clearBanner(entity);
        }

        if (request.getMobileBanner() != null) {
            applyMobileBanner(entity, request.getMobileBanner());
        } else if (create) {
            clearMobileBanner(entity);
        }

        if (request.getSeo() != null) {
            applySeo(entity, request.getSeo());
        } else if (create) {
            clearSeo(entity);
        }

        BrandTranslationRequest translations = request.getTranslations();
        BrandTranslationRequest.BrandContentRequest en =
                translations != null ? translations.getEn() : null;
        if (en != null) {
            entity.setSlugEn(AdminMutationValidators.trimToNull(en.getSlug()));
            entity.setNameEn(AdminMutationValidators.trimToNull(en.getName()));
            entity.setDescriptionEn(AdminMutationValidators.trimToNull(en.getDescription()));
            entity.setSeoTitleEn(AdminMutationValidators.trimToNull(en.getSeoTitle()));
            entity.setSeoDescriptionEn(AdminMutationValidators.trimToNull(en.getSeoDescription()));
        } else if (create) {
            entity.setSlugEn(null);
            entity.setNameEn(null);
            entity.setDescriptionEn(null);
            entity.setSeoTitleEn(null);
            entity.setSeoDescriptionEn(null);
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

    private static void applyBanner(CategoryEntity entity, ImageAssetRequest request) {
        entity.setBannerUrl(AdminMutationValidators.trimToNull(request.getUrl()));
        entity.setBannerAlt(AdminMutationValidators.trimToNull(request.getAlt()));
    }

    private static void clearBanner(CategoryEntity entity) {
        entity.setBannerUrl(null);
        entity.setBannerAlt(null);
    }

    private static void applyMobileBanner(CategoryEntity entity, ImageAssetRequest request) {
        entity.setMobileBannerUrl(AdminMutationValidators.trimToNull(request.getUrl()));
        entity.setMobileBannerAlt(AdminMutationValidators.trimToNull(request.getAlt()));
    }

    private static void clearMobileBanner(CategoryEntity entity) {
        entity.setMobileBannerUrl(null);
        entity.setMobileBannerAlt(null);
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

    private static void applyBanner(BrandEntity entity, ImageAssetRequest request) {
        entity.setBannerUrl(AdminMutationValidators.trimToNull(request.getUrl()));
        entity.setBannerAlt(AdminMutationValidators.trimToNull(request.getAlt()));
    }

    private static void clearBanner(BrandEntity entity) {
        entity.setBannerUrl(null);
        entity.setBannerAlt(null);
    }

    private static void applyMobileBanner(BrandEntity entity, ImageAssetRequest request) {
        entity.setMobileBannerUrl(AdminMutationValidators.trimToNull(request.getUrl()));
        entity.setMobileBannerAlt(AdminMutationValidators.trimToNull(request.getAlt()));
    }

    private static void clearMobileBanner(BrandEntity entity) {
        entity.setMobileBannerUrl(null);
        entity.setMobileBannerAlt(null);
    }

    private static void applySeo(ProductEntity entity, SeoMetaRequest request) {
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
    }

    private static void applySeo(CategoryEntity entity, SeoMetaRequest request) {
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
    }

    private static void applySeo(BrandEntity entity, SeoMetaRequest request) {
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
    }

    private void revalidateProduct(ProductEntity entity, String previousSlug) {
        // "home-highlights": khối nổi bật đầu trang chủ render tên/ảnh sản phẩm → đổi sản phẩm
        // (có thể đang nằm trong slot) phải làm tươi cả khối đó. TTL nền khối chỉ 300s nên churn rẻ.
        revalidateEntityTags("products", "product:", previousSlug, entity.getSlug(), "home-highlights");
    }

    private void revalidateCategory(CategoryEntity entity, String previousSlug) {
        // "home-highlights": khối nổi bật cũng render tên/slug danh mục của sản phẩm trong slot.
        revalidateEntityTags("categories", "category:", previousSlug, entity.getSlug(), "products", "menus", "home-highlights");
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

    /**
     * Hard-delete a category together with its entire sub-tree (all descendant
     * categories), in a single transaction.
     *
     * <p>Deletion is rejected when ANY category in the sub-tree (the root itself
     * or any descendant) still has products assigned to it as their primary
     * category. Products are never deleted as a side effect — the admin must
     * reassign them to another category first. When the whole sub-tree is free
     * of products, the root and every descendant category are removed.
     */
    @Transactional
    public void hardDeleteCategory(String categoryId, UUID adminId) {
        requireJpaPersistenceEnabled();

        CategoryEntity entity = categoryJpaRepository.findById(categoryId)
                .orElseThrow(() -> new NotFoundException("Category not found."));

        // Root-first ordering of the category and all of its descendants.
        List<CategoryEntity> subtree = collectCategorySubtree(entity);

        // Block if any category in the sub-tree still has products assigned —
        // we do not orphan or delete products when removing a category.
        for (CategoryEntity node : subtree) {
            long productCount = productJpaRepository.countByCategory_Id(node.getId());
            if (productCount > 0) {
                throw new ConflictException(
                        "Cannot delete: " + productCount +
                        " product" + (productCount == 1 ? " uses" : "s use") +
                        " category \"" + node.getName() + "\" as primary category. Reassign them first."
                );
            }
        }

        // Delete deepest-first so a child row is removed before its parent
        // (category.parent_id is a self-referential foreign key).
        for (int i = subtree.size() - 1; i >= 0; i--) {
            CategoryEntity node = subtree.get(i);
            auditLog("CATEGORY_HARD_DELETED", "CATEGORY", adminId, categoryJson(node), null);
            categoryJpaRepository.delete(node);
        }
    }

    /**
     * Collect a category and all of its descendants breadth-first. The returned
     * list is root-first, so iterating it in reverse yields a leaves-first order
     * safe for deletion under the self-referential {@code parent_id} FK.
     */
    private List<CategoryEntity> collectCategorySubtree(CategoryEntity root) {
        List<CategoryEntity> ordered = new ArrayList<>();
        Deque<CategoryEntity> queue = new ArrayDeque<>();
        queue.add(root);
        while (!queue.isEmpty()) {
            CategoryEntity node = queue.poll();
            ordered.add(node);
            queue.addAll(categoryJpaRepository.findByParent_Id(node.getId()));
        }
        return ordered;
    }

    private void assertNoVisibleChildren(String categoryId) {
        long visibleChildCount = categoryJpaRepository.countByParent_IdAndIsVisibleTrue(categoryId);
        if (visibleChildCount > 0) {
            throw new ConflictException(
                    "Cannot hide category: it has " + visibleChildCount +
                    " visible child categor" + (visibleChildCount == 1 ? "y" : "ies") +
                    ". Hide or re-parent them first."
            );
        }
    }

    @Transactional
    public List<Product> setHomepageBlocks(SetHomepageBlocksRequest request, UUID adminId) {
        requireJpaPersistenceEnabled();

        List<String> featuredIds = request.getFeaturedGrid() == null ? List.of() : request.getFeaturedGrid();

        // Load all products currently in FEATURED_GRID + all submitted ids
        List<ProductEntity> currentlyPinned = productJpaRepository.findByHomepageBlockIn(List.of(HomepageBlock.FEATURED_GRID));
        Set<String> allAffectedIds = new HashSet<>();
        currentlyPinned.forEach(p -> allAffectedIds.add(p.getId()));
        allAffectedIds.addAll(featuredIds);

        List<ProductEntity> allEntities = productJpaRepository.findAllById(allAffectedIds);
        Map<String, ProductEntity> byId = new HashMap<>();
        for (ProductEntity e : allEntities) {
            byId.put(e.getId(), e);
        }

        // Validate all submitted ids exist and are PUBLISHED
        List<ApiErrorDetail> errors = new ArrayList<>();
        for (int i = 0; i < featuredIds.size(); i++) {
            String id = featuredIds.get(i);
            ProductEntity entity = byId.get(id);
            if (entity == null) {
                errors.add(new ApiErrorDetail("featuredGrid[" + i + "]", "NOT_FOUND", "Product '" + id + "' not found."));
            } else if (entity.getPublishStatus() != PublishStatus.PUBLISHED) {
                errors.add(new ApiErrorDetail("featuredGrid[" + i + "]", "NOT_PUBLISHED",
                        "Product '" + id + "' must be PUBLISHED to appear on the homepage."));
            }
        }
        AdminMutationValidators.throwIfErrors(errors);

        Set<String> newFeaturedSet = new HashSet<>(featuredIds);
        Instant now = Instant.now();

        for (ProductEntity entity : allEntities) {
            String id = entity.getId();
            if (newFeaturedSet.contains(id)) {
                entity.setHomepageBlock(HomepageBlock.FEATURED_GRID);
                entity.setHomepageOrder(featuredIds.indexOf(id));
                entity.setUpdatedAt(now);
            } else {
                entity.setHomepageBlock(HomepageBlock.NONE);
                entity.setHomepageOrder(null);
                entity.setUpdatedAt(now);
            }
        }

        productJpaRepository.saveAll(allEntities);
        auditLog("PRODUCT_HOMEPAGE_BLOCKS_SET", "PRODUCT", adminId, null, null);
        webRevalidationService.revalidate("products");

        List<Product> result = new ArrayList<>();
        for (String id : featuredIds) {
            catalogReadRepository.findProductById(id).ifPresent(result::add);
        }
        return result;
    }
}


