package com.bigbike.bigbike_backend.service.catalog;

import com.bigbike.bigbike_backend.api.error.GoneException;
import com.bigbike.bigbike_backend.api.error.NotFoundException;
import com.bigbike.bigbike_backend.domain.catalog.Brand;
import com.bigbike.bigbike_backend.domain.catalog.CatalogFacets;
import com.bigbike.bigbike_backend.domain.catalog.Category;
import com.bigbike.bigbike_backend.domain.catalog.HomepageBlock;
import com.bigbike.bigbike_backend.domain.catalog.Product;
import com.bigbike.bigbike_backend.domain.catalog.ProductGenderSupport;
import com.bigbike.bigbike_backend.domain.catalog.ProductStockState;
import com.bigbike.bigbike_backend.domain.catalog.PublishStatus;
import com.bigbike.bigbike_backend.persistence.repository.commerce.order.OrderLineItemJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ProductJpaRepository;
import com.bigbike.bigbike_backend.repository.catalog.CatalogReadRepository;
import com.bigbike.bigbike_backend.service.common.PageResult;
import com.bigbike.bigbike_backend.service.common.PaginationService;
import com.bigbike.bigbike_backend.service.common.SortDirection;
import com.bigbike.bigbike_backend.service.common.SortParser;
import com.bigbike.bigbike_backend.service.common.SortSpec;
import java.math.BigDecimal;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.Deque;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import static com.bigbike.bigbike_backend.service.catalog.CatalogReadSupport.*;

@Service
@Transactional(readOnly = true)
public class CatalogReadService {

    private final CatalogReadRepository catalogReadRepository;
    private final SortParser sortParser;
    private final PaginationService paginationService;
    private final ProductJpaRepository productRepo;
    private final SizeScaleCatalogService sizeScaleCatalogService;
    private final CatalogVisualFacetCatalogService visualFacetCatalogService;
    private final OrderLineItemJpaRepository orderLineItemRepo;
    private final ProductRichHtmlImageEnricher richHtmlImageEnricher;

    @Autowired
    public CatalogReadService(
            CatalogReadRepository catalogReadRepository,
            SortParser sortParser,
            PaginationService paginationService,
            ProductJpaRepository productRepo,
            SizeScaleCatalogService sizeScaleCatalogService,
            CatalogVisualFacetCatalogService visualFacetCatalogService,
            OrderLineItemJpaRepository orderLineItemRepo,
            ProductRichHtmlImageEnricher richHtmlImageEnricher
    ) {
        this.catalogReadRepository = catalogReadRepository;
        this.sortParser = sortParser;
        this.paginationService = paginationService;
        this.productRepo = productRepo;
        this.sizeScaleCatalogService = sizeScaleCatalogService;
        this.visualFacetCatalogService = visualFacetCatalogService;
        this.orderLineItemRepo = orderLineItemRepo;
        this.richHtmlImageEnricher = richHtmlImageEnricher;
    }

    /** Source-compatible constructor for focused unit tests predating visual facets. */
    CatalogReadService(
            CatalogReadRepository catalogReadRepository,
            SortParser sortParser,
            PaginationService paginationService,
            ProductJpaRepository productRepo,
            SizeScaleCatalogService sizeScaleCatalogService
    ) {
        this(catalogReadRepository, sortParser, paginationService, productRepo,
                sizeScaleCatalogService, null, null, null);
    }

    /** Source-compatible overload for internal callers that do not expose storefront size filters. */
    public PageResult<Product> listProducts(
            int page,
            int size,
            String sort,
            String category,
            String brand,
            String q,
            String filterColor,
            List<String> filterGenders,
            Long minPrice,
            Long maxPrice,
            HomepageBlock homepageBlock,
            String lang
    ) {
        return listProducts(
                page, size, sort, category, brand, q, filterColor, filterGenders, List.of(),
                minPrice, maxPrice, homepageBlock, lang);
    }

    public PageResult<Product> listProducts(
            int page,
            int size,
            String sort,
            String category,
            String brand,
            String q,
            String filterColor,
            List<String> filterGenders,
            List<String> sizeFilters,
            Long minPrice,
            Long maxPrice,
            HomepageBlock homepageBlock,
            String lang
    ) {
        return listProducts(page, size, sort, category,
                brand == null || brand.isBlank() ? List.of() : List.of(brand), q,
                filterColor == null || filterColor.isBlank() ? List.of() : List.of(filterColor),
                List.of(), filterGenders, sizeFilters, minPrice, maxPrice, null,
                homepageBlock, lang);
    }

