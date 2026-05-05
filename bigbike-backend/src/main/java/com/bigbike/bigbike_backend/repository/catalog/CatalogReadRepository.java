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

    Optional<Category> findCategoryBySlug(String slug);

    Optional<Category> findCategoryById(String id);

    List<Brand> findAllBrands();

    Optional<Brand> findBrandBySlug(String slug);

    Optional<Brand> findBrandById(String id);
}
