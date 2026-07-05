package com.bigbike.bigbike_backend.service.admin;

import com.bigbike.bigbike_backend.api.admin.dto.GalleryImageRequest;
import com.bigbike.bigbike_backend.api.admin.dto.ImageAssetRequest;
import com.bigbike.bigbike_backend.api.admin.dto.ImportReportResponse;
import com.bigbike.bigbike_backend.api.admin.dto.ImportRowResult;
import com.bigbike.bigbike_backend.api.admin.dto.ProductTranslationRequest;
import com.bigbike.bigbike_backend.api.admin.dto.SeoMetaRequest;
import com.bigbike.bigbike_backend.api.admin.dto.UpsertProductRequest;
import com.bigbike.bigbike_backend.api.admin.dto.VariantOptionRequest;
import com.bigbike.bigbike_backend.api.admin.dto.VariantRequest;
import com.bigbike.bigbike_backend.api.common.ApiErrorDetail;
import com.bigbike.bigbike_backend.api.error.ApiException;
import com.bigbike.bigbike_backend.api.error.MutationNotImplementedException;
import com.bigbike.bigbike_backend.api.error.ValidationException;
import com.bigbike.bigbike_backend.config.MediaUrlProperties;
import com.bigbike.bigbike_backend.domain.catalog.Product;
import com.bigbike.bigbike_backend.domain.catalog.PublishStatus;
import com.bigbike.bigbike_backend.migration.wordpress.normalizer.ProductSlugGenerator;
import com.bigbike.bigbike_backend.persistence.entity.catalog.BrandEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.CategoryEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductGalleryImageEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductVariantEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductVariantGalleryImageEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductVariantOptionEntity;
import com.bigbike.bigbike_backend.persistence.repository.catalog.BrandJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.CategoryJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ProductJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ProductVariantJpaRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validator;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.Reader;
import java.io.StringWriter;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Consumer;
import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVPrinter;
import org.apache.commons.csv.CSVRecord;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

