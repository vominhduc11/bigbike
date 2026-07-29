package com.bigbike.bigbike_backend.service.admin;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.bigbike.bigbike_backend.api.admin.dto.GalleryImageRequest;
import com.bigbike.bigbike_backend.api.admin.dto.HighlightsRequest;
import com.bigbike.bigbike_backend.api.admin.dto.UpsertProductRequest;
import com.bigbike.bigbike_backend.api.admin.dto.VariantOptionRequest;
import com.bigbike.bigbike_backend.api.admin.dto.VariantRequest;
import com.bigbike.bigbike_backend.api.common.ApiErrorDetail;
import com.bigbike.bigbike_backend.api.error.NotFoundException;
import com.bigbike.bigbike_backend.api.error.MutationNotImplementedException;
import com.bigbike.bigbike_backend.domain.catalog.HomepageBlock;
import com.bigbike.bigbike_backend.domain.catalog.Product;
import com.bigbike.bigbike_backend.domain.catalog.PublishStatus;
import com.bigbike.bigbike_backend.persistence.entity.catalog.BrandEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.CategoryEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductVariantEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductVariantOptionEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.AttributeEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.AttributeValueEntity;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ProductJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ProductVariantJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.AttributeJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.AttributeValueJpaRepository;
import com.bigbike.bigbike_backend.repository.catalog.CatalogReadRepository;
import com.bigbike.bigbike_backend.repository.catalog.JpaCatalogReadRepository;
import com.bigbike.bigbike_backend.service.admin.support.AuditLogFactory;
import com.bigbike.bigbike_backend.service.audit.AuditLogWriter;
import com.bigbike.bigbike_backend.service.catalog.DescriptionBlockRenderer;
import com.bigbike.bigbike_backend.service.inventory.InventoryPolicyService;
import com.bigbike.bigbike_backend.service.web.WebRevalidationService;
import com.bigbike.bigbike_backend.service.ws.AdminInventoryWsService;
import com.bigbike.bigbike_backend.service.ws.InventoryWsEvent;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import static com.bigbike.bigbike_backend.service.admin.ProductFieldApplier.*;

@Service
public class ProductMutationService {

    private static final ObjectMapper AUDIT_MAPPER = new ObjectMapper();

    private final ProductJpaRepository productJpaRepository;
    private final ProductVariantJpaRepository productVariantJpaRepository;
    private final AttributeJpaRepository attributeJpaRepository;
    private final AttributeValueJpaRepository attributeValueJpaRepository;
    private final CatalogReadRepository catalogReadRepository;
    private final JpaCatalogReadRepository jpaCatalogReadRepository;
    private final WebRevalidationService webRevalidationService;
    private final AuditLogWriter auditLogWriter;
    private final AuditLogFactory auditLogFactory;
    private final DescriptionBlockRenderer descriptionBlockRenderer;
    private final CatalogRequestValidator catalogRequestValidator;
    private final InventoryPolicyService inventoryPolicyService;
    private final AdminInventoryWsService adminInventoryWsService;
    private final SlugRedirectHelper slugRedirectHelper;

    public ProductMutationService(
            ObjectProvider<ProductJpaRepository> productJpaRepositoryProvider,
            ObjectProvider<ProductVariantJpaRepository> productVariantJpaRepositoryProvider,
            ObjectProvider<AttributeJpaRepository> attributeJpaRepositoryProvider,
            ObjectProvider<AttributeValueJpaRepository> attributeValueJpaRepositoryProvider,
            CatalogReadRepository catalogReadRepository,
            ObjectProvider<JpaCatalogReadRepository> jpaCatalogReadRepositoryProvider,
            WebRevalidationService webRevalidationService,
            AuditLogWriter auditLogWriter,
            AuditLogFactory auditLogFactory,
            DescriptionBlockRenderer descriptionBlockRenderer,
            CatalogRequestValidator catalogRequestValidator,
            InventoryPolicyService inventoryPolicyService,
            SlugRedirectHelper slugRedirectHelper,
            AdminInventoryWsService adminInventoryWsService
    ) {
        this.productJpaRepository = productJpaRepositoryProvider.getIfAvailable();
        this.productVariantJpaRepository = productVariantJpaRepositoryProvider.getIfAvailable();
        this.attributeJpaRepository = attributeJpaRepositoryProvider.getIfAvailable();
        this.attributeValueJpaRepository = attributeValueJpaRepositoryProvider.getIfAvailable();
        this.catalogReadRepository = catalogReadRepository;
        this.jpaCatalogReadRepository = jpaCatalogReadRepositoryProvider.getIfAvailable();
        this.webRevalidationService = webRevalidationService;
        this.auditLogWriter = auditLogWriter;
        this.auditLogFactory = auditLogFactory;
        this.descriptionBlockRenderer = descriptionBlockRenderer;
        this.catalogRequestValidator = catalogRequestValidator;
        this.inventoryPolicyService = inventoryPolicyService;
        this.slugRedirectHelper = slugRedirectHelper;
        this.adminInventoryWsService = adminInventoryWsService;
    }

