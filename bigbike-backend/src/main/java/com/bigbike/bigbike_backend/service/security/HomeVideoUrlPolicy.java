package com.bigbike.bigbike_backend.service.security;

import com.bigbike.bigbike_backend.api.error.ValidationException;
import com.bigbike.bigbike_backend.service.video.FacebookUrlParser;
import com.bigbike.bigbike_backend.service.video.TikTokUrlParser;
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
                || TikTokUrlParser.isTikTokUrl(normalized)
                || FacebookUrlParser.isFacebookVideoUrl(normalized)
                || safeMediaAssetUrlPolicy.isAllowedVideoMediaUrl(normalized)) {
            return normalized;
        }

        throw ValidationException.fromField(
                field,
                "INVALID_VALUE",
                "videoUrl must be a supported YouTube/TikTok/Facebook URL or an approved internal media URL."
        );
    }

    public boolean isAllowed(String url) {
        String normalized = SafePublicLinkPolicy.trimToNull(url);
        return normalized != null
                && (YouTubeUrlParser.isYouTubeUrl(normalized)
                        || TikTokUrlParser.isTikTokUrl(normalized)
                        || FacebookUrlParser.isFacebookVideoUrl(normalized)
                        || safeMediaAssetUrlPolicy.isAllowedVideoMediaUrl(normalized));
    }
}
