package com.bigbike.bigbike_backend.service.catalog;

import com.bigbike.bigbike_backend.domain.catalog.Brand;
import com.bigbike.bigbike_backend.domain.catalog.CatalogFacets;
import com.bigbike.bigbike_backend.domain.catalog.Category;
import com.bigbike.bigbike_backend.domain.catalog.Product;
import com.bigbike.bigbike_backend.domain.catalog.ProductHighlights;
import com.bigbike.bigbike_backend.service.common.SortDirection;
import com.bigbike.bigbike_backend.service.common.SortSpec;
import java.math.BigDecimal;
import java.text.Collator;
import java.text.Normalizer;
import java.util.Comparator;
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
 * <p>Mapping (domain → list-view DTO), facet/price-band/gender building, query/color/
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

    /**
     * Display name lookup for color base slugs (output of {@link #colorBaseSlug}).
     * Covers all 86 distinct color slugs currently in product_variant_options.
     * Slugs that merge via suffix stripping (e.g. "xam-2" → "xam") share one entry.
     */
    private static final Map<String, String> COLOR_SLUG_LABELS_VI = Map.ofEntries(
            Map.entry("cam",               "Cam"),
            Map.entry("cam-den-trang",     "Cam đen trắng"),
            Map.entry("camo",              "Camo"),
            Map.entry("camo-nhat",         "Camo nhạt"),
            Map.entry("carbon",            "Carbon"),
            Map.entry("carbon-3k-bong",    "Carbon 3K bóng"),
            Map.entry("carbon-3k-nham",    "Carbon 3K nhám"),
            Map.entry("carbon-9k-bong",    "Carbon 9K bóng"),
            Map.entry("carbon-forged-bong","Carbon Forged bóng"),
            Map.entry("carbon-forged-nham","Carbon Forged nhám"),
            Map.entry("carbon-tem-bac",    "Carbon tem bạc"),
            Map.entry("carbon-tem-do",     "Carbon tem đỏ"),
            Map.entry("cyborg-blue",       "CYBORG BLUE"),
            Map.entry("cyborg-gray",       "CYBORG GRAY"),
            Map.entry("day1-green",        "DAY1 GREEN"),
            Map.entry("day1-orange",       "DAY1 ORANGE"),
            Map.entry("den",               "Đen"),
            Map.entry("den-bong",          "Đen bóng"),
            Map.entry("den-cam",           "Đen cam"),
            Map.entry("den-camo",          "Đen CAMO"),
            Map.entry("den-camo-do",       "ĐEN CAMO ĐỎ"),
            Map.entry("den-camo-trang",    "ĐEN CAMO TRẮNG"),
            Map.entry("den-do",            "Đen đỏ"),
            Map.entry("den-do-trang",      "Đen đỏ trắng"),
            Map.entry("den-hong",          "Đen hồng"),
            Map.entry("den-nau",           "Đen nâu"),
            Map.entry("den-nham",          "Đen nhám"),
            Map.entry("den-phan-quang",    "Đen Phản Quang"),
            Map.entry("den-trang",         "Đen trắng"),
            Map.entry("den-trang-do",      "Đen trắng đỏ"),
            Map.entry("den-xam",           "Đen xám"),
            Map.entry("den-xanh-duong",    "Đen xanh dương"),
            Map.entry("den-xanh-la",       "Đen xanh lá"),
            Map.entry("do",                "Đỏ"),
            Map.entry("do-trang-xanh",     "Đỏ trắng xanh"),
            Map.entry("forged-cacbon-nham","Forged carbon nhám"),
            Map.entry("guong",             "Gương"),
            Map.entry("khaki",             "KHAKI"),
            Map.entry("mcphee",            "McPhee"),
            Map.entry("mythology-gold",    "MYTHOLOGY GOLD"),
            Map.entry("mythology-red",     "MYTHOLOGY RED"),
            Map.entry("mythology-silver",  "MYTHOLOGY SILVER"),
            Map.entry("nau",               "Nâu"),
            Map.entry("nerve",             "Nerve"),
            Map.entry("ronin-blue",        "RONIN BLUE"),
            Map.entry("ronin-red",         "RONIN RED"),
            Map.entry("soc",               "Sọc"),
            Map.entry("sprinter",          "Sprinter"),
            Map.entry("super-mecha-gold",  "SUPER MECHA GOLD"),
            Map.entry("super-mecha-red",   "SUPER MECHA RED"),
            Map.entry("tem-do",            "Tem đỏ"),
            Map.entry("tem-trang",         "Tem trắng"),
            Map.entry("tem-xam",           "Tem xám"),
            Map.entry("trang",             "Trắng"),
            Map.entry("trang-bong",        "Trắng bóng"),
            Map.entry("trang-vang",        "Trắng/Vàng"),
            Map.entry("trang-xam",         "Trắng xám"),
            Map.entry("trang-xanh-la",     "Trắng/Xanh lá"),
            Map.entry("vang",              "Vàng"),
            Map.entry("vang-neon",         "Vàng NEON"),
            Map.entry("war-damaged-gray",  "WAR DAMAGED GRAY"),
            Map.entry("xam",               "Xám"),
            Map.entry("xam-bong",          "Xám bóng"),
            Map.entry("xam-do",            "Xám/Đỏ"),
            Map.entry("xam-vang",          "Xám vàng"),
            Map.entry("xanh",              "Xanh"),
            Map.entry("xanh-duong",       "Xanh Dương"),
            Map.entry("xanh-army",         "Xanh army"),
            Map.entry("xanh-dam",          "Xanh đậm"),
            Map.entry("xanh-dam-om",       "Xanh đậm ôm"),
            Map.entry("xanh-dam-suong",    "Xanh đậm suông"),
            Map.entry("xanh-duong-cam",    "Xanh dương/Cam"),
            Map.entry("xanh-la",           "Xanh lá"),
            Map.entry("xanh-la-xam",       "Xanh lá/Xám"),
            Map.entry("xanh-mecha",        "Xanh Mecha"),
            Map.entry("xanh-nhat",         "Xanh nhạt"),
            Map.entry("xanh-nhat-om",      "Xanh nhạt ôm"),
            Map.entry("xanh-nhat-suong",   "Xanh nhạt suông"),
            Map.entry("xanh-om",           "Xanh ôm"),
            Map.entry("xanh-reu",          "Xanh rêu"),
            Map.entry("xanh-reu-den",      "Xanh rêu/Đen"),
            Map.entry("xanh-vang",         "Xanh vàng")
    );

    private static final Map<String, String> COLOR_SLUG_LABELS_EN = Map.ofEntries(
            Map.entry("cam",        "Orange"),
            Map.entry("den",        "Black"),
            Map.entry("den-bong",   "Black gloss"),
            Map.entry("den-nham",   "Black matte"),
            Map.entry("do",         "Red"),
            Map.entry("nau",        "Brown"),
            Map.entry("soc",        "Striped"),
            Map.entry("trang",      "White"),
            Map.entry("trang-bong", "White gloss"),
            Map.entry("vang",       "Yellow"),
            Map.entry("xam",        "Gray"),
            Map.entry("xam-bong",   "Gray gloss"),
            Map.entry("xanh",       "Blue"),
            Map.entry("xanh-la",    "Green"),
            Map.entry("xanh-reu",   "Olive")
    );

    /** Fixed price bands — 7 dải chuẩn WP, đơn vị VND, khớp với legacy widget. */
    private static final List<PriceBand> PRICE_BANDS = List.of(
            new PriceBand("0-500k",   "0 - 500.000 VND",           "0 - 500.000 VND",            0L,         500_000L),
            new PriceBand("500k-1tr", "500.000 - 1.000.000 VND",   "500.000 - 1.000.000 VND",    500_000L,   1_000_000L),
            new PriceBand("1-2tr",    "1.000.000 - 2.000.000 VND", "1.000.000 - 2.000.000 VND",  1_000_000L, 2_000_000L),
            new PriceBand("2-3tr",    "2.000.000 - 3.000.000 VND", "2.000.000 - 3.000.000 VND",  2_000_000L, 3_000_000L),
            new PriceBand("3-5tr",    "3.000.000 - 5.000.000 VND", "3.000.000 - 5.000.000 VND",  3_000_000L, 5_000_000L),
            new PriceBand("5-10tr",   "5.000.000 - 10.000.000 VND","5.000.000 - 10.000.000 VND", 5_000_000L, 10_000_000L),
            new PriceBand("tren-10tr","Trên 10.000.000 VND",        "Over 10.000.000 VND",        10_000_000L, null)
    );

    private static final List<GenderFacet> GENDER_FACETS = List.of(
            new GenderFacet("Nam",    "Nam",    "Male"),
            new GenderFacet("Nữ",    "Nữ",    "Female"),
            new GenderFacet("Unisex","Unisex", "Unisex")
    );

    private record GenderFacet(String slug, String labelVi, String labelEn) {
    }

    private record PriceBand(String key, String label, String labelEn, Long min, Long max) {
    }

    /**
     * Domain projection: a full {@link Product} → its list-view shape.
     *
     * <p>Drops the detail-only payload the storefront catalog list does not
     * render — {@code description}, {@code gallery}, {@code videos},
     * {@code contentBottom}, {@code seo}. Variants are reduced to stubs (see {@link #toVariantStub}):
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
                p.stockQuantity(),
                p.forceOutOfStock(),
                p.publishStatus(),
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
                null,                       // specificationsHtml — detail only
                null,                       // specStatsHtml — detail only
                null,                       // trustBadgesHtml — detail only
                null,                       // quickAnswerSummary — detail only
                p.gender(),
                List.of(),                  // relatedProducts — detail only
                List.of(),                  // accessoryProducts — detail only
                null,                       // descriptionBlocks — detail only
                null,                       // suitabilitySection — detail only
                null,                       // sizeGuideSection — detail only
                null,                       // seo — detail only
                null,                       // translations — admin detail read only
                p.createdAt(),
                p.updatedAt()
        );
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
                v.stockQuantity(),
                null,
                List.of(),
                v.isAvailable()
        );
    }

    /** EN-with-Vietnamese-fallback per PRODUCT_RULE_002 for fixed facet labels. */
    private static String pick(String base, String en, String locale) {
        return "en".equalsIgnoreCase(locale) && en != null && !en.isBlank() ? en : base;
    }

    static List<CatalogFacets.FacetBucket> buildColorBuckets(List<Product> products, String locale) {
        // Scan all variant color options; group by base slug (strips -2/-3 suffixes).
        Map<String, Set<String>> baseToProductIds = new HashMap<>();
        for (Product product : products) {
            if (product.variants() == null) continue;
            product.variants().stream()
                    .filter(Objects::nonNull)
                    .filter(v -> v.options() != null)
                    .flatMap(v -> v.options().stream())
                    .filter(Objects::nonNull)
                    .filter(opt -> isColorOption(opt.name())
                            && opt.value() != null && !opt.value().isBlank())
                    .map(opt -> colorBaseSlug(opt.value()))
                    .filter(slug -> !slug.isBlank())
                    .forEach(slug ->
                            baseToProductIds.computeIfAbsent(slug, k -> new HashSet<>())
                                    .add(product.id()));
        }
        return baseToProductIds.entrySet().stream()
                .map(e -> new CatalogFacets.FacetBucket(
                        e.getKey(),
                        resolveColorLabel(e.getKey(), locale),
                        null,
                        e.getValue().size()))
                .filter(b -> b.count() > 0)
                .sorted(Comparator.comparingLong(CatalogFacets.FacetBucket::count).reversed())
                .toList();
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

    static boolean matchesGender(Product product, String filterGender) {
        if (filterGender == null || filterGender.isBlank()) return true;
        return filterGender.equalsIgnoreCase(product.gender());
    }

    static List<CatalogFacets.PriceBucket> buildPriceBuckets(List<Product> products, String locale) {
        return PRICE_BANDS.stream()
                .map(band -> new CatalogFacets.PriceBucket(
                        band.key(),
                        pick(band.label(), band.labelEn(), locale),
                        band.min(),
                        band.max(),
                        products.stream().filter(p -> matchesPrice(p, band.min(), band.max())).count()
                ))
                .toList();
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

    static boolean matchesQuery(Product product, String q) {
        if (q == null || q.isBlank()) {
            return true;
        }
        String term = q.toLowerCase(Locale.ROOT);
        return product.name().toLowerCase(Locale.ROOT).contains(term)
                || (product.shortDescription() != null && product.shortDescription().toLowerCase(Locale.ROOT).contains(term));
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
     * Price filtering and sorting use the parent product price only. Variant
     * prices are intentionally ignored so list-page filter results stay
     * consistent with the price the storefront displays.
     */
    static BigDecimal effectivePrice(Product product) {
        if (product.price() == null) {
            return null;
        }
        return product.price().retailPrice();
    }

    static boolean isColorOption(String name) {
        String normalizedName = normalize(name);
        return normalizedName.contains("color")
                || normalizedName.contains("colour")
                || normalizedName.contains("mau");
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

    static String resolveColorLabel(String baseSlug, String locale) {
        if ("en".equalsIgnoreCase(locale)) {
            String en = COLOR_SLUG_LABELS_EN.get(baseSlug);
            if (en != null) return en;
        }
        String vi = COLOR_SLUG_LABELS_VI.get(baseSlug);
        return vi != null ? vi : formatColorSlug(baseSlug);
    }

    static String formatColorSlug(String slug) {
        if (slug == null || slug.isBlank()) return "";
        String[] parts = slug.split("-");
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < parts.length; i++) {
            if (i > 0) sb.append(' ');
            if (!parts[i].isEmpty()) {
                sb.append(Character.toUpperCase(parts[i].charAt(0)));
                sb.append(parts[i].substring(1));
            }
        }
        return sb.toString();
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
