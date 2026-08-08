package com.bigbike.bigbike_backend.service.review;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.bigbike.bigbike_backend.persistence.entity.catalog.ReviewEntity;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ReviewJpaRepository;
import com.bigbike.bigbike_backend.service.admin.AdminReviewService;
import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

/**
 * Decision logic of the automatic moderator (REVIEW_RULE_012/013).
 *
 * <p>The two properties worth protecting above all: it can never produce {@code APPROVED},
 * and every failure path must leave the review untouched at {@code PENDING}.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class ReviewModerationServiceTest {

    private static final Long REVIEW_ID = 42L;

    @Mock private ReviewJpaRepository reviewRepo;
    @Mock private ReviewModerationSettings moderationSettings;
    @Mock private AiReviewModerationClient aiClient;
    @Mock private AdminReviewService adminReviewService;

    private ReviewModerationService service;

    @BeforeEach
    void setUp() {
        service = new ReviewModerationService(
                reviewRepo, moderationSettings, aiClient, adminReviewService);
        givenReview("PENDING", "Nội dung đánh giá bình thường.");
        givenSettings(true, "", Set.of(ReviewModerationCategory.values()));
        when(aiClient.isConfigured()).thenReturn(true);
    }

    private void givenReview(String status, String body) {
        ReviewEntity review = new ReviewEntity();
        review.setId(REVIEW_ID);
        review.setProductId("prod-1");
        review.setStatus(status);
        review.setBody(body);
        review.setRating(new BigDecimal("5.0"));
        when(reviewRepo.findById(REVIEW_ID)).thenReturn(Optional.of(review));
    }

    private void givenSettings(
            boolean enabled, String bannedWords, Set<ReviewModerationCategory> blocking) {
        givenSettings(enabled, bannedWords, blocking, 200);
    }

    private void givenSettings(
            boolean enabled,
            String bannedWords,
            Set<ReviewModerationCategory> blocking,
            int dailyLimit) {
        when(moderationSettings.load()).thenReturn(
                new ReviewModerationSettings.Snapshot(enabled, blocking, bannedWords, dailyLimit));
    }

    private void givenCallsSpentToday(long spent) {
        when(reviewRepo.countByModerationSourceAndModerationCheckedAtGreaterThanEqual(
                eq(ReviewModerationOutcome.SOURCE_AI), any())).thenReturn(spent);
    }

    private ReviewModerationOutcome captureOutcome() {
        ArgumentCaptor<ReviewModerationOutcome> captor =
                ArgumentCaptor.forClass(ReviewModerationOutcome.class);
        verify(adminReviewService).applyAutoModeration(any(), captor.capture());
        return captor.getValue();
    }

    @Test
    @DisplayName("master switch off records a skip and calls no AI")
    void disabledSkips() {
        givenSettings(false, "", Set.of(ReviewModerationCategory.values()));

        service.moderate(REVIEW_ID);

        ReviewModerationOutcome outcome = captureOutcome();
        assertThat(outcome.source()).isEqualTo(ReviewModerationOutcome.SOURCE_SKIPPED);
        assertThat(outcome.blocked()).isFalse();
        assertThat(outcome.reason()).isEqualTo(ReviewModerationService.REASON_DISABLED);
        verify(aiClient, never()).classify(anyString(), any());
    }

    @Test
    @DisplayName("a star-only review is skipped without spending an AI call")
    void emptyBodySkips() {
        givenReview("PENDING", "   ");

        service.moderate(REVIEW_ID);

        assertThat(captureOutcome().reason()).isEqualTo(ReviewModerationService.REASON_EMPTY_BODY);
        verify(aiClient, never()).classify(anyString(), any());
    }

    @Test
    @DisplayName("a banned word blocks to TRASH and short-circuits before the AI")
    void bannedWordBlocksWithoutAi() {
        givenSettings(true, "lừa đảo", Set.of(ReviewModerationCategory.values()));
        givenReview("PENDING", "shop nay lua dao khach");

        service.moderate(REVIEW_ID);

        ReviewModerationOutcome outcome = captureOutcome();
        assertThat(outcome.source()).isEqualTo(ReviewModerationOutcome.SOURCE_RULE);
        assertThat(outcome.blocked()).isTrue();
        assertThat(outcome.resolvedTargetStatus()).contains("TRASH");
        assertThat(outcome.reason()).contains("lừa đảo");
        verify(aiClient, never()).classify(anyString(), any());
    }

    @Test
    @DisplayName("a banned word still blocks when every AI category is switched off")
    void bannedWordIgnoresCategorySwitches() {
        givenSettings(true, "lừa đảo", Set.of());
        givenReview("PENDING", "shop lua dao");

        service.moderate(REVIEW_ID);

        assertThat(captureOutcome().blocked()).isTrue();
    }

    @Test
    @DisplayName("missing credential is a skip, not a block")
    void unconfiguredAiSkips() {
        when(aiClient.isConfigured()).thenReturn(false);

        service.moderate(REVIEW_ID);

        ReviewModerationOutcome outcome = captureOutcome();
        assertThat(outcome.blocked()).isFalse();
        assertThat(outcome.reason()).isEqualTo(ReviewModerationService.REASON_NOT_CONFIGURED);
    }

    @Test
    @DisplayName("an AI failure leaves the review pending instead of blocking it")
    void aiFailureSkips() {
        when(aiClient.classify(anyString(), any())).thenReturn(Optional.empty());

        service.moderate(REVIEW_ID);

        ReviewModerationOutcome outcome = captureOutcome();
        assertThat(outcome.source()).isEqualTo(ReviewModerationOutcome.SOURCE_SKIPPED);
        assertThat(outcome.blocked()).isFalse();
        assertThat(outcome.reason()).isEqualTo(ReviewModerationService.REASON_AI_UNAVAILABLE);
    }

    @Test
    @DisplayName("advertising goes to SPAM, abuse goes to TRASH")
    void categoryDecidesTargetStatus() {
        when(aiClient.classify(anyString(), any())).thenReturn(Optional.of(
                new AiReviewModerationClient.AiVerdict(
                        true, List.of(ReviewModerationCategory.ADVERTISING), "Chèn số điện thoại.")));

        service.moderate(REVIEW_ID);

        ReviewModerationOutcome outcome = captureOutcome();
        assertThat(outcome.source()).isEqualTo(ReviewModerationOutcome.SOURCE_AI);
        assertThat(outcome.resolvedTargetStatus()).contains("SPAM");
    }

    @Test
    @DisplayName("TRASH wins when a review trips both an abuse and an advertising category")
    void trashWinsOverSpam() {
        when(aiClient.classify(anyString(), any())).thenReturn(Optional.of(
                new AiReviewModerationClient.AiVerdict(
                        true,
                        List.of(ReviewModerationCategory.ADVERTISING, ReviewModerationCategory.PROFANITY),
                        "Vừa chửi tục vừa rải link.")));

        service.moderate(REVIEW_ID);

        assertThat(captureOutcome().resolvedTargetStatus()).contains("TRASH");
    }

    @Test
    @DisplayName("a switched-off category is recorded as a note but does not block")
    void switchedOffCategoryOnlyAnnotates() {
        givenSettings(true, "", Set.of(ReviewModerationCategory.PROFANITY));
        when(aiClient.classify(anyString(), any())).thenReturn(Optional.of(
                new AiReviewModerationClient.AiVerdict(
                        true, List.of(ReviewModerationCategory.ADVERTISING), "Có link.")));

        service.moderate(REVIEW_ID);

        ReviewModerationOutcome outcome = captureOutcome();
        assertThat(outcome.blocked()).isFalse();
        assertThat(outcome.verdict()).isEqualTo("CLEAN");
        assertThat(outcome.categoryNames()).containsExactly("ADVERTISING");
        assertThat(outcome.resolvedTargetStatus()).isEmpty();
    }

    @Test
    @DisplayName("a clean verdict never yields APPROVED — the review stays for a human")
    void cleanVerdictNeverApproves() {
        when(aiClient.classify(anyString(), any())).thenReturn(Optional.of(
                new AiReviewModerationClient.AiVerdict(false, List.of(), "")));

        service.moderate(REVIEW_ID);

        ReviewModerationOutcome outcome = captureOutcome();
        assertThat(outcome.blocked()).isFalse();
        assertThat(outcome.resolvedTargetStatus()).isEmpty();
        assertThat(outcome.targetStatus()).isNull();
    }

    @Test
    @DisplayName("a review a human already moved is left completely alone")
    void nonPendingReviewIsNotTouched() {
        givenReview("APPROVED", "Nội dung đánh giá bình thường.");

        service.moderate(REVIEW_ID);

        verifyNoInteractions(adminReviewService);
        verify(aiClient, never()).classify(anyString(), any());
    }

    @Test
    @DisplayName("a deleted review is a no-op")
    void missingReviewIsNoOp() {
        when(reviewRepo.findById(REVIEW_ID)).thenReturn(Optional.empty());

        service.moderate(REVIEW_ID);

        verifyNoInteractions(adminReviewService);
    }

    @Test
    @DisplayName("an unexpected failure never escapes the async entry point")
    void asyncEntryPointSwallowsFailures() {
        when(moderationSettings.load()).thenThrow(new IllegalStateException("settings down"));

        service.moderateAsync(REVIEW_ID);

        verifyNoInteractions(adminReviewService);
    }

    @Test
    @DisplayName("the daily budget stops paid calls once it is spent")
    void dailyLimitStopsAiCalls() {
        givenSettings(true, "", Set.of(ReviewModerationCategory.values()), 200);
        givenCallsSpentToday(200);

        service.moderate(REVIEW_ID);

        ReviewModerationOutcome outcome = captureOutcome();
        assertThat(outcome.source()).isEqualTo(ReviewModerationOutcome.SOURCE_SKIPPED);
        assertThat(outcome.blocked()).isFalse();
        assertThat(outcome.reason())
                .isEqualTo(ReviewModerationService.REASON_DAILY_LIMIT_REACHED);
        verify(aiClient, never()).classify(anyString(), any());
    }

    @Test
    @DisplayName("under the budget the call still goes through")
    void underDailyLimitStillCalls() {
        givenSettings(true, "", Set.of(ReviewModerationCategory.values()), 200);
        givenCallsSpentToday(199);
        when(aiClient.classify(anyString(), any())).thenReturn(Optional.of(
                new AiReviewModerationClient.AiVerdict(false, List.of(), "")));

        service.moderate(REVIEW_ID);

        assertThat(captureOutcome().source()).isEqualTo(ReviewModerationOutcome.SOURCE_AI);
    }

    @Test
    @DisplayName("a limit of zero switches the paid layer off entirely")
    void zeroLimitDisablesAi() {
        givenSettings(true, "", Set.of(ReviewModerationCategory.values()), 0);

        service.moderate(REVIEW_ID);

        assertThat(captureOutcome().reason())
                .isEqualTo(ReviewModerationService.REASON_DAILY_LIMIT_REACHED);
        verify(aiClient, never()).classify(anyString(), any());
    }

    @Test
    @DisplayName("the free banned-word layer keeps working after the budget is gone")
    void bannedWordsStillBlockAfterLimit() {
        givenSettings(true, "lừa đảo", Set.of(ReviewModerationCategory.values()), 0);
        givenReview("PENDING", "shop nay lua dao");

        service.moderate(REVIEW_ID);

        ReviewModerationOutcome outcome = captureOutcome();
        assertThat(outcome.source()).isEqualTo(ReviewModerationOutcome.SOURCE_RULE);
        assertThat(outcome.blocked()).isTrue();
        verify(aiClient, never()).classify(anyString(), any());
    }
}
