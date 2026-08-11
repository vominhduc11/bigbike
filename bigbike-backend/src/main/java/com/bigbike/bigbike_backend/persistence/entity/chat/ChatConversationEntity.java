package com.bigbike.bigbike_backend.persistence.entity.chat;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "chat_conversations")
@Getter
@Setter
@NoArgsConstructor
public class ChatConversationEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "customer_id")
    private UUID customerId;

    @Column(nullable = false, length = 2)
    private String locale;

    @Column(name = "turn_count", nullable = false)
    private int turnCount;

    @Column(name = "ai_call_count", nullable = false)
    private int aiCallCount;

    @Column(name = "consecutive_off_topic", nullable = false)
    private int consecutiveOffTopic;

    @Column(name = "lead_offer_status", nullable = false, length = 16)
    private String leadOfferStatus = "NONE";

    /** Server-only, non-PII catalog/order follow-up context; see DATA_CONTRACT.md. */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "context_json", columnDefinition = "jsonb")
    private String contextJson;

    @Column(name = "ended_reason", length = 32)
    private String endedReason;

    @Column(name = "started_at", nullable = false)
    private Instant startedAt;

    @Column(name = "last_message_at", nullable = false)
    private Instant lastMessageAt;

    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @PrePersist
    void onCreate() {
        Instant now = Instant.now();
        if (startedAt == null) startedAt = now;
        if (lastMessageAt == null) lastMessageAt = now;
        if (createdAt == null) createdAt = now;
        if (updatedAt == null) updatedAt = now;
        if (expiresAt == null) expiresAt = startedAt.plus(90, ChronoUnit.DAYS);
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = Instant.now();
    }
}
