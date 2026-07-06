package com.bigbike.bigbike_backend.service.admin;

import com.bigbike.bigbike_backend.api.admin.dto.ImageAssetRequest;
import com.bigbike.bigbike_backend.api.admin.dto.SeoMetaRequest;
import com.bigbike.bigbike_backend.api.common.ApiErrorDetail;
import com.bigbike.bigbike_backend.api.error.PublishGateException;
import com.bigbike.bigbike_backend.api.error.ValidationException;
import com.bigbike.bigbike_backend.domain.catalog.PublishStatus;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductEntity;
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
        if (image == null) {
            return;
        }

        validateWhitelistedMediaUrl(image.getUrl(), fieldPrefix + ".url", allowedMediaBaseUrl, errors);
        validateNonNegativeInteger(image.getWidth(), fieldPrefix + ".width", "Image width", errors);
        validateNonNegativeInteger(image.getHeight(), fieldPrefix + ".height", "Image height", errors);
    }

    static void validateSeoMeta(
            SeoMetaRequest seo,
            String fieldPrefix,
            String allowedMediaBaseUrl,
            List<ApiErrorDetail> errors
    ) {
        if (seo == null) {
            return;
        }
        validatePublicUrl(seo.getCanonicalUrl(), fieldPrefix + ".canonicalUrl", errors);
        if (seo.getOgImage() != null) {
            validateWhitelistedMediaUrl(seo.getOgImage().getUrl(), fieldPrefix + ".ogImage.url", allowedMediaBaseUrl, errors);
        }
    }

    static void validatePublicUrl(String url, String field, List<ApiErrorDetail> errors) {
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
     * Collects every media URL already present in a stored block list — structured
     * {@code ImageBlock}/{@code FeatureBlock} urls plus inline {@code <img src>} inside raw-HTML
     * block fields (paragraph/callout/feature/suitability/sizeGuide). Used to grandfather legacy
     * hotlinks when a product/article is edited, mirroring the gallery/video legacy tolerance
     * (MEDIA_RULE_002 / MEDIA_RULE_003) so old imported content stays editable.
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
            }
            urls.addAll(extractInlineImageSrcs(blockRawHtml(block)));
        }
        return urls;
    }

    /** Raw-HTML payload of the block types that carry free HTML, or {@code null} for the rest. */
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
        if (block instanceof DescriptionBlock.SuitabilityBlock b) {
            return b.getHtml();
        }
        if (block instanceof DescriptionBlock.SizeGuideBlock b) {
            return b.getHtml();
        }
        return null;
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

        // ARCHIVED, PENDING and PRIVATE are legacy/WordPress-import values.
        // They are NOT valid target states for admin API mutations.
        // Use HIDDEN for non-public products/content, DRAFT for unpublished.
        if (to == PublishStatus.ARCHIVED || to == PublishStatus.PENDING || to == PublishStatus.PRIVATE) {
            errors.add(new ApiErrorDetail(
                    field,
                    "RESERVED_PUBLISH_STATUS",
                    "Publish status " + to + " is reserved and cannot be set via the admin API. " +
                    "Use DRAFT for unpublished content or HIDDEN for suppressed content."
            ));
            return;
        }

        // Active transitions: DRAFT ↔ PUBLISHED ↔ HIDDEN, all → TRASH, TRASH → DRAFT.
        // Legacy source states (ARCHIVED/PENDING/PRIVATE) still have escape paths so
        // any remaining DB records can be moved to active states.
        boolean allowed = switch (from) {
            case DRAFT -> to == PublishStatus.PUBLISHED
                    || to == PublishStatus.HIDDEN
                    || to == PublishStatus.TRASH;
            case PUBLISHED -> to == PublishStatus.HIDDEN
                    || to == PublishStatus.TRASH;
            case HIDDEN -> to == PublishStatus.PUBLISHED
                    || to == PublishStatus.DRAFT
                    || to == PublishStatus.TRASH;
            case TRASH -> to == PublishStatus.DRAFT;
            // Legacy escape paths — allow moving remaining DB records to active states
            case ARCHIVED -> to == PublishStatus.HIDDEN
                    || to == PublishStatus.DRAFT
                    || to == PublishStatus.TRASH;
            case PENDING -> to == PublishStatus.PUBLISHED
                    || to == PublishStatus.DRAFT
                    || to == PublishStatus.TRASH;
            case PRIVATE -> to == PublishStatus.PUBLISHED
                    || to == PublishStatus.DRAFT
                    || to == PublishStatus.HIDDEN
                    || to == PublishStatus.TRASH;
        };

        if (!allowed) {
            errors.add(new ApiErrorDetail(
                    field,
                    "INVALID_STATE_TRANSITION",
                    "Invalid publish status transition from " + from + " to " + to + "."
            ));
        }
    }

    static void throwIfErrors(List<ApiErrorDetail> errors) {
        if (!errors.isEmpty()) {
            throw new ValidationException("Validation failed.", List.copyOf(errors));
        }
    }

    static void validatePublishReadiness(ProductEntity entity, List<ApiErrorDetail> errors) {
        if (trimToNull(entity.getName()) == null) {
            errors.add(new ApiErrorDetail("name", REQUIRED, "Product name is required to publish."));
        }
        if (entity.getCategory() == null) {
            errors.add(new ApiErrorDetail("categoryId", REQUIRED, "Category is required to publish."));
        }
        if (entity.getBrand() == null) {
            errors.add(new ApiErrorDetail("brandId", REQUIRED, "Brand is required to publish."));
        }
        if (trimToNull(entity.getImageUrl()) == null && trimToNull(entity.getImageId()) == null) {
            errors.add(new ApiErrorDetail("imageUrl", REQUIRED, "A main product image is required to publish."));
        }
        if (entity.getRetailPrice() == null || entity.getRetailPrice().compareTo(BigDecimal.ZERO) <= 0) {
            errors.add(new ApiErrorDetail("retailPrice", REQUIRED, "Retail price must be greater than 0 to publish."));
        }
    }

    static void throwIfPublishErrors(List<ApiErrorDetail> errors) {
        if (!errors.isEmpty()) {
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

