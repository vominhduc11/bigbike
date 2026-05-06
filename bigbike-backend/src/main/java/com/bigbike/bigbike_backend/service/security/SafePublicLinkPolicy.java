package com.bigbike.bigbike_backend.service.security;

import com.bigbike.bigbike_backend.api.error.ValidationException;
import java.net.URI;
import java.net.URISyntaxException;
import java.util.Locale;

public final class SafePublicLinkPolicy {

    private SafePublicLinkPolicy() {}

    public static String validateOrThrow(String value, String field) {
        String normalized = trimToNull(value);
        if (normalized == null) {
            throw ValidationException.fromField(field, "REQUIRED", field + " is required.");
        }
        if (!isAllowed(normalized)) {
            throw ValidationException.fromField(
                    field,
                    "INVALID_VALUE",
                    "Link must be a relative path starting with '/' or an absolute https URL."
            );
        }
        return normalized;
    }

    public static boolean isAllowed(String value) {
        String normalized = trimToNull(value);
        if (normalized == null) {
            return false;
        }

        String lower = normalized.toLowerCase(Locale.ROOT);
        if (lower.startsWith("javascript:")
                || lower.startsWith("data:")
                || lower.startsWith("vbscript:")
                || lower.startsWith("file:")
                || normalized.startsWith("//")
                || normalized.startsWith("\\\\")
                || normalized.contains("\\")) {
            return false;
        }

        if (normalized.startsWith("/")) {
            try {
                URI uri = new URI(normalized).normalize();
                return !uri.isAbsolute()
                        && uri.getRawPath() != null
                        && uri.getRawPath().startsWith("/")
                        && !uri.getRawPath().startsWith("//");
            } catch (URISyntaxException e) {
                return false;
            }
        }

        try {
            URI uri = new URI(normalized).normalize();
            String scheme = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase(Locale.ROOT);
            return "https".equals(scheme)
                    && uri.getHost() != null
                    && uri.getUserInfo() == null;
        } catch (URISyntaxException e) {
            return false;
        }
    }

    public static String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String normalized = value.trim();
        return normalized.isEmpty() ? null : normalized;
    }
}
