package com.bigbike.bigbike_backend.persistence.entity.catalog;

import lombok.Getter;
import lombok.Setter;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "reviews")
@Getter
@Setter
public class ReviewEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "product_id", nullable = false)
    private String productId;

    @Column(name = "customer_id")
    private UUID customerId;

    @Column(name = "author_name")
    private String authorName;

    @Column(name = "author_email")
    private String authorEmail;

    // REVIEW_RULE_008: bước 0,5, gồm 9 mức từ 1.0 đến 5.0; enforce ở request + DB (V347).
    @Column(nullable = false, precision = 2, scale = 1)
    private BigDecimal rating;

    @Column(columnDefinition = "text")
    private String body;

    /**
     * Customer-uploaded photo URLs in MinIO ({@code /media/reviews/...}), max 10 (V234, REVIEW_RULE_005).
     * Null/empty when the review has no photos. Stored as a JSON string array.
     */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "photos", columnDefinition = "jsonb")
    private List<String> photos;

    @Column(nullable = false)
    private String status;

    @Column(name = "legacy_id", unique = true)
    private Long legacyId;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Column(name = "first_approved_at")
    private Instant firstApprovedAt;

    /**
     * Automatic-moderation annotations (V380, REVIEW_RULE_012/013). These record what the
     * banned-word/AI layer concluded; they never decide visibility — {@link #status} does.
     * All null on rows submitted before V380 and on rows the moderator has not reached yet.
     */
    @Column(name = "moderation_source", length = 16)
    private String moderationSource;

    @Column(name = "moderation_verdict", length = 16)
    private String moderationVerdict;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "moderation_categories", columnDefinition = "jsonb")
    private List<String> moderationCategories;

    @Column(name = "moderation_reason", length = 500)
    private String moderationReason;

    @Column(name = "moderation_checked_at")
    private Instant moderationCheckedAt;

    /**
     * Optimistic concurrency token for admin moderation. Clients echo this value
     * as expectedVersion so a stale screen cannot overwrite a newer decision.
     */
    @Version
    @Column(nullable = false)
    private Long version;

}
