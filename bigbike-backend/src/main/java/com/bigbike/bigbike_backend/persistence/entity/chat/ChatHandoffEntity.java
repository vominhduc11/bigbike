package com.bigbike.bigbike_backend.persistence.entity.chat;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "chat_handoff_requests")
@Getter
@Setter
@NoArgsConstructor
public class ChatHandoffEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "request_id", nullable = false, unique = true)
    private UUID requestId;

    @Column(name = "conversation_id", nullable = false)
    private UUID conversationId;

    @Column(nullable = false, length = 24)
    private String status = "WAITING";

    @Column(name = "trigger_source", nullable = false, length = 24)
    private String triggerSource;

    @Column(name = "customer_kind", nullable = false, length = 24)
    private String customerKind;

    @Column(name = "question_summary", columnDefinition = "text")
    private String questionSummary;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "products_json", columnDefinition = "jsonb")
    private String productsJson;

    @Column(name = "contact_present", nullable = false)
    private boolean contactPresent;

    @Column(name = "requested_at", nullable = false)
    private Instant requestedAt;

    @Column(name = "acknowledged_at")
    private Instant acknowledgedAt;

    @Column(name = "acknowledged_by")
    private UUID acknowledgedBy;

    @Column(name = "assigned_at")
    private Instant assignedAt;

    @Column(name = "assigned_admin_id")
    private UUID assignedAdminId;

    @Column(name = "assigned_display_name", length = 120)
    private String assignedDisplayName;

    @Column(name = "resolved_at")
    private Instant resolvedAt;

    @Column(length = 20)
    private String resolution;

    @Column(name = "within_business_hours", nullable = false)
    private boolean withinBusinessHours;

    @Column(name = "next_open_at")
    private Instant nextOpenAt;

    @PrePersist
    void onCreate() {
        if (requestedAt == null) requestedAt = Instant.now();
    }
}
