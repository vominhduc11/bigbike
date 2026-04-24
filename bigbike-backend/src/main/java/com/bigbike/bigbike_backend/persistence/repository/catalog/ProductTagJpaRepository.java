package com.bigbike.bigbike_backend.persistence.repository.catalog;

import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductTagEntity;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ProductTagJpaRepository extends JpaRepository<ProductTagEntity, String> {
    Optional<ProductTagEntity> findBySlug(String slug);
}
