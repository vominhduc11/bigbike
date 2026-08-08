package com.bigbike.bigbike_backend.service.review;

import com.bigbike.bigbike_backend.persistence.entity.catalog.ReviewEntity;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ReviewJpaRepository;
import com.bigbike.bigbike_backend.service.admin.AdminReviewService;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

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

    static final String REASON_DISABLED = "DISABLED";
    static final String REASON_NOT_CONFIGURED = "NOT_CONFIGURED";
    static final String REASON_EMPTY_BODY = "EMPTY_BODY";
    static final String REASON_AI_UNAVAILABLE = "AI_UNAVAILABLE";
    static final String REASON_DAILY_LIMIT_REACHED = "DAILY_LIMIT_REACHED";

    /** "Today" is the shop's day, matching every other date window in the admin reports. */
    private static final ZoneId VN_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");

    private final ReviewJpaRepository reviewRepo;
    private final ReviewModerationSettings moderationSettings;
    private final AiReviewModerationClient aiClient;
    private final AdminReviewService adminReviewService;

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
        adminReviewService.applyAutoModeration(reviewId, outcome);
    }

    private ReviewModerationOutcome evaluate(ReviewSnapshot review) {
        ReviewModerationSettings.Snapshot settings = moderationSettings.load();
        if (!settings.enabled()) {
            return ReviewModerationOutcome.skipped(REASON_DISABLED);
        }
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
        if (dailyBudgetSpent(settings.dailyLimit())) {
            // Stop spending, keep screening free-of-charge: the review lands in Pending for
            // a human, which is the same place every other failure path leaves it.
            return ReviewModerationOutcome.skipped(REASON_DAILY_LIMIT_REACHED);
        }
        Optional<AiReviewModerationClient.AiVerdict> verdict =
                aiClient.classify(review.body(), review.rating());
        if (verdict.isEmpty()) {
            return ReviewModerationOutcome.skipped(REASON_AI_UNAVAILABLE);
        }
        return applySwitches(verdict.get(), settings);
    }

    /**
     * Filters the model's categories through the shop's switches. A category that is
     * switched off stays visible to the moderator as a note but cannot cause a block, so
     * turning a switch off is genuinely "stop acting on this", not "stop looking for it".
     */
    private static ReviewModerationOutcome applySwitches(
            AiReviewModerationClient.AiVerdict verdict,
            ReviewModerationSettings.Snapshot settings
    ) {
        String reason = verdict.reason() == null || verdict.reason().isBlank()
                ? null
                : verdict.reason().trim();
        if (!verdict.violation() || verdict.categories().isEmpty()) {
            return ReviewModerationOutcome.clean(
                    ReviewModerationOutcome.SOURCE_AI, verdict.categories(), reason);
        }

        List<ReviewModerationCategory> blocking = new ArrayList<>();
        for (ReviewModerationCategory category : verdict.categories()) {
            if (settings.blockingCategories().contains(category)) {
                blocking.add(category);
            }
        }
        if (blocking.isEmpty()) {
            return ReviewModerationOutcome.clean(
                    ReviewModerationOutcome.SOURCE_AI, verdict.categories(), reason);
        }
        return ReviewModerationOutcome.blockedByAi(verdict.categories(), blocking, reason);
    }

    /**
     * @return true when today's paid-call budget is already used up (REVIEW_RULE_013).
     *         A limit of {@code 0} means "never call the AI", so it is spent from the start.
     */
    private boolean dailyBudgetSpent(int dailyLimit) {
        if (dailyLimit <= 0) {
            return true;
        }
        Instant startOfDay = LocalDate.now(VN_ZONE).atStartOfDay(VN_ZONE).toInstant();
        long spent = reviewRepo.countByModerationSourceAndModerationCheckedAtGreaterThanEqual(
                ReviewModerationOutcome.SOURCE_AI, startOfDay);
        if (spent >= dailyLimit) {
            log.warn("Review AI moderation paused: {}/{} calls already spent today",
                    spent, dailyLimit);
            return true;
        }
        return false;
    }

    /**
     * Reads only what the moderator may look at. Not annotated transactional on purpose:
     * this is a single repository read whose own transaction is enough, and a
     * self-invoked {@code @Transactional} would silently do nothing behind the proxy.
     */
    private Optional<ReviewSnapshot> loadPendingReview(Long reviewId) {
        return reviewRepo.findById(reviewId)
                .filter(review -> "PENDING".equals(review.getStatus()))
                .map(review -> new ReviewSnapshot(review.getBody(), review.getRating()));
    }

    /** Only the two fields the moderator is allowed to look at (REVIEW_RULE_013). */
    record ReviewSnapshot(String body, BigDecimal rating) {}
}
