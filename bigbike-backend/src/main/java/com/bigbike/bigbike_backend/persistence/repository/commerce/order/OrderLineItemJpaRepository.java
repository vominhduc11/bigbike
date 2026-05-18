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

    @Query("SELECT li.order.id, li.productName FROM OrderLineItemEntity li WHERE li.order.id IN :orderIds ORDER BY li.order.id")
    List<Object[]> findProductNamesByOrderIdIn(@Param("orderIds") List<UUID> orderIds);

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

    // ── Dashboard: top products using product_pk (covers admin-created products) ─
    // product_pk is the string PK from the products table; productId (UUID) is null
    // for admin-created products, so we use productPk as the grouping key.

    @Query("SELECT li.productPk, li.productName, SUM(li.lineTotal), SUM(li.quantity) " +
           "FROM OrderLineItemEntity li " +
           "WHERE li.order.placedAt >= :from AND li.productPk IS NOT NULL " +
           "  AND li.order.status NOT IN :excludedStatuses " +
           "GROUP BY li.productPk, li.productName " +
           "ORDER BY SUM(li.lineTotal) DESC")
    List<Object[]> topProductsByRevenueSinceExcluding(
            @Param("from") Instant from,
            @Param("excludedStatuses") List<String> excludedStatuses,
            Pageable pageable);

    // Native query: COALESCE(product_pk, product_id::text) covers both admin-created products
    // (product_id = null, product_pk set) and regular products (both set).
    // Filtering productId IS NOT NULL (legacy behavior) silently excluded admin-created products.
    @Query(value =
        "SELECT COALESCE(li.product_pk, li.product_id::text) AS product_key, " +
        "       li.product_name, " +
        "       COALESCE(SUM(li.line_total), 0)              AS revenue, " +
        "       COALESCE(SUM(li.quantity), 0)                AS units_sold " +
        "FROM order_line_items li " +
        "JOIN orders o ON o.id = li.order_id " +
        "WHERE o.placed_at >= :from AND o.placed_at < :to " +
        "  AND o.status NOT IN :excludedStatuses " +
        "  AND (li.product_pk IS NOT NULL OR li.product_id IS NOT NULL) " +
        "GROUP BY COALESCE(li.product_pk, li.product_id::text), li.product_name " +
        "ORDER BY COALESCE(SUM(li.line_total), 0) DESC",
        nativeQuery = true)
    List<Object[]> topProductsByRevenueInRangeNative(
            @Param("from") Instant from, @Param("to") Instant to,
            @Param("excludedStatuses") List<String> excludedStatuses,
            Pageable pageable);
}
