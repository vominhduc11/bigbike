package com.bigbike.bigbike_backend.service.admin;

import com.bigbike.bigbike_backend.api.admin.dto.CommitmentRequest;
import com.bigbike.bigbike_backend.api.admin.dto.FaqRequest;
import com.bigbike.bigbike_backend.api.admin.dto.GalleryImageRequest;
import com.bigbike.bigbike_backend.api.admin.dto.HighlightRequest;
import com.bigbike.bigbike_backend.api.admin.dto.ImageAssetRequest;
import com.bigbike.bigbike_backend.api.admin.dto.ImportReportResponse;
import com.bigbike.bigbike_backend.api.admin.dto.ImportRowResult;
import com.bigbike.bigbike_backend.api.admin.dto.ProductTabRequest;
import com.bigbike.bigbike_backend.api.admin.dto.ProductTranslationRequest;
import com.bigbike.bigbike_backend.api.admin.dto.SeoMetaRequest;
import com.bigbike.bigbike_backend.api.admin.dto.SpecStatRequest;
import com.bigbike.bigbike_backend.api.admin.dto.SpecificationRequest;
import com.bigbike.bigbike_backend.api.admin.dto.TrustBadgeRequest;
import com.bigbike.bigbike_backend.api.admin.dto.UpsertProductRequest;
import com.bigbike.bigbike_backend.api.admin.dto.VariantOptionRequest;
import com.bigbike.bigbike_backend.api.admin.dto.VariantRequest;
import com.bigbike.bigbike_backend.api.admin.dto.VideoRequest;
import com.bigbike.bigbike_backend.api.common.ApiErrorDetail;
import com.bigbike.bigbike_backend.api.error.ApiException;
import com.bigbike.bigbike_backend.api.error.MutationNotImplementedException;
import com.bigbike.bigbike_backend.api.error.ValidationException;
import com.bigbike.bigbike_backend.domain.catalog.Product;
import com.bigbike.bigbike_backend.domain.catalog.PublishStatus;
import com.bigbike.bigbike_backend.migration.wordpress.normalizer.ProductSlugGenerator;
import com.bigbike.bigbike_backend.persistence.entity.catalog.BrandEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.CategoryEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductHighlightEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductVariantEntity;
import com.bigbike.bigbike_backend.persistence.repository.catalog.BrandJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.CategoryJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ProductJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ProductVariantJpaRepository;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.introspect.AnnotatedMember;
import com.fasterxml.jackson.databind.introspect.JacksonAnnotationIntrospector;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validator;
import java.io.IOException;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

/**
 * Bulk product import/export (JSON). Reuses the real {@link AdminCatalogMutationService}
 * create/update path for commits — this class only parses the JSON file, resolves human-readable
 * references (category/brand slug, SKU-or-slug upsert matching, variant SKU-based identity)
 * into the same {@link UpsertProductRequest} shape the single-product admin API already accepts,
 * then either inspects validation errors without persisting ({@link #validateImport}) or calls
 * the real create/update per row ({@link #commitImport}).
 *
 * <p>{@link #commitImport} is deliberately NOT {@code @Transactional}: each row's call into
 * {@code adminCatalogMutationService.createProduct}/{@code updateProduct} (a separate Spring bean,
 * each individually {@code @Transactional}) opens its own transaction. One row's failure must not
 * roll back rows already committed earlier in the same file — do not wrap this method's loop in an
 * outer transaction.
 */
@Service
public class ProductImportService {

    // No ObjectMapper bean is exposed for injection in this app (see
    // AdminCatalogMutationService.AUDIT_MAPPER for the same precedent) — construct our own.
    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    // Serializes the round-trip export. NON_NULL keeps files lean; the custom introspector drops
    // the ~23 `*Present` bookkeeping getters (setSku(..) etc. flip them) so a downloaded-then-
    // reimported file never emits e.g. {"salePricePresent": false} and thereby clears an untouched
    // field. No real content property name ends in "Present".
    private static final ObjectMapper EXPORT_MAPPER = buildExportMapper();

    private static ObjectMapper buildExportMapper() {
        ObjectMapper mapper = new ObjectMapper();
        mapper.setSerializationInclusion(JsonInclude.Include.NON_NULL);
        mapper.setAnnotationIntrospector(new JacksonAnnotationIntrospector() {
            @Override
            public boolean hasIgnoreMarker(AnnotatedMember member) {
                return member.getName().endsWith("Present") || super.hasIgnoreMarker(member);
            }
        });
        return mapper;
    }

    private final ProductJpaRepository productJpaRepository;
    private final ProductVariantJpaRepository productVariantJpaRepository;
    private final CategoryJpaRepository categoryJpaRepository;
    private final BrandJpaRepository brandJpaRepository;
    private final CatalogRequestValidator catalogRequestValidator;
    private final AdminCatalogMutationService adminCatalogMutationService;
    private final Validator validator;

