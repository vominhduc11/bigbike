package com.bigbike.bigbike_backend.service.admin;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.bigbike.bigbike_backend.api.admin.dto.GalleryImageRequest;
import com.bigbike.bigbike_backend.api.admin.dto.CategoryTranslationRequest;
import com.bigbike.bigbike_backend.api.admin.dto.BrandTranslationRequest;
import com.bigbike.bigbike_backend.api.admin.dto.UpsertBrandRequest;
import com.bigbike.bigbike_backend.api.admin.dto.UpsertCategoryRequest;
import com.bigbike.bigbike_backend.api.admin.dto.UpsertProductRequest;
import com.bigbike.bigbike_backend.api.admin.dto.VariantOptionRequest;
import com.bigbike.bigbike_backend.api.admin.dto.VariantRequest;
import com.bigbike.bigbike_backend.api.common.ApiErrorDetail;
import com.bigbike.bigbike_backend.api.error.ConflictException;
import com.bigbike.bigbike_backend.api.error.MutationNotImplementedException;
import com.bigbike.bigbike_backend.api.error.NotFoundException;
import com.bigbike.bigbike_backend.config.MediaUrlProperties;
import com.bigbike.bigbike_backend.service.web.WebRevalidationService;
import com.bigbike.bigbike_backend.domain.catalog.Brand;
import com.bigbike.bigbike_backend.domain.catalog.Category;
import com.bigbike.bigbike_backend.domain.catalog.Product;
import com.bigbike.bigbike_backend.domain.catalog.PublishStatus;
import com.bigbike.bigbike_backend.persistence.entity.catalog.AttributeEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.AttributeValueEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.BrandEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.CategoryEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductVariantEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductVariantOptionEntity;
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
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import com.bigbike.bigbike_backend.persistence.entity.audit.AuditLogEntity;
import com.bigbike.bigbike_backend.service.audit.AuditLogWriter;
import com.bigbike.bigbike_backend.service.catalog.DescriptionBlockRenderer;
import com.bigbike.bigbike_backend.service.inventory.InventoryPolicyService;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import static com.bigbike.bigbike_backend.service.admin.ProductFieldApplier.*;

@Service
public class AdminCatalogMutationService {

    private static final ObjectMapper AUDIT_MAPPER = new ObjectMapper();

    /**
     * Danh mục hệ thống "Chưa phân loại" — kho chứa sản phẩm khi danh mục gốc bị
     * xoá (xem CATEGORY_RULE_004). Bị khoá: không cho sửa/xoá. Bảo đảm tồn tại qua
     * Flyway V292.
     */
    private static final String UNCATEGORIZED_CATEGORY_ID = "uncategorized";

