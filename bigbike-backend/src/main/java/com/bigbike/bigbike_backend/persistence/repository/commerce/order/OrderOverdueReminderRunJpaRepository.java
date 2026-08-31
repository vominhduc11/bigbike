package com.bigbike.bigbike_backend.persistence.repository.commerce.order;

import com.bigbike.bigbike_backend.persistence.entity.commerce.order.OrderOverdueReminderRunEntity;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface OrderOverdueReminderRunJpaRepository
        extends JpaRepository<OrderOverdueReminderRunEntity, LocalDate> {

    @Modifying
    @Query(value = """
            insert into order_overdue_reminder_runs
                (run_date, threshold_days, cutoff_at, candidate_count, created_at)
            values (:runDate, :thresholdDays, :cutoffAt, 0, :now)
            on conflict (run_date) do nothing
            """, nativeQuery = true)
    int claim(
            @Param("runDate") LocalDate runDate,
            @Param("thresholdDays") int thresholdDays,
            @Param("cutoffAt") Instant cutoffAt,
            @Param("now") Instant now);

    @Modifying
    @Query("""
            update OrderOverdueReminderRunEntity run
            set run.candidateCount = :candidateCount,
                run.notificationId = :notificationId,
                run.completedAt = :completedAt
            where run.runDate = :runDate
            """)
    int complete(
            @Param("runDate") LocalDate runDate,
            @Param("candidateCount") int candidateCount,
            @Param("notificationId") UUID notificationId,
            @Param("completedAt") Instant completedAt);
}