/**
 * Bulk product import/export (CSV + JSON). Reuses the real {@link AdminCatalogMutationService}
 * create/update path for commits — this class only parses files, resolves human-readable
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

    private static final String[] EXPORT_HEADERS = {
            "Loại dòng (Sản phẩm chính / Biến thể)",
            "Mã sản phẩm nội bộ",
            "SKU / mã model sản phẩm",
            "SKU bán hàng thực tế",
            "Tên sản phẩm - Tiếng Việt",
            "Tên sản phẩm - Tiếng Anh",
            "Đường dẫn (slug) - Tiếng Việt",
            "Danh mục (slug)",
            "Thương hiệu (slug)",
            "Giới tính mục tiêu (Nam / Nữ / Unisex / để trống)",
            "Trạng thái đăng (Nháp / Đã xuất bản / Ẩn / Thùng rác)",
            "Thuộc tính biến thể #1 - Tên", "Thuộc tính biến thể #1 - Giá trị",
            "Thuộc tính biến thể #2 - Tên", "Thuộc tính biến thể #2 - Giá trị",
            "Thuộc tính biến thể #3 - Tên", "Thuộc tính biến thể #3 - Giá trị",
            "Giá bán lẻ - VNĐ",
            "Giá sale - VNĐ",
            "Tình trạng kho (Còn hàng / Hết hàng)",
            "Ẩn cưỡng bức khỏi bán (Có / Không)",
            "Ảnh đại diện - URL",
            "Ảnh đại diện - alt text",
            "Thư viện ảnh sản phẩm (nhiều URL cách nhau bằng |)",
            "Ảnh đại diện riêng biến thể - URL",
            "Ảnh đại diện riêng biến thể - alt text",
            "Thư viện ảnh riêng biến thể (nhiều URL cách nhau bằng |)",
            "Mô tả ngắn - Tiếng Việt (HTML)",
            "Mô tả ngắn - Tiếng Anh (HTML)",
            "Mô tả chi tiết - Tiếng Việt (HTML thô)",
            "Mô tả chi tiết - Tiếng Anh (HTML thô)",
            "Bảng thông số kỹ thuật - Tiếng Việt (HTML thô)",
            "Bảng thông số kỹ thuật - Tiếng Anh (HTML thô)",
            "Bảng size - Tiếng Việt (HTML thô)",
            "Bảng size - Tiếng Anh (HTML thô)",
            "SEO - Tiêu đề trang - Tiếng Việt",
            "SEO - Tiêu đề trang - Tiếng Anh",
            "SEO - Mô tả trang - Tiếng Việt",
            "SEO - Mô tả trang - Tiếng Anh",
            "SEO - Canonical URL",
            "SEO - Ảnh chia sẻ mạng xã hội (og:image) - URL"
    };

    private final ProductJpaRepository productJpaRepository;
    private final ProductVariantJpaRepository productVariantJpaRepository;
    private final CategoryJpaRepository categoryJpaRepository;
    private final BrandJpaRepository brandJpaRepository;
    private final CatalogRequestValidator catalogRequestValidator;
    private final AdminCatalogMutationService adminCatalogMutationService;
    private final MediaUrlProperties mediaUrlProperties;
    private final Validator validator;

    public ProductImportService(
            ObjectProvider<ProductJpaRepository> productJpaRepositoryProvider,
            ObjectProvider<ProductVariantJpaRepository> productVariantJpaRepositoryProvider,
            ObjectProvider<CategoryJpaRepository> categoryJpaRepositoryProvider,
            ObjectProvider<BrandJpaRepository> brandJpaRepositoryProvider,
            CatalogRequestValidator catalogRequestValidator,
            AdminCatalogMutationService adminCatalogMutationService,
            MediaUrlProperties mediaUrlProperties,
            Validator validator
    ) {
        this.productJpaRepository = productJpaRepositoryProvider.getIfAvailable();
        this.productVariantJpaRepository = productVariantJpaRepositoryProvider.getIfAvailable();
        this.categoryJpaRepository = categoryJpaRepositoryProvider.getIfAvailable();
        this.brandJpaRepository = brandJpaRepositoryProvider.getIfAvailable();
        this.catalogRequestValidator = catalogRequestValidator;
        this.adminCatalogMutationService = adminCatalogMutationService;
        this.mediaUrlProperties = mediaUrlProperties;
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
    public ImportReportResponse validateImport(MultipartFile file, String type) {
        requireJpaPersistenceEnabled();
        return runImport(file, type, false, Set.of(), null);
    }

    // Deliberately NOT @Transactional — see class javadoc.
    public ImportReportResponse commitImport(MultipartFile file, String type, Set<String> skipRowKeys, UUID adminId) {
        requireJpaPersistenceEnabled();
        return runImport(file, type, true, skipRowKeys == null ? Set.of() : skipRowKeys, adminId);
    }

    private ImportReportResponse runImport(
            MultipartFile file, String type, boolean commit, Set<String> skipRowKeys, UUID adminId) {
        List<ParsedRow> rows = "json".equalsIgnoreCase(type) ? parseJson(file) : parseCsv(file);

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

        return new ImportReportResponse(commit ? "COMMIT" : "VALIDATE", type.toLowerCase(Locale.ROOT),
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

    // ── CSV parsing (41-column template — see product-import-template.csv) ─────

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

    private List<ParsedRow> parseCsv(MultipartFile file) {
        List<CSVRecord> records;
        try (Reader reader = new InputStreamReader(file.getInputStream(), StandardCharsets.UTF_8)) {
            CSVFormat format = CSVFormat.DEFAULT.builder().setIgnoreSurroundingSpaces(true).build();
            List<CSVRecord> all = format.parse(reader).getRecords();
            records = all.size() > 1 ? all.subList(1, all.size()) : List.of();
        } catch (IOException e) {
            throw ValidationException.fromField("file", "UNREADABLE_FILE", "Không đọc được file CSV.");
        }

        Map<String, List<CSVRecord>> groups = new LinkedHashMap<>();
        for (int i = 0; i < records.size(); i++) {
            CSVRecord rec = records.get(i);
            String rawKey = col(rec, 1);
            String key = rawKey != null ? rawKey : ("__row_" + (i + 2));
            groups.computeIfAbsent(key, k -> new ArrayList<>()).add(rec);
        }

        List<ParsedRow> rows = new ArrayList<>();
        int rowNumber = 0;
        for (Map.Entry<String, List<CSVRecord>> entry : groups.entrySet()) {
            rowNumber++;
            rows.add(buildParsedRowFromCsvGroup(rowNumber, entry.getKey(), entry.getValue()));
        }
        return rows;
    }

    private ParsedRow buildParsedRowFromCsvGroup(int rowNumber, String rowKey, List<CSVRecord> groupRecords) {
        CSVRecord main = null;
        List<CSVRecord> variantRecords = new ArrayList<>();
        List<ApiErrorDetail> groupErrors = new ArrayList<>();
        for (CSVRecord rec : groupRecords) {
            String normType = ProductFieldApplier.normalizeVariantToken(col(rec, 0));
            if ("bien the".equals(normType)) {
                variantRecords.add(rec);
            } else if (main == null) {
                main = rec;
            } else {
                groupErrors.add(new ApiErrorDetail("rowType", "DUPLICATE_MAIN_ROW",
                        "Nhóm '" + rowKey + "' có nhiều hơn 1 dòng Sản phẩm chính."));
            }
        }
        if (main == null) {
            ParsedRow row = new ParsedRow(rowNumber, rowKey, new UpsertProductRequest(), null);
            row.parseErrors.add(new ApiErrorDetail("rowType", "MISSING_MAIN_ROW",
                    "Nhóm '" + rowKey + "' không có dòng Sản phẩm chính."));
            row.parseErrors.addAll(groupErrors);
            return row;
        }

        List<ApiErrorDetail> warnings = new ArrayList<>();
        UpsertProductRequest request = buildProductRequestFromCsvMainRow(main, variantRecords, warnings);
        PublishStatus fileStatus = parsePublishStatusOrNull(col(main, 10), warnings);

        ParsedRow row = new ParsedRow(rowNumber, rowKey, request, fileStatus);
        row.parseErrors.addAll(groupErrors);
        row.parseWarnings.addAll(warnings);
        return row;
    }

    private UpsertProductRequest buildProductRequestFromCsvMainRow(
            CSVRecord main, List<CSVRecord> variantRecords, List<ApiErrorDetail> warnings) {
        UpsertProductRequest request = new UpsertProductRequest();
        boolean hasVariants = !variantRecords.isEmpty();

        String modelSku = col(main, 2);
        String sellingSku = col(main, 3);
        String resolvedSku = hasVariants ? modelSku : (sellingSku != null ? sellingSku : modelSku);
        if (resolvedSku != null) {
            request.setSku(resolvedSku);
        }

        request.setName(col(main, 4));
        String slug = col(main, 6);
        if (slug != null) {
            request.setSlug(slug);
        }
        request.setCategoryId(col(main, 7));
        String brandSlug = col(main, 8);
        if (brandSlug != null) {
            request.setBrandId(brandSlug);
        }
        String gender = col(main, 9);
        if (gender != null) {
            request.setGender(gender);
        }

        applyDecimal(col(main, 17), request::setRetailPrice, warnings, "retailPrice");
        applyDecimal(col(main, 18), request::setSalePrice, warnings, "salePrice");

        if (hasVariants) {
            String forceRaw = col(main, 20);
            if (forceRaw != null) {
                request.setForceOutOfStock(Boolean.TRUE.equals(parseYesNo(forceRaw)));
            }
        } else {
            String stockRaw = col(main, 19);
            String forceRaw = col(main, 20);
            if (stockRaw != null || forceRaw != null) {
                Boolean inStock = parseStockToken(stockRaw);
                Boolean forceHide = parseYesNo(forceRaw);
                request.setForceOutOfStock(Boolean.TRUE.equals(forceHide) || Boolean.FALSE.equals(inStock));
            }
        }

        applyMainImage(request, col(main, 21), col(main, 22), warnings);
        List<GalleryImageRequest> gallery = buildGalleryList(splitPipeList(col(main, 23)), warnings, "gallery");
        if (gallery != null) {
            request.setGallery(gallery);
        }

        String shortDescVi = col(main, 27);
        if (shortDescVi != null) request.setShortDescription(shortDescVi);
        String descVi = col(main, 29);
        if (descVi != null) request.setDescription(descVi);
        String specsHtmlVi = col(main, 31);
        if (specsHtmlVi != null) request.setSpecificationsHtml(specsHtmlVi);
        String sizeGuideVi = col(main, 33);
        if (sizeGuideVi != null) request.setSizeGuide(sizeGuideVi);

        applySeoFromCsv(request, main, warnings);
        applyTranslationsFromCsv(request, main);

        if (hasVariants) {
            List<VariantRequest> variants = new ArrayList<>();
            for (CSVRecord vRec : variantRecords) {
                variants.add(buildVariantRequestFromCsvRow(vRec, warnings));
            }
            request.setVariants(variants);
        }

        return request;
    }

    private VariantRequest buildVariantRequestFromCsvRow(CSVRecord rec, List<ApiErrorDetail> warnings) {
        VariantRequest variant = new VariantRequest();
        variant.setSku(col(rec, 3));
        applyDecimal(col(rec, 17), variant::setRetailPrice, warnings, "variants.retailPrice");
        applyDecimal(col(rec, 18), variant::setSalePrice, warnings, "variants.salePrice");

        String stockRaw = col(rec, 19);
        Boolean available = parseStockToken(stockRaw);
        if (available == null) {
            warnings.add(new ApiErrorDetail("variants.isAvailable", "DEFAULTED",
                    (stockRaw == null
                            ? "Biến thể SKU '" + col(rec, 3) + "' chưa ghi tình trạng kho"
                            : "Giá trị tình trạng kho '" + stockRaw + "' không nhận dạng được")
                            + " — mặc định Còn hàng."));
            available = Boolean.TRUE;
        }
        variant.setIsAvailable(available);

        String imageUrl = col(rec, 24);
        if (imageUrl != null) {
            if (isWhitelistedMediaUrl(imageUrl)) {
                variant.setImageUrl(imageUrl);
                variant.setImageAlt(col(rec, 25));
            } else {
                warnings.add(new ApiErrorDetail("variants.imageUrl", "IMAGE_DROPPED",
                        "Ảnh biến thể từ nguồn ngoài bị bỏ qua: " + imageUrl));
            }
        }
        List<GalleryImageRequest> gallery = buildGalleryList(splitPipeList(col(rec, 26)), warnings, "variants.gallery");
        if (gallery != null) {
            variant.setGallery(gallery);
        }
        variant.setOptions(parseVariantOptions(rec));
        return variant;
    }

    private void applyMainImage(UpsertProductRequest request, String url, String alt, List<ApiErrorDetail> warnings) {
        if (url == null) {
            return;
        }
        if (isWhitelistedMediaUrl(url)) {
            request.setImage(ImageAssetRequest.builder().url(url).alt(alt).build());
        } else {
            warnings.add(new ApiErrorDetail("image.url", "IMAGE_DROPPED",
                    "Ảnh đại diện từ nguồn ngoài bị bỏ qua (chỉ chấp nhận ảnh đã có trong kho MinIO): " + url));
        }
    }

    private List<GalleryImageRequest> buildGalleryList(List<String> urls, List<ApiErrorDetail> warnings, String field) {
        if (urls.isEmpty()) {
            return null;
        }
        List<GalleryImageRequest> gallery = new ArrayList<>();
        for (String url : urls) {
            if (isWhitelistedMediaUrl(url)) {
                gallery.add(GalleryImageRequest.builder().url(url).build());
            } else {
                warnings.add(new ApiErrorDetail(field, "IMAGE_DROPPED", "Ảnh thư viện từ nguồn ngoài bị bỏ qua: " + url));
            }
        }
        return gallery.isEmpty() ? null : gallery;
    }

    private void applySeoFromCsv(UpsertProductRequest request, CSVRecord main, List<ApiErrorDetail> warnings) {
        String title = col(main, 35);
        String desc = col(main, 37);
        String canonical = col(main, 39);
        String ogImageUrl = col(main, 40);
        boolean hasOgImage = ogImageUrl != null && isWhitelistedMediaUrl(ogImageUrl);
        if (ogImageUrl != null && !hasOgImage) {
            warnings.add(new ApiErrorDetail("seo.ogImage.url", "IMAGE_DROPPED",
                    "Ảnh chia sẻ mạng xã hội từ nguồn ngoài bị bỏ qua."));
        }
        if (title == null && desc == null && canonical == null && !hasOgImage) {
            return;
        }
        SeoMetaRequest.SeoMetaRequestBuilder builder = SeoMetaRequest.builder()
                .title(title).description(desc).canonicalUrl(canonical);
        if (hasOgImage) {
            builder.ogImage(ImageAssetRequest.builder().url(ogImageUrl).build());
        }
        request.setSeo(builder.build());
    }

    private void applyTranslationsFromCsv(UpsertProductRequest request, CSVRecord main) {
        ProductTranslationRequest.ProductContentRequest en = ProductTranslationRequest.ProductContentRequest.builder()
                .name(col(main, 5))
                .shortDescription(col(main, 28))
                .description(col(main, 30))
                .specificationsHtml(col(main, 32))
                .sizeGuide(col(main, 34))
                .seoTitle(col(main, 36))
                .seoDescription(col(main, 38))
                .build();
        request.setTranslations(new ProductTranslationRequest(en));
    }

    private void applyDecimal(String raw, Consumer<BigDecimal> setter, List<ApiErrorDetail> warnings, String field) {
        if (raw == null) {
            return;
        }
        try {
            setter.accept(new BigDecimal(raw.replace(",", "").trim()));
        } catch (NumberFormatException e) {
            warnings.add(new ApiErrorDetail(field, "INVALID_VALUE", "Giá trị '" + raw + "' ở cột " + field + " không đọc được, bỏ qua."));
        }
    }

    private Boolean parseStockToken(String raw) {
        String norm = ProductFieldApplier.normalizeVariantToken(raw);
        if ("con hang".equals(norm)) return Boolean.TRUE;
        if ("het hang".equals(norm)) return Boolean.FALSE;
        return null;
    }

    private Boolean parseYesNo(String raw) {
        String norm = ProductFieldApplier.normalizeVariantToken(raw);
        if ("co".equals(norm)) return Boolean.TRUE;
        if ("khong".equals(norm)) return Boolean.FALSE;
        return null;
    }

    private PublishStatus parsePublishStatusOrNull(String raw, List<ApiErrorDetail> warnings) {
        if (raw == null) {
            return null;
        }
        String norm = ProductFieldApplier.normalizeVariantToken(raw);
        return switch (norm) {
            case "nhap" -> PublishStatus.DRAFT;
            case "da xuat ban" -> PublishStatus.PUBLISHED;
            case "an" -> PublishStatus.HIDDEN;
            case "thung rac" -> PublishStatus.TRASH;
            default -> {
                warnings.add(new ApiErrorDetail("publishStatus", "IGNORED",
                        "Trạng thái đăng '" + raw + "' không nhận dạng được — giữ nguyên trạng thái hiện tại."));
                yield null;
            }
        };
    }

    private List<VariantOptionRequest> parseVariantOptions(CSVRecord rec) {
        List<VariantOptionRequest> options = new ArrayList<>();
        int[][] pairs = {{11, 12}, {13, 14}, {15, 16}};
        for (int[] pair : pairs) {
            String name = col(rec, pair[0]);
            String value = col(rec, pair[1]);
            if (name != null && value != null) {
                options.add(VariantOptionRequest.builder().optionName(name).optionValue(value).build());
            }
        }
        return options.isEmpty() ? null : options;
    }

    private List<String> splitPipeList(String raw) {
        if (raw == null) {
            return List.of();
        }
        return Arrays.stream(raw.split("\\|")).map(String::trim).filter(s -> !s.isEmpty()).toList();
    }

    private boolean isWhitelistedMediaUrl(String url) {
        List<ApiErrorDetail> throwaway = new ArrayList<>();
        AdminMutationValidators.validateWhitelistedMediaUrl(url, "url", mediaUrlProperties.getPublicBaseUrl(), throwaway);
        return throwaway.isEmpty();
    }

    private static String col(CSVRecord rec, int index) {
        if (index >= rec.size()) {
            return null;
        }
        return AdminMutationValidators.trimToNull(rec.get(index));
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

    // ── Round-trip export (full template shape — separate from the simple Reports CSV export) ─

    @Transactional(readOnly = true)
    public byte[] exportCurrentCatalogAsTemplateCsv() {
        requireJpaPersistenceEnabled();
        List<ProductEntity> products = productJpaRepository.findAll();
        StringWriter sw = new StringWriter();
        CSVFormat format = CSVFormat.DEFAULT.builder().setHeader(EXPORT_HEADERS).build();
        try (CSVPrinter printer = new CSVPrinter(sw, format)) {
            for (ProductEntity p : products) {
                printProductRows(printer, p);
            }
        } catch (IOException e) {
            throw new RuntimeException("Failed to generate product import template export.", e);
        }
        return CsvExportUtil.withBom(sw.toString().getBytes(StandardCharsets.UTF_8));
    }

    private void printProductRows(CSVPrinter printer, ProductEntity p) throws IOException {
        List<ProductVariantEntity> variants = p.getVariants();
        boolean hasVariants = variants != null && !variants.isEmpty();
        String[] row = new String[41];
        row[0] = "SẢN PHẨM CHÍNH";
        row[1] = p.getId();
        row[2] = nvl(p.getSku());
        row[3] = hasVariants ? "" : nvl(p.getSku());
        row[4] = nvl(p.getName());
        row[5] = nvl(p.getNameEn());
        row[6] = nvl(p.getSlug());
        row[7] = p.getCategory() != null ? nvl(p.getCategory().getSlug()) : "";
        row[8] = p.getBrand() != null ? nvl(p.getBrand().getSlug()) : "";
        row[9] = nvl(p.getGender());
        row[10] = publishStatusLabel(p.getPublishStatus());
        row[11] = ""; row[12] = ""; row[13] = ""; row[14] = ""; row[15] = ""; row[16] = "";
        row[17] = formatDecimalOrBlank(p.getRetailPrice());
        row[18] = formatDecimalOrBlank(p.getSalePrice());
        row[19] = hasVariants ? "" : (Boolean.TRUE.equals(p.getForceOutOfStock()) ? "Hết hàng" : "Còn hàng");
        row[20] = Boolean.TRUE.equals(p.getForceOutOfStock()) ? "Có" : "Không";
        row[21] = nvl(p.getImageUrl());
        row[22] = nvl(p.getImageAlt());
        row[23] = joinImageUrls(p.getGallery(), ProductGalleryImageEntity::getMediaType, ProductGalleryImageEntity::getImageUrl);
        row[24] = ""; row[25] = ""; row[26] = "";
        row[27] = nvl(p.getShortDescription());
        row[28] = nvl(p.getShortDescriptionEn());
        row[29] = nvl(p.getDescription());
        row[30] = nvl(p.getDescriptionEn());
        row[31] = nvl(p.getSpecificationsHtml());
        row[32] = nvl(p.getSpecificationsHtmlEn());
        row[33] = nvl(p.getSizeGuide());
        row[34] = nvl(p.getSizeGuideEn());
        row[35] = nvl(p.getSeoTitle());
        row[36] = nvl(p.getSeoTitleEn());
        row[37] = nvl(p.getSeoDescription());
        row[38] = nvl(p.getSeoDescriptionEn());
        row[39] = nvl(p.getSeoCanonicalUrl());
        row[40] = nvl(p.getSeoOgImageUrl());
        printer.printRecord((Object[]) escapeRow(row));

        if (hasVariants) {
            for (ProductVariantEntity v : variants) {
                printer.printRecord((Object[]) escapeRow(buildVariantExportRow(p, v)));
            }
        }
    }

    private String[] buildVariantExportRow(ProductEntity p, ProductVariantEntity v) {
        List<ProductVariantOptionEntity> options = v.getOptions();
        String[] row = new String[41];
        row[0] = "BIẾN THỂ";
        row[1] = p.getId();
        row[2] = "";
        row[3] = nvl(v.getSku());
        row[4] = ""; row[5] = ""; row[6] = ""; row[7] = ""; row[8] = ""; row[9] = ""; row[10] = "";
        for (int i = 0; i < 3; i++) {
            ProductVariantOptionEntity opt = (options != null && i < options.size()) ? options.get(i) : null;
            row[11 + i * 2] = opt != null ? nvl(opt.getOptionName()) : "";
            row[12 + i * 2] = opt != null ? nvl(opt.getOptionValue()) : "";
        }
        row[17] = formatDecimalOrBlank(v.getRetailPrice());
        row[18] = formatDecimalOrBlank(v.getSalePrice());
        row[19] = v.isAvailable() ? "Còn hàng" : "Hết hàng";
        row[20] = "";
        row[21] = ""; row[22] = ""; row[23] = "";
        row[24] = nvl(v.getImageUrl());
        row[25] = nvl(v.getImageAlt());
        row[26] = joinImageUrls(v.getGallery(), ProductVariantGalleryImageEntity::getMediaType, ProductVariantGalleryImageEntity::getImageUrl);
        for (int i = 27; i < 41; i++) {
            row[i] = "";
        }
        return row;
    }

    private static String[] escapeRow(String[] row) {
        String[] out = new String[row.length];
        for (int i = 0; i < row.length; i++) {
            out[i] = CsvExportUtil.escape(row[i]);
        }
        return out;
    }

    private static String nvl(String s) {
        return s == null ? "" : s;
    }

    private static String formatDecimalOrBlank(BigDecimal value) {
        return value != null ? value.toPlainString() : "";
    }

    private static String publishStatusLabel(PublishStatus status) {
        if (status == null) {
            return "";
        }
        return switch (status) {
            case DRAFT -> "Nháp";
            case PUBLISHED -> "Đã xuất bản";
            case HIDDEN -> "Ẩn";
            case TRASH -> "Thùng rác";
            default -> "Nháp";
        };
    }

    private static <T> String joinImageUrls(List<T> items, java.util.function.Function<T, String> mediaType, java.util.function.Function<T, String> imageUrl) {
        if (items == null || items.isEmpty()) {
            return "";
        }
        return items.stream()
                .filter(item -> !"video".equalsIgnoreCase(mediaType.apply(item)))
                .map(imageUrl)
                .filter(url -> url != null)
                .reduce((a, b) -> a + "|" + b)
                .orElse("");
    }
}
