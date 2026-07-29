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
import java.text.Collator;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
@RequiredArgsConstructor
public class AdminCatalogReadService {

    private static final Set<String> PRODUCT_SORT_FIELDS = Set.of("name", "price", "createdAt", "updatedAt", "homepageOrder");
    private static final Set<String> CATEGORY_SORT_FIELDS = Set.of("name", "createdAt", "updatedAt", "sortOrder");
    private static final Set<String> BRAND_SORT_FIELDS = Set.of("name", "createdAt", "updatedAt");

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
     * System "Chưa phân loại" brand bucket (BRAND_RULE_004) — internal bookkeeping
     * only, never a manageable row in the admin brand list (unlike the category
     * equivalent, brands have no separate trash flag, so showing it here would
     * make it appear as an orphaned/trashed brand with misleading actions).
     */
    private static final String UNCATEGORIZED_BRAND_ID = "uncategorized-brand";

    private final CatalogReadRepository catalogReadRepository;
    private final SortParser sortParser;
    private final PaginationService paginationService;

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
            String filterGender,
            String homepageBlock,
            String lang
    ) {
        SortSpec sortSpec = sortParser.parse(sort, "updatedAt", SortDirection.DESC, PRODUCT_SORT_FIELDS);
        String query = coalesceSearch(q, search);
        com.bigbike.bigbike_backend.domain.catalog.HomepageBlock blockFilter = parseHomepageBlock(homepageBlock);

        List<Product> result = catalogReadRepository.findProductsFiltered(
                        query, publishStatus, stockState, brandId, categoryId, filterGender, normalizeLocale(lang))
                .stream()
                .filter(product -> blockFilter == null || product.homepageBlock() == blockFilter)
                .sorted(productComparator(sortSpec))
                .toList();

        return paginationService.paginate(result, page, size);
    }

    private static com.bigbike.bigbike_backend.domain.catalog.HomepageBlock parseHomepageBlock(String raw) {
        if (raw == null || raw.isBlank()) return null;
        try {
            return com.bigbike.bigbike_backend.domain.catalog.HomepageBlock.valueOf(raw);
        } catch (IllegalArgumentException ex) {
            // Controller already validated via @Pattern; defensive fallthrough.
            return null;
        }
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
            String visibility,
            Boolean deleted,
            String lang
    ) {
        SortSpec sortSpec = sortParser.parse(sort, "updatedAt", SortDirection.DESC, CATEGORY_SORT_FIELDS);
        String query = coalesceSearch(q, search);
        boolean asc = sortSpec.direction() == SortDirection.ASC;

        var paged = catalogReadRepository.findCategoriesPaged(
                query, visibility, deleted, sortSpec.field(), asc, page, size, normalizeLocale(lang)
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
    public List<Category> listAllCategoriesForTree(String lang) {
        String locale = normalizeLocale(lang);
        // Admin VI/EN switch: ở EN chỉ hiện danh mục đã có tên tiếng Anh (ẩn mục chưa dịch).
        return catalogReadRepository.findAllCategories(locale, "en".equals(locale)).stream()
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
            String visibility,
            String lang
    ) {
        SortSpec sortSpec = sortParser.parse(sort, "updatedAt", SortDirection.DESC, BRAND_SORT_FIELDS);
        String query = coalesceSearch(q, search);

        String locale = normalizeLocale(lang);
        // Brand names/slugs are shared across VI/EN; keep every brand visible in the EN admin list.
        List<Brand> result = catalogReadRepository.findAllBrands(locale, "en".equals(locale)).stream()
                .filter(brand -> !UNCATEGORIZED_BRAND_ID.equals(brand.id()))
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

    /** Normalize the requested content language to the repository locale ("vi" default, "en"). */
    private static String normalizeLocale(String lang) {
        return "en".equalsIgnoreCase(lang) ? "en" : "vi";
    }

    private static boolean matchesVisibility(boolean isVisible, String visibilityRaw) {
        if (visibilityRaw == null || visibilityRaw.isBlank()) {
            // No explicit filter: default list excludes soft-deleted/hidden brands,
            // mirroring Category's `deleted = false` default and Product's `!= TRASH` default.
            return isVisible;
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
            case "name" -> Comparator.comparing(Product::name, VI_NAME_COLLATOR::compare);
            case "price" -> Comparator.comparing(product -> product.price().retailPrice());
            case "createdAt" -> Comparator.comparing(Product::createdAt);
            case "updatedAt" -> Comparator.comparing(Product::updatedAt);
            default -> throw new IllegalStateException("Unsupported sort field.");
        };
        Comparator<Product> directed = sortSpec.direction() == SortDirection.DESC ? comparator.reversed() : comparator;
        // Tie-break by id (always ascending, regardless of primary sort direction) so products
        // sharing an identical name/price/createdAt/updatedAt render in a stable order across
        // requests — the underlying fetch has no SQL ORDER BY, so ties are otherwise unstable.
        return directed.thenComparing(Product::id);
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
