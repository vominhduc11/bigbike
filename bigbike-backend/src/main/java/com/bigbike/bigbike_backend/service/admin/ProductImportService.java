package com.bigbike.bigbike_backend.service.admin;

import com.bigbike.bigbike_backend.api.admin.dto.CommitmentRequest;
import com.bigbike.bigbike_backend.api.admin.dto.FaqRequest;
import com.bigbike.bigbike_backend.api.admin.dto.GalleryImageRequest;
import com.bigbike.bigbike_backend.api.admin.dto.HighlightRequest;
import com.bigbike.bigbike_backend.api.admin.dto.HighlightsRequest;
import com.bigbike.bigbike_backend.api.admin.dto.ImageAssetRequest;
import com.bigbike.bigbike_backend.api.admin.dto.ImportReportResponse;
import com.bigbike.bigbike_backend.api.admin.dto.ImportRowResult;
import com.bigbike.bigbike_backend.api.admin.dto.ProductImportRow;
import com.bigbike.bigbike_backend.api.admin.dto.ProductTranslationRequest;
import com.bigbike.bigbike_backend.api.admin.dto.SeoMetaRequest;
import com.bigbike.bigbike_backend.api.admin.dto.UpsertProductRequest;
import com.bigbike.bigbike_backend.api.admin.dto.VariantOptionRequest;
import com.bigbike.bigbike_backend.api.admin.dto.VariantRequest;
import com.bigbike.bigbike_backend.api.admin.dto.VideoRequest;
import com.bigbike.bigbike_backend.api.common.ApiErrorDetail;
import com.bigbike.bigbike_backend.api.error.ApiException;
import com.bigbike.bigbike_backend.api.error.MutationNotImplementedException;
import com.bigbike.bigbike_backend.api.error.NotFoundException;
import com.bigbike.bigbike_backend.api.error.ValidationException;
import com.bigbike.bigbike_backend.domain.catalog.DescriptionBlock;
import com.bigbike.bigbike_backend.domain.catalog.GalleryMedia;
import com.bigbike.bigbike_backend.domain.catalog.ImageAsset;
import com.bigbike.bigbike_backend.domain.catalog.Product;
import com.bigbike.bigbike_backend.domain.catalog.ProductHighlight;
import com.bigbike.bigbike_backend.domain.catalog.ProductHighlights;
import com.bigbike.bigbike_backend.domain.catalog.PublishStatus;
import com.bigbike.bigbike_backend.domain.catalog.SizeGuideSection;
import com.bigbike.bigbike_backend.domain.catalog.SuitabilitySection;
import com.bigbike.bigbike_backend.domain.catalog.VideoAsset;
import com.bigbike.bigbike_backend.migration.wordpress.normalizer.ProductSlugGenerator;
import com.bigbike.bigbike_backend.persistence.entity.catalog.BrandEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.CategoryEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductVariantEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductVariantGalleryImageEntity;
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
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