    @Transactional
    public Product createProduct(UpsertProductRequest request, UUID adminId) {
        requireJpaPersistenceEnabled();

        List<ApiErrorDetail> errors = new ArrayList<>();
        List<CategoryEntity> categories = catalogRequestValidator.validateAndResolveCategories(request, true, errors);
        BrandEntity brand = catalogRequestValidator.validateAndResolveBrand(request.getBrandId(), errors);
        String slug = catalogRequestValidator.validateProductRequest(request, null, true, false, errors);
        AdminMutationValidators.validateProductSavePublishStatus(
                null, request.getPublishStatus(), true, errors);
        AdminMutationValidators.throwIfErrors(errors);

        Instant now = Instant.now();
        ProductEntity entity = new ProductEntity();
        entity.setId(generateId("prod"));
        entity.setCreatedAt(now);
        entity.setUpdatedAt(now);

        applyProductPatch(entity, request, slug, categories, brand, true);
        dropFeaturedPlacementIfNotPublished(entity);

        List<ApiErrorDetail> readinessErrors = new ArrayList<>();
        AdminMutationValidators.validateProductFieldsRequired(
                entity, entity.getPublishStatus() == PublishStatus.PUBLISHED, readinessErrors);
        AdminMutationValidators.throwIfPublishErrors(readinessErrors);

        productJpaRepository.save(entity);
        pushInventoryEventIfChanged(entity, Map.of());
        auditLog("PRODUCT_CREATED", "PRODUCT", adminId, null, productJson(entity));
        webRevalidationService.revalidateProduct(entity.getSlug(), null);

        return catalogReadRepository.findProductById(entity.getId())
                .orElseThrow(() -> new NotFoundException("Product not found."));
    }

    @Transactional(readOnly = true)
    public Product previewProduct(UpsertProductRequest request, String lang) {
        requireJpaPersistenceEnabled();

        List<ApiErrorDetail> errors = new ArrayList<>();
        List<CategoryEntity> categories = catalogRequestValidator.validateAndResolveCategories(request, true, errors);
        BrandEntity brand = catalogRequestValidator.validateAndResolveBrand(request.getBrandId(), errors);
        String slug = catalogRequestValidator.validateProductRequest(request, null, true, true, errors);
        AdminMutationValidators.throwIfErrors(errors);

        Instant now = Instant.now();
        ProductEntity entity = new ProductEntity();
        entity.setId("prod_preview");
        entity.setCreatedAt(now);
        entity.setUpdatedAt(now);
        applyProductPatch(entity, request, slug, categories, brand, true);

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
        String before = productJson(entity);
        Map<String, String> inventoryBefore = inventoryStateSnapshot(entity);

        List<ApiErrorDetail> errors = new ArrayList<>();
        List<CategoryEntity> categories = catalogRequestValidator.validateAndResolveCategories(request, false, errors);
        BrandEntity brand = catalogRequestValidator.validateAndResolveBrand(request.getBrandId(), errors);
        String slug = catalogRequestValidator.validateProductRequest(request, entity, false, false, errors);
        PublishStatus nextPublishStatus = request.getPublishStatus() == null ? entity.getPublishStatus() : request.getPublishStatus();
        AdminMutationValidators.validateProductSavePublishStatus(
                entity.getPublishStatus(), request.getPublishStatus(), false, errors);
        AdminMutationValidators.validatePublishTransition(
                entity.getPublishStatus(), nextPublishStatus, "publishStatus", errors);
        AdminMutationValidators.throwIfErrors(errors);

        entity.setUpdatedAt(Instant.now());
        applyProductPatch(entity, request, slug, categories, brand, false);
        dropFeaturedPlacementIfNotPublished(entity);

        List<ApiErrorDetail> readinessErrors = new ArrayList<>();
        AdminMutationValidators.validateProductFieldsRequired(
                entity, nextPublishStatus == PublishStatus.PUBLISHED, readinessErrors);
        AdminMutationValidators.throwIfPublishErrors(readinessErrors);

        productJpaRepository.save(entity);
        pushInventoryEventIfChanged(entity, inventoryBefore);
        auditLog("PRODUCT_UPDATED", "PRODUCT", adminId, before, productJson(entity));
        if (!previousSlug.equals(entity.getSlug())) {
            slugRedirectHelper.autoCreateSlugRedirect("/product/" + previousSlug, "/product/" + entity.getSlug());
        }
        slugRedirectHelper.autoCreateSlugEnRedirect("/products/", "/product/", previousSlugEn, entity.getSlugEn(), entity.getSlug());
        webRevalidationService.revalidateProduct(entity.getSlug(), previousSlug);

        return catalogReadRepository.findProductById(entity.getId())
                .orElseThrow(() -> new NotFoundException("Product not found."));
    }

