package com.bigbike.bigbike_backend.service.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.bigbike.bigbike_backend.api.admin.dto.quicksearch.AdminQuickSearchGroup;
import com.bigbike.bigbike_backend.api.admin.dto.quicksearch.AdminQuickSearchItem;
import com.bigbike.bigbike_backend.persistence.entity.catalog.AttributeValueEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductVariantEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductVariantOptionEntity;
import com.bigbike.bigbike_backend.persistence.repository.auth.AdminUserJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.BrandJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.CategoryJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ProductJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.order.OrderAddressJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.order.OrderJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.content.ArticleJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.customer.CustomerJpaRepository;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.data.jpa.domain.Specification;

class AdminQuickSearchReaderTest {

    @Test
    void returnsVariantThatMatchedTheSellingSkuWithItsOptions() {
        ProductJpaRepository products = mock(ProductJpaRepository.class);
        ProductEntity product = product("product-1", "Mũ bảo hiểm");
        ProductVariantEntity variant = variant("variant-1", "LABEL-RED-M", "Đỏ / M");
        ProductVariantOptionEntity option = new ProductVariantOptionEntity();
        option.setOptionName("Màu");
        option.setOptionValue("Đỏ");
        AttributeValueEntity attributeValue = new AttributeValueEntity();
        attributeValue.setId("red");
        option.setAttributeValue(attributeValue);
        variant.setOptions(List.of(option));
        product.setVariants(List.of(variant));
        when(products.findAll(any(Specification.class))).thenReturn(List.of(product));
        when(products.findByIdsWithVariants(anyList())).thenReturn(List.of(product));

        AdminQuickSearchGroup result = reader(products).searchProducts("label-red-m");

        assertThat(result.total()).isEqualTo(1);
        AdminQuickSearchItem item = result.items().get(0);
        assertThat(item.matchedField()).isEqualTo("variantSku");
        assertThat(item.matchedVariants()).singleElement()
                .satisfies(matched -> {
                    assertThat(matched.sku()).isEqualTo("LABEL-RED-M");
                    assertThat(matched.options()).singleElement().satisfies(matchedOption -> {
                        assertThat(matchedOption.name()).isEqualTo("Màu");
                        assertThat(matchedOption.value()).isEqualTo("Đỏ");
                        assertThat(matchedOption.attributeValueId()).isEqualTo("red");
                    });
                });
    }

    @Test
    void sortsPreviewByExactThenPrefixThenContainsInsteadOfInsertionOrder() {
        ProductJpaRepository products = mock(ProductJpaRepository.class);
        ProductEntity contains = product("contains", "Nón cho mũ");
        ProductEntity prefix = product("prefix", "Mũ bảo hiểm");
        ProductEntity exact = product("exact", "Mũ");
        List<ProductEntity> candidates = List.of(contains, prefix, exact);
        when(products.findAll(any(Specification.class))).thenReturn(candidates);
        when(products.findByIdsWithVariants(anyList())).thenReturn(candidates);

        AdminQuickSearchGroup result = reader(products).searchProducts("mũ");

        assertThat(result.items()).extracting(AdminQuickSearchItem::id)
                .containsExactly("exact", "prefix", "contains");
    }

    private static AdminQuickSearchReader reader(ProductJpaRepository products) {
        return new AdminQuickSearchReader(
                mock(OrderJpaRepository.class),
                mock(OrderAddressJpaRepository.class),
                mock(CustomerJpaRepository.class),
                products,
                mock(CategoryJpaRepository.class),
                mock(BrandJpaRepository.class),
                mock(ArticleJpaRepository.class),
                mock(AdminUserJpaRepository.class)
        );
    }

    private static ProductEntity product(String id, String name) {
        ProductEntity product = new ProductEntity();
        product.setId(id);
        product.setName(name);
        product.setSlug(id);
        return product;
    }

    private static ProductVariantEntity variant(String id, String sku, String name) {
        ProductVariantEntity variant = new ProductVariantEntity();
        variant.setId(id);
        variant.setSku(sku);
        variant.setName(name);
        return variant;
    }
}
