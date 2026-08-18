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

    @Column(nullable = false, columnDefinition = "text")
    private String content;

    @Column(nullable = false, length = 24)
    private String source;

    @Column(name = "request_id")
    private UUID requestId;

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

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "products_json", columnDefinition = "jsonb")
    private String productsJson;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @PrePersist
    void onCreate() {
        if (createdAt == null) createdAt = Instant.now();
    }
}
