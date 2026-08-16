package com.bigbike.bigbike_backend.service.catalog;

import com.bigbike.bigbike_backend.domain.catalog.Brand;
import com.bigbike.bigbike_backend.domain.catalog.CatalogFacets;
import com.bigbike.bigbike_backend.domain.catalog.Category;
import com.bigbike.bigbike_backend.domain.catalog.Product;
import com.bigbike.bigbike_backend.domain.catalog.ProductGenderSupport;
import com.bigbike.bigbike_backend.domain.catalog.ProductHighlights;
import com.bigbike.bigbike_backend.domain.catalog.SeoMeta;
import com.bigbike.bigbike_backend.repository.catalog.ProductSearchTerms;
import com.bigbike.bigbike_backend.service.common.SortDirection;
import com.bigbike.bigbike_backend.service.common.SortSpec;
import java.math.BigDecimal;
import java.text.Collator;
import java.text.Normalizer;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

/**
 * Pure, stateless catalog read-side helpers extracted from {@code CatalogReadService}.
 *
 * <p>Mapping (domain → list-view DTO), facet/price-range/gender building, query/color/
 * price predicates, slug normalization and comparator construction. Every method here
 * takes plain arguments and touches no Spring beans, repositories or instance state, so
 * the service keeps only caching/orchestration and repository access. Imported via
 * {@code import static ...CatalogReadSupport.*;} so the service call sites stay unchanged.
 */
final class CatalogReadSupport {

    private CatalogReadSupport() {}

    static final Set<String> PRODUCT_SORT_FIELDS = Set.of("name", "price", "createdAt", "homepageOrder");
    static final Set<String> CATEGORY_SORT_FIELDS = Set.of("name", "createdAt", "sortOrder");
    static final Set<String> BRAND_SORT_FIELDS = Set.of("name", "createdAt");

    // Vietnamese collation for "sort by name" — base letter first (Á sorts near A, not after Z),
    // then diacritic/tone as a tie-break. SECONDARY strength keeps case-insensitivity (matches the
    // old String.CASE_INSENSITIVE_ORDER behaviour) while making accents significant.
    private static final Collator VI_NAME_COLLATOR = viNameCollator();

    private static Collator viNameCollator() {
        Collator collator = Collator.getInstance(new Locale("vi"));
        collator.setStrength(Collator.SECONDARY);
        return collator;
    }

    static final long PRICE_FILTER_STEP = 50_000L;
    private static final int MAX_PRICE_HISTOGRAM_BUCKETS = 24;

    private static final List<GenderFacet> GENDER_FACETS = List.of(
            new GenderFacet("Nam",    "Nam",    "Male"),
            new GenderFacet("Nữ",    "Nữ",    "Female")
    );

    private record GenderFacet(String slug, String labelVi, String labelEn) {
    }

    /**
     * Domain projection: a full {@link Product} → its list-view shape.
     *
     * <p>Drops the detail-only payload the storefront catalog list does not
     * render — {@code description}, {@code gallery}, {@code videos},
     * {@code contentBottom}. Variants are reduced to stubs (see {@link #toVariantStub}):
     * the card needs the variant <em>count</em> to choose the buy-box button,
     * but never reads variant internals on a list. {@code shortDescription} is
     * kept — it is the card subtitle. Stock masking already happened upstream
     * in the repository's public-view mapper, so this transform is pure.
     */
    static Product toListView(Product p) {
        return new Product(
                p.id(),
                p.sku(),
                p.slug(),
                p.slugEn(),
                p.name(),
                p.shortDescription(),
                null,                       // description — detail only
                p.brand(),
                p.category(),
                p.categories(),
                p.image(),
                List.of(),                  // gallery — detail only
                List.of(),                  // videos — detail only
                p.price(),
                p.variants() == null
                        ? List.of()
                        : p.variants().stream().map(CatalogReadSupport::toVariantStub).toList(),
                p.stockState(),
                p.available(),
                p.publishStatus(),
                p.discontinued(),
                p.sizeScaleId(),
                p.homepageBlock(),
                p.homepageOrder(),
                p.rating(),
                p.ratingCount(),
                List.of(),                  // faqs — detail only
                List.of(),                  // commitments — detail only
                ProductHighlights.EMPTY,    // highlights — detail only
                null,                       // originBrandCountry — detail only
                null,                       // sizeGuide — detail only
                null,                       // suitabilityAdvisory — detail only
                null,                       // specifications — detail only
                null,                       // specStats — detail only
                null,                       // trustBadges — detail only
                null,                       // quickAnswerSummary — detail only
                p.genders(),
                List.of(),                  // relatedProducts — detail only
                List.of(),                  // accessoryProducts — detail only
                null,                       // descriptionBlocks — detail only
                null,                       // suitabilitySection — detail only
                null,                       // sizeGuideSection — detail only
                toListSeo(p.seo()),         // seo — CHỈ giữ noIndex (V371), phần còn lại là detail-only
                null,                       // translations — admin detail read only
                p.createdAt(),
                p.updatedAt()
        );
    }

