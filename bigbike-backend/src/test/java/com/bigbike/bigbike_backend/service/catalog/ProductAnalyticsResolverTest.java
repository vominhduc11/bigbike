package com.bigbike.bigbike_backend.service.catalog;

import static org.assertj.core.api.Assertions.assertThat;

import com.bigbike.bigbike_backend.domain.catalog.ProductStockState;
import com.bigbike.bigbike_backend.domain.catalog.PublishStatus;
import com.bigbike.bigbike_backend.mapper.CartMapper;
import com.bigbike.bigbike_backend.mapper.OrderItemMapper;
import com.bigbike.bigbike_backend.persistence.entity.catalog.BrandEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.CategoryEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductEntity;
import com.bigbike.bigbike_backend.persistence.entity.commerce.cart.CartItemEntity;
import com.bigbike.bigbike_backend.persistence.entity.commerce.order.OrderLineItemEntity;
import jakarta.persistence.EntityManager;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

/** Real SQL and generated mappers, with isolated catalog fixtures and no placed orders. */
@SpringBootTest
@Transactional
class ProductAnalyticsResolverTest {
    @Autowired EntityManager em;
    @Autowired ProductAnalyticsResolver resolver;
    @Autowired CartMapper cartMapper;
    @Autowired OrderItemMapper orderItemMapper;

    @Test
    void legacyProductReferencesEnrichBothCommerceShapesWithoutChangingSellingSnapshots() {
        ProductEntity product = product("wp-analytics-" + UUID.randomUUID());
        BrandEntity brand = new BrandEntity();
        brand.setId("brand-" + UUID.randomUUID());
        brand.setSlug(brand.getId());
        brand.setName("Analytics brand");
        brand.setCreatedAt(Instant.now());
        brand.setUpdatedAt(Instant.now());
        em.persist(brand);
        product.setBrand(brand);
        CategoryEntity first = category("Primary category");
        CategoryEntity second = category("Secondary category");
        product.setCategories(new ArrayList<>(List.of(first, second)));
        em.persist(product);
        em.flush();
        em.clear();

        CartItemEntity cartLine = cartLine(product.getId());
        OrderLineItemEntity orderLine = orderLine(product.getId());
        var cartMetadata = resolver.forCartItems(List.of(cartLine));
        var orderMetadata = resolver.forOrderItems(List.of(orderLine));
        var cart = cartMapper.toItemResponse(cartLine, Set.of(), cartMetadata.get(cartLine.getId()));
        var order = orderItemMapper.toResponse(orderLine, "snapshot.webp", orderMetadata.get(orderLine.getId()));
        assertThat(cart.brandName()).isEqualTo("Analytics brand");
        assertThat(order.brandName()).isEqualTo(cart.brandName());
        assertThat(cart.categoryName()).isEqualTo("Primary category");
        assertThat(order.categoryName()).isEqualTo(cart.categoryName());
        assertThat(cart.sku()).isEqualTo("SELLING-BLUE-M");
        assertThat(order.sku()).isEqualTo("SELLING-BLUE-M");
        assertThat(cart.variantName()).isEqualTo("Blue / M");
        assertThat(order.variantName()).isEqualTo("Blue / M");
        assertThat(order.unitPrice()).isEqualByComparingTo("1250000");
        assertThat(order.productThumbnailUrl()).isEqualTo("snapshot.webp");
    }

    @Test
    void uuidFallbackAndMissingTaxonomyKeepTheLineAndItsPrice() {
        UUID productId = UUID.randomUUID();
        ProductEntity product = product(productId.toString());
        em.persist(product);
        em.flush();

        CartItemEntity cartLine = cartLine(null);
        cartLine.setProductId(productId);
        OrderLineItemEntity orderLine = orderLine(null);
        orderLine.setProductId(productId);
        var cartMetadata = resolver.forCartItems(List.of(cartLine));
        var orderMetadata = resolver.forOrderItems(List.of(orderLine));
        assertThat(cartMetadata).containsKey(cartLine.getId());
        assertThat(orderMetadata).containsKey(orderLine.getId());
        var cart = cartMapper.toItemResponse(cartLine, Set.of(), cartMetadata.get(cartLine.getId()));
        var order = orderItemMapper.toResponse(orderLine, null, orderMetadata.get(orderLine.getId()));
        assertThat(cart.brandName()).isNull();
        assertThat(cart.categoryName()).isNull();
        assertThat(order.brandName()).isNull();
        assertThat(order.categoryName()).isNull();
        assertThat(cart.unitPrice()).isEqualByComparingTo("1250000");
        assertThat(order.sku()).isEqualTo("SELLING-BLUE-M");
    }

    @Test
    void missingProductsAndEmptyCartsDoNotInventMetadata() {
        CartItemEntity cartLine = cartLine("deleted-analytics-product");
        OrderLineItemEntity orderLine = orderLine("deleted-analytics-product");
        assertThat(resolver.forCartItems(List.of(cartLine))).isEmpty();
        assertThat(resolver.forOrderItems(List.of(orderLine))).isEmpty();
        assertThat(resolver.forCartItems(List.of())).isEmpty();
        var cart = cartMapper.toItemResponse(cartLine, Set.of(cartLine.getId()), null);
        var order = orderItemMapper.toResponse(orderLine, null, null);
        assertThat(cart.available()).isFalse();
        assertThat(cart.brandName()).isNull();
        assertThat(order.categoryName()).isNull();
        assertThat(order.productName()).isEqualTo("Purchased product");
    }

    private ProductEntity product(String id) {
        ProductEntity product = new ProductEntity();
        product.setId(id);
        product.setSlug(id);
        product.setSku("PARENT-GROUP");
        product.setName("Current product");
        product.setRetailPrice(new BigDecimal("900000"));
        product.setCurrency("VND");
        product.setStockState(ProductStockState.IN_STOCK);
        product.setPublishStatus(PublishStatus.PUBLISHED);
        product.setCreatedAt(Instant.now());
        product.setUpdatedAt(Instant.now());
        return product;
    }

    private CategoryEntity category(String name) {
        CategoryEntity category = new CategoryEntity();
        category.setId("analytics-cat-" + UUID.randomUUID());
        category.setSlug(category.getId());
        category.setName(name);
        category.setCreatedAt(Instant.now());
        category.setUpdatedAt(Instant.now());
        em.persist(category);
        return category;
    }

    private CartItemEntity cartLine(String productKey) {
        CartItemEntity item = new CartItemEntity();
        item.setId(UUID.randomUUID());
        item.setProductPk(productKey);
        item.setSku("SELLING-BLUE-M");
        item.setProductName("Purchased product");
        item.setVariantName("Blue / M");
        item.setUnitPrice(new BigDecimal("1250000"));
        item.setQuantity(2);
        return item;
    }

    private OrderLineItemEntity orderLine(String productKey) {
        OrderLineItemEntity item = new OrderLineItemEntity();
        item.setId(UUID.randomUUID());
        item.setProductPk(productKey);
        item.setSku("SELLING-BLUE-M");
        item.setProductName("Purchased product");
        item.setVariantName("Blue / M");
        item.setUnitPrice(new BigDecimal("1250000"));
        item.setQuantity(2);
        return item;
    }
}
