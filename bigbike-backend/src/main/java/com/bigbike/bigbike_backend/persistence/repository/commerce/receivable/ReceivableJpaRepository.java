package com.bigbike.bigbike_backend.persistence.repository.commerce.receivable;

import com.bigbike.bigbike_backend.persistence.entity.commerce.receivable.ReceivableEntity;
import java.math.BigDecimal;
import java.time.LocalDate;
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

    @Query("SELECT COALESCE(SUM(r.outstandingAmount), 0) FROM ReceivableEntity r WHERE r.status NOT IN ('CLOSED', 'WRITTEN_OFF')")
    BigDecimal sumTotalOutstanding();

    @Query("SELECT COALESCE(SUM(r.outstandingAmount), 0) FROM ReceivableEntity r WHERE r.status = 'OVERDUE'")
    BigDecimal sumOverdueOutstanding();

    @Query("SELECT COUNT(r) FROM ReceivableEntity r WHERE r.status IN ('OPEN', 'PARTIALLY_PAID', 'OVERDUE')")
    long countOpen();

    @Query("SELECT COUNT(r) FROM ReceivableEntity r WHERE r.status = 'OVERDUE'")
    long countOverdue();

    @Query("""
            SELECT COALESCE(SUM(r.writtenOffAmount), 0)
            FROM ReceivableEntity r
            WHERE r.status = 'WRITTEN_OFF'
            """)
    BigDecimal sumWrittenOff();

    /** Returns [dueDate, outstandingAmount] for all open receivables — used for aging computation in Java. */
    @Query("SELECT r.dueDate, r.outstandingAmount FROM ReceivableEntity r WHERE r.status NOT IN ('CLOSED', 'WRITTEN_OFF')")
    List<Object[]> findOpenReceivablesForAging();

    /** Filtered paginated list. */
    // CAST(:keyword AS string) is required so PostgreSQL infers `text` for the bind parameter;
    // without it, a null keyword becomes `bytea` and `lower(bytea)` errors out at runtime.
    @Query("""
            SELECT r FROM ReceivableEntity r
            WHERE (:status IS NULL OR r.status = :status)
              AND (:customerId IS NULL OR r.customerId = :customerId)
              AND (CAST(:keyword AS string) IS NULL
                   OR LOWER(r.customerName) LIKE LOWER(CONCAT('%', CAST(:keyword AS string), '%'))
                   OR LOWER(r.customerPhone) LIKE LOWER(CONCAT('%', CAST(:keyword AS string), '%')))
            """)
    Page<ReceivableEntity> findFiltered(
            @Param("status") String status,
            @Param("customerId") UUID customerId,
            @Param("keyword") String keyword,
            Pageable pageable);

    List<ReceivableEntity> findByCustomerIdAndStatusNotIn(UUID customerId, List<String> statuses);

    /**
     * Returns all OPEN or PARTIALLY_PAID receivables whose dueDate is before the given date.
     * Used by the overdue scheduler.
     */
    @Query("""
            SELECT r FROM ReceivableEntity r
            WHERE r.status IN ('OPEN', 'PARTIALLY_PAID')
              AND r.dueDate IS NOT NULL
              AND r.dueDate < :today
              AND r.outstandingAmount > 0
            """)
    List<ReceivableEntity> findOverdueCandidates(@Param("today") LocalDate today);
}
