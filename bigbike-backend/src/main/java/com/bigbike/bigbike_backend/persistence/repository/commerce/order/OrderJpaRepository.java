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
import org.springframework.data.jpa.repository.Modifying;
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

    /**
     * Orders eligible for unpaid auto-cancel: still ON_HOLD, never paid, placed
     * before {@code cutoff}, using a manual-confirm payment method (BACS).
     * Used by {@code OrderAutoCancelScheduler}.
     */
    @Query("""
            SELECT o FROM OrderEntity o
            WHERE o.status = 'ON_HOLD'
              AND o.paymentStatus = 'UNPAID'
              AND o.paymentMethod IN ('BACS')
              AND o.placedAt IS NOT NULL
              AND o.placedAt < :cutoff
            """)
    List<OrderEntity> findBacsUnpaidOnHoldOlderThan(@Param("cutoff") Instant cutoff);

    List<OrderEntity> findByCustomerPhone(String customerPhone);

    List<OrderEntity> findByCustomerEmail(String customerEmail);

    /**
     * Atomically claims all unowned guest orders matching a verified customer email.
     * Only updates rows where customer_id IS NULL, preventing overwrite of another
     * customer's orders. Email comparison is case-insensitive via lower(). Idempotent.
     *
     * TODO: Add a functional index on lower(customer_email) when table grows large,
     *       e.g.: CREATE INDEX idx_orders_lower_customer_email ON orders (lower(customer_email))
     *       to make this update efficient at scale.
     */
    @Modifying
    @Query(value = """
            UPDATE orders
            SET customer_id = :customerId,
                updated_at  = :now
            WHERE customer_id IS NULL
              AND customer_email IS NOT NULL
              AND lower(trim(customer_email)) = :normalizedEmail
            """, nativeQuery = true)
    int linkGuestOrdersByEmail(
            @Param("customerId") UUID customerId,
            @Param("normalizedEmail") String normalizedEmail,
            @Param("now") Instant now);

    // ── Customer admin aggregate ──────────────────────────────────────────────

    @Query("SELECT o.customerId, COUNT(o), COALESCE(SUM(o.totalAmount), 0) " +
           "FROM OrderEntity o WHERE o.customerId IN :ids GROUP BY o.customerId")
    List<Object[]> countAndSumByCustomerIds(@Param("ids") java.util.Collection<UUID> ids);

    // Customer IDs whose lifetime order total reaches the VIP threshold —
    // mirrors AdminCustomerService.deriveSegment so the KPI count and the
    // per-customer segment label stay in agreement.
    @Query("SELECT o.customerId FROM OrderEntity o WHERE o.customerId IS NOT NULL "
           + "GROUP BY o.customerId HAVING COALESCE(SUM(o.totalAmount), 0) >= :threshold")
    List<UUID> findVipCustomerIds(@Param("threshold") BigDecimal threshold);

    // ── POS background jobs ───────────────────────────────────────────────────

    // ── Dashboard: KPI aggregates ──────────────────────────────────────────────

    // Gross GMV: total order value placed regardless of payment status (includes unpaid/cancelled)
    @Query("SELECT COALESCE(SUM(o.totalAmount), 0) FROM OrderEntity o WHERE o.placedAt >= :from")
    BigDecimal sumRevenueSince(@Param("from") Instant from);

    @Query("SELECT COALESCE(SUM(o.totalAmount), 0) FROM OrderEntity o WHERE o.placedAt >= :from AND o.placedAt < :to")
    BigDecimal sumRevenueBetween(@Param("from") Instant from, @Param("to") Instant to);

    // Paid revenue: actual cash collected — SUM(paidAmount) for orders where payment was received
    @Query("SELECT COALESCE(SUM(o.paidAmount), 0) FROM OrderEntity o " +
           "WHERE o.placedAt >= :from AND o.paymentStatus IN ('PAID', 'REFUNDED')")
    BigDecimal sumPaidRevenueSince(@Param("from") Instant from);

    // Canonical paid revenue: PAID and REFUNDED orders (paidAmount is never reduced by RefundService).
    @Query("SELECT COALESCE(SUM(o.paidAmount), 0) FROM OrderEntity o " +
           "WHERE o.placedAt >= :from " +
           "  AND o.paymentStatus IN ('PAID', 'REFUNDED') " +
           "  AND o.status NOT IN :excludedStatuses")
    BigDecimal sumPaidRevenueSinceExcluding(
            @Param("from") Instant from,
            @Param("excludedStatuses") List<String> excludedStatuses);

    @Query("SELECT COALESCE(SUM(o.paidAmount), 0) FROM OrderEntity o " +
           "WHERE o.placedAt >= :from AND o.placedAt < :to AND o.paymentStatus IN ('PAID', 'REFUNDED')")
    BigDecimal sumPaidRevenueBetween(@Param("from") Instant from, @Param("to") Instant to);

    @Query("SELECT COUNT(o) FROM OrderEntity o WHERE o.placedAt >= :from")
    long countOrdersSince(@Param("from") Instant from);

    @Query("SELECT COUNT(o) FROM OrderEntity o WHERE o.placedAt >= :from AND o.placedAt < :to")
    long countOrdersBetween(@Param("from") Instant from, @Param("to") Instant to);

    long countByStatus(String status);

    // ── Dashboard: revenue series (native, VN timezone, avoids full entity load) ─

    @Query(value =
        "SELECT CAST(placed_at AT TIME ZONE 'Asia/Ho_Chi_Minh' AS DATE) AS report_day, " +
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

    // ── Dashboard: valid-order aggregates (excludes CANCELLED/FAILED/REFUNDED) ─

    @Query("SELECT COALESCE(SUM(o.totalAmount), 0) FROM OrderEntity o " +
           "WHERE o.placedAt >= :from AND o.status NOT IN :excludedStatuses")
    BigDecimal sumRevenueSinceExcluding(
            @Param("from") Instant from,
            @Param("excludedStatuses") List<String> excludedStatuses);

    @Query("SELECT COUNT(o) FROM OrderEntity o " +
           "WHERE o.placedAt >= :from AND o.status NOT IN :excludedStatuses")
    long countOrdersSinceExcluding(
            @Param("from") Instant from,
            @Param("excludedStatuses") List<String> excludedStatuses);

    @Query(value =
        "SELECT CAST(placed_at AT TIME ZONE 'Asia/Ho_Chi_Minh' AS DATE) AS report_day, " +
        "       COALESCE(SUM(total_amount), 0) AS revenue, " +
        "       COUNT(*) AS cnt " +
        "FROM orders " +
        "WHERE placed_at >= :from AND status NOT IN :excludedStatuses " +
        "GROUP BY 1 ORDER BY 1",
        nativeQuery = true)
    List<Object[]> revenueSeriesSinceExcluding(
            @Param("from") Instant from,
            @Param("excludedStatuses") List<String> excludedStatuses);

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

    @Query("SELECT COALESCE(SUM(o.refundAmount), 0) FROM OrderEntity o " +
           "WHERE o.placedAt >= :from AND o.placedAt < :to AND o.refundAmount > 0")
    BigDecimal sumRefundAmountInRange(@Param("from") Instant from, @Param("to") Instant to);

    // Paid revenue: PAID and REFUNDED statuses (paidAmount is never reduced by RefundService.applyRefund()).
    @Query("SELECT COALESCE(SUM(o.paidAmount), 0) FROM OrderEntity o " +
           "WHERE o.placedAt >= :from AND o.placedAt < :to " +
           "  AND o.paymentStatus IN ('PAID', 'REFUNDED') " +
           "  AND o.status NOT IN :excludedStatuses")
    BigDecimal sumPaidRevenueBetweenExcluding(
            @Param("from") Instant from, @Param("to") Instant to,
            @Param("excludedStatuses") List<String> excludedStatuses);

    // Top customers using COALESCE(customer_id::text, customer_email) as group key.
    // Prevents the same customer appearing in multiple rows if their email changed.
    // MAX(customer_email) is used as display email.
    @Query(value =
        "SELECT COALESCE(customer_id::text, customer_email) AS customer_key, " +
        "       MAX(customer_email)                         AS display_email, " +
        "       COALESCE(SUM(total_amount), 0)              AS total_revenue, " +
        "       COUNT(*)                                     AS order_count " +
        "FROM orders " +
        "WHERE placed_at >= :from AND placed_at < :to " +
        "  AND (customer_id IS NOT NULL OR customer_email IS NOT NULL) " +
        "  AND status NOT IN :excludedStatuses " +
        "GROUP BY COALESCE(customer_id::text, customer_email) " +
        "ORDER BY COALESCE(SUM(total_amount), 0) DESC",
        nativeQuery = true)
    List<Object[]> topCustomersByRevenueInRangeCoalesce(
            @Param("from") Instant from, @Param("to") Instant to,
            @Param("excludedStatuses") List<String> excludedStatuses,
            Pageable pageable);

    // ── Reports: daily revenue series with range + status filter ─────────────

    @Query(value =
        "SELECT CAST(placed_at AT TIME ZONE 'Asia/Ho_Chi_Minh' AS DATE) AS report_day, " +
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
