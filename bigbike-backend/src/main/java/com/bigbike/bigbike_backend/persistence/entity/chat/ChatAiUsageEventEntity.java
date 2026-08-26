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
import java.time.LocalDate;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "chat_ai_usage_events")
@Getter
@Setter
@NoArgsConstructor
public class ChatAiUsageEventEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "conversation_id")
    private UUID conversationId;

    @Column(name = "message_id")
    private UUID messageId;

    @Column(name = "evaluation_run_id")
    private UUID evaluationRunId;

    @Column(nullable = false, length = 24)
    private String category;

    @Column(name = "model_id", nullable = false, length = 120)
    private String modelId;

    @Column(name = "requested_model", nullable = false, length = 120)
    private String requestedModel;

    @Column(name = "provider_request_count", nullable = false)
    private int providerRequestCount;

    @Column(name = "input_tokens", nullable = false)
    private int inputTokens;

    @Column(name = "output_tokens", nullable = false)
    private int outputTokens;

    @Column(name = "thinking_tokens", nullable = false)
    private int thinkingTokens;

    @Column(name = "image_count", nullable = false)
    private int imageCount;

    @Column(name = "estimated_cost_usd", nullable = false, precision = 19, scale = 8)
    private BigDecimal estimatedCostUsd = BigDecimal.ZERO;

    @Column(name = "price_effective_from", nullable = false)
    private LocalDate priceEffectiveFrom;

    @Column(nullable = false)
    private boolean fallback;

    @Column(nullable = false)
    private boolean success = true;

    @Column(name = "latency_ms", nullable = false)
    private int latencyMs;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @PrePersist
    void onCreate() {
        if (createdAt == null) createdAt = Instant.now();
        if (estimatedCostUsd == null) estimatedCostUsd = BigDecimal.ZERO;
    }
}
