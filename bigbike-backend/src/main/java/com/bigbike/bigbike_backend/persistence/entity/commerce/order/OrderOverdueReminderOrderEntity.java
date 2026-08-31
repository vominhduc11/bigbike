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
@Table(name = "order_overdue_reminder_orders")
@Getter
@Setter
@NoArgsConstructor
public class OrderOverdueReminderOrderEntity {

    @Id
    @Column(name = "order_id")
    private UUID orderId;

    @Column(name = "run_date", nullable = false)
    private LocalDate runDate;

    @Column(name = "reminded_at", nullable = false)
    private Instant remindedAt;
}
