package com.bigbike.bigbike_backend.service.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.bigbike.bigbike_backend.api.error.ConflictException;
import com.bigbike.bigbike_backend.persistence.entity.catalog.CategoryEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductEntity;
import com.bigbike.bigbike_backend.persistence.repository.catalog.CategoryJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ProductJpaRepository;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;

class CategoryDeletionImpactServiceTest {

    private CategoryJpaRepository categoryRepository;
    private ProductJpaRepository productRepository;
    private CategoryDeletionImpactService service;

    @BeforeEach
    @SuppressWarnings("unchecked")
    void setUp() {
        categoryRepository = mock(CategoryJpaRepository.class);
        productRepository = mock(ProductJpaRepository.class);

        ObjectProvider<CategoryJpaRepository> categoryProvider = mock(ObjectProvider.class);
        when(categoryProvider.getIfAvailable()).thenReturn(categoryRepository);
        ObjectProvider<ProductJpaRepository> productProvider = mock(ObjectProvider.class);
        when(productProvider.getIfAvailable()).thenReturn(productRepository);

        service = new CategoryDeletionImpactService(productProvider, categoryProvider);
    }

    @Test
    void previewCountsEveryDescendantAndProductInTheTree() {
        CategoryEntity root = category("root", true);
        CategoryEntity child = category("child", true);
        CategoryEntity grandchild = category("grandchild", true);

        when(categoryRepository.findById("root")).thenReturn(Optional.of(root));
        when(categoryRepository.findByParent_Id("root")).thenReturn(List.of(child));
        when(categoryRepository.findByParent_Id("child")).thenReturn(List.of(grandchild));
        when(categoryRepository.findByParent_Id("grandchild")).thenReturn(List.of());
        when(productRepository.findDistinctByCategories_IdIn(List.of("root", "child", "grandchild")))
                .thenReturn(List.of(
                        product("product-1", root),
                        product("product-2", root, category("other", false)),
                        product("product-3", grandchild)));

        var impact = service.preview(List.of("root"));

        assertThat(impact.requestedCategoryCount()).isEqualTo(1);
        assertThat(impact.rootCategoryIds()).containsExactly("root");
        assertThat(impact.descendantCategoryCount()).isEqualTo(2);
        assertThat(impact.affectedProductCount()).isEqualTo(3);
        assertThat(impact.reassignedProductCount()).isEqualTo(2);
    }

    @Test
    void previewCollapsesNestedSelectionsToOneDeletionRootWithoutDoubleCounting() {
        CategoryEntity root = category("root", true);
        CategoryEntity child = category("child", true);

        when(categoryRepository.findById("root")).thenReturn(Optional.of(root));
        when(categoryRepository.findById("child")).thenReturn(Optional.of(child));
        when(categoryRepository.findByParent_Id("root")).thenReturn(List.of(child));
        when(categoryRepository.findByParent_Id("child")).thenReturn(List.of());
        when(productRepository.findDistinctByCategories_IdIn(List.of("root", "child")))
                .thenReturn(List.of(product("product-1", root)));

        var impact = service.preview(List.of("root", "child", "root"));

        assertThat(impact.requestedCategoryCount()).isEqualTo(2);
        assertThat(impact.rootCategoryIds()).containsExactly("root");
        assertThat(impact.descendantCategoryCount()).isEqualTo(1);
        assertThat(impact.affectedProductCount()).isEqualTo(1);
        assertThat(impact.reassignedProductCount()).isEqualTo(1);
    }

    @Test
    void previewRejectsCategoryOutsideTrash() {
        CategoryEntity active = category("active", false);
        when(categoryRepository.findById("active")).thenReturn(Optional.of(active));

        assertThatThrownBy(() -> service.preview(List.of("active")))
                .isInstanceOf(ConflictException.class)
                .hasMessageContaining("Thùng rác");
    }

    private static CategoryEntity category(String id, boolean deleted) {
        CategoryEntity category = new CategoryEntity();
        category.setId(id);
        category.setDeleted(deleted);
        return category;
    }

    private static ProductEntity product(String id, CategoryEntity... categories) {
        ProductEntity product = new ProductEntity();
        product.setId(id);
        product.setCategories(new java.util.ArrayList<>(List.of(categories)));
        return product;
    }
}