    /**
     * V371 — danh sách phải mang được cờ {@code noIndex} để {@code sitemap.xml} lọc mà không phải
     * gọi API chi tiết cho từng mục (BUSINESS_RULES {@code SEO_RULE_001}/{@code SEO_RULE_002}).
     *
     * <p>Chỉ giữ đúng {@code noIndex}; title/description/canonical/ogImage vẫn là detail-only nên
     * để {@code null}. Trả {@code null} khi không có gì để nói (noIndex = false) để payload danh
     * sách không phình thêm object rỗng.
     */
    private static SeoMeta toListSeo(SeoMeta seo) {
        if (seo == null || !seo.noIndex()) {
            return null;
        }
        return new SeoMeta(null, null, null, null, true);
    }

    /**
     * A variant stripped to its list-view essentials: id/sku/name/price/stock/
     * availability. {@code options}, {@code gallery} and {@code image} — which
     * make up the bulk of the old list payload — are cleared; they are only
     * needed by the product detail endpoint.
     */
    private static com.bigbike.bigbike_backend.domain.catalog.ProductVariant toVariantStub(
            com.bigbike.bigbike_backend.domain.catalog.ProductVariant v) {
        return new com.bigbike.bigbike_backend.domain.catalog.ProductVariant(
                v.id(),
                v.sku(),
                v.name(),
                List.of(),
                v.price(),
                v.stockState(),
                null,
                List.of(),
                v.isAvailable()
        );
    }

    /** EN-with-Vietnamese-fallback per PRODUCT_RULE_002 for fixed facet labels. */
    private static String pick(String base, String en, String locale) {
        return "en".equalsIgnoreCase(locale) && en != null && !en.isBlank() ? en : base;
    }

    static List<CatalogFacets.FacetBucket> buildGenderBuckets(List<Product> products, String locale) {
        return GENDER_FACETS.stream()
                .map(g -> new CatalogFacets.FacetBucket(
                        g.slug(),
                        pick(g.labelVi(), g.labelEn(), locale),
                        null,
                        products.stream().filter(p -> matchesGender(p, g.slug())).count()
                ))
                .filter(b -> b.count() > 0)
                .toList();
    }

    /**
     * Legacy flat size facet retained for old clients. New clients should render
     * {@link #buildSizeGroups(List, SizeScaleCatalog, String)} so equal values from
     * different scale families do not become ambiguous links.
     */
    static List<CatalogFacets.FacetBucket> buildSizeBuckets(List<Product> products) {
        return buildLegacySizeBuckets(products, new SizeScaleCatalog(List.of()), "vi");
    }

