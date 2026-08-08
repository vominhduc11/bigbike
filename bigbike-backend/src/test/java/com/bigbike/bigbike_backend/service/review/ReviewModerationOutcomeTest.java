package com.bigbike.bigbike_backend.service.review;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

/**
 * Structural guard on the core safety property of REVIEW_RULE_012: the automatic moderator
 * may block a review but may never publish one.
 */
class ReviewModerationOutcomeTest {

    @ParameterizedTest(name = "target \"{0}\" is rejected at construction")
    @ValueSource(strings = {"APPROVED", "PENDING", "approved", "PUBLISHED", ""})
    @DisplayName("no outcome can route a review anywhere except SPAM or TRASH")
    void rejectsAnyTargetOtherThanSpamOrTrash(String target) {
        assertThatThrownBy(() -> new ReviewModerationOutcome(
                ReviewModerationOutcome.SOURCE_AI, true, target, List.of(), List.of(), "x"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("SPAM or TRASH");
    }

    @Test
    @DisplayName("a block must say where it goes, and a non-block must not")
    void blockedAndTargetStatusStayConsistent() {
        assertThatThrownBy(() -> new ReviewModerationOutcome(
                ReviewModerationOutcome.SOURCE_AI, true, null, List.of(), List.of(), "x"))
                .isInstanceOf(IllegalArgumentException.class);

        assertThatThrownBy(() -> new ReviewModerationOutcome(
                ReviewModerationOutcome.SOURCE_AI, false, "TRASH", List.of(), List.of(), "x"))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    @DisplayName("every factory produces a legal outcome")
    void factoriesProduceLegalOutcomes() {
        ReviewModerationOutcome skipped = ReviewModerationOutcome.skipped("DISABLED");
        assertThat(skipped.blocked()).isFalse();
        assertThat(skipped.resolvedTargetStatus()).isEmpty();
        assertThat(skipped.verdict()).isEqualTo("CLEAN");

        ReviewModerationOutcome clean = ReviewModerationOutcome.clean(
                ReviewModerationOutcome.SOURCE_AI, List.of(ReviewModerationCategory.ADVERTISING), "note");
        assertThat(clean.blocked()).isFalse();
        assertThat(clean.categoryNames()).containsExactly("ADVERTISING");

        ReviewModerationOutcome word = ReviewModerationOutcome.blockedByBannedWord("lừa đảo");
        assertThat(word.resolvedTargetStatus()).contains("TRASH");
        assertThat(word.verdict()).isEqualTo("BLOCKED");
        assertThat(word.reason()).contains("lừa đảo");

        ReviewModerationOutcome ad = ReviewModerationOutcome.blockedByAi(
                List.of(ReviewModerationCategory.ADVERTISING),
                List.of(ReviewModerationCategory.ADVERTISING),
                "link");
        assertThat(ad.resolvedTargetStatus()).contains("SPAM");
    }

    @Test
    @DisplayName("the category-to-status map itself never points at a publishing status")
    void noCategoryTargetsAPublishingStatus() {
        for (ReviewModerationCategory category : ReviewModerationCategory.values()) {
            assertThat(category.targetStatus()).isIn("SPAM", "TRASH");
        }
    }
}
