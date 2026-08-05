package com.bigbike.bigbike_backend.migration.wordpress.live;

import com.bigbike.bigbike_backend.migration.wordpress.live.LiveMigrationPreflightReport.Action;
import com.bigbike.bigbike_backend.migration.wordpress.live.LiveMigrationPreflightReport.RedirectPlan;
import com.bigbike.bigbike_backend.migration.wordpress.live.LiveMigrationOwnerOverrides.TargetContentPolicy;
import com.bigbike.bigbike_backend.migration.wordpress.live.LiveMigrationOwnerOverrides.UnavailableFileFallback;
import java.net.URI;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Rewrites only confirmed BigBike legacy links and verified WordPress upload paths. */
final class LiveMigrationContentRewriter {

    private static final String URL_CHARACTER = "[^\\s\\\\\"'<>]";
    private static final String PATH_CHARACTER = "[^\\s\\\\\"'<>?#]";
    private static final String URL_SUFFIX = "(?:[?#]" + URL_CHARACTER + "*)?";
    private static final String LEGACY_PATH = "/(?:"
            + "sp/" + PATH_CHARACTER + "+\\.html|"
            + "tin-tuc/" + PATH_CHARACTER + "+\\.html|"
            + "category/" + PATH_CHARACTER + "+|"
            + "vi(?:/" + PATH_CHARACTER + "*)?|"
            + "en/(?:sp/" + PATH_CHARACTER + "+\\.html|"
            + "tin-tuc/" + PATH_CHARACTER + "+\\.html|"
            + "category/" + PATH_CHARACTER + "+|"
            + "products(?:/" + PATH_CHARACTER + "+)?|"
            + "news(?:/" + PATH_CHARACTER + "+)?))"
            + URL_SUFFIX
            + "(?=[\\s\\\\\"'<>]|$)";
    /**
     * Hosts whose {@code /wp-content/uploads/} paths are treated as ours to internalise. Owner
     * decision 2026-08-05: product 39478 embedded seven illustrations straight from
     * {@code poc-helmet.com}; they are recovered into our own store under the very same relative
     * path, so the same rewrite must reach them. Measured scope of that host in the whole source:
     * exactly seven occurrences, all in product 39478.
     */
    private static final Pattern WP_UPLOAD_URL = Pattern.compile(
            "(?:(?:(?:https?:)?//(?:www\\.)?(?:bigbike\\.vn|bbi\\.vn|poc-helmet\\.com))/"
                    + "|(?<![A-Za-z0-9.:/])/?)wp-content/uploads/"
                    + "([^\\s\\\\\"'<>?#]+)(?:[?#][^\\s\\\\\"'<>]*)?",
            Pattern.CASE_INSENSITIVE);
    private static final Pattern INTERNAL_URL = Pattern.compile(
            "(?:(?:https?://)(?:www\\.)?bigbike\\.vn(" + LEGACY_PATH + ")"
                    + "|(?<![A-Za-z0-9.:/])(" + LEGACY_PATH + "))",
            Pattern.CASE_INSENSITIVE);
    /**
     * Matches an anchor in raw HTML and in HTML that lives inside a JSON string, where the
     * quotes around {@code href} arrive escaped ({@code <a href=\"…\">}). Group 2 captures the
     * optional backslash so the closing quote must be escaped exactly like the opening one;
     * group 4 is the href and group 6 the visible text, which is always preserved verbatim.
     */
    private static final Pattern HTML_ANCHOR = Pattern.compile(
            "(?is)<a\\b([^>]*?)\\bhref\\s*=\\s*(\\\\?)([\"'])(.*?)\\2\\3([^>]*)>(.*?)</a\\s*>");
    private static final Pattern HTML_IMAGE = Pattern.compile(
            "(?is)<img\\b[^>]*?\\bsrc\\s*=\\s*([\"'])(.*?)\\1[^>]*>");

    private final Map<String, String> redirectTargets;
    private final java.util.Set<String> acknowledgedPaths;
    /**
     * Uploads whose file no longer exists anywhere. The owner reviewed each one, so their
     * {@code <img>} tags are dropped from source prose instead of being carried over as broken
     * images — every other character of the text is kept.
     */
    private final java.util.Set<String> deadUploadPaths;

    LiveMigrationContentRewriter(List<RedirectPlan> redirects) {
        this(redirects, java.util.Set.of());
    }