    public ProductImportService(
            ObjectProvider<ProductJpaRepository> productJpaRepositoryProvider,
            ObjectProvider<ProductVariantJpaRepository> productVariantJpaRepositoryProvider,
            ObjectProvider<CategoryJpaRepository> categoryJpaRepositoryProvider,
            ObjectProvider<BrandJpaRepository> brandJpaRepositoryProvider,
            CatalogRequestValidator catalogRequestValidator,
            AdminCatalogMutationService adminCatalogMutationService,
            Validator validator
    ) {
        this.productJpaRepository = productJpaRepositoryProvider.getIfAvailable();
        this.productVariantJpaRepository = productVariantJpaRepositoryProvider.getIfAvailable();
        this.categoryJpaRepository = categoryJpaRepositoryProvider.getIfAvailable();
        this.brandJpaRepository = brandJpaRepositoryProvider.getIfAvailable();
        this.catalogRequestValidator = catalogRequestValidator;
        this.adminCatalogMutationService = adminCatalogMutationService;
        this.validator = validator;
    }

    private void requireJpaPersistenceEnabled() {
        if (productJpaRepository == null || productVariantJpaRepository == null
                || categoryJpaRepository == null || brandJpaRepository == null) {
            throw new MutationNotImplementedException(
                    "Product import APIs require JPA persistence profile. Mock profile is read-only.");
        }
    }

    @Transactional(readOnly = true)
    public ImportReportResponse validateImport(MultipartFile file) {
        requireJpaPersistenceEnabled();
        return runImport(file, false, Set.of(), null);
    }

    // Deliberately NOT @Transactional — see class javadoc.
    public ImportReportResponse commitImport(MultipartFile file, Set<String> skipRowKeys, UUID adminId) {
        requireJpaPersistenceEnabled();
        return runImport(file, true, skipRowKeys == null ? Set.of() : skipRowKeys, adminId);
    }

    private ImportReportResponse runImport(
            MultipartFile file, boolean commit, Set<String> skipRowKeys, UUID adminId) {
        List<ParsedRow> rows = parseJson(file);

        Set<String> batchSkusLower = new HashSet<>();
        Set<String> batchSlugsLower = new HashSet<>();
        List<ImportRowResult> results = new ArrayList<>();
        int ok = 0, warn = 0, err = 0, skipped = 0;

        for (ParsedRow row : rows) {
            if (skipRowKeys.contains(row.rowKey)) {
                results.add(new ImportRowResult(row.rowNumber, row.rowKey, null, row.request.getName(),
                        "SKIPPED_BY_USER", "OK", List.of(), List.of(), 0, 0, 0, 0, List.of()));
                skipped++;
                continue;
            }
            ImportRowResult result = processRow(row, batchSkusLower, batchSlugsLower, commit, adminId);
            results.add(result);
            switch (result.status()) {
                case "ERROR" -> err++;
                case "WARNING" -> warn++;
                default -> ok++;
            }
        }

        return new ImportReportResponse(commit ? "COMMIT" : "VALIDATE",
                rows.size(), ok, warn, err, skipped, results);
    }

    // ── Per-row pipeline (shared by validate + commit) ──────────────────────────

    private ImportRowResult processRow(
            ParsedRow row, Set<String> batchSkusLower, Set<String> batchSlugsLower, boolean commit, UUID adminId) {
        List<ApiErrorDetail> errors = new ArrayList<>(row.parseErrors);
        List<ApiErrorDetail> warnings = new ArrayList<>(row.parseWarnings);
        UpsertProductRequest request = row.request;

        runBeanValidation(request, errors);
        resolveCategoryAndBrand(request, errors);
        resolveRelatedAndAccessoryRefs(request, warnings);

        ProductEntity existing = resolveExistingProduct(request, errors);
        boolean ambiguous = errors.stream().anyMatch(e -> "AMBIGUOUS".equals(e.code()));
        boolean isCreate = existing == null && !ambiguous;

        resolveSlug(request, isCreate, batchSlugsLower, errors);
        applyPublishStatusRule(request, isCreate, row.fileStatus, warnings);

        if (!isCreate && existing != null) {
            backfillTranslationsFromExisting(request, existing);
            backfillSeoFromExisting(request, existing);
        }

        resolveVariantIdentities(existing, request.getVariants(), errors);
        checkBatchVariantSkuDuplicates(request.getVariants(), batchSkusLower, errors);
        checkMissingImage(request, existing, warnings);

        VariantDiff diff = computeVariantDiff(request, existing);

        if (ambiguous) {
            return errorResult(row, existing, request, isCreate, errors, warnings, diff);
        }

        if (!commit) {
            // Category/brand existence was already checked in resolveCategoryAndBrand() above (by
            // slug, with a clearer message) — do not re-run validateAndResolveCategory/Brand here,
            // it would only re-fetch the same now-resolved id or duplicate the same NOT_FOUND error.
            catalogRequestValidator.validateProductRequest(request, existing, isCreate, false, errors);
            String status = !errors.isEmpty() ? "ERROR" : (warnings.isEmpty() ? "OK" : "WARNING");
            return new ImportRowResult(row.rowNumber, row.rowKey, existing != null ? existing.getId() : null,
                    request.getName(), isCreate ? "CREATE" : "UPDATE", status, errors, warnings,
                    diff.inFile(), diff.added(), diff.updated(), diff.removed(), diff.removedSkus());
        }

        if (!errors.isEmpty()) {
            return errorResult(row, existing, request, isCreate, errors, warnings, diff);
        }

        try {
            Product saved = isCreate
                    ? adminCatalogMutationService.createProduct(request, adminId)
                    : adminCatalogMutationService.updateProduct(existing.getId(), request, adminId);
            String status = warnings.isEmpty() ? "OK" : "WARNING";
            return new ImportRowResult(row.rowNumber, row.rowKey, saved.id(), request.getName(),
                    isCreate ? "CREATE" : "UPDATE", status, List.of(), warnings,
                    diff.inFile(), diff.added(), diff.updated(), diff.removed(), diff.removedSkus());
        } catch (ApiException e) {
            List<ApiErrorDetail> commitErrors = (e.details() == null || e.details().isEmpty())
                    ? List.of(new ApiErrorDetail(null, e.code(), e.getMessage()))
                    : e.details();
            return new ImportRowResult(row.rowNumber, row.rowKey, existing != null ? existing.getId() : null,
                    request.getName(), isCreate ? "CREATE" : "UPDATE", "ERROR", commitErrors, warnings,
                    diff.inFile(), diff.added(), diff.updated(), diff.removed(), diff.removedSkus());
        } catch (RuntimeException e) {
            return new ImportRowResult(row.rowNumber, row.rowKey, existing != null ? existing.getId() : null,
                    request.getName(), isCreate ? "CREATE" : "UPDATE", "ERROR",
                    List.of(new ApiErrorDetail(null, "UNEXPECTED_ERROR", "Lỗi không xác định khi lưu dòng này.")),
                    warnings, diff.inFile(), diff.added(), diff.updated(), diff.removed(), diff.removedSkus());
        }
    }

