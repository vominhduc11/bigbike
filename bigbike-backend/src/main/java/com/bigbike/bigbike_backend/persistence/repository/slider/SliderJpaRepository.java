package com.bigbike.bigbike_backend.persistence.repository.slider;

import com.bigbike.bigbike_backend.persistence.entity.slider.SliderEntity;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SliderJpaRepository extends JpaRepository<SliderEntity, String> {
    List<SliderEntity> findByLocationOrderBySortOrderAsc(String location);
    Optional<SliderEntity> findByLocationAndSortOrder(String location, Integer sortOrder);
}
