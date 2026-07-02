package com.bigbike.bigbike_backend.persistence.repository.catalog;

import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductVariantOptionEntity;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ProductVariantOptionJpaRepository extends JpaRepository<ProductVariantOptionEntity, Long> {
    long countByAttribute_Id(String attributeId);
    long countByAttributeValue_Id(String attributeValueId);
}