    private void runBeanValidation(UpsertProductRequest request, List<ApiErrorDetail> errors) {
        for (ConstraintViolation<UpsertProductRequest> violation : validator.validate(request)) {
            errors.add(new ApiErrorDetail(violation.getPropertyPath().toString(), "INVALID_VALUE", violation.getMessage()));
        }
    }

    private void resolveCategoryAndBrand(UpsertProductRequest request, List<ApiErrorDetail> errors) {
        String categorySlug = AdminMutationValidators.trimToNull(request.getCategoryId());
        if (categorySlug == null) {
            errors.add(new ApiErrorDetail("categoryId", "REQUIRED", "Thiếu danh mục."));
        } else {
            CategoryEntity category = categoryJpaRepository.findBySlug(categorySlug).orElse(null);
            if (category == null) {
                errors.add(new ApiErrorDetail("categoryId", "NOT_FOUND",
                        "Danh mục '" + categorySlug + "' không tồn tại — kiểm tra lại slug."));
            } else {
                request.setCategoryId(category.getId());
            }
        }
        String brandSlug = AdminMutationValidators.trimToNull(request.getBrandId());
        if (brandSlug != null) {
            BrandEntity brand = brandJpaRepository.findBySlug(brandSlug).orElse(null);
            if (brand == null) {
                errors.add(new ApiErrorDetail("brandId", "NOT_FOUND",
                        "Thương hiệu '" + brandSlug + "' không tồn tại — kiểm tra lại slug."));
            } else {
                request.setBrandId(brand.getId());
            }
        }
    }

    /**
     * Matches by product-level SKU first (spec: "SKU sản phẩm ưu tiên"), falling back to slug.
     * Product SKU has no DB uniqueness (only variant SKU does), so more than one match is a real
     * possibility — treated as a row error rather than guessing. Re-fetches with variants eagerly
     * joined ({@code findByIdsWithVariants}) so the returned entity's {@code getVariants()} is safe
     * to iterate later regardless of the caller's transaction boundary (needed because
     * {@link #commitImport} is deliberately not transactional).
     */
    private ProductEntity resolveExistingProduct(UpsertProductRequest request, List<ApiErrorDetail> errors) {
        String sku = AdminMutationValidators.trimToNull(request.getSku());
        String matchedId = null;
        if (sku != null) {
            List<ProductEntity> bySku = productJpaRepository.findAllBySkuIgnoreCase(sku);
            if (bySku.size() > 1) {
                errors.add(new ApiErrorDetail("sku", "AMBIGUOUS",
                        "SKU sản phẩm '" + sku + "' trùng nhiều bản ghi — sửa bằng đường dẫn (slug) thay vì SKU."));
                return null;
            }
            if (bySku.size() == 1) {
                matchedId = bySku.get(0).getId();
            }
        }
        if (matchedId == null) {
            String slug = AdminMutationValidators.trimToNull(request.getSlug());
            if (slug != null) {
                matchedId = productJpaRepository.findBySlug(slug).map(ProductEntity::getId).orElse(null);
            }
        }
        if (matchedId == null) {
            return null;
        }
        List<ProductEntity> withVariants = productJpaRepository.findByIdsWithVariants(List.of(matchedId));
        return withVariants.isEmpty() ? null : withVariants.get(0);
    }

    private void resolveSlug(
            UpsertProductRequest request, boolean isCreate, Set<String> batchSlugsLower, List<ApiErrorDetail> errors) {
        String fileSlug = AdminMutationValidators.trimToNull(request.getSlug());
        if (fileSlug != null) {
            if (!batchSlugsLower.add(fileSlug.toLowerCase(Locale.ROOT))) {
                errors.add(new ApiErrorDetail("slug", "DUPLICATE", "Đường dẫn (slug) trùng với dòng khác trong cùng file."));
            }
            return;
        }
        if (!isCreate) {
            return;
        }
        String generated = generateUniqueSlug(request.getName(), batchSlugsLower);
        if (generated != null) {
            request.setSlug(generated);
        }
    }

