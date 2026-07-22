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
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import static com.bigbike.bigbike_backend.service.catalog.CatalogReadSupport.*;

@Service
@Transactional(readOnly = true)
@RequiredArgsConstructor
public class CatalogReadService {

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

        // Real SQL LIMIT/OFFSET path: covers every filter except color (needs
        // per-variant-option Vietnamese-diacritic normalization that isn't SQL-pushable
        // without a dedicated indexed color column) and "homepageOrder" sort (pin +
        // nulls-last + reversed-only-inside-pinned-section tie-break isn't a plain column
        // sort). Only the current page's rows are hydrated — see
        // CatalogReadRepository.findPublishedProductsPaged.
        boolean sqlPaginationEligible = (filterColor == null || filterColor.isBlank())
                && !"homepageOrder".equals(sortSpec.field());
        if (sqlPaginationEligible) {
            CatalogReadRepository.ProductListingPage sqlPage = catalogReadRepository.findPublishedProductsPaged(
                    category, brand, q, filterGender, minPrice, maxPrice, homepageBlock, sortSpec, page, size, lang);
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

        // In-memory fallback (color filter and/or homepageOrder pin-sort). Uses the
        // lighter "listing" projection (skips gallery/video/specs/faqs/commitments/
        // specStats/trustBadges/notes/related/accessory — none of that survives
        // toListView() anyway, so loading it just to discard it wastes a lazy-collection
        // batch fetch per relation on every request that lands on this path).
        Set<String> categorySlugs = resolveCategorySlugsWithDescendants(category, lang);
        List<Product> result = catalogReadRepository.findAllPublishedProductsForListing(lang).stream()
                .filter(product -> product.publishStatus() == PublishStatus.PUBLISHED)
                .filter(product -> matchesCategoryOrDescendants(product, categorySlugs))
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
                page0.items().stream().map(CatalogReadSupport::toListView).toList(),
                page0.page(),
                page0.pageSize(),
                page0.totalItems(),
                page0.totalPages()
        );
    }

    /**
     * Resolves a category slug to self + every descendant slug (CATEGORY_RULE_006), for the
     * in-memory filter path (color filter present, see {@link #listProducts}) which otherwise
     * only exact-matches the product's own category slug. Mirrors
     * {@code JpaCatalogReadRepository.resolveCategoryIdWithDescendants} but keyed on slug and
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
                .orElseThrow(() -> new NotFoundException("Product not found."));
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
        String locale = "en".equalsIgnoreCase(lang) ? "en" : "vi";
        // findAllPublishedProductsForListing() applies the PUBLISHED filter in SQL and
        // skips the 9 detail-only relations facets never read (gallery/video/specs/faqs/
        // commitments/specStats/trustBadges/notes/related/accessory) — facets aggregate
        // counts across the whole matching set so they can't be SQL-paginated, but color/
        // gender bucket counting still needs full variant+option data, which this keeps.
        // Facet labels are localized to the storefront language: category/brand
        // names resolve via locale; color/price labels fall back to Vietnamese.
        List<Product> publishedMatchingQuery = catalogReadRepository.findAllPublishedProductsForListing(locale).stream()
                .filter(product -> product.publishStatus() == PublishStatus.PUBLISHED)
                .filter(product -> matchesQuery(product, q))
                .toList();

        // Expand the category to self + all descendants (CATEGORY_RULE_006) so the
        // brand/color/gender/price facet counts match the product listing, which also
        // includes descendant products (see listProducts in-memory path). Using exact
        // slug matching here undercounts on a parent category: the facet would advertise
        // e.g. "Đen bóng (1)" while clicking it returns the full descendant-expanded list.
        Set<String> categorySlugs = resolveCategorySlugsWithDescendants(categorySlug, locale);
        List<Product> inCategory = publishedMatchingQuery.stream()
                .filter(product -> matchesCategoryOrDescendants(product, categorySlugs))
                .toList();

        return new CatalogFacets(
                buildCategoryBuckets(publishedMatchingQuery, locale),
                buildBrandBuckets(inCategory, locale),
                buildColorBuckets(inCategory, locale),
                buildGenderBuckets(inCategory, locale),
                buildPriceBuckets(inCategory, locale)
        );
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

}

