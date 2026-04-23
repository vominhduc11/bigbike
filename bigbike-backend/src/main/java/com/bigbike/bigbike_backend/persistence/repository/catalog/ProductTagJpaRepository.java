package com.bigbike.bigbike_backend.persistence.repository.catalog;

import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductTagEntity;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ProductTagJpaRepository extends JpaRepository<ProductTagEntity, Long> {
    boolean existsByProductIdAndTag(String productId, String tag);
}