    private String generateUniqueSlug(String name, Set<String> batchSlugsLower) {
        String base = ProductSlugGenerator.toSlug(AdminMutationValidators.trimToNull(name));
        if (base.isBlank()) {
            return null;
        }
        String candidate = base;
        int suffix = 2;
        while (true) {
            String lower = candidate.toLowerCase(Locale.ROOT);
            if (productJpaRepository.findBySlug(candidate).isEmpty() && !batchSlugsLower.contains(lower)) {
                batchSlugsLower.add(lower);
                return candidate;
            }
            candidate = base + "-" + (suffix++);
            if (suffix > 500) {
                return candidate;
            }
        }
    }

    /**
     * New products always start DRAFT regardless of the file (spec requirement). On update, the
     * file's status passes through EXCEPT it can never resolve to PUBLISHED — {@code updateProduct}
     * never runs the publish-readiness gate (only the dedicated publish-status endpoint does), so
     * blindly honoring "Đã xuất bản" from a file would let an incomplete product go live with zero
     * field-completeness checking. All other targets (DRAFT/HIDDEN/TRASH) pass through normally and
     * rely on the existing validatePublishTransition to reject invalid transitions per row.
     */
    private void applyPublishStatusRule(
            UpsertProductRequest request, boolean isCreate, PublishStatus fileStatus, List<ApiErrorDetail> warnings) {
        if (isCreate) {
            request.setPublishStatus(PublishStatus.DRAFT);
            return;
        }
        if (fileStatus == null) {
            return;
        }
        if (fileStatus == PublishStatus.PUBLISHED) {
            warnings.add(new ApiErrorDetail("publishStatus", "IGNORED",
                    "Trạng thái 'Đã xuất bản' không áp dụng qua nhập file — vào sửa sản phẩm để đăng thủ công."));
            return;
        }
        request.setPublishStatus(fileStatus);
    }

    /**
     * Matches each file variant row back to its existing DB variant by SKU (never by relying on
     * the file supplying the right opaque id) BEFORE {@code applyVariants} runs. Without this, an
     * existing variant that the file doesn't tag with the correct id looks "new" to
     * {@code applyVariants}'s full-replace-by-id logic — it gets a fresh id, and the old row is
     * orphan-removed, cascade-deleting stock_movements history and resetting quantityOnHand to 0.
     */
    private void resolveVariantIdentities(ProductEntity existing, List<VariantRequest> variants, List<ApiErrorDetail> errors) {
        if (variants == null || existing == null) {
            return;
        }
        for (int i = 0; i < variants.size(); i++) {
            VariantRequest v = variants.get(i);
            String hintId = AdminMutationValidators.trimToNull(v.getId());
            if (hintId != null) {
                if (productVariantJpaRepository.findByIdAndProductId(hintId, existing.getId()).isPresent()) {
                    continue;
                }
                v.setId(null);
            }
            String sku = AdminMutationValidators.trimToNull(v.getSku());
            if (sku == null) {
                continue;
            }
            int rowIndex = i;
            productVariantJpaRepository.findBySkuIgnoreCase(sku).ifPresent(match -> {
                if (match.getProduct().getId().equals(existing.getId())) {
                    v.setId(match.getId());
                } else {
                    errors.add(new ApiErrorDetail("variants[" + rowIndex + "].sku", "DUPLICATE",
                            "SKU biến thể '" + sku + "' đã thuộc về sản phẩm khác."));
                }
            });
        }
    }

    private void checkBatchVariantSkuDuplicates(
            List<VariantRequest> variants, Set<String> batchSkusLower, List<ApiErrorDetail> errors) {
        if (variants == null) {
            return;
        }
        for (int i = 0; i < variants.size(); i++) {
            String sku = AdminMutationValidators.trimToNull(variants.get(i).getSku());
            if (sku == null) {
                continue;
            }
            if (!batchSkusLower.add(sku.toLowerCase(Locale.ROOT))) {
                errors.add(new ApiErrorDetail("variants[" + i + "].sku", "DUPLICATE",
                        "SKU biến thể '" + sku + "' trùng với dòng khác trong cùng file."));
            }
        }
    }

    private void checkMissingImage(UpsertProductRequest request, ProductEntity existing, List<ApiErrorDetail> warnings) {
        boolean hasImage;
        if (request.isImagePresent()) {
            hasImage = request.getImage() != null && AdminMutationValidators.trimToNull(request.getImage().getUrl()) != null;
        } else {
            hasImage = existing != null && AdminMutationValidators.trimToNull(existing.getImageUrl()) != null;
        }
        if (!hasImage) {
            warnings.add(new ApiErrorDetail("image.url", "MISSING_IMAGE",
                    "THIẾU ẢNH — sản phẩm chưa có ảnh đại diện, cần bổ sung trước khi đăng bán."));
        }
    }