    /**
     * Owner decision 2026-07-28 (PRODUCT_RULE_015): a product that leaves {@code PUBLISHED} is
     * dropped from the homepage "Sản phẩm nổi bật" grid automatically. Leaving the FEATURED_GRID
     * marker on a DRAFT/TRASH product silently shrank the homepage grid (public reads filter to
     * PUBLISHED) and — because {@code setHomepageBlocks} rejects any non-PUBLISHED id — blocked
     * every later edit of the featured list until an admin removed that row by hand.
     * Re-publishing does NOT restore the placement; the admin re-adds it deliberately.
     */
    private static void dropFeaturedPlacementIfNotPublished(ProductEntity entity) {
        if (entity.getPublishStatus() == PublishStatus.PUBLISHED) {
            return;
        }
        if (entity.getHomepageBlock() == HomepageBlock.FEATURED_GRID) {
            entity.setHomepageBlock(HomepageBlock.NONE);
            entity.setHomepageOrder(null);
        }
    }

    @Transactional
    public Product updateProductPublishStatus(String productId, PublishStatus publishStatus, UUID adminId) {
        requireJpaPersistenceEnabled();

        ProductEntity entity = productJpaRepository.findById(productId)
                .orElseThrow(() -> new NotFoundException("Product not found."));
        String before = productJson(entity);

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
        dropFeaturedPlacementIfNotPublished(entity);
        entity.setUpdatedAt(Instant.now());
        productJpaRepository.save(entity);
        auditLog("PRODUCT_PUBLISH_STATUS_UPDATED", "PRODUCT", adminId, before, productJson(entity));
        webRevalidationService.revalidateProduct(entity.getSlug(), null);

        return catalogReadRepository.findProductById(entity.getId())
                .orElseThrow(() -> new NotFoundException("Product not found."));
    }

    @Transactional
    public Product softDeleteProduct(String productId, UUID adminId) {
        requireJpaPersistenceEnabled();

        ProductEntity entity = productJpaRepository.findById(productId)
                .orElseThrow(() -> new NotFoundException("Product not found."));

        if (entity.getPublishStatus() == PublishStatus.TRASH) {
            return catalogReadRepository.findProductById(entity.getId())
                    .orElseThrow(() -> new NotFoundException("Product not found."));
        }

        String before = productJson(entity);

        if (entity.getPublishStatus() == PublishStatus.PUBLISHED) {
            List<ApiErrorDetail> draftErrors = new ArrayList<>();
            AdminMutationValidators.validatePublishTransition(
                    entity.getPublishStatus(), PublishStatus.DRAFT, "publishStatus", draftErrors);
            AdminMutationValidators.throwIfErrors(draftErrors);
            entity.setPublishStatus(PublishStatus.DRAFT);
        }

        List<ApiErrorDetail> errors = new ArrayList<>();
        AdminMutationValidators.validatePublishTransition(
                entity.getPublishStatus(), PublishStatus.TRASH, "publishStatus", errors);
        AdminMutationValidators.throwIfErrors(errors);

        entity.setPublishStatus(PublishStatus.TRASH);
        dropFeaturedPlacementIfNotPublished(entity);
        entity.setUpdatedAt(Instant.now());
        productJpaRepository.save(entity);
        auditLog("PRODUCT_SOFT_DELETED", "PRODUCT", adminId, before, productJson(entity));
        webRevalidationService.revalidateProduct(entity.getSlug(), null);

        return catalogReadRepository.findProductById(entity.getId())
                .orElseThrow(() -> new NotFoundException("Product not found."));
    }

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