    /**
     * Thương hiệu hệ thống "Chưa phân loại" — kho chứa sản phẩm khi thương hiệu gốc
     * bị xoá vĩnh viễn (xem BRAND_RULE_004). Bị khoá: không cho sửa/xoá, ẩn khỏi
     * danh sách quản lý. Bảo đảm tồn tại qua Flyway V304.
     */
    private static final String UNCATEGORIZED_BRAND_ID = "uncategorized-brand";

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
    private final CatalogRequestValidator catalogRequestValidator;
    private final InventoryPolicyService inventoryPolicyService;

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
            ObjectProvider<RedirectJpaRepository> redirectRepoProvider,
            CatalogRequestValidator catalogRequestValidator,
            InventoryPolicyService inventoryPolicyService
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
        this.catalogRequestValidator = catalogRequestValidator;
        this.inventoryPolicyService = inventoryPolicyService;
    }

    @Transactional
    public Product createProduct(UpsertProductRequest request, UUID adminId) {
        requireJpaPersistenceEnabled();

        List<ApiErrorDetail> errors = new ArrayList<>();
        CategoryEntity category = catalogRequestValidator.validateAndResolveCategory(request.getCategoryId(), true, errors);
        BrandEntity brand = catalogRequestValidator.validateAndResolveBrand(request.getBrandId(), errors);
        String slug = catalogRequestValidator.validateProductRequest(request, null, true, false, errors);
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
        CategoryEntity category = catalogRequestValidator.validateAndResolveCategory(request.getCategoryId(), true, errors);
        BrandEntity brand = catalogRequestValidator.validateAndResolveBrand(request.getBrandId(), errors);
        String slug = catalogRequestValidator.validateProductRequest(request, null, true, true, errors);
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
        CategoryEntity category = catalogRequestValidator.validateAndResolveCategory(request.getCategoryId(), false, errors);
        BrandEntity brand = catalogRequestValidator.validateAndResolveBrand(request.getBrandId(), errors);
        String slug = catalogRequestValidator.validateProductRequest(request, entity, false, false, errors);
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
    public void hardDeleteProduct(String productId, UUID adminId) {
        requireJpaPersistenceEnabled();

        ProductEntity entity = productJpaRepository.findById(productId)
                .orElseThrow(() -> new NotFoundException("Product not found."));

        if (entity.getPublishStatus() != PublishStatus.TRASH) {
            throw new com.bigbike.bigbike_backend.api.error.ConflictException("Only trashed products can be permanently deleted.");
        }

        productJpaRepository.deleteHomeHighlightsByProductId(productId);
        productJpaRepository.deleteWishlistByProductId(productId);

        auditLog("PRODUCT_HARD_DELETED", "PRODUCT", adminId, productJson(entity), null);
        productJpaRepository.delete(entity);
        revalidateProduct(entity, null);
    }

    @Transactional
    public Category createCategory(UpsertCategoryRequest request, UUID adminId) {
        requireJpaPersistenceEnabled();

        List<ApiErrorDetail> errors = new ArrayList<>();
        String slug = catalogRequestValidator.validateCategoryRequest(request, null, true, errors);
        CategoryEntity parent = catalogRequestValidator.validateAndResolveParentCategory(request.getParentId(), null, true, errors);
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

        // Danh mục hệ thống "Chưa phân loại" bị khoá — không cho đổi tên/slug/ẩn.
        if (UNCATEGORIZED_CATEGORY_ID.equals(entity.getId())) {
            throw new ConflictException(
                    "Không thể chỉnh sửa danh mục \"Chưa phân loại\" — đây là danh mục hệ thống được khoá.");
        }

        String previousSlug = entity.getSlug();
        String previousSlugEn = entity.getSlugEn();

        List<ApiErrorDetail> errors = new ArrayList<>();
        String slug = catalogRequestValidator.validateCategoryRequest(request, entity, false, errors);
        CategoryEntity parent = catalogRequestValidator.validateAndResolveParentCategory(request.getParentId(), categoryId, false, errors);
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
        String slug = catalogRequestValidator.validateBrandRequest(request, null, true, errors);
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

        // Thương hiệu hệ thống "Chưa phân loại" bị khoá — không cho đổi tên/slug/ẩn.
        if (UNCATEGORIZED_BRAND_ID.equals(entity.getId())) {
            throw new ConflictException(
                    "Không thể chỉnh sửa thương hiệu \"Chưa phân loại\" — đây là thương hiệu hệ thống được khoá.");
        }

        String previousSlug = entity.getSlug();
        String previousSlugEn = entity.getSlugEn();

        List<ApiErrorDetail> errors = new ArrayList<>();
        String slug = catalogRequestValidator.validateBrandRequest(request, entity, false, errors);
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
        if (UNCATEGORIZED_BRAND_ID.equals(entity.getId())) {
            throw new ConflictException(
                    "Không thể xoá thương hiệu \"Chưa phân loại\" — đây là thương hiệu hệ thống.");
        }
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

    @Transactional
    public Brand restoreBrand(String brandId, UUID adminId) {
        requireJpaPersistenceEnabled();
        BrandEntity entity = brandJpaRepository.findById(brandId)
                .orElseThrow(() -> new NotFoundException("Brand not found."));
        // "Chưa phân loại" phải luôn ẩn khỏi storefront (BRAND_RULE_004) — không cho
        // khôi phục thành thương hiệu công khai dù gọi thẳng API.
        if (UNCATEGORIZED_BRAND_ID.equals(entity.getId())) {
            throw new ConflictException(
                    "Không thể khôi phục thương hiệu \"Chưa phân loại\" — đây là thương hiệu hệ thống luôn bị ẩn.");
        }
        if (entity.isVisible()) {
            return catalogReadRepository.findBrandById(entity.getId())
                    .orElseThrow(() -> new NotFoundException("Brand not found."));
        }
        entity.setVisible(true);
        entity.setUpdatedAt(Instant.now());
        brandJpaRepository.save(entity);
        auditLog("BRAND_RESTORED", "BRAND", adminId, null, brandJson(entity));
        revalidateBrand(entity, null);
        return catalogReadRepository.findBrandById(entity.getId())
                .orElseThrow(() -> new NotFoundException("Brand not found."));
    }

    /**
     * Hard-delete a brand. Products are NOT deleted — they are reassigned to the
     * protected "Chưa phân loại" brand so the storefront never ends up with a
     * dangling FK reference (fk_products_brand_id has no ON DELETE SET NULL). See
     * BUSINESS_RULES.md BRAND_RULE_004. Returns the number of products reassigned,
     * so the caller can surface it to the admin.
     */
    @Transactional
    public int hardDeleteBrand(String brandId, UUID adminId) {
        requireJpaPersistenceEnabled();
        BrandEntity entity = brandJpaRepository.findById(brandId)
                .orElseThrow(() -> new NotFoundException("Brand not found."));
        if (UNCATEGORIZED_BRAND_ID.equals(entity.getId())) {
            throw new ConflictException(
                    "Không thể xoá thương hiệu \"Chưa phân loại\" — đây là thương hiệu hệ thống.");
        }
        if (entity.isVisible()) {
            throw new ConflictException("Only trashed brands can be permanently deleted.");
        }

        List<String> reassignedProductIds = productJpaRepository.findIdsByBrand_Id(brandId);
        if (!reassignedProductIds.isEmpty()) {
            BrandEntity uncategorized = brandJpaRepository.findById(UNCATEGORIZED_BRAND_ID)
                    .orElseThrow(() -> new ConflictException(
                            "Thương hiệu \"Chưa phân loại\" không tồn tại — không thể chuyển sản phẩm. Liên hệ kỹ thuật."));
            productJpaRepository.reassignBrand(uncategorized, brandId, Instant.now());
        }

        auditLog("BRAND_HARD_DELETED", "BRAND", adminId, brandJson(entity), null);
        brandJpaRepository.delete(entity);
        revalidateBrand(entity, null);
        if (!reassignedProductIds.isEmpty()) {
            webRevalidationService.revalidateProductsByIds(reassignedProductIds);
        }
        return reassignedProductIds.size();
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
        // stockState không set ở đây — luôn được dẫn xuất lại bởi recomputeProductState(entity)
        // sau khi áp dụng variants + forceOutOfStock (xem cuối hàm).
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

        // Shipping / return (pdp_shipping_line, pdp_return_line) gỡ khỏi tầng ứng dụng ở V249;
        // cột DB giữ dormant. warranty_months / warranty_scope gỡ hẳn ở V266 cùng module bảo hành.
        // Khối "Mua tại BigBike.vn" từng có field purchaseLines (V249) cũng đã gỡ hẳn ở V276.
        if (create || request.isOriginBrandCountryPresent()) {
            entity.setOriginBrandCountry(AdminMutationValidators.trimToNull(request.getOriginBrandCountry()));
        }
        if (create || request.isSizeGuidePresent()) {
            entity.setSizeGuide(AdminMutationValidators.trimToNull(request.getSizeGuide()));
        }
        if (create || request.isSectionVisibilityPresent()) {
            entity.setSectionVisibility(AdminMutationValidators.trimToNull(request.getSectionVisibility()));
        }
        if (create || request.isSuitabilityAdvisoryPresent()) {
            entity.setSuitabilityAdvisory(AdminMutationValidators.trimToNull(request.getSuitabilityAdvisory()));
        }
        if (create || request.isSpecificationsHtmlPresent()) {
            entity.setSpecificationsHtml(AdminMutationValidators.trimToNull(request.getSpecificationsHtml()));
        }
        if (create || request.isSpecStatsHtmlPresent()) {
            entity.setSpecStatsHtml(AdminMutationValidators.trimToNull(request.getSpecStatsHtml()));
        }
        if (create || request.isTrustBadgesHtmlPresent()) {
            entity.setTrustBadgesHtml(AdminMutationValidators.trimToNull(request.getTrustBadgesHtml()));
        }
        if (create || request.isQuickAnswerSummaryPresent()) {
            entity.setQuickAnswerSummary(AdminMutationValidators.trimToNull(request.getQuickAnswerSummary()));
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

        // Đồng bộ stockState mức sản phẩm với công tắc của admin:
        //  - Có biến thể: CÒN nếu có ≥1 biến thể còn hàng, ngược lại HẾT.
        //  - Không biến thể: theo công tắc Còn/Hết mức sản phẩm (lưu qua forceOutOfStock).
        // Storefront + danh sách admin đọc stockState — xem InventoryPolicyService javadoc.
        inventoryPolicyService.recomputeProductState(entity);

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
            // Mô hình tồn kho boolean (owner 2026-06-23): stockState là field dẫn xuất,
            // phải mirror công tắc isAvailable. Storefront + danh sách admin đọc stockState,
            // không đọc isAvailable trực tiếp — nên phải đồng bộ tại đây, nếu không công tắc
            // Còn/Hết của admin sẽ không "ăn" ra ngoài. Xem InventoryPolicyService javadoc.
            inventoryPolicyService.recomputeStockState(variant);

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
            variant.setName(deriveVariantName(options, i));
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
     * Variant display name is no longer admin-entered — it is always derived from
     * the variant's own attribute values (e.g. "Đen bóng - XL"), joined in option
     * order. Prefers the linked {@link AttributeValueEntity}'s label (same
     * precedence as the read path's {@code preferLabel}) so legacy slug-only
     * option text ("den-bong") resolves to the human label when a dictionary
     * link exists; falls back to the raw submitted value otherwise. A variant
     * with no resolvable option values falls back to a positional placeholder.
     */
    private String deriveVariantName(List<ProductVariantOptionEntity> options, int index) {
        List<String> parts = new ArrayList<>();
        for (ProductVariantOptionEntity opt : options) {
            AttributeValueEntity av = opt.getAttributeValue();
            String display = (av != null && av.getLabel() != null && !av.getLabel().isBlank())
                    ? av.getLabel()
                    : opt.getOptionValue();
            if (display != null && !display.isBlank()) parts.add(display);
        }
        return parts.isEmpty() ? "Biến thể " + (index + 1) : String.join(" - ", parts);
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
        if (create || request.getIntroContent() != null) {
            entity.setIntroContent(AdminMutationValidators.trimToNull(request.getIntroContent()));
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
            entity.setIntroContentEn(AdminMutationValidators.trimToNull(en.getIntroContent()));
            entity.setSeoTitleEn(AdminMutationValidators.trimToNull(en.getSeoTitle()));
            entity.setSeoDescriptionEn(AdminMutationValidators.trimToNull(en.getSeoDescription()));
        } else if (create) {
            entity.setSlugEn(null);
            entity.setNameEn(null);
            entity.setDescriptionEn(null);
            entity.setIntroContentEn(null);
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

    @Transactional
    public Category softDeleteCategory(String categoryId, UUID adminId) {
        requireJpaPersistenceEnabled();

        CategoryEntity entity = categoryJpaRepository.findById(categoryId)
                .orElseThrow(() -> new NotFoundException("Category not found."));

        if (UNCATEGORIZED_CATEGORY_ID.equals(entity.getId())) {
            throw new ConflictException(
                    "Không thể xoá danh mục \"Chưa phân loại\" — đây là danh mục hệ thống.");
        }

        List<CategoryEntity> subtree = collectCategorySubtree(entity);
        for (CategoryEntity node : subtree) {
            node.setDeleted(true);
            node.setUpdatedAt(Instant.now());
            categoryJpaRepository.save(node);
            auditLog("CATEGORY_SOFT_DELETED", "CATEGORY", adminId, null, categoryJson(node));
        }

        revalidateCategory(entity, null);

        return catalogReadRepository.findCategoryById(entity.getId())
                .orElseThrow(() -> new NotFoundException("Category not found."));
    }

    @Transactional
    public Category restoreCategory(String categoryId, UUID adminId) {
        requireJpaPersistenceEnabled();

        CategoryEntity entity = categoryJpaRepository.findById(categoryId)
                .orElseThrow(() -> new NotFoundException("Category not found."));

        List<CategoryEntity> subtree = collectCategorySubtree(entity);
        for (CategoryEntity node : subtree) {
            node.setDeleted(false);
            node.setUpdatedAt(Instant.now());
            categoryJpaRepository.save(node);
            auditLog("CATEGORY_RESTORED", "CATEGORY", adminId, null, categoryJson(node));
        }

        revalidateCategory(entity, null);

        return catalogReadRepository.findCategoryById(entity.getId())
                .orElseThrow(() -> new NotFoundException("Category not found."));
    }

    /**
     * Hard-delete a category together with its entire sub-tree (all descendant
     * categories), in a single transaction.
     *
     * <p>Products in the deleted sub-tree are NOT deleted — they are reassigned
     * to the protected "uncategorized" bucket so the storefront never ends up
     * with a dangling product ({@code category_id} is NOT NULL). The bucket
     * itself can never be deleted. See {@code BUSINESS_RULES.md CATEGORY_RULE_004}.
     */
    @Transactional
    public void hardDeleteCategory(String categoryId, UUID adminId) {
        requireJpaPersistenceEnabled();

        CategoryEntity entity = categoryJpaRepository.findById(categoryId)
                .orElseThrow(() -> new NotFoundException("Category not found."));

        // The "uncategorized" bucket is the fallback destination for products of
        // deleted categories — it must never be deleted itself.
        if (UNCATEGORIZED_CATEGORY_ID.equals(entity.getId())) {
            throw new ConflictException(
                    "Không thể xoá danh mục \"Chưa phân loại\" — đây là danh mục hệ thống chứa sản phẩm chưa được phân loại.");
        }

        if (!entity.isDeleted()) {
            throw new ConflictException(
                    "Chỉ có thể xoá vĩnh viễn các danh mục đã nằm trong Thùng rác (đã xoá mềm).");
        }

        // Root-first ordering of the category and all of its descendants.
        List<CategoryEntity> subtree = collectCategorySubtree(entity);
        List<String> subtreeIds = subtree.stream().map(CategoryEntity::getId).toList();

        // Reassign every product in the sub-tree to the "uncategorized" bucket
        // instead of blocking the delete — products are never orphaned or deleted.
        List<String> movedProductIds = productJpaRepository.findIdsByCategory_IdIn(subtreeIds);
        if (!movedProductIds.isEmpty()) {
            CategoryEntity uncategorized = categoryJpaRepository.findById(UNCATEGORIZED_CATEGORY_ID)
                    .orElseThrow(() -> new ConflictException(
                            "Danh mục \"Chưa phân loại\" không tồn tại — không thể chuyển sản phẩm. Liên hệ kỹ thuật."));
            productJpaRepository.reassignCategory(uncategorized, subtreeIds, Instant.now());
        }

        // Delete deepest-first so a child row is removed before its parent
        // (category.parent_id is a self-referential foreign key).
        for (int i = subtree.size() - 1; i >= 0; i--) {
            CategoryEntity node = subtree.get(i);
            auditLog("CATEGORY_HARD_DELETED", "CATEGORY", adminId, categoryJson(node), null);
            categoryJpaRepository.delete(node);
        }

        // Refresh storefront caches: the removed category pages, the bucket page,
        // and every product whose primary category just changed.
        revalidateCategory(entity, null);
        if (!movedProductIds.isEmpty()) {
            webRevalidationService.revalidateProductsByIds(movedProductIds);
            webRevalidationService.revalidate(
                    "categories", "category:" + UNCATEGORIZED_CATEGORY_ID, "products", "menus");
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


