package com.bigbike.bigbike_backend.service.search;

import com.bigbike.bigbike_backend.domain.catalog.Product;
import com.bigbike.bigbike_backend.domain.catalog.ProductStockState;
import com.bigbike.bigbike_backend.repository.catalog.ProductSearchTerms;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Storefront-only search rules from {@code SEARCH_RULE_001}–{@code SEARCH_RULE_004}.
 *
 * <p>This deliberately does not call {@link ProductSearchTerms#tokens(String)}: that method
 * retains the BigBike Assistant stop-word and alias behavior. Storefront search keeps every
 * customer word and applies word-boundary matching to product fields instead.
 */
public final class StorefrontSearchRules {

    /** Customer-facing synonyms are intentionally separate from the Assistant's token processor. */
    private static final Map<String, String> STOREFRONT_ALIASES = Map.of(
            "non", "mu",
            "helmet", "mu",
            "helmets", "mu");
    /**
     * Sellable products have an implicit product/new-arrival marker. This lets a customer search
     * general storefront concepts such as "sản phẩm" or "hàng mới" without discarding those
     * words or returning an artificial empty state.
     */
    private static final List<String> PRODUCT_MARKERS = List.of("san", "pham", "hang", "moi", "product", "products", "new", "arrival");

    private StorefrontSearchRules() {
    }

    /** Accent-folded, lower-case text while preserving punctuation for literal article search. */
    public static String normalizeText(String value) {
        return ProductSearchTerms.normalize(value)
                .replaceAll("\\s+", " ")
                .trim();
    }

    /**
     * Product-search words. Punctuation separates words so a match cannot occur inside another
     * word (for example {@code khoa} never matches {@code khoac}).
     */
    public static List<String> productTerms(String query) {
        String normalized = normalizeText(query)
                .replaceAll("[^\\p{Alnum}]+", " ")
                .trim();
        if (normalized.isEmpty()) {
            return List.of();
        }
        return new ArrayList<>(new LinkedHashSet<>(List.of(normalized.split("\\s+")).stream()
                .map(term -> STOREFRONT_ALIASES.getOrDefault(term, term))
                .toList()));
    }

    /**
     * Article-search terms. Only whitespace splits terms; punctuation remains data and is later
     * escaped before a SQL LIKE expression is built.
     */
    public static List<String> literalTerms(String query) {
        String normalized = normalizeText(query);
        if (normalized.isEmpty()) {
            return List.of();
        }
        return new ArrayList<>(new LinkedHashSet<>(List.of(normalized.split("\\s+"))));
    }

    /** Escapes PostgreSQL LIKE wildcards for an expression that uses {@code '\\'} as escape. */
    public static String literalLikePattern(String term) {
        String safe = term == null ? "" : term
                .replace("\\", "\\\\")
                .replace("%", "\\%")
                .replace("_", "\\_");
        return "%" + safe + "%";
    }

    /** Article title/excerpt matching used by both the in-memory and database adapters. */
    public static boolean matchesLiteralTerms(Collection<String> fields, Collection<String> terms) {
        if (terms == null || terms.isEmpty()) {
            return false;
        }
        List<String> normalizedFields = fields == null
                ? List.of()
                : fields.stream().map(StorefrontSearchRules::normalizeText).filter(value -> !value.isEmpty()).toList();
        return terms.stream().allMatch(term -> normalizedFields.stream().anyMatch(field -> field.contains(term)));
    }

    public static boolean matchesProduct(Product product, String query) {
        return matchProduct(product, productTerms(query)).matches();
    }

    public static ProductMatch matchProduct(Product product, String query) {
        return matchProduct(product, productTerms(query));
    }

    public static Comparator<Product> relevanceComparator(String query) {
        List<String> terms = productTerms(query);
        return Comparator.comparing((Product product) -> matchProduct(product, terms), ProductMatch.ORDER)
                .thenComparing(product -> product.stockState() != ProductStockState.IN_STOCK)
                .thenComparing(Product::createdAt, Comparator.nullsLast(Comparator.reverseOrder()))
                .thenComparing(Product::id, Comparator.nullsLast(String::compareTo));
    }

    public static List<Product> rankMatchingProducts(Collection<Product> products, String query, int limit) {
        if (limit <= 0) {
            return List.of();
        }
        return (products == null ? List.<Product>of() : products).stream()
                .filter(product -> matchesProduct(product, query))
                .sorted(relevanceComparator(query))
                .limit(limit)
                .toList();
    }

    private static ProductMatch matchProduct(Product product, List<String> terms) {
        if (product == null || terms.isEmpty()) {
            return ProductMatch.NO_MATCH;
        }

        List<String> name = productTerms(product.name());
        List<List<String>> identifierFields = new ArrayList<>();
        identifierFields.add(name);
        identifierFields.add(productTerms(product.slug()));
        identifierFields.add(productTerms(product.slugEn()));
        identifierFields.add(productTerms(product.sku()));
        identifierFields.add(PRODUCT_MARKERS);
        if (product.translations() != null && product.translations().en() != null) {
            identifierFields.add(productTerms(product.translations().en().name()));
        }
        if (product.variants() != null) {
            product.variants().forEach(variant -> {
                if (variant != null) {
                    identifierFields.add(productTerms(variant.sku()));
                    if (variant.options() != null) {
                        variant.options().forEach(option -> {
                            if (option != null) {
                                identifierFields.add(productTerms(
                                        safe(option.name()) + " " + safe(option.value())));
                            }
                        });
                    }
                }
            });
        }

        List<List<String>> brandAndCategoryFields = new ArrayList<>();
        if (product.brand() != null) {
            brandAndCategoryFields.add(productTerms(product.brand().name()));
            brandAndCategoryFields.add(productTerms(product.brand().slug()));
        }
        if (product.categories() != null) {
            product.categories().forEach(category -> {
                if (category != null) {
                    brandAndCategoryFields.add(productTerms(category.name()));
                    brandAndCategoryFields.add(productTerms(category.slug()));
                    brandAndCategoryFields.add(productTerms(category.slugEn()));
                }
            });
        }

        Set<String> matchedTerms = new HashSet<>();
        collectMatchedTerms(matchedTerms, terms, identifierFields);
        collectMatchedTerms(matchedTerms, terms, brandAndCategoryFields);
        int coverage = matchedTerms.size();
        int requiredCoverage = (terms.size() / 2) + 1;
        if (coverage < requiredCoverage) {
            return new ProductMatch(coverage, Integer.MAX_VALUE, false);
        }

        int tier = phraseStartsAt(name, terms, 0)
                ? 1
                : phraseInside(name, terms)
                    ? 2
                    : brandAndCategoryFields.stream().anyMatch(field -> phraseInside(field, terms))
                        ? 3
                        : 4;
        return new ProductMatch(coverage, tier, true);
    }

    private static void collectMatchedTerms(
            Set<String> matchedTerms,
            List<String> terms,
            List<List<String>> fields
    ) {
        for (String term : terms) {
            if (fields.stream().anyMatch(field -> field.contains(term))) {
                matchedTerms.add(term);
            }
        }
    }

    private static String safe(String value) {
        return value == null ? "" : value;
    }

    private static boolean phraseInside(List<String> field, List<String> phrase) {
        if (field.size() < phrase.size()) {
            return false;
        }
        for (int index = 0; index <= field.size() - phrase.size(); index++) {
            if (phraseStartsAt(field, phrase, index)) {
                return true;
            }
        }
        return false;
    }

    private static boolean phraseStartsAt(List<String> field, List<String> phrase, int index) {
        if (index < 0 || field.size() - index < phrase.size()) {
            return false;
        }
        for (int offset = 0; offset < phrase.size(); offset++) {
            if (!field.get(index + offset).equals(phrase.get(offset))) {
                return false;
            }
        }
        return true;
    }

    /** Relevance result: more query coverage first, then the documented match tier. */
    public record ProductMatch(int coverage, int tier, boolean matches) {
        private static final ProductMatch NO_MATCH = new ProductMatch(0, Integer.MAX_VALUE, false);
        private static final Comparator<ProductMatch> ORDER = Comparator
                .comparingInt(ProductMatch::coverage).reversed()
                .thenComparingInt(ProductMatch::tier);
    }
}
