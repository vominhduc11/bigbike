package com.bigbike.bigbike_backend.service.video;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

public final class YouTubeUrlParser {

    // Matches: youtu.be/{id}, youtube.com/watch?v={id}, youtube.com/embed/{id}, youtube.com/shorts/{id}
    private static final Pattern YT_PATTERN = Pattern.compile(
            "(?:youtu\\.be/|youtube\\.com/(?:watch\\?(?:.*&)?v=|embed/|shorts/|v/))([A-Za-z0-9_-]{11})"
    );

    private YouTubeUrlParser() {}

    public static String extractId(String url) {
        if (url == null || url.isBlank()) return null;
        Matcher m = YT_PATTERN.matcher(url);
        return m.find() ? m.group(1) : null;
    }

    public static boolean isYouTubeUrl(String url) {
        return extractId(url) != null;
    }
}
