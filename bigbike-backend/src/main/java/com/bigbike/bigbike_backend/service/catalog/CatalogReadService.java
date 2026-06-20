package com.bigbike.bigbike_backend.service.catalog;

import com.bigbike.bigbike_backend.api.error.GoneException;
import com.bigbike.bigbike_backend.api.error.NotFoundException;
import com.bigbike.bigbike_backend.domain.catalog.Brand;
import com.bigbike.bigbike_backend.domain.catalog.CatalogFacets;
import com.bigbike.bigbike_backend.domain.catalog.Category;
import com.bigbike.bigbike_backend.domain.catalog.HomepageBlock;
import com.bigbike.bigbike_backend.domain.catalog.Product;
import com.bigbike.bigbike_backend.domain.catalog.PublishStatus;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ProductJpaRepository;
import com.bigbike.bigbike_backend.repository.catalog.CatalogReadRepository;
import com.bigbike.bigbike_backend.service.common.PageResult;
import com.bigbike.bigbike_backend.service.common.PaginationService;
import com.bigbike.bigbike_backend.service.common.SortDirection;
import com.bigbike.bigbike_backend.service.common.SortParser;
import com.bigbike.bigbike_backend.service.common.SortSpec;
import java.math.BigDecimal;
import java.text.Normalizer;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
@RequiredArgsConstructor
public class CatalogReadService {

    private static final Set<String> PRODUCT_SORT_FIELDS = Set.of("name", "price", "createdAt", "homepageOrder");
    private static final Set<String> CATEGORY_SORT_FIELDS = Set.of("name", "createdAt", "sortOrder");
    private static final Set<String> BRAND_SORT_FIELDS = Set.of("name", "createdAt");

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

    private final CatalogReadRepository catalogReadRepository;
    private final SortParser sortParser;
    private final PaginationService paginationService;
    private final ProductJpaRepository productRepo;

    public PageResult<Product> listProducts(
            int page,
            int size,
            String sort,
            String category,
            String brand,
            String q,
            String filterColor,
            String filterGender,
            Long minPrice,
            Long maxPrice,
            HomepageBlock homepageBlock,
            String lang
    ) {
        SortSpec sortSpec = sortParser.parse(sort, "createdAt", SortDirection.DESC, PRODUCT_SORT_FIELDS);

        // findAllPublishedProducts() applies the PUBLISHED filter in SQL; the
        // explicit predicate below is kept as a defensive guard and is a no-op.
        // Filtering runs on the full domain object — matchesColor() needs the
        // variant options, which the list-view projection below strips out.
        List<Product> result = catalogReadRepository.findAllPublishedProducts(lang).stream()
                .filter(product -> product.publishStatus() == PublishStatus.PUBLISHED)
                .filter(product -> matchesCategory(product, category))
                .filter(product -> matchesBrand(product, brand))
                .filter(product -> matchesQuery(product, q))
                .filter(product -> matchesColor(product, filterColor))
                .filter(product -> matchesGender(product, filterGender))
                .filter(product -> matchesPrice(product, minPrice, maxPrice))
                .filter(product -> homepageBlock == null || product.homepageBlock() == homepageBlock)
                .sorted(productComparator(sortSpec))
                .toList();

        // Project only the paginated slice to the lighter list view — the
        // storefront list/card never renders description/gallery/specs/SEO or
        // variant internals (see API_CONTRACT.md "Product list"). This keeps
        // the response small without touching the filtering above.
        PageResult<Product> page0 = paginationService.paginate(result, page, size);
        return new PageResult<>(
                page0.items().stream().map(CatalogReadService::toListView).toList(),
                page0.page(),
                page0.pageSize(),
                page0.totalItems(),
                page0.totalPages()
        );
    }

