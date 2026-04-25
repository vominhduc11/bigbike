package com.bigbike.bigbike_backend.service.admin;

import com.bigbike.bigbike_backend.api.admin.dto.ImageAssetRequest;
import com.bigbike.bigbike_backend.api.admin.dto.SeoMetaRequest;
import com.bigbike.bigbike_backend.api.common.ApiErrorDetail;
import com.bigbike.bigbike_backend.api.error.ValidationException;
import com.bigbike.bigbike_backend.domain.catalog.PublishStatus;
import java.net.URI;
import java.net.URISyntaxException;
import java.math.BigDecimal;
import java.util.Locale;
import java.util.List;
import java.util.regex.Pattern;

final class AdminMutationValidators {

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
            errors.add(new ApiErrorDetail(field, "REQUIRED", "Slug is required."));
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
            errors.add(new ApiErrorDetail(field, "REQUIRED", label + " is required."));
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
        validateImageAsset(seo.getOgImage(), fieldPrefix + ".ogImage", allowedMediaBaseUrl, errors);
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

    static void validatePublishTransition(
            PublishStatus from,
            PublishStatus to,
            String field,
            List<ApiErrorDetail> errors
    ) {
        if (from == null || to == null || from == to) {
            return;
        }

        // Soft-delete (→ TRASH) is allowed from any active state. Restoring out
        // of TRASH lands in DRAFT (parity with WordPress trash semantics).
        // PENDING/PRIVATE are WP-imported review states with limited transitions.
        boolean allowed = switch (from) {
            case DRAFT -> to == PublishStatus.PUBLISHED
                    || to == PublishStatus.ARCHIVED
                    || to == PublishStatus.TRASH;
            case PUBLISHED -> to == PublishStatus.HIDDEN
                    || to == PublishStatus.ARCHIVED
                    || to == PublishStatus.TRASH;
            case HIDDEN -> to == PublishStatus.PUBLISHED
                    || to == PublishStatus.ARCHIVED
                    || to == PublishStatus.TRASH;
            case ARCHIVED -> to == PublishStatus.DRAFT
                    || to == PublishStatus.TRASH;
            case PENDING -> to == PublishStatus.PUBLISHED
                    || to == PublishStatus.DRAFT
                    || to == PublishStatus.TRASH;
            case PRIVATE -> to == PublishStatus.PUBLISHED
                    || to == PublishStatus.DRAFT
                    || to == PublishStatus.HIDDEN
                    || to == PublishStatus.TRASH;
            case TRASH -> to == PublishStatus.DRAFT;
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

