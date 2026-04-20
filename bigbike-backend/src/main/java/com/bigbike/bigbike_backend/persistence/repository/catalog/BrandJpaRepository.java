package com.bigbike.bigbike_backend.persistence.repository.catalog;

import com.bigbike.bigbike_backend.persistence.entity.catalog.BrandEntity;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface BrandJpaRepository extends JpaRepository<BrandEntity, String> {
    Optional<BrandEntity> findBySlug(String slug);
}
