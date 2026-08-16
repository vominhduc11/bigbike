package com.bigbike.bigbike_backend.persistence.repository.catalog;

import com.bigbike.bigbike_backend.persistence.entity.catalog.LegacyDiscontinuedProductEntity;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

public interface LegacyDiscontinuedProductJpaRepository
        extends JpaRepository<LegacyDiscontinuedProductEntity, UUID>,
        JpaSpecificationExecutor<LegacyDiscontinuedProductEntity> {

    Optional<LegacyDiscontinuedProductEntity> findBySlugAndEnabledTrue(String slug);

    boolean existsBySlug(String slug);

    boolean existsBySlugAndIdNot(String slug, UUID id);
}
