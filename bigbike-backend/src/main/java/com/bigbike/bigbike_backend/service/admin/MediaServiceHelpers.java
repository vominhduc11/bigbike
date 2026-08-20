package com.bigbike.bigbike_backend.service.admin;

import java.util.Locale;
import java.util.Set;
import org.springframework.data.domain.Sort;

/**
 * Pure, stateless helper methods extracted from {@link AdminMediaService}.
 *
 * <p>Follows the {@code ProductFieldApplier} precedent: a {@code final} class of
 * {@code public static} helpers with a private constructor and no Spring annotation.
 * Imported statically by {@code AdminMediaService} so existing call sites stay unchanged.
 */
final class MediaServiceHelpers {

    private MediaServiceHelpers() {}

    private static final Set<String> ALLOWED_SORT_KEYS = Set.of("createdAt", "fileSize", "title", "usageCount");

    static boolean startsWith(String s, String prefix) {
        return s != null && s.toLowerCase(Locale.ROOT).startsWith(prefix);
    }

    static Sort buildSort(String sortKey, String dir) {
        String key = (sortKey != null && ALLOWED_SORT_KEYS.contains(sortKey)) ? sortKey : "createdAt";
        // usageCount is computed in memory; fallback to createdAt for the DB-level sort
        if ("usageCount".equals(key)) key = "createdAt";
        Sort.Direction direction = "asc".equalsIgnoreCase(dir) ? Sort.Direction.ASC : Sort.Direction.DESC;
        return Sort.by(direction, key);
    }

    static String nvl(String s) { return s != null ? s : ""; }

    static String sanitizeFilename(String original) {
        if (original == null || original.isBlank()) return "upload";
        // Keep extension intact, sanitize the rest
        String name = original.replaceAll("[^a-zA-Z0-9._-]", "_").toLowerCase(Locale.ROOT);
        return name.length() > 200 ? name.substring(0, 200) : name;
    }

    /** Preserve the uploader-facing basename for downloads without allowing path traversal. */
    static String preserveOriginalFilename(String original) {
        if (original == null || original.isBlank()) return "upload";
        String basename = original.replace('\\', '/');
        int slash = basename.lastIndexOf('/');
        if (slash >= 0) basename = basename.substring(slash + 1);
        basename = basename.replaceAll("[\\p{Cntrl}]", "").strip();
        return basename.isBlank() || ".".equals(basename) || "..".equals(basename)
                ? "upload" : basename;
    }
}