    LiveMigrationContentRewriter(List<RedirectPlan> redirects, java.util.Set<String> deadUploadPaths) {
        Map<String, String> targets = new LinkedHashMap<>();
        LinkedHashSet<String> acknowledged = new LinkedHashSet<>();
        for (RedirectPlan redirect : redirects) {
            if ((redirect.action() == Action.INSERT
                    || redirect.action() == Action.UPDATE_REDIRECT_TARGET
                    || redirect.action() == Action.REWRITE_URLS_ONLY
                    || redirect.action() == Action.PRESERVE)
                    && hasText(redirect.sourcePath()) && hasText(redirect.targetPath())) {
                targets.putIfAbsent(normalizeRequestPath(redirect.sourcePath()), redirect.targetPath());
            }
            if (redirect.action() == Action.ACKNOWLEDGED_NO_SAFE_TARGET
                    && hasText(redirect.sourcePath())) {
                acknowledged.add(normalizeRequestPath(redirect.sourcePath()));
            }
        }
        this.redirectTargets = Map.copyOf(targets);
        this.acknowledgedPaths = java.util.Set.copyOf(acknowledged);
        this.deadUploadPaths = java.util.Set.copyOf(deadUploadPaths);
    }

    String rewriteHtml(String html, Map<String, String> mediaPublicUrlByRelativePath) {
        if (!hasText(html)) return html;
        String withMedia = replaceMedia(html, mediaPublicUrlByRelativePath);
        String withTargets = replaceInternalLinks(withMedia);
        String withoutDeadImages = withTargets;
        for (String deadPath : deadUploadPaths) {
            withoutDeadImages = removeExactDeadImages(withoutDeadImages, deadPath).value();
            withoutDeadImages = unwrapExactDeadMediaAnchors(withoutDeadImages, deadPath).value();
        }
        return unwrapAcknowledgedAnchors(withoutDeadImages).value();
    }

    RewriteResult rewriteTargetField(
            String value,
            Map<String, String> mediaPublicUrlByRelativePath,
            String entityType,
            String entityId,
            String field,
            boolean htmlField,
            TargetContentPolicy policy,
            List<UnavailableFileFallback> unavailableFallbacks) {
        if (!hasText(value)) return new RewriteResult(value, List.of(), 0, 0);
        List<String> operations = new java.util.ArrayList<>();
        String rewritten = replaceMedia(value, mediaPublicUrlByRelativePath);
        if (!rewritten.equals(value)) operations.add("REPLACE_VERIFIED_MEDIA_URLS");
        String withTargets = replaceInternalLinks(rewritten);
        if (!withTargets.equals(rewritten)) operations.add("REWRITE_TO_REVIEWED_INTERNAL_TARGETS");
        rewritten = withTargets;

        int unlinked = 0;
        // Structured fields hold their prose as HTML inside JSON strings, so the same reviewed
        // "drop the <a> wrapper, keep every character of the text" rule applies. Only the anchor
        // tags are removed; JSON escaping and every non-anchor URL are left untouched.
        if ((htmlField || policy.unlinkDeadAnchorsInStructuredContent())
                && policy.unlinkDeadInternalAnchors()) {
            Transform anchorTransform = unwrapAcknowledgedAnchors(rewritten);
            rewritten = anchorTransform.value();
            unlinked += anchorTransform.count();
            if (anchorTransform.count() > 0) {
                operations.add("UNLINK_ACKNOWLEDGED_DEAD_INTERNAL_ANCHOR:" + anchorTransform.count());
            }
        }

        int removedImages = 0;
        if (htmlField) {
            for (UnavailableFileFallback fallback : unavailableFallbacks) {
                if (!fallback.entityType().equals(entityType)
                        || !fallback.entityId().equals(entityId)
                        || !fallback.fields().contains(field)) continue;
                Transform imageTransform = removeExactDeadImages(rewritten, fallback.relativePath());
                rewritten = imageTransform.value();
                removedImages += imageTransform.count();
                if (imageTransform.count() > 0) {
                    operations.add("REMOVE_EXACT_DEAD_IMAGE:" + fallback.relativePath()
                            + ":" + imageTransform.count());
                }
                Transform mediaAnchorTransform = unwrapExactDeadMediaAnchors(
                        rewritten, fallback.relativePath());
                rewritten = mediaAnchorTransform.value();
                unlinked += mediaAnchorTransform.count();
                if (mediaAnchorTransform.count() > 0) {
                    operations.add("UNLINK_EXACT_DEAD_MEDIA_ANCHOR:"
                            + fallback.relativePath() + ":" + mediaAnchorTransform.count());
                }
            }
        }
        return new RewriteResult(
                rewritten, List.copyOf(operations), unlinked, removedImages);
    }

    String rewriteCanonical(String sourceCanonical, String canonicalPath) {
        if (!hasText(sourceCanonical)) return null;
        String source = sourceCanonical.trim();
        try {
            URI uri = URI.create(source);
            String host = uri.getHost();
            if (!uri.isAbsolute() || host == null
                    || "bigbike.vn".equalsIgnoreCase(host)
                    || "www.bigbike.vn".equalsIgnoreCase(host)) {
                return absoluteCanonical(canonicalPath);
            }
            return source;
        } catch (IllegalArgumentException e) {
            return source.startsWith("/") ? absoluteCanonical(canonicalPath) : null;
        }
    }

