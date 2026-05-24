package com.bigbike.bigbike_backend.persistence.repository.catalog;

import com.bigbike.bigbike_backend.persistence.entity.catalog.AttributeValueEntity;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AttributeValueJpaRepository extends JpaRepository<AttributeValueEntity, String> {
    Optional<AttributeValueEntity> findByAttributeIdAndSlug(String attributeId, String slug);
    Optional<AttributeValueEntity> findByLegacyTermId(Long legacyTermId);
    List<AttributeValueEntity> findAllByAttributeIdOrderBySortOrderAsc(String attributeId);
}
