package com.bigbike.bigbike_backend.repository.catalog;

import com.bigbike.bigbike_backend.domain.catalog.Brand;
import com.bigbike.bigbike_backend.domain.catalog.Category;
import com.bigbike.bigbike_backend.domain.catalog.Product;
import java.util.List;
import java.util.Optional;

public interface CatalogReadRepository {

    List<Product> findAllProducts();

    List<Product> findProductsFiltered(String query, String publishStatus, String stockState, String brandId, String categoryId);

    Optional<Product> findProductBySlug(String slug);

    Optional<Product> findProductById(String id);

    Optional<Product> findProductByIdPublicView(String id);

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
