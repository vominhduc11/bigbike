package com.bigbike.bigbike_backend.repository.catalog;

import java.text.Normalizer;
import java.util.Collection;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/** Language-level normalization shared by storefront, admin and BigBike Assistant product search. */
public final class ProductSearchTerms {

    private static final Set<String> STOP_WORDS = Set.of(
            "toi", "minh", "em", "e", "anh", "chi", "muon", "can", "tim", "kiem",
            "cho", "xem", "mua", "shop", "cua", "hang", "san", "pham", "cai", "chiec",
            "con", "mau", "nay", "kia", "vua", "roi", "co", "khong", "ko", "k",
            "a", "voi", "nhe", "nha", "giup", "gia", "bao", "nhieu", "gi", "nao",
            "vay", "nhu", "tren", "dung", "phai", "chua", "da", "van", "la",
            "ky", "thuat", "tiet",
            "please", "want", "find", "show", "buy", "product", "products", "item", "items",
            "have", "has", "does", "the", "an", "me", "my", "for", "price", "much",
            "is", "are", "this", "that");
    private static final Map<String, String> CANONICAL_ALIASES = Map.of(
            "non", "mu",
            "helmet", "mu",
            "helmets", "mu");

    private ProductSearchTerms() {
    }

    public static List<String> tokens(String query) {
        if (query == null || query.isBlank()) return List.of();
        String normalized = normalize(query)
                .replaceAll("[^\\p{Alnum}]+", " ")
                .trim();
        if (normalized.isEmpty()) return List.of();
        return java.util.Arrays.stream(normalized.split("\\s+"))
                .filter(token -> !token.isBlank())
                .filter(token -> !STOP_WORDS.contains(token))
                .map(token -> CANONICAL_ALIASES.getOrDefault(token, token))
                .distinct()
                .toList();
    }

    public static String normalize(String value) {
        if (value == null || value.isBlank()) return "";
        return Normalizer.normalize(value, Normalizer.Form.NFD)
                .replaceAll("\\p{M}+", "")
                .replace('đ', 'd')
                .replace('Đ', 'd')
                .toLowerCase(Locale.ROOT);
    }

    /**
     * Returns whether every meaningful search token matches at least one product
     * identifier. Descriptive copy is deliberately not an input to this helper.
     */
    public static boolean matchesProductIdentifiers(
            String name,
            String nameEn,
            String slug,
            String slugEn,
            String sku,
            Collection<String> rawTerms
    ) {
        List<String> meaningfulTokens = rawTerms == null
                ? List.of()
                : rawTerms.stream()
                        .flatMap(term -> tokens(term).stream())
                        .distinct()
                        .toList();
        return meaningfulTokens.stream().allMatch(token ->
                contains(name, token)
                        || contains(nameEn, token)
                        || contains(slug, token)
                        || contains(slugEn, token)
                        || contains(sku, token));
    }

    private static boolean contains(String value, String normalizedToken) {
        return !normalize(value).isEmpty() && normalize(value).contains(normalizedToken);
    }
}
