package com.bigbike.bigbike_backend.util;

import com.bigbike.bigbike_backend.repository.catalog.ProductSearchTerms;
import java.util.Arrays;
import java.util.Collection;
import java.util.List;

/**
 * Text rules for staff/admin search. Accent folding deliberately delegates to the
 * existing product normalizer; unlike {@link ProductSearchTerms#tokens(String)},
 * this helper never removes stop words or applies chat aliases.
 */
public final class AdminSearchText {

    private AdminSearchText() {
    }

    public static String normalize(String value) {
        return ProductSearchTerms.normalize(value)
                .replaceAll("\\s+", " ")
                .trim();
    }

    /** Keeps every token, including punctuation such as '%' and '_'. */
    public static List<String> tokens(String value) {
        String normalized = normalize(value);
        if (normalized.isEmpty()) {
            return List.of();
        }
        return Arrays.stream(normalized.split(" "))
                .filter(token -> !token.isBlank())
                .distinct()
                .toList();
    }

    /** Escapes PostgreSQL LIKE wildcard characters for an expression using '\\' as escape. */
    public static String escapeLike(String value) {
        if (value == null) {
            return "";
        }
        return value.replace("\\", "\\\\")
                .replace("%", "\\%")
                .replace("_", "\\_");
    }

    public static String likePattern(String token) {
        return "%" + escapeLike(token) + "%";
    }

    public static boolean matchesAllTokens(String query, Collection<String> fields) {
        List<String> searchTokens = tokens(query);
        if (searchTokens.isEmpty()) {
            return false;
        }
        Collection<String> safeFields = fields == null ? List.of() : fields;
        return searchTokens.stream().allMatch(token -> safeFields.stream()
                .map(AdminSearchText::normalize)
                .anyMatch(field -> !field.isEmpty() && field.contains(token)));
    }

    /** 0 = whole-field match, 1 = prefix match, 2 = substring/token match. */
    public static int rank(String query, Collection<String> fields) {
        String normalizedQuery = normalize(query);
        if (normalizedQuery.isEmpty()) {
            return Integer.MAX_VALUE;
        }

        int best = Integer.MAX_VALUE;
        Collection<String> safeFields = fields == null ? List.of() : fields;
        for (String field : safeFields) {
            String normalizedField = normalize(field);
            if (normalizedField.isEmpty()) {
                continue;
            }
            if (normalizedField.equals(normalizedQuery)) {
                best = Math.min(best, 0);
            } else if (normalizedField.startsWith(normalizedQuery)) {
                best = Math.min(best, 1);
            } else if (normalizedField.contains(normalizedQuery)) {
                best = Math.min(best, 2);
            }
        }
        if (best != Integer.MAX_VALUE) {
            return best;
        }
        return matchesAllTokens(query, safeFields) ? 2 : Integer.MAX_VALUE;
    }

    public static String stableKey(String value) {
        return normalize(value);
    }
}
