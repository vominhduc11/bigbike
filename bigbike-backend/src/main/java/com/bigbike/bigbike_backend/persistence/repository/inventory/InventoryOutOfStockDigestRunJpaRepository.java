package com.bigbike.bigbike_backend.persistence.repository.inventory;

import com.bigbike.bigbike_backend.persistence.entity.inventory.InventoryOutOfStockDigestRunEntity;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface InventoryOutOfStockDigestRunJpaRepository
        extends JpaRepository<InventoryOutOfStockDigestRunEntity, LocalDate> {

    @Modifying
    @Query(value = """
            INSERT INTO inventory_out_of_stock_digest_runs
                (digest_date, outcome, created_at)
            VALUES (:digestDate, :outcome, :createdAt)
            ON CONFLICT (digest_date) DO NOTHING
            """, nativeQuery = true)
    int insertIfAbsent(
            @Param("digestDate") LocalDate digestDate,
            @Param("outcome") String outcome,
            @Param("createdAt") Instant createdAt);

    @Modifying
    @Query("""
            UPDATE InventoryOutOfStockDigestRunEntity r
            SET r.notificationId = :notificationId
            WHERE r.digestDate = :digestDate
              AND r.outcome = 'NOTIFIED'
              AND r.notificationId IS NULL
            """)
    int attachNotification(
            @Param("digestDate") LocalDate digestDate,
            @Param("notificationId") UUID notificationId);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("""
            UPDATE InventoryOutOfStockDigestRunEntity r
            SET r.emailAttemptedAt = :attemptedAt
            WHERE r.digestDate = :digestDate
              AND r.outcome = 'NOTIFIED'
              AND r.notificationId IS NOT NULL
              AND r.emailAttemptedAt IS NULL
            """)
    int claimEmail(
            @Param("digestDate") LocalDate digestDate,
            @Param("attemptedAt") Instant attemptedAt);

    @Modifying
    @Query("""
            UPDATE InventoryOutOfStockDigestRunEntity r
            SET r.emailAccepted = :accepted
            WHERE r.digestDate = :digestDate
              AND r.emailAttemptedAt IS NOT NULL
            """)
    int recordEmailResult(
            @Param("digestDate") LocalDate digestDate,
            @Param("accepted") boolean accepted);
}
