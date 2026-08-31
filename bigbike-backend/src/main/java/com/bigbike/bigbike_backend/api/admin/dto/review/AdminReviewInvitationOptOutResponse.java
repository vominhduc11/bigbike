package com.bigbike.bigbike_backend.api.admin.dto.review;

import java.time.Instant;

public record AdminReviewInvitationOptOutResponse(
        String email,
        Instant optedOutAt,
        String source
) {}
