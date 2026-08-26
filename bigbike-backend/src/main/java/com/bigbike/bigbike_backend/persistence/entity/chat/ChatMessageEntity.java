package com.bigbike.bigbike_backend.persistence.entity.chat;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.time.Instant;
import java.math.BigDecimal;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "chat_messages")
@Getter
@Setter
@NoArgsConstructor
public class ChatMessageEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "conversation_id", nullable = false)
    private UUID conversationId;

    @Column(nullable = false, length = 16)
    private String role;

    @Column(name = "sequence_no", nullable = false)
    private long sequenceNo;

    @Column(name = "staff_user_id")
    private UUID staffUserId;

    @Column(name = "staff_display_name", length = 120)
    private String staffDisplayName;

    @Column(nullable = false, columnDefinition = "text")
    private String content;

    @Column(nullable = false, length = 24)
    private String source;

    @Column(name = "request_id")
    private UUID requestId;

    @Column(name = "origin_interaction_id")
    private UUID originInteractionId;

    @Column(name = "answer_format", nullable = false, length = 24)
    private String answerFormat = "PLAIN_TEXT";

    @Column(name = "result_kind", nullable = false, length = 24)
    private String resultKind = "ANSWER";

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "action_metadata", columnDefinition = "jsonb")
    private String actionMetadata;

    @Column(name = "ai_called", nullable = false)
    private boolean aiCalled;

    /** Historical provider retry diagnostic; daily quota counts one logical response only. */
    @Column(name = "ai_retry_count", nullable = false)
    private int aiRetryCount;

    @Column(name = "input_tokens")
    private Integer inputTokens;

    @Column(name = "output_tokens")
    private Integer outputTokens;

    @Column(name = "thinking_tokens")
    private Integer thinkingTokens;

    @Column(name = "provider_request_count")
    private Integer providerRequestCount;

    @Column(name = "latency_ms")
    private Integer latencyMs;

    @Column(name = "estimated_cost_usd", precision = 19, scale = 8)
    private BigDecimal estimatedCostUsd;

    @Column(name = "requested_model", length = 120)
    private String requestedModel;

    @Column(name = "served_model", length = 120)
    private String servedModel;

    @Column(name = "fallback_used", nullable = false)
    private boolean fallbackUsed;

    @Column(name = "fallback_reason", length = 40)
    private String fallbackReason;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "products_json", columnDefinition = "jsonb")
    private String productsJson;

    @Column(name = "sales_stage", length = 24)
    private String salesStage;

    @Column(name = "outcome_code", length = 48)
    private String outcomeCode;

    @Column(name = "lead_offer_reason", length = 32)
    private String leadOfferReason;

    @Column(name = "next_step_type", length = 48)
    private String nextStepType;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "cross_sell_products_json", columnDefinition = "jsonb")
    private String crossSellProductsJson;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @PrePersist
    void onCreate() {
        if (createdAt == null) createdAt = Instant.now();
    }
}
