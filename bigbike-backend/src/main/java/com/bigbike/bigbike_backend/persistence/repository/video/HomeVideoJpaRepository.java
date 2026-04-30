package com.bigbike.bigbike_backend.persistence.repository.video;

import com.bigbike.bigbike_backend.persistence.entity.video.HomeVideoEntity;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface HomeVideoJpaRepository extends JpaRepository<HomeVideoEntity, String> {
    List<HomeVideoEntity> findAllByOrderBySortOrderAsc();
    List<HomeVideoEntity> findByIsActiveTrueOrderBySortOrderAsc();
}
