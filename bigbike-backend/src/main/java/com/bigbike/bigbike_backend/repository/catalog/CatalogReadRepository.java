package com.bigbike.bigbike_backend.repository.catalog;

import com.bigbike.bigbike_backend.domain.catalog.Brand;
import com.bigbike.bigbike_backend.domain.catalog.Category;
import com.bigbike.bigbike_backend.domain.catalog.Product;
import java.util.List;
import java.util.Optional;

public interface CatalogReadRepository {

    List<Product> findAllProducts();

    Optional<Product> findProductBySlug(String slug);

    List<Category> findAllCategories();

    Optional<Category> findCategoryBySlug(String slug);

    List<Brand> findAllBrands();

    Optional<Brand> findBrandBySlug(String slug);
}

