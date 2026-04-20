package com.bigbike.bigbike_backend.service.admin;

import com.bigbike.bigbike_backend.api.error.NotFoundException;
import com.bigbike.bigbike_backend.domain.catalog.Brand;
import com.bigbike.bigbike_backend.domain.catalog.Category;
import com.bigbike.bigbike_backend.domain.catalog.Product;
import com.bigbike.bigbike_backend.domain.catalog.ProductStockState;
import com.bigbike.bigbike_backend.domain.catalog.PublishStatus;
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

    private static final Set<String> PRODUCT_SORT_FIELDS = Set.of("name", "price", "createdAt", "updatedAt");
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
            String stockState
    ) {
        SortSpec sortSpec = sortParser.parse(sort, "updatedAt", SortDirection.DESC, PRODUCT_SORT_FIELDS);
        String query = coalesceSearch(q, search);

        List<Product> result = catalogReadRepository.findAllProducts().stream()
                .filter(product -> matchesPublishStatus(product, publishStatus))
                .filter(product -> matchesStockState(product, stockState))
                .filter(product -> matchesProductQuery(product, query))
                .sorted(productComparator(sortSpec))
                .toList();

        return paginationService.paginate(result, page, size);
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

        List<Category> result = catalogReadRepository.findAllCategories().stream()
                .filter(category -> matchesVisibility(category.isVisible(), visibility))
                .filter(category -> matchesCategoryQuery(category, query))
                .sorted(categoryComparator(sortSpec))
                .toList();

        return paginationService.paginate(result, page, size);
    }

    public Category getCategoryById(String id) {
        return catalogReadRepository.findCategoryById(id)
                .orElseThrow(() -> new NotFoundException("Category not found."));
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

    private static boolean matchesPublishStatus(Product product, String publishStatusRaw) {
        if (publishStatusRaw == null || publishStatusRaw.isBlank()) {
            return true;
        }
        return product.publishStatus() == PublishStatus.valueOf(publishStatusRaw);
    }

    private static boolean matchesStockState(Product product, String stockStateRaw) {
        if (stockStateRaw == null || stockStateRaw.isBlank()) {
            return true;
        }
        return product.stockState() == ProductStockState.valueOf(stockStateRaw);
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

    private static boolean matchesProductQuery(Product product, String query) {
        if (query == null || query.isBlank()) {
            return true;
        }
        String term = query.toLowerCase(Locale.ROOT);
        return product.name().toLowerCase(Locale.ROOT).contains(term)
                || product.slug().toLowerCase(Locale.ROOT).contains(term)
                || (product.sku() != null && product.sku().toLowerCase(Locale.ROOT).contains(term));
    }

    private static boolean matchesCategoryQuery(Category category, String query) {
        if (query == null || query.isBlank()) {
            return true;
        }
        String term = query.toLowerCase(Locale.ROOT);
        return category.name().toLowerCase(Locale.ROOT).contains(term)
                || category.slug().toLowerCase(Locale.ROOT).contains(term);
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
        Comparator<Product> comparator = switch (sortSpec.field()) {
            case "name" -> Comparator.comparing(Product::name, String.CASE_INSENSITIVE_ORDER);
            case "price" -> Comparator.comparingInt(product -> product.price().retailPrice());
            case "createdAt" -> Comparator.comparing(Product::createdAt);
            case "updatedAt" -> Comparator.comparing(Product::updatedAt);
            default -> throw new IllegalStateException("Unsupported sort field.");
        };
        return sortSpec.direction() == SortDirection.DESC ? comparator.reversed() : comparator;
    }

    private static Comparator<Category> categoryComparator(SortSpec sortSpec) {
        Comparator<Category> comparator = switch (sortSpec.field()) {
            case "name" -> Comparator.comparing(Category::name, String.CASE_INSENSITIVE_ORDER);
            case "createdAt" -> Comparator.comparing(Category::createdAt);
            case "updatedAt" -> Comparator.comparing(Category::updatedAt);
            case "sortOrder" -> Comparator.comparing(category -> category.sortOrder() == null ? Integer.MAX_VALUE : category.sortOrder());
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
