package com.bigbike.bigbike_backend.persistence.entity.commerce.order;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "order_history_batches")
@Getter
@Setter
@NoArgsConstructor
public class OrderHistoryBatchEntity {

    @Id
    private UUID id;

    @Column(name = "batch_key", nullable = false, unique = true, length = 100)
    private String batchKey;

    @Column(name = "label_vi", nullable = false)
    private String labelVi;

    @Column(name = "label_en", nullable = false)
    private String labelEn;

    @Column(name = "reason_vi", nullable = false, columnDefinition = "text")
    private String reasonVi;

    @Column(name = "reason_en", nullable = false, columnDefinition = "text")
    private String reasonEn;

    @Column(nullable = false)
    private boolean active;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "activated_at", nullable = false)
    private Instant activatedAt;

    @Column(name = "deactivated_at")
    private Instant deactivatedAt;
}
