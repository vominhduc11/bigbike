package com.bigbike.bigbike_backend.persistence.repository.commerce.receivable;

import com.bigbike.bigbike_backend.persistence.entity.commerce.receivable.ReceivableEntity;
import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ReceivableJpaRepository extends JpaRepository<ReceivableEntity, UUID> {

    Optional<ReceivableEntity> findByOrderId(UUID orderId);

    Page<ReceivableEntity> findByCustomerId(UUID customerId, Pageable pageable);

    /** Outstanding balance for a customer (non-closed, non-written-off). */
    @Query("""
            SELECT COALESCE(SUM(r.outstandingAmount), 0)
            FROM ReceivableEntity r
            WHERE r.customerId = :customerId
              AND r.status NOT IN ('CLOSED', 'WRITTEN_OFF')
            """)
    BigDecimal sumOutstandingByCustomerId(@Param("customerId") UUID customerId);

    /** Summary aggregates for the AR overview panel. Native query ensures a single row even on empty table. */
    @Query(value = """
            SELECT
                COALESCE(SUM(outstanding_amount), 0) AS total_outstanding,
                COALESCE(SUM(CASE WHEN status = 'OVERDUE' THEN outstanding_amount ELSE 0 END), 0) AS overdue_outstanding,
                COUNT(CASE WHEN status IN ('OPEN','PARTIALLY_PAID','OVERDUE') THEN 1 END) AS count_open,
                COUNT(CASE WHEN status = 'OVERDUE' THEN 1 END) AS count_overdue
            FROM accounts_receivable
            WHERE status NOT IN ('CLOSED', 'WRITTEN_OFF')
            """, nativeQuery = true)
    Object[] getSummaryAggregates();

    @Query("""
            SELECT COALESCE(SUM(r.writtenOffAmount), 0)
            FROM ReceivableEntity r
            WHERE r.status = 'WRITTEN_OFF'
            """)
    BigDecimal sumWrittenOff();

    /** Aging buckets: outstanding grouped by overdue days. */
    @Query(value = """
            SELECT
                COALESCE(SUM(CASE WHEN due_date IS NULL OR due_date >= CURRENT_DATE THEN outstanding_amount ELSE 0 END), 0) AS not_due,
                COALESCE(SUM(CASE WHEN due_date < CURRENT_DATE AND CURRENT_DATE - due_date <= 30 THEN outstanding_amount ELSE 0 END), 0) AS days_0_30,
                COALESCE(SUM(CASE WHEN CURRENT_DATE - due_date BETWEEN 31 AND 60 THEN outstanding_amount ELSE 0 END), 0) AS days_31_60,
                COALESCE(SUM(CASE WHEN CURRENT_DATE - due_date BETWEEN 61 AND 90 THEN outstanding_amount ELSE 0 END), 0) AS days_61_90,
                COALESCE(SUM(CASE WHEN CURRENT_DATE - due_date > 90 THEN outstanding_amount ELSE 0 END), 0) AS over_90
            FROM accounts_receivable
            WHERE status NOT IN ('CLOSED','WRITTEN_OFF')
            """, nativeQuery = true)
    Object[] getAgingBuckets();

    /** Filtered paginated list. */
    @Query("""
            SELECT r FROM ReceivableEntity r
            WHERE (:status IS NULL OR r.status = :status)
              AND (:customerId IS NULL OR r.customerId = :customerId)
              AND (:keyword IS NULL OR LOWER(r.customerName) LIKE LOWER(CONCAT('%', :keyword, '%'))
                   OR LOWER(r.customerPhone) LIKE LOWER(CONCAT('%', :keyword, '%')))
            """)
    Page<ReceivableEntity> findFiltered(
            @Param("status") String status,
            @Param("customerId") UUID customerId,
            @Param("keyword") String keyword,
            Pageable pageable);

    List<ReceivableEntity> findByCustomerIdAndStatusNotIn(UUID customerId, List<String> statuses);
}
