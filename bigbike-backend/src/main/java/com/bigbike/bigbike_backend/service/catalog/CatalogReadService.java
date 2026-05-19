package com.bigbike.bigbike_backend.service.catalog;

import com.bigbike.bigbike_backend.api.error.NotFoundException;
import com.bigbike.bigbike_backend.domain.catalog.Brand;
import com.bigbike.bigbike_backend.domain.catalog.CatalogFacets;
import com.bigbike.bigbike_backend.domain.catalog.Category;
import com.bigbike.bigbike_backend.domain.catalog.HomepageBlock;
import com.bigbike.bigbike_backend.domain.catalog.Product;
import com.bigbike.bigbike_backend.domain.catalog.PublishStatus;
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
     * Fixed named colors shown in the storefront filter sidebar. Keys are slugs
     * matched server-side by {@link #matchesColor}; labels are the Vietnamese
     * display names. Order matches the legacy WordPress color widget.
     */
    private static final List<ColorFacet> COLOR_FACETS = List.of(
            new ColorFacet("bac", "Bạc"),
            new ColorFacet("cam", "Cam"),
            new ColorFacet("hong", "Hồng"),
            new ColorFacet("trang", "Trắng"),
            new ColorFacet("xam", "Xám"),
            new ColorFacet("xanh-da-troi", "Xanh da trời"),
            new ColorFacet("xanh-la-cay", "Xanh lá cây"),
            new ColorFacet("vang", "Vàng"),
            new ColorFacet("den", "Đen"),
            new ColorFacet("do", "Đỏ")
    );

    /**
     * Fixed price bands shown in the storefront filter sidebar. The 8–9tr gap is
     * intentional — it replicates the legacy WordPress price widget exactly.
     */
    private static final List<PriceBand> PRICE_BANDS = List.of(
            new PriceBand("0-1tr", "0đ - 1.000.000đ", 0L, 1_000_000L),
            new PriceBand("1-2tr", "1.000.000đ - 2.000.000đ", 1_000_000L, 2_000_000L),
            new PriceBand("2-3tr", "2.000.000đ - 3.000.000đ", 2_000_000L, 3_000_000L),
            new PriceBand("3-4tr", "3.000.000đ - 4.000.000đ", 3_000_000L, 4_000_000L),
            new PriceBand("4-5tr", "4.000.000đ - 5.000.000đ", 4_000_000L, 5_000_000L),
            new PriceBand("5-6tr", "5.000.000đ - 6.000.000đ", 5_000_000L, 6_000_000L),
            new PriceBand("6-7tr", "6.000.000đ - 7.000.000đ", 6_000_000L, 7_000_000L),
            new PriceBand("7-8tr", "7.000.000đ - 8.000.000đ", 7_000_000L, 8_000_000L),
            new PriceBand("tren-9tr", "Trên 9.000.000đ", 9_000_000L, null)
    );

    private record ColorFacet(String slug, String label) {
    }

    private record PriceBand(String key, String label, Long min, Long max) {
    }

    private final CatalogReadRepository catalogReadRepository;
    private final SortParser sortParser;
    private final PaginationService paginationService;

    public PageResult<Product> listProducts(
            int page,
            int size,
            String sort,
            String category,
            String brand,
            String q,
            String filterColor,
            Long minPrice,
            Long maxPrice,
            HomepageBlock homepageBlock
    ) {
        SortSpec sortSpec = sortParser.parse(sort, "createdAt", SortDirection.DESC, PRODUCT_SORT_FIELDS);

        // findAllPublishedProducts() applies the PUBLISHED filter in SQL; the
        // explicit predicate below is kept as a defensive guard and is a no-op.
        // Filtering runs on the full domain object — matchesColor() needs the
        // variant options, which the list-view projection below strips out.
        List<Product> result = catalogReadRepository.findAllPublishedProducts().stream()
                .filter(product -> product.publishStatus() == PublishStatus.PUBLISHED)
                .filter(product -> matchesCategory(product, category))
                .filter(product -> matchesBrand(product, brand))
                .filter(product -> matchesQuery(product, q))
                .filter(product -> matchesColor(product, filterColor))
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
                null,                       // contentBottom — detail only
                null,                       // promotionContent — detail only
                null,                       // installationGuide — detail only
                List.of(),                  // faqs — detail only
                List.of(),                  // relatedProducts — detail only
                null,                       // seo — detail only
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

    public Product getProductBySlug(String slug) {
        Product product = catalogReadRepository.findProductBySlug(slug)
                .filter(item -> item.publishStatus() == PublishStatus.PUBLISHED)
                .orElseThrow(() -> new NotFoundException("Product not found."));
        return product;
    }

    /**
     * Fetch a published product by either its slug or its internal id.
     * The storefront uses slugs for SEO URLs; the mobile app stores the id with cart entries
     * and refreshes pricing via {@code /products/{id}/snapshot}.
     */
    public Product getProductByIdOrSlug(String key) {
        return catalogReadRepository.findProductBySlug(key)
                .or(() -> catalogReadRepository.findProductByIdPublicView(key))
                .filter(item -> item.publishStatus() == PublishStatus.PUBLISHED)
                .orElseThrow(() -> new NotFoundException("Product not found."));
    }

    public PageResult<Product> getWishlistProducts(List<String> productIds, int page, int size) {
        // One batch query instead of one per wishlist id; re-order by the input
        // id list so the storefront keeps the same display order as before.
        Map<String, Product> publishedById = catalogReadRepository.findProductsByIdsPublicView(productIds).stream()
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

    public PageResult<Category> listCategories(int page, int size, String sort, Boolean showOnHomepage) {
        SortSpec sortSpec = sortParser.parse(sort, "sortOrder", SortDirection.ASC, CATEGORY_SORT_FIELDS);

        List<Category> result = catalogReadRepository.findAllCategories().stream()
                .filter(Category::isVisible)
                .filter(category -> matchesFlag(category.showOnHomepage(), showOnHomepage))
                .sorted(categoryComparator(sortSpec))
                .toList();

        return paginationService.paginate(result, page, size);
    }

    public Category getCategoryBySlug(String slug) {
        return catalogReadRepository.findCategoryBySlug(slug)
                .filter(Category::isVisible)
                .orElseThrow(() -> new NotFoundException("Category not found."));
    }

    public PageResult<Brand> listBrands(int page, int size, String sort) {
        SortSpec sortSpec = sortParser.parse(sort, "name", SortDirection.ASC, BRAND_SORT_FIELDS);

        List<Brand> result = catalogReadRepository.findAllBrands().stream()
                .filter(Brand::isVisible)
                .sorted(brandComparator(sortSpec))
                .toList();

        return paginationService.paginate(result, page, size);
    }

    public Brand getBrandBySlug(String slug) {
        return catalogReadRepository.findBrandBySlug(slug)
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
    public CatalogFacets computeFacets(String categorySlug, String q) {
        // findAllPublishedProducts() applies the PUBLISHED filter in SQL; the
        // explicit predicate below is kept as a defensive guard and is a no-op.
        List<Product> publishedMatchingQuery = catalogReadRepository.findAllPublishedProducts().stream()
                .filter(product -> product.publishStatus() == PublishStatus.PUBLISHED)
                .filter(product -> matchesQuery(product, q))
                .toList();

        List<Product> inCategory = publishedMatchingQuery.stream()
                .filter(product -> matchesCategory(product, categorySlug))
                .toList();

        return new CatalogFacets(
                buildCategoryBuckets(publishedMatchingQuery),
                buildBrandBuckets(inCategory),
                buildColorBuckets(inCategory),
                buildPriceBuckets(inCategory)
        );
    }

    private List<CatalogFacets.FacetBucket> buildCategoryBuckets(List<Product> products) {
        return catalogReadRepository.findAllCategories().stream()
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

    private List<CatalogFacets.FacetBucket> buildBrandBuckets(List<Product> products) {
        return catalogReadRepository.findAllBrands().stream()
                .filter(Brand::isVisible)
                .sorted(Comparator.comparing(Brand::name, String.CASE_INSENSITIVE_ORDER))
                .map(brand -> new CatalogFacets.FacetBucket(
                        brand.slug(),
                        brand.name(),
                        brand.logo(),
                        products.stream().filter(p -> matchesBrand(p, brand.slug())).count()
                ))
                .toList();
    }

    private static List<CatalogFacets.FacetBucket> buildColorBuckets(List<Product> products) {
        return COLOR_FACETS.stream()
                .map(color -> new CatalogFacets.FacetBucket(
                        color.slug(),
                        color.label(),
                        null,
                        products.stream().filter(p -> matchesColor(p, color.slug())).count()
                ))
                .toList();
    }

    private static List<CatalogFacets.PriceBucket> buildPriceBuckets(List<Product> products) {
        return PRICE_BANDS.stream()
                .map(band -> new CatalogFacets.PriceBucket(
                        band.key(),
                        band.label(),
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
        if (filterColor == null || filterColor.isBlank()) {
            return true;
        }

        String expectedColor = normalize(filterColor);
        if (expectedColor.isBlank()) {
            return true;
        }

        if (product.variants() == null || product.variants().isEmpty()) {
            return false;
        }

        return product.variants().stream()
                .filter(Objects::nonNull)
                .filter(variant -> variant.options() != null && !variant.options().isEmpty())
                .anyMatch(variant -> variant.options().stream()
                        .filter(Objects::nonNull)
                        .anyMatch(option -> isColorOption(option.name())
                                && normalize(option.value()).equals(expectedColor)));
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
        return sortSpec.direction() == SortDirection.DESC ? comparator.reversed() : comparator;
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