    static List<CatalogFacets.FacetBucket> buildLegacySizeBuckets(
            List<Product> products,
            SizeScaleCatalog catalog,
            String locale
    ) {
        Map<String, Set<String>> productIdsByValue = new HashMap<>();
        Map<String, SizeBucketMeta> metadata = new HashMap<>();
        for (Product product : products == null ? List.<Product>of() : products) {
            if (product == null || product.id() == null) continue;
            for (SizeScaleCatalog.ResolvedSize resolved : catalog.resolve(product)) {
                if (resolved == null || resolved.value() == null) continue;
                String valueKey = SizeScaleCatalog.normalizeValue(resolved.value().key());
                if (valueKey.isBlank()) continue;
                productIdsByValue.computeIfAbsent(valueKey, ignored -> new HashSet<>()).add(product.id());
                metadata.putIfAbsent(valueKey, new SizeBucketMeta(
                        resolved.value().localizedLabel(locale), resolved.value().sortOrder()));
            }
        }
        return productIdsByValue.entrySet().stream()
                .map(entry -> {
                    SizeBucketMeta meta = metadata.get(entry.getKey());
                    return new CatalogFacets.FacetBucket(
                            entry.getKey(),
                            meta == null ? entry.getKey() : meta.label(),
                            null,
                            entry.getValue().size());
                })
                .sorted(Comparator.comparingInt((CatalogFacets.FacetBucket bucket) ->
                                metadata.getOrDefault(bucket.key(), new SizeBucketMeta(bucket.label(), Integer.MAX_VALUE)).sortOrder())
                        .thenComparing(CatalogFacets.FacetBucket::key))
                .toList();
    }

    /** Builds the data-driven grouped size facet in configured display order. */
    static List<CatalogFacets.SizeGroupFacet> buildSizeGroups(
            List<Product> products,
            SizeScaleCatalog catalog,
            String locale
    ) {
        if (catalog == null || catalog.scales().isEmpty()) return List.of();

        Map<String, Set<String>> productIdsByToken = new HashMap<>();
        Map<String, SizeScaleCatalog.ResolvedSize> resolvedByToken = new HashMap<>();
        for (Product product : products == null ? List.<Product>of() : products) {
            if (product == null || product.id() == null) continue;
            for (SizeScaleCatalog.ResolvedSize resolved : catalog.resolve(product)) {
                if (resolved == null || resolved.token() == null || resolved.token().isBlank()
                        || resolved.scale() == null || resolved.scale().group() == null) {
                    continue;
                }
                productIdsByToken.computeIfAbsent(resolved.token(), ignored -> new HashSet<>()).add(product.id());
                resolvedByToken.putIfAbsent(resolved.token(), resolved);
            }
        }

        Map<String, SizeGroupAccumulator> groups = new LinkedHashMap<>();
        for (Map.Entry<String, Set<String>> entry : productIdsByToken.entrySet()) {
            SizeScaleCatalog.ResolvedSize resolved = resolvedByToken.get(entry.getKey());
            if (resolved == null || resolved.scale() == null || resolved.scale().group() == null) continue;
            var group = resolved.scale().group();
            SizeGroupAccumulator groupAccumulator = groups.computeIfAbsent(group.key(), ignored ->
                    new SizeGroupAccumulator(group.key(), group.localizedLabel(locale), group.sortOrder()));
            var value = resolved.value();
            SizeBucketAccumulator bucket = new SizeBucketAccumulator(
                    resolved.token(),
                    SizeScaleCatalog.normalizeValue(value.key()),
                    value.localizedLabel(locale),
                    entry.getValue().size(),
                    value.sortOrder());
            // Public filters are intentionally one flat value list per group. The
            // subgroup columns remain only as migration compatibility data and are
            // not rendered or exposed by the public facet contract.
            groupAccumulator.buckets.putIfAbsent(bucket.key(), bucket);
        }

        return groups.values().stream()
                .sorted(Comparator.comparingInt(SizeGroupAccumulator::sortOrder)
                        .thenComparing(SizeGroupAccumulator::key))
                .map(group -> new CatalogFacets.SizeGroupFacet(
                        group.key,
                        group.label,
                        group.buckets.values().stream()
                                .sorted(SizeBucketAccumulator.ORDER)
                                .map(SizeBucketAccumulator::toFacet)
                                .toList()))
                .filter(group -> !group.buckets().isEmpty())
                .toList();
    }

    private record SizeBucketMeta(String label, int sortOrder) {
    }

