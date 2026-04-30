package com.bigbike.bigbike_backend.persistence.repository.commerce.order;

import com.bigbike.bigbike_backend.persistence.entity.commerce.order.OrderLineItemEntity;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface OrderLineItemJpaRepository extends JpaRepository<OrderLineItemEntity, UUID> {

    List<OrderLineItemEntity> findByOrderId(UUID orderId);

    Optional<OrderLineItemEntity> findByLegacyItemId(Long legacyItemId);

    long countByOrderId(UUID orderId);

    @Query("SELECT li.order.id, COUNT(li) FROM OrderLineItemEntity li WHERE li.order.id IN :orderIds GROUP BY li.order.id")
    List<Object[]> countByOrderIdIn(@Param("orderIds") List<UUID> orderIds);

    // ── Dashboard: top products by revenue ───────────────────────────────────
    // Groups by productId so each product has a single stable row;
    // skips legacy line items that have no productId.

    @Query("SELECT li.productId, li.productName, SUM(li.lineTotal), SUM(li.quantity) " +
           "FROM OrderLineItemEntity li " +
           "WHERE li.order.placedAt >= :from AND li.productId IS NOT NULL " +
           "GROUP BY li.productId, li.productName " +
           "ORDER BY SUM(li.lineTotal) DESC")
    List<Object[]> topProductsByRevenueSince(@Param("from") Instant from, Pageable pageable);

    @Query("SELECT li.productId, li.productName, SUM(li.lineTotal), SUM(li.quantity) " +
           "FROM OrderLineItemEntity li " +
           "WHERE li.order.placedAt >= :from AND li.order.placedAt < :to AND li.productId IS NOT NULL " +
           "  AND li.order.status NOT IN :excludedStatuses " +
           "GROUP BY li.productId, li.productName " +
           "ORDER BY SUM(li.lineTotal) DESC")
    List<Object[]> topProductsByRevenueInRange(
            @Param("from") Instant from, @Param("to") Instant to,
            @Param("excludedStatuses") List<String> excludedStatuses,
            Pageable pageable);
}
