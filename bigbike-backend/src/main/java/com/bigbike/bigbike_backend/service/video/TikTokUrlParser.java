package com.bigbike.bigbike_backend.service.video;

import java.net.URI;
import java.net.URISyntaxException;
import java.util.List;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Parser cho link video TikTok được duyệt làm nguồn nhúng (owner chốt 2026-06-25, xem AGENTS.md §14.3).
 *
 * <p>Chấp nhận link đầy đủ trên các host {@code tiktok.com} / {@code www.tiktok.com} / {@code m.tiktok.com}
 * với id số trong path: {@code /@user/video/{id}}, {@code /video/{id}}, {@code /v/{id}.html},
 * {@code /embed/v2/{id}}, {@code /embed/{id}}.
 *
 * <p>Link rút gọn ({@code vt.tiktok.com}, {@code vm.tiktok.com}) KHÔNG đọc được id mà không resolve
 * redirect → trả null (caller reject, yêu cầu dán link đầy đủ).
 */
public final class TikTokUrlParser {

    private static final List<String> SUPPORTED_HOSTS = List.of(
            "tiktok.com",
            "www.tiktok.com",
            "m.tiktok.com"
    );

    // id video TikTok là chuỗi số (hiện ~19 chữ số); nới rộng 6–30 để an toàn với thay đổi tương lai.
    private static final Pattern PATH_ID_PATTERN =
            Pattern.compile("/(?:video|v|embed/v2|embed)/(\\d{6,30})");

    private TikTokUrlParser() {}

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

        String path = uri.getPath() == null ? "" : uri.getPath();
        Matcher matcher = PATH_ID_PATTERN.matcher(path);
        return matcher.find() ? matcher.group(1) : null;
    }

    public static boolean isTikTokUrl(String url) {
        return extractId(url) != null;
    }

    /** URL nhúng iframe chính thức của TikTok cho một id video. */
    public static String embedUrl(String id) {
        return id == null ? null : "https://www.tiktok.com/embed/v2/" + id;
    }

    private static String lower(String value) {
        return value == null ? null : value.toLowerCase(Locale.ROOT);
    }
}
