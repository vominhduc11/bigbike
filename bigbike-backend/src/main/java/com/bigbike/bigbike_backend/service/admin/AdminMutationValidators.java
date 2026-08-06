package com.bigbike.bigbike_backend.service.admin;

import com.bigbike.bigbike_backend.api.admin.dto.ImageAssetRequest;
import com.bigbike.bigbike_backend.api.admin.dto.SeoMetaRequest;
import com.bigbike.bigbike_backend.api.common.ApiErrorDetail;
import com.bigbike.bigbike_backend.api.error.PublishGateException;
import com.bigbike.bigbike_backend.api.error.ValidationException;
import com.bigbike.bigbike_backend.domain.catalog.PublishStatus;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductVariantEntity;
import com.bigbike.bigbike_backend.service.security.HomeVideoUrlPolicy;
import java.net.URI;
import java.net.URISyntaxException;
import java.math.BigDecimal;
import java.util.Locale;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.regex.Pattern;
import com.bigbike.bigbike_backend.domain.catalog.DescriptionBlock;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Element;

final class AdminMutationValidators {

    private static final String REQUIRED = "REQUIRED";
    private static final String UNCATEGORIZED_CATEGORY_ID = "uncategorized";
    private static final String UNCATEGORIZED_BRAND_ID = "uncategorized-brand";
    private static final Pattern SLUG_PATTERN = Pattern.compile("^[a-z0-9]+(?:-[a-z0-9]+)*$");
    private static final Pattern WINDOWS_PATH_PATTERN = Pattern.compile("^[A-Za-z]:[\\\\/].*");

    private AdminMutationValidators() {
    }

