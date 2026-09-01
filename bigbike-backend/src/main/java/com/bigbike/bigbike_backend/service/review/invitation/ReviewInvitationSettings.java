package com.bigbike.bigbike_backend.service.review.invitation;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class ReviewInvitationSettings {

    public static final int DELAY_DAYS = 7;
    public static final int DAILY_LIMIT = 20;

    private final boolean enabled;

    public ReviewInvitationSettings(
            @Value("${bigbike.review-invitation.enabled:true}") boolean enabled) {
        this.enabled = enabled;
    }

    public Snapshot get() {
        return new Snapshot(enabled, DELAY_DAYS, DAILY_LIMIT);
    }

    public record Snapshot(boolean enabled, int delayDays, int dailyLimit) {}
}
