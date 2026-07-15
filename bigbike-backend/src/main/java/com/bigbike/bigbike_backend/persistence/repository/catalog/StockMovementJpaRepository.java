package com.bigbike.bigbike_backend.persistence.repository.catalog;

import com.bigbike.bigbike_backend.persistence.entity.catalog.StockMovementEntity;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/**
 * The {@code stock_movements} ledger is dormant under the boolean availability model (V261):
 * nothing writes movements for sales/cancels. The admin movement-timeline endpoints were
 * removed 2026-07-15 (AUD-056); the two queries kept below only serve regression tests that
 * assert NO movements are written by checkout/cancel.
 */
public interface StockMovementJpaRepository extends JpaRepository<StockMovementEntity, UUID> {

    List<StockMovementEntity> findByReferenceTypeAndReferenceId(String referenceType, UUID referenceId);

    @Query("""
        SELECT m FROM StockMovementEntity m JOIN FETCH m.variant v JOIN FETCH v.product
        WHERE m.variant.id = :variantId
        ORDER BY m.createdAt DESC
        """)
    List<StockMovementEntity> findByVariantIdOrderByCreatedAtDesc(@Param("variantId") String variantId, Pageable pageable);
}