    /**
     * translations.en.name is hard-required on every row, so the {@code translations} object is
     * always built once a row has any English content at all — but {@code applyTranslations} is a
     * full replace of every EN column at once. Without this backfill, a "just fixing the price"
     * update file that only fills EN name would silently wipe every other existing EN field
     * (short description, full description, specs HTML, size guide, SEO) back to blank.
     */
    private void backfillTranslationsFromExisting(UpsertProductRequest request, ProductEntity existing) {
        ProductTranslationRequest translations = request.getTranslations();
        if (translations == null || translations.getEn() == null) {
            return;
        }
        ProductTranslationRequest.ProductContentRequest en = translations.getEn();
        if (en.getShortDescription() == null) en.setShortDescription(existing.getShortDescriptionEn());
        if (en.getDescription() == null) en.setDescription(existing.getDescriptionEn());
        if (en.getPromotionContent() == null) en.setPromotionContent(existing.getPromotionContentEn());
        if (en.getInstallationGuide() == null) en.setInstallationGuide(existing.getInstallationGuideEn());
        if (en.getSizeGuide() == null) en.setSizeGuide(existing.getSizeGuideEn());
        if (en.getSuitabilityAdvisory() == null) en.setSuitabilityAdvisory(existing.getSuitabilityAdvisoryEn());
        if (en.getSpecificationsHtml() == null) en.setSpecificationsHtml(existing.getSpecificationsHtmlEn());
        if (en.getSpecStatsHtml() == null) en.setSpecStatsHtml(existing.getSpecStatsHtmlEn());
        if (en.getTrustBadgesHtml() == null) en.setTrustBadgesHtml(existing.getTrustBadgesHtmlEn());
        if (en.getQuickAnswerSummary() == null) en.setQuickAnswerSummary(existing.getQuickAnswerSummaryEn());
        if (en.getSeoTitle() == null) en.setSeoTitle(existing.getSeoTitleEn());
        if (en.getSeoDescription() == null) en.setSeoDescription(existing.getSeoDescriptionEn());
    }

    /** Same clobbering risk as translations, applied to the SEO sub-object. */
    private void backfillSeoFromExisting(UpsertProductRequest request, ProductEntity existing) {
        if (request.getSeo() == null) {
            return;
        }
        SeoMetaRequest seo = request.getSeo();
        if (seo.getTitle() == null) seo.setTitle(existing.getSeoTitle());
        if (seo.getDescription() == null) seo.setDescription(existing.getSeoDescription());
        if (seo.getCanonicalUrl() == null) seo.setCanonicalUrl(existing.getSeoCanonicalUrl());
        if (seo.getOgImage() == null && existing.getSeoOgImageUrl() != null) {
            seo.setOgImage(ImageAssetRequest.builder()
                    .url(existing.getSeoOgImageUrl())
                    .alt(existing.getSeoOgImageAlt())
                    .width(existing.getSeoOgImageWidth())
                    .height(existing.getSeoOgImageHeight())
                    .mimeType(existing.getSeoOgImageMimeType())
                    .build());
        }
    }

    private record VariantDiff(int inFile, int added, int updated, int removed, List<String> removedSkus) {
    }

    private VariantDiff computeVariantDiff(UpsertProductRequest request, ProductEntity existing) {
        List<VariantRequest> variants = request.getVariants();
        int inFile = variants == null ? 0 : variants.size();
        if (existing == null) {
            return new VariantDiff(inFile, inFile, 0, 0, List.of());
        }
        Set<String> fileIds = new HashSet<>();
        int added = 0, updated = 0;
        if (variants != null) {
            for (VariantRequest v : variants) {
                String id = AdminMutationValidators.trimToNull(v.getId());
                if (id != null) {
                    fileIds.add(id);
                    updated++;
                } else {
                    added++;
                }
            }
        }
        int removed = 0;
        List<String> removedSkus = new ArrayList<>();
        List<ProductVariantEntity> existingVariants = existing.getVariants();
        if (existingVariants != null) {
            for (ProductVariantEntity ev : existingVariants) {
                if (!fileIds.contains(ev.getId())) {
                    removed++;
                    removedSkus.add(ev.getSku());
                }
            }
        }
        return new VariantDiff(inFile, added, updated, removed, removedSkus);
    }

    private ImportRowResult errorResult(
            ParsedRow row, ProductEntity existing, UpsertProductRequest request, boolean isCreate,
            List<ApiErrorDetail> errors, List<ApiErrorDetail> warnings, VariantDiff diff) {
        return new ImportRowResult(row.rowNumber, row.rowKey, existing != null ? existing.getId() : null,
                request.getName(), isCreate ? "CREATE" : "UPDATE", "ERROR", errors, warnings,
                diff.inFile(), diff.added(), diff.updated(), diff.removed(), diff.removedSkus());
    }

    // ── Parsed-row model (shared by JSON parse + the per-row pipeline) ─────

    private static final class ParsedRow {
        final int rowNumber;
        final String rowKey;
        final UpsertProductRequest request;
        final PublishStatus fileStatus;
        final List<ApiErrorDetail> parseErrors = new ArrayList<>();
        final List<ApiErrorDetail> parseWarnings = new ArrayList<>();

        ParsedRow(int rowNumber, String rowKey, UpsertProductRequest request, PublishStatus fileStatus) {
            this.rowNumber = rowNumber;
            this.rowKey = rowKey;
            this.request = request;
            this.fileStatus = fileStatus;
        }
    }

