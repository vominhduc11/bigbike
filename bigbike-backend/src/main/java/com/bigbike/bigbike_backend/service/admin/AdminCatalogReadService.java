package com.bigbike.bigbike_backend.service.admin;

import com.bigbike.bigbike_backend.api.error.NotFoundException;
import com.bigbike.bigbike_backend.domain.catalog.Brand;
import com.bigbike.bigbike_backend.domain.catalog.Category;
import com.bigbike.bigbike_backend.domain.catalog.Product;
import com.bigbike.bigbike_backend.repository.catalog.CatalogReadRepository;
import com.bigbike.bigbike_backend.service.common.PageResult;
import com.bigbike.bigbike_backend.service.common.PaginationService;
import com.bigbike.bigbike_backend.service.common.SortDirection;
import com.bigbike.bigbike_backend.service.common.SortParser;
import com.bigbike.bigbike_backend.service.common.SortSpec;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import org.springframework.stereotype.Service;

@Service
public class AdminCatalogReadService {

    private static final Set<String> PRODUCT_SORT_FIELDS = Set.of("name", "price", "createdAt", "updatedAt", "homepageOrder");
    private static final Set<String> CATEGORY_SORT_FIELDS = Set.of("name", "createdAt", "updatedAt", "sortOrder");
    private static final Set<String> BRAND_SORT_FIELDS = Set.of("name", "createdAt", "updatedAt");

    private final CatalogReadRepository catalogReadRepository;
    private final SortParser sortParser;
    private final PaginationService paginationService;

    public AdminCatalogReadService(
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
            String q,
            String search,
            String publishStatus,
            String stockState,
            String brandId,
            String categoryId,
            Boolean featured,
            Boolean showOnHomepage
    ) {
        SortSpec sortSpec = sortParser.parse(sort, "updatedAt", SortDirection.DESC, PRODUCT_SORT_FIELDS);
        String query = coalesceSearch(q, search);

        List<Product> result = catalogReadRepository.findProductsFiltered(query, publishStatus, stockState, brandId, categoryId)
                .stream()
                .filter(product -> matchesFlag(product.isFeatured(), featured))
                .filter(product -> matchesFlag(product.showOnHomepage(), showOnHomepage))
                .sorted(productComparator(sortSpec))
                .toList();

        return paginationService.paginate(result, page, size);
    }

    private static boolean matchesFlag(Boolean actual, Boolean expected) {
        return expected == null || Boolean.TRUE.equals(actual) == expected;
    }

    public Product getProductById(String id) {
        return catalogReadRepository.findProductById(id)
                .orElseThrow(() -> new NotFoundException("Product not found."));
    }

    public PageResult<Category> listCategories(
            int page,
            int size,
            String sort,
            String q,
            String search,
            String visibility
    ) {
        SortSpec sortSpec = sortParser.parse(sort, "updatedAt", SortDirection.DESC, CATEGORY_SORT_FIELDS);
        String query = coalesceSearch(q, search);
        boolean asc = sortSpec.direction() == SortDirection.ASC;

        var paged = catalogReadRepository.findCategoriesPaged(
                query, visibility, sortSpec.field(), asc, page, size
        );

        long total = paged.totalItems();
        int totalPages = size <= 0 ? 0 : (int) Math.ceil((double) total / size);
        return new PageResult<>(paged.items(), page, size, total, totalPages);
    }

    public Category getCategoryById(String id) {
        return catalogReadRepository.findCategoryById(id)
                .orElseThrow(() -> new NotFoundException("Category not found."));
    }

    /**
     * Returns the full category set sorted in tree-friendly order:
     * roots first (parentId == null), then by sortOrder, then by name.
     * Children of the same parent fall together because they share the
     * same parentId comparator key. The actual tree structure is built on
     * the client; the server just ships a deterministic flat list.
     */
    public List<Category> listAllCategoriesForTree() {
        return catalogReadRepository.findAllCategories().stream()
                .sorted(Comparator
                        .comparing(
                                Category::parentId,
                                Comparator.nullsFirst(Comparator.naturalOrder())
                        )
                        .thenComparing(
                                (Category c) -> c.sortOrder() == null ? Integer.MAX_VALUE : c.sortOrder()
                        )
                        .thenComparing(Category::name, String.CASE_INSENSITIVE_ORDER))
                .toList();
    }

    public PageResult<Brand> listBrands(
            int page,
            int size,
            String sort,
            String q,
            String search,
            String visibility
    ) {
        SortSpec sortSpec = sortParser.parse(sort, "updatedAt", SortDirection.DESC, BRAND_SORT_FIELDS);
        String query = coalesceSearch(q, search);

        List<Brand> result = catalogReadRepository.findAllBrands().stream()
                .filter(brand -> matchesVisibility(brand.isVisible(), visibility))
                .filter(brand -> matchesBrandQuery(brand, query))
                .sorted(brandComparator(sortSpec))
                .toList();

        return paginationService.paginate(result, page, size);
    }

    public Brand getBrandById(String id) {
        return catalogReadRepository.findBrandById(id)
                .orElseThrow(() -> new NotFoundException("Brand not found."));
    }

    private static String coalesceSearch(String q, String search) {
        if (q != null && !q.isBlank()) {
            return q;
        }
        return search;
    }

    private static boolean matchesVisibility(boolean isVisible, String visibilityRaw) {
        if (visibilityRaw == null || visibilityRaw.isBlank()) {
            return true;
        }
        if ("VISIBLE".equals(visibilityRaw)) {
            return isVisible;
        }
        return !isVisible;
    }

    private static boolean matchesBrandQuery(Brand brand, String query) {
        if (query == null || query.isBlank()) {
            return true;
        }
        String term = query.toLowerCase(Locale.ROOT);
        return brand.name().toLowerCase(Locale.ROOT).contains(term)
                || brand.slug().toLowerCase(Locale.ROOT).contains(term);
    }

    private static Comparator<Product> productComparator(SortSpec sortSpec) {
        if ("homepageOrder".equals(sortSpec.field())) {
            Comparator<Integer> nullSafe = sortSpec.direction() == SortDirection.DESC
                    ? Comparator.nullsLast(Comparator.reverseOrder())
                    : Comparator.nullsLast(Comparator.naturalOrder());
            return Comparator.comparing(Product::homepageOrder, nullSafe)
                    .thenComparing(Product::updatedAt, Comparator.reverseOrder());
        }

        Comparator<Product> comparator = switch (sortSpec.field()) {
            case "name" -> Comparator.comparing(Product::name, String.CASE_INSENSITIVE_ORDER);
            case "price" -> Comparator.comparing(product -> product.price().retailPrice());
            case "createdAt" -> Comparator.comparing(Product::createdAt);
            case "updatedAt" -> Comparator.comparing(Product::updatedAt);
            default -> throw new IllegalStateException("Unsupported sort field.");
        };
        return sortSpec.direction() == SortDirection.DESC ? comparator.reversed() : comparator;
    }

    private static Comparator<Brand> brandComparator(SortSpec sortSpec) {
        Comparator<Brand> comparator = switch (sortSpec.field()) {
            case "name" -> Comparator.comparing(Brand::name, String.CASE_INSENSITIVE_ORDER);
            case "createdAt" -> Comparator.comparing(Brand::createdAt);
            case "updatedAt" -> Comparator.comparing(Brand::updatedAt);
            default -> throw new IllegalStateException("Unsupported sort field.");
        };
        return sortSpec.direction() == SortDirection.DESC ? comparator.reversed() : comparator;
    }
}
