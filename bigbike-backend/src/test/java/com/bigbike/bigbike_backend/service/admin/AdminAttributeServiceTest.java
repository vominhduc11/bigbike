package com.bigbike.bigbike_backend.service.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.bigbike.bigbike_backend.api.admin.dto.UpdateAttributeValueRequest;
import com.bigbike.bigbike_backend.api.error.ConflictException;
import com.bigbike.bigbike_backend.persistence.entity.catalog.AttributeValueEntity;
import com.bigbike.bigbike_backend.persistence.repository.catalog.AttributeJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.AttributeValueJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ProductVariantOptionJpaRepository;
import com.bigbike.bigbike_backend.service.admin.support.AuditLogFactory;
import com.bigbike.bigbike_backend.service.audit.AuditLogWriter;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class AdminAttributeServiceTest {

    @Test
    void blocksRenamingAValueUsedByVariants() {
        AttributeValueJpaRepository values = mock(AttributeValueJpaRepository.class);
        ProductVariantOptionJpaRepository options = mock(ProductVariantOptionJpaRepository.class);
        AdminAttributeService service = service(values, options);
        AttributeValueEntity value = value("value-red", "Đỏ");
        when(values.findById("value-red")).thenReturn(Optional.of(value));
        when(options.countByAttributeValue_Id("value-red")).thenReturn(2L);

        assertThatThrownBy(() -> service.updateValueLabel(
                "value-red", new UpdateAttributeValueRequest("Đỏ mới", "New red"), UUID.randomUUID()))
                .isInstanceOf(ConflictException.class)
                .hasMessageContaining("không thể đổi tên");
    }

    @Test
    void returnsUsageCountForAnUnusedValueAndAllowsRenamingIt() {
        AttributeValueJpaRepository values = mock(AttributeValueJpaRepository.class);
        ProductVariantOptionJpaRepository options = mock(ProductVariantOptionJpaRepository.class);
        AdminAttributeService service = service(values, options);
        AttributeValueEntity value = value("value-blue", "Xanh");
        when(values.findById("value-blue")).thenReturn(Optional.of(value));
        when(values.save(value)).thenReturn(value);
        when(options.countByAttributeValue_Id("value-blue")).thenReturn(0L);

        var response = service.updateValueLabel(
                "value-blue", new UpdateAttributeValueRequest("Xanh dương", "Blue"), UUID.randomUUID());

        assertThat(response.label()).isEqualTo("Xanh dương");
        assertThat(response.labelEn()).isEqualTo("Blue");
        assertThat(response.usageCount()).isZero();
    }

    private AdminAttributeService service(
            AttributeValueJpaRepository values,
            ProductVariantOptionJpaRepository options) {
        return new AdminAttributeService(
                mock(AttributeJpaRepository.class),
                values,
                options,
                mock(AuditLogWriter.class),
                mock(AuditLogFactory.class),
                mock(CatalogReferenceCacheEvictor.class));
    }

    private AttributeValueEntity value(String id, String label) {
        AttributeValueEntity value = new AttributeValueEntity();
        value.setId(id);
        value.setLabel(label);
        value.setLabelEn(null);
        value.setSlug(id);
        value.setSortOrder(0);
        return value;
    }
}
