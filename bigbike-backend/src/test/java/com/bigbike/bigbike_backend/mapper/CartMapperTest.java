package com.bigbike.bigbike_backend.mapper;

import static org.assertj.core.api.Assertions.assertThat;

import com.bigbike.bigbike_backend.persistence.entity.commerce.cart.CartItemEntity;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mapstruct.factory.Mappers;

class CartMapperTest {
    private final CartMapper mapper = Mappers.getMapper(CartMapper.class);

    @Test void opaqueProductIdSurvivesResponseMapping() {
        CartItemEntity item = item();
        item.setProductPk("prod_fixture");
        assertThat(mapper.toItemResponse(item, Set.of(), null).productId()).isEqualTo("prod_fixture");
    }

    @Test void opaqueVariantIdSurvivesResponseMapping() {
        CartItemEntity item = item();
        item.setProductVariantPk("var_fixture");
        assertThat(mapper.toItemResponse(item, Set.of(), null).productVariantId()).isEqualTo("var_fixture");
    }

    @Test void legacyUuidOnlyRowsKeepTheirExistingIdentifiers() {
        CartItemEntity item = item();
        UUID product = UUID.randomUUID(), variant = UUID.randomUUID();
        item.setProductId(product);
        item.setProductVariantId(variant);
        var response = mapper.toItemResponse(item, Set.of(), null);
        assertThat(response.productId()).isEqualTo(product.toString());
        assertThat(response.productVariantId()).isEqualTo(variant.toString());
    }

    @Test void simpleProductDoesNotInventVariantIdentity() {
        CartItemEntity item = item();
        assertThat(mapper.toItemResponse(item, Set.of(), null).productVariantId()).isNull();
    }

    private static CartItemEntity item() {
        CartItemEntity item = new CartItemEntity();
        item.setId(UUID.randomUUID());
        return item;
    }
}
