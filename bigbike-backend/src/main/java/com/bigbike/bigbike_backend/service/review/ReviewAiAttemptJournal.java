package com.bigbike.bigbike_backend.service.review;

import com.bigbike.bigbike_backend.persistence.entity.audit.AuditLogEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ReviewEntity;
import com.bigbike.bigbike_backend.persistence.repository.audit.AuditLogJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ReviewJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.settings.SiteSettingJpaRepository;
import com.bigbike.bigbike_backend.service.audit.AuditLogWriter;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** Durable paid-attempt accounting, independent of review lifetime (REVIEW_RULE_013). */
@Service
public class ReviewAiAttemptJournal {
    static final String ACTION = "REVIEW_AI_ATTEMPT_RESERVED";
    static final ZoneId VN_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");

    private final SiteSettingJpaRepository settings;
    private final AuditLogJpaRepository audits;
    private final ReviewJpaRepository reviews;
    private final AuditLogWriter writer;
    private final Clock clock;

    @Autowired
    public ReviewAiAttemptJournal(SiteSettingJpaRepository settings, AuditLogJpaRepository audits,
            ReviewJpaRepository reviews, AuditLogWriter writer) {
        this(settings, audits, reviews, writer, Clock.systemUTC());
    }

    ReviewAiAttemptJournal(SiteSettingJpaRepository settings, AuditLogJpaRepository audits,
            ReviewJpaRepository reviews, AuditLogWriter writer, Clock clock) {
        this.settings = settings;
        this.audits = audits;
        this.reviews = reviews;
        this.writer = writer;
        this.clock = clock;
    }

    /**
     * Called through a separate Spring proxy: commit and release the lock/connection
     * before the provider is contacted. No setting is created, reset or increased.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public Reservation reserve(Long reviewId) {
        var setting = settings.findBySettingKeyForUpdate(ReviewModerationSettings.KEY_DAILY_LIMIT);
        if (setting.isEmpty()) return Reservation.limitReached();

        // Time is sampled after acquiring the global lock, including a wait over midnight.
        Instant now = clock.instant();
        LocalDate day = now.atZone(VN_ZONE).toLocalDate();
        var review = reviews.findById(reviewId);
        UUID resourceId = resourceId(reviewId);
        if (review.isEmpty() || !"PENDING".equals(review.get().getStatus())
                || alreadyAttempted(review.get())
                || audits.existsByActionAndResourceTypeAndResourceId(ACTION, "REVIEW", resourceId)) {
            return Reservation.duplicate();
        }
        int limit = currentLimit(setting.get().getSettingValue());
        if (limit <= 0 || audits.countReviewAiAttempts(day.atStartOfDay(VN_ZONE).toInstant(),
                day.plusDays(1).atStartOfDay(VN_ZONE).toInstant()) >= limit) {
            return Reservation.limitReached();
        }

        AuditLogEntity entry = new AuditLogEntity();
        entry.setActorType("SYSTEM");
        entry.setAction(ACTION);
        entry.setResourceType("REVIEW");
        entry.setResourceId(resourceId);
        entry.setCreatedAt(now);
        entry.setAfterData("{\"version\":1,\"reviewId\":" + reviewId
                + ",\"reservationDay\":\"" + day + "\"}");
        writer.saveRequired(entry);
        return new Reservation(State.RESERVED, day);
    }

    /** Do not send an old day's reserved slot after midnight; it remains spent. */
    public boolean isCurrentDay(Reservation reservation) {
        return reservation.day() != null
                && reservation.day().equals(LocalDate.now(clock.withZone(VN_ZONE)));
    }

    static boolean alreadyAttempted(ReviewEntity review) {
        return ReviewModerationOutcome.SOURCE_AI.equals(review.getModerationSource())
                || (ReviewModerationOutcome.SOURCE_SKIPPED.equals(review.getModerationSource())
                    && ReviewModerationService.REASON_AI_UNAVAILABLE.equals(review.getModerationReason()));
    }

    /** Stable, versioned namespace bridges the Long review ID and the UUID audit field. */
    static UUID resourceId(Long reviewId) {
        return UUID.nameUUIDFromBytes(("bigbike:review-ai-attempt:v1:" + reviewId)
                .getBytes(StandardCharsets.UTF_8));
    }

    private static int currentLimit(String raw) {
        try {
            return Math.max(0, Integer.parseInt(raw.trim()));
        } catch (RuntimeException invalidSetting) {
            return 0; // Invalid or missing current values must not permit spending.
        }
    }

    enum State { RESERVED, LIMIT_REACHED, DUPLICATE }

    record Reservation(State state, LocalDate day) {
        static Reservation limitReached() { return new Reservation(State.LIMIT_REACHED, null); }
        static Reservation duplicate() { return new Reservation(State.DUPLICATE, null); }
    }
}