    private static final class SizeGroupAccumulator {
        private final String key;
        private final String label;
        private final int sortOrder;
        private final Map<String, SizeBucketAccumulator> buckets = new LinkedHashMap<>();

        private SizeGroupAccumulator(String key, String label, int sortOrder) {
            this.key = key;
            this.label = label;
            this.sortOrder = sortOrder;
        }

        private String key() { return key; }

        private int sortOrder() { return sortOrder; }
    }

    private record SizeBucketAccumulator(
            String key,
            String valueKey,
            String label,
            long count,
            int sortOrder
    ) {
        private static final Comparator<SizeBucketAccumulator> ORDER =
                Comparator.comparingInt(SizeBucketAccumulator::sortOrder)
                        .thenComparing(SizeBucketAccumulator::valueKey)
                        .thenComparing(SizeBucketAccumulator::key);

        private CatalogFacets.SizeBucket toFacet() {
            return new CatalogFacets.SizeBucket(key, valueKey, label, count);
        }
    }

    static boolean matchesGender(Product product, List<String> filterGenders) {
        List<String> active = ProductGenderSupport.firstSupported(filterGenders);
        if (active.isEmpty()) return true;
        return active.stream().anyMatch(value -> ProductGenderSupport.contains(product.genders(), value));
    }

    static boolean matchesGender(Product product, String filterGender) {
        return matchesGender(product, filterGender == null ? List.of() : List.of(filterGender));
    }

    static CatalogFacets.PriceRange buildPriceRange(List<Product> products) {
        List<Long> prices = (products == null ? List.<Product>of() : products).stream()
                .map(CatalogReadSupport::effectivePrice)
                .filter(Objects::nonNull)
                .filter(price -> price.signum() > 0)
                .map(BigDecimal::longValue)
                .toList();
        if (prices.isEmpty()) return null;

        long min = prices.stream().mapToLong(Long::longValue).min().orElse(0L);
        long max = prices.stream().mapToLong(Long::longValue).max().orElse(0L);
        if (min == max) return null;

        long span = max - min;
        int bucketCount = Math.min(MAX_PRICE_HISTOGRAM_BUCKETS,
                Math.max(1, (int) Math.ceil((double) span / PRICE_FILTER_STEP)));
        List<CatalogFacets.PriceHistogramBucket> buckets = new ArrayList<>(bucketCount);
        for (int index = 0; index < bucketCount; index++) {
            long bucketMin = min + (span * index) / bucketCount;
            long bucketMax = index == bucketCount - 1
                    ? max
                    : min + (span * (index + 1)) / bucketCount - 1;
            long count = prices.stream()
                    .filter(price -> price >= bucketMin && price <= bucketMax)
                    .count();
            buckets.add(new CatalogFacets.PriceHistogramBucket(bucketMin, bucketMax, count));
        }
        return new CatalogFacets.PriceRange(min, max, PRICE_FILTER_STEP, buckets);
    }

    static boolean matchesCategory(Product product, String categorySlug) {
        if (categorySlug == null || categorySlug.isBlank()) {
            return true;
        }
        return product.categories() != null && product.categories().stream()
                .anyMatch(category -> category.slug().equals(categorySlug));
    }

    /**
     * Same as {@link #matchesCategory(Product, String)} but against a pre-resolved set of
     * self + descendant slugs (CATEGORY_RULE_006), for the in-memory filter path used when a
     * color filter is present. {@code null} allowedSlugs means "no category filter".
     */
    static boolean matchesCategoryOrDescendants(Product product, Set<String> allowedSlugs) {
        if (allowedSlugs == null) {
            return true;
        }
        return product.categories() != null && product.categories().stream()
                .anyMatch(category -> allowedSlugs.contains(category.slug()));
    }

    static boolean matchesBrand(Product product, String brandSlug) {
        if (brandSlug == null || brandSlug.isBlank()) {
            return true;
        }
        return product.brand() != null && product.brand().slug().equals(brandSlug);
    }

    static boolean matchesBrand(Product product, List<String> brandSlugs) {
        if (brandSlugs == null || brandSlugs.isEmpty()) return true;
        return product.brand() != null && brandSlugs.contains(product.brand().slug());
    }

