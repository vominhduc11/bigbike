package com.bigbike.bigbike_backend.service.admin;

import com.bigbike.bigbike_backend.api.admin.dto.ImageAssetRequest;
import com.bigbike.bigbike_backend.api.admin.dto.SeoMetaRequest;
import com.bigbike.bigbike_backend.api.common.ApiErrorDetail;
import com.bigbike.bigbike_backend.api.error.ValidationException;
import com.bigbike.bigbike_backend.domain.catalog.PublishStatus;
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
            Integer retailPrice,
            Integer compareAtPrice,
            Integer salePrice,
            String field,
            List<ApiErrorDetail> errors
    ) {
        if (salePrice == null || retailPrice == null) {
            return;
        }

        int reference = compareAtPrice != null ? compareAtPrice : retailPrice;
        if (salePrice >= reference) {
            errors.add(new ApiErrorDetail(field, "INVALID_VALUE", "salePrice must be lower than compareAtPrice or retailPrice."));
        }
    }

    static void validateImageAsset(ImageAssetRequest image, String fieldPrefix, List<ApiErrorDetail> errors) {
        if (image == null) {
            return;
        }

        validatePublicMediaUrl(image.getUrl(), fieldPrefix + ".url", errors);
        validateNonNegativeInteger(image.getWidth(), fieldPrefix + ".width", "Image width", errors);
        validateNonNegativeInteger(image.getHeight(), fieldPrefix + ".height", "Image height", errors);
    }

    static void validateSeoMeta(SeoMetaRequest seo, String fieldPrefix, List<ApiErrorDetail> errors) {
        if (seo == null) {
            return;
        }
        validatePublicMediaUrl(seo.getCanonicalUrl(), fieldPrefix + ".canonicalUrl", errors);
        validateImageAsset(seo.getOgImage(), fieldPrefix + ".ogImage", errors);
    }

    static void validatePublicMediaUrl(String url, String field, List<ApiErrorDetail> errors) {
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
            errors.add(new ApiErrorDetail(field, "INVALID_VALUE", "Media URL must be a public http(s) URL."));
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

        boolean allowed = switch (from) {
            case DRAFT -> to == PublishStatus.PUBLISHED || to == PublishStatus.ARCHIVED;
            case PUBLISHED -> to == PublishStatus.HIDDEN || to == PublishStatus.ARCHIVED;
            case HIDDEN -> to == PublishStatus.PUBLISHED || to == PublishStatus.ARCHIVED;
            case ARCHIVED -> to == PublishStatus.DRAFT;
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
}

