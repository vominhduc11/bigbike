package com.bigbike.bigbike_backend.service.security;

import com.bigbike.bigbike_backend.api.error.ValidationException;
import com.bigbike.bigbike_backend.service.video.YouTubeUrlParser;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class HomeVideoUrlPolicy {

    private final SafeMediaAssetUrlPolicy safeMediaAssetUrlPolicy;

    public String validateOrThrow(String url, String field) {
        String normalized = SafePublicLinkPolicy.trimToNull(url);
        if (normalized == null) {
            throw ValidationException.fromField(field, "REQUIRED", field + " is required.");
        }

        if (YouTubeUrlParser.isYouTubeUrl(normalized)
                || safeMediaAssetUrlPolicy.isAllowedVideoMediaUrl(normalized)) {
            return normalized;
        }

        throw ValidationException.fromField(
                field,
                "INVALID_VALUE",
                "videoUrl must be a supported YouTube URL or an approved internal media URL."
        );
    }

    /**
     * Validates a structured video block without allowing the declared provider to disagree with
     * the URL host. Platform providers require their approved full URL; upload requires internal
     * media storage.
     */
    public boolean isAllowedForProvider(String provider, String url) {
        String normalizedProvider = SafePublicLinkPolicy.trimToNull(provider);
        String normalizedUrl = SafePublicLinkPolicy.trimToNull(url);
        if (normalizedProvider == null || normalizedUrl == null) {
            return false;
        }
        return switch (normalizedProvider) {
            case "youtube" -> YouTubeUrlParser.isYouTubeUrl(normalizedUrl);
            case "upload" -> safeMediaAssetUrlPolicy.isAllowedVideoMediaUrl(normalizedUrl);
            default -> false;
        };
    }
}