    /**
     * Re-resolves {@code relatedProductIds}/{@code accessoryProductIds} for both the CSV and
     * JSON import paths (called from {@link #processRow}, after category/brand resolution).
     * CSV rows arrive here holding raw SKU tokens (see column 42/43 parsing in
     * {@link #buildProductRequestFromCsvMainRow}); JSON rows may hold literal product IDs
     * (the pre-existing single-product-API shape) or the same SKU/slug tokens. Each token is
     * tried as: exact product ID → SKU (case-insensitive) → slug, in that order, so existing
     * ID-based JSON payloads keep working unchanged.
     *
     * <p>Unknown/ambiguous tokens are dropped with a soft warning rather than failing the row.
     * If the original list was non-empty but every token failed to resolve, the field is reset
     * to {@code null} (untouched) instead of persisting an empty list — an all-typo cell must
     * not silently wipe an existing selection (mirrors {@code buildGalleryList}'s same
     * all-invalid-entries fallback). A genuinely empty input list (JSON explicit {@code []},
     * or a CSV cell containing only separators) passes through as an explicit clear, matching
     * the single-product API's presence-flag semantics for these two fields.
     *
     * <p>A token referencing a product created earlier in the same file resolves fine on commit
     * (rows commit sequentially — see class javadoc) but may warn as {@code NOT_FOUND} during
     * validate-only preview, since that product does not exist in the database yet.
     */
    private void resolveRelatedAndAccessoryRefs(UpsertProductRequest request, List<ApiErrorDetail> warnings) {
        List<String> related = request.getRelatedProductIds();
        if (related != null) {
            request.setRelatedProductIds(resolveProductRefTokens(related, warnings, "relatedProductIds"));
        }
        List<String> accessories = request.getAccessoryProductIds();
        if (accessories != null) {
            request.setAccessoryProductIds(resolveProductRefTokens(accessories, warnings, "accessoryProductIds"));
        }
    }

    private List<String> resolveProductRefTokens(List<String> tokens, List<ApiErrorDetail> warnings, String field) {
        if (tokens.isEmpty()) {
            return tokens;
        }
        List<String> resolved = new ArrayList<>();
        for (String raw : tokens) {
            String token = AdminMutationValidators.trimToNull(raw);
            if (token == null) {
                continue;
            }
            if (productJpaRepository.findById(token).isPresent()) {
                resolved.add(token);
                continue;
            }
            List<ProductEntity> bySku = productJpaRepository.findAllBySkuIgnoreCase(token);
            if (bySku.size() == 1) {
                resolved.add(bySku.get(0).getId());
                continue;
            }
            if (bySku.size() > 1) {
                warnings.add(new ApiErrorDetail(field, "AMBIGUOUS",
                        "SKU '" + token + "' trùng nhiều sản phẩm — bỏ qua tham chiếu ở " + field + "."));
                continue;
            }
            ProductEntity bySlug = productJpaRepository.findBySlug(token).orElse(null);
            if (bySlug != null) {
                resolved.add(bySlug.getId());
            } else {
                warnings.add(new ApiErrorDetail(field, "NOT_FOUND",
                        "Không tìm thấy sản phẩm với SKU/đường dẫn '" + token + "' ở " + field + " — bỏ qua."));
            }
        }
        return resolved.isEmpty() ? null : resolved;
    }

    // ── JSON parsing (array of UpsertProductRequest; categoryId/brandId hold slugs) ─

    private List<ParsedRow> parseJson(MultipartFile file) {
        UpsertProductRequest[] array;
        try {
            array = OBJECT_MAPPER.readValue(file.getInputStream(), UpsertProductRequest[].class);
        } catch (IOException e) {
            throw ValidationException.fromField("file", "UNREADABLE_FILE",
                    "File JSON không đúng định dạng — cần là mảng object sản phẩm theo đúng shape UpsertProductRequest.");
        }
        List<ParsedRow> rows = new ArrayList<>();
        for (int i = 0; i < array.length; i++) {
            UpsertProductRequest request = array[i];
            PublishStatus fileStatus = request.getPublishStatus();
            request.setPublishStatus(null);
            String rowKey = firstNonBlank(request.getSku(), request.getSlug(), "item-" + (i + 1));
            rows.add(new ParsedRow(i + 1, rowKey, request, fileStatus));
        }
        return rows;
    }

    private static String firstNonBlank(String... candidates) {
        for (String c : candidates) {
            String trimmed = AdminMutationValidators.trimToNull(c);
            if (trimmed != null) {
                return trimmed;
            }
        }
        return candidates[candidates.length - 1];
    }

    // ── Round-trip export (full-fidelity JSON — same shape validate/commit consume) ─

    @Transactional(readOnly = true)
    public byte[] exportCurrentCatalogAsTemplateJson() {
        requireJpaPersistenceEnabled();
        List<UpsertProductRequest> out = productJpaRepository.findAll().stream()
                .map(this::toExportRequest)
                .toList();
        try {
            return EXPORT_MAPPER.writeValueAsBytes(out);
        } catch (IOException e) {
            throw new RuntimeException("Failed to generate product import JSON export.", e);
        }
    }

