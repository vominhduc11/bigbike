package com.bigbike.bigbike_backend.persistence.repository.catalog;

import com.bigbike.bigbike_backend.persistence.entity.catalog.StockMovementEntity;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface StockMovementJpaRepository extends JpaRepository<StockMovementEntity, UUID> {

    boolean existsByReferenceTypeAndReferenceId(String referenceType, UUID referenceId);

    List<StockMovementEntity> findByReferenceTypeAndReferenceId(String referenceType, UUID referenceId);

    @Query("""
        SELECT m FROM StockMovementEntity m JOIN FETCH m.variant v JOIN FETCH v.product
        WHERE m.variant.id = :variantId
        ORDER BY m.createdAt DESC
        """)
    List<StockMovementEntity> findByVariantIdOrderByCreatedAtDesc(@Param("variantId") String variantId, Pageable pageable);

    long countByVariantId(String variantId);

    long countByProductId(String productId);

    @Query("""
        SELECT m FROM StockMovementEntity m
        LEFT JOIN FETCH m.variant v
        LEFT JOIN FETCH v.product p
        WHERE m.productId = :productId
           OR (v IS NOT NULL AND p.id = :productId)
        ORDER BY m.createdAt DESC
        """)
    List<StockMovementEntity> findByProductScopeOrderByCreatedAtDesc(
            @Param("productId") String productId, Pageable pageable
    );

    @Query("""
        SELECT COUNT(m) FROM StockMovementEntity m
        LEFT JOIN m.variant v
        LEFT JOIN v.product p
        WHERE m.productId = :productId
           OR (v IS NOT NULL AND p.id = :productId)
        """)
    long countByProductScope(@Param("productId") String productId);

    @Query("""
        SELECT m FROM StockMovementEntity m LEFT JOIN FETCH m.variant v LEFT JOIN FETCH v.product
        WHERE (:movementType IS NULL OR m.movementType = :movementType)
          AND (:referenceType IS NULL OR m.referenceType = :referenceType)
        ORDER BY m.createdAt DESC
        """)
    Page<StockMovementEntity> searchMovements(
            @Param("movementType") String movementType,
            @Param("referenceType") String referenceType,
            Pageable pageable
    );
}
