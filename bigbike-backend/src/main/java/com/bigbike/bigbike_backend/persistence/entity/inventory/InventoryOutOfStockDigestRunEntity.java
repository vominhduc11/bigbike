package com.bigbike.bigbike_backend.persistence.entity.inventory;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "inventory_out_of_stock_digest_runs")
@Getter
@Setter
public class InventoryOutOfStockDigestRunEntity {

    @Id
    @Column(name = "digest_date", nullable = false)
    private LocalDate digestDate;

    @Column(nullable = false, length = 16)
    private String outcome;

    @Column(name = "notification_id")
    private UUID notificationId;

    @Column(name = "email_attempted_at")
    private Instant emailAttemptedAt;

    @Column(name = "email_accepted")
    private Boolean emailAccepted;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;
}
