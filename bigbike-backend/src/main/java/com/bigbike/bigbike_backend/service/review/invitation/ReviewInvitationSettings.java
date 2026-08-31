package com.bigbike.bigbike_backend.service.review.invitation;

import com.bigbike.bigbike_backend.persistence.entity.settings.SiteSettingEntity;
import com.bigbike.bigbike_backend.persistence.repository.settings.SiteSettingJpaRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class ReviewInvitationSettings {

    public static final String ENABLED_KEY = "review_invitation_enabled";
    public static final String DELAY_DAYS_KEY = "review_invitation_delay_days";
    public static final String DAILY_LIMIT_KEY = "review_invitation_daily_limit";

    private static final int DEFAULT_DELAY_DAYS = 7;
    private static final int DEFAULT_DAILY_LIMIT = 20;

    private final SiteSettingJpaRepository settingRepository;

    public Snapshot get() {
        return new Snapshot(
                readBoolean(ENABLED_KEY, false),
                readInt(DELAY_DAYS_KEY, DEFAULT_DELAY_DAYS, 1, 90),
                readInt(DAILY_LIMIT_KEY, DEFAULT_DAILY_LIMIT, 1, 50));
    }

    private boolean readBoolean(String key, boolean fallback) {
        return settingRepository.findBySettingKey(key)
                .map(SiteSettingEntity::getSettingValue)
                .map(String::trim)
                .filter(value -> "true".equalsIgnoreCase(value) || "false".equalsIgnoreCase(value))
                .map(Boolean::parseBoolean)
                .orElse(fallback);
    }

    private int readInt(String key, int fallback, int min, int max) {
        String raw = settingRepository.findBySettingKey(key)
                .map(SiteSettingEntity::getSettingValue)
                .orElse(null);
        if (raw == null) {
            return fallback;
        }
        try {
            int value = Integer.parseInt(raw.trim());
            return Math.max(min, Math.min(max, value));
        } catch (NumberFormatException ignored) {
            return fallback;
        }
    }

    public record Snapshot(boolean enabled, int delayDays, int dailyLimit) {}
}
