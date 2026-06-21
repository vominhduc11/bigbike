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
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.Map;
import java.util.Objects;
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
                page0.items().stream().map(CatalogReadSupport::toListView).toList(),
                page0.page(),
                page0.pageSize(),
                page0.totalItems(),
                page0.totalPages()
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
                page0.items().stream().map(CatalogReadSupport::toListView).toList(),
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

