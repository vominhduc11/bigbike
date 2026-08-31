package com.bigbike.bigbike_backend.service.security;

import com.bigbike.bigbike_backend.api.error.ValidationException;
import java.net.URI;
import java.net.URISyntaxException;
import java.util.Locale;
import java.util.Optional;
import java.util.regex.Pattern;
import org.springframework.stereotype.Component;

/** Strict policy for the single official YouTube channel used by homepage automation. */
@Component
public class YouTubeChannelUrlPolicy {

    private static final Pattern CHANNEL_ID = Pattern.compile("^UC[A-Za-z0-9_-]{22}$");

    public ChannelReference validateOrThrow(String rawValue, String field) {
        return parse(rawValue).orElseThrow(() -> ValidationException.fromField(
                field,
                "INVALID_YOUTUBE_CHANNEL_URL",
                "Chỉ chấp nhận trang kênh YouTube HTTPS dạng youtube.com/@ten-kenh hoặc "
                        + "youtube.com/channel/UC... / Only an official HTTPS YouTube channel page is allowed."
        ));
    }

    public Optional<ChannelReference> parse(String rawValue) {
        if (rawValue == null || rawValue.isBlank()) {
            return Optional.empty();
        }

        try {
            URI uri = new URI(rawValue.trim()).normalize();
            if (!"https".equalsIgnoreCase(uri.getScheme())
                    || uri.getUserInfo() != null
                    || (uri.getPort() != -1 && uri.getPort() != 443)
                    || (uri.getFragment() != null && !uri.getFragment().isBlank())) {
                return Optional.empty();
            }

            String host = uri.getHost() == null ? "" : uri.getHost().toLowerCase(Locale.ROOT);
            if (!("youtube.com".equals(host) || "www.youtube.com".equals(host))) {
                return Optional.empty();
            }

            String query = uri.getRawQuery();
            if (query != null && !query.isBlank() && !"sub_confirmation=1".equals(query)) {
                return Optional.empty();
            }

            String path = uri.getPath() == null ? "" : uri.getPath();
            while (path.length() > 1 && path.endsWith("/")) {
                path = path.substring(0, path.length() - 1);
            }

            if (path.startsWith("/@")) {
                String handle = path.substring(2);
                if (handle.isBlank() || handle.length() > 100 || handle.contains("/")
                        || handle.chars().anyMatch(Character::isWhitespace)) {
                    return Optional.empty();
                }
                return Optional.of(new ChannelReference(
                        new URI("https", "www.youtube.com", "/@" + handle, null).toASCIIString(),
                        null
                ));
            }

            if (path.startsWith("/channel/")) {
                String channelId = path.substring("/channel/".length());
                if (!CHANNEL_ID.matcher(channelId).matches()) {
                    return Optional.empty();
                }
                return Optional.of(new ChannelReference(
                        "https://www.youtube.com/channel/" + channelId,
                        channelId
                ));
            }
        } catch (URISyntaxException | IllegalArgumentException ignored) {
            return Optional.empty();
        }
        return Optional.empty();
    }

    public static boolean isValidChannelId(String value) {
        return value != null && CHANNEL_ID.matcher(value).matches();
    }

    public record ChannelReference(String normalizedUrl, String channelId) {
        public boolean hasChannelId() {
            return channelId != null;
        }
    }
}