/**
 * Bulk product import and single-product JSON export. Reuses the real {@link AdminCatalogMutationService}
 * create/update path for commits — this class parses the JSON file as {@link ProductImportRow}
 * (each bilingual column nested as one VI/EN object), converts every row via {@link
 * ProductImportRowMapper} into the same {@link UpsertProductRequest} shape the single-product admin
 * API already accepts, resolves human-readable references (category/brand slug, SKU-or-slug upsert
 * matching, variant SKU-based identity), then either inspects validation errors without persisting
 * ({@link #validateImport}) or calls the real create/update per row ({@link #commitImport}).
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

    // Serializes the single-product round-trip export. NON_NULL keeps files lean; the custom introspector drops
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
    private final ProductMutationService productMutationService;
    private final Validator validator;

    public ProductImportService(
            ObjectProvider<ProductJpaRepository> productJpaRepositoryProvider,
            ObjectProvider<ProductVariantJpaRepository> productVariantJpaRepositoryProvider,
            ObjectProvider<CategoryJpaRepository> categoryJpaRepositoryProvider,
            ObjectProvider<BrandJpaRepository> brandJpaRepositoryProvider,
            CatalogRequestValidator catalogRequestValidator,
            ProductMutationService productMutationService,
            Validator validator
    ) {
        this.productJpaRepository = productJpaRepositoryProvider.getIfAvailable();
        this.productVariantJpaRepository = productVariantJpaRepositoryProvider.getIfAvailable();
        this.categoryJpaRepository = categoryJpaRepositoryProvider.getIfAvailable();
        this.brandJpaRepository = brandJpaRepositoryProvider.getIfAvailable();
        this.catalogRequestValidator = catalogRequestValidator;
        this.productMutationService = productMutationService;
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

        discardExportOnlyImportFields(request);
        runBeanValidation(request, errors);
        checkRequiredSku(request, errors);
        checkImportDescriptionBlocks(request, errors);
        stripContentMedia(request);
        resolveCategoryAndBrand(request, errors);

        ProductEntity existing = resolveExistingProduct(request, errors);
        boolean ambiguous = errors.stream().anyMatch(e -> "AMBIGUOUS".equals(e.code()));
        boolean isCreate = existing == null && !ambiguous;

        resolveSlug(request, isCreate, batchSlugsLower, errors);
        applyPublishStatusRule(request);

        if (!isCreate && existing != null) {
            backfillTranslationsFromExisting(request, existing);
            backfillSeoFromExisting(request, existing);
        }

        resolveVariantIdentities(existing, request.getVariants(), errors);

        if (!isCreate && existing != null) {
            preserveExistingMedia(request);
        }

        checkBatchVariantSkuDuplicates(request.getVariants(), batchSkusLower, errors);

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
                    ? productMutationService.createProduct(request, adminId)
                    : productMutationService.updateProduct(existing.getId(), request, adminId);
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

    /**
     * `sku` is documented as mandatory on every import row (product-template/HUONG-DAN.md rule 1) —
     * it is the stable key {@link #resolveExistingProduct} uses to match a row back to its product
     * across re-imports. {@code UpsertProductRequest.sku} itself has no {@code @NotBlank} because the
     * same DTO backs the single-product admin edit form, where a product may legitimately not have a
     * SKU yet — so the requirement is enforced here, specific to the bulk-import flow, instead.
     */
    private void checkRequiredSku(UpsertProductRequest request, List<ApiErrorDetail> errors) {
        if (AdminMutationValidators.trimToNull(request.getSku()) == null) {
            errors.add(new ApiErrorDetail("sku", "REQUIRED", "Thiếu SKU sản phẩm."));
        }
    }

    private void discardExportOnlyImportFields(UpsertProductRequest request) {
        request.setPublishStatus(null);
        request.setImage(null);
        request.setImagePresent(false);
        request.setGallery(null);
        request.setVideos(null);
        request.setRelatedProductIds(null);
        request.setAccessoryProductIds(null);

        List<VariantRequest> variants = request.getVariants();
        if (variants == null) {
            return;
        }
        for (VariantRequest variant : variants) {
            variant.setId(null);
            variant.setImageUrl(null);
            variant.setImageAlt(null);
            variant.setImageWidth(null);
            variant.setImageHeight(null);
            variant.setImageMimeType(null);
            variant.setGallery(null);
        }
    }

    private void checkImportDescriptionBlocks(UpsertProductRequest request, List<ApiErrorDetail> errors) {
        List<DescriptionBlock> blocks = request.getDescriptionBlocks();
        if (blocks == null || blocks.isEmpty()) {
            return;
        }
        for (int i = 0; i < blocks.size(); i++) {
            DescriptionBlock block = blocks.get(i);
            if (block instanceof DescriptionBlock.FeatureBlock feature) {
                String side = AdminMutationValidators.trimToNull(feature.getSide());
                if (!"left".equals(side) && !"right".equals(side)) {
                    errors.add(new ApiErrorDetail("descriptionBlocks[" + i + "].side", "INVALID_VALUE",
                            "Khối ảnh + chữ phải chọn side là 'left' hoặc 'right'."));
                }
                continue;
            }
            errors.add(new ApiErrorDetail("descriptionBlocks[" + i + "].type", "INVALID_VALUE",
                    "Mô tả chi tiết sản phẩm trong file nhập chỉ nhận khối feature (ảnh + chữ)."));
        }
    }

    /**
     * Owner decision 2026-07-19 (revised same day): bulk import never keeps any image embedded in a
     * shop owner's content (descriptionBlocks/suitabilitySection/sizeGuideSection) — regardless of
     * whether the URL already points at the shop's own MinIO media store. This matches the same
     * always-blank-on-import treatment product/variant image/gallery/video already get
     * (PRODUCT_RULE_009, {@link #discardExportOnlyImportFields}). An earlier version of this method
     * only stripped URLs that failed the MinIO whitelist and reported a per-row WARNING; now that
     * every content image is unconditionally cleared the outcome is fully predictable, so — like
     * those other already-cleared media fields — it stays silent, no warning raised. An
     * {@code ImageBlock}'s only purpose is its {@code url}, so instead of dropping the whole block
     * (the old behavior), the block is kept with its url cleared: the same "no image yet, pick one"
     * empty state {@code ImageBlockEditor} already renders for a brand-new Image block in Admin. A
     * {@code FeatureBlock}'s image is optional, so only its url is cleared, its text stays. Any
     * inline {@code <img>} pasted into a paragraph/feature's HTML or a suitability/size-guide
     * section's HTML is stripped out of the markup, leaving the surrounding text untouched.
     */
    private void stripContentMedia(UpsertProductRequest request) {
        List<DescriptionBlock> blocks = request.getDescriptionBlocks();
        if (blocks != null && !blocks.isEmpty()) {
            for (DescriptionBlock block : blocks) {
                if (block instanceof DescriptionBlock.ImageBlock imageBlock) {
                    imageBlock.setUrl(null);
                } else if (block instanceof DescriptionBlock.FeatureBlock featureBlock) {
                    featureBlock.setUrl(null);
                }
                stripBlockInlineImages(block);
            }
        }

        SuitabilitySection suitability = request.getSuitabilitySection();
        if (suitability != null) {
            suitability.setHtml(stripImgTags(suitability.getHtml()));
            suitability.setHtmlEn(stripImgTags(suitability.getHtmlEn()));
        }
        SizeGuideSection sizeGuide = request.getSizeGuideSection();
        if (sizeGuide != null) {
            sizeGuide.setHtml(stripImgTags(sizeGuide.getHtml()));
            sizeGuide.setHtmlEn(stripImgTags(sizeGuide.getHtmlEn()));
        }

        HighlightsRequest highlights = request.getHighlights();
        if (highlights != null) {
            stripHighlightInlineImages(highlights.getPositiveNotes());
            stripHighlightInlineImages(highlights.getNegativeNotes());
        }
    }

    static void stripHighlightInlineImages(List<HighlightRequest> highlights) {
        if (highlights == null) {
            return;
        }
        for (HighlightRequest highlight : highlights) {
            highlight.setContent(stripImgTags(highlight.getContent()));
            highlight.setContentEn(stripImgTags(highlight.getContentEn()));
        }
    }

    private void stripBlockInlineImages(DescriptionBlock block) {
        if (block instanceof DescriptionBlock.ParagraphBlock paragraph) {
            paragraph.setHtml(stripImgTags(paragraph.getHtml()));
            paragraph.setHtmlEn(stripImgTags(paragraph.getHtmlEn()));
        } else if (block instanceof DescriptionBlock.FeatureBlock feature) {
            feature.setHtml(stripImgTags(feature.getHtml()));
            feature.setHtmlEn(stripImgTags(feature.getHtmlEn()));
        }
    }

    /** Removes every {@code <img>} tag unconditionally, leaving the rest of the HTML untouched. */
    private static String stripImgTags(String html) {
        String normalized = AdminMutationValidators.trimToNull(html);
        if (normalized == null) {
            return html;
        }
        Document doc = Jsoup.parseBodyFragment(normalized);
        if (doc.select("img").isEmpty()) {
            return html;
        }
        doc.select("img").remove();
        return doc.body().html();
    }

    private void resolveCategoryAndBrand(UpsertProductRequest request, List<ApiErrorDetail> errors) {
        List<String> rawCategories = request.isCategoryIdsPresent()
                ? request.getCategoryIds()
                : (request.isCategoryIdPresent() ? java.util.Collections.singletonList(request.getCategoryId()) : List.of());
        if (rawCategories == null || rawCategories.isEmpty()) {
            errors.add(new ApiErrorDetail("categorySlugs", "REQUIRED", "Thiếu danh mục."));
        } else {
            LinkedHashSet<String> resolvedIds = new LinkedHashSet<>();
            for (int index = 0; index < rawCategories.size(); index++) {
                String raw = AdminMutationValidators.trimToNull(rawCategories.get(index));
                if (raw == null) {
                    errors.add(new ApiErrorDetail("categorySlugs[" + index + "]", "REQUIRED", "Thiếu danh mục."));
                    continue;
                }
                CategoryEntity category = categoryJpaRepository.findById(raw)
                        .or(() -> categoryJpaRepository.findBySlug(raw))
                        .orElse(null);
                if (category == null) {
                    errors.add(new ApiErrorDetail("categorySlugs[" + index + "]", "NOT_FOUND",
                            "Danh mục '" + raw + "' không tồn tại — kiểm tra lại slug hoặc id."));
                } else if (category.isDeleted() || !category.isVisible()) {
                    errors.add(new ApiErrorDetail("categorySlugs[" + index + "]", "INVALID_STATE",
                            "Danh mục phải đang hiển thị và không nằm trong Thùng rác."));
                } else {
                    resolvedIds.add(category.getId());
                }
            }
            if (!resolvedIds.isEmpty()) {
                request.useResolvedCategoryIds(new ArrayList<>(resolvedIds));
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
     * Bulk JSON import is a draft-editing workflow. Every row is saved as DRAFT, for both new and
     * existing products, regardless of the file's publishStatus or the entity's prior status.
     * Publishing remains a manual Admin action so the publish-readiness gate owns image/content
     * completeness checks.
     */
    private void applyPublishStatusRule(UpsertProductRequest request) {
        request.setPublishStatus(PublishStatus.DRAFT);
    }

    /**
     * Matches each file variant row back to its existing DB variant by SKU (never by relying on
     * the file supplying the right opaque id) BEFORE {@code applyVariants} runs. Without this, an
     * existing variant that the file doesn't tag with the correct id looks "new" to
     * {@code applyVariants}'s full-replace-by-id logic — it gets a fresh id, and the old row is
     * orphan-removed, cascade-deleting any dormant stock-movement history.
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

    /**
     * translations.en.name is only required when the row touches the VI name (create, or an update
     * that sends `name`) — see CatalogRequestValidator. A row that sends a partial `translations.en`
     * block for an unrelated reason (e.g. just fixing seoTitle) must not have that partial block
     * silently wipe every other existing EN field — including `name` itself — back to blank, since
     * {@code applyTranslations} is a full replace of every EN column at once.
     */
    private void backfillTranslationsFromExisting(UpsertProductRequest request, ProductEntity existing) {
        ProductTranslationRequest translations = request.getTranslations();
        if (translations == null || translations.getEn() == null) {
            return;
        }
        ProductTranslationRequest.ProductContentRequest en = translations.getEn();
        if (en.getName() == null) en.setName(existing.getNameEn());
        if (en.getShortDescription() == null) en.setShortDescription(existing.getShortDescriptionEn());
        if (en.getDescription() == null) en.setDescription(existing.getDescriptionEn());
        if (en.getSizeGuide() == null) en.setSizeGuide(existing.getSizeGuideEn());
        if (en.getSuitabilityAdvisory() == null) en.setSuitabilityAdvisory(existing.getSuitabilityAdvisoryEn());
        if (en.getSpecifications() == null) en.setSpecifications(existing.getSpecificationsEn());
        if (en.getSpecStats() == null) en.setSpecStats(existing.getSpecStatsEn());
        if (en.getTrustBadges() == null) en.setTrustBadges(existing.getTrustBadgesEn());
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

    /**
     * PRODUCT_RULE_009: bulk import is draft data entry and never writes media from the file.
     * Product-level main image/gallery/videos are cleared by {@link #discardExportOnlyImportFields}.
     * For matched existing variants, {@code applyVariants} would otherwise overwrite media with
     * nulls, so their stored cover image + gallery are copied back onto the request row before save.
     * New variants keep null media; variant images are managed directly in Admin after import.
     *
     * <p>Product-level: {@code image} uses the same present-flag semantics {@code applyProductPatch}
     * checks ({@code create || isImagePresent()}), so forcing it back to "absent" is enough to
     * leave the column untouched. {@code gallery}/{@code videos} already treat {@code null} as
     * "untouched" on update (only an explicit {@code []} clears them), so nulling them out here has
     * the same effect.
     *
     * <p>Variant-level: {@code applyVariants} has no such presence flag — the cover image/gallery
     * it writes always comes straight from the request. So existing variants' stored media is
     * fetched fresh (gallery is {@code LAZY} and {@link #commitImport} is not
     * {@code @Transactional} — see {@link ProductVariantJpaRepository#findByIdsWithGallery}) and
     * copied onto the matching request row before {@code applyVariants} runs.
     */
    private void preserveExistingMedia(UpsertProductRequest request) {
        request.setImage(null);
        request.setImagePresent(false);
        request.setGallery(null);
        request.setVideos(null);

        List<VariantRequest> variants = request.getVariants();
        if (variants == null || variants.isEmpty()) {
            return;
        }
        List<String> matchedIds = variants.stream()
                .map(v -> AdminMutationValidators.trimToNull(v.getId()))
                .filter(id -> id != null)
                .toList();
        if (matchedIds.isEmpty()) {
            return;
        }
        Map<String, ProductVariantEntity> existingById = productVariantJpaRepository.findByIdsWithGallery(matchedIds)
                .stream().collect(Collectors.toMap(ProductVariantEntity::getId, v -> v));
        for (VariantRequest v : variants) {
            String id = AdminMutationValidators.trimToNull(v.getId());
            ProductVariantEntity match = id == null ? null : existingById.get(id);
            if (match == null) {
                continue;
            }
            v.setImageUrl(match.getImageUrl());
            v.setImageAlt(match.getImageAlt());
            v.setImageWidth(match.getImageWidth());
            v.setImageHeight(match.getImageHeight());
            v.setImageMimeType(match.getImageMimeType());
            v.setGallery(mapVariantGallery(match.getGallery()));
        }
    }

    private static List<GalleryImageRequest> mapVariantGallery(List<ProductVariantGalleryImageEntity> gallery) {
        if (gallery == null || gallery.isEmpty()) {
            return null;
        }
        return gallery.stream().map(g -> GalleryImageRequest.builder()
                .mediaType(g.getMediaType()).videoUrl(g.getVideoUrl()).videoProvider(g.getVideoProvider())
                .url(g.getImageUrl()).alt(g.getImageAlt())
                .width(g.getImageWidth()).height(g.getImageHeight()).mimeType(g.getImageMimeType())
                .sortOrder(g.getSortOrder()).build()).toList();
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
        final List<ApiErrorDetail> parseErrors = new ArrayList<>();
        final List<ApiErrorDetail> parseWarnings = new ArrayList<>();

        ParsedRow(int rowNumber, String rowKey, UpsertProductRequest request) {
            this.rowNumber = rowNumber;
            this.rowKey = rowKey;
            this.request = request;
        }
    }

    // ── JSON parsing (array of ProductImportRow; categoryId/brandId hold slugs) ─
    // Each element is immediately converted to the same UpsertProductRequest +
    // ProductTranslationRequest shape the single-product admin API accepts, via
    // ProductImportRowMapper — nothing below this point knows about the nested-bilingual shape.

    private List<ParsedRow> parseJson(MultipartFile file) {
        ProductImportRow[] array;
        try {
            array = OBJECT_MAPPER.readValue(file.getInputStream(), ProductImportRow[].class);
        } catch (IOException e) {
            throw ValidationException.fromField("file", "UNREADABLE_FILE",
                    "File JSON không đúng định dạng — cần là mảng object sản phẩm theo đúng shape ProductImportRow.");
        }
        List<ParsedRow> rows = new ArrayList<>();
        for (int i = 0; i < array.length; i++) {
            ProductImportRow source = array[i];
            UpsertProductRequest request = ProductImportRowMapper.toUpsertRequest(source);
            request.setPublishStatus(null);
            String rowIdentity = firstNonBlank(request.getSku(), request.getSlug(), "item");
            String rowKey = "row-" + (i + 1) + ":" + rowIdentity;
            ParsedRow parsed = new ParsedRow(i + 1, rowKey, request);
            if (source.getCategorySlugs() != null && source.getCategoryIds() != null) {
                parsed.parseErrors.add(new ApiErrorDetail("categorySlugs", "CONFLICT",
                        "Chỉ gửi categorySlugs hoặc categoryIds trong một dòng nhập."));
            }
            if ((source.getCategorySlugs() != null || source.getCategoryIds() != null) && source.getCategoryId() != null) {
                parsed.parseErrors.add(new ApiErrorDetail("categoryId", "CONFLICT",
                        "Không gửi categoryId cùng categorySlugs/categoryIds."));
            }
            rows.add(parsed);
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

    // ── Single-product JSON export (same ProductImportRow shape validate/commit accept) ─

    /** Same array shape (one element) so the downloaded file re-imports without edits. */
    @Transactional(readOnly = true)
    public ProductExportFile exportProductAsTemplateJson(String id) {
        requireJpaPersistenceEnabled();
        List<ProductEntity> found = productJpaRepository.findByIdsWithVariants(List.of(id));
        if (found.isEmpty()) {
            throw new NotFoundException("Product not found: " + id);
        }
        ProductEntity entity = found.get(0);
        byte[] json = writeExportJson(List.of(toExportRow(entity)));
        return new ProductExportFile("product-" + entity.getSku() + ".json", json);
    }

    /** Filename + JSON bytes for a single-product export download. */
    public record ProductExportFile(String filename, byte[] content) {}

    private static byte[] writeExportJson(List<ProductImportRow> out) {
        try {
            return EXPORT_MAPPER.writeValueAsBytes(out);
        } catch (IOException e) {
            throw new RuntimeException("Failed to generate product import JSON export.", e);
        }
    }

    /**
     * Maps a stored product back into the {@link ProductImportRow} shape the JSON import consumes,
     * so "download one product → edit → re-import" stays easy for shop operations. category and
     * brand are emitted as slugs (the import resolves them by slug), while related/accessory product
     * references are emitted as SKU. Export includes media/status/relation groups for completeness;
     * bulk import accepts those groups but discards them before validation/saving because import
     * always saves drafts and those fields are managed directly in Admin. Every bilingual column is
     * emitted as one nested VI/EN object (omitted entirely when both sides are blank — {@link
     * #EXPORT_MAPPER} is NON_NULL) instead of a separate {@code translations} block. Detailed
     * description exports only the owner-approved product block vocabulary, falling back to the
     * legacy HTML string when no supported block remains.
     */
    private ProductImportRow toExportRow(ProductEntity p) {
        ProductImportRow r = new ProductImportRow();
        r.setSku(p.getSku());
        r.setCategorySlugs(p.getCategories() == null ? List.of() : p.getCategories().stream()
                .map(CategoryEntity::getSlug)
                .toList());
        r.setBrandId(p.getBrand() != null ? p.getBrand().getSlug() : null);
        r.setGender(p.getGender());
        r.setCurrency(p.getCurrency());
        r.setRetailPrice(p.getRetailPrice());
        r.setSalePrice(p.getSalePrice());
        r.setPublishStatus(p.getPublishStatus());
        r.setAvailable(p.getAvailable());
        r.setHomepageBlock(p.getHomepageBlock());
        if (p.getHomepageOrder() != null) {
            r.setHomepageOrder(p.getHomepageOrder());
        }

        if (p.getName() != null || p.getNameEn() != null) {
            r.setName(new ProductImportRow.NameField(p.getName(), p.getNameEn()));
        }
        if (p.getSlug() != null || p.getSlugEn() != null) {
            r.setSlug(new ProductImportRow.SlugField(p.getSlug(), p.getSlugEn()));
        }
        // Owner decision 2026-07-07: these product-level bilingual columns always appear on export,
        // null-filled when the product has no content at all for them, instead of being dropped
        // entirely — same treatment as the array-element DTOs (FaqRequest, CommitmentRequest, etc.)
        // and salePrice above. Safe on reimport: ProductImportRowMapper only calls the corresponding
        // UpsertProductRequest setter per leaf VI/EN value that is non-null, so an all-null object
        // here behaves exactly like an omitted key (nothing gets touched on update).
        r.setShortDescription(new ProductImportRow.ShortDescriptionField(
                p.getShortDescription(), p.getShortDescriptionEn()));
        r.setSpecifications(new ProductImportRow.SpecificationsField(
                p.getSpecifications(), p.getSpecificationsEn()));
        r.setSpecStats(new ProductImportRow.SpecStatsField(
                p.getSpecStats(), p.getSpecStatsEn()));
        r.setTrustBadges(new ProductImportRow.TrustBadgesField(
                p.getTrustBadges(), p.getTrustBadgesEn()));
        r.setQuickAnswerSummary(new ProductImportRow.QuickAnswerSummaryField(
                p.getQuickAnswerSummary(), p.getQuickAnswerSummaryEn()));
        r.setOriginBrandCountry(new ProductImportRow.OriginBrandCountryField(
                p.getOriginBrandCountry(), p.getOriginBrandCountryEn()));
        r.setSeo(new ProductImportRow.SeoField(p.getSeoTitle(), p.getSeoTitleEn(),
                p.getSeoDescription(), p.getSeoDescriptionEn(), p.getSeoCanonicalUrl()));

        if (p.getImageUrl() != null) {
            r.setImage(ImageAssetRequest.builder()
                    .url(p.getImageUrl()).alt(p.getImageAlt())
                    .width(p.getImageWidth()).height(p.getImageHeight()).mimeType(p.getImageMimeType())
                    .build());
        }

        if (p.getDescriptionBlocks() != null && !p.getDescriptionBlocks().isEmpty()) {
            List<DescriptionBlock> blocks = exportableProductDescriptionBlocks(p.getDescriptionBlocks());
            if (!blocks.isEmpty()) {
                r.setDescriptionBlocks(blocks);
            } else if (p.getDescription() != null) {
                r.setDescription(p.getDescription());
            }
        } else if (p.getDescription() != null) {
            r.setDescription(p.getDescription());
        }
        if (p.getSuitabilitySection() != null) {
            r.setSuitabilitySection(p.getSuitabilitySection());
        }
        if (p.getSizeGuideSection() != null) {
            r.setSizeGuideSection(p.getSizeGuideSection());
        }
        if (notEmpty(p.getGallery())) {
            List<GalleryMedia> gallery = p.getGallery();
            List<GalleryImageRequest> galleryRows = new ArrayList<>();
            for (int i = 0; i < gallery.size(); i++) {
                GalleryMedia g = gallery.get(i);
                ImageAsset img = g.image();
                galleryRows.add(GalleryImageRequest.builder()
                        .mediaType(g.mediaType()).videoUrl(g.videoUrl()).videoProvider(g.videoProvider())
                        .url(img != null ? img.url() : null).alt(img != null ? img.alt() : null)
                        .width(img != null ? img.width() : null).height(img != null ? img.height() : null)
                        .mimeType(img != null ? img.mimeType() : null)
                        .sortOrder(i).build());
            }
            r.setGallery(galleryRows);
        }
        if (notEmpty(p.getVideos())) {
            List<VideoAsset> videos = p.getVideos();
            List<VideoRequest> videoRows = new ArrayList<>();
            for (int i = 0; i < videos.size(); i++) {
                VideoAsset v = videos.get(i);
                videoRows.add(VideoRequest.builder()
                        .url(v.url()).title(v.title()).provider(v.provider())
                        .description(v.description())
                        .thumbnailUrl(v.thumbnail() != null ? v.thumbnail().url() : null)
                        .sortOrder(i).build());
            }
            r.setVideos(videoRows);
        }
        if (notEmpty(p.getFaqs())) {
            r.setFaqs(p.getFaqs().stream().map(f -> FaqRequest.builder()
                    .question(f.question()).answer(f.answer())
                    .questionEn(f.questionEn()).answerEn(f.answerEn()).build()).toList());
        }
        if (notEmpty(p.getCommitments())) {
            r.setCommitments(p.getCommitments().stream().map(c -> CommitmentRequest.builder()
                    .icon(c.icon()).title(c.title()).subtitle(c.subtitle())
                    .titleEn(c.titleEn()).subtitleEn(c.subtitleEn()).build()).toList());
        }
        if (hasHighlights(p.getHighlights())) {
            r.setHighlights(HighlightsRequest.builder()
                    .positiveNotes(highlightRequests(p.getHighlights().positiveNotes()))
                    .negativeNotes(highlightRequests(p.getHighlights().negativeNotes()))
                    .build());
        }
        if (notEmpty(p.getVariants())) {
            r.setVariants(p.getVariants().stream().map(this::toVariantRequest).toList());
        }
        r.setRelatedProductIds(skusOf(p.getRelatedProducts()));
        r.setAccessoryProductIds(skusOf(p.getAccessoryProducts()));
        return r;
    }

    private static List<DescriptionBlock> exportableProductDescriptionBlocks(List<DescriptionBlock> blocks) {
        if (blocks == null || blocks.isEmpty()) {
            return List.of();
        }
        return blocks.stream()
                .filter(block -> block instanceof DescriptionBlock.ParagraphBlock
                        || block instanceof DescriptionBlock.ImageBlock
                        || block instanceof DescriptionBlock.FeatureBlock)
                .toList();
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
            vr.setGallery(mapVariantGallery(v.getGallery()));
        }
        return vr;
    }

    private static boolean hasHighlights(ProductHighlights highlights) {
        return highlights != null
                && (notEmpty(highlights.positiveNotes()) || notEmpty(highlights.negativeNotes()));
    }

    private List<HighlightRequest> highlightRequests(List<ProductHighlight> highlights) {
        if (highlights == null) {
            return null;
        }
        List<HighlightRequest> out = highlights.stream()
                .map(h -> HighlightRequest.builder()
                        .content(h.content()).contentEn(h.contentEn()).build())
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