    static List<String> wordpressUploadPaths(String value) {
        if (!hasTextStatic(value)) return List.of();
        LinkedHashSet<String> paths = new LinkedHashSet<>();
        Matcher matcher = WP_UPLOAD_URL.matcher(value);
        while (matcher.find()) {
            String relative = LiveMediaPlanner.normalizeRelativePath(matcher.group(1));
            if (relative != null) paths.add(relative);
        }
        return List.copyOf(paths);
    }

    static int wordpressUploadLinkCount(String value) {
        return countMatches(WP_UPLOAD_URL, value);
    }

    static int legacyInternalLinkCount(String value) {
        return countMatches(INTERNAL_URL, value);
    }

    static List<String> legacyInternalPaths(String value) {
        if (!hasTextStatic(value)) return List.of();
        LinkedHashSet<String> paths = new LinkedHashSet<>();
        Matcher matcher = INTERNAL_URL.matcher(value);
        while (matcher.find()) {
            String path = matcher.group(1) != null ? matcher.group(1) : matcher.group(2);
            if (path != null && !path.isBlank()) paths.add(path);
        }
        return List.copyOf(paths);
    }

    private static int countMatches(Pattern pattern, String value) {
        if (!hasTextStatic(value)) return 0;
        int count = 0;
        Matcher matcher = pattern.matcher(value);
        while (matcher.find()) count++;
        return count;
    }

    private static boolean hasTextStatic(String value) {
        return value != null && !value.isBlank();
    }

    private String replaceMedia(String value, Map<String, String> publicUrls) {
        Matcher matcher = WP_UPLOAD_URL.matcher(value);
        StringBuffer out = new StringBuffer(value.length());
        while (matcher.find()) {
            String relative = LiveMediaPlanner.normalizeRelativePath(matcher.group(1));
            String replacement = relative == null ? null : publicUrls.get(relative);
            if (replacement == null) continue;
            matcher.appendReplacement(out, Matcher.quoteReplacement(replacement));
        }
        matcher.appendTail(out);
        return out.toString();
    }

    private String replaceInternalLinks(String value) {
        Matcher matcher = INTERNAL_URL.matcher(value);
        StringBuffer out = new StringBuffer(value.length());
        while (matcher.find()) {
            String matchedPath = matcher.group(1) != null ? matcher.group(1) : matcher.group(2);
            String suffix = suffix(matchedPath);
            String normalized = normalizeRequestPath(matchedPath);
            String target = redirectTargets.get(normalized);
            if (target == null) target = localizedRedirectTarget(normalized);
            if (target == null) continue;
            matcher.appendReplacement(out, Matcher.quoteReplacement(target + suffix));
        }
        matcher.appendTail(out);
        return out.toString();
    }

    private Transform unwrapAcknowledgedAnchors(String value) {
        if (acknowledgedPaths.isEmpty() || !hasText(value)) return new Transform(value, 0);
        Matcher matcher = HTML_ANCHOR.matcher(value);
        StringBuffer out = new StringBuffer(value.length());
        int count = 0;
        while (matcher.find()) {
            String href = matcher.group(4);
            String path = internalRequestPath(href);
            if (path == null || !isAcknowledgedPath(path)) continue;
            matcher.appendReplacement(out, Matcher.quoteReplacement(matcher.group(6)));
            count++;
        }
        matcher.appendTail(out);
        return new Transform(out.toString(), count);
    }

    private boolean isAcknowledgedPath(String path) {
        if (acknowledgedPaths.contains(path)) return true;
        if (path.startsWith("/vi/") || path.startsWith("/en/")) {
            return acknowledgedPaths.contains(path.substring(3));
        }
        return false;
    }

    private Transform removeExactDeadImages(String value, String relativePath) {
        Matcher matcher = HTML_IMAGE.matcher(value);
        StringBuffer out = new StringBuffer(value.length());
        int count = 0;
        while (matcher.find()) {
            List<String> paths = wordpressUploadPaths(matcher.group(2));
            if (!paths.contains(relativePath)) continue;
            matcher.appendReplacement(out, "");
            count++;
        }
        matcher.appendTail(out);
        return new Transform(out.toString(), count);
    }

    private Transform unwrapExactDeadMediaAnchors(String value, String relativePath) {
        Matcher matcher = HTML_ANCHOR.matcher(value);
        StringBuffer out = new StringBuffer(value.length());
        int count = 0;
        while (matcher.find()) {
            if (!wordpressUploadPaths(matcher.group(4)).contains(relativePath)) continue;
            matcher.appendReplacement(out, Matcher.quoteReplacement(matcher.group(6)));
            count++;
        }
        matcher.appendTail(out);
        return new Transform(out.toString(), count);
    }