    static String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String normalized = value.trim();
        return normalized.isEmpty() ? null : normalized;
    }

    static void validateRequiredSlug(String slug, String field, List<ApiErrorDetail> errors) {
        String normalized = trimToNull(slug);
        if (normalized == null) {
            errors.add(new ApiErrorDetail(field, REQUIRED, "Slug is required."));
            return;
        }
        validateSlugFormat(normalized, field, errors);
    }

    static void validateOptionalSlug(String slug, String field, List<ApiErrorDetail> errors) {
        String normalized = trimToNull(slug);
        if (normalized == null) {
            return;
        }
        validateSlugFormat(normalized, field, errors);
    }

    static void validateRequiredText(String value, String field, String label, List<ApiErrorDetail> errors) {
        if (trimToNull(value) == null) {
            errors.add(new ApiErrorDetail(field, REQUIRED, label + " is required."));
        }
    }

    static void validateNonNegativeInteger(Integer value, String field, String label, List<ApiErrorDetail> errors) {
        if (value != null && value < 0) {
            errors.add(new ApiErrorDetail(field, "INVALID_VALUE", label + " must be greater than or equal to 0."));
        }
    }

    static void validateNonNegativeDecimal(BigDecimal value, String field, String label, List<ApiErrorDetail> errors) {
        if (value != null && value.signum() < 0) {
            errors.add(new ApiErrorDetail(field, "INVALID_VALUE", label + " must be greater than or equal to 0."));
        }
    }

    static void validateRating(BigDecimal value, String field, List<ApiErrorDetail> errors) {
        if (value != null && (value.compareTo(BigDecimal.ZERO) < 0 || value.compareTo(new BigDecimal("5")) > 0)) {
            errors.add(new ApiErrorDetail(field, "INVALID_VALUE", "Rating must be between 0 and 5."));
        }
    }

    static void validateCurrency(String currency, String field, List<ApiErrorDetail> errors) {
        String normalized = trimToNull(currency);
        if (normalized == null) {
            return;
        }
        if (!"VND".equals(normalized)) {
            errors.add(new ApiErrorDetail(field, "INVALID_VALUE", "Currency must be VND."));
        }
    }

    static void validateSalePriceRule(
            BigDecimal retailPrice,
            BigDecimal salePrice,
            String field,
            List<ApiErrorDetail> errors
    ) {
        if (salePrice == null || retailPrice == null) {
            return;
        }

        if (salePrice.compareTo(retailPrice) >= 0) {
            errors.add(new ApiErrorDetail(field, "INVALID_VALUE", "salePrice must be lower than retailPrice."));
        }
    }

    static void validateImageAsset(
            ImageAssetRequest image,
            String fieldPrefix,
            String allowedMediaBaseUrl,
            List<ApiErrorDetail> errors
    ) {
        validateImageAsset(image, fieldPrefix, allowedMediaBaseUrl, null, errors);
    }

    /**
     * {@code existingUrl} is the URL already persisted on the entity for this single-image field
     * (product.image, category.image/icon/menuIcon, brand.logo, article.coverImage). A match is
     * grandfathered and skips the MinIO whitelist check — mirrors the gallery/content-block legacy
     * tolerance (MEDIA_RULE_002/003) so editing a legacy record whose image still hotlinks the old
     * WordPress host is never blocked; only a genuinely NEW url must pass the whitelist.
     */
    static void validateImageAsset(
            ImageAssetRequest image,
            String fieldPrefix,
            String allowedMediaBaseUrl,
            String existingUrl,
            List<ApiErrorDetail> errors
    ) {
        if (image == null) {
            return;
        }

        String url = trimToNull(image.getUrl());
        if (url == null || existingUrl == null || !url.equals(trimToNull(existingUrl))) {
            validateWhitelistedMediaUrl(image.getUrl(), fieldPrefix + ".url", allowedMediaBaseUrl, errors);
        }
        validateNonNegativeInteger(image.getWidth(), fieldPrefix + ".width", "Image width", errors);
        validateNonNegativeInteger(image.getHeight(), fieldPrefix + ".height", "Image height", errors);
    }

    static void validateSeoMeta(
            SeoMetaRequest seo,
            String fieldPrefix,
            String allowedMediaBaseUrl,
            List<ApiErrorDetail> errors
    ) {
        validateSeoMeta(seo, fieldPrefix, allowedMediaBaseUrl, false, null, errors);
    }

    static void validateSeoMeta(
            SeoMetaRequest seo,
            String fieldPrefix,
            String allowedMediaBaseUrl,
            boolean isDev,
            List<ApiErrorDetail> errors
    ) {
        validateSeoMeta(seo, fieldPrefix, allowedMediaBaseUrl, isDev, null, errors);
    }

    /** {@code existingOgImageUrl} grandfathers the entity's already-persisted SEO og:image URL — same
     * rationale as {@link #validateImageAsset(ImageAssetRequest, String, String, String, List)}. */
    static void validateSeoMeta(
            SeoMetaRequest seo,
            String fieldPrefix,
            String allowedMediaBaseUrl,
            boolean isDev,
            String existingOgImageUrl,
            List<ApiErrorDetail> errors
    ) {
        if (seo == null) {
            return;
        }
        validatePublicUrl(seo.getCanonicalUrl(), fieldPrefix + ".canonicalUrl", isDev, errors);
        if (seo.getOgImage() != null) {
            String url = trimToNull(seo.getOgImage().getUrl());
            if (url == null || existingOgImageUrl == null || !url.equals(trimToNull(existingOgImageUrl))) {
                validateWhitelistedMediaUrl(seo.getOgImage().getUrl(), fieldPrefix + ".ogImage.url", allowedMediaBaseUrl, errors);
            }
        }
    }

    static void validatePublicUrl(String url, String field, List<ApiErrorDetail> errors) {
        validatePublicUrl(url, field, false, errors);
    }

    static void validatePublicUrl(String url, String field, boolean isDev, List<ApiErrorDetail> errors) {
        String normalized = trimToNull(url);
        if (normalized == null) {
            return;
        }

        String lower = normalized.toLowerCase();
        boolean invalid = !lower.startsWith("https://")
                && !lower.startsWith("http://");
        invalid = invalid || lower.startsWith("file://");
        invalid = invalid || normalized.startsWith("\\\\");
        invalid = invalid || normalized.contains("\\");
        invalid = invalid || WINDOWS_PATH_PATTERN.matcher(normalized).matches();
        invalid = invalid || normalized.startsWith("/Users/")
                || normalized.startsWith("/home/")
                || normalized.startsWith("/var/")
                || normalized.startsWith("/tmp/")
                || normalized.startsWith("/private/");

        if (invalid) {
            errors.add(new ApiErrorDetail(field, "INVALID_VALUE", "URL must be a public http(s) URL."));
            return;
        }

        if (field.endsWith("canonicalUrl")) {
            try {
                URI uri = new URI(normalized);
                String host = uri.getHost();
                if (host == null) {
                    errors.add(new ApiErrorDetail(field, "INVALID_VALUE", "Canonical URL must have a valid host."));
                    return;
                }
                // The VPS public IP (103.1.236.148) was allowed here until the 2026-08-06
                // domain cutover; everything public now runs on bigbike.vn behind nginx.
                boolean isProductionDomain = host.equalsIgnoreCase("bigbike.vn") || host.equalsIgnoreCase("www.bigbike.vn");
                boolean isDevAllowed = isDev && (host.equalsIgnoreCase("localhost") || host.equalsIgnoreCase("127.0.0.1"));
                if (!isProductionDomain && !isDevAllowed) {
                    errors.add(new ApiErrorDetail(field, "INVALID_VALUE", "Canonical URL must belong to bigbike.vn or www.bigbike.vn."));
                }
            } catch (URISyntaxException e) {
                errors.add(new ApiErrorDetail(field, "INVALID_VALUE", "Canonical URL must be a valid URL."));
            }
        }
    }

    static void validateWhitelistedMediaUrl(
            String url,
            String field,
            String allowedMediaBaseUrl,
            List<ApiErrorDetail> errors
    ) {
        String normalized = trimToNull(url);
        if (normalized == null) {
            return;
        }

        // Relative /media/... and /media-proxy/... paths are served via the internal proxy — always allowed
        if (normalized.toLowerCase().startsWith("/media/") || normalized.toLowerCase().startsWith("/media-proxy/")) {
            return;
        }

        int initialErrorCount = errors.size();
        validatePublicUrl(normalized, field, errors);
        if (errors.size() > initialErrorCount) {
            return;
        }

        String allowedBase = trimToNull(allowedMediaBaseUrl);
        if (allowedBase == null) {
            errors.add(new ApiErrorDetail(
                    field,
                    "INVALID_VALUE",
                    "Media URL whitelist is not configured."
            ));
            return;
        }

        if (!isAllowedMediaUrl(normalized, allowedBase)) {
            errors.add(new ApiErrorDetail(
                    field,
                    "INVALID_VALUE",
                    "Media URL must start with the configured MinIO public base URL."
            ));
        }
    }

    /**
     * Same acceptance rule as {@link #validateWhitelistedMediaUrl} (relative {@code /media/} or
     * {@code /media-proxy/} paths, or an absolute URL under the configured MinIO public base) but as a
     * plain predicate instead of an error-accumulating validator. Used by bulk product import
     * ({@code ProductImportService}) to silently strip a content-block image/video reference the shop
     * owner's file points at a non-MinIO host, instead of failing the whole row — see
     * {@code PRODUCT_RULE_009}. Blank input is treated as "nothing to check" (true), matching
     * {@code validateWhitelistedMediaUrl}'s no-op on a blank url.
     */
    static boolean isWhitelistedMediaUrl(String url, String allowedMediaBaseUrl) {
        String normalized = trimToNull(url);
        if (normalized == null) {
            return true;
        }
        if (normalized.toLowerCase(Locale.ROOT).startsWith("/media/")
                || normalized.toLowerCase(Locale.ROOT).startsWith("/media-proxy/")) {
            return true;
        }
        List<ApiErrorDetail> probe = new java.util.ArrayList<>();
        validatePublicUrl(normalized, "probe", probe);
        if (!probe.isEmpty()) {
            return false;
        }
        String allowedBase = trimToNull(allowedMediaBaseUrl);
        return allowedBase != null && isAllowedMediaUrl(normalized, allowedBase);
    }

    /**
     * Collects every media URL already present in a stored block list — structured
     * {@code ImageBlock}/{@code FeatureBlock}/{@code VideoBlock} urls plus inline {@code <img src>} inside raw-HTML
     * block fields (paragraph/callout/feature), VI **and** EN (V326: each block carries both
     * languages inline, so a pasted image can hide in either {@code html} or {@code htmlEn}). Used to
     * grandfather legacy image hotlinks when a product/article is edited
     * (MEDIA_RULE_002 / MEDIA_RULE_003). Video URLs may be collected for completeness but are
     * never grandfathered by write validation (MEDIA_RULE_004).
     * Since V327/V328, {@code suitability}/{@code sizeGuide} are no longer block types here — see
     * {@link #suitabilitySectionMediaUrls} / {@link #sizeGuideSectionMediaUrls} for their own scan.
     */
    static Set<String> collectBlockMediaUrls(List<DescriptionBlock> blocks) {
        Set<String> urls = new HashSet<>();
        if (blocks == null) {
            return urls;
        }
        for (DescriptionBlock block : blocks) {
            if (block instanceof DescriptionBlock.ImageBlock imageBlock) {
                String u = trimToNull(imageBlock.getUrl());
                if (u != null) {
                    urls.add(u);
                }
            } else if (block instanceof DescriptionBlock.FeatureBlock featureBlock) {
                String u = trimToNull(featureBlock.getUrl());
                if (u != null) {
                    urls.add(u);
                }
            } else if (block instanceof DescriptionBlock.VideoBlock videoBlock) {
                String u = trimToNull(videoBlock.getUrl());
                if (u != null) {
                    urls.add(u);
                }
            }
            urls.addAll(extractInlineImageSrcs(blockRawHtml(block)));
            urls.addAll(extractInlineImageSrcs(blockRawHtmlEn(block)));
        }
        return urls;
    }

    static void validateVideoBlockUrl(
            DescriptionBlock.VideoBlock block,
            String field,
            HomeVideoUrlPolicy videoUrlPolicy,
            List<ApiErrorDetail> errors
    ) {
        String url = trimToNull(block.getUrl());
        if (url == null) {
            return;
        }
        if (!videoUrlPolicy.isAllowedForProvider(block.getProvider(), url)) {
            errors.add(new ApiErrorDetail(
                    field,
                    "INVALID_VALUE",
                    "Video source must be YouTube or upload, and the URL must match its provider."
            ));
        }
    }

    /** Raw-HTML (VI) payload of the block types that carry free HTML, or {@code null} for the rest. */
    static String blockRawHtml(DescriptionBlock block) {
        if (block instanceof DescriptionBlock.ParagraphBlock b) {
            return b.getHtml();
        }
        if (block instanceof DescriptionBlock.CalloutBlock b) {
            return b.getHtml();
        }
        if (block instanceof DescriptionBlock.FeatureBlock b) {
            return b.getHtml();
        }
        return null;
    }

    /** English sibling of {@link #blockRawHtml} (V326 inline bilingual fields), or {@code null}. */
    static String blockRawHtmlEn(DescriptionBlock block) {
        if (block instanceof DescriptionBlock.ParagraphBlock b) {
            return b.getHtmlEn();
        }
        if (block instanceof DescriptionBlock.CalloutBlock b) {
            return b.getHtmlEn();
        }
        if (block instanceof DescriptionBlock.FeatureBlock b) {
            return b.getHtmlEn();
        }
        return null;
    }

    /**
     * Media URLs already present in the standalone "Phù hợp với ai" field (V327/V328) — the
     * {@code html}/{@code htmlEn} free-HTML source, used to grandfather legacy hotlinks the same
     * way {@link #collectBlockMediaUrls} does for the 4 remaining descriptionBlocks types.
     */
    static Set<String> suitabilitySectionMediaUrls(com.bigbike.bigbike_backend.domain.catalog.SuitabilitySection section) {
        Set<String> urls = new HashSet<>();
        if (section == null) return urls;
        urls.addAll(extractInlineImageSrcs(section.getHtml()));
        urls.addAll(extractInlineImageSrcs(section.getHtmlEn()));
        return urls;
    }

    /** Same as {@link #suitabilitySectionMediaUrls} but for the standalone "Bảng size" field. */
    static Set<String> sizeGuideSectionMediaUrls(com.bigbike.bigbike_backend.domain.catalog.SizeGuideSection section) {
        Set<String> urls = new HashSet<>();
        if (section == null) return urls;
        urls.addAll(extractInlineImageSrcs(section.getHtml()));
        urls.addAll(extractInlineImageSrcs(section.getHtmlEn()));
        return urls;
    }

    /** All inline {@code <img src>} values in a raw-HTML fragment (empty set when blank). */
    static Set<String> extractInlineImageSrcs(String html) {
        Set<String> srcs = new HashSet<>();
        String normalized = trimToNull(html);
        if (normalized == null) {
            return srcs;
        }
        for (Element img : Jsoup.parseBodyFragment(normalized).select("img[src]")) {
            String src = trimToNull(img.attr("src"));
            if (src != null) {
                srcs.add(src);
            }
        }
        return srcs;
    }

    /**
     * Rejects NEW external {@code <img src>} hotlinks pasted into a raw-HTML block field (§14.3):
     * each src must be an approved MinIO/internal media URL. Srcs already present in {@code existing}
     * (legacy content) and {@code data:} URIs are tolerated so editing old records is never blocked.
     */
    static void validateHtmlInlineImages(
            String html,
            String field,
            Set<String> existing,
            String allowedMediaBaseUrl,
            List<ApiErrorDetail> errors
    ) {
        String normalized = trimToNull(html);
        if (normalized == null) {
            return;
        }
        int idx = 0;
        for (Element img : Jsoup.parseBodyFragment(normalized).select("img[src]")) {
            String src = trimToNull(img.attr("src"));
            if (src != null
                    && !src.toLowerCase(Locale.ROOT).startsWith("data:")
                    && (existing == null || !existing.contains(src))) {
                validateWhitelistedMediaUrl(src, field + ".img[" + idx + "]", allowedMediaBaseUrl, errors);
            }
            idx++;
        }
    }

    static void validatePublishTransition(
            PublishStatus from,
            PublishStatus to,
            String field,
            List<ApiErrorDetail> errors
    ) {
        if (from == null || to == null || from == to) {
            return;
        }

        // HIDDEN/ARCHIVED/PENDING/PRIVATE are legacy values (WordPress import artifacts, plus the
        // former active HIDDEN state, retired 2026-07-07). None are valid target states for admin
        // API mutations.
        if (to.isLegacy()) {
            errors.add(new ApiErrorDetail(
                    field,
                    "RESERVED_PUBLISH_STATUS",
                    "Publish status " + to + " is reserved and cannot be set via the admin API. " +
                    "Use DRAFT for unpublished content."
            ));
            return;
        }

        // Active transitions: DRAFT <-> PUBLISHED (both directions), both -> TRASH, TRASH -> DRAFT.
        // Legacy source states (HIDDEN/ARCHIVED/PENDING/PRIVATE) share one consistent escape path:
        // DRAFT, or straight to TRASH like any other active state — so any remaining pre-migration
        // DB record can still be edited or soft-deleted.
        boolean allowed = switch (from) {
            case DRAFT -> to == PublishStatus.PUBLISHED || to == PublishStatus.TRASH;
            case PUBLISHED -> to == PublishStatus.DRAFT || to == PublishStatus.TRASH;
            case TRASH -> to == PublishStatus.DRAFT;
            case HIDDEN, ARCHIVED, PENDING, PRIVATE ->
                    to == PublishStatus.DRAFT || to == PublishStatus.TRASH;
        };

        if (!allowed) {
            errors.add(new ApiErrorDetail(
                    field,
                    "INVALID_STATE_TRANSITION",
                    "Invalid publish status transition from " + from + " to " + to + "."
            ));
        }
    }

    /**
     * New products start in DRAFT. Existing products retain their lifecycle state
     * while saving details; state changes belong to the dedicated publish, trash,
     * and restore endpoints.
     */
    static void validateProductSavePublishStatus(
            PublishStatus current,
            PublishStatus requested,
            boolean create,
            List<ApiErrorDetail> errors
    ) {
        if (requested == null) {
            return;
        }
        boolean invalid = create
                ? requested != PublishStatus.DRAFT
                : requested != current;
        if (!invalid) {
            return;
        }
        errors.add(new ApiErrorDetail(
                "publishStatus",
                "INVALID_STATE_TRANSITION",
                create
                        ? "New products must be saved as DRAFT. Publish through the publish endpoint."
                        : "Product status changes must use the dedicated lifecycle endpoint."
        ));
    }

    static void throwIfErrors(List<ApiErrorDetail> errors) {
        if (!errors.isEmpty()) {
            throw new ValidationException("Validation failed.", List.copyOf(errors));
        }
    }

    /**
     * PRODUCT_RULE_005 — required-field matrix, branched on has-variants and on whether
     * images are required (publish) or not (draft). Runs post-merge (after {@code
     * applyProductPatch}/{@code applyVariants}), so {@code entity} already reflects the
     * final PATCH-merged state. Called from {@code createProduct}/{@code updateProduct}
     * (requireImages = target status is PUBLISHED) and {@code updateProductPublishStatus}
     * (requireImages = true, via {@link #validatePublishReadiness}).
     */
    static void validateProductFieldsRequired(ProductEntity entity, boolean requireImages, List<ApiErrorDetail> errors) {
        if (trimToNull(entity.getName()) == null) {
            errors.add(new ApiErrorDetail("name", REQUIRED, "Product name is required."));
        }
        if (trimToNull(entity.getSlug()) == null) {
            errors.add(new ApiErrorDetail("slug", REQUIRED, "Slug is required."));
        }
        if (entity.getCategories() == null || entity.getCategories().isEmpty()) {
            errors.add(new ApiErrorDetail("categoryIds", REQUIRED, "At least one category is required."));
        }
        if (entity.getBrand() == null) {
            errors.add(new ApiErrorDetail("brandId", REQUIRED, "Brand is required."));
        }
        if (trimToNull(entity.getGender()) == null) {
            errors.add(new ApiErrorDetail("gender", REQUIRED, "Gender is required."));
        }

        if (trimToNull(entity.getSku()) == null) {
            errors.add(new ApiErrorDetail("sku", REQUIRED, "SKU is required."));
        }

        boolean hasVariants = entity.getVariants() != null && !entity.getVariants().isEmpty();

        if (!hasVariants) {
            if (entity.getRetailPrice() == null || entity.getRetailPrice().compareTo(BigDecimal.ZERO) <= 0) {
                errors.add(new ApiErrorDetail(
                        "retailPrice", REQUIRED, "Retail price must be greater than 0 when the product has no variants."));
            }
        }

        if (requireImages && trimToNull(entity.getImageUrl()) == null && trimToNull(entity.getImageId()) == null) {
            errors.add(new ApiErrorDetail("imageUrl", REQUIRED, "A main product image is required to publish."));
        }

        if (hasVariants) {
            // Owner decision 2026-07-07 (PRODUCT_RULE_013): the product's own retailPrice, when
            // valid, is the shared/default price a variant without its own retailPrice falls back to
            // (VariantPricing.regularPrice/salePrice) — so per-variant retailPrice is only required
            // when the product has no such shared price to fall back to.
            boolean hasSharedPrice = entity.getRetailPrice() != null && entity.getRetailPrice().compareTo(BigDecimal.ZERO) > 0;
            validateVariantFieldsRequired(entity.getVariants(), requireImages, hasSharedPrice, errors);
        }
    }

    private static void validateVariantFieldsRequired(
            List<ProductVariantEntity> variants, boolean requireImages, boolean hasSharedPrice,
            List<ApiErrorDetail> errors) {
        for (int i = 0; i < variants.size(); i++) {
            ProductVariantEntity variant = variants.get(i);
            String prefix = "variants[" + i + "].";
            if (trimToNull(variant.getSku()) == null) {
                errors.add(new ApiErrorDetail(prefix + "sku", REQUIRED, "Variant SKU is required."));
            }
            boolean hasOwnRetailPrice = variant.getRetailPrice() != null && variant.getRetailPrice().compareTo(BigDecimal.ZERO) > 0;
            if (!hasOwnRetailPrice && !hasSharedPrice) {
                errors.add(new ApiErrorDetail(prefix + "retailPrice", REQUIRED, "Variant retail price must be greater than 0."));
            }
            // A variant with no retailPrice of its own is not "self-priced" (VariantPricing.
            // hasOwnPrice) — it always falls back to the product's whole price pair, so a salePrice
            // submitted alone would be silently ignored rather than applied.
            if (!hasOwnRetailPrice && variant.getSalePrice() != null) {
                errors.add(new ApiErrorDetail(prefix + "salePrice", "INVALID_VALUE",
                        "salePrice cannot be set on a variant that has no retailPrice of its own."));
            }
            // Ảnh đại diện màu chỉ bắt buộc cho biến thể CÓ thuộc tính màu (PRODUCT_RULE_005,
            // sửa 2026-07-11). Biến thể không màu (vd chỉ có Size) không có ô ảnh trên form và
            // applyVariants luôn đặt imageUrl=null cho nó — nên không được đòi ảnh, tránh khoá
            // cứng việc đăng bán sản phẩm một-màu-nhiều-size.
            boolean variantHasColor = variant.getOptions() != null && variant.getOptions().stream()
                    .anyMatch(o -> ProductFieldApplier.isColorAttributeName(o.getOptionName())
                            && trimToNull(o.getOptionValue()) != null);
            if (requireImages && variantHasColor && trimToNull(variant.getImageUrl()) == null) {
                errors.add(new ApiErrorDetail(prefix + "imageUrl", REQUIRED, "A variant color image is required to publish."));
            }
        }
    }

    static void validatePublishReadiness(ProductEntity entity, List<ApiErrorDetail> errors) {
        validateProductFieldsRequired(entity, true, errors);
        if (entity.getCategories() != null
                && !entity.getCategories().isEmpty()
                && entity.getCategories().stream()
                .allMatch(category -> UNCATEGORIZED_CATEGORY_ID.equals(category.getId()))) {
            errors.add(new ApiErrorDetail(
                    "categoryIds",
                    "INVALID_STATE",
                    "Assign at least one category other than Uncategorized before publishing."
            ));
        }
        if (entity.getBrand() != null && UNCATEGORIZED_BRAND_ID.equals(entity.getBrand().getId())) {
            errors.add(new ApiErrorDetail(
                    "brandId",
                    "INVALID_STATE",
                    "Assign a brand other than Uncategorized before publishing."
            ));
        }
    }

    static void throwIfPublishErrors(List<ApiErrorDetail> errors) {
        if (!errors.isEmpty()) {
            System.err.println("--- PUBLISH GATE ERRORS ---");
            for (ApiErrorDetail err : errors) {
                System.err.println("Field: " + err.field() + ", Code: " + err.code() + ", Message: " + err.message());
            }
            throw new PublishGateException(List.copyOf(errors));
        }
    }

    private static void validateSlugFormat(String slug, String field, List<ApiErrorDetail> errors) {
        if (!SLUG_PATTERN.matcher(slug).matches()) {
            errors.add(new ApiErrorDetail(field, "INVALID_VALUE", "Slug format is invalid."));
        }
    }

    private static boolean isAllowedMediaUrl(String url, String allowedBaseUrl) {
        try {
            URI candidate = new URI(url).normalize();
            URI allowedBase = new URI(allowedBaseUrl).normalize();

            String candidateScheme = safeLower(candidate.getScheme());
            String allowedScheme = safeLower(allowedBase.getScheme());
            if (!candidateScheme.equals(allowedScheme)) {
                return false;
            }

            String candidateHost = safeLower(candidate.getHost());
            String allowedHost = safeLower(allowedBase.getHost());
            if (!candidateHost.equals(allowedHost)) {
                return false;
            }

            if (effectivePort(candidate) != effectivePort(allowedBase)) {
                return false;
            }

            String candidatePath = normalizePath(candidate.getPath());
            String allowedPath = normalizePath(allowedBase.getPath());
            if (candidatePath == null || allowedPath == null) {
                return false;
            }

            return candidatePath.equals(allowedPath) || candidatePath.startsWith(allowedPath + "/");
        } catch (URISyntaxException e) {
            return false;
        }
    }

    private static String normalizePath(String path) {
        if (path == null || path.isBlank()) {
            return null;
        }
        String normalized = path;
        while (normalized.endsWith("/") && normalized.length() > 1) {
            normalized = normalized.substring(0, normalized.length() - 1);
        }
        if (!normalized.startsWith("/")) {
            normalized = "/" + normalized;
        }
        return normalized;
    }

    private static String safeLower(String value) {
        return value == null ? "" : value.toLowerCase(Locale.ROOT);
    }

    private static int effectivePort(URI uri) {
        if (uri.getPort() != -1) {
            return uri.getPort();
        }
        String scheme = safeLower(uri.getScheme());
        return switch (scheme) {
            case "https" -> 443;
            case "http" -> 80;
            default -> -1;
        };
    }
}

