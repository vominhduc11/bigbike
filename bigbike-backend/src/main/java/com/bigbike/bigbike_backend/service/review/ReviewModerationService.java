package com.bigbike.bigbike_backend.service.review;

import com.bigbike.bigbike_backend.persistence.repository.catalog.ReviewJpaRepository;
import com.bigbike.bigbike_backend.service.admin.AdminReviewService;
import java.math.BigDecimal;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Runs the two automatic moderation layers for one review and hands the result to
 * {@link AdminReviewService} to persist (REVIEW_RULE_012).
 *
 * <p>Order matters: the local banned-word list runs first and short-circuits, so an obvious
 * hit never pays for an AI call. The AI runs only on text that survived that pass.
 *
 * <p>This class can decide to block, never to approve. {@code CLEAN} means "no violation
 * found", which still leaves the review at {@code PENDING} for a human.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ReviewModerationService {

    static final String REASON_NOT_CONFIGURED = "NOT_CONFIGURED";
    static final String REASON_EMPTY_BODY = "EMPTY_BODY";
    static final String REASON_AI_UNAVAILABLE = "AI_UNAVAILABLE";
    static final String REASON_DAILY_LIMIT_REACHED = "DAILY_LIMIT_REACHED";

    private final ReviewJpaRepository reviewRepo;
    private final ReviewModerationSettings moderationSettings;
    private final AiReviewModerationClient aiClient;
    private final AdminReviewService adminReviewService;
    private final ReviewAiAttemptJournal attemptJournal;

    /**
     * Entry point from the public submit flow. Runs off the request thread and swallows
     * everything: automatic moderation is an enhancement, and a failure here must never
     * surface to the customer who just submitted a review.
     */
    @Async
    public void moderateAsync(Long reviewId) {
        try {
            moderate(reviewId);
        } catch (RuntimeException exception) {
            log.warn("Automatic moderation failed for review {}: {}",
                    reviewId, exception.toString());
        }
    }

    /** Synchronous variant — used by tests and by {@link #moderateAsync(Long)}. */
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    public void moderate(Long reviewId) {
        if (reviewId == null) {
            return;
        }
        Optional<ReviewSnapshot> snapshot = loadPendingReview(reviewId);
        if (snapshot.isEmpty()) {
            // Deleted, or a human already moved it out of PENDING before we got here.
            return;
        }
        ReviewModerationOutcome outcome = evaluate(snapshot.get());
        if (outcome != null) {
            adminReviewService.applyAutoModeration(reviewId, outcome);
        }
    }

    private ReviewModerationOutcome evaluate(ReviewSnapshot review) {
        ReviewModerationSettings.Snapshot settings = moderationSettings.load();
        if (review.body() == null || review.body().isBlank()) {
            // A star-only review has no text to judge; calling the AI would spend money to
            // be told so.
            return ReviewModerationOutcome.skipped(REASON_EMPTY_BODY);
        }

        Optional<String> bannedWord = ReviewBannedWordMatcher
                .fromSettingValue(settings.bannedWordsRaw())
                .firstMatch(review.body());
        if (bannedWord.isPresent()) {
            return ReviewModerationOutcome.blockedByBannedWord(bannedWord.get());
        }

        if (!aiClient.isConfigured()) {
            return ReviewModerationOutcome.skipped(REASON_NOT_CONFIGURED);
        }
        ReviewAiAttemptJournal.Reservation reservation;
        try {
            reservation = attemptJournal.reserve(review.id());
        } catch (RuntimeException journalFailure) {
            log.warn("Review AI reservation failed for review {}", review.id());
            return ReviewModerationOutcome.skipped(REASON_AI_UNAVAILABLE);
        }
        if (reservation.state() == ReviewAiAttemptJournal.State.DUPLICATE) {
            // A repeated task must never overwrite the first worker's in-flight result.
            return null;
        }
        if (reservation.state() == ReviewAiAttemptJournal.State.LIMIT_REACHED
                || !attemptJournal.isCurrentDay(reservation)) {
            // Stop spending, keep screening free-of-charge: the review lands in Pending for
            // a human, which is the same place every other failure path leaves it.
            return ReviewModerationOutcome.skipped(REASON_DAILY_LIMIT_REACHED);
        }
        Optional<AiReviewModerationClient.AiVerdict> verdict;
        try {
            verdict = aiClient.classify(review.body(), review.rating());
        } catch (RuntimeException providerFailure) {
            return ReviewModerationOutcome.skipped(REASON_AI_UNAVAILABLE);
        }
        if (verdict.isEmpty()) {
            return ReviewModerationOutcome.skipped(REASON_AI_UNAVAILABLE);
        }
        return resolveVerdict(verdict.get());
    }

    /** Every recognized violation category participates in blocking (REVIEW_RULE_013). */
    private static ReviewModerationOutcome resolveVerdict(
            AiReviewModerationClient.AiVerdict verdict
    ) {
        String reason = verdict.reason() == null || verdict.reason().isBlank()
                ? null
                : verdict.reason().trim();
        if (!verdict.violation() || verdict.categories().isEmpty()) {
            return ReviewModerationOutcome.clean(
                    ReviewModerationOutcome.SOURCE_AI, verdict.categories(), reason);
        }

        return ReviewModerationOutcome.blockedByAi(
                verdict.categories(), verdict.categories(), reason);
    }

    /**
     * Reads only what the moderator may look at. Not annotated transactional on purpose:
     * this is a single repository read whose own transaction is enough, and a
     * self-invoked {@code @Transactional} would silently do nothing behind the proxy.
     */
    private Optional<ReviewSnapshot> loadPendingReview(Long reviewId) {
        return reviewRepo.findById(reviewId)
                .filter(review -> "PENDING".equals(review.getStatus()))
                .filter(review -> !ReviewAiAttemptJournal.alreadyAttempted(review))
                .map(review -> new ReviewSnapshot(review.getId(), review.getBody(), review.getRating()));
    }

    /** Internal review ID plus the two fields the provider may receive (REVIEW_RULE_013). */
    record ReviewSnapshot(Long id, String body, BigDecimal rating) {}
}
