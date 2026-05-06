package com.bigbike.bigbike_backend.service.video;

import java.net.URI;
import java.net.URISyntaxException;
import java.util.List;
import java.util.Locale;
import java.util.regex.Pattern;

public final class YouTubeUrlParser {

    private static final Pattern VIDEO_ID_PATTERN = Pattern.compile("^[A-Za-z0-9_-]{11}$");
    private static final List<String> SUPPORTED_HOSTS = List.of(
            "youtube.com",
            "www.youtube.com",
            "m.youtube.com",
            "youtu.be",
            "www.youtube-nocookie.com",
            "youtube-nocookie.com"
    );

    private YouTubeUrlParser() {}

    public static String extractId(String url) {
        if (url == null || url.isBlank()) {
            return null;
        }

        URI uri;
        try {
            uri = new URI(url.trim()).normalize();
        } catch (URISyntaxException e) {
            return null;
        }

        String scheme = lower(uri.getScheme());
        String host = lower(uri.getHost());
        if (host == null || (!"http".equals(scheme) && !"https".equals(scheme)) || !SUPPORTED_HOSTS.contains(host)) {
            return null;
        }

        if ("youtu.be".equals(host)) {
            return firstPathSegmentId(uri.getPath());
        }

        String path = uri.getPath() == null ? "" : uri.getPath();
        if ("/watch".equals(path)) {
            return extractQueryParam(uri.getRawQuery(), "v");
        }
        if (path.startsWith("/embed/")) {
            return firstPathSegmentId(path.substring("/embed/".length()));
        }
        if (path.startsWith("/shorts/")) {
            return firstPathSegmentId(path.substring("/shorts/".length()));
        }
        if (path.startsWith("/v/")) {
            return firstPathSegmentId(path.substring("/v/".length()));
        }

        return null;
    }

    public static boolean isYouTubeUrl(String url) {
        return extractId(url) != null;
    }

    private static String extractQueryParam(String rawQuery, String paramName) {
        if (rawQuery == null || rawQuery.isBlank()) {
            return null;
        }
        for (String part : rawQuery.split("&")) {
            int idx = part.indexOf('=');
            String key = idx >= 0 ? part.substring(0, idx) : part;
            if (!paramName.equals(key)) {
                continue;
            }
            String value = idx >= 0 ? part.substring(idx + 1) : "";
            return isValidVideoId(value) ? value : null;
        }
        return null;
    }

    private static String firstPathSegmentId(String pathRemainder) {
        if (pathRemainder == null || pathRemainder.isBlank()) {
            return null;
        }
        String segment = pathRemainder.startsWith("/") ? pathRemainder.substring(1) : pathRemainder;
        int slash = segment.indexOf('/');
        if (slash >= 0) {
            segment = segment.substring(0, slash);
        }
        int question = segment.indexOf('?');
        if (question >= 0) {
            segment = segment.substring(0, question);
        }
        return isValidVideoId(segment) ? segment : null;
    }

    private static boolean isValidVideoId(String value) {
        return value != null && VIDEO_ID_PATTERN.matcher(value).matches();
    }

    private static String lower(String value) {
        return value == null ? null : value.toLowerCase(Locale.ROOT);
    }
}
