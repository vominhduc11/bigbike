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

    @Column(name = "visitor_id")
    private UUID visitorId;

    @Column(name = "thread_id", nullable = false)
    private UUID threadId;

    @Column(name = "continued_from_id")
    private UUID continuedFromId;

    @Column(nullable = false, length = 2)
    private String locale;

    @Column(name = "turn_count", nullable = false)
    private int turnCount;

    @Column(name = "counted_turns", nullable = false)
    private int countedTurns;

    @Column(name = "ai_call_count", nullable = false)
    private int aiCallCount;

    @Column(name = "consecutive_off_topic", nullable = false)
    private int consecutiveOffTopic;

    @Column(name = "lead_offer_status", nullable = false, length = 16)
    private String leadOfferStatus = "NONE";

    @Column(name = "lead_offer_count", nullable = false)
    private int leadOfferCount;

    @Column(name = "lead_offer_request_id", unique = true)
    private UUID leadOfferRequestId;

    @Column(name = "lead_offer_opened_at")
    private Instant leadOfferOpenedAt;

    /** Server-only, non-PII catalog/order follow-up context; see DATA_CONTRACT.md. */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "context_json", columnDefinition = "jsonb")
    private String contextJson;

    @Column(name = "sales_stage", nullable = false, length = 24)
    private String salesStage = "BROWSING";

    @Column(name = "last_next_step_type", length = 48)
    private String lastNextStepType;

    @Column(name = "declined_next_step_type", length = 48)
    private String declinedNextStepType;

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
        if (id == null) id = UUID.randomUUID();
        if (threadId == null) threadId = id;
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
