package com.bigbike.bigbike_backend.persistence.repository.catalog;

import com.bigbike.bigbike_backend.domain.catalog.ProductSerialStatus;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductSerialEntity;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ProductSerialJpaRepository extends JpaRepository<ProductSerialEntity, UUID> {

    Page<ProductSerialEntity> findByVariant_IdOrderByReceivedAtDesc(String variantId, Pageable pageable);

    Page<ProductSerialEntity> findByVariant_IdAndStatusOrderByReceivedAtDesc(
            String variantId, ProductSerialStatus status, Pageable pageable);

    @Query("SELECT s FROM ProductSerialEntity s " +
           "WHERE s.product.id = :productId AND s.variant IS NULL " +
           "ORDER BY s.receivedAt DESC")
    Page<ProductSerialEntity> findByProductIdNoVariant(
            @Param("productId") String productId, Pageable pageable);

    @Query("SELECT s FROM ProductSerialEntity s " +
           "WHERE s.product.id = :productId AND s.variant IS NULL AND s.status = :status " +
           "ORDER BY s.receivedAt DESC")
    Page<ProductSerialEntity> findByProductIdNoVariantAndStatus(
            @Param("productId") String productId,
            @Param("status") ProductSerialStatus status,
            Pageable pageable);

    long countByVariant_IdAndStatus(String variantId, ProductSerialStatus status);

    long countByProduct_IdAndVariantIsNullAndStatus(String productId, ProductSerialStatus status);

    Optional<ProductSerialEntity> findByChassisNumber(String chassisNumber);

    Optional<ProductSerialEntity> findByEngineNumber(String engineNumber);

    @Query("""
        SELECT s.chassisNumber FROM ProductSerialEntity s
        WHERE s.chassisNumber IN :numbers
        """)
    List<String> findExistingChassisNumbers(@Param("numbers") List<String> numbers);

    @Query("""
        SELECT s.engineNumber FROM ProductSerialEntity s
        WHERE s.engineNumber IN :numbers
        """)
    List<String> findExistingEngineNumbers(@Param("numbers") List<String> numbers);

    @Query("""
        SELECT s FROM ProductSerialEntity s
        WHERE s.status = com.bigbike.bigbike_backend.domain.catalog.ProductSerialStatus.RESERVED
          AND s.reservedUntil IS NOT NULL
          AND s.reservedUntil < :now
        """)
    List<ProductSerialEntity> findExpiredReservations(@Param("now") java.time.Instant now);

    // ── Queries needed by SerialLifecycleService ──────────────────────────────

    /**
     * Picks the oldest IN_STOCK serials for a variant with a row-level write lock
     * (FOR UPDATE SKIP LOCKED) to prevent concurrent checkout double-reservation.
     * Uses native query because JPQL cannot express SKIP LOCKED.
     */
    @org.springframework.data.jpa.repository.Query(
        value = """
            SELECT * FROM product_serials
            WHERE product_variant_id = :variantId
              AND status = 'IN_STOCK'
            ORDER BY received_at ASC
            LIMIT :limit
            FOR UPDATE SKIP LOCKED
            """,
        nativeQuery = true
    )
    List<ProductSerialEntity> findAvailableForVariantWithLock(
            @Param("variantId") String variantId,
            @Param("limit") int limit
    );

    /**
     * Picks the oldest IN_STOCK serials for a product with no variant assigned.
     */
    @org.springframework.data.jpa.repository.Query(
        value = """
            SELECT * FROM product_serials
            WHERE product_id = :productId
              AND product_variant_id IS NULL
              AND status = 'IN_STOCK'
            ORDER BY received_at ASC
            LIMIT :limit
            FOR UPDATE SKIP LOCKED
            """,
        nativeQuery = true
    )
    List<ProductSerialEntity> findAvailableForProductNoVariantWithLock(
            @Param("productId") String productId,
            @Param("limit") int limit
    );

    @Query("""
        SELECT s FROM ProductSerialEntity s
        WHERE s.orderLineItemId IN (
            SELECT li.id FROM OrderLineItemEntity li WHERE li.order.id = :orderId
        )
        """)
    List<ProductSerialEntity> findByOrderId(@Param("orderId") UUID orderId);

    @Query("""
        SELECT s FROM ProductSerialEntity s
        WHERE s.orderLineItemId = :lineItemId
        """)
    List<ProductSerialEntity> findByOrderLineItemId(@Param("lineItemId") UUID lineItemId);

    @Query("""
        SELECT s FROM ProductSerialEntity s
        WHERE s.returnItemId IN (
            SELECT ri.id FROM ReturnItemEntity ri WHERE ri.returnId = :returnId
        )
        """)
    List<ProductSerialEntity> findByReturnId(@Param("returnId") UUID returnId);

    long countByVariant_IdAndStatusIn(String variantId, List<ProductSerialStatus> statuses);

    long countByProduct_IdAndVariantIsNullAndStatusIn(String productId, List<ProductSerialStatus> statuses);
}