    /** Canonical public catalog list with OR-within / AND-across facet semantics. */
    public PageResult<Product> listProducts(
            int page,
            int size,
            String sort,
            String category,
            List<String> brands,
            String q,
            List<String> filterColors,
            List<String> filterFinishes,
            List<String> filterGenders,
            List<String> sizeFilters,
            Long minPrice,
            Long maxPrice,
            Boolean inStock,
            HomepageBlock homepageBlock,
            String lang
    ) {
        boolean popularitySort = "popularity".equalsIgnoreCase(sort);
        String parsedSort = popularitySort || "date".equalsIgnoreCase(sort) || "menu_order".equalsIgnoreCase(sort)
                ? "createdAt:desc"
                : sort;
        SortSpec sortSpec = sortParser.parse(parsedSort, "createdAt", SortDirection.DESC, PRODUCT_SORT_FIELDS);
        List<String> activeGenderFilters = ProductGenderSupport.firstSupported(filterGenders);
        List<String> activeSizeFilters = normalizeSizeFilters(sizeFilters);
        List<String> activeBrands = normalizeSlugFilters(brands);
        CatalogVisualFacetCatalog visualCatalog = activeVisualCatalog();
        CatalogVisualFacetCatalog.Selection visualSelection = visualCatalog.resolve(filterColors, filterFinishes);

        // Retain the efficient SQL path for contexts fully supported by the existing query.
        boolean sqlPaginationEligible = !visualSelection.colorRequested()
                && !visualSelection.finishRequested()
                && activeSizeFilters.isEmpty()
                && activeBrands.size() <= 1
                && !Boolean.TRUE.equals(inStock)
                && !popularitySort
                && !"homepageOrder".equals(sortSpec.field());
        if (sqlPaginationEligible) {
            CatalogReadRepository.ProductListingPage sqlPage = catalogReadRepository.findPublishedProductsPaged(
                    category, activeBrands.isEmpty() ? null : activeBrands.get(0), q,
                    activeGenderFilters, null, minPrice, maxPrice, homepageBlock, sortSpec, page, size, lang);
            long totalItems = sqlPage.totalItems();
            int totalPages = totalItems == 0 ? 0 : (int) Math.ceil((double) totalItems / size);
            return new PageResult<>(
                    sqlPage.items().stream().map(CatalogReadSupport::toListView).toList(),
                    page,
                    size,
                    totalItems,
                    totalPages
            );
        }

        Set<String> categorySlugs = resolveCategorySlugsWithDescendants(category, lang);
        SizeScaleCatalog sizeCatalog = activeSizeCatalog();
        Comparator<Product> comparator = popularitySort
                ? bestSellingComparator(loadUnitsSold())
                : productComparator(sortSpec);
        List<Product> result = catalogReadRepository.findAllPublishedProductsForListing(lang).stream()
                .filter(product -> product.publishStatus() == PublishStatus.PUBLISHED)
                .filter(product -> !product.discontinued())
                .filter(product -> matchesCategoryOrDescendants(product, categorySlugs))
                .filter(product -> matchesBrand(product, activeBrands))
                .filter(product -> matchesQuery(product, q))
                .filter(product -> visualCatalog.matches(product, visualSelection))
                .filter(product -> matchesGender(product, activeGenderFilters))
                .filter(product -> sizeCatalog.matches(product, activeSizeFilters))
                .filter(product -> matchesPrice(product, minPrice, maxPrice))
                .filter(product -> !Boolean.TRUE.equals(inStock)
                        || product.stockState() == ProductStockState.IN_STOCK)
                .filter(product -> homepageBlock == null || product.homepageBlock() == homepageBlock)
                .sorted(comparator)
                .toList();

        // Project only the paginated slice to the lighter list view — the
        // storefront list/card never renders description/gallery/specs/SEO or
        // variant internals (see API_CONTRACT.md "Product list"). This keeps
        // the response small without touching the filtering above.
        PageResult<Product> page0 = paginationService.paginate(result, page, size);
        return new PageResult<>(
                page0.items().stream().map(CatalogReadSupport::toListView).toList(),
                page0.page(),
                page0.pageSize(),
                page0.totalItems(),
                page0.totalPages()
        );
    }

