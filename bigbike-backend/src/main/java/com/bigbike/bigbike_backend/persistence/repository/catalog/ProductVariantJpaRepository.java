package com.bigbike.bigbike_backend.persistence.repository.catalog;

import com.bigbike.bigbike_backend.domain.catalog.ProductStockState;
import com.bigbike.bigbike_backend.domain.catalog.PublishStatus;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductVariantEntity;
import java.util.List;
import java.util.Optional;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ProductVariantJpaRepository extends JpaRepository<ProductVariantEntity, String> {

    @Query("SELECT v FROM ProductVariantEntity v WHERE v.id = :id AND v.product.id = :productId")
    Optional<ProductVariantEntity> findByIdAndProductId(
            @Param("id") String id,
            @Param("productId") String productId
    );

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT v FROM ProductVariantEntity v JOIN FETCH v.product WHERE v.id = :id")
    Optional<ProductVariantEntity> findByIdForUpdate(@Param("id") String id);

    // Caller passes empty string (not null) for q so Postgres can resolve lower(?) to text.
    // (Null params inside lower(...) make Postgres infer bytea — see AdminInventoryService.)
    @Query("""
        SELECT v FROM ProductVariantEntity v JOIN FETCH v.product p
        WHERE (:q = ''
               OR LOWER(CAST(v.sku AS string)) LIKE LOWER(CONCAT('%', :q, '%'))
               OR LOWER(v.name) LIKE LOWER(CONCAT('%', :q, '%'))
               OR LOWER(p.name) LIKE LOWER(CONCAT('%', :q, '%')))
          AND (:state IS NULL OR v.stockState = :state)
          AND p.publishStatus <> :trashStatus
        ORDER BY p.name ASC, v.name ASC
        """)
    Page<ProductVariantEntity> searchStock(
            @Param("q") String q,
            @Param("state") ProductStockState state,
            @Param("trashStatus") PublishStatus trashStatus,
            Pageable pageable
    );

    @Query("SELECT COUNT(v) FROM ProductVariantEntity v WHERE v.stockState = :state")
    long countByStockState(@Param("state") ProductStockState state);

    @Query("SELECT COUNT(v) FROM ProductVariantEntity v WHERE v.stockState IN :states")
    long countByStockStateIn(@Param("states") List<ProductStockState> states);
}
