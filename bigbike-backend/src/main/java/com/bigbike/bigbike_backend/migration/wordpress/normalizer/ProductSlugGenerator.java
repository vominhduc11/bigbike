package com.bigbike.bigbike_backend.migration.wordpress.normalizer;

import java.text.Normalizer;
import org.springframework.stereotype.Component;

/**
 * Generates URL-safe slugs for products that have a blank or missing slug.
 *
 * Slug rules:
 *   - Strip Unicode diacritics ( vietnamesê → vietnamese)
 *   - Lowercase
 *   - Replace non-alphanumeric sequences with hyphens
 *   - Trim leading/trailing hyphens
 *   - If result is blank (name was entirely non-ASCII non-Latin), fallback to "product-{legacyId}"
 *
 * The output is always deterministic for the same (name, legacyId) pair — required for idempotency.
 */
@Component
public class ProductSlugGenerator {

    /**
     * Generate a slug candidate from a product name.
     * If name is blank or produces an empty slug, returns "product-{legacyId}".
     * Does NOT check uniqueness — uniqueness is the caller's responsibility.
     */
    public String generate(String name, long legacyId) {
        if (name != null && !name.isBlank()) {
            String slug = toSlug(name);
            if (!slug.isBlank()) {
                return slug;
            }
        }
        return "product-" + legacyId;
    }

    /**
     * Append "-{legacyId}" suffix to make a slug unique.
     * Used when the candidate slug already exists in DB or batch.
     */
    public String withSuffix(String candidate, long legacyId) {
        return candidate + "-" + legacyId;
    }

    public static String toSlug(String s) {
        // Strip combining diacritical marks (converts á→a, ê→e, đ is not decomposable → becomes d after manual replace)
        String nfd = Normalizer.normalize(s, Normalizer.Form.NFD);
        // Remove combining characters
        String stripped = nfd.replaceAll("\\p{InCombiningDiacriticalMarks}", "");
        // Handle Vietnamese đ/Đ explicitly (does not decompose via NFD)
        stripped = stripped.replace('đ', 'd').replace('Đ', 'd');
        return stripped.toLowerCase()
                .replaceAll("[^a-z0-9]+", "-")
                .replaceAll("^-+|-+$", "")
                .replaceAll("-{2,}", "-");
    }
}
