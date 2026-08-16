package com.bigbike.bigbike_backend.persistence.repository.catalog;

import com.bigbike.bigbike_backend.persistence.entity.catalog.SizeScaleValueEntity;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SizeScaleValueJpaRepository extends JpaRepository<SizeScaleValueEntity, String> {
    List<SizeScaleValueEntity> findByScale_IdAndActiveTrueOrderBySortOrderAsc(String scaleId);
    List<SizeScaleValueEntity> findByScale_IdOrderBySortOrderAsc(String scaleId);
    Optional<SizeScaleValueEntity> findByScale_IdAndValueKey(String scaleId, String valueKey);
}
