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

    /**
     * Chat-only projection. It deliberately avoids line items, addresses,
 * payment rows and the full order entity so BigBike Assistant cannot accidentally receive
     * customer-sensitive order detail.
     */
    @Query("SELECT o.id, o.orderNumber, o.status, o.placedAt, o.createdAt, o.totalAmount, o.currency "
            + "FROM OrderEntity o WHERE o.customerId = :customerId "
            + "ORDER BY o.placedAt DESC NULLS LAST, o.createdAt DESC, o.orderNumber DESC")
    List<Object[]> findCustomerOrderSummaries(
            @Param("customerId") UUID customerId, org.springframework.data.domain.Pageable pageable);

    List<OrderEntity> findByStatus(String status);

    @Query(value = """
            select orders_row.*
            from orders orders_row
            where orders_row.status = 'COMPLETED'
              and orders_row.legacy_id is null
              and orders_row.completed_at >= :activatedAt
              and orders_row.customer_email is not null
              and btrim(orders_row.customer_email) <> ''
              and not exists (
                  select 1 from review_invitation_deliveries delivery
                  where delivery.order_id = orders_row.id
              )
            order by orders_row.completed_at, orders_row.id
            """, nativeQuery = true)
    List<OrderEntity> findReviewInvitationCandidates(
            @Param("activatedAt") Instant activatedAt,
            Pageable pageable);

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
           "FROM OrderEntity o WHERE o.customerId IN :ids AND o.status <> 'CANCELLED' GROUP BY o.customerId")
    List<Object[]> countAndSumByCustomerIds(@Param("ids") java.util.Collection<UUID> ids);

    // Customer IDs whose non-cancelled lifetime order total reaches the VIP threshold —
    // mirrors AdminCustomerService.deriveSegment so the KPI count and the
    // per-customer segment label stay in agreement (CUSTOMER_RULE_006).
    @Query("SELECT o.customerId FROM OrderEntity o WHERE o.customerId IS NOT NULL AND o.status <> 'CANCELLED' "
           + "GROUP BY o.customerId HAVING COALESCE(SUM(o.totalAmount), 0) >= :threshold")
    List<UUID> findVipCustomerIds(@Param("threshold") BigDecimal threshold);

    // ── Dashboard: KPI aggregates ──────────────────────────────────────────────

    // Gross GMV: total order value placed regardless of payment records (includes unpaid/cancelled)
    @Query("SELECT COALESCE(SUM(o.totalAmount), 0) FROM OrderEntity o WHERE o.placedAt >= :from")
    BigDecimal sumRevenueSince(@Param("from") Instant from);

    @Query("SELECT COALESCE(SUM(o.totalAmount), 0) FROM OrderEntity o WHERE o.placedAt >= :from AND o.placedAt < :to")
    BigDecimal sumRevenueBetween(@Param("from") Instant from, @Param("to") Instant to);

    // Compatibility query for paidRevenue response: completed-order total value.
    @Query("SELECT COALESCE(SUM(o.totalAmount), 0) FROM OrderEntity o " +
           "WHERE o.placedAt >= :from AND o.status = 'COMPLETED'")
    BigDecimal sumPaidRevenueSince(@Param("from") Instant from);

    // Compatibility query for todayPaidRevenue: COMPLETED orders only.
    @Query("SELECT COALESCE(SUM(o.totalAmount), 0) FROM OrderEntity o " +
           "WHERE o.placedAt >= :from AND o.status = 'COMPLETED'")
    BigDecimal sumPaidRevenueSinceExcluding(
            @Param("from") Instant from);

    @Query("SELECT COALESCE(SUM(o.totalAmount), 0) FROM OrderEntity o " +
           "WHERE o.placedAt >= :from AND o.placedAt < :to AND o.status = 'COMPLETED'")
    BigDecimal sumPaidRevenueBetween(@Param("from") Instant from, @Param("to") Instant to);

    @Query("SELECT COUNT(o) FROM OrderEntity o WHERE o.placedAt >= :from")
    long countOrdersSince(@Param("from") Instant from);

    @Query("SELECT COUNT(o) FROM OrderEntity o WHERE o.placedAt >= :from AND o.placedAt < :to")
    long countOrdersBetween(@Param("from") Instant from, @Param("to") Instant to);

    long countByStatus(String status);

    @Query(value = """
            select count(*)
            from orders orders_row
            where orders_row.status = :status
              and not exists (
                  select 1
                  from order_history_batch_orders membership
                  join order_history_batches batch on batch.id = membership.batch_id
                  where membership.order_id = orders_row.id and batch.active = true
              )
            """, nativeQuery = true)
    long countOperationalByStatus(@Param("status") String status);

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

    @Query(value = """
            select orders_row.status, count(*)
            from orders orders_row
            where orders_row.placed_at >= :from
              and not exists (
                  select 1
                  from order_history_batch_orders membership
                  join order_history_batches batch on batch.id = membership.batch_id
                  where membership.order_id = orders_row.id and batch.active = true
              )
            group by orders_row.status
            """, nativeQuery = true)
    List<Object[]> countOperationalGroupedByStatusSince(@Param("from") Instant from);

    // ── Dashboard: recent orders ───────────────────────────────────────────────

    @Query("SELECT o FROM OrderEntity o WHERE o.placedAt IS NOT NULL ORDER BY o.placedAt DESC")
    List<OrderEntity> findRecentOrders(Pageable pageable);

    @Query(value = """
            select orders_row.*
            from orders orders_row
            where orders_row.placed_at is not null
              and not exists (
                  select 1
                  from order_history_batch_orders membership
                  join order_history_batches batch on batch.id = membership.batch_id
                  where membership.order_id = orders_row.id and batch.active = true
              )
            order by orders_row.placed_at desc, orders_row.created_at desc, orders_row.id desc
            """, nativeQuery = true)
    List<OrderEntity> findRecentOperationalOrders(Pageable pageable);

    @Query(value = """
            select orders_row.*
            from orders orders_row
            where orders_row.status = 'PENDING'
              and coalesce(orders_row.placed_at, orders_row.created_at) < :cutoff
              and not exists (
                  select 1
                  from order_history_batch_orders membership
                  join order_history_batches batch on batch.id = membership.batch_id
                  where membership.order_id = orders_row.id and batch.active = true
              )
              and not exists (
                  select 1 from order_overdue_reminder_orders reminder
                  where reminder.order_id = orders_row.id
              )
            order by coalesce(orders_row.placed_at, orders_row.created_at), orders_row.id
            """, nativeQuery = true)
    List<OrderEntity> findUnremindedOverdueOperationalPending(@Param("cutoff") Instant cutoff);

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

    // ── Dashboard: valid-order aggregates (excludes CANCELLED) ────────────────

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

    // Compatibility query for paidRevenue: COMPLETED-order total value.
    @Query("SELECT COALESCE(SUM(o.totalAmount), 0) FROM OrderEntity o " +
           "WHERE o.placedAt >= :from AND o.placedAt < :to " +
           "  AND o.status = 'COMPLETED'")
    BigDecimal sumPaidRevenueBetweenExcluding(
            @Param("from") Instant from, @Param("to") Instant to);

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
