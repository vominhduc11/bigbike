package com.bigbike.bigbike_backend.service.security;

import com.bigbike.bigbike_backend.api.error.ValidationException;
import com.bigbike.bigbike_backend.config.MediaUrlProperties;
import java.net.URI;
import java.net.URISyntaxException;
import java.util.Locale;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class SafeMediaAssetUrlPolicy {

    private static final String LEGACY_CDN_HOST = "cdn.bigbike.vn";
    private static final String LEGACY_CDN_PATH_PREFIX = "/uploads/";
    private static final String WP_UPLOADS_PATH_PREFIX = "/wp-content/uploads/";

    private final URI configuredMediaBaseUri;
    private final URI siteBaseUri;

    public SafeMediaAssetUrlPolicy(
            MediaUrlProperties mediaUrlProperties,
            @Value("${bigbike.site.base-url:https://bigbike.vn}") String siteBaseUrl
    ) {
        this.configuredMediaBaseUri = parseAbsoluteUri(mediaUrlProperties.getPublicBaseUrl());
        this.siteBaseUri = parseAbsoluteUri(siteBaseUrl);
    }

    public void validateImageUrlOrThrow(String url, String field) {
        String normalized = SafePublicLinkPolicy.trimToNull(url);
        if (normalized == null) {
            return;
        }
        if (!isAllowedImageUrl(normalized)) {
            throw ValidationException.fromField(
                    field,
                    "INVALID_VALUE",
                    "Image URL must be an approved media URL or BigBike legacy upload path."
            );
        }
    }

    public boolean isAllowedImageUrl(String url) {
        String normalized = SafePublicLinkPolicy.trimToNull(url);
        if (normalized == null || hasUnsafePrefix(normalized)) {
            return false;
        }

        if (normalized.startsWith("/media/")
                || normalized.startsWith("/media-proxy/")
                || normalized.startsWith(WP_UPLOADS_PATH_PREFIX)) {
            return true;
        }

        URI candidate = parseUri(normalized);
        if (candidate == null || !isHttp(candidate)) {
            return false;
        }

        return isUnderConfiguredMediaBase(candidate)
                || isBigBikeWpUploads(candidate)
                || isLegacyCdn(candidate);
    }

    public boolean isAllowedVideoMediaUrl(String url) {
        String normalized = SafePublicLinkPolicy.trimToNull(url);
        if (normalized == null || hasUnsafePrefix(normalized)) {
            return false;
        }

        if (normalized.startsWith("/media/") || normalized.startsWith("/media-proxy/")) {
            return true;
        }

        URI candidate = parseUri(normalized);
        return candidate != null && isHttp(candidate) && isUnderConfiguredMediaBase(candidate);
    }

    private boolean isUnderConfiguredMediaBase(URI candidate) {
        if (configuredMediaBaseUri == null) {
            return false;
        }
        return sameOrigin(candidate, configuredMediaBaseUri)
                && hasPathPrefix(candidate.getPath(), configuredMediaBaseUri.getPath());
    }

    private boolean isBigBikeWpUploads(URI candidate) {
        if (siteBaseUri == null) {
            return false;
        }
        return sameOrigin(candidate, siteBaseUri) && hasPathPrefix(candidate.getPath(), WP_UPLOADS_PATH_PREFIX);
    }

    private boolean isLegacyCdn(URI candidate) {
        return "https".equalsIgnoreCase(candidate.getScheme())
                && LEGACY_CDN_HOST.equalsIgnoreCase(candidate.getHost())
                && hasPathPrefix(candidate.getPath(), LEGACY_CDN_PATH_PREFIX);
    }

    private static boolean sameOrigin(URI left, URI right) {
        return safeLower(left.getScheme()).equals(safeLower(right.getScheme()))
                && safeLower(left.getHost()).equals(safeLower(right.getHost()))
                && effectivePort(left) == effectivePort(right);
    }

    private static boolean hasPathPrefix(String path, String prefix) {
        String normalizedPath = normalizePath(path);
        String normalizedPrefix = normalizePath(prefix);
        if (normalizedPath == null || normalizedPrefix == null) {
            return false;
        }
        return normalizedPath.equals(normalizedPrefix) || normalizedPath.startsWith(normalizedPrefix + "/");
    }

    private static boolean isHttp(URI uri) {
        String scheme = safeLower(uri.getScheme());
        return ("http".equals(scheme) || "https".equals(scheme))
                && uri.getHost() != null
                && uri.getUserInfo() == null;
    }

    private static boolean hasUnsafePrefix(String value) {
        String lower = value.toLowerCase(Locale.ROOT);
        return lower.startsWith("javascript:")
                || lower.startsWith("data:")
                || lower.startsWith("vbscript:")
                || lower.startsWith("file:")
                || value.startsWith("//")
                || value.startsWith("\\\\")
                || value.contains("\\");
    }

    private static URI parseAbsoluteUri(String value) {
        URI uri = parseUri(value);
        return uri != null && uri.isAbsolute() ? uri : null;
    }

    private static URI parseUri(String value) {
        try {
            return new URI(value).normalize();
        } catch (URISyntaxException e) {
            return null;
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
        return switch (safeLower(uri.getScheme())) {
            case "https" -> 443;
            case "http" -> 80;
            default -> -1;
        };
    }
}