    private Map<String, Long> loadUnitsSold() {
        if (orderLineItemRepo == null) return Map.of();
        Map<String, Long> result = new HashMap<>();
        for (Object[] row : orderLineItemRepo.catalogUnitsSoldByProduct()) {
            if (row == null || row.length < 2 || row[0] == null) continue;
            long units = row[1] instanceof Number number ? number.longValue() : 0L;
            result.put(row[0].toString(), units);
        }
        return result;
    }

    private static Comparator<Product> bestSellingComparator(Map<String, Long> unitsSold) {
        return Comparator.<Product>comparingLong(product -> unitsSold.getOrDefault(product.id(), 0L))
                .reversed()
                .thenComparing(Product::createdAt, Comparator.reverseOrder())
                .thenComparing(Product::id);
    }

    /** Backward-compatible scalar adapter for internal callers and old tests. */
    public PageResult<Product> listProducts(
            int page,
            int size,
            String sort,
            String category,
            String brand,
            String q,
            String filterColor,
            List<String> filterGenders,
            String sizeFilter,
            Long minPrice,
            Long maxPrice,
            HomepageBlock homepageBlock,
            String lang
    ) {
        return listProducts(page, size, sort, category, brand, q, filterColor, filterGenders,
                sizeFilter == null || sizeFilter.isBlank() ? List.of() : List.of(sizeFilter),
                minPrice, maxPrice, homepageBlock, lang);
    }

    private static List<String> normalizeSizeFilters(List<String> sizeFilters) {
        if (sizeFilters == null) return List.of();
        return sizeFilters.stream()
                .map(SizeScaleCatalog::normalizeFilterToken)
                .filter(value -> !value.isBlank())
                .distinct()
                .toList();
    }

    private static List<String> normalizeSlugFilters(List<String> values) {
        if (values == null) return List.of();
        return values.stream()
                .filter(Objects::nonNull)
                .map(String::trim)
                .filter(value -> !value.isBlank())
                .distinct()
                .toList();
    }

    private SizeScaleCatalog activeSizeCatalog() {
        return sizeScaleCatalogService == null
                ? new SizeScaleCatalog(List.of())
                : sizeScaleCatalogService.activeCatalog();
    }

    private CatalogVisualFacetCatalog activeVisualCatalog() {
        return visualFacetCatalogService == null
                ? new CatalogVisualFacetCatalog(List.of())
                : visualFacetCatalogService.activeCatalog();
    }

    /**
     * Internal BigBike Assistant discovery path. It deliberately has its own repository predicate so the
     * public {@code q} endpoint keeps its established response and matching contract.
     * Returned products retain listing variants because the chat service must verify sellability
     * before it creates a product card.
     */
    public List<Product> searchProductsForAssistant(
            List<String> identifierTokens,
            String category,
            String brand,
            Long minPrice,
            Long maxPrice,
            String sort,
            int limit,
            String lang
    ) {
        if (identifierTokens == null || identifierTokens.isEmpty() || limit <= 0) {
            return List.of();
        }
        SortSpec sortSpec = sortParser.parse(sort, "createdAt", SortDirection.DESC, PRODUCT_SORT_FIELDS);
        return catalogReadRepository.searchPublishedProductsForAssistant(
                List.copyOf(identifierTokens),
                trimToNull(category),
                trimToNull(brand),
                minPrice,
                maxPrice,
                sortSpec,
                "en".equalsIgnoreCase(lang) ? "en" : "vi",
                Math.min(limit, 100));
    }

