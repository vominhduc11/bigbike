package com.bigbike.bigbike_backend.service.review;

import com.bigbike.bigbike_backend.persistence.repository.settings.SiteSettingJpaRepository;
import java.util.EnumSet;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Reads the shop-managed switches for automatic review moderation (REVIEW_RULE_013).
 *
 * <p>Values are read per review rather than cached so a moderator who flips a switch in
 * Settings sees it take effect on the next review, with no restart and no cache to
 * invalidate. One review is one read of six small rows — not a hot path.
 */
@Component
@RequiredArgsConstructor
public class ReviewModerationSettings {

    public static final String KEY_ENABLED = "review_moderation_enabled";
    public static final String KEY_BANNED_WORDS = "review_moderation_banned_words";
    public static final String KEY_DAILY_LIMIT = "review_moderation_daily_limit";
    public static final String SETTING_GROUP = "review_moderation";

    /**
     * Used when the row is missing or unreadable. Deliberately a real ceiling rather than
     * "unlimited": a settings row that fails to parse must not silently uncap spending.
     */
    static final int DEFAULT_DAILY_LIMIT = 200;

    private final SiteSettingJpaRepository settingRepo;

    @Transactional(readOnly = true)
    public Snapshot load() {
        boolean enabled = readBoolean(KEY_ENABLED);
        Set<ReviewModerationCategory> blocking = EnumSet.noneOf(ReviewModerationCategory.class);
        for (ReviewModerationCategory category : ReviewModerationCategory.values()) {
            if (readBoolean(category.settingKey())) {
                blocking.add(category);
            }
        }
        return new Snapshot(enabled, blocking, readString(KEY_BANNED_WORDS), readDailyLimit());
    }

    private int readDailyLimit() {
        String raw = readString(KEY_DAILY_LIMIT);
        if (raw.isEmpty()) {
            return DEFAULT_DAILY_LIMIT;
        }
        try {
            int parsed = Integer.parseInt(raw);
            return parsed < 0 ? DEFAULT_DAILY_LIMIT : parsed;
        } catch (NumberFormatException ignored) {
            return DEFAULT_DAILY_LIMIT;
        }
    }

    private boolean readBoolean(String key) {
        return "true".equalsIgnoreCase(readString(key));
    }

    private String readString(String key) {
        return settingRepo.findBySettingKey(key)
                .map(setting -> setting.getSettingValue() == null ? "" : setting.getSettingValue().trim())
                .orElse("");
    }

    /**
     * @param enabled            master switch; false leaves every review at {@code PENDING}.
     * @param blockingCategories categories the shop wants acted on. A category outside this
     *                           set may still be reported by the AI, but only as a note.
     * @param bannedWordsRaw     raw settings text for {@link ReviewBannedWordMatcher}.
     * @param dailyLimit         maximum paid AI calls per Vietnamese calendar day. {@code 0}
     *                           switches the AI layer off entirely while leaving the free
     *                           banned-word layer running.
     */
    public record Snapshot(
            boolean enabled,
            Set<ReviewModerationCategory> blockingCategories,
            String bannedWordsRaw,
            int dailyLimit
    ) {
        public Snapshot {
            blockingCategories = blockingCategories == null
                    ? Set.of()
                    : Set.copyOf(blockingCategories);
        }
    }
}