    private String internalRequestPath(String rawHref) {
        if (!hasText(rawHref)) return null;
        String value = rawHref.trim().replace("&amp;", "&");
        try {
            URI uri = URI.create(value);
            if (uri.isAbsolute()) {
                String host = uri.getHost();
                if (host == null || !(host.equalsIgnoreCase("bigbike.vn")
                        || host.equalsIgnoreCase("www.bigbike.vn")
                        || host.equalsIgnoreCase("bbi.vn")
                        || host.equalsIgnoreCase("www.bbi.vn"))) return null;
            } else if (!value.startsWith("/")) {
                return null;
            }
            return normalizeRequestPath(value);
        } catch (IllegalArgumentException ignored) {
            return null;
        }
    }

    private String localizedRedirectTarget(String normalizedPath) {
        if ("/vi".equals(normalizedPath)) return "/";
        if (normalizedPath.startsWith("/vi/")) {
            String withoutLocale = normalizedPath.substring(3);
            String mapped = redirectTargets.get(withoutLocale);
            if (mapped != null) return mapped;
            if (isCurrentVietnameseRoute(withoutLocale)) return ensureTrailingSlash(withoutLocale);
            return null;
        }
        if (normalizedPath.startsWith("/en/")) {
            String withoutLocale = normalizedPath.substring(3);
            String mapped = redirectTargets.get(withoutLocale);
            if (mapped != null) return localizeEnglish(mapped);
            if (normalizedPath.equals("/en/products")) return "/en/products/";
            if (normalizedPath.startsWith("/en/products/")) {
                return ensureTrailingSlash("/en/product/"
                        + normalizedPath.substring("/en/products/".length()));
            }
            if (normalizedPath.equals("/en/news")) return "/en/tin-tuc/";
            if (normalizedPath.startsWith("/en/news/")) {
                return ensureTrailingSlash("/en/tin-tuc/"
                        + normalizedPath.substring("/en/news/".length()));
            }
        }
        return null;
    }

    private boolean isCurrentVietnameseRoute(String path) {
        return path.equals("/")
                || path.equals("/sp")
                || path.equals("/tin-tuc")
                || path.matches("/(?:product|tin-tuc|danh-muc|brands)/[^/?#]+/?");
    }

    private String localizeEnglish(String target) {
        String normalized = target.startsWith("/") ? target : "/" + target;
        if (normalized.equals("/sp/") || normalized.equals("/sp")) return "/en/products/";
        if (normalized.equals("/tin-tuc/") || normalized.equals("/tin-tuc")) {
            return "/en/tin-tuc/";
        }
        if (normalized.startsWith("/product/")) return "/en" + ensureTrailingSlash(normalized);
        if (normalized.startsWith("/tin-tuc/")) return "/en" + ensureTrailingSlash(normalized);
        if (normalized.startsWith("/danh-muc/")) {
            return ensureTrailingSlash("/en/categories/"
                    + normalized.substring("/danh-muc/".length()));
        }
        return normalized.startsWith("/en/") ? ensureTrailingSlash(normalized) : null;
    }

    private String ensureTrailingSlash(String value) {
        String path = value == null || value.isBlank() ? "/" : value;
        return path.equals("/") || path.endsWith("/") ? path : path + "/";
    }

    private String suffix(String path) {
        int query = path.indexOf('?');
        int fragment = path.indexOf('#');
        int start = query < 0 ? fragment : fragment < 0 ? query : Math.min(query, fragment);
        return start < 0 ? "" : path.substring(start);
    }

    private String normalizeRequestPath(String raw) {
        String value = raw == null ? "" : raw.trim();
        try {
            URI uri = URI.create(value);
            if (uri.isAbsolute() && uri.getPath() != null) value = uri.getPath();
        } catch (IllegalArgumentException ignored) {
            // Keep the raw path and let the exact map fail closed.
        }
        int query = value.indexOf('?');
        if (query >= 0) value = value.substring(0, query);
        int fragment = value.indexOf('#');
        if (fragment >= 0) value = value.substring(0, fragment);
        if (!value.startsWith("/")) value = "/" + value;
        while (value.length() > 1 && value.endsWith("/")) {
            value = value.substring(0, value.length() - 1);
        }
        return value.toLowerCase(Locale.ROOT);
    }

    private String absoluteCanonical(String path) {
        String normalized = hasText(path) ? path.trim() : "/";
        if (!normalized.startsWith("/")) normalized = "/" + normalized;
        if (!normalized.endsWith("/")) normalized += "/";
        return "https://bigbike.vn" + normalized;
    }

    private boolean hasText(String value) {
        return value != null && !value.isBlank();
    }

    record RewriteResult(
            String value,
            List<String> operations,
            int unlinkedDeadAnchors,
            int removedDeadImages) {}

    private record Transform(String value, int count) {}
}