    private static String trimToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    /**
     * Resolves a category slug to self + every descendant slug (CATEGORY_RULE_006), for the
     * in-memory filter path (color filter present, see {@link #listProducts}) which otherwise
     * only exact-matches the product's own category slug. Mirrors
     * {@code ProductFilterSpecifications.resolveCategoryIds} but keyed on slug and
     * operating on the small in-memory category list already loaded for facets.
     */
    private Set<String> resolveCategorySlugsWithDescendants(String categorySlug, String lang) {
        if (categorySlug == null || categorySlug.isBlank()) {
            return null;
        }
        List<Category> categories = catalogReadRepository.findAllCategories(lang);
        Map<String, List<String>> childrenByParentId = new HashMap<>();
        Map<String, String> slugById = new HashMap<>();
        for (Category cat : categories) {
            slugById.put(cat.id(), cat.slug());
            if (cat.parentId() != null) {
                childrenByParentId.computeIfAbsent(cat.parentId(), k -> new ArrayList<>()).add(cat.id());
            }
        }
        String rootId = categories.stream()
                .filter(cat -> categorySlug.equals(cat.slug()))
                .map(Category::id)
                .findFirst()
                .orElse(null);
        if (rootId == null) {
            return Set.of();
        }
        Set<String> visitedIds = new HashSet<>();
        Deque<String> queue = new ArrayDeque<>(List.of(rootId));
        while (!queue.isEmpty()) {
            String current = queue.poll();
            if (!visitedIds.add(current)) {
                continue;
            }
            queue.addAll(childrenByParentId.getOrDefault(current, List.of()));
        }
        Set<String> slugs = new HashSet<>();
        for (String id : visitedIds) {
            String slug = slugById.get(id);
            if (slug != null) {
                slugs.add(slug);
            }
        }
        return slugs;
    }

