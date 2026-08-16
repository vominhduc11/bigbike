package com.bigbike.bigbike_backend.persistence.repository.catalog;

import com.bigbike.bigbike_backend.persistence.entity.catalog.SizeScaleGroupEntity;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SizeScaleGroupJpaRepository extends JpaRepository<SizeScaleGroupEntity, String> {

    List<SizeScaleGroupEntity> findAllByOrderBySortOrderAscGroupKeyAsc();

    List<SizeScaleGroupEntity> findAllByActiveTrueOrderBySortOrderAscGroupKeyAsc();
}
