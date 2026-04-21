package com.bigbike.bigbike_backend.persistence.repository.catalog;

import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductVariantEntity;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ProductVariantJpaRepository extends JpaRepository<ProductVariantEntity, String> {

    @Query("SELECT v FROM ProductVariantEntity v WHERE v.id = :id AND v.product.id = :productId")
    Optional<ProductVariantEntity> findByIdAndProductId(
            @Param("id") String id,
            @Param("productId") String productId
    );
}
