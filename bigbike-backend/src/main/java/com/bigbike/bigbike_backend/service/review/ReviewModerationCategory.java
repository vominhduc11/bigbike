package com.bigbike.bigbike_backend.service.review;

import java.util.Locale;
import java.util.Optional;

/**
 * Violation classes the automatic review moderator can report (REVIEW_RULE_012).
 *
 * <p>Each category carries the status a blocked review lands in. Advertising is
 * commercial noise rather than abuse, so it goes to {@code SPAM}; the other three are
 * content the shop does not want kept in the moderation queue at all and go to
 * {@code TRASH}, which stays restorable.
 */
public enum ReviewModerationCategory {

    PROFANITY("TRASH", "review_moderation_block_profanity"),
    HARASSMENT("TRASH", "review_moderation_block_harassment"),
    ADVERTISING("SPAM", "review_moderation_block_advertising"),
    SENSITIVE("TRASH", "review_moderation_block_sensitive");

    private final String targetStatus;
    private final String settingKey;

    ReviewModerationCategory(String targetStatus, String settingKey) {
        this.targetStatus = targetStatus;
        this.settingKey = settingKey;
    }

    /** Review status a block of this category moves the review to. */
    public String targetStatus() {
        return targetStatus;
    }

    /** Settings key that switches blocking for this category on or off. */
    public String settingKey() {
        return settingKey;
    }

    /**
     * Parses a category name coming back from the AI. Unknown names are ignored rather
     * than failing the whole verdict — a provider that invents a category must never be
     * able to block a review through a code path nobody reviewed.
     */
    public static Optional<ReviewModerationCategory> parse(String raw) {
        if (raw == null || raw.isBlank()) {
            return Optional.empty();
        }
        try {
            return Optional.of(valueOf(raw.trim().toUpperCase(Locale.ROOT)));
        } catch (IllegalArgumentException ignored) {
            return Optional.empty();
        }
    }
}
