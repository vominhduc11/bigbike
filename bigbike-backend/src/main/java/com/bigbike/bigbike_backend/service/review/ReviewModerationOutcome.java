package com.bigbike.bigbike_backend.service.review;

import java.util.List;
import java.util.Optional;

/**
 * What the automatic moderator concluded about one review (REVIEW_RULE_012).
 *
 * @param source       which layer produced this: {@code RULE}, {@code AI} or {@code SKIPPED}.
 * @param blocked      true when the review must leave {@code PENDING}. Always false for
 *                     {@code SKIPPED} — a moderator that could not run never blocks.
 * @param targetStatus status a blocked review moves to; {@code null} when not blocked.
 * @param categories   every violation recognised, including categories the shop has
 *                     switched off. Those are notes for the human moderator only.
 * @param blocking     the subset of {@code categories} that is switched on and therefore
 *                     actually caused the block. Empty for a banned-word hit, which is an
 *                     explicit shop instruction rather than a categorised judgement.
 * @param reason       short Vietnamese explanation for the moderator, or a machine reason
 *                     code when skipped. Never copied into audit (REVIEW_RULE_011).
 */
public record ReviewModerationOutcome(
        String source,
        boolean blocked,
        String targetStatus,
        List<ReviewModerationCategory> categories,
        List<ReviewModerationCategory> blocking,
        String reason
) {

    public static final String SOURCE_RULE = "RULE";
    public static final String SOURCE_AI = "AI";
    public static final String SOURCE_SKIPPED = "SKIPPED";

    public static final String STATUS_SPAM = "SPAM";
    public static final String STATUS_TRASH = "TRASH";

    public ReviewModerationOutcome {
        categories = categories == null ? List.of() : List.copyOf(categories);
        blocking = blocking == null ? List.of() : List.copyOf(blocking);
        // The headline safety property of REVIEW_RULE_012 — "the automatic moderator can
        // block but never publish" — is enforced here rather than left to the factories'
        // good behaviour. Any future caller that tries to route a review to APPROVED (or
        // anywhere else) fails loudly at construction instead of quietly publishing
        // customer text that no human ever read.
        if (targetStatus != null
                && !STATUS_SPAM.equals(targetStatus)
                && !STATUS_TRASH.equals(targetStatus)) {
            throw new IllegalArgumentException(
                    "Automatic moderation may only target SPAM or TRASH, got: " + targetStatus);
        }
        if (blocked && targetStatus == null) {
            throw new IllegalArgumentException("A blocking outcome must carry a target status.");
        }
        if (!blocked && targetStatus != null) {
            throw new IllegalArgumentException("A non-blocking outcome must not carry a target status.");
        }
    }

    /** Could not run: disabled, unconfigured, empty comment, timeout, malformed answer. */
    public static ReviewModerationOutcome skipped(String reasonCode) {
        return new ReviewModerationOutcome(SOURCE_SKIPPED, false, null, List.of(), List.of(), reasonCode);
    }

    /** Nothing found, or everything found is switched off. Review stays {@code PENDING}. */
    public static ReviewModerationOutcome clean(
            String source,
            List<ReviewModerationCategory> notedCategories,
            String reason
    ) {
        return new ReviewModerationOutcome(source, false, null, notedCategories, List.of(), reason);
    }

    /**
     * Banned-word hit. Goes to the restorable trash and is not category-scoped: the shop
     * typed the word into its own blocklist, so the four AI category switches do not gate it.
     */
    public static ReviewModerationOutcome blockedByBannedWord(String matchedTerm) {
        return new ReviewModerationOutcome(
                SOURCE_RULE,
                true,
                STATUS_TRASH,
                List.of(),
                List.of(),
                "Chứa từ cấm: " + matchedTerm);
    }

    /**
     * AI block. {@code TRASH} wins over {@code SPAM} when a review trips both kinds at once:
     * pulling abuse out of the queue is the safer of the two outcomes.
     */
    public static ReviewModerationOutcome blockedByAi(
            List<ReviewModerationCategory> allCategories,
            List<ReviewModerationCategory> blockingCategories,
            String reason
    ) {
        boolean anyTrash = blockingCategories.stream()
                .anyMatch(category -> STATUS_TRASH.equals(category.targetStatus()));
        return new ReviewModerationOutcome(
                SOURCE_AI,
                true,
                anyTrash ? STATUS_TRASH : STATUS_SPAM,
                allCategories,
                blockingCategories,
                reason);
    }

    /** {@code CLEAN} or {@code BLOCKED} — the value persisted to {@code moderation_verdict}. */
    public String verdict() {
        return blocked ? "BLOCKED" : "CLEAN";
    }

    public Optional<String> resolvedTargetStatus() {
        return blocked ? Optional.ofNullable(targetStatus) : Optional.empty();
    }

    public List<String> categoryNames() {
        return categories.stream().map(Enum::name).toList();
    }
}
