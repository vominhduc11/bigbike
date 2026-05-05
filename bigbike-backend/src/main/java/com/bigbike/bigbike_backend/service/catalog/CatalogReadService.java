package com.bigbike.bigbike_backend.service.catalog;

import com.bigbike.bigbike_backend.api.error.NotFoundException;
import com.bigbike.bigbike_backend.domain.catalog.Brand;
import com.bigbike.bigbike_backend.domain.catalog.Category;
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
import java.util.Objects;
import java.util.Set;
import org.springframework.stereotype.Service;

@Service
public class CatalogReadService {

    private static final Set<String> PRODUCT_SORT_FIELDS = Set.of("name", "price", "createdAt");
    private static final Set<String> CATEGORY_SORT_FIELDS = Set.of("name", "createdAt", "sortOrder");
    private static final Set<String> BRAND_SORT_FIELDS = Set.of("name", "createdAt");

    private final CatalogReadRepository catalogReadRepository;
    private final SortParser sortParser;
    private final PaginationService paginationService;

    public CatalogReadService(
            CatalogReadRepository catalogReadRepository,
            SortParser sortParser,
            PaginationService paginationService
    ) {
        this.catalogReadRepository = catalogReadRepository;
        this.sortParser = sortParser;
        this.paginationService = paginationService;
    }

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
            Boolean featured,
            Boolean showOnHomepage
    ) {
        SortSpec sortSpec = sortParser.parse(sort, "createdAt", SortDirection.DESC, PRODUCT_SORT_FIELDS);

        List<Product> result = catalogReadRepository.findAllProducts().stream()
                .filter(product -> product.publishStatus() == PublishStatus.PUBLISHED)
                .filter(product -> matchesCategory(product, category))
                .filter(product -> matchesBrand(product, brand))
                .filter(product -> matchesQuery(product, q))
                .filter(product -> matchesColor(product, filterColor))
                .filter(product -> matchesPrice(product, minPrice, maxPrice))
                .filter(product -> matchesFlag(product.isFeatured(), featured))
                .filter(product -> matchesFlag(product.showOnHomepage(), showOnHomepage))
                .sorted(productComparator(sortSpec))
                .toList();

        return paginationService.paginate(result, page, size);
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