    static boolean matchesQuery(Product product, String q) {
        if (q == null || q.isBlank()) {
            return true;
        }
        List<String> terms = ProductSearchTerms.tokens(q);
        if (terms.isEmpty()) return false;
        String searchable = ProductSearchTerms.normalize(String.join(" ", List.of(
                product.name() == null ? "" : product.name(),
                product.slug() == null ? "" : product.slug(),
                product.slugEn() == null ? "" : product.slugEn(),
                product.sku() == null ? "" : product.sku(),
                product.shortDescription() == null ? "" : product.shortDescription())));
        return terms.stream().allMatch(searchable::contains);
    }

    static boolean matchesColor(Product product, String filterColor) {
        if (filterColor == null || filterColor.isBlank()) return true;
        String expectedBase = colorBaseSlug(filterColor);
        if (expectedBase.isBlank()) return true;
        if (product.variants() == null || product.variants().isEmpty()) return false;
        return product.variants().stream()
                .filter(Objects::nonNull)
                .filter(v -> v.options() != null && !v.options().isEmpty())
                .anyMatch(v -> v.options().stream()
                        .filter(Objects::nonNull)
                        .anyMatch(opt -> isColorOption(opt.name())
                                && colorBaseSlug(opt.value()).equals(expectedBase)));
    }

    static boolean matchesSize(Product product, String filterSize) {
        if (filterSize == null || filterSize.isBlank()) return true;
        String expected = normalizeSizeValue(filterSize);
        if (expected.isBlank() || product == null || product.variants() == null) return false;
        return product.variants().stream()
                .filter(Objects::nonNull)
                .filter(variant -> variant.options() != null)
                .flatMap(variant -> variant.options().stream())
                .filter(Objects::nonNull)
                .filter(option -> isSizeOption(option.name()))
                .anyMatch(option -> expected.equals(normalizeSizeValue(option.value())));
    }

    static boolean matchesPrice(Product product, Long minPrice, Long maxPrice) {
        if (minPrice == null && maxPrice == null) {
            return true;
        }

        BigDecimal price = effectivePrice(product);
        if (price == null) {
            return false;
        }

        if (minPrice != null && price.compareTo(BigDecimal.valueOf(minPrice)) < 0) {
            return false;
        }
        if (maxPrice != null && price.compareTo(BigDecimal.valueOf(maxPrice)) > 0) {
            return false;
        }
        return true;
    }

    static boolean matchesFlag(Boolean actual, Boolean expected) {
        return expected == null || Boolean.TRUE.equals(actual) == expected;
    }

    /**
     * Price filtering and sorting use the parent product's displayed price only.
     * A sale price is effective only when it is positive and strictly below retail.
     * Variant prices are intentionally ignored so list-page filters stay consistent
     * with the price the storefront displays.
     */
    static BigDecimal effectivePrice(Product product) {
        if (product == null || product.price() == null) {
            return null;
        }
        BigDecimal retail = product.price().retailPrice();
        BigDecimal sale = product.price().salePrice();
        if (retail == null) return null;
        return sale != null && sale.signum() > 0 && sale.compareTo(retail) < 0
                ? sale
                : retail;
    }

    static boolean isColorOption(String name) {
        String normalizedName = normalize(name);
        return normalizedName.contains("color")
                || normalizedName.contains("colour")
                || normalizedName.contains("mau");
    }

    static boolean isSizeOption(String name) {
        String normalizedName = normalize(name);
        return normalizedName.contains("size")
                || normalizedName.contains("kich co")
                || normalizedName.contains("kich thuoc");
    }

    static String normalizeSizeValue(String value) {
        if (value == null) return "";
        String normalized = value.trim().replaceAll("\\s+", "").toUpperCase(Locale.ROOT);
        return "XXXL".equals(normalized) ? "3XL" : normalized;
    }

