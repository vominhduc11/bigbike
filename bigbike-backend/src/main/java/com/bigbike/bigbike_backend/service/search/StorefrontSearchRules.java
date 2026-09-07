package com.bigbike.bigbike_backend.service.search;

import com.bigbike.bigbike_backend.domain.catalog.Product;
import com.bigbike.bigbike_backend.domain.catalog.ProductStockState;
import com.bigbike.bigbike_backend.domain.catalog.ProductVariantOption;
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
 *
 * <p>The <b>last</b> query word is the word the customer is still typing, so it matches by word
 * prefix ({@code SEARCH_RULE_002}). That is what makes the result set narrow monotonically —
 * {@code kom} ⊇ {@code komi} ⊇ {@code komine} — instead of collapsing to empty mid-typing.
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
     *
     * <p>Markers are synthetic, not real product data, so a <b>single</b> in-progress word never
     * prefix-matches them ({@code SEARCH_RULE_002}): otherwise "s" would match "san" and "m" would
     * match "moi", and every product in the catalogue would match one letter. Once the customer has
     * committed at least one complete word, the trailing word may prefix-match a marker, which
     * keeps "sản ph" → "sản phẩm" narrowing instead of blanking.
     */
    private static final List<String> PRODUCT_MARKERS = List.of("san", "pham", "hang", "moi", "product", "products", "new", "arrival");

    /**
     * Variant option labels that name a size scale. Their values ("M", "L", "XL", "42"…) repeat
     * across most of the catalogue, so matching them returns noise rather than customer intent —
     * owner decision 2026-09-07, {@code SEARCH_RULE_001}. Colour and every other option value stays
     * searchable: 51 products come in ĐEN while only 9 carry "đen" in the name.
     */
    private static final Set<String> SIZE_OPTION_LABELS = Set.of(
            "size", "sizes", "kich co", "kich thuoc", "co", "co so", "co oc");

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
     * escaped before the SQL match expression is built.
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

    /**
     * Article title/excerpt matching used by both the in-memory and database adapters. Articles
     * follow the same word-boundary rule as products ({@code SEARCH_RULE_004}): every term but the
     * last must match a whole word, and the trailing term matches by word prefix.
     */
    public static boolean matchesLiteralTerms(Collection<String> fields, Collection<String> terms) {
        if (terms == null || terms.isEmpty()) {
            return false;
        }
        List<String> normalizedFields = fields == null
                ? List.of()
                : fields.stream().map(StorefrontSearchRules::normalizeText).filter(value -> !value.isEmpty()).toList();
        List<String> orderedTerms = List.copyOf(terms);
        int lastIndex = orderedTerms.size() - 1;
        for (int index = 0; index < orderedTerms.size(); index++) {
            String term = orderedTerms.get(index);
            boolean trailing = index == lastIndex;
            boolean matched = normalizedFields.stream()
                    .anyMatch(field -> matchesWordAt(field, term, trailing));
            if (!matched) {
                return false;
            }
        }
        return true;
    }

    /**
     * True when {@code term} starts a word inside {@code field} — and, unless {@code allowPrefix},
     * also ends that word.
     */
    private static boolean matchesWordAt(String field, String term, boolean allowPrefix) {
        if (term == null || term.isEmpty()) {
            return false;
        }
        int from = 0;
        while (true) {
            int at = field.indexOf(term, from);
            if (at < 0) {
                return false;
            }
            boolean startsWord = at == 0 || !Character.isLetterOrDigit(field.charAt(at - 1));
            int end = at + term.length();
            boolean endsWord = end == field.length() || !Character.isLetterOrDigit(field.charAt(end));
            if (startsWord && (allowPrefix || endsWord)) {
                return true;
            }
            from = at + 1;
        }
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

    /** True when the variant option names a size scale, whose values are outside the search scope. */
    static boolean isSizeOption(ProductVariantOption option) {
        return option != null && SIZE_OPTION_LABELS.contains(normalizeText(option.name()));
    }

    private static ProductMatch matchProduct(Product product, List<String> terms) {
        if (product == null || terms.isEmpty()) {
            return ProductMatch.NO_MATCH;
        }

        // Text the customer actually reads may be matched by prefix. Codes may not: a bare "ag"
        // reaches 26 products through SKU fragments but only the 2 real AGV products through names
        // and brands, which is what the customer means (owner decision 2026-09-07).
        List<String> name = productTerms(product.name());
        List<List<String>> prefixableFields = new ArrayList<>();
        prefixableFields.add(name);
        if (product.translations() != null && product.translations().en() != null) {
            prefixableFields.add(productTerms(product.translations().en().name()));
        }

        List<List<String>> codeFields = new ArrayList<>();
        codeFields.add(productTerms(product.slug()));
        codeFields.add(productTerms(product.slugEn()));
        codeFields.add(productTerms(product.sku()));
        if (product.variants() != null) {
            product.variants().forEach(variant -> {
                if (variant != null) {
                    Set<String> sizeTokens = new HashSet<>();
                    if (variant.options() != null) {
                        variant.options().forEach(option -> {
                            if (option == null) {
                                return;
                            }
                            // Option NAMES are never searchable: "Kích cỡ"/"Màu sắc" would make
                            // "kich", "co", "mau" and "sac" match the whole catalogue. Size VALUES
                            // are out of scope too; colour and the rest stay customer-visible text.
                            if (isSizeOption(option)) {
                                sizeTokens.addAll(productTerms(option.value()));
                            } else {
                                prefixableFields.add(productTerms(option.value()));
                            }
                        });
                    }
                    // Selling SKUs spell the size out ("AO-GIAP-M"), so the size would come straight
                    // back in through the code even though the option itself is out of scope —
                    // measured on live data: "m" sits in 53 products' variant SKUs, "l" in 52.
                    codeFields.add(productTerms(variant.sku()).stream()
                            .filter(token -> !sizeTokens.contains(token))
                            .toList());
                }
            });
        }

        List<List<String>> brandFields = new ArrayList<>();
        if (product.brand() != null) {
            brandFields.add(productTerms(product.brand().name()));
            brandFields.add(productTerms(product.brand().slug()));
        }
        List<List<String>> categoryFields = new ArrayList<>();
        if (product.categories() != null) {
            product.categories().forEach(category -> {
                if (category != null) {
                    categoryFields.add(productTerms(category.name()));
                    categoryFields.add(productTerms(category.slug()));
                    categoryFields.add(productTerms(category.slugEn()));
                }
            });
        }
        List<List<String>> brandAndCategoryFields = new ArrayList<>(brandFields);
        brandAndCategoryFields.addAll(categoryFields);
        prefixableFields.addAll(brandAndCategoryFields);

        Set<String> matchedTerms = new HashSet<>();
        Set<String> exactTerms = new HashSet<>();
        collectMatchedTerms(matchedTerms, exactTerms, terms, prefixableFields, true);
        collectMatchedTerms(matchedTerms, exactTerms, terms, codeFields, false);
        collectMatchedTerms(matchedTerms, exactTerms, terms, List.of(PRODUCT_MARKERS), terms.size() > 1);

        int coverage = matchedTerms.size();
        int requiredCoverage = (terms.size() / 2) + 1;
        if (coverage < requiredCoverage) {
            return new ProductMatch(coverage, Integer.MAX_VALUE, false, false);
        }

        int tier = phraseStartsAt(name, terms, 0)
                ? 1
                : brandFields.stream().anyMatch(field -> phraseStartsAt(field, terms, 0))
                    ? 2
                    : phraseInside(name, terms)
                        ? 3
                        : brandAndCategoryFields.stream().anyMatch(field -> phraseInside(field, terms))
                            ? 4
                            : 5;
        return new ProductMatch(coverage, tier, exactTerms.containsAll(matchedTerms), true);
    }

    /**
     * Records which query terms matched. The trailing term may match by word prefix when
     * {@code allowPrefixOnLastTerm} is set; every earlier term must match a whole word.
     */
    private static void collectMatchedTerms(
            Set<String> matchedTerms,
            Set<String> exactTerms,
            List<String> terms,
            List<List<String>> fields,
            boolean allowPrefixOnLastTerm
    ) {
        int lastIndex = terms.size() - 1;
        for (int index = 0; index < terms.size(); index++) {
            String term = terms.get(index);
            if (fields.stream().anyMatch(field -> field.contains(term))) {
                matchedTerms.add(term);
                exactTerms.add(term);
                continue;
            }
            if (allowPrefixOnLastTerm
                    && index == lastIndex
                    && !exactTerms.contains(term)
                    && fields.stream().anyMatch(field -> field.stream().anyMatch(word -> word.startsWith(term)))) {
                matchedTerms.add(term);
            }
        }
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
        if (index < 0 || phrase.isEmpty() || field.size() - index < phrase.size()) {
            return false;
        }
        for (int offset = 0; offset < phrase.size(); offset++) {
            String word = field.get(index + offset);
            String term = phrase.get(offset);
            boolean trailing = offset == phrase.size() - 1;
            if (trailing ? !word.startsWith(term) : !word.equals(term)) {
                return false;
            }
        }
        return true;
    }

    /**
     * Relevance result: more query coverage first, then the documented match tier, then whole-word
     * matches ahead of prefix-only ones.
     */
    public record ProductMatch(int coverage, int tier, boolean exact, boolean matches) {
        private static final ProductMatch NO_MATCH = new ProductMatch(0, Integer.MAX_VALUE, false, false);
        private static final Comparator<ProductMatch> ORDER = Comparator
                .comparingInt(ProductMatch::coverage).reversed()
                .thenComparingInt(ProductMatch::tier)
                .thenComparing(ProductMatch::exact, Comparator.reverseOrder());
    }
}
