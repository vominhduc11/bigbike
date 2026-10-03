package com.bigbike.bigbike_backend.service.review;

import com.bigbike.bigbike_backend.persistence.repository.settings.SiteSettingJpaRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Reads the stored banned words and daily budget for automatic moderation (REVIEW_RULE_013).
 *
 * <p>Moderation always checks all four categories. Legacy master/category flags remain
 * stored for compatibility but are never read here, including after restart or a fresh
 * installation. The two effective values are read per review rather than cached.
 */
@Component
@RequiredArgsConstructor
public class ReviewModerationSettings {

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
        return new Snapshot(readString(KEY_BANNED_WORDS), readDailyLimit());
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

    private String readString(String key) {
        return settingRepo.findBySettingKey(key)
                .map(setting -> setting.getSettingValue() == null ? "" : setting.getSettingValue().trim())
                .orElse("");
    }

    /**
     * @param bannedWordsRaw     raw settings text for {@link ReviewBannedWordMatcher}.
     * @param dailyLimit         maximum paid AI calls per Vietnamese calendar day. {@code 0}
     *                           switches the AI layer off entirely while leaving the free
     *                           banned-word layer running.
     */
    public record Snapshot(
            String bannedWordsRaw,
            int dailyLimit
    ) {}
}
