package com.bigbike.bigbike_backend.persistence.entity.review;

import com.bigbike.bigbike_backend.domain.review.ReviewInvitationStatus;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "review_invitation_deliveries")
public class ReviewInvitationDeliveryEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "campaign_id", nullable = false)
    private UUID campaignId;

    @Column(name = "order_id", nullable = false, unique = true)
    private UUID orderId;

    @Column(name = "order_number", nullable = false, length = 100)
    private String orderNumber;

    @Column(name = "customer_id")
    private UUID customerId;

    @Column(name = "recipient_email", nullable = false, length = 255)
    private String recipientEmail;

    @Column(name = "recipient_email_normalized", nullable = false, length = 255)
    private String recipientEmailNormalized;

    @Column(nullable = false, length = 2)
    private String locale;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private ReviewInvitationStatus status = ReviewInvitationStatus.PENDING;

    @Column(name = "completed_at", nullable = false)
    private Instant completedAt;

    @Column(name = "due_at", nullable = false)
    private Instant dueAt;

    @Column(name = "attempted_at")
    private Instant attemptedAt;

    @Column(name = "provider_accepted_at")
    private Instant providerAcceptedAt;

    @Column(name = "unsubscribe_token_hash", unique = true, length = 64)
    private String unsubscribeTokenHash;

    @Column(name = "skip_reason", length = 40)
    private String skipReason;

    @Column(name = "failure_code", length = 64)
    private String failureCode;

    @Column(name = "failure_message", length = 500)
    private String failureMessage;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Version
    @Column(nullable = false)
    private Long version;
}
