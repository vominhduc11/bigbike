package com.bigbike.bigbike_backend.service.video;

import java.net.URI;
import java.net.URISyntaxException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Locale;

/**
 * Parser cho link video Facebook được duyệt làm nguồn nhúng (owner chốt 2026-06-25, xem AGENTS.md §14.3).
 *
 * <p>Khác YouTube/TikTok: Facebook KHÔNG tách id mà nhúng CẢ đường link gốc qua khung
 * {@code facebook.com/plugins/video.php?href={url}}. CHỈ video công khai mới render.
 *
 * <p>Chấp nhận link đầy đủ trên host {@code facebook.com} / {@code www.facebook.com} /
 * {@code m.facebook.com} / {@code web.facebook.com} với path chỉ video: chứa {@code /videos/},
 * {@code /reel/}, {@code /watch}, hoặc {@code video.php}.
 *
 * <p>Link rút gọn {@code fb.watch/...} KHÔNG xác định được video mà không resolve redirect → trả false.
 */
public final class FacebookUrlParser {

    private static final List<String> SUPPORTED_HOSTS = List.of(
            "facebook.com",
            "www.facebook.com",
            "m.facebook.com",
            "web.facebook.com"
    );

    private FacebookUrlParser() {}

    public static boolean isFacebookVideoUrl(String url) {
        if (url == null || url.isBlank()) {
            return false;
        }

        URI uri;
        try {
            uri = new URI(url.trim()).normalize();
        } catch (URISyntaxException e) {
            return false;
        }

        String scheme = lower(uri.getScheme());
        String host = lower(uri.getHost());
        if (host == null || (!"http".equals(scheme) && !"https".equals(scheme)) || !SUPPORTED_HOSTS.contains(host)) {
            return false;
        }

        String path = lower(uri.getPath() == null ? "" : uri.getPath());
        return path.contains("/videos/")
                || path.startsWith("/reel/")
                || path.equals("/watch")
                || path.equals("/watch/")
                || path.contains("video.php");
    }

    /** Khung nhúng iframe chính thức của Facebook cho một link video (giữ nguyên href gốc). */
    public static String embedUrl(String url) {
        if (!isFacebookVideoUrl(url)) {
            return null;
        }
        String encoded = URLEncoder.encode(url.trim(), StandardCharsets.UTF_8);
        return "https://www.facebook.com/plugins/video.php?href=" + encoded + "&show_text=false";
    }

    private static String lower(String value) {
        return value == null ? null : value.toLowerCase(Locale.ROOT);
    }
}