        String before = productJson(entity);
        entity.setPublishStatus(PublishStatus.DRAFT);
        entity.setUpdatedAt(Instant.now());
        productJpaRepository.save(entity);
        auditLog("PRODUCT_RESTORED", "PRODUCT", adminId, before, productJson(entity));
        webRevalidationService.revalidateProduct(entity.getSlug(), null);

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

        auditLog("PRODUCT_HARD_DELETED", "PRODUCT", adminId, productJson(entity), null);
        productJpaRepository.delete(entity);
        webRevalidationService.revalidateProduct(entity.getSlug(), null);
    }

    private void requireJpaPersistenceEnabled() {
        if (productJpaRepository == null) {
            throw new MutationNotImplementedException(
                    "Catalog mutation APIs require JPA persistence profile. Mock profile is read-only."
            );
        }
    }

    private void auditLog(String action, String resourceType, UUID adminId, String before, String after) {
        auditLogWriter.save(auditLogFactory.build("ADMIN", adminId, action, resourceType, null, before, after));
    }

    private static String productJson(ProductEntity e) {
        Map<String, Object> fields = new java.util.LinkedHashMap<>();
        fields.put("id", nullSafe(e.getId()));
        fields.put("sku", e.getSku());
        fields.put("name", nullSafe(e.getName()));
        fields.put("slug", nullSafe(e.getSlug()));
        fields.put("publishStatus", e.getPublishStatus() == null ? "" : e.getPublishStatus().toString());
        fields.put("brandId", e.getBrand() == null ? null : e.getBrand().getId());
        List<String> categoryIds = e.getCategories() == null ? List.of() : e.getCategories().stream()
                .map(CategoryEntity::getId)
                .toList();
        fields.put("categoryIds", categoryIds);
        fields.put("primaryCategoryId", categoryIds.isEmpty() ? null : categoryIds.get(0));
        fields.put("shortDescription", e.getShortDescription());
        fields.put("description", e.getDescription());
        fields.put("imageUrl", e.getImageUrl());
        fields.put("retailPrice", e.getRetailPrice());
        fields.put("salePrice", e.getSalePrice());
        fields.put("stockState", e.getStockState() == null ? null : e.getStockState().toString());
        fields.put("available", e.getAvailable());
        return writeAuditJson(fields);
    }

    private static String writeAuditJson(Map<String, Object> fields) {
        try {
            return AUDIT_MAPPER.writeValueAsString(fields);
        } catch (JsonProcessingException ex) {
            return "{\"_serialization_error\":true}";
        }
    }

    private static String nullSafe(String s) {
        return s == null ? "" : s;
    }

    private void pushInventoryEventIfChanged(ProductEntity product, Map<String, String> before) {
        if (!before.equals(inventoryStateSnapshot(product))) {
            adminInventoryWsService.pushEvent(new InventoryWsEvent(
                    "INVENTORY_STATE_CHANGED",
                    product.getId(),
                    Instant.now()
            ));
        }
    }

    private static Map<String, String> inventoryStateSnapshot(ProductEntity product) {
        Map<String, String> snapshot = new HashMap<>();
        snapshot.put("product:" + product.getId(), String.valueOf(product.getStockState()));
        if (product.getVariants() != null) {
            product.getVariants().forEach(variant ->
                    snapshot.put("variant:" + variant.getId(), String.valueOf(variant.getStockState())));
        }
        return snapshot;
    }

    private void applyProductPatch(
            ProductEntity entity,
            UpsertProductRequest request,
            String normalizedSlug,
            List<CategoryEntity> categories,
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
        if (!request.isDescriptionBlocksPresent() && (create || request.getDescription() != null)) {
            entity.setDescription(AdminMutationValidators.trimToNull(request.getDescription()));
        }
        if (create || request.getBrandId() != null) {
            entity.setBrand(brand);
        }
        if (create || request.isCategoryIdsPresent() || request.isCategoryIdPresent()) {
            entity.setCategories(new ArrayList<>(categories));
        }
        if (create || request.isRetailPricePresent()) {
            entity.setRetailPrice(request.getRetailPrice() == null ? BigDecimal.ZERO : request.getRetailPrice());
        }
        if (create || request.isSalePricePresent()) {
            entity.setSalePrice(request.getSalePrice());
        }
        entity.setCurrency("VND");
        if (create || request.getAvailable() != null) {
            entity.setAvailable(!Boolean.FALSE.equals(request.getAvailable()));
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
        if (create || request.isOriginBrandCountryPresent()) {
            entity.setOriginBrandCountry(AdminMutationValidators.trimToNull(request.getOriginBrandCountry()));
        }
        if (create || request.isSizeGuidePresent()) {
            entity.setSizeGuide(AdminMutationValidators.trimToNull(request.getSizeGuide()));
        }
        if (create || request.isSuitabilityAdvisoryPresent()) {
            entity.setSuitabilityAdvisory(AdminMutationValidators.trimToNull(request.getSuitabilityAdvisory()));
        }
        if (create || request.isSpecificationsPresent()) {
            entity.setSpecifications(AdminMutationValidators.trimToNull(request.getSpecifications()));
        }
        if (create || request.isSpecStatsPresent()) {
            entity.setSpecStats(AdminMutationValidators.trimToNull(request.getSpecStats()));
        }
        if (create || request.isTrustBadgesPresent()) {
            entity.setTrustBadges(AdminMutationValidators.trimToNull(request.getTrustBadges()));
        }
        if (create || request.isQuickAnswerSummaryPresent()) {
            entity.setQuickAnswerSummary(AdminMutationValidators.trimToNull(request.getQuickAnswerSummary()));
        }
        if (create || request.isGenderPresent()) {
            entity.setGender(AdminMutationValidators.trimToNull(request.getGender()));
        }

        if (request.isDescriptionBlocksPresent()) {
            List<com.bigbike.bigbike_backend.domain.catalog.DescriptionBlock> blocks = request.getDescriptionBlocks();
            entity.setDescriptionBlocks(blocks == null || blocks.isEmpty() ? null : blocks);
            String renderedHtml = descriptionBlockRenderer.renderBlocksToHtml(blocks);
            entity.setDescription(renderedHtml.isBlank() ? null : renderedHtml);
        }

        if (create || request.isSuitabilitySectionPresent()) {
            entity.setSuitabilitySection(request.getSuitabilitySection());
        }
        if (create || request.isSizeGuideSectionPresent()) {
            entity.setSizeGuideSection(request.getSizeGuideSection());
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

        if (request.isDescriptionBlocksPresent()) {
            List<com.bigbike.bigbike_backend.domain.catalog.DescriptionBlock> blocksEn =
                    com.bigbike.bigbike_backend.domain.catalog.DescriptionBlock.resolveForLocale(
                            request.getDescriptionBlocks(), "en");
            String renderedEn = descriptionBlockRenderer.renderBlocksToHtml(blocksEn);
            entity.setDescriptionEn(renderedEn.isBlank() ? null : renderedEn);
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

        if (request.getFaqs() != null) {
            applyFaqs(entity, request.getFaqs());
        } else if (create) {
            entity.setFaqs(List.of());
        }

        if (request.getCommitments() != null) {
            applyCommitments(entity, request.getCommitments());
        } else if (create) {
            entity.setCommitments(List.of());
        }

        HighlightsRequest highlightsReq = request.getHighlights();
        if (highlightsReq != null || create) {
            applyHighlights(entity,
                    highlightsReq != null ? highlightsReq.getPositiveNotes() : null,
                    highlightsReq != null ? highlightsReq.getNegativeNotes() : null);
        }

        if (request.getVariants() != null) {
            applyVariants(entity, request.getVariants());
        } else if (create) {
            entity.setVariants(new ArrayList<>());
        }

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

        Map<String, ProductVariantEntity> existingById = new HashMap<>();
        for (ProductVariantEntity v : existing) {
            if (v.getId() != null) existingById.put(v.getId(), v);
        }

        Map<String, List<GalleryImageRequest>> galleryByColor = colorGalleryRequests(requests);
        Map<String, VariantRequest> coverByColor = new HashMap<>();
        for (VariantRequest req : requests) {
            String colorKey = variantColorKey(req);
            if (colorKey != null) {
                String imgUrl = AdminMutationValidators.trimToNull(req.getImageUrl());
                if (imgUrl != null && !coverByColor.containsKey(colorKey)) {
                    coverByColor.put(colorKey, req);
                }
            }
        }
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
            if (createVariant || req.isSalePricePresent()) {
                variant.setSalePrice(req.getSalePrice());
            }
            variant.setCurrency("VND");

            VariantRequest coverReq = colorKey != null ? coverByColor.get(colorKey) : null;
            if (coverReq != null) {
                variant.setImageUrl(AdminMutationValidators.trimToNull(coverReq.getImageUrl()));
                variant.setImageAlt(AdminMutationValidators.trimToNull(coverReq.getImageAlt()));
                variant.setImageWidth(coverReq.getImageWidth());
                variant.setImageHeight(coverReq.getImageHeight());
                variant.setImageMimeType(AdminMutationValidators.trimToNull(coverReq.getImageMimeType()));
            } else {
                variant.setImageUrl(null);
                variant.setImageAlt(null);
                variant.setImageWidth(null);
                variant.setImageHeight(null);
                variant.setImageMimeType(null);
            }
            variant.setAvailable(req.getIsAvailable() == null || req.getIsAvailable());
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

        Set<String> keptIds = new HashSet<>();
        for (ProductVariantEntity v : nextVariants) {
            if (existingById.containsKey(v.getId())) keptIds.add(v.getId());
        }
        List<ProductVariantEntity> orphaned = new ArrayList<>();
        for (Map.Entry<String, ProductVariantEntity> e : existingById.entrySet()) {
            if (!keptIds.contains(e.getKey())) orphaned.add(e.getValue());
        }
        if (!orphaned.isEmpty()) {
            existing.removeAll(orphaned);
            if (productVariantJpaRepository != null) {
                productVariantJpaRepository.flush();
            }
        }

        existing.clear();
        existing.addAll(nextVariants);
    }

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

    private void linkAttributeReferences(ProductVariantOptionEntity opt,
                                          String optionName, String optionValue,
                                          String attributeValueId) {
        if (attributeValueId != null && attributeValueJpaRepository != null) {
            AttributeValueEntity byId = attributeValueJpaRepository.findById(attributeValueId).orElse(null);
            if (byId != null && matchesOptionValue(byId, optionValue)) {
                opt.setAttribute(byId.getAttribute());
                opt.setAttributeValue(byId);
                return;
            }
        }

        if (attributeJpaRepository == null) return;

        AttributeEntity attribute = attributeJpaRepository.findByCode(optionName).orElse(null);
        if (attribute == null) {
            attribute = attributeJpaRepository.findByNameIgnoreCase(optionName).orElse(null);
        }
        if (attribute == null) return;
        opt.setAttribute(attribute);

        if (attributeValueJpaRepository == null) return;
        Optional<AttributeValueEntity> valueOpt =
                attributeValueJpaRepository.findByAttributeIdAndSlug(attribute.getId(), optionValue);
        if (valueOpt.isEmpty()) {
            String normalizedSlug = normalizeVariantToken(optionValue);
            if (!normalizedSlug.isEmpty()) {
                valueOpt = attributeValueJpaRepository
                        .findByAttributeIdAndSlug(attribute.getId(), normalizedSlug);
                if (valueOpt.isEmpty()) {
                    valueOpt = attributeValueJpaRepository
                            .findByAttributeIdAndSlug(attribute.getId(), normalizedSlug.replace(' ', '-'));
                }
            }
        }
        valueOpt.ifPresent(opt::setAttributeValue);
    }

    private static boolean matchesOptionValue(AttributeValueEntity value, String optionValue) {
        String normalized = normalizeVariantToken(optionValue);
        return normalized.equals(normalizeVariantToken(value.getSlug()))
                || normalized.equals(normalizeVariantToken(value.getLabel()));
    }

    private static String generateId(String prefix) {
        return prefix + "_" + UUID.randomUUID().toString().replace("-", "");
    }
}
