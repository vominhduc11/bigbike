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

@Entity
@Table(name = "chat_evaluation_model_results")
@Getter
@Setter
@NoArgsConstructor
public class ChatEvaluationModelResultEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "run_id", nullable = false)
    private UUID runId;

    @Column(name = "model_id", nullable = false, length = 120)
    private String modelId;

    @Column(name = "total_cases", nullable = false)
    private int totalCases;

    @Column(name = "passed_cases", nullable = false)
    private int passedCases;

    @Column(name = "numeric_case_count", nullable = false)
    private int numericCaseCount;

    @Column(name = "numeric_accuracy", nullable = false, precision = 8, scale = 6)
    private BigDecimal numericAccuracy = BigDecimal.ZERO;

    @Column(name = "intent_accuracy", nullable = false, precision = 8, scale = 6)
    private BigDecimal intentAccuracy = BigDecimal.ZERO;

    @Column(name = "non_fabrication_case_count", nullable = false)
    private int nonFabricationCaseCount;

    @Column(name = "non_fabrication_rate", nullable = false, precision = 8, scale = 6)
    private BigDecimal nonFabricationRate = BigDecimal.ZERO;

    @Column(name = "give_up_rate", nullable = false, precision = 8, scale = 6)
    private BigDecimal giveUpRate = BigDecimal.ZERO;

    @Column(name = "p50_latency_ms")
    private Integer p50LatencyMs;

    @Column(name = "p95_latency_ms")
    private Integer p95LatencyMs;

    @Column(name = "input_tokens", nullable = false)
    private long inputTokens;

    @Column(name = "output_tokens", nullable = false)
    private long outputTokens;

    @Column(name = "thinking_tokens", nullable = false)
    private long thinkingTokens;

    @Column(name = "fallback_count", nullable = false)
    private int fallbackCount;

    @Column(name = "estimated_cost_usd", nullable = false, precision = 19, scale = 8)
    private BigDecimal estimatedCostUsd = BigDecimal.ZERO;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @PrePersist
    void onCreate() {
        if (createdAt == null) createdAt = Instant.now();
    }
}
