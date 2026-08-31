package com.bigbike.bigbike_backend.persistence.entity.commerce.order;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "order_overdue_reminder_runs")
@Getter
@Setter
@NoArgsConstructor
public class OrderOverdueReminderRunEntity {

    @Id
    @Column(name = "run_date")
    private LocalDate runDate;

    @Column(name = "threshold_days", nullable = false)
    private int thresholdDays;

    @Column(name = "cutoff_at", nullable = false)
    private Instant cutoffAt;

    @Column(name = "candidate_count", nullable = false)
    private int candidateCount;

    @Column(name = "notification_id")
    private UUID notificationId;

    @Column(name = "completed_at")
    private Instant completedAt;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;
}
