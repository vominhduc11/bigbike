package com.bigbike.bigbike_backend.service.review.invitation;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import org.springframework.stereotype.Component;

@Component
public class ReviewInvitationClock {

    public static final ZoneId VIETNAM_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");

    public Instant now() {
        return Instant.now();
    }

    public LocalDate todayInVietnam() {
        return LocalDate.now(VIETNAM_ZONE);
    }
}