    /**
     * Domain projection: a full {@link Product} → its list-view shape.
     *
     * <p>Drops the detail-only payload the storefront catalog list does not
     * render — {@code description}, {@code gallery}, {@code videos},
     * {@code specifications}, {@code contentBottom}, {@code promotionContent},
     * {@code seo}. Variants are reduced to stubs (see {@link #toVariantStub}):
     * the card needs the variant <em>count</em> to choose the buy-box button,
     * but never reads variant internals on a list. {@code shortDescription} is
     * kept — it is the card subtitle. Stock masking already happened upstream
     * in the repository's public-view mapper, so this transform is pure.
     */
    private static Product toListView(Product p) {
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
                        : p.variants().stream().map(CatalogReadService::toVariantStub).toList(),
                List.of(),                  // specifications — detail only
                p.stockState(),
                p.stockQuantity(),
                p.forceOutOfStock(),
                p.publishStatus(),
                p.homepageBlock(),
                p.homepageOrder(),
                p.rating(),
                p.ratingCount(),
                null,                       // promotionContent — detail only
                null,                       // installationGuide — detail only
                List.of(),                  // faqs — detail only
                List.of(),                  // commitments — detail only
                List.of(),                  // purchaseLines — detail only
                List.of(),                  // specStats — detail only
                List.of(),                  // trustBadges — detail only
                List.of(),                  // positiveNotes — detail only
                List.of(),                  // negativeNotes — detail only
                null,                       // originBrandCountry — detail only
                null,                       // sizeGuide — detail only
                null,                       // suitabilityAdvisory — detail only
                p.gender(),
                List.of(),                  // relatedProducts — detail only
                List.of(),                  // accessoryProducts — detail only
                null,                       // descriptionBlocks — detail only
                null,                       // tabs — detail only
                null,                       // sectionVisibility — detail only
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
                v.isAvailable(),
                v.trackSerials()
        );
    }

    public Product getProductBySlug(String slug, String lang) {
        Optional<Product> published = catalogReadRepository.findProductBySlug(slug, lang)
                .filter(item -> item.publishStatus() == PublishStatus.PUBLISHED);
        if (published.isPresent()) {
            return published.get();
        }
        boolean trashed = productRepo.findBySlug(slug)
                .map(p -> p.getPublishStatus() == PublishStatus.TRASH)
                .orElse(Boolean.FALSE);
        if (trashed) {
            throw new GoneException("Sản phẩm không còn được bán.");
        }
        throw new NotFoundException("Product not found.");
    }

    /**
     * Fetch a published product by either its slug or its internal id.
     * The storefront uses slugs for SEO URLs; the mobile app stores the id with cart entries
     * and refreshes pricing via {@code /products/{id}/snapshot}.
     */
    public Product getProductByIdOrSlug(String key, String lang) {
        return catalogReadRepository.findProductBySlug(key, lang)
                .or(() -> catalogReadRepository.findProductByIdPublicView(key, lang))
                .filter(item -> item.publishStatus() == PublishStatus.PUBLISHED)
                .orElseThrow(() -> new NotFoundException("Product not found."));
    }

    public PageResult<Product> getWishlistProducts(List<String> productIds, int page, int size, String lang) {
        // One batch query instead of one per wishlist id; re-order by the input
        // id list so the storefront keeps the same display order as before.
        Map<String, Product> publishedById = catalogReadRepository.findProductsByIdsPublicView(productIds, lang).stream()
                .filter(p -> p.publishStatus() == PublishStatus.PUBLISHED)
                .collect(Collectors.toMap(Product::id, p -> p, (a, b) -> a));
        List<Product> products = productIds.stream()
                .map(publishedById::get)
                .filter(Objects::nonNull)
                .toList();
        // The wishlist page renders the same storefront ProductCard as the catalog
        // list, so it returns the same list-view shape (see toListView / API_CONTRACT.md
        // "Product list") — keeping both ApiListResponse<Product> endpoints consistent.
        PageResult<Product> page0 = paginationService.paginate(products, page, size);
        return new PageResult<>(
                page0.items().stream().map(CatalogReadService::toListView).toList(),
                page0.page(),
                page0.pageSize(),
                page0.totalItems(),
                page0.totalPages()
        );
    }

    public PageResult<Category> listCategories(int page, int size, String sort, Boolean showOnHomepage, String lang) {
        SortSpec sortSpec = sortParser.parse(sort, "sortOrder", SortDirection.ASC, CATEGORY_SORT_FIELDS);

        List<Category> result = catalogReadRepository.findAllCategories(lang).stream()
                .filter(Category::isVisible)
                .filter(category -> matchesFlag(category.showOnHomepage(), showOnHomepage))
                .sorted(categoryComparator(sortSpec))
                .toList();

        return paginationService.paginate(result, page, size);
    }

    public Category getCategoryBySlug(String slug, String lang) {
        return catalogReadRepository.findCategoryBySlug(slug, lang)
                .filter(Category::isVisible)
                .orElseThrow(() -> new NotFoundException("Category not found."));
    }

    public PageResult<Brand> listBrands(int page, int size, String sort, String lang) {
        SortSpec sortSpec = sortParser.parse(sort, "name", SortDirection.ASC, BRAND_SORT_FIELDS);

        List<Brand> result = catalogReadRepository.findAllBrands(lang).stream()
                .filter(Brand::isVisible)
                .sorted(brandComparator(sortSpec))
                .toList();

        return paginationService.paginate(result, page, size);
    }

    public Brand getBrandBySlug(String slug, String lang) {
        return catalogReadRepository.findBrandBySlug(slug, lang)
                .filter(Brand::isVisible)
                .orElseThrow(() -> new NotFoundException("Brand not found."));
    }

    /**
     * Compute product counts per filter value for the storefront catalog sidebar.
     *
     * <p>v1 uses a base context of {@code PUBLISHED + search query}. Brand, color and
     * price counts also honor {@code categorySlug}; the category facet intentionally
     * ignores {@code categorySlug} so every category still shows a navigable count.
     * Counts are not cross-excluded per dimension — this matches the legacy WordPress
     * filter widget and keeps the endpoint a single pass over the catalog.
     */
    public CatalogFacets computeFacets(String categorySlug, String q, String lang) {
        String locale = "en".equalsIgnoreCase(lang) ? "en" : "vi";
        // findAllPublishedProducts() applies the PUBLISHED filter in SQL; the
        // explicit predicate below is kept as a defensive guard and is a no-op.
        // Facet labels are localized to the storefront language: category/brand
        // names resolve via locale; color/price labels fall back to Vietnamese.
        List<Product> publishedMatchingQuery = catalogReadRepository.findAllPublishedProducts(locale).stream()
                .filter(product -> product.publishStatus() == PublishStatus.PUBLISHED)
                .filter(product -> matchesQuery(product, q))
                .toList();

        List<Product> inCategory = publishedMatchingQuery.stream()
                .filter(product -> matchesCategory(product, categorySlug))
                .toList();

        return new CatalogFacets(
                buildCategoryBuckets(publishedMatchingQuery, locale),
                buildBrandBuckets(inCategory, locale),
                buildColorBuckets(inCategory, locale),
                buildGenderBuckets(inCategory, locale),
                buildPriceBuckets(inCategory, locale)
        );
    }

    /** EN-with-Vietnamese-fallback per PRODUCT_RULE_002 for fixed facet labels. */
    private static String pick(String base, String en, String locale) {
        return "en".equalsIgnoreCase(locale) && en != null && !en.isBlank() ? en : base;
    }

    private List<CatalogFacets.FacetBucket> buildCategoryBuckets(List<Product> products, String locale) {
        return catalogReadRepository.findAllCategories(locale).stream()
                .filter(Category::isVisible)
                .sorted(Comparator.comparing(category ->
                        category.sortOrder() == null ? Integer.MAX_VALUE : category.sortOrder()))
                .map(category -> new CatalogFacets.FacetBucket(
                        category.slug(),
                        category.name(),
                        null,
                        products.stream().filter(p -> matchesCategory(p, category.slug())).count()
                ))
                .toList();
    }

    private List<CatalogFacets.FacetBucket> buildBrandBuckets(List<Product> products, String locale) {
        return catalogReadRepository.findAllBrands(locale).stream()
                .filter(Brand::isVisible)
                .sorted(Comparator.comparing(Brand::name, String.CASE_INSENSITIVE_ORDER))
                .map(brand -> new CatalogFacets.FacetBucket(
                        brand.slug(),
                        brand.name(),
                        brand.logo(),
                        products.stream().filter(p -> matchesBrand(p, brand.slug())).count()
                ))
                .filter(b -> b.count() > 0)
                .toList();
    }

    private static List<CatalogFacets.FacetBucket> buildColorBuckets(List<Product> products, String locale) {
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

    private static List<CatalogFacets.FacetBucket> buildGenderBuckets(List<Product> products, String locale) {
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

    private static boolean matchesGender(Product product, String filterGender) {
        if (filterGender == null || filterGender.isBlank()) return true;
        return filterGender.equalsIgnoreCase(product.gender());
    }

    private static List<CatalogFacets.PriceBucket> buildPriceBuckets(List<Product> products, String locale) {
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

    private static boolean matchesCategory(Product product, String categorySlug) {
        if (categorySlug == null || categorySlug.isBlank()) {
            return true;
        }
        return product.categories() != null && product.categories().stream()
                .anyMatch(category -> category.slug().equals(categorySlug));
    }

    private static boolean matchesBrand(Product product, String brandSlug) {
        if (brandSlug == null || brandSlug.isBlank()) {
            return true;
        }
        return product.brand() != null && product.brand().slug().equals(brandSlug);
    }

    private static boolean matchesQuery(Product product, String q) {
        if (q == null || q.isBlank()) {
            return true;
        }
        String term = q.toLowerCase(Locale.ROOT);
        return product.name().toLowerCase(Locale.ROOT).contains(term)
                || (product.shortDescription() != null && product.shortDescription().toLowerCase(Locale.ROOT).contains(term));
    }

    private static boolean matchesColor(Product product, String filterColor) {
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

    private static boolean matchesPrice(Product product, Long minPrice, Long maxPrice) {
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

    private static boolean matchesFlag(Boolean actual, Boolean expected) {
        return expected == null || Boolean.TRUE.equals(actual) == expected;
    }

    /**
     * Price filtering and sorting use the parent product price only. Variant
     * prices are intentionally ignored so list-page filter results stay
     * consistent with the price the storefront displays.
     */
    private static BigDecimal effectivePrice(Product product) {
        if (product.price() == null) {
            return null;
        }
        return product.price().retailPrice();
    }

    private static boolean isColorOption(String name) {
        String normalizedName = normalize(name);
        return normalizedName.contains("color")
                || normalizedName.contains("colour")
                || normalizedName.contains("mau");
    }

    private static String normalize(String value) {
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
    private static String colorBaseSlug(String value) {
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

    private static String resolveColorLabel(String baseSlug, String locale) {
        if ("en".equalsIgnoreCase(locale)) {
            String en = COLOR_SLUG_LABELS_EN.get(baseSlug);
            if (en != null) return en;
        }
        String vi = COLOR_SLUG_LABELS_VI.get(baseSlug);
        return vi != null ? vi : formatColorSlug(baseSlug);
    }

    private static String formatColorSlug(String slug) {
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

    private static Comparator<Product> productComparator(SortSpec sortSpec) {
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
            case "name" -> Comparator.comparing(Product::name, String.CASE_INSENSITIVE_ORDER);
            case "price" -> Comparator.comparing(
                    CatalogReadService::effectivePrice,
                    Comparator.nullsLast(Comparator.naturalOrder())
            );
            case "createdAt" -> Comparator.comparing(Product::createdAt);
            default -> throw new IllegalStateException("Unsupported sort field.");
        };
        return sortSpec.direction() == SortDirection.DESC ? comparator.reversed() : comparator;
    }

    private static Comparator<Category> categoryComparator(SortSpec sortSpec) {
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

    private static Comparator<Brand> brandComparator(SortSpec sortSpec) {
        Comparator<Brand> comparator = switch (sortSpec.field()) {
            case "name" -> Comparator.comparing(Brand::name, String.CASE_INSENSITIVE_ORDER);
            case "createdAt" -> Comparator.comparing(Brand::createdAt);
            default -> throw new IllegalStateException("Unsupported sort field.");
        };
        return sortSpec.direction() == SortDirection.DESC ? comparator.reversed() : comparator;
    }
}

