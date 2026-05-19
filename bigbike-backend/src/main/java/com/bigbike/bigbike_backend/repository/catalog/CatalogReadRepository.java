package com.bigbike.bigbike_backend.repository.catalog;

import com.bigbike.bigbike_backend.domain.catalog.Brand;
import com.bigbike.bigbike_backend.domain.catalog.Category;
import com.bigbike.bigbike_backend.domain.catalog.Product;
import java.util.List;
import java.util.Optional;

public interface CatalogReadRepository {

    List<Product> findAllProducts();

    /**
     * PUBLISHED products only, in public view. The public catalog endpoints
     * (listing, facets, global search) all discard non-PUBLISHED rows, so the
     * status filter is pushed to SQL here — the result is identical to
     * {@code findAllProducts()} filtered to PUBLISHED, but the deep entity
     * graph of DRAFT/TRASH products is never materialised.
     */
    List<Product> findAllPublishedProducts();

    List<Product> findProductsFiltered(String query, String publishStatus, String stockState, String brandId, String categoryId);

    Optional<Product> findProductBySlug(String slug);

    Optional<Product> findProductById(String id);

    Optional<Product> findProductByIdPublicView(String id);

    /** Batch public-view lookup by id. Order of the result is not guaranteed; callers re-order. */
    List<Product> findProductsByIdsPublicView(List<String> ids);

    List<Category> findAllCategories();

    /**
     * Paged + filtered category lookup. The filter/sort are pushed down to
     * SQL when a JPA backend is active, so admin list pages don't load the
     * full table into the JVM. The mock backend uses a stream-based fallback.
     *
     * @param query        case-insensitive substring matched against name/slug; null/blank = no filter
     * @param visibility   "VISIBLE", "HIDDEN", or null/blank = both
     * @param sortField    one of "name", "createdAt", "updatedAt", "sortOrder"
     * @param sortAsc      true = ASC, false = DESC
     * @param page         1-indexed
     * @param pageSize     items per page
     */
    CategoryPage findCategoriesPaged(
            String query,
            String visibility,
            String sortField,
            boolean sortAsc,
            int page,
            int pageSize
    );

    record CategoryPage(List<Category> items, long totalItems) {}

    Optional<Category> findCategoryBySlug(String slug);

    Optional<Category> findCategoryById(String id);

    List<Brand> findAllBrands();

    Optional<Brand> findBrandBySlug(String slug);

    Optional<Brand> findBrandById(String id);
}