    /**
     * Maps a stored product back into the exact {@link UpsertProductRequest} shape the JSON import
     * consumes, so "download current catalog → edit → re-import" round-trips. category/brand are
     * emitted as slug (the import resolves them by slug), related/accessory as SKU. Every rich
     * content collection is emitted; the {@code *Present} flags are stripped by {@link #EXPORT_MAPPER}
     * so a downloaded-then-reimported file never accidentally clears an untouched field. Detailed
     * description prefers structured blocks, falling back to the legacy HTML string for old rows.
     */
    private UpsertProductRequest toExportRequest(ProductEntity p) {
        UpsertProductRequest r = new UpsertProductRequest();
        r.setSku(p.getSku());
        r.setSlug(p.getSlug());
        r.setName(p.getName());
        r.setShortDescription(p.getShortDescription());
        r.setCategoryId(p.getCategory() != null ? p.getCategory().getSlug() : null);
        r.setBrandId(p.getBrand() != null ? p.getBrand().getSlug() : null);
        r.setGender(p.getGender());
        r.setCurrency(p.getCurrency());
        r.setRetailPrice(p.getRetailPrice());
        r.setSalePrice(p.getSalePrice());
        r.setForceOutOfStock(p.getForceOutOfStock());
        r.setHomepageBlock(p.getHomepageBlock());
        if (p.getHomepageOrder() != null) {
            r.setHomepageOrder(p.getHomepageOrder());
        }
        r.setPromotionContent(p.getPromotionContent());
        r.setInstallationGuide(p.getInstallationGuide());
        r.setOriginBrandCountry(p.getOriginBrandCountry());
        r.setSizeGuide(p.getSizeGuide());
        r.setSectionVisibility(p.getSectionVisibility());
        r.setSuitabilityAdvisory(p.getSuitabilityAdvisory());
        r.setSpecificationsHtml(p.getSpecificationsHtml());
        r.setSpecStatsHtml(p.getSpecStatsHtml());
        r.setTrustBadgesHtml(p.getTrustBadgesHtml());
        r.setQuickAnswerSummary(p.getQuickAnswerSummary());

        if (p.getImageUrl() != null) {
            r.setImage(ImageAssetRequest.builder()
                    .url(p.getImageUrl()).alt(p.getImageAlt())
                    .width(p.getImageWidth()).height(p.getImageHeight()).mimeType(p.getImageMimeType())
                    .build());
        }
        r.setSeo(buildSeo(p));
        r.setTranslations(buildTranslations(p));

        if (p.getDescriptionBlocks() != null && !p.getDescriptionBlocks().isEmpty()) {
            r.setDescriptionBlocks(p.getDescriptionBlocks());
        } else if (p.getDescription() != null) {
            r.setDescription(p.getDescription());
        }
        if (p.getDescriptionBlocksEn() != null && !p.getDescriptionBlocksEn().isEmpty()) {
            r.setDescriptionBlocksEn(p.getDescriptionBlocksEn());
        }

        if (notEmpty(p.getGallery())) {
            r.setGallery(p.getGallery().stream().map(g -> GalleryImageRequest.builder()
                    .mediaType(g.getMediaType()).videoUrl(g.getVideoUrl()).videoProvider(g.getVideoProvider())
                    .url(g.getImageUrl()).alt(g.getImageAlt())
                    .width(g.getImageWidth()).height(g.getImageHeight()).mimeType(g.getImageMimeType())
                    .sortOrder(g.getSortOrder()).build()).toList());
        }
        if (notEmpty(p.getVideos())) {
            r.setVideos(p.getVideos().stream().map(v -> VideoRequest.builder()
                    .url(v.getVideoUrl()).title(v.getTitle()).provider(v.getProvider())
                    .description(v.getDescription()).thumbnailUrl(v.getThumbnailUrl())
                    .sortOrder(v.getSortOrder()).build()).toList());
        }
        if (notEmpty(p.getSpecifications())) {
            r.setSpecifications(p.getSpecifications().stream().map(s -> SpecificationRequest.builder()
                    .name(s.getName()).value(s.getValue()).groupName(s.getGroupName()).sortOrder(s.getSortOrder())
                    .nameEn(s.getNameEn()).valueEn(s.getValueEn()).groupNameEn(s.getGroupNameEn()).build()).toList());
        }
        if (notEmpty(p.getSpecStats())) {
            r.setSpecStats(p.getSpecStats().stream().map(s -> SpecStatRequest.builder()
                    .value(s.getValue()).label(s.getLabel()).sortOrder(s.getSortOrder())
                    .valueEn(s.getValueEn()).labelEn(s.getLabelEn()).build()).toList());
        }
        if (notEmpty(p.getFaqs())) {
            r.setFaqs(p.getFaqs().stream().map(f -> FaqRequest.builder()
                    .question(f.getQuestion()).answer(f.getAnswer()).sortOrder(f.getSortOrder())
                    .questionEn(f.getQuestionEn()).answerEn(f.getAnswerEn()).build()).toList());
        }
        if (notEmpty(p.getCommitments())) {
            r.setCommitments(p.getCommitments().stream().map(c -> CommitmentRequest.builder()
                    .icon(c.getIcon()).title(c.getTitle()).subtitle(c.getSubtitle()).sortOrder(c.getSortOrder())
                    .titleEn(c.getTitleEn()).subtitleEn(c.getSubtitleEn()).build()).toList());
        }
        if (notEmpty(p.getTrustBadges())) {
            r.setTrustBadges(p.getTrustBadges().stream().map(t -> TrustBadgeRequest.builder()
                    .content(t.getContent()).sortOrder(t.getSortOrder()).contentEn(t.getContentEn()).build()).toList());
        }
        if (notEmpty(p.getHighlights())) {
            r.setPositiveNotes(highlightsByKind(p, ProductHighlightEntity.KIND_PRO));
            r.setNegativeNotes(highlightsByKind(p, ProductHighlightEntity.KIND_CON));
        }
        if (notEmpty(p.getVariants())) {
            r.setVariants(p.getVariants().stream().map(this::toVariantRequest).toList());
        }
        if (notEmpty(p.getProductTabs())) {
            r.setTabs(p.getProductTabs().stream().map(t -> ProductTabRequest.builder()
                    .id(t.id()).type(t.type()).enabled(t.enabled()).sortOrder(t.sortOrder())
                    .label(t.label()).labelEn(t.labelEn()).blocks(t.blocks()).blocksEn(t.blocksEn()).build()).toList());
        }
        r.setRelatedProductIds(skusOf(p.getRelatedProducts()));
        r.setAccessoryProductIds(skusOf(p.getAccessoryProducts()));
        return r;
    }

