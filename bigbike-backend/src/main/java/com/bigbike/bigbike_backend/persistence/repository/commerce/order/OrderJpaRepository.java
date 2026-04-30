package com.bigbike.bigbike_backend.persistence.repository.commerce.order;

import com.bigbike.bigbike_backend.persistence.entity.commerce.order.OrderEntity;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface OrderJpaRepository extends JpaRepository<OrderEntity, UUID>, JpaSpecificationExecutor<OrderEntity> {

    Optional<OrderEntity> findByLegacyId(Long legacyId);

    Optional<OrderEntity> findByOrderNumber(String orderNumber);

    Optional<OrderEntity> findByOrderKey(String orderKey);

    List<OrderEntity> findByCustomerId(UUID customerId);

    @Query("SELECT o FROM OrderEntity o WHERE o.customerId = :customerId ORDER BY o.placedAt DESC NULLS LAST, o.createdAt DESC")
    org.springframework.data.domain.Page<OrderEntity> findByCustomerIdPaged(
            @Param("customerId") UUID customerId, org.springframework.data.domain.Pageable pageable);

    List<OrderEntity> findByStatus(String status);

    List<OrderEntity> findByPaymentStatus(String paymentStatus);

    List<OrderEntity> findByCustomerPhone(String customerPhone);

    List<OrderEntity> findByCustomerEmail(String customerEmail);

    // ── Dashboard: KPI aggregates ──────────────────────────────────────────────

    @Query("SELECT COALESCE(SUM(o.totalAmount), 0) FROM OrderEntity o WHERE o.placedAt >= :from")
    BigDecimal sumRevenueSince(@Param("from") Instant from);

    @Query("SELECT COALESCE(SUM(o.totalAmount), 0) FROM OrderEntity o WHERE o.placedAt >= :from AND o.placedAt < :to")
    BigDecimal sumRevenueBetween(@Param("from") Instant from, @Param("to") Instant to);

    @Query("SELECT COUNT(o) FROM OrderEntity o WHERE o.placedAt >= :from")
    long countOrdersSince(@Param("from") Instant from);

    @Query("SELECT COUNT(o) FROM OrderEntity o WHERE o.placedAt >= :from AND o.placedAt < :to")
    long countOrdersBetween(@Param("from") Instant from, @Param("to") Instant to);

    long countByStatus(String status);

    // ── Dashboard: revenue series (native, VN timezone, avoids full entity load) ─

    @Query(value =
        "SELECT CAST(placed_at AT TIME ZONE 'Asia/Ho_Chi_Minh' AS DATE) AS day, " +
        "       COALESCE(SUM(total_amount), 0) AS revenue, " +
        "       COUNT(*) AS cnt " +
        "FROM orders " +
        "WHERE placed_at >= :from " +
        "GROUP BY 1 ORDER BY 1",
        nativeQuery = true)
    List<Object[]> revenueSeriesSince(@Param("from") Instant from);

    // ── Dashboard: order status breakdown (period-scoped) ─────────────────────

    @Query("SELECT o.status, COUNT(o) FROM OrderEntity o WHERE o.placedAt >= :from GROUP BY o.status")
    List<Object[]> countGroupedByStatusSince(@Param("from") Instant from);

    // ── Dashboard: recent orders ───────────────────────────────────────────────

    @Query("SELECT o FROM OrderEntity o WHERE o.placedAt IS NOT NULL ORDER BY o.placedAt DESC")
    List<OrderEntity> findRecentOrders(Pageable pageable);

    @Query("SELECT o.customerEmail, SUM(o.totalAmount), COUNT(o) " +
           "FROM OrderEntity o " +
           "WHERE o.placedAt >= :from AND o.placedAt < :to AND o.customerEmail IS NOT NULL " +
           "  AND o.status NOT IN :excludedStatuses " +
           "GROUP BY o.customerEmail " +
           "ORDER BY SUM(o.totalAmount) DESC")
    List<Object[]> topCustomersByRevenueInRange(
            @Param("from") Instant from, @Param("to") Instant to,
            @Param("excludedStatuses") List<String> excludedStatuses,
            Pageable pageable);

    // ── Reports: period aggregation (SQL-level, avoids loading every order) ──

    @Query("SELECT COALESCE(SUM(o.totalAmount), 0) FROM OrderEntity o " +
           "WHERE o.placedAt >= :from AND o.placedAt < :to AND o.status NOT IN :excludedStatuses")
    BigDecimal sumRevenueBetweenExcluding(
            @Param("from") Instant from, @Param("to") Instant to,
            @Param("excludedStatuses") List<String> excludedStatuses);

    @Query("SELECT COUNT(o) FROM OrderEntity o " +
           "WHERE o.placedAt >= :from AND o.placedAt < :to AND o.status NOT IN :excludedStatuses")
    long countOrdersBetweenExcluding(
            @Param("from") Instant from, @Param("to") Instant to,
            @Param("excludedStatuses") List<String> excludedStatuses);

    @Query("SELECT COALESCE(SUM(o.totalAmount), 0) FROM OrderEntity o " +
           "WHERE o.placedAt >= :from AND o.placedAt < :to AND o.status = 'REFUNDED'")
    BigDecimal sumRefundAmountInRange(@Param("from") Instant from, @Param("to") Instant to);

    // ── Reports: daily revenue series with range + status filter ─────────────

    @Query(value =
        "SELECT CAST(placed_at AT TIME ZONE 'Asia/Ho_Chi_Minh' AS DATE) AS day, " +
        "       COALESCE(SUM(total_amount), 0) AS revenue, " +
        "       COUNT(*) AS cnt " +
        "FROM orders " +
        "WHERE placed_at >= :from AND placed_at < :to AND status NOT IN :excludedStatuses " +
        "GROUP BY 1 ORDER BY 1",
        nativeQuery = true)
    List<Object[]> dailyRevenueInRange(
            @Param("from") Instant from, @Param("to") Instant to,
            @Param("excludedStatuses") List<String> excludedStatuses);
}