    public Product getProductBySlug(String slug, String lang) {
        Optional<Product> published = catalogReadRepository.findProductBySlug(slug, lang)
                .filter(item -> item.publishStatus() == PublishStatus.PUBLISHED);
        if (published.isPresent()) {
            return enrichRichHtml(published.get());
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
                .filter(item -> !item.discontinued())
                .map(this::enrichRichHtml)
                .orElseThrow(() -> new NotFoundException("Product not found."));
    }

    /**
     * Pricing/stock snapshot for the buy-box refresh (storefront/mobile poll on window
     * focus). Uses the lighter "listing" projection — the snapshot only reads price/
     * stock/variant+options and has no business paying for gallery/videos/specifications/
     * faqs/commitments/specStats/trustBadges/highlights/related/accessory on every poll.
     */
    public Product getProductSnapshotByIdOrSlug(String key, String lang) {
        return catalogReadRepository.findProductBySlugForListing(key, lang)
                .or(() -> catalogReadRepository.findProductByIdPublicViewForListing(key, lang))
                .filter(item -> item.publishStatus() == PublishStatus.PUBLISHED)
                .filter(item -> !item.discontinued())
                .orElseThrow(() -> new NotFoundException("Product not found."));
    }

    private Product enrichRichHtml(Product product) {
        return richHtmlImageEnricher == null ? product : richHtmlImageEnricher.enrich(product);
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

    /**
     * Internal read-only vocabulary for BigBike Assistant. It intentionally exposes only public category
     * metadata to backend query recognition; nothing from this list is sent to the AI model.
     */
    public List<Category> listAssistantCategories(String lang) {
        return catalogReadRepository.findAllCategories("en".equalsIgnoreCase(lang) ? "en" : "vi").stream()
                .filter(Category::isVisible)
                .filter(category -> !category.deleted())
                .toList();
    }

    /**
     * Read-only source for BigBike Assistant's category-listing tool. A category remains visible even with zero
     * current products, while the count itself includes only the same sellable product shape BigBike Assistant
     * is allowed to show in a product card.
     */
    public List<AssistantCategorySummary> listAssistantCategorySummaries(String lang) {
        String locale = "en".equalsIgnoreCase(lang) ? "en" : "vi";
        List<Category> categories = new ArrayList<>(listAssistantCategories(locale));
        categories.sort(Comparator
                .comparing(Category::sortOrder, Comparator.nullsLast(Comparator.naturalOrder()))
                .thenComparing(category -> category.name() == null ? "" : category.name(),
                        String.CASE_INSENSITIVE_ORDER));

        Map<String, List<String>> childrenByParentId = new HashMap<>();
        Map<String, String> slugById = new HashMap<>();
        for (Category category : categories) {
            if (category.id() == null || category.slug() == null) continue;
            slugById.put(category.id(), category.slug());
            if (category.parentId() != null) {
                childrenByParentId.computeIfAbsent(category.parentId(), ignored -> new ArrayList<>())
                        .add(category.id());
            }
        }
        Map<String, Set<String>> slugsByRoot = new HashMap<>();
        for (Category category : categories) {
            if (category.id() == null || category.slug() == null) continue;
            slugsByRoot.put(category.slug(), categoryAndDescendantSlugs(
                    category.id(), childrenByParentId, slugById));
        }

        List<Product> sellableProducts = catalogReadRepository
                .findAllPublishedProductsForListing(locale).stream()
                .filter(CatalogReadService::assistantSellable)
                .toList();
        return categories.stream()
                .filter(category -> category.slug() != null && category.name() != null)
                .map(category -> new AssistantCategorySummary(
                        category.slug(),
                        category.name(),
                        sellableProducts.stream()
                                .filter(product -> belongsToAnyCategory(
                                        product, slugsByRoot.getOrDefault(category.slug(), Set.of())))
                                .count()))
                .toList();
    }

    /**
     * Bounded internal catalog snapshot used by the assistant's deterministic clarification
     * planner. It includes active out-of-stock rows for honest breadth counts; card eligibility
     * is checked separately before anything is shown to a customer.
     */
    public List<Product> listAssistantDecisionProducts(String lang) {
        String locale = "en".equalsIgnoreCase(lang) ? "en" : "vi";
        return catalogReadRepository.findAllPublishedProductsForListing(locale).stream()
                .filter(CatalogReadService::assistantActive)
                .toList();
    }

    /** Completed-order evidence for the assistant-only best-seller decision. */
    public AssistantSalesSnapshot assistantCompletedSales(List<String> productKeys) {
        List<String> keys = productKeys == null ? List.of() : productKeys.stream()
                .filter(Objects::nonNull)
                .map(String::trim)
                .filter(key -> !key.isBlank())
                .distinct()
                .limit(500)
                .toList();
        if (orderLineItemRepo == null || keys.isEmpty()) {
            return new AssistantSalesSnapshot(0, List.of());
        }
        Set<String> scope = Set.copyOf(keys);
        List<AssistantProductSale> sales = orderLineItemRepo.assistantCompletedSalesByProduct().stream()
                .filter(row -> row != null && row.length >= 3 && row[0] != null)
                .map(row -> new AssistantProductSale(
                        row[0].toString(),
                        ((Number) row[1]).longValue(),
                        ((Number) row[2]).longValue()))
                .filter(sale -> scope.contains(sale.productKey()))
                .toList();
        long distinctOrders = orderLineItemRepo.countAssistantCompletedOrdersForProducts(keys);
        return new AssistantSalesSnapshot(distinctOrders, sales);
    }

    private static Set<String> categoryAndDescendantSlugs(
            String rootId,
            Map<String, List<String>> childrenByParentId,
            Map<String, String> slugById
    ) {
        Set<String> visited = new HashSet<>();
        Deque<String> queue = new ArrayDeque<>(List.of(rootId));
        while (!queue.isEmpty()) {
            String current = queue.removeFirst();
            if (!visited.add(current)) continue;
            queue.addAll(childrenByParentId.getOrDefault(current, List.of()));
        }
        return visited.stream()
                .map(slugById::get)
                .filter(Objects::nonNull)
                .collect(Collectors.toUnmodifiableSet());
    }

    private static boolean belongsToAnyCategory(Product product, Set<String> categorySlugs) {
        return product != null
                && product.categories() != null
                && product.categories().stream()
                .filter(Objects::nonNull)
                .anyMatch(category -> categorySlugs.contains(category.slug()));
    }

    private static boolean assistantActive(Product product) {
        if (product == null
                || product.publishStatus() != PublishStatus.PUBLISHED
                || product.discontinued()
                || product.price() == null
                || !"VND".equalsIgnoreCase(product.price().currency())) {
            return false;
        }
        BigDecimal retail = product.price().retailPrice();
        BigDecimal sale = product.price().salePrice();
        BigDecimal effective = sale != null && sale.signum() > 0
                && retail != null && retail.signum() > 0 && sale.compareTo(retail) < 0
                ? sale : retail;
        return effective != null && effective.signum() > 0;
    }

    /** Mirrors BigBike Assistant card eligibility: published, in-stock, VND and a positive effective price. */
    private static boolean assistantSellable(Product product) {
        if (!assistantActive(product)
                || !Boolean.TRUE.equals(product.available())
                || product.stockState()
                != com.bigbike.bigbike_backend.domain.catalog.ProductStockState.IN_STOCK
        ) {
            return false;
        }
        if (product.variants() == null || product.variants().isEmpty()) return true;
        return product.variants().stream().anyMatch(variant -> variant != null
                && variant.isAvailable()
                && variant.stockState()
                == com.bigbike.bigbike_backend.domain.catalog.ProductStockState.IN_STOCK);
    }

    public record AssistantCategorySummary(String slug, String name, long sellableProductCount) {}

    public record AssistantProductSale(String productKey, long unitsSold, long completedOrderCount) {}

    public record AssistantSalesSnapshot(
            long distinctCompletedOrders,
            List<AssistantProductSale> products
    ) {
        public AssistantSalesSnapshot {
            products = products == null ? List.of() : List.copyOf(products);
        }
    }

    public Category getCategoryBySlug(String slug, String lang) {
        return catalogReadRepository.findCategoryBySlug(slug, lang)
                .filter(Category::isVisible)
                .orElseThrow(() -> new NotFoundException("Category not found."));
    }

    public PageResult<Brand> listBrands(int page, int size, String sort, String lang) {
        return listBrands(page, size, sort, null, lang);
    }

    public PageResult<Brand> listBrands(
            int page,
            int size,
            String sort,
            Boolean showOnHomepage,
            String lang
    ) {
        SortSpec sortSpec = sortParser.parse(sort, "name", SortDirection.ASC, BRAND_SORT_FIELDS);

        List<Brand> result = catalogReadRepository.findAllBrands(lang).stream()
                .filter(Brand::isVisible)
                .filter(brand -> matchesFlag(brand.showOnHomepage(), showOnHomepage))
                .sorted(brandComparator(sortSpec))
                .toList();

        return paginationService.paginate(result, page, size);
    }

    /** Internal read-only brand vocabulary for BigBike Assistant; this is not a public API surface. */
    public List<Brand> listAssistantBrands() {
        return catalogReadRepository.findAllBrands("vi").stream()
                .filter(Brand::isVisible)
                .toList();
    }

    public Brand getBrandBySlug(String slug, String lang) {
        return catalogReadRepository.findBrandBySlug(slug, lang)
                .filter(Brand::isVisible)
                .orElseThrow(() -> new NotFoundException("Brand not found."));
    }

    /**
     * Compute product counts per filter value for the storefront catalog sidebar.
     *
     * <p>v1 uses a base context of {@code PUBLISHED + search query}. Brand, color,
     * gender and price counts also honor {@code categorySlug} — including its descendant
     * categories (CATEGORY_RULE_006), so the counts match the product listing. The
     * category facet intentionally ignores {@code categorySlug} (exact per-category
     * count) so every category still shows its own navigable count.
     * Counts are not cross-excluded per dimension — this matches the legacy WordPress
     * filter widget and keeps the endpoint a single pass over the catalog.
     */
    public CatalogFacets computeFacets(String categorySlug, String q, String lang) {
        return computeFacets(categorySlug, List.of(), q, List.of(), List.of(), List.of(),
                List.of(), null, null, null, lang);
    }

    /**
     * Computes facets in the current catalog context. Size counts deliberately do not
     * apply a selected size, so users can see the remaining alternatives while refining
     * a multi-select filter; the price axis does honor the active size context.
     */
    public CatalogFacets computeFacets(
            String categorySlug,
            String brandSlug,
            String q,
            String filterColor,
            List<String> filterGenders,
            Long minPrice,
            Long maxPrice,
            String lang
    ) {
        return computeFacets(categorySlug,
                brandSlug == null || brandSlug.isBlank() ? List.of() : List.of(brandSlug), q,
                filterColor == null || filterColor.isBlank() ? List.of() : List.of(filterColor),
                List.of(), filterGenders, List.of(), minPrice, maxPrice, null, lang);
    }

    /**
     * Computes facets in the current non-price context. The price axis deliberately
     * ignores the active price range, while honoring every other active filter.
     */
    public CatalogFacets computeFacets(
            String categorySlug,
            String brandSlug,
            String q,
            String filterColor,
            List<String> filterGenders,
            List<String> sizeFilters,
            Long minPrice,
            Long maxPrice,
            String lang
    ) {
        return computeFacets(categorySlug,
                brandSlug == null || brandSlug.isBlank() ? List.of() : List.of(brandSlug), q,
                filterColor == null || filterColor.isBlank() ? List.of() : List.of(filterColor),
                List.of(), filterGenders, sizeFilters, minPrice, maxPrice, null, lang);
    }

    /** Canonical cross-excluded catalog facets (CATALOG_RULE_006–010). */
    public CatalogFacets computeFacets(
            String categorySlug,
            List<String> brandSlugs,
            String q,
            List<String> filterColors,
            List<String> filterFinishes,
            List<String> filterGenders,
            List<String> sizeFilters,
            Long minPrice,
            Long maxPrice,
            Boolean inStock,
            String lang
    ) {
        String locale = "en".equalsIgnoreCase(lang) ? "en" : "vi";
        List<Product> publishedMatchingQuery = catalogReadRepository.findAllPublishedProductsForListing(locale).stream()
                .filter(product -> product.publishStatus() == PublishStatus.PUBLISHED)
                .filter(product -> !product.discontinued())
                .filter(product -> matchesQuery(product, q))
                .toList();

        Set<String> categorySlugs = resolveCategorySlugsWithDescendants(categorySlug, locale);
        List<Product> base = publishedMatchingQuery.stream()
                .filter(product -> matchesCategoryOrDescendants(product, categorySlugs))
                .toList();

        List<String> activeBrands = normalizeSlugFilters(brandSlugs);
        List<String> activeGenders = ProductGenderSupport.firstSupported(filterGenders);
        List<String> activeSizeFilters = normalizeSizeFilters(sizeFilters);
        SizeScaleCatalog sizeCatalog = activeSizeCatalog();
        CatalogVisualFacetCatalog visualCatalog = activeVisualCatalog();
        CatalogVisualFacetCatalog.Selection fullVisual = visualCatalog.resolve(filterColors, filterFinishes);
        CatalogVisualFacetCatalog.Selection finishOnly = visualCatalog.resolve(List.of(), filterFinishes);
        CatalogVisualFacetCatalog.Selection colorOnly = visualCatalog.resolve(filterColors, List.of());

        List<Product> brandContext = base.stream()
                .filter(product -> visualCatalog.matches(product, fullVisual))
                .filter(product -> matchesGender(product, activeGenders))
                .filter(product -> sizeCatalog.matches(product, activeSizeFilters))
                .filter(product -> matchesPrice(product, minPrice, maxPrice))
                .filter(product -> matchesStock(product, inStock))
                .toList();

        List<Product> colorContext = base.stream()
                .filter(product -> matchesBrand(product, activeBrands))
                .filter(product -> visualCatalog.matches(product, finishOnly))
                .filter(product -> matchesGender(product, activeGenders))
                .filter(product -> sizeCatalog.matches(product, activeSizeFilters))
                .filter(product -> matchesPrice(product, minPrice, maxPrice))
                .filter(product -> matchesStock(product, inStock))
                .toList();

        List<Product> finishContext = base.stream()
                .filter(product -> matchesBrand(product, activeBrands))
                .filter(product -> visualCatalog.matches(product, colorOnly))
                .filter(product -> matchesGender(product, activeGenders))
                .filter(product -> sizeCatalog.matches(product, activeSizeFilters))
                .filter(product -> matchesPrice(product, minPrice, maxPrice))
                .filter(product -> matchesStock(product, inStock))
                .toList();

        List<Product> genderContext = base.stream()
                .filter(product -> matchesBrand(product, activeBrands))
                .filter(product -> visualCatalog.matches(product, fullVisual))
                .filter(product -> sizeCatalog.matches(product, activeSizeFilters))
                .filter(product -> matchesPrice(product, minPrice, maxPrice))
                .filter(product -> matchesStock(product, inStock))
                .toList();

        List<Product> sizeContext = base.stream()
                .filter(product -> matchesBrand(product, activeBrands))
                .filter(product -> visualCatalog.matches(product, fullVisual))
                .filter(product -> matchesGender(product, activeGenders))
                .filter(product -> matchesPrice(product, minPrice, maxPrice))
                .filter(product -> matchesStock(product, inStock))
                .toList();

        List<Product> priceContext = base.stream()
                .filter(product -> matchesBrand(product, activeBrands))
                .filter(product -> visualCatalog.matches(product, fullVisual))
                .filter(product -> matchesGender(product, activeGenders))
                .filter(product -> sizeCatalog.matches(product, activeSizeFilters))
                .filter(product -> matchesStock(product, inStock))
                .toList();

        List<Product> stockContext = base.stream()
                .filter(product -> matchesBrand(product, activeBrands))
                .filter(product -> visualCatalog.matches(product, fullVisual))
                .filter(product -> matchesGender(product, activeGenders))
                .filter(product -> sizeCatalog.matches(product, activeSizeFilters))
                .filter(product -> matchesPrice(product, minPrice, maxPrice))
                .toList();

        List<Product> fullContext = stockContext.stream()
                .filter(product -> matchesStock(product, inStock))
                .toList();

        long availableCount = stockContext.stream()
                .filter(product -> product.stockState() == ProductStockState.IN_STOCK)
                .count();
        CatalogFacets.FacetBucket availability = availableCount == 0 ? null
                : new CatalogFacets.FacetBucket(
                        "in-stock", "en".equals(locale) ? "In stock only" : "Chỉ hiện hàng còn",
                        null, availableCount);

        return new CatalogFacets(
                buildCategoryBuckets(publishedMatchingQuery, locale),
                buildBrandBuckets(brandContext, locale),
                buildVisualBuckets(colorContext, visualCatalog, true, locale),
                buildVisualBuckets(finishContext, visualCatalog, false, locale),
                availability,
                buildGenderBuckets(genderContext, locale),
                buildLegacySizeBuckets(sizeContext, sizeCatalog, locale),
                buildSizeGroups(sizeContext, sizeCatalog, locale),
                buildPriceRange(priceContext),
                fullContext.size(),
                visualCatalog.colors().stream()
                        .map(CatalogVisualFacetCatalog.Definition::key)
                        .filter(fullVisual.colors()::contains)
                        .toList()
        );
    }

    private List<CatalogFacets.FacetBucket> buildCategoryBuckets(List<Product> products, String locale) {
        List<Category> categories = catalogReadRepository.findAllCategories(locale).stream()
                .filter(Category::isVisible)
                .filter(category -> !category.deleted())
                .sorted(Comparator.comparing(category ->
                        category.sortOrder() == null ? Integer.MAX_VALUE : category.sortOrder()))
                .toList();
        Map<String, List<String>> childrenByParentId = new HashMap<>();
        Map<String, String> slugById = new HashMap<>();
        for (Category category : categories) {
            slugById.put(category.id(), category.slug());
            if (category.parentId() != null) {
                childrenByParentId.computeIfAbsent(category.parentId(), ignored -> new ArrayList<>())
                        .add(category.id());
            }
        }
        return categories.stream()
                .map(category -> {
                    Set<String> descendants = categoryAndDescendantSlugs(
                            category.id(), childrenByParentId, slugById);
                    return new CatalogFacets.FacetBucket(
                            category.slug(),
                            category.name(),
                            category.image(),
                            products.stream()
                                    .filter(product -> matchesCategoryOrDescendants(product, descendants))
                                    .count());
                })
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

    private static List<CatalogFacets.FacetBucket> buildVisualBuckets(
            List<Product> products,
            CatalogVisualFacetCatalog catalog,
            boolean colors,
            String locale
    ) {
        List<CatalogVisualFacetCatalog.Definition> definitions = colors
                ? catalog.colors()
                : catalog.finishes();
        return definitions.stream()
                .map(definition -> new CatalogFacets.FacetBucket(
                        definition.key(),
                        definition.label(locale),
                        null,
                        colors ? definition.swatch() : null,
                        products.stream().filter(product -> (colors
                                ? catalog.colorsFor(product)
                                : catalog.finishesFor(product)).contains(definition.key())).count()))
                .filter(bucket -> bucket.count() > 0)
                .toList();
    }

    private static boolean matchesStock(Product product, Boolean inStock) {
        return !Boolean.TRUE.equals(inStock) || product.stockState() == ProductStockState.IN_STOCK;
    }

}
