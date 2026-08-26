package com.bigbike.bigbike_backend.service.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.bigbike.bigbike_backend.api.error.ValidationException;
import com.bigbike.bigbike_backend.persistence.entity.catalog.AttributeEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.AttributeValueEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductVariantOptionEntity;
import com.bigbike.bigbike_backend.persistence.repository.catalog.AttributeValueJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ProductJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ProductVariantJpaRepository;
import com.bigbike.bigbike_backend.repository.catalog.CatalogReadRepository;
import com.bigbike.bigbike_backend.repository.catalog.JpaCatalogReadRepository;
import com.bigbike.bigbike_backend.service.admin.support.AuditLogFactory;
import com.bigbike.bigbike_backend.service.audit.AuditLogWriter;
import com.bigbike.bigbike_backend.service.catalog.DescriptionBlockRenderer;
import com.bigbike.bigbike_backend.service.inventory.InventoryPolicyService;
import com.bigbike.bigbike_backend.service.web.WebRevalidationService;
import com.bigbike.bigbike_backend.service.ws.AdminInventoryWsService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;

class VariantAttributeReferenceValidationTest {

    @Test
    void rejectsMissingAndMismatchedAttributeValueReferences() {
        AttributeValueJpaRepository values = mock(AttributeValueJpaRepository.class);
        ProductMutationService service = service(values);
        AttributeEntity color = new AttributeEntity();
        color.setCode("pa_color");
        color.setName("Màu sắc");
        AttributeValueEntity black = new AttributeValueEntity();
        black.setId("attr-value-black");
        black.setAttribute(color);
        black.setSlug("den");
        black.setLabel("Đen");
        when(values.findById("attr-value-black")).thenReturn(java.util.Optional.of(black));

        assertThatThrownBy(() -> service.linkAttributeReferences(
                new ProductVariantOptionEntity(), "Màu sắc", "Đen", null,
                "variants.2.options.1.attributeValueId"))
                .isInstanceOf(ValidationException.class)
                .satisfies(error -> assertThat(((ValidationException) error).details().get(0).field())
                        .isEqualTo("variants.2.options.1.attributeValueId"));
        assertThatThrownBy(() -> service.linkAttributeReferences(
                new ProductVariantOptionEntity(), "Kích cỡ", "Đen", "attr-value-black",
                "variants.2.options.1.attributeValueId"))
                .isInstanceOf(ValidationException.class)
                .satisfies(error -> assertThat(((ValidationException) error).details().get(0).field())
                        .isEqualTo("variants.2.options.1.attributeValueId"));
    }

    @Test
    void storesBothAttributeLinksWhenReferenceMatches() {
        AttributeValueJpaRepository values = mock(AttributeValueJpaRepository.class);
        ProductMutationService service = service(values);
        AttributeEntity color = new AttributeEntity();
        color.setCode("pa_color");
        color.setName("Màu sắc");
        AttributeValueEntity black = new AttributeValueEntity();
        black.setId("attr-value-black");
        black.setAttribute(color);
        black.setSlug("den");
        black.setLabel("Đen");
        when(values.findById("attr-value-black")).thenReturn(java.util.Optional.of(black));
        ProductVariantOptionEntity option = new ProductVariantOptionEntity();

        service.linkAttributeReferences(option, "Màu sắc", "Đen", "attr-value-black");

        assertThat(option.getAttribute()).isSameAs(color);
        assertThat(option.getAttributeValue()).isSameAs(black);
    }

    private ProductMutationService service(AttributeValueJpaRepository values) {
        return new ProductMutationService(
                provider(mock(ProductJpaRepository.class)),
                provider(mock(ProductVariantJpaRepository.class)),
                provider(values),
                mock(CatalogReadRepository.class),
                provider(mock(JpaCatalogReadRepository.class)),
                mock(WebRevalidationService.class),
                mock(AuditLogWriter.class),
                mock(AuditLogFactory.class),
                mock(DescriptionBlockRenderer.class),
                mock(CatalogRequestValidator.class),
                mock(InventoryPolicyService.class),
                mock(SlugRedirectHelper.class),
                mock(AdminInventoryWsService.class),
                mock(CatalogReferenceCacheEvictor.class));
    }

    private static <T> ObjectProvider<T> provider(T value) {
        return new ObjectProvider<>() {
            @Override
            public T getObject() {
                return value;
            }
        };
    }
}
