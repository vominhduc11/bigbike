package com.bigbike.bigbike_backend.persistence.entity.chat;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "chat_evaluation_runs")
@Getter
@Setter
@NoArgsConstructor
public class ChatEvaluationRunEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "dataset_version", nullable = false, length = 80)
    private String datasetVersion;

    @Column(name = "dataset_checksum", nullable = false, length = 64)
    private String datasetChecksum;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "model_ids", nullable = false, columnDefinition = "jsonb")
    private String modelIds;

    @Column(name = "max_cost_usd", nullable = false, precision = 19, scale = 8)
    private BigDecimal maxCostUsd;

    @Column(name = "actual_cost_usd", nullable = false, precision = 19, scale = 8)
    private BigDecimal actualCostUsd = BigDecimal.ZERO;

    @Column(nullable = false, length = 24)
    private String status;

    @Column(name = "failure_code", length = 48)
    private String failureCode;

    @Column(name = "created_by")
    private UUID createdBy;

    @Column(name = "started_at", nullable = false)
    private Instant startedAt;

    @Column(name = "completed_at")
    private Instant completedAt;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @PrePersist
    void onCreate() {
        Instant now = Instant.now();
        if (startedAt == null) startedAt = now;
        if (createdAt == null) createdAt = now;
        if (actualCostUsd == null) actualCostUsd = BigDecimal.ZERO;
    }
}