    static String normalize(String value) {
        if (value == null) {
            return "";
        }

        String normalized = Normalizer.normalize(value, Normalizer.Form.NFD)
                .replace("\u0110", "D")
                .replace("\u0111", "d")
                .replaceAll("\\p{M}+", "");

        return normalized.toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9]+", " ")
                .trim();
    }

    /**
     * Converts a raw color option value to a normalised base slug for grouping/filtering.
     * Strips Vietnamese diacritics, lower-cases, replaces non-alphanumeric runs with "-",
     * and removes a trailing -{number} suffix so "xam-2" and "xam" map to the same bucket.
     */
    static String colorBaseSlug(String value) {
        if (value == null || value.isBlank()) return "";
        return Normalizer.normalize(value.trim(), Normalizer.Form.NFD)
                .replace("\u0110", "D").replace("\u0111", "d")
                .replaceAll("\\p{M}+", "")
                .toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9]+", "-")
                .replaceAll("-{2,}", "-")
                .replaceAll("(^-|-$)", "")
                .replaceFirst("-\\d+$", "");
    }

    static Comparator<Product> productComparator(SortSpec sortSpec) {
        // homepageOrder pins manually-ordered products to the top; unpinned (null) fall to the
        // bottom and are tie-broken by newest-first so recently-added stock surfaces above
        // long-tail unpinned items. Direction (asc/desc) only flips the pinned section.
        if ("homepageOrder".equals(sortSpec.field())) {
            Comparator<Product> pinned = Comparator.comparing(
                    Product::homepageOrder,
                    Comparator.nullsLast(Comparator.naturalOrder())
            );
            if (sortSpec.direction() == SortDirection.DESC) {
                pinned = Comparator.comparing(
                        Product::homepageOrder,
                        Comparator.nullsLast(Comparator.reverseOrder())
                );
            }
            return pinned.thenComparing(Product::createdAt, Comparator.reverseOrder());
        }

        Comparator<Product> comparator = switch (sortSpec.field()) {
            case "name" -> Comparator.comparing(Product::name, VI_NAME_COLLATOR::compare);
            case "price" -> Comparator.comparing(
                    CatalogReadSupport::effectivePrice,
                    Comparator.nullsLast(Comparator.naturalOrder())
            );
            case "createdAt" -> Comparator.comparing(Product::createdAt);
            default -> throw new IllegalStateException("Unsupported sort field.");
        };
        Comparator<Product> directed = sortSpec.direction() == SortDirection.DESC ? comparator.reversed() : comparator;
        // Tie-break by id (always ascending) so products sharing an identical name/price/createdAt
        // render in a stable order across requests.
        return directed.thenComparing(Product::id);
    }

    static Comparator<Category> categoryComparator(SortSpec sortSpec) {
        Comparator<Category> comparator = switch (sortSpec.field()) {
            case "name" -> Comparator.comparing(Category::name, String.CASE_INSENSITIVE_ORDER);
            case "createdAt" -> Comparator.comparing(Category::createdAt);
            case "sortOrder" -> Comparator.comparing(category -> category.sortOrder() == null ? Integer.MAX_VALUE : category.sortOrder());
            default -> throw new IllegalStateException("Unsupported sort field.");
        };
        Comparator<Category> directed = sortSpec.direction() == SortDirection.DESC ? comparator.reversed() : comparator;
        // Tie-break by name (case-insensitive, ascending) when ordering by sortOrder so categories
        // sharing the same sortOrder render in a stable order matching the admin category tree
        // (admin tree orders siblings by sortOrder then name). The name tie-break stays ascending
        // even under sortOrder:desc.
        if ("sortOrder".equals(sortSpec.field())) {
            return directed.thenComparing(Category::name, String.CASE_INSENSITIVE_ORDER);
        }
        return directed;
    }

    static Comparator<Brand> brandComparator(SortSpec sortSpec) {
        Comparator<Brand> comparator = switch (sortSpec.field()) {
            case "name" -> Comparator.comparing(Brand::name, String.CASE_INSENSITIVE_ORDER);
            case "createdAt" -> Comparator.comparing(Brand::createdAt);
            default -> throw new IllegalStateException("Unsupported sort field.");
        };
        return sortSpec.direction() == SortDirection.DESC ? comparator.reversed() : comparator;
    }
}