    private SeoMetaRequest buildSeo(ProductEntity p) {
        boolean hasSeo = p.getSeoTitle() != null || p.getSeoDescription() != null
                || p.getSeoCanonicalUrl() != null || p.getSeoOgImageUrl() != null;
        if (!hasSeo) {
            return null;
        }
        ImageAssetRequest og = p.getSeoOgImageUrl() == null ? null : ImageAssetRequest.builder()
                .url(p.getSeoOgImageUrl()).alt(p.getSeoOgImageAlt())
                .width(p.getSeoOgImageWidth()).height(p.getSeoOgImageHeight()).mimeType(p.getSeoOgImageMimeType())
                .build();
        return SeoMetaRequest.builder()
                .title(p.getSeoTitle()).description(p.getSeoDescription()).canonicalUrl(p.getSeoCanonicalUrl())
                .ogImage(og).build();
    }

    private ProductTranslationRequest buildTranslations(ProductEntity p) {
        if (p.getNameEn() == null) {
            return null;
        }
        ProductTranslationRequest.ProductContentRequest en = ProductTranslationRequest.ProductContentRequest.builder()
                .slug(p.getSlugEn())
                .name(p.getNameEn())
                .shortDescription(p.getShortDescriptionEn())
                .description(p.getDescriptionEn())
                .promotionContent(p.getPromotionContentEn())
                .installationGuide(p.getInstallationGuideEn())
                .sizeGuide(p.getSizeGuideEn())
                .suitabilityAdvisory(p.getSuitabilityAdvisoryEn())
                .specificationsHtml(p.getSpecificationsHtmlEn())
                .specStatsHtml(p.getSpecStatsHtmlEn())
                .trustBadgesHtml(p.getTrustBadgesHtmlEn())
                .quickAnswerSummary(p.getQuickAnswerSummaryEn())
                .seoTitle(p.getSeoTitleEn())
                .seoDescription(p.getSeoDescriptionEn())
                .originBrandCountry(p.getOriginBrandCountryEn())
                .build();
        return new ProductTranslationRequest(en);
    }

    private VariantRequest toVariantRequest(ProductVariantEntity v) {
        VariantRequest vr = new VariantRequest();
        vr.setId(v.getId());
        vr.setSku(v.getSku());
        vr.setRetailPrice(v.getRetailPrice());
        vr.setSalePrice(v.getSalePrice());
        vr.setImageUrl(v.getImageUrl());
        vr.setImageAlt(v.getImageAlt());
        vr.setImageWidth(v.getImageWidth());
        vr.setImageHeight(v.getImageHeight());
        vr.setImageMimeType(v.getImageMimeType());
        vr.setIsAvailable(v.isAvailable());
        vr.setSortOrder(v.getSortOrder());
        if (notEmpty(v.getOptions())) {
            vr.setOptions(v.getOptions().stream().map(o -> VariantOptionRequest.builder()
                    .optionName(o.getOptionName()).optionValue(o.getOptionValue()).build()).toList());
        }
        if (notEmpty(v.getGallery())) {
            vr.setGallery(v.getGallery().stream().map(g -> GalleryImageRequest.builder()
                    .mediaType(g.getMediaType()).videoUrl(g.getVideoUrl()).videoProvider(g.getVideoProvider())
                    .url(g.getImageUrl()).alt(g.getImageAlt())
                    .width(g.getImageWidth()).height(g.getImageHeight()).mimeType(g.getImageMimeType())
                    .sortOrder(g.getSortOrder()).build()).toList());
        }
        return vr;
    }

    private List<HighlightRequest> highlightsByKind(ProductEntity p, String kind) {
        List<HighlightRequest> out = p.getHighlights().stream()
                .filter(h -> kind.equals(h.getKind()))
                .map(h -> HighlightRequest.builder()
                        .content(h.getContent()).contentEn(h.getContentEn()).sortOrder(h.getSortOrder()).build())
                .toList();
        return out.isEmpty() ? null : out;
    }

    private static List<String> skusOf(List<ProductEntity> products) {
        if (products == null || products.isEmpty()) {
            return null;
        }
        List<String> skus = products.stream()
                .map(ProductEntity::getSku)
                .filter(s -> s != null && !s.isBlank())
                .toList();
        return skus.isEmpty() ? null : skus;
    }

    private static boolean notEmpty(List<?> list) {
        return list != null && !list.isEmpty();
    }

}
