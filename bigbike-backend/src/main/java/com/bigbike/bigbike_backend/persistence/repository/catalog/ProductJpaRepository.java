package com.bigbike.bigbike_backend.persistence.repository.catalog;

import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductEntity;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ProductJpaRepository extends JpaRepository<ProductEntity, String> {
    Optional<ProductEntity> findBySlug(String slug);
}
